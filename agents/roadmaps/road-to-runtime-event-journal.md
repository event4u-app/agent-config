---
complexity: structural
status: ready
execution:
  mode: phase-checkpoints
owner: maintainer
review_by: 2026-11-28
research_pin: "agent-config @ 905087463 (origin/main, 2026-08-28). Every anchor below was re-read at this pin by the /analyze:inbox verification pass. Two claims carried by the source analysis were wrong and are corrected inline: the dispatch event vocabulary has ten entries, not nine, and the parked episode-finalizer roadmap was parked on a measured impossibility, not by agent discretion."
relates: []
# relates: grepped every active, later and archived roadmap for `journal`,
# `episode`, `envelope`, `telemetry` and `runtime`. road-to-supervised-telemetry-
# collector owns the first resident process and depends on the flip's Phase-1
# ADR; road-to-runtime-governance-flip owns the doctrine repeal; later/
# road-to-episode-finalizer-and-outcome-attribution-v2 owns the cross-machine
# stop-rate measurement and is parked on evidence, not on permission. None of
# the three owns a durable, hook-written event record.
estate_growth_exempt: "Charges +1 active. Warranted on a measurement: the dispatch stream emits ten distinct events across the host surface and none of them leaves a durable, joinable record; the return envelope carries six terminal states and no field records whether the orchestrator consumed the return, so an ignored `blocked` return is undetectable by construction. Both gaps are Class-A shaped — the tree already writes durable hook state at src/scripts/_lib/test_red_state.ts:33 with no resident process — and both are preconditions for the two active roadmaps that will land a resident process, neither of which owns them. Measured, not predicted: on the committed change `check_estate_count` reads `+5 active / -0 disposed, 5 exempt` and `open_blockers 31 to 42`, of which this file contributes +1 active and +2 open blockers."
estate_offset_exempt: "No archive move is available in this change: the /analyze:inbox run that authored this file consumed only gitignored inbox artefacts and archived no roadmap. Its two siblings in the same change are additions and cannot offset it."
---
# Road to a runtime event journal — the durable record lands before the resident process, because it does not need one

## Goal

Every event this suite's dispatch stream already emits leaves a durable,
`episode_id`-keyed record; every return envelope records whether the
orchestrator consumed it; and the persistence tiers the tree already uses have
names and a contract. All of it written by per-invocation hooks that
terminate — **Class A under ADR-124, no resident process, no new package** — so
none of it waits on the flip, the collector, or the ADR that opens Class B.

The one binding line for what the record is used for: **no claim requiring
transitive certainty is made on a stale or absent record.** Degradation is
reported, never silent.

## Context

> **Source:** `agents/tmp.old/runtime-code-intelligence/` — a four-proposal
> analysis round (2026-08-28). The owner directive that governs the workstream
> is recorded durably, verbatim and reachable in a clone at
> `agents/evidence/analysis/runtime-execution-directive-2026-08-28.md`; this
> roadmap cites that record, never the gitignored transcript, which is the
> defect its sibling record was written to fix.

### Why this is Class A, stated precisely because it is the load-bearing claim

`docs/decisions/ADR-124-embedded-engine-doctrine.md:110-111` keeps Class A —
an embedded engine invoked per command — adoptable, and Class B — a resident
service or daemon — prohibited in core. Its § 5 extension clause (`:151-157`)
prices opening Class B: an ADR carrying a named consumer demand signal, a
**measured Class-A failure**, and an ADR-123 security review.

Nothing in this roadmap opens Class B. Every writer here is a hook invocation
that starts, writes, and exits — the same shape as
`src/scripts/_lib/test_red_state.ts:33`, which already writes a durable RED
record into `agents/runtime/state/` with no process resident anywhere. The
suite also already operates a SQLite store on the Class-A path
(`src/scripts/code_graph/sqlite_store.ts`), so the storage choice is
precedented rather than novel.

There is a second consequence worth stating plainly, because the source round
inverted it: this journal is **the evidence a future Class-B ADR needs**. A
measured Class-A failure cannot be produced by asserting that per-invocation
writes are insufficient; it has to be measured, and it can only be measured
once the per-invocation writes exist. Building the journal is therefore not a
detour around the resident process — it is the only path to it that ADR-124 § 5
accepts.

