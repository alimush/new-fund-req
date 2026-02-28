// app/(...)/ex/payment-plans/[id]/page.jsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toPng } from "html-to-image";
import {
  FiArrowLeft,
  FiInfo,
  FiUser,
  FiCalendar,
  FiList,
  FiImage,
  FiPrinter,
  FiX,
  FiUsers,
  FiCheckCircle,
  FiClock,
  FiXCircle,
  FiSend,
  FiMessageSquare,
} from "react-icons/fi";
import { useRouter, useParams } from "next/navigation";

/* =================== HARD KEY (مؤقتاً) =================== */
const PAGE_KEY = "exceptions";

/* =================== نفس ثوابت الـ Generator =================== */
const TEMPLATE_IMG = "/payment-plan-a4.jpg";
const pct = (p) => ({ top: `${p.top}%`, left: `${p.left}%` });
const MAX_ROWS_PER_PAGE = 15;

async function waitForImages(node) {
  const imgs = Array.from(node.querySelectorAll("img"));
  await Promise.all(
    imgs.map((img) => {
      if (img.complete && img.naturalWidth > 0) return Promise.resolve();
      return new Promise((resolve) => {
        img.addEventListener("load", resolve, { once: true });
        img.addEventListener("error", resolve, { once: true });
      });
    })
  );
}

function ymdToDMY(v) {
  if (!v) return "";
  if (String(v).includes("/")) return v;
  const s = String(v);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return v;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

const fmtInt = (n) => new Intl.NumberFormat("en-US").format(Number(n || 0));

/* =================== POS =================== */
const POS = {
  salesEmp: { top: 10.5, left: 2.5, width: 28, height: 3.8 },
  date: { top: 10.5, left: 48, width: 18, height: 3.8 },
  customer: { top: 13.6, left: 3, width: 28, height: 3.8 },
  unitNo: { top: 13.6, left: 47.5, width: 18, height: 3.8 },

  table: {
    startTop: 30,
    rowH: 3.2,
    colPayType: { left: 9.5, width: 22, height: 1 },
    colAmount: { left: 33.0, width: 18, height: 1 },
    colDate: { left: 52.5, width: 15, height: 1 },
  },

  discount: { top: 79, left: 7, width: 39, height: 3.6 },
};

const rowTop = (i) => POS.table.startTop + i * POS.table.rowH;

function printAllPngs(pngs) {
  if (!pngs?.length) return;

  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) return;

  const imgsHtml = pngs.map((src) => `<div class="page"><img src="${src}" /></div>`).join("");

  doc.open();
  doc.write(`
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Print</title>
        <style>
          @page { size: A4; margin: 0; }
          html, body { margin:0; padding:0; }
          .page { width: 210mm; height: 297mm; page-break-after: always; }
          img { width: 210mm; height: 297mm; display:block; }
        </style>
      </head>
      <body>
        ${imgsHtml}
        <script>
          const imgs = Array.from(document.images);
          let loaded = 0;
          function done(){
            window.focus();
            window.print();
            setTimeout(()=>window.close(), 50);
          }
          if(!imgs.length){ done(); }
          imgs.forEach(im=>{
            if(im.complete){ loaded++; if(loaded===imgs.length) done(); return; }
            im.onload = ()=>{ loaded++; if(loaded===imgs.length) done(); };
            im.onerror = ()=>{ loaded++; if(loaded===imgs.length) done(); };
          });
        </script>
      </body>
    </html>
  `);
  doc.close();

  setTimeout(() => {
    try {
      document.body.removeChild(iframe);
    } catch {}
  }, 2500);
}

