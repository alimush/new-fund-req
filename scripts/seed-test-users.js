/**
 * Seed test DB: 6 users + permissions on companies 1/2/3
 * + default 5-step approval workflow for company "1".
 *
 * Usage:
 *   node scripts/seed-test-users.js
 * (reads MONGODB_URI from env / .env)
 */

const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

function loadEnvUri() {
  if (process.env.MONGODB_URI) return String(process.env.MONGODB_URI).trim();
  const envPath = path.join(__dirname, "..", ".env");
  if (!fs.existsSync(envPath)) return "";
  const text = fs.readFileSync(envPath, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*MONGODB_URI\s*=\s*(.+)\s*$/);
    if (!m) continue;
    let v = m[1].trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    return v.trim();
  }
  return "";
}

const COMPANIES = ["1", "2", "3"];

/** كل مفاتيح الصلاحيات المعرّفة في lib/permission.js */
const ALL_PERMISSIONS = [
  "RECEIPTS",
  "VIEW_REPORTS",
  "APPROVE_REQUEST",
  "CREATE_REQUEST",
  "DUPLICATE_REQUEST",
  "EDIT_REQUEST",
  "DELETE_REQUEST",
  "MANAGE_USERS",
  "MANAGE_PERMISSIONS",
  "EX_REPLACE_BOOKING_TRANSFER",
  "EX_WAIVER_RESERVATION",
  "EX_CANCEL_BOOKING_UNIT",
  "EX_UNIT_TRANSFER",
  "EX_EXCEPTIONS",
  "EX_Create_Request",
  "EX_WORKFLOW",
  "VIEW_ALL_REPORTS",
  "EX_REPORTS",
  "VIEW_NEW_OLD_DATA",
  "PRINT_REQUEST",
  "VOUCHER_DELEGATE",
  "EX_ATTACHMENT_ONLY",
  "OPERATION",
  "VOUCHERS_AL_GHADEER",
  "VOUCHERS_BADUR_BAGHDAD",
  "VOUCHERS_TIBA_AL_NAJAF",
  "VOUCHERS_TIBA_AL_NAJAF_SALES",
  "VOUCHERS_GHADEER_KARBALA",
  "VOUCHERS_BADUR_AL_NAJAF",
  "VOUCHERS_GHADEER_INVESTMENTS",
  "VOUCHERS_GHADEER_KARBALA_SUB",
  "VOUCHERS_GHADEER_NAJAF_SUB",
  "VOUCHERS_BADUR_BAGHDAD_SAFEBOX_ISTISHAR",
  "VOUCHERS_BADUR_BAGHDAD_ELITE",
  "VOUCHERS_BADUR_SIGNATURE",
  "VOUCHERS_BADUR_ELITE_MIB",
  "VOUCHERS_BADUR_BAGHDAD_MIB",
  "TEST",
  "VOUCHERS_REPORTS_VIEW",
  "EX",
  "CHEQUES",
  "CHEQUES_FIELD_LAYOUT",
  "VOUCHERS_FIELD_LAYOUT",
];

/** كل الشركات المعروفة في النظام */
const ALL_COMPANIES = [
  "Al-Ghadeer",
  "Badur-Baghdad",
  "Badur-Baghdad-Safebox-Istishar",
  "Badur-Baghdad-Elite",
  "Badur-Signature",
  "Badur-Elite-MIB",
  "Badur-Baghdad-MIB",
  "Tiba-Al-najaf",
  "Tiba-Al-najaf-Sales",
  "Ghadeer-Karbala",
  "Badur-Al-Najaf",
  "badur-Al-najaf",
  "Ghadeer-Investments",
  "Ghadeer-Karbala-Sub",
  "Ghadeer-Najaf-Sub",
  "010",
  "alleanza",
  "Al-Rida",
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
];

const ADMIN_SPEC = {
  username: "admin",
  arabicName: "أدمن",
  email: "",
  password: "A@aa1234",
};

const UserSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, trim: true },
    password: { type: String, required: true },
    email: { type: String, default: "" },
    arabicName: { type: String, default: "" },
    permissions: { type: [String], default: [] },
  },
  { timestamps: true }
);

const PermissionsSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
    permissions: { type: [String], default: [] },
    users: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    companies: { type: [String], default: [] },
  },
  { timestamps: true }
);

const StepSchema = new mongoose.Schema(
  {
    users: [{ type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }],
    status: {
      type: String,
      enum: ["Pending", "Approved", "Rejected", "Cancelled"],
      default: "Pending",
    },
    actedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    actedAt: { type: Date, default: null },
    comment: { type: String, default: "" },
  },
  { _id: false }
);

const WorkflowSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    company: { type: String, required: true },
    code: { type: String, default: "" },
    rules: {
      requiredPermissions: { type: [String], default: [] },
      requiredDepartments: { type: [String], default: [] },
      requiredRoles: { type: [String], default: [] },
      priority: { type: Number, default: 1 },
    },
    isDefault: { type: Boolean, default: false },
    steps: { type: [StepSchema], default: [] },
  },
  { timestamps: true }
);

WorkflowSchema.index({ company: 1, code: 1 }, { unique: true });

