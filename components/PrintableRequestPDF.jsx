"use client";
import React, { useMemo } from "react";

/** ✅ نفس جدول الشركات اللي عندك */
const COMPANIES = [
  { key: "Al-Ghadeer", name: "طلبات الغدير", logo: "/الغدير.png" },
  { key: "Al-Rida", name: "طلبات الرضا", logo: "/الرضا.png" },
  { key: "alleanza", name: "طلبات اليانزا", logo: "/اليانزا.png" },
  { key: "Al-Mezan", name: "طلبات الميزان", logo: "/الميزان.png" },
  { key: "Badur-Baghdad", name: "طلبات بدور بغداد", logo: "/بدور_بغداد.png" },
  { key: "Ghadeer-Karbala", name: "طلبات غدير كربلاء", logo: "/غدير_كربلاء.png" },
  { key: "Tiba-Al-najaf", name: "طلبات طيبة النجف", logo: "/طيبة_النجف.png" },
  { key: "badur-Al-najaf", name: "طلبات بدور النجف", logo: "/بدور_النجف.png" },
  { key: "010", name: "test", logo: "/12.png" },
  { key: "RYD", name: "رياض", logo: "" },
];

const getLogoByKey = (companyKey) => {
  const c = COMPANIES.find((x) => String(x.key) === String(companyKey));
  return c?.logo || "/image3.png";
};

const formatDate = (dateString) => {
  if (!dateString) return "---";
  const d = new Date(dateString);
  return isNaN(d.getTime())
    ? "---"
    : d.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
};

/** ✅ توحيد كل الحالات */
const normalizeStatus = (status) => {
  const s = String(status || "").toLowerCase().trim();

  if (s === "canceled") return "Cancelled"; // US
  if (s === "cancelled") return "Cancelled"; // UK
  if (s === "approved") return "Approved";
  if (s === "pending") return "Pending";
  if (s === "rejected") return "Rejected";

  return status || "---";
};

const statusBadge = (status, sizeClass = "text-[11px]") => {
  const st = normalizeStatus(status);

  const colorMap = {
    Approved: "text-green-600",
    Pending: "text-yellow-600",
    Rejected: "text-red-600",
    Cancelled: "text-gray-600",
  };

  return (
    <span
      className={`inline-block px-2 py-0.5 ${sizeClass} rounded ${
        colorMap[st] || "text-gray-600"
      }`}
    >
      {st}
    </span>
  );
};

