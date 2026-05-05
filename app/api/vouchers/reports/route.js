import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import { cookies } from "next/headers";
import Permissions from "@/models/Permissions";
import { PERMISSIONS } from "@/lib/permission";
import mongoose from "mongoose";
import { COMPANIES } from "@/lib/voucher/companies";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COLLECTION_NAME = "vouchers";
const VOUCHER_COMPANIES = COMPANIES.map((c) => c.key);

const escapeRegex = (s) =>
  String(s || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

async function getUserAccess(userId) {
  if (!userId) return { allowedCompanies: [], allowedPerms: [] };

  const groups = await Permissions.find({ users: userId })
    .select("companies permissions")
    .lean();

  const companiesSet = new Set();
  const permsSet = new Set();

  for (const g of groups) {
    (g.companies || []).forEach((c) => companiesSet.add(String(c).trim()));
    (g.permissions || []).forEach((p) => permsSet.add(String(p).trim()));
  }

  return {
    allowedCompanies: Array.from(companiesSet).filter(Boolean),
    allowedPerms: Array.from(permsSet).filter(Boolean),
  };
}

function isFiltersOnlyRequest(searchParams) {
  if (searchParams.get("filters") === "1") return true;
  const keys = Array.from(searchParams.keys());
  return keys.length === 0;
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

    const { allowedPerms } = await getUserAccess(userId);

    // 1. التحقق من الصلاحية العامة للتقارير أو الوصولات
    const hasGeneralAccess = allowedPerms.includes(PERMISSIONS.VOUCHERS_REPORTS_VIEW) || 
                             allowedPerms.includes(PERMISSIONS.RECEIPTS) ||
                             allowedPerms.includes(PERMISSIONS.VIEW_ALL_REPORTS);

    if (!hasGeneralAccess) {
      return NextResponse.json(
        { success: false, error: "ليس لديك صلاحية لمشاهدة التقارير" },
        { status: 403 }
      );
    }

    // 2. فلترة الشركات بناءً على الصلاحيات الخاصة بكل شركة
    const finalAllowedCompanies = COMPANIES.filter(c => 
      allowedPerms.includes(c.permission) || allowedPerms.includes(PERMISSIONS.VIEW_ALL_REPORTS)
    ).map(c => c.key);

    const db = mongoose.connection.db;
    const col = db.collection(COLLECTION_NAME);

    const { searchParams } = new URL(req.url);

    // filters only
    if (isFiltersOnlyRequest(searchParams)) {
      const currencies = await col.distinct("currency", {
        companyKey: { $in: finalAllowedCompanies.map(c => new RegExp(`^${escapeRegex(c)}$`, "i")) },
      });

      return NextResponse.json({
        success: true,
        filters: {
          companies: finalAllowedCompanies,
          currencies: (currencies || []).filter(Boolean).sort(),
        },
        data: [],
        meta: { total: 0, totalPages: 0, page: 1, pageSize: 0 },
      });
    }

    // suggest only
    if (searchParams.get("suggest") === "1") {
      const q = (searchParams.get("q") || "").trim();
      if (!q) return NextResponse.json({ success: true, data: [] });

      const smartOr = [
        { voucherNo: { $regex: escapeRegex(q), $options: "i" } },
        { requestId: { $regex: escapeRegex(q), $options: "i" } },
        { description: { $regex: escapeRegex(q), $options: "i" } },
        { beneficiary: { $regex: escapeRegex(q), $options: "i" } },
        { receivedBy: { $regex: escapeRegex(q), $options: "i" } },
        { bank: { $regex: escapeRegex(q), $options: "i" } },
      ];

      const results = await col
        .find({
          companyKey: { $in: finalAllowedCompanies.map(c => new RegExp(`^${escapeRegex(c)}$`, "i")) },
          $or: smartOr,
        })
        .limit(100)
        .toArray();

      const out = [];
      const seen = new Set();

      for (const doc of results) {
        const candidates = [
          { type: "no", value: doc.voucherNo, label: `رقم الوصل: ${doc.voucherNo}` },
          { type: "beneficiary", value: doc.beneficiary, label: `المستفيد: ${doc.beneficiary}` },
          { type: "receivedBy", value: doc.receivedBy, label: `استلمت من: ${doc.receivedBy}` },
          { type: "bank", value: doc.bank, label: `البنك: ${doc.bank}` },
        ].filter(c => c.value && String(c.value).toLowerCase().includes(q.toLowerCase()));

        for (const c of candidates) {
          const key = `${c.type}|${c.value}`;
          if (seen.has(key)) continue;

          seen.add(key);
          out.push(c);
        }
      }

      return NextResponse.json({
        success: true,
        data: out.slice(0, 30),
      });
    }

    // main query
    const q = (searchParams.get("q") || "").trim();
    const company = searchParams.get("company") || "all";
    const mode = searchParams.get("mode") || "all";
    const currency = searchParams.get("currency") || "all";

    const seq = (searchParams.get("seq") || "").trim();
    const beneficiary = (searchParams.get("beneficiary") || "").trim();
    const receivedBy = (searchParams.get("receivedBy") || "").trim();
    const bank = (searchParams.get("bank") || "").trim();

    const fromDate = searchParams.get("from") || "";
    const toDate = searchParams.get("to") || "";

    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const pageSize = Math.max(
      10,
      Math.min(200, parseInt(searchParams.get("pageSize") || "25", 10))
    );

    // Filter allowed companies based on user selection (case-insensitive)
    const companyList =
      company === "all"
        ? finalAllowedCompanies
        : finalAllowedCompanies.filter(c => String(c).toLowerCase() === company.toLowerCase());

    if (!companyList.length) {
      return NextResponse.json({
        success: true,
        data: [],
        meta: { total: 0, totalPages: 0, page, pageSize },
      });
    }

    const query = {
      companyKey: { $in: companyList.map(c => new RegExp(`^${escapeRegex(c)}$`, "i")) },
    };

    if (mode !== "all") query.mode = mode;
    if (currency !== "all") query.currency = currency;

    if (seq) {
      const n = Number(seq);
      if (Number.isFinite(n)) {
        query.$or = [
          { seq: n },
          { voucherNo: { $regex: escapeRegex(seq), $options: "i" } },
        ];
      } else {
        query.voucherNo = { $regex: escapeRegex(seq), $options: "i" };
      }
    }

    if (beneficiary) {
      query.beneficiary = {
        $regex: escapeRegex(beneficiary),
        $options: "i",
      };
    }

    if (receivedBy) {
      query.receivedBy = {
        $regex: escapeRegex(receivedBy),
        $options: "i",
      };
    }

    if (bank) {
      query.bank = {
        $regex: escapeRegex(bank),
        $options: "i",
      };
    }

    if (fromDate || toDate) {
      query.createdAt = {};
      if (fromDate) query.createdAt.$gte = new Date(fromDate);
      if (toDate) {
        const end = new Date(toDate);
        end.setHours(23, 59, 59, 999);
        query.createdAt.$lte = end;
      }
    }

    if (q) {
      const smartOr = [
        { voucherNo: { $regex: escapeRegex(q), $options: "i" } },
        { requestId: { $regex: escapeRegex(q), $options: "i" } },
        { description: { $regex: escapeRegex(q), $options: "i" } },
        { beneficiary: { $regex: escapeRegex(q), $options: "i" } },
        { receivedBy: { $regex: escapeRegex(q), $options: "i" } },
        { bank: { $regex: escapeRegex(q), $options: "i" } },
      ];

      if (query.$or) {
        query.$and = [{ $or: query.$or }, { $or: smartOr }];
        delete query.$or;
      } else {
        query.$or = smartOr;
      }
    }

    const total = await col.countDocuments(query);
    const results = await col
      .find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .toArray();

    return NextResponse.json({
      success: true,
      data: results.map(r => ({ ...r, _id: r._id.toString() })),
      meta: {
        total,
        totalPages: Math.ceil(total / pageSize),
        page,
        pageSize,
      },
    });
  } catch (err) {
    console.error("Voucher Reports Error:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}