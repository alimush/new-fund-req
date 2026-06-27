"use client";

export default function DateMoveModeToggle({ value, onChange, variant = "light" }) {
  const isDark = variant === "dark";
  return (
    <div
      className={`rounded-xl border p-3 space-y-2 ${
        isDark
          ? "border-violet-500/30 bg-violet-500/10"
          : "border-violet-200 bg-violet-50/80"
      }`}
    >
      <p
        className={`text-xs font-extrabold ${
          isDark ? "text-violet-100" : "text-violet-950"
        }`}
      >
        تحريك التاريخ في الطباعة
      </p>
      <label
        className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 ${
          isDark
            ? "border-white/10 bg-white/5 hover:bg-white/10"
            : "border-violet-200 bg-white hover:bg-violet-50"
        }`}
      >
        <input
          type="radio"
          name="dateMoveMode"
          checked={value === "unified"}
          onChange={() => onChange("unified")}
          className="accent-violet-500"
        />
        <span className={`text-sm font-bold ${isDark ? "text-slate-100" : "text-slate-800"}`}>
          الكل معاً (أرقام + /)
        </span>
      </label>
      <label
        className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 ${
          isDark
            ? "border-white/10 bg-white/5 hover:bg-white/10"
            : "border-violet-200 bg-white hover:bg-violet-50"
        }`}
      >
        <input
          type="radio"
          name="dateMoveMode"
          checked={value === "split"}
          onChange={() => onChange("split")}
          className="accent-violet-500"
        />
        <span className={`text-sm font-bold ${isDark ? "text-slate-100" : "text-slate-800"}`}>
          منفصل (أرقام / فواصل / كل جزء)
        </span>
      </label>
      <p
        className={`text-[10px] font-semibold leading-relaxed ${
          isDark ? "text-violet-200/80" : "text-violet-800/90"
        }`}
      >
        {value === "unified"
          ? "يحرّك أرقام التاريخ والفواصل معاً. التباعد الدقيق من قسم «↔» بالأسفل."
          : "حرّك مجموعة الأرقام أو الفواصل أو كل جزء على حدة."}
      </p>
    </div>
  );
}
