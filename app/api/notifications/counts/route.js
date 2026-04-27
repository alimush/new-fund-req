import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import { cookies } from "next/headers";
import Permissions from "@/models/Permissions";
import { getModelForCompany } from "@/models/Request";
import { Types } from "mongoose";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

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

    const cookieStore = await cookies();
    const userId = cookieStore.get("userId")?.value;

    if (!userId || !Types.ObjectId.isValid(userId)) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const companiesParam = searchParams.get("companies") || "";

    const companies = companiesParam
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);

    if (!companies.length) {
      return NextResponse.json({ success: true, counts: {} });
    }

    const uid = new Types.ObjectId(userId);
    const counts = {};

    for (const company of companies) {
      const allowed = await hasCompanyAccess(userId, company);

      if (!allowed) {
        counts[company] = 0;
        continue;
      }

      const Model = getModelForCompany(company);

      const rows = await Model.aggregate([
        {
          $match: {
            currentStep: { $gte: 0 },
            status: "Pending",
          },
        },
        {
          $addFields: {
            _currStep: {
              $arrayElemAt: ["$workflow.steps", "$currentStep"],
            },
          },
        },
        {
          $match: {
            "_currStep.status": "Pending",
            $or: [
              { "_currStep.users": uid },
              { "_currStep.users._id": uid },
            ],
          },
        },
        {
          $group: {
            _id: "$_id",
          },
        },
        {
          $count: "c",
        },
      ]);

      counts[company] = rows?.[0]?.c || 0;
    }

    return NextResponse.json({
      success: true,
      counts,
    });
  } catch (err) {
    console.error("❌ notifications/counts error:", err);

    return NextResponse.json(
      { success: false, error: err?.message || "Server error" },
      { status: 500 }
    );
  }
}