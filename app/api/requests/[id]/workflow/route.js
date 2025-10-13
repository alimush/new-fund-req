import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import { getModelForCompany } from "@/models/Request.js"; // ✅ تم تصحيح المسار

export async function POST(req, context) {
  try {
    await dbConnect();
    const { id } = await context.params;
    const { company, user, action, note } = await req.json();

    if (!company || !user || !action)
      return NextResponse.json(
        { success: false, error: "Missing company, user, or action" },
        { status: 400 }
      );

    const Model = getModelForCompany(company);
    const request = await Model.findById(id);
    if (!request)
      return NextResponse.json(
        { success: false, error: "Request not found" },
        { status: 404 }
      );

    // 🧩 تسلسل الخطوات
    const steps = request.workflowSteps || [];
    let currentStep = request.currentStep || 0;

    // 🔹 رفض (يرجع خطوة)
    if (action === "reject") {
      if (currentStep > 0) {
        request.currentStep -= 1;
        request.currentApprover = steps[request.currentStep];
        request.status = "Pending";
      } else {
        request.status = "Rejected"; // أول خطوة تم رفضها
        request.currentApprover = null;
      }
    }

    // 🔹 موافقة (يتقدم خطوة)
    else if (action === "approve") {
      if (currentStep < steps.length - 1) {
        request.currentStep += 1;
        request.currentApprover = steps[request.currentStep];
        request.status = "Pending";
      } else {
        request.status = "Approved"; // آخر خطوة تمت الموافقة عليها
        request.currentApprover = null;
      }
    }

    // 🔹 إلغاء
    else if (action === "cancel") {
      request.status = "Cancelled";
      request.currentApprover = null;
    }

    // 🔹 حفظ الحركة في التاريخ
    request.approvalHistory.push({
      user,
      action,
      note: note || "",
      date: new Date(),
    });

    await request.save();

    // ✅ تحديد الخطوة القادمة أو السابقة
    const nextApprover =
      request.currentApprover || (action === "reject" ? "Previous Step" : "Completed");

    return NextResponse.json({
      success: true,
      message: `Action '${action}' processed successfully`,
      nextApprover,
      data: request,
    });
  } catch (err) {
    console.error("❌ Workflow error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}