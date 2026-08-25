---
complexity: structural
status: ready
execution:
  mode: phase-checkpoints
estate_offset_exempt: Consumes a six-document inbox drop that no active roadmap covers; nothing in the current estate is complete enough to archive as its offset.
estate_growth_exempt: The inbox drop consolidates six documents into one roadmap; the active estate has no completed member to archive as its offset in the same change.
---
# Road to Redundancy Governance

> **Source:** `agents/tmp.old/redundanz/` — six documents from two chat sessions
> (two transcripts, four single-topic roadmaps, two competing consolidations),
> all drafted against `a36d4658`, which is this branch's base. Verified against
> the tree on 2026-08-25; the measurement corrections are in Phase 1.

## Goal

The package states one honest authority for shared knowledge, and it applies
that standard at all three moments a human or agent touches code — writing it,
reviewing it, and refactoring it. Today the standard exists only for the first
moment and only for code comments: `code-review` carries the word `DRY` and
nothing behind it, `code-refactoring` carries no redundancy content at all, and
no carrier states when duplication should be *kept*. When this is finished, one
taxonomy and one verdict set are cited by all three carriers, a measured
baseline exists that later ratchets can quote, and the one confirmed delivery
defect — seven divergent script twins that both ship — is recorded with the
per-twin decision put to the maintainer rather than guessed.

Explicitly NOT in scope: the ~534-file spine extraction, the gate-kernel
consolidation, and any clone-detector dependency. Those collide with the active
`road-to-merge-surface-zero` on the same files and are parked below with reasons.

## Phase 1 — One measured baseline

- [x] **1.1 Write the measured redundancy baseline.** Create
      `agents/evidence/analysis/redundancy-baseline-2026-08-25.md` recording each
      confirmed count with the command that produced it, plus the four
      corrections the verification pass found against the inbox claims: the
      entry-guard block is 534 files, not 373; `REPO_ROOT` declarations are 245
      but only 29 use the two-level depth, so the copies are not
      interchangeable; `ArgparseExit` is 37 but the sibling classes `ArgError`
      and `ArgExit` add 39 more; the jscpd figure is unverifiable here because
      neither `jscpd` nor `ast-grep` is a dependency.
      verify: `grep -c '^| ' agents/evidence/analysis/redundancy-baseline-2026-08-25.md`
      returns at least 12 rows, and every command quoted in the file reproduces
      its stated number when run.

- [x] **1.2 Record the seven divergent shipped twins as a table.** In the same
      artefact, list each `src/scripts/<n>.ts` against
      `src/agent-src/templates/scripts/<n>.ts` with its measured `diff -u` line
      count, and state the observed fact that `package.json` `files` carries
      both paths, so both copies reach consumers with no sync mechanism between
      them. Facts only — no side is declared correct here.
      verify: the table has exactly 7 rows and each named file pair exists.

## Phase 2 — One authority, cited at all three moments

- [ ] **2.1 Write the shared redundancy taxonomy as one guideline.** Create
      `docs/guidelines/redundancy-taxonomy.md` holding the implementation
      classes (exact clone, renamed clone, near clone, structural pattern,
      boilerplate, test repetition, intentional independence, wrong
      abstraction), the knowledge classes (knowledge, policy, contract and
      delivery-authority duplication), the representation classes (exact echo,
      paraphrase echo, structural narration, decorative metadata, feedback echo,
      accessibility conflict), the verdict set, and the Information Delta Test.
      `keep-duplicated` and `de-abstract` are stated as successful verdicts, and
      an accessibility conflict is a hard guard that never becomes a deletion.
      One authority, three consumers — a taxonomy copied into three carriers
      would be the defect this roadmap is about.
      verify: `test -f docs/guidelines/redundancy-taxonomy.md` and the file names
      all six representation classes and both keep-side verdicts.

- [ ] **2.2 Point the authoring moment at it.** In
      `docs/guidelines/code-clarity.md`, add the Information Delta Test as the
      decision procedure the existing comment-discipline section already implies
      but never states, and link the taxonomy for the representation classes.
      No new rule and no new skill: both source consolidations converged on the
      finding that new prose carriers are themselves the redundancy problem.
      verify: `grep -c 'redundancy-taxonomy' docs/guidelines/code-clarity.md`
      returns at least 1, and `./scripts-run src/scripts/check_references --quiet`
      exits 0.

- [ ] **2.3 Give the review moment a real redundancy dimension.** In
      `src/skills/code-review/SKILL.md`, replace the bare `DRY` token in the
      Quality dimension with a dimension that names the taxonomy, requires a
      verdict rather than a finding, and states the diff-aware rule: newly
      introduced high-confidence knowledge duplication is the finding, existing
      duplication is baseline and does not block an unrelated change.
      verify: `grep -c 'redundancy-taxonomy' src/skills/code-review/SKILL.md`
      returns at least 1 and the bare `DRY,` token is gone.

