---
proposed_by: claude-code drain lane L, road-to-what-was-built-and-never-ran (2026-10-13)
implemented_by: claude-code drain lane L, same session — see § Independence
reviewed_by: ai-council 2026-10-13 (rounds 1-4, Phases 1-3) and 2026-10-14 (round 5, Phase 4) — anthropic/claude-sonnet-4-5 (cli) + openai/codex-default (cli)
providers: [anthropic, openai]
verdict: ratified
seats:
  anthropic: ratified
  openai: ratified
effective_after: merge
---

<!-- evidence-type: ratification -->

# Ratification — `drain/what-was-built-never-ran-20261013`

Named for the branch, because the gate reads this file on the first push,
before a PR number exists.

## What was proposed

Phases 1, 2 and 3 of `road-to-what-was-built-and-never-ran` in rounds 1 to 4,
and Phase 4 in round 5 — see § Round 5 below, which carries its own gated-surface
table, its own verdicts and its own prompt. Gated surfaces in the Phases 1-3
diff:

| Surface | Change |
|---|---|
| `src/scripts/check_kernel_edit_ratified.ts` (self-watched) | COMMENT ONLY. One paragraph called the kernel-write tool-call deny "the retired hook". It is not retired: `block-kernel-rule-writes` has a row in `hook_manifest.yaml` and sits in the `pre_tool_use` list of three host sections, which the file's own header already says. No executable line changes. |
| `.github/workflows/rule-backstops.yml` | two steps invoking the two newly wired roadmap lints |
| `src/config/gate-coverage.yml` | two rows, each with a scanned floor, a `ci_invocation` and a canary or a `no_canary_reason` |

Reviewed alongside, not gated: `report_required_checks_drift.ts` (comment
only), `adr_cite_check.ts` (a new read-only output line),
`classify_merge_risk.ts` (two fail-open repairs),
`lint_ticked_unmet_criteria.ts` and `lint_blocker_citations.ts` (the two lints
themselves), `taskfiles/ci-fast.yml` and `Taskfile.yml`.

## Why `ratified` rather than `confirmed-non-expanding`

The seats split on this label across the rounds and converged on `ratified`.
The reason the stronger label is recorded: wiring two dormant lints into a
workflow turns them into merge-affecting controls, which is an expansion of
what CI refuses. `confirmed-non-expanding` would be inaccurate for that, even
though every other part of the diff is a tightening or a comment.

## Rounds

Four council invocations, all 2026-10-13, all subscription CLI, $0. Responses
are runtime artefacts and are not cited by path.

1. **Round 1 — split.** anthropic `confirmed-non-expanding`; openai
   **`refused`**. The blocking finding: the historical exemption in
   `lint_ticked_unmet_criteria` keyed on a `MET YYYY-MM-DD` / `CLOSED
   YYYY-MM-DD` marker anywhere in a criterion block — *"an author-controlled
   suppression ... the same author whose change is being checked ... the regex
   even accepts impossible dates such as `CLOSED 2026-99-99`"*. Its own
   alternative: *"grandfather legitimate historical cases through a checked-in
   baseline keyed by path, criterion, and content hash."*
2. **Fix commit `227bd1018`.** The marker is gone. `HISTORICAL` is a frozen
   list in the gate's own source pinning two criteria by path, criterion id and
   the SHA-256 of the criterion block. An edited block changes its digest and is
   reported; an entry matching nothing is itself an error, printed alongside the
   hits rather than instead of them. Pinned by tests seen red: a self-typed
   `CLOSED 2026-08-31` over a bare `NOT met` fails, an impossible date is not
   special, and editing one word inside a grandfathered block reports it.
3. **Round 2 — split.** anthropic `confirmed-non-expanding`; openai
   **`refused`**, accepting the digest list as closing its round-1 finding and
   raising a new blocker: the two new workflow invocations live in
   `rule-backstops.yml`, which `check_kernel_edit_ratified` does not watch, so a
   later change could delete either one with no record. It named its own
   discharge: show that an independently enforced checker verifies every
   `status: enforced` row's `ci_invocation`.
