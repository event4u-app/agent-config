---
complexity: lightweight
review_by: 2026-12-24
---

# Stub: road to council blind ratings (Ü2 / Ü3)

> **Stub — not active work.** Transferred out of
> `road-to-council-blind-review.md` Phase 2 and Phase 3 on 2026-08-20 by the
> drain-run disposition framework
> [`drain-blocker-dispositions-b.md`](../../evidence/council/drain-blocker-dispositions-b.md)
> (blocker `maintainer-blind-ratings`, disposition **B** — outcome
> `transferred`). Adopted rationale, verbatim from that record: *"Blind human
> judgments cannot be substituted with an architectural choice or inferred from
> existing nulls."*
>
> **Ü1 is NOT in this stub.** Blind synthesis was decided, adopted and merged:
> `blind_chairman` defaults to `true` (`src/scripts/council_cli.ts:3561`),
> `--no-blind-chairman` is the per-invocation opt-out (`:3630`), the audit
> artifact always carries the post-verdict de-anonymization map, and the
> behaviour is anchored in `docs/contracts/ai-council-config.md:804-820` and
> pinned by `tests/scripts/ai_council_blind_review.test.ts` (26/26 green,
> re-verified 2026-08-20). Nothing in Ü1 waits on anything.
>
> Nothing here is half-shipped and nothing was rejected on merit. The
> **machinery** for Ü2 and Ü3 is complete and flag-gated
> (`src/scripts/ai_council/blind_review.ts` — `assign_stances`,
> `STANCE_DEFS`, `OUTSIDER_STANCE_NAME`, `with_chairman_fields`; CLI
> `--stances` / `--chairman-fields` at `council_cli.ts:3631-3632`). What is
> missing is a human judgement that no agent may produce.

## Transferred work — quoted as it stood

Phase 2, the pre-registered decision rules step, verbatim at the transfer
commit — **the Ü2 and Ü3 rules only**; the Ü1 rule in the same step is
already satisfied (0/10 + 0/10, adopted):

> - **Ü3** is adopted only if the maintainer — blind to arms — rates the
>   `collective_blind_spot` field as *decision-influencing* (not merely
>   non-trivial text; boilerplate like "insufficient testing discussion"
>   does not count) in ≥2 of 3 sampled runs.
> - **Ü2** — the experimental part — is adopted ONLY if the maintainer
>   blind-prefers the stance-arm's verdict or reasoning in the MAJORITY of
>   re-runs where the arms differ substantively (council: the original
>   "at least one of many" rule was a p-hacking shape); otherwise honest
>   null and Ü2 is dropped entirely (outsider seat included).

Phase 3, the merge step, verbatim — again **the Ü2/Ü3 half only**, since the
Ü1 half is merged:

> - Merge accepted adoptions into the deliberation protocol; anchor the
>   de-anonymization step (Ü1) in the council audit log; document rejected
>   parts as honest nulls in this roadmap at archive time.

The dependent work that moves with it, enumerated rather than implied:

1. **R1** — the Ü2 reading: majority blind preference across the 9
   substantively-differing pairs (`results-2026-07-28.md`: arms differ in
   9/10).
2. **R2** — the Ü3 reading: `collective_blind_spot` decision-influencing in
   ≥2 of 3 sampled runs.
3. **Ü2 merge-or-null** — flip `--stances` on by default (with the outsider
   seat) *or* drop Ü2 entirely, outsider seat included, and record the honest
   null.
4. **Ü3 merge-or-null** — make the two chairman fields mandatory *or* record
   the honest null.
5. The roadmap's Phase-3 acceptance line "document rejected parts as honest
   nulls … at archive time" for whichever of Ü2 / Ü3 lands null.

## Resolved-when criterion, verbatim

From the `maintainer-blind-ratings` blocker entry, unchanged — and matching
the council record's quotation of it word for word:

> **Resolved when:** both readings exist, and each of Ü2 / Ü3 carries an
> adopt-or-honest-null verdict rather than a deferral.

An **honest null is a full outcome here**, not a failure: "the preference was
not majority" closes Ü2 exactly as cleanly as adoption does. A deferral is the
only answer the criterion refuses.

## Probe and re-entry producer

Promotion is not "when someone gets round to it". One named producer, two
probes, both measured failing today.

| # | Precondition | Producer — who or what makes it true | Detection probe | Measured 2026-08-20 |
|---|---|---|---|---|
| P1 | R1 exists — the Ü2 preference reading | A **named maintainer blind rater** working `internal/bench/council-blind-review/blind-rating-packet.md`, arms concealed. No command in this repository can synthesise it. | The 10 `**R1 preference (1/2/tie):**` slots carry values instead of `____`, and a dated record names the rater **and states the reading's blind status** (blind on an R1-recut packet, or explicitly labelled non-blind — blocker 4) | **FAIL** — 10 of 10 slots read `____`; `grep -rl 'R1 preference'` over the tree returns the packet and nothing else, so no separate record exists either |
| P2 | R2 exists — the Ü3 field reading | Same named rater, same sitting | ≥3 sampled runs carry a `yes`/`no` in the `**R2 blind-spot decision-influencing…**` slot, with the boilerplate exclusion applied | **FAIL** — same 10 unfilled slots; no R2 values anywhere |

**Ordering probe, from the council record:** timestamped R1 and R2 records
exist **before** arm disclosure, and each carries an adopt-or-null verdict.
The arm key is `internal/bench/council-blind-review/rating-key.md`; it is
committed and readable, so "before disclosure" is a claim about the rater's own
sequence and has to be recorded by the rater, not inferred afterwards from the
tree.

