"use client";

import { createContext, useContext, useEffect, useState } from "react";

const PermissionContext = createContext();

export function PermissionProvider({ children }) {
  const [user, setUser] = useState(null);
  const [permissions, setPermissions] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [permissionsLoaded, setPermissionsLoaded] = useState(false);

  const logoutToLogin = () => {
    setUser(null);
    setPermissions([]);
    setCompanies([]);
    setPermissionsLoaded(true);

    if (window.location.pathname !== "/login") {
      window.location.href = "/login";
    }
  };

  const load = async () => {
    try {
      const res = await fetch("/api/user-permissions", {
        cache: "no-store",
      });

      if (res.status === 401) {
        logoutToLogin();
        return;
      }

      const data = await res.json();

      if (data.success) {
        setUser(data.user || null);
        setPermissions(data.permissions || []);
        setCompanies(data.companies || []);
      } else {
        setUser(null);
        setPermissions([]);
        setCompanies([]);
      }
    } catch (err) {
      logoutToLogin();
    } finally {
      setPermissionsLoaded(true);
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
    <PermissionContext.Provider
      value={{ user, permissions, companies, permissionsLoaded }}
    >
      {children}
    </PermissionContext.Provider>
  );
}

export function usePermissions() {
  return useContext(PermissionContext);
}