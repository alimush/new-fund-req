"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import {
  getSelectionOffsets,
  htmlFromTextAndRuns,
  parseRichTextFromElement,
  setSelectionOffsets,
} from "@/lib/voucher/fieldColorRuns";

function isStyledSpanElement(el) {
  if (!el || el.nodeType !== Node.ELEMENT_NODE) return false;
  if (el.tagName !== "SPAN") return false;
  return (
    el.hasAttribute("data-vcolor") ||
    el.hasAttribute("data-vsize") ||
    el.hasAttribute("data-vweight")
  );
}

/** النص الجديد بعد/قبل كلمة منسّقة لا يرث تنسيقها */
function moveCaretOutsideStyledBoundary(root) {
  if (!root || typeof window === "undefined") return;

  const sel = window.getSelection();
  if (!sel?.rangeCount || !sel.isCollapsed) return;

  const range = sel.getRangeAt(0);
  if (!root.contains(range.commonAncestorContainer)) return;

  const { startContainer, startOffset } = range;
  if (startContainer.nodeType !== Node.TEXT_NODE) return;

  const parent = startContainer.parentElement;
  if (!parent || parent === root || !isStyledSpanElement(parent)) return;

  const textLen = startContainer.textContent?.length || 0;
  let nextRange = null;

  if (startOffset === textLen) {
    nextRange = document.createRange();
    nextRange.setStartAfter(parent);
    nextRange.collapse(true);
  } else if (startOffset === 0) {
    nextRange = document.createRange();
    nextRange.setStartBefore(parent);
    nextRange.collapse(true);
  }

  if (!nextRange) return;
  sel.removeAllRanges();
  sel.addRange(nextRange);
}

const INSERT_INPUT_TYPES = new Set([
  "insertText",
  "insertReplacementText",
  "insertFromPaste",
  "insertFromDrop",
  "insertCompositionText",
]);

const VoucherRichTextInput = forwardRef(function VoucherRichTextInput(
  {
    value = "",
    colorRuns = [],
    defaultColor = "#111827",
    defaultFontSize = 16,
    defaultFontWeight = 700,
    onChange,
    onColorRunsChange,
    onSelectionChange,
    fieldKey,
    singleLine = false,
    className = "",
    style = {},
    direction = "rtl",
    onFocus,
    onClick,
    ...rest
  },
  ref
) {
  const rootRef = useRef(null);
  const isComposingRef = useRef(false);

  const styleDefaults = {
    color: defaultColor,
    fontSize: defaultFontSize,
    fontWeight: defaultFontWeight,
  };

  useImperativeHandle(ref, () => ({
    focus: () => rootRef.current?.focus(),
    blur: () => rootRef.current?.blur(),
    get root() {
      return rootRef.current;
    },
  }));

  const syncHtml = useCallback(
    (preserveSelection = false) => {
      const el = rootRef.current;
      if (!el) return;

      const html = htmlFromTextAndRuns(value, colorRuns, styleDefaults);
      if (el.innerHTML === html) return;

      const selection =
        preserveSelection && document.activeElement === el
          ? getSelectionOffsets(el)
          : null;

      el.innerHTML = html || "";

      if (selection) {
        setSelectionOffsets(el, selection.start, selection.end);
      }
    },
    [value, colorRuns, defaultColor, defaultFontSize, defaultFontWeight]
  );

  useEffect(() => {
    if (document.activeElement === rootRef.current) {
      syncHtml(true);
      return;
    }
    syncHtml(false);
  }, [syncHtml]);

  const emitChange = useCallback(() => {
    const el = rootRef.current;
    if (!el) return;
    const parsed = parseRichTextFromElement(el, styleDefaults);
    onChange?.(parsed.text);
    onColorRunsChange?.(parsed.runs);
  }, [defaultColor, defaultFontSize, defaultFontWeight, onChange, onColorRunsChange]);

  const reportSelection = useCallback(() => {
    if (!fieldKey) return;
    const offsets = getSelectionOffsets(rootRef.current);
    if (!offsets) return;
    onSelectionChange?.({ fieldKey, ...offsets });
  }, [fieldKey, onSelectionChange]);

  const handleInput = () => {
    if (isComposingRef.current) return;
    emitChange();
    reportSelection();
  };

  return (
    <div
      ref={rootRef}
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      dir={direction}
      className={className}
      style={{
        ...style,
        color: defaultColor,
        caretColor: defaultColor,
        fontSize: `${defaultFontSize}px`,
        fontWeight: defaultFontWeight,
      }}
      onInput={handleInput}
      onBeforeInput={(e) => {
        if (isComposingRef.current) return;
        if (!INSERT_INPUT_TYPES.has(e.inputType)) return;
        moveCaretOutsideStyledBoundary(rootRef.current);
      }}
      onFocus={(e) => {
        onFocus?.(e);
        reportSelection();
      }}
      onClick={(e) => {
        onClick?.(e);
        reportSelection();
      }}
      onKeyUp={reportSelection}
      onMouseUp={reportSelection}
      onCompositionStart={() => {
        isComposingRef.current = true;
      }}
      onCompositionEnd={() => {
        isComposingRef.current = false;
        handleInput();
      }}
      onPaste={(e) => {
        e.preventDefault();
        const pasted = e.clipboardData.getData("text/plain");
        const text = singleLine ? pasted.replace(/[\r\n]+/g, " ") : pasted;
        document.execCommand("insertText", false, text);
      }}
      onKeyDown={(e) => {
        if (singleLine && e.key === "Enter") e.preventDefault();
      }}
      {...rest}
    />
  );
});

export default VoucherRichTextInput;
