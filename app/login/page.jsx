"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { FaUser, FaLock, FaUserCircle, FaEye, FaEyeSlash } from "react-icons/fa";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
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
        setError(data.error || "خطأ باليوزر أو الباسورد");
      }
    } catch {
      setError("تعذر تسجيل الدخول، حاول مرة ثانية");
    } finally {
      setSubmitting(false);
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
          relative w-full max-w-md
          rounded-3xl p-8 space-y-6
          bg-white/45 backdrop-blur-2xl
          ring-1 ring-white/40
          shadow-[0_22px_55px_-28px_rgba(0,0,0,0.38)]
        "
      >
        <div className="pointer-events-none absolute inset-0 rounded-3xl bg-gradient-to-br from-white/40 via-transparent to-transparent opacity-80" />

        {/* Icon */}
        <motion.div
          className="relative flex justify-center"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.45 }}
        >
          <div
            className="
              h-16 w-16 rounded-2xl
              bg-white/70 backdrop-blur
              ring-1 ring-white/40
              shadow-md
              flex items-center justify-center
            "
          >
            <FaUserCircle className="text-5xl text-gray-800/90" />
          </div>
        </motion.div>

        {/* Title */}
        <motion.h1
          className="relative text-center text-2xl font-black tracking-wide text-gray-800"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.18, duration: 0.45 }}
        >
          Sign in
        </motion.h1>

        {error && (
          <div className="relative rounded-2xl border border-red-200 bg-red-50/90 px-3 py-2 text-center text-sm font-semibold text-red-700">
            {error}
          </div>
        )}

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
              bg-white/65 backdrop-blur
              ring-1 ring-slate-200
              text-gray-900 placeholder:text-gray-500
              outline-none
              focus:ring-2 focus:ring-slate-300
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
            type={showPassword ? "text" : "password"}
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="
              w-full p-3 pl-10 pr-10 rounded-2xl
              bg-white/65 backdrop-blur
              ring-1 ring-slate-200
              text-gray-900 placeholder:text-gray-500
              outline-none
              focus:ring-2 focus:ring-slate-300
              transition
            "
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute inset-y-0 right-3 flex items-center text-gray-500 hover:text-gray-700 transition"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <FaEye /> : <FaEyeSlash />}
          </button>
        </motion.div>

        {/* Button */}
        <motion.button
          type="submit"
          whileHover={{ y: -1 }}
          whileTap={{ scale: 0.98 }}
          disabled={submitting}
          className="
            w-full p-3 rounded-2xl
            bg-gray-900 text-white font-semibold
            shadow-sm
            hover:bg-gray-800 disabled:opacity-70 disabled:cursor-not-allowed
            transition
          "
        >
          {submitting ? "جاري تسجيل الدخول..." : "Login"}
        </motion.button>

        {/* Small hint (اختياري) */}
        <p className="text-center text-xs text-gray-600">
          Please enter your credentials to continue
        </p>
      </motion.form>
    </div>
  );
}