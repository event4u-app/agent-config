---
complexity: lightweight
status: ready
parent_roadmap: road-to-turnaround-followups
relates:
  - slug: road-to-turnaround-followups
    relation: extends
execution:
  mode: phase-checkpoints
owner: council
review_by: 2026-09-30
estate_offset_exempt: "Atomic replacement, not an addition. This file is promoted out of `stubs/` in the same change that archives `road-to-turnaround-followups`, so the one-in-one-out half is paid by the parent: active_roadmaps goes 3 -> 3, and the roadmap COUNT of the estate is unchanged. AI council 2026-08-31, anthropic + openai, 2/2 convergent, round 2; the convergence and both seats' reasoning are inlined at the sections below rather than linked, because council output is gitignored and auto-pruned."
estate_growth_exempt: "Charges open_blockers +1 by moving `batching-corpus-never-received-the-obligation` here from the parent, and the parent loses it in the same change, so the net across the two files is zero. No offsetting disposal is claimed because none is needed. The blocker is not new work: it is the same Class-3 condition, transferred verbatim and unweakened, because both council seats refused to lower the ten-session floor, change eligibility, or drop the propagation-model requirement -- each of which they classified owner-reserved."
---

# Road to verifying an obligation was delivered before measuring it

> **Promoted from `stubs/` to the ACTIVE estate on 2026-08-31 by AI council
> verdict** (anthropic + openai, **2/2 convergent**, round 2). It began life
> 2026-08-30 as a drain-run transfer, when `road-to-turnaround-followups` step
> 1.1 re-measured the batching obligation, found the number had not moved, and
> then found the obligation had reached at most one session and plausibly zero.
> A first council ruled that shortfall a finding about the **delivery
> mechanism**, not about the obligation, and routed it here.
>
> This file now carries **both halves**: the delivery question it was created
> for, and its parent's AC-1 and step 1.1, transferred unweakened. The parent
> archives in the same change. Why it is here and not in `stubs/` or `later/` is
> § Why this roadmap is active.

## What was found

Measured 2026-08-30 while executing `road-to-turnaround-followups` step 1.1:

- The batching obligation landed in `af0cf0bf0` at 2026-08-30 14:38:40Z.
- Of the ten sessions in the measured window, by first transcript timestamp
  **one** began after it, **two** span it, and **seven** ended entirely before.
- A recursive grep for the obligation's own heading across the operator's
  installed agent tree hits **no installed copy** — only session transcripts.
  The single delivered copy is a projection inside the source checkout, loaded
  on demand rather than always.

So the number of sessions that could have *received* the obligation is **at most
one, plausibly zero**. `mean_batch_size` read 1.01 → 1.01, and that null
measures the delivery channel rather than the instruction.

## Why this is not the parent roadmap's problem

Two competency questions were being conflated, and the council named the split
in both responses:

| Question | Kind | Owner |
|---|---|---|
| *Does an explicit batching instruction change an agent's tool-call grouping?* | behavioural | `road-to-turnaround-followups` AC-1 |
| *Do on-demand projections propagate a config change to a running agent?* | infrastructure | **this stub** |

Recording the second as an answer to the first is what one seat called poisoned
evidence: a later reader cites *"batching obligations measured at 1.01 → 1.01"*
without knowing that zero sessions were exposed.

## Probe — is the gap still real?

Read, at the time this stub is next opened: does the operator's installed agent
tree carry the obligation text at all, and is there any mechanism that records
per-session which obligations were in context at session start? **Baseline
2026-08-30:** no installed copy; no such mechanism.

## What would close it

One of these, and the choice is itself part of the work:

1. **A delivery record.** Something a measurement can read to answer *"was this
   obligation in context for this session?"* per session, rather than inferring
   it from an mtime window.
2. **A documented propagation model.** If on-demand projection is the intended
   delivery, state the propagation guarantee it makes and the lag it carries, so
   a measurement can name a corpus that satisfies it without per-session
   verification. One council seat argued explicitly for this over per-session
   self-report, on the ground that requiring agents to confirm receipt builds
   instrumentation the repository does not have and that AC-1 never asked for.
3. **A recorded decision that temporal-post-change suffices**, with its
   evidentiary limitation written down — the honest version of Reading 1, which
   the council rejected as a default but named as a legitimate policy if adopted
   deliberately.

