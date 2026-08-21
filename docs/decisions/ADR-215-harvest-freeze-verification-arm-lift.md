---
adr: 215
status: accepted
date: 2026-08-05
decision: harvest-freeze-verification-arm-lift
supersedes: —
superseded_by: —
phase: skill-ecosystem sweep 2026-08 (ADR-211 Amendment A.3 reconfirmation + Amendment B cadence)
type: structural
review_trigger: >-
  Inherits ADR-211 Amendment B unchanged: the freeze question returns to the AI
  council at every minor release or at latest every three months, whichever
  comes first, and the outcome is appended to ADR-211's history. Additionally
  reopen when (a) both open verification roadmaps stall incomplete across a
  release cycle while a third high-value verification item is identified — the
  two-slot cap is then too tight, or (b) verification work ships across two
  release cycles while the maintainer judges that foundational quality has not
  improved — the activity-versus-progress gap the council named is then confirmed
  and the cap is treating the wrong bottleneck. Trigger (c) of the original
  wording (a capability entry requested by a real external adopter) is STRUCK by
  ADR-216: adoption is not a valid condition in this tree.
---

# ADR-215 — The harvest freeze lifts for verification infrastructure only, under a two-slot cap

## Status

**Accepted, then partially superseded the same day.**

> **CORRECTED BY [ADR-216](ADR-216-restraint-reanchored-to-capacity.md)
> (2026-08-05).** This record gated its capability arm partly on "≥1 real
> external adoption documented" — the same unreachable condition it was written
> to narrow. ADR-216 strikes that clause, records that external adoption is not a
> project goal, and lifts the freeze **in full**. Consequently the
> verification-versus-capability split below **dissolves**: it existed only to
> hold capability behind the adoption gate. What survives from this record is
> **D2, the mechanically-enforced two-slot concurrency cap** — a capacity
> mechanism that is independent of adoption and now the only thing restraining
> the queue. Read D1 and D2 as live, D3 as struck, D4 and D5 as live.

ADR-211's internal resume arm is satisfied and the freeze was partially lifted
here: verification-infrastructure work may open under a hard concurrency cap,
capability additions were held behind a separate arm (since struck), and
ADR-211's latent-risk door is recorded as structurally unable to admit
capability.

## Context

[ADR-211](ADR-211-harvest-freeze-resume-conditions.md) canonicalized the harvest
freeze and gave it an internal resume arm requiring all three of: the renewal
roadmap set fully closed, the hook-latency repair complete, and an AI-council
reconfirmation with a documented outcome.

**Conditions 1 and 2 verified met (2026-08-05).** Both prerequisite roadmaps are
archived with zero open and zero deferred checkboxes. Verified by direct
inspection rather than from memory, per `direct-answers` Iron Law 2 on live-state
facts.

**Condition 3 is this record.** The council ran on 2026-08-05
(anthropic/claude-sonnet-4-5 + openai/gpt-4o, 2 rounds, blind peer review). Two
independent triggers had fired simultaneously: the Amendment A internal arm, and
the Amendment B cadence review, which a minor release had made due on its own
terms.

**The decision the council was asked to dispose of.** A 40-source deep-dive of
third-party agent-skill suites had just completed — file trees, real skill
frontmatter, scripts, schemas, evaluation harnesses, prompt shapes, not READMEs —
cataloguing roughly 200 mechanisms with a per-mechanism verdict. Durable record:
[`skill-ecosystem-sweep-2026-08`](../../agents/settings/contexts/skill-ecosystem-sweep-2026-08.md).

The sweep's disposition profile is what made the question tractable: the large
majority of *content* is already covered or refused, four verticals were refused
outright under the existing domain-adoption gates, one source was refused on
media-policy grounds, and four on licence. **What survived is overwhelmingly not
capability — it is verification infrastructure and rule text.**

## Decision

### D1 — The freeze lifts for verification infrastructure, under a two-slot cap

At most **two** roadmaps in this family may sit outside `archive/` and `later/` at
any time.

> **Scope widened by ADR-216.** As written, this clause said
> "verification-infrastructure roadmaps" and defined that as changes to gates,
> checkers, projection enforcement, or rule-enforcement mechanisms — explicitly
> excluding new skills, corpora, domain surfaces, and user-facing output formats.
> With D3 struck the category no longer gates anything, so the cap now counts
> **any** `road-to-skill-ecosystem-*` roadmap. The number is unchanged; only the
> category filter is gone.

