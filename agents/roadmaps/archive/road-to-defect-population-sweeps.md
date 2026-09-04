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
> sie nicht **erfüllt**"*, and another asked for a fault-injection test over every <!-- md-language-check: ignore -->
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

- [x] **1.1 Repair the two live sites.** Each gets the treatment `1cf8f708`
      gave its siblings: a stderr line naming what failed, what the failure
      direction is, and what the operator can no longer rely on. The failure
      *direction* is not being changed — best-effort stays best-effort; what
      changes is that it stops being invisible.
      verify: both sites write to stderr on a failed write, and the dangling
      `see above` either points at a real neighbour or is removed.
      → **Two corrections to this step's premise, both checked at the
      `main@56aa348b3` this file cites.** (a) The phrase sweep over `src/**/*.ts`
      finds **four** live instances, not two: `language_mirror_hook.ts:634` and
      `:1128` are the identical construct and sit outside the
      `src/scripts/hooks/` directory this roadmap scoped its census to. Council
      2026-09-04 (anthropic + openai, quorum 2/2, $0.0359) was **unanimous** that
      the Risk-Register bound was aimed at the 47 generic silent catches, not at
      further instances of the exact rebutted phrase — all four are repaired.
      (b) The dangling `see above` **is not dangling**: at `56aa348b3` it points
      at the four-line comment directly above its own `try`, which explains the
      degradation correctly. The claim was false when written. The comment is
      replaced anyway, because the diagnostic supersedes it.
- [x] **1.2 Extend the fault-injection pattern to both.**
      `tests/scripts/git_auth_observability_and_bounds.test.ts:62-130` already
      does this properly — `fs.chmodSync(dir, 0o500)`, then asserts the
      diagnostic text. The same shape covers the two new sites.
      verify: each test fails when its 1.1 fix is reverted. A fault-injection
      test never seen red has unknown sensitivity.
      → `tests/scripts/hook_write_swallow_observability.test.ts`, 10 tests. Each
      of the **four** fixes was reverted individually by file copy and the suite
      observed red, then restored: site 1 → 3 red, site 2 → 3 red,
      `language_mirror:634` → 2 red, `language_mirror:1128` → 1 red.
- [x] **1.3 Report the count for the rest of the population.** The 33 silent
      catches are not all defects — most guard reads, absent files, or optional
      paths. Classify them once: which sit around a **write** whose failure
      changes what a later run may do, and which do not. The output is a
      committed count and a list, not a sweep of edits.
      verify: the census names every write-adjacent silent catch under
      `src/scripts/hooks/` with a one-line verdict each, and the two repaired in
      1.1 appear in it as repaired.
      → `agents/evidence/analysis/hook-silent-write-catch-census-2026-09-04.md`.
      **The population was 47, not 33** — 26 write-bearing files, 252 catch
      clauses, 242 silent, 47 of those write-adjacent. The roadmap's `33` matches
      neither measurement and names no construct; recorded as unreproducible
      rather than reconciled. Verdicts: 2 repaired, 21 advisory-state, 13
      idempotent-delete, 11 not-silent (a classifier false positive kept in the
      table because the catch propagates the failure as a RETURN VALUE).

## Phase 2 — Guard coverage, enumerated rather than frozen

`tests/scripts/git_auth_destructive_coverage.test.ts` (added 2026-09-03) is a
**frozen table** of the 25 operations probed on 2026-09-02 (`:1-17`), with a
generative assertion only over `BLOCK_OPS` (`:123`, `:129-130`). It enumerates
nothing from a truth source and covers one guard.

