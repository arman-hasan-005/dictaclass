const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const { generateSpeech } = require("../controllers/ttsController");

router.post("/", protect, generateSpeech);

module.exports = router;