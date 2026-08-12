---
adr: 225
status: accepted
date: 2026-08-12
decision: cross-corpus-proposal-verification
supersedes: —
superseded_by: —
phase: road-to-cross-corpus-verification
type: structural
review_trigger: >-
  Each rejected axis carries its own reopening condition and none of them
  expires on the calendar. The code-graph axis reopens on new retrieval
  evidence that moves the measured recall gap, never on a new plan over the
  same measurement. The attestation axis reopens on ADR-220's own named
  trigger. The chain-contract axis reopens when
  road-to-frontend-skill-application closes and leaves residue. The router
  axis reopens if a measurement shows the auto-tier corpus reaching the model
  eagerly on a host that the frontmatter says it should not — which would make
  the falsified premise true after the fact and is the one observation that
  would change this record's answer. The parked skill-size ceiling reopens on
  a number: p95 SKILL.md word count above 3,000, or more than ten skills above
  2,500.
---

# ADR-225 — A cross-corpus proposal is adopted at the size its measurements survive

## Status

**Accepted** · 2026-08-12. Records what a claim-by-claim verification of an
external comparison artifact found, which three defects it earned, and which
four axes it did not — with the specific lock each rejection runs into, so a
later proposal has to clear that lock rather than re-assert the claim.

## Context

An external comparison artifact was dropped into the maintainer inbox
proposing seven "confirmed defects" (D1–D7) and a seven-phase roadmap, drawing
on six external comparator corpora, pinned against `97e2937`. Its method
statement is sound and is the reason it was worth verifying: every phase
claims to start from *"a confirmed agent-config defect verified against the
live tree"*, with a `file:line` per claim.

Every claim was re-derived against `origin/main` @ `26c575f66` — three
independent read-only passes plus direct spot checks, with each number
recomputed rather than read from the artifact. Four of the seven verifications
did not survive being repeated.

The comparator corpora are referred to without names throughout, per
[`source-confidentiality`](../../src/rules/source-confidentiality.md); the
artifact's pinned-commit table is deliberately not carried into the tracked
tree.

## Decision

### The measurement table

| Claim | Claimed | Measured | Verdict |
|---|---|---|---|
| D1 rule corpus | 115 files, ~54,650 words, **all always-active** | 115 files, **57,291** words; **9 `always` (3,842 w) / 101 `auto` (52,745 w) / 5 `manual`** | **falsified** — 93 % of the corpus is routed, not always-on |
| D1 hook consumers | 53 concerns, none reads `dist/router.json` | **38** concerns; 0 router hits across all 38 declared script paths | count wrong, absence real — and it is the design (`docs/adrs/router/0001-three-tier-routing.md:25` makes the agent the reader) |
| D1 residue (unclaimed) | — | `src/agent-src/templates/AGENTS.md:17` says all rules are always active; **line 29 of the same file** says kernel-only + routed | **adopted** — a consumer-facing file contradicting itself |
| D2 learning loop | none exists | `hook_manifest.yaml:209` wires `memory-learn` on `session_end`, 6 platforms; `learning_sidecar.ts:11-18` implements decay + 2-origin corroboration + contested-by-recency | **dead** — exists, default-OFF by council mandate (`learning_sidecar.ts:20-22`) |
| D3 engine facts | capable, default-OFF, php/ts/js only, no post-commit refresh | all confirmed; one wrong anchor (nudge is at `hook_manifest.yaml:176-180`, not `159-162`) | facts true |
| D3 proposed cure | add always-on pointer, refresh concern, flip default after 30 days | `docs/CLAIMS.md:380` — backed honest null, recall **0.365 vs grep 0.797**, −43.2 pp against a pre-declared +10 pp threshold | **rejected** — the null's bound consequence is "stays false permanently" |
| D4 skill estate | 289 skills, 6 `references/`, mean 1,146 w, max 6,889 w | 289, 6; mean **1,187**, max **7,094**; only **6 skills > 2,500 w**, **4 > 3,000 w** | headline true, numbers stale |
| D4 residue (unclaimed) | — | two spellings — `references/` (6) and `reference/` (3); nothing lints either; `skill-writing/SKILL.md` never mentions the layout | **adopted** — unauthored convention, not drift |
| D5 attestation | nothing attests a fix's load-bearing line | true (`check_claims.ts` `SURFACE_ROOTS = ['README.md','docs']`) | **rejected as work** — already specified in `later/road-to-skill-ecosystem-runtime-enforcement.md:136`; `ADR-220` defers the check on purpose |
| D6 chain contracts | `fe-design` is "reference, not executor"; no skill declares hard gates | that line was **deleted by PR #1289**; 7 skills already declare hard gates | **rejected as work** — remainder owned by an active roadmap (24 done / 9 open) |
| D7 pack installability | no per-pack install path; deferred to `road-to-org-packs` | true in the narrow sense; **`road-to-org-packs` does not exist** in any roadmap directory | **rejected as work** — the live artefact is a maintainer blocker brief |

