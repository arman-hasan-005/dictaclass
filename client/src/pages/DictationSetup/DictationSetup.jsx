
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import API from "../../services/authService";
import Navbar from "../../components/Navbar/Navbar";
import styles from "./DictationSetup.module.css";

const LEVELS = [
  { id: "beginner", label: "Beginner", sublabel: "A1 - A2", icon: "🌱", color: "#059669", bg: "#ECFDF5" },
  { id: "intermediate", label: "Intermediate", sublabel: "B1 - B2", icon: "📖", color: "#D97706", bg: "#FFFBEB" },
  { id: "advanced", label: "Advanced", sublabel: "C1 - C2", icon: "🎓", color: "#7C3AED", bg: "#F5F3FF" },
];

const SPEEDS = [
  { value: 0.5, label: "0.5x", desc: "Very Slow" },
  { value: 0.75, label: "0.75x", desc: "Slow" },
  { value: 1.0, label: "1x", desc: "Normal" },
  { value: 1.25, label: "1.25x", desc: "Fast" },
];

const REPETITIONS = [1, 2, 3];

const PAUSES = [
  { value: 3000, label: "Short", desc: "3 seconds" },
  { value: 5000, label: "Medium", desc: "5 seconds" },
  { value: 8000, label: "Long", desc: "8 seconds" },
];

