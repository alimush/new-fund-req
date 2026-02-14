import mongoose from "mongoose";

const NotificationSchema = new mongoose.Schema(
  {
    toUser: { type: String, required: true },          // username اللي يستلم الاشعار
    companyKey: { type: String, required: true },      // نفس companyKey
    requestId: { type: String, required: true },       // id مالت الطلب
    requestCode: { type: String, default: "" },
    type: { type: String, default: "request_action" }, // approve/reject/cancel/comment...
    message: { type: String, default: "" },

    seen: { type: Boolean, default: false },           // مهم للبادج
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export default mongoose.models.Notification ||
  mongoose.model("Notification", NotificationSchema);