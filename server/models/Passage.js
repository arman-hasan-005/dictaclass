const mongoose = require("mongoose");

const passageSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    content: {
      type: String,
      required: true,
    },
    level: {
      type: String,
      enum: ["beginner", "intermediate", "advanced"],
      required: true,
    },
    chapter: {
      type: Number,
      required: true,
    },
    wordCount: {
      type: Number,
    },
    source: {
      type: String,
      enum: ["library", "upload"],
      default: "library",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Passage", passageSchema);