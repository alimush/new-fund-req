import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import { cookies } from "next/headers";
import User from "@/models/User";
import Permissions from "@/models/Permissions";
import mongoose from "mongoose";
import { getModelForCompany } from "@/models/Request";
import { PERMISSIONS } from "@/lib/permission";
import { userCanApproveOnLastStep } from "@/lib/workflow/canApproveAtStep";
import {
  voucherLookupByRequestPipeline,
  voucherLookupLetFields,
} from "@/lib/voucher/voucherLookupPipeline";
import {
  buildRegularUserReportPipeline,
  buildDelegatedDisbursementPipeline,
  buildAuthorizedUserReportPipeline,
  buildQuickSuggestPipeline,
} from "@/lib/receipts/disbursementReportPipelines";
import { companyInList } from "@/lib/companies/companyAccess";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(String(id || ""));
}

function escapeRegex(s) {
  return String(s || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function getAuthContext() {
  const cookieStore = await cookies();
  const userId = cookieStore.get("userId")?.value;
  if (!userId || !isValidObjectId(userId)) return null;

  const uid = new mongoose.Types.ObjectId(userId);
  const user = await User.findById(uid).select("username").lean();
  if (!user) return null;

  const groups = await Permissions.find({
    $or: [{ users: userId }, { users: uid }],
  }).lean();

  const permissions = [...new Set(groups.flatMap((g) => g.permissions || []).map(String))];
  const companies = [...new Set(groups.flatMap((g) => g.companies || []).map(String))].filter(
    Boolean
  );

  return {
    userId: String(userId),
    uid,
    username: String(user.username || "").trim(),
    permissions,
    companies,
  };
}

function parseDateStart(v) {
  const s = String(v || "").trim();
  if (!s) return null;
  const d = new Date(`${s}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseDateEnd(v) {
  const s = String(v || "").trim();
  if (!s) return null;
  const d = new Date(`${s}T23:59:59.999Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

async function loadDelegateHolderIdsAndUsernames() {
  const groups = await Permissions.find({
    permissions: PERMISSIONS.VOUCHER_DELEGATE,
  })
    .select("users")
    .lean();

  const ids = new Set();
  for (const g of groups) {
    for (const u of g.users || []) {
      const s = String(u);
      if (isValidObjectId(s)) ids.add(s);
    }
  }
  const idList = [...ids];
  const users = idList.length
    ? await User.find({ _id: { $in: idList } })
        .select("username")
        .lean()
    : [];
  const usernames = users
    .map((u) => String(u.username || "").trim())
    .filter(Boolean);
  return { ids: idList, usernames };
}

/** المخوّلون للصرف فقط (voucherDelegateTo) */
async function loadAuthorizedFilterUsers(ctx, companiesToScan, holderIds, canDelegateView) {
  const holderSet = new Set((holderIds || []).map(String));
  const idSet = new Set();

  if (!canDelegateView) {
    idSet.add(String(ctx.userId));
  }

  const delegatedByOr = [
    { "_step.voucherDelegatedBy": ctx.uid },
    { "_step.voucherDelegatedBy": String(ctx.userId) },
  ];
  const uname = String(ctx.username || "").trim();
  if (uname) delegatedByOr.push({ "_step.voucherDelegatedByUsername": uname });

  const delegatedOnlyMatch = {
    $or: [
      { "_step.voucherDelegateTo": { $ne: null } },
      {
        $and: [
          { "_step.voucherDelegateToUsername": { $exists: true } },
          { "_step.voucherDelegateToUsername": { $ne: "" } },
        ],
      },
    ],
  };

  for (const companyKey of companiesToScan) {
    try {
      const Model = getModelForCompany(companyKey);
      const stepScope = canDelegateView
        ? delegatedOnlyMatch
        : { $and: [{ $or: delegatedByOr }, delegatedOnlyMatch] };

      const rows = await Model.aggregate([
        { $match: STATUS_MATCH_APPROVED_NOT_CANCELLED },
        {
          $addFields: {
            _lastIdx: {
              $subtract: [{ $size: { $ifNull: ["$workflow.steps", []] } }, 1],
            },
          },
        },
        { $match: { $expr: { $gte: ["$_lastIdx", 0] } } },
        { $addFields: { _step: { $arrayElemAt: ["$workflow.steps", "$_lastIdx"] } } },
        {
          $match: {
            $expr: { $eq: ["$currentStep", "$_lastIdx"] },
            "_step.status": { $in: ["Approved", "approved"] },
            ...stepScope,
          },
        },
        { $group: { _id: "$_step.voucherDelegateTo" } },
        { $match: { _id: { $ne: null } } },
      ]);

      for (const r of rows) {
        const toId = r._id?.toString?.() || String(r._id || "");
        if (toId && isValidObjectId(toId) && !holderSet.has(toId)) {
          idSet.add(toId);
        }
      }
    } catch (e) {
      console.error(`loadAuthorizedFilterUsers ${companyKey}:`, e?.message || e);
    }
  }

  const ids = [...idSet].filter((id) => isValidObjectId(id));
  if (!ids.length) return [];

  const users = await User.find({ _id: { $in: ids } })
    .select("_id username")
    .lean();

  return users
    .map((u) => ({
      id: String(u._id),
      username: String(u.username || u._id).trim() || String(u._id),
    }))
    .sort((a, b) => a.username.localeCompare(b.username, "ar"));
}

async function resolveProcessorTarget(ctx, processorUserId, canDelegateView, authorizedUsers) {
  const authorizedIds = new Set((authorizedUsers || []).map((u) => String(u.id)));
  const pid = String(processorUserId || "").trim();

  if (canDelegateView && (!pid || pid === "all")) {
    return {
      uid: null,
      userIdStr: "",
      username: "",
      locked: false,
      filterAll: true,
    };
  }

  const targetId = pid && pid !== "all" ? pid : String(ctx.userId);

  if (!isValidObjectId(targetId)) {
    throw Object.assign(new Error("معرّف المستخدم غير صالح"), { status: 400 });
  }

  const isSelf = targetId === String(ctx.userId);

  // «صرفتها أنا» — المستخدم الحالي دائماً مسموح يفلتر على نفسه
  if (!isSelf && !authorizedIds.has(targetId)) {
    throw Object.assign(new Error("لا صلاحية للفلترة على هذا المستخدم"), { status: 403 });
  }

  const holderIds = (await loadDelegateHolderIdsAndUsernames()).ids;
  if (canDelegateView && !isSelf && holderIds.includes(targetId)) {
    throw Object.assign(new Error("لا يمكن الفلترة على مستخدم تخويل"), { status: 400 });
  }

  const u = await User.findById(targetId).select("username").lean();
  if (!u) {
    throw Object.assign(new Error("المستخدم غير موجود"), { status: 404 });
  }

  return {
    uid: new mongoose.Types.ObjectId(targetId),
    userIdStr: targetId,
    username: String(u.username || "").trim(),
    locked: !canDelegateView && isSelf && authorizedIds.size <= 1,
    filterAll: false,
    isSelf,
  };
}

/** استبعاد الطلبات الملغاة من تقارير/قوائم الصرف */
const STATUS_MATCH_APPROVED_NOT_CANCELLED = {
  status: { $in: ["Approved", "approved"], $nin: ["Cancelled", "cancelled"] },
};

function buildPendingPipeline({ uid, username, from, to, permissions = [] }) {
  const uname = String(username || "").trim();
  const delegateOr = [{ "_step.voucherDelegateTo": uid }];
  if (uname) delegateOr.push({ "_step.voucherDelegateToUsername": uname });

  // مخوّل للصرف يرى الطلب دائماً؛ باقي أعضاء آخر خطوة فقط إن كانوا يقدرون يوافقون/يخوّلون
  const canActOr = [...delegateOr];
  if (userCanApproveOnLastStep(permissions)) {
    canActOr.push({
      $and: [
        {
          $or: [
            { "_step.voucherDelegateTo": null },
            { "_step.voucherDelegateTo": { $exists: false } },
          ],
        },
        { "_step.users": { $in: [uid] } },
      ],
    });
  }

  const pipeline = [];

  const createdMatch = {};
  if (from) createdMatch.$gte = from;
  if (to) createdMatch.$lte = to;
  if (Object.keys(createdMatch).length) {
    pipeline.push({ $match: { createdAt: createdMatch } });
  }

  pipeline.push(
    { $match: STATUS_MATCH_APPROVED_NOT_CANCELLED },
    {
      $addFields: {
        _lastIdx: { $subtract: [{ $size: { $ifNull: ["$workflow.steps", []] } }, 1] },
      },
    },
    { $match: { $expr: { $gte: ["$_lastIdx", 0] } } },
    { $addFields: { _step: { $arrayElemAt: ["$workflow.steps", "$_lastIdx"] } } },
    {
      $match: {
        $expr: { $eq: ["$currentStep", "$_lastIdx"] },
        "_step.status": { $in: ["Approved", "approved"] },
        $or: canActOr,
      },
    },
    { $sort: { createdAt: -1 } },
    {
      $lookup: {
        from: "vouchers",
        let: voucherLookupLetFields(),
        pipeline: voucherLookupByRequestPipeline(),
        as: "__vrow",
      },
    },
    // قيد الصرف = لا يوجد وصل فعلي في vouchers
    { $match: { "__vrow.0": { $exists: false } } },
    {
      $project: {
        _id: 1,
        requestCode: 1,
        companyKey: 1,
        requestType: 1,
        description: 1,
        currency: 1,
        department: 1,
        createdBy: 1,
        createdAt: 1,
        status: 1,
        amount: 1,
        items: 1,
        workflow: 1,
        currentStep: 1,
        voucherNo: {
          $let: {
            vars: { d: { $arrayElemAt: ["$__vrow", 0] } },
            in: "$$d.voucherNo",
          },
        },
        voucherSeq: {
          $let: {
            vars: { d: { $arrayElemAt: ["$__vrow", 0] } },
            in: "$$d.seq",
          },
        },
      },
    }
  );

  return pipeline;
}

function buildDonePipeline({ uid, userIdStr, username, from, to }) {
  const uname = String(username || "").trim();
  const processedOr = [
    { "_step.voucherProcessedBy": uid },
    { "_step.voucherProcessedBy": userIdStr },
  ];
  if (uname) processedOr.push({ "_step.voucherProcessedByUsername": uname });

  const pipeline = [];

  pipeline.push(
    { $match: STATUS_MATCH_APPROVED_NOT_CANCELLED },
    {
      $addFields: {
        _lastIdx: { $subtract: [{ $size: { $ifNull: ["$workflow.steps", []] } }, 1] },
      },
    },
    { $match: { $expr: { $gte: ["$_lastIdx", 0] } } },
    { $addFields: { _step: { $arrayElemAt: ["$workflow.steps", "$_lastIdx"] } } },
    {
      $lookup: {
        from: "vouchers",
        let: voucherLookupLetFields(),
        pipeline: voucherLookupByRequestPipeline(),
        as: "__v",
      },
    },
    {
      $match: {
        $expr: { $eq: ["$currentStep", "$_lastIdx"] },
        "_step.status": { $in: ["Approved", "approved"] },
        "__v.0": { $exists: true },
        $or: processedOr,
      },
    }
  );

  if (from || to) {
    const range = {};
    if (from) range.$gte = from;
    if (to) range.$lte = to;
    pipeline.push({
      $match: {
        $or: [{ "_step.voucherProcessedAt": range }, { "__v.0.createdAt": range }],
      },
    });
  }

  pipeline.push(
    {
      $addFields: {
        _sortDisburse: {
          $ifNull: [
            "$_step.voucherProcessedAt",
            {
              $let: {
                vars: { d: { $arrayElemAt: ["$__v", 0] } },
                in: "$$d.createdAt",
              },
            },
          ],
        },
      },
    },
    { $sort: { _sortDisburse: -1, createdAt: -1 } },
    {
      $project: {
        _id: 1,
        requestCode: 1,
        companyKey: 1,
        requestType: 1,
        description: 1,
        currency: 1,
        department: 1,
        createdBy: 1,
        createdAt: 1,
        status: 1,
        amount: 1,
        items: 1,
        workflow: 1,
        currentStep: 1,
        voucherProcessedAt: {
          $ifNull: [
            "$_step.voucherProcessedAt",
            {
              $let: {
                vars: { d: { $arrayElemAt: ["$__v", 0] } },
                in: "$$d.createdAt",
              },
            },
          ],
        },
        voucherProcessedByUsername: {
          $ifNull: ["$_step.voucherProcessedByUsername", ""],
        },
        voucherNo: {
          $let: {
            vars: { d: { $arrayElemAt: ["$__v", 0] } },
            in: "$$d.voucherNo",
          },
        },
        voucherSeq: {
          $let: {
            vars: { d: { $arrayElemAt: ["$__v", 0] } },
            in: "$$d.seq",
          },
        },
      },
    }
  );

  return pipeline;
}

function displayVoucherNo(voucherNo, seq) {
  const v = String(voucherNo ?? "").trim();
  if (v) return v;
  const n = Number(seq);
  if (Number.isFinite(n)) return String(n).padStart(5, "0");
  return "";
}

function textMatchesRow(row, q) {
  const tq = String(q || "").trim().toLowerCase();
  if (!tq) return true;
  const vn = displayVoucherNo(row.voucherNo, row.voucherSeq);
  const text = [
    row.requestCode,
    row.companyKey,
    row.requestType,
    row.description,
    row.currency,
    row.department,
    row.createdBy,
    row._id,
    vn,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return text.includes(tq);
}

function totalFromItems(items) {
  if (!Array.isArray(items) || !items.length) return null;
  let t = 0;
  for (const it of items) {
    const q = Number(it?.qty ?? 0);
    const p = Number(it?.price ?? 0);
    if (Number.isFinite(q) && Number.isFinite(p)) t += q * p;
  }
  return t > 0 ? t : null;
}

function serializeRow(row, companyKey) {
  const id = row._id?.toString?.() || row._id;
  const fromItems = totalFromItems(row.items);
  const totalAmount =
    fromItems != null ? fromItems : row.amount != null ? Number(row.amount) : null;
  const voucherNo = displayVoucherNo(row.voucherNo, row.voucherSeq);
  const isDisbursed = Boolean(row.isDisbursed && voucherNo);
  return {
    _id: id,
    companyKey: row.companyKey || companyKey,
    requestCode: row.requestCode || "",
    requestType: row.requestType || "",
    description: row.description || "",
    currency: row.currency || "",
    department: row.department || "",
    createdBy: row.createdBy || "",
    createdAt: row.createdAt || null,
    status: row.status || "",
    totalAmount: Number.isFinite(totalAmount) ? totalAmount : null,
    isDisbursed,
    wasDelegated: Boolean(row.wasDelegated),
    voucherProcessedAt: row.voucherProcessedAt || null,
    voucherProcessedByUsername: row.voucherProcessedByUsername || "",
    voucherDelegateToUsername: row.voucherDelegateToUsername || "",
    voucherNo: voucherNo || null,
  };
}

function buildReportPipeline(ctx, opts) {
  const {
    tab,
    from,
    to,
    canDelegateView,
    delegateHolderIds,
    delegateHolderUsernames,
    processorTarget,
  } = opts;
  const userIdStr = String(ctx.userId);

  /** tab=done: فقط ما صرفه اليوزر على آخر خطوة (voucherProcessedBy) + وصل موجود */
  if (tab === "done") {
    return buildDonePipeline({
      uid: ctx.uid,
      userIdStr,
      username: ctx.username,
      from,
      to,
    });
  }

  if (canDelegateView) {
    const delegateMode = tab === "pending" ? "pending" : "all";
    return buildDelegatedDisbursementPipeline({
      delegateHolderIds,
      delegateHolderUsernames,
      from,
      to,
      processorUid: processorTarget.filterAll ? null : processorTarget.uid,
      processorIdStr: processorTarget.filterAll ? "" : processorTarget.userIdStr,
      processorUsername: processorTarget.filterAll ? "" : processorTarget.username,
      mode: delegateMode,
    });
  }

  if (tab === "pending") {
    return buildPendingPipeline({
      uid: ctx.uid,
      username: ctx.username,
      from,
      to,
      permissions: ctx.permissions,
    });
  }

  if (!processorTarget.isSelf) {
    return buildAuthorizedUserReportPipeline({
      processorUid: processorTarget.uid,
      processorIdStr: processorTarget.userIdStr,
      processorUsername: processorTarget.username,
      from,
      to,
    });
  }

  return buildRegularUserReportPipeline({
    uid: ctx.uid,
    userIdStr,
    username: ctx.username,
    permissions: ctx.permissions,
    from,
    to,
  });
}

/** نفس حقول البحث النصي في التقرير (تقريباً) بعد مرحلة الـ$project */
function buildSuggestRowMatch(sq) {
  const s = String(sq || "").trim();
  const rx = new RegExp(escapeRegex(s), "i");
  const or = [
    { requestCode: rx },
    { description: rx },
    { requestType: rx },
    { createdBy: rx },
    { department: rx },
    { currency: rx },
    { companyKey: rx },
    { voucherNo: rx },
    {
      $expr: {
        $regexMatch: {
          input: { $ifNull: [{ $toString: "$voucherSeq" }, ""] },
          regex: escapeRegex(s),
          options: "i",
        },
      },
    },
    {
      $expr: {
        $regexMatch: {
          input: { $toString: "$_id" },
          regex: escapeRegex(s),
          options: "i",
        },
      },
    },
  ];
  if (isValidObjectId(s)) {
    try {
      or.push({ _id: new mongoose.Types.ObjectId(s) });
    } catch {
      /* ignore */
    }
  }
  return { $match: { $or: or } };
}

/**
 * اقتراحات ضمن نفس صلاحية التقرير: صفوف تمرّ بـ pending/done pipeline للمستخدم الحالي،
 * ثم تطابق نصّي على الحقول الظاهرة (لا بحث عام في vouchers/طلبات خارج نطاق التقرير).
 */
async function buildDisbursementSuggest(
  ctx,
  companyFilter,
  qRaw,
  tabRaw,
  fromRaw,
  toRaw,
  processorUserIdRaw
) {
  const sq = String(qRaw || "").trim();
  if (sq.length < 2 || !ctx.companies.length) return [];

  let companiesToScan = ctx.companies;
  if (companyFilter && companyFilter !== "all") {
    if (!companyInList(ctx.companies, companyFilter)) {
      throw Object.assign(new Error("لا صلاحية لهذه الشركة"), { status: 403 });
    }
    companiesToScan = [companyFilter];
  }

  const canDelegateView = ctx.permissions.includes(PERMISSIONS.VOUCHER_DELEGATE);
  const tab = String(tabRaw || "").toLowerCase();
  const from = parseDateStart(fromRaw);
  const to = parseDateEnd(toRaw);
  const holders = canDelegateView
    ? await loadDelegateHolderIdsAndUsernames()
    : { ids: [], usernames: [] };
  const authorizedUsers = await loadAuthorizedFilterUsers(
    ctx,
    companiesToScan,
    holders.ids,
    canDelegateView
  );
  const processorTarget = await resolveProcessorTarget(
    ctx,
    processorUserIdRaw,
    canDelegateView,
    authorizedUsers
  );

  const pipeline = buildQuickSuggestPipeline({
    uid: ctx.uid,
    userIdStr: String(ctx.userId),
    username: ctx.username,
    permissions: ctx.permissions,
    canDelegateView,
    delegateHolderIds: holders.ids,
    delegateHolderUsernames: holders.usernames,
    processorTarget,
    from,
    to,
  });

  const matchStage = buildSuggestRowMatch(sq);
  const out = [];
  const seen = new Set();

  for (const companyKey of companiesToScan) {
    if (out.length >= 16) break;
    try {
      const Model = getModelForCompany(companyKey);
      const docs = await Model.aggregate([...pipeline, matchStage, { $limit: 12 }]);
      for (const d of docs) {
        const id = String(d._id);
        if (seen.has(id)) continue;
        seen.add(id);
        const code = String(d.requestCode || "").trim();
        const desc = String(d.description || "").slice(0, 48);
        const ck = d.companyKey || companyKey;
        const vn = displayVoucherNo(d.voucherNo, d.voucherSeq);
        const disbursed = Boolean(d.isDisbursed && vn);
        if (disbursed && vn) {
          const val = String(vn || code || id).trim();
          const label = `وصل ${vn} — ${ck}${desc ? " — " + desc : ""}`;
          out.push({ type: "voucher", value: val, label });
        } else {
          const val = code || id;
          const label = `طلب ${code || id} — ${ck}${desc ? " — " + desc : ""}`;
          out.push({ type: "request", value: val, label });
        }
        if (out.length >= 32) break;
      }
    } catch (e) {
      console.error(`buildDisbursementSuggest aggregate ${companyKey}:`, e?.message || e);
    }
  }

  return out;
}

export async function GET(req) {
  try {
    await dbConnect();

    const ctx = await getAuthContext();
    if (!ctx) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    if (!ctx.permissions.includes(PERMISSIONS.RECEIPTS)) {
      return NextResponse.json(
        { success: false, error: "ليس لديك صلاحية عرض هذا التقرير" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);

    if (searchParams.get("filterUsers") === "1") {
      const canDelegateView = ctx.permissions.includes(PERMISSIONS.VOUCHER_DELEGATE);
      const holders = canDelegateView
        ? await loadDelegateHolderIdsAndUsernames()
        : { ids: [], usernames: [] };
      const authorizedUsers = await loadAuthorizedFilterUsers(
        ctx,
        ctx.companies,
        holders.ids,
        canDelegateView
      );
      return NextResponse.json({
        success: true,
        data: authorizedUsers,
        meta: {
          canFilterUsers: canDelegateView || authorizedUsers.length > 1,
          viewMode: canDelegateView ? "delegate" : "regular",
        },
      });
    }

    if (searchParams.get("suggest") === "1") {
      try {
        const companyFilter = String(searchParams.get("company") || "all").trim();
        const sq = String(searchParams.get("q") || "").trim();
        const data = await buildDisbursementSuggest(
          ctx,
          companyFilter,
          sq,
          searchParams.get("tab"),
          searchParams.get("from"),
          searchParams.get("to"),
          searchParams.get("processorUser")
        );
        return NextResponse.json({ success: true, data });
      } catch (e) {
        const st = e?.status === 403 ? 403 : 500;
        return NextResponse.json(
          { success: false, error: e?.message || "Server error" },
          { status: st }
        );
      }
    }

    if (!ctx.companies.length) {
      return NextResponse.json({
        success: true,
        data: [],
        meta: { companies: [], tab: "pending" },
      });
    }

    const tab = String(searchParams.get("tab") || "").toLowerCase();
    const companyFilter = String(searchParams.get("company") || "all").trim();
    const q = String(searchParams.get("q") || "").trim();
    const from = parseDateStart(searchParams.get("from"));
    const to = parseDateEnd(searchParams.get("to"));
    const canDelegateView = ctx.permissions.includes(PERMISSIONS.VOUCHER_DELEGATE);

    let companiesToScan = ctx.companies;
    if (companyFilter && companyFilter !== "all") {
      if (!companyInList(ctx.companies, companyFilter)) {
        return NextResponse.json(
          { success: false, error: "لا صلاحية لهذه الشركة" },
          { status: 403 }
        );
      }
      companiesToScan = [companyFilter];
    }

    const holders = canDelegateView
      ? await loadDelegateHolderIdsAndUsernames()
      : { ids: [], usernames: [] };

    const authorizedUsers = await loadAuthorizedFilterUsers(
      ctx,
      companiesToScan,
      holders.ids,
      canDelegateView
    );

    let processorTarget;
    try {
      processorTarget = await resolveProcessorTarget(
        ctx,
        searchParams.get("processorUser"),
        canDelegateView,
        authorizedUsers
      );
    } catch (e) {
      return NextResponse.json(
        { success: false, error: e?.message || "خطأ في الفلتر" },
        { status: e?.status || 400 }
      );
    }

    const pipeline = buildReportPipeline(ctx, {
      tab,
      from,
      to,
      canDelegateView,
      delegateHolderIds: holders.ids,
      delegateHolderUsernames: holders.usernames,
      processorTarget,
    });

    const merged = [];

    for (const companyKey of companiesToScan) {
      try {
        const Model = getModelForCompany(companyKey);
        const list = await Model.aggregate(pipeline);
        for (const row of list) {
          if (!textMatchesRow(row, q)) continue;
          merged.push(serializeRow(row, companyKey));
        }
      } catch (e) {
        console.error(`disbursement-report aggregate failed for ${companyKey}:`, e?.message || e);
      }
    }

    merged.sort((a, b) => {
      const da = new Date(a.voucherProcessedAt || a.createdAt || 0).getTime();
      const db = new Date(b.voucherProcessedAt || b.createdAt || 0).getTime();
      return db - da;
    });

    const canFilterUsers = canDelegateView || authorizedUsers.length > 1;

    return NextResponse.json({
      success: true,
      data: merged,
      meta: {
        companies: ctx.companies,
        viewMode: canDelegateView ? "delegate" : "regular",
        canFilterUsers,
        lockedProcessorUserId: processorTarget.locked ? ctx.userId : null,
        lockedProcessorUsername: processorTarget.locked ? ctx.username : null,
        processorUsers: authorizedUsers,
        tab: tab || "all",
      },
    });
  } catch (err) {
    console.error("receipts/disbursement-report:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Server error" },
      { status: 500 }
    );
  }
}
