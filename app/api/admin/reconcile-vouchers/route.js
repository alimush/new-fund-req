import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import { cookies } from "next/headers";
import mongoose from "mongoose";
import User from "@/models/User";
import Permissions from "@/models/Permissions";
import { getModelForCompany } from "@/models/Request";
import { PERMISSIONS } from "@/lib/permission";
import { findVoucherForRequest } from "@/lib/voucher/findVoucherForRequest";
import {
  clearWrongStepVoucherFields,
  reconcileRequestVoucher,
} from "@/lib/voucher/reconcileRequestVoucher";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function assertAdmin(userId) {
  const groups = await Permissions.find({
    $or: [{ users: userId }, { users: new mongoose.Types.ObjectId(userId) }],
  }).lean();
  const perms = new Set(groups.flatMap((g) => g.permissions || []).map(String));
  if (!perms.has(PERMISSIONS.VIEW_ALL_REPORTS)) {
    return false;
  }
  return true;
}

export async function POST(req) {
  try {
    await dbConnect();
    const cookieStore = await cookies();
    const userId = cookieStore.get("userId")?.value;
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    if (!(await assertAdmin(userId))) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const dryRun = searchParams.get("dryRun") === "1";
    const company = searchParams.get("company") || "";
    const limit = Math.min(Number(searchParams.get("limit") || 200), 1000);

    const companies = company
      ? [company]
      : [...new Set((await Permissions.distinct("companies")).filter(Boolean))];

    const stats = { scanned: 0, cleared: 0, linked: 0, found: 0, skipped: 0 };

    for (const ck of companies) {
      const Model = getModelForCompany(ck);
      const rows = await Model.find({
        status: { $in: ["Approved", "approved"] },
        "workflow.steps.voucherProcessedAt": { $exists: true, $ne: null },
      })
        .select("_id requestCode workflow.steps")
        .limit(limit)
        .lean();

      for (const row of rows) {
        stats.scanned += 1;
        const rid = String(row._id);
        const rcode = String(row.requestCode || "");

        if (!dryRun) {
          const { cleared } = await clearWrongStepVoucherFields({
            requestCompanyKey: ck,
            requestId: rid,
            requestCode: rcode,
          });
          if (cleared) stats.cleared += 1;
        }

        const voucher = await findVoucherForRequest({
          requestId: rid,
          requestCode: rcode,
          requestCompanyKey: ck,
          includeLegacy: true,
        });

        if (!voucher) {
          stats.skipped += 1;
          continue;
        }
        stats.found += 1;

        if (dryRun) continue;

        const user = await User.findById(userId).select("username").lean();
        const { linked } = await reconcileRequestVoucher({
          requestCompanyKey: ck,
          requestId: rid,
          requestCode: rcode,
          voucher,
          userId,
          username: user?.username || "",
        });
        if (linked) stats.linked += 1;
      }
    }

    return NextResponse.json({ success: true, dryRun, stats });
  } catch (err) {
    console.error("reconcile-vouchers:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Server error" },
      { status: 500 }
    );
  }
}
