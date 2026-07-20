---
complexity: lightweight
execution:
  mode: autonomous
---

# Road to CHANGELOG [Unreleased] drain — clean the stale 6.0.0 fossil + guard it

> Move the ~940-line "6.0.0 at a glance" release-overview block out of
> `## [Unreleased]` into a dedicated archive file so `[Unreleased]` starts
> clean, and add the missing guard so it cannot silently reopen with an
> at-a-glance fossil.

## Goal

Drain `CHANGELOG.md` `## [Unreleased]` (currently lines 19–960, the
`### 6.0.0 at a glance — release overview` block) into
`docs/archive/CHANGELOG-6.0.0-overview.md` (content preserved, not deleted),
leave `[Unreleased]` clean, and extend the live era-drift test to assert
`[Unreleased]` carries no `### N.Y.Z at a glance` overview.

## Context (verified 2026-07-21, do not relitigate)

Source: the user-supplied 9.6.0 review (`agents/tmp/feedback-9.6.0-1.txt`,
local/gitignored) — item #21: `[Unreleased]` opens with ~1,040 lines of stale
6.0.0 release notes; "fix it and add a CI gate watching `[Unreleased]`". Also
the deferred "Fossil drain" step of `road-to-surface-consolidation`
(`[~]`, split off there to avoid coupling a CHANGELOG-history restructure to
the surface-consolidation diff — now a standalone, decoupled change).

Verified in the repo (subagent scope pass):

- The `### 6.0.0 at a glance` block sits at CHANGELOG.md **lines 19–960**,
  **above** the entire era machinery (first `# Era:` header is line 962). It was
  hand-placed under `[Unreleased]` during 6.0.0-readiness and never drained (the
  9.0-followups review moved only the misfiled *breaking* prose and explicitly
  declined the full drain).
- **Draining it breaks no test:** the era-drift cap (`tests/lib/changelog_eras.test.ts`,
  `CURRENT_ERA_BODY_CAP` 250) measures only the current-era body (lines
  1053–1205); the conventions-link test reads lines 1–30 (link at line 6). The
  drained region is outside both.
- **No release tool touches `[Unreleased]`** — `src/scripts/release.ts` writes
  new entries at the current-era insertion point, never at `[Unreleased]`, so a
  hand-drain is not reverted on the next release.
- **No `[Unreleased]`-cleanliness gate exists** — the only structural guard is
  the length cap, which never inspects this region. This roadmap adds the guard
  the review asked for (extend the existing test — no new mechanism).

This is uncontested cleanup (review #21 + the surface-consolidation deferred
step); not council-gated.

## Phase 1 — Drain the fossil (preserve, don't delete)

- [x] Move CHANGELOG.md lines 19–960 (`### 6.0.0 at a glance` … end of block)
      verbatim into a new `docs/archive/CHANGELOG-6.0.0-overview.md` with a short
      archive header (what it is, that it was drained from `[Unreleased]` on
      2026-07-21, why). Leave `[Unreleased]` clean (a one-line placeholder +
      pointer to the archived overview); keep everything from the first
      `# Era:` header (line 962) onward byte-identical.
      <!-- verify: grep -A3 '## \[Unreleased\]' CHANGELOG.md | grep -vq '6.0.0 at a glance' && test -f docs/archive/CHANGELOG-6.0.0-overview.md && echo ok -->
- [x] Confirm the era machinery is untouched: the era-drift + conventions tests
      stay green, and the first `# Era:` block + all version sections are
      byte-identical below the drained region.
      <!-- verify: npx vitest run tests/lib/changelog_eras.test.ts 2>&1 | tail -3 -->

Exit: `[Unreleased]` is clean; the 6.0.0 overview is preserved in
`docs/archive/`; era tests green. Rollback: restore the block from the archive
file (one move).

## Phase 2 — Guard [Unreleased] against fossil reopening

- [x] Add a live-CHANGELOG assertion to `tests/lib/changelog_eras.test.ts`
      (the era-drift-gate describe block): the region between `## [Unreleased]`
      and the first `# Era:` header contains no `### \d+\.\d+\.\d+ at a glance`
      overview heading. This is the guard the review asked for — an extension of
      the existing gate, not a new mechanism/CI job.
      <!-- verify: npx vitest run tests/lib/changelog_eras.test.ts 2>&1 | tail -3 -->

Exit: the new assertion is green now and would fail if a future edit reopens
`[Unreleased]` with an at-a-glance block. Rollback: remove the one assertion.

## Acceptance criteria (anti-dump)

- [x] **Net-negative in the live file, no information loss:** `[Unreleased]` drops
      ~940 lines; the content is preserved verbatim in `docs/archive/`, not deleted.
- [x] **No new mechanism:** the guard is one assertion added to the existing era
      test — no new lint/CI job/rule (complexity-budget holds).
- [x] **Era machinery untouched:** era-drift cap + conventions tests stay green;
      everything from the first `# Era:` header down is byte-identical.
- [x] **Scope held:** only the CHANGELOG drain + guard; no unrelated cleanup
      (e.g. the stale `test_changelog_eras.py` reference in the header is left for
      a separate change).

## Provenance

Source: the user-authored 9.6.0 review (`agents/tmp/feedback-9.6.0-1.txt`, local,
gitignored), item #21, plus the deferred fossil-drain step of
`road-to-surface-consolidation`. No external comparison depended on. No council
(uncontested cleanup).
