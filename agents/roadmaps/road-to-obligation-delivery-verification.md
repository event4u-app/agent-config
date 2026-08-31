---
complexity: bounded
status: ready
parent_roadmap: road-to-turnaround-followups
relates:
  - slug: road-to-turnaround-followups
    relation: successor
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

- [ ] **1.1 Answer the delivery question this roadmap was created for.** Pick
      one of the three closures in § What would close it above — a per-session
      delivery record, a documented propagation model, or a recorded decision
      that temporal-post-change suffices with its evidentiary limitation
      written down. The choice is itself the work; do not treat the third as a
      default, which the originating council rejected as one.
      verify: the chosen closure is committed, and it answers *"was this
      obligation in context for this session?"* for a session the measurement
      in 1.2 will count — without per-session self-report, which one seat
      rejected as requiring instrumentation this repository does not have.

- [ ] **1.2 Re-measure `mean_batch_size` under a documented propagation model.**
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

      **This step carries no `deferred-resolution` annotation, and that is
      deliberate.** It is the RECEIVER of the parent's carry, not a carry
      itself; the annotation lives at the parent's step 1.1, which is the end
      the sweep reads. An annotation here would name this file as its own
      destination, which `archive_completed_roadmaps.ts` refuses by design.

## Not archivable yet — stated so it cannot be read as an oversight

`archive_completed_roadmaps.ts` refuses a roadmap with an open blocker, and this
one has two open steps besides. That is the intended state: this roadmap exists
to hold an open criterion in the governed estate until the wall clock supplies
the sessions, and the `review_by` kill switch above is what stops it holding one
forever.

## Acceptance Criteria

- [ ] **AC-1 — TRANSFERRED IN from `road-to-turnaround-followups`, unweakened.**
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

## Blockers

### blocker: batching-corpus-never-received-the-obligation

- **Status:** open — **TRANSFERRED IN 2026-08-31** from
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
  initiated after the verified delivery-effective timestamp (candidate:
  2026-08-30 14:38:40Z), where the delivery mechanism in effect at measurement
  time is documented to propagate a config change to a running agent — and step
  1.2 is closed citing that reading. Per-session self-report is explicitly NOT
  the bar; a documented propagation model satisfies it.

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
