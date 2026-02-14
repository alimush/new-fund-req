import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import { cookies } from "next/headers";
import { getModelForCompany } from "@/models/Request";
import Permissions from "@/models/Permissions";

export const runtime = "nodejs";
import { Types } from "mongoose";

export async function GET() {
  try {
    await dbConnect();

    const cookieStore = cookies();
    const userId = cookieStore.get("userId")?.value;

    if (!userId) {
      return NextResponse.json({ success: false }, { status: 401 });
    }

    const groups = await Permissions.find({ users: new Types.ObjectId(userId) }).lean();

    const companies = [
      ...new Set(groups.flatMap(g => g.companies || []))
    ];

    const result = {};

    for (const company of companies) {
      const Model = getModelForCompany(company);

      const count = await Model.countDocuments({
        "approvalHistory.date": { $exists: true }
      });

      result[company] = count;
    }

    return NextResponse.json({ success: true, data: result });

  } catch (err) {
    console.error(err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}