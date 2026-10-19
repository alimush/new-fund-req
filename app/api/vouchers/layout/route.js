import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import { cookies } from "next/headers";
import Permissions from "@/models/Permissions";
import VoucherLayout from "@/models/VoucherLayout";
import {
  COMPANIES,
  POS_NEW,
  getCompanyExtra,
} from "@/lib/voucher/companies";
import { PERMISSIONS, hasPermission } from "@/lib/permission";
import {
  buildDefaultVoucherLayoutFields,
  mergeVoucherLayoutFields,
  normalizeLayoutField,
} from "@/lib/voucher/voucherLayout";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getUserPerms(userId) {
  if (!userId) return [];
  const groups = await Permissions.find({ users: userId })
    .select("permissions")
    .lean();
  const set = new Set();
  for (const g of groups) {
    (g.permissions || []).forEach((p) => set.add(String(p).trim()));
  }
  return Array.from(set);
}

function resolveCompany(companyKey) {
  const n = String(companyKey || "").trim().toLowerCase();
  return COMPANIES.find((c) => String(c.key).trim().toLowerCase() === n) || null;
}

/** اجلب وثيقة الشركة — مع دمج أي وثائق mode قديمة (payment/receipt/shared) إن وُجدت */
async function resolveCompanyLayoutDoc(companyKey) {
  const key = String(companyKey || "").trim();
  const col = VoucherLayout.collection;

  // الوثيقة الجديدة (بدون mode / unique على companyKey)
  let doc = await VoucherLayout.findOne({ companyKey: key }).lean();
  if (doc?.fields?.length) return doc;

  // توافق خلفي: وثائق قديمة بمفتاح مركّب companyKey+mode
  const legacy = await col
    .find({ companyKey: key })
    .sort({ updatedAt: -1 })
    .toArray();

  if (!legacy.length) return null;

  // فضّل shared ثم أحدث وثيقة فيها fields
  const preferred =
    legacy.find((d) => d.mode === "shared" && d.fields?.length) ||
    legacy.find((d) => d.fields?.length) ||
    legacy[0];

  return preferred;
}

export async function GET(req) {
  try {
    await dbConnect();
    const cookieStore = await cookies();
    const userId = cookieStore.get("userId")?.value;
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const companyKey = String(searchParams.get("companyKey") || "").trim();

    const company = resolveCompany(companyKey);
    if (!company) {
      return NextResponse.json(
        { success: false, error: "شركة غير صالحة" },
        { status: 400 }
      );
    }

    const EXTRA = getCompanyExtra(company, false);
    const defaults = buildDefaultVoucherLayoutFields({
      company,
      POS: POS_NEW,
      EXTRA,
    });

    const doc = await resolveCompanyLayoutDoc(company.key);
    const fields = mergeVoucherLayoutFields(defaults, doc?.fields || []);

    return NextResponse.json({
      success: true,
      data: {
        companyKey: company.key,
        /** صرف وقبض يشتركان بنفس الإحداثيات */
        sharedForPaymentAndReceipt: true,
        fields,
        updatedAt: doc?.updatedAt || null,
        fromDb: Boolean(doc),
      },
    });
  } catch (err) {
    console.error("voucher layout GET:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Server error" },
      { status: 500 }
    );
  }
}

export async function POST(req) {
  try {
    await dbConnect();
    const cookieStore = await cookies();
    const userId = cookieStore.get("userId")?.value;
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const perms = await getUserPerms(userId);
    if (!hasPermission(perms, PERMISSIONS.VOUCHERS_FIELD_LAYOUT)) {
      return NextResponse.json(
        { success: false, error: "ليس لديك صلاحية ترتيب حقول الوصولات" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const companyKey = String(body?.companyKey || "").trim();
    const company = resolveCompany(companyKey);
    if (!company) {
      return NextResponse.json(
        { success: false, error: "شركة غير صالحة" },
        { status: 400 }
      );
    }

    const EXTRA = getCompanyExtra(company, false);
    const defaults = buildDefaultVoucherLayoutFields({
      company,
      POS: POS_NEW,
      EXTRA,
    });
    const allowed = new Set(defaults.map((f) => f.key));
    const incoming = Array.isArray(body?.fields) ? body.fields : [];
    const cleaned = incoming
      .map((f) => normalizeLayoutField(f))
      .filter((f) => f && allowed.has(f.key));

    const fields = mergeVoucherLayoutFields(defaults, cleaned);

    // وثيقة واحدة فقط لكل شركة (صرف = قبض). امسح أي نسخ قديمة بـ mode
    await VoucherLayout.collection.deleteMany({ companyKey: company.key });

    const doc = await VoucherLayout.create({
      companyKey: company.key,
      fields,
      updatedBy: String(userId),
    });
    const lean = doc.toObject?.() || doc;

    return NextResponse.json({
      success: true,
      data: {
        companyKey: company.key,
        sharedForPaymentAndReceipt: true,
        fields: lean?.fields || fields,
        updatedAt: lean?.updatedAt || null,
      },
    });
  } catch (err) {
    console.error("voucher layout POST:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Server error" },
      { status: 500 }
    );
  }
}
