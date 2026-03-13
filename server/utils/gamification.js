// ── XP Calculation ────────────────────────────────────────────
const calculateXP = (level, score) => {
  let baseXP = 0;
  if (level === "beginner") baseXP = 10;
  else if (level === "intermediate") baseXP = 20;
  else if (level === "advanced") baseXP = 35;

  let bonusXP = 0;
  if (score === 100) bonusXP = 20;
  else if (score >= 90) bonusXP = 10;
  else if (score >= 75) bonusXP = 5;

  return baseXP + bonusXP;
};

// ── Streak Calculation ────────────────────────────────────────
const updateStreak = (lastSessionDate, currentStreak) => {
  if (!lastSessionDate) return 1;

  const today = new Date();
  const last = new Date(lastSessionDate);

  const todayStr = today.toDateString();
  const lastStr = last.toDateString();

  // Already played today — don't change streak
  if (todayStr === lastStr) return currentStreak;

  // Played yesterday — increment streak
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (yesterday.toDateString() === lastStr) return currentStreak + 1;

  // Missed a day — reset streak
  return 1;
};

// ── Badge Checking ────────────────────────────────────────────
// FIX 1: Renamed third param from `xpEarned` (which was never used) to `newStreak`
// FIX 2: Now uses the freshly calculated `newStreak` instead of stale `user.streak`
//         so badges like "7-Day Streak" are awarded on the session that achieves it
const checkBadges = (user, sessionScore, newStreak) => {
  const newBadges = [];
  const existingBadgeNames = user.badges.map((b) => b.name);

  // totalSessions already includes the current session (+1 was applied at call site)
  const totalSessions = user.totalSessions + 1;

  const award = (name) => {
    if (!existingBadgeNames.includes(name)) {
      newBadges.push({ name, earnedAt: new Date() });
    }
  };

  // Session milestone badges
  if (totalSessions === 1) award("First Step");
  if (totalSessions === 10) award("Getting Started");
  if (totalSessions === 50) award("Dedicated Learner");
  if (totalSessions === 100) award("Century Club");

  // Score milestone badges
  if (sessionScore === 100) award("Perfect Score");
  if (sessionScore >= 90) award("High Achiever");

  // FIX: Use newStreak (the just-calculated value) not user.streak (old value)
  if (newStreak >= 7) award("7-Day Streak");
  if (newStreak >= 30) award("30-Day Streak");

  return newBadges;
};

module.exports = { calculateXP, updateStreak, checkBadges };
