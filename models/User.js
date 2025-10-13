import mongoose from "mongoose";

const UserSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true }, // مبدئياً نخزن plain
  },
  { timestamps: true }
);

export default mongoose.models.User || mongoose.model("User", UserSchema);
