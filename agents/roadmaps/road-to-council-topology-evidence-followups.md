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
> both ends. `status: carrier` keeps it off the dashboard and out of the active
> estate count until a human flips it to `ready`; nothing here is scheduled work
> today. (This line said `status: draft` until 2026-09-03; the frontmatter has
> read `carrier` since the status that costs something landed, and a header
> naming a status the file does not carry is the class of error this whole
> roadmap is about.)
>
> **`[~]` is DEFERRED, never cancelled.** Every item below is planned and
> carried, with a resumption trigger. The detail — evidence, forbidden claims,
> red-proof tables, execution sequences — lives in the three stubs each group
> names, and is not duplicated here.
>
> **This file IS guarded now — corrected 2026-09-03, and the correction is the
> point.** This paragraph used to open "Nothing guards this file", state that no
> gate would notice if it stopped existing, and conclude that "deleting this file
> would red nothing". All three were true when written and all three are now
> false. `src/scripts/lint_carrier_integrity.ts` landed on 2026-09-02 (#1810,
> `6641d4719`) and walks from the ARCHIVED side: an archived parent names its
> receiver by slug, so the expected set of live receivers is derivable without a
> registry, and whole-file deletion is caught on the first pass.
>
> **Measured, not asserted.** Moving this file out of the tree and re-running the
> gate produces `❌ 38 broken deferral carries` and exit 1, naming the archived
> parent and the destination that "no longer exists anywhere under
> `agents/roadmaps/`". Restoring it returns exit 0. That gate's own baseline
> entry names this file by path as the reason its broken-destination class
> carries **no baseline at all**: "deleting
> `agents/roadmaps/road-to-council-topology-evidence-followups.md` produces 38 of
> those and must red immediately rather than nudge a count."
>
> What remains accurate from the original paragraph, and is kept because it
> explains why a second gate was needed: `deferralProblems`
> (`src/agent-src/scripts/archive_completed_roadmaps.ts:414`) IS a one-shot
> admission gate — its only production call (`:574`) sits inside a loop over
> `collect()` (`src/agent-src/scripts/update_roadmap_progress.ts:748`), which
> skips every unscheduled file (`:755-757`) and everything under `archive/`,
> `skipped/`, `stubs/` and `later/` (`:95`, `:315`). The parent is already
> archived, so that check can never run against this pair again. The standing
> validator is what closed the gap, not a change to the one-shot one.
>
> Two claims were NOT re-verified when this was written. **One of them is now
> measured, 2026-09-03, and it moved in the stricter direction:** deleting this
> file scores as a **shrink of one**, not as a credit and not as nothing.
> `check_estate_count` reports `active_roadmaps 4 (floor 4, +0)` with the file
> present and `3 (floor 4, -1)` with it moved aside — probed by moving the file
> out and back with a byte-identical restore. The mechanism is
> `countActiveCarriers` (`src/scripts/check_estate_count.ts:460`), added into
> `active_roadmaps` at `:527` precisely so that flipping a status is
> count-neutral and a roadmap cannot be laundered out of the count by adding one
> word. A carrier's removal still earns no offset (`classifyDiff`), so the
> deletion is visible and unrewarded. The reference-gate reach is still not
> re-verified. Deletion is a hard failure now regardless of the score, so this
> changes no disposition — it removes the one thing the earlier text called worse
> than a credit, which was invisibility.
>
> Full derivation, including the 43 inbound-reference census:
> [`agents/evidence/analysis/topology-followups-disposition-evidence-2026-09-01.md`](../evidence/analysis/topology-followups-disposition-evidence-2026-09-01.md)
> § 3. The stub that was to close the gap has been consumed by the change that
> closed it, so the pointer that stood here is deliberately not replaced with
> another.

## Drain-run disposition, 2026-09-08 — NOT EXECUTED, and this is the record

An autonomous drain run instructed to carry **every** active roadmap under
`agents/roadmaps/` to completion reached this file and **stopped**. This section
is what it recorded instead of executing 38 carried items.

**Council verdict: (a) No — a `status: carrier` roadmap is human-gated and an
autonomous run may not execute, promote, close, or advance it.** Two seats, deep
tier, unanimous. Decided alongside `road-to-continuity-retirement-sequencing`,
whose disposition section carries the full reasoning; only what is specific to
**this** file is recorded here, so the two records cannot drift.