- [ ] **2.4 Gate the refactoring moment.** In
      `src/skills/code-refactoring/SKILL.md` — which today carries zero
      redundancy content while being the skill that performs extractions — add
      the safe-abstraction check that runs before any extract: is this the same
      knowledge, does it change for the same reason, is there one honest name at
      every call site, can the core stay free of caller flags, and would a
      future divergence be a defect or legitimate evolution. A `keep-duplicated`
      outcome ends the refactor successfully.
      verify: `grep -c 'redundancy-taxonomy' src/skills/code-refactoring/SKILL.md`
      returns at least 1, and `./scripts-run src/scripts/skill_linter --quiet`
      exits 0.

- [ ] **2.5 Regenerate the projections.** Run `task sync` then
      `task generate-tools` so `dist/agent-src/` and the per-tool trees carry the
      edited skills.
      verify: `git status --short dist/agent-src` shows the two edited skills and
      `./scripts-run src/scripts/check_condensation --quiet` exits 0.

## Phase 3 — The delivery defect, decided by its owner

- [ ] **3.1 Name the ADR the twins need.** Add a short proposal section to the
      baseline artefact stating what an ADR must settle: whether
      `src/scripts/` becomes the sole authority with the template copies
      generated at build time, and what happens to consumers pinned to the
      current template behaviour.
      verify: the section names both alternatives and the consumer-impact
      question.

- [~] **3.2 Decide the intended behaviour per divergent twin.** Seven pairs,
      up to 980 diff lines each. Which side is correct is a behavioural
      judgement per file, not a mechanical one, and each resolution is a bugfix
      that changes what consumers already run. Deferred to the maintainer with
      the Phase 1.2 table as its input.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-25 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The taxonomy becomes prose nobody reads | product | A guideline that three carriers link but no gate enforces is exactly the attention-dilution the source documents warn about; it can be added and change nothing | Enforcement is deliberately out of scope until the corpus exists; the carriers cite one authority rather than restating it, so the cost is one file, and the parking lot names the measurement that would justify a gate | Phase 2 — One authority, cited at all three moments |
| 2 | A review dimension that fires on legacy debt | implementation | A redundancy dimension with no diff-awareness turns every unrelated PR red against 534 pre-existing entry-guard copies | 2.3 states the diff-aware rule as part of the dimension itself: new duplication is the finding, existing duplication is baseline | Phase 2 — One authority, cited at all three moments |
| 3 | The safe-abstraction check reads as permission to skip extraction | implementation | `keep-duplicated` as a first-class verdict can be quoted to avoid any consolidation work | The check requires a named verdict with its reason, so a keep decision is recorded and reviewable rather than silent | Phase 2 — One authority, cited at all three moments |
| 4 | Baseline numbers rot before they are used | implementation | Counts measured today drift as the tree moves, and a stale baseline is worse than none because it looks like evidence | Every row carries the command that produced it, so any consumer can re-derive rather than trust the number | Phase 1 — One measured baseline |

## Acceptance Criteria

- [ ] AC-1 — One file states the redundancy taxonomy and verdict set, and the
      authoring, review and refactoring carriers each cite it rather than
      restating it.
- [ ] AC-2 — `src/skills/code-refactoring/SKILL.md` cannot reach an extraction
      without a recorded verdict, and `keep-duplicated` is available as a
      successful outcome.
- [ ] AC-3 — A reader can reproduce every number in the baseline artefact from
      the commands it quotes, and the four corrections against the inbox claims
      are visible there.
- [ ] AC-4 — The seven divergent shipped twins are recorded with measured diff
      sizes and the decision is in front of the maintainer, not guessed.

## Parking lot — deliberately not now

- **Spine extraction** (entry guard 534, `python_compat`, `_lib/cli.ts`,
  `_lib/schema.ts`): ~500 files of churn against an active
  `road-to-merge-surface-zero` with 13 open steps on the same surface. Needs
  that roadmap closed first.
- **`REPO_ROOT` consolidation**: measured refutation — 245 declarations, 29 at
  the two-level depth. The copies encode different caller depths, so the verdict
  today is `keep-duplicated` until caller-location tests exist.
- **Clone-detector dependency** (`jscpd`, `ast-grep`): neither is a dependency,
  so the 45,807-line figure is unverified. Adding a scanner is a supply-chain
  intake decision, not an analysis step.
- **Gate kernel / gate consolidation** (134 `check_*` + 135 `lint_*`, 441
  taskfile references): a real finding, and a separate program.
- **Mechanical comment and label linters**: both source consolidations require a
  validated corpus before any such gate is written. The corpus does not exist.
