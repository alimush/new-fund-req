import dbConnect from "@/lib/mongodb";
import User from "@/models/User";
import Permissions from "@/models/Permissions";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

    const user = await User.findOne({ username }).lean();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Invalid login" },
        { status: 401 }
      );
    }

    const ok = await bcrypt.compare(String(password), String(user.password || ""));
    if (!ok) {
      return NextResponse.json(
        { success: false, error: "Invalid login" },
        { status: 401 }
      );
    }

    const userId = user._id.toString();

    const groups = await Permissions.find({ users: userId }).lean();
    const permissions = [...new Set((groups || []).flatMap((g) => g.permissions || []))];

    const res = NextResponse.json({
      success: true,
      user: { id: userId, username: user.username },
      permissions,
    });

    // ✅ تحديد البيئة
    const isProd = process.env.NODE_ENV === "production";

    // ✅ نحدد هل الدومين الحالي تابع لـ spc-it.com.iq لو لا
    const host = req.headers.get("host") || "";
    const isSpcDomain = host.endsWith("spc-it.com.iq");

    // ✅ cookie options
    const cookieOptions = {
      httpOnly: true,
      sameSite: "lax",
      secure: isProd,          // بالـ prod لازم https
      path: "/",
      maxAge: 60 * 60 * 24 * 365, // سنة
    };

    // ✅ نخلي domain فقط إذا الدومين فعلاً spc-it.com.iq
    if (isSpcDomain) {
      cookieOptions.domain = ".spc-it.com.iq";
    }

    res.cookies.set("userId", userId, cookieOptions);

    return res;
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e.message || "Server error" },
      { status: 500 }
    );
  }
}