// /app/api/ex/[pageKey]/route.js

import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import { cookies } from "next/headers";
import mongoose from "mongoose";

import ExWorkflow from "@/models/ExWorkflow";
import Permissions from "@/models/Permissions";
import User from "@/models/User";

import { getExForm } from "@/lib/exForms/registry";

import ReplaceBookingTransfer from "@/models/ReplaceBookingTransfer";
import WaiverReservation from "@/models/WaiverReservation";
import CancelBookingUnit from "@/models/CancelBookingUnit";
import UnitTransfer from "@/models/UnitTransfer";

export const runtime = "nodejs";

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

function escapeRegExp(s) {
  return String(s || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/* ================= AUTH (Cookie-based مثل نظامك) ================= */

async function requireExPermission() {
  await dbConnect();

  const cookieStore = await cookies();
  const userId = cookieStore.get("userId")?.value;

  if (!userId) {
    return { ok: false, status: 401, message: "Not authenticated" };
  }

  if (!isValidObjectId(userId)) {
    return { ok: false, status: 401, message: "Invalid userId" };
  }

  const user = await User.findById(userId).select("_id username name email").lean();
  if (!user) {
    return { ok: false, status: 401, message: "User not found" };
  }

  // Permissions groups where this user included
  const groups = await Permissions.find({ users: user._id }).lean();
  const perms = [...new Set(groups.flatMap((g) => g.permissions || []))];

  if (!perms.includes("EX")) {
    return { ok: false, status: 403, message: "Forbidden" };
  }

  return { ok: true, userId: String(user._id), user, perms };
}

/* ================= Registry ================= */

function getModelByPageKey(pageKey) {
  switch (pageKey) {
    case "replace-booking-transfer":
      return {
        model: ReplaceBookingTransfer,
        searchFields: ["customerName", "oldUnitNo", "newUnitNo", "salesEmp", "createdBy"],
        sort: { createdAt: -1 },
      };

    case "waiver-reservation":
      return {
        model: WaiverReservation,
        searchFields: ["customerName", "customerNo", "unitNo", "receiptNo", "transfereeName", "createdBy"],
        sort: { createdAt: -1 },
      };

    case "cancel-booking-unit":
      return {
        model: CancelBookingUnit,
        searchFields: ["customerName", "unitNo", "amountNumber", "phone", "createdBy"],
        sort: { createdAt: -1 },
      };

    case "unit-transfer":
      return {
        model: UnitTransfer,
        searchFields: ["description", "dateDMY", "createdBy"],
        sort: { createdAt: -1 },
      };

    default:
      return null;
  }
}

async function buildWorkflowForKey(key) {
  const wf = await ExWorkflow.findOne({ pageKey: key }).lean();
  if (!wf) return { key, name: "", steps: [] };

  const steps = Array.isArray(wf?.steps) ? wf.steps : [];

  return {
    key,
    name: wf?.name || "",
    steps: steps.map((s) => ({
      users: s.users || [],
      status: "Pending",
      actedBy: null,
      actedAt: null,
      comment: "",
      tag: "",
      tagAttachments: [],
    })),
  };
}

async function ensureDocWorkflowStable(doc, forcedKey) {
  if (!doc) return doc;

  const key = String(doc.pageKey || forcedKey || "").trim();
  const hasSteps = Array.isArray(doc?.workflow?.steps) && doc.workflow.steps.length > 0;

  if (hasSteps) {
    if (!doc.pageKey) doc.pageKey = key;
    if (typeof doc.currentStep !== "number") doc.currentStep = doc.workflow.steps.length ? 0 : -1;
    await doc.save();
    return doc;
  }

  doc.workflow = await buildWorkflowForKey(key);
  doc.pageKey = key;
  doc.status = doc.status || "Pending";
  doc.currentStep = doc.workflow.steps.length ? 0 : -1;

  await doc.save();
  return doc;
}

function mustBeValidPageKey(pageKey) {
  const cfg = getExForm(pageKey);
  const reg = getModelByPageKey(pageKey);
  return { cfg, reg };
}

/* ================= GET (List) ================= */

export async function GET(req, ctx) {
  const auth = await requireExPermission();
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.message }, { status: auth.status });
  }

  try {
    await dbConnect();

    const params = await ctx.params;
    const pageKey = String(params?.pageKey || "").trim();

    const { cfg, reg } = mustBeValidPageKey(pageKey);
    if (!cfg || !reg) {
      return NextResponse.json({ success: false, error: "Invalid pageKey" }, { status: 404 });
    }

    const Model = reg.model;

    const { searchParams } = new URL(req.url);
    const qRaw = String(searchParams.get("q") || "").trim();

    const searchFields = reg.searchFields || [];

    const filter = {
      pageKey,
      ...(qRaw
        ? {
            $or: searchFields.map((f) => ({
              [f]: { $regex: escapeRegExp(qRaw), $options: "i" },
            })),
          }
        : {}),
    };

    const list = await Model.find(filter).sort(reg.sort || { createdAt: -1 }).lean();

    return NextResponse.json({ success: true, data: list });
  } catch (err) {
    console.error("❌ ex/[pageKey] GET error:", err);
    return NextResponse.json({ success: false, error: err?.message || "Server error" }, { status: 500 });
  }
}

/* ================= POST (Create) ================= */

export async function POST(req, ctx) {
  const auth = await requireExPermission();
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.message }, { status: auth.status });
  }

  try {
    await dbConnect();

    const params = await ctx.params;
    const pageKey = String(params?.pageKey || "").trim();

    const { cfg, reg } = mustBeValidPageKey(pageKey);
    if (!cfg || !reg) {
      return NextResponse.json({ success: false, error: "Invalid pageKey" }, { status: 404 });
    }

    const Model = reg.model;
    const body = await req.json().catch(() => ({}));

    const doc = await Model.create({
      ...body,
      pageKey,
      status: "Pending",
      currentStep: 0,
      createdBy: body.createdBy || auth.user?.username || auth.user?.name || "User",
      createdById: body.createdById || String(auth.userId),
      attachments: Array.isArray(body.attachments) ? body.attachments : [],
    });

    await ensureDocWorkflowStable(doc, pageKey);

    return NextResponse.json({ success: true, data: doc });
  } catch (err) {
    console.error("❌ ex/[pageKey] POST error:", err);
    return NextResponse.json({ success: false, error: err?.message || "Server error" }, { status: 500 });
  }
}