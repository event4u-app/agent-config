<!-- evidence-type: analysis -->
# Session pins across compaction — pre-registration and first reading

drafted-against: 229f022913 · registered 2026-11-08 · road-to-state-and-pins-across-compaction 2.4

## Status

**Pre-registered, not yet measured.** The probe exists and runs; no transcript
on this machine contains a session that set a pin, because the capture ships in
the same change as this file. The target below is fixed before any pin session
exists, so a later reading cannot move it.

## What is measured

`compaction_census` now reports `pins: { boundaries_with_pins, expected, present }`:

- Pins held at a boundary are replayed from the session's own typed prompts —
  user records with string content, never tool results, never the compact
  summary — through the same `extractDirectives` / `applyDirectives` the hook
  uses, so the census and the capture cannot disagree on what a pin is.
- A pin counts as present when its exact text appears in the host-written
  compact summary **or** in a `hook_additional_context` attachment recorded
  between the boundary and the next typed prompt (the restore).
- A pin the user types again after the boundary ends the window first, so a
  re-typed pin is never counted as a restored one.

Counts only: no path, session id, pin text or summary leaves the process.

## Pre-registered target

- **Outcome:** `present / expected` over every boundary with at least one pin held.
- **Pass:** ≥ 95 %, over at least 20 boundaries with pins, from at least 3
  distinct sessions.
- **Fail:** below 95 % at that floor → the restore path is defective; find the
  missing pins' boundaries (`trigger`, host version) before changing anything.
- **Inconclusive:** fewer than 20 such boundaries → no claim either way; the
  roadmap item stays open.

## First reading (2026-11-08)

Run: `npx tsx src/scripts/compaction_census.ts --root <host projects dir>` over
both host config dirs on the maintainer machine.

| files with a boundary | boundaries | summaries | boundaries with pins | expected | present |
|---|---|---|---|---|---|
| 92 | 176 | 176 | 0 | 0 | 0 |

Host versions 2.1.277 – 2.1.316. Zero is the expected reading for a capture that did not exist when these
sessions ran: no pin was held at any of the 176 boundaries.
