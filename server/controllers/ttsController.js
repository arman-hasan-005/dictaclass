/**
 * ttsController.js
 *
 * 3-level TTS fallback chain (all handled server-side):
 *
 *   Priority 1 → ElevenLabs  (best quality, paid)
 *        ↓ limit / no key / error
 *   Priority 2 → Google Cloud TTS  (4M chars/month free Standard, 1M WaveNet)
 *        ↓ limit / no key / error
 *   Priority 3 → responds { errorCode: "USE_BROWSER" }
 *                so the client falls back to SpeechSynthesis (free, unlimited)
 *
 * Client calls POST /api/tts exactly once.
 * Success  → audio/mpeg binary  +  X-TTS-Provider: elevenlabs | google_tts
 * Failure  → 503 JSON { errorCode, message, fallbackToBrowser: true }
 */
const axios = require("axios");

// Error codes that mean "this provider is permanently done for now"
const PERMANENT = new Set(["NO_KEY", "INVALID_KEY", "QUOTA_EXCEEDED", "API_NOT_ENABLED"]);

// ─────────────────────────────────────────────────────────────
// PRIORITY 1 — ElevenLabs
// ─────────────────────────────────────────────────────────────
const classifyElevenLabsError = (error) => {
  if (!process.env.ELEVENLABS_API_KEY)
    return { code: "NO_KEY", message: "ElevenLabs key not configured" };
  if (!error.response)
    return { code: "NETWORK_ERROR", message: "Cannot reach ElevenLabs" };

  const status = error.response.status;
  let detail = {};
  try {
    detail = JSON.parse(Buffer.from(error.response.data).toString("utf8"))?.detail || {};
  } catch (_) {}
  const ds = typeof detail === "object" ? detail?.status : detail;

  if (status === 401 || ds === "invalid_api_key")
    return { code: "INVALID_KEY",    message: "ElevenLabs key invalid or expired" };
  if (status === 429)
    return { code: "QUOTA_EXCEEDED", message: "ElevenLabs rate limit hit" };
  if (status === 422 || ds === "quota_exceeded" || ds === "exceeded_character_limit")
    return { code: "QUOTA_EXCEEDED", message: "ElevenLabs character quota exhausted" };
  if (status === 403)
    return { code: "QUOTA_EXCEEDED", message: "ElevenLabs plan limit reached" };
  return { code: "SERVICE_ERROR",  message: `ElevenLabs HTTP ${status}` };
};

