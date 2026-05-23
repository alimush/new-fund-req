import dbConnect from "@/lib/mongodb";
import Permissions from "@/models/Permissions";
import User from "@/models/User";
import { normalizePermissions } from "@/lib/permission";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req) {
  try {
    await dbConnect();

    const cookieUserId = req.cookies.get("userId")?.value;

    if (!cookieUserId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // ✅ أهم شي: تأكد اليوزر بعده موجود
    const user = await User.findById(cookieUserId).lean();

    if (!user) {
      return NextResponse.json(
        { success: false, error: "User deleted or not found" },
        { status: 401 }
      );
    }

    // اختياري إذا بعدين تريد disable
    if (user.isActive === false) {
      return NextResponse.json(
        { success: false, error: "User disabled" },
        { status: 401 }
      );
    }

    const groups = await Permissions.find({
      $or: [{ users: cookieUserId }, { users: user._id }],
    }).lean();

    const permissions = normalizePermissions(
      [...new Set(groups.flatMap((g) => g.permissions || []))]
    );
    const companies = [...new Set(groups.flatMap((g) => g.companies || []))];

    return NextResponse.json({
      success: true,
      user: {
        id: user._id.toString(),
        username: user.username,
      },
      permissions,
      companies,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}