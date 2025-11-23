"use client";

import { createContext, useContext, useEffect, useState } from "react";

const PermissionContext = createContext();

export function PermissionProvider({ children }) {
  const [user, setUser] = useState(null);
  const [permissions, setPermissions] = useState([]);

  const load = async () => {
    const userId = localStorage.getItem("userId");
    const username = localStorage.getItem("username");

    if (!userId) return;

    setUser({ id: userId, username });

    const res = await fetch(`/api/user-permissions?id=${userId}`);
    const data = await res.json();

    if (data.success) {
      setPermissions(data.permissions);
      localStorage.setItem("permissions", JSON.stringify(data.permissions));
    }
  };

  useEffect(() => {
    load();
    window.addEventListener("userChanged", load);
    return () => window.removeEventListener("userChanged", load);
  }, []);

  return (
    <PermissionContext.Provider value={{ user, permissions }}>
      {children}
    </PermissionContext.Provider>
  );
}

export function usePermissions() {
  return useContext(PermissionContext);
}