### Two corrections to the source analysis

| Source claim | Verdict | What holds at the pin |
|---|---|---|
| "the 9-event dispatch stream" | **never-true** | `src/scripts/hooks/dispatch_hook.ts:100-111` — `EVENT_VOCABULARY` holds **ten**: `session_start`, `session_end`, `user_prompt_submit`, `pre_tool_use`, `post_tool_use`, `stop`, `pre_compact`, `agent_error`, `subagent_start`, `subagent_stop`. A journal sized to nine drops one on day one. |
| "the episode-finalizer move to `later/` is the precedent for agent-discretionary retreat" | **never-true as framed** | `agents/roadmaps/later/road-to-episode-finalizer-and-outcome-attribution-v2.md` was parked by a council 2/2 after **both** blockers resolved — one as a host null, the other as *not resolvable by an autonomous run*: its criterion needs ≥ 200 non-local stops from a second machine with independent identity, and all 4,912 measured stops are machine-local. That is a measured impossibility, not a discretionary retreat, and the file states the external-validity gap at its own outcome rather than hiding it. **This roadmap does not un-park it, and does not need to:** the episode *spine* is a set of fields on a record, while the finalizer's blocker is about establishing a cross-machine rate. Different work, different evidence. |

### What already ships, and is therefore not built here

- The **return envelope** as the sole return channel, with six terminal states
  (`src/scripts/_lib/outcome_envelope.ts:23-31`) and a non-success set that
  refuses to report an exhausted budget as success. Phase 3 adds **one field
  set** to it. There is no second envelope.
- The **ten-event dispatch stream** itself. Phase 1 records it; it does not
  re-emit it.
- **Durable hook-written state** under `agents/runtime/state/`, with a working
  precedent.

## Phase 1 — The journal, written by hooks that terminate

- [ ] **1.1 Record shape and storage.** An append-only, `episode_id`-keyed
      record in `agents/runtime/state/`, backed by SQLite in WAL mode so a
      concurrent hook invocation cannot corrupt a partial write. The record
      type carries **no field able to hold free-form content** — no prompt, no
      file body, no path outside a repo-relative locator — so privacy is a
      property of the schema, not of a scrubbing pass that can fail.
      verify: the schema is asserted by a test against a committed key set; a fixture attempting to write a free-form field fails to type-check.
- [ ] **1.2 All ten events are covered.** Each of the ten members of
      `EVENT_VOCABULARY` maps to a record, or is explicitly listed as
      not-recorded with a reason. Silence about an event is not coverage.
      verify: a test enumerates `EVENT_VOCABULARY` and fails when a member is neither recorded nor listed in the not-recorded set — so adding an eleventh event breaks the test rather than being missed.
- [ ] **1.3 Two concurrent writers do not corrupt or lose a record.** Two hook
      invocations writing the same episode from two checkouts of the same
      repository both land.
      verify: a concurrency test writes from two processes and asserts both records present; the mechanism is then neutralised and the same test observed **failing**, so its sensitivity is established rather than assumed.
- [ ] **1.4 First capture measurement, published whichever way it lands.**
      What fraction of host events reach a record, measured against the
      recorded 0.27 % baseline for the existing telemetry path.
      verify: the measurement is written to `agents/evidence/`, states its denominator, and is published unchanged if it is worse than the baseline — an honest null is a result here, not a failure.

## Phase 2 — The episode spine

- [ ] **2.1 The spine fields.** `episode_id`, the capability invoked, the
      return reference, the verification reference, and the terminal state —
      **reused verbatim from `outcome_envelope.ts`'s six**, never a parallel
      vocabulary.
      verify: the spine's state enum is imported from `outcome_envelope.ts` rather than redeclared, asserted by a test that fails if a literal is introduced.
- [ ] **2.2 One fixture episode traverses end to end.** task → action → result
      → outcome, joinable by `episode_id` across records written by different
      hook slots.
      verify: the fixture episode is reconstructed from the journal alone, with no in-memory state, and the reconstruction asserts every field non-null or explicitly absent.
