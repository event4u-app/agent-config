---
complexity: structural
status: carrier
parent_roadmap: road-to-inbox-harvest-2026-08-e-council-topology-evidence
---

# Road to the deferred council-topology evidence

> **Draft receiver.** This file exists so the 38 `[~]` items deferred out of
> `road-to-inbox-harvest-2026-08-e-council-topology-evidence` on 2026-09-01 have
> a **live destination** that `deferralProblems`
> (`src/agent-src/scripts/archive_completed_roadmaps.ts:414`) can verify from
> both ends. `status: draft` keeps it off the dashboard until a human flips it to
> `ready`; nothing here is scheduled work today.
>
> **`[~]` is DEFERRED, never cancelled.** Every item below is planned and
> carried, with a resumption trigger. The detail — evidence, forbidden claims,
> red-proof tables, execution sequences — lives in the three stubs each group
> names, and is not duplicated here.
>
> **Nothing guards this file, and that is worth knowing before relying on it.**
> The 38 obligations this file carries rest on it continuing to exist, and no
> gate in the repository would notice if it stopped. `deferralProblems` is a
> **one-shot** admission gate: its only production call
> (`src/agent-src/scripts/archive_completed_roadmaps.ts:574`) sits inside a loop
> over `collect()` (`src/agent-src/scripts/update_roadmap_progress.ts:748`),
> which skips every `status: draft` file (`:755-757`) and everything under
> `archive/`, `skipped/`, `stubs/` and `later/` (`:95`, `:315`). The parent is
> already archived, so the check that created this receiver can never run
> against the pair again. No linter reads `deferred-resolution:` or
> `parent_roadmap:` — the one other mention under `src/` is a warning string
> (`src/scripts/lint_roadmap_complexity.ts:259`). Neither reference gate sees
> the inbound links. Deleting this file would red nothing and would score as an
> estate **credit** (`src/scripts/check_estate_count.ts:490-534`).
>
> Full derivation, including the 43 inbound-reference census:
> [`agents/evidence/analysis/topology-followups-disposition-evidence-2026-09-01.md`](../evidence/analysis/topology-followups-disposition-evidence-2026-09-01.md)
> § 3. Closing the gap is
> [`stubs/road-to-deferral-carry-guard.md`](stubs/road-to-deferral-carry-guard.md),
> and it is deliberately not done here.

## Why one receiver rather than three, and the council split behind it

AI council 2026-09-01, members **anthropic (claude-sonnet-4-5)** and **openai
(codex-default)**, 2 rounds, blind chairman, subscription transport
(`billable=0`, `$0.0000`), quorum `2/2 present, needed 1 — concluded`.

**The seats SPLIT on this question and that is recorded rather than smoothed.**
The openai seat chose **2A**, one draft receiver: *"three receivers add
governance surface without improving preservation if one receiver maps the
groups faithfully."* The anthropic seat chose **2B**, three receivers, on the
ground that the three resumption triggers are non-fungible and one file would
need internal grouping *"which recreates the three-roadmap structure anyway"*.

**2A was taken, and the reason is not that it won a vote.** Each seat attached a
*condition* rather than an absolute, and the two conditions are simultaneously
satisfiable: openai's — one receiver is acceptable **iff** it maps the groups
faithfully — and anthropic's — the distinct triggers must stay
distinguishable. The per-group sections below are exactly that internal
grouping, so this file satisfies both conditions as stated.

**One further fact, recorded because acting on it silently would be worse.** The
anthropic seat's 2B rationale enumerated its three groups as *"Phase 2 + 23
deps"*, a *"Loom group (3 items)"* and a *"Council-topology group (12 items)"*,
with triggers naming `evidence_discipline/runner_arm_v2`, `v8.Isolate` access
and a 200-sample budget. **None of those exist in this tree** — there is no Loom
dependency, no `runner_arm_v2`, and no such budget. Its granularity argument
therefore rests partly on groups it invented, which is why the argument does not
transfer; its *condition* does, and is met. The seat's Question-1 verdict is
unaffected and was reached on evidence that does check out.

