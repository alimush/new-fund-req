import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";
import Permissions from "@/models/Permissions";
import { PERMISSIONS } from "@/lib/permission";
import { cookies } from "next/headers";

import ReplaceBookingTransfer from "@/models/ReplaceBookingTransfer";
import WaiverReservation from "@/models/WaiverReservation";
import CancelBookingUnit from "@/models/CancelBookingUnit";
import UnitTransfer from "@/models/UnitTransfer";
import AttachmentOnly from "@/models/AttachmentOnly";
import PaymentPlan from "@/models/PaymentPlan";

import { getExForm } from "@/lib/exForms/registry";
import {
  EX_BOOKING_COMPANIES,
  resolveExBookingCompaniesForUser,
} from "@/lib/exForms/exCompanies";

export const runtime = "nodejs";

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const safeSplit = (v) =>
  String(v || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

const PAYMENT_PLAN_KEY = "payment-plan";

const STATIC_FORMS = [
  { pageKey: "replace-booking-transfer", model: ReplaceBookingTransfer },
  { pageKey: "waiver-reservation", model: WaiverReservation },
  { pageKey: "cancel-booking-unit", model: CancelBookingUnit },
  { pageKey: "unit-transfer", model: UnitTransfer },
  { pageKey: "attachment-only", model: AttachmentOnly },
];

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

function computeExPendingWithIds(doc) {
  try {
    const stMain = String(doc?.status || "").trim();
    if (!/^pending$/i.test(stMain)) return [];

    if (
      Number.isInteger(doc?.currentStep) &&
      doc.currentStep >= 0 &&
      Array.isArray(doc?.workflow?.steps) &&
      doc.workflow.steps.length > doc.currentStep
    ) {
      const st = doc.workflow.steps[doc.currentStep];
      const stepSt = String(st?.status || "Pending");
      if (/^pending$/i.test(stepSt) && Array.isArray(st?.users)) {
        return st.users.map((u) => String(u?._id || u)).filter(Boolean);
      }
    }
  } catch {}
  return [];
}

function resolveCustomer(doc) {
  return (
    doc.customerName ||
    doc.customer ||
    doc.clientName ||
    doc.transfereeName ||
    doc.name ||
    ""
  );
}

function resolveUnit(doc) {
  const parts = [doc.unitNo, doc.oldUnitNo, doc.newUnitNo].filter(Boolean);
  return parts.map(String).join(" → ") || "";
}

function resolveFormTitle(pageKey, isPaymentPlan) {
  if (isPaymentPlan) return "الاستثناءات";
  return getExForm(pageKey)?.title || pageKey || "-";
}

function normalizeRow(doc, { isPaymentPlan }) {
  const pageKey = isPaymentPlan ? String(doc.pageKey || "exceptions") : doc.pageKey;
  const pkRoute = isPaymentPlan ? PAYMENT_PLAN_KEY : pageKey;

  const pendingWithIds = computeExPendingWithIds({
    status: doc.status,
    currentStep: doc.currentStep,
    workflow: doc.workflow,
  });

  return {
    _id: doc._id,
    reportKind: "ex",
    exCompanyKey: doc.exCompanyKey || "",
    pageKey,
    formTitleAr: resolveFormTitle(pageKey, isPaymentPlan),
    requestCode: doc.requestCode || "",
    createdBy: doc.createdBy || "",
    status: doc.status ?? "",
    currentStep: Number.isInteger(doc.currentStep) ? doc.currentStep : -1,
    customerSummary: resolveCustomer(doc),
    unitSummary: resolveUnit(doc),
    dateDMY: doc.dateDMY || "",
    createdAt: doc.createdAt,
    pendingWithIds,
    isPaymentPlan,
    detailRouteKey: pkRoute,
  };
}

function formsSelected(formKeysParam, allowedSet) {
  const keys = safeSplit(formKeysParam).filter(Boolean);
  const allToken = keys.some((k) => ["all", "*"].includes(String(k).toLowerCase()));
  if (!keys.length || allToken) return null;

  const sel = new Set(keys.filter((k) => allowedSet.has(k)));
  return sel.size ? sel : null;
}

async function fetchMatchedDocs(baseMatch, selectedForms /* Set|null */) {
  const tasks = [];

  for (const { pageKey, model } of STATIC_FORMS) {
    if (selectedForms && !selectedForms.has(pageKey)) continue;
    tasks.push(
      model
        .find({ ...baseMatch, pageKey })
        .sort({ createdAt: -1 })
        .lean()
        .then((rows) => (rows || []).map((d) => normalizeRow(d, { isPaymentPlan: false })))
    );
  }

  const wantPlans =
    !selectedForms ||
    selectedForms.has(PAYMENT_PLAN_KEY) ||
    selectedForms.has("exceptions");

  if (wantPlans) {
    tasks.push(
      PaymentPlan.find({ ...baseMatch })
        .sort({ createdAt: -1 })
        .lean()
        .then((rows) => (rows || []).map((d) => normalizeRow(d, { isPaymentPlan: true })))
    );
  }

  const chunks = await Promise.all(tasks);
  return chunks.flat();
}

export async function GET(req) {
  try {
    await dbConnect();

    const cookieStore = await cookies();
    const userId = cookieStore.get("userId")?.value;

    if (!userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const currentUser = await User.findById(userId).select("username").lean();
    const currentUsername = String(currentUser?.username || "").trim();

    const { allowedCompanies, allowedPerms } = await getUserAccess(userId);

    const canViewReports = allowedPerms.includes(PERMISSIONS.VIEW_REPORTS);
    const canViewAllReports = allowedPerms.includes(PERMISSIONS.VIEW_ALL_REPORTS);
    const canExReports = allowedPerms.includes(PERMISSIONS.EX_REPORTS);

    if (!canViewReports && !canViewAllReports && !canExReports) {
      return NextResponse.json(
        { success: false, error: "Forbidden: missing reports permission" },
        { status: 403 }
      );
    }

    let exCompanyDefs = resolveExBookingCompaniesForUser(allowedCompanies);
    let allowedExKeys = exCompanyDefs.map((d) => d.key).filter(Boolean);

    if (canViewAllReports && allowedExKeys.length === 0) {
      exCompanyDefs = [...EX_BOOKING_COMPANIES];
      allowedExKeys = EX_BOOKING_COMPANIES.map((c) => c.key).filter(Boolean);
    }

    const companyFilterOptions = exCompanyDefs.map((d) => ({
      value: d.key,
      label: d.name || d.key,
    }));

    const pendingUsersAll = await User.find({}).select("_id username").lean();
    const pendingOpts = pendingUsersAll.map((u) => ({
      value: String(u._id),
      label: u.username,
    }));

    if (!allowedExKeys.length) {
      return NextResponse.json({
        success: true,
        filters: {
          companies: [],
          companyOptions: [],
          formTypes: [],
          users: [],
          statuses: [],
          pendingUsers: pendingOpts,
        },
        data: [],
        meta: { total: 0, totalPages: 0, page: 1, pageSize: 0 },
      });
    }

    const { searchParams } = new URL(req.url);

    const allFormKeysSet = new Set([
      ...STATIC_FORMS.map((x) => x.pageKey),
      PAYMENT_PLAN_KEY,
    ]);

    if (searchParams.get("filters") === "1") {
      const formTypes = [
        ...STATIC_FORMS.map(({ pageKey }) => ({
          value: pageKey,
          label: resolveFormTitle(pageKey, false),
        })),
        {
          value: PAYMENT_PLAN_KEY,
          label: resolveFormTitle("exceptions", true),
        },
      ];

      const allUsers = canViewAllReports
        ? await User.find({}).select("username").lean()
        : currentUsername
          ? [{ username: currentUsername }]
          : [];

      return NextResponse.json({
        success: true,
        filters: {
          companies: companyFilterOptions,
          companyOptions: companyFilterOptions,
          formTypes,
          users: allUsers.map((u) => u.username).filter(Boolean),
          statuses: ["Pending", "Approved", "Rejected", "Cancelled"],
          pendingUsers: pendingOpts,
        },
        data: [],
        meta: { total: 0, totalPages: 0, page: 1, pageSize: 0 },
      });
    }

    if (searchParams.get("suggest") === "1") {
      const q = (searchParams.get("q") || "").trim();
      if (!q || /^\d+$/.test(q.replace(/,/g, ""))) {
        return NextResponse.json({ success: true, data: [] });
      }

      const rx = new RegExp(escapeRegex(q), "i");
      const baseMatch = {
        exCompanyKey: { $in: allowedExKeys },
        $or: [
          { requestCode: rx },
          { customerName: rx },
          { customer: rx },
          { clientName: rx },
          { transfereeName: rx },
          { unitNo: rx },
          { oldUnitNo: rx },
          { newUnitNo: rx },
          { createdBy: rx },
          { salesEmp: rx },
          { pageKey: rx },
        ],
      };

      const merged = await fetchMatchedDocs(baseMatch, null);

      const seen = new Set();
      const options = [];

      for (const row of merged.slice(0, 80)) {
        const code = String(row.requestCode || "").trim();
        if (code && rx.test(code) && !seen.has(`c:${code}`)) {
          seen.add(`c:${code}`);
          options.push({ value: code, label: code, type: "code" });
        }
        const cu = String(row.customerSummary || "").trim();
        if (cu && rx.test(cu)) {
          const short = cu.length > 60 ? cu.slice(0, 60) + "…" : cu;
          if (!seen.has(`u:${cu}`)) {
            seen.add(`u:${cu}`);
            options.push({ value: cu, label: short, type: "cust" });
          }
        }
      }

      return NextResponse.json({
        success: true,
        data: options.slice(0, 40),
      });
    }

    const companiesParam = searchParams.get("company") || "all";
    const usersParam = searchParams.get("user") || "all";
    const statusParam = searchParams.get("status") || "all";
    const pendingParam = searchParams.get("pending") || "all";
    const formsParam = searchParams.get("forms") || "all";
    const qParam = (searchParams.get("q") || "").trim();
    const fromDate = searchParams.get("from") || "";
    const toDate = searchParams.get("to") || "";

    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const pageSize = Math.max(
      10,
      Math.min(200, parseInt(searchParams.get("pageSize") || "25", 10))
    );

    let companyList =
      companiesParam === "all"
        ? allowedExKeys
        : safeSplit(companiesParam).filter((c) => allowedExKeys.includes(c));

    if (!companyList.length) {
      return NextResponse.json({
        success: true,
        filters: {
          companies: companyFilterOptions,
          companyOptions: companyFilterOptions,
          formTypes: [],
          users: [],
          statuses: [],
          pendingUsers: pendingOpts,
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

    const selectedForms = formsSelected(formsParam, allFormKeysSet);

    const buildBaseMatch = () => {
      const m = { exCompanyKey: { $in: companyList } };

      if (createdByList) {
        m.createdBy = { $in: createdByList };
      }

      if (statusParam !== "all") {
        m.status = statusParam;
      }

      if (fromDate || toDate) {
        m.createdAt = {};
        if (fromDate) m.createdAt.$gte = new Date(fromDate);
        if (toDate) {
          const end = new Date(toDate);
          end.setHours(23, 59, 59, 999);
          m.createdAt.$lte = end;
        }
      }

      if (qParam) {
        const rx = new RegExp(escapeRegex(qParam), "i");
        m.$or = [
          { requestCode: rx },
          { customerName: rx },
          { customer: rx },
          { clientName: rx },
          { transfereeName: rx },
          { unitNo: rx },
          { oldUnitNo: rx },
          { newUnitNo: rx },
          { createdBy: rx },
          { salesEmp: rx },
          { pageKey: rx },
        ];
      }

      return m;
    };

    const baseMatch = buildBaseMatch();

    let mergedAll = await fetchMatchedDocs(baseMatch, selectedForms);

    if (pendingParam !== "all") {
      mergedAll = mergedAll.filter((d) =>
        (d.pendingWithIds || []).includes(String(pendingParam))
      );
    }

    mergedAll.sort((a, b) => {
      const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return tb - ta;
    });

    const total = mergedAll.length;
    const totalPages = total ? Math.ceil(total / pageSize) : 0;
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

      pendingNameMap = new Map(users.map((u) => [String(u._id), u.username]));
    }

    const finalData = pageDocs.map((d) => ({
      ...d,
      pendingWithNames: (d.pendingWithIds || [])
        .map((id) => pendingNameMap.get(String(id)))
        .filter(Boolean),
    }));

    const pageUsers = new Set();
    const pageStatuses = new Set();
    for (const d of finalData) {
      if (d.createdBy) pageUsers.add(d.createdBy);
      if (d.status !== undefined && d.status !== null && String(d.status).trim() !== "") {
        pageStatuses.add(String(d.status));
      }
    }

    return NextResponse.json({
      success: true,
      filters: {
        companies: companyFilterOptions,
        companyOptions: companyFilterOptions,
        users: canViewAllReports
          ? Array.from(pageUsers)
          : currentUsername
            ? [currentUsername]
            : [],
        statuses: Array.from(pageStatuses),
        pendingUsers: pendingOpts,
      },
      data: finalData,
      meta: { total, totalPages, page, pageSize },
    });
  } catch (err) {
    console.error("❌ Reports EX API Error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Server error" },
      { status: 500 }
    );
  }
}