**What is specific here: this file has no promoting probe at all** — its sole
stated transition is *"a human flips it to `ready`"*. The council was asked
directly whether that absence makes the file **more** protected or **less**,
because the two readings are opposite and a run must not pick the convenient one.

**Both seats: MORE protected.** A file with a probe at least offers an objective
condition a future reader can evaluate. This one offers none, so there is no
autonomous transition to satisfy — "a human flips it" is the whole path, and
reading an absent condition as an open door inverts what the absence means.

**The measured-null exit is not available here either.** The run may collect
evidence bearing on whether these 38 items are still worth doing and recommend
that outcome; it may not adopt it. No such recommendation is made: the run did
not read the three stubs these groups name, so it has no evidence about the
items' current worth and says so rather than inferring one from the file's age.

*Reopening:* a human flips `status` to `ready`. Nothing else.

Council record: `2026-09-08-carrier-roadmaps-in-an-autonomous-drain.md` under
`agents/runtime/council/responses/` — local-only, since `agents/runtime/` is
gitignored, so the substance is transcribed here and in the sibling carrier
rather than linked.
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
> deferred disposition. What changed is that three mechanisms now stand between
> this file and its own removal, and `status: draft` became `status: carrier`.
>
> *(Corrected 2026-09-07: this sentence read "and the same `[~]`". The glyph is
> wrong for **this** file — the 38 items here are marked `[ ]`, and `[~]` is
> their mark in the archived parent, where each one carries a
> `carried-to=` annotation. The disposition is unchanged and is what the
> sentence meant; the glyph naming it was not this file's. Why `[ ]` is the only
> mechanically available mark here, and the tension that creates with the
> council's own "no indefinite `[ ]`" floor, is § Drain run 20.)*

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

## Drain run 20 (2026-09-07) — 0 of 38 closed, and every trigger re-measured rather than assumed

> **Nothing was checked, nothing was archived, and this roadmap does not close.**
> That is the finding, not a shortfall against it. The 38 obligations' resumption
> predicates are facts about the world, and a repository run cannot move a fact
> about the world. What a new run *can* add is fresh measurement, and everything
> below is measured at this commit rather than carried over from 2026-09-03.

**The council was NOT re-run, and that is the discipline.** Three rounds already
answered this file's question — drain 14 (verdict **3A**), drain 15 (verdict
**2b-i**, convergent 2/2), drain 16 (re-affirmed after re-reading the lock) —
each under an owner instruction materially identical to this run's. The recorded
boundary was re-read before being relied on: *preserve all 38 obligations in
place · preserve the three measurable resumption triggers · do not archive,
cancel, promote or transfer the carrier · do not claim its work is complete.*
Re-asking a settled question after an unwelcome verdict is verdict shopping.

**The one check that could have unsettled it was run and did not.** Before
citing the lock, this run looked for a genuinely new decision the earlier rounds
had not seen — specifically for a separable "doable half" of any deferred item,
the split that resolves a time-gated step elsewhere in this estate. There is
none left: the separation has already been performed item by item upstream. 6.5
banks its recorded-gate half and carries only the against-the-arms half; 1B.1
banks its reproduced `codex-default` contract miss at `n = 2`; 5.4's remaining
scope was narrowed on 2026-09-03 from three synthesis elements to one. The single
place a prose-only half was plausible was refused by both seats in terms that
still apply — *"merely adding prose to four templates would create another
indefinitely parked baseline"*. A question whose entire option set is
mechanically foreclosed is not a question worth a seat.

### The three triggers, measured at this commit

| Group | Trigger | Measured 2026-09-07 | Moved? |
|---|---|---|---|
| A | `n >= 5` independent eligible seats | `council:status` → **2 enabled of 5** (anthropic, openai) | no |
| A | verified 20-consecutive-UTC-day reservation | no such action exists in this environment | no |
| B | two consecutive reserved UTC-day windows, 30 calls/provider against a 50/provider/day cap | no reservation exists or can be made | no |
| C | guarded population enters an integration branch or release candidate | the guarded features are unbuilt (below) | no |

