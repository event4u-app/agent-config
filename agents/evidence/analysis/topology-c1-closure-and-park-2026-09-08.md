---
kind: analysis
subject: topology-c1-closure-and-park
observed_at: 2026-09-08
commit: 0bc7a21eeaf4900588cbe68755dee91ea233c7ea
---

<!-- evidence-type: analysis -->

# Council record and verification evidence — Phase C1 built, the blocked phases parked (2026-09-08)

> **This is a verbatim transcription of a council run, not a summary.** The
> council CLI writes only under the gitignored runtime tree, so a verdict cited
> from there is unresolvable to any reviewer. This file is what the roadmap and
> the pull request cite instead. Nothing in the two seat responses below is
> paraphrased.

## 1. The prior ruling this run refines — DEGRADED, single seat

The disposition executed on this branch rests on an earlier AI-council ruling of
2026-09-08, taken under the maintainer's written delegation. It is recorded here
with its degradation, because a reader who meets the verdict without the
degradation reads a stronger record than the one that exists.

- **Seats:** one answering. The anthropic seat returned `exit_1`.
- **Status:** `DEGRADED` — a single-seat verdict, not a convergence.
- **Verdict, as delivered:** *"Q1-a, amended: execute Phase C1, then move the
  intact parent roadmap to `agents/roadmaps/later/`."* Do **not** split it across
  the three existing stubs (Q1-c) — that couples historical deferral edges to a
  new multi-file topology. The `entry_condition` must be **phase-specific and
  disjunctive**, not a single three-part condition, so that satisfying one
  condition reactivates its own phase.
- **Deferral-integrity requirements it attached:** preserve the roadmap's stable
  identity and all backlinks from archived sources; determine whether
  `lint_deferral_integrity` resolves logical identity or literal paths; if
  literal, atomically update every archived forward reference; run
  `lint_deferral_integrity` against the final tree; do not redirect edges to the
  stubs. A partial path migration is a failed move.
- **Falsifier it named:** use Q1-b (leave the roadmap active) instead if the
  linter does not recognise `later/` as a live destination, or if repository
  lifecycle policy requires carried `[~]` obligations to stay in the active
  directory.

### Neither falsifier fired — checked, not assumed

`lint_deferral_integrity` resolves a destination by **logical slug**, probing
`<slug>.md` in four directories in a fixed order, and `later` is the second
(`src/scripts/lint_deferral_integrity.ts`, `_locate`). The gate carries a
dedicated accept self-test, *"a receiver parked under later/ is equally live and
is accepted"*. No repository lifecycle policy requires a carried obligation to
sit in the active directory. So the park proceeds, and the literal-path branch
of the deferral-integrity requirement applies only to the one markdown link
recorded in section 5 below.

## 2. This run — full strength, both seats present

| Field | Value |
|---|---|
| Mode | `design` / prompt-mode `design`, depth `deep`, peer review on |
| Members | `anthropic/claude-sonnet-4-5`, `openai/codex-default` |
| Rounds | 2 |
| Quorum | `{"status": "concluded", "threshold": 1, "total": 2, "present": 2}` |
| Cost | estimated $0 / actual $0 — all seats subscription-authed, nothing billed |
| Degradation | one of two peer-review calls returned `exit_1` (anthropic). Both deliberation calls answered. |

The question is reproduced in section 6. It states no expectation of the
outcome in either direction, per `evaluator-independence`: it offers a third
option on both questions and says in as many words that a reasoned refusal to
decide is acceptable.

## 3. Seat responses, verbatim

### 3.1 `anthropic/claude-sonnet-4-5` — deliberation

Matze,

Reviewing round 1 critiques and offering independent assessment.

## Points of agreement

**Both reviewers (A & B) — Option B is unacceptable:**
Agree completely. Silent data corruption at a governance boundary is a critical failure mode. Writing nested conditions that the gate will flatten and overwrite is not "adopting the literal ruling" — it is knowingly breaking the reactivation contract.

