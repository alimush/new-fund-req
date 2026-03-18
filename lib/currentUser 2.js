// lib/currentUser.js
export function getCurrentUser() {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("username") || null;
  }