import { readFileSync, writeFileSync, existsSync } from "fs";
import { dirname, join, extname } from "path";
import { fileURLToPath } from "url";
import HTMLtoDOCX from "html-to-docx";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const docsDir = join(root, "docs");
const outPath = join(docsDir, "دليل-طلب-التمويل.docx");

const MIME_BY_EXT = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

const BADGE = {
  pending: { icon: "⏱", iconBg: "#fffbeb", iconColor: "#d97706", ring: "#fcd34d", label: "قيد الانتظار" },
  approved: { icon: "✓", iconBg: "#ecfdf5", iconColor: "#059669", ring: "#86efac", label: "موافق" },
  rejected: { icon: "✕", iconBg: "#fef2f2", iconColor: "#dc2626", ring: "#fca5a5", label: "مرفوض" },
  cancelled: { icon: "—", iconBg: "#f1f5f9", iconColor: "#64748b", ring: "#cbd5e1", label: "ملغي" },
};

const WORD_CSS = `
  body {
    font-family: Tahoma, Arial, sans-serif;
    direction: rtl;
    text-align: right;
    font-size: 10.5pt;
    line-height: 1.65;
    color: #334155;
    margin: 0;
    padding: 4px 6px 20px;
    background: #eef2ff;
  }
  p { margin: 0 0 8px; font-weight: 600; color: #334155; }
  ul, ol { margin: 6px 0 10px; padding-right: 20px; font-weight: 600; color: #334155; }
  li { margin-bottom: 4px; }
  h1 { margin: 0 0 8px; font-size: 22pt; font-weight: 900; color: #0f172a; text-align: center; }
  h3 { font-size: 11pt; font-weight: 800; color: #1d4ed8; margin: 12px 0 6px; }
  .page-break { page-break-before: always; height: 0; margin: 0; padding: 0; }
  .note { font-size: 9.5pt; color: #64748b; font-weight: 600; }
  .section-card {
    background: #ffffff;
    border: 1px solid #e2e8f0;
    padding: 16px 18px;
    margin-bottom: 14px;
  }
  .cover-card {
    background: #ffffff;
    border: 1px solid #e2e8f0;
    padding: 36px 28px 40px;
    text-align: center;
    margin-bottom: 16px;
  }
  .app-header {
    background: #0f172a;
    padding: 16px 20px 14px;
    text-align: center;
    margin-bottom: 16px;
  }
  .shot-frame {
    background: #f1f5f9;
    border: 1px solid #e2e8f0;
    padding: 12px;
    text-align: center;
    margin: 10px 0 6px;
  }
  .shot-caption {
    background: #f8fafc;
    border: 1px solid #cbd5e1;
    padding: 8px 12px;
    font-size: 8pt;
    color: #334155;
    margin-top: 8px;
  }
  .email-box {
    background: #eff6ff;
    border: 1px solid #bfdbfe;
    padding: 12px 14px;
    margin-bottom: 10px;
  }
  .focus-box {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    padding: 12px 14px;
    margin-top: 10px;
  }
  .doc-footer {
    text-align: center;
    font-size: 8.5pt;
    font-weight: 700;
    color: #94a3b8;
    margin-top: 18px;
    padding-top: 10px;
    border-top: 1px dashed #cbd5e1;
  }
`;

function inlineLocalImages(html, baseDir) {
  return html.replace(
    /(<img\b[^>]*\bsrc=")([^"]+)(")/gi,
    (match, prefix, src, suffix) => {
      if (/^(https?:|data:)/i.test(src)) return match;
      const filePath = join(baseDir, src);
      if (!existsSync(filePath)) {
        console.warn(`⚠️  Image not found: ${src}`);
        return match;
      }
      const ext = extname(filePath).toLowerCase();
      const mime = MIME_BY_EXT[ext] || "application/octet-stream";
      const data = readFileSync(filePath).toString("base64");
      return `${prefix}data:${mime};base64,${data}${suffix}`;
    }
  );
}

function badge(type) {
  const b = BADGE[type];
  return `<span style="display:inline-block;border:1px solid ${b.ring};background:#ffffff;padding:2px 8px 2px 4px;vertical-align:middle;white-space:nowrap;">
    <span style="display:inline-block;width:20px;height:20px;line-height:20px;text-align:center;background:${b.iconBg};border:1px solid #e2e8f0;color:${b.iconColor};font-size:9pt;font-weight:900;vertical-align:middle;">${b.icon}</span>
    <span style="font-size:8.5pt;font-weight:800;color:#1e293b;vertical-align:middle;margin-right:4px;">${b.label}</span>
  </span>`;
}

