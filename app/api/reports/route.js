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
  if (!/^\d+(\.\d+)?$/.test(cleaned)) return { isNumber: false, amount: null };
  const amount = Number(cleaned);
  if (!Number.isFinite(amount)) return { isNumber: false, amount: null };
  return { isNumber: true, amount };
}

/** تطبيع المبلغ (حتى 4 منازل) لتجنب أخطاء الفاصلة العائمة */
function normalizeAmount(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return null;
  return Math.round(v * 10000) / 10000;
}

function amountToMatchString(n) {
  const v = normalizeAmount(n);
  if (v == null) return "";
  return String(v.toFixed(4)).replace(/\.?0+$/, "");
}

function formatAmountLabel(n) {
  const v = normalizeAmount(n);
  if (v == null) return "";
  const hasFraction = Math.abs(v % 1) > 1e-9;
  return v.toLocaleString("en-US", {
    minimumFractionDigits: hasFraction ? 1 : 0,
    maximumFractionDigits: 4,
  });
}

function amountMatchesPart(total, part) {
  const p = String(part || "").replace(/,/g, "").trim();
  if (!p || !/\d/.test(p)) return false;
  const s = amountToMatchString(total);
  if (!s) return false;
  if (s === "0" && p !== "0") return false;
  return s.includes(p);
}

const SUGGEST_AMOUNT_SCAN_PER_COMPANY = 100;

const REPORT_LIST_SELECT =
  "requestCode requestType createdBy status department currency description createdAt items workflow currentStep";

async function countDocsBySource({ source, companyList, queryBase }) {
  if (source === "old") {
    return RequestOldData.countDocuments({
      ...queryBase,
      companyKey: { $in: companyList },
    });
  }

  const counts = await Promise.all(
    companyList.map(async (companyKey) => {
      const Model = getModelForCompany(companyKey);
      return Model.countDocuments(queryBase);
    })
  );

  return counts.reduce((sum, n) => sum + (Number(n) || 0), 0);
}

async function fetchPageDocsBySource({
  source,
  companyList,
  queryBase,
  page,
  pageSize,
  select = REPORT_LIST_SELECT,
}) {
  const skip = (page - 1) * pageSize;

  if (source === "old") {
    return RequestOldData.find({
      ...queryBase,
      companyKey: { $in: companyList },
    })
      .select(select)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pageSize)
      .lean();
  }

  if (companyList.length === 1) {
    const companyKey = companyList[0];
    const Model = getModelForCompany(companyKey);
    const docs = await Model.find(queryBase)
      .select(select)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pageSize)
      .lean();
    return (docs || []).map((d) => ({ ...d, companyKey }));
  }

  const fetchLimit = page * pageSize;
  const perCompany = await Promise.all(
    companyList.map(async (companyKey) => {
      const Model = getModelForCompany(companyKey);
      const docs = await Model.find(queryBase)
        .select(select)
        .sort({ createdAt: -1 })
        .limit(fetchLimit)
        .lean();
      return (docs || []).map((d) => ({ ...d, companyKey }));
    })
  );

  const merged = perCompany.flat();
  merged.sort((a, b) => {
    const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return tb - ta;
  });

  return merged.slice(skip, skip + pageSize);
}

function enrichReportDocs(docs) {
  for (const d of docs) {
    d.pendingWithIds = computePendingWithIds(d);
    d.totalAmount = computeTotalAmount(d);
  }
  return docs;
}

async function attachPendingNames(pageDocs) {
  const allPendingIds = new Set();
  for (const d of pageDocs) {
    (d.pendingWithIds || []).forEach((id) => allPendingIds.add(String(id)));
  }

  if (!allPendingIds.size) {
    return pageDocs.map((d) => ({ ...d, pendingWithNames: [] }));
  }

  const users = await User.find({ _id: { $in: Array.from(allPendingIds) } })
    .select("_id username")
    .lean();

  const pendingNameMap = new Map(users.map((u) => [String(u._id), u.username]));

  return pageDocs.map((d) => ({
    ...d,
    pendingWithNames: (d.pendingWithIds || [])
      .map((id) => pendingNameMap.get(String(id)))
      .filter(Boolean),
  }));
}

function buildSearchMeta({ total, page, pageSize }) {
  const totalPages = total ? Math.ceil(total / pageSize) : 0;
  return { total, totalPages, page, pageSize };
}

