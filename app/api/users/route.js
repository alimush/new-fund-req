import dbConnect from "@/lib/mongodb";
import User from "@/models/User";
import Permissions from "@/models/Permissions";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

async function requireManagePermissions(req) {
  await dbConnect();

  // ✅ userId يجي من الفرونت (localStorage) عن طريق header
  const userId = req.headers.get("x-user-id");

  if (!userId) {
    return {
      ok: false,
      res: NextResponse.json(
        { success: false, error: "Missing userId" },
        { status: 401 }
      ),
    };
  }

  // ✅ نجيب كروباته ونطلع صلاحياته
  const groups = await Permissions.find({ users: userId }).lean();
  const perms = [...new Set(groups.flatMap((g) => g.permissions || []))];

  if (!perms.includes("MANAGE_PERMISSIONS")) {
    return {
      ok: false,
      res: NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 }
      ),
    };
  }

  return { ok: true, userId, perms };
}

// 🟢 GET — fetch users (بدون password)
export async function GET(req) {
  const auth = await requireManagePermissions(req);
  if (!auth.ok) return auth.res;

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q");

  const users = q
    ? await User.find({ username: { $regex: q, $options: "i" } }).select("-password")
    : await User.find({}).select("-password");

  const usersWithGroups = await Promise.all(
    users.map(async (u) => {
      const groups = await Permissions.find({ users: u._id }).select("name");
      return { ...u.toObject(), groups };
    })
  );

  return NextResponse.json({ success: true, users: usersWithGroups });
}

// 🟢 POST — create user (مع email)
export async function POST(req) {
  const auth = await requireManagePermissions(req);
  if (!auth.ok) return auth.res;

  const { username, password, email, group, companies } = await req.json();

  const exists = await User.findOne({ username });
  if (exists) {
    return NextResponse.json(
      { success: false, error: "User already exists" },
      { status: 400 }
    );
  }

  const newUser = await User.create({
    username,
    password,
    email: (email || "").trim().toLowerCase(),
    group: group || null,
    companies: companies || [],
  });

  const userObj = newUser.toObject();
  delete userObj.password;

  return NextResponse.json({ success: true, user: userObj }, { status: 201 });
}

// 🟡 PUT — update user (email + optional password)
export async function PUT(req) {
  const auth = await requireManagePermissions(req);
  if (!auth.ok) return auth.res;

  const { id, username, password, email, group, companies } = await req.json();

  const updateData = {};
  if (username !== undefined) updateData.username = username;
  if (email !== undefined) updateData.email = (email || "").trim().toLowerCase();

  if (password !== undefined && String(password).trim() !== "") {
    updateData.password = password;
  }

  if (group !== undefined) updateData.group = group;
  if (companies !== undefined) updateData.companies = companies;

  const user = await User.findByIdAndUpdate(id, updateData, { new: true }).select("-password");

  if (!user) {
    return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true, user }, { status: 200 });
}

// 🔴 DELETE — remove
export async function DELETE(req) {
  const auth = await requireManagePermissions(req);
  if (!auth.ok) return auth.res;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  const deleted = await User.findByIdAndDelete(id);

  if (!deleted) {
    return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true, message: "User deleted" }, { status: 200 });
}