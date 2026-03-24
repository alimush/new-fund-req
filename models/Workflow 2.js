import mongoose from "mongoose";

const StepSchema = new mongoose.Schema(
  {
    users: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
    ],
    status: {
      type: String,
      enum: ["Pending", "Approved", "Rejected", "Cancelled"],
      default: "Pending",
    },
    actedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    actedAt: { type: Date, default: null },
    comment: { type: String, default: "", trim: true },
  },
  { _id: false }
);

// ✅ rules schema (مضمن)
const RulesSchema = new mongoose.Schema(
  {
    // لازم المستخدم يمتلك كل هذي الصلاحيات حتى ينطبق هذا الworkflow
    requiredPermissions: { type: [String], default: [] },

    // (اختياري) إذا تريد تربطها بأقسام
    requiredDepartments: { type: [String], default: [] },

    // (اختياري) إذا عندك roles مستقبلاً
    requiredRoles: { type: [String], default: [] },

    // أولوية الاختيار (الأعلى ينطبق قبل)
    priority: { type: Number, default: 1 },
  },
  { _id: false }
);

const WorkflowSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },

    // ✅ شيل unique عن company
    company: { type: String, required: true, trim: true },

    // ✅ الافتراضي بدون كود
    code: { type: String, default: "", trim: true, index: true },

    // ✅ جديد: قواعد اختيار هذا الworkflow
    rules: { type: RulesSchema, default: () => ({}) },

    // ✅ جديد: fallback workflow إذا ماكو شي ينطبق
    isDefault: { type: Boolean, default: false },

    steps: { type: [StepSchema], default: [] },
  },
  { timestamps: true }
);

// ✅ لازم قبل model
WorkflowSchema.index({ company: 1, code: 1 }, { unique: true });

// ✅ (اختياري لكن مفيد) تسريع البحث حسب rules
WorkflowSchema.index({ company: 1, "rules.priority": -1, isDefault: -1 });

export default mongoose.models.Workflow ||
  mongoose.model("Workflow", WorkflowSchema);