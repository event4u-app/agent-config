# Cross-Source Consistency — Mechanics

> The discrepancy taxonomy, the scan procedure, the confidence-tiered noise control, worked examples, and the precedence table for the `cross-source-consistency` rule

_Companion to `src/rules/cross-source-consistency.md` (P4 pattern of `road-to-kernel-and-router.md`). The Iron Law, the fire/not-fire scope, and the subordination clauses stay in the rule; this file carries the taxonomy detail, the scan procedure, and the examples._

## The discrepancy taxonomy

| # | Class | Definition | Canonical example |
|---|---|---|---|
| a | **text ↔ image** | The ticket/spec text contradicts an attached mockup, screenshot, or diagram. | Text: "show birthdays **today**". Mockup: a birthday from two days ago. |
| b | **silent-but-needed** | The spec is silent on a behavior that is clearly required for the feature to be correct. | Spec: weekend-shifting only. Clearly also needed: public-holiday shifting — but never specified. |
| c | **spec ↔ codebase/reality** | The spec contradicts what the code, DB, API, or a real source actually does. | Spec: "the endpoint returns `dueDate`". The DTO has no such field. |
| d | **intra-ticket** | Acceptance criteria, description, and comments contradict each other. | Description: real-time. AC: "nightly batch is fine." |

Type (a) and (d) are **contradictions between present sources** — the agent
must not pick one silently. Type (b) is a **scope decision** — the inferred
behavior may be right, but adding it is a scope expansion the user owns. Type
(c) routes the *verification* to `source-discovery` (read the real source); this
rule only owns *surfacing the conflict and asking*.

## The scan procedure

Run this whenever planning, refining, estimating, roadmapping, or implementing
from a ticket/spec that carries a second source:

1. **Enumerate the sources.** Ticket text, every attachment (mockup / screenshot
   / diagram), the AC block, description, comments, and — for implementation —
   the relevant codebase/DB/API surface. If an attachment cannot be read,
   say so; do not assume it agrees.
2. **Compare pairwise for type (a), (c), (d).** For each pair, ask: do they state
   the same thing about the same requirement? A mismatch is a discrepancy.
3. **Scan for type (b) — silence.** List the behaviors the feature obviously
   needs but the spec never mentions (weekend/holiday shifts, empty states,
   error paths, permission edges, pagination, timezone). Each unstated-but-needed
   behavior is a candidate to surface — not to implement.
4. **Classify confidence.** High = the sources plainly disagree, or the missing
   behavior is clearly load-bearing. Low = the "conflict" is a plausible
   re-reading, or the missing behavior may be intentionally out of scope.
5. **Decide per the setting** (below), then **batch** every surviving discrepancy
   into ONE question folded into this turn's single `ask-when-uncertain` prompt.

## Confidence-tiered noise control (`consistency.cross_source`)

The rule fires only under a real trade-off (it must pass the
`no-cheap-questions` Pre-Send Self-Check). The setting tunes how aggressively:

| Value | High-confidence discrepancy | Low-confidence discrepancy |
|---|---|---|
| `on` (default) | Surface + ask before proceeding. | Surface + ask (batched into the same question). |
| `auto` | Surface + ask. | State as an explicit assumption and proceed (no question). |
| `off` | No cross-source checking — legacy behavior. | No cross-source checking. |

Batching is the anti-noise mechanism: N discrepancies for one artefact become
one numbered-options block, never N prompts. Plain vagueness (a single unclear
source, no second source to compare) is **not** a discrepancy — it stays with
`ask-when-uncertain` so the two disciplines never double-fire on the same input.

## Worked examples

### Example 1 — text ↔ image (type a)

Ticket: *"The tile shows employees who have their birthday **today**."* Attached
mockup: a card with a birthday dated **two days ago**.

- Wrong: implement "today" (or implement "recent, like the mockup") and move on.
  Both are silent guesses on a real contradiction — a violation even if the
  chosen reading turns out correct.
- Right: *"The ticket text says 'today' but the mockup shows a birthday from two
  days ago. Which is authoritative — (1) strictly today, (2) a recent window as
  the mockup implies, (3) something else?"* Then implement the confirmed reading;
  `design-fidelity` governs building it 1:1 afterwards.

### Example 2 — silent-but-needed (type b)

Ticket update: *"If a birthday falls on the weekend, show it on the next
workday."* The spec never mentions public holidays.

- Wrong: also shift birthdays that fall on a public holiday, because it is
  "obviously" consistent with the weekend rule — a silent scope expansion.
- Right: *"The spec covers weekend-shifting but is silent on public holidays.
  Should birthdays on a public holiday also shift to the next workday? (1) yes,
  same as weekends, (2) no, holidays are out of scope, (3) only regional
  holidays."* Obvious-to-the-agent ≠ in-scope; `scope-control` owns the
  expansion permission.

## Precedence & subordination

| Neighbour rule | Relationship |
|---|---|
| `ask-when-uncertain` | **Parent ask discipline.** This rule folds its discrepancy into that rule's single question. `ask-when-uncertain` fires on *missing* info; this adds *conflicting present* sources. Never a second question block. |
| `scope-control` | **Permission authority** for the type-(b) silent-scope-expansion. This rule surfaces the expansion; `scope-control` gates it. |
| `design-fidelity` | **Fires after** this rule. This rule resolves a text↔image conflict at decision time; `design-fidelity` then enforces build-time 1:1 fidelity to the resolved design. |
| `source-discovery` / `source-discovery-gate` | **Owns verification** for type (c). This rule surfaces the spec↔code conflict; `source-discovery` provides the evidence procedure. |
| `no-cheap-questions` | **Floor.** A discrepancy ask must carry a real trade-off; batch, never nag. |
| `active-remediation` | **Sibling shape.** Its never-silently-ignore ladder is the response model this rule applies to source discrepancies rather than code issues. |

## Failure modes

- **Silent-correct-guess.** Picking the right reading of a contradiction without
  asking. Correct output, wrong process — still a violation.
- **Double-firing.** Emitting a discrepancy question AND a separate
  `ask-when-uncertain` / `improve-before-implement` question about the same
  underlying uncertainty. Fold into one turn's one question.
- **Noise creep.** Surfacing plausible re-readings as if they were hard
  contradictions. Use the confidence tier; `auto` states low-confidence as an
  assumption instead of asking.
- **Silent scope expansion.** Implementing an inferred-but-unspecified behavior
  because it seems obvious. It is a scope decision the user owns.
