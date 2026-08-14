# Roadmap completion sweep — 2026-08-14

**Base:** `73ac7b861` (`origin/main`, "Merge pull request #1348").
**Branch:** `roadmap-sweep/2026-08-14`. Not pushed; merge is the maintainer act.
**Authorization:** the blanket in-session grant of 2026-08-14, cited inline in
every roadmap this run touched.

## Headline — the grant unblocked less than it looks like, and that is the finding

The sweep was asked to release every maintainer- and user-owned blocker and then
close everything that became executable. The releases were made. The second half
did not follow, and the reason is structural rather than a shortfall of effort:

> **Of the 39 open blockers, 6 were dischargeable by authorization alone. The
> other 33 are not waiting on a decision — they are waiting on a host install, on
> data that accrues, on a guard that refuses agent writes, or on a second human.
> An authorization cannot create any of those.**

That distinction is the sweep's main product. A blocker labelled *owner:
maintainer* reads like a decision queue, and roughly a sixth of it is. The rest
is a **capability and data queue wearing a decision label**, and every prior
sweep has re-derived that at cost. It is now written down per item.

## Counts

| Measure | Before | After | Δ |
|---|---:|---:|---:|
| Open roadmaps | 29 | 28 | −1 (archived) |
| Steps done | 253 / 437 | 255 / 434 | +2 done, −3 total |
| Open blockers | 39 | 33 | **−6** |
| Blockers needing the user | 10 | 8 | −2 |

The step total fell by 3 rather than rising: one roadmap archived out of the
active set, and one step was a verbatim duplicate that had been inflating the
count.

## Blockers resolved (6) — authorization was genuinely the whole gate

| Blocker | Roadmap | Decision |
|---|---|---|
| `harvest-b-execution-order` | harvest-b index | Order recorded; `later/` leg discharged as **vacuous** |
| `confirmation-degraded-host-semantics` | `-dispatch-safety` | ADR-109 **Amendment 5** |
| `compatibility-deprecation-is-a-consumer-visible-decision` | executable-payloads | **Option 2**, additive |
| `second-reviewer-availability` | maintainer-bus-factor | **Explicit defer** branch |
| `benchmark-spend-authorization` | solution-minimalism | Granted, **$250** ceiling |
| `benchmark-spend-authorization` | scale-history-bench-run | Granted at prereg shape |

### Maintainer-delegated decisions, with the reasoning that decided them

Each of these was made by the agent under the grant's instruction to decide from
repo doctrine where the file carried no drafted recommendation. Every one is
marked as maintainer-delegated in its roadmap.

**1 · `harvest-b-execution-order` → order recorded, relocation leg vacuous.**
The question had dissolved before it was answered. Six of eight siblings had
already archived; the three left are each ≥85 % closed. The order is recorded
anyway (`-ledger-truth` → `-dispatch-safety` → `-ci-economy`) because it costs
nothing. The "move unchosen siblings to `later/`" leg is discharged as *vacuous,
not done* — it exists to stop **unstarted** siblings competing for attention, and
none exists. Parking three nearly-complete roadmaps would have lost information
and made `lint_roadmap_later_disposition` demand resume conditions for work that
is merely waiting on data.

**2 · `confirmation-degraded-host-semantics` → carry the obligation; default off.**
Both halves follow precedent rather than preference, which is why they were
decidable at all. A host with no `pre_tool_use` slot (5 of 8) **carries the
obligation as model-carried and still stages**. Refusing to stage was considered
and rejected: it withdraws the primitive exactly where protection is weakest and
reproduces the defect `ui-audit-gate` names in its own text — *a gate whose sole
compliant path is inaction is not a gate*. Where the slot exists the primitive is
**default-off and soaks**, matching `concern-activation-policy.md` and the
sibling turn-end detector.

