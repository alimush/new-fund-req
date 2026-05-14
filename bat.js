const { MongoClient } = require("mongodb");

const SOURCE_URI =
  "1";

const TARGET_URI =
  "2";

const SOURCE_DB = "test";
const TARGET_DB = "test";

const BATCH_SIZE = 1000;

async function cloneIndexes(sourceCollection, targetCollection) {
  let specs;
  try {
    specs = await sourceCollection.listIndexes().toArray();
  } catch {
    return;
  }
  for (const spec of specs) {
    if (spec.name === "_id_") continue;
    const key = spec.key;
    if (!key || typeof key !== "object") continue;
    const opts = { ...spec };
    delete opts.v;
    delete opts.key;
    delete opts.ns;
    try {
      await targetCollection.createIndex(key, opts);
    } catch (e) {
      console.warn(`   ⚠️ index ${spec.name}: ${e?.message || e}`);
    }
  }
}

async function copyCollectionData(sourceCollection, targetCollection) {
  const cursor = sourceCollection.find({});
  let batch = [];
  let total = 0;

  while (await cursor.hasNext()) {
    batch.push(await cursor.next());
    if (batch.length >= BATCH_SIZE) {
      await targetCollection.insertMany(batch, { ordered: false });
      total += batch.length;
      console.log(`   ➡️ ${total} docs…`);
      batch = [];
    }
  }
  if (batch.length > 0) {
    await targetCollection.insertMany(batch, { ordered: false });
    total += batch.length;
  }
  return total;
}

async function migrate() {
  if (SOURCE_URI === TARGET_URI && SOURCE_DB === TARGET_DB) {
    console.error("❌ SOURCE and TARGET are identical. Abort.");
    process.exit(1);
  }

  const sourceClient = new MongoClient(SOURCE_URI);
  const targetClient = new MongoClient(TARGET_URI);

  try {
    console.log("🔌 Connecting…");

    await sourceClient.connect();
    await targetClient.connect();

    const sourceDb = sourceClient.db(SOURCE_DB);
    const targetDb = targetClient.db(TARGET_DB);

    console.log(`\n⚠️  Dropping target database "${TARGET_DB}" (full clone).`);
    await targetDb.dropDatabase();
    console.log("🗑️  Target dropped.\n");

    let collections;
    try {
      collections = await sourceDb.listCollections({ type: "collection" }).toArray();
    } catch {
      collections = await sourceDb.listCollections().toArray();
    }

    const names = collections
      .map((c) => c.name)
      .filter((n) => n && !String(n).startsWith("system."));

    console.log(`📦 ${names.length} collections\n`);

    for (const name of names) {
      console.log(`🚀 ${name}`);
      const sc = sourceDb.collection(name);
      const tc = targetDb.collection(name);
      await cloneIndexes(sc, tc);
      const n = await copyCollectionData(sc, tc);
      console.log(`   ✅ ${n} records\n`);
    }

    console.log("\n🎉 Clone completed.");
  } catch (err) {
    console.error("❌ Error:", err?.message || err);
    process.exitCode = 1;
  } finally {
    await sourceClient.close();
    await targetClient.close();
    console.log("🔌 Connections closed.");
  }
}

migrate();