function sectionTitle(icon, title) {
  return `<p style="margin-bottom:10px;font-size:13pt;font-weight:800;color:#0f172a;">
    <span style="display:inline-block;width:28px;height:28px;line-height:28px;text-align:center;background:#ffffff;border:1px solid #e2e8f0;font-size:12pt;vertical-align:middle;">${icon}</span>
    <span style="vertical-align:middle;margin-right:8px;">${title}</span>
  </p>`;
}

function sectionCard(content) {
  return `<div class="section-card">${content}</div>`;
}

function appHeader() {
  return `<div class="app-header">
    <img src="spc-logo.jpg" alt="SPC" style="height:34px;background:#ffffff;padding:3px 7px;border:1px solid #e2e8f0;vertical-align:middle;" />
    <span style="display:inline-block;width:1px;height:32px;background:#64748b;margin:0 12px;vertical-align:middle;">&nbsp;</span>
    <span style="display:inline-block;text-align:right;vertical-align:middle;">
      <span style="display:block;font-size:9pt;font-weight:800;color:#e2e8f0;letter-spacing:0.06em;">FUND REQUEST</span>
      <span style="display:block;font-size:8pt;font-weight:700;color:#94a3b8;">دليل الاستخدام</span>
    </span>
    <p style="margin:10px 0 0;text-align:center;">
      <span style="display:inline-block;width:56px;height:2px;background:#6366f1;">&nbsp;</span>
    </p>
  </div>`;
}

function coverHero() {
  return `<div class="cover-card">
    <p style="font-size:9pt;font-weight:700;color:#2563eb;letter-spacing:0.06em;margin-bottom:6px;">دليل الاستخدام</p>
    <h1>طلب التمويل</h1>
    <p style="font-size:11pt;font-weight:600;color:#64748b;max-width:480px;margin:0 auto;">
      شرح مبسّط لآلية تقديم طلبات الصرف، الموافقات، والمتابعة داخل نظام إدارة طلبات التمويل
    </p>
  </div>`;
}

function dataTable(rows) {
  const body = rows
    .map(([a, b]) => `<tr>
      <td style="padding:7px 10px;border-bottom:1px solid #f1f5f9;font-weight:600;color:#475569;">${a}</td>
      <td style="padding:7px 10px;border-bottom:1px solid #f1f5f9;font-weight:600;color:#475569;">${b}</td>
    </tr>`)
    .join("");

  return `<table cellpadding="0" cellspacing="0" width="100%" style="margin:8px 0 4px;border-collapse:collapse;font-size:10pt;">
    <thead>
      <tr>
        <th style="background:#ffffff;color:#0f172a;font-weight:800;text-align:right;padding:8px 10px;border-bottom:1px solid #e2e8f0;font-size:9.5pt;">الحقل</th>
        <th style="background:#ffffff;color:#0f172a;font-weight:800;text-align:right;padding:8px 10px;border-bottom:1px solid #e2e8f0;font-size:9.5pt;">الوصف</th>
      </tr>
    </thead>
    <tbody>${body}</tbody>
  </table>`;
}

function dataTableCustom(headers, rows) {
  const head = headers
    .map((h) => `<th style="background:#ffffff;color:#0f172a;font-weight:800;text-align:right;padding:8px 10px;border-bottom:1px solid #e2e8f0;font-size:9.5pt;">${h}</th>`)
    .join("");
  const body = rows
    .map((row) => `<tr>${row.map((c) => `<td style="padding:7px 10px;border-bottom:1px solid #f1f5f9;font-weight:600;color:#475569;vertical-align:top;">${c}</td>`).join("")}</tr>`)
    .join("");

  return `<table cellpadding="0" cellspacing="0" width="100%" style="margin:8px 0 4px;border-collapse:collapse;font-size:10pt;">
    <thead><tr>${head}</tr></thead>
    <tbody>${body}</tbody>
  </table>`;
}

