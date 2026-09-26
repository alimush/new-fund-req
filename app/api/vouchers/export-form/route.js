import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import mongoose from "mongoose";
import { ObjectId } from "mongodb";
import dbConnect from "@/lib/mongodb";
import Permissions from "@/models/Permissions";
import { PERMISSIONS } from "@/lib/permission";
import { COMPANIES } from "@/lib/voucher/companies";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COLLECTION_NAME = "vouchers";

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
 * GET /api/vouchers/export-form?id=...
 * Returns Receipt or Payment voucher Excel based on voucher.mode.
 */
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

    const { allowedPerms } = await getUserAccess(userId);
    const hasGeneralAccess =
      allowedPerms.includes(PERMISSIONS.VOUCHERS_REPORTS_VIEW) ||
      allowedPerms.includes(PERMISSIONS.RECEIPTS);

    if (!hasGeneralAccess) {
      return NextResponse.json(
        { success: false, error: "ليس لديك صلاحية تصدير هذا الوصل" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id") || "";
    if (!id || !ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, error: "Invalid id" },
        { status: 400 }
      );
    }

    const db = mongoose.connection.db;
    const doc = await db.collection(COLLECTION_NAME).findOne({
      _id: new ObjectId(id),
    });
    if (!doc) {
      return NextResponse.json(
        { success: false, error: "Voucher not found" },
        { status: 404 }
      );
    }

    const companyConfig = COMPANIES.find(
      (c) =>
        String(c.key).toLowerCase() === String(doc.companyKey).toLowerCase()
    );
    const hasSpecificAccess =
      companyConfig && allowedPerms.includes(companyConfig.permission);
    if (!hasSpecificAccess) {
      return NextResponse.json(
        { success: false, error: "ليس لديك صلاحية لوصولات هذه الشركة" },
        { status: 403 }
      );
    }

    const mode =
      String(doc.mode || "").toLowerCase() === "receipt"
        ? "receipt"
        : "payment";

    const { buildVoucherFormBuffer } = await import(
      "@/lib/voucher/buildVoucherFormExcel"
    );
    const buffer = await buildVoucherFormBuffer(doc);

    const kind = mode === "receipt" ? "قبض" : "صرف";
    const no =
      doc.voucherNo || String(doc.seq ?? "").padStart(5, "0") || "voucher";
    const filename = `وصل_${kind}_${no}.xlsx`;

    return new NextResponse(Buffer.from(buffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("voucher form export error:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Export failed" },
      { status: 500 }
    );
  }
}
