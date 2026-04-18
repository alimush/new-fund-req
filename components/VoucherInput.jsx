"use client";

export default function VoucherInput({
  inputRef,
  value,
  onChange,
  style,
  direction = "rtl",
  textAlign,
  placeholder = "",
}) {
  return (
    <input
      ref={inputRef}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className="absolute"
      style={{
        ...style,
        background: "transparent",
        border: "none",
        outline: "none",
        direction,
        textAlign: textAlign || (direction === "rtl" ? "right" : "left"),
        unicodeBidi: "plaintext",
        caretColor: "black",
        fontFamily: "inherit",
        fontSize: "16px",
        fontWeight: 700,
        lineHeight: 1.25,
        color: "#111827",
      }}
    />
  );
}