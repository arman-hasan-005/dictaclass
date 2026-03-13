/**
 * emailService.js
 *
 * Nodemailer wrapper for all transactional emails in DictaClass.
 *
 * Setup (one-time):
 *   Add to server/.env:
 *     EMAIL_USER=your_gmail@gmail.com
 *     EMAIL_PASS=your_16char_app_password   ← Gmail App Password, NOT real password
 *   Google Account → Security → 2-Step Verification → App Passwords
 *
 * Exports:
 *   sendVerificationEmail(toEmail, name, token)   ← new in Step 3
 *   sendPasswordResetEmail(toEmail, name, token)  ← Step 2 (unchanged)
 */
const nodemailer = require("nodemailer");

// ── Shared transporter ────────────────────────────────────────
// Returns null (not a crash) when creds are missing so the server boots fine.
// The individual send functions handle the null case with a clear error.
const createTransporter = () => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) return null;
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
};

// ── Shared email HTML shell ───────────────────────────────────
// Wraps any body content in the branded DictaClass email template.
const emailShell = (bodyHtml) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#F3F4F6;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0"
         style="background:#F3F4F6;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width:480px;background:#ffffff;border-radius:16px;
               box-shadow:0 4px 24px rgba(0,0,0,0.08);overflow:hidden;">

          <!-- Header -->
          <tr>
            <td style="background:#1E3A5F;padding:28px 32px;text-align:center;">
              <div style="font-size:28px;font-weight:700;color:#F97316;">DictaClass</div>
              <div style="font-size:11px;color:#93C5FD;letter-spacing:2px;
                          text-transform:uppercase;margin-top:4px;">
                Dictation Simulator
              </div>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:36px 32px;">
              ${bodyHtml}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#F9FAFB;padding:18px 32px;text-align:center;
                       border-top:1px solid #E5E7EB;">
              <p style="margin:0;font-size:12px;color:#9CA3AF;">
                © ${new Date().getFullYear()} DictaClass · Classroom Dictation Simulator
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();

// ── CTA button snippet (reused by both emails) ────────────────
const ctaButton = (url, label) => `
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td align="center" style="padding:8px 0 28px;">
        <a href="${url}"
           style="display:inline-block;background:#F97316;color:#ffffff;
                  font-size:16px;font-weight:600;padding:14px 36px;
                  border-radius:12px;text-decoration:none;">
          ${label}
        </a>
      </td>
    </tr>
  </table>`;

// ── URL fallback snippet ──────────────────────────────────────
const urlFallback = (url) => `
  <p style="margin:0 0 4px;font-size:12px;color:#9CA3AF;">
    If the button doesn't work, copy and paste this link into your browser:
  </p>
  <p style="margin:0 0 24px;font-size:12px;color:#6B7280;word-break:break-all;">
    <a href="${url}" style="color:#3B82F6;">${url}</a>
  </p>`;

// ── Shared send helper ────────────────────────────────────────
const send = async (options) => {
  const transporter = createTransporter();
  if (!transporter) {
    const err = new Error("Email service not configured — set EMAIL_USER and EMAIL_PASS in .env");
    err.code = "EMAIL_NOT_CONFIGURED";
    throw err;
  }
  try {
    await transporter.sendMail({ from: `"DictaClass" <${process.env.EMAIL_USER}>`, ...options });
  } catch (err) {
    console.error("[Email] Send failed:", err.message);
    const sendErr = new Error("Failed to send email. Please try again later.");
    sendErr.code = "EMAIL_SEND_FAILED";
    throw sendErr;
  }
};

// ─────────────────────────────────────────────────────────────
// sendVerificationEmail
// Sent immediately after a new user registers.
// @param {string} toEmail  — recipient address
// @param {string} name     — display name for the greeting
// @param {string} token    — raw token (NOT hashed) — placed in the URL
// ─────────────────────────────────────────────────────────────
const sendVerificationEmail = async (toEmail, name, token) => {
  const clientUrl  = process.env.CLIENT_URL || "http://localhost:5173";
  const verifyUrl  = `${clientUrl}/verify-email/${token}`;

  await send({
    to: toEmail,
    subject: "Verify your DictaClass account",
    text: `
Hi ${name},

Welcome to DictaClass! Please verify your email address by clicking the link below.

${verifyUrl}

This link does not expire — you can click it any time.

If you did not create a DictaClass account, you can safely ignore this email.

— The DictaClass Team
    `.trim(),
    html: emailShell(`
      <p style="margin:0 0 8px;font-size:22px;font-weight:600;color:#111827;">
        Welcome to DictaClass, ${name}! 🎉
      </p>
      <p style="margin:0 0 24px;font-size:15px;color:#6B7280;line-height:1.6;">
        Your account is almost ready. Click the button below to verify your
        email address and start practising.
      </p>
      ${ctaButton(verifyUrl, "Verify My Email →")}
      <div style="background:#EFF6FF;border:1px solid #BFDBFE;border-radius:10px;
                  padding:12px 16px;margin-bottom:24px;">
        <p style="margin:0;font-size:13px;color:#1E40AF;">
          ℹ️ This link does not expire — you can click it any time.
        </p>
      </div>
      ${urlFallback(verifyUrl)}
      <p style="margin:0;font-size:13px;color:#9CA3AF;line-height:1.6;">
        If you didn't create a DictaClass account, you can safely ignore this email.
      </p>
    `),
  });
};

// ─────────────────────────────────────────────────────────────
// sendPasswordResetEmail  (Step 2 — unchanged)
// @param {string} toEmail  — recipient address
// @param {string} name     — display name
// @param {string} token    — raw token (NOT hashed)
// ─────────────────────────────────────────────────────────────
const sendPasswordResetEmail = async (toEmail, name, token) => {
  const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";
  const resetUrl  = `${clientUrl}/reset-password/${token}`;

  await send({
    to: toEmail,
    subject: "Reset your DictaClass password",
    text: `
Hi ${name},

You requested a password reset for your DictaClass account.

${resetUrl}

This link expires in 1 hour. If you did not request this, you can safely ignore this email.

— The DictaClass Team
    `.trim(),
    html: emailShell(`
      <p style="margin:0 0 8px;font-size:22px;font-weight:600;color:#111827;">
        Hi ${name} 👋
      </p>
      <p style="margin:0 0 24px;font-size:15px;color:#6B7280;line-height:1.6;">
        We received a request to reset the password for your DictaClass account.
        Click the button below to choose a new one.
      </p>
      ${ctaButton(resetUrl, "Reset My Password →")}
      <div style="background:#FEF3C7;border:1px solid #FDE68A;border-radius:10px;
                  padding:12px 16px;margin-bottom:24px;">
        <p style="margin:0;font-size:13px;color:#92400E;">
          ⏰ This link expires in <strong>1 hour</strong>.
        </p>
      </div>
      ${urlFallback(resetUrl)}
      <p style="margin:0;font-size:13px;color:#9CA3AF;line-height:1.6;">
        If you didn't request a password reset, you can safely ignore this email.
        Your password will not change.
      </p>
    `),
  });
};

module.exports = { sendVerificationEmail, sendPasswordResetEmail };
