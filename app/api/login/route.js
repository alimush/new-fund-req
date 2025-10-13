import dbConnect from "@/lib/mongodb";
import User from "@/models/User";

export async function POST(req) {
  try {
    await dbConnect();

    const { username, password } = await req.json();

    // جلب المستخدم من الـ collection users
    const user = await User.findOne({ username });
    if (!user) {
      return new Response(JSON.stringify({ error: "❌ المستخدم غير موجود" }), {
        status: 401,
      });
    }

    // مقارنة الباسورد (هنا plain text لأن عندك الباسوردات مخزنة كـ نص عادي)
    if (user.password !== password) {
      return new Response(
        JSON.stringify({ error: "❌ كلمة المرور غير صحيحة" }),
        { status: 401 }
      );
    }

    // نجاح
    return new Response(
      JSON.stringify({
        message: "✅ تسجيل الدخول ناجح",
        user: {
          id: user._id,
          username: user.username,
        },
      }),
      { status: 200 }
    );
  } catch (err) {
    console.error("Login error:", err);
    return new Response(JSON.stringify({ error: "⚠️ خطأ بالسيرفر" }), {
      status: 500,
    });
  }
}