The two slots opened by this record are, in the order the council named them
mandatory-first and mandatory-second:

1. [`road-to-skill-ecosystem-gate-integrity`](../../agents/roadmaps/archive/road-to-skill-ecosystem-gate-integrity.md)
   — generalizes into a checkable invariant the failure class this package has
   recorded four separate times from its own history and fixed four times
   individually.
2. [`road-to-skill-ecosystem-authoring-discipline`](../../agents/roadmaps/archive/road-to-skill-ecosystem-authoring-discipline.md)
   — implements the one intervention shape the sweep found measured, where the
   identical obligation scored 0 of 4 absent, 1 of 4 as prose (below the
   no-instruction control), and 4 of 4 as a mandated artifact at the decision
   point.

Queued behind them, in `agents/roadmaps/later/` with an explicit slot blocker:
runtime enforcement (position 3), eval integrity (position 4), security and
conformance (position 5).

### D2 — The cap is mechanically enforced, not left to discipline

A guideline a single maintainer intends to honour drifts under urgency. The cap is
enforced by a gate: a third concurrently-open `road-to-skill-ecosystem-*` roadmap
outside `archive/` and `later/` fails the build with a pointer to this record.

> **Corrected 2026-08-05 — the claim now matches reality.** As first written this
> clause asserted present-tense mechanical enforcement and then deferred the
> implementation to "a step in the gate-integrity roadmap". **No such step
> existed.** So the record claimed an enforcement that did not exist and pointed
> at work that was never written — a claim-without-resolution in the one record
> governing what is now the *only* surviving restraint mechanism, and a textbook
> instance of the failure class this whole change set is about.
>
> The gate is `src/scripts/lint_roadmap_family_cap.ts`, registered as
> `task lint-roadmap-family-cap` and wired into the CI aggregator. It carries the
> scan-scope assertion (a dead roadmap root fails rather than passing green),
> prints the scanned denominator on the green path, and ships six paired fixtures
> including an over-cap failure and a dead-root failure — so it is demonstrably
> able to fail. The family prefix and the cap are named constants: widening them
> is a visible one-line diff that needs its own decision record, never a silent
> threshold edit.

### D3 — ~~Capability stays frozen behind its own arm~~ — STRUCK by ADR-216

> **STRUCK.** This clause gated capability on "≥1 real external adoption is
> documented" OR a locally reproduced external finding. The first half is the
> unreachable condition this whole record exists to narrow, and carrying it
> forward reproduced the defect one file over. ADR-216 strikes it and lifts the
> freeze in full, so there is no capability arm to gate.
>
> **What replaces it:** one queue, one capacity mechanism. The two-slot cap in D2
> applies to any roadmap in the family regardless of whether its content is
> verification or capability; a capability roadmap competes for a slot on equal
> terms. Ordering within the queue is a maintainer choice per slot, informed by
> the sweep record's evidence, not fixed by a category.
>
> The one part worth keeping from the original clause: the sweep's two findings
> that contradict locked decisions here (sweep record § R1 and § R2) are still
> best resolved by reproducing them locally before acting. That is now a
> **sequencing preference backed by evidence discipline**, not a gate.

### D4 — ADR-211 Amendment D cannot admit capability; recorded as a construction defect

Amendment D requires a failing test written and committed before the borrow. For a
defect in existing machinery this works — the test exercises real code that
misbehaves. For a capability that does not exist yet it cannot: a test referencing
absent code is not a failing test but a declaration of intent, which Amendment D
explicitly excludes.

The council split on whether this is intended design. The majority position, and
the one adopted here, is that it is a defect rather than intent, because ADR-211's
own framing states the binding constraint is adoption and never states that
capability is banned. If Amendments C and D structurally prevent capability even
when adoption would justify it, they contradict the record they amend.

**Repair:** D3's separate capability arm, not a patch to Amendment D. Amendment D
stays exactly as written for the defect-closure case it handles well. A
skipped-or-pending test for a not-yet-existing capability is explicitly **not**
accepted as a substitute, because it is indistinguishable from wishful thinking.

### D5 — The two contradictory findings are recorded, not acted on

