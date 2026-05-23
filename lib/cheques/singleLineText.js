/** يمنع أسطر جديدة — سطر واحد للمبلغ كتابة */
export function singleLineText(val) {
  return String(val ?? "")
    .replace(/[\r\n]+/g, " ")
    .replace(/\s+/g, " ");
}
