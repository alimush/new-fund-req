import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import mongoose from "mongoose";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";
import Permissions from "@/models/Permissions";
import Voucher from "@/models/Voucher";
import { getModelForCompany } from "@/models/Request";
import { REQUEST_COMPANY_KEYS } from "@/lib/requests/createdByIdentity";
import { linkVoucherToRequest } from "@/lib/voucher/linkVoucherToRequest";
import { buildRequestPageHref } from "@/lib/voucher/voucherRequestLink";
import { PERMISSIONS } from "@/lib/permission";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function escapeRegex(s) {
  return String(s || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function getUserPermissions(userId) {
  if (!userId || !mongoose.Types.ObjectId.isValid(String(userId))) return [];
  const groups = await Permissions.find({ users: new mongoose.Types.ObjectId(String(userId)) })
    .select("permissions")
    .lean();
  const set = new Set();
  for (const g of groups) {
    (g.permissions || []).forEach((p) => set.add(String(p).trim()));
  }
  return Array.from(set).filter(Boolean);
}

async function requireDelegateAccess() {
  const cookieStore = await cookies();
  const userIdRaw = cookieStore.get("userId")?.value;
  if (!userIdRaw || !mongoose.Types.ObjectId.isValid(userIdRaw)) {
    return {
      error: NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 }),
    };
  }
  const perms = await getUserPermissions(userIdRaw);
  const ok =
    perms.includes(PERMISSIONS.VOUCHER_DELEGATE) ||
    perms.includes(PERMISSIONS.VIEW_ALL_REPORTS) ||
    perms.includes(PERMISSIONS.MANAGE_PERMISSIONS);
  if (!ok) {
    return {
      error: NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 }),
    };
  }
  return { userId: userIdRaw, perms };
}

/**
 * GET ?q= — بحث طلبات بالرمز (لصلاحية VOUCHER_DELEGATE)
 */
export async function GET(req) {
  try {
    await dbConnect();
    const auth = await requireDelegateAccess();
    if (auth.error) return auth.error;

    const { searchParams } = new URL(req.url);
    const q = String(searchParams.get("q") || "").trim();
    if (!q || q.length < 1) {
      return NextResponse.json({ success: true, data: [] });
    }

    const rx = new RegExp(escapeRegex(q), "i");
    const results = [];

    for (const companyKey of REQUEST_COMPANY_KEYS) {
      try {
        const Model = getModelForCompany(companyKey);
        const docs = await Model.find({ requestCode: rx })
          .sort({ createdAt: -1 })
          .limit(12)
          .select(
            "requestCode companyKey status description currency totalAmount createdAt workflow.steps"
          )
          .lean();

        for (const d of docs) {
          const steps = d.workflow?.steps || [];
          const last = steps[steps.length - 1];
          const linkedIds = [
            ...(Array.isArray(last?.voucherIds) ? last.voucherIds : []),
            last?.voucherId,
          ]
            .map((x) => String(x || "").trim())
            .filter(Boolean);
          results.push({
            _id: String(d._id),
            requestCode: d.requestCode || "",
            companyKey: d.companyKey || companyKey,
            status: d.status || "",
            description: d.description || "",
            currency: d.currency || "",
            totalAmount: d.totalAmount,
            createdAt: d.createdAt,
            linkedVoucherCount: new Set(linkedIds).size,
            href: buildRequestPageHref(d.companyKey || companyKey, d._id),
          });
        }
      } catch {
        /* company collection missing */
      }
    }

    results.sort((a, b) => {
      const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return tb - ta;
    });

    // إزالة تكرار نفس الـ id عبر شركات
    const seen = new Set();
    const unique = [];
    for (const row of results) {
      if (seen.has(row._id)) continue;
      seen.add(row._id);
      unique.push(row);
      if (unique.length >= 40) break;
    }

    return NextResponse.json({ success: true, data: unique });
  } catch (err) {
    console.error("vouchers/link-request GET:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Server error" },
      { status: 500 }
    );
  }
}

/**
 * POST { voucherId, requestId, requestCompanyKey }
 * ربط وصل بطلب — طلب واحد يدعم عدة وصولات
 */
export async function POST(req) {
  try {
    await dbConnect();
    const auth = await requireDelegateAccess();
    if (auth.error) return auth.error;

    const body = await req.json();
    const voucherId = String(body?.voucherId || "").trim();
    const requestId = String(body?.requestId || "").trim();
    let requestCompanyKey = String(body?.requestCompanyKey || "").trim();

    if (!voucherId || !requestId) {
      return NextResponse.json(
        { success: false, error: "voucherId و requestId مطلوبان" },
        { status: 400 }
      );
    }

    if (!requestCompanyKey) {
      for (const ck of REQUEST_COMPANY_KEYS) {
        try {
          const Model = getModelForCompany(ck);
          const doc = await Model.findById(requestId).select("companyKey").lean();
          if (doc) {
            requestCompanyKey = String(doc.companyKey || ck);
            break;
          }
        } catch {
          /* next */
        }
      }
    }

    if (!requestCompanyKey) {
      return NextResponse.json(
        { success: false, error: "تعذّر تحديد شركة الطلب" },
        { status: 400 }
      );
    }

    const voucher = await Voucher.findById(voucherId).select("_id").lean();
    if (!voucher) {
      return NextResponse.json({ success: false, error: "الوصل غير موجود" }, { status: 404 });
    }

    const actor = await User.findById(auth.userId).select("username").lean();
    const result = await linkVoucherToRequest({
      requestCompanyKey,
      requestId,
      voucherId,
      userId: auth.userId,
      username: actor?.username || "",
    });

    if (!result?.ok) {
      const messages = {
        invalid_ids: "معرّفات غير صالحة",
        voucher_not_found: "الوصل غير موجود",
        request_not_found: "الطلب غير موجود",
        voucher_linked_to_other_request: "هذا الوصل مربوط بطلب آخر",
        voucher_mismatch: "الوصل لا يطابق هذا الطلب",
      };
      return NextResponse.json(
        {
          success: false,
          error: messages[result?.reason] || result?.reason || "فشل الربط",
          reason: result?.reason,
        },
        { status: 400 }
      );
    }

    let requestCode = "";
    try {
      const Model = getModelForCompany(requestCompanyKey);
      const reqDoc = await Model.findById(requestId).select("requestCode").lean();
      requestCode = String(reqDoc?.requestCode || "").trim();
    } catch {
      /* ignore */
    }

    return NextResponse.json({
      success: true,
      message:
        result.linkedCount > 1
          ? `تم الربط — الطلب مرتبط الآن بـ ${result.linkedCount} وصولات`
          : "تم ربط الوصل بالطلب",
      voucherNo: result.voucherNo,
      linkedCount: result.linkedCount,
      requestLink: {
        href: buildRequestPageHref(requestCompanyKey, requestId),
        requestCode,
      },
    });
  } catch (err) {
    console.error("vouchers/link-request POST:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Server error" },
      { status: 500 }
    );
  }
}
