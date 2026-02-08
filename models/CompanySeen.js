import mongoose from "mongoose";

const CompanySeenSchema = new mongoose.Schema(
  {
    // ✅ خليها String حتى تطابق cookie حرفياً
    userId: { type: String, required: true, index: true },

    company: { type: String, required: true, index: true },

    lastSeenAt: { type: Date, default: new Date(0) },

    // ✅ اشعارات مقروءة وحدة وحدة
    seenKeys: { type: [String], default: [] },
  },
  { timestamps: true }
);

CompanySeenSchema.index({ userId: 1, company: 1 }, { unique: true });

export default mongoose.models.CompanySeen ||
  mongoose.model("CompanySeen", CompanySeenSchema);