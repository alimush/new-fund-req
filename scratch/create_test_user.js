const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const MONGO_URI = "mongodb://localhost:27017/fund_req_db"; // Check if this is the correct URI

// User Schema
const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  permissions: [String]
});
const User = mongoose.models.User || mongoose.model("User", UserSchema);

// Permissions Schema
const PermissionsSchema = new mongoose.Schema({
  name: String,
  permissions: [String],
  users: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  companies: [String]
});
const Permissions = mongoose.models.Permissions || mongoose.model("Permissions", PermissionsSchema);

async function createTestUser() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("Connected to DB");

    const username = "test_admin";
    const password = "test_admin";
    const hashed = await bcrypt.hash(password, 10);

    // 1. Create or update user
    let user = await User.findOne({ username });
    if (user) {
      user.password = hashed;
      await user.save();
    } else {
      user = await User.create({ username, password: hashed });
    }
    console.log("User created/updated:", user.username);

    // 2. Create or update permission group
    const allCompanies = [
      "Al-Ghadeer",
      "Badur-Baghdad",
      "Tiba-Al-najaf",
      "Ghadeer-Karbala",
      "Badur-Al-Najaf",
      "Ghadeer-Investments",
      "Ghadeer-Karbala-Sub"
    ];
    
    const allPerms = [
      "view_reports",
      "receipts",
      "create_request",
      "approve_request"
    ];

    let group = await Permissions.findOne({ name: "Test Admin Group" });
    if (group) {
      group.companies = allCompanies;
      group.permissions = allPerms;
      if (!group.users.includes(user._id)) {
        group.users.push(user._id);
      }
      await group.save();
    } else {
      group = await Permissions.create({
        name: "Test Admin Group",
        companies: allCompanies,
        permissions: allPerms,
        users: [user._id]
      });
    }
    console.log("Permission group updated with all companies");

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

createTestUser();