export default function DictationSetup() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [sourceTab, setSourceTab] = useState("library");
  const [level, setLevel] = useState(user?.preferredLevel || "beginner");
  const [passages, setPassages] = useState([]);
  const [selectedPassage, setSelectedPassage] = useState(null);
  const [speed, setSpeed] = useState(0.75);
  const [repetitions, setRepetitions] = useState(2);
  const [pause, setPause] = useState(5000);
  const [voice, setVoice] = useState(user?.preferredVoice || "female");
  const [loading, setLoading] = useState(false);
  const [inputMode, setInputMode] = useState("type");

  // Upload states
  const [uploadedText, setUploadedText] = useState("");
  const [uploadedTitle, setUploadedTitle] = useState("");
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchPassages();
  }, [level]); // eslint-disable-line

  const fetchPassages = async () => {
    try {
      setLoading(true);
      setSelectedPassage(null);
      const { data } = await API.get(`/passages?level=${level}`);
      setPassages(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadLoading(true);
    setUploadError("");
    setUploadedText("");
    const fileName = file.name.replace(/\.[^/.]+$/, "");
    setUploadedTitle(fileName);
    try {
      const extension = file.name.split(".").pop().toLowerCase();
      if (["jpg", "jpeg", "png", "webp"].includes(extension)) {
        const { createWorker } = await import("tesseract.js");
        const worker = await createWorker("eng");
        const { data: { text } } = await worker.recognize(file);
        await worker.terminate();
        setUploadedText(text.trim());
      } else if (extension === "pdf") {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.js",
    import.meta.url
  ).toString();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let fullText = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    fullText += content.items.map((item) => item.str).join(" ") + " ";
  }
  setUploadedText(fullText.trim());

      } else if (["doc", "docx"].includes(extension)) {
        const mammoth = await import("mammoth");
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        setUploadedText(result.value.trim());
      } else {
        setUploadError("Unsupported file. Please upload JPG, PNG, PDF, DOC or DOCX.");
      }
    } catch (err) {
      console.error(err);
      setUploadError("Failed to extract text. Please try another file.");
    } finally {
      setUploadLoading(false);
    }
  };

  const handleStart = () => {
    if (sourceTab === "library" && !selectedPassage) return;
    if (sourceTab === "upload" && !uploadedText) return;

    const passageData = sourceTab === "library"
      ? selectedPassage
      : {
          _id: null,
          title: uploadedTitle || "Custom Passage",
          content: uploadedText,
          level,
          source: "upload",
        };

    navigate("/session", {
      state: { passage: passageData, speed, repetitions, pause, voice, inputMode},
    });
  };

  const canStart = sourceTab === "library" ? !!selectedPassage : !!uploadedText;

  return (
    <div className={styles.page}>
      <Navbar />
      <div className={styles.content}>

        {/* Header */}
        <div className={styles.headerRow}>
          <h1 className={styles.title}>Setup Your Dictation</h1>
          <p className={styles.subtitle}>Configure your session to match your learning needs</p>
        </div>

        {/* Source Tabs */}
        <div className={styles.tabRow}>
          <button
            className={`${styles.tab} ${sourceTab === "library" ? styles.tabActive : ""}`}
            onClick={() => setSourceTab("library")}
          >
            📚 Use Library
          </button>
          <button
            className={`${styles.tab} ${sourceTab === "upload" ? styles.tabActive : ""}`}
            onClick={() => setSourceTab("upload")}
          >
            📤 Upload Your Own
          </button>
        </div>

        {/*Input mode*/}
        <div className={styles.inputModeRow}>
  <button
    className={`${styles.modeCard} ${inputMode === "type" ? styles.modeSelected : ""}`}
    onClick={() => setInputMode("type")}
  >
    <div className={styles.modeIcon}>⌨️</div>
    <div className={styles.modeLabel}>Type Mode</div>
    <div className={styles.modeSub}>Type answers on screen</div>
  </button>
  <button
    className={`${styles.modeCard} ${inputMode === "handwrite" ? styles.modeSelected : ""}`}
    onClick={() => setInputMode("handwrite")}
  >
    <div className={styles.modeIcon}>✍️</div>
    <div className={styles.modeLabel}>Handwrite Mode</div>
    <div className={styles.modeSub}>Write on paper, upload photo</div>
  </button>
</div>

        {/* ── LIBRARY TAB ───────────────────────────── */}
        {sourceTab === "library" && (
          <div className={styles.grid}>

            {/* Left — Level + Passage (full height) */}
            <div className={styles.leftCol}>

              {/* Level Selection */}
              <div className={styles.card}>
                <h3 className={styles.cardTitle}>📊 Select Level</h3>
                <div className={styles.levelGrid}>
                  {LEVELS.map((l) => (
                    <button
                      key={l.id}
                      className={`${styles.levelCard} ${level === l.id ? styles.levelSelected : ""}`}
                      style={level === l.id ? { borderColor: l.color, background: l.bg } : {}}
                      onClick={() => setLevel(l.id)}
                    >
                      <div className={styles.levelIcon}>{l.icon}</div>
                      <div className={styles.levelLabel}>{l.label}</div>
                      <div className={styles.levelSub}>{l.sublabel}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Passage List — stretches to match right column */}
              <div className={`${styles.card} ${styles.passageCard}`}>
                <h3 className={styles.cardTitle}>📝 Select Passage</h3>
                {loading ? (
                  <div className={styles.loadingText}>Loading passages...</div>
                ) : (
                  <div className={styles.passageList}>
                    {passages.map((p) => (
                      <button
                        key={p._id}
                        className={`${styles.passageRow} ${selectedPassage?._id === p._id ? styles.passageSelected : ""}`}
                        onClick={() => setSelectedPassage(p)}
                      >
                        <div className={styles.passageChapter}>Ch. {p.chapter}</div>
                        <div className={styles.passageInfo}>
                          <div className={styles.passageTitle}>{p.title}</div>
                          <div className={styles.passageWords}>{p.wordCount} words</div>
                        </div>
                        {selectedPassage?._id === p._id && (
                          <div className={styles.passageCheck}>✓</div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

            </div>

            {/* Right — Settings + Summary */}
            <div className={styles.rightCol}>
              {/* Voice */}
              <div className={styles.card}>
                <h3 className={styles.cardTitle}>🎙️ Teacher Voice</h3>
                <div className={styles.voiceGrid}>
                  <button className={`${styles.voiceCard} ${voice === "female" ? styles.voiceSelected : ""}`} onClick={() => setVoice("female")}>
                    <div className={styles.voiceIcon}>👩</div>
                    <div className={styles.voiceLabel}>Female</div>
                    <div className={styles.voiceSub}>Warm & Clear</div>
                  </button>
                  <button className={`${styles.voiceCard} ${voice === "male" ? styles.voiceSelected : ""}`} onClick={() => setVoice("male")}>
                    <div className={styles.voiceIcon}>👨</div>
                    <div className={styles.voiceLabel}>Male</div>
                    <div className={styles.voiceSub}>Deep & Clear</div>
                  </button>
                </div>
              </div>

              {/* Speed */}
              <div className={styles.card}>
                <h3 className={styles.cardTitle}>⚡ Reading Speed</h3>
                <div className={styles.optionGrid}>
                  {SPEEDS.map((s) => (
                    <button key={s.value} className={`${styles.optionCard} ${speed === s.value ? styles.optionSelected : ""}`} onClick={() => setSpeed(s.value)}>
                      <div className={styles.optionLabel}>{s.label}</div>
                      <div className={styles.optionDesc}>{s.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Repetitions */}
              <div className={styles.card}>
                <h3 className={styles.cardTitle}>🔁 Sentence Repetitions</h3>
                <p className={styles.cardDesc}>How many times each sentence is read before moving on</p>
                <div className={styles.repGrid}>
                  {REPETITIONS.map((r) => (
                    <button key={r} className={`${styles.repCard} ${repetitions === r ? styles.repSelected : ""}`} onClick={() => setRepetitions(r)}>
                      <div className={styles.repNumber}>{r}×</div>
                      <div className={styles.repDesc}>{r === 1 ? "Once" : r === 2 ? "Twice" : "Three times"}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Pause */}
              <div className={styles.card}>
                <h3 className={styles.cardTitle}>⏸️ Pause Between Sentences</h3>
                <p className={styles.cardDesc}>Time given to write after each sentence is read</p>
                <div className={styles.optionGrid}>
                  {PAUSES.map((p) => (
                    <button key={p.value} className={`${styles.optionCard} ${pause === p.value ? styles.optionSelected : ""}`} onClick={() => setPause(p.value)}>
                      <div className={styles.optionLabel}>{p.label}</div>
                      <div className={styles.optionDesc}>{p.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Summary */}
              <div className={styles.summaryCard}>
                <h3 className={styles.summaryTitle}>Session Summary</h3>
                <div className={styles.summaryRows}>
                  <div className={styles.summaryRow}><span>Passage</span><span>{selectedPassage ? selectedPassage.title : "Not selected"}</span></div>
                  <div className={styles.summaryRow}><span>Level</span><span>{level.charAt(0).toUpperCase() + level.slice(1)}</span></div>
                  <div className={styles.summaryRow}><span>Voice</span><span>{voice === "female" ? "👩 Female" : "👨 Male"}</span></div>
                  <div className={styles.summaryRow}><span>Speed</span><span>{speed}x</span></div>
                  <div className={styles.summaryRow}><span>Repetitions</span><span>{repetitions}× per sentence</span></div>
                  <div className={styles.summaryRow}><span>Pause</span><span>{PAUSES.find((p) => p.value === pause)?.label}</span></div>
                </div>
                <button className={styles.startBtn} onClick={handleStart} disabled={!canStart}>
                  {canStart ? "Start Dictation →" : "Select a passage first"}
                </button>
              </div>

            </div>
          </div>
        )}

        {/* ── UPLOAD TAB ────────────────────────────── */}
{sourceTab === "upload" && (
  <div className={styles.uploadLayout}>

    {/* Upload Card — Full Width */}
    <div className={styles.card}>
      <h3 className={styles.cardTitle}>📤 Upload Passage</h3>
      <p className={styles.cardDesc}>
        Upload an image, PDF, or Word document to use as your dictation passage
      </p>
      <input
        ref={fileInputRef}
        type="file"
        accept=".jpg,.jpeg,.png,.webp,.pdf,.doc,.docx"
        onChange={handleFileUpload}
        style={{ display: "none" }}
      />
      <button
        className={styles.uploadBtn}
        onClick={() => fileInputRef.current.click()}
        disabled={uploadLoading}
      >
        {uploadLoading ? "⏳ Extracting text..." : "📁 Choose File"}
      </button>
      <div className={styles.uploadFormats}>
        Supported formats: JPG, PNG, PDF, DOC, DOCX
      </div>
      {uploadError && (
        <div className={styles.uploadError}>{uploadError}</div>
      )}
      {uploadedText && (
        <>
          <div className={styles.uploadSuccess}>
            <div className={styles.uploadSuccessIcon}>✅</div>
            <div style={{ flex: 1 }}>
              <div className={styles.uploadSuccessTitle}>Text extracted successfully!</div>
              <input
                className={styles.titleInput}
                value={uploadedTitle}
                onChange={(e) => setUploadedTitle(e.target.value)}
                placeholder="Enter passage title..."
              />
            </div>
          </div>
          <div className={styles.textPreview}>
            <div className={styles.textPreviewLabel}>Preview:</div>
            <div className={styles.textPreviewContent}>
              {uploadedText.substring(0, 400)}{uploadedText.length > 400 ? "..." : ""}
            </div>
          </div>
        </>
      )}
    </div>

    {/* Row 2 — Voice + Speed */}
    <div className={styles.uploadRow}>
      <div className={styles.card}>
        <h3 className={styles.cardTitle}>🎙️ Teacher Voice</h3>
        <div className={styles.voiceGrid}>
          <button
            className={`${styles.voiceCard} ${voice === "female" ? styles.voiceSelected : ""}`}
            onClick={() => setVoice("female")}
          >
            <div className={styles.voiceIcon}>👩</div>
            <div className={styles.voiceLabel}>Female</div>
            <div className={styles.voiceSub}>Warm & Clear</div>
          </button>
          <button
            className={`${styles.voiceCard} ${voice === "male" ? styles.voiceSelected : ""}`}
            onClick={() => setVoice("male")}
          >
            <div className={styles.voiceIcon}>👨</div>
            <div className={styles.voiceLabel}>Male</div>
            <div className={styles.voiceSub}>Deep & Clear</div>
          </button>
        </div>
      </div>

      <div className={styles.card}>
        <h3 className={styles.cardTitle}>⚡ Reading Speed</h3>
        <div className={styles.optionGrid}>
          {SPEEDS.map((s) => (
            <button
              key={s.value}
              className={`${styles.optionCard} ${speed === s.value ? styles.optionSelected : ""}`}
              onClick={() => setSpeed(s.value)}
            >
              <div className={styles.optionLabel}>{s.label}</div>
              <div className={styles.optionDesc}>{s.desc}</div>
            </button>
          ))}
        </div>
      </div>
    </div>

    {/* Row 3 — Repetitions + Pause */}
    <div className={styles.uploadRow}>
      <div className={styles.card}>
        <h3 className={styles.cardTitle}>🔁 Sentence Repetitions</h3>
        <p className={styles.cardDesc}>
          How many times each sentence is read before moving on
        </p>
        <div className={styles.repGrid}>
          {REPETITIONS.map((r) => (
            <button
              key={r}
              className={`${styles.repCard} ${repetitions === r ? styles.repSelected : ""}`}
              onClick={() => setRepetitions(r)}
            >
              <div className={styles.repNumber}>{r}×</div>
              <div className={styles.repDesc}>
                {r === 1 ? "Once" : r === 2 ? "Twice" : "Three times"}
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className={styles.card}>
        <h3 className={styles.cardTitle}>⏸️ Pause Between Sentences</h3>
        <p className={styles.cardDesc}>
          Time given to write after each sentence is read
        </p>
        <div className={styles.optionGrid}>
          {PAUSES.map((p) => (
            <button
              key={p.value}
              className={`${styles.optionCard} ${pause === p.value ? styles.optionSelected : ""}`}
              onClick={() => setPause(p.value)}
            >
              <div className={styles.optionLabel}>{p.label}</div>
              <div className={styles.optionDesc}>{p.desc}</div>
            </button>
          ))}
        </div>
      </div>
    </div>

    {/* Row 4 — Summary Full Width */}
    <div className={styles.summaryCard}>
      <h3 className={styles.summaryTitle}>Session Summary</h3>
      <div className={styles.uploadSummaryInner}>
        <div className={styles.summaryRows}>
          <div className={styles.summaryRow}>
            <span>Passage</span>
            <span>{uploadedText ? uploadedTitle || "Custom Passage" : "Not uploaded"}</span>
          </div>
          <div className={styles.summaryRow}>
            <span>Voice</span>
            <span>{voice === "female" ? "👩 Female" : "👨 Male"}</span>
          </div>
          <div className={styles.summaryRow}>
            <span>Speed</span>
            <span>{speed}x</span>
          </div>
          <div className={styles.summaryRow}>
            <span>Repetitions</span>
            <span>{repetitions}× per sentence</span>
          </div>
          <div className={styles.summaryRow}>
            <span>Pause</span>
            <span>{PAUSES.find((p) => p.value === pause)?.label}</span>
          </div>
        </div>
        <button
          className={styles.startBtn}
          onClick={handleStart}
          disabled={!canStart}
        >
          {canStart ? "Start Dictation →" : "Upload a passage first"}
        </button>
      </div>
    </div>

  </div>
)}

      </div>
    </div>
  );
}