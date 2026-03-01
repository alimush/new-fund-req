import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import Workflow from "@/models/Workflow";
import { getModelForCompany } from "@/models/Request";
import User from "@/models/User";
import Permissions from "@/models/Permissions";
import mongoose from "mongoose";
import {
  buildRequestCreatedEmailHtml,
  sendWorkflowEmail,
} from "@/lib/email/workflowEmail";
export const runtime = "nodejs";

// =========================
// Counter (RequestCode)
// =========================
const CounterSchema = new mongoose.Schema({
  key: { type: String, unique: true },
  seq: { type: Number, default: 0 },
});

const Counter =
  mongoose.models.Counter || mongoose.model("Counter", CounterSchema);

// =========================
// helpers
// =========================
const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

const norm = (v) => String(v ?? "").trim();
const normLower = (v) => norm(v).toLowerCase();

async function getUserPermissions(userId) {
  if (!userId || !isValidObjectId(userId)) return [];
  const groups = await Permissions.find({
    users: new mongoose.Types.ObjectId(userId),
  }).lean();

  const perms = [...new Set(groups.flatMap((g) => g.permissions || []))];
  return perms.map((x) => String(x));
}

async function hasCompanyAccess(userId, company) {
  if (!userId || !company) return false;
  if (!isValidObjectId(userId)) return false;

  const exists = await Permissions.exists({
    users: new mongoose.Types.ObjectId(userId),
    companies: company,
  });

  return !!exists;
}

async function requireCompanyAccess(req, company) {
  await dbConnect();

  const userId = req.headers.get("x-user-id");
  if (!userId) return { ok: false, status: 401, error: "Missing x-user-id" };
  if (!isValidObjectId(userId))
    return { ok: false, status: 401, error: "Invalid userId" };
  if (!company) return { ok: false, status: 400, error: "Company is required" };

  const allowed = await hasCompanyAccess(userId, company);
  if (!allowed)
    return { ok: false, status: 403, error: "No access to this company" };

  const user = await User.findById(userId).select("username").lean();
  const username = user?.username ? String(user.username) : "";

  const permissions = await getUserPermissions(userId);
  const isAdmin = permissions.includes("ADMIN") || permissions.includes("SUPER_ADMIN");

  return { ok: true, userId, username, permissions, isAdmin };
}

async function canEditOrDeleteRequest({ Model, id, username, isAdmin }) {
  if (isAdmin) return { ok: true };

  const doc = await Model.findById(id).select("createdBy").lean();
  if (!doc) return { ok: false, status: 404, error: "Request not found" };

  const owner = String(doc.createdBy || "");
  if (owner && owner === username) return { ok: true };

  return { ok: false, status: 403, error: "Not allowed" };
}

function buildSearchFilter(q) {
  const t = String(q || "").trim();
  if (!t) return null;

  // regex escape
  const safe = t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const rx = new RegExp(safe, "i");

  return {
    $or: [
      { requestCode: rx },
      { company: rx },
      { companyKey: rx },
      { requestType: rx },
      { description: rx },
      { currency: rx },
      { department: rx },
      { createdBy: rx },
      { projectName: rx },
      // _id as string search (fallback): we can't regex ObjectId directly reliably, so ignore
    ],
  };
}

async function signAttachmentsIfAny(request) {
  if (!request) return request;

  if (Array.isArray(request.attachments) && request.attachments.length > 0) {
    const s3 = new S3Client({
      region: process.env.S3_REGION,
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
      },
    });

    for (const file of request.attachments) {
      if (!file?.key) continue;
      file.url = await getSignedUrl(
        s3,
        new GetObjectCommand({
          Bucket: process.env.S3_BUCKET_NAME,
          Key: file.key,
        }),
        { expiresIn: 3600 }
      );
    }
  }

  return request;
}

/* =========================
   POST → Create Request (PROTECTED)
========================= */
export async function POST(req) {
  try {
    await dbConnect();

    const body = await req.json();
    const company = norm(body.company);

    if (!company) {
      return NextResponse.json(
        { success: false, error: "Company is required" },
        { status: 400 }
      );
    }

    // ✅ حماية + نطلع username الحقيقي
    const auth = await requireCompanyAccess(req, company);
    if (!auth.ok) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status }
      );
    }

    const { userId, username, permissions } = auth;

    // ✅ تحديد هل عنده MARKETING
  // ✅ helper: هل اليوزر يحقق شروط هذا الوركفلو؟
