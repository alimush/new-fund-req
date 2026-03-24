import mongoose from "mongoose";

const StepSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "GuiUser",   // اسم موديل المستخدم عدّله حسب اسم ملفك
    required: true
  }
});

const WorkflowSchema = new mongoose.Schema({
  name: String,
  company: String,
  steps: [StepSchema],
});

const Workflow =
  mongoose.models.Workflow || mongoose.model("Workflow", WorkflowSchema);

export default Workflow;