function flowSteps() {
  const steps = [
    ["①", "إنشاء الطلب"],
    ["②", "الموافقات"],
    ["③", "الاعتماد"],
    ["④", "الصرف"],
  ];

  const cells = [];
  steps.forEach((step, i) => {
    cells.push(`<td style="width:22%;text-align:center;vertical-align:middle;padding:4px;background:#ffffff;border:1px solid #e2e8f0;">
      <div style="font-size:8pt;font-weight:800;color:#3b82f6;margin-bottom:2px;">${step[0]}</div>
      <div style="font-size:9.5pt;font-weight:800;color:#1e293b;">${step[1]}</div>
    </td>`);
    if (i < steps.length - 1) {
      cells.push(`<td style="width:3%;text-align:center;vertical-align:middle;color:#94a3b8;font-size:14pt;font-weight:800;">←</td>`);
    }
  });

  return `<table cellpadding="0" cellspacing="0" width="100%" style="margin:12px 0 4px;border-collapse:collapse;"><tr>${cells.join("")}</tr></table>`;
}

function kpiRow3(items) {
  const cells = items
    .map(
      ([label, value]) => `<td style="width:33%;padding:4px;vertical-align:top;background:#ffffff;border:1px solid #e2e8f0;">
        <div style="font-size:8.5pt;font-weight:700;color:#64748b;">${label}</div>
        <div style="font-size:10pt;font-weight:800;color:#0f172a;margin-top:2px;">${value}</div>
      </td>`
    )
    .join("");

  return `<table cellpadding="0" cellspacing="0" width="100%" style="margin:10px 0 4px;border-collapse:collapse;"><tr>${cells}</tr></table>`;
}

function shotBlock(title, icon, src, alt, captionItems) {
  const caption = captionItems.map((item) => `<li>${item}</li>`).join("");

  return sectionCard(`
    ${sectionTitle(icon, title)}
    <div class="shot-frame">
      <img src="${src}" alt="${alt}" width="520" style="max-width:100%;border:1px solid #cbd5e1;background:#ffffff;" />
    </div>
    <div class="shot-caption">
      <strong style="display:block;margin-bottom:4px;font-size:8.5pt;color:#1e293b;">وصف الصورة:</strong>
      <ul style="margin:0;padding-right:18px;font-size:8pt;line-height:1.55;">${caption}</ul>
    </div>
  `);
}

function reportFocus(title, items, extra = "") {
  const list = items.map((item) => `<li>${item}</li>`).join("");
  return `<div class="focus-box">
    <h3 style="margin-top:0;font-size:10.5pt;">${title}</h3>
    <ul>${list}</ul>
    ${extra}
  </div>`;
}