async function upsertUser(User, spec, hashed) {
  const doc = await User.findOneAndUpdate(
    { username: spec.username },
    {
      $set: {
        username: spec.username,
        password: hashed,
        email: spec.email || "",
        arabicName: spec.arabicName || "",
        permissions: [],
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return doc;
}

async function upsertGroup(Permissions, name, permissions, userIds, companies) {
  return Permissions.findOneAndUpdate(
    { name },
    {
      $set: {
        name,
        permissions,
        users: userIds,
        companies,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

async function main() {
  const uri = loadEnvUri();
  if (!uri) {
    console.error("❌ MONGODB_URI missing");
    process.exit(1);
  }

  console.log("🔌 Connecting to test DB…");
  await mongoose.connect(uri);
  console.log("✅ Connected:", mongoose.connection.name || "(default)");

  const User = mongoose.models.User || mongoose.model("User", UserSchema);
  const Permissions =
    mongoose.models.Permissions ||
    mongoose.model("Permissions", PermissionsSchema);
  const Workflow =
    mongoose.models.Workflow || mongoose.model("Workflow", WorkflowSchema);

  // احذف يوزرات التيست القديمة إن وُجدت
  const legacyUsernames = [
    "test_requester",
    "test_step1",
    "test_step2",
    "test_step3",
    "test_step4",
    "test_step5",
  ];
  await User.deleteMany({ username: { $in: legacyUsernames } });

  const previousUsernames = [
    "ahmed.hassan",
    "sara.kadhim",
    "omar.jabbar",
    "noor.rasheed",
    "mustafa.fadel",
    "layla.naji",
  ];
  await User.deleteMany({ username: { $in: previousUsernames } });

  const userSpecs = [
    {
      username: "ahmed",
      arabicName: "أحمد",
      email: "",
      role: "requester",
      password: "Ahmed@2026",
    },
    {
      username: "hassan",
      arabicName: "حسن",
      email: "",
      role: "approver",
      step: 1,
      password: "Hassan@2026",
    },
    {
      username: "omar",
      arabicName: "عمر",
      email: "",
      role: "approver",
      step: 2,
      password: "Omar@2026",
    },
    {
      username: "ali",
      arabicName: "علي",
      email: "",
      role: "approver",
      step: 3,
      password: "Ali@2026",
    },
    {
      username: "mustafa",
      arabicName: "مصطفى",
      email: "",
      role: "approver",
      step: 4,
      password: "Mustafa@2026",
    },
    {
      username: "karim",
      arabicName: "كريم",
      email: "",
      role: "approver",
      step: 5,
      password: "Karim@2026",
    },
  ];

  const usersByUsername = {};
  for (const spec of userSpecs) {
    const userHash = await bcrypt.hash(spec.password, 10);
    const u = await upsertUser(User, spec, userHash);
    usersByUsername[spec.username] = u;
    console.log(`👤 ${spec.username} (${spec.arabicName}) → ${u._id}`);
  }

  const requesterId = usersByUsername.ahmed._id;
  const approverIds = [
    usersByUsername.hassan._id,
    usersByUsername.omar._id,
    usersByUsername.ali._id,
    usersByUsername.mustafa._id,
    usersByUsername.karim._id,
  ];

  await upsertGroup(
    Permissions,
    "Test Requesters (1-2-3)",
    ["CREATE_REQUEST", "EDIT_REQUEST", "VIEW_REPORTS", "PRINT_REQUEST", "DUPLICATE_REQUEST"],
    [requesterId],
    COMPANIES
  );
  console.log("🔐 Group: Test Requesters (1-2-3)");

  await upsertGroup(
    Permissions,
    "Test Approvers (1-2-3)",
    ["APPROVE_REQUEST", "VIEW_REPORTS", "PRINT_REQUEST", "VOUCHER_DELEGATE"],
    approverIds,
    COMPANIES
  );
  console.log("🔐 Group: Test Approvers (1-2-3)");

  const steps = approverIds.map((uid) => ({
    users: [uid],
    status: "Pending",
    actedBy: null,
    actedAt: null,
    comment: "",
  }));

  const wf = await Workflow.findOneAndUpdate(
    { company: "1", code: "" },
    {
      $set: {
        name: "وورك فلو شركة 1 — 5 خطوات موافقة",
        company: "1",
        code: "",
        isDefault: true,
        rules: {
          requiredPermissions: [],
          requiredDepartments: [],
          requiredRoles: [],
          priority: 10,
        },
        steps,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  console.log(`🧩 Workflow company=1 id=${wf._id} steps=${wf.steps.length}`);

  // أدمن بكل الصلاحيات + كل الشركات
  const adminHash = await bcrypt.hash(ADMIN_SPEC.password, 10);
  const adminUser = await upsertUser(User, ADMIN_SPEC, adminHash);
  await upsertGroup(
    Permissions,
    "Test Admin (all)",
    ALL_PERMISSIONS,
    [adminUser._id],
    ALL_COMPANIES
  );
  console.log(
    `👑 admin (${ADMIN_SPEC.arabicName}) → ${adminUser._id} | perms=${ALL_PERMISSIONS.length} companies=${ALL_COMPANIES.length}`
  );

  console.log("\n========== LOGIN ==========");
  for (const spec of userSpecs) {
    const roleLabel =
      spec.role === "requester" ? "ريكويستر" : `موافقة خطوة ${spec.step}`;
    console.log(
      `${spec.arabicName} | ${spec.username} | ${spec.password} | ${roleLabel}`
    );
  }
  console.log(
    `${ADMIN_SPEC.arabicName} | ${ADMIN_SPEC.username} | ${ADMIN_SPEC.password} | أدمن (كل الصلاحيات)`
  );
  console.log("Companies : 1, 2, 3 (+ admin → all companies)");
  console.log("Workflow  : company 1 → 5 approval steps");
  console.log("===========================\n");

  await mongoose.disconnect();
  console.log("✅ Done");
}

main().catch(async (err) => {
  console.error("❌ Seed failed:", err);
  try {
    await mongoose.disconnect();
  } catch {}
  process.exit(1);
});
