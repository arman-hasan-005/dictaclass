
import { useState, useRef } from "react";
import Fuse from "fuse.js";
import styles from "./NotebookUpload.module.css";

// ── STEP 1: Preprocess image ──────────────────────────────────
const preprocessImage = (file) => {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const MAX_WIDTH = 1500;
      let width = img.width;
      let height = img.height;

      if (width > MAX_WIDTH) {
        const ratio = MAX_WIDTH / width;
        width = MAX_WIDTH;
        height = height * ratio;
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");

      ctx.drawImage(img, 0, 0, width, height);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      for (let i = 0; i < data.length; i += 4) {
        const gray =
          0.299 * data[i] +
          0.587 * data[i + 1] +
          0.114 * data[i + 2];

        const contrast = 1.5;
        const factor =
          (259 * (contrast * 255 + 255)) /
          (255 * (259 - contrast * 255));
        const enhanced = factor * (gray - 128) + 128;
        const clamped = Math.min(255, Math.max(0, enhanced));

        data[i] = clamped;
        data[i + 1] = clamped;
        data[i + 2] = clamped;
      }

      ctx.putImageData(imageData, 0, 0);
      URL.revokeObjectURL(url);

      const base64 = canvas.toDataURL("image/jpeg", 0.6).split(",")[1];
      resolve(base64);
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };

    img.src = url;
  });
};

// ── STEP 3: Fuzzy match full text against original ────────────
const fuzzyMatchText = (extractedText, originalSentences) => {
  if (!extractedText.trim()) return extractedText;

  const originalFull = originalSentences.join(" ");
  const origWords = originalFull
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter(Boolean);

  const extractedWords = extractedText
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter(Boolean);

  const fuse = new Fuse(origWords, { threshold: 0.35, includeScore: true });

  const corrected = extractedWords.map((word) => {
    const results = fuse.search(word);
    if (results.length > 0 && results[0].score < 0.35) {
      return results[0].item;
    }
    return word;
  });

  return corrected.join(" ");
};

