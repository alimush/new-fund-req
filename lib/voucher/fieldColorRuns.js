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

export function mergeAdjacentRuns(runs) {
  if (!Array.isArray(runs) || !runs.length) return [];
  const sorted = [...runs].sort((a, b) => a.start - b.start);
  const merged = [{ ...sorted[0] }];

  for (let i = 1; i < sorted.length; i += 1) {
    const prev = merged[merged.length - 1];
    const cur = sorted[i];
    if (cur.color === prev.color && cur.start <= prev.end) {
      prev.end = Math.max(prev.end, cur.end);
    } else if (cur.color === prev.color && cur.start === prev.end) {
      prev.end = cur.end;
    } else {
      merged.push({ ...cur });
    }
  }

  return merged;
}

export function normalizeColorRuns(text, runs, defaultColor = "#111827") {
  const len = String(text || "").length;
  if (!Array.isArray(runs) || !runs.length || !len) return [];

  const out = [];
  for (const run of runs) {
    const start = Math.max(0, Math.min(Number(run?.start) || 0, len));
    const end = Math.max(start, Math.min(Number(run?.end) || 0, len));
    if (start >= end) continue;
    const color = normalizeHexColor(run?.color, defaultColor);
    if (color === normalizeHexColor(defaultColor)) continue;
    out.push({ start, end, color });
  }

  return mergeAdjacentRuns(out);
}

function compressColorsToRuns(colors) {
  const runs = [];
  let i = 0;

  while (i < colors.length) {
    const color = colors[i];
    if (!color) {
      i += 1;
      continue;
    }
    let j = i + 1;
    while (j < colors.length && colors[j] === color) j += 1;
    runs.push({ start: i, end: j, color });
    i = j;
  }

  return runs;
}

export function applyColorToRange(text, runs, start, end, color) {
  const normalizedColor = normalizeHexColor(color);
  const len = String(text || "").length;
  const safeStart = Math.max(0, Math.min(start, len));
  const safeEnd = Math.max(safeStart, Math.min(end, len));
  if (safeStart === safeEnd) return normalizeColorRuns(text, runs);

  const colors = new Array(len).fill(null);
  for (const run of normalizeColorRuns(text, runs)) {
    for (let i = run.start; i < run.end; i += 1) colors[i] = run.color;
  }
  for (let i = safeStart; i < safeEnd; i += 1) colors[i] = normalizedColor;

  return compressColorsToRuns(colors);
}

export function splitTextByColorRuns(text, runs, defaultColor = "#111827") {
  const value = String(text || "");
  const len = value.length;
  if (!len) return [];

  const normalized = normalizeColorRuns(value, runs, defaultColor);
  if (!normalized.length) return [{ text: value, color: defaultColor }];

  const parts = [];
  let cursor = 0;

  for (const run of normalized) {
    if (cursor < run.start) {
      parts.push({
        text: value.slice(cursor, run.start),
        color: defaultColor,
      });
    }
    parts.push({
      text: value.slice(run.start, run.end),
      color: run.color,
    });
    cursor = run.end;
  }

  if (cursor < len) {
    parts.push({ text: value.slice(cursor), color: defaultColor });
  }

  return parts.filter((part) => part.text);
}

export function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function htmlFromTextAndRuns(text, runs, defaultColor = "#111827") {
  const parts = splitTextByColorRuns(text, runs, defaultColor);
  return parts
    .map((part) => {
      const escaped = escapeHtml(part.text).replace(/\n/g, "<br>");
      if (normalizeHexColor(part.color) === normalizeHexColor(defaultColor)) {
        return escaped;
      }
      return `<span data-vcolor="${part.color}" style="color:${part.color}">${escaped}</span>`;
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

export function parseRichTextFromElement(root, defaultColor = "#111827") {
  if (!root) return { text: "", runs: [] };

  let text = "";
  const runs = [];

  const appendText = (chunk, color) => {
    if (!chunk) return;
    const start = text.length;
    text += chunk;
    const end = text.length;
    if (!color) return;
    const normalized = normalizeHexColor(color, defaultColor);
    if (normalized === normalizeHexColor(defaultColor)) return;
    runs.push({ start, end, color: normalized });
  };

  const walk = (node, inheritedColor = null) => {
    if (node.nodeType === Node.TEXT_NODE) {
      appendText(node.textContent || "", inheritedColor);
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;

    const el = node;
    if (el.tagName === "BR") {
      appendText("\n", inheritedColor);
      return;
    }

    const color = getColorFromElement(el) || inheritedColor;
    for (const child of el.childNodes) walk(child, color);
  };

  for (const child of root.childNodes) walk(child, null);

  return {
    text,
    runs: mergeAdjacentRuns(runs),
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

export function sanitizeFieldColorRuns(input, texts, fieldStyles, globalTextStyle) {
  const out = {};
  if (!input || typeof input !== "object") return out;

  for (const key of RICH_TEXT_FIELD_KEYS) {
    const runs = input[key];
    if (!Array.isArray(runs) || !runs.length) continue;

    const text = String(texts?.[key] ?? "");
    const defaultColor =
      fieldStyles?.[key]?.color || globalTextStyle?.color || "#111827";
    const normalized = normalizeColorRuns(text, runs, defaultColor);
    if (normalized.length) out[key] = normalized;
  }

  return out;
}

export function normalizeFieldColorRuns(input = {}) {
  if (!input || typeof input !== "object") return {};
  const out = {};
  for (const [key, runs] of Object.entries(input)) {
    if (!Array.isArray(runs)) continue;
    out[key] = runs
      .map((run) => ({
        start: Number(run?.start) || 0,
        end: Number(run?.end) || 0,
        color: normalizeHexColor(run?.color),
      }))
      .filter((run) => run.end > run.start);
  }
  return out;
}