- [ ] **2.3 The namespace survives two checkouts and a branch switch.** The
      episode key includes the git common directory, so two worktrees of the
      same repository never collide, and a branch switch invalidates a
      projection rather than silently reusing it.
      verify: a test writes from two worktrees of one repository and asserts distinct namespaces; a branch switch fixture invalidates the projection.

## Phase 3 — Consumption acknowledgment

- [ ] **3.1 The orchestrator records what it did with a return.**
      `consumed` · `partially-consumed` · `rejected-with-reason`, added to the
      existing envelope as a field set. A return in a non-success state that
      carries no acknowledgment is a **detectable ignored blocker**.
      verify: a fixture `blocked` return with no acknowledgment is reported by the detector; the same return with `rejected-with-reason` is not.
- [ ] **3.2 The acknowledgment joins the spine.** So "was this blocker
      ignored" is answerable from the journal after the fact, not only in the
      session that produced it.
      verify: the fixture episode from 2.2 carries the acknowledgment field and the ignored-blocker query returns it.
- [ ] **3.3 Adoption is measured, not assumed.** What share of returns carry an
      acknowledgment, published.
      verify: the measurement exists with its denominator; a share below any stated expectation is published as measured rather than re-scoped.

## Phase 4 — The tiers get names and a contract

- [x] **4.1 T0–T3 named over what exists.** T0 process-lifetime · T1 session
      register and seen-set · T2 `agents/runtime/state/` and its SQLite twins ·
      T3 the aggregated store a resident process would own. The contract
      **describes existing surfaces** and creates no new store and no package.
      verify: each tier names at least one existing file, and the contract adds no new storage path; a reviewer can check the second claim from the diff alone.
- [x] **4.2 Promotion into T3 is always supervised.** observe → candidate →
      evidence → review → promote. No step promotes on a threshold alone, and
      nothing here reopens agent memory (ADR-094 stays closed).
      verify: the contract states the five stages and names ADR-094 as untouched; no code in this roadmap writes into a T3 path.
- [x] **4.3 Health and degradation states over the existing freshness
      verdicts.** With the one binding line: no claim requiring transitive
      certainty on a stale or absent journal.
      verify: a fixture query against a stale journal returns a degraded verdict naming the staleness, never a confident answer; a fixture against an absent journal returns `unavailable`, never an empty success.

## Blockers

### blocker: journal-retention-and-size

- **Status:** resolved
- **Owner:** maintainer
- **Resolution:** **(c) — TTL plus an explicit, time-bounded, human-only hold.**
  AI council 2026-08-28 (anthropic + openai, 1 round, $0.00, both seats
  subscription-authed), **2/2 convergent on the letter** and convergent on four
  design constraints neither the blocker nor the recommendation had stated:

  1. **Default TTL 30 days, anchored on episode close** — `episode_closed_at`;
     absent, `session_end`; absent, the last event timestamp past an inactivity
     threshold. A TTL anchored on write rather than close would expire a live
     episode.
  2. **A hold is an append-only record, never a mutable pin table.**
     `retention_hold` / `retention_release` pairs carrying `episode_id`,
     `created_at`, `created_by`, `reason`, `retain_until`. No pin-management UI
     in Phase 1.
  3. **Only a human may set a hold. The observed agent may never pin its own
     episodes** — both seats independently. An agent that can hold its own
     records can defeat retention, and it need not do so deliberately.
  4. **Holds expire too.** Default 180 days, renewable. Permanently-kept
     evidence belongs in an explicit archive/export path, never in the live
     journal.

  Both seats raised the same counter-argument — a hold surface can quietly
  recreate the unbounded store the TTL exists to prevent — and it is answered by
  (2) and (4) rather than waved away. One seat's alternative, a large size-capped
  ring, is recorded as the fallback if the hold surface proves to cost more than
  it returns; it is not adopted, because "oldest dropped" is unpredictable from a
  reader's side, which is exactly what a retention policy must not be.
- **Interaction with the boundary blocker — see its own resolution.** Both seats
  independently identified the same combined failure: a hold makes a mis-derived
  episode boundary **durable**. The mitigation is recorded there, because it
  constrains the boundary record rather than the retention rule.
- **Blocks:** Phase 1 only in its retention half; the record shape and the
  spine land under any answer.
