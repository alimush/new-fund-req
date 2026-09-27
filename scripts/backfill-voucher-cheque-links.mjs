/**
 * يربط الوصولات القديمة التي فيها رقم صك مع نظام الصكوك (chequeId).
 *
 * الاستخدام:
 *   node scripts/backfill-voucher-cheque-links.mjs --dry-run
 *   node scripts/backfill-voucher-cheque-links.mjs
 *   node scripts/backfill-voucher-cheque-links.mjs --limit=100
 */
import mongoose from "mongoose";
import { readFileSync, existsSync } from "fs";
import { fileURLToPath, pathToFileURL } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return;
  const text = readFileSync(filePath, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}

loadEnvFile(join(root, ".env.local"));
loadEnvFile(join(root, ".env"));

function normalizeChequeNumber(value) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, "");
}

async function main() {
  const MONGODB_URI = process.env.MONGODB_URI;
  if (!MONGODB_URI) {
    console.error("MONGODB_URI missing (.env.local / .env)");
    process.exit(1);
  }

  const dryRun = process.argv.includes("--dry-run");
  const limitArg = process.argv.find((a) => a.startsWith("--limit="));
  const limit = limitArg ? Number(limitArg.split("=")[1]) : 0;

  console.log(
    dryRun
      ? "DRY RUN — لن يُحفظ أي تعديل"
      : "LIVE — سيتم ربط الوصولات بالصكوك"
  );

  await mongoose.connect(MONGODB_URI);

  const Cheque = (await import(pathToFileURL(join(root, "models/Cheque.js")).href))
    .default;
  const Voucher = (
    await import(pathToFileURL(join(root, "models/Voucher.js")).href)
  ).default;

  const docs = await Cheque.find({ status: { $ne: "void" } })
    .select("_id chequeNumber updatedAt createdAt")
    .sort({ updatedAt: -1, createdAt: -1 })
    .lean();

  const chequeIndex = new Map();
  for (const doc of docs) {
    const key = normalizeChequeNumber(doc.chequeNumber);
    if (!key || chequeIndex.has(key)) continue;
    chequeIndex.set(key, doc._id);
  }

  const filter = {
    chequeNo: { $exists: true, $nin: [null, ""] },
    $or: [{ chequeId: null }, { chequeId: { $exists: false } }],
  };

  let query = Voucher.find(filter)
    .select("_id companyKey mode voucherNo chequeNo chequeId")
    .sort({ updatedAt: -1 });
  if (limit > 0) query = query.limit(limit);

  const vouchers = await query.lean();
  let matched = 0;
  let updated = 0;
  let noMatch = 0;
  const samples = [];
  const ops = [];

  for (const v of vouchers) {
    const key = normalizeChequeNumber(v.chequeNo);
    if (!key) {
      noMatch += 1;
      continue;
    }
    const chequeId = chequeIndex.get(key);
    if (!chequeId) {
      noMatch += 1;
      continue;
    }

    matched += 1;
    if (samples.length < 30) {
      samples.push({
        voucherId: String(v._id),
        companyKey: v.companyKey,
        voucherNo: v.voucherNo,
        mode: v.mode,
        chequeNo: key,
        chequeId: String(chequeId),
      });
    }

    if (!dryRun) {
      ops.push({
        updateOne: {
          filter: { _id: v._id },
          update: { $set: { chequeId } },
        },
      });
    }
  }

  if (!dryRun && ops.length) {
    const CHUNK = 500;
    for (let i = 0; i < ops.length; i += CHUNK) {
      const res = await Voucher.bulkWrite(ops.slice(i, i + CHUNK), {
        ordered: false,
      });
      updated += res.modifiedCount || 0;
    }
  }

  const result = {
    scanned: vouchers.length,
    matched,
    updated: dryRun ? 0 : updated,
    wouldUpdate: dryRun ? matched : undefined,
    noMatch,
    chequeIndexSize: chequeIndex.size,
    samples,
    dryRun,
  };

  console.log(JSON.stringify(result, null, 2));
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