**One Group A fact is new, and it moves the trigger further from met rather than
closer.** `council:status` additionally reports both seats at
`qualification: unknown` — *"no exchange with this provider has ever been
recorded"* — and states the consequence itself: they *"are not counted toward a
quorum"*. So the seat position at this commit is 2 configured of 5 **and zero
qualified**, where the earlier record established only the 2-of-5 shortfall. The
`n >= 5` floor is short by three seats before qualification is even reached.

**Group C's two repository-side facts were re-verified and came back stricter,
not looser.** Step 10.3's metric is still absent in every form — a search for
`zero_marginal|marginal_value|marginalValue|zmv` across `src/` and `tests/`
returns zero hits. Step 10.2's stage-output vocabulary still has **zero
production importers**: `StageOutput` occurs only at its own definition site,
`src/scripts/ai_council/replay_route.ts` lines 49, 74 and 175, and the two test
files reach it through the `stageOutputs` property rather than the type name. Its
trigger asks for production code that *emits* stage records; nothing emits them.

### The seven committed guards are green, and that is still not closure

All seven test files named in the Group C stub are present, and running them
together gives **83 passed of 83** — matching the stub's per-file counts exactly
(7 · 13 · 11 · 13 · 11 · 15 · 13). So that stub's *"everything already built
stays built"* is re-verified true at this commit rather than assumed.

It closes nothing. The stub's forbidden-claims list names this exact temptation
twice, and it governs: **sabotage sensitivity is not positive runtime
validation.** The only permitted claim is that the defensive tests exist and
detect the planted violation. Seven green guards over an absent population are
seven green guards over an absent population.

### Archival is refused mechanically, and the refusal was measured this run

The boundary forbids archiving; so does the tree, and the second fact was probed
rather than quoted. Moving this file out and re-running
`src/scripts/lint_carrier_integrity` produces **`❌ 38 broken deferral carries`
and exit 1**, naming the archived parent for every one. Restoring the file
returns exit 0, verified byte-identical by `sha256`
(`0e1b2efb4882a7626431ce43de0874f70a7ad556a86453cd43f6314e95f7c2ed`) with a
clean working tree before and after.

The descope route was re-checked and is still closed: `deferralProblems`
resolves `carried-to=` only against `agents/roadmaps/<slug>.md` or
`agents/roadmaps/later/<slug>.md`, so `stubs/` is not a legal destination;
`later/` was refused by a council in this family on preservation grounds; and
`[-]` is owner-reserved. Every mark other than `[ ]` is therefore either
unavailable or a false green.

**One header figure had gone stale and is corrected here.** The header records
`check_estate_count` reporting `active_roadmaps 4 (floor 4, +0)` with this file
present. At this commit it reports **`active_roadmaps 10 (floor 10 at
origin/main, +0)`** and the estate is within its ratchet. The 2026-09-03 reading
was true when taken; the estate grew around it. The mechanism the header credits
— `countActiveCarriers`, added into `active_roadmaps` so a status flip is
count-neutral — is unchanged, so the disposition it supported is unchanged with
it. Only the number moved.

### The glyph tension, recorded because it is resolved nowhere

The 38 items here are `[ ]`. The council floor carried in the Group C stub says
**"no indefinite `[ ]` parking — 'mechanism built, waiting for population' is a
deferred state, not an active one"**, and its floor 2 forbids *"no indefinite
`[ ]` without a scheduled execution path"*. Both describe these 38 exactly.

The floor was satisfied **at the parent**, which converted its steps to `[~]`
with a `carried-to=` annotation apiece. It cannot be satisfied *here*: a `[~]`
in this file would need its own onward receiver, and there is no legal one — the
same wall § Disposition 2026-09-01 (drain run 15) hit. So `[ ]` is not a
judgement that this work is active; it is the only mark the tree permits, and the
floor and the mechanism are in genuine conflict at this one spot.

This is recorded rather than resolved, and deliberately not sent to a seat: the
option set is empty, so there is nothing for a council to choose between. It
belongs to whoever holds the transition vocabulary, and that stub now carries a
fired trigger of its own (next section).

