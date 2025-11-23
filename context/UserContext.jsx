"use client";
import { createContext, useContext, useState, useEffect } from "react";

const UserContext = createContext();

export function UserProvider({ children }) {
  const [user, setUser] = useState(null); // { username, companies }
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // نحمل اليوزر المخزون بعد تسجيل الدخول
    const stored = localStorage.getItem("user");
    if (stored) {
      setUser(JSON.parse(stored));
    }
    setLoading(false);
  }, []);

  const saveUser = (userdata) => {
    localStorage.setItem("user", JSON.stringify(userdata));
    setUser(userdata);
  };

  const logout = () => {
    localStorage.removeItem("user");
    setUser(null);
  };

  return (
    <UserContext.Provider value={{ user, saveUser, logout, loading }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  return useContext(UserContext);
}