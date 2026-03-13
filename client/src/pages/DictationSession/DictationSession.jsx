import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Navbar from "../../components/Navbar/Navbar";
import NotebookUpload from "../../components/NotebookUpload/NotebookUpload";
import { useDictation, PHASES } from "../../hooks/useDictation";
import styles from "./DictationSession.module.css";

export default function DictationSession() {
  const location = useLocation();
  const navigate = useNavigate();
  const { passage, speed, repetitions, pause, voice, inputMode } =
    location.state || {};

  const {
    sentences,
    phase,
    currentIndex,
    currentRep,
    answers,
    pauseCountdown,
    started,
    statusText,
    isPaused,
    inputRefs,
    ttsProvider,
    ttsWarning,
    handleStart,
    handlePauseResume,
    handleStop,
    handleAnswerChange,
    cleanup,
  } = useDictation({ passage, speed, repetitions, pause, voice });

  // Redirect if no passage was passed
  useEffect(() => {
    if (!passage) navigate("/setup", { replace: true });
  }, []); // eslint-disable-line

  // Cleanup speech synthesis and timers on unmount
  useEffect(() => () => cleanup(), []); // eslint-disable-line

  const handleSubmit = () => {
    navigate("/results", { state: { passage, sentences, answers } });
  };

  // ── Phase visual helpers ───────────────────────────────────
  const getPhaseColor = () => {
    switch (phase) {
      case PHASES.ANNOUNCING:
        return "#7C3AED";
      case PHASES.READING:
        return "#059669";
      case PHASES.REPEATING:
        return "#D97706";
      case PHASES.WAITING:
      case PHASES.PAUSING:
        return "#2563EB";
      case PHASES.FINISHED:
        return "#059669";
      default:
        return "var(--primary)";
    }
  };

  const getPhaseIcon = () => {
    switch (phase) {
      case PHASES.ANNOUNCING:
        return "📢";
      case PHASES.READING:
        return "🎙️";
      case PHASES.REPEATING:
        return "🔁";
      case PHASES.WAITING:
        return "✏️";
      case PHASES.PAUSING:
        return "⏳";
      case PHASES.FINISHED:
        return "✅";
      default:
        return "🎓";
    }
  };

  if (!passage) return null;

  return (
    <div className={styles.page}>
      <Navbar />
      <div className={styles.content}>
        {/* ── TTS Provider Banner ── */}
        {ttsWarning && (
          <div
            style={{
              background: ttsProvider === "browser" ? "#FEF3C7" : "#EFF6FF",
              border: `1px solid ${ttsProvider === "browser" ? "#FDE68A" : "#BFDBFE"}`,
              borderRadius: 8,
              padding: "10px 16px",
              marginBottom: 12,
              fontSize: 14,
              color: ttsProvider === "browser" ? "#92400E" : "#1E40AF",
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <span style={{ flex: 1 }}>{ttsWarning}</span>
          </div>
        )}

        {/* TTS provider indicator (subtle pill, always visible when session running) */}
        {started && (
          <div style={{ textAlign: "right", fontSize: 12, marginBottom: 6 }}>
            <span
              style={{
                padding: "2px 10px",
                borderRadius: 12,
                background:
                  ttsProvider === "elevenlabs"
                    ? "#ECFDF5"
                    : ttsProvider === "google_tts"
                      ? "#EFF6FF"
                      : "#FEF3C7",
                color:
                  ttsProvider === "elevenlabs"
                    ? "#065F46"
                    : ttsProvider === "google_tts"
                      ? "#1E40AF"
                      : "#92400E",
                border: "1px solid",
                borderColor:
                  ttsProvider === "elevenlabs"
                    ? "#A7F3D0"
                    : ttsProvider === "google_tts"
                      ? "#BFDBFE"
                      : "#FDE68A",
              }}
            >
              {ttsProvider === "elevenlabs"
                ? "🎙️ ElevenLabs"
                : ttsProvider === "google_tts"
                  ? "🔵 Google TTS"
                  : "🔊 Browser Voice"}
            </span>
          </div>
        )}

        {/* ── Status Bar ── */}
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
                  passage.level?.slice(1)}
                &nbsp;·&nbsp;
                {voice === "female" ? "👩 Female" : "👨 Male"}
                &nbsp;·&nbsp;
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
                      width: `${((currentIndex + 1) / sentences.length) * 100}%`,
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

        {/* ── Handwrite Mode ── */}
        {inputMode === "handwrite" ? (
          <div className={styles.handwriteArea}>
            {phase !== PHASES.FINISHED ? (
              <div className={styles.handwriteListening}>
                <div className={styles.handwriteIcon}>📓</div>
                <h2 className={styles.handwriteTitle}>
                  Write on your notebook
                </h2>
                <p className={styles.handwriteSub}>
                  Listen carefully and write each sentence on paper. When the
                  dictation ends, you will upload a photo of your work.
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
                          width: `${((currentIndex + 1) / sentences.length) * 100}%`,
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
                onSubmit={(fullText) =>
                  navigate("/results", {
                    state: {
                      passage,
                      sentences,
                      answers: null,
                      handwrittenText: fullText,
                      isHandwrite: true,
                    },
                  })
                }
              />
            )}
          </div>
        ) : (
          /* ── Type Mode ── */
          <div className={styles.sentenceList}>
            {sentences.map((sentence, i) => {
              const isActive =
                started && currentIndex === i && phase !== PHASES.FINISHED;
              const isPast =
                started && (i < currentIndex || phase === PHASES.FINISHED);
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
                          ? "Start dictation to begin typing…"
                          : isActive
                            ? "Type what you hear…"
                            : isPast
                              ? "You can still edit this answer"
                              : "Waiting…"
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
            <button className={styles.submitBtnLarge} onClick={handleSubmit}>
              Submit & See Results →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
