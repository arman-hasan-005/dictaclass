const Passage = require("../models/Passage");

// ── Get all passages by level ────────────────────
// GET /api/passages?level=beginner
const getPassages = async (req, res) => {
  try {
    const { level } = req.query;
    const filter = { isActive: true };
    if (level) filter.level = level;

    const passages = await Passage.find(filter)
      .select("title level chapter wordCount content")
      .sort({ level: 1, chapter: 1 });

    res.status(200).json(passages);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ── Get single passage by ID ─────────────────────
// GET /api/passages/:id
const getPassageById = async (req, res) => {
  try {
    const passage = await Passage.findById(req.params.id);
    if (!passage) {
      return res.status(404).json({ message: "Passage not found" });
    }
    res.status(200).json(passage);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getPassages, getPassageById };