export default function PrintableRequestPDF({ request, companyKey }) {
  if (!request) return null;

  const currencySymbol = request?.currency === "USD" ? "USD" : "د.ع";

  const items = useMemo(() => {
    const arr = Array.isArray(request?.items) ? request.items : [];
    return arr.map((it) => ({
      name: it.desc ?? it.name ?? "-",
      quantity: Number(it.qty ?? it.quantity ?? 0),
      price: Number(it.price ?? 0),
    }));
  }, [request]);

  const total = useMemo(() => {
    return items.reduce((sum, it) => sum + it.quantity * it.price, 0);
  }, [items]);

  const steps = useMemo(() => {
    const s = request?.workflow?.steps;
    return Array.isArray(s) ? s : [];
  }, [request]);

  const companyLabel =
    request?.company || request?._oldProjectName || companyKey || "---";

  /** ✅ نطبّع حالة الطلب مرة وحدة */
  const reqStatus = normalizeStatus(request?.status);
  const isReqCancelled = reqStatus === "Cancelled";

  /** ✅ نفس دزاين الورك فلو مال PrintableFundRequest بالضبط */
  const stepCard = (step, idx) => {
    const base =
      "border rounded-lg shadow-sm p-2 flex flex-col gap-0.5 items-center ";

    // ✅ إذا الطلب ملغي => كل الخطوات تصير ملغية (رصاصي)
    const stepStatus = normalizeStatus(step?.status);
    const st = isReqCancelled ? "Cancelled" : stepStatus;

    const state =
      st === "Approved"
        ? "bg-green-50 border-green-300"
        : st === "Pending"
        ? "bg-yellow-50 border-yellow-300"
        : st === "Rejected"
        ? "bg-red-50 border-red-300"
        : st === "Cancelled"
        ? "bg-gray-100 border-gray-300"
        : "bg-white border-gray-200";

    const approverName =
      step?.actedBy?.username ||
      step?.users?.[0]?.username ||
      step?.approvers?.[0]?.name ||
      "---";

    const level = step?.level ?? idx + 1;

    return (
      <div key={idx} className={`${base} ${state}`}>
        <div className="text-[10px] font-bold leading-tight">
          الخطوة {level}
        </div>

        <div className="text-[10px] font-medium leading-tight">
          {approverName}
        </div>

        {statusBadge(st, "text-[10px] leading-tight")}

        {(step?.approvedAt || step?.actedAt) && (
          <div className="text-[9px] leading-tight">
            {formatDate(step.approvedAt || step.actedAt)}
          </div>
        )}

        {(step?.comments || step?.comment) && (
          <div className="text-[9px] leading-tight text-gray-700 text-center">
            {step.comments || step.comment}
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      dir="rtl"
      className="mx-auto bg-white px-12 pt-8 pb-16 font-[Arial] text-black text-sm"
      style={{ width: "297mm", boxSizing: "border-box" }}
    >
      {/* ================= HEADER ================= */}
      <table className="w-full table-fixed border-collapse mb-8 text-black text-sm">
        <tbody>
          <tr>
            {/* Left */}
            <td className="w-1/3 bg-white p-0 align-top">
              <table className="w-full bg-gray-50 border-collapse">
                <tbody>
                  <tr>
                    <td className="px-2 py-2 pl-2 pr-2 pb-4 border border-gray-600 font-semibold">
                      <strong>التاريخ:</strong>
                    </td>
                    <td className="px-2 py-2 pl-2 pr-2 pb-4 border border-gray-600">
                      {formatDate(request.createdAt)}
                    </td>
                  </tr>

                  <tr>
                    <td className="px-2 py-2 pl-2 pr-2 pb-4 border border-gray-600 font-semibold">
                      <strong>الحالة :</strong>
                    </td>
                    <td className="px-2 py-2 pl-2 pr-2 pb-4 border border-gray-600">
                      {statusBadge(reqStatus)}
                    </td>
                  </tr>

                  <tr>
                    <td className="px-2 py-2 pl-2 pr-2 pb-4 border border-gray-600 font-semibold">
                      <strong>رمز المستند :</strong>
                    </td>
                    <td className="px-2 py-2 pl-2 pr-2 pb-4 border border-gray-600">
                      {request.requestCode || request.code || request._id}
                    </td>
                  </tr>
                </tbody>
              </table>
            </td>

            {/* ✅ Logo (بالنص مضبوط) */}
            <td className="w-1/3 bg-white p-0 align-middle">
              <div className="w-full h-full flex items-center justify-center py-2">
                <img
                  src={getLogoByKey(companyKey)}
                  alt="شعار الشركة"
                  crossOrigin="anonymous"
                  className="max-w-full max-h-32 object-contain"
                  onError={(e) => {
                    e.currentTarget.src = "/image3.png";
                  }}
                />
              </div>
            </td>

            {/* Right */}
            <td className="w-1/3 bg-white p-0 align-top">
              <table className="w-full bg-gray-50 border-collapse">
                <tbody>
                  <tr>
                    <td className="px-2 py-2 pl-2 pr-2 pb-4 border border-gray-600 font-semibold">
                      <strong>الشركة :</strong>
                    </td>
                    <td className="px-2 py-2 pl-2 pr-2 pb-4 border border-gray-600">
                      {companyLabel}
                    </td>
                  </tr>

                  <tr>
                    <td className="px-2 py-2 pl-2 pr-2 pb-4 border border-gray-600 font-semibold">
                      <strong>القسم :</strong>
                    </td>
                    <td className="px-2 py-2 pl-2 pr-2 pb-4 border border-gray-600">
                      {request.department || "---"}
                    </td>
                  </tr>

                  <tr>
                    <td className="px-2 py-2 pl-2 pr-2 pb-4 border border-gray-600 font-semibold">
                      <strong>مقدم الطلب :</strong>
                    </td>
                    <td className="px-2 py-2 pl-2 pr-2 pb-4 border border-gray-600">
                      {request.createdBy || "---"}
                    </td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>
        </tbody>
      </table>

      {/* ================= MAIN TABLE ================= */}
      <table className="w-full border border-gray-600 text-center text-sm mb-10 border-separate">
        <thead>
          <tr className="bg-gray-50">
            <th
              colSpan={1}
              className="border pl-2 pr-2 pb-4 text-right w-1/5 align-middle"
            >
              <strong>نوع الطلب :</strong>{" "}
              <span className="font-normal">{request.requestType || "---"}</span>
            </th>

            <th
              colSpan={4}
              className="border pl-2 pr-2 pb-4 text-right w-4/5 align-middle"
            >
              <strong>الوصف :</strong>{" "}
              <span className="font-normal">{request.description || "---"}</span>
            </th>
          </tr>

          <tr className="bg-gray-100">
            <th
              colSpan={5}
              className="border pl-2 pr-2 pb-4 text-right align-middle"
            >
              <strong>الملاحظات :</strong>{" "}
              <span className="font-normal">
                {request.notes || request.note || "---"}
              </span>
            </th>
          </tr>

          <tr className="bg-slate-200">
            <th className="border pl-2 pr-2 pb-4 w-10 align-middle">ت</th>
            <th className="border pl-2 pr-2 pb-4 text-right align-middle">
              التفاصيل
            </th>
            <th className="border pl-2 pr-2 pb-4 w-24 align-middle">العدد</th>
            <th className="border pl-2 pr-2 pb-4 w-32 align-middle">
              سعر المفرد
            </th>
            <th className="border pl-2 pr-2 pb-4 w-32 align-middle">المجموع</th>
          </tr>
        </thead>

        <tbody>
          {items.map((it, i) => (
            <tr key={i} className={i % 2 ? "bg-slate-50" : ""}>
              <td className="border pl-2 pr-2 pb-4 font-bold align-middle">
                {i + 1}
              </td>
              <td className="border pl-2 pr-2 pb-4 text-right align-middle">
                {it.name}
              </td>
              <td className="border pl-2 pr-2 pb-4 align-middle">
                {it.quantity}
              </td>
              <td className="border pl-2 pr-2 pb-4 align-middle">
                {Number(it.price || 0).toLocaleString()} {currencySymbol}
              </td>
              <td className="border pl-2 pr-2 pb-4 align-middle">
                {(it.quantity * it.price).toLocaleString()} {currencySymbol}
              </td>
            </tr>
          ))}

          <tr className="bg-slate-200 font-bold">
            <td
              colSpan={4}
              className="border pl-2 pr-2 pb-4 text-right align-middle"
            >
              الإجمالي
            </td>
            <td className="border pl-2 pr-2 pb-4 align-middle">
              {Number(total || 0).toLocaleString()} {currencySymbol}
            </td>
          </tr>
        </tbody>
      </table>

      {/* ================= WORKFLOW ================= */}
      <h3 className="text-lg font-semibold text-center mb-12">الموافقات</h3>

      <div className="flex flex-wrap justify-center gap-2 mb-26 text-center text-xs">
        {steps.map((step, i) => stepCard(step, i))}
      </div>
      
    </div>
  );
}