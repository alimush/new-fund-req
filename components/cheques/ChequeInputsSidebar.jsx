"use client";

import { FiCalendar, FiHash, FiDollarSign, FiDatabase, FiUser } from "react-icons/fi";
import ChequeFieldInput from "@/components/cheques/ChequeFieldInput";
import { amountNumericToWordsLines } from "@/lib/cheques/amountWords";
import { datePartsFromIso, isoFromDateParts } from "@/lib/cheques/dateUtils";
import { isSlashLayoutKey } from "@/lib/cheques/dateSlashLayout";
import { singleLineText } from "@/lib/cheques/singleLineText";
import { TEXT_KEY, fieldWithChequePosition, AMOUNT_WORDS_KEY } from "@/lib/cheques/textFieldLayout";

function resolveAmountWordsLine1Field(fields, amountWordsLayout) {
  const base = (fields || []).find((f) => f.key === AMOUNT_WORDS_KEY);
  if (!base) return null;
  return amountWordsLayout ? fieldWithChequePosition(base, amountWordsLayout) : base;
}

function withAmountWords(values, amountVal, template, fields, globalFontScale = 100, amountWordsLayout = null) {
  const line1Field = resolveAmountWordsLine1Field(fields, amountWordsLayout);
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
      !f.sidebarOnly &&
      !isSlashLayoutKey(f.key) &&
      f.key !== TEXT_KEY
  );

  const isoDate = isoFromDateParts(values);

  return (
    <aside className="flex flex-col gap-4 w-full lg:w-[260px] xl:w-[280px] shrink-0">
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

      {fieldByKey[TEXT_KEY] ? (
        <Section title="المدير المفوض" icon={FiUser}>
          <label className="block text-[11px] font-bold text-slate-500 mb-1">
            {fieldByKey[TEXT_KEY].label}
          </label>
          <ChequeFieldInput
            field={fieldByKey[TEXT_KEY]}
            value={values[TEXT_KEY]}
            onChange={(val) => set(TEXT_KEY, val)}
            variant="sidebar"
            isActive={activeField === TEXT_KEY}
            onFocus={() => onFieldFocus?.(TEXT_KEY)}
            onBlur={onFieldBlur}
          />
          <p className="text-[10px] text-slate-500 font-semibold mt-2">
            يظهر على يسار الصك — اسحب من أي حافة حول الحقل لتحريك موضعه
          </p>
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
                        withAmountWords(
                          values,
                          val,
                          template,
                          fields,
                          globalFontScale,
                          amountWordsLayout
                        )
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
            المبلغ بالأرقام يُحوَّل تلقائياً إلى كتابة على سطرين عند الحاجة
          </p>
        ) : null}
      </Section>
    </aside>
  );
}
