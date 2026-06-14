import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import { cookies } from "next/headers";
import Voucher from "@/models/Voucher";
import VoucherCounter from "@/models/VoucherCounter";
import { PERMISSIONS } from "@/lib/permission";
import { COMPANIES } from "@/lib/voucher/companies";
import {
  resolveVoucherCompanyKeyForUser,
  hasVoucherPermissionForRequest,
  voucherLookupCompanyKeys,
} from "@/lib/voucher/resolveVoucherCompanyKey";
import Permissions from "@/models/Permissions";
import User from "@/models/User";
import { getModelForCompany } from "@/models/Request";
import { findVoucherForRequest } from "@/lib/voucher/findVoucherForRequest";
import { linkVoucherToRequest } from "@/lib/voucher/linkVoucherToRequest";
import { buildVoucherDateFromParts } from "@/lib/voucher/voucherDate";
import { sanitizeFieldColorRuns } from "@/lib/voucher/fieldColorRuns";

export const runtime = "nodejs";

const DEFAULT_GLOBAL_TEXT_STYLE = {
  fontSize: 16,
  fontWeight: 700,
  color: "#111827",
};

const DEFAULT_FIELD_STYLES = {
  date: { fontSize: 18, fontWeight: 800, color: "#ffffff" },
  amount: { fontSize: 16, fontWeight: 800, color: "#111827" },
  words: { fontSize: 16, fontWeight: 700, color: "#111827" },
  desc: { fontSize: 16, fontWeight: 600, color: "#111827" },
  bank: { fontSize: 16, fontWeight: 700, color: "#111827" },
  fxRate: { fontSize: 16, fontWeight: 700, color: "#111827" },
  receivedBy: { fontSize: 16, fontWeight: 700, color: "#111827" },
  notes: { fontSize: 16, fontWeight: 600, color: "#111827" },
  chequeNo: { fontSize: 16, fontWeight: 700, color: "#111827" },
  nationalId: { fontSize: 16, fontWeight: 700, color: "#111827" },
  phone: { fontSize: 16, fontWeight: 700, color: "#111827" },
};

async function getUserAccess(userId) {
  if (!userId) return { allowedPerms: [] };
  const groups = await Permissions.find({ users: userId }).select("permissions").lean();
  const permsSet = new Set();
  for (const g of groups) {
    (g.permissions || []).forEach((p) => permsSet.add(String(p).trim()));
  }
  return { allowedPerms: Array.from(permsSet).filter(Boolean) };
}

