import mongoose from "mongoose";
import xlsx from "xlsx";

// =====================================
// إعدادات
// =====================================
const MONGODB_URI =
  "mongodb+srv://alimushtaqmcamt_db_user:pDaGJT4YdNMnIRfV@cluster01.dkc7vo.mongodb.net/test?appName=Cluster01";

const EXCEL_FILE_PATH = "./requests2.xlsx";
const SHEET_NAME = "Sheet1";
const collectionName = "requests_old-data";

// =====================================
// Helpers
// =====================================
function norm(v) {
  return String(v ?? "").trim();
}

function normLower(v) {
  return norm(v).toLowerCase();
}

function splitPendingUsers(value) {
  return String(value || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

function excelDateToJSDate(value) {
  if (!value) return new Date();

  if (value instanceof Date) return value;

  if (typeof value === "number") {
    const parsed = xlsx.SSF.parse_date_code(value);
    if (parsed) {
      return new Date(
        parsed.y,
        parsed.m - 1,
        parsed.d,
        parsed.H || 0,
        parsed.M || 0,
        parsed.S || 0
      );
    }
  }

  const d = new Date(value);
  return isNaN(d.getTime()) ? new Date() : d;
}

function parseAmount(value) {
  if (value === null || value === undefined || value === "") return 0;

  const clean = String(value)
    .replace(/,/g, "")
    .replace(/\s/g, "")
    .trim();

  const num = Number(clean);
  return isNaN(num) ? 0 : num;
}

function getCell(row, keyName) {
  const entry = Object.keys(row).find(
    (k) => String(k).trim().toLowerCase() === String(keyName).trim().toLowerCase()
  );
  return entry ? row[entry] : "";
}

function buildItems(amount, description) {
  return [
    {
      desc: norm(description),
      qty: 1,
      price: parseAmount(amount),
    },
  ];
}

function mapFinalStatus(statusText) {
  const s = normLower(statusText);

  if (s === "approved" || s === "approve") return "Approved";
  if (s === "rejected" || s === "reject") return "Rejected";
  if (s === "cancelled" || s === "canceled" || s === "cancel") return "Cancelled";

  return "Pending";
}

// =====================================
// Schemas
// =====================================
const WorkflowSchema = new mongoose.Schema(
  {
    name: String,
    company: String,
    code: String,
    rules: {
      requiredPermissions: [String],
      requiredDepartments: [String],
      requiredRoles: [String],
      priority: Number,
    },
    isDefault: Boolean,
    steps: [
      {
        users: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
        status: String,
        actedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
        actedAt: { type: Date, default: null },
        comment: { type: String, default: "" },
        tag: { type: String, default: "" },
        attachment: { type: mongoose.Schema.Types.Mixed, default: null },
        tagAttachments: { type: [mongoose.Schema.Types.Mixed], default: [] },
      },
    ],
  },
  { strict: false, timestamps: true }
);

const UserSchema = new mongoose.Schema(
  {
    username: String,
    email: String,
    password: String,
    permissions: [String],
  },
  { strict: false, timestamps: true }
);

const ItemSchema = new mongoose.Schema(
  {
    desc: String,
    qty: Number,
    price: Number,
  },
  { _id: false }
);

const AttachmentSchema = new mongoose.Schema(
  {
    key: { type: String, default: "" },
    name: { type: String, default: "" },
    type: { type: String, default: "" },
    size: { type: Number, default: 0 },
    url: { type: String, default: "" },
  },
  { _id: false }
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
    comment: { type: String, default: "", trim: true },
    tag: { type: String, default: "", trim: true },
    attachment: { type: AttachmentSchema, default: null },
    tagAttachments: {
      type: [AttachmentSchema],
      default: [],
    },
  },
  { _id: false }
);

const RequestSchema = new mongoose.Schema(
  {
    companyKey: { type: String, index: true, required: true },
    requestCode: {
      type: String,
      index: true,
      unique: true,
      sparse: true,
    },
    requestType: String,
    description: String,
    currency: String,
    department: String,
    items: [ItemSchema],
    createdBy: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    attachments: { type: [AttachmentSchema], default: [] },
    workflow: {
      name: String,
      steps: [StepSchema],
    },
    currentStep: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["Pending", "Approved", "Rejected", "Cancelled"],
      default: "Pending",
    },
    paymentVoucher: {
      amount: Number,
      amountWords: String,
      currency: String,
      date: Date,
      description: String,
      createdBy: String,
      createdAt: Date,
    },
    projectName: { type: String, default: "", trim: true },
    cancelledAt: { type: Date, default: null },
    cancelledNote: { type: String, default: "" },
    approvalHistory: [
      {
        user: String,
        action: String,
        note: String,
        date: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true, strict: false }
);

// =====================================
// Models
// =====================================
const Workflow =
  mongoose.models.Workflow || mongoose.model("Workflow", WorkflowSchema, "workflows");

const User =
  mongoose.models.User || mongoose.model("User", UserSchema, "users");

const RequestModel =
  mongoose.models[collectionName] ||
  mongoose.model(collectionName, RequestSchema, collectionName);

// =====================================
// Workflow logic
// =====================================
async function findUserByUsername(username) {
  const clean = norm(username);
  if (!clean) return null;

  return await User.findOne({ username: clean }).select("_id username email").lean();
}

async function findUsersByUsernames(usernames) {
  const cleaned = (usernames || []).map(norm).filter(Boolean);
  if (!cleaned.length) return [];

  return await User.find({ username: { $in: cleaned } })
    .select("_id username email")
    .lean();
}

function findStepIndexByUserIds(workflow, userIds) {
  if (!workflow?.steps?.length || !Array.isArray(userIds) || !userIds.length) return -1;

  const userIdSet = new Set(userIds.map((id) => String(id)));

  return workflow.steps.findIndex(
    (step) =>
      Array.isArray(step.users) &&
      step.users.some((u) => {
        const id = String(u?._id || u);
        return userIdSet.has(id);
      })
  );
}

/**
 * إذا أكو Pending With:
 * - الستيبات قبل stepIndex => Approved
 * - الستيب الحالية:
 *    Approved  => Pending
 *    Pending   => Pending
 *    Rejected  => Rejected
 *    Cancelled => Cancelled
 * - الستيبات بعدها => Pending
 */
function buildWorkflowState(workflow, stepIndex, finalStatus) {
  const steps = (workflow.steps || []).map((step, idx) => {
    let status = "Pending";
    let actedAt = null;
    let comment = "";

    if (idx < stepIndex) {
      status = "Approved";
      actedAt = new Date();
      comment = "Approved";
    } else if (idx === stepIndex) {
      if (finalStatus === "Rejected") {
        status = "Rejected";
        actedAt = new Date();
        comment = "Rejected";
      } else if (finalStatus === "Cancelled") {
        status = "Cancelled";
        actedAt = new Date();
        comment = "Cancelled";
      } else {
        status = "Pending";
        actedAt = null;
        comment = "";
      }
    } else {
      status = "Pending";
      actedAt = null;
      comment = "";
    }

    return {
      users: (step.users || []).map((u) => u?._id || u),
      status,
      actedBy: null,
      actedAt,
      comment,
      tag: "",
      attachment: null,
      tagAttachments: [],
    };
  });

  return steps;
}

function buildWorkflowStateWithoutPendingWith(workflow, finalStatus) {
  const steps = (workflow.steps || []).map((step, idx) => {
    let status = "Pending";
    let actedAt = null;
    let comment = "";

    if (finalStatus === "Approved") {
      status = "Approved";
      actedAt = new Date();
      comment = "Approved";
    } else if (finalStatus === "Rejected") {
      if (idx === 0) {
        status = "Rejected";
        actedAt = new Date();
        comment = "Rejected";
      } else {
        status = "Pending";
      }
    } else if (finalStatus === "Cancelled") {
      if (idx === 0) {
        status = "Cancelled";
        actedAt = new Date();
        comment = "Cancelled";
      } else {
        status = "Pending";
      }
    } else {
      status = "Pending";
    }

    return {
      users: (step.users || []).map((u) => u?._id || u),
      status,
      actedBy: null,
      actedAt,
      comment,
      tag: "",
      attachment: null,
      tagAttachments: [],
    };
  });

  return steps;
}

async function getWorkflowForCompany(company) {
  return await Workflow.findOne({ company: norm(company) }).lean();
}

// =====================================
// Main
// =====================================
async function run() {
  try {
    console.log("🔌 Connecting to MongoDB...");
    await mongoose.connect(MONGODB_URI);
    console.log("✅ MongoDB connected");

    const workbook = xlsx.readFile(EXCEL_FILE_PATH);
    const sheet =
      workbook.Sheets[SHEET_NAME] || workbook.Sheets[workbook.SheetNames[0]];

    if (!sheet) {
      throw new Error("No sheet found in Excel file");
    }

    const rows = xlsx.utils.sheet_to_json(sheet, { defval: "" });
    console.log(`📄 Rows found: ${rows.length}`);
    console.log(`📁 Target collection: ${collectionName}`);

    let inserted = 0;
    let skipped = 0;
    let failed = 0;

    for (let i = 0; i < rows.length; i++) {
      const rowNo = i + 2;
      const row = rows[i];

      try {
        const company = norm(row.Company);
        const requestCode = norm(row.Code);
        const requestType = norm(row.Type);
        const requester = norm(row.Requester);
        const statusText = norm(row.Status);
        const pendingWithRaw = norm(row["Pending With"]);
        const pendingWithUsers = splitPendingUsers(pendingWithRaw);
        const department = norm(row.Department);
        const currency = norm(row.Currency);
        const amount = parseAmount(getCell(row, "Amount"));
        const description = norm(getCell(row, "Description"));
        const date = excelDateToJSDate(row.Date);

        if (!company) {
          console.log(`⚠️ Row ${rowNo}: Company missing -> skipped`);
          skipped++;
          continue;
        }

        if (!requestCode) {
          console.log(`⚠️ Row ${rowNo}: Code missing -> skipped`);
          skipped++;
          continue;
        }

        const exists = await RequestModel.findOne({ requestCode }).lean();
        if (exists) {
          console.log(`⏭️ Row ${rowNo}: requestCode already exists (${requestCode})`);
          skipped++;
          continue;
        }

        const workflow = await getWorkflowForCompany(company);
        if (!workflow) {
          console.log(`❌ Row ${rowNo}: No workflow found for company "${company}"`);
          failed++;
          continue;
        }

        const finalStatus = mapFinalStatus(statusText);

        let workflowSteps = [];
        let currentStep = 0;
        let note = "";

        if (pendingWithUsers.length > 0) {
          const pendingUsers = await findUsersByUsernames(pendingWithUsers);

          if (!pendingUsers.length) {
            console.log(
              `❌ Row ${rowNo}: Pending With users not found "${pendingWithRaw}"`
            );
            failed++;
            continue;
          }

          const foundUsernames = pendingUsers.map((u) => u.username);
          const missingUsernames = pendingWithUsers.filter(
            (u) => !foundUsernames.includes(u)
          );

          const stepIndex = findStepIndexByUserIds(
            workflow,
            pendingUsers.map((u) => u._id)
          );

          if (stepIndex === -1) {
            console.log(
              `❌ Row ${rowNo}: none of users "${pendingWithRaw}" found in workflow of company "${company}"`
            );
            failed++;
            continue;
          }

          workflowSteps = buildWorkflowState(workflow, stepIndex, finalStatus);
          currentStep = stepIndex;

          note = `Pending With = ${pendingWithRaw}, matchedUsers = ${foundUsernames.join(
            ", "
          )}, missingUsers = ${missingUsernames.join(", ") || "NONE"}, currentStep = ${currentStep}, finalStatus = ${finalStatus}`;
        } else {
          workflowSteps = buildWorkflowStateWithoutPendingWith(workflow, finalStatus);

          if (finalStatus === "Approved") {
            currentStep = Math.max((workflow.steps?.length || 1) - 1, 0);
          } else {
            currentStep = 0;
          }

          note = `status = ${finalStatus}`;
        }

        const doc = new RequestModel({
          companyKey: company,
          company,
          requestCode,
          requestType,
          description,
          currency,
          department,
          createdBy: requester || "Excel Import",
          createdAt: date,
          attachments: [],
          items: buildItems(amount, description),
          workflow: {
            name: workflow.name || "",
            steps: workflowSteps,
          },
          currentStep,
          status:
            pendingWithUsers.length > 0 &&
            (finalStatus === "Approved" || finalStatus === "Pending")
              ? "Pending"
              : finalStatus,
          projectName: "",
          cancelledAt: finalStatus === "Cancelled" ? new Date() : null,
          cancelledNote: finalStatus === "Cancelled" ? "Cancelled" : "",
          approvalHistory: [
            {
              user: "Excel Import",
              action: "Imported",
              note,
              date: new Date(),
            },
          ],
        });

        await doc.save();

        inserted++;
        console.log(
          `✅ Row ${rowNo}: inserted ${requestCode} | company=${company} | pendingWith=${pendingWithRaw || "EMPTY"} | status=${finalStatus} | currentStep=${currentStep}`
        );
      } catch (err) {
        failed++;
        console.log(`❌ Row ${rowNo}: ${err.message}`);
      }
    }

    console.log("\n==============================");
    console.log(`✅ Inserted: ${inserted}`);
    console.log(`⚠️ Skipped : ${skipped}`);
    console.log(`❌ Failed  : ${failed}`);
    console.log("==============================\n");

    await mongoose.disconnect();
    console.log("🔌 MongoDB disconnected");
  } catch (err) {
    console.error("❌ Fatal Error:", err);
    try {
      await mongoose.disconnect();
    } catch {}
  }
}

run();