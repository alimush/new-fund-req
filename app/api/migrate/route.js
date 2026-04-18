import { NextResponse } from "next/server";
import { MongoClient } from "mongodb";

const SOURCE_URI =
  "mongodb+srv://AliMushtaq:Aaa12345@cluster0.iihipor.mongodb.net/?appName=Cluster0";

const TARGET_URI =
  "mongodb+srv://alimushtaqmcamt_db_user:pDaGJT4YdNMnIRfV@cluster01.dkc7vo.mongodb.net/?appName=Cluster01";

const SOURCE_DB = "oldDatabaseName";
const TARGET_DB = "newDatabaseName";

// حماية بسيطة


export async function POST(req) {
  let sourceClient;
  let targetClient;

  try {
    const body = await req.json();
    const { secret } = body;



    sourceClient = new MongoClient(SOURCE_URI);
    targetClient = new MongoClient(TARGET_URI);

    await sourceClient.connect();
    await targetClient.connect();

    const sourceDb = sourceClient.db(SOURCE_DB);
    const targetDb = targetClient.db(TARGET_DB);

    const collections = await sourceDb.listCollections().toArray();

    const results = [];

    for (const collectionInfo of collections) {
      const collectionName = collectionInfo.name;

      const sourceCollection = sourceDb.collection(collectionName);
      const targetCollection = targetDb.collection(collectionName);

      const docs = await sourceCollection.find({}).toArray();

      if (docs.length > 0) {
        // إذا تريد تمسح الموجود قبل النقل


        await targetCollection.insertMany(docs, { ordered: false });
      }

      results.push({
        collection: collectionName,
        count: docs.length,
      });
    }

    return NextResponse.json({
      success: true,
      message: "Migration completed",
      results,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error.message,
      },
      { status: 500 }
    );
  } finally {
    if (sourceClient) await sourceClient.close();
    if (targetClient) await targetClient.close();
  }
}