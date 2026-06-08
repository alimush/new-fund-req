import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import { cookies } from "next/headers";
import Permissions from "@/models/Permissions";
import PaymentPlanLayout from "@/models/PaymentPlanLayout";
import { PERMISSIONS } from "@/lib/permission";
import {
  PAYMENT_PLAN_TEMPLATE,
  PAYMENT_PLAN_TEMPLATE_KEY,
} from "@/lib/ex/paymentPlanTemplate";
import { mergePaymentPlanFields } from "@/lib/ex/paymentPlanLayoutMerge";

export const runtime = "nodejs";

async function getUserPerms(userId) {
  const groups = await Permissions.find({ users: userId })
    .select("permissions")
    .lean();
  return [...new Set(groups.flatMap((g) => g.permissions || []).map(String))];
}

async function requireExAccess(userId) {
  const perms = await getUserPerms(userId);
  const ok =
    perms.includes(PERMISSIONS.EX) ||
    perms.includes(PERMISSIONS.EX_Create_Request) ||
    perms.includes(PERMISSIONS.VIEW_ALL_REPORTS);
  return { ok, perms };
}

export async function GET() {
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

    const access = await requireExAccess(userId);
    if (!access.ok) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 403 }
      );
    }

    const doc = await PaymentPlanLayout.findOne({
      templateKey: PAYMENT_PLAN_TEMPLATE_KEY,
    }).lean();

    const merged = mergePaymentPlanFields(
      PAYMENT_PLAN_TEMPLATE,
      doc?.fields || []
    );

    return NextResponse.json({
      success: true,
      templateKey: PAYMENT_PLAN_TEMPLATE_KEY,
      data: merged,
      tableRowHeight:
        Number(doc?.tableRowHeight) ||
        PAYMENT_PLAN_TEMPLATE.defaultTableRowHeight,
      updatedAt: doc?.updatedAt || null,
    });
  } catch (err) {
    console.error("payment-plan-layout GET:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}

export async function POST() {
  return NextResponse.json(
    { success: false, error: "تعديل ترتيب الفورمة غير متاح حالياً" },
    { status: 403 }
  );
}
