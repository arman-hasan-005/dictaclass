import { useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import API from "../../services/authService";
import styles from "./ResetPassword.module.css";
import TextField from "@mui/material/TextField";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";

export default function ResetPassword() {
  const { token }    = useParams();
  const navigate     = useNavigate();

  const [password,   setPassword]   = useState("");
  const [confirm,    setConfirm]    = useState("");
  const [loading,    setLoading]    = useState(false);
  const [success,    setSuccess]    = useState(false);
  const [error,      setError]      = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (password.length < 6) {
      return setError("Password must be at least 6 characters.");
    }
    if (password !== confirm) {
      return setError("Passwords do not match.");
    }

    setLoading(true);
    try {
      await API.post(`/auth/reset-password/${token}`, { password });
      setSuccess(true);
      // Redirect to login after 3 seconds
      setTimeout(() => navigate("/login"), 3000);
    } catch (err) {
      const msg = err.response?.data?.message;
      setError(msg || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.card}>

        {/* Logo */}
        <div className={styles.logoWrap}>
          <div className={styles.logo}>DictaClass</div>
          <div className={styles.tagline}>Classroom Dictation Simulator</div>
        </div>

        {success ? (
          /* ── Success state ─────────────────────────────────── */
          <div className={styles.successBox}>
            <div className={styles.successIcon}>✅</div>
            <h2 className={styles.title}>Password Reset!</h2>
            <p className={styles.subtitle}>
              Your password has been changed successfully.
              Redirecting you to the sign-in page…
            </p>
            <Link to="/login" className={styles.backLink}>
              Sign in now →
            </Link>
          </div>
        ) : (
          /* ── Form state ────────────────────────────────────── */
          <>
            <h2 className={styles.title}>Set New Password</h2>
            <p className={styles.subtitle}>
              Choose a new password for your DictaClass account.
            </p>

            {error && (
              <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
                {error}{" "}
                {/* Offer a re-request link when the token is expired */}
                {error.toLowerCase().includes("expired") && (
                  <Link to="/forgot-password" style={{ fontWeight: 600 }}>
                    Request a new link
                  </Link>
                )}
              </Alert>
            )}

            <form onSubmit={handleSubmit} className={styles.form}>
              <TextField
                fullWidth
                label="New Password"
                type="password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(""); }}
                required
                variant="outlined"
                helperText="At least 6 characters"
                sx={{ mb: 2 }}
              />
              <TextField
                fullWidth
                label="Confirm New Password"
                type="password"
                value={confirm}
                onChange={(e) => { setConfirm(e.target.value); setError(""); }}
                required
                variant="outlined"
                sx={{ mb: 3 }}
              />

              <button
                type="submit"
                className={styles.submitBtn}
                disabled={loading}
              >
                {loading
                  ? <CircularProgress size={20} color="inherit" />
                  : "Reset Password →"}
              </button>
            </form>

            <p className={styles.footer}>
              Remembered it?{" "}
              <Link to="/login" className={styles.link}>Sign in</Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
