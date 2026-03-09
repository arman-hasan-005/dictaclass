const User = require("../models/User");

// ── Get top 50 users by XP ───────────────────────
// GET /api/leaderboard
const getLeaderboard = async (req, res) => {
  try {
    const topUsers = await User.find()
      .select("name xp streak totalSessions avatar")
      .sort({ xp: -1 })
      .limit(50);

    // Find current user's rank
    const userId = req.user._id;
    const allUsers = await User.find()
      .select("_id")
      .sort({ xp: -1 });

    const userRank = allUsers.findIndex(
      (u) => u._id.toString() === userId.toString()
    ) + 1;

    res.status(200).json({ topUsers, userRank });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getLeaderboard };