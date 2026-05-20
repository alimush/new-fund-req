import { Types } from "mongoose";
import Voucher from "@/models/Voucher";
import { getModelForCompany } from "@/models/Request";
import { voucherLookupCompanyKeys } from "@/lib/voucher/resolveVoucherCompanyKey";
import { voucherBelongsToRequest } from "@/lib/voucher/voucherRequestMatch";
import { findLegacyVoucherForRequest } from "@/lib/voucher/findLegacyVoucherForRequest";

const MODE_OR_LEGACY = {
  $or: [
    { mode: "payment" },
    { mode: { $exists: false } },
    { mode: null },
    { mode: "" },
  ],
};

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

function queryFilter(identity, companyKey = "", useMode = true) {
  const parts = [identity];
  if (useMode) parts.push(MODE_OR_LEGACY);
  const filter = parts.length === 1 ? { ...parts[0] } : { $and: parts };
  const ck = safeString(companyKey);
  if (ck) filter.companyKey = ck;
  return filter;
}

function acceptVoucher(doc, ctx) {
  if (!doc) return null;
  if (voucherBelongsToRequest(doc, ctx)) return doc;
  return null;
}

const REQUEST_SELECT =
  "workflow.steps requestCode description items paymentVoucher totalAmount currency companyKey";

export async function findVoucherForRequest({
  requestId,
  requestCode = "",
  mode = "payment",
  requestCompanyKey,
  allowedPerms = [],
  hintCompanyKey = "",
  includeLegacy = true,
}) {
  const rid = safeString(requestId);
  let rcode = safeString(requestCode);
  const ctx = { requestId: rid, requestCode: rcode };
  let req = null;

  if (rid && requestCompanyKey) {
    const RequestModel = getModelForCompany(requestCompanyKey);
    req = await RequestModel.findById(rid).select(REQUEST_SELECT).lean();
    if (!req) {
      req = await RequestModel.findOne({ _id: rid, companyKey: requestCompanyKey })
        .select(REQUEST_SELECT)
        .lean();
    }
    if (req) {
      if (!rcode) rcode = safeString(req.requestCode);
      ctx.requestCode = rcode;

      const steps = req.workflow?.steps || [];
      const last = steps[steps.length - 1];
      const stepVid = safeString(last?.voucherId);
      if (stepVid && Types.ObjectId.isValid(stepVid)) {
        const fromStep = await Voucher.findById(stepVid).lean();
        const ok = acceptVoucher(fromStep, ctx);
        if (ok) return ok;
      }
    }
  }

  const idOr = buildIdOr(rid);
  const codeOr = rcode ? { requestCode: rcode } : null;

  const keys = new Set(
    voucherLookupCompanyKeys(requestCompanyKey, allowedPerms, hintCompanyKey)
  );
  if (requestCompanyKey) keys.add(requestCompanyKey);
  if (hintCompanyKey) keys.add(hintCompanyKey);

  const tryFind = async (identity, useMode) => {
    for (const ck of keys) {
      const doc = await Voucher.findOne(queryFilter(identity, ck, useMode))
        .sort({ createdAt: -1 })
        .lean();
      const ok = acceptVoucher(doc, ctx);
      if (ok) return ok;
    }
    const doc = await Voucher.findOne(queryFilter(identity, "", useMode))
      .sort({ createdAt: -1 })
      .lean();
    return acceptVoucher(doc, ctx);
  };

  if (idOr) {
    let doc = await tryFind(idOr, true);
    if (doc) return doc;
    doc = await tryFind(idOr, false);
    if (doc) return doc;
  }

  if (codeOr) {
    let doc = await tryFind(codeOr, true);
    if (doc) return doc;
    doc = await tryFind(codeOr, false);
    if (doc) return doc;
  }

  if (includeLegacy && req) {
    const legacy = await findLegacyVoucherForRequest({
      requestDoc: req,
      requestCompanyKey,
      allowedPerms,
      hintCompanyKey,
    });
    if (legacy) return legacy;
  }

  return null;
}
