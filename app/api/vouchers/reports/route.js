import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import { cookies } from "next/headers";
import Permissions from "@/models/Permissions";
import { PERMISSIONS } from "@/lib/permission";
import mongoose from "mongoose";

export const runtime = "nodejs";

const COLLECTION_NAME = "vouchers";
const VOUCHER_COMPANIES = ["Al-Ghadeer", "Badur-Baghdad"];

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

    const { allowedCompanies, allowedPerms } = await getUserAccess(userId);

    if (!allowedPerms.includes(PERMISSIONS.VIEW_REPORTS)) {
      return NextResponse.json(
        { success: false, error: "Forbidden: missing VIEW_REPORTS permission" },
        { status: 403 }
      );
    }

    const finalAllowedCompanies = allowedCompanies.filter((c) =>
      VOUCHER_COMPANIES.includes(String(c))
    );

    const db = mongoose.connection.db;
    const col = db.collection(COLLECTION_NAME);

    const { searchParams } = new URL(req.url);

    // =========================
    // filters only
    // =========================
    if (isFiltersOnlyRequest(searchParams)) {
      const currencies = await col.distinct("currency", {
        companyKey: { $in: finalAllowedCompanies },
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

    // =========================
    // suggest only
    // =========================
    if (searchParams.get("suggest") === "1") {
      const q = (searchParams.get("q") || "").trim();
      if (!q) return NextResponse.json({ success: true, data: [] });

      const rx = new RegExp(escapeRegex(q), "i");

      const docs = await col
        .find(
          {
            companyKey: { $in: finalAllowedCompanies },
            $or: [
              { voucherNo: { $regex: rx } },
              { requestId: { $regex: rx } },
              { description: { $regex: rx } },
              { beneficiary: { $regex: rx } },
              { receivedBy: { $regex: rx } },
              { bank: { $regex: rx } },
            ],
          },
          {
            projection: {
              voucherNo: 1,
              requestId: 1,
              description: 1,
              beneficiary: 1,
              receivedBy: 1,
              bank: 1,
            },
          }
        )
        .sort({ createdAt: -1 })
        .limit(50)
        .toArray();

      const out = [];
      const seen = new Set();

      for (const d of docs) {
        const candidates = [
          { value: d.voucherNo, label: d.voucherNo, type: "voucherNo" },
          { value: d.requestId, label: d.requestId, type: "requestId" },
          {
            value: d.description,
            label: d.description,
            type: "description",
          },
          {
            value: d.beneficiary,
            label: d.beneficiary,
            type: "beneficiary",
          },
          {
            value: d.receivedBy,
            label: d.receivedBy,
            type: "receivedBy",
          },
          { value: d.bank, label: d.bank, type: "bank" },
        ];

        for (const c of candidates) {
          if (!c.value) continue;
          if (!rx.test(String(c.value))) continue;

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

    // =========================
    // main query (table search only)
    // =========================
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

    const companyList =
      company === "all"
        ? finalAllowedCompanies
        : finalAllowedCompanies.includes(company)
        ? [company]
        : [];

    if (!companyList.length) {
      return NextResponse.json({
        success: true,
        data: [],
        meta: { total: 0, totalPages: 0, page, pageSize },
      });
    }

    const query = {
      companyKey: { $in: companyList },
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
    const totalPages = total ? Math.ceil(total / pageSize) : 0;

    const data = await col
      .find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .toArray();

    return NextResponse.json({
      success: true,
      data,
      meta: { total, totalPages, page, pageSize },
    });
  } catch (err) {
    console.error("❌ Voucher Reports API Error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Server error" },
      { status: 500 }
    );
  }
}