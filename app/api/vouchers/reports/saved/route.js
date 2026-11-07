import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import mongoose from "mongoose";
import dbConnect from "@/lib/mongodb";
import Permissions from "@/models/Permissions";
import User from "@/models/User";
import VoucherSavedDailyReport from "@/models/VoucherSavedDailyReport";
import { PERMISSIONS } from "@/lib/permission";
import { COMPANIES } from "@/lib/voucher/companies";
import { leanVouchersForDailyReport } from "@/lib/voucher/leanVoucherForDailyReport";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getUserAccess(userId) {
  if (!userId || !mongoose.Types.ObjectId.isValid(String(userId))) {
    return { allowedCompanies: [], allowedPerms: [] };
  }
  const groups = await Permissions.find({
    users: new mongoose.Types.ObjectId(String(userId)),
  })
    .select("companies permissions")
    .lean();

  const companiesSet = new Set();
  const permsSet = new Set();
  for (const g of groups) {
    (g.companies || []).forEach((c) => companiesSet.add(String(c).trim()));
    (g.permissions || []).forEach((p) => permsSet.add(String(p).trim()));
  }

  // صلاحيات صناديق الوصل → مفاتيح الشركات
  const voucherPermToKey = new Map(
    COMPANIES.filter((c) => c.permission).map((c) => [
      String(c.permission),
      c.key,
    ])
  );
  for (const p of permsSet) {
    const key = voucherPermToKey.get(p);
    if (key) companiesSet.add(key);
  }

  return {
    allowedCompanies: Array.from(companiesSet).filter(Boolean),
    allowedPerms: Array.from(permsSet).filter(Boolean),
  };
}

function companyName(key) {
  const found = COMPANIES.find(
    (c) => String(c.key).toLowerCase() === String(key || "").toLowerCase()
  );
  return found?.name || key || "";
}

function buildTitle({ dateFrom, dateTo, companyKeys, companyNames }) {
  const range =
    dateFrom && dateTo
      ? dateFrom === dateTo
        ? dateFrom
        : `${dateFrom} → ${dateTo}`
      : dateFrom || dateTo || "بدون تاريخ";
  const names = (companyNames || []).filter(Boolean);
  const keys = companyKeys || [];
  const label =
    names.length === 1
      ? names[0]
      : names.length > 1
      ? `${names.length} صناديق`
      : keys.length === 1
      ? companyName(keys[0])
      : keys.length
      ? `${keys.length} صناديق`
      : "تقرير يومي";
  return `تقرير يومي — ${label} — ${range}`;
}

async function requireReportsUser() {
  const cookieStore = await cookies();
  const userId = cookieStore.get("userId")?.value;
  if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
    return { ok: false, res: NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 }) };
  }
  const { allowedCompanies, allowedPerms } = await getUserAccess(userId);
  const canView =
    allowedPerms.includes(PERMISSIONS.VOUCHERS_REPORTS_VIEW) ||
    allowedPerms.includes(PERMISSIONS.VIEW_ALL_REPORTS) ||
    COMPANIES.some((c) => c.permission && allowedPerms.includes(c.permission));
  if (!canView) {
    return {
      ok: false,
      res: NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 }),
    };
  }
  const user = await User.findById(userId).select("username").lean();
  const username = String(user?.username || "").trim();
  const isAdmin =
    /^admin$/i.test(username) ||
    allowedPerms.includes(PERMISSIONS.VIEW_ALL_REPORTS);
  return {
    ok: true,
    userId,
    username,
    isAdmin,
    allowedCompanies,
    allowedPerms,
  };
}

/** قائمة التقارير المحفوظة */
export async function GET(req) {
  try {
    await dbConnect();
    const auth = await requireReportsUser();
    if (!auth.ok) return auth.res;

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const pageSize = Math.min(
      100,
      Math.max(10, parseInt(searchParams.get("pageSize") || "25", 10))
    );

    // الأدمن يشوف الكل؛ الباقي فقط تقاريره
    const query = auth.isAdmin
      ? {}
      : { savedByUserId: new mongoose.Types.ObjectId(auth.userId) };

    const [total, rows] = await Promise.all([
      VoucherSavedDailyReport.countDocuments(query),
      VoucherSavedDailyReport.find(query)
        .select(
          "title dateFrom dateTo companyFilter companyKeys companyNames cashier voucherCount savedByUsername createdAt fontSize fontBold signedAttachments"
        )
        .sort({ createdAt: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean(),
    ]);

    return NextResponse.json({
      success: true,
      data: rows,
      meta: {
        total,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    });
  } catch (e) {
    console.error("saved reports GET:", e);
    return NextResponse.json(
      { success: false, error: e?.message || "Failed" },
      { status: 500 }
    );
  }
}

/** حفظ لقطة تقرير عند الطباعة */
export async function POST(req) {
  try {
    await dbConnect();
    const auth = await requireReportsUser();
    if (!auth.ok) return auth.res;

    const body = await req.json().catch(() => ({}));
    const vouchers = leanVouchersForDailyReport(body?.vouchers);
    const dateFrom = String(body?.dateFrom || "").trim();
    const dateTo = String(body?.dateTo || "").trim();
    const companyFilter = String(body?.companyFilter || "all").trim() || "all";
    const cashier = String(body?.cashier || auth.username || "").trim();
    const prevBalances =
      body?.prevBalances && typeof body.prevBalances === "object"
        ? body.prevBalances
        : {};
    const fontSize = Number(body?.fontSize);
    const fontBold = body?.fontBold !== false;

    const companyKeys = [
      ...new Set(
        (Array.isArray(body?.companyKeys) ? body.companyKeys : [])
          .map((k) => String(k || "").trim())
          .filter(Boolean)
      ),
    ];
    if (!companyKeys.length) {
      for (const v of vouchers) {
        const k = String(v.companyKey || "").trim();
        if (k && !companyKeys.includes(k)) companyKeys.push(k);
      }
    }
    if (!companyKeys.length && companyFilter.toLowerCase() !== "all") {
      companyKeys.push(companyFilter);
    }

    const companyNames = companyKeys.map(companyName);
    const title =
      String(body?.title || "").trim() ||
      buildTitle({ dateFrom, dateTo, companyKeys, companyNames });

    const doc = await VoucherSavedDailyReport.create({
      savedByUserId: auth.userId,
      savedByUsername: auth.username,
      title,
      dateFrom,
      dateTo,
      companyFilter,
      companyKeys,
      companyNames,
      cashier,
      prevBalances,
      fontSize: Number.isFinite(fontSize) ? Math.min(14, Math.max(7, Math.round(fontSize))) : 9,
      fontBold,
      voucherCount: vouchers.length,
      vouchers,
    });

    return NextResponse.json({
      success: true,
      data: {
        _id: String(doc._id),
        title: doc.title,
        createdAt: doc.createdAt,
        voucherCount: doc.voucherCount,
      },
    });
  } catch (e) {
    console.error("saved reports POST:", e);
    return NextResponse.json(
      { success: false, error: e?.message || "Failed" },
      { status: 500 }
    );
  }
}
