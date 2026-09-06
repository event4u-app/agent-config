---
complexity: structural
status: carrier
parent_roadmap: road-to-the-activation-census-consequence
---

# Road to the skill-surface framing choice

> **Receiver, and a decision packet.** This file exists so the one `[~]` item
> deferred out of `road-to-the-activation-census-consequence` (step 3.1) has a
> live destination `deferralProblems`
> (`src/agent-src/scripts/archive_completed_roadmaps.ts`) can verify from both
> ends, and so the choice that item was written to surface is stated somewhere a
> reader meets it. `status: carrier` keeps it off the dashboard and out of the
> active estate count until a human flips it to `ready`.
>
> **Nothing here is scheduled work.** The parent roadmap built neither option
> and this file builds neither. Its content is the packet: two options, the
> count each affects, and what would falsify the one chosen.
>
> **The decision is owner-reserved.** It changes what the package claims to be
> for its consumers, which is a public commitment under
> `decision-revisit-gate`'s reserved set. An AI council dispositioned the
> parent's blocker on 2026-09-06 and its verdict was unanimous DESCOPE — the
> parent closes without the choice, the choice does not close. That verdict is
> about roadmap scope only; it settles nothing about the surface.

## The measurement this decision sits on

Three counts, from `agents/evidence/metrics/skill-activation-census.json` and
reproduced in `agents/evidence/analysis/skill-activation-populations-2026-09-06.md`:

| Population | Count |
|---|---|
| Skills shipped | 299 |
| Declare a machine-matchable trigger key in frontmatter | 12 |
| Carry an `evals/triggers.json` corpus (a test fixture; no host reads it at routing time) | 100 |
| In both of the two above | 2 |
| Reachable only by a human naming them | 189 |

Over 30 sessions and 11,338 assistant turns the census records 0 Skill
invocations and 0 of 299 distinct skills. The reading is one machine's store
and bounds nothing beyond it.

## The options

### Option A — build a host-side activation path for the 12

Commit to a selection mechanism for the skills that declare a machine-matchable
trigger key, name the host it is built against, and measure it.

- **Affects:** 12 skills (2 of them also in the 100).
- **Costs, in surfaces rather than in time:** a host integration this repository
  does not own; a measurement that can distinguish a fired selection from a
  human naming the same skill; and a second census reading over a store taken
  after the mechanism exists.
- **Falsifies the option:** the mechanism ships and a census over a comparable
  store still records 0 invocations of those 12 — which would move the cause
  somewhere the trigger key is not.

### Option B — reframe the remainder as human-named reference material

Declare the 189 reference material by design, and bring `docs/CLAIMS.md` and the
consumer-facing surfaces into line with that.

- **Affects:** 189 skills.
- **Costs, in surfaces rather than in time:** the claims ledger; the four
  surfaces that described skills as topic-matched, already corrected by the
  parent roadmap's 2.3; and any consumer-facing prose that a reader could take
  as a selection promise.
- **Falsifies the option:** a host is shown selecting one of the 189 without a
  human naming it, which would make "reference material by design" a false
  description of what the package ships.

### Option C — record a reason beside the claim

The parent's blocker offers a third: leave the surface as it is and record the
reason next to the census claim in `docs/proof.md`, so the next review round
meets an answer rather than re-deriving the argument. This is a decision about
what to publish, not a decision that anything about the surface is settled.

- **Affects:** the published claim; the 299 are untouched.
- **Falsifies the option:** the recorded reason stops holding — for instance if
  the store the census reads stops being the only one available.

## Phase 1 — the owner chooses

- [ ] **1.1 Record the choice.** One of A, B or C, written into `docs/decisions/`
      or beside the claim in `docs/proof.md`.
      verify: `./scripts-run src/scripts/check_claims` passes against the resulting
      text, and `adr_cite_check` on any ADR the choice produces reports a live status.

## Acceptance Criteria

- [ ] AC-1 — One of the three options is recorded, with the count it affects and its falsifier.
- [ ] AC-2 — `./scripts-run src/scripts/check_claims` passes against the resulting text.
