import dbConnect from "@/lib/mongodb";
import User from "@/models/User";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// حط هنا ID مال الموظف
const TARGET_USER_ID = "69f32e4651cff835f6354d69";

export async function GET() {
  try {
    await dbConnect();

    const user = await User.findByIdAndUpdate(
      TARGET_USER_ID,
      {
        $set: { isActive: false },
        $inc: { sessionVersion: 1 },
      },
      { new: true }
    ).select("_id username isActive sessionVersion");

    if (!user) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "User disabled successfully",
      user,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message || "Server error" },
      { status: 500 }
    );
  }
}