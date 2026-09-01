import { Types } from "mongoose";
import { getModelForCompany } from "@/models/Request";
import { REQUEST_COMPANY_KEYS } from "@/lib/requests/createdByIdentity";

export function buildRequestPageHref(requestCompanyKey, requestId) {
  const company = String(requestCompanyKey || "").trim();
  const id = String(requestId || "").trim();
  if (!company || !id) return null;
  return `/requests/${encodeURIComponent(company)}/${encodeURIComponent(id)}`;
}

export async function resolveRequestCompanyKey({
  requestId,
  requestCompanyKey = "",
  hintCompanyKey = "",
} = {}) {
  const rid = String(requestId || "").trim();
  if (!rid) return null;

  const stored = String(requestCompanyKey || "").trim();
  if (stored) return stored;

  const hints = [
    hintCompanyKey,
    ...REQUEST_COMPANY_KEYS,
  ]
    .map((key) => String(key || "").trim())
    .filter(Boolean);

  const uniqueHints = [...new Set(hints)];

  for (const companyKey of uniqueHints) {
    try {
      const Model = getModelForCompany(companyKey);
      let doc = null;

      if (Types.ObjectId.isValid(rid)) {
        doc = await Model.findById(rid).select("companyKey").lean();
      }

      if (doc) {
        return String(doc.companyKey || companyKey);
      }
    } catch {
      /* try next company */
    }
  }

  return null;
}

export async function enrichVouchersWithRequestLinks(vouchers = []) {
  if (!Array.isArray(vouchers) || !vouchers.length) return [];

  const list = vouchers.map((row) => ({ ...row }));
  const groups = new Map();

  for (const row of list) {
    const rid = String(row.requestId || "").trim();
    if (!rid) {
      row.requestLink = null;
      continue;
    }
    if (!groups.has(rid)) groups.set(rid, []);
    groups.get(rid).push(row);
  }

  await Promise.all(
    [...groups.entries()].map(async ([rid, rows]) => {
      const sample = rows[0];
      const companyKey = await resolveRequestCompanyKey({
        requestId: rid,
        requestCompanyKey: sample.requestCompanyKey,
        hintCompanyKey: sample.companyKey,
      });

      const requestLink = companyKey
        ? {
            href: buildRequestPageHref(companyKey, rid),
            requestCode: String(sample.requestCode || "").trim(),
          }
        : null;

      for (const row of rows) {
        row.requestCompanyKey = companyKey || String(row.requestCompanyKey || "");
        row.requestLink = requestLink;
      }
    })
  );

  return list;
}
