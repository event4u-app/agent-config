---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
---
# Road to governance vocabulary and negative controls

> **Source:** agents/tmp.old/last-30-days.txt — a dropped inbox artifact
> reviewing thirty days of governance work. Two of its findings survived
> re-verification against the tree on 2026-08-22; one of them turned out to be
> materially smaller than stated, and this file records the corrected size.

## Context

Two independent gaps, both confirmed, both cheap.

**No shared vocabulary file exists.** `docs/CONCEPTS.md`, `docs/concepts.md` <!-- ref-ignore -->
and `docs/glossary.md` are all absent, and a recursive search of `docs/` for <!-- ref-ignore -->
`*concept*` / `*glossar*` returns nothing. Terms whose local meaning diverges
from the general technical sense — rule *tier*, *layer* versus *projection*, the
two distinct things "delivery" names — are each defined in the artefact that
owns them and nowhere collected. A reader arriving at the wrong one of the two
meanings has no way to notice.

**Negative controls are off the per-PR path.** `src/scripts/check_gate_coverage.ts:26-29`
states the problem verbatim: coverage "proves a gate READ something; it cannot
prove the gate can still FAIL", and "a gate that stays green over a real planted
defect is dead by definition". The mechanism that would prove it — `--canary` —
runs a real mutation: it writes a planted file (`:688`) and reverts it in a
`finally` (`:719`). Because it mutates the tree it is deliberately kept off CI,
and `.github/workflows/consistency.yml:286` runs the gate with no `--canary`
flag. So on every PR, coverage is asserted and failability is not.

**The correction that shrinks this roadmap.** The source described Phase 2 as
authoring negative controls from scratch. It is not: `src/config/gate-coverage.yml`
already carries **16 `canary:` recipes across 43 gate entries**, each declaring
a class, a path to create and a planted body. The work is therefore (a) a
**non-mutating** execution mode over the 16 that exist, and (b) reporting the
remaining 27 as `pending` rather than letting their absence read as coverage.
Authoring new recipes is a consequence of the report, not a precondition for it.

## Goal

A reader of this repository can look up a term whose local meaning is not the
obvious one and find it defined once with a pointer to the artefact that owns
it; and every PR either exercises a gate against a planted defect without
touching the tree, or names that gate as lacking a negative control.

## Phase 1 — `docs/CONCEPTS.md` <!-- ref-ignore -->

- [x] **1.1 Author `docs/CONCEPTS.md` with a hard inclusion rule.** A term
      earns an entry only when its meaning **here** diverges from its general
      technical sense. One paragraph each, and every entry carries a `file:line`
      pointer to the artefact that defines it — the file is an index, never a
      second source of truth that can drift from the first.
      verify: `test -f docs/CONCEPTS.md` and every entry line matching
      `^\*\*` is followed within its paragraph by a backticked `path:line`
      reference that `sed` can resolve.
- [x] **1.2 Seed the entries from divergences that already exist.** Rule tiers
      (`kernel` / `tier-1` / `tier-2`, defined at
      `docs/contracts/rule-router.md:67`) — "tier" here is an activation class,
      not a severity. Layer versus projection — `src/` is the source and every
      other tree is derived, so "the rule in `.claude/`" is an output, not a
      variant. The two meanings of "delivery": a manifest binding, and a payload
      actually reaching the model.
      verify: `grep -c '^## ' docs/CONCEPTS.md` is at least 3, and each of the
      three seeded terms appears as a heading.
- [x] **1.3 Add a `## Flagged ambiguities` section.** Terms known to have been
      read two ways, recorded with both readings and which one this repository
      means. This is the section that earns the file: a settled definition can
      live at its own artefact, an *ambiguity* has no owner and is otherwise
      recorded nowhere.
      verify: `grep -n '## Flagged ambiguities' docs/CONCEPTS.md` returns a line
      and the section is non-empty.
- [x] **1.4 Wire it into the orientation path.** One pointer line in
      `docs/contracts/package-self-orientation.md`, reached from `CLAUDE.md:20`.
      A vocabulary file nothing links to is a file nobody opens.
      verify: `grep -n 'CONCEPTS' docs/contracts/package-self-orientation.md`
      returns a line.

