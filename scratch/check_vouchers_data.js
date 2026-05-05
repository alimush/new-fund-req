const mongoose = require("mongoose");

const MONGO_URI = "mongodb+srv://AliMushtaq:Aaa12345@cluster0.iihipor.mongodb.net/?appName=Cluster0";

async function checkVouchers() {
  try {
    await mongoose.connect(MONGO_URI);
    const db = mongoose.connection.db;
    
    // البحث عن آخر 5 وصولات بشكل عام لرؤية الـ companyKey
    const lastVouchers = await db.collection("vouchers").find({}).sort({createdAt: -1}).limit(5).toArray();
    
    console.log("--- Last 5 Vouchers in DB ---");
    lastVouchers.forEach(v => {
      console.log(`Voucher No: ${v.voucherNo}`);
      console.log(`Company Key in DB: "${v.companyKey}"`);
      console.log(`Company Name in DB: "${v.companyName}"`);
      console.log("-----------------------------------");
    });
    
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkVouchers();
