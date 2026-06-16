"use client";

import { FiRepeat, FiRotateCw } from "react-icons/fi";
import {
  SHEET_ROTATION_MAX,
  SHEET_ROTATION_MIN,
} from "@/lib/cheques/printCalib";

const QUICK_ANGLES = [0, 90, 180, -90];

/**
 * دوران حر وقلب منطقة الصك على ورقة A4
 * @param {"light"|"dark"} variant
 */
export default function SheetOrientationControls({
  rotationDeg = 0,
  flipHorizontal = false,
  flipVertical = false,
  onRotation,
  onFlipHorizontal,
  onFlipVertical,
  variant = "light",
}) {
  const isDark = variant === "dark";

  const btnBase = isDark
    ? "rounded-lg border px-2 py-1.5 text-[11px] font-extrabold transition"
    : "rounded-lg border px-2.5 py-1.5 text-[11px] font-extrabold transition";

  const btnIdle = isDark
    ? "border-white/15 bg-white/5 text-slate-200 hover:bg-white/10"
    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50";

  const btnActive = isDark
    ? "border-sky-400 bg-sky-500/30 text-sky-100"
    : "border-sky-400 bg-sky-50 text-sky-900";

  const labelCls = isDark
    ? "text-xs font-extrabold text-white"
    : "text-xs font-extrabold text-slate-800";

  const hintCls = isDark
    ? "text-[10px] font-semibold text-slate-400"
    : "text-[10px] font-semibold text-slate-500";

  const safeRot = Number.isFinite(Number(rotationDeg)) ? Number(rotationDeg) : 0;

  return (
    <div className="space-y-3">
      <div>
        <p className={labelCls}>دوران منطقة الصك</p>
        <p className={`${hintCls} mt-0.5`}>
          اسحب المقبض الدائري من زاوية الإطار — أو حرّك الشريط / أدخل الزاوية
        </p>
        <div className="mt-2 flex items-center gap-2">
          <FiRotateCw
            size={14}
            className={isDark ? "shrink-0 text-sky-400" : "shrink-0 text-sky-600"}
          />
          <input
            type="range"
            min={SHEET_ROTATION_MIN}
            max={SHEET_ROTATION_MAX}
            step={0.5}
            value={safeRot}
            onChange={(e) => onRotation?.(parseFloat(e.target.value))}
            className="min-w-0 flex-1 accent-sky-600"
          />
          <input
            type="number"
            min={SHEET_ROTATION_MIN}
            max={SHEET_ROTATION_MAX}
            step={0.5}
            value={safeRot}
            onChange={(e) => {
              const n = parseFloat(e.target.value);
              if (Number.isFinite(n)) onRotation?.(n);
            }}
            className={`w-[4.5rem] shrink-0 rounded-lg border px-1.5 py-1 text-center text-xs font-black tabular-nums ${
              isDark
                ? "border-white/15 bg-white/10 text-white"
                : "border-slate-200 bg-white text-slate-900"
            }`}
          />
          <span className={`text-[10px] font-bold ${isDark ? "text-slate-400" : "text-slate-500"}`}>
            °
          </span>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {QUICK_ANGLES.map((deg) => (
            <button
              key={deg}
              type="button"
              onClick={() => onRotation?.(deg)}
              className={`${btnBase} ${Math.abs(safeRot - deg) < 0.5 ? btnActive : btnIdle}`}
            >
              {deg}°
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className={labelCls}>قلب المنطقة</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => onFlipHorizontal?.(!flipHorizontal)}
            className={`${btnBase} ${flipHorizontal ? btnActive : btnIdle}`}
          >
            <span className="inline-flex items-center gap-1">
              <FiRepeat size={12} />
              قلب أفقي
            </span>
          </button>
          <button
            type="button"
            onClick={() => onFlipVertical?.(!flipVertical)}
            className={`${btnBase} ${flipVertical ? btnActive : btnIdle}`}
          >
            <span className="inline-flex items-center gap-1">
              <FiRepeat size={12} className="rotate-90" />
              قلب عمودي
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
