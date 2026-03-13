/**
 * useDictation.js  —  Session orchestration hook with 3-level TTS awareness
 *
 * TTS priority chain (server-side):
 *   Priority 1 → ElevenLabs  (best quality, paid)
 *        ↓ limit / no key
 *   Priority 2 → Google TTS  (1M WaveNet chars/month free)
 *        ↓ limit / no key
 *   Priority 3 → Browser SpeechSynthesis (unlimited, no key needed)
 *
 * Client calls POST /api/tts once per sentence:
 *   • Gets audio/mpeg   → play it; X-TTS-Provider header tells which tier was used
 *   • Gets 503 JSON
 *       errorCode "USE_BROWSER" → both backend tiers down, switch permanently
 *       anything else           → fall back to browser for this sentence only
 *
 * State exposed to UI:
 *   ttsProvider  "elevenlabs" | "google_tts" | "browser"
 *   ttsWarning   string — shown as a yellow/blue banner when provider degrades
 *
 * BUGS FIXED vs previous version:
 *   • ttsWarning was in useCallback deps → caused stale closure cascade
 *     (speakBackend → speak → runSession all re-created on every warning change)
 *     Fix: replaced with warningShownRef so deps stay [speed, voice]
 */
import { useState, useRef, useCallback, useMemo } from "react";

export const PHASES = {
  IDLE:       "idle",
  ANNOUNCING: "announcing",
  READING:    "reading",
  PAUSING:    "pausing",
  REPEATING:  "repeating",
  WAITING:    "waiting",
  FINISHED:   "finished",
};

// ── Helpers ────────────────────────────────────────────────────
const splitSentences = (text) =>
  text.match(/[^.!?]+[.!?]+/g)
    ?.map((s) => s.trim())
    .filter((s) => s.length > 2) || [text];

const findBrowserVoice = (gender) => {
  const voices = window.speechSynthesis.getVoices();
  return (
    voices.find((v) =>
      gender === "female"
        ? v.name.includes("Zira")     || v.name.includes("Samantha") ||
          v.name.includes("Susan")    || v.name.toLowerCase().includes("female")
        : v.name.includes("David")   || v.name.includes("Mark") ||
          v.name.includes("Daniel")  || v.name.toLowerCase().includes("male")
    ) || null
  );
};

const PROVIDER_LABELS = {
  elevenlabs: "🎙️ ElevenLabs",
  google_tts: "🔵 Google TTS",
  browser:    "🔊 Browser Voice",
};