function matchesWorkflowByPerms(workflow, userPerms) {
  const required = workflow?.rules?.requiredPermissions;
  if (!Array.isArray(required) || required.length === 0) return true; // العام ينطبق على الكل
  const set = new Set((userPerms || []).map(String));
  return required.every((p) => set.has(String(p)));
}

// ✅ helper: هل هذا workflow "عام"؟
function isGeneralWorkflow(workflow) {
  const required = workflow?.rules?.requiredPermissions;
  return !Array.isArray(required) || required.length === 0;
}

// ✅ helper: ترتيب لاختيار الأفضل
function workflowScore(workflow) {
  const pri = Number(workflow?.rules?.priority);
  const priority = Number.isFinite(pri) ? pri : 1;
  const requiredCount = Array.isArray(workflow?.rules?.requiredPermissions)
    ? workflow.rules.requiredPermissions.length
    : 0;

  return { priority, requiredCount };
}

// ======================
// ✅ اختيار workflow حسب الصلاحيات
// ======================
let workflow = null;

// 1) جيب كل workflows للشركة
const workflows = await Workflow.find({ company })
  .populate("steps.users")
  .lean();

// 2) فلتر اللي ينطبق على صلاحيات المستخدم
const matched = workflows.filter((wf) => matchesWorkflowByPerms(wf, permissions));

// 3) إذا أكو مطابقين: اختار الأفضل (priority أعلى، وبعدين الأكثر تخصيصًا)
if (matched.length > 0) {
  matched.sort((a, b) => {
    const A = workflowScore(a);
    const B = workflowScore(b);

    // priority desc
    if (B.priority !== A.priority) return B.priority - A.priority;

    // الأكثر شروطًا أولاً (أكثر تخصيص)
    if (B.requiredCount !== A.requiredCount) return B.requiredCount - A.requiredCount;

    // الأحدث أولاً (اختياري)
    const at = new Date(a.updatedAt || a.createdAt || 0).getTime();
    const bt = new Date(b.updatedAt || b.createdAt || 0).getTime();
    return bt - at;
  });

  // إذا موجود workflow متخصص ينطبق -> خذه
  // وإذا كله عام -> هم راح يختار العام
  workflow = matched[0];
}

// 4) إذا ماكو أي workflow ينطبق (يعني المستخدم ما عنده الصلاحيات لأي متخصص)
if (!workflow) {
  // جيب العام (rules.requiredPermissions = [])
  workflow =
    workflows.find((wf) => isGeneralWorkflow(wf)) ||
    null;
}

