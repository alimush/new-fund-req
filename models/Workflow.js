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

const WorkflowSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },

    // ✅ مهم: شيل unique
    company: { type: String, required: true, trim: true },

    // ✅ الافتراضي بدون كود
    code: { type: String, default: "", trim: true, index: true },

    steps: { type: [StepSchema], default: [] },
  },
  { timestamps: true }
);

// ✅ لازم قبل model
WorkflowSchema.index({ company: 1, code: 1 }, { unique: true });

export default mongoose.models.Workflow ||
  mongoose.model("Workflow", WorkflowSchema);