// ── Hook ───────────────────────────────────────────────────────
export function useDictation({ passage, speed, repetitions, pause, voice }) {
  const sentences = useMemo(
    () => (passage?.content ? splitSentences(passage.content) : []),
    [passage?.content]
  );

  const [phase,          setPhase]          = useState(PHASES.IDLE);
  const [currentIndex,   setCurrentIndex]   = useState(0);
  const [currentRep,     setCurrentRep]     = useState(1);
  const [answers,        setAnswers]        = useState(() => Array(sentences.length).fill(""));
  const [pauseCountdown, setPauseCountdown] = useState(0);
  const [started,        setStarted]        = useState(false);
  const [statusText,     setStatusText]     = useState("Ready to begin");
  const [isPaused,       setIsPaused]       = useState(false);
  const [ttsProvider,    setTtsProvider]    = useState("elevenlabs");
  const [ttsWarning,     setTtsWarning]     = useState("");

  const inputRefs      = useRef([]);
  const countdownRef   = useRef(null);
  const isCancelledRef = useRef(false);
  const isPausedRef    = useRef(false);

  // useBrowserRef: set true permanently when server confirms both backend tiers are down
  const useBrowserRef   = useRef(false);
  // warningShownRef: prevents showing the Google TTS downgrade banner more than once
  // Using a ref instead of checking ttsWarning state avoids stale closure in useCallback
  const warningShownRef = useRef(false);

  // ── Priority 3: Browser SpeechSynthesis ──────────────────────
  // Always available, no key needed, unlimited.
  const speakBrowser = useCallback(
    (text, rate) =>
      new Promise((resolve) => {
        if (isCancelledRef.current) return resolve();
        window.speechSynthesis.cancel();

        const utterance  = new SpeechSynthesisUtterance(text);
        utterance.rate   = rate || speed || 1.0;
        utterance.pitch  = 1;
        utterance.volume = 1;

        const doSpeak = () => {
          const preferred = findBrowserVoice(voice);
          if (preferred) utterance.voice = preferred;

          const checker = setInterval(() => {
            if (isCancelledRef.current) {
              window.speechSynthesis.cancel();
              clearInterval(checker);
              resolve();
            } else if (isPausedRef.current) {
              window.speechSynthesis.pause();
            } else {
              window.speechSynthesis.resume();
            }
          }, 200);

          utterance.onend   = () => { clearInterval(checker); resolve(); };
          utterance.onerror = () => { clearInterval(checker); resolve(); };
          window.speechSynthesis.speak(utterance);
        };

        if (window.speechSynthesis.getVoices().length > 0) doSpeak();
        else window.speechSynthesis.onvoiceschanged = doSpeak;
      }),
    [speed, voice]
  );

  // ── Priority 1+2: Backend TTS (ElevenLabs → Google TTS) ──────
  // The server tries ElevenLabs first. If it fails permanently (no key / quota),
  // it automatically falls through to Google TTS before responding.
  // We just call /api/tts and read the X-TTS-Provider header to know which was used.
  const speakBackend = useCallback(
    async (text, rate) => {
      const user   = JSON.parse(localStorage.getItem("dictaclass_user") || "null");
      const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

      const response = await fetch(`${apiUrl}/tts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user?.token || ""}`,
        },
        body: JSON.stringify({ text, gender: voice }),
      });

      const contentType = response.headers.get("content-type") || "";

      // ── Success path: server returned audio ──────────────────
      if (response.ok && contentType.includes("audio")) {
        const provider = response.headers.get("x-tts-provider") || "elevenlabs";
        setTtsProvider(provider);

        // Show a one-time banner if server silently downgraded from ElevenLabs
        // Using warningShownRef (not ttsWarning state) to avoid stale closure
        if (provider !== "elevenlabs" && !warningShownRef.current) {
          warningShownRef.current = true;
          setTtsWarning(`ℹ️ ${PROVIDER_LABELS[provider]} active (ElevenLabs unavailable)`);
        }

        // Consume the response body as a blob (safe — we are in the audio branch)
        const blobUrl = URL.createObjectURL(await response.blob());
        const audio   = new Audio(blobUrl);
        audio.playbackRate = rate || speed || 1.0;

        return new Promise((resolve) => {
          const checker = setInterval(() => {
            if (isCancelledRef.current) {
              audio.pause();
              clearInterval(checker);
              URL.revokeObjectURL(blobUrl);
              resolve();
            } else if (isPausedRef.current) {
              audio.pause();
            } else if (audio.paused && !audio.ended) {
              audio.play();
            }
          }, 200);

          audio.onended = () => { clearInterval(checker); URL.revokeObjectURL(blobUrl); resolve(); };
          audio.onerror = () => { clearInterval(checker); URL.revokeObjectURL(blobUrl); resolve(); };
          // audio.play() rejects when browser blocks autoplay — resolve silently so
          // speak() can fall back to browser SpeechSynthesis
          audio.play().catch(() => {
            clearInterval(checker);
            URL.revokeObjectURL(blobUrl);
            resolve();
          });
        });
      }

      // ── Error path: server returned JSON ─────────────────────
      // Safe to call response.json() here because response.blob() was NOT called
      // above — the two branches are mutually exclusive
      const data      = await response.json().catch(() => ({}));
      const errorCode = data.errorCode || "SERVICE_ERROR";
      const err       = new Error(data.message || "TTS backend error");
      err.errorCode         = errorCode;
      err.fallbackToBrowser = data.fallbackToBrowser || false;
      throw err;
    },
    [speed, voice]  // warningShownRef is a ref — not needed in deps
  );

  // ── Smart dispatcher — called for every sentence ──────────────
  const speak = useCallback(
    async (text, rate) => {
      if (isCancelledRef.current) return;

      // Already permanently switched to browser this session
      if (useBrowserRef.current) {
        return speakBrowser(text, rate);
      }

      try {
        await speakBackend(text, rate);
      } catch (err) {
        const code = err.errorCode || "SERVICE_ERROR";
        console.warn(`[TTS] Backend failed (${code}): ${err.message}`);

        if (code === "USE_BROWSER") {
          // Server confirmed both ElevenLabs AND Google TTS are down
          // Switch permanently to browser for the rest of this session
          useBrowserRef.current = true;
          setTtsProvider("browser");
          setTtsWarning("⚠️ ElevenLabs & Google TTS unavailable — using browser voice");
        }

        // Fall back to browser for this sentence (permanent or temporary error)
        return speakBrowser(text, rate);
      }
    },
    [speakBackend, speakBrowser]
  );

  // ── Countdown timer ───────────────────────────────────────────
  const doPause = useCallback((ms) => {
    return new Promise((resolve) => {
      if (isCancelledRef.current) return resolve();
      const totalSeconds = Math.ceil(ms / 1000);
      setPauseCountdown(totalSeconds);
      let remaining = totalSeconds;
      countdownRef.current = setInterval(() => {
        if (isPausedRef.current) return;
        remaining -= 1;
        setPauseCountdown(remaining);
        if (remaining <= 0) { clearInterval(countdownRef.current); resolve(); }
      }, 1000);
    });
  }, []);

  // ── Main session loop ─────────────────────────────────────────
  const runSession = useCallback(async () => {
    // Full reset at the start of every session
    isCancelledRef.current  = false;
    useBrowserRef.current   = false;
    warningShownRef.current = false;
    setTtsProvider("elevenlabs");
    setTtsWarning("");

    // 1. Opening announcement
    setPhase(PHASES.ANNOUNCING);
    setStatusText("📢 Listening to announcement…");
    const announcement =
      passage.source === "upload"
        ? `Attention class. Today's dictation is titled: ${passage.title}. We will begin now.`
        : `Attention class. Today's dictation is titled: ${passage.title}. Level: ${passage.level}. Please get ready.`;
    await speak(announcement, 0.9);
    if (isCancelledRef.current) return;
    await doPause(2000);

    // 2. Sentences with repetitions
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
            : `🔁 Repeating sentence ${i + 1}…`
        );
        await speak(sentences[i]);
        if (isCancelledRef.current) return;
        if (rep < repetitions) {
          setPhase(PHASES.PAUSING);
          setStatusText("✏️ Write what you heard…");
          await doPause(2000);
        }
      }

      if (isCancelledRef.current) return;
      setPhase(PHASES.WAITING);
      setStatusText("✏️ Write the sentence now…");
      await doPause(pause);
    }

    // 3. Closing
    setPhase(PHASES.ANNOUNCING);
    setStatusText("🔔 Dictation complete!");
    await speak("That is the end of the dictation. Please check your work.", 0.9);
    setPhase(PHASES.FINISHED);
    setStatusText("✅ Dictation finished! Review and submit.");
  }, [sentences, passage, repetitions, pause, speak, doPause]);

  // ── Controls ──────────────────────────────────────────────────
  const handleStart = useCallback(() => {
    setStarted(true);
    runSession();
  }, [runSession]);

  const handlePauseResume = useCallback(() => {
    isPausedRef.current = !isPausedRef.current;
    setIsPaused(isPausedRef.current);
    if (isPausedRef.current) window.speechSynthesis.pause();
    else window.speechSynthesis.resume();
  }, []);

  const handleStop = useCallback(() => {
    isCancelledRef.current = true;
    clearInterval(countdownRef.current);
    window.speechSynthesis.cancel();
    setPhase(PHASES.FINISHED);
    setStatusText("✅ Session stopped. Review and submit.");
    setStarted(true);
  }, []);

  const handleAnswerChange = useCallback((index, value) => {
    setAnswers((prev) => {
      const updated = [...prev];
      updated[index] = value;
      return updated;
    });
  }, []);

  const cleanup = useCallback(() => {
    isCancelledRef.current = true;
    clearInterval(countdownRef.current);
    window.speechSynthesis.cancel();
  }, []);

  return {
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
    ttsProvider,       // "elevenlabs" | "google_tts" | "browser"
    ttsWarning,        // string — shown as banner in DictationSession
    handleStart,
    handlePauseResume,
    handleStop,
    handleAnswerChange,
    cleanup,
  };
}
