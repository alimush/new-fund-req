import mongoose from "mongoose";

const IdentityAttachmentSchema = new mongoose.Schema(
  {
    key: { type: String, default: "" },
    name: { type: String, default: "" },
    url: { type: String, required: true },
    contentType: { type: String, default: "application/octet-stream" },
    size: { type: Number, default: 0 },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const VoucherPersonIdentitySchema = new mongoose.Schema(
  {
    personName: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    personNameKey: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    attachments: {
      type: [IdentityAttachmentSchema],
      default: [],
    },

    /** @deprecated legacy single file — kept for old records */
    attachment: {
      type: IdentityAttachmentSchema,
      default: null,
    },

    uploadedByUserId: { type: String, default: "" },
    uploadedByName: { type: String, default: "" },
  },
  {
    timestamps: true,
  }
);

export default mongoose.models.VoucherPersonIdentity ||
  mongoose.model("VoucherPersonIdentity", VoucherPersonIdentitySchema);
