const mongoose = require('mongoose');

async function run() {
  await mongoose.connect('mongodb://localhost:27017/ghadeer-funds');
  const User = mongoose.connection.db.collection('users');
  const Permissions = mongoose.connection.db.collection('permissions');

  const admin = await User.findOne({ username: 'admin' });
  if (!admin) {
    console.log('Admin user not found');
    process.exit(0);
  }

  const userId = admin._id.toString();
  console.log('Admin User ID:', userId);

  const groups = await Permissions.find({ users: userId }).toArray();
  console.log('Groups for admin:');
  groups.forEach(g => {
    console.log(`- Group: ${g.name}`);
    console.log(`  Permissions: ${JSON.stringify(g.permissions)}`);
  });

  process.exit(0);
}

run();
