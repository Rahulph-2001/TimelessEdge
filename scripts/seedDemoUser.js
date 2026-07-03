/**
 * seedDemoUser.js
 * ─────────────────────────────────────────────────────────────────
 * One-time seed script to create:
 *   1. Demo customer   →  demo@timelessedge.com  /  Demo@1234
 *   2. Demo admin      →  admin@timelessedge.com /  Admin@1234
 *
 * Run with:  node scripts/seedDemoUser.js
 * ─────────────────────────────────────────────────────────────────
 */

require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const User = require("../models/userSchema");

const DEMO_ACCOUNTS = [
  {
    label: "Demo Customer",
    name: "Demo User",
    email: "demo@timelessedge.com",
    password: "Demo@1234",
    isAdmin: false,
    wallet: 500,
  },
  {
    label: "Demo Admin",
    name: "Demo Admin",
    email: "admin@timelessedge.com",
    password: "Admin@1234",
    isAdmin: true,
    wallet: 0,
  },
];

async function seed() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅  Connected to MongoDB\n");

    for (const account of DEMO_ACCOUNTS) {
      const existing = await User.findOne({ email: account.email });

      if (existing) {
        console.log(
          `⚠️   ${account.label} (${account.email}) already exists — skipping.`
        );
        continue;
      }

      const passwordHash = await bcrypt.hash(account.password, 10);

      const newUser = new User({
        name: account.name,
        email: account.email,
        password: passwordHash,
        isAdmin: account.isAdmin,
        isBlocked: false,
        wallet: account.wallet,
      });

      await newUser.save();
      console.log(
        `✅  Created ${account.label}:\n    Email   : ${account.email}\n    Password: ${account.password}\n    Wallet  : ₹${account.wallet}\n`
      );
    }

    console.log("🎉  Seeding complete!");
  } catch (err) {
    console.error("❌  Seed failed:", err.message);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

seed();
