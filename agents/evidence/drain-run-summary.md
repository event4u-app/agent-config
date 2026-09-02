<!-- evidence-type: v1 | type: current-binding | declared: 2026-09-02 -->

# Autonomous roadmap drain — run 16, 2026-09-02

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
