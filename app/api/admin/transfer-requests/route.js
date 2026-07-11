import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import mongoose from "mongoose";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";
import { getAdminWorkflowAccess } from "@/lib/adminRequestsWorkflowCommon";
import {
  executeTransferUserRequests,
  previewTransferUserRequests,
} from "@/lib/admin/transferUserRequests";

export const runtime = "nodejs";

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

function parseOptions(body = {}) {
  return {
    transferCreatedBy: body.transferCreatedBy !== false,
    transferWorkflow: body.transferWorkflow !== false,
    includeOldData: Boolean(body.includeOldData),
  };
}

async function resolveUsers(fromUserId, toUserId) {
  const [fromUser, toUser] = await Promise.all([
    User.findById(fromUserId).select("username").lean(),
    User.findById(toUserId).select("username").lean(),
  ]);
  return { fromUser, toUser };
}

export async function POST(req) {
  try {
    await dbConnect();

    const cookieStore = await cookies();
    const userIdRaw = cookieStore.get("userId")?.value;
    if (!userIdRaw || !isValidObjectId(userIdRaw)) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const userId = new mongoose.Types.ObjectId(userIdRaw);
    const { allowedCompanies, hasManage } = await getAdminWorkflowAccess(userId);

    if (!hasManage) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    if (!allowedCompanies.length) {
      return NextResponse.json(
        { success: false, error: "لا شركات ضمن صلاحيتك" },
        { status: 400 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const dryRun = Boolean(body.dryRun);
    const fromUserId = String(body.fromUserId || "").trim();
    const toUserId = String(body.toUserId || "").trim();
    const companyFilter = String(body.company || "").trim();
    const options = parseOptions(body);

    if (!options.transferCreatedBy && !options.transferWorkflow) {
      return NextResponse.json(
        { success: false, error: "فعّل خياراً واحداً على الأقل للنقل" },
        { status: 400 }
      );
    }

    if (!isValidObjectId(fromUserId) || !isValidObjectId(toUserId)) {
      return NextResponse.json(
        { success: false, error: "اختر مستخدم «من» و«إلى» بشكل صحيح" },
        { status: 400 }
      );
    }

    if (fromUserId === toUserId) {
      return NextResponse.json(
        { success: false, error: "لا يمكن النقل لنفس المستخدم" },
        { status: 400 }
      );
    }

    if (companyFilter && !allowedCompanies.includes(companyFilter)) {
      return NextResponse.json(
        { success: false, error: "لا صلاحية لهذه الشركة" },
        { status: 403 }
      );
    }

    const { fromUser, toUser } = await resolveUsers(fromUserId, toUserId);
    if (!fromUser) {
      return NextResponse.json({ success: false, error: "المستخدم المصدر غير موجود" }, { status: 404 });
    }
    if (!toUser) {
      return NextResponse.json(
        { success: false, error: "المستخدم الهدف غير موجود" },
        { status: 404 }
      );
    }

    const payload = {
      allowedCompanies,
      fromUsername: String(fromUser.username || "").trim(),
      fromUserId,
      toUsername: String(toUser.username || "").trim(),
      toUserId,
      companyFilter,
      options,
    };

    if (dryRun) {
      const preview = await previewTransferUserRequests(payload);
      return NextResponse.json({
        success: true,
        dryRun: true,
        from: { id: fromUserId, username: payload.fromUsername },
        to: { id: toUserId, username: payload.toUsername },
        options,
        ...preview,
      });
    }

    const result = await executeTransferUserRequests(payload);
    return NextResponse.json({
      success: true,
      dryRun: false,
      from: { id: fromUserId, username: payload.fromUsername },
      to: { id: toUserId, username: payload.toUsername },
      options,
      ...result,
    });
  } catch (err) {
    console.error("admin transfer-requests:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Server error" },
      { status: 500 }
    );
  }
}