**Both reviewers — Behavioral verify clauses require their populations:**
Agree. A run discharges only the predicates for which the required population (dissent, corrections, calls) actually occurred. Built-and-wired ≠ verified when the clause gates on runtime behavior.

**Reviewer B — Handwritten parser at a governance boundary is suspect:**
Strongly agree. The gate should load YAML, validate structure, and fail closed on malformed input — not manually parse indentation and silently overwrite keys. This is what schema validation exists for.

## Points of disagreement

**Reviewer A: "Don't park yet, execute C1 first"**

Disagree with the sequencing. C1's three items can be executed and marked complete *independently* of whether the roadmap is parked. These are separable decisions:
- Should C1's built mechanisms close? (Q2)
- Should the intact roadmap move to `later/`? (Q1)

The question *as posed* is about parking format, not whether to park at all. If parking is the decided move (which the DEGRADED ruling proposed), we need to answer Q1 regardless of C1's state.

**Reviewer B: "Change the gate first, then park"**

Disagree with blocking parking on a gate rewrite. If:
- The gate change requires its own roadmap/approval
- Other roadmaps depend on current gate behavior
- Immediate action on this roadmap is required by repository policy

Then "fix the gate" becomes its own unscheduled dependency. Architecturally pure, operationally blocked.

**Reviewer A: Option A is acceptable "if you must park"**

Partially disagree. Option A *is* the non-destructive choice if parking happens now, but neither reviewer surfaced the question it leaves unanswered: **what is the mechanical reactivation test?**

"Read the `what` prose and decide" is not automation — it is punting the condition-parsing to the next human. If reactivation is genuinely manual, state that explicitly. If not, Option A defers the same automation gap that Option B's corruption breaks outright.

## New points not raised in round 1

### 1. The DEGRADED ruling itself is suspect

Both reviewers treated the ruling as binding and optimized around its request. Neither questioned whether a single-seat decision after transport failure, asking for a capability the system cannot express, should drive implementation at all.

**The ruling requested something the parser cannot do.** Before choosing a workaround:
1. Surface that the requested shape and the parseable shape diverge
2. Ask whether the ruling stands given that constraint
3. If yes: document Option A as a compatibility layer awaiting migration
4. If no: decide the actual parking strategy fresh (all phases? just C1? none?)

A DEGRADED ruling asking for the impossible should trigger re-evaluation, not forced implementation.

**What falsifies this:** If repository governance prohibits challenging a DEGRADED ruling, or if the ruling's authority exceeds the gate's constraints regardless of feasibility.

### 2. The "buildable now" / behavioral-verify contradiction (Q2)

Neither reviewer excavated the deeper issue: **why do these steps have runtime-observation verify clauses if the phase is "buildable now"?**

The phase description says: "building the mechanisms does not require a council run, and only observing them in production does."

But the verify clauses ARE production observations:
- 5.4: "renders all three elements" (runtime)
- 10.2: "yields attribution" (runtime)  
- 10.3: "rate is non-null" (runtime)

This is a **contradiction in the roadmap itself.** You cannot simultaneously claim:
- The phase is buildable without a qualifying run
- The verify clauses require council-run observations

One of these must be wrong:
1. Phase description wrong → phase IS blocked on a qualifying run (like C2/C3)
2. Verify clauses wrong → should test build/wire, not runtime behavior
3. Steps should be split → closed build + open observation

Reviewer B's "split into closed implementation + open observation" points toward (3), but neither reviewer named the contradiction directly.

**My answer to Q2, restated:**

For the three clauses *as written*:
- **5.4:** NOT discharged (no dissent occurred)
- **10.2:** PARTIALLY discharged (structure yes, behavior no if no corrections)
- **10.3:** NOT discharged (no calls occurred)

Disposition: **[~] with explicit note of what awaits,** OR **open if the roadmap stays active.**

