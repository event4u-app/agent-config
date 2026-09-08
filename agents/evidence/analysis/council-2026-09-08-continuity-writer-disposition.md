---
kind: analysis
subject: continuity-writer-disposition
observed_at: 2026-09-08
commit: 21c2ee68a9a9c77f116284bf695cd64c7ab6915c
---

<!-- evidence-type: analysis -->

# Council record — the honest deliverable for `road-to-continuity-writer-activation` (2026-09-08)

> **Verbatim transcription of a council run, not a summary.** The council CLI
> writes only under the gitignored runtime tree, so a verdict cited from there
> is unresolvable to any reviewer. This file is what the roadmap and the pull
> request cite instead. Nothing in the seat responses below is paraphrased.

## Run metadata

| Field | Value |
|---|---|
| Mode | `design` / prompt-mode `design`, depth `deep`, peer review on |
| Members | `anthropic/claude-sonnet-4-5`, `openai/codex-default` |
| Rounds | 2 |
| Quorum | `{"status": "concluded", "threshold": 1, "total": 2, "present": 2}` |
| Cost | estimated $0 / actual $0 — all seats subscription-authed, nothing billed |
| Degradation | **NONE.** Both seats answered both the deliberation and the peer-review round; 4 calls made, 4 scorable. This run is FULL STRENGTH and is not to be cited as degraded. |
| Emitted deliberation record | `zero_marginal_value_call_rate` 0 over 4 scored of 4 calls |

The question is reproduced in § 5. It states no expectation of the outcome:
it offers a third option on both questions and says a reasoned refusal to
decide is acceptable.

## 1. Verdict — both seats chose C, and their C is narrower than "execute Phase 1"

Convergent, in four ordered parts:

1. **Discharge the implementer-owned telemetry blocker DURABLY** — not merely a
   one-line header. Because the collector's source file is absent from the tree,
   the provenance of the existing report is unknown and a regeneration could
   recreate the defect. Label it non-evidentiary and provenance-incomplete.
2. **Repair the roadmap's dependency model.** Free-floating prose blockers wired
   to no step cannot gate work or prove done-ness. anthropic calls this "a
   deliverable flaw"; openai asks for each item to name the step it gates,
   whether it is a decision, a dependency, a risk or an executable task, and its
   status.
3. **Then** a bounded, default-off Phase 1 vertical slice.
4. **Stop before** rename, retirement, consumer removal, or concern-count growth.

Both seats also corrected the framing this lane brought them, and the
correction is recorded because it went against the lane's own reading —
openai: *"'No step carries a `blocked-by` annotation' is evidence of deficient
dependency modelling, not independently proof that nothing is blocked. Prose
constraints can still be normative."*

## 2. Where they diverged, and what would settle it

They agree Phase 1 is one architectural unit and disagree on how divisible it
is. openai: *"'Execute Phase 1 — or as much as one lane can carry' permits
unsafe partial completion. The state machine, persistence protocol,
controlled-failure tests, and rollback behavior form one architectural unit."*
anthropic proposes an explicitly bounded slice instead — conflict policy plus
state machine, the writer with input validation, a minimal fixture-plus-one
integration test, **one** kill switch, and the remaining Phase 1 work
documented.

**Resolving evidence:** whether conflict handling, failure tests and safe
rollback fit into one atomic review unit for the lane in question. openai names
exactly that as its own falsifier for reverting to a disposition-only
deliverable.

## 3. Question 2 — the telemetry fix does not license the retirement

Convergent: correcting the report is **trap-closing only** and supplies no
positive non-use evidence. openai: *"Documentation references prove dependency,
not runtime non-use. They establish required migration work, not that
retirement is safe."*

Convergent on the remedy — the retirement blocker conflates two different
things and should be split:

- **authorization** — owner: maintainer, decision pending unless the governance
  record explicitly says the prior authorisation stays effective once the
  condition is satisfied;
- **execution** — owner: implementer, status ready, dependent on the first
  where atomic removal is required.

openai adds the guard against the opposite error: *"If the governance record
clearly establishes continuing authorization, remove the first item entirely.
Do not retain a fictional maintainer blocker merely for historical
attribution."*

