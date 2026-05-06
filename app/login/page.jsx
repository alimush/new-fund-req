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
      window.dispatchEvent(new Event("userChanged"));
      router.push("/home");
    } else {
      alert(data.error || "❌ خطأ باليوزر أو الباسورد");
    }
  };

  return (
    // ✅ بدون أي خلفية: يعتمد على RootLayout
    <div className="relative flex min-h-screen items-center justify-center px-4">
      <motion.form
        onSubmit={handleLogin}
        initial={{ opacity: 0, y: 28 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="
          relative w-full max-w-sm
          rounded-3xl p-8 space-y-7
          bg-white/35 backdrop-blur-2xl
          ring-1 ring-white/25
          shadow-[0_18px_45px_-25px_rgba(0,0,0,0.35)]
        "
      >
        {/* Icon */}
        <motion.div
          className="flex justify-center"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.45 }}
        >
          <div
            className="
              h-16 w-16 rounded-2xl
              bg-white/45 backdrop-blur
              ring-1 ring-white/25
              shadow-sm
              flex items-center justify-center
            "
          >
            <FaUserCircle className="text-5xl text-gray-800/90" />
          </div>
        </motion.div>

        {/* Title */}
        <motion.h1
          className="text-2xl font-black text-center text-gray-800 tracking-wide"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.18, duration: 0.45 }}
        >
          Sign in
        </motion.h1>

        {/* Username */}
        <motion.div
          className="relative"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.28, duration: 0.45 }}
        >
          <span className="absolute inset-y-0 left-3 flex items-center text-gray-500 pointer-events-none">
            <FaUser />
          </span>

          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="
              w-full p-3 pl-10 rounded-2xl
              bg-white/45 backdrop-blur
              ring-1 ring-black/5
              text-gray-900 placeholder:text-gray-500
              outline-none
              focus:ring-2 focus:ring-blue-200/70
              transition
            "
            required
          />
        </motion.div>

        {/* Password */}
        <motion.div
          className="relative"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.36, duration: 0.45 }}
        >
          <span className="absolute inset-y-0 left-3 flex items-center text-gray-500 pointer-events-none">
            <FaLock />
          </span>

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="
              w-full p-3 pl-10 rounded-2xl
              bg-white/45 backdrop-blur
              ring-1 ring-black/5
              text-gray-900 placeholder:text-gray-500
              outline-none
              focus:ring-2 focus:ring-blue-200/70
              transition
            "
            required
          />
        </motion.div>

        {/* Button */}
        <motion.button
          type="submit"
          whileHover={{ y: -1 }}
          whileTap={{ scale: 0.98 }}
          className="
            w-full p-3 rounded-2xl
            bg-gray-900 text-white font-semibold
            shadow-sm
            hover:bg-gray-800
            transition
          "
        >
          Login
        </motion.button>

        {/* Small hint (اختياري) */}
        <p className="text-center text-xs text-gray-600">
          Please enter your credentials to continue
        </p>
      </motion.form>
    </div>
  );
}