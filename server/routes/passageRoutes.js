const express = require("express");
const router = express.Router();
const {
  getPassages,
  getPassageById,
} = require("../controllers/passageController");
const { protect } = require("../middleware/authMiddleware");

router.get("/", protect, getPassages);
router.get("/:id", protect, getPassageById);

module.exports = router;