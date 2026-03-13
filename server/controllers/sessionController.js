const { body, validationResult } = require("express-validator");
const Session = require("../models/Session");
const Passage = require("../models/Passage");
const User = require("../models/User");
const { calculateXP, updateStreak, checkBadges } = require("../utils/gamification");

// ── Server-side scorer ────────────────────────────────────────
// Normalise text: lowercase, strip punctuation, collapse whitespace
const normalizeText = (str) =>
  (str || "").toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();

// Score a single student answer against the original sentence.
// Uses positional word comparison — same algorithm as the frontend.
const scoreAnswer = (original, answer) => {
  const origWords = normalizeText(original).split(/\s+/).filter(Boolean);
  const ansWords = normalizeText(answer).split(/\s+/).filter(Boolean);

  let correct = 0;
  origWords.forEach((word, i) => {
    if (ansWords[i] === word) correct++;
  });

  return { correct, total: origWords.length };
};

// ── Validation rules ──────────────────────────────────────────
const submitSessionValidation = [
  body("level")
    .isIn(["beginner", "intermediate", "advanced"])
    .withMessage("Invalid level"),
  body("passageTitle")
    .optional()
    .isString()
    .isLength({ max: 200 })
    .trim(),
  body("sentences")
    .optional()
    .isArray({ max: 100 }),
];

// ── Submit a completed session ────────────────────────────────
// POST /api/sessions
const submitSession = async (req, res) => {
  // Validate input
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: errors.array()[0].msg });
  }

  try {
    const {
      passageId,
      passageTitle,
      level,
      sentences,         // array of { original, answer, score }
      // These client-submitted values are used only as fallback for uploaded passages
      score: clientScore,
      correctWords: clientCorrectWords,
      totalWords: clientTotalWords,
    } = req.body;

    const userId = req.user._id;
    const user = await User.findById(userId);

    // ── Server-side scoring (when passageId exists) ────────────
    // Re-compute score using the stored passage content so the
    // client cannot submit a fraudulent score.
    let score, correctWords, totalWords;

    if (passageId && sentences && sentences.length > 0) {
      const passage = await Passage.findById(passageId);
      if (passage) {
        // Re-split passage into sentences to mirror the client
        const passageSentences =
          passage.content
            .match(/[^.!?]+[.!?]+/g)
            ?.map((s) => s.trim())
            .filter((s) => s.length > 2) || [passage.content];

        let totalCorrect = 0;
        let totalAll = 0;

        const scoredSentences = passageSentences.map((original, i) => {
          const answer = sentences[i]?.answer || "";
          const { correct, total } = scoreAnswer(original, answer);
          totalCorrect += correct;
          totalAll += total;
          return {
            original,
            answer,
            score: total > 0 ? Math.round((correct / total) * 100) : 0,
          };
        });

        correctWords = totalCorrect;
        totalWords = totalAll;
        score = totalWords > 0
          ? Math.round((correctWords / totalWords) * 100)
          : 0;

        // Use the server-scored sentences for the record
        sentences.splice(0, sentences.length, ...scoredSentences);
      }
    }

    // Fallback: use client-submitted values for uploaded passages
    // (no stored passage to verify against)
    if (score === undefined) {
      score = Math.min(100, Math.max(0, Number(clientScore) || 0));
      correctWords = Math.max(0, Number(clientCorrectWords) || 0);
      totalWords = Math.max(0, Number(clientTotalWords) || 0);
    }

    // ── Gamification ──────────────────────────────────────────
    const xpEarned = calculateXP(level, score);

    // FIX: Calculate newStreak BEFORE calling checkBadges, then pass it in
    const newStreak = updateStreak(user.lastSessionDate, user.streak);

    // FIX: Pass newStreak (not user.streak) so streak badges are awarded
    //      on the session that actually achieves the milestone
    const newBadges = checkBadges(user, score, newStreak);

    // ── Create session record ─────────────────────────────────
    const session = await Session.create({
      user: userId,
      passage: passageId || null,
      passageTitle: passageTitle || "Untitled",
      level: level || "beginner",
      score,
      correctWords,
      totalWords,
      xpEarned,
      sentences: sentences || [],
      newBadges,           // FIX: was not being stored in Session
    });

    // ── Update user stats ─────────────────────────────────────
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
        $push: { badges: { $each: newBadges } },
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
    console.error("submitSession error:", error);
    res.status(500).json({ message: error.message });
  }
};

// ── Get session history ───────────────────────────────────────
// GET /api/sessions/history
const getSessionHistory = async (req, res) => {
  try {
    const sessions = await Session.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(20)
      .select("passageTitle level score xpEarned correctWords totalWords createdAt");

    res.status(200).json(sessions);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ── Get aggregated stats ──────────────────────────────────────
// GET /api/sessions/stats
const getStats = async (req, res) => {
  try {
    const sessions = await Session.find({ user: req.user._id })
      .select("score level");

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

    res.status(200).json({ totalSessions, averageScore, bestScore, levelBreakdown });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { submitSession, submitSessionValidation, getSessionHistory, getStats };