/* =================== STATUS BADGE =================== */
function StatusBadge({ status }) {
  const s = String(status || "Pending").toLowerCase();

  let text = status || "Pending";
  let cls = "bg-amber-50 text-amber-800 border-amber-200";

  if (s === "approved") {
    cls = "bg-green-50 text-green-800 border-green-200";
    text = "Approved";
  } else if (s === "rejected") {
    cls = "bg-red-50 text-red-800 border-red-200";
    text = "Rejected";
  } else if (s === "cancelled" || s === "canceled") {
    cls = "bg-gray-100 text-gray-700 border-gray-200";
    text = "Cancelled";
  } else if (s === "pending") {
    cls = "bg-amber-50 text-amber-800 border-amber-200";
    text = "Pending";
  }

  return (
    <span className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-semibold border ${cls}`}>
      <span className="h-2 w-2 rounded-full bg-current opacity-60" />
      {text}
    </span>
  );
}

/* =================== COMMENT MODAL (مثل تصميمك) =================== */
function CommentModal({ open, title, subtitle, submitLabel, onClose, onSubmit, loading }) {
  const [text, setText] = useState("");

  useEffect(() => {
    if (open) setText("");
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="w-full max-w-lg rounded-2xl bg-white shadow-2xl overflow-hidden"
            initial={{ y: 18, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 12, opacity: 0, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 160, damping: 18 }}
          >
            <div className="p-4 border-b flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-black text-gray-900 flex items-center gap-2">
                  <FiMessageSquare /> {title}
                </div>
                {subtitle ? <div className="mt-1 text-xs text-gray-600">{subtitle}</div> : null}
              </div>

              <button
                onClick={loading ? undefined : onClose}
                className="shrink-0 px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center gap-2"
              >
                <FiX /> Close
              </button>
            </div>

            <div className="p-4">
              <label className="block text-xs font-bold text-gray-700 mb-2">Comment (اختياري)</label>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={5}
                className="w-full rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-200 p-3 text-sm"
                placeholder="اكتب ملاحظة / سبب..."
                disabled={loading}
              />
            </div>

            <div className="p-4 border-t bg-white flex justify-end gap-2">
              <button
                onClick={loading ? undefined : onClose}
                className="px-4 py-2 rounded-xl font-bold bg-gray-100 hover:bg-gray-200"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                onClick={() => onSubmit(text)}
                className="px-4 py-2 rounded-xl font-black bg-black text-white hover:bg-gray-900 flex items-center gap-2 disabled:opacity-60"
                disabled={loading}
              >
                <FiSend /> {submitLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default function PaymentPlanDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id;

  const [status, setStatus] = useState("loading");
  const [plan, setPlan] = useState(null);
  const [workflow, setWorkflow] = useState(null);
  const [errMsg, setErrMsg] = useState("");

  const [currentUser, setCurrentUser] = useState(null);
  const [acting, setActing] = useState(false);

  const [showPreview, setShowPreview] = useState(false);
  const [previewPngs, setPreviewPngs] = useState([]);
  const [building, setBuilding] = useState(false);

  const [actionModal, setActionModal] = useState({ open: false, action: null, stepIndex: null });

  const pageRefs = useRef([]);
  pageRefs.current = [];
  const setPageRef = (i) => (el) => {
    if (el) pageRefs.current[i] = el;
  };

  // ===================== GET PLAN (يجلب plan + workflow + currentUser) =====================
  useEffect(() => {
    if (!id) return;
    let alive = true;

    (async () => {
      try {
        setStatus("loading");
        setErrMsg("");

        const res = await fetch(`/api/ex/payment-plans/${id}?key=${encodeURIComponent(PAGE_KEY)}`, {
          cache: "no-store",
          credentials: "include",
        });
        const j = await res.json().catch(() => ({}));
        if (!alive) return;

        if (!res.ok || !j?.success) {
          setPlan(null);
          setWorkflow(null);
          setCurrentUser(null);
          setStatus(res.status === 404 ? "notfound" : "error");
          setErrMsg(j?.error || "Not found");
          return;
        }

        setPlan(j.data);
        setWorkflow(j.workflow ?? j.data?.workflow ?? null);
        setCurrentUser(j.currentUser || null);
        setStatus("ready");
      } catch (e) {
        if (!alive) return;
        setStatus("error");
        setErrMsg(e?.message || "Server error");
      }
    })();

    return () => {
      alive = false;
    };
  }, [id]);

  const cleanedRows = useMemo(() => {
    return (plan?.rows || [])
      .map((r) => ({
        payType: String(r.payType || "").trim(),
        amount: String(r.amount || "").trim(),
        payDateYMD: String(r.payDateYMD || "").trim(),
      }))
      .filter((r) => r.payType || r.amount || r.payDateYMD);
  }, [plan]);

  const totalAmount = useMemo(() => {
    return cleanedRows.reduce((sum, r) => {
      const n = Number(String(r.amount || "0").replace(/,/g, ""));
      return sum + (isFinite(n) ? n : 0);
    }, 0);
  }, [cleanedRows]);

  const pages = useMemo(() => {
    const chunks = [];
    const all = cleanedRows || [];
    for (let i = 0; i < all.length; i += MAX_ROWS_PER_PAGE) chunks.push(all.slice(i, i + MAX_ROWS_PER_PAGE));
    return chunks.length ? chunks : [[]];
  }, [cleanedRows]);

  const buildPagePngs = async () => {
    const nodes = pageRefs.current.filter(Boolean);
    if (!nodes.length) return [];
    for (const n of nodes) await waitForImages(n);

    const pngs = [];
    for (const node of nodes) {
      const dataUrl = await toPng(node, {
        cacheBust: true,
        pixelRatio: 3,
        backgroundColor: "#ffffff",
      });
      pngs.push(dataUrl);
    }
    return pngs;
  };

  const openPreview = async () => {
    setShowPreview(true);
    setBuilding(true);
    try {
      const pngs = await buildPagePngs();
      setPreviewPngs(pngs);
    } finally {
      setBuilding(false);
    }
  };

  const doPrint = async () => {
    setBuilding(true);
    try {
      const pngs = await buildPagePngs();
      printAllPngs(pngs);
    } finally {
      setBuilding(false);
    }
  };

  const workflowSteps = useMemo(() => (Array.isArray(workflow?.steps) ? workflow.steps : []), [workflow]);

  const submitAction = async (noteText) => {
    if (!actionModal?.action || actionModal?.stepIndex == null) return;

    setActing(true);
    try {
      const res = await fetch(`/api/ex/payment-plans/${id}?key=${encodeURIComponent(PAGE_KEY)}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: actionModal.action,
          note: noteText || "",
          stepIndex: actionModal.stepIndex,
          key: PAGE_KEY,
        }),
      });

      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j?.success) {
        if (res.status === 409) {
          alert("صار تحديث بالخطة، رح نسوي Refresh");
          window.location.reload();
          return;
        }
        alert(j?.error || "Action failed");
        return;
      }

      setPlan(j.data);
      setWorkflow(j.workflow ?? j.data?.workflow ?? null);
      setActionModal({ open: false, action: null, stepIndex: null });
    } finally {
      setActing(false);
    }
  };

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-screen bg-transparent">
        <div className="w-12 h-12 border-4 border-gray-300 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (status === "notfound") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-gray-700 bg-transparent">
        <div className="font-black">Payment Plan not found</div>
        <button onClick={() => router.back()} className="mt-4 px-4 py-2 bg-gray-800 text-white rounded-xl">
          Back
        </button>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-gray-700 bg-transparent">
        <div className="font-black">Error</div>
        <div className="text-sm mt-2 text-gray-600">{errMsg || "Server error"}</div>
        <button onClick={() => router.back()} className="mt-4 px-4 py-2 bg-gray-800 text-white rounded-xl">
          Back
        </button>
      </div>
    );
  }

  return (
    <motion.div
      className="min-h-screen bg-transparent p-6 md:p-10"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.45 }}
    >
      <div className="max-w-6xl mx-auto">
        {/* ========== Offscreen Render Area (للصور/الطباعة) ========== */}
        <div className="sr-only" aria-hidden="true">
          {pages.map((rowsChunk, pageIdx) => (
            <div
              key={pageIdx}
              ref={setPageRef(pageIdx)}
              className="relative bg-white overflow-hidden"
              style={{ width: 900, aspectRatio: "210/297" }}
            >
              <img src={TEMPLATE_IMG} alt="template" className="absolute inset-0 w-full h-full object-contain" draggable={false} />

              <div className="absolute inset-0 text-gray-900">
                {!!plan?.salesEmp && (
                  <div className="absolute font-extrabold" style={{ ...pct(POS.salesEmp), width: `${POS.salesEmp.width}%`, fontSize: 16, direction: "rtl", textAlign: "right" }}>
                    {plan.salesEmp}
                  </div>
                )}

                {!!plan?.dateDMY && (
                  <div className="absolute font-extrabold" style={{ ...pct(POS.date), width: `${POS.date.width}%`, fontSize: 16, direction: "rtl", textAlign: "right" }}>
                    {plan.dateDMY}
                  </div>
                )}

                {!!plan?.customer && (
                  <div className="absolute font-extrabold" style={{ ...pct(POS.customer), width: `${POS.customer.width}%`, fontSize: 16, direction: "rtl", textAlign: "right" }}>
                    {plan.customer}
                  </div>
                )}

                {!!plan?.unitNo && (
                  <div className="absolute font-extrabold" style={{ ...pct(POS.unitNo), width: `${POS.unitNo.width}%`, fontSize: 16, direction: "rtl", textAlign: "right" }}>
                    {plan.unitNo}
                  </div>
                )}

                {rowsChunk.map((r, i) => {
                  const top = rowTop(i);
                  return (
                    <div key={`${pageIdx}_${i}`}>
                      {!!r.payType && (
                        <div className="absolute font-bold" style={{ top: `${top}%`, left: `${POS.table.colPayType.left}%`, width: `${POS.table.colPayType.width}%`, fontSize: 14, direction: "rtl", textAlign: "center" }}>
                          {r.payType}
                        </div>
                      )}

                      {!!r.amount && (
                        <div className="absolute font-bold" style={{ top: `${top}%`, left: `${POS.table.colAmount.left}%`, width: `${POS.table.colAmount.width}%`, fontSize: 14, direction: "ltr", textAlign: "center" }}>
                          {fmtInt(String(r.amount).replace(/,/g, ""))}
                        </div>
                      )}

                      {!!r.payDateYMD && (
                        <div className="absolute font-bold" style={{ top: `${top}%`, left: `${POS.table.colDate.left}%`, width: `${POS.table.colDate.width}%`, fontSize: 14, direction: "rtl", textAlign: "center" }}>
                          {ymdToDMY(r.payDateYMD)}
                        </div>
                      )}
                    </div>
                  );
                })}

                {pageIdx === pages.length - 1 && !!plan?.discount && (
                  <div className="absolute font-extrabold" style={{ ...pct(POS.discount), width: `${POS.discount.width}%`, fontSize: 15, direction: "rtl", textAlign: "center" }}>
                    {plan.discount}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* =================== HEADER (مثل تصميمك) =================== */}
        <div className="mb-10">
          <div className="flex items-center justify-between">
            <StatusBadge status={plan?.status || "Pending"} />

            <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
              <FiInfo className="text-blue-600" /> Payment Plan Details
            </h1>

            <button
              onClick={() => router.back()}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gray-800 text-white hover:bg-gray-900 shadow"
            >
              <FiArrowLeft /> Back
            </button>
          </div>

          {/* Action Buttons */}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              onClick={openPreview}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition shadow disabled:opacity-60"
              disabled={building}
            >
              <FiImage />
              <span className="text-sm font-semibold">Preview</span>
            </button>

            <button
              onClick={doPrint}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-900 text-white hover:bg-black transition shadow disabled:opacity-60"
              disabled={building}
            >
              <FiPrinter />
              <span className="text-sm font-semibold">Print</span>
            </button>

            {(building || acting) && <div className="text-sm text-gray-600">جارِ التنفيذ…</div>}
          </div>
        </div>

        {/* =================== SUMMARY (نفس الستايل) =================== */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
          <motion.div
            className="rounded-3xl bg-white/35 backdrop-blur-2xl ring-1 ring-white/25 shadow-[0_18px_45px_-25px_rgba(0,0,0,0.35)] p-6"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-gray-700">
              <FiInfo /> معلومات الخطة
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-gray-700">
              <div className="rounded-2xl transition-all duration-300 hover:-translate-y-1 hover:bg-white/45 hover:shadow-[0_12px_30px_-15px_rgba(0,0,0,0.35)]">
                <Info label="ID" value={plan?._id} icon={<FiInfo />} />
              </div>

              <div className="rounded-2xl transition-all duration-300 hover:-translate-y-1 hover:bg-white/45 hover:shadow-[0_12px_30px_-15px_rgba(0,0,0,0.35)]">
                <Info label="الزبون" value={plan?.customer} icon={<FiUser />} />
              </div>

              <div className="rounded-2xl transition-all duration-300 hover:-translate-y-1 hover:bg-white/45 hover:shadow-[0_12px_30px_-15px_rgba(0,0,0,0.35)]">
                <Info label="رقم الوحدة" value={plan?.unitNo} icon={<FiInfo />} />
              </div>

              <div className="rounded-2xl transition-all duration-300 hover:-translate-y-1 hover:bg-white/45 hover:shadow-[0_12px_30px_-15px_rgba(0,0,0,0.35)]">
                <Info label="التاريخ" value={plan?.dateDMY || (plan?.createdAt ? new Date(plan.createdAt).toLocaleString() : "-")} icon={<FiCalendar />} />
              </div>

              <div className="rounded-2xl transition-all duration-300 hover:-translate-y-1 hover:bg-white/45 hover:shadow-[0_12px_30px_-15px_rgba(0,0,0,0.35)]">
                <Info label="موظف المبيعات" value={plan?.salesEmp} icon={<FiUser />} />
              </div>

              <div className="rounded-2xl transition-all duration-300 hover:-translate-y-1 hover:bg-white/45 hover:shadow-[0_12px_30px_-15px_rgba(0,0,0,0.35)]">
                <Info label="الخصم" value={plan?.discount} icon={<FiInfo />} />
              </div>
            </div>
          </motion.div>

          <motion.div
            className="rounded-3xl bg-white/35 backdrop-blur-2xl ring-1 ring-white/25 shadow-[0_18px_45px_-25px_rgba(0,0,0,0.35)] p-6"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-gray-700">
              <FiList /> ملخص الدفعات
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-gray-700">
              <div className="rounded-2xl transition-all duration-300 hover:-translate-y-1 hover:bg-white/45 hover:shadow-[0_12px_30px_-15px_rgba(0,0,0,0.35)]">
                <Info label="عدد الصفوف" value={String(cleanedRows.length || 0)} icon={<FiList />} />
              </div>

              <div className="rounded-2xl transition-all duration-300 hover:-translate-y-1 hover:bg-white/45 hover:shadow-[0_12px_30px_-15px_rgba(0,0,0,0.35)]">
                <Info label="عدد الصفحات" value={String(pages.length || 1)} icon={<FiList />} />
              </div>

              <div className="rounded-2xl transition-all duration-300 hover:-translate-y-1 hover:bg-white/45 hover:shadow-[0_12px_30px_-15px_rgba(0,0,0,0.35)] sm:col-span-2">
                <Info label="المجموع" value={fmtInt(totalAmount)} icon={<FiInfo />} />
              </div>
            </div>
          </motion.div>
        </div>

        {/* =================== ROWS (نفس ستايل Items) =================== */}
        <Section title="الدفعات" icon={<FiList />}>
          <div
            className="
              relative overflow-hidden
              rounded-3xl
              bg-white/55 backdrop-blur-2xl
              ring-1 ring-black/5
              shadow-[0_18px_45px_-28px_rgba(0,0,0,0.22)]
            "
          >
            {/* soft glow */}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/70 via-white/20 to-transparent opacity-90" />
            <div className="pointer-events-none absolute -top-10 -left-10 h-40 w-40 rounded-full bg-white/70 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-12 -right-12 h-44 w-44 rounded-full bg-white/50 blur-3xl" />

            <div className="relative overflow-x-auto">
              <div className="max-h-[420px] overflow-y-auto">
                <table className="min-w-full text-sm text-slate-900">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-white/70 backdrop-blur border-b border-black/5 text-[11px] uppercase tracking-wider text-slate-700">
                      <th className="px-5 py-4 text-center font-black w-[40%]">نوع الدفعة</th>
                      <th className="px-5 py-4 text-center font-black w-[30%]">المبلغ</th>
                      <th className="px-5 py-4 text-center font-black w-[30%]">التاريخ</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-black/5">
                    {cleanedRows.length ? (
                      cleanedRows.map((r, i) => (
                        <tr
                          key={i}
                          className={[
                            "transition-colors hover:bg-slate-900/[0.03]",
                            i % 2 === 0 ? "bg-white/35" : "bg-transparent",
                          ].join(" ")}
                        >
                          <td className="px-5 py-4 text-center font-extrabold text-slate-900">{r.payType || "-"}</td>
                          <td className="px-5 py-4 text-center tabular-nums text-slate-800 font-semibold">
                            {r.amount ? fmtInt(String(r.amount).replace(/,/g, "")) : "-"}
                          </td>
                          <td className="px-5 py-4 text-center text-slate-700">
                            {r.payDateYMD ? ymdToDMY(r.payDateYMD) : "-"}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={3} className="px-5 py-12 text-center text-slate-500 italic">
                          No rows
                        </td>
                      </tr>
                    )}
                  </tbody>

                  {cleanedRows.length ? (
                    <tfoot className="sticky bottom-0 z-10">
                      <tr className="bg-white/75 backdrop-blur border-t border-black/5">
                        <td className="px-5 py-4 text-right font-black text-slate-700" colSpan={2}>
                          Total
                        </td>
                        <td className="px-5 py-4 text-center">
                          <span className="inline-flex items-center justify-center px-4 py-2 rounded-2xl bg-white ring-1 ring-black/5 font-black text-lg text-slate-900 shadow-sm">
                            {fmtInt(totalAmount)}
                          </span>
                        </td>
                      </tr>
                    </tfoot>
                  ) : null}
                </table>
              </div>
            </div>
          </div>
        </Section>

        {/* ================= WORKFLOW (نفس تصميمك تماماً) ================= */}
        {workflow && (
          <Section title={`Workflow: ${workflow?.name || ""}`} icon={<FiUsers />}>
            {workflowSteps.length === 0 && (
              <p className="text-gray-500 italic text-center py-6">No workflow steps found.</p>
            )}

            {workflowSteps.length > 0 && (
              <div className="relative">
                <div className="pointer-events-none absolute left-0 top-0 h-full w-10 bg-gradient-to-r from-white/60 to-transparent z-10" />
                <div className="pointer-events-none absolute right-0 top-0 h-full w-10 bg-gradient-to-l from-white/60 to-transparent z-10" />

                <div className="flex items-start gap-6 overflow-x-auto py-6 px-1">
                  {workflowSteps.map((step, idx) => {
                    const lastIdx = workflowSteps.length - 1;
                    const planStatus = String(plan?.status || "").toLowerCase();
                    const stepStatus = String(step?.status || "Pending");
                    const stepStatusLower = stepStatus.toLowerCase();

                    const isCurrent = idx === Number(plan?.currentStep);
                    const isCancelled = planStatus === "cancelled" || planStatus === "canceled";

                    const canAct =
                      planStatus === "pending" &&
                      isCurrent &&
                      stepStatusLower === "pending" &&
                      currentUser &&
                      step?.users?.some((u) => String(u?._id) === String(currentUser?._id));

                    const hasComment = !!(step?.comment && String(step.comment).trim());
                    const hasAttach =
                      (Array.isArray(step?.tagAttachments) && step.tagAttachments.length > 0) || !!step?.tag;

                    const actedName =
                      step?.actedBy?.username || step?.actedBy?.name || step?.actedBy?.email || "";

                    const cardBase = `
                      relative min-w-[320px] rounded-3xl p-6
                      bg-white/40 backdrop-blur-2xl
                      ring-1 ring-white/25
                      shadow-[0_18px_45px_-28px_rgba(0,0,0,0.25)]
                      transition
                    `;

                    const cardHover = isCancelled
                      ? "cursor-not-allowed opacity-80"
                      : "cursor-default hover:bg-white/55 hover:ring-white/40";

                    const currentRing = isCurrent && !isCancelled ? "ring-2 ring-blue-200/70" : "";

                    return (
                      <div key={idx} className="flex items-center gap-5">
                        <motion.div
                          whileHover={isCancelled ? {} : { y: -3 }}
                          transition={{ duration: 0.2 }}
                          className={`${cardBase} ${cardHover} ${currentRing}`}
                        >
                          <div className="pointer-events-none absolute inset-0 rounded-3xl bg-gradient-to-br from-white/45 via-transparent to-transparent opacity-80" />

                          {(hasComment || hasAttach) && !isCancelled && (
                            <div className="absolute top-3 right-3 flex items-center gap-1 text-blue-700/80">
                              <FiMessageSquare className="text-lg" />
                              <span className="text-xs font-medium">View</span>
                            </div>
                          )}

                          {/* HEADER */}
                          <div className="relative flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                              <div
                                className={`h-11 w-11 rounded-2xl flex items-center justify-center text-white font-bold
                                  ${isCancelled ? "bg-gray-500" : isCurrent ? "bg-blue-600" : "bg-gray-800"}
                                `}
                              >
                                {idx + 1}
                              </div>

                              <div>
                                <p className="font-semibold text-gray-800">الخطوة {idx + 1}</p>

                                <div className="mt-1">
                                  <StatusBadge status={isCancelled ? "cancelled" : stepStatus} />
                                </div>

                                {step?.actedAt && (
                                  <div className="mt-2 text-xs text-gray-600 flex items-center gap-2">
                                    <FiCalendar className="text-gray-500" />
                                    <span className="font-semibold">Acted At:</span>
                                    <span>{new Date(step.actedAt).toLocaleString()}</span>
                                  </div>
                                )}

                                {!!actedName && (
                                  <div className="mt-1 text-xs text-gray-600 flex items-center gap-2">
                                    <FiUser className="text-gray-500" />
                                    <span className="font-semibold">By:</span>
                                    <span>{actedName}</span>
                                  </div>
                                )}
                              </div>
                            </div>

                            {isCancelled ? (
                              <FiXCircle className="text-gray-400 text-lg" />
                            ) : stepStatus === "Approved" ? (
                              <FiCheckCircle className="text-green-600 text-lg" />
                            ) : stepStatus === "Rejected" ? (
                              <FiXCircle className="text-red-600 text-lg" />
                            ) : (
                              <FiClock className="text-amber-600 text-lg" />
                            )}
                          </div>

                          {/* USERS */}
                          <div className="relative space-y-3">
                            {(step.users || []).map((user, uidx) => {
                              const username = user?.username || user?.name || user?.email || "User";

                              const acted =
                                stepStatusLower !== "pending" &&
                                step?.actedBy &&
                                (String(step.actedBy?._id) === String(user?._id) ||
                                  String(step.actedBy?.username) === String(user?.username) ||
                                  String(step.actedBy?.email) === String(user?.email));

                              const rowBase =
                                "flex items-center gap-3 p-3 rounded-2xl " +
                                "bg-white/45 backdrop-blur ring-1 ring-black/5";

                              const avatarBg = isCancelled
                                ? "bg-gray-500"
                                : acted
                                ? stepStatus === "Approved"
                                  ? "bg-green-600"
                                  : "bg-red-600"
                                : "bg-gray-800";

                              return (
                                <div key={user?._id || `${idx}_${uidx}`} className={rowBase}>
                                  <div className={`h-9 w-9 rounded-2xl flex items-center justify-center font-bold text-white ${avatarBg}`}>
                                    {String(username).charAt(0).toUpperCase()}
                                  </div>

                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-gray-800 truncate">{username}</p>
                                    {acted && <p className="text-xs text-gray-600">Took Action</p>}
                                  </div>

                                  {acted && !isCancelled && <StatusBadge status={stepStatus} />}
                                </div>
                              );
                            })}
                          </div>

                          {/* ACTIONS */}
                          {canAct && !isCancelled && (
                            <div className="mt-5 flex gap-3">
                              <button
                                disabled={acting}
                                onClick={() => setActionModal({ open: true, action: "approve", stepIndex: idx })}
                                className="flex-1 py-2.5 rounded-2xl bg-green-600 hover:bg-green-700 text-white font-semibold shadow-sm disabled:opacity-60"
                              >
                                Approve
                              </button>

                              <button
                                disabled={acting}
                                onClick={() => setActionModal({ open: true, action: "reject", stepIndex: idx })}
                                className="flex-1 py-2.5 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-semibold shadow-sm disabled:opacity-60"
                              >
                                Reject
                              </button>
                            </div>
                          )}
                        </motion.div>

                        {idx !== workflowSteps.length - 1 && (
                          <div className="text-3xl text-gray-400/60 select-none">→</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </Section>
        )}

        {/* PREVIEW MODAL */}
        <AnimatePresence>
          {showPreview && (
            <motion.div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <motion.div
                className="w-full max-w-md sm:max-w-2xl lg:max-w-3xl rounded-2xl bg-white shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
                initial={{ y: 24, opacity: 0, scale: 0.98 }}
                animate={{ y: 0, opacity: 1, scale: 1 }}
                exit={{ y: 18, opacity: 0, scale: 0.98 }}
                transition={{ type: "spring", stiffness: 140, damping: 18 }}
              >
                <div className="p-3 border-b flex items-center justify-between">
                  <div className="font-black text-gray-900 flex items-center gap-2">
                    <FiImage /> Preview (A4)
                  </div>

                  <button
                    onClick={() => {
                      setShowPreview(false);
                      setPreviewPngs([]);
                    }}
                    className="px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center gap-2"
                  >
                    <FiX /> Close
                  </button>
                </div>

                <div className="flex-1 bg-gray-50 overflow-y-auto">
                  {building && !previewPngs.length ? (
                    <div className="h-full flex items-center justify-center text-gray-600">جارِ تجهيز المعاينة…</div>
                  ) : previewPngs.length ? (
                    <div className="p-2 space-y-3">
                      {previewPngs.map((src, i) => (
                        <div key={i} className="w-full bg-white rounded-xl shadow overflow-hidden aspect-[210/297]">
                          <img src={src} alt={`page_${i + 1}`} className="w-full h-full object-contain block" />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="h-full flex items-center justify-center text-gray-600">ماكو معاينة (تأكد البيانات موجودة)</div>
                  )}
                </div>

                <div className="p-3 border-t flex justify-end gap-2 bg-white">
                  <button onClick={doPrint} className="px-4 py-2 rounded-xl font-black flex items-center gap-2 bg-black text-white hover:bg-gray-900" disabled={building}>
                    <FiPrinter /> Print
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* COMMENT MODAL FOR APPROVE/REJECT */}
        <CommentModal
          open={!!actionModal?.open}
          title={actionModal?.action === "approve" ? "Approve Step" : "Reject Step"}
          subtitle={actionModal?.action === "approve" ? "اكتب ملاحظة (اختياري) ثم Submit" : "اكتب سبب الرفض (اختياري) ثم Submit"}
          submitLabel="Submit"
          onClose={() => (acting ? null : setActionModal({ open: false, action: null, stepIndex: null }))}
          onSubmit={submitAction}
          loading={acting}
        />
      </div>
    </motion.div>
  );
}

/* =================== نفس الـ Info/Section اللي عندك =================== */
function Info({ label, value, icon }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-white/35 backdrop-blur ring-1 ring-white/25 p-3 shadow-sm">
      <div className="text-gray-500 text-lg">{icon}</div>
      <div>
        <div className="text-xs text-gray-500">{label}</div>
        <div className="font-medium text-gray-800">{value || "-"}</div>
      </div>
    </div>
  );
}

function Section({ title, icon, children }) {
  return (
    <motion.div
      className="p-6 mb-8 rounded-3xl bg-white/35 backdrop-blur-2xl ring-1 ring-white/25 shadow-[0_18px_45px_-25px_rgba(0,0,0,0.35)] overflow-hidden"
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-gray-700">
        {icon} {title}
      </h2>
      {children}
    </motion.div>
  );
}