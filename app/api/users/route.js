import dbConnect from "@/lib/mongodb";
import User from "@/models/User";
import Permissions from "@/models/Permissions";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { getUserIdFromRequest } from "@/lib/auth/getUserIdFromRequest";

export const runtime = "nodejs";

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

async function requireManagePermissions(req) {
  await dbConnect();

  const { userId } = getUserIdFromRequest(req);

  if (!userId) {
    return {
      ok: false,
      res: NextResponse.json(
        { success: false, error: "Missing userId" },
        { status: 401 }
      ),
    };
  }

  if (!isValidObjectId(userId)) {
    return {
      ok: false,
      res: NextResponse.json(
        { success: false, error: "Invalid userId" },
        { status: 401 }
      ),
    };
  }

  // ✅ نجيب كروباته ونطلع صلاحياته
  const groups = await Permissions.find({
    users: new mongoose.Types.ObjectId(userId),
  }).lean();

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
    ? await User.find({ username: { $regex: q, $options: "i" } }).select(
        "-password"
      )
    : await User.find({}).select("-password");

  const usersWithGroups = await Promise.all(
    users.map(async (u) => {
      const groups = await Permissions.find({ users: u._id }).select("name");
      return { ...u.toObject(), groups };
    })
  );

  return NextResponse.json({ success: true, users: usersWithGroups });
}

// 🟢 POST — create user (مع email) + ✅ HASH PASSWORD
export async function POST(req) {
  const auth = await requireManagePermissions(req);
  if (!auth.ok) return auth.res;

  const { username, password, arabicName , email, group, companies } = await req.json();

  if (!username || !password) {
    return NextResponse.json(
      { success: false, error: "Username & password are required" },
      { status: 400 }
    );
  }

  const exists = await User.findOne({ username });
  if (exists) {
    return NextResponse.json(
      { success: false, error: "User already exists" },
      { status: 400 }
    );
  }

  // ✅ hash
  const hashedPassword = await bcrypt.hash(String(password), 10);

  const newUser = await User.create({
    username,
    arabicName: (arabicName || "").trim(),
    password: hashedPassword, // ✅ بدل plain
    email: (email || "").trim().toLowerCase(),
    group: group || null,
    companies: companies || [],
  });

  const userObj = newUser.toObject();
  delete userObj.password;

  return NextResponse.json({ success: true, user: userObj }, { status: 201 });
}

// 🟡 PUT — update user (email + optional password) + ✅ HASH IF PROVIDED
export async function PUT(req) {
  const auth = await requireManagePermissions(req);
  if (!auth.ok) return auth.res;

  const { id, username, password, email, arabicName, group, companies } = await req.json();

  if (!id || !isValidObjectId(id)) {
    return NextResponse.json(
      { success: false, error: "Valid user id required" },
      { status: 400 }
    );
  }

  const updateData = {}; // ✅ لازم قبل استخدامه

  if (username !== undefined) updateData.username = String(username || "").trim();

  if (email !== undefined)
    updateData.email = String(email || "").trim().toLowerCase();

  if (arabicName !== undefined)
    updateData.arabicName = String(arabicName || "").trim();

  if (password !== undefined && String(password).trim() !== "") {
    updateData.password = await bcrypt.hash(String(password), 10);
  }

  if (group !== undefined) updateData.group = group;
  if (companies !== undefined) updateData.companies = companies;

  const user = await User.findByIdAndUpdate(id, updateData, {
    new: true,
  }).select("-password");

  if (!user) {
    return NextResponse.json(
      { success: false, error: "User not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({ success: true, user }, { status: 200 });
}

// 🔴 DELETE — remove
export async function DELETE(req) {
  const auth = await requireManagePermissions(req);
  if (!auth.ok) return auth.res;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id || !isValidObjectId(id)) {
    return NextResponse.json(
      { success: false, error: "Valid id required" },
      { status: 400 }
    );
  }

  const deleted = await User.findByIdAndDelete(id);

  if (!deleted) {
    return NextResponse.json(
      { success: false, error: "User not found" },
      { status: 404 }
    );
  }

  return NextResponse.json(
    { success: true, message: "User deleted" },
    { status: 200 }
  );
}