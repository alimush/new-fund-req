import mongoose from "mongoose";
import { readFileSync } from "fs";

const envText = readFileSync(".env", "utf8");
const uri =
  envText.match(/^MONGODB_URI\s*=\s*"?([^"\n]+)"?/m)?.[1]?.trim() ||
  process.env.MONGODB_URI;

if (!uri) {
  console.error("MONGODB_URI not found");
  process.exit(1);
}

await mongoose.connect(uri);
const db = mongoose.connection.db;

const workflows = await db.collection("workflows").find({}).toArray();
const alleanzaWf = workflows.filter((w) =>
  String(w.company || "").toLowerCase().includes("alleanza")
);

console.log("All workflow companies:", [...new Set(workflows.map((w) => w.company))]);
console.log("\nAlleanza workflows:", alleanzaWf.length);
alleanzaWf.forEach((w) => {
  console.log(`- ${w.name} | company=${w.company} | steps=${w.steps?.length || 0}`);
  console.log("  rules:", JSON.stringify(w.rules || {}));
});

const perms = await db
  .collection("permissions")
  .find({ companies: { $regex: /alleanza/i } })
  .toArray();
console.log("\nPermission groups with alleanza:", perms.length);
perms.forEach((p) => {
  console.log(`- ${p.name} | perms=${(p.permissions || []).join(", ")} | users=${(p.users || []).length}`);
});

await mongoose.disconnect();
