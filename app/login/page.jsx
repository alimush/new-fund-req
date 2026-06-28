"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { FaUser, FaLock, FaEye, FaEyeSlash } from "react-icons/fa";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e) => {
    e.preventDefault();
    if (loading) return;

    setError("");
    try {
      setLoading(true);
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
      setLoading(false);
    }
  };

  return (
    <div className="-m-6 relative z-10 flex min-h-screen">
      {/* Brand panel */}
      <motion.div
        initial={{ opacity: 0, x: -24 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5 }}
        className="relative hidden flex-col justify-between overflow-hidden bg-slate-950 p-10 lg:flex lg:w-[45%] xl:w-[42%] xl:p-14"
      >
        <div className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-slate-800/40 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 h-80 w-80 rounded-full bg-slate-800/30 blur-3xl" />

        <div className="relative">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white shadow-sm">
              <span className="text-sm font-black tracking-wide text-slate-950">SPC</span>
            </div>
            <div>
              <p className="text-lg font-bold text-white">SPC Portal</p>
              <p className="text-xs text-slate-500">Developed by SPC team</p>
            </div>
          </div>
        </div>

        <div className="relative space-y-6">
          <h2 className="text-3xl font-bold leading-tight text-white xl:text-4xl">
            Welcome back,
            <br />
            <span className="text-slate-400">sign in to continue.</span>
          </h2>
          <p className="max-w-sm text-sm leading-relaxed text-slate-400">
            Use your account credentials to access the system securely.
          </p>
        </div>

        <p className="relative text-xs text-slate-600">© Solution Portal Company</p>
      </motion.div>

      {/* Form panel */}
      <div className="flex flex-1 items-center justify-center bg-slate-50 px-6 py-12 sm:px-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.1 }}
          className="w-full max-w-md"
        >
          <div className="mb-8 flex items-center justify-center gap-3 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-950">
              <span className="text-xs font-black tracking-wide text-white">SPC</span>
            </div>
            <div>
              <p className="text-base font-bold text-slate-900">SPC Portal</p>
              <p className="text-[11px] text-slate-500">Developed by SPC team</p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-slate-900">Sign in</h1>
              <p className="mt-1 text-sm text-slate-500">
                Enter your credentials to continue
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-500">
                  Username
                </label>
                <div className="relative">
                  <FaUser className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400" />
                  <input
                    type="text"
                    placeholder="Enter username"
                    value={username}
                    onChange={(e) => {
                      setUsername(e.target.value);
                      if (error) setError("");
                    }}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-4 text-sm text-slate-900 transition placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-300"
                    required
                    autoComplete="username"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-500">
                  Password
                </label>
                <div className="relative">
                  <FaLock className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400" />
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (error) setError("");
                    }}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-10 text-sm text-slate-900 transition placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-300"
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute inset-y-0 right-3 flex items-center text-slate-400 transition hover:text-slate-600"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <FaEye /> : <FaEyeSlash />}
                  </button>
                </div>
              </div>

              {error ? (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700"
                >
                  {error}
                </motion.div>
              ) : null}

              <button
                type="submit"
                disabled={loading}
                className="mt-2 w-full rounded-xl bg-slate-900 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "جاري تسجيل الدخول..." : "Sign in"}
              </button>
            </form>
          </div>

          <p className="mt-6 text-center text-xs text-slate-400 lg:hidden">
            © Solution Portal Company
          </p>
        </motion.div>
      </div>
    </div>
  );
}
