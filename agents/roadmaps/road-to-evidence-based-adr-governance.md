---
complexity: structural
status: ready
estate_offset_exempt: >-
  No offset available that this change may honestly take. The estate's other
  13 active roadmaps belong to other sessions; archiving or parking one to buy
  a slot would be a terminal disposition of another session's work, which the
  ratchet's own 67 -> 69 entry names as the incentive it must never create.
  The nearest adjacent roadmap, archive/road-to-adr-revisit-governance.md, is
  already archived — and Invariants Proof 3 records that it closed its ADR-001
  step without producing the follow-up, which is part of why this roadmap
  exists rather than being an amendment to it.
execution:
  mode: phase-checkpoints
---
# Road to evidence-based ADR governance — provenance, E0–E4 evidence grades, full-corpus re-adjudication

> **Source:** Owner instruction, 2026-08-21 (`agents/tmp.old/refactor-adrs.txt`):
> ADRs must be fact-based (community best practice, measurements, tests — never
> council/agent gut feeling alone); mark origin human vs agentic; grade how
> easily each decision may be overturned; question ALL of them; identify
> autonomy blockers for consumer projects and ac. Merged from two independent
> analyses (Claude + GPT, 2026-08-21) across four review rounds, then ruled on
> by a two-seat council. Every load-bearing repo claim re-verified against the
> tree at `492873f09`. External grounding: MADR 4.x confidence/evidence
> metadata (adr.github.io/madr), Azure Well-Architected ADR guidance ("record
> the confidence level of the decision"), AWS prescriptive ADR guidance
> (two-way-door speed vs one-way-door analysis), GRADE's separation of
> evidence certainty from recommendation strength, Thoughtworks EA playbook
> (governance should enable autonomy, not centralize decisions).
>
> **Reconciliation note (recorded so it is not re-litigated):** one analysis
> proposed a static `change_resistance: R0–R3` per document. Rejected —
> `adr-layout § Reopen authority` already decided, council-convergent
> 2026-08-19: *"The routing unit is the transition, never the document …
> a static per-document label cannot express that."*
>
> **Rounds 2–4** resolved: provenance shape (`human | agentic | mixed |
> unknown`, not a `council` class), claim-relative evidence grades instead of
> an evidence-class count, the council-first residue, the blocking Phase 0,
> the per-area frontmatter gap, and four census corrections. Their findings
> survive below as Invariants proofs and as Phase 1.5.
>
> **Round 5 — two-seat council, convergent, and it vetoes the previous core.**
> Both seats named the same self-contradiction: v4 claimed "evidence grade
> prices the reopen burden; it never changes reopen authority" while also
> ruling "agentic + E0/E1 + reversible-internal ⇒ agent may supersede
> directly". Those cannot both hold — if E2→E1 changes whether an agent may
> supersede, the grade **is** an authorization input, and calling the result
> "provisional" changes neither the trust boundary nor the blast radius. The
> architecture is therefore re-cut (§ Architecture): evidence grade affects
> **prioritization and required review material only**; any authority
> consequence is a separate, later, default-off decision gated on a shadow
> trial. Also adopted from round 5: the authority-integrity invariant,
> staged `review_trigger: unclassified` migration, an `authority_basis`
> mutation policy, structured-observation blocking cost, an
> externally-adjudicated gold sample (agreement is not accuracy), a defined
> rollback unit, and the disposition `INSUFFICIENT-EVIDENCE-TO-CLASSIFY`.
>
> **Status.** `ready`: Phase 0A is discharged by the source instruction and
> Phases 1–6 are executable now. The two owner-reserved items — Phase 0B and
> Phase 7 — are `[~]` with named blockers, so the roadmap does not close until
> the owner rules on them.

## Goal

ADR authority derives from current evidence, reversibility, external
commitments, and explicit owner intent — never from the mere existence of an
accepted file, and never from agents agreeing with each other.

Concretely, when this is finished: every accepted ADR carries machine-readable
`provenance` and `evidence` (E0–E4) plus a substantive `review_trigger`; the
full corpus (184 records) has one recorded challenge disposition each, with no
silent re-openings and no silent re-affirmations; every confirmed autonomy
blocker is reopened, amended, or re-affirmed with its blocking cost stated as
sourced observations; permanence language and council-consensus-as-evidence
are linted out of new records; the grade influences **review burden and
prioritization only**, with any coupling to authority decided separately in
Phase 7 on measured evidence and shipped default-off behind a kill switch.

## Architecture — the load-bearing separation

```
EVIDENCE GRADE IS A DESCRIPTIVE MEASUREMENT. IT PRICES REVIEW BURDEN AND
PRIORITY. IT CONFERS NO AUTHORITY UNTIL PHASE 7 SAYS SO, ON MEASURED
EVIDENCE, DEFAULT-OFF, BEHIND A KILL SWITCH.
```

Three layers, deliberately decoupled so a failure in one does not silently
become a failure in the next:

| Layer | Ships in | Can it change who may act? |
|---|---|---|
| **Metadata** — `provenance`, `evidence`, `authority_basis`, `review_trigger` | Phases 1–3 | No |
| **Surfacing** — census, `adr:effective`, cite-time output, sweep artifact | Phases 2–4 | No |
| **Authority** — grade-derived reopen routing | Phase 7 only, default-off | Yes, once enabled |

The previous draft fused all three. That fusion is what both council seats
refused, and the repo has the receipt: the 44 engine-shaped REJECTs were
*correlated agreement* treated as evidence, and only measurement disposed of
the feature. A design that lets an agent assign a grade and then draw
authority from it reproduces that failure with better metadata.

## Invariants

```
COUNCIL CONSENSUS IS NOT EVIDENCE. AGENT CONSENSUS IS NOT EVIDENCE.
AN ADR FILE IS NOT EVIDENCE.
N MODELS AGREEING DOES NOT RAISE evidence.strength — SOURCES AND
MEASUREMENTS DO.

NO PARTY GAINS AUTHORITY FROM A GRADE IT PROPOSED OR BENEFITS FROM.
`reversible-internal` IS ITSELF AN AUTHORITY-BEARING CLASSIFICATION AND IS
NEVER SELF-ASSIGNED BY THE PARTY THAT WOULD ACT ON IT.

AN ADR'S HISTORICAL DECISION-MAKER DOES NOT DETERMINE ITS REOPEN VENUE.
VENUE IS DETERMINED BY THE PROPOSED TRANSITION, THE AFFECTED TRUST
BOUNDARIES, THE RESERVED DIMENSIONS, AND — ONLY ONCE PHASE 7 ENABLES IT —
AN INDEPENDENTLY VALIDATED EVIDENCE ASSESSMENT.

A LOW-EVIDENCE ADR MAY RECORD A DECISION.
IT MAY NOT ESTABLISH THAT ALTERNATIVES REMAIN INVALID BY ITS EXISTENCE ALONE.

A HUMAN PRODUCT DECISION MAY BE AUTHORITATIVE WITHOUT BEING AN
EMPIRICAL FACT. RECORD IT AS owner_intent — NEVER FAKE EVIDENCE FOR IT.

EVERY ADR MAY BE QUESTIONED. NOT EVERY ADR MAY BE AUTONOMOUSLY OVERTURNED.
QUESTIONING ALL OF THEM DOES NOT REQUIRE CLASSIFYING ALL OF THEM —
`INSUFFICIENT-EVIDENCE-TO-CLASSIFY` IS AN HONEST DISPOSITION.
```

**Proof 1 — consensus is not evidence.** 44 engine-shaped REJECT records
accumulated 2026-06-01 → 2026-07-22 under an over-broad council-carried
interpretation (`engine-reclassification-2026-07.md` header); the first engine
actually built and measured returned an honest null — recall 0.365 vs
disciplined grep 0.797, pre-registered and hash-bound (`docs/CLAIMS.md`
`code-graph-retrieval-null`). Measurement disposed of the feature; council
agreement had carried the rejects. **Hypothesis → experiment → measurement →
decision**, not agent → council → convergence → law. Round 5 sharpened what
this proves: the failure was *correlated agreement*, so a council cannot serve
as the independent validator of a grade either.

**Proof 2 — classify-on-desk produces approximately nothing.** Verified at
`492873f09`: `reopen_policy` exists in exactly **1 of 177** flat ADRs and
**0 of 7** per-area records (`grep -rln '^reopen_policy:' docs/decisions/
docs/adrs/` → ADR-216 only); `protected_dimensions` likewise. The decisive
detail: the 2026-08-19 sweep *was* the classify-on-desk moment for twelve
records — and classified exactly one, noting in its own words that ADR-216
"is the first ADR to carry the new fields". Eleven of twelve left the desk
unclassified in the very change that created the mechanism.

**Proof 3 — prose lifecycle enforcement is satisfied by its weakest honest
reading.** The archived predecessor roadmap checked its step "Resolve ADR-001
specifically" as `[x]`
(`agents/roadmaps/archive/road-to-adr-revisit-governance.md:320`) — and the
checkbox is honest, because that step's own text operationalized "resolve" as
"give it a disposition in the sweep table", which happened. The sweep row it
produced states in its own words that "the follow-up ADR was never written",
and ADR-001 remains `accepted`, `superseded_by: —` today. A candidate row
without a dated follow-up is a parking spot. Enforcement must be mechanical
(3.4), never prose.

## Prerequisites

- `docs/contracts/adr-layout.md` — reopen authority, the reopen record,
  `reopen_policy`/`protected_dimensions`, and the `No bulk classification`
  clause at `:153`. This roadmap amends it; governance self-amendment is
  owner-reserved (its own row 6), which is what Phase 0A settles.
- `docs/decisions/adr-reopen-sweep-2026-08.md`,
  `docs/decisions/engine-reclassification-2026-07.md` — the two sweep
  precedents whose shape Phase 3 follows.
- ADR-237 — capability-before-role doctrine; Phase 4 applies its test to the
  corpus.
- Tooling touched: `src/scripts/check_adr_frontmatter.ts`,
  `src/scripts/adr_cite_check.ts`, `src/scripts/adr/regenerate_index.ts`,
  `src/scripts/audit_adr_coverage.ts`, `src/scripts/lint_provenance_vocabulary.ts`,
  `src/skills/adr-create/`, `src/skills/decision-record/`,
  `src/skills/decision-review/`, `src/rules/decision-revisit-gate.md`.
- **Three independent frontmatter parsers exist** and must not become four:
  `check_adr_frontmatter.ts:155`, `adr_cite_check.ts:182`,
  `adr/regenerate_index.ts:110` (the last regex-based, no fold support).
  Phase 2.0 extracts one shared reader first.
- **`adr_cite_check` has no CI gate** — no workflow invokes it; only a test
  imports it. Every "enforced at cite time" claim in this roadmap is therefore
  model-carried until 2.3 wires it, and is stated that way rather than
  implied.
- `agents/roadmaps/road-to-user-out-of-the-loop.md` — verified: it cites
  **zero** ADRs as blockers (its only ADR reference, ADR-115 at `:120`, is a
  factual note; its two `## Blockers

### blocker: owner-autonomy-batch

- **Status:** open
- **Owner:** user
- **Class:** 3 — human-only
- **Blocks:** Phase 0B (all three rows), Phase 4 step 4.2 (blocker-lane rows 1, 2, 6)
- **Question:** Three Hard-Floor rulings the source instruction did not
  authorize. (a) Does any explicit, this-turn, single-deliverable delegation
  pre-clear commit/push for that run, or does `commit-policy.md:37`'s one-shot
  fence stand? (b) May an end-to-end delegation cover integration-branch
  merges of judge-ranked candidates, with trunk excluded, or does ADR-005 § 1
  stand? (c) Is the ADR-211 sweep row stale (close it) or is a residual
  purpose question genuinely open (record it separately)?
- **Recommendation:** Take (c) first and close it as stale — Amendment E and
  ADR-216 both say the freeze is lifted, so the sweep row contradicts the tree
  and costs nothing to correct. Hold (a) and (b): both widen agent write
  authority, and this roadmap's own Phase 7 argues that authority changes
  belong behind measurement rather than alongside a schema change.
- **If you do nothing:** Phases 1–3, 5 and 6 run in full and blocker-lane rows
  3, 4, 5, 7–13 all dispose normally. Rows 1, 2 and 6 stay `[~]`, so three of
  thirteen lane rows and AC-4's owner-gate clause remain open. Nothing else
  stalls.
- **What to do:** Answer (a), (b), (c) in one sitting. Each `yes` executes its
  lane row with the carve-out inheriting ADR-237's excluded list verbatim
  (trunk, deploy, prod data, irreversible external); each `no` lands a
  RE-AFFIRMED row whose blocking cost is recorded as sourced observations per
  Phase 3's `blocking_cost` shape.
- **Resolved when:** all three rulings are recorded in the sweep artifact and
  blocker-lane rows 1, 2 and 6 each carry a landed outcome.

### blocker: authority-coupling-decision

- **Status:** open
- **Owner:** user
- **Class:** 3 — human-only
- **Blocks:** Phase 7 (both steps)
- **Question:** May an independently validated evidence grade reduce the
  authorization burden for a reopen — and if so, under which pre-registered
  accuracy threshold, with which rollback unit?
- **Recommendation:** Do not decide it now. Let Phase 6 run in shadow mode
  first: the question is only answerable once `grade-accuracy-vs-gold`,
  `evidence-discovery-recall` and `beneficiary-linked-grade-bias` have
  numbers, and a suspension drill has passed. A published null is an
  acceptable answer.
- **If you do nothing:** Everything in Phases 0A–6 still lands. The estate
  gains provenance, evidence grades, substantive review triggers, a full
  184-record challenge disposition and cite-time surfacing — all of it
  descriptive. What stays absent is any autonomous reopen path derived from a
  grade, which is exactly the state the council ruled the safe default.
- **What to do:** Read the Phase 6 measurements when they land, then rule
  once: enabled default-off with a named re-enabler and a chosen rollback
  unit, or not enabled with the null published.
- **Resolved when:** an owner ruling is recorded either way, and — if enabled
  — the rollback unit is one of the four named options and the suspension
  drill has passed before the first grade-derived action.
