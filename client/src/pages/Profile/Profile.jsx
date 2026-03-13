import { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { getProfile, updateProfile } from "../../services/userService";
import Navbar from "../../components/Navbar/Navbar";
import styles from "./Profile.module.css";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import toast from "react-hot-toast";

// All possible badges — locked ones shown greyed out
const ALL_BADGES = {
  "First Step":        { icon: "👣", desc: "Complete your first session" },
  "Getting Started":   { icon: "🌱", desc: "Complete 10 sessions" },
  "Dedicated Learner": { icon: "📚", desc: "Complete 50 sessions" },
  "Century Club":      { icon: "💯", desc: "Complete 100 sessions" },
  "Perfect Score":     { icon: "⭐", desc: "Score 100% in a session" },
  "High Achiever":     { icon: "🏆", desc: "Score 90%+ in a session" },
  "7-Day Streak":      { icon: "🔥", desc: "Practice 7 days in a row" },
  "30-Day Streak":     { icon: "🌟", desc: "Practice 30 days in a row" },
};

export default function Profile() {
  const { user, updateUser } = useAuth();

  const [sessions, setSessions] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);
  const [editing,  setEditing]  = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [form, setForm] = useState({
    name:           user?.name           || "",
    preferredLevel: user?.preferredLevel || "beginner",
    preferredVoice: user?.preferredVoice || "female",
  });

  useEffect(() => { fetchProfile(); }, []); // eslint-disable-line

  const fetchProfile = async () => {
    try {
      setLoading(true);
      setError(null);
      const { data } = await getProfile();
      setSessions(data.recentSessions || []);
    } catch (err) {
      console.error("fetchProfile error:", err);
      setError("Failed to load profile. Check your connection.");
      toast.error("Could not load profile data.");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    const toastId = toast.loading("Saving profile…");
    try {
      setSaving(true);
      const { data } = await updateProfile(form);
      updateUser(data.user);
      toast.success("Profile saved!", { id: toastId });
      setEditing(false);
    } catch (err) {
      console.error("updateProfile error:", err);
      toast.error("Failed to save. Please try again.", { id: toastId });
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

  const earnedNames = user?.badges?.map((b) => b.name) || [];

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
              <span className={styles.streakBadge}>🔥 {user?.streak || 0} day streak</span>
              <span className={styles.sessionsBadge}>📖 {user?.totalSessions || 0} sessions</span>
            </div>
          </div>

          <div className={styles.editArea}>
            {!editing ? (
              <button className={styles.editBtn} onClick={() => setEditing(true)}>
                ✏️ Edit Profile
              </button>
            ) : (
              <div className={styles.editBtns}>
                <button className={styles.saveBtn} onClick={handleSave} disabled={saving}>
                  {saving ? "Saving…" : "Save"}
                </button>
                <button className={styles.cancelBtn} onClick={() => setEditing(false)}>
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── Preferences (editing mode) ── */}
        {editing && (
          <div className={styles.prefsCard}>
            <h3 className={styles.cardTitle}>⚙️ Preferences</h3>
            <div className={styles.prefsGrid}>
              <div className={styles.prefItem}>
                <label className={styles.prefLabel}>Default Level</label>
                <select
                  className={styles.prefSelect}
                  value={form.preferredLevel}
                  onChange={(e) => setForm({ ...form, preferredLevel: e.target.value })}
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
                  onChange={(e) => setForm({ ...form, preferredVoice: e.target.value })}
                >
                  <option value="female">👩 Female</option>
                  <option value="male">👨 Male</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* ── Stats ── */}
        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <div className={styles.statIcon}>🎯</div>
            <div className={styles.statValue}>{accuracy}%</div>
            <div className={styles.statLabel}>Overall Accuracy</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statIcon}>✅</div>
            <div className={styles.statValue}>{user?.totalCorrectWords || 0}</div>
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

        {/* ── Error state ── */}
        {error && (
          <div className={styles.errorBox}>
            <p>{error}</p>
            <button className={styles.retryBtn} onClick={fetchProfile}>
              Try Again
            </button>
          </div>
        )}

        <div className={styles.bottomGrid}>
          {/* ── Badges — all badges, locked ones greyed out ── */}
          <div className={styles.card}>
            <div className={styles.badgeHeader}>
              <h3 className={styles.cardTitle}>🏅 Badges</h3>
              <span className={styles.badgeCount}>
                {earnedNames.length} / {Object.keys(ALL_BADGES).length} earned
              </span>
            </div>
            <div className={styles.badgesGrid}>
              {Object.entries(ALL_BADGES).map(([name, info]) => {
                const earned   = earnedNames.includes(name);
                const earnedAt = user?.badges?.find((b) => b.name === name)?.earnedAt;
                return (
                  <div
                    key={name}
                    className={styles.badge}
                    style={{
                      opacity: earned ? 1 : 0.35,
                      filter:  earned ? "none" : "grayscale(1)",
                    }}
                    title={earned ? `Earned: ${name}` : info.desc}
                  >
                    <div className={styles.badgeIcon}>{info.icon}</div>
                    <div className={styles.badgeName}>{name}</div>
                    <div className={styles.badgeDate}>
                      {earned && earnedAt
                        ? new Date(earnedAt).toLocaleDateString()
                        : info.desc}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Recent Sessions — skeleton while loading ── */}
          <div className={styles.card}>
            <h3 className={styles.cardTitle}>📋 Recent Sessions</h3>
            {loading ? (
              <div className={styles.sessionList}>
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className={styles.sessionRow}>
                    <div className={styles.sessionInfo}>
                      <Skeleton width={160} height={16} style={{ marginBottom: 6 }} />
                      <Skeleton width={110} height={12} />
                    </div>
                    <div className={styles.sessionRight}>
                      <Skeleton width={32} height={28} />
                      <Skeleton width={44} height={20} />
                    </div>
                  </div>
                ))}
              </div>
            ) : sessions.length === 0 ? (
              <div className={styles.emptySessions}>
                No sessions yet. Start practising! 🚀
              </div>
            ) : (
              <div className={styles.sessionList}>
                {sessions.map((s, i) => (
                  <div key={i} className={styles.sessionRow}>
                    <div className={styles.sessionInfo}>
                      <div className={styles.sessionTitle}>
                        {s.passageTitle || "Untitled"}
                      </div>
                      <div className={styles.sessionMeta}>
                        {s.level?.charAt(0).toUpperCase() + s.level?.slice(1)}
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
