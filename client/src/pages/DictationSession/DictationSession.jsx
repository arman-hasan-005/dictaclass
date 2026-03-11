
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Navbar from "../../components/Navbar/Navbar";
import styles from "./DictationSession.module.css";
import NotebookUpload from "../../components/NotebookUpload/NotebookUpload";

// Split passage into sentences
const splitSentences = (text) => {
  return (
    text
      .match(/[^.!?]+[.!?]+/g)
      ?.map((s) => s.trim())
      .filter((s) => s.length > 2) || [text]
  );
};

const PHASES = {
  IDLE: "idle",
  ANNOUNCING: "announcing",
  READING: "reading",
  PAUSING: "pausing",
  REPEATING: "repeating",
  WAITING: "waiting",
  FINISHED: "finished",
};

export default function DictationSession() {
  const location = useLocation();
  const navigate = useNavigate();
  const { passage, speed, repetitions, pause, voice, inputMode } =
    location.state || {};

  const sentences = useMemo(
    () => (passage?.content ? splitSentences(passage.content) : []),
    [passage?.content]
  );

  const [phase, setPhase] = useState(PHASES.IDLE);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentRep, setCurrentRep] = useState(1);
  const [answers, setAnswers] = useState(Array(sentences.length).fill(""));
  const [pauseCountdown, setPauseCountdown] = useState(0);
  const [started, setStarted] = useState(false);
  const [statusText, setStatusText] = useState("Ready to begin");
  const [isPaused, setIsPaused] = useState(false);

  const inputRefs = useRef([]);
  const countdownRef = useRef(null);
  const isCancelledRef = useRef(false);
  const isPausedRef = useRef(false);

  // Redirect if no passage
  useEffect(() => {
    if (!passage) navigate("/setup");
  }, []); // eslint-disable-line

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isCancelledRef.current = true;
      clearInterval(countdownRef.current);
      window.speechSynthesis.cancel();
    };
  }, []);

  // ── Get preferred voice ──────────────────────────────
  const getVoice = () => {
    const voices = window.speechSynthesis.getVoices();
    return (
      voices.find((v) =>
        voice === "female"
          ? v.name.includes("Zira") ||
            v.name.includes("Samantha") ||
            v.name.includes("Susan") ||
            v.name.toLowerCase().includes("female")
          : v.name.includes("David") ||
            v.name.includes("Mark") ||
            v.name.includes("Daniel") ||
            v.name.toLowerCase().includes("male")
      ) || null
    );
  };

  // ── Speak using browser SpeechSynthesis ─────────────
  const speakText = useCallback(
    (text, rate) => {
      return new Promise((resolve) => {
        if (isCancelledRef.current) return resolve();
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = rate || speed || 1.0;
        utterance.pitch = 1;
        utterance.volume = 1;

        const doSpeak = () => {
          const preferred = getVoice();
          if (preferred) utterance.voice = preferred;

          // Pause checker
          const pauseChecker = setInterval(() => {
            if (isCancelledRef.current) {
              window.speechSynthesis.cancel();
              clearInterval(pauseChecker);
              resolve();
            } else if (isPausedRef.current) {
              window.speechSynthesis.pause();
            } else {
              window.speechSynthesis.resume();
            }
          }, 200);

          utterance.onend = () => {
            clearInterval(pauseChecker);
            resolve();
          };
          utterance.onerror = () => {
            clearInterval(pauseChecker);
            resolve();
          };

          window.speechSynthesis.speak(utterance);
        };

        if (window.speechSynthesis.getVoices().length > 0) {
          doSpeak();
        } else {
          window.speechSynthesis.onvoiceschanged = doSpeak;
        }
      });
    },
    [speed, voice] // eslint-disable-line
  );

  // ── Countdown pause ──────────────────────────────────
  const doPause = useCallback((ms) => {
    return new Promise((resolve) => {
      if (isCancelledRef.current) return resolve();
      const seconds = Math.ceil(ms / 1000);
      setPauseCountdown(seconds);
      let remaining = seconds;
      countdownRef.current = setInterval(() => {
        if (isPausedRef.current) return;
        remaining -= 1;
        setPauseCountdown(remaining);
        if (remaining <= 0) {
          clearInterval(countdownRef.current);
          resolve();
        }
      }, 1000);
    });
  }, []);

  // ── Main session flow ────────────────────────────────
  const runSession = useCallback(async () => {
    isCancelledRef.current = false;

    // ── 1. Announcement ──
    setPhase(PHASES.ANNOUNCING);
    setStatusText("📢 Listening to announcement...");

    const announcementText =
      passage.source === "upload"
        ? `Attention class. Today's dictation is titled: ${passage.title}. We will begin now. Please get ready.`
        : `Attention class. Today's dictation is titled: ${passage.title}. Level: ${passage.level}. We will begin now. Please get ready.`;

    await speakText(announcementText, 0.9);

    if (isCancelledRef.current) return;
    await doPause(2000);

    // ── 2. Read each sentence ──
    for (let i = 0; i < sentences.length; i++) {
      if (isCancelledRef.current) return;

      setCurrentIndex(i);
      setTimeout(() => inputRefs.current[i]?.focus(), 100);

      for (let rep = 1; rep <= repetitions; rep++) {
        if (isCancelledRef.current) return;

        setCurrentRep(rep);
        setPhase(rep === 1 ? PHASES.READING : PHASES.REPEATING);
        setStatusText(
          rep === 1
            ? `📢 Sentence ${i + 1} of ${sentences.length}`
            : `🔁 Repeating sentence ${i + 1}...`
        );

        await speakText(sentences[i]);
        if (isCancelledRef.current) return;

        if (rep < repetitions) {
          setPhase(PHASES.PAUSING);
          setStatusText("✏️ Write what you heard...");
          await doPause(2000);
        }
      }

      if (isCancelledRef.current) return;
      setPhase(PHASES.WAITING);
      setStatusText("✏️ Write the sentence now...");
      await doPause(pause);
    }

    // ── 3. End announcement ──
    setPhase(PHASES.ANNOUNCING);
    setStatusText("🔔 Dictation complete!");

    await speakText(
      "That is the end of the dictation. Please check your work.",
      0.9
    );

    setPhase(PHASES.FINISHED);
    setStatusText("✅ Dictation finished! Review and submit.");
  }, [sentences, passage, repetitions, pause, speakText, doPause]);

  const handleStart = () => {
    setStarted(true);
    runSession();
  };

  const handlePauseResume = () => {
    isPausedRef.current = !isPausedRef.current;
    setIsPaused(isPausedRef.current);
    if (isPausedRef.current) {
      window.speechSynthesis.pause();
    } else {
      window.speechSynthesis.resume();
    }
  };

  const handleStop = () => {
    isCancelledRef.current = true;
    clearInterval(countdownRef.current);
    window.speechSynthesis.cancel();
    setPhase(PHASES.FINISHED);
    setStatusText("✅ Session stopped. Review and submit.");
    setStarted(true);
  };

  const handleSubmit = () => {
    navigate("/results", {
      state: { passage, sentences, answers },
    });
  };

  const handleAnswerChange = (index, value) => {
    const updated = [...answers];
    updated[index] = value;
    setAnswers(updated);
  };

  // ── Phase UI helpers ─────────────────────────────────
  const getPhaseColor = () => {
    switch (phase) {
      case PHASES.ANNOUNCING: return "#7C3AED";
      case PHASES.READING: return "#059669";
      case PHASES.REPEATING: return "#D97706";
      case PHASES.WAITING:
      case PHASES.PAUSING: return "#2563EB";
      case PHASES.FINISHED: return "#059669";
      default: return "var(--primary)";
    }
  };

  const getPhaseIcon = () => {
    switch (phase) {
      case PHASES.ANNOUNCING: return "📢";
      case PHASES.READING: return "🎙️";
      case PHASES.REPEATING: return "🔁";
      case PHASES.WAITING: return "✏️";
      case PHASES.PAUSING: return "⏳";
      case PHASES.FINISHED: return "✅";
      default: return "🎓";
    }
  };

  if (!passage) return null;

  return (
    <div className={styles.page}>
      <Navbar />

      <div className={styles.content}>

        {/* ── Top Status Bar ── */}
        <div
          className={styles.statusBar}
          style={{ borderColor: getPhaseColor() }}
        >
          <div className={styles.statusLeft}>
            <div className={styles.statusIcon}>{getPhaseIcon()}</div>
            <div>
              <div className={styles.statusText}>{statusText}</div>
              <div className={styles.statusMeta}>
                {passage.title} &nbsp;·&nbsp;
                {passage.level?.charAt(0).toUpperCase() +
                  passage.level?.slice(1)}{" "}
                &nbsp;·&nbsp;
                {voice === "female" ? "👩 Female" : "👨 Male"} &nbsp;·&nbsp;
                {speed}x speed
              </div>
            </div>
          </div>

          <div className={styles.statusRight}>
            {/* Countdown */}
            {(phase === PHASES.WAITING || phase === PHASES.PAUSING) &&
              pauseCountdown > 0 && (
                <div
                  className={styles.countdown}
                  style={{ borderColor: getPhaseColor() }}
                >
                  <span className={styles.countdownNum}>{pauseCountdown}</span>
                  <span className={styles.countdownLabel}>sec</span>
                </div>
              )}

            {/* Progress */}
            {started && phase !== PHASES.FINISHED && (
              <div className={styles.progress}>
                <div className={styles.progressLabel}>
                  {currentIndex + 1} / {sentences.length}
                </div>
                <div className={styles.progressBar}>
                  <div
                    className={styles.progressFill}
                    style={{
                      width: `${
                        ((currentIndex + 1) / sentences.length) * 100
                      }%`,
                      background: getPhaseColor(),
                    }}
                  />
                </div>
                {repetitions > 1 && (
                  <div className={styles.repBadge}>
                    Rep {currentRep}/{repetitions}
                  </div>
                )}
              </div>
            )}

            {/* Controls */}
            <div>
              {!started ? (
                <button className={styles.startBtn} onClick={handleStart}>
                  🎙️ Start Dictation
                </button>
              ) : phase !== PHASES.FINISHED ? (
                <div className={styles.sessionControls}>
                  <button
                    className={isPaused ? styles.resumeBtn : styles.pauseBtn}
                    onClick={handlePauseResume}
                  >
                    {isPaused ? "▶ Resume" : "⏸ Pause"}
                  </button>
                  <button className={styles.stopBtn} onClick={handleStop}>
                    ⏹ End
                  </button>
                </div>
              ) : (
                <button className={styles.submitBtn} onClick={handleSubmit}>
                  Submit & See Results →
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── Sentences + Inputs ── */}
        {inputMode === "handwrite" ? (

          /* ── HANDWRITE MODE ── */
          <div className={styles.handwriteArea}>
            {phase !== PHASES.FINISHED ? (
              <div className={styles.handwriteListening}>
                <div className={styles.handwriteIcon}>📓</div>
                <h2 className={styles.handwriteTitle}>Write on your notebook</h2>
                <p className={styles.handwriteSub}>
                  Listen carefully and write each sentence on paper as you hear
                  it. When the dictation ends, you will upload a photo of your
                  work.
                </p>
                {started && phase !== PHASES.IDLE && (
                  <div className={styles.handwriteProgress}>
                    <div className={styles.handwriteSentenceNum}>
                      Sentence {currentIndex + 1} of {sentences.length}
                    </div>
                    <div className={styles.handwriteProgressBar}>
                      <div
                        className={styles.handwriteProgressFill}
                        style={{
                          width: `${
                            ((currentIndex + 1) / sentences.length) * 100
                          }%`,
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <NotebookUpload
                sentences={sentences}
                passage={passage}
                onSubmit={(fullText) => {
                  navigate("/results", {
                    state: {
                      passage,
                      sentences,
                      answers: null,
                      handwrittenText: fullText,
                      isHandwrite: true,
                    },
                  });
                }}
              />
            )}
          </div>

        ) : (

          /* ── TYPE MODE ── */
          <div className={styles.sentenceList}>
            {sentences.map((sentence, i) => {
              const isActive =
                started &&
                currentIndex === i &&
                phase !== PHASES.FINISHED;
              const isPast =
                started &&
                (i < currentIndex || phase === PHASES.FINISHED);
              const isFuture = !started || i > currentIndex;

              return (
                <div
                  key={i}
                  className={`${styles.sentenceBlock}
                    ${isActive ? styles.sentenceActive : ""}
                    ${isPast ? styles.sentencePast : ""}
                    ${isFuture && started ? styles.sentenceFuture : ""}
                  `}
                >
                  <div
                    className={styles.sentenceNum}
                    style={
                      isActive
                        ? { background: getPhaseColor(), color: "white" }
                        : {}
                    }
                  >
                    {i + 1}
                  </div>
                  <div className={styles.sentenceContent}>
                    <textarea
                      ref={(el) => (inputRefs.current[i] = el)}
                      className={styles.answerInput}
                      placeholder={
                        !started
                          ? "Start dictation to begin typing..."
                          : isActive
                          ? "Type what you hear..."
                          : isPast
                          ? "You can still edit this answer"
                          : "Waiting..."
                      }
                      value={answers[i]}
                      onChange={(e) => handleAnswerChange(i, e.target.value)}
                      disabled={!started}
                      rows={2}
                    />
                  </div>
                  <div className={styles.sentenceStatus}>
                    {isActive && (
                      <div
                        className={styles.activeDot}
                        style={{ background: getPhaseColor() }}
                      />
                    )}
                    {isPast && answers[i] && (
                      <div className={styles.doneIcon}>✓</div>
                    )}
                    {isPast && !answers[i] && (
                      <div className={styles.skippedIcon}>—</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

        )}

        {/* ── Submit Footer ── */}
        {phase === PHASES.FINISHED && inputMode !== "handwrite" && (
          <div className={styles.footer}>
            <div className={styles.footerText}>
              🎉 Dictation complete! You answered{" "}
              <strong>{answers.filter((a) => a.trim()).length}</strong> of{" "}
              <strong>{sentences.length}</strong> sentences.
            </div>
            <button
              className={styles.submitBtnLarge}
              onClick={handleSubmit}
            >
              Submit & See Results →
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
