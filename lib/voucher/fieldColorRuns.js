import { clampFontSize, clampFontWeight } from "@/lib/voucher/styles";

export function normalizeHexColor(v, fallback = "#111827") {
  const s = String(v || "").trim();
  if (/^#([0-9a-fA-F]{6})$/.test(s)) return s.toLowerCase();

  const rgb = s.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (rgb) {
    const hex = [rgb[1], rgb[2], rgb[3]]
      .map((n) => Number(n).toString(16).padStart(2, "0"))
      .join("");
    return `#${hex}`;
  }

  return fallback;
}

function resolveDefaults(defaults) {
  if (typeof defaults === "string") {
    return {
      color: normalizeHexColor(defaults, "#111827"),
      fontSize: 16,
      fontWeight: 700,
    };
  }
  return {
    color: normalizeHexColor(defaults?.color, "#111827"),
    fontSize: clampFontSize(defaults?.fontSize, 16),
    fontWeight: clampFontWeight(defaults?.fontWeight, 700),
  };
}

function stylesEqual(a, b) {
  return (
    normalizeHexColor(a?.color) === normalizeHexColor(b?.color) &&
    clampFontSize(a?.fontSize, 16) === clampFontSize(b?.fontSize, 16) &&
    clampFontWeight(a?.fontWeight, 700) === clampFontWeight(b?.fontWeight, 700)
  );
}

function storedPropsEqual(a, b) {
  return (
    normalizeHexColor(a?.color || "") === normalizeHexColor(b?.color || "") &&
    (a?.fontSize ?? null) === (b?.fontSize ?? null) &&
    (a?.fontWeight ?? null) === (b?.fontWeight ?? null)
  );
}

export function mergeAdjacentRuns(runs) {
  if (!Array.isArray(runs) || !runs.length) return [];
  const sorted = [...runs].sort((a, b) => a.start - b.start);
  const merged = [{ ...sorted[0] }];

  for (let i = 1; i < sorted.length; i += 1) {
    const prev = merged[merged.length - 1];
    const cur = sorted[i];
    if (storedPropsEqual(cur, prev) && cur.start <= prev.end) {
      prev.end = Math.max(prev.end, cur.end);
    } else if (storedPropsEqual(cur, prev) && cur.start === prev.end) {
      prev.end = cur.end;
    } else {
      merged.push({ ...cur });
    }
  }

  return merged;
}

function isWhitespaceChar(ch) {
  return /\s/.test(ch);
}

/** لا يُطبَّق التنسيق على المسافات بين الكلمات */
export function trimStyleRange(text, start, end) {
  const value = String(text || "");
  let safeStart = Math.max(0, Math.min(start, value.length));
  let safeEnd = Math.max(safeStart, Math.min(end, value.length));

  while (safeStart < safeEnd && isWhitespaceChar(value[safeStart])) safeStart += 1;
  while (safeEnd > safeStart && isWhitespaceChar(value[safeEnd - 1])) safeEnd -= 1;

  return { start: safeStart, end: safeEnd };
}

export function stripWhitespaceFromRuns(text, runs, defaults = {}) {
  const value = String(text || "");
  const len = value.length;
  if (!len || !Array.isArray(runs) || !runs.length) return [];

  const d = resolveDefaults(defaults);
  const chars = expandRunsToCharStyles(len, runs, d);

  for (let i = 0; i < len; i += 1) {
    if (isWhitespaceChar(value[i]) && !stylesEqual(chars[i], d)) {
      chars[i] = { ...d };
    }
  }

  return mergeAdjacentRuns(compressCharStylesToRuns(chars, d));
}

function expandRunsToCharStyles(len, runs, defaults) {
  const chars = Array.from({ length: len }, () => ({ ...defaults }));
  if (!Array.isArray(runs) || !runs.length) return chars;

  for (const run of runs) {
    const start = Math.max(0, Math.min(Number(run?.start) || 0, len));
    const end = Math.max(start, Math.min(Number(run?.end) || 0, len));
    if (start >= end) continue;

    const style = {
      color:
        run.color != null
          ? normalizeHexColor(run.color, defaults.color)
          : defaults.color,
      fontSize:
        run.fontSize != null
          ? clampFontSize(run.fontSize, defaults.fontSize)
          : defaults.fontSize,
      fontWeight:
        run.fontWeight != null
          ? clampFontWeight(run.fontWeight, defaults.fontWeight)
          : defaults.fontWeight,
    };

    for (let i = start; i < end; i += 1) chars[i] = style;
  }

  return chars;
}

function compressCharStylesToRuns(chars, defaults) {
  const runs = [];
  let i = 0;

  while (i < chars.length) {
    const style = chars[i];
    if (stylesEqual(style, defaults)) {
      i += 1;
      continue;
    }

    let j = i + 1;
    while (j < chars.length && stylesEqual(chars[j], style)) j += 1;

    const stored = { start: i, end: j };
    if (style.color !== defaults.color) stored.color = style.color;
    if (style.fontSize !== defaults.fontSize) stored.fontSize = style.fontSize;
    if (style.fontWeight !== defaults.fontWeight) stored.fontWeight = style.fontWeight;
    runs.push(stored);
    i = j;
  }

  return runs;
}

export function normalizeStyleRuns(text, runs, defaults = {}) {
  const len = String(text || "").length;
  if (!len || !Array.isArray(runs) || !runs.length) return [];

  const d = resolveDefaults(defaults);
  const bounded = runs
    .map((run) => ({
      start: Math.max(0, Math.min(Number(run?.start) || 0, len)),
      end: Math.max(0, Math.min(Number(run?.end) || 0, len)),
      color: run?.color,
      fontSize: run?.fontSize,
      fontWeight: run?.fontWeight,
    }))
    .filter((run) => run.end > run.start);

  const chars = expandRunsToCharStyles(len, bounded, d);
  return stripWhitespaceFromRuns(text, mergeAdjacentRuns(compressCharStylesToRuns(chars, d)), d);
}

export function normalizeColorRuns(text, runs, defaultColor = "#111827") {
  return normalizeStyleRuns(text, runs, { color: defaultColor });
}

export function applyStyleToRange(text, runs, start, end, patch = {}, defaults = {}) {
  const len = String(text || "").length;
  const trimmed = trimStyleRange(text, start, end);
  const safeStart = trimmed.start;
  const safeEnd = trimmed.end;
  const d = resolveDefaults(defaults);

  if (safeStart === safeEnd) return normalizeStyleRuns(text, runs, d);

  const chars = expandRunsToCharStyles(
    len,
    normalizeStyleRuns(text, runs, d),
    d
  );

  const nextStyle = { ...(chars[safeStart] || d) };
  if (patch.color != null) nextStyle.color = normalizeHexColor(patch.color, d.color);
  if (patch.fontSize != null) {
    nextStyle.fontSize = clampFontSize(patch.fontSize, d.fontSize);
  }
  if (patch.fontWeight != null) {
    nextStyle.fontWeight = clampFontWeight(patch.fontWeight, d.fontWeight);
  }

  for (let i = safeStart; i < safeEnd; i += 1) {
    if (!isWhitespaceChar(String(text || "")[i])) {
      chars[i] = { ...nextStyle };
    }
  }

  return stripWhitespaceFromRuns(text, compressCharStylesToRuns(chars, d), d);
}

export function applyColorToRange(text, runs, start, end, color, defaults = {}) {
  return applyStyleToRange(text, runs, start, end, { color }, defaults);
}

/** نمط النص عند التحديد أو عند موضع المؤشر */
export function getStyleAtRange(text, runs, start, end, defaults = {}) {
  const value = String(text || "");
  const len = value.length;
  const d = resolveDefaults(defaults);
  if (!len) return { ...d };

  const rangeStart = Math.max(0, Math.min(start, len));
  const rangeEnd = Math.max(rangeStart, Math.min(end, len));
  const normalizedRuns = normalizeStyleRuns(value, runs, d);
  const chars = expandRunsToCharStyles(len, normalizedRuns, d);

  if (rangeStart === rangeEnd) {
    const idx = rangeStart > 0 ? Math.min(rangeStart - 1, len - 1) : 0;
    return { ...chars[idx] };
  }

  const trimmed = trimStyleRange(value, rangeStart, rangeEnd);
  if (trimmed.end <= trimmed.start) return { ...d };

  let ref = null;
  for (let i = trimmed.start; i < trimmed.end; i += 1) {
    if (isWhitespaceChar(value[i])) continue;
    if (ref === null) {
      ref = chars[i];
      continue;
    }
    if (!stylesEqual(chars[i], ref)) {
      return { ...ref };
    }
  }

  return ref ? { ...ref } : { ...d };
}

export function splitTextByStyleRuns(text, runs, defaults = {}) {
  const value = String(text || "");
  const len = value.length;
  if (!len) return [];

  const d = resolveDefaults(defaults);
  const chars = expandRunsToCharStyles(len, normalizeStyleRuns(value, runs, d), d);

  const parts = [];
  let i = 0;
  while (i < len) {
    let j = i + 1;
    while (j < len && stylesEqual(chars[j], chars[i])) j += 1;
    parts.push({
      text: value.slice(i, j),
      color: chars[i].color,
      fontSize: chars[i].fontSize,
      fontWeight: chars[i].fontWeight,
    });
    i = j;
  }

  return parts.filter((part) => part.text);
}

export function splitTextByColorRuns(text, runs, defaultColor = "#111827") {
  return splitTextByStyleRuns(text, runs, { color: defaultColor });
}

export function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function spanStyleAttrs(part, defaults) {
  const attrs = [];
  const styles = [];

  if (part.color !== defaults.color) {
    attrs.push(`data-vcolor="${part.color}"`);
    styles.push(`color:${part.color}`);
  }
  if (part.fontSize !== defaults.fontSize) {
    attrs.push(`data-vsize="${part.fontSize}"`);
    styles.push(`font-size:${part.fontSize}px`);
  }
  if (part.fontWeight !== defaults.fontWeight) {
    attrs.push(`data-vweight="${part.fontWeight}"`);
    styles.push(`font-weight:${part.fontWeight}`);
  }

  return { attrs, styles };
}

export function htmlFromTextAndRuns(text, runs, defaults = {}) {
  const d = resolveDefaults(defaults);
  const parts = splitTextByStyleRuns(text, runs, d);

  return parts
    .map((part) => {
      const escaped = escapeHtml(part.text).replace(/\n/g, "<br>");
      if (stylesEqual(part, d)) return escaped;

      const { attrs, styles } = spanStyleAttrs(part, d);
      return `<span ${attrs.join(" ")} style="${styles.join(";")}">${escaped}</span>`;
    })
    .join("");
}

function getColorFromElement(el) {
  if (!el || el.nodeType !== Node.ELEMENT_NODE) return null;
  const dataColor = el.getAttribute("data-vcolor");
  if (dataColor) return normalizeHexColor(dataColor);
  const inline = el.style?.color;
  if (inline) return normalizeHexColor(inline);
  return null;
}

function getFontSizeFromElement(el) {
  if (!el || el.nodeType !== Node.ELEMENT_NODE) return null;
  const dataSize = el.getAttribute("data-vsize");
  if (dataSize) return clampFontSize(dataSize);
  const inline = el.style?.fontSize;
  if (inline) return clampFontSize(String(inline).replace(/px$/i, ""));
  return null;
}

function getFontWeightFromElement(el) {
  if (!el || el.nodeType !== Node.ELEMENT_NODE) return null;
  const dataWeight = el.getAttribute("data-vweight");
  if (dataWeight) return clampFontWeight(dataWeight);
  const inline = el.style?.fontWeight;
  if (inline) return clampFontWeight(inline);
  return null;
}

export function parseRichTextFromElement(root, defaults = {}) {
  if (!root) return { text: "", runs: [] };

  const d = resolveDefaults(defaults);
  let text = "";
  const runs = [];

  const pushSegment = (chunk, inherited = {}) => {
    if (!chunk) return;
    const start = text.length;
    text += chunk;
    const end = text.length;

    const style = {
      color:
        inherited.color != null
          ? normalizeHexColor(inherited.color, d.color)
          : d.color,
      fontSize:
        inherited.fontSize != null
          ? clampFontSize(inherited.fontSize, d.fontSize)
          : d.fontSize,
      fontWeight:
        inherited.fontWeight != null
          ? clampFontWeight(inherited.fontWeight, d.fontWeight)
          : d.fontWeight,
    };

    if (stylesEqual(style, d)) return;

    const stored = { start, end };
    if (style.color !== d.color) stored.color = style.color;
    if (style.fontSize !== d.fontSize) stored.fontSize = style.fontSize;
    if (style.fontWeight !== d.fontWeight) stored.fontWeight = style.fontWeight;
    runs.push(stored);
  };

  const appendText = (chunk, inherited = {}) => {
    if (!chunk) return;
    let i = 0;
    while (i < chunk.length) {
      const isWs = isWhitespaceChar(chunk[i]);
      let j = i + 1;
      while (j < chunk.length && isWhitespaceChar(chunk[j]) === isWs) j += 1;
      pushSegment(chunk.slice(i, j), isWs ? {} : inherited);
      i = j;
    }
  };

  const walk = (node, inherited = {}) => {
    if (node.nodeType === Node.TEXT_NODE) {
      appendText(node.textContent || "", inherited);
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;

    const el = node;
    if (el.tagName === "BR") {
      appendText("\n", inherited);
      return;
    }

    const nextInherited = {
      color: getColorFromElement(el) ?? inherited.color,
      fontSize: getFontSizeFromElement(el) ?? inherited.fontSize,
      fontWeight: getFontWeightFromElement(el) ?? inherited.fontWeight,
    };

    for (const child of el.childNodes) walk(child, nextInherited);
  };

  for (const child of root.childNodes) walk(child, {});

  return {
    text,
    runs: stripWhitespaceFromRuns(text, mergeAdjacentRuns(runs), d),
  };
}

export function getSelectionOffsets(root) {
  if (typeof window === "undefined" || !root) return null;
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;

  const range = sel.getRangeAt(0);
  if (!root.contains(range.commonAncestorContainer)) return null;

  const pre = range.cloneRange();
  pre.selectNodeContents(root);
  pre.setEnd(range.startContainer, range.startOffset);
  const start = pre.toString().length;
  const end = start + range.toString().length;
  return { start, end };
}

export function setSelectionOffsets(root, start, end) {
  if (typeof window === "undefined" || !root) return;

  const range = document.createRange();
  const sel = window.getSelection();
  let charIndex = 0;
  let startSet = false;

  const walk = (node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const len = node.textContent?.length || 0;
      const next = charIndex + len;

      if (!startSet && start >= charIndex && start <= next) {
        range.setStart(node, start - charIndex);
        startSet = true;
      }
      if (startSet && end >= charIndex && end <= next) {
        range.setEnd(node, end - charIndex);
        throw "done";
      }

      charIndex = next;
      return;
    }

    for (const child of node.childNodes) walk(child);
  };

  try {
    walk(root);
    if (startSet) range.setEnd(root, root.childNodes.length);
  } catch (err) {
    if (err !== "done") throw err;
  }

  sel?.removeAllRanges();
  sel?.addRange(range);
}

export const RICH_TEXT_FIELD_KEYS = [
  "words",
  "desc",
  "bank",
  "fxRate",
  "receivedBy",
  "beneficiary",
  "notes",
  "chequeNo",
  "nationalId",
  "phone",
  "sanadNo",
];

function fieldDefaultsForKey(key, fieldStyles, globalTextStyle) {
  const field = fieldStyles?.[key] || {};
  return {
    color: field.color || globalTextStyle?.color || "#111827",
    fontSize: field.fontSize ?? globalTextStyle?.fontSize ?? 16,
    fontWeight: field.fontWeight ?? globalTextStyle?.fontWeight ?? 700,
  };
}

export function sanitizeFieldColorRuns(input, texts, fieldStyles, globalTextStyle) {
  const out = {};
  if (!input || typeof input !== "object") return out;

  for (const key of RICH_TEXT_FIELD_KEYS) {
    const runs = input[key];
    if (!Array.isArray(runs) || !runs.length) continue;

    const text = String(texts?.[key] ?? "");
    const defaults = fieldDefaultsForKey(key, fieldStyles, globalTextStyle);
    const normalized = normalizeStyleRuns(text, runs, defaults);
    if (normalized.length) out[key] = normalized;
  }

  return out;
}

export function normalizeFieldColorRuns(input = {}, fieldStyles = {}, globalTextStyle = {}) {
  if (!input || typeof input !== "object") return {};
  const out = {};

  for (const [key, runs] of Object.entries(input)) {
    if (!Array.isArray(runs)) continue;
    const defaults = fieldDefaultsForKey(key, fieldStyles, globalTextStyle);
    const bounded = runs
      .map((run) => {
        const stored = {
          start: Number(run?.start) || 0,
          end: Number(run?.end) || 0,
        };
        if (run?.color != null) stored.color = normalizeHexColor(run.color, defaults.color);
        if (run?.fontSize != null) stored.fontSize = clampFontSize(run.fontSize, defaults.fontSize);
        if (run?.fontWeight != null) {
          stored.fontWeight = clampFontWeight(run.fontWeight, defaults.fontWeight);
        }
        return stored;
      })
      .filter((run) => run.end > run.start);

    const stripped = mergeAdjacentRuns(bounded)
      .map((run) => {
        const stored = { start: run.start, end: run.end };
        if (run.color && normalizeHexColor(run.color) !== normalizeHexColor(defaults.color)) {
          stored.color = normalizeHexColor(run.color);
        }
        if (
          run.fontSize != null &&
          clampFontSize(run.fontSize) !== clampFontSize(defaults.fontSize)
        ) {
          stored.fontSize = clampFontSize(run.fontSize);
        }
        if (
          run.fontWeight != null &&
          clampFontWeight(run.fontWeight) !== clampFontWeight(defaults.fontWeight)
        ) {
          stored.fontWeight = clampFontWeight(run.fontWeight);
        }
        return stored.color != null || stored.fontSize != null || stored.fontWeight != null
          ? stored
          : null;
      })
      .filter(Boolean);

    if (stripped.length) out[key] = stripped;
  }

  return out;
}