## What this stub deliberately does NOT do

It does not propose raising the reminder's frequency, and it does not reopen the
parent's pre-commitment. The parent pre-committed that a null is the RESULT and
never a reason to repeat the reminder more loudly; that binds harder here, not
less, because a channel that is not connected cannot be fixed by sending more
down it.

## Why this roadmap is active, and not in `later/` or `stubs/`

This placement is a deliberate, narrow exception to an Iron Law, taken by
council rather than by convenience, and it is written here so a later reader
meets the argument rather than the conclusion.

`roadmap-progress-sync` § Later disposition says: *"A ROADMAP WHOSE OPEN WORK
CANNOT PROCEED NOW (GATED ON AN EXTERNAL TRIGGER OR A DECISION) BUT WILL RESUME
→ MOVE IT TO `agents/roadmaps/later/`. NEVER LEAVE A BLOCKED-FOR-LATER ROADMAP
IN THE ACTIVE TREE."* The open work here IS externally gated, so that law points
at `later/`.

Two findings, both verified against the tree on 2026-08-31, point the other way:

1. **`stubs/` is not a legal destination and is governed by nothing.**
   `archive_completed_roadmaps.ts` builds its carry-destination candidate list as
   exactly two paths — `agents/roadmaps/<slug>.md` and
   `agents/roadmaps/later/<slug>.md`. A carry naming a stub resolves to neither
   and the sweep blocks. Separately: `lint_roadmap_blockers.ts:35` scans
   `agents/roadmaps/*.md` non-recursively, so the three stub files that carry
   `### blocker:` headings today appear in no gate; `update_roadmap_progress`
   reports three roadmaps and no stub; `resume_probe` reads `later/` only. A stub
   is real prose with no governance.
2. **`later/` is not the active estate.** A parallel council round the same day,
   on a different roadmap, ruled 2/2 that `later/` is excluded from the dashboard
   and from `/roadmap:process-*`, so parking a criterion there does not preserve
   active-estate membership. That round chose an active receiver for the same
   reason this one does.

So the Iron Law yields, through an explicit exception both seats required be
written down rather than assumed:

> **Exception.** Externally gated work MUST move to `later/` **unless** active
> governance is necessary to preserve or adjudicate an unresolved acceptance
> criterion. The exception requires a named blocker, a measurable releasing
> condition, an accountable owner, and an explicit review trigger.

All four are present: the blocker below, the ten-session floor, `owner: council`,
and the kill switch in the next section. Preserving active-estate membership is
more fundamental than the directory rule, because the directory rule would defeat
it.

### The kill switch — this exception expires

One seat made this a condition of its verdict, in these terms: without a kill
switch the exception becomes permanent, which is exactly the indefinite
active-headroom consumption the Iron Law exists to prevent.

> **If the ten-session floor has not been reached by `review_by: 2026-09-30`,
> this roadmap MOVES to `agents/roadmaps/later/` — regardless of the governance
> argument above, and without a further council round.** Preservation is
> imperfect there and that is the accepted cost; an exception that never expires
> is worse.

## Phase 1 — Establish that the obligation was delivered