### What is adopted

Three defects, all of which the verification found rather than the proposal
named:

1. **The template self-contradiction.** `AGENTS.md:17` versus `:29`, repaired
   to match the measured frontmatter split.
2. **The unauthored disclosure layout.** `references/` is specified as the
   canonical directory in `skill-writing`, and the three `reference/` skills
   converge onto it in the same change — documenting a canon while the tree
   disagrees with it manufactures the drift the documentation exists to
   prevent.
3. **This record**, so the falsified numbers cannot be re-argued.

### What is parked, with a number

A word or token ceiling for the 285 skills that carry no `token_budget_class`.
Three size gates already exist —
[`lint_token_budget_discipline.ts`](../../src/scripts/lint_token_budget_discipline.ts)
enforces a hard 3,500-**token** ceiling on the 4 skills that declare
`rich`, `skill_linter.ts:1643` warns at 400 **lines**, `check_pack_size.ts`
caps **bytes** per skill — and a fourth gate would fire on **4–6 files** on the
day it ships. Measured distribution, so a future check is one command rather
than a fresh census: n=289, mean 1,187, median 1,077, p90 1,867, p95 2,294,
p99 3,851, max 7,094.

**Reopen when** p95 crosses 3,000 words, or when more than ten skills exceed
2,500. Not before: a gate whose finding set is six files trains its readers to
skip it, which is the failure it would exist to prevent.

### What is rejected, and the lock each rejection runs into

- **The router phase** (D1) — its stated lever, an ~80 % cut to an always-on
  payload, measures a payload that is 93 % routed. **Reopens** on a
  measurement showing the auto-tier corpus reaching the model eagerly on some
  host, which would make the premise true after the fact.
- **The code-graph phase** (D3) — contradicts a **backed** honest null whose
  consequence is explicitly bound, with no new evidence offered. **Reopens**
  on new retrieval evidence, never on a new plan over the same measurement.
- **The instinct loop** (D2) — the loop exists; its default-OFF, human-gated
  promotion is a recorded council mandate, not an oversight. **Reopens** by
  revisiting that mandate on its own terms.
- **The fix-witness layer** (D5) — duplicates a specified mechanism and an
  accepted deferral. **Reopens** on ADR-220's named trigger.

## Consequences

- A proposal of this class is now cheap to answer: the table above says which
  of its numbers to re-derive first, and the four locks say what evidence a
  successor would have to bring.
- The three adopted repairs are small and land together; none of them is what
  the proposal asked for, and all three were invisible until its claims were
  checked. That asymmetry is the finding worth keeping — the artifact's value
  was as a **prompt to measure**, not as a plan.
- Nothing here forecloses the rejected axes. Each names its reopening
  condition, and two of them (retrieval evidence, the ADR-220 trigger) are
  conditions a future run could genuinely meet.
- The verification cost three read-only passes and one council pass ($0.061)
  and avoided committing to a seven-phase roadmap whose ordering rationale
  rested on a falsified measurement.

## Alternatives considered

- **Adopt the proposal as written.** Rejected: its own ordering rationale
  names D1 as "the largest measured token lever", and D1's measurement is
  wrong by construction — 3,842 always-active words, not 54,650.
- **Adopt the small phases and defer the large ones.** Rejected as a framing:
  it reads as sequencing when the actual finding is that four axes are locked
  by prior decisions. Deferring them would hide the locks rather than record
  them.
- **Reject the artifact without a record.** Rejected: the next proposal from
  the same source class would re-assert the same claims, and the verification
  would be paid for twice.
- **Ship the skill-size ceiling anyway, advisory.** Rejected: this package has
  repeatedly recorded that a gate measured before it is built either fires on
  a real population or is recorded as a decision instead. Six files is the
  second case.

## References

- [`road-to-cross-corpus-verification`](../../agents/roadmaps/archive/road-to-cross-corpus-verification.md) — the executing roadmap.
- [`docs/CLAIMS.md`](../CLAIMS.md) § `code-graph-retrieval-null` — the backed null the D3 axis runs into.
- [`ADR-220`](ADR-220-skill-invocation-attestation.md) — the accepted deferral the D5 axis runs into.
- [`docs/adrs/router/0001-three-tier-routing.md`](../adrs/router/0001-three-tier-routing.md) — the tier design that makes the agent, not a hook, the router's reader.
- [`source-confidentiality`](../../src/rules/source-confidentiality.md) — why the comparator corpora are unnamed here.
