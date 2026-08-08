import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { Types } from "mongoose";
import dbConnect from "@/lib/mongodb";
import Permissions from "@/models/Permissions";
import { getModelForCompany } from "@/models/Request";
import { PERMISSIONS } from "@/lib/permission";

export const runtime = "nodejs";

function attachmentUrl(key) {
  if (!key) return "";
  const encoded = String(key)
    .split("/")
    .map(encodeURIComponent)
    .join("/");
  return `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.S3_REGION}.amazonaws.com/${encoded}`;
}

export async function GET(req, { params }) {
  try {
    await dbConnect();

    const cookieStore = await cookies();
    const userId = cookieStore.get("userId")?.value;
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const company = String(searchParams.get("company") || "").trim();

    if (!userId || !Types.ObjectId.isValid(userId)) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }
    if (!company || !Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, error: "بيانات الطلب غير صالحة" },
        { status: 400 }
      );
    }

    const uid = new Types.ObjectId(userId);
    const groups = await Permissions.find({ users: uid })
      .select("companies permissions")
      .lean();
    const hasCompanyAccess = groups.some((group) =>
      (group.companies || []).some(
        (key) => String(key).trim().toLowerCase() === company.toLowerCase()
      )
    );
    const permissions = new Set(
      groups.flatMap((group) => group.permissions || []).map(String)
    );

    if (!hasCompanyAccess) {
      return NextResponse.json(
        { success: false, error: "ليس لديك وصول إلى هذه الشركة" },
        { status: 403 }
      );
    }
    if (!permissions.has(PERMISSIONS.DUPLICATE_REQUEST)) {
      return NextResponse.json(
        { success: false, error: "ليس لديك صلاحية تكرار الطلبات" },
        { status: 403 }
      );
    }

    const Model = getModelForCompany(company);
    const source = await Model.findById(id)
      .select(
        "requestType description currency department expenseType projectName items attachments"
      )
      .lean();

    if (!source) {
      return NextResponse.json(
        { success: false, error: "الطلب الأصلي غير موجود" },
        { status: 404 }
      );
    }

    const attachments = (Array.isArray(source.attachments)
      ? source.attachments
      : []
    ).map((file) => ({
      key: file?.key || "",
      name: file?.name || "",
      type: file?.type || "",
      size: Number(file?.size || 0),
      url: attachmentUrl(file?.key),
    }));

    return NextResponse.json({
      success: true,
      data: {
        requestType: source.requestType || "",
        description: source.description || "",
        currency: source.currency || "",
        department: source.department || "",
        expenseType: source.expenseType || "",
        projectName: source.projectName || "",
        items: Array.isArray(source.items) ? source.items : [],
        attachments,
      },
    });
  } catch (error) {
    console.error("Request clone template GET:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "تعذر تحميل بيانات الطلب" },
      { status: 500 }
    );
  }
}
