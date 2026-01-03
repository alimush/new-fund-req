import dbConnect from "@/lib/mongodb";
import User from "@/models/User";

export async function GET(req) {
  try {
    await dbConnect();

    const userId = req.cookies.get("userId")?.value;

    if (!userId) {
      return new Response(
        JSON.stringify({ success: false, message: "No logged in user" }),
        { status: 200 }
      );
    }

    const user = await User.findById(userId).lean();

    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: user._id,
          username: user.username,
        },
      }),
      { status: 200 }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ success: false, error: e.message }),
      { status: 500 }
    );
  }
}