import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import { cookies } from "next/headers";
import mongoose from "mongoose";
import Cheque from "@/models/Cheque";
import { requireChequeAccess } from "@/lib/cheques/chequeAuth";

export const runtime = "nodejs";

export async function GET(_req, { params }) {
  try {
    await dbConnect();

    const cookieStore = await cookies();
    const userId = cookieStore.get("userId")?.value;
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const access = await requireChequeAccess(userId);
    if (!access.ok) return access.res;

    const { id: rawId } = await params;
    const id = String(rawId || "").trim();
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, error: "معرّف صك غير صالح" },
        { status: 400 }
      );
    }

    const doc = await Cheque.findById(id).lean();
    if (!doc) {
      return NextResponse.json(
        { success: false, error: "الصك غير موجود" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: doc });
  } catch (err) {
    console.error("❌ Cheque GET by id:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