But the **more fundamental answer:** fix the contradiction before closing anything. Either:
- Rewrite verify clauses to test build/wire (then close on build)
- OR admit the phase requires a qualifying run (then block it like C2/C3)  
- OR split each step (close build, carry observation)

Closing on build alone when verify clauses explicitly name runtime populations is redefining success criteria retroactively.

**What falsifies this:** If repository convention treats "buildable now" as "implementation work can proceed" (not "closeable"), then verify clauses become gates for a *future* observation phase, not success criteria for this one — but that needs explicit statement.

### 3. Where carried items go when the parent parks

Both reviewers said unobserved verify clauses should be "carried," but *to where?* The parent roadmap is being archived. Options:
- New roadmap for C1 observations (scope expansion)
- Later phase of this roadmap (which phase? C2/C3 are also blocked)
- Acceptance that observation waits indefinitely (then why not stay open?)

Neither reviewer specified the receiving artifact or the deferral-edge mechanics.

### 4. Trust boundary at serialization, not just parsing

Reviewer B noted the parser risk, but the gate's failure is deeper: it validates that three keys exist, not that the stored condition *round-trips intact.*

Before any nested-condition work:
- Test serialization preserves every named phase
- Test reactivation consumers can independently select phases
- Test unknown keys / duplicate phases fail closed
- Test ordering stability

"Passes the linter" ≠ "preserves the contract."

### 5. Kill-switch criterion missing

If Option A lands (prose disjunction), what triggers rollback? Neither reviewer specified:
- Reactivation automation proves it cannot parse the prose?
- A reader reports phase loss?
- The next qualifying run surfaces a gap?

A safe temporary form needs an explicit unsafe-condition detector, not just a compatibility claim.

---

## Summary recommendations

**Q1:** Neither A nor B. **Challenge the DEGRADED ruling first.** Surface that the requested shape and parseable shape diverge; ask whether the ruling stands. If it does: Option A with explicit "reactivation is manual" and a migration path to structured conditions. If not: decide parking strategy fresh.

**Q2:** Fix the "buildable now" / behavioral-verify contradiction before closing. As written: only structural parts discharge on an empty-population run; behavioral parts stay [~] or open. Split steps (build vs observe) if the phase truly is build-only, OR admit it requires a qualifying run.

**Falsifies both:** Evidence that repository governance treats DEGRADED rulings as binding regardless of feasibility, and "buildable now" as explicitly distinct from "closeable now."

### 3.2 `openai/codex-default` — deliberation

Matze, I would not greenlight parking yet. The defensible sequence is: complete C1’s implementation work, preserve any unmet live observations as explicit carried obligations, fix the lossy entry-condition gate, and only then park the comprehensively blocked remainder.

## 1. Assessment of the prior critiques

### Points I agree with

**Reviewer A**

- Option B is categorically unsafe. The prompt states that nested phase blocks are flattened with last-write-wins behavior, silently discarding three reactivation paths. Deliberately selecting that representation would knowingly approve semantic data loss.
- An empty population is not affirmative verification. No dissent cannot verify dissent rendering; no corrections cannot verify per-correction attribution.
- Parking should not precede C1 implementation. The earlier ruling itself says “execute C1 and then park.”

**Reviewer B**

- The long-term answer is **C: change the gate to represent phase-specific conditions structurally**.
- The handwritten parser is a governance trust boundary, not merely a formatting convenience. It accepts a document while silently changing its meaning.
- Run evidence must be tied to the relevant revision, configuration, council identity, and live path. “An artefact exists” alone proves none of those.
- An implementation item may be closed after formally splitting implementation from production observation, provided the observation obligation remains traceable.
- Unknown keys, duplicate keys, malformed nesting, and lossy round-trips should fail closed.
- The safe fallback is “roadmap remains active,” not “roadmap parked with truncated conditions.”

### Points I disagree with or would refine

