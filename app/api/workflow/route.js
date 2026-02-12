import dbConnect from "@/lib/mongodb";
import Workflow from "@/models/Workflow";
import Permissions from "@/models/Permissions";
import { NextResponse } from "next/server";
import mongoose from "mongoose";

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

// ✅ نفس حماية users: تحقق MANAGE_PERMISSIONS اعتماداً على userId
async function requireManagePermissions(req) {
  await dbConnect();

  const userId = req.headers.get("x-user-id"); // يجي من localStorage بالفرونت
  if (!userId) {
    return { ok: false, status: 401, message: "Missing userId" };
  }

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
  const company = searchParams.get("company");

  const populateUser = {
    path: "steps.users",
    model: "User",
    strictPopulate: false,
  };

  if (id) {
    if (!isValidObjectId(id)) {
      return NextResponse.json({ success: false, error: "Invalid workflow id" }, { status: 400 });
    }
    const wf = await Workflow.findById(id).populate(populateUser);
    return NextResponse.json({ success: true, workflow: wf });
  }

  if (company) {
    const wf = await Workflow.findOne({ company }).populate(populateUser);
    return NextResponse.json({ success: true, workflow: wf });
  }

  const all = await Workflow.find().populate(populateUser);
  return NextResponse.json({ success: true, workflows: all });
}

// ======================= POST =======================
// Create OR Update by company (UPSERT)
export async function POST(req) {
  const auth = await requireManagePermissions(req);
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.message }, { status: auth.status });
  }

  await dbConnect();
  const body = await req.json();

  const { name, company, steps } = body;

  if (!name?.trim()) {
    return NextResponse.json({ success: false, error: "name required" }, { status: 400 });
  }

  if (!company?.trim()) {
    return NextResponse.json({ success: false, error: "company required" }, { status: 400 });
  }

  const update = { name };
  if (Array.isArray(steps)) update.steps = steps;

  const wf = await Workflow.findOneAndUpdate({ company }, update, { new: true, upsert: true });
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

  const { id, name, steps = [] } = body;

  if (!id || !isValidObjectId(id)) {
    return NextResponse.json({ success: false, error: "Valid workflow id required" }, { status: 400 });
  }

  if (!name?.trim()) {
    return NextResponse.json({ success: false, error: "name required" }, { status: 400 });
  }

  const updated = await Workflow.findByIdAndUpdate(
    id,
    { name, steps },
    { new: true, runValidators: true }
  );

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