function collectAmountSuggestions(docs, digitPart) {
  const part = String(digitPart || "").replace(/,/g, "").trim();
  if (!part || !/\d/.test(part)) return [];

  const amountByKey = new Map();

  for (const d of docs || []) {
    const total = computeTotalAmount(d);
    const norm = normalizeAmount(total);
    if (norm == null) continue;
    if (!amountMatchesPart(norm, part)) continue;
    const key = amountToMatchString(norm);
    if (!amountByKey.has(key)) amountByKey.set(key, norm);
  }

  return Array.from(amountByKey.values())
    .sort((a, b) => a - b)
    .slice(0, 25)
    .map((amt) => ({
      value: amountToMatchString(amt),
      label: `مبلغ: ${formatAmountLabel(amt)}`,
      type: "amount",
    }));
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
  limitPerCompany = null,
}) {
  const docsByCompany = await Promise.all(
    companyList.map(async (companyKey) => {
      const Model = getModelForCompany(companyKey);

      let q = Model.find(queryBase).sort({ createdAt: -1 });
      if (limitPerCompany) q = q.limit(limitPerCompany);
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
  limitPerCompany = null,
}) {
  let q = RequestOldData.find({
    ...queryBase,
    companyKey: { $in: companyList },
  }).sort({ createdAt: -1 });

  if (limitPerCompany) q = q.limit(limitPerCompany);
  if (select) q = q.select(select);

  return await q.lean();
}

async function getDocsBySource({
  source,
  companyList,
  queryBase,
  select = null,
  limitPerCompany = null,
}) {
  if (source === "old") {
    return await getOldDocs({
      companyList,
      queryBase,
      select,
      limitPerCompany,
    });
  }

  return await getNewDocsByCompany({
    companyList,
    queryBase,
    select,
    limitPerCompany,
  });
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

    const [{ allowedCompanies, allowedPerms }, currentUser] = await Promise.all([
      getUserAccess(userId),
      User.findById(userId).select("username").lean(),
    ]);
    const currentUsername = String(currentUser?.username || "").trim();

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
        select: "requestCode description items createdAt companyKey",
      });

      const digitPart = q.replace(/,/g, "").trim();
      const isNumericQuery = /^\d+(\.\d+)?$/.test(digitPart);

      const baseCond = {
        status: { $ne: "Cancelled" },
        ...(canViewAllReports
          ? {}
          : { createdBy: currentUsername || "__never_match__" }),
      };

      let amountScanDocs = merged;
      if (isNumericQuery) {
        const recentForAmount = await getDocsBySource({
          source,
          companyList: allowedCompanies,
          queryBase: baseCond,
          select: "items",
          limitPerCompany: SUGGEST_AMOUNT_SCAN_PER_COMPANY,
        });
        amountScanDocs = [...merged, ...recentForAmount];
      }

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

      collectAmountSuggestions(amountScanDocs, digitPart).forEach((o) =>
        options.push(o)
      );

      Array.from(descMap.entries())
        .slice(0, 25)
        .forEach(([full, short]) =>
          options.push({ value: full, label: short, type: "desc" })
        );

      const uniq = new Map();
      for (const o of options) {
        uniq.set(`${o.type}|${o.value}`, o);
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
      return NextResponse.json({
        success: true,
        data: [],
        meta: buildSearchMeta({ total: 0, page, pageSize }),
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
        const rxText = escapeRegex(qParam);
        // نفس منطق الاقتراحات: بحث جزئي في الكود والوصف (ليس تطابقاً كاملاً فقط)
        query.$or = [
          { requestCode: { $regex: rxText, $options: "i" } },
          { description: { $regex: rxText, $options: "i" } },
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
        select: REPORT_LIST_SELECT,
      });

      enrichReportDocs(mergedAll);

      if (pendingParam !== "all") {
        const p = String(pendingParam);
        mergedAll = mergedAll.filter((d) =>
          (d.pendingWithIds || []).includes(p)
        );
      }

      if (qIsNumber && Number.isFinite(qAmount)) {
        const target = normalizeAmount(qAmount);
        mergedAll = mergedAll.filter((d) => {
          const v = normalizeAmount(d.totalAmount);
          if (v == null || target == null) return false;
          return v === target;
        });
      }

      mergedAll.sort((a, b) => {
        const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return tb - ta;
      });

      const totalHeavy = mergedAll.length;
      const start = (page - 1) * pageSize;
      const pageDocs = mergedAll.slice(start, start + pageSize);
      const finalData = await attachPendingNames(pageDocs);

      return NextResponse.json({
        success: true,
        data: finalData,
        meta: buildSearchMeta({ total: totalHeavy, page, pageSize }),
      });
    }

    // =========================
    // NORMAL MODE (DB pagination)
    // =========================
    const [total, pageDocsRaw] = await Promise.all([
      countDocsBySource({ source, companyList, queryBase }),
      fetchPageDocsBySource({
        source,
        companyList,
        queryBase,
        page,
        pageSize,
      }),
    ]);

    if (!total) {
      return NextResponse.json({
        success: true,
        data: [],
        meta: buildSearchMeta({ total: 0, page, pageSize }),
      });
    }

    enrichReportDocs(pageDocsRaw);
    const finalData = await attachPendingNames(pageDocsRaw);

    return NextResponse.json({
      success: true,
      data: finalData,
      meta: buildSearchMeta({ total, page, pageSize }),
    });
  } catch (err) {
    console.error("❌ Reports API Error:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}