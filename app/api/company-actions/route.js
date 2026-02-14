import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import { cookies } from "next/headers";
import CompanySeen from "@/models/CompanySeen";
import { getModelForCompany } from "@/models/Request";

export const runtime = "nodejs";
import User from "@/models/User";

/**
 * GET /api/company-actions?companies=010,RYD,Al-Rida
 * يرجّع:
 * {
 *   success:true,
 *   data:{
 *     counts: { "010": 3, "RYD": 0 },
 *     notifications: {
 *       "010":[{requestId, requestCode, requestType, action, date, actorId, actorName}],
 *       "RYD":[...]
 *     }
 *   }
 * }
 */
export async function GET(req) {
  try {
    await dbConnect();

    const cookieStore = await cookies();
    const userId = cookieStore.get("userId")?.value;
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const companiesParam = searchParams.get("companies") || "";
    const companies = companiesParam
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    if (companies.length === 0) {
      return NextResponse.json(
        { success: false, error: "companies is required" },
        { status: 400 }
      );
    }

    // ✅ نجيب lastSeenAt دفعة وحدة
    const seenDocs = await CompanySeen.find({
      userId,
      company: { $in: companies },
    })
      .select("company lastSeenAt")
      .lean();

    const seenMap = new Map(seenDocs.map((d) => [d.company, d.lastSeenAt]));

    const counts = {};
    const notifications = {};

    for (const company of companies) {
      const lastSeenAt = seenMap.get(company) || new Date(0);
      const Model = getModelForCompany(company);

      // ✅ نفلتر بعد lastSeenAt + approve/reject/cancel + نستثني اكشنات نفس اليوزر (حل ObjectId vs string)
      const basePipeline = [
        { $unwind: "$approvalHistory" },
        {
          $match: {
            "approvalHistory.action": { $in: ["approve", "reject", "cancel"] },
            "approvalHistory.date": { $gt: lastSeenAt }, // افضل من $gte
          },
        },
        {
          $match: {
            $expr: {
              $ne: [{ $toString: "$approvalHistory.user" }, userId],
            },
          },
        },
      ];

      // ✅ $facet يطلع count الحقيقي + آخر 10 notifications
      const faceted = await Model.aggregate([
        ...basePipeline,
        {
          $facet: {
            count: [{ $count: "count" }],
            latest: [
              { $sort: { "approvalHistory.date": -1 } },
              { $limit: 10 },
              {
                $project: {
                  _id: 1,
                  requestCode: 1,
                  requestType: 1,
                  company: 1,
                  action: "$approvalHistory.action",
                  date: "$approvalHistory.date",
                  actorId: "$approvalHistory.user",
                },
              },
            ],
          },
        },
      ]);

      const facet0 = faceted?.[0] || {};
      const countVal = facet0?.count?.[0]?.count || 0;
      const rows = Array.isArray(facet0?.latest) ? facet0.latest : [];

      counts[company] = countVal;

      // ✅ نجيب أسماء الactors دفعة وحدة
      const actorIds = [
        ...new Set(rows.map((r) => String(r.actorId)).filter(Boolean)),
      ];

      let userMap = new Map();
      if (actorIds.length) {
        const users = await User.find({ _id: { $in: actorIds } })
          .select("username")
          .lean();
        userMap = new Map(users.map((u) => [String(u._id), u.username]));
      }

      notifications[company] = rows.map((r) => ({
        requestId: r._id,
        requestCode: r.requestCode || String(r._id).slice(-6),
        requestType: r.requestType || "Request",
        action: r.action, // approve/reject/cancel
        date: r.date,
        actorId: r.actorId,
        actorName: userMap.get(String(r.actorId)) || "Unknown",
      }));
    }

    return NextResponse.json({
      success: true,
      data: { counts, notifications },
    });
  } catch (err) {
    console.error("❌ company-actions GET error:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/company-actions
 * body: { company: "010" }
 * mark as read
 */
export async function POST(req) {
  try {
    await dbConnect();

    const cookieStore = await cookies();
    const userId = cookieStore.get("userId")?.value;
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    const { company } = await req.json();
    if (!company) {
      return NextResponse.json(
        { success: false, error: "company is required" },
        { status: 400 }
      );
    }

    await CompanySeen.updateOne(
      { userId, company },
      { $set: { lastSeenAt: new Date() } },
      { upsert: true }
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("❌ company-actions POST error:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}