export async function GET(req) {
  try {
    await dbConnect();

    const cookieStore = await cookies();
    const userId = cookieStore.get("userId")?.value;

    if (!userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { allowedPerms } = await getUserAccess(userId);

    const { searchParams } = new URL(req.url);
    const companyKey = searchParams.get("companyKey");
    const requestCompanyKey = searchParams.get("requestCompanyKey") || companyKey;
    const requestId = searchParams.get("requestId");
    const mode = searchParams.get("mode") || "payment";

    if (!companyKey || !requestId) {
      return NextResponse.json(
        { success: false, error: "companyKey and requestId are required" },
        { status: 400 }
      );
    }

    const voucherCompanyKey = resolveVoucherCompanyKeyForUser(
      requestCompanyKey || companyKey,
      allowedPerms
    );

    const companyConfig = COMPANIES.find(
      (c) => String(c.key).toLowerCase() === String(voucherCompanyKey).toLowerCase()
    );
    const isTestCompany = String(companyConfig?.key || "").trim() === "010";
    const hasCompanyPermission = Boolean(
      companyConfig?.permission && allowedPerms.includes(companyConfig.permission)
    );
    let hasAccess = isTestCompany
      ? hasCompanyPermission
      : hasCompanyPermission ||
        allowedPerms.includes(PERMISSIONS.VIEW_ALL_REPORTS) ||
        hasVoucherPermissionForRequest(requestCompanyKey || companyKey, allowedPerms);

    // ✅ مخوّل على آخر خطوة، أو VOUCHER_DELEGATE لعرض وصل مصروف بالتخويل
    if (!hasAccess && requestId) {
      const RequestModel = getModelForCompany(requestCompanyKey);
      const requestDoc = await RequestModel.findOne({
        _id: requestId,
        companyKey: requestCompanyKey,
      })
        .select(
          "status currentStep workflow.steps.users workflow.steps.status workflow.steps.voucherDelegateTo workflow.steps.voucherDelegateToUsername workflow.steps.voucherProcessedAt workflow.steps.voucherProcessedBy workflow.steps.voucherNo workflow.steps.voucherId"
        )
        .lean();

      if (requestDoc && canActOnVoucherStep(requestDoc, userId)) {
        hasAccess = true;
      } else if (requestDoc && canDelegateViewDisbursedVoucher(requestDoc, allowedPerms)) {
        hasAccess = true;
      }
    }

    if (!hasAccess) {
      return NextResponse.json({ success: false, error: "ليس لديك صلاحية لهذه الشركة" }, { status: 403 });
    }

    let requestCodeHint = safeString(searchParams.get("requestCode"));
    if (!requestCodeHint && requestId) {
      const RequestModel = getModelForCompany(requestCompanyKey || companyKey);
      const reqLean = await RequestModel.findById(requestId).select("requestCode").lean();
      requestCodeHint = safeString(reqLean?.requestCode);
    }

    const doc = await findVoucherForRequest({
      requestId,
      requestCode: requestCodeHint,
      mode,
      requestCompanyKey: requestCompanyKey || companyKey,
      allowedPerms,
      hintCompanyKey: requestCompanyKey || companyKey || voucherCompanyKey,
    });

    if (doc && requestId) {
      try {
        const actor = await User.findById(userId).select("username").lean();
        const linked = await linkVoucherToRequest({
          requestCompanyKey: requestCompanyKey || companyKey,
          requestId,
          voucherId: String(doc._id),
          userId,
          username: actor?.username || "",
        });
        if (!linked?.ok) {
          console.warn("link on voucher GET skipped:", linked?.reason, requestId);
        }
      } catch (e) {
        console.error("link on voucher GET:", e);
      }
    }

    return NextResponse.json({
      success: true,
      data: doc || null,
    });
  } catch (err) {
    console.error("Voucher GET error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Server error" },
      { status: 500 }
    );
  }
}

function safeString(v) {
  return String(v ?? "").trim();
}

function toNumber(v, def = 0) {
  const n = Number(String(v ?? "").replace(/,/g, ""));
  return Number.isFinite(n) ? n : def;
}

