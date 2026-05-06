import Permissions from "@/models/Permissions";
import User from "@/models/User";
import mongoose from "mongoose";
import {
  DEFAULT_EX_BOOKING_COMPANY,
  resolveExBookingCompaniesForUser,
  isPageKeyAllowedForExCompany,
  getExBookingCompanyDef,
} from "@/lib/exForms/exCompanies";

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

export async function loadUserCompanyKeysForUserId(userIdRaw) {
  if (!userIdRaw || !isValidObjectId(userIdRaw)) return [];

  const user = await User.findById(userIdRaw).select("_id").lean();
  if (!user) return [];

  const groups = await Permissions.find({
    $or: [{ users: String(userIdRaw) }, { users: user._id }],
  }).lean();

  return [...new Set(groups.flatMap((g) => g.companies || []))];
}

export async function getAllowedExBookingCompanyKeysForUser(userIdRaw) {
  const keys = await loadUserCompanyKeysForUserId(userIdRaw);
  return resolveExBookingCompaniesForUser(keys).map((c) => c.key);
}

export function normalizeRequestedExCompany(searchParams, body, fallback = DEFAULT_EX_BOOKING_COMPANY) {
  const fromQuery =
    typeof searchParams?.get === "function" ? String(searchParams.get("company") || "").trim() : "";
  const fromBody = body && typeof body === "object" ? String(body.exCompanyKey || body.company || "").trim() : "";
  return fromQuery || fromBody || fallback;
}

export function assertExCompanyAndPageKey(_userIdRaw, requestedCompanyKey, pageKey) {
  const company = String(requestedCompanyKey || "").trim();
  const pk = String(pageKey || "").trim();

  if (!getExBookingCompanyDef(company)) {
    return { ok: false, status: 400, message: "Unknown EX company" };
  }

  if (!isPageKeyAllowedForExCompany(company, pk)) {
    return { ok: false, status: 404, message: "Form not enabled for this company" };
  }

  return { ok: true, companyKey: company, pageKey: pk };
}

/**
 * يتحقق أن المستخدم مسموح له بالشركة المطلوبة (حسب مجموعاته).
 */
export async function assertUserMayAccessExCompany(userIdRaw, requestedCompanyKey) {
  const allowedDefs = resolveExBookingCompaniesForUser(await loadUserCompanyKeysForUserId(userIdRaw));
  const ok = allowedDefs.some((c) => c.key === String(requestedCompanyKey || "").trim());
  if (!ok) {
    return { ok: false, status: 403, message: "No access to this booking company" };
  }
  return { ok: true };
}
