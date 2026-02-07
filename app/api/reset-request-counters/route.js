import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import mongoose from "mongoose";

const CounterSchema = new mongoose.Schema({
  key: { type: String, unique: true },
  seq: { type: Number, default: 0 },
});

const Counter =
  mongoose.models.Counter || mongoose.model("Counter", CounterSchema);

export async function GET() {
  try {
    await dbConnect();

    // 🔥 تصفير كل عدادات الريكويست
    const result = await Counter.updateMany(
      { key: { $regex: /^REQ_/ } },
      { $set: { seq: 0 } }
    );

    return NextResponse.json({
      success: true,
      message: "✅ Request counters have been reset successfully",
      modified: result.modifiedCount,
    });
  } catch (err) {
    console.error("❌ Reset Counter Error:", err.message);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}