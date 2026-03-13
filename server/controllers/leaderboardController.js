const User = require("../models/User");

// GET /api/leaderboard?sort=xp|accuracy|sessions|streak
const getLeaderboard = async (req, res) => {
  try {
    const { sort = "xp" } = req.query;

    // FIX: "accuracy" previously sorted by totalWords (most active users),
    //      not by accuracy percentage. We now fetch all users and sort in-memory
    //      so the computed accuracy ratio can be used as the sort key.

    // Determine the MongoDB sort for fields that can be sorted directly
    let mongoSort = {};
    if (sort === "xp") mongoSort = { xp: -1 };
    else if (sort === "sessions") mongoSort = { totalSessions: -1 };
    else if (sort === "streak") mongoSort = { streak: -1 };
    // For "accuracy" we skip mongoSort and sort in JS after computing the ratio

    const users = await User.find({})
      .select("name xp streak totalSessions totalWords totalCorrectWords")
      .sort(sort !== "accuracy" ? mongoSort : { xp: -1 }) // initial fetch order
      .limit(sort === "accuracy" ? 0 : 50); // fetch all when sorting by accuracy

    const result = users.map((u) => ({
      _id: u._id,
      name: u.name,
      xp: u.xp || 0,
      streak: u.streak || 0,
      totalSessions: u.totalSessions || 0,
      accuracy:
        u.totalWords > 0
          ? Math.round((u.totalCorrectWords / u.totalWords) * 100)
          : 0,
    }));

    // FIX: Sort by accuracy in-memory for the accuracy tab
    if (sort === "accuracy") {
      result.sort((a, b) => b.accuracy - a.accuracy);
    }

    // Cap at top 50 after in-memory sort
    res.status(200).json(result.slice(0, 50));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getLeaderboard };
