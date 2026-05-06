export function getUserIdFromRequest(req) {
  const cookieUserId = req?.cookies?.get?.("userId")?.value || "";

  if (cookieUserId) {
    return { userId: String(cookieUserId), source: "cookie" };
  }

  return { userId: "", source: "none" };
}
