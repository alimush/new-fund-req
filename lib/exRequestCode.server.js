import mongoose from "mongoose";

/** Shared counter collection (same pattern as app/api/requests/route.js). */
const CounterSchema = new mongoose.Schema({
  key: { type: String, unique: true },
  seq: { type: Number, default: 0 },
});

const Counter =
  mongoose.models.Counter || mongoose.model("Counter", CounterSchema);

export function slugExRequestCodeSegment(s) {
  return (
    String(s || "")
      .trim()
      .toUpperCase()
      .replace(/\s+/g, "-")
      .replace(/[^A-Z0-9-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "X"
  );
}

/** اسم الفورم كامل (مكبّس وASCII) + رقم، مثل REPLACE-BOOKING-TRANSFER-0001 */
export async function nextExRequestCode(company, pageKey) {
  const companySlug = slugExRequestCodeSegment(company);
  const formSlug = slugExRequestCodeSegment(pageKey);
  const counterKey = `EX_REQ_${companySlug}_${formSlug}`;

  const counter = await Counter.findOneAndUpdate(
    { key: counterKey },
    { $inc: { seq: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  const serial = String(counter.seq).padStart(4, "0");
  return `${formSlug}-${serial}`;
}
