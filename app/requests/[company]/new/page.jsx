"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import CreateRequestModal from "@/components/CreateRequestModal";
import PageLoader from "@/components/PageLoader";
import { usePermissions } from "@/context/PermissionContext";
import { PERMISSIONS } from "@/lib/permission";

function DuplicateRequestPageContent() {
  const { company } = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { permissions, permissionsLoaded } = usePermissions();
  const sourceId = String(searchParams.get("cloneFrom") || "").trim();
  const [initialData, setInitialData] = useState(null);
  const [error, setError] = useState("");

  const canDuplicate =
    Array.isArray(permissions) &&
    permissions.includes(PERMISSIONS.DUPLICATE_REQUEST);

  useEffect(() => {
    if (!permissionsLoaded) return;
    if (!canDuplicate) {
      router.replace("/home");
      return;
    }
    if (!sourceId) {
      setError("لم يُحدد الطلب المراد تكراره");
      return;
    }

    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(
          `/api/requests/${encodeURIComponent(sourceId)}/clone?company=${encodeURIComponent(company)}`,
          { cache: "no-store", credentials: "include" }
        );
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json?.success) {
          throw new Error(json?.error || "تعذر تحميل بيانات الطلب");
        }
        if (!cancelled) setInitialData(json.data);
      } catch (err) {
        if (!cancelled) setError(err?.message || "تعذر تحميل بيانات الطلب");
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [permissionsLoaded, canDuplicate, sourceId, company, router]);

  if (!permissionsLoaded || (!initialData && !error)) {
    return <PageLoader />;
  }

  if (error) {
    return (
      <div className="mx-auto max-w-lg py-24 text-center" dir="rtl">
        <p className="font-extrabold text-red-700">{error}</p>
        <button
          type="button"
          onClick={() => router.replace(`/requests/${encodeURIComponent(company)}`)}
          className="mt-5 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-extrabold text-white"
        >
          العودة إلى الطلبات
        </button>
      </div>
    );
  }

  return (
    <CreateRequestModal
      open
      mode="clone"
      companyKey={company}
      requestId={sourceId}
      initialData={initialData}
      canCreate={canDuplicate}
      onClose={() => router.replace(`/requests/${encodeURIComponent(company)}`)}
      onCreated={(created) => {
        const newId = created?._id;
        if (newId) {
          router.replace(
            `/requests/${encodeURIComponent(company)}/${encodeURIComponent(String(newId))}`
          );
        } else {
          router.replace(`/requests/${encodeURIComponent(company)}`);
        }
      }}
    />
  );
}

export default function DuplicateRequestPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <DuplicateRequestPageContent />
    </Suspense>
  );
}