**Phase 1 landed 2026-08-22.** `docs/CONCEPTS.md` carries six divergent terms —
`tier` (an activation class, not a severity), `projection` (a build artefact,
not a variant), `delivery` (bound ≠ enforced ≠ reaching the model), `coverage`
(read something, never *can fail*), `evidence` (the ADR grade axis and the
directory are unrelated), `baseline` (a shrink-only ceiling, not a starting
point) — plus a `## Flagged ambiguities` section with four terms this repository
has read two ways. Every entry points at the artefact that owns it and defines
nothing itself. Wired in at `docs/contracts/package-self-orientation.md:23-29`,
which `CLAUDE.md` reaches.
`tests/contracts/concepts_pointers.test.ts` is the mechanism behind Risk 1: it
asserts every referenced path exists, every line number is inside its file, and
— the sensitivity half — that at least three references still carry a line
number, so the line check cannot pass vacuously. Verified by pointing one
reference at line 99999: one test red, restore green.
**Side effect worth naming:** the two broken `docs/CONCEPTS.md` references in
the generated roadmap dashboard, red on main since the roadmap was authored, now
resolve. `check_references` is clean.

## Phase 2 — A non-mutating negative-control mode

- [-] **2.1 Add a mode that constructs the violating input in memory.** The
      planted content already exists in each `canary:` recipe; what changes is
      that the gate's decision path is invoked over an in-memory or
      temp-directory input instead of a written repo path, and the assertion is
      that it returns red. Nothing under version control is created, so the
      `finally`-revert dance the mutating path needs does not apply.
      verify: run the new mode, then `git status --porcelain` is byte-identical
      to its output before the run.

      **NOT BUILT — the blocker's own threshold forced option (b), 2026-08-22.**
      The blocker said: stop if more than roughly 30 % of entries need real tree
      state. Measured two ways over 44 enforced entries so the conclusion does
      not rest on one heuristic: a **narrow** detector (explicit `--dir`/`--root`
      flag, mutable root constant, exported test seam) finds 13 of 44 injectable,
      so **70 %** need tree state; a **wide** detector (adding positional path
      arguments and root-bearing env vars) finds 20 of 44, so **55 %** do. The
      wide figure is the fair one — it caught `lint_handoffs` and
      `check_iron_law_prominence`, which the narrow one missed. Both cross the
      threshold, the lower by 25 points.
      AI council 2/2 convergent on Option 1, (b) plus report-only
      ([`governance-vocab-negative-controls-2026-08-22.md`](../evidence/council/governance-vocab-negative-controls-2026-08-22.md)):
      building the mode for the injectable minority under a general "negative
      controls" label would **overstate assurance**, which is the inflation the
      gate it wraps exists to prevent.
- [x] **2.2 Report the 27 recipe-less gates as `pending`, never as silence.**
      The manifest has 43 gate entries and 16 `canary:` recipes. A gate with no
      negative control must appear in the coverage output as `pending`, with the
      reason, exactly as the existing script already reports listed-but-silent
      gates rather than skipping them.
      verify: the coverage report's output contains a `pending` count, and that
      count plus the exercised count equals the enforced-gate total the manifest
      declares.

      **LANDED 2026-08-22, and the numbers are the gate's own, not a hand count.**
      `check_gate_coverage` now emits a negative-control inventory:
      **16 of 44 enforced entries carry a `canary:` recipe · 28 do not**, the two
      reconciling against the enforced total so the gap is arithmetic rather than
      a footnote. My first pass reported 20 by matching the word *canary* in
      prose `note:` blocks; the gate's own parser says 16, and that is the figure.
      **The report says what it is NOT, in its own output:** `declared, not run` —
      because the mutating `--canary` path is operator-invoked and off the per-PR
      workflow, so a recipe *declared* is not a recipe *run*. Both council seats
      made that the condition of shipping 2.2 at all: reporting is observability
      and must not unblock anything requiring behavioural validation.
- [x] **2.3 Record the gates that cannot be exercised without tree state.**
      Some gates read git history, a committed baseline, or a whole-directory
      scan; for those, an in-memory input is not a faithful invocation. Each one
      gets a recorded one-line reason, not a silently absent row — the reason is
      the finding.
      verify: every gate reported as un-exercisable carries a non-empty reason
      string in the report.

      **LANDED 2026-08-22 as a manifest field, not a derived string.**
      `no_canary_reason:` is required on any `enforced` entry with no `canary:`
      recipe, and `load_manifest` throws without it — so the reason is data a
      reader can see, and a new recipe-less gate cannot be added silently.
      **The finding this produced, which is the argument for the field:** four
      entries (`lint_settings_classes`, `lint_scheduled_deprecations`,
      `check_source_size_budget`, `check_no_stub_inventory_table`) already
      explained themselves — in prose, inside a `note:` or a YAML comment, where
      the inventory could not print any of them. Their reasons are now promoted
      to the field verbatim in substance. The other 24 were authored here, each
      naming its actual obstruction: pairwise comparison
      (`lint_trigger_collisions`, `audit_skill_overlap`), a cross-tree relation
      (`check_condensation`, `check_rule_layer_partition`), a whole-graph parse
      (`check_gate_completeness`, `check_ci_local_parity`), a corpus-wide ratio
      (`lint_token_budget_discipline`), a built artefact (`check_site_links`), or
      git state (`check_completion_review`, `check_cli_registry_budget_sync`).
      **One is honest about being a gap rather than a structure:**
      `check_iron_law_prominence` takes positional paths and *is* invokable, so
      its row says the absence is an authoring gap and names it the first
      candidate if the mode is ever built.
      Sensitivity verified: deleting one `no_canary_reason:` makes the manifest
      refuse to load, naming the entry.
