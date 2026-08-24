---
complexity: structural
status: ready
owner: maintainer
review_by: 2026-11-24
execution:
  mode: phase-checkpoints
estate_offset_exempt: "Landed by the /analyze:inbox run of 2026-08-24 from feedback-14.11.0 sections 70, 71, 76 and 87. The one-in-one-out half fires on every added agents/roadmaps/road-to-*.md whatever its status, and this change archives nothing to offset against. Warranted on a measurement: the skill corpus grew +8 in one release against +1 across the preceding ten, and no gate in the tree objects to either number."
estate_growth_exempt: "Charges +1 active_roadmaps and +3 open_blockers. The three blockers are decisions this roadmap cannot take for the maintainer -- what a skill costs, whether a retirement is reversible, and whether the roadmap-estate budget file is the right home for a fourth metric. Filing them countable is the point: the defect this roadmap addresses is a corpus that grows with nothing objecting, and a roadmap about that which hides its own charges would be the same shape."
---
# Road to skill-estate drawdown — a capability must pay for its existence

> **Source:** `agents/tmp.old/feedback-14.11.0/chat.txt` §70, §71, §76, §87.

## Goal

The skill corpus has a measured size, a gate that objects when it grows, and a
durable record of every admission decision including the refusals. Finished means:
a skill-count metric exists on the same ratchet the roadmap estate already uses,
each of the reviewer's five retirement signals is either measurable with a named
instrument or recorded as unmeasurable, and a first retirement tranche has landed
with its evidence.

## Context — measured 2026-08-24, re-derived at each tag

**The corpus grew +8 in one release, against +1 across the preceding ten.**
Counted with `git ls-tree -r --name-only <tag> -- src/skills | grep -c 'SKILL.md$'`:

| Tag | skills |
|---|---|
| 14.0.0 | 290 |
| 14.9.0 | 291 |
| 14.10.0 | 291 |
| **14.11.0** | **299** |
| HEAD | 299 |

**No gate constrains that number.** `src/config/` holds 13 budget files and a
`grep -rlE '"?skill(_|-)?count' src/config/` returns nothing.
`estate-count-budget.json` gates `active_roadmaps`, `later_roadmaps` and
`open_blockers` — the roadmap estate, a different corpus.
`measure_skill_reduction.ts` measures per-user-type **filtering**, not retirement.
`archive/road-to-estate-drawdown.md` is the roadmap-estate campaign.

**The observation is not new, and its previous answer was a gate without a cap.**
`archive/road-to-capability-governance.md:46` records the same finding in the same
words — *"Reviewers: skill count keeps climbing; nothing forces 'should this be a
new'"* — and answered it at Phase 3.1 (`:49`, closed) with an authoring gate: a
new skill must state which family, which capability versus an existing one, why
not extend or merge, why not a guideline, and its visibility tier.

That gate is real and is not the problem. Its **storage** is:

> *"Record the answers in the PR body."*

`src/scripts/check_finding_dispositions.ts:11` rejects that exact surface for
findings, in its own words — a comment is *"mutable and unaudited; it is
transport, not a record"*. So the admission gate asks the right five questions and
keeps its answers where this repository has already ruled answers may not be kept.
There is consequently **no ledger of refusals**, which is why +8 skills can land
with no visible "no".

**Searched for a prior refusal and found none.** `grep -ilE 'skill.{0,12}retire|
retire.{0,12}skill|skill count|skill estate'` over `archive/`, `later/` and
`stubs/` returns six files; reading them, `road-to-capability-governance.md:46` is
the recurring *observation* and `road-to-governance-cleanup.md:64` is a one-off
2026-05-01 audit that captured the count as data. **A skill-count ratchet was
never proposed and never refused.** So this is a genuine gap behind a recurring
observation, not a reopen — [`recurring-criticism`](../../src/rules/recurring-criticism.md)
does not fire, and saying so is cheaper than leaving a reader to wonder.

## Phase 1 — measure before gating

- [ ] **1.1 Register the count and its definition.** Decide what counts as one
      skill (a `SKILL.md`, presumably) and record the definition beside the number
      so a later reader cannot re-derive a different total.
      verify: a committed figure plus the exact command that produced it, and
      re-running that command reproduces it.
- [ ] **1.2 Per retirement signal, name the instrument or record its absence.**
      The reviewer's five: never triggered · low relevance score · duplicate
      responsibility · dead cross-skill links · no unique outcome. Two have shipped
      instruments — `src/shared/skillRanking.ts` for relevance (consumed by
      `cli/mcp/dispatch.ts`, `cli/mcp/content.ts`, `hooks/skill_route_hook.ts`,
      `mcp_server/tools.ts`, `skill_tools/*`, but **not** by
      `compute_skill_tiers.ts` or the host-listing emitter) and `lint_handoffs.ts`
      for dead links. The other three need naming or an honest null.
      verify: a five-row table, each row carrying an instrument with a path or the
      word `none`, and no row left blank.