**Reviewer A: “Don’t park” as the primary answer**

This is directionally right but too absolute. The background establishes three buildable C1 items; it does not establish that they remain unbuilt now. Question 2 says the mechanisms are built and wired and a run has occurred. Once implementation is complete and unmet runtime observations are carried correctly, keeping all 38 blocked items active may no longer add value.

The deciding invariant should be:

> No executable work and no acceptance obligation may become undiscoverable by parking.

If carried verification items satisfy that invariant, parking may be legitimate even though runtime observations remain outstanding.

**Reviewer A: structural reachability is discharged “on any run”**

Not necessarily. A run only proves reachability if the evidence shows that the relevant code path and emitter were actually loaded or invoked. Merely producing an unrelated council artefact does not establish that. Reviewer B’s provenance requirement is the stronger formulation.

**Reviewer A: `[~]` is necessarily the correct status**

The prompt defines `[~]` as a deferral edge in one context, but does not give the repository’s complete status semantics. “Carried” is appropriate only if there is an explicit receiver and preserved acceptance predicate. Otherwise, the item should remain open. A decorative `[~]` without a valid destination is another form of premature closure.

**Reviewer B: change the gate before doing anything else**

Changing the gate blocks **parking**, but it need not block implementing C1 or examining the run artefact. Those workstreams are independent:

1. Build and test C1.
2. Classify live evidence and create carried observation items where needed.
3. Change and migrate the gate.
4. Park only after the new representation round-trips and consumers support it.

Conflating these steps unnecessarily serializes useful work.

**Reviewer B: a kill switch for automated parking/reactivation**

Reasonable if automation actually performs those mutations. The prompt only identifies a lint gate. If movement and reactivation are manual, the practical kill switch is simpler: reject the new nested form until every consumer supports it, and prohibit moving the roadmap. A runtime feature flag would be needless machinery unless an automated mutator exists.

## 2. Question 1 — entry-condition shape

My choice is **C**:

1. Leave the roadmap active while C1 has executable implementation work or unsafely represented obligations.
2. Extend the schema and every consumer to support an explicit disjunction of independently addressable phase conditions.
3. Migrate and round-trip-test the document.
4. Park only after the remaining obligations are blocked or validly carried.

Option B must be rejected immediately. Option A is acceptable only as a documented compatibility bridge when parking is operationally urgent and reactivation is entirely manual. It is not semantically equivalent to a phase-aware schema: placing a miniature condition language in `what` cannot independently represent each phase’s `when` and `who`, nor let automation reactivate one phase safely.

The design should define more than parser syntax. It must answer:

- Is the unit of reactivation a roadmap or a phase?
- Who evaluates each predicate?
- Can one phase be returned to active status while the file remains in `later/`?
- Which components consume `entry_condition`, beyond the linter?
- Are C2 and C3 genuinely governed by one identical condition, or merely similar conditions?
- How are existing flat entries migrated?

These are currently open architectural decisions disguised as a serialization choice.

### Rollback and stop criteria

Parking must abort, or be reversed, if:

- Parsed phase identities or condition counts differ from the source.
- Any consumer cannot read both old and migrated documents during rollout.
- Duplicate or unknown keys are accepted.
- A single satisfied branch reactivates unrelated phases.
- The source roadmap cannot be reconstructed losslessly.
- Carried C1 observations have no explicit receiver.

Keep the old flat reader during migration, but make unsupported nesting an error immediately; silent flattening should not remain a tolerated compatibility behavior.

### What would falsify my choice

I would accept A permanently if repository policy and consumer inventory demonstrate that:

- `entry_condition` is exclusively human-readable;
- all reactivation is manual;
- `when` and `who` are necessarily shared across phases;
- reactivation always moves the entire roadmap, never an individual phase; and
- tests verify that the complete disjunction remains visible without downstream prose parsing.

Passing the current linter alone would not falsify the need for C.

## 3. Question 2 — what the run can discharge

