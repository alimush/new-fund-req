import dbConnect from "@/lib/mongodb";
import Workflow from "@/models/Workflow";
import Permissions from "@/models/Permissions";
import { NextResponse } from "next/server";
import mongoose from "mongoose";

export const runtime = "nodejs";

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

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

// ======================= GET =======================
export async function GET(req) {
  const auth = await requireManagePermissions(req);
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.message }, { status: auth.status });
  }

  await dbConnect();
  const { searchParams } = new URL(req.url);

  const id = searchParams.get("id");
  const company = (searchParams.get("company") || "").trim();

  // ✅ مهم: نخليه كـ param حتى لو فارغ
  const codeParam = searchParams.get("code"); // null إذا مو موجود

  const populateUser = {
    path: "steps.users",
    model: "User",
    strictPopulate: false,
  };

  // 1) by id
  if (id) {
    if (!isValidObjectId(id)) {
      return NextResponse.json({ success: false, error: "Invalid workflow id" }, { status: 400 });
    }
    const wf = await Workflow.findById(id).populate(populateUser);
    return NextResponse.json({ success: true, workflow: wf });
  }

  // 2) by company + code (حتى لو code فارغ)
  if (company && codeParam !== null) {
    const codeNorm = (codeParam ?? "").trim(); // يسمح ""
    const wf = await Workflow.findOne({ company, code: codeNorm }).populate(populateUser);
    return NextResponse.json({ success: true, workflow: wf });
  }

  // 3) by company (كل الووركفلوات للشركة)
  if (company) {
    const list = await Workflow.find({ company }).populate(populateUser);
    return NextResponse.json({ success: true, workflows: list });
  }

  // 4) all
  const all = await Workflow.find().populate(populateUser);
  return NextResponse.json({ success: true, workflows: all });
}

// ======================= POST =======================
// Create جديد دائماً
export async function POST(req) {
  const auth = await requireManagePermissions(req);
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.message }, { status: auth.status });
  }

  await dbConnect();
  const body = await req.json();

  const { name, company, code, steps } = body;

  if (!name?.trim()) {
    return NextResponse.json({ success: false, error: "name required" }, { status: 400 });
  }

  if (!company?.trim()) {
    return NextResponse.json({ success: false, error: "company required" }, { status: 400 });
  }

  // ✅ code اختياري (الافتراضي بدون كود)
  const codeNorm = (code ?? "").trim();

  // ✅ منع تكرار نفس (company + code)
  const exists = await Workflow.findOne({
    company: company.trim(),
    code: codeNorm,
  }).lean();

  if (exists) {
    return NextResponse.json(
      { success: false, error: "Workflow code already exists for this company" },
      { status: 409 }
    );
  }

  const wf = await Workflow.create({
    name: name.trim(),
    company: company.trim(),
    code: codeNorm, // "" للوركفلو الأول
    steps: Array.isArray(steps) ? steps : [],
  });

  return NextResponse.json({ success: true, workflow: wf });
}

// ======================= PUT =======================
// Update by ID فقط
export async function PUT(req) {
  const auth = await requireManagePermissions(req);
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.message }, { status: auth.status });
  }

  await dbConnect();
  const body = await req.json();

  const { id, name, code, steps = [] } = body;

  if (!id || !isValidObjectId(id)) {
    return NextResponse.json({ success: false, error: "Valid workflow id required" }, { status: 400 });
  }

  if (!name?.trim()) {
    return NextResponse.json({ success: false, error: "name required" }, { status: 400 });
  }

  // ✅ code اختياري (تقدر تغيّره لفارغ أو قيمة)
  const codeNorm = code === undefined ? undefined : (code ?? "").trim();

  // ✅ منع التعارض إذا code مرسل
  if (codeNorm !== undefined) {
    const current = await Workflow.findById(id).lean();
    if (!current) {
      return NextResponse.json({ success: false, error: "Workflow not found" }, { status: 404 });
    }

    const conflict = await Workflow.findOne({
      _id: { $ne: id },
      company: current.company,
      code: codeNorm,
    }).lean();

    if (conflict) {
      return NextResponse.json(
        { success: false, error: "Workflow code already exists for this company" },
        { status: 409 }
      );
    }
  }

  const updateDoc = {
    name: name.trim(),
    steps: Array.isArray(steps) ? steps : [],
  };

  if (codeNorm !== undefined) updateDoc.code = codeNorm;

  const updated = await Workflow.findByIdAndUpdate(id, updateDoc, {
    new: true,
    runValidators: true,
  });

  if (!updated) {
    return NextResponse.json({ success: false, error: "Workflow not found" }, { status: 404 });
  }

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

  const wf = await Workflow.findByIdAndDelete(id);

  if (!wf) {
    return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}