- [ ] **1.3 Rank the corpus once, on whatever 1.2 established.** A ranking is not
      a retirement decision; it is the input one needs.
      verify: a committed ranking whose row count equals 1.1's figure.

## Phase 2 — the ratchet, as a fourth metric on the existing budget

- [ ] **2.1 Add `skill_count` to `src/config/estate-count-budget.json` and
      `check_estate_count.ts`.** Reuse the shape, do not build a parallel gate:
      that gate already measures its floor on the **base ref's own tree** with the
      same functions it applies to HEAD (so the "before" side cannot be rewritten
      by the change under review), reads `estate_growth_exempt` from the **diff**
      so a claim cannot be banked, and runs a `one_in_one_out` lint.
      verify: `./scripts-run src/scripts/check_estate_count` prints a
      `skill_count` row with a floor, and a test proves the floor comes from the
      base ref rather than from the config.
- [ ] **2.2 Prove the gate fires.** Add a skill in a test fixture and watch the
      metric grow and the gate refuse; remove it and watch it pass.
      verify: red-then-green demonstrated by sabotage, not asserted.

## Phase 3 — a durable admission and refusal record

- [ ] **3.1 Move the Phase-3.1 answers out of the PR body into a committed
      ledger.** Follow the precedent the tree already set for findings rather than
      inventing a format: `check_finding_dispositions.ts` is the reader, its
      rejection of comments is the reason, and a committed file is what it accepts.
      verify: a new skill cannot pass its authoring gate without a committed row,
      and `grep` finds the row after the PR is squashed.
- [ ] **3.2 Record refusals, not only admissions.** A ledger of what shipped is a
      changelog; the reviewer's ask is a visible "no".
      verify: the ledger's schema carries a rejected state, and at least one
      historical refusal is backfilled or the absence of any is recorded.

## Phase 4 — the first tranche, gated on Phase 1

- [ ] **4.1 Retire the candidates Phase 1 ranked, in one reviewable batch.**
      Not "retire aggressively": retire the set whose evidence Phase 1 produced,
      and leave the rest.
      verify: `skill_count` falls, `check_estate_count` reports the fall, and every
      retirement cites its 1.3 row.
- [ ] **4.2 Record the net direction per release from here.** The reviewer's ask is
      *"netto sinkender Skill Count"* — a falling net, not a single tranche.
      verify: a committed figure per release, and the first two readings.

## Blockers

### blocker: b-what-a-skill-costs

- **What:** The governing principle — *"eine Capability muss ihre Existenz
  bezahlen"* — needs a price before a ratchet can charge it. Standing tokens?
  Catalogue bytes? Host-listing slots? The four differ by an order of magnitude
  and pick different retirement candidates.
- **Blocks:** 2.1's metric definition, and therefore 1.1's.
- **What to do:** choose among (a) a bare `SKILL.md` count, (b) catalogue bytes as
  `_lib/skill_catalogue.ts` computes them, (c) exact-BPE description tokens as
  `check_preamble_payload_budget` already measures for the preloaded catalogue, or
  (d) host-listing slots. Record the choice and its reason in
  `src/config/estate-count-budget.json`.
- **Owner:** maintainer.
- **Recommendation:** (a) for the ratchet and (c) as the published companion
  figure. A count is the thing a `one_in_one_out` lint can express; the token
  figure is the thing that answers "did it pay".
- **If you do nothing:** Phase 2 stalls, because a gate cannot ratchet an
  undefined metric.
- **Resolved when:** the definition is committed in that config file.
- **Status:** open.

### blocker: b-retirement-reversibility

- **What:** Deleting a skill is not obviously reversible. A consumer install may
  reference it, a rule may route to it, and
  `lint_rule_skill_pack_reach` exists precisely because a rule may not route to a
  skill a pack-legal install cannot receive.
- **Blocks:** 4.1.
- **What to do:** decide the retirement mechanism: hard delete, an `archive/`
  directory under `src/skills/`, or a `deprecated` lifecycle value — note
  `archive/road-to-capability-governance.md` Phase 5.1 already shipped a four-word
  lifecycle `experimental → validated → recommended → deprecated` as a **view**,
  so the vocabulary exists. Then run `./scripts-run src/scripts/lint_rule_skill_pack_reach`
  against the proposed tranche.
- **Owner:** maintainer.
- **Recommendation:** reuse the shipped `deprecated` value for one release, then
  delete. It makes the tranche reversible for exactly as long as a consumer needs
  to notice.
- **If you do nothing:** a tranche either breaks a routing rule or is never taken.
- **Resolved when:** the mechanism is recorded, and the reach lint is green on the
  proposed tranche.
- **Status:** open.

### blocker: b-fourth-metric-home