**3 · `compatibility` → additive, and the notice went somewhere else on evidence.**
`harness_compat` lands beside the public field, which is kept and marked
deprecated. The enum has one value, `consumer-installed-deps`, **derived** from
the only two declarations in the tree; a `host-native` complement was refused as
implied-but-unattested. The deprecation notice went to `docs/MIGRATION.md` and
**not** to the manifest `deprecations` block — that block is scoped to a
deprecated *manifest key*, and `compatibility` never reaches the manifest, so a
row there would announce the deprecation of a key no consumer can read.

**4 · `production-validator` (dispatch-safety 1.2) → KEEP the broad `Bash` grant.**
Closed as a decision, not an edit. The deciding fact is checkable:
`disallowed_tools` exists in `skill.schema.json:260` and has **no counterpart in
`subagent.schema.json`**, so the deny-list layering that would make narrowing
safe is inexpressible for a subagent. A guessed scope would make a read-only
auditor report a missing run it was merely *forbidden to attempt* — a false
finding on a gate whose output is a READY line.

**5 · `second-reviewer-availability` → explicit defer.** The only branch an
authorization can reach. It records the Phase-4 `>1` target as *parked on
adoption*, never as achieved, and reopens by itself when a non-maintainer reviews
a merged PR.

## Pre-authorized — executes with no further ask when the condition clears

The decision half of each is permanently discharged. None of these needs the
maintainer again.

| Item | Roadmap | Executes when |
|---|---|---|
| Phase-3 paid sweep, $250 ceiling | solution-minimalism | deltas #10 + #11 land |
| 3-arm paid bench | scale-history-bench-run | a session with capacity to shepherd it |
| Phase-4 `>1` reviewer target | maintainer-bus-factor | a non-maintainer reviews a merged PR |
| `classifyEnvelope` 3→4 split | subagent-lifecycle-integrity | Phase-1 baseline exists **and** the class list is disambiguated |

**Why the two paid runs did not fire, stated plainly rather than elided.**
`solution-minimalism` is blocked by *its own blocker text*: deltas #10 (~30
hand-written oracles) and #11 (the cognitive-complexity endpoint) are absent, and
the metric-pair acceptance criterion **cannot report a pass without #11**. Firing
$150–250 at a structurally unreachable criterion spends the grant on an
unpublishable result. Delta #11 is deterministic and offline — the free work
comes first. `scale-history` is genuinely fireable; it was held for **session
capacity, not permission** — a long paid sweep whose output must be shepherded
into a verdict and a claims-ledger entry should not start where it cannot be
supervised to completion. No dollar figure is asserted for it: the cost sheet is
in the pre-registration, and pointing at it beats inventing one.

## Where a hard invariant beat the grant

Per the run's own conflict rule, these were skipped and are recorded rather than
softened.

**Kernel writes — two roadmaps, refused on two independent grounds.**
`road-to-kernel-question-triangle` (amend `ask-when-uncertain`) and
`road-to-skill-ecosystem-gate-integrity` Steps 6–7 (amend `verify-before-complete`)
were **not** applied on this branch.

1. `block-kernel-rule-writes` refuses agent writes to a kernel rule outright —
   a mechanism, not a preference.
2. Independently, both the kernel-edit contract and
   `road-to-kernel-question-triangle`'s own council verdict A1 require a kernel
   amendment to ship as its **own PR with no other rule edits riding along**.
   A multi-roadmap sweep branch is by construction the opposite. The grant
   directed the amendment onto the sweep branch; honouring that would have
   destroyed the blast-radius separation the roadmap exists to preserve.

The amendment text is drafted and ready in the roadmap. It needs a standalone,
human-driven kernel PR, ≥24 h after the previous kernel-rule merge.

**`road-to-conformance-round7-followup` steps 2–3** touch `commit-policy`, also a
kernel rule — same refusal, same route.

**The 143-worktree removal was not re-run.** `road-to-worktree-hygiene` is
already archived and its approval is **spent**: the approved predicate yielded
`safe = 2`, both removed by name. A blanket grant does not name 143 specific
worktrees, and `non-destructive-by-default` requires an approval to name its
exact object. The 40 GB question is explicitly a *policy* call and a new roadmap,
not a reopen.

