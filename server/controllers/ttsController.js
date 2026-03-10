const axios = require("axios");

const generateSpeech = async (req, res) => {
  try {
    const { text, gender } = req.body;

    if (!text) {
      return res.status(400).json({ message: "Text is required" });
    }

    const apiKey = process.env.ELEVENLABS_API_KEY;

    // Choose voice based on gender preference
    const voiceId =
      gender === "male"
        ? process.env.ELEVENLABS_VOICE_ID_MALE
        : process.env.ELEVENLABS_VOICE_ID_FEMALE;

    const response = await axios({
      method: "POST",
      url: `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      headers: {
        "xi-api-key": apiKey,
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
    });

    res.set({
      "Content-Type": "audio/mpeg",
      "Content-Length": response.data.length,
    });

    res.send(Buffer.from(response.data));
  } catch (error) {
  if (error.response) {
    // Convert buffer response to readable text
    const errorText = Buffer.from(error.response.data).toString("utf8");
    console.error("ElevenLabs error details:", errorText);
  } else {
    console.error("ElevenLabs error:", error.message);
  }
  res.status(500).json({ message: "Failed to generate speech" });
  }
};

module.exports = { generateSpeech };