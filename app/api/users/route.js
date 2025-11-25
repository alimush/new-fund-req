import dbConnect from "@/lib/mongodb";
import User from "@/models/User";
import Permissions from "@/models/Permissions";

// 🟢 GET — fetch users
export async function GET(req) {
  await dbConnect();
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q");

  let users = q
    ? await User.find({ username: { $regex: q, $options: "i" } })
    : await User.find({});

  // attach groups
  const usersWithGroups = await Promise.all(
    users.map(async (u) => {
      const groups = await Permissions.find({ users: u._id }).select("name");
      return {
        ...u._doc,
        groups,
      };
    })
  );

  return Response.json({
    success: true,
    users: usersWithGroups,
  });
}

// 🟢 POST — create user
export async function POST(req) {
  await dbConnect();
  const { username, password, group, companies } = await req.json();

  const exists = await User.findOne({ username });
  if (exists) {
    return Response.json({ success: false, error: "User already exists" }, { status: 400 });
  }

  const newUser = await User.create({
    username,
    password,
    group: group || null,
    companies: companies || [],
  });

  return Response.json({ success: true, user: newUser }, { status: 201 });
}

// 🟡 PUT — update user
export async function PUT(req) {
  await dbConnect();
  const { id, username, password, group, companies } = await req.json();

  const updateData = {};

  if (username !== undefined) updateData.username = username;
  if (password !== undefined) updateData.password = password;
  if (group !== undefined) updateData.group = group;
  if (companies !== undefined) updateData.companies = companies;

  const user = await User.findByIdAndUpdate(id, updateData, { new: true });

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