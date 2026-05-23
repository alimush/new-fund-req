import mongoose from "mongoose";

const DatePartsSchema = new mongoose.Schema(
  {
    dd: { type: String, default: "" },
    mm: { type: String, default: "" },
    yy: { type: String, default: "" },
  },
  { _id: false }
);

const ChequeSchema = new mongoose.Schema(
  {
    templateKey: {
      type: String,
      required: true,
      enum: ["real_estate_baghdad", "mustashar_ghadeer"],
      index: true,
    },

    templateName: { type: String, default: "" },

    bankName: { type: String, default: "" },
    bankNameEn: { type: String, default: "" },
    drawerName: { type: String, default: "" },
    branch: { type: String, default: "" },

    chequeNumber: { type: String, default: "", index: true },
    accountNumber: { type: String, default: "" },

    dateParts: {
      type: DatePartsSchema,
      default: () => ({}),
    },

    customer: { type: String, default: "" },
    payee: { type: String, default: "" },

    amountNumeric: { type: Number, default: 0 },
    amountWords: { type: String, default: "" },
    amountWordsLine2: { type: String, default: "" },
    text: { type: String, default: "" },

    /** موضع/حجم حقل text لهذا الصك فقط */
    textFieldLayout: {
      top: { type: Number },
      left: { type: Number },
      width: { type: Number },
      height: { type: Number },
      fontSize: { type: Number },
      fontWeight: { type: Number },
    },

    currency: { type: String, default: "IQD" },
    bearer: { type: Boolean, default: false },

    status: {
      type: String,
      enum: ["draft", "issued"],
      default: "draft",
      index: true,
    },

    createdBy: { type: String, default: "", index: true },
    createdByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
  },
  { timestamps: true }
);

ChequeSchema.index({ templateKey: 1, createdAt: -1 });

export default mongoose.models.Cheque || mongoose.model("Cheque", ChequeSchema);
