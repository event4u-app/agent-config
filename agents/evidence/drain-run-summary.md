<!-- evidence-type: v1 | type: current-binding | declared: 2026-09-03 -->

# Autonomous roadmap drain — run 18, 2026-09-03

Autonomous roadmap drain under a written owner instruction: drive every active
roadmap to completion, route every open decision to the AI council rather than
to the owner, close gates only legitimately, one PR per roadmap, no user
round-trips.

Base commit `2b3d2b347`. Seven active roadmaps; **all seven carry a PR**, plus
one shared-defect PR the run had to open to make any of them green.

## The queue, recomputed

The instruction carried a seed table of 36 roadmaps. **It was stale in full** —
none of its 36 names exists in `agents/roadmaps/` today, and the live set is
seven files, every one at 0/N. The instruction's own step 1.2 says to recompute
rather than trust the seed; that is what happened, and it is recorded because a
reader comparing the two would otherwise assume 29 roadmaps were dropped.

All seven were below the 10 % line, so the ordering rule was ascending
complexity then ascending step count.

## Pull requests

| PR | Roadmap | State |
|---|---|---|
| [#1815](https://github.com/event4u-app/agent-config/pull/1815) | `road-to-governed-skill-scouting` | complete, archived |
| [#1816](https://github.com/event4u-app/agent-config/pull/1816) | `road-to-ship-control-coverage` | complete, archived |
| [#1817](https://github.com/event4u-app/agent-config/pull/1817) | `road-to-self-description-truth` | complete, archived |
| [#1818](https://github.com/event4u-app/agent-config/pull/1818) | `road-to-wired-instruments` | complete, archived |
| [#1819](https://github.com/event4u-app/agent-config/pull/1819) | `road-to-artifact-location-and-doctor-reach` | complete, archived |
| [#1820](https://github.com/event4u-app/agent-config/pull/1820) | `road-to-council-topology-evidence-followups` | **parked, deliberately** — see § Terminal |
| [#1821](https://github.com/event4u-app/agent-config/pull/1821) | `road-to-cascading-base-integration` | complete, archived |
| [#1822](https://github.com/event4u-app/agent-config/pull/1822) | — | shared defect: `npm audit`, see § The shared red |

## Council decisions

All under the standing delegation, all on **2026-09-03**, members
`anthropic/claude-sonnet-4-5` and `openai/codex-default`, blind chairman,
subscription transport (`billable=0`, `$0.0000`). Council artefacts are
gitignored and auto-pruned, so each decision is inlined in the roadmap and the
PR that consumed it, per `no-roadmap-references`.

### Round 1 — the seven blockers, three rounds

| Blocker | Verdict | Roadmap's own recommendation | Agreed? |
|---|---|---|---|
| `doctor-exit-contract` | **(b)** `--strict` carries the failing exit | (b) | yes |
| `cascade-default-inclusion-policy` | **split** — see below | (a) | — |
| `scout-egress-authority` | **(a)** no network fetch | (a) | yes |
| `scout-invocation-surface` | **(a)** in-repo only | (b) | **no — overruled** |
| `readme-daemon-wording` | **(a)** governed wording | (a) | yes |
| `ddg-citation-authority` | **(b)** structured `authority` | (b) | yes |
| `continuation-terminal-state-arity` | **(a)** a seventh state | (a) | yes |

Six unanimous. One reversal worth naming: on `scout-invocation-surface` both
seats independently rejected the roadmap's own recommendation, calling consumer
invocation a different trust domain rather than another entry point — three new
contracts, not one. The evidence that would reopen it is recorded with the
decision.

Several verdicts carried conditions that were adopted as part of the decision
rather than treated as advice: quarantine must still enforce provenance and
inertness because "a human copied it" is not a content-trust guarantee; the
strict mode needs a configurable severity threshold and a kill switch that is
not a code rollback; the seventh terminal state ships only with a consumer
inventory, schema versioning, unknown-value tolerance and a downgrade mapping;
the legal citation must migrate atomically, sibling citation included.

### Round 2 — specifying the split

`cascade-default-inclusion-policy` split (a)/(b) — **but not on substance.**
Both seats independently named the *same* third option as correct and picked
opposite fallbacks only because the framing demanded a fallback. A focused
follow-up round specified it, and the two seats converged on a near-identical
design: an explicit per-target branch-convergence policy read exclusively from
the resolved PR target SHA, exact target names, fail-on-missing-entry, one
stable result type with closed reason codes, and a kill switch surfaced as
bypassed rather than passed. That specification is what #1821 builds.

### Round 3 — the source-size residual

`doctor --strict` needed 16 lines of wiring in a file 2,100 lines past the
size-budget threshold, against a ratchet that permits zero growth. The council
**split**: one seat for raising the baseline with a payback obligation, one for
descoping the feature.

**Neither was taken, and the reason is evidence rather than preference.** A
parallel branch demonstrated the same day that paying the ratchet down is
achievable in this codebase. So the implementation was extracted into two new
under-cap modules, the delta went `+137 → −21`, and the baseline was **lowered**
18,230 → 18,209. The gate's own test comment prescribes exactly this: a commit
that splits a god-file lowers the excess and must carry the lowered baseline.

A split resolved by measurement is not a split that needed a third opinion.

### Not re-run — the topology carrier

`road-to-council-topology-evidence-followups` already carried a recorded council
verdict on this exact question, mechanism and instruction shape, reached under a
**materially identical** owner instruction on 2026-09-01. Re-asking after an
unwelcome verdict is verdict shopping, so the council was not consulted again
and the recorded boundary was honoured.

## Descopes and carries

| What | Where it went | Why |
|---|---|---|
| `road-to-governed-skill-scouting` Phase 4 — upstream drift-watch | `later/road-to-skill-ecosystem-capability-queue`, with a `parent_roadmap` back-link | Not deferred for capacity. Drift-watch requires a network fetch, and the egress decision that unblocked the rest of the roadmap forbids one. The decision closed the phase. |
| `road-to-self-description-truth` step 2.2's finding | new `road-to-python-era-doc-references` | The step asked for a count and got **1,089 dead `.py` references**, 946 of them across 233 live doc files. Three orders of magnitude past the instance that prompted it, and past a lightweight roadmap's scope. |
| `road-to-council-topology-evidence-followups` — all 38 obligations | nowhere; left in place | See § Terminal. |

## Terminal — the one roadmap not drained

`road-to-council-topology-evidence-followups` is a carrier holding 38 items
deferred out of an archived parent. Its resumption triggers are facts about the
world, and they were **measured live rather than assumed**:

| Trigger | Requires | Measured | Verdict |
|---|---|---|---|
| Phase 2 seats | `n >= 5` independent eligible seats | `council:status` → **2 enabled of 5** | unmet by three seats |
| Phase 2 capacity | a verified 20-consecutive-UTC-day reservation | none exists | unmet |
| Phase 3 windows | two consecutive UTC-day windows at 30 calls/provider against a 50/day cap | no reservation | unmet |

This is the instruction's own terminal case, and its *"legitimate gate closure
only"* clause is what decides it: no execution, council decision, re-scope or
descope can conjure three council seats or a capacity reservation. **Zero of the
38 obligations were executed and none is claimed complete.**

What #1820 does carry is a factual repair. Three header claims had gone false —
the file said `status: draft` (it reads `carrier`), said "nothing guards this
file", and said deleting it "would red nothing". A guard landed on 2026-09-02
and, measured by moving the file out of the tree, deletion now produces
**38 broken deferral carries and exit 1**. Two links pointed at a stub the
guard's own change consumed. A carrier whose subject is "a mechanism keyed on
something that moved" is the worst place to leave a stale claim standing.

## The shared red

Every roadmap PR failed `Static Checks` on `npm audit --omit=dev
--audit-level=high`: 3 advisories (`fast-uri` high, `hono` and `qs` moderate,
including a cross-user SSR disclosure). Red on `main` and on every branch cut
from it; no roadmap diff touches the lockfile.

#1822 fixes it alone — patch/minor only, no semver-major, 0 vulnerabilities
after a clean `npm ci`. It is separate on purpose: burying a dependency bump
inside an unrelated roadmap PR makes both unreviewable. **Merge #1822 first**
and the audit red clears from the rest.

The dev-only advisories in the same tree (`vitest`, `vite`, `esbuild`) all need
semver-majors and the gate scopes them out with `--omit=dev`. Deliberately not
swept in.

## Findings worth keeping

- **`lint_roadmap_complexity` is red on clean `main`** for every lightweight
  roadmap: `relates:` rows use the old slug-only form and rule 18 requires
  `slug:` + `relation:`. Each PR fixed **only its own** rows. Rows for roadmaps
  a run had not executed were left alone deliberately — inventing a relation
  value for a roadmap nobody read is a fabricated frontmatter field.
- **A `--root` flag is not a capability.** Four lints accept `--root`; run
  against a real quarantined candidate, exactly **one** reaches it. Two take it
  to mean the *repository* root; one scans a sub-path a text-only candidate does
  not have. A fleet list built by grepping for the flag would have been wrong in
  three places and would have reported three lints as having scanned nothing.
- **`is_roadmap_candidate` is a name filter, not a detector.** Over an arbitrary
  tree it accepts nearly every `.md`. The location gate pairs it with a
  three-signal content shape; a looser predicate turns 6 of 14 cases red.
- **`doctor` was never "always exits zero".** It already returned 1 on manifest
  drift, and `--ci` already folded check failures in. The real gap was a failing
  exit outside the `--ci` JSON contract.
- **`main()` in `cmd_doctor.ts` has two exit paths and only one is obvious.** A
  strict check wired into the drift branch alone exits 0 on any repository
  without an install manifest — including this one.
- **`context_fingerprint` was written by nothing**, not merely unread, so
  consuming it would have reproduced the defect class its own roadmap was
  fixing. The producer had to come first.
- **A test guard fired on its own documentation** — the no-egress source guard
  matched the tokens its header named. The header was reworded rather than the
  guard loosened.

## Honest nulls

- The `git log -S` sweep for daemon-variant phrasings across five publish
  surfaces returned **zero** beyond the two already known.
- The sibling-citation sweep found **35 citation sites**, of which 3 were the
  known defect and 32 were live law — **no further dead citations**.
- **Zero anchor drift** across every roadmap: every cited `file:line` resolved
  at `2b3d2b347`.
- No cross-repo artefact-move trigger was built. One observed instance does not
  justify a new command surface, and the roadmap asked for exactly that
  restraint.

---

# Prior run — autonomous roadmap drain, run 17, 2026-09-02

The only report the maintainer asked to read. Every claim below was produced by a
command in this run, not carried from a prior session. **Zero metered calls to
any generation API; every council seat ran on subscription transport,
`billable=0`, `$0.0000` total.**

## The instruction, and where it did not match the tree

The brief seeded **36 active roadmaps** at commit `c536dbd` and said to recompute
before use. Recomputed at `6641d4719`, the live inventory was **2** — the seed
list was stale by roughly thirty archivals. It was discarded and the queue
rebuilt from the tree, which is what the brief instructs.

The user's own narrowing governed the run: *resolve the blocker and work the last
open roadmap through completely.*

| # | Roadmap | Progress at start | Complexity | Outcome |
|---|---|---|---|---|
| 1 | `road-to-governed-evidence-production` | 4/9 (44%) | structural | Blocker resolved with (b); Phase 2 given a terminal disposition; **parked to `agents/roadmaps/later/`** by council verdict G3. Not archived — see below. |
| 2 | `road-to-council-topology-evidence-followups` | 0/38 | structural | Untouched by design. `status: carrier`; 38 deferred steps in archived roadmaps resolve to it, and `lint_carrier_integrity`'s broken-destination class reds at zero tolerance if it moves. |

## Why the roadmap is parked and not archived, in one paragraph

Archival requires zero open items. The five that remain — steps `2.1`, `2.2` and
criteria `AC-2`, `AC-3`, `AC-4` — could only be closed by converting them to
`[-]` cancelled, and the checkbox vocabulary has **no glyph for "waived"**. A
council ruled 2/2 that the owner's delegation does **not** reach that
owner-reserved conversion: *"a governance rule does not become optional because
a linter cannot detect its violation."* So every criterion keeps its `[ ]` and
stays alive in the estate, the dispositions are recorded in prose, and the file
parks whole — which is what `src/rules/roadmap-progress-sync.md:120-125` makes
mandatory for a roadmap whose open work cannot proceed now but will resume.

## Pull requests

| PR | Title | Roadmap | State |
|---|---|---|---|
| (see the PR body of this branch) | `roadmap: park governed-evidence-production to later/, resolve metered-backend-park with (b)` | `road-to-governed-evidence-production` | open, one known-red gate escalated below |

Two commits: the evidence analysis, then the roadmap disposition and park.

## Council decisions

| # | Question | Verdict | Recorded in |
|---|---|---|---|
| 1 | Does verdict 2A survive four new findings, and what is Phase 2's terminal disposition? | **D2**, 2/2 convergent — 2A refuted in its operative form; AC-2 waived on demonstrated design infeasibility; AC-3/AC-4 close as dependent, unsatisfied dispositions; no fifth option; do not read "cheap" into AC-2 retroactively | roadmap § Phase 2 terminal disposition |
| 2 | By which glyph and which authority does D2 get written down? | **G3**, 2/2 convergent — park to `later/`; the delegation does **not** reach the owner-reserved `[-]`; all five items stay `[ ]`; blocker closes with (b) | roadmap § Phase 2 mechanism |
| 3 | One coverage floor now reds on a corpus that shrank by design — lower it? | **SPLIT 1-1**, which is an escalation condition and not a verdict. Both seats agree F1 (lower to 1) is technically right; they disagree on whether the delegation reaches it | evidence analysis § One consequence is UNRESOLVED |

The two prior transport failures on question 3 (`exit_1`, `os_error: ENOBUFS`,
0/2 present) are recorded as failures, not refusals; the third attempt answered.

## The one item that reached the owner — and was answered

Parking the roadmap takes `agents/roadmaps/` top level from two files to one (the
carrier, which cannot be removed). That reddened `check_requirements_trace`'s
`scanned:` floor, and `check_gate_coverage` runs in remote CI
(`.github/workflows/consistency.yml:359`), so the PR carried one red gate.
Every other gate in the battery was green throughout.

The floor's own note predicts that red and calls it *"the gate firing on the
drain WORKING"*; it had already been re-derived twice for the same reason. Its
`Revisit-if` anticipates the estate stabilising **above** 2 and it stabilised
**below** 2 — a gap in the clause. The council split on authority, so the agent
left the row alone and put the proposal to the owner.

**ANSWERED 2026-09-02. The owner authorised it, applied the change themselves,
and `check_gate_coverage` now returns exit 0 —** *"every enforced gate cleared
its coverage floor"*. The record that authorisation asked for is in
`agents/evidence/analysis/drain17-phase2-candidate-surface-finding.md`:

1. The row's floor now reads 1.
2. 1 derives from the carrier invariant and its 38 dependent references, not from
   today's file count — the only signal this floor catches reports 0, and 0 < 1
   leaves it intact.
3. The coupling: that invariant is enforced by a **different** gate, so if
   carrier-integrity enforcement changes, the derivation must be revisited.
4. The `Revisit-if` gap: it should be read as covering any structurally justified
   minimum in either direction, re-derived from what the estate is structurally
   required to hold and never from the live count.

**The agent could not make this change, and that is why the owner ran it.** The
harness's auto-mode classifier refused every route — a scripted edit, the edit
tool, and even writing the replacement note text to a scratch file — because
touching a gate threshold downward reads as config weakening. Points 2-4
therefore live in the evidence artefact rather than in the row's own `corpus:`
note, which still argues for the old value: the row and its justification have
come apart, and whoever next has write access to it should fold them in.

## Descopes

**None.** Nothing was dropped, cancelled, or transferred. That is the point of
the G3 mechanism: five open criteria are preserved in place with a resume
condition rather than closed to make a directory look empty.

## Corrections this run made to its own findings

Recorded because two of them were caught by verification rather than by care.

| Claim as first drafted | Corrected to | Caught by |
|---|---|---|
| "v1 excludes the candidate surface by explicit comment" | v1 **layers** the four owned paths into `with`/`with-rdp` clones and spawns with `cwd: cloneRoot`; what blocks a candidate clone is `reset_clone`'s variant allowlist, which does not accept `candidate` | independent verification pass |
| "`assertWithinBudget` aborts an over-budget bench sweep" | It has **no** `bench_ab_*` caller, and every committed caller passes an estimated spend of 0 — the ceiling enforces nothing on that path. The decisive fact is that no approved powered plan fits it | independent verification pass |
| "none of the five corpus rules is reachable from a fixture task" | Four are path-unreachable; `augment-edit-discipline` carries `path_prefix: "src/"` and the fixture has `src/cli.ts`. The categorical form is withdrawn; an effect-size judgement survives, marked weaker than the structural legs | council peer review flagged it `needs-verification` |

## An adjacent defect surfaced and NOT fixed

`clone_candidate` joins `record.id` straight into a path
(`bench_ab_clone.ts:332`) and `id` is validated only as a non-empty string, so an
id carrying `..` or a separator would land a candidate clone outside `CLONES`
where the integrity checker (direct children only) does not look. Nothing
executes there. Surfaced rather than patched, because this change is a roadmap
disposition and not a code fix.

## Honest limits of this report

- **The floor red was real, was escalated, and is now closed by owner action —
  never waived.** What remains open is smaller and is stated rather than tidied
  away: the row in `gate-coverage.yml` now carries a value its own `corpus:` note
  does not justify, because the agent was blocked from writing that note and the
  justification lives in the evidence artefact instead.
- **One council seat could not verify the citations** it reasoned over, and said
  so — its verdict rests on the quoted provisions being accurate. The citations
  are what a later reader checks, not something to inherit.
- **The peer-review half of the first council round was 1 of 2.** The anthropic
  peer-review returned a refusal, having been shown one response where the
  round's structure implies two. Both primary rounds were 2/2.
- **The corpus-identity leg rests on one host's projection.** `.claude/` is
  gitignored and generated; `subject_digest=860eaf2dee7f35df` reproduced
  byte-identically against the drain-16 capture on this machine, and that is the
  strength of the claim.
- **`task ci` was not run.** It chains 292 tasks, runs `test` twice, and writes
  build output. The gate battery plus `check_gate_coverage`, `check_estate_count`,
  the gate-meta gates and the archive-index check were run instead, and each
  result above is an observed exit code.
- **One further red was found, measured, and attributed elsewhere.**
  `check_gate_completeness` exits 1 with *"225 violation(s) against a baseline of
  214 — 11 new"*. It is **not** caused by this change: a detached worktree at
  `origin/main` reports the identical `225 un-adopted · 308 registered`, so the
  count did not move, and the derivation agrees — this diff registers no gate.
  The gate also runs in **no** workflow (only in `task ci`, which no workflow
  invokes), which is how a stale baseline survived on the trunk unnoticed.
  Closing it means eleven gates adopting the ledger, or correcting the baseline —
  and the gate itself calls the latter *"a defect, not a fix"*. Left untouched
  under `minimal-safe-diff` and surfaced here rather than folded into a roadmap
  disposition it has nothing to do with.

---

# Prior run — autonomous roadmap drain, run 16, 2026-09-02

> Preserved in full below and unedited. Run 17 is the current record and sits
> above it in this same file.

The only report the maintainer asked to read. Every claim below was produced by a
command in this run, not carried from a prior session.

## The instruction, and where it did not match the tree

The brief named **36 active roadmaps**, seeded at commit `c536dbd`, and said to
recompute before use. Recomputed at `56c333855`, the live inventory was **3**.
The seed list was three weeks and roughly thirty archivals stale, so it was
discarded and the queue rebuilt from the tree.

| # | Roadmap | Progress at start | Complexity | Outcome |
|---|---|---|---|---|
| 1 | `road-to-governed-evidence-production` | 4/9 (44%) | structural | PR #1809, **merged**. Phase 2 stays open by council verdict — the roadmap is correctly unarchived. |
| 2 | `road-to-comment-enforcement-completion` | 0/5 | structural | PR #1808, **merged and archived**. |
| 3 | `road-to-council-topology-evidence-followups` | 0/38 (draft) | structural | Not archived, by design: it became `status: carrier`. The roadmap that protects it — `road-to-deferral-carry-guard` — was promoted, completed and archived instead. |

Queue order followed the brief's rule: progress descending above 10 %, then
ascending complexity with the checkbox count as tie-break.

## The roadmap directory is not empty, and both councils say it should not be

The brief's terminal condition was an empty `agents/roadmaps/`. Two roadmaps
remain, and in both cases emptying it would have been the cosmetic closure the
council refused **twice** in this repository's own record:

- **`road-to-governed-evidence-production`** — its last three acceptance
  criteria need a metered comparison the council placed **outside the delegated
  envelope**, unprompted, in both seats. Archiving it would claim a criterion
  nobody satisfied.
- **`road-to-council-topology-evidence-followups`** — its function is to
  persist 38 obligations whose resumption triggers are unmet. Position P
  (migrating them out of the estate) was refused because any destination
  satisfying the invariant recreates the carrier under another name, and because
  the migration target is a semantic choice an autonomous run may not make.

Per § 0 of the brief, the council's recorded decision substitutes for owner
sign-off. It is recorded here that the council used that authority to keep two
files rather than to close them.

## Pull requests

| PR | Title | State |
|---|---|---|
| [#1808](https://github.com/event4u-app/agent-config/pull/1808) | roadmap: complete comment-enforcement-completion | MERGED 2026-09-02T05:35:43Z |
| [#1809](https://github.com/event4u-app/agent-config/pull/1809) | roadmap(governed-evidence): cure F-A and F-C, and record 2A as owner-reserved | MERGED 2026-09-02T06:05:03Z |
| [#1810](https://github.com/event4u-app/agent-config/pull/1810) | roadmap: complete the deferral-carry guard, and give a carrier a status that costs something | open, CI **SETTLED GREEN — 45 checks** |

**Nothing was merged by this run.** A production-branch merge is a Hard Floor in
`non-destructive-by-default`, which no mandate, autonomy setting or council
verdict lifts. #1808 and #1809 were merged by the maintainer.

## Council decisions

Four questions across three rounds, all `anthropic/claude-sonnet-4-5` +
`openai/codex-default`, 2 rounds each, depth deep, peer-review, blind chairman,
quorum 2/2 present (needed 1), concluded. Subscription transport on every run:
`billable=0`, `$0.0000` total. Council artefacts are gitignored and auto-pruned,
so each verdict is inlined in the roadmap it governs rather than cited by path.

| Q | Question | Verdict | Where it is recorded |
|---|---|---|---|
| 1 | Does a distinct subagent satisfy the un-park procedure's "independent session"? | **1B**, 2/2 — no. A child of the authoring orchestration is part of that run, and the orchestrator writes its prompt. | `road-to-governed-evidence-production` § Phase 2 disposition |
| 2 | A blocker whose only two options are both mechanically impossible for an agent | **2A**, 2/2 — carry it out, archive the roadmap around it. 2C refused as bookkeeping, 2B as undead work, 2D named as better and unavailable. | archived `road-to-comment-enforcement-completion` § Blockers |
| 3 | A roadmap whose function is to persist, in an estate instructed to empty | **3Q**, 2/2 after one round split — a `carrier` lifecycle state with mechanical protection, protections before reclassification. | `road-to-council-topology-evidence-followups` § Unguarded-carrier gap |
| 4 | A frozen corpus that cannot move its own pre-registered evaluator | **2A conditional, and owner-reserved** — both seats, unprompted. Freeze ordering corrected against drain 15. | `road-to-governed-evidence-production` § Phase 2 disposition |

Two verdicts reversed earlier recorded decisions, and both reversals are
recorded in the file rather than silently applied:

- **Q3 reversed drain 14's verdict 3A.** That verdict was conditional (*"if
  confirmed, surface to owner"*) and the run that recorded it also ran the
  mutation test that confirmed the claim. The condition had already fired.
- **Q4 reversed drain 15's freeze ordering.** *"Prior execution does not cure a
  compromised independence safeguard. A later record supersedes an earlier rule
  only if it explicitly resolves or replaces the conflicting requirement — not
  merely because it is later and 'convergent.'"*

## Descopes

| What | Where it went | Why it could not be done here |
|---|---|---|
| `b-kernel-rule-edit` — the false `enforced_by` claim in `language-and-tone` | `agents/roadmaps/later/road-to-language-and-tone-enforcer-claim.md`, blocker preserved at `Status: open` | Both curing options are writes to a kernel rule. `block_kernel_rule_writes.ts` denies every agent write at the Write/Edit surface (`:105-124`) and the Bash surface (`:126-205`), and names the sole bypass as a human-owned registry. Circumventing it was not contemplated. |
| The carrier transition vocabulary | `agents/roadmaps/stubs/road-to-carrier-transition-vocabulary.md` | Exactly one carrier exists. A vocabulary designed against one instance encodes that instance; both seats asked for a deliberately immobile first version. |
| Phase 2 of `road-to-governed-evidence-production` | stays open in place | Owner-reserved by council verdict. |
| `check_gate_completeness`, red at 225 against a baseline of 214 | recorded here, not fixed | Pre-existing and unattributable: identical count with and without this run's diffs, and both independent reviewers reached the same conclusion. It sits in `task ci` and in no workflow, so it is a local-only gate red on clean `main`. Repairing 11 unrelated gates is outside the diff this run is entitled to, and raising a ratchet is a defect. |

**The council's word deviated from once**, and it is recorded rather than
smoothed: Q2's seats both said *stub*. A stub is not a valid `[~]` receiver —
`deferralProblems` resolves a `carried-to=` destination only against
`agents/roadmaps/` or `later/` and fail-closes on `stubs/` — so `later/` was
used, which additionally keeps the blocker inside `open_blockers`.

## Completion reviews

Every mutating branch was reviewed by a fresh subagent dispatched at the
`dispatch_r2_reviewer` package, using that dispatcher's own prompt verbatim. No
expectation of the outcome was added to any prompt. Each findings artefact was
committed **before** its fixes.

| Branch | Findings | Highest severity | Outcome |
|---|---|---|---|
| comment-enforcement | 4 | medium | all fixed; one observation recorded and not fixed (a missing `tsx` scores as a behaving `reject` in the shared harness, which is every adopter's problem, not this branch's) |
| governed-evidence | 8 | **high** | all fixed; one axis of finding 3 recorded rather than fixed, with the reason |
| deferral-carry-guard | 11 | **high** | all fixed |

**Three reviews found defects that reading would not have.** The
governed-evidence high finding was a mandatory metric row that was a structural
constant zero, making the one ceiling check its own contract calls mandatory
unreachable. The carrier-guard high finding **refuted this run's own risk
register**: Risk 1 claimed a self-declared carrier *"gains exclusion and gains a
red at the same time"*, and the reviewer measured that the gate enumerated
archived parents only and never enumerated self-declared carriers — so the
status was a free exclusion that also lowered the estate floor. The gate now
enumerates both sides, and the mitigation text was corrected to describe what
ships.

## What this run built, beyond closing boxes

- `lint_carrier_integrity` — a standing validator that walks from the archived
  parent, where the record survives, because the archival sweep validates a
  carry exactly once and never sees the pair again.
- `status: carrier` — a lifecycle state taught to four readers, whose deletion
  earns no estate credit and whose absence from a real carry is a hard failure.
- `corpus_manifest` and `candidate_pair_delta` — the F-A pin and the F-C
  producer, with a fresh-checkout reconstruction proving subject equivalence.
- `lint_code_comments --self-test` — 20 cases, 11 rejecting, sensitivity
  observed rather than assumed.

## What CI caught that no local gate did

PR #1810 went red twice, and both are worth recording because the local
preflight passed each time.

**`check_source_size_budget`, +96 lines.** Two files crossed the 1,500-line
ceiling — `check_estate_count` 1412 → 1581 and `update_roadmap_progress`
1500 → 1515, the second having had exactly zero headroom. That gate's own
doctrine is that an oversized file is **split**, not granted a higher baseline,
so the excess was paid down to the baseline rather than the number moved: a
shared `_lib/carrier_status.ts` for a predicate that had two implementations and
five callers, a companion module for the three new self-test cases, and
`is_draft` → `is_unscheduled` over `{draft, carrier}` so one honest predicate
replaces a second predicate plus an `||` at each call site. **No comment was
deleted to buy a line** — the two long fixture rationales moved into the shared
module and are pointed at from the cases.

**`check_secret_leak`, one high-confidence finding.** The PEM canary pin in
`.secret-allow` drifted 525 → 543, because registering the new gate put a row
with its own canary recipe above it. Fifth drift of that pin, fifth time from
the same cause. Re-pinned from a fresh `grep -n`, not offset from the old
number, with the body re-read before moving it.

Both were fixed on the branch. Neither was in the local preflight, which is the
gap worth carrying forward rather than the two fixes.

## Honest limits of this report

Three gates were red locally and are not this run's: `check_gate_completeness`
(above), `check_roadmap_trackable:relates` (a loose ratchet at 1 against a
baseline of 9, not lowered on a local reading), and four dead rows in
`check_gate_coverage --canary`, of which the carrier row is not one — it fires.
Each was proven pre-existing by measurement rather than argued.

Two roadmaps remain active and both are correctly active. The estate is not
empty, and the reason is recorded above rather than worked around.

One ordering note, because the brief asked for this file as the final commit:
it is the last **content** commit. The commit after it touches only
`agents/evidence/reviews/…findings.md`, which the review-scope diff excludes by
construction — the re-bind the completion-review contract requires, and the one
commit that cannot change what this summary describes.

---

## Run 18, continued — the half that happened after a context reset

The record above was written from inside run 18 and is the authoritative account
of its first half: the recomputed queue, the council decisions standing in for
each maintainer signature, the parked carrier, and the shared `npm audit` defect
that #1822 fixed. This section adds only what happened after it, and contradicts
none of it. Same run, same instruction, one context reset in the middle.

### The six PRs were red after #1822, and #1822 is why

#1822 cleared the audit advisories **on `main`**. The six completion PRs were
opened before it merged, so every one of them stayed `BEHIND` and kept failing
`Static Checks (ESLint · typecheck · prepack)` at its `npm audit (runtime deps,
high+)` step (`.github/workflows/tests.yml:443-447`) — the fix existed and had
not reached them. Merging `main` into each makes `npm audit --omit=dev
--audit-level=high` print `found 0 vulnerabilities`, verified in each worktree
before its push rather than inferred from #1822 having merged.

Two facts about the push path, recorded because they each cost a refused push:

- The **remote branch head was ahead of the local worktree on all six** — a
  GitHub *Update branch* press. The pre-push preflight refuses a push whose PR
  head is unreachable locally (`❌ PR #1817 head 7bc8fa4f7 is not reachable from
  the local branch`), so `git merge origin/<branch>` is a mandatory step before
  `git merge origin/main`, not a no-op. Nothing was force-pushed.
- Each preflight emitted an **advisory** `missing-artifact` completion-review
  violation and was left alone as out of scope for a merge-only change: 2 code
  paths of 7 changed files on #1815, 6 of 17 on #1816, 3 of 12 on #1817, 25 of
  38 on #1818, 6 of 14 on #1819, 5 of 12 on #1821. #1818's 25 is large enough to
  deserve a real completion-review artifact before that one merges. No gate
  blocks on it today; this is a flag, not a finding.

### Ten blocking-severity bot findings, triaged rather than waved through

The dogfooded adversarial-review gate reported **1–3 findings of blocking
severity on every one of the six PRs**, all advisory today ("WOULD block merge
under an enforced gate"). They sit on code and prose these branches newly
introduce, so each was triaged individually. **Six were real, four were false
positives, and both verdicts carry the evidence that decided them.**

#### Security — 3 real, 3 false positives

| PR | id | Verdict | What decided it |
|---|---|---|---|
| #1815 | `4e407b92dae4` high | real, fixed | Reproduced pre-fix: `--candidate '../../../../.github/workflows'` ran through, and the scan-scope line asserted a root it was not scanning. The name reached `path.join(qroot, name)` unchecked. |
| #1815 | `5af816352604` high | real, narrowed; residual recorded | `intake` lstats the candidate, then the read path re-walked it on extension alone — a post-intake symlink was followed out of quarantine. |
| #1815 | `7001a7a5357b` **critical** | false positive | `grep -rn "skill.scout" .github/` → exit 1, zero matches. The only surface is `taskfiles/dev.yml:138`, hand-run; and `scout-egress-authority` + `scout-invocation-surface` were both council-resolved **(a)** — no network, in-repo only. The trifecta's ingestion leg does not exist. |
| #1819 | `412040920bb4` **critical** | false positive | The cited file is not in the diff at all — `git diff --name-only origin/main...HEAD \| grep adversarial-review` → exit 1, byte-identical to `main`. It also forbids subset reporting twice itself, and the renderer maps over every parsed finding. |
| #1821 | `b64b04412839` **critical** | false positive as framed; one real premise pinned | The framing is inverted: the gitignore deviation is what *keeps* the boundary, because a SHA-pinned read of a gitignored `.agent-settings.yml` returns nothing in every consumer, so reading it at all would be the bypass. Genuinely unguarded was the deviation's *premise* — nothing asserted `.branch-convergence.yml` stays trackable. Three guards now pin it with git's own matcher. |
| #1821 | `8cba49fc38ed` high | false positive | `grep -rn "sync_pr_branch\|branch_convergence" .github/` → exit 1. The surfaces run under the maintainer's own credentials, and the tree carries **zero** `pull_request_target` workflows, so a fork PR is token-capped read-only. |

The #1815 fix is a **refusal, not a normalisation**, and its containment
assertion lands *before* the scan-scope report so that line can never record a
traversed root. The TOCTOU residual — a regular file swapped for a *different*
regular file inside the read pass — needs an fd-based open with `fstat` and is
recorded on that branch in the quarantine contract the resolved blocker already
names, rather than implied away.

**Red before green was proven for every new guard, each red only for its own
reason.** #1815: both guards removed exactly as shipped → the CLI-confinement
test and both read-time tests go red (3 failed / 38 passed); restored → 41 pass.
#1821: `.branch-convergence.yml` in `.gitignore` reds guard 1, `.branch-*.yml`
in the managed block reds guard 2, a `node:fs` import reds guard 3; probes
reverted → 31 pass. A guard whose test was never seen red has unknown
sensitivity, so this is measured rather than asserted.

#### Claims — 4 real, 0 false positives

| PR | id | Verdict | What decided it |
|---|---|---|---|
| #1816 | `2cef2e24285c` high | real, repaired | The roadmap said the citation "went stale for roughly sixteen months". `git log -S "TMG" -- src/config/web-launch-readiness.json` dates the add at `627f1a23c` (2026-08-25) against DDG § 5 in force since 2024-05-14: it was **27 months** out of date *on the day it was written*, and shipped for nine days. Sixteen matches neither reading. |
| #1817 | `4bda21863ba8` high | real, repaired | A genuine second instance of this roadmap's own subject. `claim: no-runtime-daemon` pointed at `docs/contracts/no-runtime-boundary.md#file-first, no-runtime suite` — never two links, but one bold inline phrase split by its own comma, removed at `68463a1e0` one day *after* the entry was withdrawn. Silent because `check_claims.ts:542` reads `if (entry.status !== 'backed') continue`. |
| #1818 | `fa4542cbf57d` high | real, repaired | `ls -d src/skills/*/ \| wc -l` → 299 and `check_estate_count` → `skill_count 299 (floor 299)`, while the rule's `:34` says *"that install projected 297 skills"* — one host's denominator from a dated measurement, not a live self-count. Exactly one of the two cited sites was stale. |
| #1818 | `a7e8732a5371` **critical** | real, repaired; the step is still right | The roadmap said a step's premise was half wrong yet left the box checked, and nothing said why that was still sound. The wrong half made the step *bigger*, not moot: both verify conditions discharge at head (`grep -c context_fingerprint … → 6` against a `> 0` requirement, and the halt test returns `halt-premise-invalidated`). `[x]` stands, now with the reason stated, and `[-]` was not used. |

Two things about the claim half are worth carrying forward. #1816's repair came
from a **defect-pattern sweep, not a single-site fix**: the same unanchored
number appeared at **six** sites, five now anchored, the sixth — a quoted council
verdict — left verbatim beside a dated correction, because the seats were
repeating the roadmap's own number and their decision does not rest on it. And
#1817's blast radius was **measured rather than assumed**: of the ledger's 8
closed entries, 1 of the 5 path-shaped pointers dangled, so the guard was not
widened — extending it would reach three `resolved-null` entries whose
`evidence:` carries pre-registration prose.

One honest limit on #1817's own acceptance criterion: `check_claims` exit 0 does
**not** validate the replacement wording, because `README.md:30` is unmarkered
prose — exit 0 only proves the retired needle is gone. The criterion is qualified
accordingly rather than read as stronger than it is.

#### Advisory findings deliberately left alone

Out of the blocking scope this pass set, and named so they are not mistaken for
cleared: on #1821, `f8df6af3ba7e` (`remoteSha` is trusted not to lie) and
`1ef902de4363` (the `enabled: false` kill switch surfaces as BYPASSED but writes
no audit trail) both look substantive rather than probabilistic noise. On #1818,
`696d10672065` and `5a45d7252b56` sit inside the Phase 2/4 notes the claim
repairs just rewrote, so they may read differently against the new text.

### The council escalation that was recommended and not taken

All six bot comments carry **"Escalation warranted — large diff (≥ 400 changed
lines)"** and recommend a full `/council:pr` pass, noting it is spend-bearing and
gated by blocker `self-review-gate-cost`. It was not run, and the reason is
sequencing rather than cost: every one of the six diffs was still moving while
the triage landed, and a council verdict on a superseded head is worth less than
no verdict. Recorded as an open recommendation for whoever merges, not as a step
silently dropped.

### Honest limits of this half

- **Three PRs merged from outside this session** while the triage ran — #1816,
  #1819 and #1821, all at 08:33 UTC, plus the #1820 carrier disposition and this
  file's own #1823. Nothing here merged them; the merges are named because a
  reader comparing PR states to this text would otherwise think it stale.
- **CI is claimed green only where `ci_settle` said so, at the head it said it
  about.** #1815 `SETTLED GREEN — 38 check(s)` and #1821 `SETTLED GREEN — 42
  check(s)`, #1816 `SETTLED GREEN — 34 check(s)`, #1818 `SETTLED GREEN — 49
  check(s)`. Two of those greens were then **withdrawn rather than carried**,
  because the commit they were measured at no longer exists as head: #1815's
  first green at `7e3fe731c` was superseded by its security fix, and #1815 and
  #1818 both took a further merge commit afterwards (below). A green run on a
  superseded commit is not a green PR.
- **The three merges from outside broke two of the branches, and that is the
  last thing this run fixed.** With #1816, #1819 and #1821 on `main`, #1815 and
  #1818 went `CONFLICTING`. #1815's only conflict was mechanical — the branch
  added `dev:skill-scout` where `main` added `push-ready` at the same spot in
  `taskfiles/dev.yml`; both kept, `task --list` parses 491 tasks. #1818 carried
  the same plus a **ratchet** collision: it and `drain/artifact-location` each
  lowered `check_source_size_budget` from the *same* 18,230 base, to 18,226
  (net −4) and 18,209 (net −21). Either side alone is wrong in a different
  direction — `main`'s discards the −4 #1818 earned, and #1818's *raises* the
  baseline against `main` and weakens the gate. The committed value is neither:
  **18,205**, the gate's own output on the merged tree. A local reading is
  admissible for this gate specifically, and the discriminator is recorded in
  the entry itself, because the same file records a 165 → 164 lowering on the
  `ci-parity:local-only` entry that was **reverted** for depending on how the
  environment resolves the projection surface — whereas this gate walks only
  `SOURCE_ROOTS = ['src']` (`check_source_size_budget.ts:88`) and `git status
  -uall -- src/` reported zero untracked files, so a clean CI checkout of the
  same commit measures the same number. If CI reads otherwise, CI's number is
  the correct one.
- **#1817's own first push of this record went red, and the cause was this
  file.** Its triage section cited the skill-scout quarantine contract by full
  path under `docs/contracts/`. At the time that file existed only on #1815's
  branch, so `check_references` reported one broken reference pointing at this
  very summary, and `demo-commands-still-pass` failed for the same single reason
  via `task check-refs`. #1815 has since merged and the file now resolves on
  `main` - past tense here is load-bearing, because a present-tense reading of
  this sentence went false the moment that PR landed, which is the third time in
  one run that a claim in this file outran its own evidence. Both now name the contract without writing a path this
  tree does not carry - including this sentence, which reintroduced the identical
  break on the first attempt at describing it. Green afterwards:
  `check_references` 1828 scanned, no broken references, and the demo script's
  full trust surface passes.
- **No PR was merged by this session.** Merging to a production trunk is a
  Hard-Floor action no standing instruction lifts, and the brief asked for PRs.
- **`main`'s own red gates were not re-audited here.** One was measured in
  passing and is not this run's: `lint_roadmap_complexity` fails on sibling
  roadmaps whose `relates:` rows are byte-identical to `main`.
- **No metered spend in this half.** No council call was made after the context
  reset; the sessions the PR bodies cite belong to the first half and record
  their own `billable=0` transport.
