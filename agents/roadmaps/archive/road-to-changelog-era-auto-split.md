---
complexity: structural
---

# Roadmap: CHANGELOG era auto-split — turn release-blocker into release-script affordance

> Synthesis of the AI Council session on `agents/runtime/council/responses/changelog-era-split-2026-05-25.json` (2 members × 3 rounds, $0.15 actual). The 250-line drift gate in `tests/test_changelog_eras.py` is doing its job — it is fencing the context-window-friendly era cap that [`docs/contracts/CHANGELOG-conventions.md`](../../../docs/contracts/CHANGELOG-conventions.md) § Era splits documents. The failure mode is not the gate; it is that `scripts/release.py` has no awareness of the gate and therefore generates `release: X.Y.Z` PRs that fail the very test that is supposed to discipline them. This roadmap closes that gap in four tiers: Tier 1 (manual era split for the 3.1.x → pre-3.2.0 boundary — done, PR #231) unblocks the in-flight release; Tier 2 (auto-split logic in `release.py`) makes it permanent; Tier 3 (drift-gate hardening) keeps the test as a backstop for non-release edits with a precise assertion message; Tier 4 (discovery loop) takes the council's strongest blind spot seriously — whether the manual changelog convention is the right tool for a package that bills itself as an "Universal AI Agent OS" at all, or whether a machine-generated alternative replaces the era ritual outright.

## Prerequisites

- [x] Council session run and synthesis archived — `agents/runtime/council/responses/changelog-era-split-2026-05-25.json` (2 members, 3 rounds, anthropic+openai, $0.15 actual vs. $0.42 estimated).
- [x] Council verdict captured in chat 2026-05-25: Option E (hybrid auto-split + drift-gate backstop), commit-level "never bundled" reading, idempotency via `git log --grep`, boundary heuristic = bottom-most `X.Y.0`.
- [x] Tier 1 manual split executed and PR opened — `chore/split-changelog-era-3.1.x` → `docs/archive/CHANGELOG-pre-3.2.0.md` (PR #231); current era body reduced from 249 → 6 lines; `tests/test_changelog_eras.py::test_current_era_body_under_cap` passes locally.
- [x] Confirm rules that gate this work:
  - `commit-policy` — no commit steps written into this roadmap unsolicited; the maintainer invokes the commit shape.
  - `roadmap-progress-sync` — every roadmap edit regenerates `agents/roadmaps-progress.md` same response.
  - `non-destructive-by-default` — automated archive-file creation in Tier 2 is a write under `docs/archive/`; not Hard-Floor, but the boundary picker must refuse to overwrite an existing archive.
  - `verify-before-complete` — every claim of "done" in Tier 2 / Tier 3 / Tier 4 requires a fresh `pytest tests/test_changelog_eras.py` run in the same message.

## Context

The drift gate fired on PR #230 (`release: 3.2.0`) because the current-era body had grown to 291 lines across the 3.1.x line — 41 lines over cap. The release script wrote the new `## [3.2.0]` heading at the top, the test correctly refused to let a 291-line era ship, and the entire release process froze even though every other step (version bump, marketplace.json, derived-file regen, PR open) was healthy. **The bug is not "the test is too strict" — it is "the script does not know about the test".**

The council aligned on three structural points the original analysis missed:

- **"Never bundled" is a commit-level constraint, not a PR-level constraint.** The convention text (`CHANGELOG-conventions.md` § Era splits) uses *commit* explicitly. Two commits in one PR — `chore(changelog): split era X.Y.x → pre-X.Y.x` immediately followed by `release: X.Y.Z` — satisfies the rule. This unlocks the Tier 2 design: the release PR contains both the split and the release entry, in that order, as two distinct commits.
- **Boundary picking needs a deterministic algorithm before code lands.** The convention says "typically the last `X.Y.0`" but gives no tiebreaker for "no `X.Y.0` exists in the current era" or "body is still > 250 after the split". Tier 2 Step 2 specifies the algorithm; nothing in Tier 2 ships without it.
- **The drift gate stays.** The gate's role shifts from "catch release-time overflow" (now solved by Tier 2) to "catch non-release edits that push the era past 250" (e.g. a hand-edit of an Unreleased section, an agent that adds entries outside `release.py`). Tier 3 sharpens the assertion message so a maintainer hitting the gate in 2027 sees the right escape hatch.

The strongest blind spot the council surfaced is upstream of all four tiers: **the manual changelog convention itself may be the wrong primitive for this package.** A "Universal AI Agent OS" that auto-splits a hand-maintained log is automating the wrong layer. Tier 4 captures the discovery loop without committing to a rewrite — the question is whether machine-generated entries from Conventional Commits + git log obsolete the convention, or whether the human-curated narrative the convention preserves is load-bearing for the consumer story.

## Phase 1: Tier 1 — Manual era split for the in-flight release (DONE)

Smallest leverage-per-hour item the council named. Unblocks PR #230 immediately so the 3.2.0 release can ship without waiting for Tier 2. Lands as its own PR so the release PR is not contaminated by the split commit's diff.

- [x] **Step 1:** Branch off `main` as `chore/split-changelog-era-3.1.x`.
- [x] **Step 2:** Move every 3.1.x entry from `CHANGELOG.md` into `docs/archive/CHANGELOG-pre-3.2.0.md` with the standard archive header (linking back to `docs/contracts/CHANGELOG-conventions.md`).
- [x] **Step 3:** Replace the moved block in `CHANGELOG.md` with `# Era: pre-3.2.0 — archived` plus the archive link, and rename the active era to `# Era: 3.2.x — current`.
- [x] **Step 4:** Verify `pytest tests/test_changelog_eras.py` is green (body = 6 lines, cap 250).
- [x] **Step 5:** Open PR #231 with body referencing this roadmap's Tier 1 and the council JSON as evidence.

## Phase 2: Tier 2 — Auto-split logic in `scripts/release.py`

The permanent fix. Detects the over-cap condition during release planning, runs the same five-step convention algorithm automatically, and writes the era-split commit as the **first** commit on the release branch — before the `release: X.Y.Z` commit. Idempotent under `--resume`.

- [x] **Step 1: Pre-flight era-cap probe.** `scripts/release.py` now imports `current_era_body_size()` from `scripts/_lib/changelog_eras.py` and runs the probe during planning. The shared module owns the cap constant and era-header regex so the test and the script cannot drift.
- [x] **Step 2: Boundary picker — deterministic algorithm.** `plan_split()` in `scripts/_lib/changelog_eras.py` derives the boundary from the release version's `(major, minor)` (semver-aware), refuses patch-release crossings (returns None → release.py dies with manual-intervention message), and refuses to overwrite an existing archive (`FileExistsError`).
- [x] **Step 3: Splitter implementation.** `perform_split(plan)` in `scripts/_lib/changelog_eras.py` is pure file I/O — moves the current-era body into `docs/archive/CHANGELOG-pre-<boundary>.md` with the standard header, replaces the block with the collapsed pointer, and writes the new era intro block with the next-era hint pre-rendered.
- [x] **Step 4: Two-commit guarantee in `execute()`.** `scripts/release.py` now plans the split during `main()`, executes `perform_split()` + `git add docs/archive/<file> CHANGELOG.md` + `chore(changelog): split era X.Y.x → pre-<boundary>` as commit #1, then runs the existing version-bump mutations against the now-empty current era and commits `release: X.Y.Z` as commit #2.
- [x] **Step 5: Idempotency under `--resume`.** The planner checks `plan.archive_path.exists()` and `git log` for an existing `chore(changelog): split era` commit on the branch; either signal skips the split step on a resume.
- [x] **Step 6: Tests.** `tests/test_changelog_split.py` covers (i) no-split path via patch-release returning None, (ii) minor and major bumps crossing the boundary, (iii) backwards-release refusal, (iv) non-semver release refusal, (v) splitter moves entries + collapses era + refuses existing archive, (vi) insertion-point logic with and without existing version headings. Full suite stays green (4938 passed, 25 skipped).

## Phase 3: Tier 3 — Drift-gate hardening

The drift gate stays as the backstop for entries written **outside** `release.py` — agent-authored Unreleased edits, hand-written hotfixes, doc patches that grow the current era. Tier 3's job is to make the failure message actionable so a 2027-maintainer hitting the gate sees the right escape hatch (auto-split via `task release`, not manual surgery).

- [x] **Step 1: Sharpen `test_current_era_body_under_cap` assertion message.** Message now names `task release` as the auto-split path and points hand-edit overflows at `docs/contracts/CHANGELOG-conventions.md § Era splits`.
- [x] **Step 2: Share the cap constant.** `scripts/_lib/changelog_eras.py` owns `CURRENT_ERA_BODY_CAP = 250` and `ERA_HEADER_RE`. Both `tests/test_changelog_eras.py` and `scripts/release.py` import from there — no parallel copies.
- [x] **Step 3: Document the gate-vs-script contract.** `docs/contracts/CHANGELOG-conventions.md § Era splits` now has a "Gate-vs-script contract" subsection naming the canonical splitter, the backstop, the shared cap constant, and the patch-overflow refusal.

## Phase 4: Tier 4 — Discovery loop: question the convention itself

The council's strongest blind spot. Tier 4 is **not** a commitment to replace the convention — it is a time-boxed investigation that either confirms the manual+auto-split design (and closes the question for 12 months) or proposes a successor.

- [x] **Step 1: Audit consumer touchpoints.** Audit landed in [`ADR-027`](../../../docs/decisions/ADR-027-changelog-machine-vs-manual.md) § Step 1 — seven surfaces enumerated, three high-traffic (GitHub Release notes, npm package page, packagist package page) lean on the narrative paragraph at the top of `CHANGELOG.md` as the highest-weight field. `docs/getting-started-by-role.md` and pack-level `FIRST_WIN.md` do not reference the changelog.
- [x] **Step 2: Compare manual+auto-split vs. machine-generated.** Comparison landed in [`ADR-027`](../../../docs/decisions/ADR-027-changelog-machine-vs-manual.md) § Step 2 — three shapes measured against the 3.2.0 release (38 commits, 141 lines): current convention (~2.8k tokens, 5–15 maintainer-min, high density, high parseability), `release-please` fully generated (~1.1k tokens, ~30 min/month policing commit messages, low density, medium parseability), hybrid (indistinguishable from current). Fully-generated shape loses the narrative paragraph that surfaces 1–3 lean on.
- [x] **Step 3: Decide.** [`ADR-027`](../../../docs/decisions/ADR-027-changelog-machine-vs-manual.md) — **confirm the current convention + Tier 2/3 machinery for 12 months**, review on 2027-05-25 or earlier on any of four named triggers. No successor roadmap. `tests/test_changelog_eras.py` + `tests/test_changelog_split.py` green (14 passed in 0.05s) on the closing run.

## Acceptance Criteria

- `task release` on a clean repo with a current-era body at 240 lines completes without hitting the gate (under-cap path).
- `task release` on a clean repo with a current-era body at 280 lines completes by writing two commits (`chore(changelog): split era …` then `release: X.Y.Z`), the era body drops below 250 in the same PR, the archive file lands under `docs/archive/`, and the existing PR-consistency check stays green.
- `task release --resume` after a crash between the two commits never duplicates the split commit and never overwrites the archive file.
- `tests/test_changelog_eras.py` is green at every commit on the release branch.
- The drift-gate failure message, when hit from a non-release edit, names `task release` as the auto-split path.
- An ADR exists under `docs/decisions/` recording the Phase 4 decision.
