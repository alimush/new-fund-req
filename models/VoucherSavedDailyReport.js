import mongoose from "mongoose";

/**
 * لقطة تقرير يومي للوصولات — تُحفظ عند الطباعة وتُعاد بالفورمة نفسها.
 * Collection: vouchersaveddailyreports
 */
const VoucherSavedDailyReportSchema = new mongoose.Schema(
  {
    savedByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    savedByUsername: { type: String, default: "", trim: true, index: true },

    title: { type: String, default: "", trim: true },

    dateFrom: { type: String, default: "", trim: true, index: true },
    dateTo: { type: String, default: "", trim: true, index: true },
    companyFilter: { type: String, default: "all", trim: true },

    companyKeys: { type: [String], default: [], index: true },
    companyNames: { type: [String], default: [] },

    cashier: { type: String, default: "", trim: true },
    prevBalances: { type: mongoose.Schema.Types.Mixed, default: {} },

    fontSize: { type: Number, default: 9 },
    fontBold: { type: Boolean, default: true },

    voucherCount: { type: Number, default: 0 },
    /** لقطة وصولات خفيفة كافية لإعادة بناء فورمة الطباعة */
    vouchers: { type: [mongoose.Schema.Types.Mixed], default: [] },
  },
  { timestamps: true }
);

VoucherSavedDailyReportSchema.index({ createdAt: -1 });
VoucherSavedDailyReportSchema.index({
  savedByUserId: 1,
  createdAt: -1,
});

export default mongoose.models.VoucherSavedDailyReport ||
  mongoose.model(
    "VoucherSavedDailyReport",
    VoucherSavedDailyReportSchema,
    "vouchersaveddailyreports"
  );
