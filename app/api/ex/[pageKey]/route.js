// /app/api/ex/[pageKey]/route.js

import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import { cookies } from "next/headers";
import mongoose from "mongoose";

import ExWorkflow from "@/models/ExWorkflow";
import Permissions from "@/models/Permissions";
import User from "@/models/User";

import { getExForm } from "@/lib/exForms/registry";
import { sendWorkflowEmail, buildExWorkflowActionEmailHtml } from "@/lib/email/exWorkflowEmail";

import ReplaceBookingTransfer from "@/models/ReplaceBookingTransfer";
import WaiverReservation from "@/models/WaiverReservation";
import CancelBookingUnit from "@/models/CancelBookingUnit";
import UnitTransfer from "@/models/UnitTransfer";
import AttachmentOnly from "@/models/AttachmentOnly";
export const runtime = "nodejs";

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

function escapeRegExp(s) {
  return String(s || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getIdStr(v) {
  if (!v) return "";
  if (typeof v === "string" || typeof v === "number") return String(v);
  if (typeof v === "object" && v._id) return String(v._id);
  return String(v);
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

  const user = await User.findById(userId)
  .select("_id username name email arabicName")
  .lean();  if (!user) {
    return { ok: false, status: 401, message: "User not found" };
  }

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
      case "attachment-only":
        return {
          model: AttachmentOnly,
          searchFields: ["title", "createdBy"],
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

      actedBy: null,
      status: key === "attachment-only" ? "" : "Pending",
      actedAt: key === "attachment-only" ? new Date() : null,
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
  if (key === "attachment-only") {
    doc.status = "";
    doc.currentStep = -1;
  } else {
    doc.status = doc.status || "Pending";
    doc.currentStep = doc.workflow.steps.length ? 0 : -1;
  }

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
    const isAttachmentOnly = pageKey === "attachment-only";
    const doc = await Model.create({
      ...body,
      pageKey,
      status: isAttachmentOnly ? "" : "Pending",
currentStep: isAttachmentOnly ? -1 : 0,
createdBy: auth.user?.username || body.createdBy || "User",
createdById: String(auth.userId),
      attachments: Array.isArray(body.attachments) ? body.attachments : [],
    });

    await ensureDocWorkflowStable(doc, pageKey);
    if (pageKey === "attachment-only") {
      const freshDoc = await Model.findById(doc._id).lean();
      const emailDocFields = {

        customerName:
    
          freshDoc?.customerName ||
    
          freshDoc?.clientName ||
    
          freshDoc?.transfereeName ||
    
          freshDoc?.name ||
    
          "",
    
        unitNo:
    
          freshDoc?.unitNo ||
    
          freshDoc?.newUnitNo ||
    
          freshDoc?.oldUnitNo ||
    
          "",
    
        oldUnitNo: freshDoc?.oldUnitNo || "",
    
        newUnitNo: freshDoc?.newUnitNo || "",
    
      };
    
      const allUserIds = [
        ...new Set(
          (freshDoc?.workflow?.steps || [])
            .flatMap((s) => s?.users || [])
            .map(getIdStr)
            .filter(Boolean)
        ),
      ];
    
      const users = allUserIds.length
        ? await User.find({ _id: { $in: allUserIds } })
        .select("_id username name email arabicName")
            .lean()
        : [];
    
      const toEmails = users.map((u) => u.email).filter(Boolean);
    
      const baseDomain = process.env.EX_BASE_DOMAIN || "https://funds-gdr.spc-it.com.iq";
    
      const docUrl = `${String(baseDomain).replace(/\/+$/, "")}/ex/${encodeURIComponent(
        pageKey
      )}/${encodeURIComponent(String(doc._id))}?key=${encodeURIComponent(pageKey)}`;
    
      const html = buildExWorkflowActionEmailHtml({
        action: "created",
        planId: String(doc._id),
        pageKey,
        stepFrom: 0,
        stepTo: 0,
        note: "تم إرسال الاتاج إلى جميع المعنيين في الورك فلو.",
        actorName:
        auth.user?.arabicName ||
        auth.user?.username ||
        auth.user?.name ||
        auth.user?.email ||
        "System",
        greetingName: "زميلنا",
        toUserName: "",
        planUrl: docUrl,
        showRoutingLine: false,
        showDetailsButton: false,
        docTitle: cfg?.title || "اتاج",
        docTypeAr: "الاتاج",
        ...emailDocFields,
      });
    
      const emailAttachments = (freshDoc?.attachments || [])
        .filter((f) => f?.url)
        .map((f, idx) => ({
          filename: f?.name || `attachment-${idx + 1}`,
          path: encodeURI(String(f.url)),
        }));
    
      if (toEmails.length > 0) {
        await sendWorkflowEmail({
          toEmails,
          subject: `اتاج جديد | ${String(doc._id).slice(-6)}`,
          html,
          attachments: emailAttachments,
        });
      }
    
      return NextResponse.json({ success: true, data: freshDoc });
    }

    
    // ✅ Send email to first step users
    try {
      const freshDoc = await Model.findById(doc._id).lean();
      const emailDocFields = {
        customerName:
          freshDoc?.customerName ||
          freshDoc?.clientName ||
          freshDoc?.transfereeName ||
          freshDoc?.name ||
          "",
      
        unitNo:
          freshDoc?.unitNo ||
          freshDoc?.newUnitNo ||
          freshDoc?.oldUnitNo ||
          "",
      
        oldUnitNo: freshDoc?.oldUnitNo || "",
        newUnitNo: freshDoc?.newUnitNo || "",
      };
      const firstStepUsers = freshDoc?.workflow?.steps?.[0]?.users || [];
      const firstStepUserIds = firstStepUsers.map(getIdStr).filter(Boolean);

      if (firstStepUserIds.length > 0) {
        const stepUsers = await User.find({ _id: { $in: firstStepUserIds } })
        .select("_id username name email arabicName")
          .lean();

        const toEmails = stepUsers.map((u) => u.email).filter(Boolean);
        const toUserName =
        stepUsers?.[0]?.arabicName ||
        stepUsers?.[0]?.name ||
        stepUsers?.[0]?.username ||
        "زميلنا";

        if (toEmails.length > 0) {
          const baseDomain =
            process.env.EX_BASE_DOMAIN || "https://funds-gdr.spc-it.com.iq";

          const docUrl = `${String(baseDomain).replace(/\/+$/, "")}/ex/${encodeURIComponent(
            pageKey
          )}/${encodeURIComponent(String(doc._id))}?key=${encodeURIComponent(pageKey)}`;

          const docTitle = cfg?.title || pageKey;
          const docTypeAr = cfg?.title || "المستند";

          const html = buildExWorkflowActionEmailHtml({
            action: "created",
            planId: String(doc._id),
            pageKey,
            stepFrom: 0,
            stepTo: 0,
            note: "تم إنشاء طلب جديد بانتظار الإجراء.",
            actorName:
            auth.user?.arabicName ||
            auth.user?.username ||
            auth.user?.name ||
            auth.user?.email ||
            "System",
            greetingName: toUserName,
            toUserName,
            planUrl: docUrl,
            showRoutingLine: true,
            docTitle,
            docTypeAr,
            ...emailDocFields,
          });

          await sendWorkflowEmail({
            toEmails,
            subject: `${pageKey} Waiting Your Action | Step 1`,
            html,
          });
        }
      }
    } catch (emailErr) {
      console.error("❌ Create email send failed:", emailErr?.message || emailErr);
    }

    return NextResponse.json({ success: true, data: doc });
  } catch (err) {
    console.error("❌ ex/[pageKey] POST error:", err);
    return NextResponse.json({ success: false, error: err?.message || "Server error" }, { status: 500 });
  }
}