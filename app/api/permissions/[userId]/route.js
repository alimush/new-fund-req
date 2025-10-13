import { NextResponse } from "next/server";
import mongoose from "mongoose";
import Permission from "@/models/Permission";

let isConnected = false;
const connectDB = async () => {
  if (isConnected) return;
  await mongoose.connect(process.env.MONGODB_URI, { dbName: "FundRrq" });
  isConnected = true;
};

// 🟢 POST → إضافة صلاحيات
export async function POST(req) {
  try {
    await connectDB();
    const body = await req.json(); 
    const { userId, companies } = body;

    if (!userId || !companies) {
      return NextResponse.json({ success: false, error: "userId & companies required" }, { status: 400 });
    }

    // إذا موجود عدل، إذا لا أضف
    const perm = await Permission.findOneAndUpdate(
      { userId },
      { companies },
      { upsert: true, new: true }
    );

    return NextResponse.json({ success: true, data: perm });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// 🔵 GET → جلب الصلاحيات
export async function GET(req) {
  await connectDB();
  const all = await Permission.find();
  return NextResponse.json({ success: true, data: all });
}
