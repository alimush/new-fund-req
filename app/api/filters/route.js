import { NextResponse } from "next/server";
import mongoose from "mongoose";

const RequestSchema = new mongoose.Schema(
  {
    company: String,
    createdBy: String,
  },
  { strict: false }
);

const getModelForCompany = (company) => {
  const name = `requests_${company.toLowerCase()}`;
  return (
    mongoose.models[name] ||
    mongoose.model(name, RequestSchema, name)
  );
};

let isConnected = false;
async function connectDB() {
  if (isConnected) return;
  await mongoose.connect(process.env.MONGODB_URI, { dbName: "FundRrq" });
  isConnected = true;
}

export async function GET() {
  try {
    await connectDB();

    // حدد أسماء المجموعات (الشركات)
    const collections = await mongoose.connection.db.listCollections().toArray();
    const requestCollections = collections.filter((c) =>
      c.name.startsWith("requests_")
    );

    const allCompanies = new Set();
    const allUsers = new Set();

    for (const col of requestCollections) {
      const companyName = col.name.replace("requests_", "");
      const Model = getModelForCompany(companyName);

      const docs = await Model.find({}, { company: 1, createdBy: 1 }).lean();

      docs.forEach((d) => {
        if (d.company) allCompanies.add(d.company);
        if (d.createdBy) allUsers.add(d.createdBy);
      });
    }

    return NextResponse.json({
      success: true,
      companies: Array.from(allCompanies),
      users: Array.from(allUsers),
    });
  } catch (err) {
    console.error("❌ Filter API Error:", err.message);
    return NextResponse.json({ success: false, error: err.message });
  }
}