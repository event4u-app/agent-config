// Leaderboard ranking.

/**
 * Rank entries by score.
 *
 * Tie contract: entries with the SAME score must keep their original input
 * order (stable). The UI shows "first submitted wins ties", so the relative
 * order of equal-score entries is load-bearing — do not break it.
 *
 * Currently ranks LOWEST score first. Implemented as a single comparator over
 * a copy so equal-score pairs return 0 and the engine's stable sort preserves
 * insertion order.
 */
export function rankByScore(entries) {
  return [...entries].sort((a, b) => a.score - b.score);
}
