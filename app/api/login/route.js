import dbConnect from "@/lib/mongodb";
import User from "@/models/User";
import Permissions from "@/models/Permissions";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs"; // ✅ اضفها

export const runtime = "nodejs";

export async function POST(req) {
  try {
    await dbConnect();

    const { username, password } = await req.json();

    if (!username || !password) {
      return NextResponse.json(
        { success: false, error: "Missing username or password" },
        { status: 400 }
      );
    }

    // ✅ نجيب اليوزر باليوزرنيم فقط
    const user = await User.findOne({ username }).lean();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Invalid login" },
        { status: 401 }
      );
    }

    // ✅ نقارن الباسورد المدخل ويا المشفر بالموديل
    const ok = await bcrypt.compare(String(password), String(user.password || ""));
    if (!ok) {
      return NextResponse.json(
        { success: false, error: "Invalid login" },
        { status: 401 }
      );
    }

    const userId = user._id.toString();

    // ✅ permissions
    const groups = await Permissions.find({ users: userId }).lean();
    const permissions = [...new Set((groups || []).flatMap((g) => g.permissions || []))];

    const res = NextResponse.json({
      success: true,
      user: {
        id: userId,
        username: user.username,
      },
      permissions,
    });

    // ✅ cookie
    res.cookies.set("userId", userId, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    });

    return res;
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e.message || "Server error" },
      { status: 500 }
    );
  }
}