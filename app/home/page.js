"use client";
import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { usePermissions } from "@/context/PermissionContext";
const cards = [
  { key: "Al-Ghadeer", name: "طلبات الغدير", logo: "/الغدير.png" },
  { key: "Al-Rida", name: "طلبات الرضا", logo: "/الرضا.png" },
  { key: "Al-Mezan", name: "طلبات الميزان", logo: "/الميزان.png" },
  { key: "Badur-Baghdad", name: "طلبات بدور بغداد", logo: "/بدور_بغداد.png" },
  {
    key: "Ghadeer-Karbala",
    name: "طلبات غدير كربلاء",
    logo: "/غدير_كربلاء.png",
  },
  { key: "Tiba-Al-najaf", name: "طلبات طيبة النجف", logo: "/طيبة_النجف.png" },
  { key: "badur-Al-najaf", name: "طلبات بدور النجف", logo: "/بدور_النجف.png" },
  { key: "010", name: "شاورما الحلوين", logo: "/1.png" },
  { key: "RYD", name: "رياض", logo: "" },

];

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const item = {
  hidden: { y: 20, scale: 0.95 },
  show: { y: 0, scale: 1, transition: { duration: 0.5, ease: "easeOut" } },
};

export default function HomePage() {
  const { companies } = usePermissions(); 
  const allowedCards = cards.filter(c => companies.includes(c.key));
  return (
    <div

    >
      {/* الهيدر */}
      <div className="max-w-6xl mx-auto mb-10 text-center mt-16 relative">
        <motion.h1
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="text-3xl md:text-4xl font-bold 
                     bg-gradient-to-r from-gray-400 via-gray-600 to-slate-800
                     text-transparent bg-clip-text"
        >
          Companies Dashboard
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.6, ease: "easeOut" }}
          className="mt-2 bg-gradient-to-r from-gray-500 via-gray-600 to-gray-800 
                     text-transparent bg-clip-text"
        >
          اختر الشركة لعرض تفاصيل الطلبات
        </motion.p>
      </div>
{/* الكروت */}
<motion.div
  className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
  variants={container}
  initial="hidden"
  animate="show"
>
  {allowedCards.map((c, idx) => (
    <Link key={idx} href={`/requests/${c.key}`} passHref>
      <motion.div
        variants={item}
        whileHover={{ y: -4, scale: 1.015 }}
        whileTap={{ scale: 0.995 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="
          group relative cursor-pointer rounded-3xl p-6
          bg-white/40 backdrop-blur-2xl
          ring-1 ring-white/25
          shadow-[0_18px_45px_-25px_rgba(0,0,0,0.35)]
          hover:bg-white/55 hover:ring-white/35
          transition-all duration-300
          text-center flex flex-col items-center
        "
      >
        {/* زخارف ناعمة */}
        <div className="pointer-events-none absolute inset-0 rounded-3xl bg-gradient-to-br from-white/25 via-transparent to-transparent opacity-80" />

        {/* اللوغو */}
        <div
          className="
            relative w-20 h-20 rounded-2xl
            bg-white/55 backdrop-blur
            ring-1 ring-white/25
            shadow-sm overflow-hidden
          "
        >
          <Image
            src={c.logo}
            alt={`${c.name} logo`}
            fill
            className="object-contain p-2 transition-transform duration-500 group-hover:scale-105"
          />
        </div>

        {/* النص */}
        <h2 className="mt-4 text-lg font-bold tracking-tight text-gray-900">
          {c.name}
        </h2>
      </motion.div>
    </Link>
  ))}
</motion.div>
    </div>
  );
}