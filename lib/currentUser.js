// lib/currentUser.js

// 🔵 هنا انت ترجع اليوزر الحالي من localStorage
export function getCurrentUser() {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("username") || null;
  }