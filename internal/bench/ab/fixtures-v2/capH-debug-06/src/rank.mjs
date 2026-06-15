// Group-and-rank helper for the leaderboard layer.
//
// Input: a flat list of entries, each { team, score }, in submission order.
// Output: an object mapping each team to a list of { score, rank }, where
// `rank` is the entry's 1-based position WITHIN ITS OWN TEAM, in the order
// the entries were submitted. Teams appear in first-seen order; an entry's
// position is relative to its team only, never to the global list.

/**
 * @param {{team: string, score: number}[]} entries
 * @returns {Record<string, {score: number, rank: number}[]>}
 */
export function groupRanked(entries) {
  // First pass: bucket entries by team, preserving submission order.
  const buckets = new Map();
  for (const entry of entries) {
    if (!buckets.has(entry.team)) {
      buckets.set(entry.team, []);
    }
    buckets.get(entry.team).push(entry.score);
  }

  // Second pass: assign within-team ranks.
  const result = {};
  let rank = 1;
  for (const [team, scores] of buckets) {
    const ranked = [];
    for (const score of scores) {
      ranked.push({ score, rank });
      rank += 1;
    }
    result[team] = ranked;
  }

  return result;
}
