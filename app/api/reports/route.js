// app/api/reports/route.js
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";
import { getModelForCompany } from "@/models/Request";

export const runtime = "nodejs";
import { cookies } from "next/headers";
import Permissions from "@/models/Permissions";
import { PERMISSIONS } from "@/lib/permission";

const safeSplit = (v) =>
  String(v || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

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
  if (keys.length === 0) return true;
  if (keys.length === 1 && keys[0] === "company") return true;
  return false;
}

function computePendingWithIds(doc) {
  try {
    if (
      doc?.status === "Pending" &&
      Number.isInteger(doc?.currentStep) &&
      doc?.workflow?.steps?.length
    ) {
      const st = doc.workflow.steps[doc.currentStep];
      if (st?.status === "Pending" && Array.isArray(st?.users)) {
        return st.users.map((u) => String(u));
      }
    }
  } catch {}
  return [];
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

    if (!allowedCompanies.length) {
      return NextResponse.json({
        success: true,
        filters: {
          companies: [],
          users: [],
          currencies: [],
          statuses: [],
          pendingUsers: [],
        },
        data: [],
        meta: { total: 0, totalPages: 0, page: 1, pageSize: 0 },
      });
    }

    const { searchParams } = new URL(req.url);

    // =========================
    // 1) CODES MODE (GLOBAL)
    // =========================
    const codesMode = searchParams.get("codes") === "1";
    if (codesMode) {
      const q = (searchParams.get("q") || "").trim();

      const cond = {};
      if (q) cond.requestCode = { $regex: q, $options: "i" };

      const allCodes = await Promise.all(
        allowedCompanies.map(async (companyKey) => {
          const Model = getModelForCompany(companyKey);
          const codes = await Model.distinct("requestCode", cond);
          return codes || [];
        })
      );

      const set = new Set();
      for (const arr of allCodes) {
        for (const c of arr) if (c) set.add(String(c));
      }

      const data = Array.from(set)
        .sort()
        .slice(0, 50)
        .map((c) => ({ value: c, label: c }));

      return NextResponse.json({ success: true, data });
    }

    // =========================
    // 2) FILTERS ONLY
    // =========================
    if (isFiltersOnlyRequest(searchParams)) {
      const wantFull = searchParams.get("filters") === "1";

      const pendingUsers = await User.find({})
        .select("_id username")
        .lean();

      if (!wantFull) {
        return NextResponse.json({
          success: true,
          filters: {
            companies: allowedCompanies,
            users: [],
            currencies: [],
            statuses: ["Pending", "Approved", "Rejected", "Cancelled"],
            pendingUsers: pendingUsers.map((u) => ({
              value: String(u._id),
              label: u.username,
            })),
          },
          data: [],
          meta: { total: 0, totalPages: 0, page: 1, pageSize: 0 },
        });
      }

      // FULL filters
      const allUsers = await User.find({}).select("username").lean();

      const currencyArrays = await Promise.all(
        allowedCompanies.map(async (companyKey) => {
          const Model = getModelForCompany(companyKey);
          const arr = await Model.distinct("currency", {});
          return arr || [];
        })
      );

      const currenciesSet = new Set();
      currencyArrays.flat().forEach((c) => c && currenciesSet.add(String(c)));

      const statuses = ["Pending", "Approved", "Rejected", "Cancelled"];

      return NextResponse.json({
        success: true,
        filters: {
          companies: allowedCompanies,
          users: allUsers.map((u) => u.username).filter(Boolean),
          currencies: Array.from(currenciesSet).sort(),
          statuses,
          pendingUsers: pendingUsers.map((u) => ({
            value: String(u._id),
            label: u.username,
          })),
        },
        data: [],
        meta: { total: 0, totalPages: 0, page: 1, pageSize: 0 },
      });
    }

    // =========================
    // 3) QUERY PARAMS (✅ هذا كان ناقص عندك)
    // =========================
    const companiesParam = searchParams.get("company") || "all";
    const usersParam = searchParams.get("user") || "all";
    const statusParam = searchParams.get("status") || "all";
    const currencyParam = searchParams.get("currency") || "all";
    const pendingParam = searchParams.get("pending") || "all";
    const fromDate = searchParams.get("from") || "";
    const toDate = searchParams.get("to") || "";
    const codeParam = (searchParams.get("code") || "").trim();

    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const pageSize = Math.max(
      10,
      Math.min(200, parseInt(searchParams.get("pageSize") || "25", 10))
    );

    // companyList based on allowedCompanies
    let companyList = null;
    if (companiesParam === "all") {
      companyList = allowedCompanies;
    } else {
      const requested = safeSplit(companiesParam);
      companyList = requested.filter((c) => allowedCompanies.includes(c));
    }

    if (!companyList.length) {
      const pendingUsers = await User.find({}).select("_id username").lean();
      return NextResponse.json({
        success: true,
        filters: {
          companies: allowedCompanies,
          users: [],
          currencies: [],
          statuses: [],
          pendingUsers: pendingUsers.map((u) => ({
            value: String(u._id),
            label: u.username,
          })),
        },
        data: [],
        meta: { total: 0, totalPages: 0, page, pageSize },
      });
    }

    // createdBy list
    const createdByList = usersParam === "all" ? null : safeSplit(usersParam);

    const buildQuery = () => {
      const query = {};

      if (codeParam) query.requestCode = { $regex: codeParam, $options: "i" };
      if (createdByList) query.createdBy = { $in: createdByList };
      if (statusParam !== "all") query.status = statusParam;
      if (currencyParam !== "all") query.currency = currencyParam;

      if (fromDate || toDate) {
        query.createdAt = {};
        if (fromDate) query.createdAt.$gte = new Date(fromDate);
        if (toDate) {
          const end = new Date(toDate);
          end.setHours(23, 59, 59, 999);
          query.createdAt.$lte = end;
        }
      }

      return query;
    };

    const queryBase = buildQuery();

    // ====== total count (per company) ======
    const countsByCompany = await Promise.all(
      companyList.map(async (companyKey) => {
        const Model = getModelForCompany(companyKey);
        const c = await Model.countDocuments(queryBase);
        return { companyKey, count: c };
      })
    );

    const total = countsByCompany.reduce((a, x) => a + x.count, 0);
    const totalPages = total ? Math.ceil(total / pageSize) : 0;

    if (!total) {
      const pendingUsers = await User.find({}).select("_id username").lean();
      return NextResponse.json({
        success: true,
        filters: {
          companies: companyList,
          users: [],
          currencies: [],
          statuses: [],
          pendingUsers: pendingUsers.map((u) => ({
            value: String(u._id),
            label: u.username,
          })),
        },
        data: [],
        meta: { total: 0, totalPages: 0, page, pageSize },
      });
    }

    // ====== smart skip/limit across companies ======
    const globalSkip = (page - 1) * pageSize;
    let remainingSkip = globalSkip;
    let remainingTake = pageSize;

    const plan = [];

    for (const { companyKey, count } of countsByCompany) {
      if (remainingTake <= 0) break;
      if (count <= 0) continue;

      if (remainingSkip >= count) {
        remainingSkip -= count;
        continue;
      }

      const skip = Math.max(0, remainingSkip);
      const available = count - skip;
      const limit = Math.min(remainingTake, available);

      plan.push({ companyKey, skip, limit });

      remainingSkip = 0;
      remainingTake -= limit;
    }

    // fetch only needed
    const fetchPromises = plan.map(async ({ companyKey, skip, limit }) => {
      const Model = getModelForCompany(companyKey);

      const docs = await Model.find(queryBase)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

      return docs.map((d) => ({ ...d, companyKey }));
    });

    let merged = (await Promise.all(fetchPromises)).flat();

    for (const d of merged) d.pendingWithIds = computePendingWithIds(d);

    if (pendingParam !== "all") {
      const p = String(pendingParam);
      merged = merged.filter((d) => d.pendingWithIds?.includes(p));
    }

    merged.sort((a, b) => {
      const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return tb - ta;
    });

    // pendingWithNames
    const allPendingIds = new Set();
    for (const d of merged)
      (d.pendingWithIds || []).forEach((id) => allPendingIds.add(String(id)));

    let pendingNameMap = new Map();
    if (allPendingIds.size > 0) {
      const users = await User.find({ _id: { $in: Array.from(allPendingIds) } })
        .select("_id username")
        .lean();
      pendingNameMap = new Map(users.map((u) => [String(u._id), u.username]));
    }

    const finalData = merged.map((d) => {
      let totalAmount = 0;
    
      if (Array.isArray(d.items)) {
        totalAmount = d.items.reduce((sum, it) => {
          const q = Number(it.qty || 0);
          const p = Number(it.price || 0);
          return sum + q * p;
        }, 0);
      }
    
      return {
        ...d,
        totalAmount, // ✅ هذا المهم
        pendingWithNames: (d.pendingWithIds || [])
          .map((id) => pendingNameMap.get(String(id)))
          .filter(Boolean),
      };
    });
    // light filters from current page
    const pageUsers = new Set();
    const pageCurrencies = new Set();
    const pageStatuses = new Set();

    for (const d of finalData) {
      if (d.createdBy) pageUsers.add(d.createdBy);
      if (d.currency) pageCurrencies.add(d.currency);
      if (d.status) pageStatuses.add(d.status);
    }

    const pendingUsers = await User.find({}).select("_id username").lean();

    return NextResponse.json({
      success: true,
      filters: {
        companies: companyList,
        users: Array.from(pageUsers),
        currencies: Array.from(pageCurrencies),
        statuses: Array.from(pageStatuses),
        pendingUsers: pendingUsers.map((u) => ({
          value: String(u._id),
          label: u.username,
        })),
      },
      data: finalData,
      meta: { total, totalPages, page, pageSize },
    });
  } catch (err) {
    console.error("❌ Reports API Error:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}