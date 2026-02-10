"use client";

import { createContext, useContext, useEffect, useState } from "react";

const PermissionContext = createContext();

export function PermissionProvider({ children }) {
  const [user, setUser] = useState(null);
  const [permissions, setPermissions] = useState([]);
  const [companies, setCompanies] = useState([]); // 🟦 الشركات

  const load = async () => {
    const userId = localStorage.getItem("userId");
    const username = localStorage.getItem("username");

    if (!userId) return;

    setUser({ id: userId, username });

    // جلب صلاحيات + شركات اليوزر
    const res = await fetch(`/api/user-permissions?id=${userId}`);
    const data = await res.json();

    if (data.success) {
      setPermissions(data.permissions || []);
      setCompanies(data.companies || []);   // 🟦 خزن الشركات

      // خزن محلياً

    }
  };

  useEffect(() => {
    load();
    window.addEventListener("userChanged", load);
    return () => window.removeEventListener("userChanged", load);
  }, []);

  return (
    <PermissionContext.Provider value={{ user, permissions, companies }}>
      {children}
    </PermissionContext.Provider>
  );
}

export function usePermissions() {
  return useContext(PermissionContext);
}