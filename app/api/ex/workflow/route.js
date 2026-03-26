import dbConnect from "@/lib/mongodb";
import ExWorkflow from "@/models/ExWorkflow";
import Permissions from "@/models/Permissions";
import { NextResponse } from "next/server";
import mongoose from "mongoose";

// ✅ يجيب الفورمات من registry (Server-side)
import { EX_FORMS } from "@/lib/exForms/registry";

export const runtime = "nodejs";

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

function normalizeEmails(list = []) {
  return [...new Set(
    (Array.isArray(list) ? list : [])
      .map((x) => String(x || "").trim().toLowerCase())
      .filter(Boolean)
  )];
}

// ✅ سماح pageKey من الفورمات + الاستثناءات
function isAllowedPageKey(k) {
  const key = String(k || "").trim();
  if (!key) return false;

  // forms الموجودة بالـ registry
  if (EX_FORMS && EX_FORMS[key]) return true;

  // صفحات خاصة مو ضمن EX_FORMS
  if (key === "exceptions") return true;

  return false;
}

// ✅ تحقق MANAGE_PERMISSIONS
async function requireManagePermissions(req) {
  await dbConnect();

  const userId = req.headers.get("x-user-id");
  if (!userId) return { ok: false, status: 401, message: "Missing userId" };

  const groups = await Permissions.find({ users: userId }).lean();
  const perms = [...new Set(groups.flatMap((g) => g.permissions || []))];

  if (!perms.includes("MANAGE_PERMISSIONS")) {
    return { ok: false, status: 403, message: "Forbidden" };
  }

  return { ok: true, userId, perms };
}

const populateUser = {
  path: "steps.users",
  model: "User",
  strictPopulate: false,
};

// ======================= GET =======================
export async function GET(req) {
  const auth = await requireManagePermissions(req);
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.message }, { status: auth.status });
  }

  await dbConnect();
  const { searchParams } = new URL(req.url);

  const id = searchParams.get("id");
  const pageKey = (searchParams.get("pageKey") || "").trim();
  const codeParam = searchParams.get("code"); // null إذا مو موجود

  // 1) by id
  if (id) {
    if (!isValidObjectId(id)) {
      return NextResponse.json({ success: false, error: "Invalid workflow id" }, { status: 400 });
    }
    const wf = await ExWorkflow.findById(id).populate(populateUser);
    return NextResponse.json({ success: true, workflow: wf });
  }

  // 2) by pageKey + code (حتى لو code فارغ)
  if (pageKey && codeParam !== null) {
    const codeNorm = (codeParam ?? "").trim();
    const wf = await ExWorkflow.findOne({ pageKey, code: codeNorm }).populate(populateUser);
    return NextResponse.json({ success: true, workflow: wf });
  }

  // 3) by pageKey
  if (pageKey) {
    const list = await ExWorkflow.find({ pageKey }).populate(populateUser);
    return NextResponse.json({ success: true, workflows: list });
  }

  // 4) all
  const all = await ExWorkflow.find().populate(populateUser);
  return NextResponse.json({ success: true, workflows: all });
}

// ======================= POST =======================
export async function POST(req) {
  const auth = await requireManagePermissions(req);
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.message }, { status: auth.status });
  }

  await dbConnect();
  const body = await req.json();

  const { name, pageKey, code, steps, finalApproveEmails = [] } = body;

  if (!name?.trim()) {
    return NextResponse.json({ success: false, error: "name required" }, { status: 400 });
  }
  if (!pageKey?.trim()) {
    return NextResponse.json({ success: false, error: "pageKey required" }, { status: 400 });
  }

  // ✅ validate pageKey موجود بالـ forms
  if (!isAllowedPageKey(pageKey)) {
    return NextResponse.json({ success: false, error: "Invalid pageKey (not in registry)" }, { status: 400 });
  }

  const codeNorm = (code ?? "").trim();

  // ✅ منع تكرار نفس (pageKey + code)
  const exists = await ExWorkflow.findOne({
    pageKey: pageKey.trim(),
    code: codeNorm,
  }).lean();

  if (exists) {
    return NextResponse.json(
      { success: false, error: "Workflow code already exists for this pageKey" },
      { status: 409 }
    );
  }

  const wf = await ExWorkflow.create({
    name: name.trim(),
    pageKey: pageKey.trim(),
    code: codeNorm,
    steps: Array.isArray(steps) ? steps : [],
    finalApproveEmails: normalizeEmails(finalApproveEmails),
  });

  return NextResponse.json({ success: true, workflow: wf });
}

// ======================= PUT =======================
export async function PUT(req) {
  const auth = await requireManagePermissions(req);
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.message }, { status: auth.status });
  }

  await dbConnect();
  const body = await req.json();

  const { id, name, code, steps = [], finalApproveEmails = [] } = body;

  if (!id || !isValidObjectId(id)) {
    return NextResponse.json({ success: false, error: "Valid workflow id required" }, { status: 400 });
  }

  if (!name?.trim()) {
    return NextResponse.json({ success: false, error: "name required" }, { status: 400 });
  }

  // ✅ code اختياري
  const codeNorm = code === undefined ? undefined : (code ?? "").trim();

  // ✅ منع التعارض إذا code مرسل
  if (codeNorm !== undefined) {
    const current = await ExWorkflow.findById(id).lean();
    if (!current) return NextResponse.json({ success: false, error: "Workflow not found" }, { status: 404 });

    const conflict = await ExWorkflow.findOne({
      _id: { $ne: id },
      pageKey: current.pageKey,
      code: codeNorm,
    }).lean();

    if (conflict) {
      return NextResponse.json(
        { success: false, error: "Workflow code already exists for this pageKey" },
        { status: 409 }
      );
    }
  }

  const updateDoc = {
    name: name.trim(),
    steps: Array.isArray(steps) ? steps : [],
    finalApproveEmails: normalizeEmails(finalApproveEmails),

  };

  if (codeNorm !== undefined) updateDoc.code = codeNorm;

  const updated = await ExWorkflow.findByIdAndUpdate(id, updateDoc, { new: true, runValidators: true });
  if (!updated) return NextResponse.json({ success: false, error: "Workflow not found" }, { status: 404 });

  return NextResponse.json({ success: true, workflow: updated });
}

// ======================= DELETE =======================
export async function DELETE(req) {
  const auth = await requireManagePermissions(req);
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.message }, { status: auth.status });
  }

  await dbConnect();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id || !isValidObjectId(id)) {
    return NextResponse.json({ success: false, error: "Valid id is required" }, { status: 400 });
  }

  const wf = await ExWorkflow.findByIdAndDelete(id);
  if (!wf) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });

  return NextResponse.json({ success: true });
}