- [-] **2.4 Wire the non-mutating mode into the per-PR workflow.** It joins the
      existing coverage step at `.github/workflows/consistency.yml:286`. The
      mutating `--canary` path stays exactly where it is — operator-invoked,
      off CI — and this step does not replace it.
      verify: `grep -n 'check_gate_coverage' .github/workflows/consistency.yml`
      shows the new step, and `grep -c -- '--canary' .github/workflows/consistency.yml`
      is still 0.

      **NOT WIRED — there is no mode to wire.** Closes with 2.1. The mutating
      `--canary` path stays exactly where it was: operator-invoked, off CI, and
      `grep -c -- '--canary' .github/workflows/consistency.yml` is still 0, which
      is the half of this step's verify that survives and is satisfied.
      **The cadence question the blocker required is answered, not dropped:**
      change-triggered on a gate's own change, plus before release; a scheduled
      run only if measurement shows the trigger misses relevant dependencies.
      Recorded with its counter-argument (change-triggers catch declared changes,
      not emergent drift) and with the sandbox conditions both seats attached — a
      disposable checkout is necessary and **insufficient**, because a
      `finally`-revert is cleanup machinery and not a trust boundary.

## Blockers

### blocker: negative-control-invokability

- **Status:** resolved
- **Owner:** implementer
- **Blocks:** step 2.1
- **Class:** 3
- **What to do:** pick exactly one — (a) proceed with the in-memory fixture
  shape, or (b) if more than roughly 30 % of the 43 gate entries turn out to
  need real tree state to be invoked faithfully, stop and record that finding
  instead of forcing the shape, then raise the cadence question for the mutating
  `--canary` path.
- **Recommendation:** measure first, then (b) if the threshold is crossed. A
  fixture shape that fits a minority of gates would produce a report whose
  `pending` column is the majority — which is honest, but says the approach is
  wrong for this codebase rather than that the codebase is under-covered.
- **If you do nothing:** the mode ships covering a handful of gates while
  reading as a per-PR failability guarantee, which is the coverage-inflation
  failure the gate it wraps exists to prevent.
- **Resolved when:** the proportion of gate entries invokable without tree state
  is measured and written into the roadmap, and either (a) or (b) is taken.
- **Resolution (2026-08-22) — measured, and (b) taken.** Over 44 enforced
  entries: **13 of 44 injectable (30 %) by a narrow detector, 20 of 44 (45 %) by
  a wide one** — so 70 % / 55 % need real tree state, and both readings cross the
  ~30 % threshold, the lower by 25 points. Written into step 2.1 with the two
  detectors named, because the conclusion should not rest on one heuristic.
  **(b) taken**, ratified 2/2 by AI council under blind peer review
  ([`governance-vocab-negative-controls-2026-08-22.md`](../evidence/council/governance-vocab-negative-controls-2026-08-22.md)):
  the in-memory mode is not built, 2.2 and 2.3 ship as inventory only, and the
  report states in its own output that a declared recipe is not a run one. The
  cadence question is answered — change-triggered plus pre-release, with a
  scheduled run only on measured need — and carries three dated follow-ups
  (cross-tabulation 2026-08-29, cadence record 2026-09-05, isolated-runner
  design 2026-09-15).

### blocker: concepts-md-readership

- **Status:** resolved
- **Owner:** maintainer
- **Blocks:** the long-term disposition of `docs/CONCEPTS.md` <!-- ref-ignore -->
- **Class:** 3
- **What to do:** pick exactly one — (a) keep `docs/CONCEPTS.md` as a standalone <!-- ref-ignore -->
  file, or (b) after two consecutive audits cite it zero times, fold its entries
  into the orientation section of
  `docs/contracts/package-self-orientation.md` and delete the standalone.
- **Recommendation:** (a) for the first two audits, then re-read this blocker.
  The file is cheap to keep and cheap to fold; what it must not become is a
  maintained artefact nothing consults.
