import { Types } from "mongoose";
import Voucher from "@/models/Voucher";
import { getModelForCompany } from "@/models/Request";
import {
  requestIdsEqual,
  voucherBelongsToRequest,
} from "@/lib/voucher/voucherRequestMatch";

function safeString(v) {
  return String(v ?? "").trim();
}

function buildIdOr(requestId) {
  const rid = safeString(requestId);
  if (!rid) return null;
  const or = [{ requestId: rid }];
  if (Types.ObjectId.isValid(rid)) {
    or.push({ requestId: new Types.ObjectId(rid) });
  }
  return { $or: or };
}

function voucherNoOf(doc) {
  if (!doc) return "";
  const n = safeString(doc.voucherNo);
  if (n) return n;
  if (doc.seq != null) return String(doc.seq).padStart(5, "0");
  return "";
}

/**
 * كل الوصولات المربوطة بطلب (طلب واحد يمكن أن يرتبط بعدة وصولات).
 */
export async function findVouchersForRequest({
  requestId,
  requestCode = "",
  requestCompanyKey = "",
}) {
  const rid = safeString(requestId);
  let rcode = safeString(requestCode);
  const company = safeString(requestCompanyKey);

  if (rid && company && !rcode) {
    try {
      const RequestModel = getModelForCompany(company);
      const req =
        (await RequestModel.findById(rid).select("requestCode").lean()) ||
        (await RequestModel.findOne({ _id: rid, companyKey: company })
          .select("requestCode")
          .lean());
      if (req) rcode = safeString(req.requestCode);
    } catch {
      /* ignore */
    }
  }

  const ctx = { requestId: rid, requestCode: rcode };
  const orParts = [];
  const idOr = buildIdOr(rid);
  if (idOr) orParts.push(idOr);
  if (rcode) orParts.push({ requestCode: rcode });
  if (!orParts.length) return [];

  const filter = orParts.length === 1 ? orParts[0] : { $or: orParts };
  const docs = await Voucher.find(filter).sort({ createdAt: 1, seq: 1 }).lean();

  const seen = new Set();
  const out = [];
  for (const doc of docs) {
    const byId = rid && requestIdsEqual(doc.requestId, rid);
    const byCode = rcode && safeString(doc.requestCode) === rcode;
    if (!byId && !byCode && !voucherBelongsToRequest(doc, ctx)) continue;
    const id = String(doc._id);
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(doc);
  }
  return out;
}

export function summarizeVouchers(vouchers = []) {
  const list = Array.isArray(vouchers) ? vouchers : [];
  const nos = list.map(voucherNoOf).filter(Boolean);
  const ids = list.map((v) => String(v._id)).filter(Boolean);
  const items = list.map((v) => ({
    _id: String(v._id),
    voucherNo: voucherNoOf(v),
    companyKey: String(v.companyKey || "").trim(),
    mode: String(v.mode || "payment").trim() || "payment",
    amount: v.amount,
    currency: String(v.currency || "").trim(),
    description: String(v.description || "").trim(),
    createdAt: v.createdAt || null,
  }));
  return {
    vouchers: list,
    items,
    voucherIds: ids,
    voucherId: ids[0] || null,
    voucherNo: nos[0] || null,
    voucherNos: nos,
    voucherNosLabel: nos.length ? nos.map((n) => `وصل ${n}`).join(" · ") : "",
    hasVoucher: list.length > 0,
    count: list.length,
  };
}
