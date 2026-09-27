"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * اقتراحات أرقام الصكوك من نظام الصكوك (debounced)
 */
export function useVoucherChequeSuggest({
  enabled = true,
  minLength = 1,
} = {}) {
  const [options, setOptions] = useState([]);
  const [show, setShow] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [pos, setPos] = useState({ left: 0, top: 0, width: 280 });
  const anchorRef = useRef(null);
  const boxRef = useRef(null);
  const debounceRef = useRef(null);
  const abortRef = useRef(null);

  const recalcPos = useCallback(() => {
    const el = anchorRef.current?.root || anchorRef.current;
    if (!el?.getBoundingClientRect) return;
    const r = el.getBoundingClientRect();
    setPos({
      left: r.left,
      top: r.bottom + 6,
      width: Math.max(r.width, 320),
    });
  }, []);

  const close = useCallback(() => {
    setShow(false);
    setActiveIdx(-1);
  }, []);

  const fetchSuggestions = useCallback(
    async (q) => {
      const text = String(q || "").trim();
      if (!enabled || text.length < minLength) {
        setOptions([]);
        setShow(false);
        setActiveIdx(-1);
        setLoading(false);
        return;
      }

      if (abortRef.current) abortRef.current.abort();
      const ac = new AbortController();
      abortRef.current = ac;

      setLoading(true);
      try {
        const params = new URLSearchParams({ q: text });
        const res = await fetch(
          `/api/vouchers/cheque-suggest?${params.toString()}`,
          { credentials: "include", signal: ac.signal }
        );
        const json = await res.json();

        if (json?.success && Array.isArray(json.data) && json.data.length) {
          setOptions(json.data);
          recalcPos();
          setShow(true);
          setActiveIdx(-1);
        } else {
          setOptions([]);
          setShow(false);
          setActiveIdx(-1);
        }
      } catch (err) {
        if (err?.name !== "AbortError") {
          console.error("cheque suggest error:", err);
        }
      } finally {
        if (abortRef.current === ac) setLoading(false);
      }
    },
    [enabled, minLength, recalcPos]
  );

  const openFor = useCallback(
    (text, ref) => {
      if (!enabled) return;
      anchorRef.current = ref?.current || ref;

      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        fetchSuggestions(text);
      }, 220);
    },
    [enabled, fetchSuggestions]
  );

  const handleKeyDown = useCallback(
    (e) => {
      if (!show || !options.length) return null;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIdx((i) => Math.min(i + 1, options.length - 1));
        return "handled";
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIdx((i) => Math.max(i - 1, 0));
        return "handled";
      }
      if (e.key === "Escape") {
        close();
        return "handled";
      }
      if (e.key === "Enter" && activeIdx >= 0 && options[activeIdx]) {
        e.preventDefault();
        return "pick";
      }
      return null;
    },
    [show, options, activeIdx, close]
  );

  useEffect(() => {
    if (!show) return;
    recalcPos();
    const onScrollOrResize = () => recalcPos();
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [show, recalcPos]);

  useEffect(() => {
    if (!show) return;
    const onDown = (e) => {
      const anchor = anchorRef.current?.root || anchorRef.current;
      if (anchor?.contains?.(e.target)) return;
      if (boxRef.current?.contains(e.target)) return;
      close();
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [show, close]);

  useEffect(
    () => () => {
      clearTimeout(debounceRef.current);
      abortRef.current?.abort();
    },
    []
  );

  return {
    options,
    show,
    activeIdx,
    setActiveIdx,
    loading,
    pos,
    boxRef,
    openFor,
    close,
    handleKeyDown,
  };
}
