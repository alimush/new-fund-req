// ======================= /lib/workflowEmail.js =======================
import nodemailer from "nodemailer";

/* ======================= CORE ======================= */
export function getTransporter() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || "587");
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    throw new Error(
      "Missing SMTP env vars (SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS)"
    );
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

export async function sendWorkflowEmail({ toEmails, subject, html }) {
  if (!Array.isArray(toEmails) || toEmails.length === 0) return { skipped: true };

  const transporter = getTransporter();
  const from = process.env.MAIL_FROM || process.env.SMTP_USER;

  const info = await transporter.sendMail({
    from,
    to: toEmails.join(","),
    subject,
    html,
  });

  return { skipped: false, messageId: info.messageId };
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

/* ======================= TEMPLATE: APPROVE/REJECT ======================= */
/**
 * ✅ تحديث مهم:
 * - greetingName: اسم الشخص اللي راح نقوله "مرحبا ..."
 *   - للـ StepUser => greetingName = toUserName
 *   - للـ Requester => greetingName = createdBy
 * - showRoutingLine:
 *   - للـ StepUser => true (يعرض تم تحويل/تم ارجاع...)
 *   - للـ Requester => false
 */
export function buildWorkflowActionEmailHtml({
  action,
  requestId,
  company,
  stepFrom,
  stepTo,
  note,
  actorName,

  greetingName = "",      // ✅ بديل requesterName القديم
  toUserName = "",
  requestUrl = "",

  showRoutingLine = true, // ✅ NEW

  baseDomain = "https://funds-gdr.spc-it.com.iq",
}) {
  const actionTxt =
    action === "approve" ? "Approved" : action === "reject" ? "Rejected" : String(action);

  const fromIdx = Number.isFinite(Number(stepFrom)) ? Number(stepFrom) : 0;
  const toIdx = Number.isFinite(Number(stepTo)) ? Number(stepTo) : 0;

  const computedUrl =
    requestUrl?.trim() ||
    `${String(baseDomain).replace(/\/+$/, "")}/requests/${encodeURIComponent(
      company || ""
    )}/${encodeURIComponent(requestId || "")}`;

  const actedStepNum = fromIdx + 1;
  const waitingStepNum = toIdx + 1;

  const arabicActionLine =
    action === "approve"
      ? `تمت الموافقة على الخطوة ${actedStepNum} من طلب التمويل بواسطة <b style="color:#f8fafc">${escapeHtml(
          actorName || "System"
        )}</b>.`
      : action === "reject"
      ? `تم رفض الخطوة ${actedStepNum} من طلب التمويل بواسطة <b style="color:#f8fafc">${escapeHtml(
          actorName || "System"
        )}</b>.`
      : `تم تحديث طلب التمويل بواسطة <b style="color:#f8fafc">${escapeHtml(
          actorName || "System"
        )}</b>.`;

  // ✅ routingLine يظهر فقط للـ StepUser (showRoutingLine=true)
  const routingLine =
    action === "approve"
      ? toUserName
        ? `تم تحويل الطلب إلى الموظف التالي: <b style="color:#f8fafc">${escapeHtml(
            toUserName
          )}</b>. <br/>ننتظر الموافقة أو الرفض على الخطوة ${waitingStepNum}.`
        : `تم تحويل الطلب إلى الموظف التالي. <br/>ننتظر الموافقة أو الرفض على الخطوة ${waitingStepNum}.`
      : action === "reject"
      ? toUserName
        ? `تم إرجاع الطلب إلى الموظف السابق: <b style="color:#f8fafc">${escapeHtml(
            toUserName
          )}</b>. <br/>ننتظر الموافقة أو الرفض على الخطوة ${waitingStepNum}.`
        : `تم إرجاع الطلب إلى الموظف السابق. <br/>ننتظر الموافقة أو الرفض على الخطوة ${waitingStepNum}.`
      : "";

  return `
  <div style="margin:0;padding:0;background:#0b1220;direction:ltr">
    <div style="max-width:720px;margin:0 auto;padding:22px 14px">

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

              <td style="width:34%;text-align:center;vertical-align:middle">
                <div style="
                  font-family:Arial,sans-serif;
                  font-weight:900;
                  font-size:18px;
                  letter-spacing:.2px;
                  background:linear-gradient(90deg,#e5e7eb,#f3f4f6,#ffffff);
                  -webkit-background-clip:text;background-clip:text;color:transparent;
                ">Fund Request</div>

                <div style="font-family:Arial,sans-serif;font-size:11px;color:#cbd5e1;margin-top:5px">
                  Workflow Notification
                </div>
              </td>

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
                    action === "approve"
                      ? "linear-gradient(135deg,#22c55e,#16a34a)"
                      : action === "reject"
                      ? "linear-gradient(135deg,#ef4444,#b91c1c)"
                      : "linear-gradient(135deg,#94a3b8,#64748b)"
                  };
                  color:#ffffff;
                  white-space:nowrap;
                  text-transform:uppercase;
                  box-shadow:0 14px 28px rgba(0,0,0,.55);
                ">
                  ${action === "approve" ? "APPROVE" : action === "reject" ? "REJECT" : escapeHtml(actionTxt)}
                </span>
              </td>
            </tr>
          </table>
        </div>
      </div>

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
          إشعار حركة الموافقات على طلب التمويل
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
            يمكنك مراجعة طلب التمويل من خلال الزر التالي:
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
              ">📋 عرض التفاصيل</span>
            </a>
          </div>

          ${
            note
              ? `
              <div style="
                border:1px solid rgba(255,255,255,.10);
                background:rgba(31,41,55,.58);
                border-radius:18px;
                padding:13px 13px;
                font-family:Arial,sans-serif;
                box-shadow:0 10px 18px rgba(0,0,0,.32);
                margin-top:6px;
                text-align:right;
              ">
                <div style="font-size:11px;color:#94a3b8;font-weight:900;margin-bottom:7px">ملاحظة</div>
                <div style="font-size:13px;color:#e5e7eb;line-height:1.8">
                  ${escapeHtml(note).replaceAll("\n", "<br/>")}
                </div>
              </div>
            `
              : ""
          }

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

/* ======================= TEMPLATE: CREATED (STEP 1) ======================= */
/**
 * ✅ هذا للإيميل اللي يروح مباشرة بعد إنشاء الطلب للستيب الأول
 * - greetingName = stepUserName
 * - يحتوي على "تم إنشاء الطلب بواسطة createdBy" + التفاصيل + زر عرض التفاصيل
 */
export function buildRequestCreatedEmailHtml({
    requestId,
    company,
    createdBy,
    greetingName = "زميلنا",
    requestCode,
    requestType,
    currency,
    department,
    description,
    totalAmount,
    baseDomain = "https://funds-gdr.spc-it.com.iq",
  }) {
    const computedUrl = `${String(baseDomain).replace(/\/+$/, "")}/requests/${encodeURIComponent(
      company || ""
    )}/${encodeURIComponent(requestId || "")}`;
  
    const safe = (v) => escapeHtml(v ?? "");
  
    return `
    <div style="margin:0;padding:0;background:#0b1220;direction:ltr">
      <div style="max-width:720px;margin:0 auto;padding:22px 14px">
  
        <!-- ================= HEADER (UPDATED like approve/reject layout) ================= -->
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
  
                <td style="width:34%;text-align:center;vertical-align:middle">
                  <div style="
                    font-family:Arial,sans-serif;
                    font-weight:900;
                    font-size:18px;
                    letter-spacing:.2px;
                    background:linear-gradient(90deg,#e5e7eb,#f3f4f6,#ffffff);
                    -webkit-background-clip:text;background-clip:text;color:transparent;
                  ">Fund Request</div>
  
                  <div style="font-family:Arial,sans-serif;font-size:11px;color:#cbd5e1;margin-top:5px">
                    Workflow Notification
                  </div>
                </td>
  
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
                    background:linear-gradient(135deg,#60a5fa,#2563eb);
                    color:#ffffff;
                    white-space:nowrap;
                    text-transform:uppercase;
                    box-shadow:0 14px 28px rgba(0,0,0,.55);
                  ">
                    CREATED
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
          padding:20px;
          font-family:Arial,sans-serif;
        ">
  
          <!-- Greeting -->
          <div style="text-align:right;color:#e5e7eb;font-weight:900;font-size:18px;margin-bottom:10px">
            👋 مرحبا ${safe(greetingName)}
          </div>
  
          <!-- Message -->
          <div style="text-align:right;color:#cbd5e1;font-size:14px;line-height:1.9;margin-bottom:16px">
            ✅ تم إنشاء طلب تمويل جديد بواسطة
            <b style="color:#f8fafc">${safe(createdBy || "Unknown")}</b>.
            <br/>
            يمكنك مراجعة التفاصيل من خلال الزر التالي:
          </div>
  
          <!-- Button -->
          <div style="text-align:center;margin:20px 0 14px 0">
            <a href="${safe(computedUrl)}" style="
              display:inline-block;
              padding:14px 28px;
              border-radius:999px;
              font-size:15px;
              font-weight:900;
              background:linear-gradient(to bottom,#1f2937,#1f2937 40%,#111827);
              border:1px solid rgba(255,255,255,.28);
              box-shadow:0 14px 28px rgba(0,0,0,.55), inset 0 1px 0 rgba(255,255,255,.18);
              text-decoration:none;
            ">
              <span style="
                background:linear-gradient(90deg,#d1d5db,#f3f4f6,#ffffff);
                -webkit-background-clip:text;
                background-clip:text;
                color:transparent;
                font-weight:900;
              ">📋 عرض التفاصيل</span>
            </a>
          </div>
  
          <!-- Info Table -->
          <table width="100%" cellpadding="0" cellspacing="0"
            style="border-collapse:separate;border-spacing:12px 12px;margin-top:10px">
  
            <tr>
              <td style="width:50%">
                <div style="border:1px solid rgba(255,255,255,.10);
                  background:rgba(31,41,55,.58);
                  border-radius:18px;
                  padding:14px">
                  <div style="font-size:11px;color:#94a3b8;font-weight:900;margin-bottom:6px">
                    Request Code
                  </div>
                  <div style="font-size:14px;color:#f8fafc;font-weight:900">
                    ${safe(requestCode || requestId)}
                  </div>
                </div>
              </td>
  
              <td style="width:50%">
                <div style="border:1px solid rgba(255,255,255,.10);
                  background:rgba(31,41,55,.58);
                  border-radius:18px;
                  padding:14px">
                  <div style="font-size:11px;color:#94a3b8;font-weight:900;margin-bottom:6px">
                    Company
                  </div>
                  <div style="font-size:14px;color:#f8fafc;font-weight:900">
                    ${safe(company)}
                  </div>
                </div>
              </td>
            </tr>
  
            <tr>
              <td style="width:50%">
                <div style="border:1px solid rgba(255,255,255,.10);
                  background:rgba(31,41,55,.58);
                  border-radius:18px;
                  padding:14px">
                  <div style="font-size:11px;color:#94a3b8;font-weight:900;margin-bottom:6px">
                    Type
                  </div>
                  <div style="font-size:14px;color:#f8fafc;font-weight:900">
                    ${safe(requestType)}
                  </div>
                </div>
              </td>
  
              <td style="width:50%">
                <div style="border:1px solid rgba(255,255,255,.10);
                  background:rgba(31,41,55,.58);
                  border-radius:18px;
                  padding:14px">
                  <div style="font-size:11px;color:#94a3b8;font-weight:900;margin-bottom:6px">
                    Department
                  </div>
                  <div style="font-size:14px;color:#f8fafc;font-weight:900">
                    ${safe(department)}
                  </div>
                </div>
              </td>
            </tr>
  
            <tr>
              <td style="width:50%">
                <div style="border:1px solid rgba(255,255,255,.10);
                  background:rgba(31,41,55,.58);
                  border-radius:18px;
                  padding:14px">
                  <div style="font-size:11px;color:#94a3b8;font-weight:900;margin-bottom:6px">
                    Currency
                  </div>
                  <div style="font-size:14px;color:#f8fafc;font-weight:900">
                    ${safe(currency)}
                  </div>
                </div>
              </td>
  
              <td style="width:50%">
                <div style="border:1px solid rgba(255,255,255,.10);
                  background:rgba(31,41,55,.58);
                  border-radius:18px;
                  padding:14px">
                  <div style="font-size:11px;color:#94a3b8;font-weight:900;margin-bottom:6px">
                    Total Amount
                  </div>
                  <div style="font-size:14px;color:#f8fafc;font-weight:900">
                    ${safe(totalAmount)}
                  </div>
                </div>
              </td>
            </tr>
          </table>
  
          ${
            description
              ? `
              <div style="
                margin-top:14px;
                border:1px solid rgba(255,255,255,.10);
                background:rgba(31,41,55,.58);
                border-radius:18px;
                padding:14px;
                text-align:right">
                <div style="font-size:11px;color:#94a3b8;font-weight:900;margin-bottom:6px">
                  Description
                </div>
                <div style="font-size:13px;color:#e5e7eb;line-height:1.8">
                  ${safe(description).replaceAll("\n","<br/>")}
                </div>
              </div>
            `
              : ""
          }
  
          <div style="margin-top:16px;font-size:11px;color:#94a3b8;text-align:center">
            هذا الإيميل مرسل تلقائياً من النظام. الرجاء عدم الرد عليه.
          </div>
  
        </div>
      </div>
    </div>
  `;}

/* ======================= TEMPLATE: VOUCHER DELEGATION ======================= */
export function buildVoucherDelegationEmailHtml({
  requestId,
  company,
  requestCode = "",
  requestType = "",
  description = "",
  delegatedByName = "",
  greetingName = "زميلنا",
  requestUrl = "",
  baseDomain = "https://funds-gdr.spc-it.com.iq",
}) {
  const computedUrl =
    requestUrl?.trim() ||
    `${String(baseDomain).replace(/\/+$/, "")}/requests/${encodeURIComponent(
      company || ""
    )}/${encodeURIComponent(requestId || "")}`;

  const safe = (v) => escapeHtml(v ?? "");

  return `
  <div style="margin:0;padding:0;background:#0b1220;direction:ltr">
    <div style="max-width:720px;margin:0 auto;padding:22px 14px">
      <div style="
        position:relative;border-radius:22px;overflow:hidden;
        border:1px solid rgba(255,255,255,.10);
        background:linear-gradient(to bottom,#1f2937,#1f2937 35%,#111827);
        box-shadow:0 14px 34px rgba(0,0,0,.60);
      ">
        <div style="position:relative;padding:16px 18px">
          <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
            <tr>
              <td style="width:33%;vertical-align:middle">
                <div style="font-family:Arial,sans-serif;font-weight:900;font-size:22px;color:#f3f4f6">SPC</div>
              </td>
              <td style="width:34%;text-align:center;vertical-align:middle">
                <div style="font-family:Arial,sans-serif;font-weight:900;font-size:18px;color:#f3f4f6">Fund Request</div>
                <div style="font-family:Arial,sans-serif;font-size:11px;color:#cbd5e1;margin-top:5px">تخويل صرف</div>
              </td>
              <td style="width:33%;text-align:right;vertical-align:middle">
                <span style="
                  display:inline-block;font-family:Arial,sans-serif;font-size:14px;font-weight:900;
                  padding:12px 16px;border-radius:999px;border:2px solid rgba(255,255,255,.34);
                  background:linear-gradient(135deg,#10b981,#059669);color:#fff;
                  box-shadow:0 14px 28px rgba(0,0,0,.55);
                ">تخويل</span>
              </td>
            </tr>
          </table>
        </div>
      </div>

      <div style="
        margin-top:14px;border-radius:22px;overflow:hidden;
        border:1px solid rgba(255,255,255,.08);background:rgba(15,23,42,.88);
        box-shadow:0 12px 30px rgba(0,0,0,.60);padding:20px;font-family:Arial,sans-serif;
      ">
        <div style="text-align:right;color:#e5e7eb;font-weight:900;font-size:18px;margin-bottom:10px">
          👋 مرحبا ${safe(greetingName)}
        </div>

        <div style="text-align:right;color:#cbd5e1;font-size:14px;line-height:1.9;margin-bottom:16px">
          تم <b style="color:#f8fafc">تخويلك</b> لإجراء <b style="color:#f8fafc">صرف الطلب ورفع الوصل</b>
          بواسطة <b style="color:#f8fafc">${safe(delegatedByName || "—")}</b>.
          <br/>
          الرجاء مراجعة الطلب وإتمام إجراء الصرف من النظام.
        </div>

        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;border-spacing:10px 10px;margin-bottom:14px">
          <tr>
            <td style="width:50%">
              <div style="border:1px solid rgba(255,255,255,.10);background:rgba(31,41,55,.58);border-radius:14px;padding:12px;text-align:right">
                <div style="font-size:11px;color:#94a3b8;font-weight:900">كود الطلب</div>
                <div style="font-size:14px;color:#f8fafc;font-weight:900">${safe(requestCode || requestId)}</div>
              </div>
            </td>
            <td style="width:50%">
              <div style="border:1px solid rgba(255,255,255,.10);background:rgba(31,41,55,.58);border-radius:14px;padding:12px;text-align:right">
                <div style="font-size:11px;color:#94a3b8;font-weight:900">الشركة</div>
                <div style="font-size:14px;color:#f8fafc;font-weight:900">${safe(company)}</div>
              </div>
            </td>
          </tr>
          ${
            requestType
              ? `<tr><td colspan="2">
              <div style="border:1px solid rgba(255,255,255,.10);background:rgba(31,41,55,.58);border-radius:14px;padding:12px;text-align:right">
                <div style="font-size:11px;color:#94a3b8;font-weight:900">نوع الطلب</div>
                <div style="font-size:14px;color:#f8fafc;font-weight:900">${safe(requestType)}</div>
              </div>
            </td></tr>`
              : ""
          }
        </table>

        ${
          description
            ? `<div style="border:1px solid rgba(255,255,255,.10);background:rgba(31,41,55,.58);border-radius:14px;padding:12px;text-align:right;margin-bottom:14px">
              <div style="font-size:11px;color:#94a3b8;font-weight:900;margin-bottom:6px">الوصف</div>
              <div style="font-size:13px;color:#e5e7eb;line-height:1.8">${safe(description).replaceAll("\n", "<br/>")}</div>
            </div>`
            : ""
        }

        <div style="text-align:center;margin:18px 0 8px 0">
          <a href="${safe(computedUrl)}" style="
            display:inline-block;padding:14px 28px;border-radius:999px;font-size:15px;font-weight:900;
            background:linear-gradient(to bottom,#1f2937,#111827);border:1px solid rgba(255,255,255,.28);
            text-decoration:none;color:#f3f4f6;
          ">📋 فتح الطلب</a>
        </div>

        <div style="margin-top:14px;font-size:11px;color:#94a3b8;text-align:center">
          هذا الإيميل مرسل تلقائياً من النظام. الرجاء عدم الرد عليه.
        </div>
      </div>
    </div>
  </div>
  `;
}