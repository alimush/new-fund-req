import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import mongoose from "mongoose";
import dbConnect from "@/lib/mongodb";
import { getModelForCompany } from "@/models/Request";
import {
  buildAdminWorkflowListQuery,
  buildIncomingStepsForLastStepOnlyMerge,
  getAdminWorkflowAccess,
  lastStepUsersSignature,
  mergeAdminWorkflowSteps,
} from "@/lib/adminRequestsWorkflowCommon";

export const runtime = "nodejs";

const BULK_MAX = 250;

async function collectMatching(companyList, queryBase) {
  const out = [];
  for (const companyKey of companyList) {
    const Model = getModelForCompany(companyKey);
    const docs = await Model.find(queryBase)
      .select("_id companyKey workflow.steps workflow.name")
      .lean();
    for (const d of docs) {
      out.push({ ...d, companyKey: d.companyKey || companyKey });
    }
  }
  return out;
}

/**
 * POST — تحقق جاف أو تطبيق تعديل وورك فلو على كل الطلبات المطابقة للفلتر
 * Body: { dryRun, company?, requestCode?, disbursed?, lastStepUser?, workflow? }
 */
export async function POST(req) {
  try {
    await dbConnect();

    const cookieStore = await cookies();
    const userIdRaw = cookieStore.get("userId")?.value;
    if (!userIdRaw || !mongoose.Types.ObjectId.isValid(userIdRaw)) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const userId = new mongoose.Types.ObjectId(userIdRaw);
    const { allowedCompanies, hasManage } = await getAdminWorkflowAccess(userId);

    if (!hasManage) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    if (!allowedCompanies.length) {
      return NextResponse.json({ success: false, error: "لا شركات ضمن صلاحيتك" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const dryRun = Boolean(body.dryRun);
    const companyParam = String(body.company || "").trim();
    const codeQ = String(body.requestCode || "").trim();
    const disbursed = String(body.disbursed || "").trim();
    const lastStepUser = String(body.lastStepUser || "").trim();

    let companyList = allowedCompanies;
    if (companyParam) {
      if (!allowedCompanies.includes(companyParam)) {
        return NextResponse.json(
          { success: false, error: "لا صلاحية لهذه الشركة" },
          { status: 403 }
        );
      }
      companyList = [companyParam];
    }

    const queryBase = buildAdminWorkflowListQuery({
      codeQ,
      disbursed,
      lastStepUserId: lastStepUser,
    });
    const all = await collectMatching(companyList, queryBase);

    if (all.length === 0) {
      return NextResponse.json({
        success: true,
        dryRun,
        count: 0,
        uniform: false,
        message: "لا توجد طلبات مطابقة للفلتر.",
      });
    }

    if (all.length > BULK_MAX) {
      return NextResponse.json(
        {
          success: false,
          error: `عدد الطلبات المطابقة (${all.length}) يتجاوز الحد (${BULK_MAX}). ضيّق الفلتر (شركة، رقم طلب، مصروف/غير مصروف).`,
          count: all.length,
          max: BULK_MAX,
        },
        { status: 400 }
      );
    }

    const sigs = [...new Set(all.map((d) => lastStepUsersSignature(d.workflow?.steps)))];
    const uniform = sigs.length === 1;

    if (!uniform) {
      const bySig = {};
      for (const d of all) {
        const k = lastStepUsersSignature(d.workflow?.steps);
        bySig[k] = (bySig[k] || 0) + 1;
      }
      return NextResponse.json({
        success: true,
        dryRun,
        count: all.length,
        uniform: false,
        message:
          "الطلبات المطابقة للفلتر لا تتشارك نفس الموافقين على آخر خطوة. استخدم التعديل الفردي أو ضيّق الفلتر.",
        signatureGroups: bySig,
      });
    }

    const first = all[0];
    const firstSteps = first.workflow?.steps || [];
    const lastStep = firstSteps.length ? firstSteps[firstSteps.length - 1] : null;
    const templateWorkflow = {
      name: String(first.workflow?.name || ""),
      lastStepOnly: true,
      steps: [
        {
          users: (Array.isArray(lastStep?.users) ? lastStep.users : []).map((u) => String(u)),
        },
      ],
    };

    if (dryRun) {
      return NextResponse.json({
        success: true,
        dryRun: true,
        count: all.length,
        uniform: true,
        max: BULK_MAX,
        workflow: templateWorkflow,
      });
    }

    const wf = body.workflow;
    if (!wf || !Array.isArray(wf.steps)) {
      return NextResponse.json(
        { success: false, error: "workflow.steps مطلوب للتطبيق" },
        { status: 400 }
      );
    }

    if (wf.steps.length === 0) {
      return NextResponse.json(
        { success: false, error: "يلزم خطوة واحدة على الأقل" },
        { status: 400 }
      );
    }

    if (wf.steps.length !== 1) {
      return NextResponse.json(
        {
          success: false,
          error: "التعديل الجماعي يرسل خطوة واحدة فقط (الخطوة الأخيرة).",
        },
        { status: 400 }
      );
    }

    const allAgain = await collectMatching(companyList, queryBase);
    if (allAgain.length !== all.length) {
      return NextResponse.json(
        { success: false, error: "تغيّر عدد الطلبات أثناء التنفيذ. أعد المحاولة." },
        { status: 409 }
      );
    }
    const sigs2 = [...new Set(allAgain.map((d) => lastStepUsersSignature(d.workflow?.steps)))];
    if (sigs2.length !== 1 || sigs2[0] !== sigs[0]) {
      return NextResponse.json(
        { success: false, error: "تغيّر موافقو آخر خطوة لبعض الطلبات. أعد التحقق." },
        { status: 409 }
      );
    }

    let updated = 0;
    const errors = [];

    for (const d of allAgain) {
      try {
        const Model = getModelForCompany(d.companyKey);
        const request = await Model.findById(d._id);
        if (!request) {
          errors.push({ id: String(d._id), error: "غير موجود" });
          continue;
        }

        let merged;
        try {
          const prevSteps = request.workflow?.steps || [];
          const incomingFull = buildIncomingStepsForLastStepOnlyMerge(prevSteps, wf.steps[0]);
          merged = mergeAdminWorkflowSteps(prevSteps, incomingFull);
        } catch (e) {
          if (e.code === "EMPTY_STEP_USERS") {
            errors.push({ id: String(d._id), error: "خطوة بلا مستخدمين" });
            continue;
          }
          if (e.code === "NO_WORKFLOW_STEPS") {
            errors.push({ id: String(d._id), error: "لا خطوات وورك فلو" });
            continue;
          }
          throw e;
        }

        request.workflow = request.workflow || {};
        request.workflow.steps = merged;
        if (typeof wf.name === "string") {
          request.workflow.name = wf.name.trim();
        }

        let cs = Number.isInteger(request.currentStep) ? request.currentStep : 0;
        if (merged.length === 0) {
          cs = 0;
        } else if (cs >= merged.length) {
          cs = merged.length - 1;
        } else if (cs < 0) {
          cs = 0;
        }
        request.currentStep = cs;

        request.markModified("workflow");
        await request.save();
        updated += 1;
      } catch (e) {
        errors.push({ id: String(d._id), error: e?.message || "خطأ" });
      }
    }

    return NextResponse.json({
      success: true,
      dryRun: false,
      updated,
      failed: errors.length,
      errors: errors.length ? errors.slice(0, 20) : undefined,
    });
  } catch (err) {
    console.error("admin requests-workflow bulk:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Server error" },
      { status: 500 }
    );
  }
}
