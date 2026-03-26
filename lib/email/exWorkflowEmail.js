// /lib/exWorkflowEmail.js
import nodemailer from "nodemailer";

/* ======================= CORE ======================= */
export function getExTransporter() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || "587");
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    throw new Error("Missing SMTP env vars (SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS)");
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

export async function sendWorkflowEmail({ toEmails = [], subject = "", html = "" }) {
  if (!Array.isArray(toEmails) || toEmails.length === 0) return { skipped: true };

  const transporter = getExTransporter();
  const from = process.env.MAIL_FROM || process.env.SMTP_FROM || process.env.SMTP_USER;

  const info = await transporter.sendMail({
    from,
    to: toEmails.join(","),
    subject,
    html,
  });

  return { skipped: false, messageId: info.messageId, accepted: info.accepted };
}

/* ======================= UTILS ======================= */
export function escapeHtml(str = "") {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function biDiText(str = "", dir = "auto") {
  return `<span dir="${dir}" style="unicode-bidi:isolate;">${escapeHtml(str)}</span>`;
}

/**
 * ✅ تنظيف الـ key حتى يصير صالح للـ URL
 * - "unit-transfer" => "unit-transfer"
 * - " unit transfer " => "unit-transfer"
 * - "تحويل وحدة" => "تحويل-وحدة"
 */
export function normalizePageKey(input = "") {
  return String(input || "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\w\u0600-\u06FF-]+/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/* ======================= TEMPLATE: APPROVE/REJECT (Dynamic EX) ======================= */
/**
 * ✅ نفس روح تصميم funds (dark glass + header badge)
 *
 * داينمك بالكامل:
 * - pageKey: يستخدم بالرابط الافتراضي /ex/{pageKey}/{id}?key={pageKey} ✅ (هذا المطلوب)
 * - docTitle: عنوان المستند بالهيدر (EN)
 * - docTypeAr: اسم المستند بالعربي داخل البودي
 *
 * ملاحظات:
 * - stepFrom/stepTo: 0-based
 */
export function buildExWorkflowActionEmailHtml({
  action,
  planId, // (هو ID المستند)
  pageKey = "", // ✅ نعتمد عليه للرابط
  stepFrom,
  stepTo,
  note,
  actorName,

  greetingName = "",
  toUserName = "",
  planUrl = "",

  showRoutingLine = true,

  baseDomain = "", // اختياري لتوليد رابط تلقائي (إذا planUrl ما موجود)
  docTitle = "", // عنوان بالهيدر (EN)
  docTypeAr = "", // اسم المستند بالعربي داخل البودي
}) {
  const a = String(action || "").toLowerCase();
  const actionTxt =
  a === "approve"
    ? "Approved"
    : a === "reject"
    ? "Rejected"
    : a === "created"
    ? "Created"
    : String(action || "Updated");

  const fromIdx = Number.isFinite(Number(stepFrom)) ? Number(stepFrom) : 0;
  const toIdx = Number.isFinite(Number(stepTo)) ? Number(stepTo) : 0;

  const safeId = String(planId || "").trim();

  // ✅ نعتمد على key فقط
  const routeKey = normalizePageKey(pageKey || "");

  // ✅ رابط داينمك افتراضي مبني على key
  const computedUrl =
    String(planUrl || "").trim() ||
    (baseDomain && routeKey && safeId
      ? `${String(baseDomain).replace(/\/+$/, "")}/ex/${encodeURIComponent(routeKey)}/${encodeURIComponent(
          safeId
        )}?key=${encodeURIComponent(routeKey)}`
      : "#");

      const actedStepNum = fromIdx + 1;
      const waitingStepNum = toIdx + 1;
      
      const typeAr = docTypeAr || "المستند";
      const typeEn = String(docTitle || "").trim() || String(pageKey || "").trim() || "Document";
      
      const safeActor = biDiText(actorName || "System", "ltr");
      const safeTypeAr = biDiText(typeAr, "rtl");
      const safeTypeEn = biDiText(typeEn, "ltr");
      const safeToUser = biDiText(toUserName || "", "ltr");
      const safePlanId = biDiText(String(planId || ""), "ltr");
      const safeGreeting = biDiText(greetingName || "زميلنا", "auto");
  const arabicActionLine =
  a === "approve"
    ? `تمت الموافقة على الخطوة ${waitingStepNum} من <b style="color:#f8fafc">${safeTypeAr}</b> بواسطة <b style="color:#f8fafc">${safeActor}</b>.`
    : a === "reject"
    ? `تم رفض الخطوة ${waitingStepNum} من <b style="color:#f8fafc">${safeTypeAr}</b> بواسطة <b style="color:#f8fafc">${safeActor}</b>.`
    : a === "created"
    ? `تم إنشاء <b style="color:#f8fafc">${safeTypeAr}</b> بواسطة <b style="color:#f8fafc">${safeActor}</b> وهو الآن بانتظار الإجراء.`
    : `تم تحديث <b style="color:#f8fafc">${safeTypeAr}</b> بواسطة <b style="color:#f8fafc">${safeActor}</b>.`;

    const routingLine =
    a === "approve"
      ? toUserName
        ? `تم تحويل ${safeTypeAr} إلى الموظف التالي: <b style="color:#f8fafc">${safeToUser}</b>.<br/>ننتظر الإجراء على الخطوة ${waitingStepNum}.`
        : `تم تحويل ${safeTypeAr} إلى الموظف التالي.<br/>ننتظر الإجراء على الخطوة ${waitingStepNum}.`
      : a === "reject"
      ? toUserName
        ? `تم إرجاع ${safeTypeAr} إلى الموظف السابق: <b style="color:#f8fafc">${safeToUser}</b>.<br/>ننتظر الإجراء على الخطوة ${waitingStepNum}.`
        : `تم إرجاع ${safeTypeAr} إلى الموظف السابق.<br/>ننتظر الإجراء على الخطوة ${waitingStepNum}.`
      : a === "created"
      ? toUserName
        ? `تم إرسال ${safeTypeAr} إلى: <b style="color:#f8fafc">${safeToUser}</b>.<br/>ننتظر الإجراء على الخطوة 1.`
        : `تم إرسال ${safeTypeAr} إلى الموظف المعني.<br/>ننتظر الإجراء على الخطوة 1.`
      : "";

  const noteBlock = note
    ? `
      <div style="
        border:1px solid rgba(255,255,255,.10);
        background:rgba(31,41,55,.58);
        border-radius:18px;
        padding:13px 13px;
        font-family:Arial,sans-serif;
        box-shadow:0 10px 18px rgba(0,0,0,.32);
        margin-top:10px;
        text-align:right;
      ">
        <div style="font-size:11px;color:#94a3b8;font-weight:900;margin-bottom:7px">ملاحظة</div>
        <div style="font-size:13px;color:#e5e7eb;line-height:1.8">
          ${escapeHtml(note).replaceAll("\n", "<br/>")}
        </div>
      </div>
    `
    : "";

  return `
  <div style="margin:0;padding:0;background:#0b1220;direction:ltr">
    <div style="max-width:720px;margin:0 auto;padding:22px 14px">

      <!-- ================= HEADER ================= -->
      <div style="
        position:relative;
        border-radius:22px;
        overflow:hidden;
        border:1px solid rgba(255,255,255,.10);
        background:linear-gradient(to bottom,#1f2937,#1f2937 35%,#111827);
        box-shadow:0 14px 34px rgba(0,0,0,.60);
      ">
        <div style="position:relative;padding:16px 18px">
          <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
            <tr>
              <!-- LEFT -->
              <td style="width:33%;vertical-align:middle">
                <div style="font-family:Arial,sans-serif;line-height:1.15">
                  <div style="
                    font-weight:900;font-size:22px;letter-spacing:.3px;
                    background:linear-gradient(90deg,#d1d5db,#f3f4f6,#ffffff);
                    -webkit-background-clip:text;background-clip:text;color:transparent;
                  ">SPC</div>
                  <div style="font-size:11px;color:#cbd5e1;margin-top:4px">
                    Developed by SPC team
                  </div>
                </div>
              </td>

              <!-- CENTER -->
              <td style="width:34%;text-align:center;vertical-align:middle">
                <div style="
                  font-family:Arial,sans-serif;
                  font-weight:900;
                  font-size:18px;
                  letter-spacing:.2px;
                  background:linear-gradient(90deg,#e5e7eb,#f3f4f6,#ffffff);
                  -webkit-background-clip:text;background-clip:text;color:transparent;
                ">${escapeHtml(typeEn)}</div>

                <div style="font-family:Arial,sans-serif;font-size:11px;color:#cbd5e1;margin-top:5px">
                  Workflow Notification
                </div>
              </td>

              <!-- RIGHT BADGE -->
              <td style="width:33%;text-align:right;vertical-align:middle">
                <span style="
                  display:inline-block;
                  font-family:Arial,sans-serif;
                  font-size:16px;
                  font-weight:900;
                  letter-spacing:2.2px;
                  padding:12px 18px;
                  border-radius:999px;
                  border:2px solid rgba(255,255,255,.34);
                background:${
  a === "approve"
    ? "linear-gradient(135deg,#22c55e,#16a34a)"
    : a === "reject"
    ? "linear-gradient(135deg,#ef4444,#b91c1c)"
    : a === "created"
    ? "linear-gradient(135deg,#3b82f6,#1d4ed8)"
    : "linear-gradient(135deg,#94a3b8,#64748b)"
};
                  color:#ffffff;
                  white-space:nowrap;
                  text-transform:uppercase;
                  box-shadow:0 14px 28px rgba(0,0,0,.55);
                ">
                ${
                  a === "approve"
                    ? "APPROVE"
                    : a === "reject"
                    ? "REJECT"
                    : a === "created"
                    ? "CREATED"
                    : escapeHtml(actionTxt)
                }
                </span>
              </td>
            </tr>
          </table>
        </div>
      </div>

      <!-- ================= BODY ================= -->
      <div style="
        margin-top:14px;
        border-radius:22px;
        overflow:hidden;
        border:1px solid rgba(255,255,255,.08);
        background:rgba(15,23,42,.88);
        box-shadow:0 12px 30px rgba(0,0,0,.60);
      ">
        <div style="
          padding:14px 16px;
          background:rgba(31,41,55,.78);
          border-bottom:1px solid rgba(255,255,255,.06);
          font-family:Arial,sans-serif;
          color:#f3f4f6;
          font-weight:900;
          font-size:13px;
          text-align:right;
        ">
          إشعار حركة الموافقات على ${escapeHtml(typeAr)}
        </div>
<div style="padding:18px; direction:rtl; text-align:right;">
          <div style="
            text-align:right;
            font-family:Arial,sans-serif;
            font-weight:900;
            font-size:18px;
            color:#e5e7eb;
            margin:6px 2px 10px 2px;
          ">
            👋 مرحبا ${safeGreeting}
          </div>

          <div style="
            text-align:right;
            font-family:Arial,sans-serif;
            font-size:13px;
            color:#cbd5e1;
            line-height:1.95;
            margin:0 2px 14px 2px;
          ">
            ${arabicActionLine}
            <br/>
            ${showRoutingLine ? routingLine : ""}
            <br/>
          رقم المستند: <b style="color:#f8fafc">${safePlanId}</b>
            <br/>
            يمكنك مراجعة التفاصيل من خلال الزر التالي:
          </div>

          <div style="text-align:center;margin:18px 0 8px 0">
            <a href="${escapeHtml(computedUrl || "#")}" style="
              display:inline-block;
              padding:12px 24px;
              border-radius:999px;
              font-family:Arial,sans-serif;
              font-size:15px;
              font-weight:900;
              letter-spacing:.3px;
              background:linear-gradient(to bottom,#1f2937,#1f2937 40%,#111827);
              border:1px solid rgba(255,255,255,.28);
              box-shadow:0 14px 28px rgba(0,0,0,.55), inset 0 1px 0 rgba(255,255,255,.18);
              text-decoration:none;
            ">
              <span style="
                font-weight:900;
                font-size:15px;
                letter-spacing:.3px;
                background:linear-gradient(90deg,#d1d5db,#f3f4f6,#ffffff);
                -webkit-background-clip:text;background-clip:text;color:transparent;
                display:inline-block;
              ">📄 عرض التفاصيل </span>
            </a>
          </div>

          ${noteBlock}

          <div style="margin-top:14px;font-family:Arial,sans-serif;font-size:11px;color:#94a3b8;text-align:center">
            هذا الإيميل مرسل تلقائياً من النظام. الرجاء عدم الرد عليه.
          </div>
        </div>
      </div>

      <div style="margin-top:12px;text-align:center;font-family:Arial,sans-serif;color:#94a3b8;font-size:11px;line-height:1.7">
        <div style="opacity:.92;font-weight:900">SPC • Workflow System</div>
        <div style="opacity:.75">© ${new Date().getFullYear()} All rights reserved</div>
      </div>
    </div>
  </div>
  `;
}