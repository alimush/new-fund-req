import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import { cookies } from "next/headers";
import { getModelForCompany } from "@/models/Request";

function calcTotal(items = []) {
  return items.reduce((sum, it) => {
    const qty = Number(it?.qty) || 0;
    const price = Number(it?.price) || 0;
    return sum + qty * price;
  }, 0);
}

// POST /api/vouchers
// body: { company, requestId }
export async function POST(req) {
  try {
    await dbConnect();

    const cookieStore = await cookies();
    const userId = cookieStore.get("userId")?.value;

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { company, requestId } = body || {};

    if (!company || !requestId) {
      return NextResponse.json(
        { success: false, error: "company and requestId are required" },
        { status: 400 }
      );
    }

    const Model = getModelForCompany(company);
    const request = await Model.findById(requestId);

    if (!request) {
      return NextResponse.json(
        { success: false, error: "Request not found" },
        { status: 404 }
      );
    }

    // لازم يكون Approved نهائي
    if (String(request.status || "").toLowerCase() !== "approved") {
      return NextResponse.json(
        { success: false, error: "Voucher allowed only after final approval" },
        { status: 400 }
      );
    }

    // لازم آخر خطوة Approved
    const steps = request?.workflow?.steps || [];
    const lastIdx = steps.length - 1;

    if (lastIdx < 0) {
      return NextResponse.json(
        { success: false, error: "No workflow steps" },
        { status: 400 }
      );
    }

    const lastStep = steps[lastIdx];
    if (!lastStep || String(lastStep.status || "") !== "Approved") {
      return NextResponse.json(
        { success: false, error: "Last step must be Approved" },
        { status: 400 }
      );
    }

    // صلاحية: نفس ناس آخر خطوة (نفس منطقك)
    const isAllowed =
      Array.isArray(lastStep.users) &&
      lastStep.users.some((u) => String(u) === String(userId));

    if (!isAllowed) {
      return NextResponse.json(
        { success: false, error: "Not authorized to generate voucher" },
        { status: 403 }
      );
    }

    // بيانات من الريكويست نفسه
    const total = calcTotal(request.items || []);
    const currency = String(request.currency || "").toUpperCase();

    // مبلغاً وقدره: نخزنه نص بسيط (تبدله بدالة أقوى لاحقاً)
    const amountWords = `${Math.round(total)} ${
      currency === "USD" ? "دولار" : "دينار"
    } فقط لا غير`;

    // خزّن الوصل داخل الريكويست
    request.paymentVoucher = {
      date: request.createdAt ? new Date(request.createdAt) : new Date(),
      receiverName: String(request.createdBy || ""),
      description: String(request.description || ""),
      amount: total,
      currency,
      amountWords,
      createdByUserId: userId,
      createdAt: new Date(),
    };

    request.approvalHistory?.push?.({
      user: userId,
      action: "voucher",
      note: "Payment voucher generated",
      date: new Date(),
    });

    await request.save();

    return NextResponse.json({ success: true, data: request.paymentVoucher });
  } catch (err) {
    console.error("❌ VOUCHER API Error:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}