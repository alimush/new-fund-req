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

    // ✅ secure فقط مع HTTPS الحقيقي — مو مع NODE_ENV=production على http://IP
    const host = req.headers.get("host") || "";
    const isSpcDomain = host.endsWith("spc-it.com.iq");
    const forwardedProto = String(req.headers.get("x-forwarded-proto") || "")
      .split(",")[0]
      .trim()
      .toLowerCase();
    const isHttps =
      forwardedProto === "https" ||
      String(req.url || "").startsWith("https://");

    // ✅ cookie options
    const cookieOptions = {
      httpOnly: true,
      sameSite: "lax",
      secure: isHttps,
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
    console.error("[api/login]", e?.message || e);
    const msg = String(e?.message || "");
    const isTls =
      /ssl|tls|alert number 80|ECONNRESET|ETIMEDOUT|server selection/i.test(msg);
    return NextResponse.json(
      {
        success: false,
        error: isTls
          ? "تعذر الاتصال بقاعدة البيانات مؤقتاً، أعد المحاولة خلال لحظات"
          : msg || "Server error",
      },
      { status: 500 }
    );
  }
}