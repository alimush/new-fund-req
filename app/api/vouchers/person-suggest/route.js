import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import dbConnect from "@/lib/mongodb";
import Permissions from "@/models/Permissions";
import { PERMISSIONS } from "@/lib/permission";
import { COMPANIES } from "@/lib/voucher/companies";
import mongoose from "mongoose";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COLLECTION_NAME = "vouchers";

const escapeRegex = (s) =>
  String(s || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function normalizeName(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ");
}

function buildLabel(name, profile) {
  const parts = [name];
  if (profile.nationalId) parts.push(`هوية: ${profile.nationalId}`);
  else if (profile.phone) parts.push(`هاتف: ${profile.phone}`);
  return parts.join(" — ");
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

function pickProfile(doc) {
  return {
    receivedBy: normalizeName(doc.receivedBy),
    beneficiary: normalizeName(doc.beneficiary),
    nationalId: normalizeName(doc.nationalId),
    phone: normalizeName(doc.phone),
    bank: normalizeName(doc.bank),
    chequeNo: normalizeName(doc.chequeNo),
    sanadNo: normalizeName(doc.sanadNo),
  };
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
    const q = normalizeName(searchParams.get("q") || "");
    const field = String(searchParams.get("field") || "all").trim();
    const companyKey = String(searchParams.get("companyKey") || "").trim();

    if (q.length < 2) {
      return NextResponse.json({ success: true, data: [] });
    }

    const regex = new RegExp(escapeRegex(q), "i");
    const or = [];

    if (field === "all" || field === "receivedBy") {
      or.push({ receivedBy: { $regex: regex } });
    }
    if (field === "all" || field === "beneficiary") {
      or.push({ beneficiary: { $regex: regex } });
    }

    if (!or.length) {
      return NextResponse.json({ success: true, data: [] });
    }

    const query = { $or: or };
    if (companyKey) {
      query.companyKey = {
        $regex: new RegExp(`^${escapeRegex(companyKey)}$`, "i"),
      };
    }

    const col = mongoose.connection.db.collection(COLLECTION_NAME);
    const docs = await col
      .find(query)
      .project({
        receivedBy: 1,
        beneficiary: 1,
        nationalId: 1,
        phone: 1,
        bank: 1,
        chequeNo: 1,
        sanadNo: 1,
        createdAt: 1,
        updatedAt: 1,
      })
      .sort({ updatedAt: -1, createdAt: -1 })
      .limit(250)
      .toArray();

    const seen = new Set();
    const out = [];

    for (const doc of docs) {
      const profile = pickProfile(doc);
      const candidates = [];

      if (
        (field === "all" || field === "receivedBy") &&
        profile.receivedBy &&
        regex.test(profile.receivedBy)
      ) {
        candidates.push({
          name: profile.receivedBy,
          matchField: "receivedBy",
        });
      }

      if (
        (field === "all" || field === "beneficiary") &&
        profile.beneficiary &&
        regex.test(profile.beneficiary)
      ) {
        candidates.push({
          name: profile.beneficiary,
          matchField: "beneficiary",
        });
      }

      for (const c of candidates) {
        const key = `${c.matchField}|${c.name.toLowerCase()}`;
        if (seen.has(key)) continue;
        seen.add(key);

        out.push({
          name: c.name,
          matchField: c.matchField,
          label: buildLabel(c.name, profile),
          receivedBy: profile.receivedBy,
          beneficiary: profile.beneficiary,
          nationalId: profile.nationalId,
          phone: profile.phone,
          bank: profile.bank,
          chequeNo: profile.chequeNo,
          sanadNo: profile.sanadNo,
        });

        if (out.length >= 20) break;
      }

      if (out.length >= 20) break;
    }

    return NextResponse.json({ success: true, data: out });
  } catch (e) {
    console.error("person-suggest error:", e);
    return NextResponse.json(
      { success: false, error: e?.message || "Suggest failed" },
      { status: 500 }
    );
  }
}
