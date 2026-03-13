/**
 * NotebookUpload.jsx  —  Triple Accuracy Pipeline
 *
 *   📸 Photo Uploaded
 *        ↓
 *   🔧 Image Preprocessing  (grayscale → contrast boost → unsharp sharpen)
 *        ↓
 *   👁️  Google Vision API   (skipped if no key / limit reached → Tesseract)
 *        ↓
 *   📝 Extracted Text
 *        ↓
 *   🎯 Fuzzy Matching        (forgiving comparison against original passage)
 *        ↓
 *   ✅ Final Score
 *
 * BUGS FIXED vs previous version:
 *   • Sharp array was Uint8ClampedArray(length) initialised to all-zeros
 *     → 1px black border around every image after sharpen kernel
 *     Fix: copy edge pixel rows/cols from out[] into sharp[] after kernel loop
 *   • engineUsed variable was assigned in catch block but never read → removed
 *   • setOcrEngine("tesseract") was called before runTesseract() completed
 *     → UI showed wrong engine if Tesseract threw
 *     Fix: set ocrEngine only after runTesseract() resolves
 */
import { useState, useRef } from "react";
import API from "../../services/authService";
import styles from "./NotebookUpload.module.css";

// Error codes that mean Google Vision is permanently unavailable right now
const SKIP_VISION_CODES = new Set([
  "NO_KEY", "INVALID_KEY", "QUOTA_EXCEEDED", "API_NOT_ENABLED",
]);

// ─────────────────────────────────────────────────────────────
// STAGE 1 — Image Preprocessing
// Three sequential operations:
//   A. Grayscale (luminosity formula)
//   B. Contrast boost (S-curve factor method)
//   C. Unsharp mask sharpen (3×3 convolution kernel)
// Returns: base64 JPEG string ready for OCR
// ─────────────────────────────────────────────────────────────
const preprocessImage = (file) =>
  new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      // Resize: cap at 1600px wide to keep file size manageable
      const MAX_W = 1600;
      let { width: w, height: h } = img;
      if (w > MAX_W) { h = Math.round((h * MAX_W) / w); w = MAX_W; }

      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, w, h);

      const imgData = ctx.getImageData(0, 0, w, h);
      const src = imgData.data;
      const out = new Uint8ClampedArray(src.length);

      // ── A: Grayscale ─────────────────────────────────────────
      // Luminosity formula matches human visual perception weighting
      for (let i = 0; i < src.length; i += 4) {
        const g = Math.round(0.299 * src[i] + 0.587 * src[i + 1] + 0.114 * src[i + 2]);
        out[i] = out[i + 1] = out[i + 2] = g;
        out[i + 3] = src[i + 3];
      }

      // ── B: Contrast boost ────────────────────────────────────
      // S-curve: factor = (259 × (C+255)) / (255 × (259−C))
      const C      = 60;
      const factor = (259 * (C + 255)) / (255 * (259 - C));
      for (let i = 0; i < out.length; i += 4) {
        const v = Math.min(255, Math.max(0, factor * (out[i] - 128) + 128));
        out[i] = out[i + 1] = out[i + 2] = v;
      }

      // ── C: Unsharp mask sharpen ──────────────────────────────
      // 3×3 kernel:  [ 0, -1,  0 ]
      //              [-1,  5, -1 ]
      //              [ 0, -1,  0 ]
      // Enhances edges — makes handwriting strokes crisper for OCR.
      //
      // FIX: Initialise sharp[] by copying out[] first so edge pixels
      // (row 0, row h-1, col 0, col w-1) are never left as black zeros.
      const sharp  = new Uint8ClampedArray(out);  // copy all pixels including edges
      const kernel = [0, -1, 0, -1, 5, -1, 0, -1, 0];

      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          let acc = 0;
          for (let ky = -1; ky <= 1; ky++) {
            for (let kx = -1; kx <= 1; kx++) {
              acc += out[((y + ky) * w + (x + kx)) * 4] * kernel[(ky + 1) * 3 + (kx + 1)];
            }
          }
          const si = (y * w + x) * 4;
          const v  = Math.min(255, Math.max(0, acc));
          sharp[si] = sharp[si + 1] = sharp[si + 2] = v;
          sharp[si + 3] = 255;
        }
      }

      ctx.putImageData(new ImageData(sharp, w, h), 0, 0);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.85).split(",")[1]);
    };

    img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    img.src = url;
  });

