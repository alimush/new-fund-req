import mongoose from "mongoose";

const PermissionsSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },

    // صلاحيات الكروب
    permissions: {
      type: [String],
      default: []
    },

    // اليوزرات المرتبطة بالكروب
    users: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

    // 🔥 الشركات التابعة للكروب
    companies: {
      type: [String],
      default: []
    }
  },
  { timestamps: true }
);

export default mongoose.models.Permissions ||
  mongoose.model("Permissions", PermissionsSchema);