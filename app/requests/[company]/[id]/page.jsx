"use client";
import { Suspense } from "react";
import { useParams } from "next/navigation";
import RequestDetails from "@/components/RequestDetails";

function RequestDetailsPageContent() {
  const { company, id } = useParams();
  return <RequestDetails id={id} companyKey={company} />;
}

export default function RequestDetailsPage() {
  return (
    <Suspense
      fallback={
        <div className="py-20 text-center font-bold text-slate-600" dir="rtl">
          جاري التحميل…
        </div>
      }
    >
      <RequestDetailsPageContent />
    </Suspense>
  );
}