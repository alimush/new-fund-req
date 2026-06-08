import mongoose from "mongoose";
import { PAYMENT_PLAN_TEMPLATE_KEY } from "@/lib/ex/paymentPlanTemplate";

const FieldLayoutSchema = new mongoose.Schema(
  {
    key: { type: String, required: true },
    top: { type: Number, default: 0 },
    left: { type: Number, default: 0 },
    width: { type: Number, default: 10 },
    height: { type: Number, default: 5 },
    fontSize: { type: Number, default: 14 },
    fontWeight: { type: Number, default: 700 },
    textAlign: { type: String, default: "center" },
  },
  { _id: false }
);

const PaymentPlanLayoutSchema = new mongoose.Schema(
  {
    templateKey: {
      type: String,
      required: true,
      unique: true,
      default: PAYMENT_PLAN_TEMPLATE_KEY,
    },
    fields: { type: [FieldLayoutSchema], default: [] },
    tableRowHeight: { type: Number, default: 2.75 },
    updatedBy: { type: String, default: "" },
  },
  { timestamps: true }
);

if (mongoose.models.PaymentPlanLayout) {
  delete mongoose.models.PaymentPlanLayout;
}

export default mongoose.model("PaymentPlanLayout", PaymentPlanLayoutSchema);
