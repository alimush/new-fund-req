import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import mongoose from "mongoose";
import { getModelForCompany } from "../route"; // مهم جداً

export async function POST(req, { params }) {
  try {
    await dbConnect();

    const { id } = params;
    const body = await req.json();

    const { company, user, action, note } = body;

    if (!company || !user || !action)
      return NextResponse.json({ success: false, error: "Missing fields" });

    const Model = getModelForCompany(company);
    const request = await Model.findById(id);

    if (!request)
      return NextResponse.json({ success: false, error: "Request not found" });

    // -------- GET WORKFLOW FOR COMPANY --------
    const Workflow = mongoose.models.Workflow;
    const wf = await Workflow.findOne({ company }).populate("steps.user");

    if (!wf)
      return NextResponse.json({ success: false, error: "No workflow found" });

    const steps = wf.steps;

    // ------ ensure request has workflow states ------
    if (!request.workflowSteps || request.workflowSteps.length === 0) {
      request.workflowSteps = steps.map((s) => ({
        user: s.user._id,
        status: "Pending",
      }));
      request.currentStep = 0;
    }

    const current = request.currentStep;

    // 🛑 check if this user is allowed
    if (String(request.workflowSteps[current].user) !== String(steps[current].user._id)) {
      return NextResponse.json({
        success: false,
        error: "You are not allowed to act on this step",
      });
    }

    // -------- HANDLE APPROVE --------
    if (action === "approve") {
      request.workflowSteps[current].status = "Approved";

      if (current + 1 < request.workflowSteps.length) {
        request.currentStep = current + 1;
        request.status = "Pending";
      } else {
        request.status = "Approved"; // Final approve
      }
    }

    // -------- HANDLE REJECT --------
    if (action === "reject") {
      request.workflowSteps[current].status = "Rejected";

      if (current - 1 >= 0) {
        request.currentStep = current - 1; // يرجع خطوة
        request.status = "Pending";
      } else {
        request.status = "Rejected"; // أول خطوة رفض
      }
    }

    // -------- HANDLE CANCEL --------
    if (action === "cancel") {
      if (request.createdBy !== user)
        return NextResponse.json({ success: false, error: "Only creator can cancel" });

      request.status = "Cancelled";
    }

    // -------- push history --------
    request.approvalHistory.push({
      user,
      action,
      note,
    });

    await request.save();

    return NextResponse.json({ success: true, data: request });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message });
  }
}