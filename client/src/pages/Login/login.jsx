// FIX: File renamed from login.jsx → Login.jsx
// App.jsx imports this as "./pages/Login/Login" (capital L).
// On Linux (case-sensitive filesystem), the lowercase filename caused a
// "Module not found" error at runtime even though it worked on macOS/Windows.
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import API from "../../services/authService";
import styles from "./Login.module.css";

import TextField from "@mui/material/TextField";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";

export default function Login() {
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  // When the server returns EMAIL_NOT_VERIFIED we show a resend link
  const [unverifiedEmail, setUnverifiedEmail] = useState("");
  const [resendStatus, setResendStatus] = useState("idle"); // idle|sending|sent|error

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError("");
    setUnverifiedEmail("");
    setResendStatus("idle");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setUnverifiedEmail("");

    try {
      const { data } = await API.post("/auth/login", formData);
      login(data);
      navigate("/dashboard");
    } catch (err) {
      const body = err.response?.data || {};

      // Unverified account — show resend option
      if (body.errorCode === "EMAIL_NOT_VERIFIED") {
        setUnverifiedEmail(body.email || formData.email);
        setError(body.message || "Please verify your email before logging in.");
      } else {
        setError(body.message || "Login failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResendStatus("sending");
    try {
      await API.post("/auth/resend-verification", { email: unverifiedEmail });
      setResendStatus("sent");
    } catch {
      setResendStatus("error");
    }
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.card}>
        <div className={styles.logoWrap}>
          <div className={styles.logo}>DictaClass</div>
          <div className={styles.tagline}>Classroom Dictation Simulator</div>
        </div>

        <h2 className={styles.title}>Welcome Back</h2>
        <p className={styles.subtitle}>
          Sign in to continue your learning journey
        </p>

        {/* Standard error */}
        {error && !unverifiedEmail && (
          <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
            {error}
          </Alert>
        )}

        {/* Unverified account — special banner with resend */}
        {unverifiedEmail && (
          <Alert
            severity="warning"
            sx={{ mb: 2, borderRadius: 2 }}
            action={
              resendStatus === "sent" ? (
                <span
                  style={{ fontSize: 13, fontWeight: 600, color: "#065F46" }}
                >
                  ✓ Sent!
                </span>
              ) : (
                <button
                  onClick={handleResend}
                  disabled={resendStatus === "sending"}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    fontWeight: 700,
                    fontSize: 13,
                    color: "#92400E",
                    textDecoration: "underline",
                    padding: 0,
                  }}
                >
                  {resendStatus === "sending" ? "Sending…" : "Resend link"}
                </button>
              )
            }
          >
            Please verify your email before logging in.
          </Alert>
        )}

        <form onSubmit={handleSubmit} className={styles.form}>
          <TextField
            fullWidth
            label="Email Address"
            name="email"
            type="email"
            value={formData.email}
            onChange={handleChange}
            required
            variant="outlined"
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            label="Password"
            name="password"
            type="password"
            value={formData.password}
            onChange={handleChange}
            required
            variant="outlined"
            sx={{ mb: 2 }}
          />
          <p
            style={{
              textAlign: "right",
              marginTop: "-8px",
              marginBottom: "16px",
            }}
          >
            <Link to="/forgot-password" className={styles.link}>
              Forgot password?
            </Link>
          </p>
          <button type="submit" className={styles.submitBtn} disabled={loading}>
            {loading ? (
              <CircularProgress size={20} color="inherit" />
            ) : (
              "Sign In →"
            )}
          </button>
        </form>

        <p className={styles.footer}>
          Don't have an account?{" "}
          <Link to="/register" className={styles.link}>
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