// ─────────────────────────────────────────────────────────────
// STAGE 2 — Google Vision OCR  (via backend /api/ocr)
// ─────────────────────────────────────────────────────────────
const runGoogleVision = async (base64) => {
  const { data } = await API.post("/ocr", { imageBase64: base64 });
  return data.text || "";
};

// ─────────────────────────────────────────────────────────────
// STAGE 2 FALLBACK — Tesseract.js  (browser, free, always available)
// ─────────────────────────────────────────────────────────────
const runTesseract = async (base64) => {
  const bytes  = atob(base64);
  const arr    = new Uint8Array([...bytes].map((c) => c.charCodeAt(0)));
  const blob   = new Blob([arr], { type: "image/jpeg" });
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng", 1, { logger: () => {} });
  await worker.setParameters({ tessedit_pageseg_mode: "6" });
  const { data: { text } } = await worker.recognize(blob);
  await worker.terminate();
  return text.trim();
};

// ─────────────────────────────────────────────────────────────
// STAGE 3 — Fuzzy Matching
// Maps each extracted word to its closest match in the original
// passage using Levenshtein distance.
// Tolerance: ≤ 1 edit — corrects common OCR noise (l→1, O→0)
// without corrupting genuinely wrong student answers.
// ─────────────────────────────────────────────────────────────
const levenshtein = (a, b) => {
  const dp = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) =>
      i === 0 ? j : j === 0 ? i : 0
    )
  );
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
  return dp[a.length][b.length];
};

const fuzzyMatch = (extracted, originalSentences) => {
  if (!extracted.trim()) return extracted;

  const origWords = originalSentences
    .join(" ").toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter(Boolean);

  const extrWords = extracted
    .toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter(Boolean);

  return extrWords.map((word) => {
    let best = word, bestDist = Infinity;
    for (const orig of origWords) {
      const d = levenshtein(word, orig);
      if (d < bestDist) { best = orig; bestDist = d; }
    }
    return bestDist <= 1 ? best : word;
  }).join(" ");
};

// ─────────────────────────────────────────────────────────────
// Pipeline stage definitions — drives both UI and logic
// ─────────────────────────────────────────────────────────────
const STAGES = [
  { key: "upload",        icon: "📸", label: "Photo Uploaded",       sub: "" },
  { key: "preprocessing", icon: "🔧", label: "Image Preprocessing",  sub: "grayscale + contrast + sharpen" },
  { key: "ocr",           icon: "👁️",  label: "Google Vision API",    sub: "reads preprocessed image" },
  { key: "extracted",     icon: "📝", label: "Extracted Text",        sub: "raw OCR output" },
  { key: "fuzzy",         icon: "🎯", label: "Fuzzy Matching",        sub: "forgiving comparison against original" },
  { key: "score",         icon: "✅", label: "Final Score",           sub: "ready to submit" },
];

const STATUS_STYLES = {
  waiting: { bg: "#F9FAFB", border: "#E5E7EB", color: "#9CA3AF", dot: "#D1D5DB" },
  active:  { bg: "#EEF2FF", border: "#A5B4FC", color: "#3730A3", dot: "#6366F1" },
  done:    { bg: "#ECFDF5", border: "#A7F3D0", color: "#065F46", dot: "#10B981" },
  skipped: { bg: "#FFFBEB", border: "#FDE68A", color: "#92400E", dot: "#F59E0B" },
  error:   { bg: "#FEF2F2", border: "#FECACA", color: "#991B1B", dot: "#EF4444" },
};

