import { useEffect, useState, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { submitSession } from "../../services/sessionService";
import Navbar from "../../components/Navbar/Navbar";
import { scoreSentence, scoreHandwrite, getGrade } from "../../utils/scorer";
import styles from "./Results.module.css";

export default function Results() {
  const location = useLocation();
  const navigate = useNavigate();
  const { updateUser } = useAuth();

  const { passage, sentences, answers, handwrittenText, isHandwrite } =
    location.state || {};

  const [saved, setSaved] = useState(false);
  const [xpEarned, setXpEarned] = useState(0);
  const [newBadges, setNewBadges] = useState([]);
  const [saving, setSaving] = useState(false);

  // FIX: Use a ref instead of relying solely on `saved` state to prevent the
  // double POST in development (React used to run with StrictMode which
  // double-invokes effects; also guards against any future re-mount).
  const hasSavedRef = useRef(false);

  // Calculate results using the centralised scorer module
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

  // Save session — guarded by both state and ref to prevent any double-fire
  useEffect(() => {
    if (!passage || hasSavedRef.current) return;
    hasSavedRef.current = true; // claim the save immediately before any await

    const save = async () => {
      setSaving(true);
      try {
        // Build the sentences payload for the backend
        const sentencesPayload = isHandwrite
          ? [
              {
                original: sentences.join(" "),
                answer: handwrittenText || "",
                score: overallPercentage,
              },
            ]
          : sentenceResults.map((r, i) => ({
              original: sentences[i],
              answer: answers?.[i] || "",
              score: r.percentage,
            }));

        const res = await submitSession({
          passageId: passage._id || null,
          passageTitle: passage.title,
          level: passage.level || "beginner",
          totalWords,
          correctWords: totalCorrect,
          score: overallPercentage,
          sentences: sentencesPayload,
        });

        setXpEarned(res.data.xpEarned || 0);
        setNewBadges(res.data.newBadges || []);

        // Update XP/badges in Navbar + Dashboard + Profile instantly
        if (res.data.updatedUser) {
          updateUser(res.data.updatedUser);
        }
        setSaved(true);
      } catch (err) {
        console.error("Failed to save session:", err);
        // Don't block the user from seeing results on a save failure
      } finally {
        setSaving(false);
      }
    };

    save();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!passage) {
    navigate("/setup", { replace: true });
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
            <button className={styles.retryBtn} onClick={() => navigate("/setup")}>
              🔄 Try Again
            </button>
            <button className={styles.dashBtn} onClick={() => navigate("/dashboard")}>
              🏠 Dashboard
            </button>
          </div>
        </div>

        {/* ── Score Cards ── */}
        <div className={styles.scoreRow}>
          <div className={styles.gradeCard} style={{ background: grade.bg, borderColor: grade.color }}>
            <div className={styles.gradeLabel}>Grade</div>
            <div className={styles.gradeLetter} style={{ color: grade.color }}>
              {grade.label}
            </div>
          </div>

          <div className={styles.scoreCard}>
            <div className={styles.scoreIcon}>🎯</div>
            <div className={styles.scoreValue}>{overallPercentage}%</div>
            <div className={styles.scoreLabel}>Overall Accuracy</div>
          </div>

          <div className={styles.scoreCard}>
            <div className={styles.scoreIcon}>📝</div>
            <div className={styles.scoreValue}>
              {totalCorrect}<span>/{totalWords}</span>
            </div>
            <div className={styles.scoreLabel}>Words Correct</div>
          </div>

          <div className={styles.scoreCard}>
            <div className={styles.scoreIcon}>📖</div>
            <div className={styles.scoreValue}>
              {answeredSentences}<span>/{isHandwrite ? 1 : sentences?.length}</span>
            </div>
            <div className={styles.scoreLabel}>
              {isHandwrite ? "Passage Attempted" : "Sentences Attempted"}
            </div>
          </div>

          <div className={styles.scoreCard}>
            <div className={styles.scoreIcon}>⚡</div>
            <div className={styles.scoreValue} style={{ color: "#D97706" }}>
              {saving ? "…" : `+${xpEarned}`}
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
              style={{ width: `${overallPercentage}%`, background: grade.color }}
            />
          </div>
        </div>

        {/* ── Sentence Review ── */}
        <div className={styles.sentencesSection}>
          <h2 className={styles.sectionTitle}>
            {isHandwrite ? "Full Passage Review" : "Sentence by Sentence Review"}
          </h2>

          <div className={styles.sentenceList}>
            {isHandwrite ? (
              <div className={styles.sentenceCard}>
                <div className={styles.sentenceHeader}>
                  <div className={styles.sentenceNum}>Full Passage</div>
                  <div
                    className={styles.sentencePct}
                    style={{
                      color: sentenceResults[0]?.percentage >= 80 ? "#059669"
                        : sentenceResults[0]?.percentage >= 50 ? "#D97706" : "#DC2626",
                      background: sentenceResults[0]?.percentage >= 80 ? "#ECFDF5"
                        : sentenceResults[0]?.percentage >= 50 ? "#FFFBEB" : "#FEF2F2",
                    }}
                  >
                    {sentenceResults[0]?.percentage}%
                  </div>
                </div>
                <div className={styles.originalLabel}>Original:</div>
                <div className={styles.wordRow}>
                  {sentenceResults[0]?.wordResults.map((w, j) => (
                    <span key={j} className={w.correct ? styles.wordCorrect : styles.wordWrong}>
                      {w.word}
                    </span>
                  ))}
                </div>
                <div className={styles.answerLabel}>Your handwriting:</div>
                <div className={styles.answerText}>
                  {handwrittenText?.trim() || <span className={styles.noAnswer}>No text extracted</span>}
                </div>
              </div>
            ) : (
              sentenceResults.map((result, i) => (
                <div key={i} className={styles.sentenceCard}>
                  <div className={styles.sentenceHeader}>
                    <div className={styles.sentenceNum}>Sentence {i + 1}</div>
                    <div
                      className={styles.sentencePct}
                      style={{
                        color: result.percentage >= 80 ? "#059669"
                          : result.percentage >= 50 ? "#D97706" : "#DC2626",
                        background: result.percentage >= 80 ? "#ECFDF5"
                          : result.percentage >= 50 ? "#FFFBEB" : "#FEF2F2",
                      }}
                    >
                      {result.percentage}%
                    </div>
                  </div>
                  <div className={styles.originalLabel}>Original:</div>
                  <div className={styles.wordRow}>
                    {result.wordResults.map((w, j) => (
                      <span key={j} className={w.correct ? styles.wordCorrect : styles.wordWrong}>
                        {w.word}
                      </span>
                    ))}
                  </div>
                  <div className={styles.answerLabel}>Your answer:</div>
                  <div className={styles.answerText}>
                    {answers?.[i]?.trim() || <span className={styles.noAnswer}>No answer given</span>}
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
            {overallPercentage >= 90 ? "Outstanding! 🌟"
              : overallPercentage >= 75 ? "Great job! 👏"
              : overallPercentage >= 50 ? "Good effort! Keep practicing 💪"
              : "Keep going! Practice makes perfect 📚"}
          </div>
          <div className={styles.headerBtns}>
            <button className={styles.retryBtn} onClick={() => navigate("/setup")}>
              🔄 Try Again
            </button>
            <button className={styles.dashBtn} onClick={() => navigate("/dashboard")}>
              🏠 Dashboard
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
