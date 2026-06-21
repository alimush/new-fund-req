import { getChequeTemplate } from "@/lib/cheques/templates";

export const MUSTASHAR_TEMPLATE_KEY = "mustashar_ghadeer";
export const REAL_ESTATE_TEMPLATE_KEY = "real_estate_baghdad";

export const BRANCHED_TEMPLATE_KEYS = [
  MUSTASHAR_TEMPLATE_KEY,
  REAL_ESTATE_TEMPLATE_KEY,
];

/** أفرع MIB الافتراضية — نفس مقاس/خط القالب الرئيسي، صورة مختلفة لكل فرع */
export const DEFAULT_MUSTASHAR_BRANCHES = [
  {
    branchKey: "mib_main",
    templateKey: MUSTASHAR_TEMPLATE_KEY,
    name: "شركة الغدير - MIB الرئيسي",
    drawerName: "شركة الغدير للاستثمارات العقارية والوكالات التجارية",
    branchLabel: "الرئيسي",
    accountNumber: "2027611600",
    image: "/assets/cheques/branches/mib_main.png",
    sortOrder: 1,
    active: true,
  },
  {
    branchKey: "mib_budoor_baghdad",
    templateKey: MUSTASHAR_TEMPLATE_KEY,
    name: "MIB — مجمع بدور بغداد السكني",
    drawerName: "شركة الغدير / مجمع بدور بغداد السكني",
    branchLabel: "الرئيسي",
    accountNumber: "2027611602",
    image: "/assets/cheques/branches/mib_budoor_baghdad.png",
    sortOrder: 2,
    active: true,
  },
  {
    branchKey: "mib_muntadhar",
    templateKey: MUSTASHAR_TEMPLATE_KEY,
    name: "MIB — مجمع المنتظر / طيبة النجف",
    drawerName: "شركة الغدير / مجمع المنتظر / طيبة النجف",
    branchLabel: "الرئيسي",
    accountNumber: "2027611603",
    image: "/assets/cheques/branches/mib_muntadhar.png",
    sortOrder: 3,
    active: true,
  },
  {
    branchKey: "mib_budoor_najaf",
    templateKey: MUSTASHAR_TEMPLATE_KEY,
    name: "MIB — بدور النجف",
    drawerName: "شركة الغدير / بدور النجف",
    branchLabel: "الرئيسي",
    accountNumber: "2027611605",
    image: "/assets/cheques/branches/mib_budoor_najaf.png",
    sortOrder: 4,
    active: true,
  },
  {
    branchKey: "mib_karbala",
    templateKey: MUSTASHAR_TEMPLATE_KEY,
    name: "MIB — مجمع غدير كربلاء",
    drawerName: "شركة الغدير / مجمع غدير كربلاء",
    branchLabel: "الرئيسي",
    accountNumber: "2027611604",
    image: "/assets/cheques/branches/mib_karbala.png",
    sortOrder: 5,
    active: true,
  },
];

/** أفرع المصرف العقاري — صورة مختلفة لكل فرع */
export const DEFAULT_REAL_ESTATE_BRANCHES = [
  {
    branchKey: "re_main",
    templateKey: REAL_ESTATE_TEMPLATE_KEY,
    name: "العقاري - شركة الغدير - رئيسي",
    drawerName: "شركة الغدير للاستثمارات العقارية",
    branchLabel: "العقاري - شركة الغدير - رئيسي",
    accountNumber: "",
    image: "/assets/cheques/branches/real_estate_main.png",
    sortOrder: 1,
    active: true,
  },
  {
    branchKey: "re_karbala",
    templateKey: REAL_ESTATE_TEMPLATE_KEY,
    name: "المصرف العقاري — كربلاء المقدسة",
    drawerName: "شركة الغدير للاستثمارات العقارية",
    branchLabel: "الفرع كربلاء المقدسة / 827",
    accountNumber: "",
    image: "/assets/cheques/branches/real_estate_karbala.png",
    sortOrder: 2,
    active: true,
  },
];

export function isMustasharTemplateKey(templateKey) {
  return String(templateKey || "").trim() === MUSTASHAR_TEMPLATE_KEY;
}

/** فرع العقاري المرجعي — كل الإعدادات (حقول، طباعة، تاريخ) موحّدة منه */
export const REAL_ESTATE_MAIN_BRANCH_KEY = "re_main";

export function isRealEstateMainBranch(branchKey) {
  return normalizeBranchKey(branchKey) === REAL_ESTATE_MAIN_BRANCH_KEY;
}

/** فرع عقاري غير الرئيسي — يستخدم نفس تخطيط/طباعة الرئيسي، صورة الفرع فقط */
export function realEstateUsesMainBranchSettings(templateKey, branchKey) {
  return (
    isRealEstateTemplateKey(templateKey) &&
    Boolean(branchKey) &&
    !isRealEstateMainBranch(branchKey)
  );
}

export function realEstateMainBranchPath(templateKey = REAL_ESTATE_TEMPLATE_KEY) {
  return `/cheques/${String(templateKey || "").trim()}?branch=${REAL_ESTATE_MAIN_BRANCH_KEY}`;
}