- [-] **1.1 Answer the delivery question this roadmap was created for.** Pick
      one of the three closures in § What would close it above — a per-session
      delivery record, a documented propagation model, or a recorded decision
      that temporal-post-change suffices with its evidentiary limitation
      written down. The choice is itself the work; do not treat the third as a
      default, which the originating council rejected as one.
      verify: the chosen closure is committed, and it answers *"was this
      obligation in context for this session?"* for a session the measurement
      in 1.2 will count — without per-session self-report, which one seat
      rejected as requiring instrumentation this repository does not have.

      **ANSWERED 2026-08-31 — and the answer is (E) BLOCKED-BY-ARCHITECTURE,
      which is the exit AC-1 names for exactly this outcome. The checkbox stays
      `[ ]` on purpose; see § Why 1.1 is answered and still open.**

      **AI council 2026-08-31, anthropic/claude-sonnet-4-5 +
      openai/codex-default, 2/2 present.** The seats returned different letters
      and converged on the same next action, which is why this reads as a
      convergence rather than a split. anthropic: *"(E) BLOCKED-BY-ARCHITECTURE
      with one deterministic gate before redesign … Before picking any closure,
      verify in `dist/agent-src/` or run `agent-config rules:list` in a consumer
      install."* openai: *"choose B, derive a new prospective boundary from a
      verified propagation contract, and switch to E if deterministic delivery
      cannot be independently established"*, dissenting that *"failure to prove
      the invariant requires E, not a weaker propagation contract."*
      Both made the SAME probe the deciding step. It was run.

      **THE PROBE, and it is reproducible.** The obligation is the
      `## Independent calls go in ONE block` section added to
      `src/rules/token-efficiency.md` by `af0cf0bf0` (2026-08-30 14:38:40Z).

      | Layer | Command | Result |
      |---|---|---|
      | the projection | `grep -c 'Independent calls go in ONE block' dist/agent-src/rules/token-efficiency.md` | **1** — present |
      | the operator's INSTALLED tree | `grep -c 'Independent calls go in ONE block' ~/.claude/rules/token-efficiency.md` | **0** — absent |
      | that file's mtime | `ls -l ~/.claude/rules/token-efficiency.md` | **2026-08-25 14:28** — five days BEFORE the obligation landed |
      | its trigger set | `sed -n '1,20p' src/rules/token-efficiency.md` | `type: "auto"`, `alwaysApply: false`, triggers `keyword: "minimize tool calls"` and `phrase: "fetching logs"` |
      | its declared cadence | same frontmatter | `obligation_frequency: "per-edit"` |

      **So it is neither of anthropic's two branches.** Not *"intentionally
      source-only"* — the projection carries it, so delivery is intended. Not
      simply *"projection broken"* — the projection is correct. The failure is
      **two independent things**, and only the second is architectural:

      1. **The install is stale.** The operator's tree predates the obligation
         by five days. Fixable by re-running the installer; not architectural,
         and NOT the reason this closes as E.
      2. **The trigger design cannot carry a per-edit obligation, and the
         alternative is budget-blocked.** A `type: auto` rule fires on its
         triggers; neither `"minimize tool calls"` nor `"fetching logs"` occurs
         in an ordinary work prompt, so a rule declaring
         `obligation_frequency: "per-edit"` reaches almost no edit. The only
         cadence that would deliver it is `type: always`, and that is
         **measurably unavailable**: `./scripts-run src/scripts/check_always_budget`
         reports the extended budget at **60,252 / 60,254 chars (100.0%)** —
         **two characters of headroom** — on a ratchet that *"may only move
         DOWN"*, across nine rules that are the kernel, which
         `block_kernel_rule_writes` denies agent writes to. There is no
         reachable configuration in which this obligation is delivered per-edit.

      **This is the same defect shape the tree already documents about itself.**
      `fix-what-you-see` records in its own § Honest activation gap that it
      shipped `auto` *"for a budget reason, not a design one"*, that keyword
      triggers match the PROMPT, and that closing the gap needs the ext-cap
      ratchet opened deliberately or a `post_tool_use` carrier. That is the
      redesign recommendation this step hands forward, and it is
      owner-reserved: opening the ratchet is a recorded maintainer decision,
      and a kernel rule is not agent-writable.

      **The redesign recommendation, per openai's own wording:** a
      *"delivery-mechanism-written receipt — not an agent self-report"*. The
      mechanism that projects a rule is the only party that can truthfully
      record that it did, and per-session self-report is barred by AC-1.

      **What this does NOT do.** It does not lower the ten-session floor, change
      eligibility, count unusable sessions as zero-sized batches, or drop the
      propagation-model requirement — all four are owner-reserved and were
      refused by both prior councils. It does not reformulate AC-1. It does not
      raise the reminder's frequency, which the parent pre-committed against.

      **Cohort-boundary consequence.** `2026-08-30 14:38:40Z` is void as a
      boundary: no propagation occurred at it. Per openai, the boundary is the
      latest of the contract's effective deployment time, the obligation's
      availability through the projection path, and the end of the guaranteed
      lag — **none of which exists yet**. So no boundary is nameable, and the
      four post-timestamp sessions measured below do not enter any corpus.

      **CLOSED `[-]` 2026-08-31 — BLOCKED-BY-ARCHITECTURE, on a 2/2 convergent
      AI council (anthropic/claude-sonnet-4-5 + openai/codex-default, Option B,
      disposition D3). The criterion is TRANSFERRED, never met and never
      dropped:** it lives on unweakened in
      `agents/roadmaps/stubs/road-to-obligation-exposure-instrumentation.md`.
      **What changed since the 2026-08-31 reading that left this open.** That
      reading expected the wall clock to supply the sessions. It cannot. The
      question put to this round was whether the measured non-delivery is an
      *architectural* impossibility or merely an un-run installer — and the
      answer decides whether waiting is honest. Three facts were measured first:
      `grep -rl "CALLS WITH NO DEPENDENCY BETWEEN THEM" ~/.claude/rules ~/.claude/plugins`
      returns **0 files**; every file in `~/.claude/rules/` carries one install
      mtime, `2026-08-25 14:28`, five days before `af0cf0bf0`
      (`2026-08-30 14:38:40Z`); and the installed `token-efficiency.md` DOES
      carry an *older* obligation from the same source file (`## Size-gated
      reads`, at its line 57), which proves the install path works and is simply
      behind.
      **A correction this round owes its own record.** The earlier analysis
      grepped `Size-gated reads` — an obligation that IS installed — and
      concluded from that mis-grep that nothing had been delivered. Its
      conclusion survived; its reasoning did not. The heading that is actually
      absent is `## Independent calls go in ONE block`.
      **The council refuted the reading those facts suggested.** Both seats
      rejected the proposal to close 1.1 by closure (2), a documented
      propagation model, in one sentence: *installation proves availability, and
      AC-1 requires exposure.* The obligation lives in a `type: auto` rule, which
      enters a session's context only when its routing triggers match, so a
      corpus defined as "sessions after the install timestamp" necessarily
      contains sessions where the rule was installed and never projected.
      Redefining *exposed* as *available* would lower an owner-reserved floor,
      which both seats refused. anthropic: *"For a **model-carried** obligation
      like the batching Iron Law, being in the tree ≠ being in the session
      context."* openai: *"A post-install timestamp cannot identify a corpus
      exposed to a `type: auto` rule."*
      **Re-running the installer is legitimate and does not unblock this.** Both
      seats agreed it would repair staleness and create a clean timestamped
      availability boundary, and that it *"would not unblock this roadmap by
      itself"* — so it was not run as part of this closure, and no earlier
      session is treated as exposed.
      **Floors not lowered, stated because both seats required it:** the
      ten-usable-session floor and the exposure reading of *"post-change
      corpus"* are owner-reserved and are carried into the stub verbatim. This
      closure moves the criterion; it does not weaken it.