Sweep record § R1 (declared size bands versus a published measurement over 7,308
trajectories) and § R2 (imperative density versus reasoning-based phrasing, where
three sources disagree) are `decision-revisit-gate` triggers, surfaced to the
maintainer with their numbers. Neither is silently applied. § R1 carries a blocker
in the authoring-discipline roadmap; § R2's one adoptable half — a
consistently-unfollowed rule needs structural enforcement or deletion, not a
louder restatement — is adopted independently of the unsettled style question.

## Consequences

- ADR-211 stays in force. Its external arm, its Amendment B cadence, and its
  Amendment C evidence-direction requirement are unchanged. This record narrows
  what the freeze covers and adds the capability arm; it does not retire the
  freeze.
- The four roadmaps parked under ADR-211 on 2026-08-03 are unaffected. Their
  resume lines cite ADR-211 and remain correct.
- The sweep's value is captured without opening nine workstreams. Two roadmaps are
  executable now; three verification roadmaps and one capability queue are parked
  with explicit slot and arm blockers.
- **The activity-versus-progress risk is named and instrumented.** The council's
  strongest objection to lifting was that verification work feels productive while
  doing nothing about the binding constraint — which the council took to be
  adoption. ADR-216 corrects that premise: the binding constraint is maintainer
  capacity. Review trigger (b) is re-anchored accordingly — verification shipping
  across two release cycles without the maintainer judging foundational quality
  improved is what confirms the gap.
- Every adoption from the sweep is re-derived under `code-provenance`, never
  adapted as text. One source is copyleft ShareAlike and one is GPL; adapting
  either's prose would propagate their terms into this tree.

## Alternatives considered

- **Keep the freeze whole.** Rejected. Both council members reached the same
  position independently: the greater risk for verification infrastructure is *not*
  lifting, because the top findings close failures this package has already paid
  for — one of them four times — and refusing to fix a known repeated failure for
  procedural reasons wastes the sweep and produces no compensating benefit.
- **Lift entirely.** Rejected *here*, then accepted by ADR-216 once the anchoring
  was corrected. The load-bearing half of the rejection survives: the sweep is
  large enough that converting all of it into open work is roughly nine parallel
  workstreams for one maintainer, which is the fragmentation the restraint exists
  to prevent — hence the concurrency cap. The adoption half of the rejection was
  the defect ADR-216 removed.
- **Author every roadmap and park all of them.** Rejected as a middle-ground
  fallacy: either the work is valuable enough to execute, or it is not worth the
  authoring cost. "Valuable but not now" requires a specific unparking condition —
  which exists for the capability arm and does not exist for verification work when
  capacity just freed.
- **Analysis record with no roadmaps.** Rejected. It pays the sweep's full cost and
  captures none of its value, and the mandatory-first item addresses a failure
  already paid for four times.
- **Patch Amendment D to accept a pending test.** Rejected per D4 — a test written
  before the code it references cannot fail for the right reason.
- **One verification slot plus one capability slot.** The minority council
  position, rejected here because the capability arm's gate was unmet. **ADR-216
  supersedes this reasoning**: with the split dissolved, both slots are simply
  slots, and whether a slot holds verification or capability work is a maintainer
  choice rather than a category rule. The minority position turns out to have
  been closer to correct, for a reason neither member could reach — the gate it
  deferred to was never valid.

## References

- [ADR-211](ADR-211-harvest-freeze-resume-conditions.md) — the freeze this record
  narrows; Amendment A.3 is satisfied by this record's council.
- [`surface-consolidation-restraint`](../../agents/settings/contexts/surface-consolidation-restraint.md)
  — the 2026-07-20 restraint set the freeze belongs to.
- [`skill-ecosystem-sweep-2026-08`](../../agents/settings/contexts/skill-ecosystem-sweep-2026-08.md)
  — the durable sweep record: method, convergences, refusals, negative evidence,
  the two contradictions, and the anonymized provenance.
- [`decision-revisit-gate`](../../src/rules/decision-revisit-gate.md) — the
  mechanism-match test that keeps this record from reopening the reminder-shaped
  honest nulls.

## History

- 2026-08-05 — record created. ADR-211 Amendment A conditions 1 and 2 verified met
  by inspection; condition 3 satisfied by the council session recorded here.
  Council disposition: lift for verification infrastructure under a two-slot
  mechanically-enforced cap, capability frozen behind a separate arm, Amendment D
  recorded as unable to admit capability. Amendment B cadence review discharged for
  this cycle with the same outcome.
