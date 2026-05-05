const mongoose = require("mongoose");

const MONGO_URI = "mongodb+srv://AliMushtaq:Aaa12345@cluster0.iihipor.mongodb.net/?appName=Cluster0";

async function checkPermissions() {
  try {
    await mongoose.connect(MONGO_URI);
    const db = mongoose.connection.db;
    const permissions = await db.collection("permissions").find({}).toArray();
    
    console.log("--- Permission Groups and Companies ---");
    permissions.forEach(p => {
      console.log(`Group: ${p.name}`);
      console.log(`Companies: ${JSON.stringify(p.companies)}`);
      console.log("-----------------------------------");
    });
    
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkPermissions();
