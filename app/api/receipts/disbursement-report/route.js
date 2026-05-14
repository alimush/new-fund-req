import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import { cookies } from "next/headers";
import User from "@/models/User";
import Permissions from "@/models/Permissions";
import mongoose from "mongoose";
import { getModelForCompany } from "@/models/Request";
import { PERMISSIONS } from "@/lib/permission";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(String(id || ""));
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

function buildPendingPipeline({ uid, username, from, to }) {
  const uname = String(username || "").trim();
  const delegateOr = [{ "_step.voucherDelegateTo": uid }];
  if (uname) delegateOr.push({ "_step.voucherDelegateToUsername": uname });

  const canActOr = [
    ...delegateOr,
    {
      $and: [
        {
          $or: [
            { "_step.voucherDelegateTo": null },
            { "_step.voucherDelegateTo": { $exists: false } },
          ],
        },
        { "_step.users": { $in: [uid] } },
      ],
    },
  ];

  const pipeline = [];

  const createdMatch = {};
  if (from) createdMatch.$gte = from;
  if (to) createdMatch.$lte = to;
  if (Object.keys(createdMatch).length) {
    pipeline.push({ $match: { createdAt: createdMatch } });
  }

  pipeline.push(
    { $match: { status: { $in: ["Approved", "approved"] } } },
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
        $and: [
          {
            $or: [
              { "_step.voucherProcessedBy": null },
              { "_step.voucherProcessedBy": { $exists: false } },
            ],
          },
          {
            $or: [
              { "_step.voucherProcessedAt": null },
              { "_step.voucherProcessedAt": { $exists: false } },
            ],
          },
        ],
        $or: canActOr,
      },
    },
    { $sort: { createdAt: -1 } },
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
    { $match: { status: { $in: ["Approved", "approved"] } } },
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
        $or: processedOr,
      },
    }
  );

  const procMatch = {};
  if (from) procMatch.$gte = from;
  if (to) procMatch.$lte = to;
  if (Object.keys(procMatch).length) {
    pipeline.push({ $match: { "_step.voucherProcessedAt": procMatch } });
  }

  // لا تعرض طلباً في «صرفتها أنا» إن لم يبقَ وصل مرتبط به (مثلاً بعد حذف الوصل)
  pipeline.push(
    {
      $lookup: {
        from: "vouchers",
        let: { rid: { $toString: "$_id" } },
        pipeline: [
          {
            $match: {
              $expr: {
                $or: [
                  { $eq: ["$requestId", "$$rid"] },
                  { $eq: [{ $toString: { $ifNull: ["$requestId", ""] } }, "$$rid"] },
                ],
              },
            },
          },
          { $limit: 1 },
          { $project: { _id: 1 } },
        ],
        as: "__voucherStillExists",
      },
    },
    { $match: { "__voucherStillExists.0": { $exists: true } } }
  );

  pipeline.push(
    { $sort: { "_step.voucherProcessedAt": -1, createdAt: -1 } },
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
        voucherProcessedAt: "$_step.voucherProcessedAt",
        voucherProcessedByUsername: "$_step.voucherProcessedByUsername",
      },
    }
  );

  return pipeline;
}

function textMatchesRow(row, q) {
  const tq = String(q || "").trim().toLowerCase();
  if (!tq) return true;
  const text = [
    row.requestCode,
    row.companyKey,
    row.requestType,
    row.description,
    row.currency,
    row.department,
    row.createdBy,
    row._id,
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
    voucherProcessedAt: row.voucherProcessedAt || null,
    voucherProcessedByUsername: row.voucherProcessedByUsername || "",
  };
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

    if (!ctx.companies.length) {
      return NextResponse.json({
        success: true,
        data: [],
        meta: { companies: [], tab: "pending" },
      });
    }

    const { searchParams } = new URL(req.url);
    const tab = String(searchParams.get("tab") || "pending").toLowerCase();
    const companyFilter = String(searchParams.get("company") || "all").trim();
    const q = String(searchParams.get("q") || "").trim();
    const from = parseDateStart(searchParams.get("from"));
    const to = parseDateEnd(searchParams.get("to"));

    let companiesToScan = ctx.companies;
    if (companyFilter && companyFilter !== "all") {
      if (!ctx.companies.includes(companyFilter)) {
        return NextResponse.json(
          { success: false, error: "لا صلاحية لهذه الشركة" },
          { status: 403 }
        );
      }
      companiesToScan = [companyFilter];
    }

    const userIdStr = String(ctx.userId);
    const pipelineFn =
      tab === "done"
        ? () => buildDonePipeline({ uid: ctx.uid, userIdStr, username: ctx.username, from, to })
        : () => buildPendingPipeline({ uid: ctx.uid, username: ctx.username, from, to });

    const merged = [];

    for (const companyKey of companiesToScan) {
      try {
        const Model = getModelForCompany(companyKey);
        const list = await Model.aggregate(pipelineFn());
        for (const row of list) {
          if (!textMatchesRow(row, q)) continue;
          merged.push(serializeRow(row, companyKey));
        }
      } catch (e) {
        console.error(`disbursement-report aggregate failed for ${companyKey}:`, e?.message || e);
      }
    }

    merged.sort((a, b) => {
      const da = new Date(
        tab === "done" ? a.voucherProcessedAt || a.createdAt : a.createdAt || 0
      ).getTime();
      const db = new Date(
        tab === "done" ? b.voucherProcessedAt || b.createdAt : b.createdAt || 0
      ).getTime();
      return db - da;
    });

    return NextResponse.json({
      success: true,
      data: merged,
      meta: {
        companies: ctx.companies,
        tab: tab === "done" ? "done" : "pending",
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
