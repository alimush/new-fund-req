import dbConnect from "@/lib/mongodb";
import User from "@/models/User";
import { NextResponse } from "next/server";
import mongoose from "mongoose";

export const runtime = "nodejs";

export async function GET(req) {
  try {
    await dbConnect();

    const userId = req.cookies.get("userId")?.value;

    if (!userId) {
      return NextResponse.json({ user: null }, { status: 200 });
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return NextResponse.json({ user: null }, { status: 200 });
    }

    const user = await User.findById(userId).populate("group").lean();
    if (!user) {
      return NextResponse.json({ user: null }, { status: 200 });
    }

    const userGroup = user.group;
    const userPermissions =
      userGroup && typeof userGroup === "object" && Array.isArray(userGroup.permissions)
        ? userGroup.permissions
        : [];

    return NextResponse.json(
      {
        user: {
          id: String(user._id),
          username: user.username || "",
          group: userGroup && typeof userGroup === "object" ? userGroup.name || null : null,
        },
        permissions: userPermissions,
      },
      { status: 200 }
    );
  } catch (err) {
    return NextResponse.json({ user: null }, { status: 200 });
  }
}