- [-] **1.2 Re-measure `mean_batch_size` under a documented propagation model.**
      **TRANSFERRED IN from `road-to-turnaround-followups` step 1.1**, verbatim
      and unweakened, by AI council 2026-08-31 (anthropic + openai, 2/2, round
      2). Measure `mean_batch_size` across **at least 10 usable sessions**
      initiated after 2026-08-30 14:38:40Z. A session is usable only when
      batching is applicable and `mean_batch_size` is defined over it. Record
      the eligible population, the exclusion rules, the excluded-session count,
      the qualifying sample size, the measured result, and the delivery verdict.
      **Do not resolve this before the qualifying sample reaches 10.**
      **Pre-committed, carried from the parent:** if the number has not moved,
      that is the RESULT and it is recorded as a null — never a reason to repeat
      the same reminder more loudly, which this repository has already measured
      not to work for the session-canary obligation.
      **A null under verified exposure IS valid closure.** One seat made this
      explicit so a later agent does not read "no change" as "measurement
      incomplete".
      verify: a reading exists over ≥ 10 usable post-2026-08-30T14:38:40Z
      sessions under a propagation model committed by 1.1, with its corpus
      window and exclusion count recorded beside it, and the delta stated in
      whichever direction it went.

      **CLOSED `[-]` 2026-08-31 — BLOCKED-BY-ARCHITECTURE, same 2/2 council,
      same disposition D3.** Not measurable, and the reason is upstream of the
      sample size rather than in it: no corpus can be shown to be *exposed*, so
      the ≥ 10 usable sessions this step needs cannot be identified even in
      principle under the current architecture. The cohort boundary this step
      still names, `2026-08-30 14:38:40Z`, was already struck by an amendment in
      the blocker's `Resolved when` and is retained here only as the record of
      what was tried. The measurement obligation is carried unweakened into
      `agents/roadmaps/stubs/road-to-obligation-exposure-instrumentation.md`.
      **The pre-commitment is honoured, not discharged.** "If the number has not
      moved, that is the RESULT" still stands for whoever takes the reading after
      the stub is promoted. What this closure records is that the reading was
      never *available*, which is a different fact from a null and is not filed
      as one.

      **This step carries no `deferred-resolution` annotation, and that is
      deliberate.** It is the RECEIVER of the parent's carry, not a carry
      itself; the annotation lives at the parent's step 1.1, which is the end
      the sweep reads. An annotation here would name this file as its own
      destination, which `archive_completed_roadmaps.ts` refuses by design.