### A sibling stub's resumption trigger fired, and nothing noticed for five days

`agents/roadmaps/stubs/road-to-carrier-transition-vocabulary.md` deferred its
work on an explicit premise — *"There is exactly **one** carrier in the tree"* —
and set its reopening condition as *"a second carrier appears"*. **A second
carrier appeared on 2026-09-07:**
`agents/roadmaps/road-to-the-skill-surface-framing-choice.md`, `status: carrier`,
parent `road-to-the-activation-census-consequence`, landed in `a42179585`
(PR #1884). `lint_carrier_integrity` now reports `2 live carrier(s) justified`
where its 2026-09-02 run reported one.

That stub has been updated with the dated observation, the provenance, and an
explicit statement that nothing was built — designing a carrier-identity scheme
or a transfer declaration means repository-wide lifecycle infrastructure plus a
CI gate to bind it, and that authority was found absent by drain 14's verdict 3A
and left divergent by drain 15. The engineering premise changed; the authority
did not.

**It is worth naming what this instance demonstrates,** because this file
predicted it. § What still does not guard it says: *"No mechanism monitors the 38
resumption triggers, so an item whose trigger fires stays `[~]` until a human
looks."* A sibling artefact's trigger fired, was met for five days, and was
found only because a directed run happened to read the file. The prediction is
confirmed with a live instance, on a neighbour rather than on the 38 — which is
the same gap either way.

### What this run did NOT do

No checkbox was flipped. Nothing was archived, promoted, cancelled or
transferred. No mechanism was built, no gate was written, no capacity was
reserved, no seat was spent (`$0.0000`, no council call made), and no work here
is claimed complete. Every one of the 38 obligations stands exactly where it
stood, under the same triggers, with the same forbidden-claims lists governing.
The changes are three factual repairs and two dated observations — the class of
edit drain 16 established as inside the boundary, for the reason it gave: a
carrier whose whole subject is a mechanism keyed on something that moved is the
worst possible place to leave a stale claim standing.

## Where the governing Blockers and Acceptance Criteria live

This file carries **no `## Blockers` section and no `## Acceptance Criteria`
section**, and that is deliberate rather than an omission — it is a receiver,
not a schedulable roadmap. Both surfaces belong to the archived parent
`road-to-inbox-harvest-2026-08-e-council-topology-evidence`: nine blocker
entries, all `Status: resolved` (which is why that roadmap could archive at
all), and 29 numbered acceptance criteria. Each of the 38 obligations below is
measured against those, not against anything in this file.

Stated here because the absence is otherwise indistinguishable from an artefact
that forgot to write them, and a reader concluding the obligations carry no
acceptance criteria would conclude the opposite of the truth.

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

**Re-measured 2026-09-03 — the invisibility is closed, and this paragraph is
appended rather than rewritten for the same reason the paragraph above was.**
`check_estate_count` now reports `active_roadmaps 4 (floor 4 at origin/main, +0)`
with this file present and `3 (floor 4, -1)` with it moved aside. Probed by
moving the file out, running the gate, and moving it back to a byte-identical
copy; the working tree was clean before and after.

The mechanism is `countActiveCarriers` (`src/scripts/check_estate_count.ts:460`),
whose result is added into `active_roadmaps` at `:527`. Its own docblock states
the defect it closes, and it is this one: *"flipping one file to `carrier` moved
`active_roadmaps 3 → 2` and the gate printed 'estate within its ratchet'
… any roadmap can be laundered out of the count by adding one word."* So the
`status: draft`-then-`carrier` invisibility this section measured on 2026-09-01
was a real hole and is now plugged from the other side. Deleting this file is a
**visible** shrink of one — and still earns no offset, because `classifyDiff`
grants none for a carrier's removal, which is the half that has not changed.

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

That converts the guard stub's predicted *"disposition vocabulary it does not
have today"* from a prediction into a measurement (the stub itself is gone —
consumed by #1810, the change that shipped the guard, so it is named rather than
linked): the vocabulary has to distinguish a receiver archived
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

## Disposition 2026-09-03 (drain run 16) — the same instruction arrived again, and the lock held

