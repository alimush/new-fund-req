import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import dbConnect from "@/lib/mongodb";
import Permissions from "@/models/Permissions";
import { PERMISSIONS } from "@/lib/permission";
import { backfillVoucherChequeLinks } from "@/lib/voucher/backfillVoucherChequeLinks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getUserAccess(userId) {
  if (!userId) return { allowedPerms: [] };
  const groups = await Permissions.find({ users: userId })
    .select("permissions")
    .lean();
  const permsSet = new Set();
  for (const g of groups) {
    (g.permissions || []).forEach((p) => permsSet.add(String(p).trim()));
  }
  return { allowedPerms: Array.from(permsSet).filter(Boolean) };
}

/**
 * POST /api/vouchers/cheque-backfill
 * Body: { dryRun?: boolean, limit?: number }
 * صلاحية: MANAGE_PERMISSIONS
 */
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

    const { allowedPerms } = await getUserAccess(userId);
    if (!allowedPerms.includes(PERMISSIONS.MANAGE_PERMISSIONS)) {
      return NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const dryRun = Boolean(body?.dryRun);
    const limit = Number(body?.limit) > 0 ? Number(body.limit) : 0;

    const result = await backfillVoucherChequeLinks({ dryRun, limit });

    return NextResponse.json({ success: true, data: result });
  } catch (e) {
    console.error("cheque-backfill error:", e);
    return NextResponse.json(
      { success: false, error: e?.message || "Backfill failed" },
      { status: 500 }
    );
  }
}
