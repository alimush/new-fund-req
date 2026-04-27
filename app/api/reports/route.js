// app/api/reports/route.js
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";
import { getModelForCompany } from "@/models/Request";
import { cookies } from "next/headers";
import Permissions from "@/models/Permissions";
import { PERMISSIONS } from "@/lib/permission";
import RequestOldData from "@/models/RequestOldData";

export const runtime = "nodejs";

const safeSplit = (v) =>
  String(v || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

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

function computeTotalAmount(doc) {
  let totalAmount = 0;

  if (Array.isArray(doc?.items)) {
    totalAmount = doc.items.reduce((sum, it) => {
      const q = Number(it?.qty || 0);
      const p = Number(it?.price || 0);
      return sum + q * p;
    }, 0);
  }

  return totalAmount;
}

function parseDigitsAmount(q) {
  const cleaned = String(q || "").replace(/,/g, "").trim();
  if (!cleaned) return { isNumber: false, amount: null };
  if (!/^\d+$/.test(cleaned)) return { isNumber: false, amount: null };
  return { isNumber: true, amount: Number(cleaned) };
}

async function getCurrenciesBySource(source, allowedCompanies) {
  if (source === "old") {
    return await RequestOldData.distinct("currency", {
      companyKey: { $in: allowedCompanies },
    });
  }

  const currencyArrays = await Promise.all(
    allowedCompanies.map(async (companyKey) => {
      const Model = getModelForCompany(companyKey);
      return await Model.distinct("currency", {});
    })
  );

  return currencyArrays.flat();
}

async function getNewDocsByCompany({
  companyList,
  queryBase,
  select = null,
}) {
  const docsByCompany = await Promise.all(
    companyList.map(async (companyKey) => {
      const Model = getModelForCompany(companyKey);

      let q = Model.find(queryBase).sort({ createdAt: -1 });
      if (select) q = q.select(select);

      const docs = await q.lean();
      return (docs || []).map((d) => ({ ...d, companyKey }));
    })
  );

  return docsByCompany.flat();
}

async function getOldDocs({
  companyList,
  queryBase,
  select = null,
}) {
  let q = RequestOldData.find({
    ...queryBase,
    companyKey: { $in: companyList },
  }).sort({ createdAt: -1 });

  if (select) q = q.select(select);

  return await q.lean();
}

async function getDocsBySource({
  source,
  companyList,
  queryBase,
  select = null,
}) {
  if (source === "old") {
    return await getOldDocs({ companyList, queryBase, select });
  }

  return await getNewDocsByCompany({ companyList, queryBase, select });
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

    const currentUser = await User.findById(userId).select("username").lean();
    const currentUsername = String(currentUser?.username || "").trim();

    const { allowedCompanies, allowedPerms } = await getUserAccess(userId);

    const canViewReports = allowedPerms.includes(PERMISSIONS.VIEW_REPORTS);
    const canViewAllReports = allowedPerms.includes(
      PERMISSIONS.VIEW_ALL_REPORTS
    );

    if (!canViewReports && !canViewAllReports) {
      return NextResponse.json(
        { success: false, error: "Forbidden: missing reports permission" },
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
    const source = searchParams.get("source") || "new";
    const isOldSource = source === "old";

    // =========================
    // SUGGEST MODE
    // =========================
    if (searchParams.get("suggest") === "1") {
      const q = (searchParams.get("q") || "").trim();
      if (!q) return NextResponse.json({ success: true, data: [] });

      const { isNumber } = parseDigitsAmount(q);

      if (isNumber) {
        return NextResponse.json({ success: true, data: [] });
      }

      const rxText = escapeRegex(q);
      const rx = new RegExp(rxText, "i");

      const cond = {
        status: { $ne: "Cancelled" },
      
        ...(canViewAllReports
          ? {}
          : { createdBy: currentUsername || "__never_match__" }),
      
        $or: [
          { requestCode: { $regex: rxText, $options: "i" } },
          { description: { $regex: rxText, $options: "i" } },
        ],
      };

      const merged = await getDocsBySource({
        source,
        companyList: allowedCompanies,
        queryBase: cond,
        select: "requestCode description createdAt companyKey",
      });

      const codesSet = new Set();
      const descMap = new Map();

      for (const d of merged) {
        const code = String(d?.requestCode || "").trim();
        const desc = String(d?.description || "").trim();

        if (code && rx.test(code)) {
          codesSet.add(code);
        }

        if (desc && rx.test(desc)) {
          const short = desc.length > 60 ? desc.slice(0, 60) + "…" : desc;
          if (!descMap.has(desc)) descMap.set(desc, short);
        }
      }

      const options = [];

      Array.from(codesSet)
        .sort()
        .slice(0, 25)
        .forEach((c) => options.push({ value: c, label: c, type: "code" }));

      Array.from(descMap.entries())
        .slice(0, 25)
        .forEach(([full, short]) =>
          options.push({ value: full, label: short, type: "desc" })
        );

      const uniq = new Map();
      for (const o of options) {
        uniq.set(`${o.type}|${o.label}`, o);
      }

      return NextResponse.json({
        success: true,
        data: Array.from(uniq.values()).slice(0, 50),
      });
    }

    // =========================
    // FILTERS ONLY
    // =========================
    if (isFiltersOnlyRequest(searchParams)) {
      const wantFull = searchParams.get("filters") === "1";
      const pendingUsers = await User.find({}).select("_id username").lean();

      if (!wantFull) {
        return NextResponse.json({
          success: true,
          filters: {
            companies: allowedCompanies,
            users: canViewAllReports
              ? []
              : currentUsername
              ? [currentUsername]
              : [],
            currencies: [],
            statuses: ["Pending", "Approved", "Rejected"],
            pendingUsers: pendingUsers.map((u) => ({
              value: String(u._id),
              label: u.username,
            })),
          },
          data: [],
          meta: { total: 0, totalPages: 0, page: 1, pageSize: 0 },
        });
      }

      const allUsers = canViewAllReports
        ? await User.find({}).select("username").lean()
        : currentUsername
        ? [{ username: currentUsername }]
        : [];

      const currenciesRaw = await getCurrenciesBySource(source, allowedCompanies);

      const currenciesSet = new Set();
      (currenciesRaw || []).flat().forEach((c) => c && currenciesSet.add(String(c)));

      return NextResponse.json({
        success: true,
        filters: {
          companies: allowedCompanies,
          users: allUsers.map((u) => u.username).filter(Boolean),
          currencies: Array.from(currenciesSet).sort(),
          statuses: ["Pending", "Approved", "Rejected"],
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
    // QUERY PARAMS
    // =========================
    const qParam = (searchParams.get("q") || "").trim();
    const { isNumber: qIsNumber, amount: qAmount } = parseDigitsAmount(qParam);

    const companiesParam = searchParams.get("company") || "all";
    const usersParam = searchParams.get("user") || "all";
    const statusParam = searchParams.get("status") || "all";
    const currencyParam = searchParams.get("currency") || "all";
    const pendingParam = searchParams.get("pending") || "all";
    const fromDate = searchParams.get("from") || "";
    const toDate = searchParams.get("to") || "";

    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const pageSize = Math.max(
      10,
      Math.min(200, parseInt(searchParams.get("pageSize") || "25", 10))
    );

    let companyList = null;

    if (companiesParam === "all") {
      companyList = allowedCompanies;
    } else {
      companyList = safeSplit(companiesParam).filter((c) =>
        allowedCompanies.includes(c)
      );
    }

    if (!companyList.length) {
      const pendingUsers = await User.find({}).select("_id username").lean();

      return NextResponse.json({
        success: true,
        filters: {
          companies: allowedCompanies,
          users: canViewAllReports
            ? []
            : currentUsername
            ? [currentUsername]
            : [],
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

    const createdByList = canViewAllReports
      ? usersParam === "all"
        ? null
        : safeSplit(usersParam)
      : currentUsername
      ? [currentUsername]
      : ["__never_match__"];

    const buildQuery = () => {
      const query = {};

      if (createdByList) {
        query.createdBy = { $in: createdByList };
      }

      if (statusParam === "Cancelled") {
        query.status = "__never_match__";
      } else if (statusParam !== "all") {
        query.status = statusParam;
      } else {
        query.status = { $ne: "Cancelled" };
      }

      if (currencyParam !== "all") {
        query.currency = currencyParam;
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

      if (qParam && !qIsNumber) {
        const rx = { $regex: escapeRegex(qParam), $options: "i" };
        query.$or = [
          { requestCode: rx },
          { description: rx },
          { createdBy: rx },
          { department: rx },
        ];
      }

      return query;
    };

    const queryBase = buildQuery();

    const needHeavyFilter =
      pendingParam !== "all" || (qIsNumber && Number.isFinite(qAmount));

    // =========================
    // HEAVY FILTER MODE
    // =========================
    if (needHeavyFilter) {
      let mergedAll = await getDocsBySource({
        source,
        companyList,
        queryBase,
      });

      for (const d of mergedAll) {
        d.pendingWithIds = computePendingWithIds(d);
        d.totalAmount = computeTotalAmount(d);
      }

      if (pendingParam !== "all") {
        const p = String(pendingParam);
        mergedAll = mergedAll.filter((d) =>
          (d.pendingWithIds || []).includes(p)
        );
      }

      if (qIsNumber && Number.isFinite(qAmount)) {
        const target = Number(qAmount);
        mergedAll = mergedAll.filter((d) => {
          const v = Number(d.totalAmount);
          if (!Number.isFinite(v)) return false;
          return Math.round(v) === Math.round(target);
        });
      }

      mergedAll.sort((a, b) => {
        const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return tb - ta;
      });

      const totalHeavy = mergedAll.length;
      const totalPagesHeavy = totalHeavy ? Math.ceil(totalHeavy / pageSize) : 0;

      const start = (page - 1) * pageSize;
      const pageDocs = mergedAll.slice(start, start + pageSize);

      const allPendingIds = new Set();
      for (const d of pageDocs) {
        (d.pendingWithIds || []).forEach((id) => allPendingIds.add(String(id)));
      }

      let pendingNameMap = new Map();
      if (allPendingIds.size > 0) {
        const users = await User.find({ _id: { $in: Array.from(allPendingIds) } })
          .select("_id username")
          .lean();

        pendingNameMap = new Map(
          users.map((u) => [String(u._id), u.username])
        );
      }

      const finalData = pageDocs.map((d) => ({
        ...d,
        pendingWithNames: (d.pendingWithIds || [])
          .map((id) => pendingNameMap.get(String(id)))
          .filter(Boolean),
      }));

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
          users: canViewAllReports
            ? Array.from(pageUsers)
            : currentUsername
            ? [currentUsername]
            : [],
          currencies: Array.from(pageCurrencies),
          statuses: Array.from(pageStatuses),
          pendingUsers: pendingUsers.map((u) => ({
            value: String(u._id),
            label: u.username,
          })),
        },
        data: finalData,
        meta: {
          total: totalHeavy,
          totalPages: totalPagesHeavy,
          page,
          pageSize,
        },
      });
    }

    // =========================
    // NORMAL MODE
    // =========================
    let merged = await getDocsBySource({
      source,
      companyList,
      queryBase,
    });

    for (const d of merged) {
      d.pendingWithIds = computePendingWithIds(d);
      d.totalAmount = computeTotalAmount(d);
    }

    merged.sort((a, b) => {
      const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return tb - ta;
    });

    const total = merged.length;
    const totalPages = total ? Math.ceil(total / pageSize) : 0;

    if (!total) {
      const pendingUsers = await User.find({}).select("_id username").lean();

      return NextResponse.json({
        success: true,
        filters: {
          companies: companyList,
          users: canViewAllReports
            ? []
            : currentUsername
            ? [currentUsername]
            : [],
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

    const start = (page - 1) * pageSize;
    const pageDocs = merged.slice(start, start + pageSize);

    const allPendingIds = new Set();
    for (const d of pageDocs) {
      (d.pendingWithIds || []).forEach((id) => allPendingIds.add(String(id)));
    }

    let pendingNameMap = new Map();
    if (allPendingIds.size > 0) {
      const users = await User.find({ _id: { $in: Array.from(allPendingIds) } })
        .select("_id username")
        .lean();

      pendingNameMap = new Map(users.map((u) => [String(u._id), u.username]));
    }

    const finalData = pageDocs.map((d) => ({
      ...d,
      pendingWithNames: (d.pendingWithIds || [])
        .map((id) => pendingNameMap.get(String(id)))
        .filter(Boolean),
    }));

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
        users: canViewAllReports
          ? Array.from(pageUsers)
          : currentUsername
          ? [currentUsername]
          : [],
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