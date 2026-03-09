const mongoose = require("mongoose");
const dotenv = require("dotenv");
const Passage = require("./models/Passage");
const passages = require("./data/passages");

dotenv.config();

mongoose.connect(process.env.MONGO_URI);

const seedPassages = async () => {
  try {
    await Passage.deleteMany();
    await Passage.insertMany(passages);
    console.log("✅ All 30 passages seeded successfully!");
    process.exit();
  } catch (error) {
    console.error("❌ Seeding failed:", error);
    process.exit(1);
  }
};

seedPassages();