const mongoose = require("mongoose");

const sessionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    passage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Passage",
      required: false,
      default: null,
    },
    // FIX: passageTitle was being written by the controller but missing from schema
    passageTitle: {
      type: String,
      default: "Untitled",
      trim: true,
    },
    level: {
      type: String,
      enum: ["beginner", "intermediate", "advanced"],
      required: true,
    },
    score: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    correctWords: {
      type: Number,
      required: true,
      default: 0,
    },
    totalWords: {
      type: Number,
      required: true,
      default: 0,
    },
    timeTaken: {
      type: Number,
      default: 0,
    },
    xpEarned: {
      type: Number,
      default: 0,
    },
    // FIX: sentences was being written by the controller but missing from schema
    sentences: {
      type: [
        {
          original: { type: String },
          answer: { type: String },
          score: { type: Number },
        },
      ],
      default: [],
    },
    newBadges: {
      type: [
        {
          name: { type: String },
          earnedAt: { type: Date, default: Date.now },
        },
      ],
      default: [],
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Session", sessionSchema);
