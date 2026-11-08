import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import mongoose from "mongoose";
import dbConnect from "@/lib/mongodb";
import Permissions from "@/models/Permissions";
import User from "@/models/User";
import VoucherSavedDailyReport from "@/models/VoucherSavedDailyReport";
import Voucher from "@/models/Voucher";
import { PERMISSIONS } from "@/lib/permission";
import { COMPANIES } from "@/lib/voucher/companies";

/** التقارير القديمة حُفظت بدون cbOne/cbTwo → نكمّلها من الوصل الحي */
async function hydrateSettlementFlags(vouchers) {
  const list = Array.isArray(vouchers) ? vouchers : [];
  const needIds = [];
  for (const v of list) {
    if (!v || typeof v !== "object") continue;
    if (v.cbOne !== undefined || v.cbTwo !== undefined) continue;
    const id = String(v._id || "").trim();
    if (id && mongoose.Types.ObjectId.isValid(id)) needIds.push(id);
  }
  if (!needIds.length) return list;

  const live = await Voucher.find({ _id: { $in: needIds } })
    .select("_id cbOne cbTwo")
    .lean();
  const byId = new Map(
    (live || []).map((row) => [String(row._id), row])
  );

  return list.map((v) => {
    if (!v || typeof v !== "object") return v;
    if (v.cbOne !== undefined || v.cbTwo !== undefined) return v;
    const liveRow = byId.get(String(v._id || ""));
    if (!liveRow) return v;
    return {
      ...v,
      cbOne: Boolean(liveRow.cbOne),
      cbTwo: Boolean(liveRow.cbTwo),
    };
  });
}

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

    const vouchers = await hydrateSettlementFlags(doc.vouchers);
    return NextResponse.json({
      success: true,
      data: { ...doc, vouchers },
    });
  } catch (e) {
    console.error("saved report GET id:", e);
    return NextResponse.json(
      { success: false, error: e?.message || "Failed" },
      { status: 500 }
    );
  }
}

function sanitizeAttachment(input, auth) {
  if (!input || typeof input !== "object") return null;
  const key = String(input.key || "").trim();
  const name = String(input.name || "").trim();
  const url = String(input.url || "").trim();
  if (!key && !url) return null;
  const size = Number(input.size);
  return {
    key,
    name: name || key.split("/").pop() || "file",
    url,
    contentType: String(input.contentType || "application/octet-stream").trim(),
    size: Number.isFinite(size) && size >= 0 ? size : 0,
    uploadedAt: input.uploadedAt ? new Date(input.uploadedAt) : new Date(),
    uploadedByUserId: String(auth.userId || ""),
    uploadedByUsername: String(auth.username || ""),
  };
}

/** رفع / حذف مرفق تقرير موقّع */
export async function PATCH(req, { params }) {
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

    const doc = await VoucherSavedDailyReport.findById(id);
    if (!doc || !canAccessDoc(doc.toObject(), auth)) {
      return NextResponse.json(
        { success: false, error: "Not found" },
        { status: 404 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "add").trim().toLowerCase();

    if (action === "remove") {
      const key = String(body?.key || "").trim();
      const url = String(body?.url || "").trim();
      if (!key && !url) {
        return NextResponse.json(
          { success: false, error: "key or url required" },
          { status: 400 }
        );
      }
      const before = Array.isArray(doc.signedAttachments)
        ? doc.signedAttachments
        : [];
      doc.signedAttachments = before.filter((a) => {
        if (key && String(a.key || "") === key) return false;
        if (url && String(a.url || "") === url) return false;
        return true;
      });
      await doc.save();
      return NextResponse.json({
        success: true,
        data: {
          _id: String(doc._id),
          signedAttachments: doc.signedAttachments,
        },
      });
    }

    const att = sanitizeAttachment(body?.attachment, auth);
    if (!att) {
      return NextResponse.json(
        { success: false, error: "Invalid attachment" },
        { status: 400 }
      );
    }
    if (!Array.isArray(doc.signedAttachments)) doc.signedAttachments = [];
    doc.signedAttachments.push(att);
    await doc.save();

    return NextResponse.json({
      success: true,
      data: {
        _id: String(doc._id),
        signedAttachments: doc.signedAttachments,
      },
    });
  } catch (e) {
    console.error("saved report PATCH:", e);
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