function clampNumber(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function safeColor(value, fallback = "#111827") {
  const v = String(value || "").trim();
  return /^#([0-9a-fA-F]{6})$/.test(v) ? v : fallback;
}

function sanitizeGlobalTextStyle(input = {}) {
  return {
    fontSize: clampNumber(input.fontSize, 8, 72, DEFAULT_GLOBAL_TEXT_STYLE.fontSize),
    fontWeight: clampNumber(input.fontWeight, 100, 900, DEFAULT_GLOBAL_TEXT_STYLE.fontWeight),
    color: safeColor(input.color, DEFAULT_GLOBAL_TEXT_STYLE.color),
  };
}

function sanitizeFieldStyles(input = {}) {
  const result = {};

  Object.keys(DEFAULT_FIELD_STYLES).forEach((key) => {
    const incoming = input?.[key] || {};
    const base = DEFAULT_FIELD_STYLES[key];

    result[key] = {
      fontSize: clampNumber(incoming.fontSize, 8, 72, base.fontSize),
      fontWeight: clampNumber(incoming.fontWeight, 100, 900, base.fontWeight),
      color: safeColor(incoming.color, base.color),
    };
  });

  return result;
}

function isFinalApprovedVoucherStep(requestDoc) {
  if (!requestDoc) return false;
  if (String(requestDoc.status || "").toLowerCase() === "cancelled") return false;
  const steps = requestDoc?.workflow?.steps || [];
  if (!steps.length) return false;
  const lastIdx = steps.length - 1;
  const step = steps[lastIdx];
  if (!step) return false;
  return (
    String(requestDoc.status || "") === "Approved" &&
    Number(requestDoc.currentStep) === lastIdx &&
    String(step.status || "") === "Approved"
  );
}

function canActOnVoucherStep(requestDoc, userId) {
  if (!isFinalApprovedVoucherStep(requestDoc) || !userId) return false;
  const steps = requestDoc.workflow.steps;
  const step = steps[steps.length - 1];
  const currentId = String(userId);
  const inStep = (step.users || []).some((u) => String(u) === currentId);
  if (!inStep) return false;

  const delegatedTo = step?.voucherDelegateTo ? String(step.voucherDelegateTo) : "";
  if (delegatedTo) return delegatedTo === currentId;
  return true;
}

/** VOUCHER_DELEGATE: عرض وصل مصروف عبر تخويل */
function canDelegateViewDisbursedVoucher(requestDoc, allowedPerms = []) {
  if (!Array.isArray(allowedPerms) || !allowedPerms.includes(PERMISSIONS.VOUCHER_DELEGATE)) {
    return false;
  }
  if (!isFinalApprovedVoucherStep(requestDoc)) return false;

  const step = requestDoc.workflow.steps[requestDoc.workflow.steps.length - 1];
  const wasDelegated =
    step?.voucherDelegateTo != null ||
    String(step?.voucherDelegateToUsername || "").trim();
  if (!wasDelegated) return false;

  return Boolean(
    step?.voucherProcessedAt ||
      step?.voucherProcessedBy ||
      step?.voucherNo ||
      step?.voucherId
  );
}

export async function POST(req) {
  try {
    await dbConnect();

    const cookieStore = await cookies();
    const userId = cookieStore.get("userId")?.value || "";
    const createdByName = cookieStore.get("username")?.value || "";

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    const { allowedPerms } = await getUserAccess(userId);
    const body = await req.json();

    const {
      companyKey,
      requestCompanyKey = null,
      companyName,
      mode,
      requestId = null,
      requestCode = "",

      vDateYY,
      vDateMM,
      vDateDD,

      vAmount,
      vWords,
      vDesc,
      vCurrency,

      vBank,
      vFxRate,
      vReceivedBy,
      vBeneficiary,
      vNotes,

      vChequeNo,
      vNationalId,
      vPhone,
      vSanadNo,

      cbOne,
      cbTwo,

      globalTextStyle,
      fieldStyles,
      fieldColorRuns,
    } = body || {};

    if (!companyKey || !mode) {
      return NextResponse.json(
        { success: false, error: "companyKey and mode are required" },
        { status: 400 }
      );
    }

    const requestCompany = safeString(requestCompanyKey || companyKey);
    let voucherCompanyKey = resolveVoucherCompanyKeyForUser(
      requestCompany,
      allowedPerms
    );

    let requestDocForVoucher = null;
    if (requestId) {
      const RequestModel = getModelForCompany(requestCompany);
      requestDocForVoucher = await RequestModel.findOne({
        _id: requestId,
        companyKey: requestCompany,
      })
        .select(
          "status currentStep workflow.steps.users workflow.steps.status workflow.steps.voucherDelegateTo workflow.steps.voucherDelegateCompanyKey"
        )
        .lean();

      if (requestDocForVoucher && canActOnVoucherStep(requestDocForVoucher, userId)) {
        const lastStep =
          requestDocForVoucher.workflow?.steps?.[
            requestDocForVoucher.workflow.steps.length - 1
          ];
        const delegatedKey = String(lastStep?.voucherDelegateCompanyKey || "").trim();
        if (delegatedKey) voucherCompanyKey = delegatedKey;
      }
    }

    const resolvedConfig = COMPANIES.find(
      (c) => String(c.key).toLowerCase() === String(voucherCompanyKey).toLowerCase()
    );

    const companyConfig = resolvedConfig;
    const isTestCompany = String(companyConfig?.key || "").trim() === "010";
    const hasCompanyPermission = Boolean(
      companyConfig?.permission && allowedPerms.includes(companyConfig.permission)
    );
    let hasAccess = isTestCompany
      ? hasCompanyPermission
      : hasCompanyPermission ||
        allowedPerms.includes(PERMISSIONS.VIEW_ALL_REPORTS) ||
        hasVoucherPermissionForRequest(requestCompany, allowedPerms);

    // ✅ استثناء: إذا المستخدم مخوَّل على آخر step لهذا الطلب، نسمح له حتى بدون صلاحية الوصولات
    if (!hasAccess && requestDocForVoucher && canActOnVoucherStep(requestDocForVoucher, userId)) {
      hasAccess = true;
    }

    if (!hasAccess) {
      return NextResponse.json({ success: false, error: "ليس لديك صلاحية لإنشاء وصولات لهذه الشركة" }, { status: 403 });
    }

    if (!["payment", "receipt"].includes(mode)) {
      return NextResponse.json(
        { success: false, error: "Invalid mode" },
        { status: 400 }
      );
    }

    const saveCompanyKey = safeString(voucherCompanyKey);
    const saveCompanyName = safeString(
      companyName || resolvedConfig?.name || voucherCompanyKey
    );

    // ✅ لنفس الطلب/الشركة/النوع: إنشاء مرة واحدة فقط
    let requestCodeHint = safeString(requestCode);
    if (requestId && !requestCodeHint) {
      const RequestModel = getModelForCompany(requestCompany);
      const reqLean = await RequestModel.findById(requestId).select("requestCode").lean();
      requestCodeHint = safeString(reqLean?.requestCode);
    }

    if (requestId) {
      const existingVoucher = await findVoucherForRequest({
        requestId,
        requestCode: requestCodeHint,
        mode,
        requestCompanyKey: requestCompany,
        allowedPerms,
        hintCompanyKey: saveCompanyKey,
      });

      if (existingVoucher) {
        await linkVoucherToRequest({
          requestCompanyKey: requestCompany,
          requestId,
          voucherId: String(existingVoucher._id),
          userId,
          username: createdByName || "",
        });
        return NextResponse.json({
          success: true,
          message: "Voucher already exists for this request",
          data: existingVoucher,
        });
      }
    }

    if (requestId) {
      if (!requestDocForVoucher) {
        return NextResponse.json(
          { success: false, error: "Request not found for voucher" },
          { status: 404 }
        );
      }

      if (!canActOnVoucherStep(requestDocForVoucher, userId)) {
        return NextResponse.json(
          { success: false, error: "You are not allowed to issue voucher for this request" },
          { status: 403 }
        );
      }
    }

    const counter = await VoucherCounter.findOneAndUpdate(
      { companyKey: saveCompanyKey, mode },
      { $inc: { seq: 1 } },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
      }
    );

    const seq = counter.seq;
    const voucherNo = String(seq).padStart(5, "0");

    const doc = await Voucher.create({
      companyKey: saveCompanyKey,
      companyName: saveCompanyName,
      mode,
      seq,
      voucherNo,

      requestId: requestId ? safeString(requestId) : null,
      requestCode: requestCodeHint || safeString(requestCode),

      voucherDate: buildVoucherDateFromParts(vDateYY, vDateMM, vDateDD) || new Date(),

      dateParts: {
        yy: safeString(vDateYY),
        mm: safeString(vDateMM),
        dd: safeString(vDateDD),
      },

      amount: toNumber(vAmount, 0),
      amountText: safeString(vAmount),
      amountWords: safeString(vWords),
      currency: safeString(vCurrency || "IQD").toUpperCase(),

      description: safeString(vDesc),
      bank: safeString(vBank),
      fxRate: safeString(vFxRate),
      receivedBy: safeString(vReceivedBy),
      beneficiary: safeString(vBeneficiary),
      notes: safeString(vNotes),

      chequeNo: safeString(vChequeNo),
      nationalId: safeString(vNationalId),
      phone: safeString(vPhone),
      sanadNo: safeString(vSanadNo),

      cbOne: Boolean(cbOne),
      cbTwo: Boolean(cbTwo),

      globalTextStyle: sanitizeGlobalTextStyle(globalTextStyle),
      fieldStyles: sanitizeFieldStyles(fieldStyles),
      fieldColorRuns: sanitizeFieldColorRuns(
        fieldColorRuns || {},
        {
          words: vWords,
          desc: vDesc,
          bank: vBank,
          fxRate: vFxRate,
          receivedBy: vReceivedBy,
          beneficiary: vBeneficiary,
          notes: vNotes,
          chequeNo: vChequeNo,
          nationalId: vNationalId,
          phone: vPhone,
          sanadNo: vSanadNo,
        },
        sanitizeFieldStyles(fieldStyles),
        sanitizeGlobalTextStyle(globalTextStyle)
      ),

      createdByUserId: userId,
      createdByName,
    });

    if (requestId) {
      await linkVoucherToRequest({
        requestCompanyKey: requestCompany,
        requestId,
        voucherId: String(doc._id),
        userId,
        username: createdByName || "",
      });
    }

    const linked = requestId ? await Voucher.findById(doc._id).lean() : doc;

    return NextResponse.json({
      success: true,
      message: "Voucher created successfully",
      data: linked || doc,
    });
  } catch (err) {
    console.error("❌ Create Voucher Error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Server error" },
      { status: 500 }
    );
  }
}