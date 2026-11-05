import { Types } from "mongoose";

export function safeString(v) {
  return String(v ?? "").trim();
}

export function requestIdsEqual(a, b) {
  const x = safeString(a);
  const y = safeString(b);
  if (!x || !y) return false;
  if (x === y) return true;
  if (!Types.ObjectId.isValid(x) || !Types.ObjectId.isValid(y)) return false;
  try {
    return String(new Types.ObjectId(x)) === String(new Types.ObjectId(y));
  } catch {
    return false;
  }
}

/** علامة فصل يدوي — لا تُعامل كربط بطلب ولا تدخل مطابقة legacy */
export const VOUCHER_DETACHED_CODE = "__DETACHED__";

export function isDetachedVoucherCode(code) {
  return safeString(code) === VOUCHER_DETACHED_CODE;
}

/** هل الوصل مربوط بهذا الطلب صراحةً؟ */
export function voucherBelongsToRequest(voucher, { requestId, requestCode } = {}) {
  if (!voucher) return false;

  const rid = safeString(requestId);
  const rcode = safeString(requestCode);
  const vid = safeString(voucher.requestId);
  const vcode = safeString(voucher.requestCode);

  if (isDetachedVoucherCode(vcode)) return false;

  if (vid && rid) {
    if (requestIdsEqual(vid, rid)) return true;
    return false;
  }

  if (vcode && rcode && vcode === rcode) return true;

  if (!vid && !vcode) return false;

  return false;
}

/** وصل بدون ربط — لا يُستخدم إلا مع بحث صريح لاحقاً */
export function voucherIsUnlinked(voucher) {
  if (!voucher) return false;
  const code = safeString(voucher.requestCode);
  if (isDetachedVoucherCode(code)) return false;
  return !safeString(voucher.requestId) && !code;
}
