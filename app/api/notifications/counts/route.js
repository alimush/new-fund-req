import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import { cookies } from "next/headers";
import Permissions from "@/models/Permissions";
import User from "@/models/User";
import { getModelForCompany } from "@/models/Request";
import { Types } from "mongoose";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

async function hasCompanyAccess(userId, company) {
  if (!userId || !company) return false;
  if (!Types.ObjectId.isValid(userId)) return false;

  const uid = new Types.ObjectId(userId);

  const exists = await Permissions.exists({
    users: uid,
    companies: company,
  });

  return !!exists;
}

/** نفس منطق scope=pending في /api/requests — موافقات بانتظارك */
async function countPendingApprovals(Model, uid) {
  const rows = await Model.aggregate([
    {
      $match: {
        currentStep: { $gte: 0 },
        status: { $in: ["Pending", "pending"] },
      },
    },
    {
      $addFields: {
        _currStep: {
          $arrayElemAt: ["$workflow.steps", "$currentStep"],
        },
      },
    },
    {
      $match: {
        "_currStep.status": { $in: ["Pending", "pending"] },
        $or: [{ "_currStep.users": uid }, { "_currStep.users._id": uid }],
      },
    },
    { $group: { _id: "$_id" } },
    { $count: "c" },
  ]);
  return rows?.[0]?.c || 0;
}

/**
 * نفس منطق scope=delegated في /api/requests — طلبات مخوّلة لك للصرف (الوصل)،
 * مع استبعاد ما تم إصدار الوصل له (voucherProcessed).
 */
async function countDelegatedVoucherPending(Model, uid, username) {
  const uname = String(username || "").trim();
  const rows = await Model.aggregate([
    { $match: { status: { $in: ["Approved", "approved"] } } },
    {
      $addFields: {
        _lastIdx: { $subtract: [{ $size: { $ifNull: ["$workflow.steps", []] } }, 1] },
      },
    },
    { $match: { $expr: { $gte: ["$_lastIdx", 0] } } },
    {
      $addFields: {
        _step: { $arrayElemAt: ["$workflow.steps", "$_lastIdx"] },
      },
    },
    {
      $match: {
        $expr: { $eq: ["$currentStep", "$_lastIdx"] },
        "_step.status": { $in: ["Approved", "approved"] },
        $and: [
          {
            $or: [
              { "_step.voucherDelegateTo": uid },
              { "_step.voucherDelegateToUsername": uname || "__no_user__" },
            ],
          },
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
      },
    },
    { $group: { _id: "$_id" } },
    { $count: "c" },
  ]);
  return rows?.[0]?.c || 0;
}

export async function GET(req) {
  try {
    await dbConnect();

    const cookieStore = await cookies();
    const userId = cookieStore.get("userId")?.value;

    if (!userId || !Types.ObjectId.isValid(userId)) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const companiesParam = searchParams.get("companies") || "";

    const companies = companiesParam
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);

    if (!companies.length) {
      return NextResponse.json({ success: true, counts: {} });
    }

    const uid = new Types.ObjectId(userId);
    const me = await User.findById(uid).select("username").lean();
    const username = String(me?.username || "").trim();

    const counts = {};

    for (const company of companies) {
      const allowed = await hasCompanyAccess(userId, company);

      if (!allowed) {
        counts[company] = 0;
        continue;
      }

      const Model = getModelForCompany(company);

      const [nApproval, nVoucher] = await Promise.all([
        countPendingApprovals(Model, uid),
        countDelegatedVoucherPending(Model, uid, username),
      ]);

      counts[company] = nApproval + nVoucher;
    }

    return NextResponse.json({
      success: true,
      counts,
    });
  } catch (err) {
    console.error("❌ notifications/counts error:", err);

    return NextResponse.json(
      { success: false, error: err?.message || "Server error" },
      { status: 500 }
    );
  }
}