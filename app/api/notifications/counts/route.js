import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import { cookies } from "next/headers";
import Permissions from "@/models/Permissions";
import { getModelForCompany } from "@/models/Request";
import { Types } from "mongoose";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

// ✅ نفس الدالة اللي عندك
async function hasCompanyAccess(userId, company) {
  if (!userId || !company) return false;
  if (!Types.ObjectId.isValid(userId)) return false;

  const uid = new Types.ObjectId(userId);

  const exists = await Permissions.exists({
    users: uid,
    companies: company,
  });

  return !!exists;
}

export async function GET(req) {
  try {
    await dbConnect();

    // ✅ Auth
    const cookieStore = cookies();
    const userId = cookieStore.get("userId")?.value;

    if (!userId) {
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const companiesParam = searchParams.get("companies") || ""; // comma-separated
    const companies = companiesParam
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);

    if (!companies.length) {
      return NextResponse.json({ success: true, counts: {} });
    }

    const uid = new Types.ObjectId(userId);
    const counts = {};

    // ✅ لكل شركة: نجيب عدد الطلبات اللي currentStep مالها Pending وبيها userId ضمن users
    for (const company of companies) {
      // ✅ صلاحية الشركة
      const allowed = await hasCompanyAccess(userId, company);
      if (!allowed) {
        counts[company] = 0;
        continue;
      }

      const Model = getModelForCompany(company);

      // ✅ Aggregation حتى نجيب الستيب الحالي بدقة
      const rows = await Model.aggregate([
        {
          $match: {
            currentStep: { $gte: 0 },
            status: { $in: ["Pending", "Rejected"] }, // إذا تحب فقط Pending خليها ["Pending"]
          },
        },
        {
          $addFields: {
            _currStep: { $arrayElemAt: ["$workflow.steps", "$currentStep"] },
          },
        },
        {
          $match: {
            "_currStep.status": "Pending",
            "_currStep.users": uid, // وجود اليوزر داخل users
          },
        },
        { $count: "c" },
      ]);

      counts[company] = rows?.[0]?.c || 0;
    }

    return NextResponse.json({ success: true, counts });
  } catch (err) {
    console.error("❌ notifications/counts error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}