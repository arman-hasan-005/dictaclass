import { useState } from "react";
import { Link } from "react-router-dom";
import API from "../../services/authService";
import styles from "./ForgotPassword.module.css";
import TextField from "@mui/material/TextField";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";

export default function ForgotPassword() {
  const [email,     setEmail]     = useState("");
  const [loading,   setLoading]   = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error,     setError]     = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      await API.post("/auth/forgot-password", { email });
      setSubmitted(true);   // Always show success — server never reveals if email exists
    } catch (err) {
      // Only surface server-side problems (503 etc.), not "email not found"
      const msg = err.response?.data?.message;
      if (err.response?.status === 503) {
        setError(msg || "Email service unavailable. Please contact the administrator.");
      } else if (err.response?.status >= 500) {
        setError("Something went wrong. Please try again.");
      } else {
        // 4xx — treat as success (prevents user enumeration)
        setSubmitted(true);
      }
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

        {submitted ? (
          /* ── Success state ─────────────────────────────────── */
          <div className={styles.successBox}>
            <div className={styles.successIcon}>📬</div>
            <h2 className={styles.title}>Check your inbox</h2>
            <p className={styles.subtitle}>
              If <strong>{email}</strong> is registered, we've sent a password
              reset link. It expires in <strong>1 hour</strong>.
            </p>
            <p className={styles.hint}>
              Don't see it? Check your spam or junk folder.
            </p>
            <Link to="/login" className={styles.backLink}>
              ← Back to Sign In
            </Link>
          </div>
        ) : (
          /* ── Form state ────────────────────────────────────── */
          <>
            <h2 className={styles.title}>Forgot Password?</h2>
            <p className={styles.subtitle}>
              Enter your email and we'll send you a link to reset your password.
            </p>

            {error && (
              <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
                {error}
              </Alert>
            )}

            <form onSubmit={handleSubmit} className={styles.form}>
              <TextField
                fullWidth
                label="Email Address"
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(""); }}
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
                  : "Send Reset Link →"}
              </button>
            </form>

            <p className={styles.footer}>
              Remember your password?{" "}
              <Link to="/login" className={styles.link}>Sign in</Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
