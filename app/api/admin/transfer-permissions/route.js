import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import mongoose from "mongoose";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";
import { getAdminWorkflowAccess } from "@/lib/adminRequestsWorkflowCommon";
import {
  executeTransferUserPermissions,
  previewTransferUserPermissions,
  validateTransferUserIds,
} from "@/lib/admin/transferUserPermissions";

export const runtime = "nodejs";

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

export async function POST(req) {
  try {
    await dbConnect();

    const cookieStore = await cookies();
    const userIdRaw = cookieStore.get("userId")?.value;
    if (!userIdRaw || !isValidObjectId(userIdRaw)) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const userId = new mongoose.Types.ObjectId(userIdRaw);
    const { hasManage } = await getAdminWorkflowAccess(userId);

    if (!hasManage) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const dryRun = Boolean(body.dryRun);
    const fromUserId = String(body.fromUserId || "").trim();
    const toUserId = String(body.toUserId || "").trim();

    const valid = validateTransferUserIds(fromUserId, toUserId);
    if (!valid.ok) {
      return NextResponse.json({ success: false, error: valid.error }, { status: 400 });
    }

    const [fromUser, toUser] = await Promise.all([
      User.findById(fromUserId).select("username").lean(),
      User.findById(toUserId).select("username").lean(),
    ]);

    if (!fromUser) {
      return NextResponse.json({ success: false, error: "المستخدم المصدر غير موجود" }, { status: 404 });
    }
    if (!toUser) {
      return NextResponse.json({ success: false, error: "المستخدم الهدف غير موجود" }, { status: 404 });
    }

    const result = dryRun
      ? await previewTransferUserPermissions({ fromUserId, toUserId })
      : await executeTransferUserPermissions({ fromUserId, toUserId });

    return NextResponse.json({
      success: true,
      dryRun,
      from: { id: fromUserId, username: fromUser.username },
      to: { id: toUserId, username: toUser.username },
      ...result,
    });
  } catch (err) {
    console.error("admin transfer-permissions:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Server error" },
      { status: 500 }
    );
  }
}
