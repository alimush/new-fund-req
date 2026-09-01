import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import dbConnect from "@/lib/mongodb";
import Permissions from "@/models/Permissions";
import VoucherPersonIdentity from "@/models/VoucherPersonIdentity";
import { PERMISSIONS } from "@/lib/permission";
import { COMPANIES } from "@/lib/voucher/companies";
import { normalizePersonName, personNameKey } from "@/lib/voucher/normalizePersonName";
import { sanitizeAttachment } from "@/lib/voucher/sanitizeAttachment";

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
        .select("personName personNameKey attachment")
        .lean();

      const data = {};
      for (const doc of docs) {
        data[doc.personNameKey] = {
          personName: doc.personName,
          attachment: doc.attachment || null,
        };
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
      data: doc
        ? {
            personName: doc.personName,
            attachment: doc.attachment || null,
          }
        : null,
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

    const doc = await VoucherPersonIdentity.findOneAndUpdate(
      { personNameKey: key },
      {
        $set: {
          personName,
          personNameKey: key,
          attachment,
          uploadedByUserId: userId,
          uploadedByName: username,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();

    return NextResponse.json({
      success: true,
      data: {
        personName: doc.personName,
        attachment: doc.attachment,
      },
    });
  } catch (e) {
    console.error("person-identity PUT error:", e);
    return NextResponse.json(
      { success: false, error: e?.message || "Failed to save identity" },
      { status: 500 }
    );
  }
}
