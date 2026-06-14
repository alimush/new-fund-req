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

const VoucherRichTextInput = forwardRef(function VoucherRichTextInput(
  {
    value = "",
    colorRuns = [],
    defaultColor = "#111827",
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

      const html = htmlFromTextAndRuns(value, colorRuns, defaultColor);
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
    [value, colorRuns, defaultColor]
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
    const parsed = parseRichTextFromElement(el, defaultColor);
    onChange?.(parsed.text);
    onColorRunsChange?.(parsed.runs);
  }, [defaultColor, onChange, onColorRunsChange]);

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
      }}
      onInput={handleInput}
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
