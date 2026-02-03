import mongoose from "mongoose";

const UserSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, trim: true },
    password: { type: String, required: true },

    // ✅ NEW
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
    },

    permissions: {
      type: [String],
      default: [],
    },
  },
  { timestamps: true }
);

export default mongoose.models.User || mongoose.model("User", UserSchema);