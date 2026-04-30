"use client";

import { createContext, useContext, useEffect, useState } from "react";

const PermissionContext = createContext();

export function PermissionProvider({ children }) {
  const [user, setUser] = useState(null);
  const [permissions, setPermissions] = useState([]);
  const [companies, setCompanies] = useState([]);

  const logoutToLogin = () => {
    localStorage.clear();
    setUser(null);
    setPermissions([]);
    setCompanies([]);

    if (window.location.pathname !== "/login") {
      window.location.href = "/login";
    }
  };

  const load = async () => {
    const userId = localStorage.getItem("userId");
    const username = localStorage.getItem("username");

    if (!userId) return;

    try {
      const res = await fetch(`/api/user-permissions?id=${userId}`, {
        cache: "no-store",
      });

      if (res.status === 401) {
        logoutToLogin();
        return;
      }

      const data = await res.json();

      if (data.success) {
        setUser({ id: userId, username });
        setPermissions(data.permissions || []);
        setCompanies(data.companies || []);
      } else {
        setPermissions([]);
        setCompanies([]);
      }
    } catch (err) {
      logoutToLogin();
    }
  };

  useEffect(() => {
    load();

    window.addEventListener("userChanged", load);

    // يفحص كل 5 ثواني إذا اليوزر بعده موجود
    const interval = setInterval(load, 5000);

    return () => {
      window.removeEventListener("userChanged", load);
      clearInterval(interval);
    };
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