The facts provided do not say whether the run contained dissent, corrections, or calls. Therefore no reviewer can honestly declare that a particular clause was actually discharged. The correct result is conditional:

| Step | A single run discharges it only if |
|---|---|
| 5.4 | Real dissent occurred, and the artefact renders all three required elements. |
| 10.2 | The relevant emitter was reached through the live path, at least one correction occurred, and each relevant correction received an unambiguous stage attribution. |
| 10.3 | The run produced calls, emitted the rate, and the emitted value was non-null and semantically valid. |

“Non-null” alone may be too weak for 10.3. A sentinel, `NaN`, impossible value, or wrong denominator could pass a literal non-null test. The acceptance contract should specify the domain and denominator of the rate.

For all three, evidence must identify the tested commit, configuration, council/run ID, and artefact location. Otherwise the run crosses the branch-to-production trust boundary without proving that this implementation produced the observation.

### Correct disposition when the population is absent

- Keep the item **open** if the original roadmap and phase remain active.
- Mark it **carried** only when creating a distinct receiving observation item with a valid deferral edge.
- Do not mark the existing item closed while leaving its original `verify:` clause attached and unmet.

A carried record should state:

- what was established: implemented, wired, and any proven reachability;
- what was not observed and why;
- the tested revision and artefact;
- the qualifying trigger: dissent, correction, or calls;
- the receiving phase or roadmap and accountable owner;
- that implementation completion must not be counted as completed live validation.

### Can an unexercised mechanism ever be closed?

Yes, but only through an explicit change in the acceptance model—not through an empty run:

1. Split the item into a closed implementation obligation and an open/carried live-observation obligation preserving the original predicate; or
2. Use an approved equivalent verification method, such as deterministic replay through materially the same path, if repository policy recognizes it; or
3. Establish that `verify:` is formally advisory rather than a closure criterion.

Any scope change should be approved and recorded before closure. Retroactively treating `verify:` as advisory because the run lacked the necessary population is not verification.

### What would falsify this answer

It would be falsified by:

- an attributable artefact showing each named population and required result;
- repository policy explicitly defining `verify:` as non-blocking guidance; or
- governed evidence that an equivalent replay exercises the same serialization, routing, and emission behavior as the live path.

## Hardest architectural pushback

The call I would oppose most strongly is treating the handwritten, lossy parser as authoritative governance while permitting it to accept unsupported structure. That makes a permissive implementation bug the effective schema.

Evidence that would change my mind would need to show that the field is intentionally non-executable human metadata, no consumer relies on phase identity, reactivation is always whole-roadmap and manual, and property/round-trip tests demonstrate that every supported form retains its complete meaning.

**End summary:** Fix the lossy governance boundary before parking; let C1 implementation proceed independently; and close runtime predicates only when observed or preserved as explicit, attributable carried obligations.

### 3.3 `openai/codex-default` — peer review

### Strongest response

Matze, **Response-A** is the strongest—and only—response. Its most load-bearing contribution is identifying the contract mismatch at the serialization boundary: a configuration that passes linting but loses phase-specific conditions during parsing is silently corrupt, so reactivation must be tested by round-tripping the complete structure, not merely checking for required keys.

### Weakest blind spot

**Response-A** overstates the alleged contradiction between “buildable now” and behavioral verification. Those claims can coexist if “buildable” means implementation may proceed while completion remains contingent on later observation. The real defect is ambiguity about step lifecycle and status semantics; the response should first establish the repository’s definition of “buildable,” “verified,” and `[~]` before recommending changes to acceptance criteria.

### What everyone missed

`needs-verification`: **Response-A** does not connect its recommendation to the project’s defining promise: a read-only production validator that can be dropped into any repository and tried within 30 seconds without additional installation or lock-in. Any schema migration, manual-reactivation convention, or new receiving roadmap should be evaluated against whether a fresh consumer can install the subagent and receive a deterministic, fail-closed “done” verdict through that minimal quickstart.

