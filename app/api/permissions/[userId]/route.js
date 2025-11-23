import { NextResponse } from "next/server";
import mongoose from "mongoose";
import Permissions from "@/models/Permission";

let isConnected = false;
const connectDB = async () => {
  if (isConnected) return;
  await mongoose.connect(process.env.MONGODB_URI, { dbName: "FundRrq" });
  isConnected = true;
};

// =========================
// 🔵 GET – fetch group or all groups
// =========================
export async function GET(req) {
  await connectDB();

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (id) {
    const group = await Permissions.findById(id).populate("users");
    return NextResponse.json({ success: true, data: group });
  }

  const all = await Permissions.find().populate("users");
  return NextResponse.json({ success: true, data: all });
}

// =========================
// 🟢 POST – Create new group
// =========================
export async function POST(req) {
  try {
    await connectDB();
    const body = await req.json();

    const group = await Permissions.create({
      name: body.name,
      permissions: body.permissions || [],
      users: body.users || [],
      companies: body.companies || []
    });

    return NextResponse.json({ success: true, data: group });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message });
  }
}

// =========================
// 🟡 PUT – Update group
// =========================
export async function PUT(req) {
  try {
    await connectDB();
    const body = await req.json();
    const { id, name, users, permissions, companies } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: "Group ID required" });
    }

    const updated = await Permissions.findByIdAndUpdate(
      id,
      {
        name,
        users,
        permissions,
        companies
      },
      { new: true }
    ).populate("users");

    return NextResponse.json({ success: true, data: updated });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message });
  }
}

// =========================
// 🔴 DELETE – Remove group
// =========================
export async function DELETE(req) {
  await connectDB();

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ success: false, error: "Group ID required" });
  }

  await Permissions.findByIdAndDelete(id);

  return NextResponse.json({ success: true, message: "Group deleted" });
}