export function isRealEstateTemplateKey(templateKey) {
  return String(templateKey || "").trim() === REAL_ESTATE_TEMPLATE_KEY;
}

export function isBranchedTemplateKey(templateKey) {
  return BRANCHED_TEMPLATE_KEYS.includes(String(templateKey || "").trim());
}

export function branchesPagePath(templateKey) {
  return `/cheques/${String(templateKey || "").trim()}/branches`;
}

export function getDefaultBranchesForTemplate(templateKey) {
  if (isMustasharTemplateKey(templateKey)) return DEFAULT_MUSTASHAR_BRANCHES;
  if (isRealEstateTemplateKey(templateKey)) return DEFAULT_REAL_ESTATE_BRANCHES;
  return [];
}

export function normalizeBranchKey(raw) {
  return String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "");
}

/** دمج فرع مع القالب — الأبعاد والحقول من القالب، الصورة من الفرع */
export function applyBranchToTemplate(baseTemplate, branch) {
  if (!baseTemplate || !branch) return baseTemplate;
  const out = {
    ...baseTemplate,
    name: branch.name || baseTemplate.name,
    image: branch.image || baseTemplate.image,
    drawerName: branch.drawerName || baseTemplate.drawerName,
    branch: branch.branchLabel || branch.name || baseTemplate.branch,
    branchKey: branch.branchKey,
    defaultAccountNumber: branch.accountNumber || "",
    aspectRatio: baseTemplate.aspectRatio,
    imageWidthPx: baseTemplate.imageWidthPx,
    imageHeightPx: baseTemplate.imageHeightPx,
    printWidthMm: baseTemplate.printWidthMm,
    printHeightMm: baseTemplate.printHeightMm,
  };
  if (isRealEstateTemplateKey(baseTemplate.key)) {
    out.layoutProfileBranchKey = REAL_ESTATE_MAIN_BRANCH_KEY;
    out.usesSharedMainLayout = !isRealEstateMainBranch(branch.branchKey);
  }
  return out;
}

export function findDefaultBranchForCheque(doc) {
  if (!doc || !isBranchedTemplateKey(doc.templateKey)) return null;

  const defaults = getDefaultBranchesForTemplate(doc.templateKey);
  if (!defaults.length) return null;

  const key = normalizeBranchKey(doc.branchKey);
  if (key) {
    const byKey = defaults.find((b) => normalizeBranchKey(b.branchKey) === key);
    if (byKey) return byKey;
  }

  const acc = String(doc.accountNumber || "").trim();
  if (acc) {
    return defaults.find((b) => String(b.accountNumber || "") === acc) || null;
  }

  return null;
}

export async function fetchBranchForChequeDoc(doc) {
  if (!doc || !isBranchedTemplateKey(doc.templateKey)) return null;

  const branchKey = normalizeBranchKey(doc.branchKey);
  if (branchKey) {
    try {
      const res = await fetch(
        `/api/cheques/branches?templateKey=${encodeURIComponent(doc.templateKey)}&branchKey=${encodeURIComponent(branchKey)}`,
        { cache: "no-store" }
      );
      const json = await res.json();
      if (json?.success && json.branch) return json.branch;
    } catch {
      //
    }
  }

  return findDefaultBranchForCheque(doc);
}

export function resolveChequeTemplateForDoc(doc, branch = null) {
  const base = doc?.templateKey ? getChequeTemplate(doc.templateKey) : null;
  if (!base) return null;
  const resolvedBranch = branch || findDefaultBranchForCheque(doc);
  return resolvedBranch ? applyBranchToTemplate(base, resolvedBranch) : base;
}

export function branchPublicDto(doc) {
  if (!doc) return null;
  return {
    id: String(doc._id || doc.id || ""),
    branchKey: doc.branchKey,
    templateKey: doc.templateKey,
    name: doc.name,
    drawerName: doc.drawerName,
    branchLabel: doc.branchLabel,
    accountNumber: doc.accountNumber,
    image: doc.image,
    sortOrder: doc.sortOrder ?? 0,
    active: doc.active !== false,
  };
}

/** إزالة تكرار branchKey — يُبقي أحدث سجل */
export function dedupeBranchesList(branches = []) {
  const byKey = new Map();
  for (const raw of branches) {
    const b = branchPublicDto(raw) || raw;
    const key = normalizeBranchKey(b?.branchKey);
    if (!key) continue;
    if (!byKey.has(key)) {
      byKey.set(key, { ...b, branchKey: key });
      continue;
    }
    const prev = byKey.get(key);
    const prevOrder = Number(prev.sortOrder) || 0;
    const nextOrder = Number(b.sortOrder) || 0;
    if (nextOrder < prevOrder || (nextOrder === prevOrder && String(b.id) > String(prev.id))) {
      byKey.set(key, { ...b, branchKey: key });
    }
  }
  return Array.from(byKey.values()).sort(
    (a, b) =>
      (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0) ||
      String(a.name || "").localeCompare(String(b.name || ""), "ar")
  );
}
