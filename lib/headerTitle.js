import { EX_BOOKING_COMPANIES, EX_BOOKING_FORMS_CATALOG } from "@/lib/exForms/exCompanies";
import { CHEQUE_TEMPLATES } from "@/lib/cheques/templates";

/** أسماء أنظمة طلبات الصرف حسب مفتاح الشركة (نفس بطاقات /home) */
export const REQUEST_SYSTEM_TITLES = {
  "Al-Ghadeer": "طلبات الغدير",
  "Badur-Baghdad": "طلبات بدور بغداد",
  "Ghadeer-Karbala": "طلبات غدير كربلاء",
  "Tiba-Al-najaf": "طلبات طيبة النجف",
  "badur-Al-najaf": "طلبات بدور النجف",
  "010": "test",
  "old-data": "Old Data",
  alleanza: "طلبات اليانزا",
  "Al-Rida": "طلبات الرضا",
};

const DEFAULT_TITLE = "Fund Request";

function normalizePath(pathname) {
  const raw = String(pathname || "").trim();
  if (!raw || raw === "/") return "/";
  return raw.replace(/\/+$/, "");
}

function exFormTitle(pageKey) {
  const k = String(pageKey || "").trim();
  if (!k) return null;
  const form = EX_BOOKING_FORMS_CATALOG.find((f) => f.listPath === k || f.key === k);
  return form?.name || null;
}

function exCompanyTitle(companyKey) {
  const def = EX_BOOKING_COMPANIES.find((c) => c.key === String(companyKey || "").trim());
  return def?.name || null;
}

function chequeTemplateTitle(templateKey) {
  const tpl = CHEQUE_TEMPLATES.find((t) => t.key === String(templateKey || "").trim());
  return tpl?.name || null;
}

/** عنوان الهيدر المركزي حسب المسار الحالي */
export function resolveHeaderTitle(pathname) {
  const path = normalizePath(pathname);
  const parts = path.split("/").filter(Boolean);

  if (path === "/login") return "تسجيل الدخول";
  if (path === "/home") return DEFAULT_TITLE;
  if (path === "/register") return "إنشاء مستخدم";

  if (parts[0] === "requests") {
    const company = parts[1];
    if (company) {
      return REQUEST_SYSTEM_TITLES[company] || `طلبات ${company}`;
    }
    return "طلبات الصرف";
  }

  if (parts[0] === "vouchers") {
    if (parts[1] === "reports") return "تقارير الوصولات";
    return "إدارة الوصولات";
  }

  if (parts[0] === "receipts" && parts[1] === "disbursement") {
    return "تتبع صرف الطلبات";
  }

  if (parts[0] === "reports") {
    if (parts[1] === "ex") return "تقارير طلبات الحجز";
    return "تقارير الطلبات";
  }

  if (parts[0] === "cheques") {
    if (parts[1] === "reports") return "تقارير الصكوك";
    if (parts[1] === "view") return "نظام الصكوك";
    if (parts[1]) {
      const tplName = chequeTemplateTitle(parts[1]);
      return tplName ? `نظام الصكوك — ${tplName}` : "نظام الصكوك";
    }
    return "نظام الصكوك";
  }

  if (parts[0] === "ex") {
    if (parts[1] === "ex-home") {
      const companyName = exCompanyTitle(parts[2]);
      return companyName ? `طلبات الحجز — ${companyName}` : "طلبات الحجز";
    }
    if (parts[1] === "workflow") return "EX Workflow";
    if (parts[1] === "payment-plan") return "خطط الدفع";
    const formName = exFormTitle(parts[1]);
    if (formName) return formName;
    return "طلبات الحجز";
  }

  if (parts[0] === "permissions") return "إدارة الصلاحيات";
  if (parts[0] === "workflow") return "الموافقات";
  if (parts[0] === "admin") {
    if (parts[1] === "requests-workflow") return "وورك فلو الطلبات";
    if (parts[1] === "voucher-links") return "ربط الوصولات";
    return "إدارة النظام";
  }

  return DEFAULT_TITLE;
}
