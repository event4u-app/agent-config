---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
relates: []
# relates: manual sweep over agents/roadmaps/**/*.md on 2026-09-04 for
# `fault injection`, `guard coverage`, `swallow`, `self-description` — the one
# close artefact, archive/road-to-self-description-truth.md, is complete and
# covered four named instances, not the class. No open roadmap or stub owns any
# of the three sweeps below.
estate_offset_exempt: "Cannot be offset. Every active roadmap at the floor is either owner-blocked or one day old, and the three sweeps here have counted populations in this tree — a silent swallowed write in a security hook among them — that no other active roadmap can absorb without losing its own subject."
estate_growth_exempt: "Adds one active roadmap against a floor of 1. Its three items are one shape — a defect fixed at the site it was reported and never searched for elsewhere — and each carries a counted, verified population from this tree, which is what separates it from the two sibling roadmaps in this change (a parser fix and a ledger). Folding it into either would bury three sweeps under an unrelated subject. Parking it leaves a silent swallowed write live in a security hook, in the same class a commit in the same release rebutted by name one file away."
---
# Road to defect-population sweeps

> **Source:** `agents/tmp.old/inbox-2026-09-e/` — an external multi-model review
> round on release 14.16.0. One reviewer named the shape directly: *"Das ist
> viermal dasselbe Muster: eine Komponente **behauptet** eine Eigenschaft, die
> sie nicht **erfüllt**"*, and another asked for a fault-injection test over every
> guard write path. Every population count below was taken from this tree at
> `main@56aa348b3`, not from the review.

## Goal

Three defect classes this package fixed at one site each are searched across
their whole population, the count is recorded, and the mechanism that would have
found the remaining instances exists rather than being promised.

The shape is the one [`downstream-changes`](../../src/rules/downstream-changes.md)
§ Defect-pattern search already requires — *name the exact wrong construct, grep
the tree, report the count* — applied to three cases where it demonstrably did
not run.

## Phase 1 — The swallowed write, counted

The 14.16.0 commit `1cf8f708` ("stop swallowing a failed write") repaired two
sites in `src/scripts/git_authorization_hook.ts` (`:1073-1084`, `:1220-1230`) and
wrote the argument into the code:

> *"'Observability only' was the reason given for writing nothing, which inverted
> the word: a grant that silently fails to be consumed is a capability that
> outlives its single use, and the operator has no way to know."*

Grepping the exact phrase it rebuts finds it still live at two further sites:

| site | construct |
|---|---|
| `src/scripts/hooks/block_unauthorized_git.ts:934-936` | `catch { /* observability only — see above */ }` around `atomic_write_json` of the pending-refusal record. The `see above` points at nothing in that file |
| `src/scripts/hooks/evidence_independence.ts:366-370` | `catch { /* observability only */ }` around `atomic_write_json` of the evaluation-count state |

`src/scripts/language_mirror_hook.ts:605-615` is a third occurrence of the phrase
and is **not** a defect: it is a docblock reasoning about exactly this hazard for
its own catch. It is listed because a grep will return it and the next reader
should not have to re-decide it.

Denominator for the sweep: **26** files under `src/scripts/hooks/` contain
`atomic_write_json`, `writeFileSync` or `appendFileSync`; **33** `catch {` blocks
in that directory swallow without a diagnostic.

- [ ] **1.1 Repair the two live sites.** Each gets the treatment `1cf8f708`
      gave its siblings: a stderr line naming what failed, what the failure
      direction is, and what the operator can no longer rely on. The failure
      *direction* is not being changed — best-effort stays best-effort; what
      changes is that it stops being invisible.
      verify: both sites write to stderr on a failed write, and the dangling
      `see above` either points at a real neighbour or is removed.
- [ ] **1.2 Extend the fault-injection pattern to both.**
      `tests/scripts/git_auth_observability_and_bounds.test.ts:62-130` already
      does this properly — `fs.chmodSync(dir, 0o500)`, then asserts the
      diagnostic text. The same shape covers the two new sites.
      verify: each test fails when its 1.1 fix is reverted. A fault-injection
      test never seen red has unknown sensitivity.
- [ ] **1.3 Report the count for the rest of the population.** The 33 silent
      catches are not all defects — most guard reads, absent files, or optional
      paths. Classify them once: which sit around a **write** whose failure
      changes what a later run may do, and which do not. The output is a
      committed count and a list, not a sweep of edits.
      verify: the census names every write-adjacent silent catch under
      `src/scripts/hooks/` with a one-line verdict each, and the two repaired in
      1.1 appear in it as repaired.

## Phase 2 — Guard coverage, enumerated rather than frozen

`tests/scripts/git_auth_destructive_coverage.test.ts` (added 2026-09-03) is a
**frozen table** of the 25 operations probed on 2026-09-02 (`:1-17`), with a
generative assertion only over `BLOCK_OPS` (`:123`, `:129-130`). It enumerates
nothing from a truth source and covers one guard.