## Group A — Phase 2 and its dependents

**Deferred by:** AI council verdict **A3**, 2026-09-01, provisional and
owner-ratifiable (see the parent's `blocker: phase-2-benchmark-cost`).

**Detail:** [`stubs/road-to-council-topology-benchmark-execution.md`](stubs/road-to-council-topology-benchmark-execution.md)

**Resume when all three hold:** `n >= 5` independent eligible seats are
configured; a **verified** 20-consecutive-UTC-day reservation of that capacity
exists (an intention is not a reservation); and no governed-estate headroom
constraint prevents monopolising those seats for the duration. Plus the
fresh-manifest trigger: if the corpus, models, prompts, eligibility rules or
provider configuration change, the frozen manifest is invalid and a new
pre-registration cycle is required.

- [ ] 2.2 Mandatory baselines per eligible slice
- [ ] 2.3 Emit the full metric set
- [ ] 2.4 Stage ablation
- [ ] 2.5 Separate model quality from topology quality
- [ ] 2.7 Round-count bias arm
- [ ] 5.2 Bench identity-blind against identity-visible synthesis
- [ ] 5.5 Revisit ADR-120 only on results
- [ ] 6.5 Pre-registered promotion gate against a fixed-round arm — the
      recorded-gate half is DONE and preserved; only the against-the-arms half
      is carried
- [ ] 7.2 The selector returns an explainable record
- [ ] 7.4 Deterministic policy first, interpretable features only
- [ ] 7.5 Shadow mode first
- [ ] 7.6 Promote per task slice on benchmark evidence only
- [ ] 8.5 Stop when the next call has low expected value
- [ ] 9.1 Same-provider host-subagent fan-out lane as a governed exception
- [ ] 9.4 Benchmark governed bundles after seating is solved
- [ ] 10.4 Compute route regret offline
- [ ] 11.2 Train an offline challenger classifier
- [ ] 11.3 Promotion requires a material Pareto improvement
- [ ] 11.5 Model-generation changes mark affected routing evidence
- [ ] 13.1 Shadow rollout stage
- [ ] 13.2 Advisory rollout stage
- [ ] 13.3 Adaptive rollout stage
- [ ] 13.4 Default-on per slice
- [ ] 13.5 Re-evaluate on model-generation changes

## Group B — the provider-recognition leakage bench

**Deferred by:** the council's **B1** verdict under the **B3** fallback its own
openai seat named, 2026-09-01. **No measurement was taken and none is claimed.**

**Detail:** [`stubs/road-to-provider-leakage-bench-execution.md`](stubs/road-to-provider-leakage-bench-execution.md)

**Resume when** two consecutive UTC-day windows can be reserved with the
per-provider cap free in both, and the run executing them can remain coherent
across the boundary. Each arm is 30 calls per provider against a cap of 50 per
provider per UTC day, so the arms cannot share a day.

- [ ] 3.3 Provider-recognition leakage bench — build the runner, run both arms
- [ ] 3.4 Hold style normalization behind the stronger gate

## Group C — instrumentation and its live-run evidence

**Deferred by:** the council's second pass, 2026-09-01. Every guard named in the
stub is **committed and runs in CI regardless of these checkboxes** — the
council was explicit that they are defensive infrastructure, not blocked work.

**Detail:** [`stubs/road-to-council-topology-instrumentation.md`](stubs/road-to-council-topology-instrumentation.md)

**Resume, per item**, when the population it guards enters an integration branch
or a release candidate (7.3, 10.1, 10.6, 11.1, 12.1, 12.2, 12.3); when the
mechanism is built AND a qualifying real run is scheduled (5.4, 10.2, 10.3);
when one allocated representative analysis run is available in which **every**
answering seat inlines the findings block (1B.1); and when capacity is
explicitly allocated for `>= 10` representative runs with the comparison methods
frozen beforehand (1B.4).

- [ ] 1B.1 Findings schema as a fenced trailing block, replacing the second
      extraction call — the authorised run was made 2026-09-01 and REPRODUCED
      the `codex-default` contract miss; n = 2, not a rate
- [ ] 1B.4 Promotion gate across `>= 10` real analysis runs
- [ ] 5.4 Final synthesis retains unresolved disagreement
- [ ] 7.3 Keep the deterministic/probe path above council
- [ ] 10.1 Extend decision replay with the route record
- [ ] 10.2 Attribute each useful correction to its first stage
- [ ] 10.3 Emit `zero_marginal_value_call_rate`
- [ ] 10.6 Track early-stop savings separately from quality
- [ ] 11.1 Offline training rows without raw prompt content
- [ ] 12.1 `/council` stays the user concept
- [ ] 12.2 A free explain mode
- [ ] 12.3 A force-topology control cannot override the five named authorities

## Unguarded-carrier gap — CLOSED 2026-09-02, and drain 14's verdict reversed on the record

> **This section changes `status:` and nothing else about the obligations.** All
> 38 items stay exactly where they are, with the same triggers and the same
> `[~]`. What changed is that three mechanisms now stand between this file and
> its own removal, and `status: draft` became `status: carrier`.

*AI council 2026-09-02 (drain run 16), members `anthropic/claude-sonnet-4-5` +
`openai/codex-default`, 2 rounds each over two rounds of questions, depth deep,
peer-review, blind chairman, quorum 2/2 present (needed 1) — concluded.
Subscription transport, `billable=0`, `$0.0000`. Council artefacts are
gitignored and auto-pruned, so every line relied on is inlined here per
`no-roadmap-references`.*

**Drain 14's verdict 3A is reversed, and the reversal is recorded rather than
quietly overwritten.** That verdict — *"this file stays `status: draft`, and the
guard stub is NOT promoted"* — rested on two grounds, and the drain-14 record
names both. The first was authority: *"adding a CI gate is a governance act
whose authority this run has not established."* The second was evidence: both
seats graded the header's *"deleting it reds nothing"* claim **SPECULATIVE** for
want of command output, and made escalation **conditional** — *"if confirmed,
surface to owner"*.

**The condition was met by the same run that recorded it.** The mutation test
the council asked for was run on 2026-09-01 and confirmed the claim. So the
lock's own escalation trigger had fired before this round opened; drain 16 did
not overrule a standing verdict, it satisfied the condition that verdict
attached.

**Verdict 3Q, convergent 2/2.** Both seats refused plain 3A on the second
asking, in terms that answer drain 14's evidence ground directly: *"recognizing
the file socially as a carrier does not protect it mechanically."* The invariant
they named belongs to the obligations rather than to this pathname: *"A live
deferred obligation must always have a validated carrier, and it may disappear
from that carrier only through resolution or an explicit, validated transfer."*

**Position P — migrate the 38 obligations out of the roadmap estate — was
refused.** *"Any Position P destination satisfying that invariant would
effectively recreate Position Q under another name."* It was additionally
refused as undecidable by an autonomous run, since the migration target is a
semantic choice.

**One design point diverges from both seats and the divergence is the better
answer.** One seat required *"a durable registry, baseline comparison, or
equivalent tombstone mechanism"*, on the correct ground that *"a validator that
only scans surviving carriers has nothing left to inspect"* once a whole file is
deleted. The remedy taken is not a registry: the **archived parent already is
the durable record**. It carries `<!-- deferred-resolution: carried-to=<slug> -->`
for every deferred item, it lives where nothing rewrites it, and it names this
file by slug. `lint_carrier_integrity` walks from that side, so deletion is
caught on the first pass with no baseline file to maintain and no second
suppression surface.

**What now stands between this file and its removal.**

1. `src/scripts/lint_carrier_integrity.ts` — walks every roadmap under
   `archive/` and `skipped/` and hard-fails at zero on a `broken-destination`.
   Deleting this file produces 38 of them. Renaming it, re-parenting it,
   moving it to `skipped/`, or archiving it while it declares `status: carrier`
   each red the same way.
2. `check_estate_count.classifyDiff` — removing a `status: carrier` roadmap no
   longer scores an offset, so the estate credit that made deletion profitable
   is gone. Asserted in that gate's own case table, together with the control
   proving an ordinary deletion still offsets.
3. `status: carrier` in `update_roadmap_progress` and
   `check_roadmap_trackable` — this file is skipped where a draft is, so it
   stays off the dashboard and out of `/roadmap:process-*` without claiming to
   be scheduled work, and its lack of `## Phase` headings is no longer a
   trackability failure.

**What still does not guard it, stated because the header above was written to
be honest about exactly this.** No mechanism monitors the 38 resumption
triggers, so an item whose trigger fires stays `[~]` until a human looks. The
transition vocabulary — rename, re-parent, split, onward carry, partial
resolution, carrier-to-carrier transfer — does not exist; every one of those
transitions fails closed today, which both seats asked for as a deliberately
immobile first version. `agents/roadmaps/stubs/road-to-carrier-transition-vocabulary.md`
records it.

## What this file may NOT be read as claiming

That any deferred mechanism was verified against a real population; that
topology validation is live; that any promotion gate passed; that telemetry is
complete; that Phase-2 equivalence was measured; or that sabotage sensitivity is
positive runtime validation. Each stub carries a per-group forbidden-claims
list, and those lists govern.

**That sentence was not true when this file was written, and was made true on
2026-09-01 rather than softened.** Only the Group A stub carried such a list.
The Group B stub stated the permitted claim and no prohibitions; the Group C
stub carried a list for one of its three internal groups. The missing lists have
been added by transcribing the archived parent's own per-step deferral blocks —
each of which pointed *at these stubs* for its forbidden claims, so the pointer
previously resolved to nothing. Nothing was invented; the transcription sources
are cited inside each new section.

## Unguarded-carrier gap — CONFIRMED 2026-09-01

> **This section adds a measurement and changes nothing else.** No checkbox is
> flipped, no item is added or removed, and `status:` stays `draft`. It is here
> because the header above states the gap as a claim, and a claim that reached
> a council as *speculative* is now a measurement — including one part that came
> back **worse** than the header said.

*AI council 2026-09-01 (drain run 14), members `anthropic/claude-sonnet-4-5` +
`openai/codex-default`, 2 rounds, depth deep, peer-review, blind chairman,
quorum 2/2 present (needed 1) — concluded. Subscription transport,
`billable=0`, `$0.0000`. Verdicts **1C / 2C / 3A**, convergent 2/2 on all three.
The question and both seat responses are local-only and are deliberately not
cited by path — `agents/runtime/council/` is gitignored and auto-pruned, so per
`no-roadmap-references` the text relied on is inlined.*

**Verdict 3A: this file stays `status: draft`, and the guard stub is NOT
promoted.** Both seats held that adding a CI gate is a governance act whose
authority this run has not established. Both also graded the header's *"deleting
it reds nothing"* claim **SPECULATIVE** for want of command output, and made
escalation conditional: *"if confirmed, surface to owner"*.

### The mutation test the council asked for — run, and confirmed

Isolated detached worktree at commit `b50b27281`, `node_modules` cloned so a
missing-dependency false red is excluded. Nine gates run in an identical loop
twice: once with this file present, once with it deleted.

| Gate | carrier present | carrier deleted |
|---|---|---|
| `check_estate_count` | exit 0 | exit 0 |
| `check_no_roadmap_refs` | exit 0 | exit 0 |
| `check_references` | exit 0 | exit 0 |
| `check_roadmap_trackable` | exit 0 | exit 0 |
| `lint_empty_roadmaps` | exit 0 | exit 0 |
| `lint_roadmap_blockers` | exit 0 | exit 0 |
| `lint_roadmap_complexity` | exit 0 (3 files) | exit 0 (2 files) |
| `lint_roadmap_later_disposition` | exit 0 | exit 0 |
| `lint_roadmap_family_cap` | exit 0 (3 scanned) | exit 0 (2 scanned) |

**Nine of nine green in both directions.** Deleting a file carrying 38 live
obligations reds nothing.

### A correction to this file's own header, in the stricter direction

The header above predicts that deleting this file *"would score as an estate
**credit**"*. **Measured, it scores as nothing at all.** `check_estate_count`
reports `active_roadmaps 2 (floor 2, +0)` both with the file present and with it
deleted. The reason is `status: draft`: `collect()` skips every draft file
(`src/agent-src/scripts/update_roadmap_progress.ts:755-757`), so this roadmap was
never in the active count in either direction.

**That is worse than the header claimed, not better.** A credit would at least
have been a visible delta — a number moving, something a reader or a ratchet
could notice. There is none. The deletion is not merely unpunished; it is
**invisible**. The header's wording is left in place above and corrected here
rather than rewritten, so the claim and its refutation stay side by side.

### Why the gap was not closed in this run

Beyond verdict 3A, a census run in the same pass supplies the engineering
reason. Across `agents/roadmaps/archive/`: **46** `deferred-resolution:
carried-to=` annotations in **5** files, naming **6** distinct destinations. Two
of the six already resolve **only** under `archive/` —
`road-to-journal-host-capture-measurement` (carried from
`archive/road-to-runtime-event-journal.md:124`) and
`road-to-obligation-delivery-verification` (carried from
`archive/road-to-turnaround-followups.md:82`) — and both would fail the
destination-is-not-dead check at
`src/agent-src/scripts/archive_completed_roadmaps.ts:470-477`.

**Both are benign.** A roadmap only reaches `archive/` through
`archive_completed` once `stats.open_ === 0` (`:562`) and its blockers are
closed (`:591`), so each of those receivers discharged the work it received
before being archived. So the naive standing validator — the guard stub's
option 1 — is **2-of-2 false-positive on the live corpus at this commit**.

That converts
[`stubs/road-to-deferral-carry-guard.md`](stubs/road-to-deferral-carry-guard.md)'s
predicted *"disposition vocabulary it does not have today"* from a prediction
into a measurement: the vocabulary has to distinguish a receiver archived
**after discharging** the carry from one archived **with it still open**, and
nothing in the tree records that difference today.

### Disposition

**Surfaced to the owner, and deliberately not acted on.** The escalation
condition both seats attached — *"if confirmed, surface to owner"* — is met, and
this section is the surfacing. Nothing was built: promoting the guard stub, or
shipping the narrower `classifyDiff` change, is a governance act on a
fail-closed archival path, and verdict 3A withholds that authority from this
run. The gap is real, it is now measured rather than asserted, and it remains
open.


## Disposition 2026-09-01 (drain run 15) — 2b-i, and one divergence recorded rather than executed

*AI council 2026-09-01 (drain run 15, second round), members
`anthropic/claude-sonnet-4-5` + `openai/codex-default`, 2 rounds, depth deep,
peer-review, blind chairman, quorum **2/2 present** (needed 1) — concluded.
Subscription transport, `billable=0`, `$0.0000`. Council artefacts are
gitignored and auto-pruned, so every line relied on is inlined here per
`no-roadmap-references`.*

This run operated under a written owner instruction delegating every open
decision to the council, and naming a terminal fallback: *"If a blocker
survives execution, council decision, re-scoping and descoping … descope it
into a stub with rationale, close the roadmap around it, ship the PR,
continue."* Two questions were put: what to do about this carrier, and whether
the delegation reaches the 3A no-promote finding recorded above.

### The carrier — verdict 2b-i, convergent 2/2: leave it standing, claim nothing

The 38 obligations are valid; their resumption predicates are false and **no
repository work can change them**. Re-measured this run: `council:status`
reports **2 enabled of 5** against Group A's `n >= 5` floor, and a *verified*
20-consecutive-UTC-day capacity reservation is not an action that exists in
this environment. Group B needs two reserved UTC-day windows because each arm
is 30 calls per provider against a 50-per-provider-per-day cap, and a
mid-execution break was ruled to make partial results invalid. Group C lacks
the population or the authorised real-run conditions.

**The terminal fallback was considered and does not apply, for a mechanical
reason rather than a preference.** A stub is not a legal carry destination —
`deferralProblems` resolves `carried-to=` only against
`agents/roadmaps/<slug>.md` or `agents/roadmaps/later/<slug>.md`, and
`agents/roadmaps/stubs/` resolves as *"does not exist"* and reds the archival
sweep. `later/` was rejected by a council in this family on preservation
grounds and the seats re-affirmed it here: *"Moving the obligations to `later/`
would reduce their visibility and operability, violating the preservation
rationale already recorded. Moving them to `stubs/` is mechanically invalid.
Archiving the carrier without a sound destination would therefore be cosmetic
closure."*

The owner instruction's own *"legitimate gate closure only"* clause is what
decides it: *"Any suggestion that the terminal-fallback instruction requires a
false closure — its 'legitimate gate closure only' clause controls when the
repository provides no legal stub route."*

**The boundary, as the council stated it:** preserve all 38 obligations in
place · preserve the three measurable resumption triggers · do not archive,
cancel, promote or transfer the carrier · do not claim its work is complete.

**One rejected repair, recorded so it is not re-proposed.** A new
`status: terminal-parked-pending-capacity` was floated and refused: *"Inventing
a new status could make the roadmap untrackable or create another governance
bypass. The supplied facts only establish that `status: draft` works
mechanically."* The file keeps `status: draft`.

The counter-argument was heard and is not dismissed: an indefinitely retained
0/38 draft is estate noise and weakens the meaning of *"active roadmap"*. The
seat that raised it also answered it — *"taxonomy discomfort is weaker than
losing tracked obligations."*

### The unguarded-carrier gap — DIVERGENT, so nothing was built

The § Disposition above surfaced a measured integrity defect: deleting this
carrier is invisible to all nine gates. Drain 15 asked whether the owner's
delegation supplies the authority that verdict 3A found absent.

**The seats disagreed, and the disagreement is the outcome.**

- One seat: *"The standing instruction is unusually explicit: every open
  decision is answered by the council … The earlier 3A result identified
  missing authority, not a permanently owner-reserved constitutional floor."*
  It chose mechanism 1 while rejecting its naive form.
- The other seat: *"The standing instruction authorizes closing this roadmap
  under current rules, not creating new CI gates with repository-wide scope …
  The unguarded-carrier gap is not a blocker to this roadmap — it is a systemic
  governance blind spot that affects future archival decisions. Creating a new
  CI gate is a governance act that outlives this run."*

**A divergent council does not carry a mandate**, so no validator was written,
no gate was registered, and 3A stands. The gap remains open and measured.

**What the permissive seat specified is kept anyway**, because it is the design
a future authorised run would otherwise re-derive — and because the naive form
is already known to be wrong: implement referential integrity for carry
annotations, not the measured naive validator · recognise every
repository-defined legitimate destination including the benign ones under
`archive/` · reject missing destinations and demonstrable loss of carried
obligations · do not require receivers to be active or non-draft unless an
existing rule independently requires it · fixtures for all six observed
destination shapes and both archive-only cases · zero false positives across
the current 46 annotations · prove that deleting this carrier makes the check
fail · keep genuine unresolved references fail-closed. Mechanism 2 (charging
the deletion in `classifyDiff`) *"should remain unapproved absent a separate
specification and regression analysis of every `classifyDiff` consumer"*.

### What this run did NOT do

Nothing was checked, nothing was archived, nothing was transferred, no
mechanism was built, and no capacity was reserved. The file is materially
unchanged apart from this record. That is the honest terminal state of a
carrier whose every trigger is a fact about the world rather than a fact about
the repository.
