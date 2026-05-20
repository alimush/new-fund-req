import Voucher from "@/models/Voucher";
import { voucherLookupCompanyKeys } from "@/lib/voucher/resolveVoucherCompanyKey";
import { safeString, voucherIsUnlinked } from "@/lib/voucher/voucherRequestMatch";
import { computeRequestTotalAmount } from "@/lib/voucher/requestAmount";

const MODE_OR_LEGACY = {
  $or: [
    { mode: "payment" },
    { mode: { $exists: false } },
    { mode: null },
    { mode: "" },
  ],
};

const UNLINKED_OR = {
  $and: [
    {
      $or: [
        { requestId: null },
        { requestId: "" },
        { requestId: { $exists: false } },
      ],
    },
    {
      $or: [
        { requestCode: null },
        { requestCode: "" },
        { requestCode: { $exists: false } },
      ],
    },
  ],
};

function processorId(step) {
  const by = step?.voucherProcessedBy;
  if (!by) return "";
  if (typeof by === "object" && by._id) return safeString(by._id);
  return safeString(by);
}

function amountMatchFilter(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) return null;
  const tol = Math.max(1, Math.round(n * 0.002));
  return { amount: { $gte: n - tol, $lte: n + tol } };
}

/** وصل قديم بدون requestId — مطابقة بصارف + تاريخ + مبلغ + شركة */
export async function findLegacyVoucherForRequest({
  requestDoc,
  requestCompanyKey,
  allowedPerms = [],
  hintCompanyKey = "",
}) {
  if (!requestDoc) return null;

  const steps = requestDoc.workflow?.steps || [];
  const last = steps[steps.length - 1];
  if (!last?.voucherProcessedAt) return null;

  const keys = voucherLookupCompanyKeys(
    requestCompanyKey,
    allowedPerms,
    hintCompanyKey
  );
  if (requestCompanyKey) keys.push(requestCompanyKey);
  if (hintCompanyKey) keys.push(hintCompanyKey);

  const processedAt = new Date(last.voucherProcessedAt);
  if (Number.isNaN(processedAt.getTime())) return null;

  const windowStart = new Date(processedAt);
  windowStart.setDate(windowStart.getDate() - 5);
  const windowEnd = new Date(processedAt);
  windowEnd.setDate(windowEnd.getDate() + 5);

  const amount = computeRequestTotalAmount(requestDoc);
  const amountFilter = amountMatchFilter(amount);
  const byId = processorId(last);
  const descHint = safeString(requestDoc.description).slice(0, 80);

  for (const ck of [...new Set(keys)]) {
    const base = {
      companyKey: ck,
      ...MODE_OR_LEGACY,
      ...UNLINKED_OR,
      createdAt: { $gte: windowStart, $lte: windowEnd },
    };
    if (amountFilter) Object.assign(base, amountFilter);
    if (byId) base.createdByUserId = byId;

    let candidates = await Voucher.find(base).sort({ createdAt: -1 }).limit(8).lean();

    if (!candidates.length && byId) {
      const relaxed = { ...base };
      delete relaxed.createdByUserId;
      candidates = await Voucher.find(relaxed).sort({ createdAt: -1 }).limit(8).lean();
    }

    const unlinked = candidates.filter((v) => voucherIsUnlinked(v));
    if (unlinked.length === 1) return unlinked[0];

    if (unlinked.length > 1 && descHint) {
      const byDesc = unlinked.filter((v) => {
        const d = safeString(v.description);
        return d && (d.includes(descHint) || descHint.includes(d.slice(0, 40)));
      });
      if (byDesc.length === 1) return byDesc[0];
    }
  }

  return null;
}
