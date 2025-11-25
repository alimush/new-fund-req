import dbConnect from "@/lib/mongodb";
import Permissions from "@/models/Permissions";
import mongoose from "mongoose";
import { NextResponse } from "next/server";

// 🟢 GET (ALL or ONE)
export async function GET(req) {
  try {
    await dbConnect();

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    // إذا اكو ID → رجع كروب واحد
    if (id) {
      const group = await Permissions.findById(id)
        .populate("users")
        .lean();

      if (!group) {
        return NextResponse.json(
          { success: false, error: "Group not found" },
          { status: 404 }
        );
      }

      return NextResponse.json({ success: true, data: group });
    }

    // رجّع كل الكروبات
    const groups = await Permissions.find({})
      .populate("users")
      .lean();

    return NextResponse.json({ success: true, data: groups });

  } catch (err) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}

// 🟢 CREATE
export async function POST(req) {
  try {
    await dbConnect();

    const { name } = await req.json();
    if (!name) {
      return NextResponse.json(
        { success: false, error: "Group name required" },
        { status: 400 }
      );
    }

    const group = await Permissions.create({
      name,
      permissions: [],
      users: [],
    });

    return NextResponse.json({ success: true, data: group });

  } catch (err) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
// 🟢 UPDATE
export async function PUT(req) {
  try {
    await dbConnect();

    const { id, name, users, permissions, companies } = await req.json();

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Group ID is required" },
        { status: 400 }
      );
    }

    // تنظيف البيانات
    const cleanUsers =
      users?.map((u) => new mongoose.Types.ObjectId(u)) || [];

    const cleanPerms = permissions || [];

    const cleanCompanies = companies || []; // ← 🔥🔥 لازم نستلمها

    // 🔥 تحديث الكروب بالكامل بما يحتويه (users + permissions + companies)
    const updated = await Permissions.findByIdAndUpdate(
      id,
      {
        name,
        users: cleanUsers,
        permissions: cleanPerms,
        companies: cleanCompanies, // ← أهم سطر
      },
      { new: true }
    )
      .populate("users")
      .lean();

    return NextResponse.json({ success: true, data: updated });

  } catch (err) {
    console.error("UPDATE PERMISSION ERROR:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
// 🟥 DELETE
export async function DELETE(req) {
  try {
    await dbConnect();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id)
      return NextResponse.json(
        { success: false, error: "Group ID required" },
        { status: 400 }
      );

    await Permissions.findByIdAndDelete(id);

    return NextResponse.json({ success: true, message: "Group deleted" });

  } catch (err) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
} 