export default function NotebookUpload({ sentences, onSubmit }) {
  const [image, setImage] = useState(null);
  const [preview, setPreview] = useState(null);
  const [extracting, setExtracting] = useState(false);
  const [extractedFull, setExtractedFull] = useState("");
  const [error, setError] = useState("");
  const [step, setStep] = useState("upload");
  const [pipeline, setPipeline] = useState({
    preprocessing: false,
    ocr: false,
    fuzzy: false,
  });
  const fileRef = useRef(null);

  const handleImage = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImage(file);
    setPreview(URL.createObjectURL(file));
    setError("");
    setExtractedFull("");
  };

  const handleExtract = async () => {
    if (!image) return;
    setExtracting(true);
    setError("");
    setPipeline({ preprocessing: false, ocr: false, fuzzy: false });

    try {
      // ── Stage 1: Preprocess ──
      setPipeline({ preprocessing: true, ocr: false, fuzzy: false });
      const processedBase64 = await preprocessImage(image);

      if (!processedBase64) {
        setError("Failed to process image. Please try again.");
        return;
      }

      // Convert base64 back to blob for Tesseract
      const byteChars = atob(processedBase64);
      const byteNums = new Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) {
        byteNums[i] = byteChars.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNums);
      const processedBlob = new Blob([byteArray], { type: "image/jpeg" });

      // ── Stage 2: Tesseract OCR ──
      setPipeline({ preprocessing: true, ocr: true, fuzzy: false });
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker("eng", 1, {
        logger: () => {},
      });

      await worker.setParameters({
        tessedit_pageseg_mode: "6",
        preserve_interword_spaces: "1",
      });

      const { data: { text } } = await worker.recognize(processedBlob);
      await worker.terminate();

      const rawText = text.trim();

      // ── Stage 3: Fuzzy matching on full text ──
      setPipeline({ preprocessing: true, ocr: true, fuzzy: true });
      const correctedText = fuzzyMatchText(rawText, sentences);

      setExtractedFull(correctedText);
      setStep("review");

    } catch (err) {
      console.error(err);
      setError("Failed to extract text. Please try a clearer photo.");
    } finally {
      setExtracting(false);
    }
  };

  return (
    <div className={styles.wrap}>
      {step === "upload" ? (

        // ── UPLOAD STEP ──
        <div className={styles.uploadStep}>
          <div className={styles.header}>
            <div className={styles.headerIcon}>📸</div>
            <h2 className={styles.headerTitle}>Upload Your Notebook</h2>
            <p className={styles.headerSub}>
              Take a clear photo of your handwritten answers and upload it below
            </p>
          </div>

          {/* Tips */}
          <div className={styles.tipsRow}>
            <div className={styles.tip}>💡 Good lighting</div>
            <div className={styles.tip}>📏 Flat surface</div>
            <div className={styles.tip}>🔍 Clear writing</div>
            <div className={styles.tip}>📐 Straight angle</div>
          </div>

          {/* File Input */}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleImage}
            style={{ display: "none" }}
          />

          {!preview ? (
            <button
              className={styles.uploadBtn}
              onClick={() => fileRef.current.click()}
            >
              <div className={styles.uploadBtnIcon}>📷</div>
              <div className={styles.uploadBtnText}>
                Take Photo or Choose Image
              </div>
              <div className={styles.uploadBtnSub}>JPG, PNG supported</div>
            </button>
          ) : (
            <div className={styles.previewWrap}>
              <img
                src={preview}
                className={styles.previewImg}
                alt="notebook"
              />
              <button
                className={styles.changeBtn}
                onClick={() => {
                  setPreview(null);
                  setImage(null);
                }}
              >
                Change Photo
              </button>
            </div>
          )}

          {error && <div className={styles.error}>{error}</div>}

          {/* Pipeline Progress */}
          {extracting && (
            <div className={styles.pipelineWrap}>
              <div
                className={`${styles.pipelineStep} ${
                  pipeline.preprocessing
                    ? styles.pipelineDone
                    : styles.pipelineActive
                }`}
              >
                {pipeline.preprocessing ? "✅" : "⏳"} Preprocessing image...
              </div>
              <div className={styles.pipelineArrow}>↓</div>
              <div
                className={`${styles.pipelineStep} ${
                  pipeline.ocr
                    ? styles.pipelineDone
                    : pipeline.preprocessing
                    ? styles.pipelineActive
                    : styles.pipelineWaiting
                }`}
              >
                {pipeline.ocr
                  ? "✅"
                  : pipeline.preprocessing
                  ? "⏳"
                  : "⏸️"}{" "}
                Tesseract OCR...
              </div>
              <div className={styles.pipelineArrow}>↓</div>
              <div
                className={`${styles.pipelineStep} ${
                  pipeline.fuzzy
                    ? styles.pipelineDone
                    : pipeline.ocr
                    ? styles.pipelineActive
                    : styles.pipelineWaiting
                }`}
              >
                {pipeline.fuzzy
                  ? "✅"
                  : pipeline.ocr
                  ? "⏳"
                  : "⏸️"}{" "}
                Fuzzy matching...
              </div>
            </div>
          )}

          {preview && !extracting && (
            <button
              className={styles.extractBtn}
              onClick={handleExtract}
            >
              🔬 Run Triple Accuracy Pipeline
            </button>
          )}
        </div>

      ) : (

        // ── REVIEW STEP ──
        <div className={styles.reviewStep}>
          <div className={styles.reviewHeader}>
            <div className={styles.pipelineSuccess}>
              ✅ Preprocessing &nbsp;→&nbsp; ✅ Tesseract OCR &nbsp;→&nbsp; ✅ Fuzzy Match
            </div>
            <h2 className={styles.headerTitle}>Review Extracted Text</h2>
            <p className={styles.headerSub}>
              Check and fix any mistakes before submitting
            </p>
          </div>

          {/* Original passage for reference */}
          <div className={styles.originalBox}>
            <div className={styles.originalLabel}>📖 Original Passage:</div>
            <div className={styles.originalText}>
              {sentences.join(" ")}
            </div>
          </div>

          {/* Extracted text — editable */}
          <div className={styles.extractedBox}>
            <div className={styles.extractedLabel}>
              ✍️ Your Handwriting (extracted — edit if needed):
            </div>
            <textarea
              className={styles.extractedInput}
              value={extractedFull}
              onChange={(e) => setExtractedFull(e.target.value)}
              rows={8}
              placeholder="Extracted text will appear here..."
            />
          </div>

          <div className={styles.reviewFooter}>
            <button
              className={styles.backBtn}
              onClick={() => setStep("upload")}
            >
              ← Retake Photo
            </button>
            <button
              className={styles.submitBtn}
              onClick={() => onSubmit(extractedFull)}
            >
              Submit & See Results →
            </button>
          </div>
        </div>

      )}
    </div>
  );
}
