---
adr: 027
status: accepted
date: 2026-05-25
decision: changelog-machine-vs-manual
supersedes: —
superseded_by: —
phase: v3.x · changelog-era-auto-split Phase 4
type: discovery-loop-closure
review_date: 2027-05-25
---

# ADR-027 — CHANGELOG convention — confirm manual narrative + auto-split for 12 months

## Status

**Accepted** · 2026-05-25. Closes Phase 4 of
[`road-to-changelog-era-auto-split.md`](../../agents/roadmaps/archive/road-to-changelog-era-auto-split.md).
Time-boxed: review on 2027-05-25 or earlier if a trigger below fires.

## Context

The AI Council that produced the auto-split design surfaced one upstream
question: **is the manual changelog convention itself the right primitive
for a package that bills itself as an "Universal AI Agent OS"?** Phase 4
investigates without committing to a rewrite — either confirm
`docs/contracts/CHANGELOG-conventions.md` + the Tier 2/3 machinery stand
for 12 months, or draft a successor roadmap.

### Step 1 — Consumer touchpoint audit

Every place a consumer reads the changelog and which fields they read:

| # | Surface | What the consumer sees | Field weight |
|---|---|---|---|
| 1 | **GitHub Release notes** | `plan.changelog_body` rendered via `scripts/release.py:818` | narrative + bullets + tests-delta |
| 2 | **npmjs.com package page** | auto-rendered `CHANGELOG.md` (top of file) | narrative paragraph dominates the fold |
| 3 | **packagist.org package page** | same — auto-rendered `CHANGELOG.md` | same |
| 4 | **`README.md` footer** | link only to `CHANGELOG.md` and `releases/latest` | navigation, no content |
| 5 | **`CHANGELOG.md` direct** | full structured entries | full Keep-a-Changelog shape |
| 6 | **`docs/archive/CHANGELOG-pre-*.md`** | historical eras behind the active-era pointer | follow-up reads only |
| 7 | **`agents/settings/contexts/adr-artifact-engagement.md` § L100** | guidance to write a deprecation note in `CHANGELOG.md` | governance / authoring, not consumer |

`docs/getting-started-by-role.md` — not in scope. No role-pack `FIRST_WIN.md` references the changelog.

**Reader insight.** Surfaces 1–3 are the high-traffic consumer surfaces.
Each renders the *top* of the changelog: the narrative paragraph + the
first bullet group + the tests-delta. The narrative paragraph carries
the framing every other layer (bullets, compare-link) loses.

### Step 2 — Spike comparison against the audit

Three shapes, measured against the 3.2.0 release (38 commits, 141 lines
of narrative + bullets in the current convention):

| Metric | Current (manual narrative + auto-split) | (a) `release-please` fully generated | (b) Hybrid (manual paragraph + generated bullets) |
|---|---:|---:|---:|
| **Token budget per release** | ~2.8k (141 lines × ~80 chars) | ~1.1k (38 commits × ~120 chars) | ~2.6k (same as current; bullets generated, paragraph hand-written) |
| **Maintainer minutes per release** | 5–15 (write narrative; auto-split runs in `task release`) | 0 direct + ~30/month policing commit messages | 5–10 (paragraph only) |
| **Information density per line** | high — narrative compresses 5–10 bullets of context | low — every infrastructure commit becomes a line | high — same as current |
| **Parseability for downstream agents** | high — `### Features` / `### Fixes` / `### BREAKING` are semantic anchors | medium — same headings, but no narrative anchor to disambiguate scope churn | high |
| **Hands-off failure mode** | era over-cap → auto-split fires | commit-message drift pollutes the log → no recovery without rewriting commits | narrative drift → degrades to release-please equivalent |

The fully-generated shape **loses the narrative paragraph**, which is
the field weight #1–3 surfaces lean on. The hybrid shape is what the
current convention *already* allows — `release-please` is just the
extreme end of the auto-spectrum; the convention sits at a defensible
middle.

The operational cost that prompted the question (era over-cap blocking
the release PR) is solved by Tier 2 in the same roadmap. The discovery
question therefore reduces to: **is the narrative paragraph worth
~2.5k tokens per release?** Audit says yes — it is the field consumers
read first and the field that differentiates the package from bot
output.

## Decision

**Confirm `docs/contracts/CHANGELOG-conventions.md` + Tier 2/3
machinery for 12 months.** No successor roadmap.

The current convention:

- Keeps the **hand-written narrative paragraph** as the load-bearing
  framing for consumer surfaces (npm, packagist, GitHub Releases).
- Lets `scripts/release.py` generate the **bullet list** under
  Features / Fixes / Chores / Docs / BREAKING via the auto-split flow
  plus the existing Keep-a-Changelog shape.
- Lets the **drift gate** (`tests/test_changelog_eras.py`) catch
  non-release edits that grow the active era past 250 lines.

The "Universal AI Agent OS" framing **argues for**, not against, a
human-curated changelog — agents that consume `CHANGELOG.md` as a
ground-truth of "what changed" prefer structured, semantic, framed
entries over a flat commit dump.

## Consequences

- `docs/contracts/CHANGELOG-conventions.md` stands as-is. The
  Tier 3 Step 3 "Gate-vs-script contract" subsection is the canonical
  reference for the gate / script split.
- No new tooling lands as a Phase 4 follow-up.
- Review on **2027-05-25** or earlier if any trigger fires:
  1. The narrative paragraph stops being written for two consecutive
     releases (signal: convention is breaking down naturally).
  2. The active-era body grows past 250 lines from non-release edits
     more than twice in a quarter (signal: humans are bypassing the
     gate; auto-split is no longer the right primitive).
  3. A downstream consumer (npm/packagist/GitHub Release renderer)
     changes how it slices the top-of-file (signal: the field weight
     assumption above is invalidated).
  4. Council session re-opens the question with new evidence.

## Alternatives considered

| Option | Why rejected |
|---|---|
| **`release-please` fully generated** | Loses the narrative paragraph; surfaces 1–3 lose their highest-weight field. |
| **Hybrid (manual paragraph + generated bullets, separate tool)** | Indistinguishable from current convention in output; adds a tool boundary without changing the artefact. |
| **Drop the changelog entirely, point to GitHub Releases** | npm / packagist auto-render `CHANGELOG.md` from the repo; deleting it degrades surfaces 2–3 to a generic placeholder. |

## References

- [`docs/contracts/CHANGELOG-conventions.md`](../contracts/CHANGELOG-conventions.md) — convention being confirmed.
- [`agents/roadmaps/archive/road-to-changelog-era-auto-split.md`](../../agents/roadmaps/archive/road-to-changelog-era-auto-split.md) — closes Phase 4.
- [`agents/runtime/council/responses/changelog-era-split-2026-05-25.json`](../../agents/runtime/council/responses/changelog-era-split-2026-05-25.json) — the originating council synthesis.
- `scripts/_lib/changelog_eras.py` — shared cap + splitter (Tier 2 output).
- `scripts/release.py:818` — `plan.changelog_body` → GitHub Release notes wire.
- `tests/test_changelog_eras.py`, `tests/test_changelog_split.py` — gate + splitter coverage.
