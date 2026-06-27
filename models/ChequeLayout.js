import mongoose from "mongoose";

const FieldLayoutSchema = new mongoose.Schema(
  {
    key: { type: String, required: true },
    top: { type: Number, default: 0 },
    left: { type: Number, default: 0 },
    width: { type: Number, default: 10 },
    height: { type: Number, default: 5 },
    fontSize: { type: Number, default: 14 },
    fontWeight: { type: Number, default: 700 },
  },
  { _id: false }
);

const PrintCalibSchema = new mongoose.Schema(
  {
    pageTopMm: { type: Number, default: 0 },
    pageLeftMm: { type: Number, default: 0 },
    widthMm: { type: Number, default: 0 },
    heightMm: { type: Number, default: 0 },
    offsetXmm: { type: Number, default: 0 },
    offsetYmm: { type: Number, default: 0 },
    scaleX: { type: Number, default: 100 },
    scaleY: { type: Number, default: 100 },
    sheetRotationDeg: { type: Number, default: 0 },
    flipHorizontal: { type: Boolean, default: false },
    flipVertical: { type: Boolean, default: false },
    globalFontSizeScale: { type: Number, default: 130 },
    globalTextColor: { type: String, default: "#0f172a" },
    fieldOffsets: { type: mongoose.Schema.Types.Mixed, default: {} },
    fieldFontStyles: { type: mongoose.Schema.Types.Mixed, default: {} },
    /** مواضع النسخ الثلاث لمعايرة Wizard — مفاتيح "1" | "2" | "3" */
    wizardCopyLayouts: { type: mongoose.Schema.Types.Mixed, default: null },
    /** دليل معايرة Wizard: coordinates | frame */
    wizardGuideStyle: {
      type: String,
      enum: ["coordinates", "frame"],
      default: "coordinates",
    },
    /** موضع صورة الصك على A4 — مستقل عن منطقة البيانات */
    imageSheet: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { _id: false }
);

const ChequeLayoutSchema = new mongoose.Schema(
  {
    templateKey: {
      type: String,
      required: true,
      unique: true,
      enum: ["real_estate_baghdad", "mustashar_ghadeer", "rafidain_ghadeer"],
    },
    fields: { type: [FieldLayoutSchema], default: [] },
    dateShowSlashes: { type: Boolean, default: true },
    /** مقياس حجم الخط العام للحقول على صورة الصك (%) */
    globalFontScale: { type: Number, default: 100 },
    printCalib: { type: PrintCalibSchema, default: null },
    /** shared = نفس موضع البيانات | separate = موضع خاص بمعايرة Wizard */
    wizardCalibSource: {
      type: String,
      enum: ["shared", "separate"],
      default: "shared",
    },
    wizardPrintCalib: { type: PrintCalibSchema, default: null },
    /** عدد نسخ صفحة اختبار Wizard على ورقة واحدة (1–3) */
    wizardTestCopyCount: { type: Number, default: 3, min: 1, max: 3 },
    /** مرجع ثابت لموضع البيانات على الورقة — يُستعاد بزر */
    printCalibBaselineLabel: { type: String, default: "" },
    printCalibBaseline: { type: PrintCalibSchema, default: null },
    updatedBy: { type: String, default: "" },
  },
  { timestamps: true }
);

if (mongoose.models.ChequeLayout) {
  delete mongoose.models.ChequeLayout;
}

export default mongoose.model("ChequeLayout", ChequeLayoutSchema);
