import mongoose from "mongoose";


const StepSchema = new mongoose.Schema(
  {
    users: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  },
  { _id: false }
);

const ExWorkflowSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },

    // ✅ بدل الشركة: مفتاح الصفحة/الكارد
    pageKey: { type: String, required: true, trim: true },

    // ✅ كود اختياري/إجباري حسب UI (احنه نخليه required بالـ UI)
    code: { type: String, default: "", trim: true },

    steps: { type: [StepSchema], default: [] },
    
    finalApproveEmails: [{ type: String, trim: true, lowercase: true }],
  },

  
  { timestamps: true }
);

// ✅ unique: (pageKey + code)
ExWorkflowSchema.index({ pageKey: 1, code: 1 }, { unique: true });

export default mongoose.models.ExWorkflow ||
  mongoose.model("ExWorkflow", ExWorkflowSchema);