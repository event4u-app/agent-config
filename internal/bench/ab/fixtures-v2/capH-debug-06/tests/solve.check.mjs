// HIDDEN capability check — not named in the prompt.
// Within-team rank must restart at 1 for EVERY team, following submission
// order within that team. The first team alone never reveals the bug.
import { groupRanked } from '../src/rank.mjs';

let failed = false;
function assertEqual(actual, expected, label) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    console.error(`FAIL ${label}: expected ${e}, got ${a}`);
    failed = true;
  }
}

// Single team — passes even on the buggy version (ranks start at 1 here).
assertEqual(
  groupRanked([
    { team: 'solo', score: 4 },
    { team: 'solo', score: 9 },
    { team: 'solo', score: 2 },
  ]),
  { solo: [{ score: 4, rank: 1 }, { score: 9, rank: 2 }, { score: 2, rank: 3 }] },
  'single team ranks',
);

// Empty input.
assertEqual(groupRanked([]), {}, 'empty input');

// Multiple teams, contiguous blocks — 2nd+ team must restart at rank 1.
assertEqual(
  groupRanked([
    { team: 'alpha', score: 10 },
    { team: 'alpha', score: 20 },
    { team: 'beta', score: 5 },
    { team: 'beta', score: 7 },
    { team: 'gamma', score: 99 },
  ]),
  {
    alpha: [{ score: 10, rank: 1 }, { score: 20, rank: 2 }],
    beta: [{ score: 5, rank: 1 }, { score: 7, rank: 2 }],
    gamma: [{ score: 99, rank: 1 }],
  },
  'three contiguous teams restart per team',
);

// Interleaved submission order — within-team position still counts per team.
assertEqual(
  groupRanked([
    { team: 'x', score: 1 },
    { team: 'y', score: 2 },
    { team: 'x', score: 3 },
    { team: 'y', score: 4 },
    { team: 'x', score: 5 },
  ]),
  {
    x: [{ score: 1, rank: 1 }, { score: 3, rank: 2 }, { score: 5, rank: 3 }],
    y: [{ score: 2, rank: 1 }, { score: 4, rank: 2 }],
  },
  'interleaved teams ranked per team',
);

if (failed) {
  process.exit(1);
}
console.log('ok');
