import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import styles from "./Navbar.module.css";

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const isActive = (path) => location.pathname === path;

  return (
    <nav className={styles.navbar}>
      <div className={styles.container}>

        {/* Logo */}
        <Link to="/dashboard" className={styles.logo}>
          DictaClass
          <span className={styles.logoSub}>Dictation Simulator</span>
        </Link>

        {/* Nav Links */}
        <div className={styles.navLinks}>
          <Link
            to="/dashboard"
            className={`${styles.navLink} ${isActive("/dashboard") ? styles.active : ""}`}
          >
            Dashboard
          </Link>
          <Link
            to="/setup"
            className={`${styles.navLink} ${isActive("/setup") ? styles.active : ""}`}
          >
            Practice
          </Link>
          <Link
            to="/leaderboard"
            className={`${styles.navLink} ${isActive("/leaderboard") ? styles.active : ""}`}
          >
            Leaderboard
          </Link>
          <Link
            to="/profile"
            className={`${styles.navLink} ${isActive("/profile") ? styles.active : ""}`}
          >
            Profile
          </Link>
        </div>

        {/* Right Side */}
        <div className={styles.rightSide}>
          <div className={styles.xpBadge}>⚡ {user?.xp || 0} XP</div>
          <div className={styles.userInfo}>
            <div
               className={styles.avatar}
               onClick={() => navigate("/profile")}
               style={{ cursor: "pointer" }}
               >
               {user?.name?.charAt(0).toUpperCase()}
            </div>
            <span className={styles.userName}>{user?.name}</span>
          </div>
          <button onClick={handleLogout} className={styles.logoutBtn}>
            Logout
          </button>
        </div>

      </div>
    </nav>
  );
}