function reportsUI() {
  const kpi = (icon, iconColor, bg, label, value) =>
    `<td style="width:25%;padding:3px;vertical-align:top;">
      <table cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;">
        <tr>
          <td style="background:rgba(255,255,255,0.95);border:1px solid #e2e8f0;padding:9px 8px;">
            <table cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
              <tr>
                <td style="width:32px;height:32px;text-align:center;vertical-align:middle;background:#ffffff;border:1px solid #e2e8f0;color:${iconColor};font-size:11pt;">${icon}</td>
                <td style="padding-right:7px;vertical-align:middle;">
                  <div style="font-size:7pt;font-weight:800;color:#64748b;">${label}</div>
                  <div style="font-size:11pt;font-weight:900;color:#0f172a;">${value}</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </td>`;

  const filterField = (label, value) =>
    `<td style="width:25%;padding:3px;vertical-align:top;">
      <div style="font-size:7pt;font-weight:900;color:#475569;margin-bottom:3px;">${label}</div>
      <table cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;">
        <tr><td style="height:28px;background:#ffffff;border:1px solid #e5e7eb;padding:0 8px;font-size:7pt;font-weight:800;color:#64748b;text-align:right;">${value}</td></tr>
      </table>
    </td>`;

  return `<table cellpadding="0" cellspacing="0" width="100%" style="margin:10px 0;border-collapse:collapse;">
    <tr>
      <td style="background:linear-gradient(145deg,#f1f5f9,#eef2ff);border:1px solid #e2e8f0;padding:12px;">
        <table cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:10px;border-collapse:collapse;">
          <tr>
            <td style="background:#ffffff;border:1px solid #e2e8f0;padding:14px 16px;">
              <table cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;">
                <tr>
                  <td style="text-align:left;vertical-align:top;">
                    <span style="display:inline-block;padding:5px 10px;background:#ecfdf5;color:#065f46;border:1px solid #a7f3d0;font-size:7.5pt;font-weight:900;">Excel</span>
                    <span style="display:inline-block;padding:5px 10px;background:#f8fafc;color:#334155;border:1px solid #e2e8f0;font-size:7.5pt;font-weight:900;margin-right:4px;">مسح الفلاتر</span>
                    <span style="display:inline-block;padding:5px 10px;background:#2563eb;color:#ffffff;border:1px solid #2563eb;font-size:7.5pt;font-weight:900;margin-right:4px;">بحث</span>
                  </td>
                  <td style="text-align:right;vertical-align:top;">
                    <div style="font-size:7.5pt;font-weight:800;color:#2563eb;letter-spacing:0.08em;">التقارير</div>
                    <div style="font-size:13pt;font-weight:900;color:#0f172a;">📚 تقارير الطلبات</div>
                    <div style="font-size:8pt;font-weight:700;color:#64748b;margin-top:3px;">فلترة ومتابعة الطلبات حسب الصلاحيات</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>

        <table cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:10px;border-collapse:collapse;">
          <tr>
            ${kpi("📚", "#4f46e5", "#eef2ff", "المجموع", "48")}
            ${kpi("✓", "#059669", "#ecfdf5", "مقبول", "12")}
            ${kpi("⏱", "#d97706", "#fffbeb", "قيد الانتظار", "22")}
            ${kpi("✕", "#dc2626", "#fef2f2", "مرفوض", "8")}
          </tr>
        </table>

        <table cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:10px;border-collapse:collapse;">
          <tr>
            <td style="background:#ffffff;border:1px solid #e2e8f0;padding:12px;">
              <div style="font-size:9pt;font-weight:900;color:#0f172a;margin-bottom:8px;text-align:right;">🛡 الفلاتر</div>
              <table cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;">
                <tr>
                  ${filterField("الشركة", "كل الشركات")}
                  ${filterField("مقدم الطلب", "كل المستخدمين")}
                  ${filterField("الحالة", "كل الحالات")}
                  ${filterField("العملة", "كل العملات")}
                </tr>
                <tr>
                  ${filterField("قيد الانتظار عند", "الكل")}
                  ${filterField("From", "—")}
                  ${filterField("To", "—")}
                  ${filterField("بحث موحّد", "كود أو وصف أو مبلغ...")}
                </tr>
              </table>
            </td>
          </tr>
        </table>

        <table cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;">
          <tr>
            <td style="background:#ffffff;border:1px solid #e2e8f0;padding:0;">
              <table cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;font-size:7pt;font-weight:800;">
                <thead>
                  <tr>
                    ${["الشركة", "كود الطلب", "نوع الطلب", "مقدم الطلب", "الحالة", "قيد الانتظار عند", "المبلغ", "التاريخ"]
                      .map((h) => `<th style="background:#ffffff;color:#0f172a;padding:7px 4px;border-bottom:1px solid #e2e8f0;text-align:right;font-size:6.8pt;font-weight:900;">${h}</th>`)
                      .join("")}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style="padding:6px 4px;border-bottom:1px solid #f1f5f9;">شركة ١</td>
                    <td style="padding:6px 4px;border-bottom:1px solid #f1f5f9;font-family:monospace;font-size:6.5pt;">REQ-2401</td>
                    <td style="padding:6px 4px;border-bottom:1px solid #f1f5f9;">مشتريات</td>
                    <td style="padding:6px 4px;border-bottom:1px solid #f1f5f9;">مستخدم ٢</td>
                    <td style="padding:6px 4px;border-bottom:1px solid #f1f5f9;">${badge("pending")}</td>
                    <td style="padding:6px 4px;border-bottom:1px solid #f1f5f9;">معتمد ١</td>
                    <td style="padding:6px 4px;border-bottom:1px solid #f1f5f9;">3,500,000</td>
                    <td style="padding:6px 4px;border-bottom:1px solid #f1f5f9;">15/01/2026</td>
                  </tr>
                  <tr>
                    <td style="padding:6px 4px;border-bottom:1px solid #f1f5f9;background:#f8fafc;">شركة ٢</td>
                    <td style="padding:6px 4px;border-bottom:1px solid #f1f5f9;background:#f8fafc;font-family:monospace;font-size:6.5pt;">REQ-2398</td>
                    <td style="padding:6px 4px;border-bottom:1px solid #f1f5f9;background:#f8fafc;">تشغيل</td>
                    <td style="padding:6px 4px;border-bottom:1px solid #f1f5f9;background:#f8fafc;">مستخدم ٣</td>
                    <td style="padding:6px 4px;border-bottom:1px solid #f1f5f9;background:#f8fafc;">${badge("pending")}</td>
                    <td style="padding:6px 4px;border-bottom:1px solid #f1f5f9;background:#f8fafc;">معتمد ٢</td>
                    <td style="padding:6px 4px;border-bottom:1px solid #f1f5f9;background:#f8fafc;">1,200,000</td>
                    <td style="padding:6px 4px;border-bottom:1px solid #f1f5f9;background:#f8fafc;">12/01/2026</td>
                  </tr>
                  <tr>
                    <td style="padding:6px 4px;border-bottom:1px solid #f1f5f9;">شركة ١</td>
                    <td style="padding:6px 4px;border-bottom:1px solid #f1f5f9;font-family:monospace;font-size:6.5pt;">REQ-2385</td>
                    <td style="padding:6px 4px;border-bottom:1px solid #f1f5f9;">مشاريع</td>
                    <td style="padding:6px 4px;border-bottom:1px solid #f1f5f9;">مستخدم ٤</td>
                    <td style="padding:6px 4px;border-bottom:1px solid #f1f5f9;">${badge("approved")}</td>
                    <td style="padding:6px 4px;border-bottom:1px solid #f1f5f9;">—</td>
                    <td style="padding:6px 4px;border-bottom:1px solid #f1f5f9;">8,750,000</td>
                    <td style="padding:6px 4px;border-bottom:1px solid #f1f5f9;">05/01/2026</td>
                  </tr>
                  <tr>
                    <td style="padding:6px 4px;border-bottom:1px solid #f1f5f9;background:#f8fafc;">شركة ٣</td>
                    <td style="padding:6px 4px;border-bottom:1px solid #f1f5f9;background:#f8fafc;font-family:monospace;font-size:6.5pt;">REQ-2372</td>
                    <td style="padding:6px 4px;border-bottom:1px solid #f1f5f9;background:#f8fafc;">صيانة</td>
                    <td style="padding:6px 4px;border-bottom:1px solid #f1f5f9;background:#f8fafc;">مستخدم ٥</td>
                    <td style="padding:6px 4px;border-bottom:1px solid #f1f5f9;background:#f8fafc;">${badge("rejected")}</td>
                    <td style="padding:6px 4px;border-bottom:1px solid #f1f5f9;background:#f8fafc;">—</td>
                    <td style="padding:6px 4px;border-bottom:1px solid #f1f5f9;background:#f8fafc;">450,000</td>
                    <td style="padding:6px 4px;border-bottom:1px solid #f1f5f9;background:#f8fafc;">28/12/2025</td>
                  </tr>
                </tbody>
              </table>
              <div style="padding:7px 10px;border-top:1px solid #e2e8f0;background:#ffffff;font-size:7pt;font-weight:900;color:#475569;text-align:left;direction:ltr;">Total: 48 | Page: 1 / 2</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>`;
}

