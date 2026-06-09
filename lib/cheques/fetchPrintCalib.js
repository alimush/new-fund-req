import {
  fieldsFromTemplate,
  mergeTemplateFields,
} from "@/lib/cheques/mergeFields";
import { defaultPrintCalib, normalizePrintCalib } from "@/lib/cheques/printCalib";

function mergedFieldsFromLayout(template, layoutData, fallbackFields = []) {
  if (Array.isArray(layoutData) && layoutData.length) {
    return mergeTemplateFields(template, layoutData);
  }
  if (fallbackFields?.length) return fallbackFields;
  return fieldsFromTemplate(template);
}

/**
 * تحميل إعدادات الطباعة المحفوظة للقالب (لكل templateKey مستقل).
 */
export async function fetchPrintCalib(templateKey, template, fields = []) {
  const bundle = await fetchChequePrintBundle(templateKey, template, fields);
  return bundle.printCalib;
}

/**
 * القالب الكامل للطباعة: إعدادات الضبط + مواضع الحقول المحفوظة.
 */
export async function fetchChequePrintBundle(templateKey, template, fields = []) {
  const fallbackSlashes = template?.dateShowSlashesDefault ?? true;
  const fallbackFields = mergedFieldsFromLayout(template, [], fields);

  if (!templateKey || !template) {
    return {
      fields: fallbackFields,
      printCalib: defaultPrintCalib(template, fallbackFields),
      dateShowSlashes: fallbackSlashes,
    };
  }

  try {
    const res = await fetch(
      `/api/cheques/layout?templateKey=${encodeURIComponent(templateKey)}`,
      { cache: "no-store" }
    );
    const json = await res.json();
    if (json?.success) {
      const layoutFields = mergedFieldsFromLayout(template, json.data, fields);
      return {
        fields: layoutFields,
        printCalib: normalizePrintCalib(json.printCalib, template, layoutFields),
        dateShowSlashes:
          typeof json.dateShowSlashes === "boolean"
            ? json.dateShowSlashes
            : fallbackSlashes,
      };
    }
  } catch {
    //
  }

  return {
    fields: fallbackFields,
    printCalib: defaultPrintCalib(template, fallbackFields),
    dateShowSlashes: fallbackSlashes,
  };
}
