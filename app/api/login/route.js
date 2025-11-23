import dbConnect from "@/lib/mongodb";
import User from "@/models/User";
import Permissions from "@/models/Permissions";
import { NextResponse } from "next/server";

export async function POST(req) {
  try {
    await dbConnect();

    const { username, password } = await req.json();

    const user = await User.findOne({ username, password }).lean();

    if (!user)
      return NextResponse.json({ success: false, error: "Invalid login" });

    // extract id
    const userId = user._id.toString();

    const groups = await Permissions.find({ users: userId }).lean();

    const permissions = [...new Set(groups.flatMap(g => g.permissions))];

    return NextResponse.json({
      success: true,
      user: {
        id: userId,
        username: user.username
      },
      permissions
    });

  } catch (e) {
    return NextResponse.json({ success: false, error: e.message });
  }
}