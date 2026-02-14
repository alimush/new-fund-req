import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";

import { getModelForCompany } from "@/models/Request";

import Request from "@/models/Request"; // عدل المسار حسب موديلك\


import User from "@/models/User";
import nodemailer from "nodemailer";
import mongoose from "mongoose";

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

function buildSubject({ action, companyKey, requestId, stepIndex }) {
  const a = action === "approve" ? "APPROVED" : action === "reject" ? "REJECTED" : action?.toUpperCase();
  return `[Workflow] Request ${a} | ${companyKey || ""} | ${requestId} | Step ${stepIndex + 1}`;
}

function buildHtml({ action, request, targetStepIndex, actorUsername, note }) {
  const actionTxt = action === "approve" ? "Approved" : action === "reject" ? "Rejected" : action;
  const reqTitle = request?.requestType || "Request";
  const company = request?.company || "-";
  const amount = request?.items?.reduce((s, it) => s + (Number(it.qty)||0)*(Number(it.price)||0), 0) ?? "";

  return `
  <div style="font-family:Arial,sans-serif;line-height:1.6">
    <h2 style="margin:0 0 10px">Workflow Update</h2>
    <p><b>Action:</b> ${actionTxt}</p>
    <p><b>By:</b> ${actorUsername || "System"}</p>
    <p><b>Company:</b> ${company}</p>
    <p><b>Type:</b> ${reqTitle}</p>
    ${amount !== "" ? `<p><b>Total:</b> ${amount}</p>` : ""}
    <p><b>Next Step:</b> Step ${targetStepIndex + 1}</p>
    ${note ? `<p><b>Note:</b><br/>${String(note).replaceAll("\n", "<br/>")}</p>` : ""}
    <hr/>
    <p style="color:#666;font-size:12px">This email was sent automatically from the workflow system.</p>
  </div>`;
}

function getTransporter() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || "587");
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    throw new Error("Missing SMTP env vars (SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS)");
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

export async function POST(req) {
  try {
    await dbConnect();

    const body = await req.json();
    const { requestId, companyKey, action, stepIndex, actorUserId, note } = body || {};

    if (!requestId || !companyKey || !action || stepIndex === undefined || stepIndex === null) {
      return NextResponse.json(
        { success: false, error: "Missing requestId/companyKey/action/stepIndex" },
        { status: 400 }
      );
    }
    if (!isValidObjectId(requestId)) {
      return NextResponse.json({ success: false, error: "Invalid requestId" }, { status: 400 });
    }

    const requestDoc = await Request.findOne({ _id: requestId, companyKey }).lean();
    if (!requestDoc) {
      return NextResponse.json({ success: false, error: "Request not found" }, { status: 404 });
    }

    const steps = requestDoc?.workflow?.steps || [];
    const currentIdx = Number(stepIndex);

    // ✅ نحدد منو يستلم الإيميل
    let targetStepIndex = null;

    if (action === "approve") {
      // الخطوة الجاية
      if (currentIdx + 1 < steps.length) targetStepIndex = currentIdx + 1;
    } else if (action === "reject") {
      // الخطوة السابقة
      if (currentIdx - 1 >= 0) targetStepIndex = currentIdx - 1;
    } else {
      return NextResponse.json({ success: false, error: "action must be approve or reject" }, { status: 400 });
    }

    // إذا ماكو خطوة (مثلاً آخر خطوة approve)
    if (targetStepIndex === null) {
      return NextResponse.json({ success: true, skipped: true, message: "No target step to notify" });
    }

    const targetUsersIds = steps?.[targetStepIndex]?.users || [];
    if (!Array.isArray(targetUsersIds) || targetUsersIds.length === 0) {
      return NextResponse.json({ success: true, skipped: true, message: "Target step has no users" });
    }

    // جيب ايميلات اليوزرز
    const users = await User.find({ _id: { $in: targetUsersIds } })
      .select("username email")
      .lean();

    const emails = users.map((u) => u.email).filter(Boolean);

    if (emails.length === 0) {
      return NextResponse.json({ success: true, skipped: true, message: "No emails found for target users" });
    }

    let actorUsername = "";
    if (actorUserId && isValidObjectId(actorUserId)) {
      const actor = await User.findById(actorUserId).select("username").lean();
      actorUsername = actor?.username || "";
    }

    const transporter = getTransporter();
    const from = process.env.MAIL_FROM || process.env.SMTP_USER;

    const subject = buildSubject({ action, companyKey, requestId, stepIndex: currentIdx });
    const html = buildHtml({
      action,
      request: requestDoc,
      targetStepIndex,
      actorUsername,
      note,
    });

    const info = await transporter.sendMail({
      from,
      to: emails.join(","),
      subject,
      html,
    });

    return NextResponse.json({
      success: true,
      targetStepIndex,
      to: emails,
      messageId: info.messageId,
    });
  } catch (err) {
    console.error("❌ notify error:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Notify failed" },
      { status: 500 }
    );
  }
}
