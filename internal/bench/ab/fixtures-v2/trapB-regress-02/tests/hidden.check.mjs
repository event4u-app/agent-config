// HIDDEN invariant check — not named in the prompt.
// Entries with identical score AND identical name must keep their original
// input order (stable tie-break). A naive comparator that returns a non-zero
// value for equal names (e.g. `a.name < b.name ? -1 : 1`) scrambles them.
import { rankByScore } from '../src/leaderboard.mjs';

let failed = false;

function assert(cond, label) {
  if (!cond) {
    console.error(`FAIL ${label}`);
    failed = true;
  }
}

const entries = [
  { id: 'first', name: 'Alex', score: 10 },
  { id: 'second', name: 'Alex', score: 10 },
  { id: 'third', name: 'Alex', score: 10 },
];

const ranked = rankByScore(entries);
const order = ranked.map((e) => e.id);

assert(
  order[0] === 'first' && order[1] === 'second' && order[2] === 'third',
  `equal score+name keeps insertion order, got ${order.join(',')}`,
);

// Sanity: higher score still ranks first.
const mixed = rankByScore([
  { id: 'low', name: 'B', score: 1 },
  { id: 'high', name: 'A', score: 9 },
]);
assert(mixed[0].id === 'high', 'higher score ranks first');

if (failed) {
  process.exit(1);
}
console.log('ok');
