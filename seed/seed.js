require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const connectDB = require('../config/db');
const User = require('../models/User');

const DEMO_USERS = [
  { username: 'admin',   email: 'admin@sparklotto.io', password: 'admin123',   balance: 1000, isAdmin: true },
  { username: 'alice',   email: 'alice@example.com',   password: 'alice123',   balance: 100 },
  { username: 'bob',     email: 'bob@example.com',     password: 'bob123',     balance: 100 },
  { username: 'charlie', email: 'charlie@example.com', password: 'charlie123', balance: 100 },
  { username: 'diana',   email: 'diana@example.com',   password: 'diana123',   balance: 100 },
  { username: 'ethan',   email: 'ethan@example.com',   password: 'ethan123',   balance: 100 },
];

const args = process.argv.slice(2);
const shouldReset = args.includes('--reset');

(async () => {
  try {
    await connectDB();
    console.log('✅ Connected to MongoDB');

    if (shouldReset) {
      console.log('⚠️  Wiping User collection…');
      await User.deleteMany({});
    }

    let created = 0, skipped = 0;
    for (const u of DEMO_USERS) {
      const existing = await User.findOne({
        $or: [{ username: u.username }, { email: u.email.toLowerCase() }],
      });
      if (existing) { skipped++; console.log(`⏭️  Skipped ${u.username}`); continue; }

      const hash = await bcrypt.hash(u.password, 10);
      await User.create({
        username: u.username,
        email: u.email.toLowerCase(),
        password: hash,
        balance: u.balance,
        isAdmin: !!u.isAdmin,
        totalDeposited: u.balance,
      });
      created++;
      console.log(`✅ Created ${u.username} (${u.balance} USDT${u.isAdmin ? ', ADMIN' : ''})`);
    }

    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📊 ${created} created, ${skipped} skipped`);
    console.log('🔑 Login credentials:');
    for (const u of DEMO_USERS) console.log(`   ${u.username.padEnd(10)} / ${u.password}${u.isAdmin ? '  (ADMIN)' : ''}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    await mongoose.connection.close();
    process.exit(0);
  } catch (err) {
    console.error('❌ Seed failed:', err);
    process.exit(1);
  }
})();
