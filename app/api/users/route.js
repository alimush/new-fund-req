import dbConnect from "@/lib/mongodb";
import User from "@/models/User";

// 🟢 جلب المستخدمين (مع بحث اختياري)
export async function GET(req) {
  await dbConnect();
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q");

  let users;
  if (q) {
    users = await User.find({
      username: { $regex: q, $options: "i" }, // بحث جزئي
    });
  } else {
    users = await User.find({});
  }

  return new Response(JSON.stringify(users), { status: 200 });
}

// ➕ إضافة مستخدم
export async function POST(req) {
  await dbConnect();
  const { username, password } = await req.json();

  const existing = await User.findOne({ username });
  if (existing) {
    return new Response(JSON.stringify({ error: "User already exists" }), {
      status: 400,
    });
  }

  const user = await User.create({ username, password });
  return new Response(JSON.stringify(user), { status: 201 });
}

// ✏️ تعديل مستخدم
export async function PUT(req) {
  await dbConnect();
  const { id, username, password } = await req.json();

  const user = await User.findByIdAndUpdate(
    id,
    { username, password },
    { new: true }
  );

  if (!user) {
    return new Response(JSON.stringify({ error: "User not found" }), {
      status: 404,
    });
  }

  return new Response(JSON.stringify(user), { status: 200 });
}

// 🗑 حذف مستخدم
export async function DELETE(req) {
  await dbConnect();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  const user = await User.findByIdAndDelete(id);
  if (!user) {
    return new Response(JSON.stringify({ error: "User not found" }), {
      status: 404,
    });
  }

  return new Response(JSON.stringify({ message: "User deleted" }), {
    status: 200,
  });
}
