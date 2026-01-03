"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { FaUser, FaLock, FaUserCircle } from "react-icons/fa";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const router = useRouter();

  const handleLogin = async (e) => {
    e.preventDefault();

    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    
    const data = await res.json();
    
    if (data.success) {
      localStorage.setItem("userId", data.user.id);
      localStorage.setItem("username", data.user.username);
      localStorage.setItem("companies", JSON.stringify(data.user.companies));
      localStorage.setItem("user", JSON.stringify(data.user));

      window.dispatchEvent(new Event("userChanged"));
      router.push("/home");
    
    } else {
      alert(data.error || "❌ خطأ باليوزر أو الباسورد");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#ffffff] text-[#171717] relative overflow-hidden">

      {/* خلفيات ناعمة */}
      <div className="absolute -top-40 -left-40 w-[28rem] h-[28rem] bg-gray-200/30 rounded-full blur-3xl" />
      <div className="absolute -bottom-40 -right-40 w-[24rem] h-[24rem] bg-gray-300/20 rounded-full blur-3xl" />

      <motion.form
        onSubmit={handleLogin}
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: "easeOut" }}
        className="relative w-96 bg-white/70 backdrop-blur-xl shadow-xl border border-gray-200/70 rounded-2xl p-8 space-y-7"
      >
        {/* أيقونة المستخدم */}
        <motion.div
          className="flex justify-center"
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
        >
          <FaUserCircle className="text-7xl text-gray-700 drop-shadow-md" />
        </motion.div>

        {/* عنوان */}
        <motion.h1
          className="text-2xl font-bold text-center tracking-wide 
                     bg-gradient-to-r from-gray-600 via-gray-800 to-gray-900 
                     bg-clip-text text-transparent"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.5 }}
        >
          Sign in
        </motion.h1>

        {/* Username */}
        <motion.div
          className="relative"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.5 }}
        >
          <span
            className="absolute inset-y-0 left-3 flex items-center text-gray-500 transition-all duration-200 pointer-events-none"
            id="userIcon"
          >
            <FaUser />
          </span>

          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onFocus={() =>
              (document.getElementById("userIcon").style.color = "#000")
            }
            onBlur={() =>
              (document.getElementById("userIcon").style.color = "#6b7280")
            }
            className="w-full p-3 pl-10 rounded-lg border border-gray-300 
                       focus:ring-2 focus:ring-gray-400 outline-none 
                       bg-white text-gray-900 transition"
            required
          />
        </motion.div>

        {/* Password */}
        <motion.div
          className="relative"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.5 }}
        >
          <span
            className="absolute inset-y-0 left-3 flex items-center text-gray-500 transition-all duration-200 pointer-events-none"
            id="passIcon"
          >
            <FaLock />
          </span>

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onFocus={() =>
              (document.getElementById("passIcon").style.color = "#000")
            }
            onBlur={() =>
              (document.getElementById("passIcon").style.color = "#6b7280")
            }
            className="w-full p-3 pl-10 rounded-lg border border-gray-300 
                       focus:ring-2 focus:ring-gray-400 outline-none 
                       bg-white text-gray-900 transition"
            required
          />
        </motion.div>

        {/* Login Button */}
        <motion.button
          type="submit"
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.96 }}
          className="w-full p-3 rounded-lg bg-gradient-to-r from-gray-500 via-gray-700 to-gray-800 
                     text-white font-semibold shadow-lg hover:from-gray-600 hover:to-gray-900 transition"
        >
          Login
        </motion.button>
      </motion.form>
    </div>
  );
}