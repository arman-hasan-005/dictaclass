const User = require("../models/User");
const Session = require("../models/Session"); // FIX: was incorrectly required inside getProfile function body
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { body, validationResult } = require("express-validator");

// ── Generate JWT ──────────────────────────────────────────────
const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "30d" });

// ── Validation rules ──────────────────────────────────────────
const registerValidation = [
  body("name").trim().notEmpty().withMessage("Name is required"),
  body("email").isEmail().normalizeEmail().withMessage("Valid email is required"),
  body("password")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters"),
];

const loginValidation = [
  body("email").isEmail().normalizeEmail().withMessage("Valid email is required"),
  body("password").notEmpty().withMessage("Password is required"),
];

// ── Register ──────────────────────────────────────────────────
// POST /api/auth/register
const registerUser = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: errors.array()[0].msg });
  }

  try {
    const { name, email, password, preferredLevel } = req.body;

    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: "An account with that email already exists" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      preferredLevel: preferredLevel || "beginner",
    });

    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      xp: user.xp,
      streak: user.streak,
      badges: user.badges,
      preferredLevel: user.preferredLevel,
      preferredVoice: user.preferredVoice,
      totalSessions: user.totalSessions,
      totalCorrectWords: user.totalCorrectWords,
      totalWords: user.totalWords,
      token: generateToken(user._id),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ── Login ─────────────────────────────────────────────────────
// POST /api/auth/login
const loginUser = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: errors.array()[0].msg });
  }

  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    res.status(200).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      xp: user.xp,
      streak: user.streak,
      badges: user.badges,
      preferredLevel: user.preferredLevel,
      preferredVoice: user.preferredVoice,
      totalSessions: user.totalSessions,
      totalCorrectWords: user.totalCorrectWords,
      totalWords: user.totalWords,
      token: generateToken(user._id),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ── Get current user ──────────────────────────────────────────
// GET /api/auth/me
const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ── Get profile with recent sessions ─────────────────────────
// GET /api/auth/profile
const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("-password");

    // FIX: Session is now imported at the top of the file, not inside this function
    // FIX: Added passageTitle to the select so it appears in the response
    const recentSessions = await Session.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(10)
      .select("passageTitle level score xpEarned correctWords totalWords createdAt");

    res.status(200).json({ user, recentSessions });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ── Update profile ────────────────────────────────────────────
// PUT /api/auth/profile
const updateProfile = async (req, res) => {
  try {
    const { name, preferredLevel, preferredVoice } = req.body;

    const allowedLevels = ["beginner", "intermediate", "advanced"];
    const allowedVoices = ["female", "male"];

    const updates = {};
    if (name && name.trim()) updates.name = name.trim();
    if (preferredLevel && allowedLevels.includes(preferredLevel))
      updates.preferredLevel = preferredLevel;
    if (preferredVoice && allowedVoices.includes(preferredVoice))
      updates.preferredVoice = preferredVoice;

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: updates },
      { new: true }
    ).select("-password");

    res.status(200).json({ user });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  registerUser,
  registerValidation,
  loginUser,
  loginValidation,
  getMe,
  getProfile,
  updateProfile,
};
