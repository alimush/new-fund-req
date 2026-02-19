import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import VoucherCounter from "@/models/VoucherCounter";

export async function POST(req) {
  try {
    await dbConnect();

    const { companyKey, mode } = await req.json();
    if (!companyKey || !mode) {
      return NextResponse.json({ error: "companyKey/mode required" }, { status: 400 });
    }

    // ✅ upsert + inc بدون تعارض
    const doc = await VoucherCounter.findOneAndUpdate(
      { companyKey, mode },                 // ✅ filter حسب الـ schema
      { $inc: { seq: 1 } },                 // ✅ يزيد واحد
      { new: true, upsert: true, setDefaultsOnInsert: true }
    ).lean();

    return NextResponse.json({ seq: doc.seq });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}