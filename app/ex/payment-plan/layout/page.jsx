"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** صفحة ترتيب الفورمة معطّلة حالياً */
export default function PaymentPlanLayoutPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/ex/payment-plan");
  }, [router]);

  return null;
}
