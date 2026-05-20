/**
 * يزيل voucherId/voucherNo من آخر خطوة إذا يشيران لوصل لا يخص هذا الطلب.
 * الاستخدام: node scripts/repair-wrong-voucher-steps.mjs [--dry-run] [companyKey]
 */
import mongoose from "mongoose";
import { config } from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, "..", ".env.local") });
config({ path: join(__dirname, "..", ".env") });

const MONGODB_URI = process.env.MONGODB_URI;
const dryRun = process.argv.includes("--dry-run");
const onlyCompany = process.argv.find((a) => a && !a.startsWith("-") && a !== process.argv[1]);

function safeString(v) {
  return String(v ?? "").trim();
}

function idsEqual(a, b) {
  const x = safeString(a);
  const y = safeString(b);
  if (!x || !y) return false;
  if (x === y) return true;
  if (!mongoose.Types.ObjectId.isValid(x) || !mongoose.Types.ObjectId.isValid(y)) return false;
  return String(new mongoose.Types.ObjectId(x)) === String(new mongoose.Types.ObjectId(y));
}

function belongs(voucher, requestId, requestCode) {
  if (!voucher) return false;
  const vid = safeString(voucher.requestId);
  const vcode = safeString(voucher.requestCode);
  if (vid && idsEqual(vid, requestId)) return true;
  if (vcode && requestCode && vcode === requestCode) return true;
  return false;
}

async function main() {
  if (!MONGODB_URI) {
    console.error("MONGODB_URI missing");
    process.exit(1);
  }
  await mongoose.connect(MONGODB_URI);
  const db = mongoose.connection.db;
  const Voucher = db.collection("vouchers");

  const collections = await db.listCollections().toArray();
  const requestCols = collections
    .map((c) => c.name)
    .filter((n) => n.startsWith("requests_") || n === "requests");

  let fixed = 0;
  let scanned = 0;

  for (const colName of requestCols) {
    if (onlyCompany && !colName.includes(onlyCompany.replace(/-/g, "").toLowerCase())) {
      if (!colName.toLowerCase().includes(onlyCompany.toLowerCase().replace(/-/g, ""))) continue;
    }
    const col = db.collection(colName);
    const cursor = col.find(
      { "workflow.steps.voucherId": { $exists: true, $ne: "" } },
      { projection: { requestCode: 1, workflow: 1 } }
    );

    for await (const req of cursor) {
      scanned += 1;
      const steps = req.workflow?.steps || [];
      if (!steps.length) continue;
      const lastIdx = steps.length - 1;
      const step = steps[lastIdx];
      const stepVid = safeString(step?.voucherId);
      if (!stepVid || !mongoose.Types.ObjectId.isValid(stepVid)) continue;

      const voucher = await Voucher.findOne({ _id: new mongoose.Types.ObjectId(stepVid) });
      const rid = String(req._id);
      const rcode = safeString(req.requestCode);

      if (belongs(voucher, rid, rcode)) continue;

      const orphanNo = !stepVid && safeString(step?.voucherNo);
      if (!voucher && !orphanNo) continue;

      console.log(
        dryRun ? "[dry-run]" : "[fix]",
        colName,
        rcode || rid,
        "step voucher",
        stepVid,
        orphanNo ? "orphan voucherNo" : "wrong voucherId",
        "-> clear",
        voucher
          ? `(was linked to ${safeString(voucher.requestId)} / ${voucher.requestCode || ""})`
          : ""
      );

      if (!dryRun) {
        await col.updateOne(
          { _id: req._id },
          {
            $unset: {
              [`workflow.steps.${lastIdx}.voucherId`]: "",
              [`workflow.steps.${lastIdx}.voucherNo`]: "",
            },
          }
        );
      }
      fixed += 1;
    }
  }

  console.log(`Done. scanned=${scanned} cleared=${fixed} dryRun=${dryRun}`);
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
