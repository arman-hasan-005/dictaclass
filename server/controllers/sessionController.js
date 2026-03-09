const Session = require("../models/Session");
const User = require("../models/User");
const { calculateXP, updateStreak, checkBadges } = require("../utils/gamification");

// ── Submit a completed session ───────────────────
// POST /api/sessions
const submitSession = async (req, res) => {
  try {
    const { level, score, correctWords, totalWords, timeTaken, passageId } = req.body;
    const userId = req.user._id;

    // Get current user
    const user = await User.findById(userId);

    // Calculate XP earned
    const xpEarned = calculateXP(level, score);

    // Update streak
    const newStreak = updateStreak(user.lastSessionDate, user.streak);

    // Check for new badges
    const newBadges = checkBadges(user, score, xpEarned);

    // Create the session record
    const session = await Session.create({
      user: userId,
      passage: passageId || null,
      level,
      score,
      correctWords,
      totalWords,
      timeTaken,
      xpEarned,
      newBadges,
    });

    // Update user stats
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        $inc: {
          xp: xpEarned,
          totalSessions: 1,
          totalCorrectWords: correctWords,
          totalWords: totalWords,
        },
        $set: {
          streak: newStreak,
          lastSessionDate: new Date(),
        },
        $push: {
          badges: { $each: newBadges },
        },
      },
      { new: true }
    ).select("-password");

    res.status(201).json({
      session,
      xpEarned,
      newBadges,
      updatedUser,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ── Get user's session history ───────────────────
// GET /api/sessions/history
const getSessionHistory = async (req, res) => {
  try {
    const sessions = await Session.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(20);

    res.status(200).json(sessions);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ── Get user's stats ─────────────────────────────
// GET /api/sessions/stats
const getStats = async (req, res) => {
  try {
    const userId = req.user._id;

    const sessions = await Session.find({ user: userId });

    const totalSessions = sessions.length;
    const averageScore =
      totalSessions > 0
        ? Math.round(
            sessions.reduce((sum, s) => sum + s.score, 0) / totalSessions
          )
        : 0;

    const bestScore =
      totalSessions > 0 ? Math.max(...sessions.map((s) => s.score)) : 0;

    const levelBreakdown = {
      beginner: sessions.filter((s) => s.level === "beginner").length,
      intermediate: sessions.filter((s) => s.level === "intermediate").length,
      advanced: sessions.filter((s) => s.level === "advanced").length,
    };

    res.status(200).json({
      totalSessions,
      averageScore,
      bestScore,
      levelBreakdown,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { submitSession, getSessionHistory, getStats };