## Why 1.1 is answered and still open

The question is answered decisively and the checkbox is `[ ]`. That is not an
oversight and it is not modesty; it is consistency with a verdict this same
drain run recorded on a sibling roadmap hours earlier.

**The step's `verify:` is unsatisfiable BY THE ANSWER, not by incompleteness.**
It asks that the chosen closure *"answers 'was this obligation in context for
this session?' for a session the measurement in 1.2 will count"*. The answer is
that no closure can, because the obligation is not delivered per-edit and cannot
be under a reachable configuration. A negative answer to a `verify:` is a
finding, never a satisfaction of it.

**And the tree now has a rule for exactly this shape.** AI council 2026-08-31
(anthropic + openai, **2/2 convergent**) ruled on
`road-to-inbox-harvest-2026-08-e-council-topology-evidence` that a step whose
`verify:` asserts a property of a mechanism that does not exist may **not**
close `[x]` — *"that overstates the evidence"* — and that a third state exists
only once its tooling lands atomically. Closing 1.1 `[x]` here, in the same run
that recorded that verdict there, would contradict it on the identical
structural situation. The `guarded-baseline` annotation is deliberately NOT
applied: this step has no RED-proven guard, and both seats were explicit that a
baseline never seen red is an ordinary open item and not eligible.

**What the step DID produce, and it is the durable part:** a reproducible probe,
a named architectural cause with a measured number behind it (two characters of
budget headroom on a down-only ratchet), a redesign recommendation the owner can
act on, and a cohort boundary correctly voided rather than silently reused. A
later reader inherits an answer instead of the question.

## Archivable as of 2026-08-31 — and the earlier note is kept, not deleted

**This section previously read "Not archivable yet".** Its reasoning was sound
and its premise was falsified, so it is corrected here rather than removed.

The premise was: *"this roadmap exists to hold an open criterion in the governed
estate until the wall clock supplies the sessions."* The 2026-08-31 council
established that the wall clock cannot supply them — sessions accumulate, but
none of them can be shown to have been *exposed* to a `type: auto` obligation
without instrumentation that does not exist. Waiting therefore buys nothing, and
a roadmap that holds a criterion no amount of time can satisfy is not preserving
it; it is only deferring the moment someone notices.

So the disposition changed from *wait* to *transfer and archive*: the criterion
moves to `agents/roadmaps/stubs/road-to-obligation-exposure-instrumentation.md`,
which is capability-gated and carries a named probe re-run every 30 days, and
this roadmap archives. Both seats chose D3 over parking in `later/` for exactly
this reason — anthropic: *"Parking in `later/` would imply time could produce
qualifying sessions; it cannot."*

