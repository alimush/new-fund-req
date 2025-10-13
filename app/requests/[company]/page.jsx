"use client";
import { useParams } from "next/navigation";
import RequestsPage from "@/components/RequestsPage";

export default function CompanyRequestsPage() {
  const { company } = useParams();
  return <RequestsPage companyKey={company} />;
}
