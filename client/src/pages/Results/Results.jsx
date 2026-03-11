
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import API from "../../services/authService";
import Navbar from "../../components/Navbar/Navbar";
import { useAuth } from "../../context/AuthContext";
import styles from "./Results.module.css";

// Normalize text for comparison
const normalize = (str) =>
  str.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();

// Levenshtein distance for fuzzy matching
const levenshtein = (a, b) => {
  const dp = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) =>
      i === 0 ? j : j === 0 ? i : 0
    )
  );
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[a.length][b.length];
};

// Score a single answer against original sentence
const scoreSentence = (original, answer) => {
  const origWords = normalize(original).split(/\s+/).filter(Boolean);
  const ansWords = normalize(answer).split(/\s+/).filter(Boolean);

  let correct = 0;
  const wordResults = origWords.map((word, i) => {
    const match = ansWords[i] === word;
    if (match) correct++;
    return { word, typed: ansWords[i] || "", correct: match };
  });

  return {
    wordResults,
    correct,
    total: origWords.length,
    percentage:
      origWords.length > 0
        ? Math.round((correct / origWords.length) * 100)
        : 0,
  };
};

// Score full handwritten text against full passage
const scoreHandwrite = (originalSentences, handwrittenText) => {
  const originalFull = originalSentences.join(" ");
  const origWords = normalize(originalFull).split(/\s+/).filter(Boolean);
  const ansWords = normalize(handwrittenText || "").split(/\s+/).filter(Boolean);

  let correct = 0;
  const wordResults = origWords.map((word, i) => {
    const typed = ansWords[i] || "";
    const isCorrect = typed === word || levenshtein(typed, word) <= 1;
    if (isCorrect) correct++;
    return { word, typed, correct: isCorrect };
  });

  return [
    {
      wordResults,
      correct,
      total: origWords.length,
      percentage:
        origWords.length > 0
          ? Math.round((correct / origWords.length) * 100)
          : 0,
    },
  ];
};

// Grade
const getGrade = (pct) => {
  if (pct >= 95) return { label: "A+", color: "#059669", bg: "#ECFDF5" };
  if (pct >= 85) return { label: "A", color: "#059669", bg: "#ECFDF5" };
  if (pct >= 75) return { label: "B", color: "#2563EB", bg: "#EFF6FF" };
  if (pct >= 65) return { label: "C", color: "#D97706", bg: "#FFFBEB" };
  if (pct >= 50) return { label: "D", color: "#EA580C", bg: "#FFF7ED" };
  return { label: "F", color: "#DC2626", bg: "#FEF2F2" };
};

