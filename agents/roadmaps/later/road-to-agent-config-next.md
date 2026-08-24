---
complexity: lightweight
status: draft
execution:
  mode: phase-checkpoints
---
# Road to agent config next — the architecture-tournament program, parked

> **Source:** agents/tmp.old/feedback-14.8.0 — a dropped inbox bundle carrying a
> 9,654-line reviewer corpus (ten independent sessions), its own triage
> write-up, and two revisions of this proposal. The triage lives at
> `agents/evidence/analysis/feedback-14-8-0-triage.md`.

> **Parked 2026-08-22. Resume when** BOTH conditions hold, measured and written
> down, not asserted: (a) the standing-payload delta ledger has **≥ 4 weeks of
> measured entries** — the instrument `agents/roadmaps/archive/road-to-standing-payload-diet.md`
> Phase 0 builds (steps 0.3–0.5, the two-sided debit/credit per-PR delta); and
> (b) subagent response-envelope adoption is **≥ 95 % over ≥ 500 stops**, which
> is the terminal state of the roadmap `road-to-subagent-envelope-adoption`
> (authored in the same inbox drain as this file — reference it by slug, it is
> not this roadmap's to name a path for).
>
> **Re-measured 2026-08-24 by `/analyze:inbox`. BOTH LEGS STILL UNMET — the
> condition is unchanged, only its figures moved, and one of them moved the wrong
> way.**
>
> The 14.11.0 feedback bundle re-arrived carrying this same program rebased on
> `0f7c26ee9` — ten design-frame files, one per track. Nothing was landed from it,
> because:
>
> - **Leg (a):** the instrument landed. `road-to-standing-payload-diet` is
>   archived at 18 done / 0 open and `check_standing_payload_delta.ts` ships with
>   `partitionCredit()` booking the ADR-236 credit side. But the leg asks for
>   **four weeks of entries**, and the floor derived below (2026-09-20) still
>   stands — a landed instrument holds zero weeks of history on the day it lands.
> - **Leg (b):** measured **0.00 %, 0 valid envelopes of 4,274 stops**. The
>   denominator is met eight times over; the rate is in the DROP band of the very
>   roadmap that owns it. Against a ≥ 95 % condition this is not "not yet", it is
>   pointing the other way.
>
> Recorded here rather than only in the triage, because a parked file whose resume
> figures are a day stale is how a re-arrival gets read as new. Triage:
> `agents/evidence/analysis/feedback-14-11-0-triage.md`.
>
> **Third arrival, same day, 2026-08-24.** A further inbox bundle
> (`agents/tmp.old/atomic-claude-graph/`) proposed this program again as an
> 11-phase runtime roadmap — 2,354 lines, zero checkboxes, zero `verify:` lines
> — and cited this file nowhere. The sequence is now
> feedback-14.8.0 → feedback-14.11.0 → atomic-claude-graph. Nothing above
> changed: both legs were re-measured that day and leg (b) still points the
> wrong way. Logged so a fourth arrival is recognised as one, instead of costing
> another full re-derivation. Its two extractable items went to
> `road-to-decision-conformance` steps 0.4 and 3.0; its form and premise
> refutations are recorded in
> `road-to-contract-review-deadlines` § Dropped.
>
> **Per-leg decidability, added 2026-08-23 by `road-to-unowned-resume-conditions`.
> Both legs are OWNED. Neither is restated and neither is recorded permanent —
> the conditions below are the ones parked on 2026-08-22, unchanged.**
>
> **Leg (a) — owned, and the earliest possible date is derived, not estimated.**
> The ledger cannot hold its first entry until `road-to-standing-payload-diet`
> steps **0.3, 0.4 and 0.5** land — 0.3 emits the per-PR delta against the
> merge-base, 0.4 registers it in the gate ledger, 0.5 books the credit side so
> the ledger is two-sided. At 2026-08-23 that roadmap is **0 of 19 steps closed**
> and 0.3–0.5 are three of the nineteen, so the ledger holds **zero weeks**.
> Four weeks of entries therefore cannot complete before **2026-09-20** — and
> that date assumes all three steps land the same day this was written, which
> nothing suggests. It is a floor, not a forecast: the real date is four weeks
> after 0.5 lands, whenever that is. Owner: whoever carries the diet roadmap.
>
> **Leg (b) — owned, with the arrival channel named.** This leg was
> **unreachable** at 2026-08-22 and the park did not say so: its producer
> `road-to-subagent-envelope-adoption` was archived with Phase 2 and AC-3/AC-4 all
> `[-]`, its last published rate is **0.00 % — 0 `ok` of 1,296 stops**, and its
> own blocker recorded that ">= 500 stops … from a ledger that is not this
> machine's drain traffic" had **"no arrival channel for it today"** because the
> ledger is `agents/runtime/`, gitignored at `.gitignore:190`, with no workflow
> ingesting it.
>
> The channel is now named: **`agents/roadmaps/stubs/road-to-org-telemetry-sink.md`**,
> whose Phase 2 exit criterion is, verbatim, *"records written on a second machine
> appear in the sink."* That is precisely the input leg (b) is missing, and it is
> the only mechanism in this estate that produces it. That stub is itself gated on
> the `sink-choice` decision — deliberately owner-reserved, because a telemetry
> sink is a **standing egress** and configuring one is not an agent's call.
>
> So leg (b)'s chain is: `sink-choice` decided → the sink stands up → non-local
> stops accumulate → 500 of them carry a post-split `envelope_parse` value → the
> leg is measurable. **Owner: the maintainer, at `sink-choice`.** The condition
> itself is untouched: `>= 95 % over >= 500 stops` still means what it meant, and
> the outlet taken was *"name what would make the input arrive"* — not the
> restatement outlet, which `decision-revisit-gate`'s owner-reserved table routes
> to the owner and which no council or agent path may take.
>
> **What a reader can now tell, which was the goal:** (a) is owned and has a
> derived floor date; (b) is owned and has a named channel behind one named
> owner-reserved decision. Neither is unreachable and neither is silently
> permanent.
>
> Parked rather than adopted, and parked rather than skipped: the program is not
> wrong, it is early. Every one of its four sequenced items is either already
> owned elsewhere, already parked as prior art, or demand-gated with no confirmed
> defect starting it. Nothing here is refuted; the ordering is.

## Goal

When this roadmap is resumed, the reader can tell — from measurements that
already exist rather than from this document's own argument — whether the
architecture-tournament program is now the right next block of work. Until
then the goal is negative and it is the whole point of the park: **no new
architecture surface is opened on the strength of this proposal**, and the
reasoning for that is recorded once, here, so it is not re-derived from the
twelve-item version of the same idea.

## Context — the two-version lineage, verified

The bundle carries two revisions of one proposal, and they are not the same
document:

- **v1** proposes a 12-roadmap family (its § 2 enumerates all twelve), an
  architecture tournament across eleven tracks, and a Phase 0 that freezes
  architecture expansion while inventorying every accepted ADR that constrains
  runtime, state, daemon, networking, federation, learning, code intelligence,
  browser, plugin, storage or model dispatch — marking each `unchallenged`,
  `challenge-required`, or `historical-only`.
- **v2 is the live revision** and reduces v1 to **four sequenced items** plus a
  tournament held only *after* convergence, with a hard cap of three
  simultaneously active structural roadmaps from the family. Its opening
  paragraph states the reduction as its own purpose.

This roadmap is about **v2**, because v2 is what a resumer would pick up. v1 is
recorded only so a later reader does not re-import it (see § Reusable residue).

## Why this is parked — item by item

Verified overlap, in the order v2 sequences them:

1. **A cross-corpus parity residue review.** One scheduled review of a
   chain-contract residue, explicitly producing evidence plus one disposition
   and no new roadmap. This is the smallest item and the only one that is
   *due* by an existing lock — it does not need this roadmap to happen, and
   binding it to a twelve-track program is what makes it wait.
2. **A runtime-truth-and-reduction umbrella.** Duplicative: its phases each
   have a named destination already in this tree. The response-envelope leg is
   the roadmap `road-to-subagent-envelope-adoption`; the context-ledger leg is
   `agents/roadmaps/archive/road-to-standing-payload-diet.md` Phase 0. An umbrella whose
   every phase resolves elsewhere adds sequencing, not work.
3. **An external-host enforcement spike.** Demand-gated with **no confirmed
   defect** starting it. It is a capability probe: the tree carries host
   detection references for that host and no enforcement plugin, which is a
   gap in capability rather than an observed failure. Under this repository's
   own harvest form a probe with no confirmed defect behind it belongs behind a
   stub, not in a sprint core. The design is sound; the priority is not.
4. **A common-core extraction.** A framework consolidation whose prior art is
   already parked — **four records, all verified present**:
   `agents/roadmaps/stubs/road-to-central-policy.md`,
   `agents/roadmaps/later/road-to-policy-evaluation-core.md`,
   `agents/roadmaps/later/road-to-surface-consolidation.md`, and
   `agents/roadmaps/later/road-to-carrier-layer-convergence.md`. Re-opening the
   axis from a fifth entry point, while four earlier ones sit parked, is how an
   axis accumulates records instead of a decision.

### The decisive reason, stated plainly

Two facts, not an argument:

- **Estate.** v1's family is twelve active roadmaps. The registered ratchet
  baseline in `src/config/estate-count-budget.json` is `active_roadmaps: 3` —
  low single digits. Adopting the program as written would multiply the active
  estate by roughly five against a gate that only ever walks down. v2's
  three-at-a-time cap mitigates this and does not remove it: the family is
  still declared, and the cap is a promise inside the same document.
- **Its own Phase 0 is already being built.** v1 Phase 0 asks to record
  standing context, install size, setup time, completion rate, provider/tool
  calls, model tokens and representative task quality. That is a context ledger
  under another name, and
  `agents/roadmaps/archive/road-to-standing-payload-diet.md` Phase 0 builds the
  measuring half of it now (0.3 emits a per-PR standing-payload delta against
  the merge-base; 0.5 books the credit side so the ledger is two-sided). The
  tournament cannot start before that ledger exists. The ledger is useful
  without the tournament. So the ledger goes first, and this file waits on it —
  which is exactly what the resume condition says.

## Owner-reserved — this proposal amends governance

Naming it as such rather than letting a resumer discover it: v1 Phase 0 marks
accepted identity ADRs `challenge-required`, and v2 opens its invariants with
"no sacred ADR". **Making standing identity ADRs challengeable is governance
self-amendment** — reopening authority over the records that set authority.
That is owner-reserved under `src/rules/decision-revisit-gate.md`; it is not a
council-decidable transition and it is not an agent-decidable one. No part of
the resume gate below grants it. A resumer who clears both measured conditions
has cleared the *sequencing* objection only; the governance clause still needs
the owner, separately and explicitly.

## Reusable residue — two sections, and only two

If this file is ever mined rather than resumed, take **the program-invariants
section** and **the decision-loop section**, and nothing else. The invariants
(null is a result; every default reversible until its migration gate passes;
existing unproven core contracts outrank host-surface expansion; architecture
work may end in KEEP / MERGE / INTEGRATE / PARK / REJECT) are good policy
independent of whether a tournament ever runs. The decision loop is a reusable
shape for any capability track.

Everything else — the twelve-roadmap family, the eleven tracks, the per-track
provider candidates drawn from external references (names withheld per
`src/rules/source-confidentiality.md`) — is the part that fails the estate test
above. Stated explicitly so a later reader does not re-import the twelve-item
version and rediscover this park from scratch.

## Phase 1 — the resume gate

Nothing in this phase opens architecture work. Each step tests one leg of the
resume condition; all three must pass before the program is reconsidered, and
clearing them still leaves the owner-reserved clause open.

- [ ] **1.1 Confirm the standing-payload delta ledger carries ≥ 4 weeks of
      measured entries.** Not "the ledger exists" — dated readings, at least
      four weekly ones, with both a debit and a credit column populated at
      least once. If the ledger shipped but never accumulated entries, that is
      the finding, and the answer is to fix the ledger, not to resume here.
      verify: the pre-state is that no workflow computes a merge-base delta — `grep -rln 'merge-base\|merge_base' .github/workflows/` returns nothing and exits 1 today; at resume time the ledger artefact named by `agents/roadmaps/archive/road-to-standing-payload-diet.md` Phase 0 lists ≥ 4 dated entries.
- [ ] **1.2 Confirm response-envelope adoption is ≥ 95 % over ≥ 500 stops.**
      The pinned reading is the opposite: 0.00 % adoption (0 `ok` of 1,296
      stops), with delivery at 100 % and parse failure 0.39 %. A successor
      reading with a denominator of at least 500 stops must show ≥ 95 % `ok`.
      verify: `grep -n '0.00 %' agents/evidence/investigations/subagent-envelope-return-baseline.md` returns line 55 as the pre-state, and a successor reading in the same directory records `ok`/stops ≥ 0.95 on ≥ 500 stops.
- [ ] **1.3 Re-screen all four sequenced items against the tree before
      resuming, and write the screen down.** Each item is re-checked for a
      named destination elsewhere and for a confirmed defect behind it. An item
      that still resolves elsewhere is struck from the program rather than
      carried; an item whose defect is still unconfirmed stays demand-gated.
      verify: a dated screen exists under `agents/evidence/analysis/` naming, per item, either its destination roadmap or the confirmed defect that starts it — and the four prior-art records above are re-checked for their current disposition.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-22 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The park becomes a burial | product | `later/` is excluded from `/roadmap:process-*`, so a parked file can sit unread until its resume condition is stale and nobody notices it fired | The resume condition is two measurable readings owned by roadmaps that are active now, not a date — when either lands, this file is the named consumer of that measurement | Phase 1 — the resume gate |
| 2 | A resumer reads the twelve-item version as the plan | implementation | v1 and v2 are both in the source bundle; the reduction from twelve roadmaps to four sequenced items is the whole content of v2, and a resumer starting from v1 re-imports the estate problem | § Reusable residue names the two salvageable sections and explicitly excludes the family and the tracks | Context — the two-version lineage, verified |
| 3 | The governance clause is cleared by the measured gate | product | Both resume readings are mechanical; the ADR-challengeability clause is not, and a resumer who clears 1.1 and 1.2 may read the gate as fully open | § Owner-reserved states the clause is untouched by the gate, and step 1.3 re-screens the program rather than starting it | Owner-reserved — this proposal amends governance |

## Acceptance Criteria

- [ ] AC-1 — The resume condition is stated as two measurable readings with
      named owners, so a later reader can check whether it has fired without
      re-reading the source bundle.
- [ ] AC-2 — Each of the four sequenced items carries, in this file, either the
      destination that already owns it or the reason it is demand-gated; the
      four prior-art records for the consolidation item are cited by path and
      verified present.
- [ ] AC-3 — The governance self-amendment is labelled owner-reserved in its own
      section, and the resume gate does not claim to clear it.
- [ ] AC-4 — The reusable residue is scoped to two named sections, so the
      twelve-roadmap version cannot be re-imported by a reader who only has
      this file.