// ─────────────────────────────────────────────────────────────
// PipelineVisual — live 6-step pipeline status display
// ─────────────────────────────────────────────────────────────
function PipelineVisual({ stageStatus, ocrEngine, ocrSkipReason }) {
  return (
    <div style={{ margin: "20px 0" }}>
      <div style={{ textAlign: "center", fontWeight: 700, fontSize: 15,
        color: "#1E3A5F", marginBottom: 16 }}>
        🔬 Triple Accuracy Pipeline
      </div>

      {STAGES.map((stage, i) => {
        const status = stageStatus[stage.key] || "waiting";
        const s      = STATUS_STYLES[status];
        const isOCR  = stage.key === "ocr";

        return (
          <div key={stage.key}>
            <div style={{
              display: "flex", alignItems: "center", gap: 12,
              background: s.bg, border: `1.5px solid ${s.border}`,
              borderRadius: 10, padding: "10px 16px", transition: "all 0.3s",
              opacity: status === "waiting" ? 0.45 : 1,
            }}>
              {/* Animated status dot */}
              <div style={{
                width: 10, height: 10, borderRadius: "50%", background: s.dot,
                flexShrink: 0,
                animation: status === "active" ? "pulse 1s infinite" : "none",
              }} />

              <span style={{ fontSize: 18, lineHeight: 1 }}>{stage.icon}</span>

              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: s.color }}>
                  {stage.label}
                  {/* Engine badge on OCR row */}
                  {isOCR && status === "done" && ocrEngine === "google_vision" && (
                    <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 600,
                      background: "#DBEAFE", color: "#1E40AF",
                      padding: "1px 7px", borderRadius: 99 }}>
                      Google Vision ✓
                    </span>
                  )}
                  {isOCR && status === "done" && ocrEngine === "tesseract" && (
                    <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 600,
                      background: "#FEF3C7", color: "#92400E",
                      padding: "1px 7px", borderRadius: 99 }}>
                      Tesseract fallback
                    </span>
                  )}
                  {isOCR && status === "skipped" && (
                    <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 600,
                      background: "#FEF3C7", color: "#92400E",
                      padding: "1px 7px", borderRadius: 99 }}>
                      Vision skipped → Tesseract
                    </span>
                  )}
                </div>
                {(stage.sub || (isOCR && status === "skipped" && ocrSkipReason)) && (
                  <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 1 }}>
                    {isOCR && status === "skipped" && ocrSkipReason
                      ? ocrSkipReason
                      : stage.sub}
                  </div>
                )}
              </div>

              {status === "done"    && <span style={{ fontSize: 14, color: "#10B981" }}>✓</span>}
              {status === "active"  && <span style={{ fontSize: 12, color: "#6366F1" }}>⏳</span>}
              {status === "skipped" && <span style={{ fontSize: 12 }}>⏭️</span>}
            </div>

            {i < STAGES.length - 1 && (
              <div style={{ textAlign: "center", color: "#D1D5DB",
                fontSize: 16, lineHeight: 1, margin: "3px 0" }}>
                ↓
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────
export default function NotebookUpload({ sentences, onSubmit }) {
  const [image,         setImage]         = useState(null);
  const [preview,       setPreview]       = useState(null);
  const [step,          setStep]          = useState("upload"); // "upload" | "review"
  const [stageStatus,   setStageStatus]   = useState({
    upload: "done", preprocessing: "waiting",
    ocr: "waiting", extracted: "waiting",
    fuzzy: "waiting", score: "waiting",
  });
  const [ocrEngine,     setOcrEngine]     = useState(null);  // set AFTER engine completes
  const [ocrSkipReason, setOcrSkipReason] = useState("");
  const [extractedFull, setExtractedFull] = useState("");
  const [extracting,    setExtracting]    = useState(false);
  const [error,         setError]         = useState("");
  const fileRef = useRef(null);

  const setStage = (key, status) =>
    setStageStatus((prev) => ({ ...prev, [key]: status }));

  const resetState = () => {
    setError(""); setExtractedFull("");
    setOcrEngine(null); setOcrSkipReason("");
    setStageStatus({
      upload: "done", preprocessing: "waiting",
      ocr: "waiting", extracted: "waiting",
      fuzzy: "waiting", score: "waiting",
    });
  };

  const handleImage = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImage(file);
    setPreview(URL.createObjectURL(file));
    resetState();
  };

  const handleExtract = async () => {
    if (!image) return;
    setExtracting(true);
    setError("");

    try {
      // ── Stage: Preprocessing ──────────────────────────────────
      setStage("preprocessing", "active");
      const base64 = await preprocessImage(image);
      if (!base64) throw new Error("Image preprocessing failed");
      setStage("preprocessing", "done");

      // ── Stage: OCR (Google Vision → Tesseract fallback) ───────
      setStage("ocr", "active");
      let rawText = "";

      try {
        // Try Google Vision first
        rawText = await runGoogleVision(base64);
        // FIX: set ocrEngine AFTER the call succeeds (not before)
        setOcrEngine("google_vision");
        setStage("ocr", "done");

      } catch (visionErr) {
        // Read the structured error code from the backend
        const errorCode = visionErr.response?.data?.errorCode || "SERVICE_ERROR";
        const message   = visionErr.response?.data?.message   || visionErr.message;

        const reasonMap = {
          NO_KEY:          "No Google Vision key in server .env",
          INVALID_KEY:     "Google Vision key invalid or expired",
          QUOTA_EXCEEDED:  "Google Vision quota limit reached",
          API_NOT_ENABLED: "Cloud Vision API not enabled in Google Cloud project",
          NETWORK_ERROR:   "Cannot reach Google Vision API",
          SERVICE_ERROR:   "Google Vision service error",
        };
        setOcrSkipReason(reasonMap[errorCode] || `Vision unavailable (${errorCode})`);
        console.warn(`[OCR] Google Vision: ${message} — falling back to Tesseract`);

        // Mark Vision as skipped regardless of error type
        setStage("ocr", "skipped");

        // Run Tesseract — set ocrEngine only after it completes
        rawText = await runTesseract(base64);
        setOcrEngine("tesseract");
      }

      // ── Stage: Extracted ──────────────────────────────────────
      setStage("extracted", "done");

      // ── Stage: Fuzzy Matching ─────────────────────────────────
      setStage("fuzzy", "active");
      const corrected = fuzzyMatch(rawText, sentences);
      setStage("fuzzy", "done");

      // ── Stage: Score ready ────────────────────────────────────
      setStage("score", "done");

      setExtractedFull(corrected);
      setStep("review");

    } catch (err) {
      console.error("[OCR Pipeline]", err);
      setError("Pipeline failed. Please try a clearer photo in good lighting.");
    } finally {
      setExtracting(false);
    }
  };

  // ─── Upload step ────────────────────────────────────────────
  if (step === "upload") {
    return (
      <div className={styles.wrap}>
        <div className={styles.header}>
          <div className={styles.headerIcon}>📓</div>
          <h2 className={styles.headerTitle}>Upload Your Notebook</h2>
          <p className={styles.headerSub}>
            Take a clear photo — the pipeline reads, processes, and scores your handwriting
          </p>
        </div>

        <div className={styles.tipsRow}>
          <div className={styles.tip}>💡 Good lighting</div>
          <div className={styles.tip}>📏 Flat surface</div>
          <div className={styles.tip}>🔍 Clear writing</div>
          <div className={styles.tip}>📐 Straight angle</div>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleImage}
          style={{ display: "none" }}
        />

        {!preview ? (
          <button className={styles.uploadBtn} onClick={() => fileRef.current.click()}>
            <div className={styles.uploadBtnIcon}>📷</div>
            <div className={styles.uploadBtnText}>Take Photo or Choose Image</div>
            <div className={styles.uploadBtnSub}>JPG, PNG supported</div>
          </button>
        ) : (
          <div className={styles.previewWrap}>
            <img src={preview} className={styles.previewImg} alt="notebook" />
            <button
              className={styles.changeBtn}
              onClick={() => { setPreview(null); setImage(null); resetState(); }}
            >
              Change Photo
            </button>
          </div>
        )}

        {error && <div className={styles.error}>{error}</div>}

        {/* Live pipeline — shown as soon as an image is selected */}
        {preview && (
          <PipelineVisual
            stageStatus={stageStatus}
            ocrEngine={ocrEngine}
            ocrSkipReason={ocrSkipReason}
          />
        )}

        {preview && !extracting && (
          <button className={styles.extractBtn} onClick={handleExtract}>
            🔬 Run Triple Accuracy Pipeline
          </button>
        )}

        {extracting && (
          <div style={{ textAlign: "center", padding: 14,
            color: "#6366F1", fontWeight: 600, fontSize: 14 }}>
            ⏳ Processing… please wait
          </div>
        )}
      </div>
    );
  }

  // ─── Review step ────────────────────────────────────────────
  return (
    <div className={styles.wrap}>

      {/* Pipeline summary banner */}
      {ocrEngine === "google_vision" ? (
        <div style={{ background: "#ECFDF5", border: "1px solid #A7F3D0",
          borderRadius: 10, padding: "12px 18px", marginBottom: 20 }}>
          <div style={{ fontWeight: 700, color: "#059669", marginBottom: 4 }}>
            ✅ Triple Accuracy Pipeline Complete
          </div>
          <div style={{ fontSize: 13, color: "#065F46" }}>
            🔧 Preprocessed → 👁️ Google Vision → 📝 Extracted → 🎯 Fuzzy Matched → ✅ Ready
          </div>
        </div>
      ) : (
        <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A",
          borderRadius: 10, padding: "12px 18px", marginBottom: 20 }}>
          <div style={{ fontWeight: 700, color: "#D97706", marginBottom: 4 }}>
            ⚠️ Pipeline Complete — Tesseract Fallback Used
          </div>
          <div style={{ fontSize: 13, color: "#92400E", marginBottom: 4 }}>
            🔧 Preprocessed → ⏭️ Vision skipped → 🔤 Tesseract → 📝 Extracted → 🎯 Fuzzy Matched
          </div>
          {ocrSkipReason && (
            <div style={{ fontSize: 12, color: "#B45309" }}>Reason: {ocrSkipReason}</div>
          )}
          <div style={{ fontSize: 12, color: "#92400E", marginTop: 4 }}>
            Tesseract is less accurate than Google Vision — please review the text carefully below.
          </div>
        </div>
      )}

      <div className={styles.reviewHeader}>
        <h2 className={styles.headerTitle}>Review Extracted Text</h2>
        <p className={styles.headerSub}>Check and correct any mistakes, then submit</p>
      </div>

      <div className={styles.originalBox}>
        <span className={styles.originalLabel}>📖 Original Passage</span>
        <div className={styles.originalText}>{sentences.join(" ")}</div>
      </div>

      <div className={styles.extractedBox}>
        <span className={styles.extractedLabel}>
          ✍️ Your Handwriting — Extracted &amp; Fuzzy Matched (edit if needed)
        </span>
        <textarea
          className={styles.extractedInput}
          value={extractedFull}
          onChange={(e) => setExtractedFull(e.target.value)}
          rows={8}
          placeholder="Extracted text will appear here…"
        />
      </div>

      <div className={styles.reviewFooter}>
        <button
          className={styles.backBtn}
          onClick={() => { setStep("upload"); resetState(); }}
        >
          ← Retake Photo
        </button>
        <button
          className={styles.submitBtn}
          onClick={() => onSubmit(extractedFull)}
        >
          Submit &amp; See Results →
        </button>
      </div>
    </div>
  );
}
