import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import { cookies } from "next/headers";
import Permissions from "@/models/Permissions";
import User from "@/models/User";
import { getModelForCompany } from "@/models/Request";
import { Types } from "mongoose";
import { pendingApprovalMongoExtraMatch } from "@/lib/workflow/canApproveAtStep";
import { countPendingDisbursement } from "@/lib/receipts/disbursementCount";
import { PERMISSIONS } from "@/lib/permission";
import { isApprovalOnlyCompany } from "@/lib/companies/expenseTypeCompanies";

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

async function getUserPermissions(userId) {
  const uid = new Types.ObjectId(userId);
  const groups = await Permissions.find({ users: uid }).select("permissions").lean();
  return [...new Set(groups.flatMap((g) => g.permissions || []).map(String))];
}

/** نفس منطق scope=pending في /api/requests — موافقات بانتظارك (من يقدر يوافق فقط) */
async function countPendingApprovals(Model, uid, userPermissions = []) {
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
        $and: [
          {
            $or: [{ "_currStep.users": uid }, { "_currStep.users._id": uid }],
          },
          pendingApprovalMongoExtraMatch(userPermissions),
        ].filter((c) => c && Object.keys(c).length > 0),
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
      return NextResponse.json({
        success: true,
        counts: {},
        approval: {},
        disbursement: {},
      });
    }

    const uid = new Types.ObjectId(userId);
    const me = await User.findById(uid).select("username").lean();
    const username = String(me?.username || "").trim();
    const userPermissions = await getUserPermissions(userId);

    const counts = {};
    const approval = {};
    const disbursement = {};
    const canCountDisbursement = userPermissions.includes(PERMISSIONS.RECEIPTS);

    for (const company of companies) {
      const allowed = await hasCompanyAccess(userId, company);

      if (!allowed) {
        counts[company] = { approval: 0, disbursement: 0, total: 0 };
        approval[company] = 0;
        disbursement[company] = 0;
        continue;
      }

      const Model = getModelForCompany(company);

      const nApproval = await countPendingApprovals(Model, uid, userPermissions);
      const isVoucherDelegate = userPermissions.includes(PERMISSIONS.VOUCHER_DELEGATE);
      const nDisbursement =
        canCountDisbursement && !isVoucherDelegate && !isApprovalOnlyCompany(company)
          ? await countPendingDisbursement(Model, {
              uid,
              username,
              permissions: userPermissions,
            })
          : 0;

      approval[company] = nApproval;
      disbursement[company] = nDisbursement;
      counts[company] = {
        approval: nApproval,
        disbursement: nDisbursement,
        total: nApproval + nDisbursement,
      };
    }

    return NextResponse.json({
      success: true,
      counts,
      approval,
      disbursement,
    });
  } catch (err) {
    console.error("❌ notifications/counts error:", err);

    return NextResponse.json(
      { success: false, error: err?.message || "Server error" },
      { status: 500 }
    );
  }
}