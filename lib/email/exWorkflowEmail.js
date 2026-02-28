// /lib/exWorkflowEmail.js
import nodemailer from "nodemailer";

/* ======================= CORE (مثل workflowEmail.js) ======================= */
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

/* ======================= UTILS (نفس ستايلك) ======================= */
export function escapeHtml(str = "") {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/* ======================= TEMPLATE: APPROVE/REJECT (Payment Plan) ======================= */
/**
 * ✅ نفس روح تصميم funds (dark glass + header badge)
 *
 * - greetingName: اسم الشخص اللي راح نقوله "مرحبا ..."
 *   - للـ StepUser => greetingName = toUserName
 *   - للـ Owner/Creator => greetingName = ownerName
 * - showRoutingLine:
 *   - للـ StepUser => true (يعرض تم تحويل/تم ارجاع...)
 *   - للـ Owner/Creator => false
 *
 * ملاحظات:
 * - stepFrom/stepTo: صفر-مبني (0-based)
 */
export function buildExWorkflowActionEmailHtml({
  action,
  planId,
  pageKey,
  stepFrom,
  stepTo,
  note,
  actorName,

  greetingName = "",
  toUserName = "",
  planUrl = "",

  showRoutingLine = true,

  baseDomain = "", // اختياري إذا تريد تولّد رابط تلقائياً
}) {
  const a = String(action || "").toLowerCase();
  const actionTxt = a === "approve" ? "Approved" : a === "reject" ? "Rejected" : String(action || "Updated");

  const fromIdx = Number.isFinite(Number(stepFrom)) ? Number(stepFrom) : 0;
  const toIdx = Number.isFinite(Number(stepTo)) ? Number(stepTo) : 0;

  const computedUrl =
  String(planUrl || "").trim() ||
  (baseDomain
    ? `${String(baseDomain).replace(/\/+$/, "")}/ex/payment-plan/${encodeURIComponent(
        String(planId || "")
      )}`
    : "#");

  const actedStepNum = fromIdx + 1;
  const waitingStepNum = toIdx + 1;

  const arabicActionLine =
    a === "approve"
      ? `تمت الموافقة على الخطوة ${actedStepNum} من خطة الدفع بواسطة <b style="color:#f8fafc">${escapeHtml(
          actorName || "System"
        )}</b>.`
      : a === "reject"
      ? `تم رفض الخطوة ${actedStepNum} من خطة الدفع بواسطة <b style="color:#f8fafc">${escapeHtml(
          actorName || "System"
        )}</b>.`
      : `تم تحديث خطة الدفع بواسطة <b style="color:#f8fafc">${escapeHtml(actorName || "System")}</b>.`;

  const routingLine =
    a === "approve"
      ? toUserName
        ? `تم تحويل الخطة إلى الموظف التالي: <b style="color:#f8fafc">${escapeHtml(toUserName)}</b>.<br/>ننتظر الإجراء على الخطوة ${waitingStepNum}.`
        : `تم تحويل الخطة إلى الموظف التالي.<br/>ننتظر الإجراء على الخطوة ${waitingStepNum}.`
      : a === "reject"
      ? toUserName
        ? `تم إرجاع الخطة إلى الموظف السابق: <b style="color:#f8fafc">${escapeHtml(toUserName)}</b>.<br/>ننتظر الإجراء على الخطوة ${waitingStepNum}.`
        : `تم إرجاع الخطة إلى الموظف السابق.<br/>ننتظر الإجراء على الخطوة ${waitingStepNum}.`
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
                ">Payment Plan</div>

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
                      : "linear-gradient(135deg,#94a3b8,#64748b)"
                  };
                  color:#ffffff;
                  white-space:nowrap;
                  text-transform:uppercase;
                  box-shadow:0 14px 28px rgba(0,0,0,.55);
                ">
                  ${a === "approve" ? "APPROVE" : a === "reject" ? "REJECT" : escapeHtml(actionTxt)}
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
          إشعار حركة الموافقات على خطة الدفع
        </div>

        <div style="padding:18px">

          <div style="
            text-align:right;
            font-family:Arial,sans-serif;
            font-weight:900;
            font-size:18px;
            color:#e5e7eb;
            margin:6px 2px 10px 2px;
          ">
            👋 مرحبا ${escapeHtml(greetingName || "زميلنا")}
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
            رقم الخطة: <b style="color:#f8fafc">${escapeHtml(String(planId || ""))}</b>
            
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
              ">📄 فتح الخطة</span>
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