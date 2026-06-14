import mongoose from "mongoose";

const TextStyleSchema = new mongoose.Schema(
  {
    fontSize: {
      type: Number,
      default: 16,
    },
    fontWeight: {
      type: Number,
      default: 700,
    },
    color: {
      type: String,
      default: "#111827",
    },
  },
  { _id: false }
);

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

    chequeNo: {
      type: String,
      default: "",
    },

    nationalId: {
      type: String,
      default: "",
    },

    phone: {
      type: String,
      default: "",
    },

    sanadNo: {
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

    globalTextStyle: {
      type: new mongoose.Schema(
        {
          fontSize: {
            type: Number,
            default: 16,
          },
          fontWeight: {
            type: Number,
            default: 700,
          },
          color: {
            type: String,
            default: "#111827",
          },
        },
        { _id: false }
      ),
      default: () => ({
        fontSize: 16,
        fontWeight: 700,
        color: "#111827",
      }),
    },

    fieldStyles: {
      date: {
        type: TextStyleSchema,
        default: () => ({
          fontSize: 18,
          fontWeight: 800,
          color: "#ffffff",
        }),
      },

      amount: {
        type: TextStyleSchema,
        default: () => ({
          fontSize: 16,
          fontWeight: 800,
          color: "#111827",
        }),
      },

      words: {
        type: TextStyleSchema,
        default: () => ({
          fontSize: 16,
          fontWeight: 700,
          color: "#111827",
        }),
      },

      desc: {
        type: TextStyleSchema,
        default: () => ({
          fontSize: 16,
          fontWeight: 600,
          color: "#111827",
        }),
      },

      bank: {
        type: TextStyleSchema,
        default: () => ({
          fontSize: 16,
          fontWeight: 700,
          color: "#111827",
        }),
      },

      fxRate: {
        type: TextStyleSchema,
        default: () => ({
          fontSize: 16,
          fontWeight: 700,
          color: "#111827",
        }),
      },

      receivedBy: {
        type: TextStyleSchema,
        default: () => ({
          fontSize: 16,
          fontWeight: 700,
          color: "#111827",
        }),
      },

      notes: {
        type: TextStyleSchema,
        default: () => ({
          fontSize: 16,
          fontWeight: 600,
          color: "#111827",
        }),
      },

      chequeNo: {
        type: TextStyleSchema,
        default: () => ({
          fontSize: 16,
          fontWeight: 700,
          color: "#111827",
        }),
      },

      nationalId: {
        type: TextStyleSchema,
        default: () => ({
          fontSize: 16,
          fontWeight: 700,
          color: "#111827",
        }),
      },

      phone: {
        type: TextStyleSchema,
        default: () => ({
          fontSize: 16,
          fontWeight: 700,
          color: "#111827",
        }),
      },
    },

    fieldColorRuns: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({}),
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

    requestId: {
      type: String,
      default: null,
      index: true,
    },

    requestCode: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

// منع تكرار نفس الرقم لنفس الشركة ولنفس النوع
VoucherSchema.index({ companyKey: 1, mode: 1, seq: 1 }, { unique: true });

export default mongoose.models.Voucher ||
  mongoose.model("Voucher", VoucherSchema);