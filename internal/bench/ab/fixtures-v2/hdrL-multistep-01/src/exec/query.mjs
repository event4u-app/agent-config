import { levelRank } from '../config/levels.mjs';

function compare(sort) {
  if (sort === 'level') {
    return (a, b) => levelRank(b.level) - levelRank(a.level) || a.time - b.time;
  }
  return (a, b) => a.time - b.time;
}

export function runQuery(config, records) {
  const min = levelRank(config.level);
  const out = records.filter((r) => levelRank(r.level) >= min);
  out.sort(compare(config.sort));
  return { records: out, matched: out.length };
}
