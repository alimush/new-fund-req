import mongoose from "mongoose";

const ChequeBranchSchema = new mongoose.Schema(
  {
    branchKey: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    templateKey: {
      type: String,
      required: true,
      enum: ["mustashar_ghadeer", "real_estate_baghdad"],
      index: true,
    },
    name: { type: String, required: true, trim: true },
    drawerName: { type: String, default: "" },
    branchLabel: { type: String, default: "الرئيسي" },
    accountNumber: { type: String, default: "" },
    image: { type: String, required: true, trim: true },
    sortOrder: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

ChequeBranchSchema.index({ templateKey: 1, branchKey: 1 }, { unique: true });
ChequeBranchSchema.index({ templateKey: 1, sortOrder: 1, name: 1 });

if (mongoose.models.ChequeBranch) {
  delete mongoose.models.ChequeBranch;
}

export default mongoose.model("ChequeBranch", ChequeBranchSchema);
