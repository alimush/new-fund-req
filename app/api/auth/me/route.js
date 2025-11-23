import dbConnect from "@/lib/mongodb";
import User from "@/models/User";

export async function GET(req) {
  try {
    await dbConnect();

    // 🔥 هنا تجيب الـ userId من الكوكي
    const userId = req.cookies.get("userId")?.value;

    if (!userId) {
      return new Response(JSON.stringify({ user: null }), { status: 200 });
    }

    const user = await User.findById(userId).populate("group");

    return new Response(
      JSON.stringify({
        user: {
          id: user._id,
          username: user.username,
          group: user.group?.name || null,
        },
        permissions: user.group?.permissions || [],
      }),
      { status: 200 }
    );
  } catch (err) {
    return new Response(JSON.stringify({ user: null }), { status: 200 });
  }
}