- **What to do:** pick exactly one — (a) time-based TTL with a fixed window:
  simple, predictable, and it discards evidence a later investigation wants;
  (b) size-capped ring with the oldest episodes dropped: bounded on disk,
  and the drop point is unpredictable from a reader's side; (c) TTL plus an
  explicit pin so a named episode survives its window: keeps investigations
  reproducible, and needs a pin surface nothing has yet.
- **Resolved when:** the choice is recorded here and 1.1's schema carries the
  retention field it implies.
- **Recommendation:** (c). An append-only record with no retention policy is
  the growth defect the estate's own scale discipline names, and a plain TTL
  destroys exactly the episodes a post-hoc question is asked about.
- **If you do nothing:** the journal grows without bound, which makes it the
  first surface a future reviewer asks to delete.

### blocker: what-counts-as-an-episode-boundary

- **Status:** resolved
- **Owner:** maintainer
- **Resolution:** **(c) — one episode per task — with the opening rule REPLACED.**
  AI council 2026-08-28 (anthropic + openai, 1 round, $0.00), 2/2 convergent on
  the letter, and **both seats rejected this blocker's own proposed opening
  condition.** That rejection is the substance of the resolution, so it is
  recorded rather than summarised away.

  The blocker proposed opening the episode at "the first mutating action after a
  user prompt", and conceded it is a judgement no field records. Neither seat
  accepted it:

  - One seat noted that the obvious mechanical proxy — reading the
    interrupt classification — inherits a judgement rather than removing one,
    and that `user-interrupt-priority`'s own "in doubt → treat as interrupt"
    default would fragment a 20-turn task into 20 half-episodes.
  - The other rejected it on a stronger ground: opening at the first *mutation*
    **omits the reads, dispatch decisions and reasoning that explain why the
    mutation happened** — precisely the evidence the journal exists to preserve.

  **Adopted instead — open on envelope correlation, not on mutation:**

  1. The envelope assigns a stable `task_id` when it accepts or dispatches work.
  2. Every journal event carries `task_id`, `session_id` and, where applicable,
     `prompt_id`.
  3. The **first event carrying that `task_id`** opens the episode.
  4. An explicit terminal envelope event closes it.
  5. An event with no `task_id` stays session-scoped and is marked
     `boundary_status: session_fallback` — which is (a) kept as the fallback key,
     as the recommendation intended, but **marked** rather than silent.

- **The combined failure both seats found, and its mitigation.** A retention hold
  makes a mis-derived boundary durable: pin an episode that was really three
  tasks, and two unrelated tasks are retained forever as collateral, while the
  genuinely relevant adjacent events expire. Boundary error stops being a
  confusing view and becomes a retention-policy violation. Adopted mitigations,
  taken from both seats:

  - **Record boundary provenance** on every episode: `explicit` · `derived` ·
    `session_fallback`, plus the derivation rule version.
  - **A derived or unresolved boundary may not carry an episode-only hold.**
    Such a hold widens automatically to the containing session or to an explicit
    time range.
  - **A later reconstruction may create a corrected episode definition without
    rewriting journal records** — the records are append-only; the episode is a
    view over them.
  - One seat additionally proposed **event-level holds** rather than
    episode-level, which would dissolve the interaction entirely. Recorded as
    the preferred shape if the widening rule proves awkward; not adopted in
    Phase 1, because it costs a second addressing scheme before anything has
    used the first.
- **Blocks:** Phase 2 only. Phase 1 records events without needing the answer;
  Phases 3 and 4 depend on Phase 2.
- **What to do:** pick exactly one — (a) one episode per host session:
  trivially derivable from `session_start`/`session_end`, and a long session
  containing four unrelated tasks becomes one unanalysable episode;
  (b) one per user turn: fine-grained and cheap, and it splits a single task
  that spans turns into fragments that must be re-joined; (c) one per task,
  opened at the first mutating action after a user prompt and closed at the
  terminal state — matches the envelope's own unit, and the open condition is
  a judgement no field records today.
