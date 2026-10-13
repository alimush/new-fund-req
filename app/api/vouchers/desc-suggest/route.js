import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import mongoose from "mongoose";
import dbConnect from "@/lib/mongodb";
import Permissions from "@/models/Permissions";
import { PERMISSIONS } from "@/lib/permission";
import { COMPANIES } from "@/lib/voucher/companies";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COLLECTION_NAME = "vouchers";

const escapeRegex = (s) =>
  String(s || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function normalizeText(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ");
}

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

/**
 * اقتراحات وصف الوصل من وصولات سابقة.
 * GET /api/vouchers/desc-suggest?q=&companyKey=
 */
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
    const hasAnyCompanyPerm = COMPANIES.some(
      (c) => c.permission && allowedPerms.includes(c.permission)
    );
    const canUse =
      allowedPerms.includes(PERMISSIONS.RECEIPTS) ||
      allowedPerms.includes(PERMISSIONS.VOUCHERS_REPORTS_VIEW) ||
      allowedPerms.includes(PERMISSIONS.VIEW_ALL_REPORTS) ||
      hasAnyCompanyPerm;

    if (!canUse) {
      return NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const q = normalizeText(searchParams.get("q") || "");
    const companyKey = String(searchParams.get("companyKey") || "").trim();

    if (q.length < 2) {
      return NextResponse.json({ success: true, data: [] });
    }

    const regex = new RegExp(escapeRegex(q), "i");
    const query = {
      description: { $regex: regex },
    };
    if (companyKey) {
      query.companyKey = {
        $regex: new RegExp(`^${escapeRegex(companyKey)}$`, "i"),
      };
    }

    const col = mongoose.connection.db.collection(COLLECTION_NAME);
    const docs = await col
      .find(query)
      .project({
        description: 1,
        receivedBy: 1,
        mode: 1,
        createdAt: 1,
        updatedAt: 1,
      })
      .sort({ updatedAt: -1, createdAt: -1 })
      .limit(250)
      .toArray();

    const seen = new Set();
    const out = [];

    for (const doc of docs) {
      const text = normalizeText(doc.description);
      if (!text || !regex.test(text)) continue;

      const key = text.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);

      const receivedBy = normalizeText(doc.receivedBy);
      const mode = String(doc.mode || "").trim();
      const meta = [];
      if (mode === "payment") meta.push("صرف");
      else if (mode === "receipt") meta.push("قبض");
      if (receivedBy) meta.push(receivedBy);

      out.push({
        text,
        label: meta.length ? `${text} — ${meta.join(" · ")}` : text,
        receivedBy,
        mode,
      });

      if (out.length >= 20) break;
    }

    return NextResponse.json({ success: true, data: out });
  } catch (e) {
    console.error("desc-suggest error:", e);
    return NextResponse.json(
      { success: false, error: e?.message || "Suggest failed" },
      { status: 500 }
    );
  }
}
