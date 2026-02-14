import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import { getModelForCompany } from "@/models/Request";

export const runtime = "nodejs";

export async function PUT(req) {
  try {
    await dbConnect();

    const { id, company } = await req.json();

    if (!id || !company)
      return NextResponse.json({ success: false, error: "id & company required" });

    const Model = getModelForCompany(company);
    const request = await Model.findById(id);
    

    if (!request)
      return NextResponse.json({ success: false, error: "Request not found" });

    // 👇 فقط غيّر قيمة status
    request.status = "Cancelled";

    await request.save();

    return NextResponse.json({ success: true, data: request });

  } catch (err) {
    return NextResponse.json({ success: false, error: err.message });
  }
}