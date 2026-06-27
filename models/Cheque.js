import mongoose from "mongoose";

const DatePartsSchema = new mongoose.Schema(
  {
    dd: { type: String, default: "" },
    mm: { type: String, default: "" },
    yy: { type: String, default: "" },
  },
  { _id: false }
);

const FieldLayoutSchema = new mongoose.Schema(
  {
    top: { type: Number },
    left: { type: Number },
    width: { type: Number },
    height: { type: Number },
    fontSize: { type: Number },
    fontWeight: { type: Number },
  },
  { _id: false }
);

const AttachmentSchema = new mongoose.Schema(
  {
    key: { type: String, default: "" },
    name: { type: String, default: "Attachment" },
    url: { type: String, required: true },
    contentType: { type: String, default: "application/octet-stream" },
    size: { type: Number, default: 0 },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const ChequeSchema = new mongoose.Schema(
  {
    templateKey: {
      type: String,
      required: true,
      enum: ["real_estate_baghdad", "mustashar_ghadeer", "rafidain_ghadeer"],
      index: true,
    },

    /** فرع MIB — mib_main | mib_karbala … */
    branchKey: { type: String, default: "", index: true },
    branchName: { type: String, default: "" },

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
    governorate: { type: String, default: "" },

    amountNumeric: { type: Number, default: 0 },
    amountWords: { type: String, default: "" },
    amountWordsLine2: { type: String, default: "" },
    text: { type: String, default: "" },

    /** موضع/حجم حقل text لهذا الصك فقط */
    textFieldLayout: { type: FieldLayoutSchema, default: undefined },
    /** موضع سطري المبلغ كتابة — وضع الإدخال */
    amountWordsLayout: { type: FieldLayoutSchema, default: undefined },
    amountWordsLine2Layout: { type: FieldLayoutSchema, default: undefined },

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

    attachments: {
      type: [AttachmentSchema],
      default: () => [],
    },
  },
  { timestamps: true }
);

ChequeSchema.index({ templateKey: 1, createdAt: -1 });

export default mongoose.models.Cheque || mongoose.model("Cheque", ChequeSchema);
