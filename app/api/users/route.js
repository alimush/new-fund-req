import dbConnect from "@/lib/mongodb";
import User from "@/models/User";
import Permissions from "@/models/Permissions";

// 🟢 GET — fetch users (بدون password)
export async function GET(req) {
  await dbConnect();
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q");

  const users = q
    ? await User.find({ username: { $regex: q, $options: "i" } }).select("-password")
    : await User.find({}).select("-password");

  // attach groups
  const usersWithGroups = await Promise.all(
    users.map(async (u) => {
      const groups = await Permissions.find({ users: u._id }).select("name");
      return {
        ...u.toObject(),
        groups,
      };
    })
  );

  return Response.json({
    success: true,
    users: usersWithGroups,
  });
}

// 🟢 POST — create user (مع email)
export async function POST(req) {
  await dbConnect();
  const { username, password, email, group, companies } = await req.json();

  const exists = await User.findOne({ username });
  if (exists) {
    return Response.json(
      { success: false, error: "User already exists" },
      { status: 400 }
    );
  }

  const newUser = await User.create({
    username,
    password,
    email: (email || "").trim().toLowerCase(), // ✅
    group: group || null,
    companies: companies || [],
  });

  const userObj = newUser.toObject();
  delete userObj.password;

  return Response.json({ success: true, user: userObj }, { status: 201 });
}

// 🟡 PUT — update user (email + optional password)
export async function PUT(req) {
  await dbConnect();
  const { id, username, password, email, group, companies } = await req.json();

  const updateData = {};

  if (username !== undefined) updateData.username = username;
  if (email !== undefined) updateData.email = (email || "").trim().toLowerCase(); // ✅

  // ✅ password optional (إذا فارغ لا نغيره)
  if (password !== undefined && String(password).trim() !== "") {
    updateData.password = password;
  }

  if (group !== undefined) updateData.group = group;
  if (companies !== undefined) updateData.companies = companies;

  const user = await User.findByIdAndUpdate(id, updateData, { new: true }).select("-password");

  if (!user) {
    return Response.json({ success: false, error: "User not found" }, { status: 404 });
  }

  return Response.json({ success: true, user }, { status: 200 });
}

// 🔴 DELETE — remove
export async function DELETE(req) {
  await dbConnect();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  const deleted = await User.findByIdAndDelete(id);

  if (!deleted) {
    return Response.json({ success: false, error: "User not found" }, { status: 404 });
  }

  return Response.json({ success: true, message: "User deleted" }, { status: 200 });
}