export default function Results() {
  const location = useLocation();
  const navigate = useNavigate();
  const { updateUser } = useAuth(); // ✅ Added

  const {
    passage,
    sentences,
    answers,
    handwrittenText,
    isHandwrite,
  } = location.state || {};

  const [saved, setSaved] = useState(false);
  const [xpEarned, setXpEarned] = useState(0);
  const [newBadges, setNewBadges] = useState([]);
  const [saving, setSaving] = useState(false);

  // Calculate results
  const sentenceResults = isHandwrite
    ? scoreHandwrite(sentences, handwrittenText)
    : sentences?.map((s, i) => scoreSentence(s, answers?.[i] || "")) || [];

  const totalCorrect = sentenceResults.reduce((sum, r) => sum + r.correct, 0);
  const totalWords = sentenceResults.reduce((sum, r) => sum + r.total, 0);
  const overallPercentage =
    totalWords > 0 ? Math.round((totalCorrect / totalWords) * 100) : 0;

  const answeredSentences = isHandwrite
    ? handwrittenText?.trim() ? 1 : 0
    : answers?.filter((a) => a.trim()).length || 0;

  const grade = getGrade(overallPercentage);

  // Save session to backend
  useEffect(() => {
    if (!passage || saved) return;
    const saveSession = async () => {
      setSaving(true);
      try {
        const res = await API.post("/sessions", {
          passageId: passage._id || null,
          passageTitle: passage.title,
          level: passage.level || "beginner",
          totalWords,
          correctWords: totalCorrect,
          score: overallPercentage,
          sentences: isHandwrite
            ? [{
                original: sentences.join(" "),
                answer: handwrittenText || "",
                score: overallPercentage,
              }]
            : sentenceResults.map((r, i) => ({
                original: sentences[i],
                answer: answers?.[i] || "",
                score: r.percentage,
              })),
        });

        setXpEarned(res.data.xpEarned || 0);
        setNewBadges(res.data.newBadges || []);

        // ✅ Update XP in Navbar + Dashboard + Profile instantly
        if (res.data.updatedUser) {
          updateUser(res.data.updatedUser);
        }

        setSaved(true);
      } catch (err) {
        console.error("Failed to save session:", err);
      } finally {
        setSaving(false);
      }
    };
    saveSession();
  }, []); // eslint-disable-line

  if (!passage) {
    navigate("/setup");
    return null;
  }

  return (
    <div className={styles.page}>
      <Navbar />
      <div className={styles.content}>

        {/* ── Header ── */}
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>Results</h1>
            <p className={styles.subtitle}>
              {passage.title} &nbsp;·&nbsp;
              {isHandwrite ? "✍️ Handwrite Mode" : "⌨️ Type Mode"}
            </p>
          </div>
          <div className={styles.headerBtns}>
            <button
              className={styles.retryBtn}
              onClick={() => navigate("/setup")}
            >
              🔄 Try Again
            </button>
            <button
              className={styles.dashBtn}
              onClick={() => navigate("/dashboard")}
            >
              🏠 Dashboard
            </button>
          </div>
        </div>

        {/* ── Score Cards Row ── */}
        <div className={styles.scoreRow}>

          {/* Grade */}
          <div
            className={styles.gradeCard}
            style={{ background: grade.bg, borderColor: grade.color }}
          >
            <div className={styles.gradeLabel}>Grade</div>
            <div
              className={styles.gradeLetter}
              style={{ color: grade.color }}
            >
              {grade.label}
            </div>
          </div>

          {/* Overall % */}
          <div className={styles.scoreCard}>
            <div className={styles.scoreIcon}>🎯</div>
            <div className={styles.scoreValue}>{overallPercentage}%</div>
            <div className={styles.scoreLabel}>Overall Accuracy</div>
          </div>

          {/* Words */}
          <div className={styles.scoreCard}>
            <div className={styles.scoreIcon}>📝</div>
            <div className={styles.scoreValue}>
              {totalCorrect}
              <span>/{totalWords}</span>
            </div>
            <div className={styles.scoreLabel}>Words Correct</div>
          </div>

          {/* Sentences */}
          <div className={styles.scoreCard}>
            <div className={styles.scoreIcon}>📖</div>
            <div className={styles.scoreValue}>
              {answeredSentences}
              <span>/{isHandwrite ? 1 : sentences?.length}</span>
            </div>
            <div className={styles.scoreLabel}>
              {isHandwrite ? "Passage Attempted" : "Sentences Attempted"}
            </div>
          </div>

          {/* XP */}
          <div className={styles.scoreCard}>
            <div className={styles.scoreIcon}>⚡</div>
            <div
              className={styles.scoreValue}
              style={{ color: "#D97706" }}
            >
              {saving ? "..." : `+${xpEarned}`}
            </div>
            <div className={styles.scoreLabel}>XP Earned</div>
          </div>

        </div>

        {/* ── New Badges ── */}
        {newBadges.length > 0 && (
          <div className={styles.badgesRow}>
            <div className={styles.badgesTitle}>🏆 New Badges Unlocked!</div>
            <div className={styles.badgesList}>
              {newBadges.map((badge, i) => (
                <div key={i} className={styles.badge}>
                  <div className={styles.badgeIcon}>{badge.icon || "🏅"}</div>
                  <div className={styles.badgeName}>{badge.name}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Progress Bar ── */}
        <div className={styles.progressCard}>
          <div className={styles.progressHeader}>
            <span>Overall Score</span>
            <span style={{ color: grade.color, fontWeight: 700 }}>
              {overallPercentage}%
            </span>
          </div>
          <div className={styles.progressBar}>
            <div
              className={styles.progressFill}
              style={{
                width: `${overallPercentage}%`,
                background: grade.color,
              }}
            />
          </div>
        </div>

        {/* ── Review Section ── */}
        <div className={styles.sentencesSection}>
          <h2 className={styles.sectionTitle}>
            {isHandwrite ? "Full Passage Review" : "Sentence by Sentence Review"}
          </h2>

          <div className={styles.sentenceList}>
            {isHandwrite ? (

              // ── Handwrite Mode ──
              <div className={styles.sentenceCard}>
                <div className={styles.sentenceHeader}>
                  <div className={styles.sentenceNum}>Full Passage</div>
                  <div
                    className={styles.sentencePct}
                    style={{
                      color:
                        sentenceResults[0]?.percentage >= 80
                          ? "#059669"
                          : sentenceResults[0]?.percentage >= 50
                          ? "#D97706"
                          : "#DC2626",
                      background:
                        sentenceResults[0]?.percentage >= 80
                          ? "#ECFDF5"
                          : sentenceResults[0]?.percentage >= 50
                          ? "#FFFBEB"
                          : "#FEF2F2",
                    }}
                  >
                    {sentenceResults[0]?.percentage}%
                  </div>
                </div>

                <div className={styles.originalLabel}>Original:</div>
                <div className={styles.wordRow}>
                  {sentenceResults[0]?.wordResults.map((w, j) => (
                    <span
                      key={j}
                      className={
                        w.correct ? styles.wordCorrect : styles.wordWrong
                      }
                    >
                      {w.word}
                    </span>
                  ))}
                </div>

                <div className={styles.answerLabel}>Your handwriting:</div>
                <div className={styles.answerText}>
                  {handwrittenText?.trim() ? (
                    handwrittenText
                  ) : (
                    <span className={styles.noAnswer}>No text extracted</span>
                  )}
                </div>
              </div>

            ) : (

              // ── Type Mode ──
              sentenceResults.map((result, i) => (
                <div key={i} className={styles.sentenceCard}>
                  <div className={styles.sentenceHeader}>
                    <div className={styles.sentenceNum}>Sentence {i + 1}</div>
                    <div
                      className={styles.sentencePct}
                      style={{
                        color:
                          result.percentage >= 80
                            ? "#059669"
                            : result.percentage >= 50
                            ? "#D97706"
                            : "#DC2626",
                        background:
                          result.percentage >= 80
                            ? "#ECFDF5"
                            : result.percentage >= 50
                            ? "#FFFBEB"
                            : "#FEF2F2",
                      }}
                    >
                      {result.percentage}%
                    </div>
                  </div>

                  <div className={styles.originalLabel}>Original:</div>
                  <div className={styles.wordRow}>
                    {result.wordResults.map((w, j) => (
                      <span
                        key={j}
                        className={
                          w.correct ? styles.wordCorrect : styles.wordWrong
                        }
                      >
                        {w.word}
                      </span>
                    ))}
                  </div>

                  <div className={styles.answerLabel}>Your answer:</div>
                  <div className={styles.answerText}>
                    {answers?.[i]?.trim() ? (
                      answers[i]
                    ) : (
                      <span className={styles.noAnswer}>No answer given</span>
                    )}
                  </div>
                </div>
              ))

            )}
          </div>
        </div>

        {/* ── Footer ── */}
        <div className={styles.footer}>
          <div className={styles.footerText}>
            🎉 You scored <strong>{overallPercentage}%</strong> —{" "}
            {overallPercentage >= 90
              ? "Outstanding! 🌟"
              : overallPercentage >= 75
              ? "Great job! 👏"
              : overallPercentage >= 50
              ? "Good effort! Keep practicing 💪"
              : "Keep going! Practice makes perfect 📚"}
          </div>
          <div className={styles.headerBtns}>
            <button
              className={styles.retryBtn}
              onClick={() => navigate("/setup")}
            >
              🔄 Try Again
            </button>
            <button
              className={styles.dashBtn}
              onClick={() => navigate("/dashboard")}
            >
              🏠 Dashboard
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
