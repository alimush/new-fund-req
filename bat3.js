const { MongoClient } = require("mongodb");

// 🔴 المصدر
const sourceUri = process.env.SOURCE_MONGODB_URI || "";

// 🟢 الهدف
const targetUri = process.env.TARGET_MONGODB_URI || "";

const dbName = "test";
const collectionName = "requests_old-data";

async function run() {
  if (!sourceUri || !targetUri) {
    throw new Error("Missing SOURCE_MONGODB_URI or TARGET_MONGODB_URI");
  }

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

    // ✅ قراءة كل الداتا من المصدر
    const docs = await sourceCol.find({}).toArray();
    console.log(`📦 Found ${docs.length} documents in source collection: ${collectionName}`);

    if (!docs.length) {
      console.log("⚠️ No data found to copy");
      return;
    }

    // ✅ إدراج مثل ما هي، بدون حذف من المصدر وبدون تغيير اسم الكولكشن
    // ordered: false حتى إذا أكو _id مكرر يكمل بالباقي
    const result = await targetCol.insertMany(docs, { ordered: false });

    console.log(`🎉 Copied ${result.insertedCount} documents successfully to target collection: ${collectionName}`);
  } catch (err) {
    // duplicate key error
    if (err.code === 11000 || (err.writeErrors && err.writeErrors.length > 0)) {
      const insertedCount = err.result?.result?.nInserted || err.result?.nInserted || 0;
      console.log(`⚠️ Some documents already exist in target (duplicate _id).`);
      console.log(`✅ Inserted ${insertedCount} new documents.`);
      console.log(`⏭️ Skipped duplicated documents and continued.`);
    } else {
      console.error("❌ Error:", err);
    }
  } finally {
    await sourceClient.close();
    await targetClient.close();
    console.log("🔌 Connections closed");
  }
}

run();