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

  const load = async (options = {}) => {
    const { silent = false } = options;
    if (!silent) setPermissionsLoaded(false);

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

    const onUserChanged = () => load();
    window.addEventListener("userChanged", onUserChanged);

    const interval = setInterval(() => load({ silent: true }), 5000);

    return () => {
      window.removeEventListener("userChanged", onUserChanged);
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