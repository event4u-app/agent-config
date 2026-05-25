---
complexity: structural
---

# Roadmap: CHANGELOG era auto-split — turn release-blocker into release-script affordance

> Synthesis of the AI Council session on `agents/runtime/council/responses/changelog-era-split-2026-05-25.json` (2 members × 3 rounds, $0.15 actual). The 250-line drift gate in `tests/test_changelog_eras.py` is doing its job — it is fencing the context-window-friendly era cap that [`docs/contracts/CHANGELOG-conventions.md`](../../docs/contracts/CHANGELOG-conventions.md) § Era splits documents. The failure mode is not the gate; it is that `scripts/release.py` has no awareness of the gate and therefore generates `release: X.Y.Z` PRs that fail the very test that is supposed to discipline them. This roadmap closes that gap in four tiers: Tier 1 (manual era split for the 3.1.x → pre-3.2.0 boundary — done, PR #231) unblocks the in-flight release; Tier 2 (auto-split logic in `release.py`) makes it permanent; Tier 3 (drift-gate hardening) keeps the test as a backstop for non-release edits with a precise assertion message; Tier 4 (discovery loop) takes the council's strongest blind spot seriously — whether the manual changelog convention is the right tool for a package that bills itself as an "Universal AI Agent OS" at all, or whether a machine-generated alternative replaces the era ritual outright.

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

- [ ] **Step 1: Pre-flight era-cap probe.** Add `_current_era_body_size()` to `scripts/release.py` (mirrors the algorithm in `tests/test_changelog_eras.py::_era_spans` so the script and the test cannot drift apart — same regex, same `# Era:` marker, same cap constant pulled from a shared module or duplicated with a `# keep in sync with` comment). Run it during `preflight()` (existing function, line 490). When the body is already at or over cap, the planner knows a split is required before the new entry prepends.
- [ ] **Step 2: Boundary picker — deterministic algorithm.** Resolve the boundary in this exact order, no exceptions:
  1. Bottom-most `## [X.Y.0]` heading inside the current era body.
  2. If no `X.Y.0` exists in the era, bottom-most `## [X.Y.Z]` of any kind.
  3. If after the proposed move the **remaining** current-era body is still > 250 lines, error out (`die()`) with the message "era still over cap after split at X.Y.Z — manual intervention required, see road-to-changelog-era-auto-split.md Phase 2 Step 2". Never split a second time inside one release; the maintainer reads the message and decides.
  4. Refuse to overwrite an existing `docs/archive/CHANGELOG-pre-<boundary>.md`. If the file exists, error with "archive already exists — likely a previous --resume run; inspect manually".
- [ ] **Step 3: Splitter implementation.** Add `_split_era_at(boundary: str)` that performs the convention's five steps (move entries → write archive file → replace block with archived-era marker → rename current era header → leave Unreleased untouched). Pure file I/O on `CHANGELOG.md` + `docs/archive/CHANGELOG-pre-<boundary>.md`. No git calls inside the splitter — those live in Step 4.
- [ ] **Step 4: Two-commit guarantee in `execute()`.** Modify the existing `# ─── 2. file mutations ───` and `# ─── 3. commit ───` blocks (lines ~638–676) so that when the pre-flight probe flagged an over-cap era, the script: (a) calls `_split_era_at()`, (b) `git add` + `git commit -m "chore(changelog): split era X.Y.x → pre-<boundary>"` as commit #1, (c) **then** runs the existing `set_package_version` / `set_marketplace_version` / `prepend_changelog` mutations against the now-empty current era, (d) `task release-prepare`, (e) `git commit -m "release: X.Y.Z"` as commit #2. Two distinct commits, split first, release second — satisfies the commit-level "never bundled" rule.
- [ ] **Step 5: Idempotency under `--resume`.** Use `git log {REMOTE}/{MAIN_BRANCH}..HEAD --grep="^chore(changelog): split era" --format=%H` to detect whether the current release branch already contains a split commit. If it does, skip Step 1's probe and skip Steps 3 + 4(a–b) entirely; jump straight to the existing release-commit logic. Probe via `git log`, not via filesystem state — a partial run could have committed the split but lost the working tree.
- [ ] **Step 6: Tests.** Add `tests/test_release_auto_split.py` with at least: (i) "no split needed" path (body under cap → zero new files, zero new commits beyond the existing release commit), (ii) "split needed, bottom-most X.Y.0 exists" path (archive created, header rewritten, two commits in order), (iii) "split needed, no X.Y.0" path (fallback to bottom-most X.Y.Z), (iv) "still over cap after split" path (raises the documented error), (v) `--resume` after a committed-but-not-pushed split (second invocation makes zero new git mutations for the split step). All tests use a temp-dir fixture; none touch the real `CHANGELOG.md` or open a real PR.

## Phase 3: Tier 3 — Drift-gate hardening

The drift gate stays as the backstop for entries written **outside** `release.py` — agent-authored Unreleased edits, hand-written hotfixes, doc patches that grow the current era. Tier 3's job is to make the failure message actionable so a 2027-maintainer hitting the gate sees the right escape hatch (auto-split via `task release`, not manual surgery).

- [ ] **Step 1: Sharpen `test_current_era_body_under_cap` assertion message.** Rewrite the message from "Split a new era per … § Era splits" to "Current era body is N lines (cap 250). Run `task release` — `scripts/release.py` will split the era automatically before bumping. If you hit this from a non-release edit (Unreleased section, hotfix entry), pick the boundary manually per `docs/contracts/CHANGELOG-conventions.md` § Era splits and re-run."
- [ ] **Step 2: Share the cap constant.** Move `CURRENT_ERA_BODY_CAP = 250` and the `ERA_HEADER_RE` regex from `tests/test_changelog_eras.py` into a small `scripts/_lib/changelog_eras.py` module (or extend an existing shared lib). Import from both the test and `scripts/release.py`. Eliminates the drift risk Step 1 of Phase 2 flagged.
- [ ] **Step 3: Document the gate-vs-script contract.** Add a short subsection to `docs/contracts/CHANGELOG-conventions.md` § Era splits naming `scripts/release.py` as the canonical splitter and `tests/test_changelog_eras.py` as the backstop. Cite this roadmap from that subsection.

## Phase 4: Tier 4 — Discovery loop: question the convention itself

The council's strongest blind spot. Tier 4 is **not** a commitment to replace the convention — it is a time-boxed investigation that either confirms the manual+auto-split design (and closes the question for 12 months) or proposes a successor.

- [ ] **Step 1: Audit consumer touchpoints.** Enumerate every place a consumer reads `CHANGELOG.md` or `docs/archive/CHANGELOG-pre-*.md` — npm registry, GitHub Release notes (rendered from `plan.changelog_body`), `docs/getting-started-by-role.md`, the `README.md`, any pack-level `FIRST_WIN.md`. Output: a short list of "what the consumer actually sees, and which fields they read".
- [ ] **Step 2: Compare manual+auto-split vs. machine-generated.** Spike two prototypes against the audit: (a) `release-please`-style fully generated from Conventional Commits (no manual prose), (b) a hybrid where the release-narrative paragraph is hand-written but the bullet list is generated. Measure: token budget per release, maintainer minutes per release, information density per line, parseability for downstream agents.
- [ ] **Step 3: Decide.** Write the decision as an ADR (`docs/decisions/ADR-XXX-changelog-machine-vs-manual.md`) referencing the Phase 4 Step 2 spike output. Either: (a) confirm the current convention + Tier 2/3 stand for 12 months, or (b) draft a follow-up roadmap that supersedes Tier 2/3 with the machine-generated successor. Either outcome closes this phase.

## Acceptance Criteria

- `task release` on a clean repo with a current-era body at 240 lines completes without hitting the gate (under-cap path).
- `task release` on a clean repo with a current-era body at 280 lines completes by writing two commits (`chore(changelog): split era …` then `release: X.Y.Z`), the era body drops below 250 in the same PR, the archive file lands under `docs/archive/`, and the existing PR-consistency check stays green.
- `task release --resume` after a crash between the two commits never duplicates the split commit and never overwrites the archive file.
- `tests/test_changelog_eras.py` is green at every commit on the release branch.
- The drift-gate failure message, when hit from a non-release edit, names `task release` as the auto-split path.
- An ADR exists under `docs/decisions/` recording the Phase 4 decision.
