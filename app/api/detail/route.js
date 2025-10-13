import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { getModelForCompany } from "../route"; // استعمل نفس الفنكشن لو موجود

let isConnected = false;
const connectDB = async () => {
  if (isConnected) return;
  await mongoose.connect(process.env.MONGODB_URI, { dbName: "FundRrq" });
  isConnected = true;
};

export async function GET(req) {
  try {
    await connectDB();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const companyKey = searchParams.get("company"); // لازم يروح companyKey حتى نجيب الـ collection

    if (!id || !companyKey) {
      return NextResponse.json({ success: false, error: "id و companyKey مطلوبان" }, { status: 400 });
    }

    const Model = getModelForCompany(companyKey);
    const request = await Model.findById(id);

    if (!request) {
      return NextResponse.json({ success: false, error: "الطلب غير موجود" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: request });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
