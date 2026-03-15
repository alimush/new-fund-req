import mongoose from "mongoose";

const VoucherSchema = new mongoose.Schema(
  {
    companyKey: {
      type: String,
      required: true,
      index: true,
    },

    companyName: {
      type: String,
      default: "",
    },

    mode: {
      type: String,
      enum: ["payment", "receipt"],
      required: true,
      index: true,
    },

    seq: {
      type: Number,
      required: true,
      index: true,
    },

    voucherNo: {
      type: String,
      required: true,
      index: true,
    },

    requestId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      index: true,
    },

    voucherDate: {
      type: Date,
      required: true,
    },

    dateParts: {
      yy: { type: String, default: "" },
      mm: { type: String, default: "" },
      dd: { type: String, default: "" },
    },

    amount: {
      type: Number,
      default: 0,
    },

    amountText: {
      type: String,
      default: "",
    },

    amountWords: {
      type: String,
      default: "",
    },

    currency: {
      type: String,
      enum: ["IQD", "USD"],
      default: "IQD",
    },

    description: {
      type: String,
      default: "",
    },

    bank: {
      type: String,
      default: "",
    },

    fxRate: {
      type: String,
      default: "",
    },

    receivedBy: {
      type: String,
      default: "",
    },

    beneficiary: {
      type: String,
      default: "",
    },

    notes: {
      type: String,
      default: "",
    },

    cbOne: {
      type: Boolean,
      default: false,
    },

    cbTwo: {
      type: Boolean,
      default: false,
    },

    createdByUserId: {
      type: String,
      default: "",
      index: true,
    },

    createdByName: {
      type: String,
      default: "",
    },

    requestId: { type: String, default: null },
requestCode: { type: String, default: "" },
  },
  {
    timestamps: true,
  }
);

// منع تكرار نفس الرقم لنفس الشركة ولنفس النوع
VoucherSchema.index(
  { companyKey: 1, mode: 1, seq: 1 },
  { unique: true }
);

export default mongoose.models.Voucher ||
  mongoose.model("Voucher", VoucherSchema);