import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import mongoose from "mongoose";
import dbConnect from "@/lib/mongodb";
import Permissions from "@/models/Permissions";
import User from "@/models/User";
import VoucherSavedDailyReport from "@/models/VoucherSavedDailyReport";
import { PERMISSIONS } from "@/lib/permission";
import { COMPANIES } from "@/lib/voucher/companies";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getUserAccess(userId) {
  if (!userId || !mongoose.Types.ObjectId.isValid(String(userId))) {
    return { allowedCompanies: [], allowedPerms: [] };
  }
  const groups = await Permissions.find({
    users: new mongoose.Types.ObjectId(String(userId)),
  })
    .select("companies permissions")
    .lean();

  const companiesSet = new Set();
  const permsSet = new Set();
  for (const g of groups) {
    (g.companies || []).forEach((c) => companiesSet.add(String(c).trim()));
    (g.permissions || []).forEach((p) => permsSet.add(String(p).trim()));
  }
  for (const c of COMPANIES) {
    if (c.permission && permsSet.has(c.permission)) companiesSet.add(c.key);
  }
  return {
    allowedCompanies: Array.from(companiesSet).filter(Boolean),
    allowedPerms: Array.from(permsSet).filter(Boolean),
  };
}

async function requireReportsUser() {
  const cookieStore = await cookies();
  const userId = cookieStore.get("userId")?.value;
  if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }
  const { allowedCompanies, allowedPerms } = await getUserAccess(userId);
  const canView =
    allowedPerms.includes(PERMISSIONS.VOUCHERS_REPORTS_VIEW) ||
    allowedPerms.includes(PERMISSIONS.VIEW_ALL_REPORTS) ||
    COMPANIES.some((c) => c.permission && allowedPerms.includes(c.permission));
  if (!canView) return { ok: false, status: 403, error: "Forbidden" };
  const user = await User.findById(userId).select("username").lean();
  const username = String(user?.username || "").trim();
  const isAdmin =
    /^admin$/i.test(username) ||
    allowedPerms.includes(PERMISSIONS.VIEW_ALL_REPORTS);
  return { ok: true, userId, username, isAdmin, allowedCompanies, allowedPerms };
}

function canAccessDoc(doc, auth) {
  if (!doc) return false;
  if (auth.isAdmin) return true;
  return String(doc.savedByUserId) === String(auth.userId);
}

export async function GET(_req, { params }) {
  try {
    await dbConnect();
    const auth = await requireReportsUser();
    if (!auth.ok) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status }
      );
    }

    const { id: rawId } = await params;
    const id = String(rawId || "").trim();
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, error: "Invalid id" },
        { status: 400 }
      );
    }

    const doc = await VoucherSavedDailyReport.findById(id).lean();
    if (!doc || !canAccessDoc(doc, auth)) {
      return NextResponse.json(
        { success: false, error: "Not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: doc });
  } catch (e) {
    console.error("saved report GET id:", e);
    return NextResponse.json(
      { success: false, error: e?.message || "Failed" },
      { status: 500 }
    );
  }
}

export async function DELETE(_req, { params }) {
  try {
    await dbConnect();
    const auth = await requireReportsUser();
    if (!auth.ok) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status }
      );
    }

    const { id: rawId } = await params;
    const id = String(rawId || "").trim();
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, error: "Invalid id" },
        { status: 400 }
      );
    }

    const doc = await VoucherSavedDailyReport.findById(id).lean();
    if (!doc || !canAccessDoc(doc, auth)) {
      return NextResponse.json(
        { success: false, error: "Not found" },
        { status: 404 }
      );
    }

    const delQuery = auth.isAdmin
      ? { _id: id }
      : { _id: id, savedByUserId: auth.userId };
    await VoucherSavedDailyReport.deleteOne(delQuery);
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("saved report DELETE:", e);
    return NextResponse.json(
      { success: false, error: e?.message || "Failed" },
      { status: 500 }
    );
  }
}