const tryElevenLabs = async (text, gender) => {
  if (!process.env.ELEVENLABS_API_KEY)
    throw { code: "NO_KEY", message: "ElevenLabs key not configured" };

  const voiceId =
    gender === "male"
      ? process.env.ELEVENLABS_VOICE_ID_MALE
      : process.env.ELEVENLABS_VOICE_ID_FEMALE;

  if (!voiceId)
    throw { code: "NO_KEY", message: "ElevenLabs voice ID not configured" };

  try {
    const res = await axios({
      method: "POST",
      url: `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      headers: {
        "xi-api-key": process.env.ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      data: {
        text,
        model_id: "eleven_flash_v2_5",
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0.3,
          use_speaker_boost: true,
        },
      },
      responseType: "arraybuffer",
      timeout: 15000,
    });
    return { audioBuffer: Buffer.from(res.data), provider: "elevenlabs" };
  } catch (err) {
    throw classifyElevenLabsError(err);
  }
};

// ─────────────────────────────────────────────────────────────
// PRIORITY 2 — Google Cloud Text-to-Speech
// Free tier: 4 million chars/month (Standard) | 1 million chars/month (WaveNet)
// Get key: console.cloud.google.com → Enable "Cloud Text-to-Speech API" → Credentials → API Key
// ─────────────────────────────────────────────────────────────

// WaveNet voices sound much more natural than Standard.
// 1M WaveNet chars/month free ≈ ~800,000 words ≈ thousands of dictation sentences.
// Switch to en-US-Standard-F / en-US-Standard-D for 4M free chars if needed.
const GOOGLE_TTS_VOICES = {
  female: { languageCode: "en-US", name: "en-US-Wavenet-F", ssmlGender: "FEMALE" },
  male:   { languageCode: "en-US", name: "en-US-Wavenet-D", ssmlGender: "MALE"   },
};

const classifyGoogleTTSError = (error) => {
  if (!process.env.GOOGLE_TTS_API_KEY)
    return { code: "NO_KEY", message: "Google TTS key not configured" };
  if (!error.response)
    return { code: "NETWORK_ERROR", message: "Cannot reach Google TTS" };

  const status = error.response.status;
  const errData = error.response.data?.error || {};
  const msg = (errData.message || "").toLowerCase();
  const st  = (errData.status  || "").toLowerCase();

  if (status === 400 && (msg.includes("api key not valid") || msg.includes("invalid")))
    return { code: "INVALID_KEY",     message: "Google TTS key invalid" };
  if (status === 401)
    return { code: "INVALID_KEY",     message: "Google TTS key unauthorised" };
  if (status === 403 && (st === "permission_denied" || msg.includes("not enabled")))
    return { code: "API_NOT_ENABLED", message: "Cloud Text-to-Speech API not enabled in Google Cloud project" };
  if (status === 429 || st === "resource_exhausted")
    return { code: "QUOTA_EXCEEDED",  message: "Google TTS quota exceeded" };
  return { code: "SERVICE_ERROR", message: `Google TTS HTTP ${status}` };
};

const tryGoogleTTS = async (text, gender) => {
  if (!process.env.GOOGLE_TTS_API_KEY)
    throw { code: "NO_KEY", message: "Google TTS key not configured" };

  try {
    const res = await axios.post(
      `https://texttospeech.googleapis.com/v1/text:synthesize?key=${process.env.GOOGLE_TTS_API_KEY}`,
      {
        input: { text },
        voice: GOOGLE_TTS_VOICES[gender] || GOOGLE_TTS_VOICES.female,
        audioConfig: {
          audioEncoding: "MP3",
          speakingRate: 1.0,
          pitch: 0.0,
        },
      },
      { timeout: 15000 }
    );

    const audioBase64 = res.data?.audioContent;
    if (!audioBase64)
      throw { code: "SERVICE_ERROR", message: "Google TTS returned empty audio" };

    return { audioBuffer: Buffer.from(audioBase64, "base64"), provider: "google_tts" };
  } catch (err) {
    if (err.code) throw err; // already classified
    throw classifyGoogleTTSError(err);
  }
};

// ─────────────────────────────────────────────────────────────
// POST /api/tts — main handler
// ─────────────────────────────────────────────────────────────
const generateSpeech = async (req, res) => {
  const { text, gender = "female" } = req.body;
  if (!text || !text.trim())
    return res.status(400).json({ message: "text is required" });

  // ── Priority 1: ElevenLabs ──────────────────────────────────
  try {
    const { audioBuffer, provider } = await tryElevenLabs(text, gender);
    console.log(`[TTS] ✅ ElevenLabs  (${text.length} chars)`);
    res.set({ "Content-Type": "audio/mpeg", "Content-Length": audioBuffer.length, "X-TTS-Provider": provider });
    return res.send(audioBuffer);
  } catch (elErr) {
    console.warn(`[TTS] ⚠️  ElevenLabs → ${elErr.code}: ${elErr.message}`);
    if (!PERMANENT.has(elErr.code)) {
      // Transient error — skip Google TTS too, tell client to use browser just for this sentence
      return res.status(503).json({ errorCode: elErr.code, message: elErr.message, fallbackToBrowser: true });
    }
    // Permanent failure — fall through to Google TTS
  }

  // ── Priority 2: Google Cloud TTS ───────────────────────────
  try {
    const { audioBuffer, provider } = await tryGoogleTTS(text, gender);
    console.log(`[TTS] ✅ Google TTS  (${text.length} chars)`);
    res.set({ "Content-Type": "audio/mpeg", "Content-Length": audioBuffer.length, "X-TTS-Provider": provider });
    return res.send(audioBuffer);
  } catch (gErr) {
    console.warn(`[TTS] ⚠️  Google TTS → ${gErr.code}: ${gErr.message}`);
    // Fall through to browser fallback
  }

  // ── Priority 3: tell client to use browser SpeechSynthesis ─
  console.info("[TTS] 🔊 All backend providers unavailable — client will use browser TTS");
  return res.status(503).json({
    errorCode: "USE_BROWSER",
    message: "All TTS providers unavailable — using browser voice",
    fallbackToBrowser: true,
  });
};

module.exports = { generateSpeech };