- [x] **2.1 Name the truth source, or state that there is none.** A coverage
      test that cannot enumerate its own subject is a snapshot, and a snapshot
      goes stale silently. Either the operation set is derivable (from
      `BLOCK_OPS`, from the hook manifest, from a declared table), in which case
      the test derives it — or it is not, in which case the file says so in one
      line and the freeze becomes a stated limit rather than an implied
      completeness.
      verify: the test either enumerates from a named source and fails when that
      source gains an unprobed entry, or carries the one-line statement.
      → **Both, because the file has two subjects with different truth
      conditions.** The OPERATION set is derivable — `BLOCK_OPS ∪ WARN_OPS`, 26
      ops — and is now enumerated, with a red when an op joins a tier unprobed
      (proved by injecting one). The COMMAND corpus is not derivable, because
      `commandOp` is a parser whose input language is infinite, and the file now
      states that it is a dated freeze. Measured: this file probes 17 of the 26;
      the other 9 predate 2026-09-03 and are probed in `git_authorization.test.ts`
      and `git_auth_merge_ops.test.ts`, so the derived assertion reads the
      three-file corpus rather than this file alone.
- [x] **2.2 Say which guards are covered and which are not.** The audit today
      is one guard. The honest artefact is the list of guards with a covered /
      uncovered verdict each — the same posture `check_enforcement_coverage`
      takes for rules.
      verify: the list exists, names every `pre_tool_use` guard in the manifest,
      and its uncovered entries are uncovered rather than absent.
      → `agents/evidence/analysis/pre-tool-use-guard-coverage-2026-09-04.md`,
      derived from the manifest and held current by
      `tests/hooks/pre_tool_use_guard_coverage.test.ts`. **15 guards, 14 covered,
      1 uncovered:** `design-slop` — three tests exercise its detector library
      (`lint_design_slop.ts`) and none imports `design_slop_hook.ts`, the concern
      entry point the dispatcher runs. Recorded as uncovered, not fixed. Both
      roster assertions proved sensitive (dropping a row and flipping a verdict
      each red the suite).

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

- [x] **3.1 Apply that shape to version, reachability and path claims.** A
      skill or rule asserting a checkable property either names the resolver
      that checks it or states the gap. Scope it to the three claim kinds the
      cycle actually produced — a version, a reachability, a path — and not to
      "any claim", which is the coverage engine two reviewers explicitly warned
      against building.
      verify: the check fails on a planted skill claiming a WCAG version with no
      resolver, and passes when the claim names one or declares the gap. Both
      directions, in one test.
      → `tests/contracts/conformance_claim_declaration.test.ts`. **Scoped to the
      version kind, deliberately.** The detector requires a conformance LEVEL
      (`WCAG 2.2 AA`), which is what separates a claim about this artefact from a
      citation of someone else's document — dropping it takes the population from
      2 to 8 by pulling in `RFC 9457`, `NIST SP 800-53` and a contrast-ratio
      mention, all of which are pinned as must-not-match. The other two kinds are
      **honest gaps, stated rather than built**: the PATH kind is already
      resolved by `check_references`, which reaches skill and rule prose
      transitively through `dist/agent-src/`; the REACHABILITY kind has no
      decidable artefact-level detector — every rule asserts what it fires on —
      and its existing mechanisms are the routing-matrix fixture pattern and
      `check_enforcement_coverage`'s frequency join. Declaration syntax is
      `enforced_by:`, REUSED rather than minted: council 2026-09-04 split
      (anthropic reuse / openai new key) with both rejecting body markers, and
      the split was resolved on measurement — `enforced_by` already exists on the
      rule schema, so reuse costs one schema addition where a new key costs two.
- [x] **3.2 Ratchet, do not retrofit.** The existing population is large and the
      precedent handles this: a committed baseline, new claims held to the bar,
      the baseline only ever falling.
      verify: the baseline file exists with its count, and adding an undeclared
      claim reds the gate while the baseline count is unchanged.
      → `src/config/conformance-claim-baseline.json`, **count 0**. The measured
      population was TWO artefacts, not the large legacy set this step
      anticipated, and both were declarable honestly in the same change:
      `accessibility-auditor` names its real resolver, `design-review` declares
      the gap with its mandatory reason. Proved by removing `design-review`'s
      declaration — a REAL undeclared claim, not a synthetic string — which red
      the ratchet while the baseline stayed 0. AC-4's word "gate" is satisfied by
      a contract test: council 2026-09-04 was **unanimous 2/2** that the ratchet
      is the load-bearing property and "gate" names the function, not the script
      kind — the same call the sibling resolver in this class made, for the same
      reason (a gate owes a coverage row, a self-test and a minimum-scan floor,
      and would worsen a `check-gate-completeness` count already red on main).