### Refinement

Prefer Option A only as an explicitly manual, lossless compatibility format, keep unobserved behavioral checks open, and require round-trip plus clean-install quickstart tests before treating the roadmap as safely parked.

### 3.4 `anthropic/claude-sonnet-4-5` — peer review

Returned `exit_1` with an empty body. Recorded rather than dropped: it is the
fourth call the run made, and it is the call the emitted
`zero_marginal_value_call_rate` excludes from its denominator (4 calls made, 3
scorable).

## 4. Synthesis, and the C5.4 audit run over it

The synthesis below was produced from the two seat responses using the amended
templates this change ships. It is reproduced in full because it is the artefact
the C5.4 verify clause is exercised against.

## Convergence / Divergence

### Agreement
Option B is categorically unsafe — nested phase blocks are flattened last-write-wins, so choosing it knowingly discards three reactivation paths (anthropic, openai).
An empty population is not affirmative verification: no dissent cannot verify dissent rendering, no corrections cannot verify per-correction attribution (anthropic, openai).
An implementation item may be closed only after implementation and live observation are formally split, and only while the observation obligation stays traceable to a named receiver (anthropic, openai).
A decorative carried marker with no valid destination is another form of premature closure (openai), which anthropic reaches from the other side by asking where carried items go once the parent parks.

### Clashes
Whether to park at all. anthropic holds that parking format and C1 closure are separable decisions and that Option A is the non-destructive choice if parking happens now; openai holds Option C — extend the schema and every consumer first, and leave the roadmap active until then — and would accept Option A permanently only against five stated conditions.
Whether the prior DEGRADED ruling binds. anthropic holds that a single-seat ruling requesting a shape the parser cannot express should trigger re-evaluation rather than forced implementation; openai does not challenge the ruling and reasons only about the representation.
Whether structural reachability is discharged by any run. anthropic treats the emitter being on the live path as sufficient; openai holds that a run proves reachability only when the evidence ties the emitter's invocation to a named commit, configuration and run identity.

### Blind spots
Neither seat was told what this run actually contained, so both reasoned about the empty-population case; the run in fact produced 4 calls, 3 scorable, and 28 attributed corrections across two stages. `needs-verification`: read off the run artefact, not from a response.
Neither seat addressed that `lint_deferral_integrity` already accepts `later/` as a live destination with a dedicated accept self-test, which is the fact that decides whether parking strands the 38 deferral edges.

### Recommendation
Adopt Option A as a documented compatibility bridge, stating in the parked file that reactivation is manual and whole-roadmap, and record openai's Option C as an unresolved disagreement rather than resolving it by silence.

### Resolving evidence
whether to park at all — strongest minority evidence: openai's five conditions for accepting Option A permanently (`entry_condition` is human-readable only; all reactivation manual; `when` and `who` shared across phases; reactivation moves the whole roadmap; tests keep the full disjunction visible) · resolved by: an inventory of every consumer of `entry_condition` — if the linter is the only reader and no automation mutates or reactivates, all five hold and A is permanent; if a second consumer parses phase identity, C is required.
whether the DEGRADED ruling binds — strongest minority evidence: anthropic's observation that the ruling asked for a shape `entryConditionParts` cannot express · resolved by: re-putting the shape question to a full-strength council, which this run is, and recording its answer as the amendment.
whether reachability needs run provenance — strongest minority evidence: openai's point that an artefact existing proves neither the commit nor the path · resolved by: the run artefact naming its commit, its config and its run id alongside the emitted record.

### Kill criteria
- a second consumer of `entry_condition` is found that parses phase identity — Option A stops being sufficient and Option C becomes required.
- `lint_deferral_integrity` stops resolving a `later/` destination — the park strands 38 edges and must be reverted.
- a later run shows `zero_marginal_value_call_rate` outside [0,1] or with a denominator that is not `calls_scored` — the emitted rate is not semantically valid and 10.3 reopens.