## Why no agent may close this — and the tree-level reason it is not close

The pre-registration names the **maintainer** as the rater. Substituting an AI
rater would break the pre-registration and would itself be the self-preference
bias this roadmap exists to measure — the one substitution that invalidates the
result it produces (E1: Panickssery/Bowman/Feng, NeurIPS 2024, arXiv:2404.13076
— self-preference strength correlates with self-recognition ability; E2: Koo et
al. 2024 — real names vs anonymous aliases measurably change evaluations).

Two mechanisms make an agent rating unsound here, and the second one is
specific to this repository rather than general:

1. **Provenance is knowable from the packet text alone — measured 10/10.**
   Only arm b carries `## Collective blind spot` and `## One-line verdict`
   sections, because those *are* Ü3's mandatory fields. Ten of the twenty
   syntheses carry them, and mapping which synthesis holds them per question
   reproduces `rating-key.md`'s arm-b assignment in **10 of 10** questions with
   no mismatch. So the treatment arm is recoverable without opening the key,
   and an agent "blind" rating is not blind for R1 at all. This is also a
   defect in the packet itself, not only an agent problem — see blocker 4.
2. **The key is in the tree.** `rating-key.md` is committed next to the packet.
   Any agent with repository read access can disclose the arms in one command,
   so the ordering probe above ("before arm disclosure") is unfalsifiable for an
   agent and only meaningful for a human who states their own sequence.

A **council pass is not a substitute either**, and the availability of paid
council spend in this repository does not change that: the criterion asks for a
*maintainer* rating with arms concealed, and a council seat is neither the
maintainer nor blind to what it is being asked. If a council pass has value
here it is for a different question — not for producing R1 or R2.

The corollary is the useful diagnostic: **an agent finding itself able to
produce these ratings has found a broken instrument, not a cleared blocker.**

## Blockers carried across in full

**1. Ü2 and Ü3 stay undecided, and the roadmap cannot terminate in either
direction on them.** Phase 3's merge-or-null cannot be written for Ü2/Ü3 at
all. Ü1's shipped behaviour is unaffected — which is what made this the
cheapest kind of blocker to leave open and the easiest to forget for weeks
(surfaced 2026-08-14; the standing lesson is
`agents/settings/contexts/buried-roadmap-blockers.md`).

**2. The Ü2 rating reads a bundled arm.** Arm b bundles blinding + stances +
fields **and** a fresh synthesizer sample, with no same-arm repeat baseline, so
part of the 9/10 verdict drift is plausibly sampling variance
(`results-2026-07-28.md` § Honest limitations). Ü1's adoption does not rest on
drift — its criteria are degradation-shaped — but a Ü2 preference reading does
read a bundled treatment, and the rater should know that before rating.

**3. The sample is one person, n=10, single day, `run`-path only.** Recorded as
such in the results file and never to be inflated into a significance claim.
This is a property of the pre-registration, not a defect to fix before rating.

**4. The packet as prepared cannot deliver a blind R1 — new finding,
2026-08-20, and it applies to the human rater too.** Ü3's mandatory sections
are themselves the arm label: the fields-bearing synthesis is arm b in **10 of
10** questions, verified by mapping `## Collective blind spot` occurrences per
question against `rating-key.md`. A rater who notices that pattern once knows
the arm for every remaining pair, and the knowledge is not un-learnable. So R1
as currently packaged measures a preference between an identified pair, which
is the naming effect E2 describes rather than a blind preference.

Two ways out, and the choice belongs to the rater, not to an agent:

- **Re-cut the packet for R1** — strip the `## Collective blind spot` and
  `## One-line verdict` sections from the arm-b syntheses in an R1-only copy,
  rate preference on the remainder, and keep the intact packet for R2 (where
  the section's presence is the object of the rating and disclosure is
  harmless). This preserves the pre-registration; it re-cuts the presentation,
  not the rule.
- **Rate R1 anyway and record the compromise** — an honest, explicitly
  non-blind preference reading, labelled as such. Admissible only if labelled;
  a compromised reading recorded as blind would be the fabricated-evidence
  failure this whole roadmap exists to prevent.

R2 is unaffected either way: it asks whether the field is decision-influencing,
so knowing that the field-bearing arm is arm b tells the rater nothing they
were being blinded from.

## Seed content on promotion

- The two readings first, recorded with their date and the rater's name, in a
  dated artefact under `agents/evidence/` (the packet itself is a worksheet,
  not the record).
- Then the two merge-or-null decisions, each written as adopt **or** honest
  null with its rule outcome quoted — never as a deferral.
- If Ü2 lands null: drop it entirely, **outsider seat included**, and remove
  the `--stances` flag path rather than leaving a default-off mechanism nothing
  decided (the roadmap's own rule: "otherwise honest null and Ü2 is dropped
  entirely").
- If Ü3 lands null: keep `--chairman-fields` default-off or remove it on the
  same reasoning, and record the null against the 10/10 evaluator
  present+specific finding — which is a *text-quality* observation and
  deliberately not the rule.

## What does NOT apply to this stub

The **Promotion criteria (shared)** in [`README.md`](README.md) — recruited
customer, funded security audit, maintainer ADR lifting a Hard-Floor item —
govern the six org-mode stubs created by Phase 9 of the archived
employee-product roadmap. They do **not** govern this one: this is a drain-run
transfer of an internal deliberation-protocol decision that crosses no Hard
Floor, introduces no org surface, and needs no customer. Its gates are P1-P2
above and nothing else.
