// /app/api/ex/[pageKey]/route.js

import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import { cookies } from "next/headers";
import mongoose from "mongoose";

import ExWorkflow from "@/models/ExWorkflow";
import Permissions from "@/models/Permissions";
import User from "@/models/User";

import { getExForm } from "@/lib/exForms/registry";
import {
  DEFAULT_EX_BOOKING_COMPANY,
  exCompanyMongoFilter,
} from "@/lib/exForms/exCompanies";
import {
  assertExCompanyAndPageKey,
  assertUserMayAccessExCompany,
  normalizeRequestedExCompany,
} from "@/lib/exForms/exCompanyAccess.server";
import { sendWorkflowEmail, buildExWorkflowActionEmailHtml } from "@/lib/email/exWorkflowEmail";
import { nextExRequestCode } from "@/lib/exRequestCode.server";

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
        searchFields: ["requestCode", "customerName", "oldUnitNo", "newUnitNo", "salesEmp", "createdBy"],
        sort: { createdAt: -1 },
      };

    case "waiver-reservation":
      return {
        model: WaiverReservation,
        searchFields: ["requestCode", "customerName", "customerNo", "unitNo", "receiptNo", "transfereeName", "createdBy"],
        sort: { createdAt: -1 },
      };

    case "cancel-booking-unit":
      return {
        model: CancelBookingUnit,
        searchFields: ["requestCode", "customerName", "unitNo", "amountNumber", "phone", "createdBy"],
        sort: { createdAt: -1 },
      };

    case "unit-transfer":
      return {
        model: UnitTransfer,
        searchFields: ["requestCode", "customerName", "oldUnitNo", "newUnitNo", "description", "dateDMY", "createdBy"],
        sort: { createdAt: -1 },
      };
      case "attachment-only":
        return {
          model: AttachmentOnly,
          searchFields: ["requestCode", "title", "customerName", "unitNo", "transactionType", "createdBy"],
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
    const company = normalizeRequestedExCompany(searchParams, null, DEFAULT_EX_BOOKING_COMPANY);

    const mayCo = await assertUserMayAccessExCompany(auth.userId, company);
    if (!mayCo.ok) {
      return NextResponse.json({ success: false, error: mayCo.message }, { status: mayCo.status });
    }

    const pkGate = assertExCompanyAndPageKey(auth.userId, company, pageKey);
    if (!pkGate.ok) {
      return NextResponse.json({ success: false, error: pkGate.message }, { status: pkGate.status });
    }

    const searchFields = reg.searchFields || [];

    const filterParts = [{ pageKey }, exCompanyMongoFilter(company)];
    if (qRaw) {
      filterParts.push({
        $or: searchFields.map((f) => ({
          [f]: { $regex: escapeRegExp(qRaw), $options: "i" },
        })),
      });
    }
    const filter = filterParts.length === 1 ? filterParts[0] : { $and: filterParts };

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
    const { searchParams } = new URL(req.url);
    const company = normalizeRequestedExCompany(searchParams, body, DEFAULT_EX_BOOKING_COMPANY);

    const mayCo = await assertUserMayAccessExCompany(auth.userId, company);
    if (!mayCo.ok) {
      return NextResponse.json({ success: false, error: mayCo.message }, { status: mayCo.status });
    }

    const pkGate = assertExCompanyAndPageKey(auth.userId, company, pageKey);
    if (!pkGate.ok) {
      return NextResponse.json({ success: false, error: pkGate.message }, { status: pkGate.status });
    }

    const { exCompanyKey: _xc, company: _qc, requestCode: _ignoreClientCode, ...bodyRest } = body;

    const isAttachmentOnly = pageKey === "attachment-only";

    let doc = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      const requestCode = await nextExRequestCode(company, pageKey);
      try {
        doc = await Model.create({
          ...bodyRest,
          pageKey,
          exCompanyKey: company,
          requestCode,
          status: isAttachmentOnly ? "" : "Pending",
          currentStep: isAttachmentOnly ? -1 : 0,
          createdBy: auth.user?.username || body.createdBy || "User",
          createdById: String(auth.userId),
          attachments: Array.isArray(body.attachments) ? body.attachments : [],
        });
        break;
      } catch (e) {
        if (e?.code === 11000 && String(e?.message || "").includes("requestCode")) continue;
        throw e;
      }
    }

    if (!doc) {
      return NextResponse.json(
        { success: false, error: "Could not generate unique requestCode, try again." },
        { status: 409 }
      );
    }

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

        transactionType: freshDoc?.transactionType || "",
    
      };

      // معاملة زبون: إيميلات finalApproveEmails تنرسل مباشرة عند إنشاء الطلب
      const wfCfg = await ExWorkflow.findOne({ pageKey })
        .select("finalApproveEmails")
        .lean();
      const createNotifyEmails = [
        ...new Set(
          (Array.isArray(wfCfg?.finalApproveEmails) ? wfCfg.finalApproveEmails : [])
            .map((x) => String(x || "").trim().toLowerCase())
            .filter(Boolean)
        ),
      ];
    
      const toEmails = createNotifyEmails;
    
      const baseDomain = process.env.EX_BASE_DOMAIN || "https://funds-gdr.spc-it.com.iq";
    
      const docUrl = `${String(baseDomain).replace(/\/+$/, "")}/ex/${encodeURIComponent(
        pageKey
      )}/${encodeURIComponent(String(doc._id))}?key=${encodeURIComponent(
        pageKey
      )}&company=${encodeURIComponent(company)}`;
    
      const html = buildExWorkflowActionEmailHtml({
        action: "created",
        planId: String(doc._id),
        pageKey,
        stepFrom: 0,
        stepTo: 0,
        note: "",
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
        docTitle: cfg?.title || "معامله زبون",
        docTypeAr: "معاملة زبون",
        ...emailDocFields,
      });
    
      const emailAttachments = (freshDoc?.attachments || [])
        .filter((f) => f?.url)
        .map((f, idx) => ({
          filename: f?.name || `attachment-${idx + 1}`,
          path: encodeURI(String(f.url)),
        }));
    
      if (toEmails.length > 0) {
        const customerName = String(emailDocFields.customerName || "").trim() || "—";
        const unitNo =
          String(
            emailDocFields.unitNo ||
              emailDocFields.newUnitNo ||
              emailDocFields.oldUnitNo ||
              ""
          ).trim() || "—";

        await sendWorkflowEmail({
          toEmails,
          // RLM يحافظ على ترتيب العنوان في علب البريد (عربي + أرقام/إنجليزي)
          subject: `\u200Fمعامله زبون - ${customerName} - ${unitNo}`,
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
          )}/${encodeURIComponent(String(doc._id))}?key=${encodeURIComponent(
            pageKey
          )}&company=${encodeURIComponent(company)}`;

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