### Concrete next step
Park the roadmap with the flat three-part `entry_condition` whose `what` enumerates the four phase conditions as an explicit disjunction, and record this clash in the roadmap's own text.

### The audit output

Run with `auditSynthesisElements` over the text above:

```
synthesis retains all three elements of the unresolved disagreement
  - unresolved-disagreement: present [### Clashes]
  - minority-evidence: present [strongest minority evidence:]
  - resolving-evidence: present [resolved by:]
complete=true dissentPresent=true source=text
```

`source=text` matters: the audit decided for itself that this pass dissented,
from a non-empty disagreement section, rather than being told so by the caller.

**Scope, stated rather than left to be discovered.** The audit checks presence
and shape. A synthesis that names a clash, cites a minority exhibit and proposes
a resolving measurement passes it even when the measurement is a poor one.
Grading the content needs the benchmark, and the benchmark has not run.

## 5. Verification evidence for the three C1 steps

The council's own answer to question 2 supplies the acceptance table. Both seats
converged that an empty population is not affirmative verification: no dissent
cannot verify dissent rendering, no corrections cannot verify per-correction
attribution. The openai seat wrote the conditions out per step. Its table is
applied here against what this run actually contained — a fact neither seat was
told, and which is read off the run artefact rather than off a response.

| Step | The condition the council named | What this run contained |
|---|---|---|
| C5.4 | real dissent occurred, and the artefact renders all three required elements | dissent present and reproduced in section 3; audit in section 4 reports all three present |
| C10.2 | the emitter was reached through the live path, at least one correction occurred, and each received an unambiguous stage attribution | emitter runs unconditionally in `cmd_run`; 28 corrections, each carrying `firstStage`, `firstMember` and `firstCallIndex` |
| C10.3 | the run produced calls, emitted the rate, and the value is non-null and semantically valid | 4 calls made, 3 scorable; rate emitted as `0`; numerator, denominator and threshold published alongside it |

### The emitted record, verbatim from the run artefact

```json
{
  "zero_marginal_value_call_rate": 0,
  "zero_marginal_value_unavailable_reason": "",
  "calls_total": 4,
  "calls_scored": 3,
  "calls_zero_marginal": 0,
  "novelty_threshold": 0.8,
  "stage_outputs": [
    {
      "stage": "deliberation",
      "produced": 26,
      "calls": 2
    },
    {
      "stage": "peer-review",
      "produced": 2,
      "calls": 2
    }
  ]
}
```

The first three of the 28 attributions:

```json
[
  {
    "correction": "A run discharges only the predicates for which the required population (dissent, corrections, calls) actually occurred.",
    "firstStage": "deliberation",
    "firstCallIndex": 0,
    "firstMember": "anthropic/claude-sonnet-4-5",
    "restatements": 0
  },
  {
    "correction": "Disagree with the sequencing.",
    "firstStage": "deliberation",
    "firstCallIndex": 0,
    "firstMember": "anthropic/claude-sonnet-4-5",
    "restatements": 0
  },
  {
    "correction": "Disagree with blocking parking on a gate rewrite.",
    "firstStage": "deliberation",
    "firstCallIndex": 0,
    "firstMember": "anthropic/claude-sonnet-4-5",
    "restatements": 0
  }
]
```

### On "non-null" being too weak a bar

The openai seat's sharpest point on C10.3 is that a literal non-null test would
pass a sentinel, a `NaN`, or a wrong denominator, and that the acceptance
contract should name the rate's domain and denominator. The emitted record
answers it by construction rather than by assertion: `calls_zero_marginal /
calls_scored` is published beside the rate, so the number is re-derivable by
hand, and the domain is `[0, 1]` because the numerator counts a subset of the
denominator. The kill criterion is recorded in the synthesis above.

### What this does NOT establish

