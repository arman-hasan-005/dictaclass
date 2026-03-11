
import { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import API from "../../services/authService";
import Navbar from "../../components/Navbar/Navbar";
import styles from "./Profile.module.css";

const BADGE_ICONS = {
  "First Step": "👣",
  "Getting Started": "🌱",
  "Dedicated Learner": "📚",
  "Century Club": "💯",
  "Perfect Score": "⭐",
  "High Achiever": "🏆",
  "7-Day Streak": "🔥",
  "30-Day Streak": "🌟",
};

export default function Profile() {
  const { user, setUser } = useAuth();
  const [, setStats] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: user?.name || "",
    preferredLevel: user?.preferredLevel || "beginner",
    preferredVoice: user?.preferredVoice || "female",
  });
  const [saveMsg, setSaveMsg] = useState("");

  useEffect(() => {
    fetchProfile();
  }, []); 

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const { data } = await API.get("/auth/profile");
      setStats(data.stats);
      setSessions(data.recentSessions || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const { data } = await API.put("/auth/profile", form);
      setUser(data.user);
      setSaveMsg("✅ Profile updated!");
      setEditing(false);
      setTimeout(() => setSaveMsg(""), 3000);
    } catch (err) {
      console.error(err);
      setSaveMsg("❌ Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  const getGrade = (pct) => {
    if (pct >= 95) return "A+";
    if (pct >= 85) return "A";
    if (pct >= 75) return "B";
    if (pct >= 65) return "C";
    if (pct >= 50) return "D";
    return "F";
  };

  const getGradeColor = (pct) => {
    if (pct >= 75) return "#059669";
    if (pct >= 50) return "#D97706";
    return "#DC2626";
  };

  const accuracy =
    user?.totalWords > 0
      ? Math.round((user.totalCorrectWords / user.totalWords) * 100)
      : 0;

  return (
    <div className={styles.page}>
      <Navbar />
      <div className={styles.content}>

        {/* ── Profile Header ── */}
        <div className={styles.profileHeader}>
          <div className={styles.avatarWrap}>
            <div className={styles.avatar}>
              {user?.name?.charAt(0).toUpperCase()}
            </div>
            <div className={styles.xpBadge}>⚡ {user?.xp || 0} XP</div>
          </div>

          <div className={styles.profileInfo}>
            {editing ? (
              <input
                className={styles.nameInput}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Your name"
              />
            ) : (
              <h1 className={styles.name}>{user?.name}</h1>
            )}
            <p className={styles.email}>{user?.email}</p>
            <div className={styles.streakRow}>
              <span className={styles.streakBadge}>
                🔥 {user?.streak || 0} day streak
              </span>
              <span className={styles.sessionsBadge}>
                📖 {user?.totalSessions || 0} sessions
              </span>
            </div>
          </div>

          <div className={styles.editArea}>
            {saveMsg && <div className={styles.saveMsg}>{saveMsg}</div>}
            {!editing ? (
              <button
                className={styles.editBtn}
                onClick={() => setEditing(true)}
              >
                ✏️ Edit Profile
              </button>
            ) : (
              <div className={styles.editBtns}>
                <button
                  className={styles.saveBtn}
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? "Saving..." : "Save"}
                </button>
                <button
                  className={styles.cancelBtn}
                  onClick={() => setEditing(false)}
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── Preferences (shown when editing) ── */}
        {editing && (
          <div className={styles.prefsCard}>
            <h3 className={styles.cardTitle}>⚙️ Preferences</h3>
            <div className={styles.prefsGrid}>
              <div className={styles.prefItem}>
                <label className={styles.prefLabel}>Default Level</label>
                <select
                  className={styles.prefSelect}
                  value={form.preferredLevel}
                  onChange={(e) =>
                    setForm({ ...form, preferredLevel: e.target.value })
                  }
                >
                  <option value="beginner">🌱 Beginner (A1-A2)</option>
                  <option value="intermediate">📖 Intermediate (B1-B2)</option>
                  <option value="advanced">🎓 Advanced (C1-C2)</option>
                </select>
              </div>
              <div className={styles.prefItem}>
                <label className={styles.prefLabel}>Default Voice</label>
                <select
                  className={styles.prefSelect}
                  value={form.preferredVoice}
                  onChange={(e) =>
                    setForm({ ...form, preferredVoice: e.target.value })
                  }
                >
                  <option value="female">👩 Female</option>
                  <option value="male">👨 Male</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* ── Stats Row ── */}
        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <div className={styles.statIcon}>🎯</div>
            <div className={styles.statValue}>{accuracy}%</div>
            <div className={styles.statLabel}>Overall Accuracy</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statIcon}>✅</div>
            <div className={styles.statValue}>
              {user?.totalCorrectWords || 0}
            </div>
            <div className={styles.statLabel}>Words Correct</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statIcon}>📝</div>
            <div className={styles.statValue}>{user?.totalWords || 0}</div>
            <div className={styles.statLabel}>Total Words</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statIcon}>🔥</div>
            <div className={styles.statValue}>{user?.streak || 0}</div>
            <div className={styles.statLabel}>Day Streak</div>
          </div>
        </div>

        <div className={styles.bottomGrid}>

          {/* ── Badges ── */}
          <div className={styles.card}>
            <h3 className={styles.cardTitle}>🏅 Badges</h3>
            {user?.badges?.length === 0 || !user?.badges ? (
              <div className={styles.emptyBadges}>
                <div className={styles.emptyIcon}>🎖️</div>
                <div>Complete sessions to earn badges!</div>
              </div>
            ) : (
              <div className={styles.badgesGrid}>
                {user.badges.map((badge, i) => (
                  <div key={i} className={styles.badge}>
                    <div className={styles.badgeIcon}>
                      {BADGE_ICONS[badge.name] || "🏅"}
                    </div>
                    <div className={styles.badgeName}>{badge.name}</div>
                    <div className={styles.badgeDate}>
                      {new Date(badge.earnedAt).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Recent Sessions ── */}
          <div className={styles.card}>
            <h3 className={styles.cardTitle}>📋 Recent Sessions</h3>
            {loading ? (
              <div className={styles.loading}>Loading...</div>
            ) : sessions.length === 0 ? (
              <div className={styles.emptySessions}>
                No sessions yet. Start practicing! 🚀
              </div>
            ) : (
              <div className={styles.sessionList}>
                {sessions.map((s, i) => (
                  <div key={i} className={styles.sessionRow}>
                    <div className={styles.sessionInfo}>
                      <div className={styles.sessionTitle}>
                        {s.passageTitle}
                      </div>
                      <div className={styles.sessionMeta}>
                        {s.level?.charAt(0).toUpperCase() + s.level?.slice(1)}{" "}
                        &nbsp;·&nbsp;
                        {new Date(s.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    <div className={styles.sessionRight}>
                      <div
                        className={styles.sessionGrade}
                        style={{ color: getGradeColor(s.score) }}
                      >
                        {getGrade(s.score)}
                      </div>
                      <div className={styles.sessionScore}>{s.score}%</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}