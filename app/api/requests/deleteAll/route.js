import mongoose from "mongoose";
import dbConnect from "@/lib/mongodb"; // تأكد أن هذا الملف موجود عندك ويتصل بـ MongoDB

export const runtime = "nodejs";

export async function DELETE() {
  try {
    // ✅ الاتصال بقاعدة البيانات
    await dbConnect();

    // 🧠 الحصول على جميع المجموعات (Collections) الموجودة في القاعدة
    const collections = await mongoose.connection.db.listCollections().toArray();

    // 🔸 تصفية المجموعات التي تبدأ بـ requests_
    const requestCollections = collections
      .map((c) => c.name)
      .filter((name) => name.startsWith("requests_"));

    if (requestCollections.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "لا توجد مجموعات لحذفها." }),
        { status: 200 }
      );
    }

    // 🧨 حذف جميع المستندات من كل مجموعة
    for (const colName of requestCollections) {
      const collection = mongoose.connection.db.collection(colName);
      await collection.deleteMany({});
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `تم حذف جميع الريكويستات من ${requestCollections.length} شركة ✅`,
      }),
      { status: 200 }
    );
  } catch (err) {
    console.error("❌ خطأ أثناء الحذف الجماعي:", err);
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500 }
    );
  }
}