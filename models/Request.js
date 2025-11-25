// models/Request.js
import mongoose from "mongoose";

// 🧱 Items Schema
const ItemSchema = new mongoose.Schema({
  code: String,
  name: String,
  qty: Number,
  price: Number,
});

// 🧾 Request Schema
const RequestSchema = new mongoose.Schema({
  companyKey: { type: String, index: true, required: true },
  title: String,
  branch: String,
  project: String,
  amount: Number,
  costCenter: String,
  glAccount: String,
  paymentType: String,
  items: [ItemSchema],
  createdBy: { type: String, required: true },
  attachment: {
    url: String,
    name: String,
  },
  status: {
    type: String,
    enum: ["Pending", "Approved", "Rejected", "Cancelled"],
    default: "Pending",
  },
  approver: { type: String },
  approvalHistory: [
    {
      user: String,
      action: String, // Approved / Rejected / Cancelled
      date: { type: Date, default: Date.now },
      note: String,
    },
  ],

  workflowSteps: [
    {
      user: String, // userId
      status: {
        type: String,
        enum: ["Pending", "Approved", "Rejected"],
        default: "Pending",
      },
    },
  ],

  // 🚦 هنا مؤشر بأي خطوة وصلنا
  currentStep: {
    type: Number,
    default: 0,
  },
}, { timestamps: true });

// ✅ إنشاء موديل رئيسي افتراضي
const Request = mongoose.models.Request || mongoose.model("Request", RequestSchema);

// ✅ دالة تولد موديل خاص بكل شركة
export function getModelForCompany(companyKey) {
  const collectionName = `requests_${companyKey.toLowerCase()}`;
  return (
    mongoose.models[collectionName] ||
    mongoose.model(collectionName, RequestSchema, collectionName)
  );
}

export default Request;