import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import { cookies } from "next/headers";
import User from "@/models/User";
import Permissions from "@/models/Permissions";
import PaymentPlanLayout from "@/models/PaymentPlanLayout";
import { PERMISSIONS } from "@/lib/permission";
import {
  PAYMENT_PLAN_TEMPLATE,
  PAYMENT_PLAN_TEMPLATE_KEY,
} from "@/lib/ex/paymentPlanTemplate";
import {
  fieldsFromPaymentPlanTemplate,
  layoutPayloadFromPaymentPlanFields,
  mergePaymentPlanFields,
} from "@/lib/ex/paymentPlanLayoutMerge";

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

function layoutResponse(doc) {
  const merged = mergePaymentPlanFields(
    PAYMENT_PLAN_TEMPLATE,
    doc?.fields || []
  );

  return {
    success: true,
    templateKey: PAYMENT_PLAN_TEMPLATE_KEY,
    data: merged,
    tableRowHeight:
      Number(doc?.tableRowHeight) ||
      PAYMENT_PLAN_TEMPLATE.defaultTableRowHeight,
    updatedAt: doc?.updatedAt || null,
    updatedBy: doc?.updatedBy || "",
  };
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

    return NextResponse.json(layoutResponse(doc));
  } catch (err) {
    console.error("payment-plan-layout GET:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}

export async function POST(req) {
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

    const user = await User.findById(userId).select("username").lean();
    const username = String(user?.username || "").trim();

    const body = await req.json().catch(() => ({}));

    if (body?.reset) {
      await PaymentPlanLayout.deleteOne({ templateKey: PAYMENT_PLAN_TEMPLATE_KEY });
      return NextResponse.json({
        ...layoutResponse(null),
        message: "تمت إعادة القالب الافتراضي",
      });
    }

    const fields = layoutPayloadFromPaymentPlanFields(body?.fields || []);
    const tableRowHeight = Number(body?.tableRowHeight);
    const rowH =
      Number.isFinite(tableRowHeight) && tableRowHeight > 0
        ? tableRowHeight
        : PAYMENT_PLAN_TEMPLATE.defaultTableRowHeight;

    const doc = await PaymentPlanLayout.findOneAndUpdate(
      { templateKey: PAYMENT_PLAN_TEMPLATE_KEY },
      {
        $set: {
          templateKey: PAYMENT_PLAN_TEMPLATE_KEY,
          fields,
          tableRowHeight: rowH,
          updatedBy: username,
        },
      },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
    ).lean();

    return NextResponse.json({
      ...layoutResponse(doc),
      message: "تم حفظ التخطيط",
    });
  } catch (err) {
    console.error("payment-plan-layout POST:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
