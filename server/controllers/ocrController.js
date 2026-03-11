const axios = require("axios");

const extractHandwriting = async (req, res) => {
  try {
    const { imageBase64 } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ message: "No image provided" });
    }

    const apiKey = process.env.GOOGLE_VISION_API_KEY;

    const response = await axios.post(
      `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
      {
        requests: [
          {
            image: { content: imageBase64 },
            features: [
              { type: "DOCUMENT_TEXT_DETECTION", maxResults: 1 }
            ],
          },
        ],
      }
    );

    const fullText =
      response.data.responses[0]?.fullTextAnnotation?.text || "";

    res.status(200).json({ text: fullText.trim() });
  } catch (error) {
    console.error("OCR error:", error.response?.data || error.message);
    res.status(500).json({ message: "Failed to extract text from image" });
  }
};

module.exports = { extractHandwriting };