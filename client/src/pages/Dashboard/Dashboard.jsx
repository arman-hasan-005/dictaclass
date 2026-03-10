
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import API from "../../services/authService";
import Navbar from "../../components/Navbar/Navbar";
import styles from "./Dashboard.module.css";

const BADGES_INFO = {
  "First Step":       { icon: "👣", desc: "Complete your first session" },
  "Getting Started":  { icon: "🌱", desc: "Complete 10 sessions" },
  "Dedicated Learner":{ icon: "📚", desc: "Complete 50 sessions" },
  "Century Club":     { icon: "💯", desc: "Complete 100 sessions" },
  "Perfect Score":    { icon: "⭐", desc: "Score 100% in a session" },
  "High Achiever":    { icon: "🏆", desc: "Score 90%+ in a session" },
  "7-Day Streak":     { icon: "🔥", desc: "Practice 7 days in a row" },
  "30-Day Streak":    { icon: "💎", desc: "Practice 30 days in a row" },
};

const XP_PER_LEVEL = 500;

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, historyRes] = await Promise.all([
          API.get("/sessions/stats"),
          API.get("/sessions/history"),
        ]);
        setStats(statsRes.data);
        setHistory(historyRes.data.slice(0, 5));
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const xpProgress = ((user?.xp || 0) % XP_PER_LEVEL);
  const xpPercent = Math.round((xpProgress / XP_PER_LEVEL) * 100);
  const currentLevel = Math.floor((user?.xp || 0) / XP_PER_LEVEL) + 1;

  const getScoreColor = (score) => {
    if (score >= 90) return "#059669";
    if (score >= 70) return "#D97706";
    return "#DC2626";
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-GB", {
      day: "numeric", month: "short", year: "numeric"
    });
  };

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
          <button
            className={styles.practiceBtn}
            onClick={() => navigate("/setup")}
          >
            Start Practice →
          </button>
        </div>
      </div>

      <div className={styles.content}>

        {/* XP Progress */}
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
            <div
              className={styles.xpBarFill}
              style={{ width: `${xpPercent}%` }}
            />
          </div>
          <div className={styles.xpBarLabel}>
            {xpProgress} / {XP_PER_LEVEL} XP to Level {currentLevel + 1}
          </div>
        </div>

        {/* Stat Cards */}
        {loading ? (
          <div className={styles.loadingRow}>Loading stats...</div>
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

          {/* Recent Sessions */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <h3 className={styles.cardTitle}>Recent Sessions</h3>
              <button
                className={styles.viewAllBtn}
                onClick={() => navigate("/profile")}
              >
                View All
              </button>
            </div>
            {history.length === 0 ? (
              <div className={styles.emptyState}>
                <div className={styles.emptyIcon}>🎙️</div>
                <p>No sessions yet. Start your first practice!</p>
                <button
                  className={styles.startBtn}
                  onClick={() => navigate("/setup")}
                >
                  Start Now
                </button>
              </div>
            ) : (
              <div className={styles.sessionList}>
                {history.map((session) => (
                  <div key={session._id} className={styles.sessionRow}>
                    <div className={styles.sessionLeft}>
                      <div className={styles.sessionLevel}>
                        {session.level.charAt(0).toUpperCase() + session.level.slice(1)}
                      </div>
                      <div className={styles.sessionDate}>
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
                      <div className={styles.sessionXP}>
                        +{session.xpEarned} XP
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Badges */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <h3 className={styles.cardTitle}>Badges</h3>
            </div>
            {user?.badges?.length === 0 || !user?.badges ? (
              <div className={styles.emptyState}>
                <div className={styles.emptyIcon}>🏅</div>
                <p>Complete sessions to earn badges!</p>
              </div>
            ) : (
              <div className={styles.badgeGrid}>
                {user.badges.map((badge, i) => (
                  <div key={i} className={styles.badgeCard}>
                    <div className={styles.badgeIcon}>
                      {BADGES_INFO[badge.name]?.icon || "🏅"}
                    </div>
                    <div className={styles.badgeName}>{badge.name}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* Level Breakdown */}
        {stats && (
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



