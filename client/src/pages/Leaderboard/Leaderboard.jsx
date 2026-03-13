import { useState, useEffect } from "react";
import API from "../../services/authService";
import { useAuth } from "../../context/AuthContext";
import Navbar from "../../components/Navbar/Navbar";
import styles from "./Leaderboard.module.css";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import toast from "react-hot-toast";

const TABS = [
  { id: "xp",       label: "⚡ Most XP" },
  { id: "accuracy", label: "🎯 Best Accuracy" },
  { id: "sessions", label: "📖 Most Sessions" },
  { id: "streak",   label: "🔥 Best Streak" },
];

export default function Leaderboard() {
  const { user } = useAuth();
  const [tab,     setTab]     = useState("xp");
  const [data,    setData]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  useEffect(() => { fetchLeaderboard(); }, [tab]); // eslint-disable-line

  const fetchLeaderboard = async () => {
    try {
      setLoading(true);
      setError(null);
      const { data: res } = await API.get(`/leaderboard?sort=${tab}`);
      setData(res);
    } catch (err) {
      console.error(err);
      setError("Failed to load leaderboard. Check your connection.");
      toast.error("Could not load leaderboard.");
    } finally {
      setLoading(false);
    }
  };

  const getValue = (entry) => {
    switch (tab) {
      case "xp":       return `${entry.xp} XP`;
      case "accuracy": return `${entry.accuracy}%`;
      case "sessions": return `${entry.totalSessions} sessions`;
      case "streak":   return `${entry.streak} days`;
      default:         return "";
    }
  };

  const getRankStyle = (rank) => {
    if (rank === 1) return { bg: "#FFF9E6", border: "#F59E0B", medal: "🥇" };
    if (rank === 2) return { bg: "#F8F9FA", border: "#94A3B8", medal: "🥈" };
    if (rank === 3) return { bg: "#FFF5F0", border: "#F97316", medal: "🥉" };
    return { bg: "var(--white)", border: "var(--border)", medal: null };
  };

  const myRank = data.findIndex((e) => e._id === user?._id) + 1;

  return (
    <div className={styles.page}>
      <Navbar />
      <div className={styles.content}>

        {/* Header */}
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>Leaderboard</h1>
            <p className={styles.subtitle}>See how you rank against other learners</p>
          </div>
          {myRank > 0 && (
            <div className={styles.myRankBadge}>
              Your Rank: <strong>#{myRank}</strong>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className={styles.tabs}>
          {TABS.map((t) => (
            <button
              key={t.id}
              className={`${styles.tab} ${tab === t.id ? styles.tabActive : ""}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Error state */}
        {error && (
          <div className={styles.errorBox}>
            <p>{error}</p>
            <button className={styles.retryBtn} onClick={fetchLeaderboard}>
              Try Again
            </button>
          </div>
        )}

        {/* Top 3 Podium — skeleton while loading */}
        {loading ? (
          <div className={styles.podium}>
            {[1, 2, 3].map((i) => (
              <div key={i} className={styles.podiumItem}>
                <Skeleton circle width={56} height={56} style={{ marginBottom: 8 }} />
                <Skeleton width={80}  height={14} style={{ marginBottom: 4 }} />
                <Skeleton width={60}  height={12} style={{ marginBottom: 8 }} />
                <Skeleton width={80}  height={40} borderRadius={8} />
              </div>
            ))}
          </div>
        ) : !error && data.length >= 3 && (
          <div className={styles.podium}>
            {/* 2nd place */}
            <div className={styles.podiumItem}>
              <div className={styles.podiumAvatar} style={{ background: "#94A3B8" }}>
                {data[1]?.name?.charAt(0).toUpperCase()}
              </div>
              <div className={styles.podiumName}>{data[1]?.name}</div>
              <div className={styles.podiumValue}>{getValue(data[1])}</div>
              <div className={`${styles.podiumBlock} ${styles.podiumBlock2}`}>🥈 2nd</div>
            </div>

            {/* 1st place */}
            <div className={`${styles.podiumItem} ${styles.podiumFirst}`}>
              <div className={styles.podiumCrown}>👑</div>
              <div className={styles.podiumAvatar} style={{ background: "#F59E0B" }}>
                {data[0]?.name?.charAt(0).toUpperCase()}
              </div>
              <div className={styles.podiumName}>{data[0]?.name}</div>
              <div className={styles.podiumValue}>{getValue(data[0])}</div>
              <div className={`${styles.podiumBlock} ${styles.podiumBlock1}`}>🥇 1st</div>
            </div>

            {/* 3rd place */}
            <div className={styles.podiumItem}>
              <div className={styles.podiumAvatar} style={{ background: "#F97316" }}>
                {data[2]?.name?.charAt(0).toUpperCase()}
              </div>
              <div className={styles.podiumName}>{data[2]?.name}</div>
              <div className={styles.podiumValue}>{getValue(data[2])}</div>
              <div className={`${styles.podiumBlock} ${styles.podiumBlock3}`}>🥉 3rd</div>
            </div>
          </div>
        )}

        {/* Full List */}
        <div className={styles.listCard}>
          {loading ? (
            /* Skeleton rows */
            [1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div key={i} className={styles.row} style={{ border: "1px solid var(--border)" }}>
                <div className={styles.rank}>
                  <Skeleton circle width={32} height={32} />
                </div>
                <Skeleton circle width={40} height={40} />
                <div className={styles.info} style={{ flex: 1 }}>
                  <Skeleton width={120} height={16} style={{ marginBottom: 6 }} />
                  <Skeleton width={90}  height={12} />
                </div>
                <Skeleton width={70} height={20} />
              </div>
            ))
          ) : error ? null : data.length === 0 ? (
            <div className={styles.empty}>No data yet. Be the first! 🚀</div>
          ) : (
            data.map((entry, i) => {
              const rank      = i + 1;
              const rankStyle = getRankStyle(rank);
              const isMe      = entry._id === user?._id;

              return (
                <div
                  key={entry._id}
                  className={`${styles.row} ${isMe ? styles.rowMe : ""}`}
                  style={{
                    background:  isMe ? "#EEF2FF" : rankStyle.bg,
                    borderColor: isMe ? "var(--primary)" : rankStyle.border,
                  }}
                >
                  <div className={styles.rank}>
                    {rankStyle.medal ? (
                      <span className={styles.medal}>{rankStyle.medal}</span>
                    ) : (
                      <span className={styles.rankNum}>#{rank}</span>
                    )}
                  </div>
                  <div
                    className={styles.avatar}
                    style={{ background: isMe ? "var(--primary)" : "#94A3B8" }}
                  >
                    {entry.name?.charAt(0).toUpperCase()}
                  </div>
                  <div className={styles.info}>
                    <div className={styles.name}>
                      {entry.name}
                      {isMe && <span className={styles.youBadge}>You</span>}
                    </div>
                    <div className={styles.meta}>
                      {entry.totalSessions} sessions &nbsp;·&nbsp;
                      {entry.streak > 0 && `🔥 ${entry.streak} day streak`}
                    </div>
                  </div>
                  <div className={styles.value}>{getValue(entry)}</div>
                </div>
              );
            })
          )}
        </div>

      </div>
    </div>
  );
}
