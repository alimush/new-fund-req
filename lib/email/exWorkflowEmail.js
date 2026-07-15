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

export async function sendWorkflowEmail({
  toEmails = [],
  subject = "",
  html = "",
  attachments = [],
}) {
  if (!Array.isArray(toEmails) || toEmails.length === 0) return { skipped: true };

  const transporter = getExTransporter();
  const from = process.env.MAIL_FROM || process.env.SMTP_FROM || process.env.SMTP_USER;

  const info = await transporter.sendMail({
    from,
    to: toEmails.join(","),
    subject,
    html,
    attachments,
  });

  return {
    skipped: false,
    messageId: info.messageId,
    accepted: info.accepted,
  };
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

export function normalizePageKey(input = "") {
  return String(input || "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\w\u0600-\u06FF-]+/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/* ======================= EMAIL TEMPLATE ======================= */
export function buildExWorkflowActionEmailHtml({
  action,
  planId,
  pageKey = "",
  stepFrom,
  stepTo,
  note,
  actorName,

  greetingName = "",
  toUserName = "",
  planUrl = "",

  showRoutingLine = true,
  showDetailsButton = true,

  baseDomain = "",
  docTitle = "",
  docTypeAr = "",

  customerName = "",
  unitNo = "",
  oldUnitNo = "",
  newUnitNo = "",
  transactionType = "",
}) {
  const a = String(action || "").toLowerCase();
  const isAttachmentOnly = String(pageKey || "").trim() === "attachment-only";

  const actionTxt =
    a === "approve"
      ? "موافق عليه"
      : a === "reject"
      ? "مرفوض"
      : a === "created"
      ? "تم الإنشاء"
      : String(action || "تم التحديث");

  const toIdx = Number.isFinite(Number(stepTo)) ? Number(stepTo) : 0;
  const safeId = String(planId || "").trim();
  const routeKey = normalizePageKey(pageKey || "");

  const computedUrl =
    String(planUrl || "").trim() ||
    (baseDomain && routeKey && safeId
      ? `${String(baseDomain).replace(/\/+$/, "")}/ex/${encodeURIComponent(
          routeKey
        )}/${encodeURIComponent(safeId)}?key=${encodeURIComponent(routeKey)}`
      : "#");

  const waitingStepNum = toIdx + 1;

  const typeAr = docTypeAr || "الطلب";
  const typeEn = String(docTitle || "").trim() || String(pageKey || "").trim() || "مستند";

  const safeActor = biDiText(actorName || "الموظف المعني", "auto");
  const safeTypeAr = biDiText(typeAr, "rtl");
  const safePlanId = biDiText(String(planId || ""), "ltr");
  const safeCustomerName = customerName ? biDiText(customerName, "rtl") : "";

  const finalUnitNo = unitNo || newUnitNo || oldUnitNo || "";

  const rowStyleLabel =
    "padding:11px 12px;color:#94a3b8;font-weight:900;width:150px;border-bottom:1px solid rgba(255,255,255,.06)";
  const rowStyleValue =
    "padding:11px 12px;color:#f8fafc;font-weight:900;border-bottom:1px solid rgba(255,255,255,.06)";

  const customerLine = safeCustomerName
    ? `
      <tr>
        <td style="${rowStyleLabel}">اسم الزبون</td>
        <td style="${rowStyleValue}">${safeCustomerName}</td>
      </tr>
    `
    : "";

  const transactionTypeLine = transactionType
    ? `
      <tr>
        <td style="${rowStyleLabel}">نوع المعاملة</td>
        <td style="${rowStyleValue}">${biDiText(transactionType, "rtl")}</td>
      </tr>
    `
    : "";

  const unitLine = finalUnitNo
    ? `
      <tr>
        <td style="${rowStyleLabel}">رقم الوحدة</td>
        <td style="${rowStyleValue}">${escapeHtml(finalUnitNo)}</td>
      </tr>
    `
    : "";

  const oldNewUnitLine =
    oldUnitNo || newUnitNo
      ? `
        ${
          oldUnitNo
            ? `
              <tr>
                <td style="${rowStyleLabel}">الوحدة القديمة</td>
                <td style="${rowStyleValue}">${escapeHtml(oldUnitNo)}</td>
              </tr>
            `
            : ""
        }
        ${
          newUnitNo
            ? `
              <tr>
                <td style="${rowStyleLabel}">الوحدة الجديدة</td>
                <td style="${rowStyleValue}">${escapeHtml(newUnitNo)}</td>
              </tr>
            `
            : ""
        }
      `
      : "";

  const formalBody = isAttachmentOnly
    ? `
      <p style="margin:0 0 12px 0;">تحية طيبة ...</p>
      <p style="margin:0 0 12px 0;">
        يرجى الاطلاع على المرفق أدناه الذي يحتوي على معاملات زبائن بدور بغداد
        ليتسنى لكم البدء بإجراءات توقيع العقد.
      </p>
      <p style="margin:0;">مع فائق الاحترام والتقدير،</p>
    `
    : a === "approve"
    ? `
      <p style="margin:0 0 12px 0;">
        تم موافقة السيد/ة <b style="color:#f8fafc">${safeActor}</b>
        على الطلب الخاص بـ <b style="color:#f8fafc">${safeTypeAr}</b>،
      راجين المباشرة باتخاذ الإجراءات اللازمة.
      </p>
      <p style="margin:0;">مع الشكر والتقدير.</p>
    `
    : a === "reject"
    ? `
      <p style="margin:0 0 12px 0;">
        نود إعلامكم بأنه تم رفض الطلب الخاص بـ
        <b style="color:#f8fafc">${safeTypeAr}</b>
        من قبل السيد/ة <b style="color:#f8fafc">${safeActor}</b>.
      </p>
      <p style="margin:0 0 12px 0;">
        يرجى الاطلاع واتخاذ ما يلزم حسب السياقات المعتمدة.
      </p>
      <p style="margin:0;">مع الشكر والتقدير.</p>
    `
    : a === "created"
    ? `
      <p style="margin:0 0 12px 0;">
        يرجى الاطلاع على الطلب المرفق الخاص بـ
        <b style="color:#f8fafc">${safeTypeAr}</b>
        والمقدم من قبل السيد/ة <b style="color:#f8fafc">${safeActor}</b>.
      </p>
      <p style="margin:0 0 12px 0;">
        راجين اتخاذ الإجراءات اللازمة.
      </p>
      <p style="margin:0;">مع الشكر والتقدير.</p>
    `
    : `
      <p style="margin:0 0 12px 0;">
        نود إعلامكم بأنه تم تحديث الطلب الخاص بـ
        <b style="color:#f8fafc">${safeTypeAr}</b>
        من قبل السيد/ة <b style="color:#f8fafc">${safeActor}</b>.
      </p>
      <p style="margin:0;">مع الشكر والتقدير.</p>
    `;

  const greetingBlock = isAttachmentOnly
    ? `السادة قسم العقود وقسم الحسابات المحترمين,`
    : `السادة المحترمون<br/>تحية طيبة،،`;

  const routingLine =
    !isAttachmentOnly && showRoutingLine && a !== "created"
      ? `
        <div style="
          margin-top:14px;
          padding:12px 14px;
          border-radius:16px;
          background:rgba(30,41,59,.65);
          border:1px solid rgba(255,255,255,.08);
          color:#cbd5e1;
          font-family:Arial,sans-serif;
          font-size:13px;
          line-height:1.8;
        ">
          تم تحويل الطلب إلى الخطوة رقم <b style="color:#f8fafc">${waitingStepNum}</b>.
        </div>
      `
      : "";

  const noteBlock = note
    ? `
      <div style="
        border:1px solid rgba(255,255,255,.10);
        background:rgba(31,41,55,.58);
        border-radius:18px;
        padding:13px;
        font-family:Arial,sans-serif;
        box-shadow:0 10px 18px rgba(0,0,0,.32);
        margin-top:16px;
        text-align:right;
      ">
        <div style="font-size:11px;color:#94a3b8;font-weight:900;margin-bottom:7px">ملاحظة</div>
        <div style="font-size:13px;color:#e5e7eb;line-height:1.8">
          ${escapeHtml(note).replaceAll("\n", "<br/>")}
        </div>
      </div>
    `
    : "";

  const shouldShowDetailsButton = !isAttachmentOnly && showDetailsButton;

  return `
  <div style="margin:0;padding:0;background:#0b1220;direction:ltr">
    <div style="max-width:720px;margin:0 auto;padding:22px 14px">

      <!-- Header -->
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
                    font-weight:900;
                    font-size:22px;
                    letter-spacing:.3px;
                    background:linear-gradient(90deg,#d1d5db,#f3f4f6,#ffffff);
                    -webkit-background-clip:text;
                    background-clip:text;
                    color:transparent;
                  ">SPC</div>
                  <div style="font-size:11px;color:#cbd5e1;margin-top:4px">
                    تم التطوير بواسطة فريق SPC
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
                  -webkit-background-clip:text;
                  background-clip:text;
                  color:transparent;
                ">${escapeHtml(typeEn)}</div>

                <div style="font-family:Arial,sans-serif;font-size:11px;color:#cbd5e1;margin-top:5px">
                  إشعار رسمي من مسار العمل
                </div>
              </td>

              <td style="width:33%;text-align:right;vertical-align:middle">
                <span style="
                  display:inline-block;
                  font-family:Arial,sans-serif;
                  font-size:14px;
                  font-weight:900;
                  letter-spacing:1.3px;
                  padding:12px 18px;
                  border-radius:999px;
                  border:2px solid rgba(255,255,255,.34);
                  background:${
                    isAttachmentOnly
                      ? "linear-gradient(135deg,#64748b,#334155)"
                      : a === "approve"
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
                    isAttachmentOnly
                      ? "مرفق"
                      : a === "approve"
                      ? "موافق عليه"
                      : a === "reject"
                      ? "مرفوض"
                      : a === "created"
                      ? "طلب جديد"
                      : escapeHtml(actionTxt)
                  }
                </span>
              </td>
            </tr>
          </table>
        </div>
      </div>

      <!-- Body -->
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
          ${isAttachmentOnly ? "إشعار رسمي بخصوص معاملة زبون" : `إشعار رسمي بخصوص ${escapeHtml(typeAr)}`}
        </div>

        <div style="padding:18px;direction:rtl;text-align:right;">
          <div style="
            font-family:Arial,sans-serif;
            font-weight:900;
            font-size:18px;
            color:#e5e7eb;
            margin:6px 2px 14px 2px;
            line-height:1.9;
          ">
            ${greetingBlock}
          </div>

          <div style="
            font-family:Arial,sans-serif;
            font-size:14px;
            color:#cbd5e1;
            line-height:2;
            margin:0 2px 14px 2px;
          ">
            ${formalBody}
          </div>

          ${routingLine}

          ${noteBlock}

          <table width="100%" cellpadding="0" cellspacing="0" style="
            margin-top:16px;
            border-collapse:separate;
            border-spacing:0;
            border-radius:16px;
            overflow:hidden;
            background:rgba(30,41,59,.55);
            border:1px solid rgba(255,255,255,.08);
            font-family:Arial,sans-serif;
            font-size:13px;
            direction:rtl;
            text-align:right;
          ">
            <tr>
              <td style="${rowStyleLabel}">رقم المستند</td>
              <td style="${rowStyleValue}">${safePlanId}</td>
            </tr>
            ${customerLine}
            ${transactionTypeLine}
            ${oldNewUnitLine || unitLine}
          </table>

          ${
            shouldShowDetailsButton
              ? `
                <div style="text-align:center;margin:22px 0 8px 0">
                  <a href="${escapeHtml(computedUrl || "#")}" style="
                    display:inline-block;
                    padding:12px 26px;
                    border-radius:999px;
                    font-family:Arial,sans-serif;
                    font-size:15px;
                    font-weight:900;
                    letter-spacing:.2px;
                    background-color:#111827 !important;
                    color:#ffffff !important;
                    -webkit-text-fill-color:#ffffff !important;
                    border:1px solid rgba(255,255,255,.28);
                    box-shadow:0 14px 28px rgba(0,0,0,.45), inset 0 1px 0 rgba(255,255,255,.16);
                    text-decoration:none;
                  ">
                    <span style="color:#ffffff !important;-webkit-text-fill-color:#ffffff !important;text-decoration:none;">
                      📄 عرض التفاصيل
                    </span>
                  </a>
                </div>
              `
              : ""
          }

          <div style="margin-top:16px;font-family:Arial,sans-serif;font-size:11px;color:#94a3b8;text-align:center">
            هذا الإيميل مرسل تلقائياً من النظام. الرجاء عدم الرد عليه.
          </div>
        </div>
      </div>

      <div style="margin-top:12px;text-align:center;font-family:Arial,sans-serif;color:#94a3b8;font-size:11px;line-height:1.7">
        <div style="opacity:.92;font-weight:900">SPC • نظام مسار العمل</div>
        <div style="opacity:.75">© ${new Date().getFullYear()} جميع الحقوق محفوظة</div>
      </div>
    </div>
  </div>
  `;
}