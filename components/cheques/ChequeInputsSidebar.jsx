"use client";

import { FiCalendar, FiHash, FiDollarSign, FiDatabase, FiType } from "react-icons/fi";
import ChequeFieldInput from "@/components/cheques/ChequeFieldInput";
import { amountNumericToWordsLines } from "@/lib/cheques/amountWords";
import { datePartsFromIso, isoFromDateParts } from "@/lib/cheques/dateUtils";
import { singleLineText } from "@/lib/cheques/singleLineText";
import {
  AMOUNT_WORDS_KEY,
  AMOUNT_WORDS_LINE2_KEY,
} from "@/lib/cheques/textFieldLayout";

function NumControl({ label, value, onChange, min = 0, max = 100, step = 1 }) {
  return (
    <div>
      <label className="text-[10px] font-bold text-slate-500">{label}</label>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-0.5 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm font-bold text-slate-800"
      />
    </div>
  );
}

function withAmountWords(values, amountVal, template, fields, globalFontScale = 100) {
  const line1Field = (fields || []).find((f) => f.key === "amountWords");
  const { line1, line2 } = amountNumericToWordsLines(
    amountVal,
    line1Field,
    template,
    globalFontScale
  );
  return {
    ...values,
    amountNumeric: amountVal,
    amountWords: singleLineText(line1),
    amountWordsLine2: singleLineText(line2),
  };
}

const DATE_KEYS = ["dateDay", "dateMonth", "dateYear"];
const AMOUNT_KEYS = ["amountNumeric", "amountWords", "amountWordsLine2"];

function Section({ title, icon: Icon, children }) {
  return (
    <section className="rounded-2xl border border-slate-200/90 bg-slate-50/80 p-4">
      <h3 className="flex items-center gap-2 text-sm font-extrabold text-slate-800 mb-3">
        {Icon ? <Icon className="text-emerald-600 shrink-0" size={16} /> : null}
        {title}
      </h3>
      {children}
    </section>
  );
}

