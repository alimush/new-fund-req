import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import dbConnect from "@/lib/mongodb";
import Permissions from "@/models/Permissions";
import { PERMISSIONS } from "@/lib/permission";
import { COMPANIES } from "@/lib/voucher/companies";
import Cheque from "@/models/Cheque";
import { getChequeTemplate } from "@/lib/cheques/templates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const escapeRegex = (s) =>
  String(s || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

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

function formatAmountLabel(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return "";
  return num.toLocaleString("en-US", { maximumFractionDigits: 3 });
}

function mapCheque(doc) {
  const tpl = getChequeTemplate(doc.templateKey);
  const bankName =
    String(doc.bankName || "").trim() ||
    String(tpl?.bankName || "").trim() ||
    String(doc.templateName || "").trim();

  const chequeNumber = String(doc.chequeNumber || "").trim();
  const payee = String(doc.payee || doc.customer || "").trim();
  const amount = Number(doc.amountNumeric) || 0;
  const currency = String(doc.currency || "IQD").toUpperCase() === "USD" ? "USD" : "IQD";
  const amountLabel = formatAmountLabel(amount);
  const status = String(doc.status || "").trim();

  const meta = [];
  if (bankName) meta.push(bankName);
  if (payee) meta.push(payee);
  if (amountLabel) meta.push(`${amountLabel} ${currency}`);
  if (status && status !== "issued") meta.push(status);

  return {
    id: String(doc._id),
    chequeId: String(doc._id),
    chequeNumber,
    label: chequeNumber
      ? `${chequeNumber}${meta.length ? ` — ${meta.join(" · ")}` : ""}`
      : meta.join(" · ") || String(doc._id),
    bankName,
    branchName: String(doc.branchName || doc.branch || "").trim(),
    templateKey: doc.templateKey || "",
    templateName: String(doc.templateName || tpl?.name || "").trim(),
    payee,
    amount,
    amountText: amountLabel,
    amountWords: String(doc.amountWords || "").trim(),
    currency,
    status,
    dateParts: doc.dateParts || null,
  };
}

/**
 * اقتراحات أرقام الصكوك من نظام الصكوك لربطها بالوصولات.
 * GET /api/vouchers/cheque-suggest?q=
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
    const q = String(searchParams.get("q") || "").trim();
    if (q.length < 1) {
      return NextResponse.json({ success: true, data: [] });
    }

    const rx = new RegExp(escapeRegex(q), "i");
    const filter = {
      status: { $ne: "void" },
      $or: [
        { chequeNumber: rx },
        { payee: rx },
        { customer: rx },
        { accountNumber: rx },
        { bankName: rx },
      ],
    };

    const docs = await Cheque.find(filter)
      .sort({ updatedAt: -1, createdAt: -1 })
      .limit(30)
      .select(
        "chequeNumber bankName branchName branch templateKey templateName payee customer amountNumeric amountWords currency status dateParts"
      )
      .lean();

    // Prefer exact / prefix matches on chequeNumber first
    const qLower = q.toLowerCase();
    const ranked = [...docs].sort((a, b) => {
      const an = String(a.chequeNumber || "").toLowerCase();
      const bn = String(b.chequeNumber || "").toLowerCase();
      const aExact = an === qLower ? 0 : an.startsWith(qLower) ? 1 : 2;
      const bExact = bn === qLower ? 0 : bn.startsWith(qLower) ? 1 : 2;
      if (aExact !== bExact) return aExact - bExact;
      return 0;
    });

    const data = ranked.map(mapCheque).filter((row) => row.chequeNumber);

    return NextResponse.json({ success: true, data: data.slice(0, 20) });
  } catch (e) {
    console.error("cheque-suggest error:", e);
    return NextResponse.json(
      { success: false, error: e?.message || "Suggest failed" },
      { status: 500 }
    );
  }
}
