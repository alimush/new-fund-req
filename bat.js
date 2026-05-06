import { MongoClient } from "mongodb";

const SOURCE_URI = process.env.SOURCE_MONGODB_URI || "";
const TARGET_URI = process.env.TARGET_MONGODB_URI || "";

const SOURCE_DB = "test";
const TARGET_DB = "test";

const BATCH_SIZE = 1000;


async function migrate() {
  if (!SOURCE_URI || !TARGET_URI) {
    throw new Error("Missing SOURCE_MONGODB_URI or TARGET_MONGODB_URI");
  }

  const sourceClient = new MongoClient(SOURCE_URI);
  const targetClient = new MongoClient(TARGET_URI);

  try {
    console.log("🔌 Connecting...");

    await sourceClient.connect();
    await targetClient.connect();

    const sourceDb = sourceClient.db(SOURCE_DB);
    const targetDb = targetClient.db(TARGET_DB);

    const collections = await sourceDb.listCollections().toArray();

    console.log(`📦 Found ${collections.length} collections`);

    for (const col of collections) {
      const name = col.name;

      console.log(`\n🚀 Migrating: ${name}`);

      const sourceCollection = sourceDb.collection(name);
      const targetCollection = targetDb.collection(name);

      const cursor = sourceCollection.find({});
      let batch = [];
      let total = 0;

      while (await cursor.hasNext()) {
        const doc = await cursor.next();
        batch.push(doc);

        if (batch.length === BATCH_SIZE) {
          try {
            const result = await targetCollection.insertMany(batch, {
              ordered: false,
            });
            total += result.insertedCount;
          } catch (err) {
            console.log("⚠️ Duplicate skipped");
          }

          console.log(`➡️ ${total} inserted`);
          batch = [];
        }
      }

      if (batch.length > 0) {
        try {
          const result = await targetCollection.insertMany(batch, {
            ordered: false,
          });
          total += result.insertedCount;
        } catch (err) {
          console.log("⚠️ Duplicate skipped");
        }
      }

      console.log(`✅ Done ${name}: ${total} records`);
    }

    console.log("\n🎉 Migration Completed Successfully");
  } catch (err) {
    console.error("❌ Error:", err.message);
  } finally {
    await sourceClient.close();
    await targetClient.close();
    console.log("🔌 Connections closed");
  }
}

migrate();