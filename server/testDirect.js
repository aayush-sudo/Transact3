const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { MongoMemoryServer } = require('mongodb-memory-server');
const User = require('./src/models/User');

async function test() {
  const mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());

  const salt = await bcrypt.genSalt(10);
  const password = "password123";
  // Simulate pre-save hook manually or just create a user
  const user = new User({
    name: 'test',
    email: 'test@example.com',
    password: password
  });
  await user.save();

  const foundUser = await User.findOne({ email: 'test@example.com' }).select('+password');
  console.log("Found User password:", foundUser.password);
  
  try {
    const isMatch = await foundUser.matchPassword(password);
    console.log("Is Match:", isMatch);
  } catch (err) {
    console.error("Match error:", err);
  }
  process.exit(0);
}
test();
