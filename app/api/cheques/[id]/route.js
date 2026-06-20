import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import { cookies } from "next/headers";
import mongoose from "mongoose";
import Cheque from "@/models/Cheque";
import { requireChequeAccess } from "@/lib/cheques/chequeAuth";

export const runtime = "nodejs";

function sanitizeAttachment(att) {
  if (!att?.url) return null;
  const contentType =
    att.contentType || (att.url.endsWith(".pdf") ? "application/pdf" : "image/png");
  const key = String(att.key || "").trim();
  const out = {
    name: att.name || "Attachment",
    url: att.url,
    contentType,
    size: Number(att.size || 0),
    uploadedAt: att.uploadedAt ? new Date(att.uploadedAt) : new Date(),
  };
  if (key) out.key = key;
  return out;
}

function normalizeChequeDoc(doc) {
  if (!doc) return doc;
  return {
    ...doc,
    _id: doc._id?.toString?.() || doc._id,
    attachments: Array.isArray(doc.attachments) ? doc.attachments : [],
  };
}

export async function GET(_req, { params }) {
  try {
    await dbConnect();

    const cookieStore = await cookies();
    const userId = cookieStore.get("userId")?.value;
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const access = await requireChequeAccess(userId);
    if (!access.ok) return access.res;

    const { id: rawId } = await params;
    const id = String(rawId || "").trim();
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, error: "معرّف صك غير صالح" },
        { status: 400 }
      );
    }

    const doc = await Cheque.findById(id).lean();
    if (!doc) {
      return NextResponse.json(
        { success: false, error: "الصك غير موجود" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: normalizeChequeDoc(doc) });
  } catch (err) {
    console.error("❌ Cheque GET by id:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}

export async function PUT(req, { params }) {
  try {
    await dbConnect();

    const cookieStore = await cookies();
    const userId = cookieStore.get("userId")?.value;
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const access = await requireChequeAccess(userId);
    if (!access.ok) return access.res;

    const { id: rawId } = await params;
    const id = String(rawId || "").trim();
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, error: "معرّف صك غير صالح" },
        { status: 400 }
      );
    }

    const body = await req.json();

    if (body?.attachment) {
      const cleanAttachment = sanitizeAttachment(body.attachment);
      if (!cleanAttachment) {
        return NextResponse.json(
          { success: false, error: "بيانات المرفق غير صالحة" },
          { status: 400 }
        );
      }

      const updated = await Cheque.findByIdAndUpdate(
        id,
        { $push: { attachments: cleanAttachment } },
        { new: true }
      ).lean();

      if (!updated) {
        return NextResponse.json(
          { success: false, error: "الصك غير موجود" },
          { status: 404 }
        );
      }

      return NextResponse.json({ success: true, data: normalizeChequeDoc(updated) });
    }

    if (body?.deleteAttachmentKey || body?.deleteAttachmentUrl) {
      const deleteKey = String(body.deleteAttachmentKey || "").trim();
      const deleteUrl = String(body.deleteAttachmentUrl || "").trim();
      if (!deleteKey && !deleteUrl) {
        return NextResponse.json(
          { success: false, error: "معرّف الاتاج غير صالح" },
          { status: 400 }
        );
      }

      const existing = await Cheque.findById(id).lean();
      if (!existing) {
        return NextResponse.json(
          { success: false, error: "الصك غير موجود" },
          { status: 404 }
        );
      }

      const before = Array.isArray(existing.attachments) ? existing.attachments : [];
      const nextAttachments = before.filter((a) => {
        if (deleteKey && String(a?.key || "").trim() === deleteKey) return false;
        if (deleteUrl && String(a?.url || "").trim() === deleteUrl) return false;
        return true;
      });

      if (nextAttachments.length === before.length) {
        return NextResponse.json(
          { success: false, error: "لم يُعثر على الاتاج المطلوب" },
          { status: 404 }
        );
      }

      const updated = await Cheque.findByIdAndUpdate(
        id,
        { $set: { attachments: nextAttachments } },
        { new: true }
      ).lean();

      return NextResponse.json({ success: true, data: normalizeChequeDoc(updated) });
    }

    return NextResponse.json(
      { success: false, error: "طلب غير مدعوم" },
      { status: 400 }
    );
  } catch (err) {
    console.error("❌ Cheque PUT by id:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
