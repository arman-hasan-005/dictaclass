const axios = require("axios");

// ── Error code classifier ─────────────────────────────────────
const classifyVisionError = (error) => {
  if (!process.env.GOOGLE_VISION_API_KEY) {
    return { code: "NO_KEY", message: "Google Vision API key not configured" };
  }
  if (!error.response) {
    return { code: "NETWORK_ERROR", message: "Could not reach Google Vision API" };
  }
  const status = error.response.status;
  const errData = error.response.data?.error || {};
  const errMsg = (errData.message || "").toLowerCase();
  const errStatus = (errData.status || "").toLowerCase();

  if (status === 400 && (errMsg.includes("api key not valid") || errMsg.includes("invalid")))
    return { code: "INVALID_KEY", message: "Google Vision API key is invalid or expired" };
  if (status === 403 && (errStatus === "permission_denied" || errMsg.includes("api not enabled")))
    return { code: "API_NOT_ENABLED", message: "Google Vision API not enabled in your Google Cloud project" };
  if (status === 429 || errStatus === "resource_exhausted")
    return { code: "QUOTA_EXCEEDED", message: "Google Vision quota exceeded" };
  if (status === 401)
    return { code: "INVALID_KEY", message: "Google Vision key unauthorised" };
  return { code: "SERVICE_ERROR", message: `Google Vision error ${status}` };
};

// ── POST /api/ocr ─────────────────────────────────────────────
const extractHandwriting = async (req, res) => {
  const { imageBase64 } = req.body;
  if (!imageBase64) return res.status(400).json({ message: "No image provided" });

  if (!process.env.GOOGLE_VISION_API_KEY) {
    return res.status(503).json({ errorCode: "NO_KEY", message: "Google Vision API key not configured — use Tesseract fallback" });
  }

  try {
    const response = await axios.post(
      `https://vision.googleapis.com/v1/images:annotate?key=${process.env.GOOGLE_VISION_API_KEY}`,
      {
        requests: [{
          image: { content: imageBase64 },
          features: [{ type: "DOCUMENT_TEXT_DETECTION", maxResults: 1 }],
        }],
      },
      { timeout: 20000 }
    );

    // Google Vision returns 200 even for some errors — check inside the response
    const visionError = response.data.responses?.[0]?.error;
    if (visionError) {
      console.warn("[OCR] Vision response error:", visionError);
      const fakeErr = { response: { status: visionError.code, data: { error: { message: visionError.message, status: visionError.status } } } };
      const { code, message } = classifyVisionError(fakeErr);
      return res.status(503).json({ errorCode: code, message });
    }

    const fullText = response.data.responses[0]?.fullTextAnnotation?.text || "";
    return res.status(200).json({
      text: fullText.trim(),
      provider: "google_vision",
    });

  } catch (error) {
    const { code, message } = classifyVisionError(error);
    console.warn(`[OCR] Google Vision failed — ${code}: ${message}`);
    return res.status(503).json({ errorCode: code, message });
  }
};

module.exports = { extractHandwriting };