- **What:** `estate-count-budget.json` is named for the **roadmap** estate and its
  `metric.basis` describes roadmap parsing. A skill metric there is either a
  welcome consolidation or a category error, and that is a judgement about what
  the file is for.
- **Blocks:** 2.1.
- **What to do:** either extend that file and widen its `_comment` and
  `metric.basis` in the same change, or create `src/config/skill-estate-budget.json` <!-- ref-ignore --> <!-- a path that exists only if b-fourth-metric-home takes the second option -->
  and accept a second gate. If the second: it must carry `owner` and `review_by`,
  because `lint_budget_ownership.ts` scans `src/config/*budget*.json` and would
  see it.
- **Owner:** maintainer.
- **Recommendation:** extend the existing file. A second ratchet is a second place
  to forget, and the gate's floor-from-the-base-ref machinery is the expensive part
  that should not be written twice.
- **If you do nothing:** Phase 2 has no home and the roadmap stops at Phase 1's
  measurements — which is still worth having, and is why this blocker does not
  block Phase 1.
- **Resolved when:** the metric lives in a named file that `lint_budget_ownership`
  scans.
- **Status:** open.

## Risk Register

<!-- risk-review: v1 | reviewed: 2026-08-24 | reviewer: analyze-inbox -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The ratchet imports the exemption asymmetry it is modelled on | implementation | The gate being reused has a documented defect: `status: draft` lets a roadmap leave the measured set, and promotion is charged while addition is exempted — 13 identical `estate_offset_exempt` claims in one PR. A skill ratchet with a `draft`-shaped escape reproduces it. | Non-goals state no skill-side equivalent of `draft`, and 2.2 proves the gate fires rather than assuming it. | Phase 2 — the ratchet, as a fourth metric on the existing budget |
| 2 | Tiering is read as admission headroom | product | The reviewer names this directly: *"Wir können jetzt noch 200 Skills hinzufügen, weil sie ja nicht alle stehen."* Tiered projection reduces what is *delivered*, not what exists, and conflating the two turns a delivery win into an admission licence. | The metric counts what exists, never what is projected; the Non-goals say so. | Context |
| 3 | A retirement tranche is chosen by convenience | implementation | Ranking 299 skills produces a long tail, and the cheapest candidates to delete are the ones nobody will defend rather than the ones that fail a signal. | 4.1 requires every retirement to cite its 1.3 row, so the evidence precedes the choice. | Phase 4 — the first tranche, gated on Phase 1 |
| 4 | Phase 1 lands and Phases 2–4 never do | product | This is the shape the reviewer warns about elsewhere: a measurement pass that documents a problem better without changing it. | 2.1 is the artifact a later reviewer can check for; a Phase 1 that lands alone leaves `skill_count` absent from the gate output, which is the visible signal it did not finish. | Phase 2 — the ratchet, as a fourth metric on the existing budget |
| 5 | Three of the five signals turn out unmeasurable | implementation | "No unique outcome" and "duplicate responsibility" may have no instrument, and an unmeasurable signal cannot gate a retirement. | 1.2 admits `none` as a row value; an honest null on three signals still leaves two that work, and the ratchet in Phase 2 does not depend on any of them. | Phase 1 — measure before gating |

## Acceptance Criteria

- [ ] **AC-1** — `check_estate_count` prints a `skill_count` row with a floor measured on the base ref, and a test proves the floor is not read from config.
- [ ] **AC-2** — the gate is demonstrated red on an added skill and green on its removal, by sabotage.
- [ ] **AC-3** — the five retirement signals each carry an instrument path or the word `none`, with no blank row.
- [ ] **AC-4** — a new skill cannot pass its authoring gate without a committed ledger row, and the row survives a squash.
- [ ] **AC-5** — the ledger schema carries a rejected state, and either one historical refusal is backfilled or the absence of any is recorded.
- [ ] **AC-6** — `skill_count` is lower than 299 and every retirement cites its ranking row.
- [ ] **AC-7** — two consecutive per-release readings of the net direction are committed.

## Explicitly NOT in this roadmap

**A parallel ratchet.** The floor-from-the-base-ref machinery, the diff-scoped
claim and the `one_in_one_out` lint already exist and were expensive to get right.
`b-fourth-metric-home` decides where the metric lives; it does not license a
second implementation.

**A `draft`-shaped escape hatch.** The gate being reused has a documented hole
where the measured party decides whether its work enters the measurement
(`stubs/road-to-draft-status-ratchet-boundary.md`). Nothing here creates a skill
analogue of it.

**Tiering as a substitute.** Reducing what is delivered is a real and separate
win. It does not reduce what exists, and this roadmap counts what exists.

**A target number.** No measurement in this tree says what the right skill count
is. The ratchet's job is to make growth visible and argued; picking a destination
is a decision Phase 1's evidence should inform, not one this roadmap asserts.
