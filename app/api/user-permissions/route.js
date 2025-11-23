import dbConnect from "@/lib/mongodb";
import Permissions from "@/models/Permissions";
import mongoose from "mongoose";
import { NextResponse } from "next/server";

export async function GET(req) {
  try {
    await dbConnect();

    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("id");

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "User ID required" },
        { status: 400 }
      );
    }

    const objectId = new mongoose.Types.ObjectId(userId);

    const groups = await Permissions.find({ users: objectId }).lean();

    const permissions = [...new Set(groups.flatMap(g => g.permissions))];

    return NextResponse.json({ success: true, permissions });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}