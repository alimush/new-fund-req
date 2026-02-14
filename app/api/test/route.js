import dbConnect from "@/lib/mongodb";

export const runtime = "nodejs";

export async function GET() {
  try {
    await dbConnect();
    return new Response("✅ Connected to MongoDB (FundRrq DB)", { status: 200 });
  } catch (error) {
    return new Response("❌ Connection failed: " + error.message, { status: 500 });
  }
}