Building a mechanism and observing it in production are different obligations.
This run is one council pass on one machine against one question. It establishes
that the three mechanisms exist, are wired to the live path, and produced the
readings their verify clauses name. It establishes nothing about whether council
topology improves decision quality, nothing about a rate over any population
larger than this run, and nothing about the seven Phase C2 guards — whose
sabotage sensitivity is a property of the tests and never runtime validation, as
the roadmap's own risk register row 4 says.

## 6. The question put to the council, verbatim

# Two decisions on parking a roadmap and closing its buildable phase

You are reviewing an in-progress change to a governed agent-configuration
repository. Answer both questions below on their merits. Either answer may be
"neither option — here is a third", and a reasoned refusal to decide is an
acceptable outcome if the evidence does not support a decision.

## Background, stated as fact

`agents/roadmaps/road-to-council-topology-evidence-followups.md` is an active
roadmap with 41 open items and three open blockers. It is the declared receiver
of 38 `[~]` deferral edges from an archived parent roadmap. Its Phase A (24
items) is blocked on council seating that cannot be created here; its Phase B
(2 items) is blocked on two reserved UTC days; its Phase C2 (7 items) and C3
(2 items) are blocked on a qualifying live council run. Its Phase C1 (3 items)
carries no blocker and its own text states that C1 is buildable now, that
building the mechanisms does not require a council run, and that only observing
them in production does.

An earlier council ruled that C1 should be executed and the intact parent then
moved to `agents/roadmaps/later/`, with an entry condition that is
"phase-specific and disjunctive, not a single three-part condition, so that
satisfying one condition reactivates its own phase". That ruling was taken by a
single seat after the other seat's transport failed, and is recorded as
DEGRADED.

## Question 1 — the entry-condition shape

The repository gate `src/scripts/lint_roadmap_later_disposition.ts` parses
`entry_condition` by hand, without a YAML loader. Its parser
(`entryConditionParts`) reads the key line, then consumes indented
`key: value` lines until the first line that is not indented-non-blank. It
requires exactly three keys — `what`, `when`, `who` — each with a non-empty
value on its own key line. A scalar form is rejected outright. A nested,
per-phase mapping is not recognised: the phase keys are collected and ignored,
and any `what`/`when`/`who` nested under them are flattened, so the LAST phase
block silently overwrites the earlier ones and three of four phases disappear
from the recorded condition with no error.

So the prior ruling's requested shape and the only shape the gate can read are
not the same shape.

Which of these should the change adopt, and why:

- **A.** The flat three-part mapping the gate parses, with `what` written as an
  explicit disjunction that enumerates each phase's own condition by name, so
  the per-phase semantics survive in the text the gate stores.
- **B.** The nested per-phase mapping the prior ruling literally described,
  accepting that the gate records only the last phase block.
- **C.** Something else — including changing the gate, and including leaving the
  roadmap active rather than parking it.

State what would falsify your choice.

## Question 2 — what legitimately closes a build-only step

Phase C1's three steps each carry a `verify:` line that names an observation,
not a build:

- 5.4 — "a run with real dissent renders all three elements";
- 10.2 — "the emitter exists and is reachable from the live path; one recorded
  run yields a per-correction stage attribution";
- 10.3 — "the rate is emitted and is non-null on a run that produced calls".

The phase text says these are buildable now and that only running them needs a
council run. The verify lines require a run. A run has now been made and its
artefact exists.

For a step whose mechanism is built and wired to the live path, and whose
verify clause has been exercised against one real run of this council:

- Which of the three verify clauses does a single real run actually discharge,
  and which does it not?
- Where a run cannot discharge a clause because the run did not contain the
  population the clause names (no dissent occurred, or no correction occurred),
  what is the correct disposition for that step: closed, open, or carried — and
  what must the roadmap say about it?
- Is there any circumstance in which a built-and-wired mechanism with an
  unexercised verify clause may be recorded as closed?

State what would falsify your answer.
