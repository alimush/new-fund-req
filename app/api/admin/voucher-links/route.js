import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import mongoose from "mongoose";
import dbConnect from "@/lib/mongodb";
import Voucher from "@/models/Voucher";
import User from "@/models/User";
import { getModelForCompany } from "@/models/Request";
import { getAdminWorkflowAccess } from "@/lib/adminRequestsWorkflowCommon";
import { linkVoucherToRequest } from "@/lib/voucher/linkVoucherToRequest";
import {
  voucherLookupCompanyKeysForAdmin,
} from "@/lib/voucher/resolveVoucherCompanyKey";
import {
  buildRequestsNeedingVoucherLinkPipeline,
  toAdminLinkRequestRow,
} from "@/lib/voucher/adminVoucherLinkList";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function escapeRegex(s) {
  return String(s || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function requireManageAccess() {
  const cookieStore = await cookies();
  const userIdRaw = cookieStore.get("userId")?.value;
  if (!userIdRaw || !mongoose.Types.ObjectId.isValid(userIdRaw)) {
    return { error: NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 }) };
  }
  const userId = new mongoose.Types.ObjectId(userIdRaw);
  const { allowedCompanies, hasManage } = await getAdminWorkflowAccess(userId);
  if (!hasManage) {
    return { error: NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 }) };
  }
  return { userId: userIdRaw, allowedCompanies };
}

/**
 * GET ?resource=requests|vouchers
 * requests: company, requestCode, page, pageSize
 * vouchers: companyKey (request company), q, requestId (لإظهار وصل هذا الطلب أيضاً)
 */
export async function GET(req) {
  try {
    await dbConnect();
    const auth = await requireManageAccess();
    if (auth.error) return auth.error;

    const { searchParams } = new URL(req.url);
    const resource = searchParams.get("resource") || "requests";

    if (resource === "vouchers") {
      const requestCompany = String(searchParams.get("companyKey") || "").trim();
      const requestId = String(searchParams.get("requestId") || "").trim();
      const q = String(searchParams.get("q") || "").trim();

      if (!requestCompany) {
        return NextResponse.json({ success: false, error: "companyKey مطلوب" }, { status: 400 });
      }

      const vKeys = voucherLookupCompanyKeysForAdmin(requestCompany);
      const unlinkedOr = {
        $and: [
          {
            $or: [
              { requestId: null },
              { requestId: "" },
              { requestId: { $exists: false } },
            ],
          },
          {
            $or: [
              { requestCode: null },
              { requestCode: "" },
              { requestCode: { $exists: false } },
            ],
          },
        ],
      };

      const forThisRequest =
        requestId && mongoose.Types.ObjectId.isValid(requestId)
          ? {
              $or: [
                { requestId },
                { requestId: new mongoose.Types.ObjectId(requestId) },
              ],
            }
          : null;

      const linkFilter = forThisRequest
        ? { $or: [unlinkedOr, forThisRequest] }
        : unlinkedOr;

      const base = {
        companyKey: { $in: vKeys },
        $and: [
          linkFilter,
          {
            $or: [
              { mode: "payment" },
              { mode: { $exists: false } },
              { mode: null },
              { mode: "" },
            ],
          },
        ],
      };

      if (q) {
        const seqNum = Number(String(q).replace(/^0+/, "") || q);
        const orSearch = [{ voucherNo: { $regex: escapeRegex(q), $options: "i" } }];
        if (Number.isFinite(seqNum) && seqNum > 0) {
          orSearch.push({ seq: seqNum });
        }
        base.$and.push({ $or: orSearch });
      }

      const docs = await Voucher.find(base)
        .sort({ createdAt: -1 })
        .limit(40)
        .select("voucherNo seq amount currency description createdAt requestId requestCode companyKey")
        .lean();

      return NextResponse.json({
        success: true,
        data: docs.map((d) => ({
          _id: String(d._id),
          voucherNo: d.voucherNo || (d.seq != null ? String(d.seq).padStart(5, "0") : ""),
          seq: d.seq,
          amount: d.amount,
          currency: d.currency,
          description: d.description || "",
          createdAt: d.createdAt,
          companyKey: d.companyKey,
          requestId: d.requestId ? String(d.requestId) : "",
          requestCode: d.requestCode || "",
          isLinked: Boolean(d.requestId || d.requestCode),
        })),
      });
    }

    const company = String(searchParams.get("company") || "").trim();
    const requestCode = String(searchParams.get("requestCode") || "").trim();
    const page = Math.max(1, Number(searchParams.get("page") || 1));
    const pageSize = Math.min(100, Math.max(10, Number(searchParams.get("pageSize") || 25)));

    let companies = auth.allowedCompanies;
    if (company) {
      if (!companies.includes(company)) {
        return NextResponse.json({ success: false, error: "Forbidden company" }, { status: 403 });
      }
      companies = [company];
    }

    const pipeline = buildRequestsNeedingVoucherLinkPipeline({ requestCode });
    const allRows = [];

    for (const ck of companies) {
      const Model = getModelForCompany(ck);
      const batch = await Model.aggregate(pipeline);
      allRows.push(...batch.map((d) => ({ ...d, companyKey: d.companyKey || ck })));
    }

    allRows.sort((a, b) => {
      const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return tb - ta;
    });

    const total = allRows.length;
    const totalPages = total ? Math.ceil(total / pageSize) : 0;
    const start = (page - 1) * pageSize;
    const slice = allRows.slice(start, start + pageSize).map(toAdminLinkRequestRow);

    return NextResponse.json({
      success: true,
      data: slice,
      meta: { total, totalPages, page, pageSize },
      filters: { companies: auth.allowedCompanies },
    });
  } catch (err) {
    console.error("admin voucher-links GET:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Server error" },
      { status: 500 }
    );
  }
}

/** POST { requestCompanyKey, requestId, voucherId } */
export async function POST(req) {
  try {
    await dbConnect();
    const auth = await requireManageAccess();
    if (auth.error) return auth.error;

    const body = await req.json();
    const requestCompanyKey = String(body?.requestCompanyKey || "").trim();
    const requestId = String(body?.requestId || "").trim();
    const voucherId = String(body?.voucherId || "").trim();

    if (!requestCompanyKey || !requestId || !voucherId) {
      return NextResponse.json(
        { success: false, error: "requestCompanyKey و requestId و voucherId مطلوبة" },
        { status: 400 }
      );
    }

    if (!auth.allowedCompanies.includes(requestCompanyKey)) {
      return NextResponse.json({ success: false, error: "Forbidden company" }, { status: 403 });
    }

    const actor = await User.findById(auth.userId).select("username").lean();
    const result = await linkVoucherToRequest({
      requestCompanyKey,
      requestId,
      voucherId,
      userId: auth.userId,
      username: actor?.username || "",
    });

    if (!result?.ok) {
      const messages = {
        invalid_ids: "معرّفات غير صالحة",
        voucher_not_found: "الوصل غير موجود",
        request_not_found: "الطلب غير موجود",
        voucher_linked_to_other_request: "هذا الوصل مربوط بطلب آخر",
        voucher_mismatch: "الوصل لا يطابق هذا الطلب",
      };
      return NextResponse.json(
        {
          success: false,
          error: messages[result?.reason] || result?.reason || "فشل الربط",
          reason: result?.reason,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "تم ربط الوصل بالطلب",
      voucherNo: result.voucherNo,
    });
  } catch (err) {
    console.error("admin voucher-links POST:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Server error" },
      { status: 500 }
    );
  }
}