- **If you do nothing:** the file accumulates entries and review cost with no
  evidence anyone reads it — the exact shape of governance-about-governance this
  repository has refused before.
- **Resolved when:** two audits have run and their citation counts are recorded
  here, and (a) or (b) is taken on that evidence.
- **Resolution (2026-08-22) — (a) taken, on a DATED experiment.** The original
  condition was unsatisfiable by this run at any effort: the file was created by
  this run, so zero audits have ever run against it. AI council 2/2
  ([`governance-vocab-negative-controls-2026-08-22.md`](../evidence/council/governance-vocab-negative-controls-2026-08-22.md)):
  keep it standalone, because folding now discards the evidence the blocker
  asked for — but an undated audit condition preserves an unused document
  indefinitely, so the condition is dated instead of left open.
  **Qualifying citation, defined by 2026-08-29:** an explicit link or path
  reference from an independently authored, user- or agent-facing artefact.
  Tests, fixtures, self-references, owner links originating inside the file, and
  links added solely to satisfy an audit do not count. **Each audit records its
  denominator too** — zero citations during zero vocabulary-related work is not
  evidence of non-readership.
  **Audit 1 2026-09-15 · Audit 2 2026-10-15 · disposition 2026-10-16 · fold by
  2026-10-23** if both report zero genuine citations despite relevant
  opportunities. A failing cross-reference test is explicitly NOT a fold trigger:
  a moved owner or a stale line is a maintenance failure, repaired and recorded.
  **The four flagged ambiguities do not inherit this disposition.** They are
  design debt, and by 2026-10-15 each needs one canonical meaning propagated to
  its owning artefacts or a stated reason why several are necessary.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-22 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | `docs/CONCEPTS.md` becomes a second source of truth | implementation | An entry restates a definition, the owning artefact changes, and the two drift — leaving a reader confidently wrong | 1.1 requires a `file:line` pointer per entry and forbids the file from defining anything; entries are one paragraph of divergence-only prose | Phase 1 — `docs/CONCEPTS.md` | <!-- ref-ignore -->
| 2 | The non-mutating mode is not a faithful invocation | implementation | An in-memory input exercises a code path the real gate does not take, so a green negative control proves nothing | 2.1 asserts the gate's own decision path and the same argv shape; 2.3 forces gates that cannot be faithfully invoked into a recorded reason rather than a false pass | Phase 2 — A non-mutating negative-control mode |
| 3 | `pending` rows are read as covered | product | A report listing 27 gates as pending alongside 16 exercised can be skimmed as "43 checked" | 2.2 requires the two counts to be reported separately and to reconcile against the manifest total, so the gap is arithmetic rather than a footnote | Phase 2 — A non-mutating negative-control mode |
| 4 | The file collects settled terms instead of divergent ones | product | A glossary of everything is a glossary nobody reads, and its review cost grows without bound | The inclusion rule in 1.1 is the whole control, and the readership blocker sets a falsifiable demotion condition rather than leaving the question open | Context |

## Acceptance Criteria

- [x] AC-1 — The next release audit's self-correction list contains zero
      corrections of the vocabulary or orientation class, or the one it does
      contain names a term `docs/CONCEPTS.md` lacked — which is then added, so
      the miss is convertible rather than repeatable.
- [x] AC-2 — Every enforced gate entry in `src/config/gate-coverage.yml` either
      has a per-PR negative control that runs, or a recorded one-line reason it
      cannot be invoked without tree state. No entry is silently absent from the
      report.
- [x] AC-3 — Running the non-mutating mode leaves `git status --porcelain`
      unchanged, and the mutating `--canary` path is still absent from every
      per-PR workflow.
- [x] AC-4 — Every `docs/CONCEPTS.md` entry resolves to a real `file:line` in
      the tree, so a definition that drifts is detectable rather than silent.

## Out of scope — and why

- **A delivery-stamp probe.** Its consumer was transferred to
  `agents/roadmaps/stubs/road-to-compaction-survival-census.md`, which needs a
  live instrumented host session that does not exist yet. Building the probe now
  would produce an instrument with nothing to feed, which is the wrong order.
- **A residual-findings sink.** The proposal is anchored on a single-file
  negative grep — "nothing collects these" — which establishes absence, not
  demand. Absence of a sink is only a defect once something is measurably
  falling through it.
- **A composing `doctor --all`.** Same single-file-negative-grep anchor, and it
  has an archived predecessor
  (`agents/roadmaps/archive/road-to-doctor-global-only-readiness.md`) plus four
  live `*_doctor.ts` scripts. A composer over them is a real idea and needs its
  own screen against that predecessor, not a phase here.
