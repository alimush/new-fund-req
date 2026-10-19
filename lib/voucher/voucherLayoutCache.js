/**
 * كاش تخطيط حقول الوصولات (ذاكرة + localStorage)
 * يمنع وميض المواضع الخاطئة عند فتح الوصل من التقرير / تبويب جديد.
 */

const memoryCache = new Map();
const inflight = new Map();
const STORAGE_PREFIX = "voucherLayout:v1:";

export function readCachedVoucherLayout(companyKey) {
  const key = String(companyKey || "").trim();
  if (!key) return null;
  const mem = memoryCache.get(key);
  if (Array.isArray(mem) && mem.length) return mem;
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.length) return null;
    memoryCache.set(key, parsed);
    return parsed;
  } catch {
    return null;
  }
}

export function writeCachedVoucherLayout(companyKey, fields) {
  const key = String(companyKey || "").trim();
  if (!key || !Array.isArray(fields) || !fields.length) return;
  memoryCache.set(key, fields);
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(fields));
  } catch {
    /* quota / private mode */
  }
}

/** حمّل التخطيط وخزّنه — استدعِها من التقارير قبل فتح الوصل */
export async function prefetchVoucherLayout(companyKey) {
  const key = String(companyKey || "").trim();
  if (!key) return null;
  const existing = readCachedVoucherLayout(key);
  if (existing) return existing;
  if (inflight.has(key)) return inflight.get(key);

  const promise = (async () => {
    try {
      const qs = new URLSearchParams({ companyKey: key });
      const res = await fetch(`/api/vouchers/layout?${qs}`, {
        credentials: "include",
        cache: "no-store",
      });
      const json = await res.json();
      if (json?.success && Array.isArray(json.data?.fields) && json.data.fields.length) {
        writeCachedVoucherLayout(key, json.data.fields);
        return json.data.fields;
      }
    } catch {
      /* ignore */
    } finally {
      inflight.delete(key);
    }
    return null;
  })();

  inflight.set(key, promise);
  return promise;
}

export function prefetchVoucherLayouts(companyKeys = []) {
  const keys = [...new Set((companyKeys || []).map((k) => String(k || "").trim()).filter(Boolean))];
  return Promise.all(keys.map((key) => prefetchVoucherLayout(key)));
}