## 4. Seat responses, verbatim

### 4.1 `anthropic/claude-sonnet-4-5` — deliberation

Matze, here's my independent analysis after reading both prior critiques.

## Question 1: The Deliverable

**My answer: C** — but structured as: fix blocker 4 durably, make blocking structure explicit, execute a bounded Phase 1 vertical slice, and document the Phase 3 dependency upfront.

### Agreement with prior reviewers

**Agree with A:**
- Phase 1 is genuinely unblocked by the five named blockers (verified individually) ✓
- Calling it "blocked" when Phase 1 demonstrably isn't would be a wrong disposition ✓
- Pure disposition (Option A) avoids doing available work ✓

**Agree with B:**
- The architectural concerns (trust boundary, sequencing, rollback) are legitimate ✓
- The lack of `blocked-by` annotations is a coordination defect, not just missing metadata ✓
- A bounded, reviewable slice is the honest scope, not "all of Phase 1" ✓

### Disagreement with prior reviewers

**Disagree with A:**
- "Execute Phase 1, or as much as one lane can carry" undersells the discipline B surfaces. The filesystem **is** an untrusted input boundary — a deterministic writer that trusts on-disk state without validation is not deterministic across malformed inputs, concurrent writes, or storage adapter failures.
- A's falsification test is incomplete: "explicit roadmap text saying Phase 1 is blocked" misses implicit dependencies. The concern-split assumption (blocker 5 explicitly blocks Phase 3, which Phase 1 assumes will happen) creates a Phase 1→3 ordering constraint that should be made visible.

**Disagree with B:**
- The 8-configuration concern (three switches → 2³ states) is speculative. The design may architecturally prohibit unsupported combinations. This is a review question for the implementation, not a pre-execution blocker.
- "Rollback criteria insufficient" is a real gap, but defining those criteria **is** Phase 1 work (part of the kill-switch semantics), not a reason to defer starting Phase 1.

### New points not raised in round 1

1. **The blocker structure is itself a deliverable flaw.** Free-floating prose blockers cannot gate work or prove done-ness. B names this as "design defect"; A doesn't. The honest fix: convert the prose list to `blocked-by: [blocker-4, blocker-5]` annotations on the steps they actually gate, so the roadmap's own checkboxes enforce the dependencies.

2. **"One lane's capacity" must be explicitly bounded.** Both reviewers assume one lane can carry Phase 1, but neither specifies what that means. The answer:
   - Conflict policy decisions + state machine with explicit failure paths
   - Writer implementation (default-off, with input validation for the filesystem trust boundary)
   - Minimal parity suite (fixture + one real-dispatcher integration test proving determinism)
   - **One** kill-switch with explicit trip conditions + rollback procedure
   - Documented remaining Phase 1 work (fuller coverage, remaining switches, operational validation)

   Not "all four Phase 1 steps" — that would include three independent switches, which may be too much for one lane.

3. **The telemetry fix must address generation, not just the header.** B is right that a one-line patch is ephemeral if the report regenerates. But the collector source is **absent**, so the durable fix is: mark the current report as `static: non-evidentiary, provenance unknown`. That closes the trap without assuming a generation fix exists.

4. **Blocker 5's Phase 3 scope creates a Phase 1→3 ordering assumption that must be surfaced.** Phase 1 assumes the three-concern split is eventually payable via Phase 3 retirement. If Phase 3 doesn't happen, Phase 1 code stays under the `0`-growth ratchet violation. The honest roadmap makes this dependency explicit upfront, not just in blocker 5's prose.

**Falsified by:**
- Evidence that input validation for the filesystem boundary cannot be Phase 1 scope
- Evidence that making blocking explicit requires cross-phase coordination
- Evidence that one lane cannot carry state machine + minimal tests + one switch
- Governance showing the concern-split assumption has no fallback if Phase 3 is deferred

---

## Question 2: Blocker 4 → 3 Relationship

**My answer:** Fixing blocker 4 durably closes a trap but provides no positive non-use evidence. Blocker 3 should be split: a thin maintainer check (is the earlier authorization still controlling?) and an implementer-owned execution item (ready, unblocked).

