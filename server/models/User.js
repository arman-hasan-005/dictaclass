const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Please add a name"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Please add an email"],
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: [true, "Please add a password"],
      minlength: 6,
    },
    avatar: {
      type: String,
      default: "",
    },
    xp: {
      type: Number,
      default: 0,
    },
    streak: {
      type: Number,
      default: 0,
    },
    lastSessionDate: {
      type: Date,
      default: null,
    },
    preferredLevel: {
      type: String,
      enum: ["beginner", "intermediate", "advanced"],
      default: "beginner",
    },
    preferredVoice: {
      type: String,
      enum: ["female", "male"],
      default: "female",
    },
    badges: [
      {
        name: { type: String },
        earnedAt: { type: Date, default: Date.now },
      },
    ],
    totalSessions: {
      type: Number,
      default: 0,
    },
    totalCorrectWords: {
      type: Number,
      default: 0,
    },
    totalWords: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);