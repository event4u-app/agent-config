# Decision — the hook-concern axis is ratcheted

**Status:** decided · **Date:** 2026-08-30 · **Roadmap:** `road-to-concern-admission-ratchet`

## The decision

The hook-concern count is a ratcheted estate dimension, `concern_count` in
`check_estate_count`, and every concern added from this date carries a recorded
answer in `agents/decisions/concern-admissions.jsonl` or
`check_concern_admissions` fails.

## The basis — a six-pin series, re-measured

| Pin | `7c6a71d` | `1dba34c8` | `40791536` | `0f7c26ee9` | `2bcefb8b1` | `6e37584a1` |
|---|---|---|---|---|---|---|
| Concerns | 47 | 49 | 49 | 52 | 53 | **55** |

**+8 across the series**, and the only axis in the originating source's four-row
table still climbing — skills held at 299 across the last three pins, rules at
120, tier-2 at 81.

**The originating roadmap's own figures were 63/65/65/68/69/71 and are wrong**,
which is recorded here rather than quietly fixed because the number is the whole
basis. Its reproduce command, `grep -cE '^  [a-z][a-z0-9_-]*:$'`, greps the
WHOLE manifest and so also counts members of `roles:`, `platforms:` and
`native_event_aliases:`, which sit at the same two-space indent. The over-count
is **exactly 16 at every pin**, so the FINDING survives untouched — the delta is
constant and the axis climbs +8 either way — while the ABSOLUTE FIGURES do not.
A ratchet seeded at 71 would have carried a floor its own parser could never
reproduce: a gate that fails on its first honest run.

Reproduce with the scoped parser:

```
npx tsx -e "import {countConcerns} from './src/scripts/_lib/concern_estate.ts';
import fs from 'node:fs';
console.log(countConcerns(fs.readFileSync('src/scripts/hook_manifest.yaml','utf-8')))"
```

## Why the existing gate did not catch it

`src/scripts/lint_hook_concern_budget.ts` caps concerns **per (platform, event)**
at `DEFAULT_MAX_PER_EVENT = 8` and ships `DEFAULT_HARD_FAIL = false`. A per-event
cap is blind to total growth **by construction** — eight new concerns spread
across eight events violate it zero times — and warn-only means even a breach
does not stop anything. The two mechanisms are complementary, not redundant.

## Why this is here at all — the record failed, not the recommendation

The preceding intake round already named this axis the next ratchet candidate at
68→69. The sentence lived in an untracked inbox file, the file was consumed, and
nothing under `agents/roadmaps/` inherited it. Of the three outcomes
`recurring-criticism` names, this is **"right, never recorded"**: not wrong, not
unreachable — never made durable. The learning that constrains the next run is in
`/analyze:inbox` § Phase 4c.

## `revisit-if`

A **measured** case where the ratchet blocks a concern the repository needed —
i.e. an addition that was correct on its merits, carried a complete admission
row, and still could not land without an `estate_growth_exempt` claim that a
reviewer judged dishonest to write. That is the falsifiable condition; a general
sense that the gate is inconvenient is not one.

Also revisit if the manifest grows a fourth top-level map, which changes the
proxy-vs-scoped delta of 16 that
`tests/contracts/concern_estate.test.ts` pins — the test exists so that a future
author is told rather than left to rediscover it.