export default function ChequeInputsSidebar({
  template,
  fields: fieldsProp,
  values,
  onChange,
  activeField,
  onFieldFocus,
  onFieldBlur,
  autoAmountWords = true,
  globalFontScale = 100,
  amountWordsLayout = null,
  amountWordsLine2Layout = null,
  onAmountWordsLayoutChange,
  onAmountWordsLine2LayoutChange,
}) {
  if (!template) return null;

  const fields = fieldsProp || template.fields || [];
  const fieldByKey = Object.fromEntries(fields.map((f) => [f.key, f]));

  const set = (key, val) => onChange?.({ ...values, [key]: val });

  const sidebarOnlyFields = fields.filter((f) => f.sidebarOnly);
  const canvasOtherFields = fields.filter(
    (f) =>
      !DATE_KEYS.includes(f.key) &&
      !AMOUNT_KEYS.includes(f.key) &&
      !f.sidebarOnly
  );

  const isoDate = isoFromDateParts(values);

  const amountWordsLineField =
    activeField === AMOUNT_WORDS_KEY || activeField === AMOUNT_WORDS_LINE2_KEY
      ? fieldByKey[activeField]
      : null;

  const patchActiveAmountWordsLine = (partial) => {
    if (activeField === AMOUNT_WORDS_KEY) {
      onAmountWordsLayoutChange?.(partial);
      return;
    }
    if (activeField === AMOUNT_WORDS_LINE2_KEY) {
      onAmountWordsLine2LayoutChange?.(partial);
    }
  };

  return (
    <aside className="flex flex-col gap-4 w-full lg:w-[300px] xl:w-[320px] shrink-0">
      <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/60 px-4 py-3">
        <p className="text-xs font-bold text-emerald-800/80">البنك</p>
        <p className="text-sm font-extrabold text-emerald-950 mt-0.5">
          {template.bankName}
        </p>
        <p className="text-[11px] text-emerald-800/70 mt-2 font-semibold truncate">
          {template.drawerName}
        </p>
        {template.branch ? (
          <p className="text-[11px] text-slate-600 font-semibold mt-1">
            الفرع: {template.branch}
          </p>
        ) : null}
      </div>

      <Section title="التاريخ" icon={FiCalendar}>
        <label className="block text-[11px] font-bold text-slate-500 mb-1">
          اختيار التاريخ (اليوم افتراضياً)
        </label>
        <input
          type="date"
          value={isoDate}
          onChange={(e) => onChange?.({ ...values, ...datePartsFromIso(e.target.value) })}
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-800 mb-3"
        />
        <div className="grid grid-cols-3 gap-2">
          {DATE_KEYS.map((key) => {
            const f = fieldByKey[key];
            if (!f) return null;
            return (
              <div key={key}>
                <label className="block text-[11px] font-bold text-slate-500 mb-1 text-center">
                  {f.label}
                  {key === "dateYear" ? " (٤)" : ""}
                </label>
                <ChequeFieldInput
                  field={f}
                  value={values[key]}
                  onChange={(val) => set(key, val)}
                  variant="sidebar"
                  isActive={activeField === key}
                  onFocus={() => onFieldFocus?.(key)}
                  onBlur={onFieldBlur}
                />
              </div>
            );
          })}
        </div>
        <p className="text-[10px] text-slate-500 font-semibold mt-2 text-center">
          يظهر على الصك: {values.dateDay || "–"} {values.dateMonth ? `/ ${values.dateMonth}` : ""}{" "}
          {values.dateYear ? `/ ${values.dateYear}` : ""}
        </p>
      </Section>

      {sidebarOnlyFields.length > 0 ? (
        <Section title="بيانات الحفظ (لا تظهر على الصورة)" icon={FiDatabase}>
          <div className="space-y-3">
            {sidebarOnlyFields.map((f) => (
              <div key={f.key}>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">
                  {f.label}
                </label>
                <ChequeFieldInput
                  field={f}
                  value={values[f.key]}
                  onChange={(val) => set(f.key, val)}
                  variant="sidebar"
                  isActive={activeField === f.key}
                  onFocus={() => onFieldFocus?.(f.key)}
                  onBlur={onFieldBlur}
                />
              </div>
            ))}
          </div>

        </Section>
      ) : null}

      {canvasOtherFields.length > 0 ? (
        <Section title="بيانات الصك" icon={FiHash}>
          <div className="space-y-3">
            {canvasOtherFields.map((f) => (
              <div key={f.key}>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">
                  {f.label}
                </label>
                <ChequeFieldInput
                  field={f}
                  value={values[f.key]}
                  onChange={(val) => set(f.key, val)}
                  variant="sidebar"
                  isActive={activeField === f.key}
                  onFocus={() => onFieldFocus?.(f.key)}
                  onBlur={onFieldBlur}
                />
              </div>
            ))}
          </div>
        </Section>
      ) : null}

      <Section title="المبلغ" icon={FiDollarSign}>
        <div className="space-y-3">
          {AMOUNT_KEYS.map((key) => {
            const f = fieldByKey[key];
            if (!f) return null;
            return (
              <div key={key}>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">
                  {f.label}
                  {key === "amountNumeric" && template.currency ? (
                    <span className="text-slate-400 font-semibold mr-1">
                      ({template.currency})
                    </span>
                  ) : null}
                </label>
                <ChequeFieldInput
                  field={f}
                  value={values[key]}
                  onChange={(val) => {
                    if (key === "amountNumeric" && autoAmountWords) {
                      onChange?.(
                        withAmountWords(values, val, template, fields, globalFontScale)
                      );
                      return;
                    }
                    set(key, val);
                  }}
                  variant="sidebar"
                  isActive={activeField === key}
                  onFocus={() => onFieldFocus?.(key)}
                  onBlur={onFieldBlur}
                />
              </div>
            );
          })}
        </div>
        {autoAmountWords ? (
          <p className="text-[10px] text-emerald-700 font-semibold">
            المبلغ بالأرقام يُحوَّل تلقائياً إلى كتابة (حتى المليارات)
          </p>
        ) : null}
        {amountWordsLineField ? (
          <div className="rounded-xl border border-emerald-200 bg-white p-3 mt-3 space-y-2">
            <p className="flex items-center gap-2 text-xs font-extrabold text-emerald-900">
              <FiType size={14} />
              خط {amountWordsLineField.label}
            </p>
            <p className="text-[10px] font-semibold text-emerald-800/80">
              يُطبَّق على الصك فوراً — يُحفظ مع القالب عند «حفظ تخطيط هذا الصك»
            </p>
            <div className="grid grid-cols-2 gap-2">
              <NumControl
                label="حجم الخط px"
                value={amountWordsLineField?.fontSize ?? 14}
                min={8}
                max={48}
                step={1}
                onChange={(v) => patchActiveAmountWordsLine({ fontSize: v })}
              />
              <NumControl
                label="سماكة الخط"
                value={amountWordsLineField?.fontWeight ?? 700}
                min={400}
                max={900}
                step={100}
                onChange={(v) => patchActiveAmountWordsLine({ fontWeight: v })}
              />
            </div>
          </div>
        ) : (
          <p className="text-[10px] text-slate-500 font-semibold mt-2">
            انقر سطر المبلغ كتابة على الصك لتعديل حجم خطه
          </p>
        )}
      </Section>

      <p className="text-[11px] text-sky-700 font-semibold text-center leading-relaxed px-1 rounded-lg bg-sky-50 py-2">
        حقل text: حرّكه وكبّره من الصورة (الشريط الأزرق) — يُحفظ مع هذا الصك فقط
      </p>

      <p className="text-[11px] text-emerald-800 font-semibold text-center leading-relaxed px-1 rounded-lg bg-emerald-50 py-2">
        سطرا المبلغ كتابة: انقر السطر على الصك ثم عدّل حجم الخط من «المبلغ»
      </p>

      <p className="text-[11px] text-slate-500 font-semibold text-center leading-relaxed px-1">
        باقي الحقول: التعديل من الشريط أو على الصورة
      </p>
    </aside>
  );
}
