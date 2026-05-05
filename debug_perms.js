const mongoose = require('mongoose');

async function run() {
  await mongoose.connect('mongodb+srv://AliMushtaq:Aaa12345@cluster0.iihipor.mongodb.net/FundRrq?appName=Cluster0');
  
  const User = mongoose.connection.db.collection('users');
  const Permissions = mongoose.connection.db.collection('permissions');

  const user = await User.findOne({ username: 'admin' });
  if (!user) {
    console.log('User admin not found');
    process.exit(0);
  }

  const userId = user._id.toString();
  const groups = await Permissions.find({ users: userId }).toArray();
  
  console.log('--- PERMISSIONS FOR ADMIN ---');
  const allPerms = new Set();
  groups.forEach(g => {
    (g.permissions || []).forEach(p => allPerms.add(p));
  });
  
  console.log(Array.from(allPerms).join('\n'));
  process.exit(0);
}

run();