A second autonomous drain run reached this file under a **written owner
instruction materially identical to drain run 15's**: drive every active roadmap
to completion, route every open decision to the AI council rather than to the
owner, and — the clause that decides this file — *"legitimate gate closure
only… never mark a gate green without one of those three."*

**The council was NOT re-run on it, and that is the discipline rather than a
shortcut.** The prior section records a 2-round, 2/2-quorum council verdict on
this exact question, on this exact mechanism, under this exact instruction shape.
Re-asking after an unwelcome verdict is verdict shopping, not rigour. The
recorded boundary is unchanged and was re-read before being cited: *preserve all
38 obligations in place · preserve the three measurable resumption triggers · do
not archive, cancel, promote or transfer the carrier · do not claim its work is
complete.*

**The triggers were measured live rather than assumed, which is the one thing a
new run can add.** Phase 2's trigger requires `n >= 5` independent eligible
seats. `agent-config council:status` on this machine reports **2 enabled of 5**
(anthropic, openai), so the seat condition is unmet by three seats — before the
20-consecutive-UTC-day reservation and the estate-headroom condition are even
reached. Phase 3's trigger needs two consecutive UTC-day windows at 30 calls per
provider against a 50-per-provider-per-day cap; no reservation exists. Both are
facts about the world, and neither moved since 2026-09-01.

### What this run DID change, and why it is inside the boundary

Three factual claims in the header, and two dead links. All five were true when
written and had gone false:

1. The header said `status: draft`; the frontmatter has read `carrier` since
   #1810.
2. It said **"Nothing guards this file"**, that no gate would notice its
   deletion, and that deleting it **"would red nothing"**.
   `src/scripts/lint_carrier_integrity.ts` landed 2026-09-02 (#1810,
   `6641d4719`) and walks from the archived side. Verified by moving this file
   out of the tree: `❌ 38 broken deferral carries`, exit 1; restored, exit 0.
   That gate's own baseline entry names this file by path as the reason its
   broken-destination class carries no baseline at all.
3. Two links pointed at `stubs/road-to-deferral-carry-guard.md`, which no longer
   exists — the change that shipped the guard consumed it.

None of that touches an obligation, a trigger, or the carrier's status, so it
sits inside the recorded boundary rather than against it. A carrier whose whole
subject is "a mechanism keyed on something that moved" is the worst possible
place to leave a stale claim standing, and leaving one because the file is
parked would be the error this roadmap exists to describe.

### What this run did NOT do

No item was checked, nothing was archived, promoted, cancelled or transferred,
no mechanism was built, no capacity was reserved, and no work here is claimed
complete. Every one of the 38 obligations stands exactly where it stood.

## Estate placement — `road-to-admissible-council-seats` stays standalone (2026-09-07)

Folded in here because that roadmap's `free-seat-estate-slot` blocker named this
file as the alternative home for the seat work, and the standalone-vs-fold-in
question had to be answered somewhere durable rather than left to the next
estate review.

**Decision: standalone. It keeps its own trunk and is NOT folded into this file.**
Resolved by an AI council (2 seats, run 19, 2026-09-06) under the maintainer's
standing delegation.

**The measured growth figure, not the prediction.** The blocker predicted
`active_roadmaps` 1 → 2. That prediction was wrong about the levels, which is
exactly why the disposition required a measurement on the actual adopting
commit rather than a number written at authoring time:

- Adopting commit `708b57545` ("docs(roadmaps): add road-to-admissible-council-seats",
  2026-09-05). Top-level roadmaps under `agents/roadmaps/`: **7 → 8, delta +1.**
- `./scripts-run src/scripts/check_estate_count` on the branch that completes and
  archives it reports the estate **within its ratchet**, and the archival is a
  net **−1** active roadmap — the roadmap pays back the slot it took.

**Why standalone rather than folded in.** This file is a `status: carrier`
receiver for 38 deferred items from one specific parent roadmap; its purpose is
to give those deferrals a verifiable destination. Absorbing an unrelated,
independently-scoped roadmap into it would make the carrier's own inventory
unreadable and would put a completed body of work inside a file whose whole
reason to exist is that its items are NOT done.

**Scope.** This settles the placement question and nothing else. It creates no
obligation for this file, adds no item to its 38, and does not change this
roadmap's status.
