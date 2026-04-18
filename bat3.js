const { MongoClient } = require("mongodb");

// 🔴 المصدر (Cluster01)
const sourceUri =
  "mongodb+srv://alimushtaqmcamt_db_user:pDaGJT4YdNMnIRfV@cluster01.dkc7vo.mongodb.net/test?appName=Cluster01";

// 🟢 الهدف (Cluster0)
const targetUri =
  "mongodb+srv://AliMushtaq:Aaa12345@cluster0.iihipor.mongodb.net/?appName=Cluster0";

const dbName = "test";
const collectionName = "requests_old-data";

async function run() {
  const sourceClient = new MongoClient(sourceUri);
  const targetClient = new MongoClient(targetUri);

  try {
    await sourceClient.connect();
    await targetClient.connect();

    console.log("✅ Connected to both databases");

    const sourceDB = sourceClient.db(dbName);
    const targetDB = targetClient.db(dbName);

    const sourceCol = sourceDB.collection(collectionName);
    const targetCol = targetDB.collection(collectionName);

    // 🔥 (اختياري) يمسح القديم من الهدف
    await targetCol.deleteMany({});
    console.log("🗑️ Cleared target collection");

    const docs = await sourceCol.find({}).toArray();

    console.log(`📦 Found ${docs.length} documents`);

    if (!docs.length) {
      console.log("⚠️ No data to copy");
      return;
    }

    const newDocs = docs.map((doc) => {
      const { _id, ...rest } = doc;
      return {
        ...rest,
        migratedFrom: "cluster01",
        migratedAt: new Date(),
      };
    });

    const result = await targetCol.insertMany(newDocs);

    console.log(`🎉 Copied ${result.insertedCount} documents successfully`);
  } catch (err) {
    console.error("❌ Error:", err);
  } finally {
    await sourceClient.close();
    await targetClient.close();
    console.log("🔌 Connections closed");
  }
}

run();