"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { FiFileText } from "react-icons/fi";

const cards = [
  {
    key: "exceptions",
    name: "الاستثنائات",
    href: "/ex/payment-plan",
    icon: FiFileText,
  },
];

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const item = {
  hidden: { y: 20, scale: 0.95 },
  show: {
    y: 0,
    scale: 1,
    transition: { duration: 0.5, ease: "easeOut" },
  },
};

export default function ExDashboardPage() {
  return (
    <div>
      {/* Header */}
      <div className="max-w-6xl mx-auto mb-10 text-center mt-16 relative">
        <motion.h1
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="text-3xl md:text-4xl font-bold text-gray-900"
        >
          EX Dashboard
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.6, ease: "easeOut" }}
          className="mt-2 text-gray-600"
        >
          اختر القسم المطلوب
        </motion.p>
      </div>

      {/* Cards */}
      <motion.div
        className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
        variants={container}
        initial="hidden"
        animate="show"
      >
        {cards.map((c, idx) => {
          const Icon = c.icon;

          return (
            <Link key={idx} href={c.href}>
              <motion.div
                variants={item}
                whileHover={{ y: -4, scale: 1.015 }}
                whileTap={{ scale: 0.995 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="
                  group relative cursor-pointer rounded-3xl p-8
                  bg-white/40 backdrop-blur-2xl
                  ring-1 ring-white/25
                  shadow-[0_18px_45px_-25px_rgba(0,0,0,0.35)]
                  hover:bg-white/55 hover:ring-white/35
                  transition-all duration-300
                  text-center flex flex-col items-center
                "
              >
                {/* زخرفة خفيفة */}
                <div className="pointer-events-none absolute inset-0 rounded-3xl bg-gradient-to-br from-white/25 via-transparent to-transparent opacity-80" />

                {/* Icon بدل اللوغو */}
                <div
                  className="
                    relative w-20 h-20 rounded-2xl
                    bg-white/55 backdrop-blur
                    ring-1 ring-white/25
                    shadow-sm
                    flex items-center justify-center
                  "
                >
                  <Icon className="text-3xl text-gray-800 transition-transform duration-500 group-hover:scale-110" />
                </div>

                {/* Title */}
                <h2 className="mt-6 text-lg font-bold tracking-tight text-gray-900">
                  {c.name}
                </h2>
              </motion.div>
            </Link>
          );
        })}
      </motion.div>
    </div>
  );
}