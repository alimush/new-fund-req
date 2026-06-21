import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import { cookies } from "next/headers";
import ChequeBranch from "@/models/ChequeBranch";
import { isValidChequeTemplateKey } from "@/lib/cheques/templates";
import {
  branchPublicDto,
  dedupeBranchesList,
  isBranchedTemplateKey,
  normalizeBranchKey,
} from "@/lib/cheques/chequeBranches";
import {
  dedupeChequeBranchesInDb,
  ensureBranchesSeeded,
} from "@/lib/cheques/seedChequeBranches";
import { requireChequeAccess, requireManagePermissions } from "@/lib/cheques/chequeAuth";

export const runtime = "nodejs";

export async function GET(req) {
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

    const { searchParams } = new URL(req.url);
    const templateKey = String(searchParams.get("templateKey") || "").trim();
    const branchKey = normalizeBranchKey(searchParams.get("branchKey"));

    if (!isValidChequeTemplateKey(templateKey)) {
      return NextResponse.json(
        { success: false, error: "قالب غير صالح" },
        { status: 400 }
      );
    }

    if (isBranchedTemplateKey(templateKey)) {
      await ensureBranchesSeeded(templateKey);
    }

    if (branchKey) {
      await dedupeChequeBranchesInDb(templateKey);
      const one = await ChequeBranch.findOne({
        templateKey,
        branchKey,
        active: { $ne: false },
      }).lean();
      if (!one) {
        return NextResponse.json(
          { success: false, error: "الفرع غير موجود" },
          { status: 404 }
        );
      }
      return NextResponse.json({
        success: true,
        branch: branchPublicDto(one),
      });
    }

    const list = await ChequeBranch.find({
      templateKey,
      active: { $ne: false },
    })
      .sort({ sortOrder: 1, name: 1, updatedAt: -1 })
      .lean();

    const branches = dedupeBranchesList(list.map(branchPublicDto));

    return NextResponse.json({
      success: true,
      templateKey,
      branches,
    });
  } catch (err) {
    console.error("❌ Cheque branches GET:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}

export async function POST(req) {
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

    const access = await requireManagePermissions(userId);
    if (!access.ok) return access.res;

    const body = await req.json();
    const templateKey = String(body?.templateKey || "").trim();
    const branchKey = normalizeBranchKey(body?.branchKey);

    if (!isBranchedTemplateKey(templateKey) || !branchKey) {
      return NextResponse.json(
        { success: false, error: "بيانات فرع غير صالحة" },
        { status: 400 }
      );
    }

    const name = String(body?.name || "").trim();
    const image = String(body?.image || "").trim();
    if (!name || !image) {
      return NextResponse.json(
        { success: false, error: "الاسم ومسار الصورة مطلوبان" },
        { status: 400 }
      );
    }

    const doc = await ChequeBranch.findOneAndUpdate(
      { templateKey, branchKey },
      {
        templateKey,
        branchKey,
        name,
        image,
        drawerName: String(body?.drawerName || "").trim(),
        branchLabel: String(body?.branchLabel || "الرئيسي").trim(),
        accountNumber: String(body?.accountNumber || "").trim(),
        sortOrder: Number(body?.sortOrder) || 0,
        active: body?.active !== false,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();

    return NextResponse.json({
      success: true,
      branch: branchPublicDto(doc),
    });
  } catch (err) {
    console.error("❌ Cheque branches POST:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
