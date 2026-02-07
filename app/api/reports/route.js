// app/api/reports/route.js
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import mongoose from "mongoose";
import User from "@/models/User";
import { getModelForCompany } from "@/models/Request";
import { cookies } from "next/headers";
import Permissions from "@/models/Permissions";
import { PERMISSIONS } from "@/lib/permission";

const safeSplit = (v) =>
  String(v || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

async function getUserAccess(userId) {
  if (!userId) return { allowedCompanies: [], allowedPerms: [] };

  const groups = await Permissions.find({ users: userId })
    .select("companies permissions")
    .lean();

  const companiesSet = new Set();
  const permsSet = new Set();

  for (const g of groups) {
    (g.companies || []).forEach((c) => companiesSet.add(String(c).trim()));
    (g.permissions || []).forEach((p) => permsSet.add(String(p).trim()));
  }

  return {
    allowedCompanies: Array.from(companiesSet).filter(Boolean),
    allowedPerms: Array.from(permsSet).filter(Boolean),
  };
}

export async function GET(req) {
  try {
    await dbConnect();

    const cookieStore = await cookies();
    const userId = cookieStore.get("userId")?.value;    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { allowedCompanies, allowedPerms } = await getUserAccess(userId);

    // ✅ لازم يمتلك VIEW_REPORTS
    if (!allowedPerms.includes(PERMISSIONS.VIEW_REPORTS)) {
      return NextResponse.json(
        { success: false, error: "Forbidden: missing VIEW_REPORTS permission" },
        { status: 403 }
      );
    }

    // إذا ما عنده شركات => رجع فاضي
    if (!allowedCompanies.length) {
      return NextResponse.json({
        success: true,
        filters: {
          companies: [],
          users: [],
          currencies: [],
          statuses: [],
          pendingUsers: [],
        },
        data: [],
      });
    }

    const { searchParams } = new URL(req.url);

    // ✅ Mode: return requestCode suggestions for ONE company
    const codesMode = searchParams.get("codes") === "1";
    if (codesMode) {
      const company = (searchParams.get("company") || "").trim(); // companyKey
      const q = (searchParams.get("q") || "").trim(); // search text

      if (!company) {
        return NextResponse.json(
          { success: false, error: "company is required" },
          { status: 400 }
        );
      }

      // ✅ ممنوع يطلب أكواد لشركة مو ضمن صلاحياته
      if (!allowedCompanies.includes(company)) {
        return NextResponse.json(
          { success: false, error: "Forbidden company" },
          { status: 403 }
        );
      }

      const Model = getModelForCompany(company);

      const cond = {};
      if (q) cond.requestCode = { $regex: q, $options: "i" };

      const codes = await Model.distinct("requestCode", cond);

      const data = (codes || [])
        .filter(Boolean)
        .sort()
        .slice(0, 50)
        .map((c) => ({ value: c, label: c }));

      return NextResponse.json({ success: true, data });
    }

    // ========= Query Params (Filters) =========
    const companiesParam = searchParams.get("company") || "all"; // all OR a,b,c
    const usersParam = searchParams.get("user") || "all"; // createdBy (string)
    const statusParam = searchParams.get("status") || "all";
    const currencyParam = searchParams.get("currency") || "all";
    const pendingParam = searchParams.get("pending") || "all"; // userId OR all
    const fromDate = searchParams.get("from") || "";
    const toDate = searchParams.get("to") || "";
    const codeParam = (searchParams.get("code") || "").trim();

    // ✅ companyList: إذا all => خليها allowedCompanies، إذا محدد => تقاطع مع allowedCompanies
    let companyList = null;
    if (companiesParam === "all") {
      companyList = allowedCompanies;
    } else {
      const requested = safeSplit(companiesParam);
      companyList = requested.filter((c) => allowedCompanies.includes(c));
    }

    // إذا بعد التقاطع ما بقى شي => فاضي
    if (!companyList.length) {
      return NextResponse.json({
        success: true,
        filters: {
          companies: allowedCompanies,
          users: [],
          currencies: [],
          statuses: [],
          pendingUsers: [],
        },
        data: [],
      });
    }

    const createdByList = usersParam === "all" ? null : safeSplit(usersParam);

    // ========= Build Filters Options =========
    const allCompanies = new Set(companyList); // ✅ فقط المسموح
    const allUsers = new Set();
    const allCurrencies = new Set();
    const allStatuses = new Set();

    // ========= Data =========
    let allResults = [];

    for (const companyKey of companyList) {
      const Model = getModelForCompany(companyKey);

      const query = {};

      if (codeParam) query.requestCode = { $regex: codeParam, $options: "i" };
      if (createdByList) query.createdBy = { $in: createdByList };
      if (statusParam !== "all") query.status = statusParam;
      if (currencyParam !== "all") query.currency = currencyParam;

      if (fromDate || toDate) {
        query.createdAt = {};
        if (fromDate) query.createdAt.$gte = new Date(fromDate);
        if (toDate) query.createdAt.$lte = new Date(toDate);
      }

      const docs = await Model.find(query).lean().sort({ createdAt: -1 });

      // تحديث قوائم الفلاتر
      for (const d of docs) {
        if (d.createdBy) allUsers.add(d.createdBy);
        if (d.currency) allCurrencies.add(d.currency);
        if (d.status) allStatuses.add(d.status);
      }

      // PendingWith + فلتر pendingParam
      for (const d of docs) {
        let pendingWithIds = [];
        let pendingWithNames = [];

        if (
          d?.status === "Pending" &&
          Number.isInteger(d?.currentStep) &&
          d?.workflow?.steps?.length
        ) {
          const st = d.workflow.steps[d.currentStep];
          if (st?.status === "Pending" && Array.isArray(st?.users)) {
            pendingWithIds = st.users.map((u) => String(u));
          }
        }

        if (pendingParam !== "all") {
          if (!pendingWithIds.includes(String(pendingParam))) continue;
        }

        if (pendingWithIds.length > 0) {
          const users = await User.find({ _id: { $in: pendingWithIds } })
            .select("username")
            .lean();
          pendingWithNames = users.map((u) => u.username).filter(Boolean);
        }

        allResults.push({
          ...d,
          companyKey,
          pendingWithIds,
          pendingWithNames,
        });
      }
    }

    const pendingUsers = await User.find({}).select("_id username").lean();

    return NextResponse.json({
      success: true,
      filters: {
        companies: Array.from(allCompanies),
        users: Array.from(allUsers),
        currencies: Array.from(allCurrencies),
        statuses: Array.from(allStatuses),
        pendingUsers: pendingUsers.map((u) => ({
          value: String(u._id),
          label: u.username,
        })),
      },
      data: allResults,
    });
  } catch (err) {
    console.error("❌ Reports API Error:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}