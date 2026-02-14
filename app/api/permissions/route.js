import dbConnect from "@/lib/mongodb";
import Permissions from "@/models/Permissions";
import User from "@/models/User";
import { NextResponse } from "next/server";
import mongoose from "mongoose";

export const runtime = "nodejs";
import { PERMISSIONS } from "@/lib/permission";

// =========================
// Helpers
// =========================
function getUserIdFromReq(req) {
  return req.headers.get("x-user-id") || "";
}

async function requireManagePermissions(req) {
  const userId = getUserIdFromReq(req);

  if (!userId) {
    return {
      ok: false,
      res: NextResponse.json(
        { success: false, error: "Missing x-user-id" },
        { status: 401 }
      ),
    };
  }

  await dbConnect();

  const user = await User.findById(userId).lean();
  if (!user) {
    return {
      ok: false,
      res: NextResponse.json(
        { success: false, error: "Invalid user" },
        { status: 401 }
      ),
    };
  }

  // ✅ اجلب كل الكروبات الي هذا المستخدم ضمنها
  const groups = await Permissions.find({ users: user._id })
    .select("permissions companies")
    .lean();

  // ✅ اجمع كل الصلاحيات
  const allPerms = new Set();
  for (const g of groups) {
    (g.permissions || []).forEach((p) => allPerms.add(p));
  }

  const canManage =
    allPerms.has(PERMISSIONS.MANAGE_PERMISSIONS) ||
    allPerms.has("manage_permissions"); // fallback إذا مخزنها سترنغ مباشر

  if (!canManage) {
    return {
      ok: false,
      res: NextResponse.json(
        { success: false, error: "Access denied" },
        { status: 403 }
      ),
    };
  }

  return { ok: true, user, groups };
}

// =========================
// 🟢 GET (ALL or ONE)
// =========================
export async function GET(req) {
  try {
    const guard = await requireManagePermissions(req);
    if (!guard.ok) return guard.res;

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    // إذا اكو ID → رجع كروب واحد
    if (id) {
      const group = await Permissions.findById(id).populate("users").lean();

      if (!group) {
        return NextResponse.json(
          { success: false, error: "Group not found" },
          { status: 404 }
        );
      }

      return NextResponse.json({ success: true, data: group });
    }

    // رجّع كل الكروبات
    const groups = await Permissions.find({}).populate("users").lean();
    return NextResponse.json({ success: true, data: groups });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}

// =========================
// 🟢 CREATE
// =========================
export async function POST(req) {
  try {
    const guard = await requireManagePermissions(req);
    if (!guard.ok) return guard.res;

    const { name } = await req.json();
    if (!name) {
      return NextResponse.json(
        { success: false, error: "Group name required" },
        { status: 400 }
      );
    }

    const group = await Permissions.create({
      name,
      permissions: [],
      users: [],
      companies: [],
    });

    return NextResponse.json({ success: true, data: group });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}

// =========================
// 🟢 UPDATE
// =========================
export async function PUT(req) {
  try {
    const guard = await requireManagePermissions(req);
    if (!guard.ok) return guard.res;

    const { id, name, users, permissions, companies } = await req.json();

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Group ID is required" },
        { status: 400 }
      );
    }

    // تنظيف البيانات
    const cleanUsers = (users || []).map((u) => new mongoose.Types.ObjectId(u));
    const cleanPerms = permissions || [];
    const cleanCompanies = companies || [];

    const updated = await Permissions.findByIdAndUpdate(
      id,
      {
        name,
        users: cleanUsers,
        permissions: cleanPerms,
        companies: cleanCompanies,
      },
      { new: true }
    )
      .populate("users")
      .lean();

    return NextResponse.json({ success: true, data: updated });
  } catch (err) {
    console.error("UPDATE PERMISSION ERROR:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}

// =========================
// 🟥 DELETE
// =========================
export async function DELETE(req) {
  try {
    const guard = await requireManagePermissions(req);
    if (!guard.ok) return guard.res;

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Group ID required" },
        { status: 400 }
      );
    }

    await Permissions.findByIdAndDelete(id);
    return NextResponse.json({ success: true, message: "Group deleted" });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}