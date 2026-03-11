
import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import styles from "./Navbar.module.css";

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate("/login");
    setMenuOpen(false);
  };

  const isActive = (path) => location.pathname === path;

  const closeMenu = () => setMenuOpen(false);

  return (
    <nav className={styles.navbar}>
      <div className={styles.container}>

        {/* Logo */}
        <Link to="/dashboard" className={styles.logo} onClick={closeMenu}>
          DictaClass
          <span className={styles.logoSub}>Dictation Simulator</span>
        </Link>

        {/* Desktop Nav Links */}
        <div className={styles.navLinks}>
          <Link to="/dashboard" className={`${styles.navLink} ${isActive("/dashboard") ? styles.active : ""}`}>
            Dashboard
          </Link>
          <Link to="/setup" className={`${styles.navLink} ${isActive("/setup") ? styles.active : ""}`}>
            Practice
          </Link>
          <Link to="/leaderboard" className={`${styles.navLink} ${isActive("/leaderboard") ? styles.active : ""}`}>
            Leaderboard
          </Link>
          <Link to="/profile" className={`${styles.navLink} ${isActive("/profile") ? styles.active : ""}`}>
            Profile
          </Link>
        </div>

        {/* Right Side */}
        <div className={styles.rightSide}>
          <div className={styles.xpBadge}>⚡ {user?.xp || 0} XP</div>
          <div className={styles.userInfo}>
            <div
              className={styles.avatar}
              onClick={() => { navigate("/profile"); closeMenu(); }}
              style={{ cursor: "pointer" }}
            >
              {user?.name?.charAt(0).toUpperCase()}
            </div>
            <span className={styles.userName}>{user?.name}</span>
          </div>
          <button onClick={handleLogout} className={styles.logoutBtn}>
            Logout
          </button>

          {/* Hamburger Button — mobile only */}
          <button
            className={styles.hamburger}
            onClick={() => setMenuOpen((p) => !p)}
            aria-label="Toggle menu"
          >
            <span className={`${styles.bar} ${menuOpen ? styles.bar1Open : ""}`} />
            <span className={`${styles.bar} ${menuOpen ? styles.bar2Open : ""}`} />
            <span className={`${styles.bar} ${menuOpen ? styles.bar3Open : ""}`} />
          </button>
        </div>

      </div>

      {/* Mobile Dropdown Menu */}
      <div className={`${styles.mobileMenu} ${menuOpen ? styles.mobileMenuOpen : ""}`}>
        <div className={styles.mobileUser}>
          <div className={styles.mobileAvatar}>
            {user?.name?.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className={styles.mobileUserName}>{user?.name}</div>
            <div className={styles.mobileUserXp}>⚡ {user?.xp || 0} XP</div>
          </div>
        </div>

        <div className={styles.mobileDivider} />

        <Link
          to="/dashboard"
          className={`${styles.mobileLink} ${isActive("/dashboard") ? styles.mobileLinkActive : ""}`}
          onClick={closeMenu}
        >
          🏠 Dashboard
        </Link>
        <Link
          to="/setup"
          className={`${styles.mobileLink} ${isActive("/setup") ? styles.mobileLinkActive : ""}`}
          onClick={closeMenu}
        >
          🎙️ Practice
        </Link>
        <Link
          to="/leaderboard"
          className={`${styles.mobileLink} ${isActive("/leaderboard") ? styles.mobileLinkActive : ""}`}
          onClick={closeMenu}
        >
          🏆 Leaderboard
        </Link>
        <Link
          to="/profile"
          className={`${styles.mobileLink} ${isActive("/profile") ? styles.mobileLinkActive : ""}`}
          onClick={closeMenu}
        >
          👤 Profile
        </Link>

        <div className={styles.mobileDivider} />

        <button className={styles.mobileLogout} onClick={handleLogout}>
          🚪 Logout
        </button>
      </div>

      {/* Backdrop */}
      {menuOpen && (
        <div className={styles.backdrop} onClick={closeMenu} />
      )}
    </nav>
  );
}