### Agreement with prior reviewers

**Agree with A:**
- Blocker 3's mechanical proofs (grep-based, not telemetry) are independent of blocker 4's zeros ✓
- The earlier maintainer authorization was given by name ✓
- Execution work remains ✓

**Agree with B:**
- Fixing blocker 4 is trap-closing, not positive evidence ✓
- The one-line header fix must address report generation durably (B's point about absent source) ✓
- Blocker 3 conflates authorization and execution ✓

### Disagreement with prior reviewers

**Disagree with A:**
- "Owner should be implementer" oversimplifies. The timeline shows: earlier approval by name → later council condition ("prove non-use") → audit satisfied condition. The question is whether the later condition **superseded** the earlier approval or merely **added verification**. If there's any governance ambiguity, a thin maintainer check remains.

**Disagree with B:**
- B treats the authorization question as genuinely open ("unless governance records establish…"). But the audit's mechanical proofs **do** satisfy "prove non-use" — the condition was met. The remaining question is procedural: does the later council's framing require re-confirmation, or does satisfying the condition automatically reinstate the earlier approval?

### New points

1. **The durable blocker-4 fix is narrower than B describes.** The collector source being absent means the fix cannot "identify and fix the actual report generator" — there is no generator to fix. The honest path: mark the report header as `status: static, evidence-class: non-evidentiary, provenance: unknown`. That makes the zeros uninterpretable by design, which is what B's "unrun instrument" achieves but with explicit non-evidentiary status.

2. **The split of blocker 3 should be conditional on governance clarity:**
   - **If** governance precedent clearly shows the later condition merely added verification (not override), **then** blocker 3 becomes: `owner: implementer, status: authorized-and-ready, blocked-by: []` (pure execution).
   - **If** there's any ambiguity whether the later framing requires re-confirmation, **then** split: a thin maintainer blocker ("confirm authorization remains controlling") + an implementer execution blocker ("remove documented dependencies").

3. **The documentation checklist being "complete" (blocker 3's text) means the investigation finished, not that the authorization auto-resolves.** A's reading ("authorization given, execution remains") assumes the earlier approval survives the later condition. B's reading ("decision required") assumes it doesn't. The honest answer depends on whether the council's "prove non-use" was a superseding condition or a verification gate. That's a governance question, and if it's unclear, the thin maintainer blocker stays.

**Falsified by:**
- Governance record showing the later condition explicitly superseded (not just qualified) the earlier approval
- Evidence that blocker 3's mechanical proofs relied on the broken telemetry (verification says no)
- Evidence that the documentation checklist is incomplete (blocker text says complete)
- Evidence that correcting blocker 4's header somehow changes what blocker 3's audit established (it doesn't — independent lines)

---

**End summary:** The honest deliverable is a bounded Phase 1 vertical slice (state machine + minimal tests + one switch) plus explicit blocking structure and documented Phase 3 dependency. Blocker 4 needs a durable non-evidentiary marker; blocker 3 splits into authorization-check (if governance is ambiguous) + execution (implementer-owned, ready).

### 4.2 `openai/codex-default` — deliberation

Matze, my greenlight decision is **C**, but narrower than Reviewer B’s formulation:

> Discharge blocker 4 durably, repair the roadmap’s dependency model, then execute a bounded, default-off Phase 1 slice. Do not claim the roadmap—or all of Phase 1—complete.

## Question 1: honest deliverable

The roadmap is not globally blocked. The verified facts explicitly describe Phase 1 as “unblocked implementation work,” while blockers 1–3 concern rename/retirement matters and blocker 5 constrains Phase 3.

I agree with Reviewer A that Option A would misrepresent available progress. However, I disagree with choosing B without qualification. “Execute Phase 1—or as much as one lane can carry” permits unsafe partial completion. The state machine, persistence protocol, controlled-failure tests, and rollback behavior form one architectural unit.

The lane should:

1. Correct blocker 4’s misleading report semantics.
2. Replace the unwired `## Blockers` inventory with explicit scope:
   - which phase or step each item gates;
   - whether it is a decision, dependency, risk, or executable task;
   - its current status and completion evidence.
3. Implement a coherent Phase 1 vertical slice:
   - conflict invariants and transition table;
   - deterministic, default-off writer;
   - fixture and real-adapter failure tests;
   - operationally defined kill switches.
4. Stop before rename, retirement, consumer removal, or concern-count growth.

### Important qualification

“No step carries a `blocked-by` annotation” is evidence of deficient dependency modelling, not independently proof that nothing is blocked. Prose constraints can still be normative. The stronger evidence is the verified scope of each blocker and the stated ability to implement Phase 1 inside existing concerns.

### What would falsify this choice

I would revert to a disposition-only deliverable if evidence showed that:

- Phase 1 necessarily introduces the prohibited `+2` concern growth;
- its dispatcher or storage integration requires one of the blocked retirements;
- landing the writer default-off still changes existing runtime behavior;
- conflict handling, failure tests, and safe rollback cannot fit into one atomic review unit;
- repository governance explicitly limits this lane to classification rather than implementation.

## Question 2: blocker 4 versus blocker 3

Correcting blocker 4 is primarily a trap-closing change. It supplies no evidence of non-use; it merely prevents meaningless zeros from being mistaken for such evidence.

I agree with both reviewers on that narrow point. I also agree with Reviewer B that a one-line header edit is not necessarily a durable discharge. Because “the collector’s source file is absent from the tree,” the trust boundary that produced the report is unknown. The report should be labelled non-evidentiary and provenance-incomplete, or its actual generator must be found and corrected. Otherwise regeneration may recreate the defect.

The correction affects blocker 3 only conditionally:

- If blocker 3’s non-use conclusion rests entirely on the enumerated mechanical audit, its disposition does not change.
- If telemetry contributed to satisfying the council’s condition, correcting the header removes that purported evidence and blocker 3 remains unresolved.
- Documentation references prove dependency, not runtime non-use. They establish required migration work, not that retirement is safe.

### Is the maintainer decision outstanding?

The supplied facts do not settle this. Reviewer A’s claim that authorization is definitively complete is too strong.

An earlier maintainer authorization was followed by a council condition requiring proof of non-use. The critical governance question is whether that condition:

- merely established implementation acceptance criteria under the existing authorization; or
- superseded the authorization and requires a new maintainer decision after evidence is presented.

A completed checklist resolves the discovery work. It does not itself resolve governance precedence or prove that the accepted evidentiary standard was met.

Reviewer B’s split is therefore the safest model:

- `command-retirement-authorization`
  - Owner: maintainer
  - Status: decision pending, unless the governance record explicitly says prior authorization remains effective once the condition is satisfied
- `remove-documented-command-dependencies`
  - Owner: implementer
  - Status: ready
  - Dependency: retirement authorization, where atomic removal is required

If the governance record clearly establishes continuing authorization, remove the first item entirely. Do not retain a fictional maintainer blocker merely for historical attribution.

### What would falsify this answer

My classification would be falsified by a controlling record that explicitly says either:

- the earlier named authorization remains operative and specifies that the completed mechanical audit satisfies the later condition; or
- the council superseded the earlier authorization and requires renewed approval.

It would also change if the audit proves only absence of static references rather than all relevant invocation paths, such as aliases, generated commands, external automation, or installed older versions.

## Architectural concerns not fully resolved in round 1

The hardest call I would push back on is the proposed **one-slot queue protocol**, before debating module layout. The states `absent/published/consuming/consumed/quarantined/conflicting` do not by themselves define correctness.

The design still needs explicit answers for:

- atomic ownership of `published → consuming`;
- crash recovery from every transitional state;
- whether retries are at-least-once or at-most-once;
- duplicate detection and idempotency keys;
- simultaneous publishers and stale consumers;
- malformed, symlinked, or partially written on-disk state;
- quarantine release and operator responsibility;
- behavior when a kill switch changes during consumption.

Evidence that would change my mind is a transition table with invariants, atomic filesystem/storage operations, and crash-injection tests demonstrating no lost record and bounded duplicate handling across every supported switch configuration.

I agree with Reviewer B that “three independent kill switches” creates up to eight configurations, but would refine the requirement: unsupported combinations should be rejected explicitly rather than all eight necessarily being supported. Each switch also needs trip criteria, authority, persistence scope, in-flight behavior, recovery procedure, and re-enable criteria.

Finally, Phase 3 cannot retrospectively pay for a concern increase needed by Phase 1. Until retirement actually lands, Phase 1 must remain within the current concern count or obtain an explicit ratchet exception.

**End summary:** Reclassify and wire the blockers, durably neutralize the false telemetry signal, and land only a coherent default-off Phase 1 slice; blocker 3 should be split into governance and execution until authorization precedence is proven.

### 4.3 `anthropic/claude-sonnet-4-5` — peer review

### Strongest response

Response-A provides the most careful analysis of the governance precedence question in blocker 3. The distinction between "completed checklist resolves discovery work" versus "resolves the authorization itself" is load-bearing: if the council's non-use condition *superseded* rather than *refined* the earlier maintainer approval, then blocker 3 remains unresolved until a fresh decision. This catches a potential procedural trap that could invalidate downstream work. The split into `command-retirement-authorization` (pending) and `remove-documented-command-dependencies` (ready) is the safest model when authorization precedence is ambiguous.

### Weakest blind spot

Response-A over-scopes the architectural requirements for Phase 1. The enumerated concerns—atomic ownership, crash recovery, duplicate detection, malformed state handling, eight kill-switch configurations—are implementation-detail questions that belong in design review *after* greenlight, not blockers to greenlight itself. A roadmap authorizes scope and proves unblocked; it does not pre-specify implementation invariants. The response treats Phase 1 as if it must be specification-complete before execution, which inverts the planning→implementation sequence and would make every roadmap unexecutable until it contains a full design doc.

### What everyone missed

No response addresses whether the **execution lane** (the entity or team carrying out the work) has capacity and authority to discharge blocker 4 *durably*. Response-A correctly identifies that correcting the header alone is insufficient if the generator recreates the defect, but does not ask: who owns that generator, is it in scope for this lane, and if not, what is the escalation path? A blocker whose durable discharge requires out-of-scope work is a dependency, not a task. `needs-verification`

### Refinement

Synthesizer should separate governance resolution (blocker 3's authorization precedence) from implementation architecture (Phase 1's queue protocol details): greenlight Phase 1 execution contingent on confirming that the earlier maintainer authorization remains operative once the mechanical audit completes, and defer architectural invariants to design review.

### 4.4 `openai/codex-default` — peer review

### Strongest response

Matze, Response-A is strongest because it separates repairing misleading telemetry from proving actual non-use: “trap-closing, not positive evidence.” That distinction prevents a corrected report label from being mistaken for validation and supports splitting authorization from implementation.

### Weakest blind spot

Response-A repeatedly presents unshown conclusions as verified facts—such as “verified individually,” “collector source is absent,” and the audit’s proofs satisfying the condition—without citing the underlying artefact. Its recommendations therefore depend on evidence unavailable in the response itself.

### What everyone missed

Response-A never tests its proposed state machine, writer, switches, and roadmap restructuring against the project’s defining constraint: a read-only subagent that users can try in 30 seconds with nothing else installed. The central decision should be evaluated by whether it preserves that minimal wedge and directly strengthens `@production-validator`’s done-gating behavior.

### Refinement

The synthesizer should preserve Response-A’s evidence-versus-telemetry distinction, but approve only the smallest bounded change demonstrably necessary for the read-only 30-second validation flow.

## 5. The question put to the council, verbatim

# What is the honest deliverable for a roadmap whose blockers are real but whose Phase 1 is not blocked?

Answer on the merits. Any answer may be "neither option — here is a third", and
a reasoned refusal to decide is acceptable if the evidence does not support one.

## Verified facts, each checked against the tree rather than taken from prose

The roadmap is `road-to-continuity-writer-activation`, newly created on the
default branch as the receiver for five items carried out of an archived
predecessor. It has four phases, nine steps and five blockers.

**No step carries a `blocked-by` annotation.** Grepped; there are none. The
blockers are recorded in a `## Blockers` section and wired to no checkbox.

**Phase 1 (four steps) is unblocked implementation work**, and substantial:
settle a one-slot-queue conflict policy and write its state machine
(absent/published/consuming/consumed/quarantined/conflicting); build a
deterministic, default-off writer that computes every field from on-disk state
with no model spend; a two-part parity suite (a fixture suite plus runtime
integration against the real dispatcher and storage adapter with controlled
failures); and three independent kill switches with a rollback note. The
roadmap's own text says a writer whose handlers are independently switchable
inside existing concerns satisfies the substance of the earlier ruling.

**The five blockers, verified individually:**

1. `capture-endpoint-rename-is-owner-reserved` — owner: maintainer. Both seats
   of a prior council declined to choose the surviving endpoint name; it needs
   five recorded owner decisions. Blocks a rename only; capture keeps working.
2. `context-fill-retirement-has-a-parked-consumer` — owner: maintainer.
   VERIFIED: a parked roadmap has steps 1.1 and 1.4c still open (`[ ]`), both
   read the file as a planned input, and 1.4c exists specifically to bound its
   staleness. The producer exists and runs on every session end.
3. `chat-history-command-retirement-has-documented-dependencies` — owner:
   maintainer. VERIFIED: every cited reference exists, and the command the
   owner's authorisation explicitly PRESERVES advertises the retirement
   candidate as a crash-recovery path in three places, plus a user-facing
   quick-start row. The blocker's own "What to do" is nevertheless a complete,
   enumerated checklist rather than an investigation — the audit already ran.
   The owner authorised retiring these two commands by name on an earlier date;
   a later council made it conditional on proving non-use, and the audit cleared
   every mechanical class and found the documentation class populated.
4. `the-command-usage-telemetry-cannot-prove-non-use` — owner: **implementer**.
   VERIFIED, and worse than recorded: the report reads `Active: 0` across all
   337 tracked artefacts; the preserved command reads `dead / 0 / 0` on the same
   page as the retirement candidates; and the collector's source file is
   **absent from the tree**, not merely empty as the blocker states. Its
   "Resolved when" offers two options, one of which is a one-line header change
   declaring the zeros an unrun instrument. It blocks nothing directly and is
   recorded because it nearly caused a wrong disposition on blocker 3.
5. `three-concern-split-is-unpaid-under-the-concern-ratchet` — owner:
   **implementer**. VERIFIED: the growth allowance for the concern axis is
   literally `0` in config and in the gate. A three-way split costs +2 and must
   be paid by retiring a concern, which is Phase 3 work.

## Question 1 — the deliverable

The lane was told to expect the roadmap to be mostly or entirely blocked, and
that if it is, the honest deliverable is a disposition rather than a closure.
The verification above does not support "entirely blocked": Phase 1 is real,
available work that no blocker gates.

Which is correct for a single lane here?

- **A.** Discharge the one implementer-owned blocker that is dischargeable
  (number 4), record a verified disposition for the other four, change nothing
  else, and land a PR that changes the record rather than the progress.
- **B.** Execute Phase 1 — or as much of it as one lane can carry — because
  calling a roadmap blocked when its first phase is not is itself a wrong
  disposition, and the "disposition" framing would be a way of not doing
  available work.
- **C.** Something else, including doing both, or doing neither and reporting
  the roadmap as mis-scoped.

State what would falsify your choice.

## Question 2 — does discharging blocker 4 touch blocker 3?

Blocker 4 exists because an all-zero instrument reads as proof of non-use and
nearly caused a wrong retirement. If the header is corrected so the zeros
announce themselves as an unrun instrument:

- does that change anything about blocker 3's disposition, or is it purely a
  trap-closing edit with no bearing on the retirement decision?
- blocker 3's owner is the maintainer, but the owner already authorised
  retiring these two commands by name, and the blocker's own remedy is a
  finished checklist. Is the maintainer's decision still genuinely outstanding,
  or has it already been given and the blocker is recording an execution risk
  rather than a missing authorization?
- if it is an execution risk rather than a missing decision, what is the
  correct owner field and status for it?

State what would falsify your answer.
