/**
 * تصدير مستخدمي النظام مع صلاحيات طلبات الصندوق فقط (بدون EX / وصولات / صكوك).
 * التشغيل: node scripts/export-fund-request-permissions.mjs
 */
import { readFileSync } from "fs";
import mongoose from "mongoose";
import ExcelJS from "exceljs";

function loadEnvFile(path) {
  const text = readFileSync(path, "utf8");
  const env = {};
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    const key = t.slice(0, i).trim();
    let val = t.slice(i + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    env[key] = val;
  }
  return env;
}

const env = loadEnvFile(".env");
const uri = env.MONGODB_URI || process.env.MONGODB_URI;
if (!uri) {
  console.error("MONGODB_URI not found");
  process.exit(1);
}

const COMPANY_AR = {
  "al-ghadeer": "طلبات الغدير",
  "badur-baghdad": "طلبات بدور بغداد",
  "ghadeer-karbala": "طلبات غدير كربلاء",
  "tiba-al-najaf": "طلبات طيبة النجف",
  "badur-al-najaf": "طلبات بدور النجف",
  "010": "اختبار",
  "old-data": "البيانات القديمة",
  alleanza: "طلبات اليانزا",
  "al-rida": "طلبات الرضا",
  "al-mezan": "طلبات الميزان",
  ryd: "رياض",
  1: "شركة ١",
  2: "شركة ٢",
  3: "شركة ٣",
  4: "شركة ٤",
  5: "شركة ٥",
  6: "شركة ٦",
};

const FUND_LABELS = {
  CREATE_REQUEST: "إنشاء طلب",
  DUPLICATE_REQUEST: "تكرار طلب",
  EDIT_REQUEST: "تعديل طلب",
  DELETE_REQUEST: "حذف طلب",
  APPROVE_REQUEST: "الموافقة على الطلبات",
  PRINT_REQUEST: "طباعة الطلب",
  VIEW_REPORTS: "عرض تقارير (طلباته فقط)",
  VIEW_ALL_REPORTS: "جميع التقارير",
  VIEW_NEW_OLD_DATA: "عرض البيانات القديمة والجديدة",
  MANAGE_USERS: "إدارة المستخدمين",
  MARKETING: "تسويق",
};

const FUND_ORDER = Object.keys(FUND_LABELS);

function isExcludedPermission(raw) {
  const p = String(raw || "").trim();
  if (!p) return true;
  const u = p.toUpperCase();
  if (u === "MANAGE_PERMISSIONS") return true;
  if (u === "EX" || u.startsWith("EX_") || u.startsWith("EX")) return true;
  if (u === "OPERATION") return true;
  if (u === "RECEIPTS" || u.startsWith("VOUCHER") || u.startsWith("CHEQUE")) return true;
  if (u === "TEST") return true;
  if (p.includes("صكوك") || p.includes("وصول")) return true;
  return false;
}

function companyLabel(key) {
  const k = String(key || "").trim();
  if (!k) return "";
  if (/^[1-6]$/.test(k)) return "";
  const label = COMPANY_AR[k.toLowerCase()] || k;
  if (/^شركة\s*[١-٦1-6]$/.test(label)) return "";
  return label;
}

function toDirectUri(srvUri) {
  const raw = String(srvUri || "").trim();
  const prefix = "mongodb+srv://";
  if (!raw.startsWith(prefix)) return raw;
  const rest = raw.slice(prefix.length);
  const at = rest.lastIndexOf("@");
  if (at < 0) return raw;
  const creds = rest.slice(0, at);
  return `mongodb://${creds}@ac-p3zxmir-shard-00-00.iihipor.mongodb.net:27017/?ssl=true&authSource=admin&directConnection=true`;
}

const hostHint = uri.replace(/\/\/[^@]+@/, "//***@").slice(0, 90);
console.log("connecting", hostHint);
const directUri = toDirectUri(uri);
const clientPromise = mongoose.connect(directUri, {
  serverSelectionTimeoutMS: 12000,
  connectTimeoutMS: 12000,
  family: 4,
  directConnection: true,
});
await clientPromise;
const admin = mongoose.connection.db.admin();
const dbs = await admin.listDatabases();
let db = null;
const found = [];
for (const d of dbs.databases) {
  const candidate = mongoose.connection.client.db(d.name);
  const cols = (await candidate.listCollections().toArray()).map((c) => c.name);
  if (cols.some((n) => n.toLowerCase() === "users")) {
    found.push(`${d.name}:${cols.filter((n) => /user|perm/i.test(n)).join("+")}`);
    if (!db) db = candidate;
  }
}
console.log("userDbs", found.join(" | ") || "none");
if (!db) {
  console.error("no users collection");
  await mongoose.disconnect();
  process.exit(1);
}

const users = await db
  .collection("users")
  .find({}, { projection: { username: 1, arabicName: 1, email: 1, permissions: 1 } })
  .toArray();

