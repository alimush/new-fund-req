import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import dbConnect from "@/lib/mongodb";
import Permissions from "@/models/Permissions";
import { PERMISSIONS } from "@/lib/permission";
import { COMPANIES } from "@/lib/voucher/companies";

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
    const hasAnyCompanyPerm = COMPANIES.some(
      (c) => c.permission && allowedPerms.includes(c.permission)
    );
    const canView =
      allowedPerms.includes(PERMISSIONS.VOUCHERS_REPORTS_VIEW) ||
      allowedPerms.includes(PERMISSIONS.VIEW_ALL_REPORTS) ||
      allowedPerms.includes(PERMISSIONS.RECEIPTS) ||
      hasAnyCompanyPerm;

    if (!canView) {
      return NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const vouchers = Array.isArray(body?.vouchers) ? body.vouchers : [];
    if (!vouchers.length) {
      return NextResponse.json(
        { success: false, error: "No vouchers" },
        { status: 400 }
      );
    }

    const reportMod = await import("@/lib/voucher/buildDailyCashReportExcel");
    const buildFn =
      reportMod.buildDailyCashReportBuffer ||
      reportMod.default?.buildDailyCashReportBuffer;

    if (typeof buildFn !== "function") {
      throw new Error("buildDailyCashReportBuffer export missing");
    }

    const host =
      req.headers.get("x-forwarded-host") || req.headers.get("host") || "";
    const proto = req.headers.get("x-forwarded-proto") || "https";
    const templateUrl = host
      ? `${proto}://${host}/templates/voucher-daily-form.xlsx`
      : "";

    const buffer = await buildFn(vouchers, {
      dateFrom: body?.dateFrom || "",
      dateTo: body?.dateTo || "",
      companyFilter: body?.companyFilter || "all",
      templateUrl,
    });

    const filename = `تقرير_صندوق_${new Date().toISOString().slice(0, 10)}.xlsx`;
    return new NextResponse(Buffer.from(buffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("voucher daily export error:", e);
    return NextResponse.json(
      { success: false, error: e?.message || "Export failed" },
      { status: 500 }
    );
  }
}
