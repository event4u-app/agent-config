---
complexity: lightweight
status: ready
review_by: 2026-12-10
tree_pin: ada1f46a85
estate_growth_exempt: "Activated on 2026-11-10 by the owner's instruction ('3, beides aktiv machen'), with 11 of 25 active after the move. No roadmap owned these items (round inbox-2026-11-wo; the search is in the PR that parked it, #2968)."
estate_offset_exempt: "Activated on 2026-11-10 by the owner's instruction ('3, beides aktiv machen'), with 11 of 25 active after the move; every step is open and the release surfaces it fixes ship in the next release, so nothing is archived to offset it."
execution:
  mode: phase-checkpoints
relates:
  - slug: later/road-to-records-that-match-their-code
    relation: extends
    note: "Its release phase closed the record side. This file covers what the generator still derives from commit subjects and the span check it never had."
  - slug: road-to-gates-that-check-what-they-claim
    relation: disjoint
    note: "That file owns the gate residues; this one owns the release surfaces only. 1.2 there fixes the major-detection comment; 1.1 here fixes the breaking block that reads it."
---

# Road to release notes that match the span

> **Source:** `agents/tmp.old/inbox-2026-11-wo/` — an external review package on
> releases 20.0.0 and 20.2.0 (two transcripts, two rescores, two status updates,
> two revisions of a supplied parity plan, two score tables) plus an owner-side
> bench feedback chat. Drafted against `main@ada1f46a85` on 2026-11-10; every
> *still-true* reading below was re-checked there.

## Goal

The CHANGELOG, `docs/MIGRATION.md` and `BREAKING_CHANGES.md` for a release name
every consumer-visible change in the span the release covers. They take it from
the span itself, never from commit subjects or a keyword filter.

## Context

What the review found, with what was re-checked on `main@ada1f46a85`:

- The 20.0.0 breaking block lists `ci: satisfy the gates…` (`7690bd9`) and leaves
  the actual rename `96a46ef` under Features and Fixes:
  `docs/archive/CHANGELOG-pre-20.1.0.md:33-35` and `:202`. The generator builds
  the block from subjects. This was reported eight times in one source.
- `BREAKING_CHANGES.md:76` and `docs/MIGRATION.md:50` cite `7690bd9`, not `96a46ef`.
- 20.2.0 flipped the consumer default to the reduced layer (`6322154`), yet the
  last MIGRATION section is `## 20.0.0` (`docs/MIGRATION.md:45`). The
  Default-changes highlight misses the flip because it is a word filter
  (`_lib/release_highlights.ts:273,378`, `CHANGELOG.md:525`).
- #2835 (`d03db4aa53`) is in tag 20.0.0, but its default-changing commits
  `453e47c` and `91ebb14` appear in no release notes, and nothing compares the
  notes with the span. The reviewer predicted this one release ahead.
- The 20.0.0 notes say "Honest nulls: _none_" (`CHANGELOG-pre-20.1.0.md:28`),
  although a ten-round revert landed in that span.

## Phase 1 — The surfaces say what changed

- [ ] **1.1 The breaking block reads the footer.** Build the `### BREAKING
      CHANGES` block from each commit's `BREAKING CHANGE:` footer text, never
      from its subject; a commit with `!` and no footer is named as such.
      verify: a test where a `feat!:` commit with a footer and a `ci:` commit without one produce exactly the footer's line.
- [ ] **1.2 Correct the 20.0.0 citation.** `BREAKING_CHANGES.md:76` and
      `docs/MIGRATION.md:50` cite `96a46ef`.
      verify: `grep -c 7690bd9 BREAKING_CHANGES.md docs/MIGRATION.md` -> 0
- [ ] **1.3 The 20.2.0 MIGRATION section.** Name the default flip to the reduced
      layer, its evidence (`agents/evidence/metrics/adapted-layer-confirmation-{haiku,sonnet}-result-20261110.md`)
      and the way back (`agent-config install --full`).
      verify: `docs/MIGRATION.md` has a `## 20.2.0` section naming `--full`.
- [ ] **1.4 Default changes from a declared flag.** A commit that changes a
      consumer default declares it in a trailer, and the highlight reads the
      trailer instead of matching words.
      verify: a test where a default flip whose subject avoids the filter words is still listed.

## Phase 2 — The notes are checked against the span

- [ ] **2.1 Span equivalence.** Before the release PR exists, every commit in
      `<previous tag>..<release head>` that touches a consumer surface is either
      named in the section or listed as internal, and the release head contains
      `main`.
      verify: replayed on the 20.0.0 span, the check names `453e47c` and `91ebb14`.
- [ ] **2.2 A default flip carries its verdict.** A change to a consumer default
      cites a machine-readable verdict file that a gate reads (NON-INFERIOR, or
      an owner decision naming the flip), and emits its MIGRATION and
      Default-changes lines itself.
      verify: a test where a flip without a verdict file is refused and one with it emits both lines.
- [ ] **2.3 Unreleased and honest nulls.** Curated `[Unreleased]` entries move
      into the release section, and the honest-nulls line is derived from reverts
      and recorded nulls in the span, never left as "_none_" by default.
      verify: a test where a span holding a `Revert "…"` commit produces an honest-nulls line naming that commit.

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| C1 | contested-technical | agent (closure, round inbox-2026-11-wo) | "Named in the section" and "listed as internal" are both legal outcomes per commit; only a commit in neither is refused. Not a choice between designs. | unpicked-alternative:75 | a release lists most consumer commits as internal |
| C2 | deterministic | agent | 2.3's verify was rewritten to a test on a span holding a `Revert "…"` commit. | unfalsifiable-verify:85 | — |

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-11-10 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | A span check that cries wolf | implementation | Every governance-only commit flagged as missing turns the check into noise that gets waived | Consumer surfaces only, with internal commits listed rather than refused | Phase 2 — The notes are checked against the span |
| 2 | A trailer nobody writes | product | 1.4 and 2.2 depend on authors declaring a default change | 2.2 refuses the undeclared flip on the consumer-default files themselves, so the trailer is a convenience and not the only gate | Phase 1 — The surfaces say what changed |

## Acceptance Criteria

- [ ] AC-1: Replayed on 20.0.0 and 20.2.0, the generated notes name the rename,
      the two #2835 commits and the layer flip, and nothing else is missing.
- [ ] AC-2: No consumer-default flip can ship without a verdict file a gate has
      read (the reviewer's constraint, round inbox-2026-11-wo).
- [ ] AC-3: Comparator frameworks stay anonymised in every tracked surface this
      file touches.
