"use client";
import { useParams } from "next/navigation";
import RequestDetails from "@/components/RequestDetails";

export default function RequestDetailsPage() {
  const { company, id } = useParams(); // يجيب باراميترات الرابط
  return <RequestDetails id={id} companyKey={company} />;
}