if (!workflow) {
  return NextResponse.json(
    { success: false, error: "No workflow defined for this company" },
    { status: 400 }
  );
}

    if (!workflow) {
      return NextResponse.json(
        { success: false, error: "No workflow defined for this company" },
        { status: 400 }
      );
    }

    const workflowSnapshot = {
      name: workflow.name,
      steps: workflow.steps.map((s) => ({
        name: s.name || s.title || s.stepName || "",
        users: (s.users || []).map((u) => u?._id || u),
        status: "Pending",
        actedBy: null,
        actedAt: null,
        comment: "",
        attachment: null,
      })),
    };

    const Model = getModelForCompany(company);

    // ✅ createdBy من السيرفر فقط (مو من الفرونت)
    const baseData = {
      companyKey: company,
      company,
      requestType: body.requestType,
      description: body.description,
      projectName: body.projectName,
      currency: body.currency,
      department: body.department,
      createdBy: username || "", // ✅ safe
      items: Array.isArray(body.items) ? body.items : [],
      attachments: Array.isArray(body.attachments) ? body.attachments : [],
      workflow: workflowSnapshot,
      currentStep: 0,
      status: "Pending",
    };

    const companyText = company.toUpperCase().replace(/\s+/g, "-").replace(/-+/g, "-");
    const counterKey = `REQ_${companyText}`;

    for (let attempt = 0; attempt < 5; attempt++) {
      const counter = await Counter.findOneAndUpdate(
        { key: counterKey },
        { $inc: { seq: 1 } },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );

      const serial = String(counter.seq).padStart(5, "0");
      const requestCode = `REQ-${companyText}-${serial}`;

      try {
        const newRequest = new Model({ ...baseData, requestCode });
        await newRequest.save();
        
        /* =========================================================
           ✅ AFTER CREATE: Email to Step 1 users (always)
        ========================================================= */
        try {
          // Step 0 users (first step)
          const step0Ids = newRequest?.workflow?.steps?.[0]?.users || [];
        
          if (Array.isArray(step0Ids) && step0Ids.length > 0) {
            const step0Users = await User.find({ _id: { $in: step0Ids } })
  .select("email username")
  .lean();

// ✅ لا نرسل ايميل للشخص اللي سوّى الكريت إذا هو موجود بالستيب الأول
const filteredUsers = step0Users.filter(
  (u) => String(u.username || "").trim() !== String(username || "").trim()
);

const step0Emails = [
  ...new Set(filteredUsers.map((u) => u.email).filter(Boolean)),
];

// Greeting (إذا بقى شخص واحد بعد الفلترة)
const stepUserName =
  filteredUsers.length === 1 ? String(filteredUsers[0]?.username || "") : "";
        
            if (step0Emails.length > 0) {
              const html = buildRequestCreatedEmailHtml({
                requestId: newRequest._id.toString(),
                company,
                createdBy: username || newRequest.createdBy || "System", // اللي سوّى الكريت
                greetingName: stepUserName || "زميلنا",                  // عزيزي stepuser
                requestCode: newRequest.requestCode || requestCode,
                requestType: newRequest.requestType || "",
                currency: newRequest.currency || "",
                department: newRequest.department || "",
                description: newRequest.description || "",
                totalAmount: newRequest.totalAmount || "",
                baseDomain: "https://funds-gdr.spc-it.com.iq",
              });
        
              await sendWorkflowEmail({
                toEmails: step0Emails,
                subject: `[Workflow] CREATED → Step 1 | ${company}`,
                html,
              });
            }
          }
        } catch (e) {
          console.error("❌ Create email notify failed:", e?.message || e);
        }
        
        return NextResponse.json({ success: true, data: newRequest });
      } catch (e) {
        if (e?.code === 11000 && String(e?.message || "").includes("requestCode")) continue;
        throw e;
      }
    }

    return NextResponse.json(
      { success: false, error: "Could not generate unique requestCode, try again." },
      { status: 409 }
    );
  } catch (err) {
    console.error("❌ POST Error:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "POST failed" },
      { status: 500 }
    );
  }
}

/* =========================
   GET → List OR Single (PROTECTED)
   ✅ scope=mine | pending
   ✅ q= search
   ✅ status=approved|pending|rejected|cancelled|all  (for mine)
========================= */
export async function GET(req) {
  try {
    await dbConnect();

    const { searchParams } = new URL(req.url);
    const company = searchParams.get("company");
    const id = searchParams.get("id");

    const scope = String(searchParams.get("scope") || "mine").toLowerCase();
    const q = String(searchParams.get("q") || "").trim();
    const statusParam = String(searchParams.get("status") || "all").toLowerCase(); // ✅ جديد

    // ✅ حماية
    const auth = await requireCompanyAccess(req, company);
    if (!auth.ok) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status }
      );
    }

    const { userId, username } = auth;
    const Model = getModelForCompany(company);

    // ✅ Single request
    if (id) {
      if (!isValidObjectId(id)) {
        return NextResponse.json(
          { success: false, error: "Invalid id" },
          { status: 400 }
        );
      }

      const request = await Model.findById(id).populate({
        path: "workflow.steps.users",
        model: "User",
        strictPopulate: false,
      });

      if (!request) {
        return NextResponse.json(
          { success: false, error: "Request not found" },
          { status: 404 }
        );
      }

      await signAttachmentsIfAny(request);

      return NextResponse.json({ success: true, data: request });
    }

    // =========================
    // ✅ LIST: mine
    // =========================
    if (scope === "mine") {
      const filter = {
        createdBy: username || "__no_user__",
      };

      // ✅ status filter (اختياري)
      if (statusParam && statusParam !== "all") {
        // نخليها case-insensitive عبر $in
        const s = statusParam[0].toUpperCase() + statusParam.slice(1);
        filter.status = { $in: [s, statusParam] };
      }

      const searchFilter = buildSearchFilter(q);
      const finalFilter = searchFilter ? { $and: [filter, searchFilter] } : filter;

      const list = await Model.find(finalFilter).lean().sort({ createdAt: -1 });

      return NextResponse.json({ success: true, data: list });
    }

    // =========================
    // ✅ LIST: pending approval إلي
    // (step الحالي users بيه userId)
    // =========================
    if (scope === "pending") {
      const uid = new mongoose.Types.ObjectId(userId);

      const pipeline = [
        { $match: { status: { $in: ["Pending", "pending"] } } },
        { $addFields: { _step: { $arrayElemAt: ["$workflow.steps", "$currentStep"] } } },
        {
          $match: {
            "_step.status": { $in: ["Pending", "pending"] },
            "_step.users": { $in: [uid] },
          },
        },
        { $sort: { createdAt: -1 } },
        { $project: { _step: 0 } },
      ];

      const list = await Model.aggregate(pipeline);

      // ✅ search (بعد الـ aggregate) — كافي للأحجام المعتادة
      if (q) {
        const tq = q.toLowerCase();
        const out = list.filter((r) => {
          const text = [
            r.requestCode,
            r.company,
            r.companyKey,
            r.requestType,
            r.description,
            r.currency,
            r.department,
            r.createdBy,
            r._id,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          return text.includes(tq);
        });
        return NextResponse.json({ success: true, data: out });
      }

      return NextResponse.json({ success: true, data: list });
    }

    return NextResponse.json(
      { success: false, error: "Invalid scope. Use scope=mine or scope=pending" },
      { status: 400 }
    );
  } catch (err) {
    console.error("❌ GET Error:", err.message);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}