The `review_by: 2026-09-30` kill switch above is thereby spent rather than
pending: it fired early, by decision, in the direction it was pointing.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-31 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The active-placement exception becomes permanent | product | An exception to the Later-disposition Iron Law with no expiry consumes active-estate headroom indefinitely, which is the exact failure that law exists to prevent. One council seat made the expiry a condition of its verdict for this reason | `review_by: 2026-09-30` is a kill switch, not a review note: if the ten-session floor is unmet by then the file MOVES to `later/` without a further council round | Why this roadmap is active, and not in `later/` or `stubs/` |
| 2 | The temporal reading is later cited as satisfying AC-1 | product | `mean_batch_size` 1.01 → 1.01 is recorded and reads like a result. A later agent citing it without the exposure caveat records "we measured it and it did nothing" where the truth is "we could not measure it" — the poisoned-evidence failure the 2026-08-30 council named | The reading is labelled a baseline at AC-1 and in `src/config/turnaround-budget.json`; R6 and R7 of the evidence file carry the 2-of-10 count and the seat-transcript exclusion with its re-test | Acceptance Criteria |
| 3 | The cohort boundary is wrong because delivery became effective later than install | implementation | `2026-08-30 14:38:40Z` is an install timestamp. If step 1.1 establishes that propagation only became effective afterwards, every session counted between the two dates is ineligible and a measurement built on them is void | AC-1 records the boundary as a **candidate**, not immutable, and names the verified delivery-effective timestamp as the real one. Step 1.1 runs before 1.2 by construction | Phase 1 — Establish that the obligation was delivered |
| 4 | Council-seat transcripts re-enter the corpus | implementation | 17 post-timestamp sessions exist on the machine that are single-turn provider-CLI invocations with zero tool calls. `mean_batch_size` is undefined over them, so including them returns a number about the wrong population | The exclusion and its cheap re-test — the first JSONL row being a `queue-operation` enqueue of a council question — are recorded in R7 of `agents/evidence/analysis/agent-turnaround-2026-08-30.md`; step 1.2 requires the excluded-session count to be reported | Phase 1 — Establish that the obligation was delivered |
| 5 | Step 1.1 concludes propagation is impossible and the criterion is quietly reformulated | product | An architectural dead end invites moving the goalposts, which both council seats classified owner-reserved and refused | AC-1 names the honest exit explicitly: close as BLOCKED-BY-ARCHITECTURE with a redesign recommendation, never reformulate | Acceptance Criteria |

## Acceptance Criteria

- [-] **AC-1 — TRANSFERRED OUT 2026-08-31, unweakened.**
      Original criterion, verbatim: *"`mean_batch_size` has a second reading
      against a named post-change corpus, and the delta is recorded whichever
      direction it went — including 'did not move'."*
      **Binding interpretation**, from the council of 2026-08-30 (2/2) that
      ruled it `not-met` and the round-2 council of 2026-08-31 (2/2) that
      transferred it: *"post-change corpus"* means a corpus **exposed to** the
      change, not merely one later than it. Under a documented propagation
      model, measure across **≥ 10 usable sessions** initiated after
      2026-08-30 14:38:40Z. Per-session self-report is explicitly NOT the bar; a
      documented propagation model satisfies it.
      **Evidence already recorded, and it does not satisfy this.** The
      2026-08-30 reading — `mean_batch_size` 1.01 → 1.01, unrounded 1.008959 =
      3266/3237 — is retained as a **labelled baseline** in
      `src/config/turnaround-budget.json` `subsequent_readings[0]` and in
      `agents/evidence/analysis/agent-turnaround-2026-08-30.md` (R1–R5). It is
      not a satisfaction of this criterion: exposure was unverified, and R6/R7
      of that file measure **2 usable sessions against a bar of 10**.
      **One refinement the round-2 council added:** the cohort boundary should
      ultimately be the **verified delivery-effective timestamp**, not the
      install timestamp. `2026-08-30 14:38:40Z` is the current candidate, not an
      immutable boundary — if 1.1 establishes that propagation only became
      effective later, sessions between the two dates do not enter the corpus.
      **Owner-reserved, and refused by both seats:** lowering the ten-session
      floor, changing eligibility, counting unusable sessions as zero-sized
      batches, or dropping the propagation-model requirement. If 1.1 establishes
      that propagation is impossible under the current architecture, the honest
      exit is to close as **BLOCKED-BY-ARCHITECTURE** with a redesign
      recommendation — never to reformulate the criterion, which would be moving
      the goalposts.

      **CLOSED `[-]` 2026-08-31 — TRANSFERRED, never met and never dropped.**
      AI council 2026-08-31 (anthropic + openai, 2/2 convergent, Option B +
      D3) ruled that this criterion cannot be satisfied under the current
      architecture, and applied the exit the criterion itself names: *"the
      honest exit is to close as BLOCKED-BY-ARCHITECTURE with a redesign
      recommendation — never to reformulate the criterion."* The criterion, its
      ten-session floor and its exposure reading of *"post-change corpus"* are
      carried verbatim into
      `agents/roadmaps/stubs/road-to-obligation-exposure-instrumentation.md`,
      together with the two redesign mechanisms the council named: a per-session
      projection record, or a propagation mechanism guaranteeing presence in
      every corpus session. Neither exists; the stub's probe re-reads for both.
      **Nothing here is reformulated.** `[-]` is the transferred glyph, the same
      one this roadmap's own § Related uses for an inbound transfer. Reading it
      as satisfaction would be the generous reading the parent chain has refused
      three times.

