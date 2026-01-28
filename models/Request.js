// models/Request.js
import mongoose from "mongoose";

// 🧱 Items Schema
const ItemSchema = new mongoose.Schema(
  {
    code: String,
    name: String,
    qty: Number,
    price: Number,
  },
  { _id: false }
);

// 🧾 Request Schema (WITH WORKFLOW SNAPSHOT)
const RequestSchema = new mongoose.Schema(
  {
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

    // 🟢 Workflow SNAPSHOT (لا يتغير أبداً)
    workflow: {
      name: String,
      steps: [
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
      
          actedAt: Date,
      
          comment: {
            type: String,
            default: "",
          },
        },
      ],
    },

    currentStep: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ["Pending", "Approved", "Rejected", "Cancelled"],
      default: "Pending",
    },
    
    cancelledAt: Date,
    cancelledNote: String,
    approvalHistory: [
      {
        user: String,
        action: String,
        note: String,
        date: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

// ✅ Per-company collection ONLY
export function getModelForCompany(companyKey) {
  const collectionName = `requests_${companyKey.toLowerCase()}`;
  return (
    mongoose.models[collectionName] ||
    mongoose.model(collectionName, RequestSchema, collectionName)
  );
}