/* =========================
   PUT → Update Request (PROTECTED)
   ✅ owner OR ADMIN
   ❌ NO WORKFLOW EDIT
========================= */
export async function PUT(req) {
  try {
    await dbConnect();

    const body = await req.json();
    const { id, company, ...updateData } = body;

    if (!id || !company) {
      return NextResponse.json(
        { success: false, error: "ID & Company required" },
        { status: 400 }
      );
    }
    if (!isValidObjectId(id)) {
      return NextResponse.json(
        { success: false, error: "Invalid id" },
        { status: 400 }
      );
    }

    // ✅ حماية
    const auth = await requireCompanyAccess(req, company);
    if (!auth.ok) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status }
      );
    }

    const { username, isAdmin } = auth;
    const Model = getModelForCompany(company);

    // ✅ صلاحية تعديل
    const allow = await canEditOrDeleteRequest({ Model, id, username, isAdmin });
    if (!allow.ok) {
      return NextResponse.json(
        { success: false, error: allow.error },
        { status: allow.status }
      );
    }

    // ✅ امنع تعديل workflow fields
    delete updateData.workflow;
    delete updateData.currentStep;
    delete updateData.approvalHistory;

    updateData.companyKey = company;
    updateData.company = company;

    const updated = await Model.findByIdAndUpdate(id, updateData, { new: true });

    if (!updated) {
      return NextResponse.json(
        { success: false, error: "Request not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (err) {
    console.error("❌ PUT Error:", err.message);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}

/* =========================
   DELETE → Remove Request (PROTECTED)
   ✅ owner OR ADMIN
========================= */
export async function DELETE(req) {
  try {
    await dbConnect();

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const company = searchParams.get("company");

    if (!id || !company) {
      return NextResponse.json(
        { success: false, error: "ID & Company required" },
        { status: 400 }
      );
    }
    if (!isValidObjectId(id)) {
      return NextResponse.json(
        { success: false, error: "Invalid id" },
        { status: 400 }
      );
    }

    // ✅ حماية
    const auth = await requireCompanyAccess(req, company);
    if (!auth.ok) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status }
      );
    }

    const { username, isAdmin } = auth;
    const Model = getModelForCompany(company);

    // ✅ صلاحية حذف
    const allow = await canEditOrDeleteRequest({ Model, id, username, isAdmin });
    if (!allow.ok) {
      return NextResponse.json(
        { success: false, error: allow.error },
        { status: allow.status }
      );
    }

    const deleted = await Model.findByIdAndDelete(id);

    if (!deleted) {
      return NextResponse.json(
        { success: false, error: "Request not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("❌ DELETE Error:", err.message);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}