- **Resolved when:** the boundary is recorded and 2.2's fixture asserts it.
- **Recommendation:** (c) with (a) as the fallback key, so an episode that
  cannot be delimited still lands under its session rather than being dropped.
  The envelope already reasons in tasks; a journal keyed on a different unit
  cannot join to it without a mapping nobody maintains.
- **If you do nothing:** Phase 2 has no unit and the spine cannot be
  reconstructed, which is the only thing Phase 1's records are for.

## Acceptance Criteria

- [ ] AC-1 — Every member of `EVENT_VOCABULARY` is either recorded or listed
      as not-recorded with a reason, enforced by a test that fails when a new
      member is added — so coverage cannot silently regress.
- [ ] AC-2 — The record type has no field capable of holding a prompt, a file
      body or an absolute path, asserted against a committed key set.
- [ ] AC-3 — Two concurrent writers from two worktrees of one repository both
      land, and the test has been observed failing with the mechanism
      neutralised.
- [ ] AC-4 — One fixture episode is reconstructed from the journal alone,
      end to end, with no in-memory state.
- [ ] AC-5 — A non-success return with no consumption acknowledgment is
      reported by the ignored-blocker detector; one with an acknowledgment is
      not.
- [x] AC-6 — The tier contract names existing files for all four tiers and
      introduces no new storage path.
- [ ] AC-7 — A query against a stale or absent journal returns a degraded or
      unavailable verdict naming the cause; none returns a confident answer.
- [ ] AC-8 — Nothing in the landed change is a resident process: every writer
      is a hook invocation that terminates, checkable from the diff.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-28 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The journal becomes a resident process by increments | implementation | Each step is individually Class A, and an aggregation or retention need is the usual reason a per-invocation writer acquires a long-lived helper — at which point ADR-124's Class-B bar has been crossed without its ADR. | AC-8 makes "no resident process" a checkable property of the diff, and Phase 4's T3 tier is explicitly the tier this roadmap does not write into. | Phase 4 — The tiers get names and a contract |
| 2 | A record captures content it must not | implementation | An event record is the natural place for a prompt excerpt or a path, and once written the privacy failure is durable and distributed. | 1.1 makes the exclusion a property of the schema rather than of a scrubber, and AC-2 asserts it against a committed key set. | Phase 1 — The journal, written by hooks that terminate |
| 3 | The episode boundary is chosen implicitly by the first implementation | implementation | Phase 1 can land without the boundary decision, so the first code to need one will pick it, and the blocker resolves retroactively against whatever shipped. | The `what-counts-as-an-episode-boundary` blocker names Phase 2 as blocked and 2.2's fixture asserts the recorded choice, so the decision precedes the reconstruction rather than following it. | Phase 2 — The episode spine |
| 4 | An unbounded append-only store becomes the thing that gets deleted | product | A record with no retention grows until someone removes it wholesale, taking the evidence with it — the failure the estate's own growth discipline exists to prevent. | The `journal-retention-and-size` blocker gates the retention half of Phase 1 and its recommendation keeps named episodes pinned past their window. | Phase 1 — The journal, written by hooks that terminate |
| 5 | Consumption acknowledgment is adopted at a rate too low to answer anything | product | A field nobody fills makes the ignored-blocker detector look green while measuring nothing, which is worse than not having it. | 3.3 measures adoption with a stated denominator and publishes a low share as measured rather than re-scoping the claim. | Phase 3 — Consumption acknowledgment |

## What this roadmap will NOT build

- **Any resident process.** No collector, no watchdog, no daemon. Those sit
  behind the flip's Phase-1 ADR and ADR-124 § 5, and this roadmap is one of the
  inputs that ADR will need, not a way around it.
- **A `runtime/` kernel package.** The journal is a contract seam over surfaces
  that already exist. A package would be a second event model beside the
  dispatch stream.
- **A second envelope.** Phase 3 adds one field set to the envelope that ships.
- **Agent memory, in any form.** ADR-094 stays closed. A durable event record
  keyed by episode is not a memory layer, and Phase 4.2 states the promotion
  discipline that keeps the two apart.
- **The cross-machine stop-rate measurement.** That is the parked
  episode-finalizer roadmap's, blocked on evidence no autonomous run can
  produce. This roadmap does not claim it, does not un-park it, and does not
  depend on it.