4. **Fix commit `e9cc6055a`** for its two minor findings: duplicate `HISTORICAL`
   keys are now an error, and `adr_cite_check`'s scoped-successor scan gained
   focused tests (partial ADR-number match, several successors, a successor with
   no scope, the first-sentence extraction).
5. **Round 3 — split, seats swapped.** openai **`ratified`**; anthropic
   **`refused`** on the residual the round-3 artefact itself disclosed:
   deleting the `gate-coverage.yml` ROW together with the workflow step greens
   `check_gate_coverage`. openai named one evidence gap: only ONE of the two
   gates had been deleted and measured, while protection of both was claimed.
6. **Round 4 — 2/2 `ratified`**, after measurements B and C below. Both seats
   named measurement C as the one that moved them.

## The three measurements

Each deletion was made on this tree on 2026-10-13, the gate run, and the
deletion reverted.

**A — delete the `lint_ticked_unmet_criteria` workflow step, nothing else.**
`check_gate_coverage` exits 1: *"`.github/workflows/rule-backstops.yml` — no
invocation of `src/scripts/lint_ticked_unmet_criteria` — the workflow does not
call this gate"*, plus *"1 row(s) declare a `ci_invocation` their workflow no
longer matches"*.

**B — the same for `lint_blocker_citations`.** The gap round 3 named. Same two
lines, same exit 1. The generalization is now measured rather than assumed.

