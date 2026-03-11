const User = require("../models/User");

const getLeaderboard = async (req, res) => {
  try {
    const { sort = "xp" } = req.query;

    let sortField = {};
    if (sort === "xp") sortField = { xp: -1 };
    else if (sort === "accuracy") sortField = { totalWords: -1 };
    else if (sort === "sessions") sortField = { totalSessions: -1 };
    else if (sort === "streak") sortField = { streak: -1 };

    const users = await User.find({})
      .select("name xp streak totalSessions totalWords totalCorrectWords")
      .sort(sortField)
      .limit(50);

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

    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getLeaderboard };