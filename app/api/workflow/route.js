import dbConnect from "@/lib/mongodb";
import Workflow from "@/models/workflow";

// ======================= GET =======================
export async function GET(req) {
  await dbConnect();

  const { searchParams } = new URL(req.url);
  const company = searchParams.get("company");
  const id = searchParams.get("id");

  const populateUser = {
    path: "steps.user",
    model: "User",
    strictPopulate: false,
  };

  // 🟦 Get workflow by ID
  if (id) {
    const wf = await Workflow.findById(id).populate(populateUser);
    return Response.json({ success: true, workflow: wf });
  }

  // 🟦 Get workflow by company
  if (company) {
    const wf = await Workflow.findOne({ company }).populate(populateUser);
    return Response.json({ success: true, workflow: wf });
  }

  // 🟦 Get all workflows
  const all = await Workflow.find().populate(populateUser);
  return Response.json({ success: true, workflows: all });
}

// ======================= POST =======================
export async function POST(req) {
  await dbConnect();

  const body = await req.json();

  const exists = await Workflow.findOne({
    company: body.company,
    name: body.name,
  });

  if (exists) {
    return Response.json({
      success: false,
      error: "Workflow already exists for this company",
    });
  }

  const created = await Workflow.create({
    name: body.name,
    company: body.company,
    steps: body.steps || [],
  });

  return Response.json({ success: true, workflow: created });
}

// ======================= PUT =======================
export async function PUT(req) {
  await dbConnect();
  const body = await req.json();

  const populateUser = {
    path: "steps.user",
    model: "User",
    strictPopulate: false,
  };

  const updated = await Workflow.findByIdAndUpdate(
    body.id,
    { steps: body.steps },
    { new: true }
  ).populate(populateUser);

  return Response.json({ success: true, workflow: updated });
}

// ======================= DELETE =======================
export async function DELETE(req) {
  await dbConnect();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id)
    return Response.json({ success: false, error: "ID is required" });

  await Workflow.findByIdAndDelete(id);

  return Response.json({ success: true, message: "Workflow deleted" });
}