const groups = await db.collection("permissions").find({}).toArray();

const byUser = new Map();
for (const u of users) {
  byUser.set(String(u._id), {
    user: u,
    perms: new Set(),
    permCompanies: new Map(),
    companies: new Set(),
    groups: new Set(),
  });
}

for (const g of groups) {
  const rawPerms = Array.isArray(g.permissions) ? g.permissions : [];
  const gPerms = rawPerms
    .map((p) => String(p || "").trim())
    .filter((p) => p && !isExcludedPermission(p));
  const excludedOnly = rawPerms.length > 0 && gPerms.length === 0;
  // مجموعة EX / وصولات / صكوك فقط — لا تُحسب ضمن طلبات الصندوق
  if (excludedOnly) continue;

  const gCompanies = (Array.isArray(g.companies) ? g.companies : []).filter(
    (c) => String(c || "").trim().toUpperCase() !== "EX"
  );

  for (const uid of g.users || []) {
    const row = byUser.get(String(uid));
    if (!row) continue;
    const names = [];
    for (const c of gCompanies) {
      const name = companyLabel(c);
      if (!name) continue;
      names.push(name);
      row.companies.add(name);
    }
    for (const p of gPerms) {
      row.perms.add(p);
      if (!row.permCompanies.has(p)) row.permCompanies.set(p, new Set());
      for (const name of names) row.permCompanies.get(p).add(name);
    }
    if ((gPerms.length || names.length) && g.name) {
      row.groups.add(String(g.name).trim());
    }
  }
}

const extraLabels = new Map();
for (const row of byUser.values()) {
  for (const p of row.perms) {
    if (!FUND_LABELS[p]) extraLabels.set(p, p);
  }
}

const permColumns = [
  ...FUND_ORDER.map((k) => ({ key: k, label: FUND_LABELS[k] })),
  ...[...extraLabels.keys()]
    .sort()
    .map((k) => ({ key: k, label: extraLabels.get(k) })),
];

const DROP_USERNAMES = new Set(["admin", "admin2", "accounting manager"]);

function isRidaOrAlleanza(row) {
  const blob = [
    row.user.username,
    row.user.email,
    row.user.arabicName,
    ...row.companies,
    ...row.groups,
  ]
    .join(" ")
    .toLowerCase();
  return (
    blob.includes("الرضا") ||
    blob.includes("اليانزا") ||
    blob.includes("al-rida") ||
    blob.includes("alrida") ||
    blob.includes("alleanza") ||
    blob.includes("alianza")
  );
}

const rows = [...byUser.values()]
  .filter((row) => {
    const username = String(row.user.username || "").trim().toLowerCase();
    if (DROP_USERNAMES.has(username)) return false;
    if (username === "test" || username.startsWith("test")) return false;
    if (isRidaOrAlleanza(row)) return false;
    if (row.companies.size === 0) return false;
    return true;
  })
  .sort((a, b) => {
    const an = String(a.user.username || "");
    const bn = String(b.user.username || "");
    return an.localeCompare(bn, "en");
  });

const workbook = new ExcelJS.Workbook();
workbook.creator = "GDR Funds";
workbook.created = new Date();
const ws = workbook.addWorksheet("طلبات الصندوق", {
  views: [{ rightToLeft: true, state: "frozen", ySplit: 1 }],
});

const headers = ["الاسم", "البريد", "الشركات", "الصلاحيات"];

ws.addRow(headers);
const header = ws.getRow(1);
header.font = { name: "Calibri", bold: true, color: { argb: "FFFFFFFF" }, size: 12 };
header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F4C81" } };
header.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
header.height = 28;

for (const row of rows) {
  const hasAllReports = row.perms.has("VIEW_ALL_REPORTS");
  const labels = permColumns
    .filter((c) => row.perms.has(c.key))
    .filter((c) => !(hasAllReports && c.key === "VIEW_REPORTS"))
    .map((c) => c.label);
  const line = [
    row.user.username || "",
    row.user.email || "",
    [...row.companies].join("، "),
    labels.join("، "),
  ];
  const excelRow = ws.addRow(line);
  excelRow.alignment = { vertical: "middle", wrapText: true, horizontal: "right" };
  excelRow.getCell(1).alignment = { vertical: "middle", horizontal: "left" };
  excelRow.font = { name: "Calibri", size: 11 };
}

ws.columns = [
  { width: 28 },
  { width: 32 },
  { width: 48 },
  { width: 70 },
];

ws.autoFilter = {
  from: { row: 1, column: 1 },
  to: { row: 1, column: headers.length },
};

const out = "صلاحيات_طلبات_الصندوق.xlsx";
await workbook.xlsx.writeFile(out);

const withPerms = rows.filter((r) => r.perms.size > 0).length;
console.log(
  JSON.stringify({
    users: rows.length,
    withFundPermissions: withPerms,
    extraPermissions: [...extraLabels.keys()],
    file: out,
  })
);

await mongoose.disconnect();
