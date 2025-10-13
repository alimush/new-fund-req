import mongoose from "mongoose";

const PermissionSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },          // ID مال اليوزر
    companies: [{ type: String, required: true }],     // الشركات المسموح بيها
    groups: [{ type: String }],                        // قروبات إذا تحب
  },
  { timestamps: true }
);

export default mongoose.models.Permission ||
  mongoose.model("Permission", PermissionSchema);
