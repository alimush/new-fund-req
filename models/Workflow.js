import mongoose from "mongoose";

const StepSchema = new mongoose.Schema(
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

    actedAt: {
      type: Date,
      default: null,
    },

    comment: {
      type: String,
      default: "",
      trim: true,
    },
  },
  { _id: false }
);

const WorkflowSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    company: {
      type: String,
      required: true,
      unique: true, // ✔️ Workflow واحد فقط لكل شركة
      trim: true,
    },

    steps: {
      type: [StepSchema],
      default: [],
    },
  },
  { timestamps: true }
);

export default mongoose.models.Workflow ||
  mongoose.model("Workflow", WorkflowSchema);
