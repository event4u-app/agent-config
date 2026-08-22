# Council disposition — requirements traceability

<!-- evidence-type: analysis -->

**Date:** 2026-08-22 · **Members:** 2/2 (anthropic, openai) · **Mode:** `design`,
depth `standard`, blind peer review · **Cost:** $0.0822.

## Decision 1 — `b-required-for-structural`: (a), keep optional. Convergent.

Both seats. Requiredness before the listing phase has produced a single count is
requiredness decided on intuition, and the additive-optional shape is the one
`late_artifacts` (§2a) and `deferred_policy` (§2b) already established in the
same contract section.

**Both added that (a) alone is an incomplete decision**, and the addition is
carried: the transition to required needs its own record, existing roadmaps must
not retroactively fail, and identity semantics have to be stated now rather than
inferred from a slug grammar. All three are in § 2c.

## Decision 2 — `b-traceability-value-unmeasured`: **(b)**, against the roadmap's own recommendation. Convergent.

The roadmap recommended (a) — reuse `road-to-plan-gates-measurement`'s
zero-adoption falsifier. **Both seats rejected it**, and the reason is not a
preference:

> Zero adoption does not falsify traceability value. It may indicate no
> opportunity, no incentive, poor documentation, or a measurement system that
> never operated.

Seat A named the destructive interaction plainly: Decision 1 (optional) makes a
zero-adoption falsifier **certain** to fire; parking on it removes any reason to
populate the fields; so the measurement design creates the falsifier it is trying
to avoid.

**Four separate falsifiers replace the one**, and they park different things:

| Falsifier | Condition | Parks |
|---|---|---|
| **No opportunity** | fewer than three eligible structural roadmaps enter the window | the adoption *measurement* |
| **No adoption** | zero non-maintainer-prompted roadmaps adopt it | *enforcement*, never the schema |
| **Poor resolution** | results non-deterministic, or >20 % of manually checked classifications false | the *resolver* |
| **No demonstrated value** | an adequately documented sample shows no concrete reviewer or validator use | remove or redesign |

Collapsing them is how a zero from non-adoption becomes indistinguishable from a
zero from non-compliance.

## Decision 3 — the vanished dogfood set: option 4, and the two seats proposed different fours

Step 2.1 named three roadmaps to dogfood. **All three were archived by sibling
pull requests in the same drain run** (#1542, #1538, #1532) before any window
opened.

**Seat A: abort Phase 0.** *"Corpus instability — active structural roadmap count
insufficient to support the traceability experiment. Resume when ≥5 structural
roadmaps are expected to remain active for 90 days, AND at least one maintainer
demonstrates a concrete tracing problem these fields would solve."*

**Seat B: separate the three populations.** And it refutes the abort directly:

> A shrinking corpus does not prevent shipping an optional schema extension or a
> deterministic inventory tool. It prevents drawing a meaningful adoption or
> value conclusion from that corpus. The architectural requirement should be
> **measurement validity**, not corpus growth.

**Seat B's is the one acted on**, because its refutation is unanswered: seat A's
own greenlight condition was that the abort option be *named*, and naming it is
satisfied by recording it here. What ships is the schema plus a read-only
inventory — neither of which needs a stable corpus to be correct — while every
*conclusion* about adoption or value is parked under the falsifiers above.

Three populations, reported separately and never summed:

- **`fixture`** — synthetic inputs testing parser and resolver mechanics. Never
  counts toward adoption: a maintainer-authored fixture is evidence about the
  reader, not about uptake. (Seat B also refused seat A's suggestion to *create*
  roadmaps as dogfood, for the same reason — that contaminates the experiment.)
- **`cohort`** — a frozen manifest at a commit; may include archived members;
  experimental history only.
- **`live`** — the current active corpus. The compliance number, and the only
  one a ratchet may read.

## The finding that changed the SCHEMA, not just the plan

Seat B's hardest pushback, and seat A agreed with the identity half:

> I would push back hardest on treating the three flat fields as a traceability
> model. They appear countable, but the proposal has not shown that they encode
> an unambiguous chain from requirement → acceptance criterion → evidence.

With more than one requirement, more than one criterion and a shared pool of
refs, three flat top-level fields are an ambiguous many-to-many: a gate can
report a populated count while providing no dependable trace. § 2c therefore
ships a **repeated row**, one `(requirement, acceptance, evidence_refs)` triple
per row — not three fields.

## Three further clauses carried into § 2c

- **`evidence_refs` are syntactically safe tokens, not verified evidence.** The
  newline rule rejects bodies; it says nothing about whether a ref exists, is in
  scope, or is relevant.
- **Revision semantics were undefined.** Now stated: refs are evaluated at the
  **current head**, with the consequence written down — a completed roadmap can
  move from resolved to unresolved with no roadmap edit.
- **"Gate" had three meanings.** Listing, resolving, enforcing. Exactly the
  first two ship; enforcement does not, and does not until the relation model has
  been exercised on a real corpus.

## Dated follow-ups

- **2026-08-25** (seat B) — replace step 2.1 with the three-population model,
  recording paths, commit SHA, eligibility rule and lifecycle status. *Done in
  this change.*
- **2026-09-12** (seat B) — specify namespaces, uniqueness scope, rename policy,
  revision semantics and legacy compatibility before any enforcement. *Partly
  done in § 2c; enforcement remains unshipped.*
- **2026-09-19** (seat B) — document measurement windows, denominators, cohort
  rules and unparking conditions before interpreting any count.
- **2026-09-22** (seat A) — review requiredness, 30 days rather than 90.