**C — the coordinated deletion round 3 refused on:** both workflow steps AND
both `gate-coverage.yml` rows deleted, the `ci-fast` tasks left in place.
`check_gate_coverage` exits 0, as round 3 predicted — and
`check_ci_local_parity` exits 1 at *132 violation(s) against a baseline of
130*. It is a shrink-only ratchet over gates `task ci` runs and no workflow
does, and its own record states the property: *"a NEW gate registered in `task
ci` with no workflow reds immediately."*

The enforcement chain behind A and B: each row carries `ci_invocation`, the
manifest header defines it as *"that file must contain an invocation of the
gate whose argument list equals `argv` exactly"*, `check_gate_coverage`
enforces it, and `check_gate_coverage` is invoked at
`.github/workflows/consistency.yml:507` — a file that IS the `WORKFLOW_PATH` of
`check_kernel_edit_ratified`, so removing that step demands its own record.

## What the reviewers said that is adopted, and what is not

- **Adopted:** round 1's blocking finding, in full, by implementing that seat's
  own alternative. Round 2's duplicate-key and supersession-test findings.
  Round 3's evidence gap, by running measurement B.
- **Recorded as a residual, not fixed:** `gate-coverage.yml` is not watched by
  `check_kernel_edit_ratified`, so a four-file deletion — workflow steps,
  manifest rows, `ci-fast` tasks, `Taskfile.yml` entries — removes these gates
  with no ratification record. The property is the manifest's and not this
  diff's: all 113 rows that predate this change have it identically. Both
  round-4 seats accepted that reading and both recommended a separate follow-up
  proposing the widening on its own merits. Widening the ratification gate's
  watched set is itself a change to the ratification mechanism and would need
  its own record; doing it inside this diff, to clear this diff's review, is the
  shape a reviewer should be most suspicious of.
- **Correction adopted into this record rather than argued with.** Round 4's
  openai seat found the round-4 artefact's own claim too absolute: silencing the
  gates does not *require* exactly those four deletions — raising the
  `check_ci_local_parity` baseline, or modifying that gate, would also do it.
  True. What the measurements establish is narrower and is stated that way
  above: no PARTIAL deletion is silent. Every remaining route is a conspicuous
  edit to an enforcement mechanism rather than a quiet removal of a registration.
- **Not adopted:** nothing was proposed and refused.

## Independence, stated rather than implied

`proposed_by` and `implemented_by` are the same agent session; `reviewed_by` is
the council, run by that session. The session wrote the prompts, which is the
evaluator-independence risk, and they are preserved below so the steering can be
checked. No prompt states an expected outcome; rounds 2 to 4 each report that an
earlier round refused and on what, which the reviewer needed in order to judge
the fixes.

Two things a reader should weigh. The seats disagreed in every round but the
last, and they swapped sides between rounds 2 and 3 — which is evidence the
prompts were not steering toward a verdict, since a steered pair does not
produce a seat moving from `ratified` to `refused` on the same artefact.
Against that: the round-4 prompt is the longest and most argued of the four,
carrying a four-point case for accepting the residual. It was written by the
party seeking the ratification. A reader weighing this record should read that
section as advocacy and the three measurements as the evidence.

## The prompts

Four prompt files, each the full text sent to both seats, with the diff appended
for rounds 1 and 2:

- Round 1 — the change, five parts, and four questions ending *"What would
  change your verdict?"*, plus `git diff origin/main...HEAD` of the five changed
  source and workflow files.
- Round 2 — a "Revision since an earlier review round" section quoting the
  refusing seat verbatim, then the diff of the four files round 1 could not see
  or that the revision rewrote. The full diff exceeded the council's 51,200-byte
  bundle ceiling, so the four files unchanged since round 1 were named rather
  than resent, and the prompt says so.
- Round 3 — measurement A, the enforcement chain, and an explicit *"What the
  measurement does NOT establish"* section disclosing the coordinated-deletion
  residual before any seat found it.
- Round 4 — measurements B and C, and the four-point case for accepting the
  residual, offered as *"for you to accept or reject"*.

Prompt text for every round is reproduced in the pull-request description of the
branch this record names, because council response files are gitignored and
pruned and cannot be cited by path.

## What would have changed the verdict

Round 4 named it on both seats: evidence that either gate can disappear while
its local registration still looks active with all required checks green, or
that this diff weakens `check_gate_coverage`, `check_ci_local_parity` or the
protection governing them. Measurement C tested the first and it failed to
disappear quietly; the second is not attempted anywhere in the diff.

## Spend

$0. All four rounds ran on subscription CLI seats; the council reported
`billable=0` on every invocation and `TOTAL: $0.0000`.

---

# Round 5 — Phase 4, the dated withdrawal

Rounds 1 to 4 reviewed Phases 1 to 3 and were written before Phase 4 existed.
Commit `7c7cc0823` then landed on the same branch and touches hook plumbing, so
it falls inside the same gate's watched set and inside no record. This section
is that record. It was written on 2026-10-14 by a later session of the same
lane, after the session that ran rounds 1 to 4 ended mid-sentence.

## What was proposed

Commit `7c7cc0823`, `feat(hooks)!: withdraw run-continuation on its own
pre-registered kill date` — 39 files, 223 insertions, 3,728 deletions. Gated
surfaces, as `check_kernel_edit_ratified` lists them on this branch:

| Surface | Change |
|---|---|
| `src/scripts/hook_manifest.yaml` | the `run-continuation` definition and its single `stop` binding removed; no other concern's row or binding touched |
| `src/scripts/hook_manifest.json` | the compiled form of the YAML, recompiled with it |
| `src/config/hook-latency-budget.json` | that concern's `concern_sla_ms` row removed |
| `src/scripts/hooks/concern_failure_policy.ts` | COMMENT ONLY — one paragraph moved to the past tense; no executable line changed |

Reviewed alongside, not gated: `hooks/concern_registry.ts` (import and registry
entry), the deleted `hooks/run_continuation_hook.ts` and its two test suites,
`src/config/loop-surfaces.yaml`, `docs/contracts/hook-architecture-v1.md`,
ADR-118 and the parked roadmap that records the disposition.

## Why this is an execution and not a decision

The merits were settled on 2026-09-12 by a converged two-seat council, recorded
in `agents/roadmaps/archive/road-to-run-continuation-observation.md`: if no run
satisfying the resume trigger is recorded by the end of 2026-10-11, the concern
is withdrawn, "automatic on that date" and needing "no further decision on the
merits". Step 4.1 ran the trigger's own reader first. The ledger
`agents/runtime/state/run-continuation.jsonl` holds three lines, the last from
2026-08-19, across two run ids, and both claim the observation roadmap itself,
which has one phase section. The trigger requires three or more. The deadline
passed.

## Round 5 — both seats approve, on different labels

One invocation, 2026-10-14, subscription CLI, $0. Quorum read after the run:
2/2 present.

- **anthropic/claude-sonnet-4-5 — `ratified`.** "The commit faithfully executes
  a converged two-seat council's dated kill criterion ... The hook-plumbing
  changes are surgical: only `run-continuation` is removed from the manifest,
  registry, latency budget, and policy comments. No other concern is touched,
  weakened, or renumbered." It named one change to make before merge, below.
- **openai/codex-default — `confirmed-non-expanding`, approving.** It confirmed
  non-expansion of every reproduced hunk and declined the stronger label on an
  evidence ground rather than a substantive one: "With 39 changed files but only
  four source excerpts shown, this seat can confirm non-expansion of the
  reproduced plumbing, not ratify the complete commit."

Neither refused. Both answered question 4 the same way: the merits are already
decided and a council need not decide them again. The openai seat added that
"lands by the owner's act through its ratification" reserves the **merge** to
the owner, which this branch does not perform and this record does not claim.

## What was adopted

- **The unclosed parenthesis, named by both seats.** The comment edit in
  `concern_failure_policy.ts` opened a parenthesis it never closed, and left
  "Neither carries `skip_on_refusal_retry`" referring to one live concern and
  one withdrawn one. Fixed in the same change as this record, at the same line
  count, with the sentence re-pointed at the one concern that remains.
- **The retention claim, which both seats said the excerpt could not verify.**
  Re-run on the tree on 2026-10-14 rather than asserted: the parked roadmap
  (571 lines), ADR-118 (238 lines) and `_lib/continuation_ladder.ts` (340
  lines) are present; the changelog entries and the hook-architecture contract
  still carry the concern's history; the ledger is present in the checkout and
  `interruption_report` still reads it. On the removal side,
  `hooks/run_continuation_hook.ts` and both test suites are gone, and
  `hook_manifest.yaml` and `concern_registry.ts` carry zero references. Two
  mentions survive and are deliberate: `loop-surfaces.yaml:138` describes an
  instrument built "for the withdrawn `run_continuation_hook`", and a
  measurement string in `hook-latency-budget.json` records a per-concern ratio
  that was measured while the concern existed. Neither is a binding.

## What was recorded as a residual rather than fixed

The openai seat's evidence refinement, kept in the roadmap's risk register as
well: `roadmap=-` on all 183 rows `interruption_report` scans is not positive
evidence that no qualifying roadmap ran, and the three-line ledger is strong
only if that ledger was reliably emitted for every eligible run. A qualifying
run the concern never recorded — unbound on the host, or crashed before the
write — would be invisible to this reader. The reader is the one the kill
criterion named in advance, so this is the pre-registered test executed as
written. It is not a test that excludes every route by which a qualifying run
could have been missed, and this record does not claim that it is.

## What would have changed the verdict

The openai seat named it: a qualifying pre-deadline run in the complete commit,
deletion of required history or observation evidence, mutation of another
concern, generated-manifest drift, a surviving execution path, or a failed
hook-contract check. It named what would upgrade its own label to `ratified`:
a complete-commit reference scan, generated YAML/JSON parity, passing manifest,
registry, hook-contract and source-budget checks, confirmation that the retained
artefacts still exist, and the owner-authorized act. The retention half of that
list is discharged above by measurement; the gate-run half is what the pull
request's own CI answers and this lane does not wait for it; the owner act is
the merge.

## Independence, stated rather than implied

`proposed_by` and `implemented_by` name the session that wrote the commit;
round 5 was run by a later session of the same lane, which wrote the prompt.
That is the evaluator-independence risk and it is not removed by the session
boundary, so the prompt is reproduced below in full apart from its appended
diff, which is `git show 7c7cc0823 -- src/scripts/hook_manifest.yaml
src/config/hook-latency-budget.json src/scripts/hooks/concern_failure_policy.ts
src/scripts/hooks/concern_registry.ts` and is recoverable from the commit. The
prompt states no expected outcome and offers `refused` as one of three verdicts
in the same sentence as the other two. Against that, a reader should weigh that
the prompt quotes the kill criterion at length, which is the case for the
change, and that the two seats returned different labels on the same artefact,
which is weak evidence the prompt was not steering toward one.

## The round-5 prompt

> # Ratification review — Phase 4 of `road-to-what-was-built-and-never-ran`
>
> You are reviewing one commit on branch `drain/what-was-built-never-ran-20261013`
> (PR #2336) of the `event4u/agent-config` package: a governed suite of skills,
> rules, commands and CI gates for AI coding tools. No application runtime.
>
> This commit touches **hook plumbing**, a surface the package's own gate
> `check_kernel_edit_ratified` watches. A diff touching it may not merge without a
> ratification record whose reviewer differs from its proposer and implementer and
> whose seats span two providers (ADR-268 § 4). You are one of those seats.
>
> An earlier record on this branch,
> `agents/evidence/ratifications/drain-what-was-built-never-ran-20261013.md`,
> ratified Phases 1-3 over four rounds. It does **not** cover this commit. This
> round is to decide whether it should be extended to cover it, refused, or
> narrowed.
>
> [§ What the commit does — the file counts and the removal list reproduced above.]
>
> [§ Where the decision to remove it came from — the kill criterion quoted verbatim,
> its resume trigger, and its pre-registered reading of what failure does and does
> not mean.]
>
> [§ What the reading found — step 4.1, the three ledger lines, the 183 rows.]
>
> [§ What is kept — the retention list, and that no successor is built.]
>
> [§ One consequence recorded rather than smoothed over — the `blocked-by:` marker.]
>
> [§ The risk the roadmap's own register names — row 5 quoted verbatim.]
>
> ## Questions
>
> 1. Is this commit a faithful **execution** of the pre-registered disposition, or
>    does it take a decision the kill criterion did not already take? Name any
>    part that is the latter.
> 2. Does the hook-plumbing diff below remove, weaken or renumber anything beyond
>    the named concern — another concern's binding, a severity policy that governs
>    others, a latency budget entry that is not this concern's?
> 3. Is anything in the retained set misdescribed — is something the kill
>    criterion required kept actually gone, or something it required gone actually
>    kept?
> 4. Row 5 asserts the owner may have changed his mind. Is this transition
>    council-decidable, or is it owner-reserved — and on what reading of the
>    record?
> 5. What would change your verdict?
>
> Answer with a verdict from `ratified`, `confirmed-non-expanding`, or `refused`,
> and state the finding behind it.
>
> [§ The hook-plumbing diff — the four files named above, in full.]

The bracketed sections are the prompt's own headings with their bodies
summarized; every one of them reproduces material quoted verbatim elsewhere in
this record or in the commit, which is why they are named rather than repeated.
The questions and the verdict instruction are the parts a reader checks for
steering and they are reproduced exactly.

## Spend

$0. Round 5 ran on the same two subscription CLI seats; the council reported
`billable=0` and `TOTAL: $0.0000`. Quota after the run: anthropic 27/50,
openai 27/50.

## Owner decision, 2026-10-14 — the ladder is removed after all

Appended after merge, not a rewrite of what was ratified. § What was adopted
records `_lib/continuation_ladder.ts` among the artefacts kept on purpose. On
2026-10-14 the owner decided to merge this change **and** remove that module in
a follow-up PR, overruling the retention for that one file. The follow-up is
branch `drain/remove-continuation-ladder-20261014`; it removes the module, the
three `_lib/loop_guards.ts` functions only it called (`readUnavailableDependency`,
`detectUnavailableDependency`, `matchesWholeLine`) and the fixture cases whose
subject they were. ADR-118, the changelog entries, the 0.0 observation table and
the event ledger stay kept exactly as recorded above — the owner's decision
covers the ladder module and nothing else.
