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

    // 🔍 تأكد من الحقول الأساسية
    if (!company || !user || !action)
      return NextResponse.json({ success: false, error: "Missing fields" });

    // 🟦 تحميل موديل الطلب حسب الشركة
    const Model = getModelForCompany(company);
    const request = await Model.findById(id);

    if (!request)
      return NextResponse.json({ success: false, error: "Request not found" });

    // 🟦 تحميل الورك فلو من موديل Workflow
    const Workflow = mongoose.models.Workflow;
    const wf = await Workflow.findOne({ company }).populate("steps.user");

    if (!wf)
      return NextResponse.json({ success: false, error: "No workflow found" });

    const steps = wf.steps;

    // 🧱 إنشاء workflowSteps داخل الطلب إذا أول مرة
    if (!request.workflowSteps || request.workflowSteps.length === 0) {
      request.workflowSteps = steps.map((s) => ({
        user: s.user._id.toString(),
        username: s.user.username,
        status: "Pending",
      }));
      request.currentStep = 0;
    }

    const current = request.currentStep;

    // 🔐 حماية — فقط صاحب الخطوة الحالية يحق له تنفيذ الإجراء
    const stepUserId = request.workflowSteps[current].user;

    if (String(stepUserId) !== String(user)) {
      return NextResponse.json({
        success: false,
        error: "You are not allowed to act on this step",
      });
    }

    // 🟢 -------- HANDLE APPROVE --------
    if (action === "approve") {
      request.workflowSteps[current].status = "Approved";

      // إذا أكو خطوة بعدها → ننتقل إليها
      if (current + 1 < request.workflowSteps.length) {
        request.currentStep = current + 1;
        request.status = "Pending";
      } else {
        // 🔥 تريدها فقط Approved وليس Completed
        request.status = "Approved";
      }
    }

    // 🔴 -------- HANDLE REJECT --------
    if (action === "reject") {
      request.workflowSteps[current].status = "Rejected";
      request.status = "Rejected"; // ينهي الطلب مباشرة
    }

    // 🟡 -------- HANDLE CANCEL --------
    if (action === "cancel") {
      if (request.createdBy !== user)
        return NextResponse.json({
          success: false,
          error: "Only creator can cancel",
        });

      request.status = "Cancelled";
    }

    // 📝 -------- تسجيل التاريخ --------
    request.approvalHistory.push({
      user,
      action,
      note,
      date: new Date(),
    });

    await request.save();

    return NextResponse.json({ success: true, data: request });

  } catch (err) {
    return NextResponse.json({ success: false, error: err.message });
  }
}