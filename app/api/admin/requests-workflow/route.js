import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import dbConnect from "@/lib/mongodb";
import { getModelForCompany } from "@/models/Request";
import {
  buildAdminWorkflowListQuery,
  getAdminWorkflowAccess,
} from "@/lib/adminRequestsWorkflowCommon";
import mongoose from "mongoose";

export const runtime = "nodejs";

async function listMerged(companyList, queryBase, select, page, pageSize) {
  const docsByCompany = await Promise.all(
    companyList.map(async (companyKey) => {
      const Model = getModelForCompany(companyKey);
      let q = Model.find(queryBase).sort({ createdAt: -1 });
      if (select) q = q.select(select);
      const docs = await q.lean();
      return (docs || []).map((d) => ({ ...d, companyKey }));
    })
  );

  const merged = docsByCompany.flat();
  merged.sort((a, b) => {
    const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return tb - ta;
  });

  const total = merged.length;
  const totalPages = total ? Math.ceil(total / pageSize) : 0;
  const start = (page - 1) * pageSize;
  const slice = merged.slice(start, start + pageSize);

  return { slice, total, totalPages };
}

async function listPagedSingleCompany(companyKey, queryBase, select, page, pageSize) {
  const Model = getModelForCompany(companyKey);
  const skip = (page - 1) * pageSize;

  const [total, docs] = await Promise.all([
    Model.countDocuments(queryBase),
    Model.find(queryBase)
      .select(select)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pageSize)
      .lean(),
  ]);

  const rows = (docs || []).map((d) => ({ ...d, companyKey }));
  const totalPages = total ? Math.ceil(total / pageSize) : 0;
  return { slice: rows, total, totalPages };
}

function toListRow(doc) {
  const steps = doc?.workflow?.steps;
  const last = Array.isArray(steps) && steps.length ? steps[steps.length - 1] : null;
  const hasVoucherOut = Boolean(last?.voucherProcessedAt);
  return {
    _id: doc._id,
    companyKey: doc.companyKey,
    requestCode: doc.requestCode || "",
    description: doc.description || "",
    status: doc.status,
    currentStep: doc.currentStep,
    createdBy: doc.createdBy,
    createdAt: doc.createdAt,
    workflowName: doc?.workflow?.name || "",
    stepsCount: Array.isArray(steps) ? steps.length : 0,
    hasVoucherOut,
  };
}

/**
 * GET — قائمة طلبات (للمستخدمين بصلاحية MANAGE_PERMISSIONS فقط)
 * Query: company (اختياري), requestCode (اختياري، جزئي), disbursed=yes|no (اختياري),
 * lastStepUser=ObjectId (اختياري: طلبات آخر خطوة فيها مستخدم واحد فقط وهذا المعرّف)
 */
export async function GET(req) {
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
      return NextResponse.json({
        success: true,
        data: [],
        meta: { total: 0, totalPages: 0, page: 1, pageSize: 25 },
        filters: { companies: [] },
      });
    }

    const { searchParams } = new URL(req.url);
    const companyParam = String(searchParams.get("company") || "").trim();
    const codeQ = String(searchParams.get("requestCode") || "").trim();
    const disbursed = String(searchParams.get("disbursed") || "").trim();
    const lastStepUser = String(searchParams.get("lastStepUser") || "").trim();

    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const pageSize = Math.min(
      100,
      Math.max(5, parseInt(searchParams.get("pageSize") || "25", 10))
    );

    let companyList = allowedCompanies;
    if (companyParam) {
      if (!allowedCompanies.includes(companyParam)) {
        return NextResponse.json(
          { success: false, error: "No access to this company" },
          { status: 403 }
        );
      }
      companyList = [companyParam];
    }

    const queryBase = buildAdminWorkflowListQuery({ codeQ, disbursed, lastStepUserId: lastStepUser });

    const select =
      "requestCode description status currentStep createdBy createdAt workflow.name workflow.steps";

    let slice;
    let total;
    let totalPages;

    if (companyList.length === 1) {
      ({ slice, total, totalPages } = await listPagedSingleCompany(
        companyList[0],
        queryBase,
        select,
        page,
        pageSize
      ));
    } else {
      ({ slice, total, totalPages } = await listMerged(
        companyList,
        queryBase,
        select,
        page,
        pageSize
      ));
    }

    const data = slice.map(toListRow);

    return NextResponse.json({
      success: true,
      data,
      meta: { total, totalPages, page, pageSize },
      filters: { companies: allowedCompanies },
    });
  } catch (err) {
    console.error("admin requests-workflow list:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Server error" },
      { status: 500 }
    );
  }
}
