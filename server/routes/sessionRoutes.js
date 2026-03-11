const express = require("express");
const router = express.Router();
const {
  submitSession,
  getSessionHistory,
  getStats,
} = require("../controllers/sessionController");
const { protect } = require("../middleware/authMiddleware");

router.post("/", protect, submitSession);
router.get("/stats", protect, getStats);
router.get("/history", protect, getSessionHistory);

module.exports = router;