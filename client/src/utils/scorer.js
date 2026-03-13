// FIX: This file was empty. Scoring logic was embedded directly in Results.jsx.
//      It is now extracted here so it can be imported wherever needed.

// Normalise a string: lowercase, strip punctuation, trim whitespace
export const normalizeText = (str) =>
  (str || "").toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();

// Levenshtein distance — used for fuzzy word comparison in handwrite mode
export const levenshtein = (a, b) => {
  const dp = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) =>
      i === 0 ? j : j === 0 ? i : 0
    )
  );
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[a.length][b.length];
};

/**
 * Score one typed answer against the original sentence.
 * Uses positional word matching (word at index i vs word at index i).
 *
 * @returns {{ wordResults, correct, total, percentage }}
 */
export const scoreSentence = (original, answer) => {
  const origWords = normalizeText(original).split(/\s+/).filter(Boolean);
  const ansWords = normalizeText(answer).split(/\s+/).filter(Boolean);

  let correct = 0;
  const wordResults = origWords.map((word, i) => {
    const typed = ansWords[i] || "";
    const isCorrect = typed === word;
    if (isCorrect) correct++;
    return { word, typed, correct: isCorrect };
  });

  return {
    wordResults,
    correct,
    total: origWords.length,
    percentage:
      origWords.length > 0 ? Math.round((correct / origWords.length) * 100) : 0,
  };
};

/**
 * Score full handwritten text against all original sentences joined together.
 * Uses fuzzy Levenshtein matching (tolerance ≤ 1 edit) for OCR noise.
 *
 * @returns {Array} Single-element array (to keep the same shape as type-mode results)
 */
export const scoreHandwrite = (originalSentences, handwrittenText) => {
  const originalFull = originalSentences.join(" ");
  const origWords = normalizeText(originalFull).split(/\s+/).filter(Boolean);
  const ansWords = normalizeText(handwrittenText || "").split(/\s+/).filter(Boolean);

  let correct = 0;
  const wordResults = origWords.map((word, i) => {
    const typed = ansWords[i] || "";
    const isCorrect = typed === word || levenshtein(typed, word) <= 1;
    if (isCorrect) correct++;
    return { word, typed, correct: isCorrect };
  });

  return [
    {
      wordResults,
      correct,
      total: origWords.length,
      percentage:
        origWords.length > 0 ? Math.round((correct / origWords.length) * 100) : 0,
    },
  ];
};

/** Map a percentage score to a letter grade and colour */
export const getGrade = (pct) => {
  if (pct >= 95) return { label: "A+", color: "#059669", bg: "#ECFDF5" };
  if (pct >= 85) return { label: "A", color: "#059669", bg: "#ECFDF5" };
  if (pct >= 75) return { label: "B", color: "#2563EB", bg: "#EFF6FF" };
  if (pct >= 65) return { label: "C", color: "#D97706", bg: "#FFFBEB" };
  if (pct >= 50) return { label: "D", color: "#EA580C", bg: "#FFF7ED" };
  return { label: "F", color: "#DC2626", bg: "#FEF2F2" };
};