## Blockers

### blocker: batching-corpus-never-received-the-obligation

- **Status:** resolved — **2026-08-31, outcome state `transferred`.** AI council
  2026-08-31 (anthropic/claude-sonnet-4-5 + openai/codex-default, **2/2
  convergent**, Option B + disposition D3) ruled that the delivery question is
  answered BLOCKED-BY-ARCHITECTURE and that steps 1.1, 1.2 and AC-1 close on
  that reading. The finding in one sentence: **installation proves availability,
  and AC-1 requires exposure** — a `type: auto` rule enters a session's context
  only on a trigger match, so no install timestamp can name a corpus that was
  demonstrably exposed. The criterion is carried unweakened into
  `agents/roadmaps/stubs/road-to-obligation-exposure-instrumentation.md` with
  both redesign mechanisms the council named; the ten-session floor and the
  exposure reading of *"post-change corpus"* are untouched and remain
  owner-reserved. The token is `resolved` because that is the only string
  `lint_roadmap_blockers` reads as closed; the outcome state `transferred` lives
  in this prose and in the stub, per the drain-run disposition framework.
  **Original status, retained as the record of what was tried:** open —
  **TRANSFERRED IN 2026-08-31** from
  `road-to-turnaround-followups`, unchanged in substance. Created there
  2026-08-30 by the drain run that executed its step 1.1. AI council 2026-08-30
  (anthropic + openai, 2/2) ruled AC-1 `not-met`; AI council 2026-08-31
  (anthropic + openai, 2/2, round 2) moved it here rather than into `stubs/`,
  after the stub-governance check both seats had attached to their first verdict
  was run and failed.
- **Owner:** council — the disposition keeps AC-1 alive and unweakened and moves
  it into the governed active estate, which the preservation test makes
  council-decidable. Nothing here lowers a floor or descopes a criterion.
- **Class:** 3
- **Blocks:** step 1.2 and AC-1 only. Step 1.1 is untouched by it and is the
  work that eventually clears it.
- **What to do:** answer the delivery question at step 1.1 first, by picking
  exactly one of these three, which are the closures § What would close it
  enumerates:
  (a) build a **per-session delivery record** — something a measurement can read
  to answer *"was this obligation in context for this session?"*, rather than
  inferring it from an mtime window;
  (b) write a **documented propagation model** in
  `docs/contracts/` stating the guarantee on-demand projection makes and the lag
  it carries, so a corpus can be named without per-session verification — one
  seat argued explicitly for this over per-session self-report;
  (c) record a **deliberate decision that temporal-post-change suffices**, with
  its evidentiary limitation written down — the honest form of the reading the
  2026-08-30 council rejected as a default but named as a legitimate policy if
  adopted knowingly.
  Then re-run the measurement:
  `./scripts-run src/scripts/probe_turnaround --limit 10 --against-baseline --store "$HOME/.claude/projects/-Users-<you>-projects-<...>-agent-config"`
  from the MAIN checkout, never a worktree — R5 of
  `agents/evidence/analysis/agent-turnaround-2026-08-30.md` records that a
  worktree has its own store slug and the probe fails closed on the empty corpus.
  The obligation reached at most one of the ten originally measured sessions and
  plausibly zero, so the measurement cannot be repeated usefully until delivery
  is either instrumented or documented. **Do not raise the reminder's
  frequency** — the parent's pre-commitment forbids it and a disconnected
  channel is not fixed by sending more down it.
- **Recommendation:** do 1.1, then 1.2. Closing AC-1 on the temporal reading
  would record *"we measured it and it did nothing"* where the truthful
  statement is *"we could not measure it"* — one seat called that poisoned
  evidence, and this repository's own failure catalogue holds that a false null
  is harder to remediate later than a deferred condition surfaced now.
