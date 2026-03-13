/**
 * VerifyEmail.jsx
 *
 * Loaded when the user clicks the link in their welcome email:
 *   /verify-email/:token
 *
 * On mount it immediately calls GET /api/auth/verify-email/:token.
 * Shows one of three states:
 *   loading  — spinner while the request is in flight
 *   success  — "Email verified! You can now log in." + button
 *   error    — invalid/already-used token + link back to login
 */
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import API from "../../services/authService";
import styles from "./VerifyEmail.module.css";
import CircularProgress from "@mui/material/CircularProgress";

export default function VerifyEmail() {
  const { token }  = useParams();
  const [status,   setStatus]  = useState("loading"); // loading | success | already | error
  const [message,  setMessage] = useState("");

  useEffect(() => {
    if (!token) return;

    API.get(`/auth/verify-email/${token}`)
      .then(({ data }) => {
        if (data.alreadyVerified) {
          setStatus("already");
        } else {
          setStatus("success");
        }
        setMessage(data.message || "Email verified!");
      })
      .catch((err) => {
        setStatus("error");
        setMessage(
          err.response?.data?.message ||
          "This verification link is invalid or has already been used."
        );
      });
  }, [token]);

  // Handle missing token before rendering
  if (!token) {
    return (
      <div className={styles.wrapper}>
        <div className={styles.card}>
          <div className={styles.centerBox}>
            <div className={styles.bigIcon}>❌</div>
            <h2 className={styles.title}>Link Invalid</h2>
            <p className={styles.subtitle}>No verification token found in this link.</p>
            <div className={styles.errorActions}>
              <Link to="/register" className={styles.ctaOutline}>
                Create a new account
              </Link>
              <Link to="/login" className={styles.ctaGhost}>
                Back to Sign In
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.card}>

        {/* Logo */}
        <div className={styles.logoWrap}>
          <div className={styles.logo}>DictaClass</div>
          <div className={styles.tagline}>Classroom Dictation Simulator</div>
        </div>

        {/* Loading */}
        {status === "loading" && (
          <div className={styles.centerBox}>
            <CircularProgress size={40} sx={{ color: "#1E3A5F" }} />
            <p className={styles.subtitle} style={{ marginTop: 20 }}>
              Verifying your email…
            </p>
          </div>
        )}

        {/* Success */}
        {status === "success" && (
          <div className={styles.centerBox}>
            <div className={styles.bigIcon}>✅</div>
            <h2 className={styles.title}>Email Verified!</h2>
            <p className={styles.subtitle}>
              Your DictaClass account is now active. You can sign in and start practising.
            </p>
            <Link to="/login" className={styles.cta}>
              Sign In →
            </Link>
          </div>
        )}

        {/* Already verified */}
        {status === "already" && (
          <div className={styles.centerBox}>
            <div className={styles.bigIcon}>👍</div>
            <h2 className={styles.title}>Already Verified</h2>
            <p className={styles.subtitle}>
              Your email is already verified. You can sign in any time.
            </p>
            <Link to="/login" className={styles.cta}>
              Sign In →
            </Link>
          </div>
        )}

        {/* Error */}
        {status === "error" && (
          <div className={styles.centerBox}>
            <div className={styles.bigIcon}>❌</div>
            <h2 className={styles.title}>Link Invalid</h2>
            <p className={styles.subtitle}>{message}</p>

            <div className={styles.errorActions}>
              <Link to="/register" className={styles.ctaOutline}>
                Create a new account
              </Link>
              <Link to="/login" className={styles.ctaGhost}>
                Back to Sign In
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
