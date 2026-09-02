require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const mongoose = require("mongoose");
const Admin    = require("../src/models/Admin");

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  const exists = await Admin.findOne({ email: "mahmoudhabib55200@gmail.com" });
  if (exists) { console.log("✅ Admin already exists"); process.exit(0); }
  await Admin.create({ name: "Mahmoud", email: "mahmoudhabib55200@gmail.com", password: "Admin@1234" });
  console.log("✅ Admin created successfully");
  process.exit(0);
}

main().catch(err => { console.error("❌", err.message); process.exit(1); });