- **If you do nothing:** AC-1 stays open, this roadmap stays active until its
  `review_by` kill switch fires on 2026-09-30 and moves it to `later/`, and the
  batching obligation's effect stays unmeasured. Nothing regresses and nothing
  is silently lost.
- **Resolved when:** `mean_batch_size` is measured across ≥ 10 usable sessions
  initiated after the verified delivery-effective timestamp, where the delivery
  mechanism in effect at measurement time is documented to propagate a config
  change to a running agent — and step 1.2 is closed citing that reading.
  Per-session self-report is explicitly NOT the bar; a documented propagation
  model satisfies it.

  **AMENDED 2026-08-31 in ONE respect, and it is a tightening, not a
  weakening.** The candidate boundary `2026-08-30 14:38:40Z` is **struck**. Step
  1.1's probe established that no propagation occurred at that timestamp — the
  operator's installed rule tree still predates it by five days — so a corpus
  built on it would be a corpus of sessions exposed to nothing, which is the
  poisoned evidence this blocker exists to prevent. **There is currently no
  nameable boundary at all**, and per the 2026-08-31 council the real one is the
  latest of: the propagation contract's effective deployment time, the
  obligation's availability through that path, and the end of its guaranteed
  lag. None of the three exists. The ten-session floor, the eligibility rules
  and the propagation-model requirement are **untouched**.

  **A SECOND, INDEPENDENT gate now stands in front of this one, and it is
  architectural.** Even a corrected install would not deliver the obligation
  per-edit: the rule is `type: auto` with triggers `keyword: "minimize tool
  calls"` and `phrase: "fetching logs"`, neither of which occurs in an ordinary
  work prompt, while its own frontmatter declares
  `obligation_frequency: "per-edit"`. The cadence that would deliver it is
  `type: always`, and `./scripts-run src/scripts/check_always_budget` reports
  **60,252 / 60,254 chars (100.0%) — two characters of headroom** on a ratchet
  that may only move DOWN, across nine rules that are the kernel and are not
  agent-writable. So this blocker is no longer only wall-clock-bound. Full
  evidence and the redesign recommendation are at step 1.1.

  **Measured 2026-08-31, so the wall-clock half is not speculative either:** of
  163 sessions in the operator's transcript store, **4** have a first
  timestamped row after 2026-08-30 14:38:40Z (all 4 with ≥ 1 `tool_use`), and
  one of those is the measuring session. Against a floor of 10 that is 3-4, and
  every one of them is now ineligible anyway under the struck boundary.

## Where the two council seats disagreed

Recorded rather than smoothed over, because the disagreement decided a detail of
this change.

**On the source step's glyph.** One seat argued the parent's step 1.1 should
become `[-] MERGED`, on the semantic ground that `[~]` means *"I will do this
later, here"* while a transfer means *"this is resolved, elsewhere"*. The other
argued it must stay `[~]`, on the mechanical ground that
`archive_completed_roadmaps.ts` parses `[~]` items only
(`DEFERRED_STEP_RE = /^[ \t]*[-*][ \t]+\[~\][ \t]*(.*)$/`), so a `[-]` item
carries no annotation the carry-integrity check can read — the check would
silently not run.

**Resolved on the mechanism, not the semantics:** the parent keeps `[~]` plus the
annotation, so the sweep actually verifies the destination exists, is live, is
not self-referential, and carries the `parent_roadmap:` back-link. The semantic
objection is real and is answered in prose at the parent's step, which states
that `[~]` there means TRANSFERRED and not unfinished-business-returning.

**On preventing a one-item blocked roadmap.** One seat proposed folding in
unrelated work so this file is not a single blocked item; the other refused,
calling it gaming the roadmap shape, expanding scope, and concealing the real
wall-clock dependency. The refusal was taken: a small blocked roadmap is
acceptable when its exceptional active placement is deliberate and governed,
which the kill switch above makes checkable.

## Related


- `road-to-turnaround-followups.md` § Phase 1 — the parent, where AC-1 stays
  open under the council's `not-met` verdict.
- `src/config/turnaround-budget.json` — `subsequent_readings[0]` carries the
  reading and its corpus window.
- `agents/evidence/analysis/agent-turnaround-2026-08-30.md` — the R1–R5
  re-reading block, where R1 records the delivery finding.
