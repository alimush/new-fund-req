import dbConnect from "@/lib/mongodb";
import User from "@/models/User";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET() {
  try {
    await dbConnect();

    // ✅ Next App Router (ممكن يحتاج await حسب إصدار Next)
    const cookieStore = await cookies();
    const userId = cookieStore.get("userId")?.value;

    if (!userId) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const user = await User.findById(userId).lean();
    if (!user) {
      // كوكي قديم / يوزر محذوف
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    // ✅ لا ترجع id للفرونت
    return NextResponse.json(
      {
        success: true,
        user: { username: user.username },
      },
      { status: 200 }
    );
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e.message },
      { status: 500 }
    );
  }
}