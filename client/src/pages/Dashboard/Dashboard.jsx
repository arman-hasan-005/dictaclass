import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import API from "../../services/authService";
import Navbar from "../../components/Navbar/Navbar";
import styles from "./Dashboard.module.css";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import toast from "react-hot-toast";

// All possible badges — used to render locked badges alongside earned ones
const ALL_BADGES = {
  "First Step":        { icon: "👣", desc: "Complete your first session" },
  "Getting Started":   { icon: "🌱", desc: "Complete 10 sessions" },
  "Dedicated Learner": { icon: "📚", desc: "Complete 50 sessions" },
  "Century Club":      { icon: "💯", desc: "Complete 100 sessions" },
  "Perfect Score":     { icon: "⭐", desc: "Score 100% in a session" },
  "High Achiever":     { icon: "🏆", desc: "Score 90%+ in a session" },
  "7-Day Streak":      { icon: "🔥", desc: "Practice 7 days in a row" },
  "30-Day Streak":     { icon: "💎", desc: "Practice 30 days in a row" },
};

const XP_PER_LEVEL = 500;

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats,   setStats]   = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  useEffect(() => { fetchData(); }, []); // eslint-disable-line

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [statsRes, historyRes] = await Promise.all([
        API.get("/sessions/stats"),
        API.get("/sessions/history"),
      ]);
      setStats(statsRes.data);
      setHistory(historyRes.data.slice(0, 5));
    } catch (err) {
      console.error(err);
      setError("Failed to load dashboard. Check your connection.");
      toast.error("Failed to load dashboard data.");
    } finally {
      setLoading(false);
    }
  };

  const xpProgress   = (user?.xp || 0) % XP_PER_LEVEL;
  const xpPercent    = Math.round((xpProgress / XP_PER_LEVEL) * 100);
  const currentLevel = Math.floor((user?.xp || 0) / XP_PER_LEVEL) + 1;

  const getScoreColor = (score) => {
    if (score >= 90) return "#059669";
    if (score >= 70) return "#D97706";
    return "#DC2626";
  };

  const formatDate = (dateStr) =>
    new Date(dateStr).toLocaleDateString("en-GB", {
      day: "numeric", month: "short", year: "numeric",
    });

  const earnedNames = user?.badges?.map((b) => b.name) || [];

  return (
    <div className={styles.page}>
      <Navbar />

      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerInner}>
          <div>
            <h1 className={styles.greeting}>
              Welcome back, {user?.name?.split(" ")[0]}! 👋
            </h1>
            <p className={styles.subGreeting}>
              Ready for today's dictation practice?
            </p>
          </div>
          <button className={styles.practiceBtn} onClick={() => navigate("/setup")}>
            Start Practice →
          </button>
        </div>
      </div>

      <div className={styles.content}>

        {/* ── Error state ── */}
        {error && (
          <div className={styles.errorBox}>
            <p>{error}</p>
            <button className={styles.retryBtn} onClick={fetchData}>
              Try Again
            </button>
          </div>
        )}

        {/* ── Onboarding banner — shown only when user has 0 sessions ── */}
        {!loading && !error && stats?.totalSessions === 0 && (
          <div className={styles.onboardCard}>
            <div className={styles.onboardLeft}>
              <h2 className={styles.onboardTitle}>Welcome to DictaClass! 👋</h2>
              <p className={styles.onboardText}>
                You haven't completed any sessions yet. Here's how to get started:
              </p>
              <ol className={styles.onboardSteps}>
                <li>Click <strong>Start Practice</strong> above or the button below</li>
                <li>Choose your level — Beginner, Intermediate, or Advanced</li>
                <li>Select a passage and click <strong>Start Dictation</strong></li>
                <li>Listen carefully and type exactly what you hear</li>
              </ol>
            </div>
            <button
              className={styles.onboardBtn}
              onClick={() => navigate("/setup")}
            >
              Start Your First Session →
            </button>
          </div>
        )}

        {/* ── XP Progress ── */}
        <div className={styles.xpCard}>
          <div className={styles.xpTop}>
            <div>
              <div className={styles.xpLabel}>Level {currentLevel}</div>
              <div className={styles.xpValue}>{user?.xp || 0} XP Total</div>
            </div>
            <div className={styles.streakBadge}>
              🔥 {user?.streak || 0} Day Streak
            </div>
          </div>
          <div className={styles.xpBarTrack}>
            <div className={styles.xpBarFill} style={{ width: `${xpPercent}%` }} />
          </div>
          <div className={styles.xpBarLabel}>
            {xpProgress} / {XP_PER_LEVEL} XP to Level {currentLevel + 1}
          </div>
        </div>

        {/* ── Stat Cards — skeleton while loading ── */}
        {loading ? (
          <div className={styles.statsGrid}>
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className={styles.statCard}>
                <Skeleton circle width={40} height={40} style={{ marginBottom: 10 }} />
                <Skeleton width={60} height={36} style={{ marginBottom: 6 }} />
                <Skeleton width={90} height={14} />
              </div>
            ))}
          </div>
        ) : (
          <div className={styles.statsGrid}>
            <div className={styles.statCard}>
              <div className={styles.statIcon}>📝</div>
              <div className={styles.statValue}>{stats?.totalSessions || 0}</div>
              <div className={styles.statLabel}>Total Sessions</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statIcon}>🎯</div>
              <div className={styles.statValue}>{stats?.averageScore || 0}%</div>
              <div className={styles.statLabel}>Average Score</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statIcon}>⭐</div>
              <div className={styles.statValue}>{stats?.bestScore || 0}%</div>
              <div className={styles.statLabel}>Best Score</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statIcon}>🏅</div>
              <div className={styles.statValue}>{user?.badges?.length || 0}</div>
              <div className={styles.statLabel}>Badges Earned</div>
            </div>
          </div>
        )}

        <div className={styles.bottomGrid}>
          {/* ── Recent Sessions ── */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <h3 className={styles.cardTitle}>Recent Sessions</h3>
              <button className={styles.viewAllBtn} onClick={() => navigate("/profile")}>
                View All
              </button>
            </div>

            {loading ? (
              <div className={styles.sessionList}>
                {[1, 2, 3].map((i) => (
                  <div key={i} className={styles.sessionRow}>
                    <div className={styles.sessionLeft}>
                      <Skeleton width={140} height={16} style={{ marginBottom: 6 }} />
                      <Skeleton width={100} height={12} />
                    </div>
                    <div className={styles.sessionRight}>
                      <Skeleton width={48} height={28} />
                      <Skeleton width={40} height={20} />
                    </div>
                  </div>
                ))}
              </div>
            ) : history.length === 0 ? (
              <div className={styles.emptyState}>
                <div className={styles.emptyIcon}>🎙️</div>
                <p>No sessions yet. Start your first practice!</p>
                <button className={styles.startBtn} onClick={() => navigate("/setup")}>
                  Start Now
                </button>
              </div>
            ) : (
              <div className={styles.sessionList}>
                {history.map((session) => (
                  <div key={session._id} className={styles.sessionRow}>
                    <div className={styles.sessionLeft}>
                      <div className={styles.sessionTitle}>
                        {session.passageTitle || "Untitled"}
                      </div>
                      <div className={styles.sessionMeta}>
                        {session.level?.charAt(0).toUpperCase() + session.level?.slice(1)}
                        &nbsp;·&nbsp;
                        {formatDate(session.createdAt)}
                      </div>
                    </div>
                    <div className={styles.sessionRight}>
                      <div
                        className={styles.sessionScore}
                        style={{ color: getScoreColor(session.score) }}
                      >
                        {session.score}%
                      </div>
                      <div className={styles.sessionXP}>+{session.xpEarned} XP</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Badges — all badges, locked ones greyed out ── */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <h3 className={styles.cardTitle}>Badges</h3>
              <span className={styles.badgeCount}>
                {earnedNames.length} / {Object.keys(ALL_BADGES).length} earned
              </span>
            </div>

            {loading ? (
              <div className={styles.badgeGrid}>
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className={styles.badgeCard}>
                    <Skeleton circle width={36} height={36} style={{ marginBottom: 6 }} />
                    <Skeleton width={60} height={12} />
                  </div>
                ))}
              </div>
            ) : (
              <div className={styles.badgeGrid}>
                {Object.entries(ALL_BADGES).map(([name, info]) => {
                  const earned = earnedNames.includes(name);
                  return (
                    <div
                      key={name}
                      className={styles.badgeCard}
                      style={{
                        opacity: earned ? 1 : 0.35,
                        filter: earned ? "none" : "grayscale(1)",
                      }}
                      title={earned ? `Earned: ${name}` : info.desc}
                    >
                      <div className={styles.badgeIcon}>{info.icon}</div>
                      <div className={styles.badgeName}>{name}</div>
                      <div className={styles.badgeDesc}>
                        {earned ? "✓ Earned" : info.desc}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Level Breakdown ── */}
        {!loading && stats && (
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <h3 className={styles.cardTitle}>Sessions by Level</h3>
            </div>
            <div className={styles.levelGrid}>
              <div className={styles.levelItem}>
                <div className={styles.levelDot} style={{ background: "#059669" }} />
                <div className={styles.levelName}>🌱 Beginner</div>
                <div className={styles.levelCount}>
                  {stats.levelBreakdown?.beginner || 0} sessions
                </div>
              </div>
              <div className={styles.levelItem}>
                <div className={styles.levelDot} style={{ background: "#D97706" }} />
                <div className={styles.levelName}>📖 Intermediate</div>
                <div className={styles.levelCount}>
                  {stats.levelBreakdown?.intermediate || 0} sessions
                </div>
              </div>
              <div className={styles.levelItem}>
                <div className={styles.levelDot} style={{ background: "#7C3AED" }} />
                <div className={styles.levelName}>🎓 Advanced</div>
                <div className={styles.levelCount}>
                  {stats.levelBreakdown?.advanced || 0} sessions
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