- [ ] **2.1 Name the truth source, or state that there is none.** A coverage
      test that cannot enumerate its own subject is a snapshot, and a snapshot
      goes stale silently. Either the operation set is derivable (from
      `BLOCK_OPS`, from the hook manifest, from a declared table), in which case
      the test derives it — or it is not, in which case the file says so in one
      line and the freeze becomes a stated limit rather than an implied
      completeness.
      verify: the test either enumerates from a named source and fails when that
      source gains an unprobed entry, or carries the one-line statement.
- [ ] **2.2 Say which guards are covered and which are not.** The audit today
      is one guard. The honest artefact is the list of guards with a covered /
      uncovered verdict each — the same posture `check_enforcement_coverage`
      takes for rules.
      verify: the list exists, names every `pre_tool_use` guard in the manifest,
      and its uncovered entries are uncovered rather than absent.

## Phase 3 — A checkable claim gets a resolver, or an honest gap

`archive/road-to-self-description-truth.md` closed four named instances of
"asserts a property it does not satisfy" and is complete. The 14.16.0 cycle then
produced four MORE of the same shape, and exactly one of them got a resolver:

| fix | what it left behind |
|---|---|
| `2bd8e506` accessibility WCAG version | `tests/scripts/accessibility_wcag_version_claim.test.ts` — a resolver |
| `4461e319` iconography default | prose only |
| `bb857f11` `security-sensitive-stop` reachability | one routing-matrix fixture |
| `8ded7ff5` python-era paths | doc edits only |

The precedent for the general form already exists and is not this file's
invention: `src/scripts/lint_rule_enforcement_declaration.ts` requires a new rule
to declare `enforced_by:` or to say `none` with a reason in the body, with a
baseline ratchet over the pre-existing rules.

- [ ] **3.1 Apply that shape to version, reachability and path claims.** A
      skill or rule asserting a checkable property either names the resolver
      that checks it or states the gap. Scope it to the three claim kinds the
      cycle actually produced — a version, a reachability, a path — and not to
      "any claim", which is the coverage engine two reviewers explicitly warned
      against building.
      verify: the check fails on a planted skill claiming a WCAG version with no
      resolver, and passes when the claim names one or declares the gap. Both
      directions, in one test.
- [ ] **3.2 Ratchet, do not retrofit.** The existing population is large and the
      precedent handles this: a committed baseline, new claims held to the bar,
      the baseline only ever falling.
      verify: the baseline file exists with its count, and adding an undeclared
      claim reds the gate while the baseline count is unchanged.
- [ ] **3.3 Fix the instance in the record of the class.**
      `agents/roadmaps/archive/road-to-self-description-truth.md:3` carries
      `status: ready` while sitting in `archive/` with every box checked — the
      roadmap that closed this defect class carries an instance of it in its own
      frontmatter.
      verify: the frontmatter status matches the file's location, and a grep for
      `status: ready` under `agents/roadmaps/archive/` returns nothing, or the
      remaining hits are listed with a reason.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-09-04 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The 33 silent catches become 33 edits | product | A census that turns into a sweep is the drive-by refactor `minimal-safe-diff` forbids, and most of those catches are correct — they guard reads and optional paths | 1.3 produces a count and a list with verdicts, explicitly not edits; only the two write-adjacent sites named in 1.1 are touched | Phase 1 — The swallowed write, counted |
| 2 | Phase 3 grows into the coverage engine two reviewers warned against | product | "Every claim needs a resolver" is one generalisation step away from a global semantic-consistency registry, which both the review round and the tree's own prior decisions reject | 3.1 fixes the scope to the three claim kinds the cycle produced and requires a planted-negative test, so the bar is a measured class rather than an ambition | Phase 3 — A checkable claim gets a resolver, or an honest gap |
| 3 | The guard-coverage list reads as completeness | implementation | Turning a frozen table into an enumerated one makes it look authoritative, and the enumeration source may itself be partial | 2.2 requires uncovered guards to appear as uncovered rather than be omitted, which is the difference between a list and a claim | Phase 2 — Guard coverage, enumerated rather than frozen |

## Acceptance Criteria

- [ ] AC-1 — Neither `block_unauthorized_git.ts` nor `evidence_independence.ts`
      swallows a failed write without a diagnostic, and reverting either fix
      turns its fault-injection test red.
- [ ] AC-2 — A committed census names every write-adjacent silent catch under
      `src/scripts/hooks/` with a verdict, and states the denominator it was
      taken from.
- [ ] AC-3 — The guard-coverage test either enumerates its operation set from a
      named source or states that it is a dated freeze, and a per-guard
      covered/uncovered list exists.
- [ ] AC-4 — A skill or rule asserting a version, a reachability or a path either
      names its resolver or declares the gap, enforced by a ratcheted gate that
      fails on a planted undeclared claim.
- [ ] AC-5 — No file under `agents/roadmaps/archive/` claims `status: ready`.
