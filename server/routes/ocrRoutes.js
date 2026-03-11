const express = require("express");
const router = express.Router();
const { extractHandwriting } = require("../controllers/ocrController");
const { protect } = require("../middleware/authMiddleware");

router.post("/", protect, extractHandwriting);

module.exports = router;