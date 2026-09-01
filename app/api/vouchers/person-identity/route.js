import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import dbConnect from "@/lib/mongodb";
import Permissions from "@/models/Permissions";
import VoucherPersonIdentity from "@/models/VoucherPersonIdentity";
import { PERMISSIONS } from "@/lib/permission";
import { COMPANIES } from "@/lib/voucher/companies";
import { normalizePersonName, personNameKey } from "@/lib/voucher/normalizePersonName";
import { sanitizeAttachment } from "@/lib/voucher/sanitizeAttachment";
import {
  formatIdentityRecord,
  getIdentityAttachments,
} from "@/lib/voucher/personIdentityAttachments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getUserAccess(userId) {
  if (!userId) return { allowedPerms: [] };

  const groups = await Permissions.find({ users: userId })
    .select("permissions")
    .lean();

  const permsSet = new Set();
  for (const g of groups) {
    (g.permissions || []).forEach((p) => permsSet.add(String(p).trim()));
  }

  return { allowedPerms: Array.from(permsSet).filter(Boolean) };
}

function canUseVoucherIdentity(allowedPerms) {
  const hasAnyCompanyPerm = COMPANIES.some(
    (c) => c.permission && allowedPerms.includes(c.permission)
  );

  return (
    allowedPerms.includes(PERMISSIONS.RECEIPTS) ||
    allowedPerms.includes(PERMISSIONS.VOUCHERS_REPORTS_VIEW) ||
    allowedPerms.includes(PERMISSIONS.VIEW_ALL_REPORTS) ||
    hasAnyCompanyPerm
  );
}

async function migrateLegacyAttachment(key) {
  const doc = await VoucherPersonIdentity.findOne({ personNameKey: key }).lean();
  if (!doc?.attachment?.url) return;

  const existing = getIdentityAttachments(doc);
  if (existing.length) {
    await VoucherPersonIdentity.updateOne(
      { personNameKey: key },
      { $unset: { attachment: "" } }
    );
    return;
  }

  await VoucherPersonIdentity.updateOne(
    { personNameKey: key },
    {
      $set: { attachments: [doc.attachment] },
      $unset: { attachment: "" },
    }
  );
}

export async function GET(req) {
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

    const { allowedPerms } = await getUserAccess(userId);
    if (!canUseVoucherIdentity(allowedPerms)) {
      return NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const namesParam = String(searchParams.get("names") || "").trim();

    if (namesParam) {
      const keys = [
        ...new Set(
          namesParam
            .split(",")
            .map((part) => personNameKey(normalizePersonName(part)))
            .filter(Boolean)
        ),
      ];

      if (!keys.length) {
        return NextResponse.json({ success: true, data: {} });
      }

      const docs = await VoucherPersonIdentity.find({
        personNameKey: { $in: keys },
      })
        .select("personName personNameKey attachments attachment")
        .lean();

      const data = {};
      for (const doc of docs) {
        data[doc.personNameKey] = formatIdentityRecord(doc);
      }

      return NextResponse.json({ success: true, data });
    }

    const name = normalizePersonName(searchParams.get("name") || "");
    const key = personNameKey(name);

    if (!key) {
      return NextResponse.json({ success: true, data: null });
    }

    const doc = await VoucherPersonIdentity.findOne({ personNameKey: key }).lean();

    return NextResponse.json({
      success: true,
      data: formatIdentityRecord(doc),
    });
  } catch (e) {
    console.error("person-identity GET error:", e);
    return NextResponse.json(
      { success: false, error: e?.message || "Failed to load identity" },
      { status: 500 }
    );
  }
}

export async function PUT(req) {
  try {
    await dbConnect();

    const cookieStore = await cookies();
    const userId = cookieStore.get("userId")?.value || "";
    const username = cookieStore.get("username")?.value || "";

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { allowedPerms } = await getUserAccess(userId);
    if (!canUseVoucherIdentity(allowedPerms)) {
      return NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const personName = normalizePersonName(body?.personName || "");
    const key = personNameKey(personName);
    const attachment = sanitizeAttachment(body?.attachment);

    if (!key) {
      return NextResponse.json(
        { success: false, error: "حقل استلمت من مطلوب" },
        { status: 400 }
      );
    }

    if (!attachment) {
      return NextResponse.json(
        { success: false, error: "Invalid attachment payload" },
        { status: 400 }
      );
    }

    await migrateLegacyAttachment(key);

    const doc = await VoucherPersonIdentity.findOneAndUpdate(
      { personNameKey: key },
      {
        $set: {
          personName,
          personNameKey: key,
          uploadedByUserId: userId,
          uploadedByName: username,
        },
        $push: { attachments: attachment },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();

    return NextResponse.json({
      success: true,
      data: formatIdentityRecord(doc),
    });
  } catch (e) {
    console.error("person-identity PUT error:", e);
    return NextResponse.json(
      { success: false, error: e?.message || "Failed to save identity" },
      { status: 500 }
    );
  }
}

function attachmentMatches(a, att) {
  if (!a || !att) return false;
  const k = String(att.key || "").trim();
  const u = String(att.url || "").trim();
  if (k && String(a.key || "").trim() === k) return true;
  if (u && String(a.url || "").trim() === u) return true;
  return false;
}

export async function DELETE(req) {
  try {
    await dbConnect();

    const cookieStore = await cookies();
    const userId = cookieStore.get("userId")?.value || "";
    const username = cookieStore.get("username")?.value || "";

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { allowedPerms } = await getUserAccess(userId);
    if (!canUseVoucherIdentity(allowedPerms)) {
      return NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const personName = normalizePersonName(body?.personName || "");
    const key = personNameKey(personName);
    const deleteKey = String(body?.deleteAttachmentKey || "").trim();
    const deleteUrl = String(body?.deleteAttachmentUrl || "").trim();

    if (!key) {
      return NextResponse.json(
        { success: false, error: "حقل استلمت من مطلوب" },
        { status: 400 }
      );
    }

    if (!deleteKey && !deleteUrl) {
      return NextResponse.json(
        { success: false, error: "معرّف المرفق غير صالح" },
        { status: 400 }
      );
    }

    await migrateLegacyAttachment(key);

    const existing = await VoucherPersonIdentity.findOne({ personNameKey: key }).lean();
    if (!existing) {
      return NextResponse.json(
        { success: false, error: "لم تُعثر على هوية لهذا الاسم" },
        { status: 404 }
      );
    }

    const before = getIdentityAttachments(existing);
    const target = { key: deleteKey, url: deleteUrl };
    const nextAttachments = before.filter((a) => !attachmentMatches(a, target));

    if (nextAttachments.length === before.length) {
      return NextResponse.json(
        { success: false, error: "لم يُعثر على المرفق المطلوب" },
        { status: 404 }
      );
    }

    let doc;
    if (!nextAttachments.length) {
      await VoucherPersonIdentity.deleteOne({ personNameKey: key });
      doc = null;
    } else {
      doc = await VoucherPersonIdentity.findOneAndUpdate(
        { personNameKey: key },
        {
          $set: {
            attachments: nextAttachments,
            uploadedByUserId: userId,
            uploadedByName: username,
          },
          $unset: { attachment: "" },
        },
        { new: true }
      ).lean();
    }

    return NextResponse.json({
      success: true,
      data: formatIdentityRecord(doc),
    });
  } catch (e) {
    console.error("person-identity DELETE error:", e);
    return NextResponse.json(
      { success: false, error: e?.message || "Failed to delete identity attachment" },
      { status: 500 }
    );
  }
}