function buildWordBody() {
  return `
  ${appHeader()}
  ${coverHero()}

  ${sectionCard(`
    ${sectionTitle("📋", "ما هو طلب التمويل؟")}
    <p>طلب التمويل هو مستند إلكتروني يُقدَّم لطلب صرف مبلغ مالي لغرض محدد (مشتريات، مصاريف تشغيل، رواتب، مشاريع…). يمر الطلب بخطوات موافقة محددة مسبقاً قبل اعتماده.</p>
    <p>لكل طلب <strong>رمز فريد (Request Code)</strong> يُستخدم للبحث والمتابعة والأرشفة.</p>
  `)}

  ${sectionCard(`
    ${sectionTitle("📝", "ماذا يحتوي الطلب؟")}
    ${dataTable([
      ["نوع الطلب", "تصنيف الطلب حسب إعداد الشركة"],
      ["القسم", "القسم مقدّم الطلب"],
      ["العملة", "دينار عراقي أو دولار"],
      ["الوصف والملاحظات", "شرح سبب الطلب وأي تفاصيل إضافية"],
      ["جدول البنود", "التفاصيل، الكمية، سعر الوحدة، والمجموع"],
      ["المجموع الكلي", "يُحسب تلقائياً من البنود"],
      ["المرفقات", "فواتير، عقود، كشوف (صور أو PDF)"],
    ])}
    <p class="note">في بعض الشركات قد يظهر أيضاً: اسم المشروع أو نوع المصروف (حسب إعداد الشركة).</p>
  `)}

  ${shotBlock(
    "لوحة التحكم (الداشبورد)",
    "🏠",
    "assets/dashboard-screenshot.jpg",
    "لوحة التحكم",
    [
      "<strong>الشريط العلوي:</strong> شعار SPC، اسم النظام Fund Request، وحساب المستخدم.",
      "<strong>بطاقة الملخص:</strong> اسم المستخدم، عدد الشركات المتاحة، والطلبات بانتظار الموافقة.",
      "<strong>الأدوات والتقارير:</strong> للانتقال إلى تقارير الطلبات ومتابعة حالتها.",
      "<strong>شبكة الشركات:</strong> اختر الشركة (١–٦) واضغط على بطاقتها لفتح طلباتها.",
    ]
  )}

  ${shotBlock(
    "داشبورد الطلبات (Requests)",
    "📄",
    "assets/requests-screenshot.jpg",
    "داشبورد الطلبات",
    [
      "<strong>العنوان وإنشاء طلب:</strong> اسم الشركة وزر «إنشاء طلب» لإضافة طلب تمويل جديد.",
      "<strong>بطاقات الملخص:</strong> مجموع طلباتي، طلباتي قيد الانتظار، وطلباتي الموافق عليها.",
      "<strong>البحث:</strong> للبحث بالكود أو الوصف أو نوع الطلب.",
      "<strong>طلباتي:</strong> الطلبات التي أنشأها المستخدم مع فلتر حسب الحالة.",
      "<strong>قيد الانتظار للموافقة:</strong> الطلبات التي تحتاج موافقة المستخدم الحالي.",
    ]
  )}

  <div class="page-break"></div>
  ${appHeader()}

  ${sectionCard(`
    ${sectionTitle("🔄", "مراحل الطلب")}
    ${flowSteps()}
    <h3>① إنشاء الطلب</h3>
    <p>يُفتح طلب جديد، تُملأ البيانات وتُرفع المرفقات، ثم يُحفظ فيصبح ${badge("pending")}.</p>
    <p class="note">عند الإنشاء يُرسل <strong>بريد إلكتروني تلقائي</strong> إلى موظفي <strong>الخطوة الأولى</strong> في سير العمل.</p>
    <h3>② الموافقات</h3>
    <p>يمر الطلب بخطوات محددة. كل معتمد يراجع ويوافق أو يرفض مع تعليق.</p>
    <h3>③ الاعتماد</h3>
    <p>بعد اكتمال الموافقات تصبح الحالة ${badge("approved")} والطلب جاهز للصرف.</p>
    <h3>④ الصرف</h3>
    <p>يُصدر وصل صرف ويُربط بالطلب.</p>
  `)}

  ${sectionCard(`
    ${sectionTitle("🏷️", "حالات الطلب")}
    ${dataTableCustom(
      ["الحالة", "المعنى"],
      [
        [badge("pending"), "الطلب لم يكتمل اعتماده بعد"],
        [badge("approved"), "اكتملت الموافقات — جاهز للصرف"],
        [badge("rejected"), "رُفض في إحدى الخطوات — لا يُنفَّذ"],
        [badge("cancelled"), "أُلغي الطلب"],
      ]
    )}
  `)}

  ${sectionCard(`
    ${sectionTitle("✅", "سير العمل والموافقات")}
    <p>كل طلب مربوط بـ <strong>سير عمل (Workflow)</strong> يحدد من يوافق في كل خطوة وترتيب الخطوات.</p>
    <ul>
      <li>لا يمكن تخطي خطوة — الترتيب إلزامي</li>
      <li>الرفض في أي خطوة يوقف الطلب أو يُعاد للخطوة السابقة</li>
      <li>يمكن إضافة تعليق مع الموافقة أو الرفض</li>
      <li>يمكن رفع مرفق (اتاج) أثناء خطوة الموافقة</li>
      <li>سجل الموافقات محفوظ ومرئي في صفحة الطلب</li>
    </ul>
  `)}

  ${shotBlock(
    "سير العمل",
    "🔄",
    "assets/workflow-screenshot.jpg",
    "سير العمل",
    [
      "<strong>شريط التقدم:</strong> يوضح الخطوة الحالية من إجمالي خطوات الموافقة.",
      "<strong>الخطوات المكتملة:</strong> تظهر بعلامة «موافق» مع اسم المعتمد وتاريخ الإجراء.",
      "<strong>الخطوة الحالية:</strong> تظهر «قيد الانتظار» مع أسماء الموظفين المطلوب موافقتهم.",
      "<strong>الخطوات القادمة:</strong> تبقى بانتظار دورها حتى يُكمل الطلب الخطوات السابقة.",
    ]
  )}

  ${sectionCard(`
    <div class="email-box">
      <h3 style="margin-top:0;color:#1d4ed8;">📧 إشعارات البريد الإلكتروني</h3>
      <p>يرسل النظام رسائل بريد تلقائياً عند تحرك الطلب في سير العمل:</p>
      <ul>
        <li><strong>عند الموافقة:</strong> بريد للخطوة التالية + بريد لمقدّم الطلب.</li>
        <li><strong>عند الرفض:</strong> بريد للخطوة السابقة + بريد لمقدّم الطلب.</li>
      </ul>
      <p class="note">لا يُرسل بريد عند الموافقة في الخطوة الأخيرة، ولا عند الرفض في الخطوة الأولى.</p>
      <div style="text-align:center;margin-top:10px;">
        <img src="assets/email-notification-screenshot.jpg" alt="مثال بريد إشعار" width="400" style="max-width:100%;border:1px solid #93c5fd;background:#ffffff;" />
      </div>
      <div class="shot-caption" style="background:#ffffff;border-color:#bfdbfe;">
        <strong>وصف الصورة:</strong>
        مثال لرسالة بريد تُرسل تلقائياً عند الموافقة — تتضمن الشركة، الانتقال بين الخطوات، ملاحظة المعتمد، وزر «عرض التفاصيل».
      </div>
    </div>
    ${kpiRow3([
      ["في صفحة الطلب", "بيانات + بنود + مرفقات"],
      ["مسار الموافقات", "من وافق ومن ينتظر"],
      ["الإجراءات", "موافقة / رفض / تعليق"],
    ])}
  `)}

  <div class="page-break"></div>
  ${appHeader()}

  ${sectionCard(`
    ${sectionTitle("📎", "المرفقات")}
    ${dataTableCustom(
      ["النوع", "متى يُرفع"],
      [
        ["مرفقات الطلب", "عند الإنشاء أو التعديل (فواتير، مستندات داعمة)"],
        ["اتاج خطوة الموافقة", "أثناء الموافقة من المعتمد"],
      ]
    )}
    <p>الصيغ المدعومة: صور (JPG, PNG…) وملفات PDF — تُفتح من صفحة الطلب.</p>
  `)}

  ${sectionCard(`
    ${sectionTitle("⬇️", "تحميل PDF الطلب")}
    ${dataTableCustom(
      ["الخيار", "المحتوى"],
      [
        ["تحميل PDF الطلب فقط", "بيانات الطلب + جدول البنود + الموافقات"],
        ["تحميل PDF الطلب والمرفقات", "الطلب مع دمج المرفقات واتاجات الموافقة"],
      ]
    )}
  `)}

  ${sectionCard(`
    ${sectionTitle("📊", "التقارير والمتابعة")}
    <p>صفحة <strong>تقارير الطلبات</strong> (من لوحة التحكم) تتيح البحث المتقدّم وتصدير Excel.</p>
  `)}

  <div class="page-break"></div>
  ${appHeader()}

  ${sectionCard(`
    ${sectionTitle("📊", "تقارير الطلبات")}
    <p>صفحة التقارير تعرض مؤشرات سريعة، فلاتر بحث متقدمة، وجدول نتائج:</p>
    ${reportsUI()}
  `)}

  ${sectionCard(`
    ${sectionTitle("⏳", "تقرير قيد الانتظار (Pending)")}
    <p>لاستخراج تقرير بالطلبات التي <strong>لم تكتمل موافقتها بعد</strong>:</p>
    <ol>
      <li>اختر من فلتر <strong>الحالة</strong> → ${badge("pending")}</li>
      <li>حدّد الشركة أو الفترة الزمنية إن لزم</li>
      <li>اضغط <strong>بحث</strong></li>
    </ol>
    ${reportFocus("ماذا يعرض هذا التقرير؟", [
      "كل الطلبات بحالة «قيد الانتظار» ضمن صلاحياتك",
      "عمود <strong>قيد الانتظار عند</strong> يبيّن المعتمد في الخطوة الحالية",
      "يمكن الجمع مع فلتر الشركة أو مقدم الطلب أو العملة",
    ], '<p class="note" style="margin:0;"><strong>فلتر إضافي:</strong> «قيد الانتظار عند» = موظف محدد → يعرض فقط الطلبات المعلّقة عنده.</p>')}
  `)}

  ${sectionCard(`
    ${sectionTitle("🔀", "تقرير حالة الخطوة (Stage Status)")}
    <p>عمود <strong>قيد الانتظار عند</strong> هو مفتاح متابعة <strong>مرحلة سير العمل</strong> لكل طلب.</p>
    ${dataTableCustom(
      ["الهدف", "الإجراء"],
      [
        ["معرفة أين علق طلب معيّن", "ابحث بكود الطلب → راجع عمود «قيد الانتظار عند»"],
        ["قائمة كل ما عند خطوة معيّنة", "الحالة = قيد الانتظار + «قيد الانتظار عند» = الموظف المطلوب"],
        ["متابعة تأخير الموافقات", "فلتر بالتاريخ + الحالة قيد الانتظار"],
      ]
    )}
  `)}

  ${sectionCard(`
    ${sectionTitle("✅", "تقرير المعتمد (Approved)")}
    <ol>
      <li>اختر من فلتر <strong>الحالة</strong> → ${badge("approved")}</li>
      <li>حدّد الشركة والفترة (مثلاً: شهر محاسبي)</li>
      <li>اضغط <strong>بحث</strong> ثم <strong>Excel</strong> للتصدير</li>
    </ol>
    ${reportFocus("ماذا يعرض هذا التقرير؟", [
      "الطلبات الجاهزة للصرف — اكتمل سير الموافقات عليها",
      "عمود «قيد الانتظار عند» يكون فارغاً (—)",
      "ملف Excel يحتوي: الشركة، الكود، النوع، مقدم الطلب، الحالة، المبلغ، التاريخ",
    ])}
  `)}

  ${sectionCard(`
    ${sectionTitle("💡", "مثال عملي")}
    <p><strong>الموقف:</strong> قسم يحتاج 5,000,000 د.ع لشراء مواد.</p>
    ${dataTableCustom(
      ["#", "الإجراء"],
      [
        ["١", "فتح لوحة التحكم واختيار شركة ١ وإنشاء طلب جديد"],
        ["٢", "إدخال البنود والمبلغ ورفع الفاتورة"],
        ["٣", "موافقة مدير القسم"],
        ["٤", "موافقة المدير المالي"],
        ["٥", "الموافقة النهائية — الطلب يصبح معتمداً"],
        ["٦", "إصدار وصل صرف وربطه بالطلب"],
        ["٧", "استخراج تقرير للمراجعة الشهرية"],
      ]
    )}
  `)}

  <div class="doc-footer">دليل طلب التمويل — SPC</div>
  `;
}

function buildWordHtml() {
  const body = buildWordBody();
  const withImages = inlineLocalImages(body, docsDir);
  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <title>دليل طلب التمويل</title>
  <style>${WORD_CSS}</style>
</head>
<body>
${withImages}
</body>
</html>`;
}

async function main() {
  const html = buildWordHtml();
  const buffer = await HTMLtoDOCX(html, null, {
    orientation: "portrait",
    margins: { top: 900, right: 1000, bottom: 900, left: 1000 },
    title: "دليل طلب التمويل",
    lang: "ar",
    table: { row: { cantSplit: true } },
    footer: false,
    pageNumber: false,
  });

  writeFileSync(join(docsDir, "_t.html"), html); process.exit(0);
  console.log(`✅ Word: ${outPath}`);
}

main().catch((err) => {
  console.error("❌", err.message || err);
  process.exit(1);
});