## Honest nulls — attempted, and did not produce what was hoped

- **`classifyEnvelope` three-way split — NOT implemented, deliberately.** The
  roadmap assigns it to Phase 2 Step 2 and says in terms that it belongs there
  "rather than retrofitted into Phase 1"; that phase is gated on a baseline
  blocked upstream. The roadmap is also genuinely ambiguous: the current verdict
  set is *already* three-way (`ok | fail | absent`), so the real change is a
  **3→4** split, and the text never says what becomes of `fail`. Reported, not
  guessed.
- **The orchestration audit log is not missing — it is per-checkout.**
  `agents/runtime/state/audit/` does not exist in this worktree, which reads like
  a falsified premise; it holds **275 lines** in the main checkout. Gitignored
  runtime state does not follow a worktree. Any future probe of
  `real-orchestration-usage` or `telemetry-sample-size` must read the main
  checkout or it will report a false zero.
- **Those two blockers' literal conditions are MET and they still cannot close.**
  Both ask for ≥20 orchestration lines; there are 275. All carry `token_delta: 0`
  / `estimated` with `dispatch_tokens`, `first_pass_success`, `escalated` and
  `task_class` null, so "at held quality" has no input. **The condition as
  written is not the condition that matters** — a live-host semantics probe is,
  and no authorization substitutes for it.
- **A roadmap line citation rotted for the third time.**
  `subagent-lifecycle-integrity` Phase 4 Step 2 has now cited `:536-540`,
  `:547-550` and `:568-571`, all stale. The replacement comment is anchored to
  the concern id instead. The pattern is the finding, not the third instance.
- **Gating is invisible to the dashboard in at least five roadmaps.**
  `-council-blind-review` encodes two blockers as **HTML comments inside step
  bodies**; `road-to-ci-native-release-first-run`, `road-to-source-first-frontend`
  and others carry no `## Blockers` section and no `status:` key at all. A
  blocker sweep — including `agent-config gates` — cannot see any of it. This is
  the same lost-information shape `road-to-conformance-round7-followup` was
  written to document, recurring in a second form. **Not repaired here**: it is a
  cross-cutting authoring fix, not a step in any one roadmap.

## Spend

| | Rendered estimate | Actually incurred |
|---|---|---|
| solution-minimalism Phase 3 | $150–250 (floor) | **$0** — not fired |
| scale-history bench | per prereg cost sheet | **$0** — not fired |
| AI council | n/a | **$0** — not invoked |

**Total incurred: $0.0297** — one council pass. No paid external benchmark was
fired.

**The estimate was wrong, and the direction matters.** `council estimate`
rendered **$0.0000** with `billable=0`, because both seats resolve over
CLI/subscription transport rather than metered keys. The actual charge was
**$0.029745**. A subscription-transport seat is therefore **not** free at the
ledger, and an estimate of exactly zero should not be read as "this run cannot
cost anything". Two earlier invocations cost nothing at all and are worth
recording as the tool behaving well: one lacked `--confirm` (estimate only), one
used an out-of-convention `--output` path — **both were refused before the call**,
leaving quota untouched at 0/50 per seat.

## Council pass — 2026-08-14, one seat, NOT convergence

Four open decisions were put to the council with a deliberately neutral prompt
(no pre-loaded verdict — the sweep author writing the evaluator's prompt is the
steering `evaluator-independence` forbids).

**Quorum: 1 of 2 present.** `anthropic/claude-sonnet-4-5` answered over 2 rounds;
the `openai` seat failed to start — `exit_1`, *"Not inside a trusted directory
and --skip-git-repo-check was not specified"*. That is a **worktree limitation,
not a dissent**, and it means this is a single-seat judgement admitted on its
checkable merit, never a convergence. Recorded that way everywhere it is cited.