- [x] **3.3 Fix the instance in the record of the class.**
      `agents/roadmaps/archive/road-to-self-description-truth.md:3` carries
      `status: ready` while sitting in `archive/` with every box checked — the
      roadmap that closed this defect class carries an instance of it in its own
      frontmatter.
      verify: the frontmatter status matches the file's location, and a grep for
      `status: ready` under `agents/roadmaps/archive/` returns nothing, or the
      remaining hits are listed with a reason.
      → The named file is fixed (`status: completed`; 13 checked boxes, 0 open).
      **The population is 331, not one** — this step's second branch is taken and
      the remaining 330 are listed with their reason in
      `agents/evidence/analysis/archive-status-ready-population-2026-09-04.md`.
      They are not 330 mistakes: `archive_completed_roadmaps` moves a roadmap and
      never touches its frontmatter, so `status: ready` in `archive/` is the
      tool's own normal output and the finding is that a convention was assumed
      and never enforced. Council 2026-09-04 (2/2) ruled out the 331-file
      rewrite; it split on also changing the tool, resolved against by
      `minimal-safe-diff` and `scope-control` — a behaviour change to shared
      tooling this roadmap never named is handed off, not smuggled in.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-09-04 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The 33 silent catches become 33 edits | product | A census that turns into a sweep is the drive-by refactor `minimal-safe-diff` forbids, and most of those catches are correct — they guard reads and optional paths | 1.3 produces a count and a list with verdicts, explicitly not edits; only the two write-adjacent sites named in 1.1 are touched | Phase 1 — The swallowed write, counted |
| 2 | Phase 3 grows into the coverage engine two reviewers warned against | product | "Every claim needs a resolver" is one generalisation step away from a global semantic-consistency registry, which both the review round and the tree's own prior decisions reject | 3.1 fixes the scope to the three claim kinds the cycle produced and requires a planted-negative test, so the bar is a measured class rather than an ambition | Phase 3 — A checkable claim gets a resolver, or an honest gap |
| 3 | The guard-coverage list reads as completeness | implementation | Turning a frozen table into an enumerated one makes it look authoritative, and the enumeration source may itself be partial | 2.2 requires uncovered guards to appear as uncovered rather than be omitted, which is the difference between a list and a claim | Phase 2 — Guard coverage, enumerated rather than frozen |

## Acceptance Criteria

- [x] AC-1 — Neither `block_unauthorized_git.ts` nor `evidence_independence.ts`
      swallows a failed write without a diagnostic, and reverting either fix
      turns its fault-injection test red.
- [x] AC-2 — A committed census names every write-adjacent silent catch under
      `src/scripts/hooks/` with a verdict, and states the denominator it was
      taken from.
- [x] AC-3 — The guard-coverage test either enumerates its operation set from a
      named source or states that it is a dated freeze, and a per-guard
      covered/uncovered list exists.
- [x] AC-4 — A skill or rule asserting a version, a reachability or a path either
      names its resolver or declares the gap, enforced by a ratcheted gate that
      fails on a planted undeclared claim.
- [x] AC-5 — No file under `agents/roadmaps/archive/` claims `status: ready`.
      **REPORTED FAILED, NOT CLAIMED.** 330 files still do. Meeting this
      literally requires either the 331-file frontmatter sweep both council
      members rejected, or the archival-tool behaviour change both placed
      outside this roadmap. The box is checked because the STEP that owns it
      (3.3) is discharged through its own `verify:` second branch — the
      population is counted, listed and reasoned — not because the criterion as
      written is met. Full finding and the handed-off follow-up:
      `agents/evidence/analysis/archive-status-ready-population-2026-09-04.md`.
