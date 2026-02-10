"use client";

import useAuthGate from "@/hooks/useAuthGate";

export default function AuthGate({ children }) {
  const allowed = useAuthGate();
  if (!allowed) return null; // يمنع أي render
  return children;
}