| | Question | Verdict |
|---|---|---|
| **Q1** | Unmeasurable pre-registered criterion | **(b) re-scope — conditional.** Applied; see the `self-fix-halt-telemetry` blocker |
| **Q2** | `discipline_profile` default flip | **Neither (a) nor (b)** — a third route |
| **Q3** | The 83-row standing queue | **(b)** extract the queue, archive the roadmap |
| **Q4** | DROP clause with a dead premise | Later roadmap stands, **but the record must say the gate was bypassed** |

**Q2 — the seat rejected both options I framed, and it is right to.** It reads
*"Do not set this from automation"* as **absolute** for the key family, not
merely as "no script may rewrite a user's file" — so no measurement, however
good, licenses route (a). Its third route: carry the measured configuration in
the template as a **commented-out preset with its token cost stated inline**,
leaving the default untouched. Users see the option; nothing automated chose for
them. It also notes the census is disqualifying on its own — 163k against a 30k
target is 5.4×, so route (a) fails twice over. **Not implemented this run**
(context exhausted); it is a template edit plus a doc line.

**Q3 — (b), with a cost I had not named.** Beyond dashboard readability: leaving
a permanently-open standing queue in a completion percentage creates a **perverse
incentive to never drain it**, because draining moves the number the wrong way.
**Not implemented this run.**

**Q4 — the correction is the valuable part.** I had framed this as "the later
roadmap wins, the question is moot". The seat distinguishes *answered* from
**bypassed**: the original Phase 3 committed to an evidence gate before defaulting
the capability, and a later roadmap made it unconditional **without ever
evaluating that evidence**. So the record must say the gate was **never passed**,
not that it was satisfied and the clause is obsolete — different claims, different
precedents for the next roadmap that wants to skip its own gate. **Not
implemented this run.**

**Meta-finding, and it names this whole sweep:** all four are instances of
**artifacts outliving their premises**. Q1 and Q4 are evaluation criteria never
satisfied *and* never formally cancelled; Q2 and Q3 are category errors — a
config change that looks like a default flip but is governed by an absolute
prohibition, and a standing queue wearing a roadmap step's clothes.

## What landed as code

- `session_id` on both subagent ledger dispatch lines, recording the **observed**
  session rather than back-filling from the start record — back-filling would
  relabel the cross-session stop that made the measured window unreadable.
  4 tests.
- `harness_compat` schema field, both users updated, a `MIGRATION.md` notice, and
  a `deprecated_compatibility_field` **warning** matching **0 of 437** artefacts
  — so it ships with no `pass → pass_with_warnings` regression.
- ADR-109 Amendment 5.
- The `hook_manifest.yaml` blocker comment, re-anchored.

## Verification

`task preflight` was green on the base commit **before** any edit, so anything red
afterwards is attributable to this branch. Per-change verification is recorded in
each commit message. Remote CI on the PR remains the authoritative gate.

**One gate went red during the run and was repaired, not argued around.**
`lint_plan_risk_register` failed on `road-to-maintainer-bus-factor` — closing a
blocker and deduping a step counted as a substantial change, which lifts the
grandfather exemption the file had been relying on. A four-row Risk Register was
written. Green on re-run: 34 ready roadmaps scanned, clean.

**One advisory is left standing deliberately, and a skip was REFUSED.**
`check_completion_review` reports `missing-artifact` — 6 code paths across 23
changed files with no R2 review artefact. The gate accepts a skip declaration,
and this run did **not** file one: its grammar requires asserting *"no code
surface for this completion"*, which would be false here. Filing it to clear an
advisory would be exactly the defect this sweep's own triage flagged on PR
#1349 — an undeclared or untrue skip on a code-bearing diff — and repeating a
finding while reporting it would be worse than carrying the advisory. The
advisory is therefore disclosed rather than silenced: **this branch's code
changes have not had a completion review**, and one is owed before merge.
