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

- [x] **1.1 Register the count and its definition.** Decide what counts as one
      skill (a `SKILL.md`, presumably) and record the definition beside the number
      so a later reader cannot re-derive a different total.
      verify: **299 maintained skills and 11,461 exact-BPE description tokens**,
      both defined in `src/config/estate-count-budget.json` §
      `metric.skill_count` / `metric.skill_description_tokens` and measured by
      `_lib/skill_estate.ts`. Reproduce: `find src/skills -name SKILL.md | wc -l`
      → 299, or `measureSkillEstate(process.cwd())` for the split with the
      deprecated exclusion. The definition names what is EXCLUDED, which the
      count alone cannot: `lifecycle: deprecated` skills do not count, because
      with them counted deprecating one would create no headroom and the
      retirement mechanism the council chose would be unusable against its own
      gate. 0 carry it today, so the exclusion is a no-op now and a correctness
      property once a tranche lands.
- [x] **1.2 Per retirement signal, name the instrument or record its absence.**
      The reviewer's five: never triggered · low relevance score · duplicate
      responsibility · dead cross-skill links · no unique outcome.
      verify: **the five-row table, with every instrument RUN rather than only
      named — and the result is that no signal currently produces a retirement
      candidate.**

      | signal | instrument | reading, 2026-08-24 |
      |---|---|---|
      | never triggered | **`none`** | No persistence path exists. `skill_route_hook.ts` contains no `appendFileSync` / `writeFileSync` / sink at all, and the one audit file (`agents/runtime/state/audit/2026-08.jsonl`) holds a single `type: note` row carrying **zero** skill names. This is the reviewer's strongest signal and it has no instrument. |
      | low relevance score | `src/shared/skillRanking.ts` | Exists, and is a RANKER with no threshold — it answers "which of these" for a query, not "is this one dead". Not consumed by `compute_skill_tiers.ts` or the host-listing emitter. |
      | duplicate responsibility | `src/scripts/audit_skill_overlap.ts` | RAN: **299 skills, 0 pairs ≥ 70 %, 0 same-domain merge candidates.** An honest null, not an absent instrument. |
      | dead cross-skill links | `src/scripts/lint_handoffs.ts` | RAN: 18 violations, **all `handoff_tier_mismatch`** — a `tier` metadata backfill backlog on the LINKED-TO skills, not a broken link. The one genuinely dangling link was fixed when the baseline was set. **0 retirement candidates.** |
      | no unique outcome | `src/scripts/skill_eval_coverage.ts` | RAN: **42/299 = 14.0 %** behavioural-eval coverage (rich 4/4, default-surface 29/29, router 2/2, priority 35/35, other 7/264). Usable as a signal only for the 42; silent on the 257 that carry no eval. |

      No row is blank and no row is guessed. Three instruments were run rather
      than cited, which is what turns this from a table of names into a
      measurement — and the measurement is the finding: see 1.3.
- [x] **1.3 Rank the corpus once, on whatever 1.2 established.** A ranking is not
      a retirement decision; it is the input one needs.
      verify: **PUBLISHED NULL — a ranking is not constructible from what 1.2
      established, and the reason is a finding rather than a gap in this step.**

      A retirement ranking needs at least one signal that nominates candidates.
      Of the five: the two instruments that CAN nominate both returned **zero**
      (0 overlap pairs ≥ 70 %, 0 dead links); relevance is a per-query ranker
      with no dead-skill threshold, so it cannot order a corpus by
      retirement-worthiness without one being invented; eval coverage is silent
      on 257 of 299; and the signal that would actually nominate — never
      triggered — has no instrument at all.

      So a "committed ranking whose row count equals 299" would be 299 rows of
      the same non-answer, ordered by nothing. Publishing it would create exactly
      the artefact this repository rejects elsewhere: a measurement-shaped object
      with no measurement in it. **The honest output is that Phase 4's input does
      not exist**, which is why 4.1 is not attempted here and why the missing
      instrument is named as the thing that unblocks it.

## Phase 2 — the ratchet, as a fourth metric on the existing budget

- [x] **2.1 Add `skill_count` to `src/config/estate-count-budget.json` and
      `check_estate_count.ts`.** Reuse the shape, do not build a parallel gate:
      that gate already measures its floor on the **base ref's own tree** with the
      same functions it applies to HEAD (so the "before" side cannot be rewritten
      by the change under review), reads `estate_growth_exempt` from the **diff**
      so a claim cannot be banked, and runs a `one_in_one_out` lint.
      verify: **two metrics, not one**, and the gate prints both with a base-ref
      floor:

      ```
      skill_count          299  (floor 299 at origin/main, +0)
      skill_description_tokens 11461  (floor 11461 at origin/main, +0)
      ```

      AI council 2/2 asked for the token dimension to be **gated** rather than
      published informationally, against this step's own recommendation: a count
      ratchet alone is gameable by merging four large skills into one file, which
      lowers the count while the description payload a host must carry does not
      move. Both dimensions carry allowance 0 — the defect being addressed is a
      corpus that grew with nothing objecting, so an addition takes the
      `estate_growth_exempt` claim path or fails.

      The floor comes from the base ref and a test proves it in the way the step
      asks: `tests/scripts/check_estate_count.test.ts` § the skill estate drives
      the REAL binary over a git repo whose base ref carries a committed skill
      tree, asserts `floor 4 at main`, and then greps the budget file to show it
      holds **no** skill number that could have supplied it. Two subtrees are
      materialised because `materialiseSubtree` takes one prefix, and they are
      independent on purpose: a base ref with no `src/skills` (an old tag, a
      shallow clone) DROPS the skill metrics with a printed reason and leaves the
      roadmap metrics ratcheting — never a silent zero floor, which would fail
      every branch, and never a silent skip, which would pass every tree.

      An unresolved tokeniser drops that one metric the same way, because an
      exact reading compared against a proxy one moves by more than the growth
      this gate exists to catch.
- [x] **2.2 Prove the gate fires.** Add a skill in a test fixture and watch the
      metric grow and the gate refuse; remove it and watch it pass.
      verify: **sabotaged on the live tree AND in fixtures, both dimensions, exit
      codes captured directly rather than through a pipe.**

      Live tree, one added skill:
      `skill_count 300 (floor 299, +1)` · `skill_description_tokens 11472 (floor
      11461, +11)` · `❌ the skill estate grew: skill_count 299 → 300` · **exit 1**.
      Removed → **exit 0**.

      Live tree, token-only (the gaming path): one existing description
      lengthened, no file added → `skill_count 299 (+0)` ·
      `skill_description_tokens 11482 (floor 11461, +21)` · **exit 1**, and the
      failure line names `skill_description_tokens` and not `skill_count`.
      Restored → **exit 0**.

      Seven fixture cases in `tests/scripts/check_estate_count.test.ts` drive the
      real CLI over temp git repos: both dimensions reported with a base-ref
      floor · an added skill refused with the config proven not to hold the number
      · the failure line naming *the skill estate* rather than *the roadmap
      estate* (the noun was unconditional before this metric existed) · a padded
      description refused with the count unchanged · a deprecated skill LOWERING
      the count · a base ref with no skill tree dropping the metrics with a
      stated reason · a skill addition authorised by an `estate_growth_exempt`
      claim. 48 tests green across the two files, and the gate's own
      `--self-test` stays green at 13/13 (8 rejecting, floor 12).

      Where the discrimination is proven: those seven cases go through
      `spawnSync` against the real binary, which is what the `--self-test`
      harness does too. No new `--self-test` case was added; the CLI-driven
      fixtures cover the same property over real git history, which a synthetic
      self-test fixture cannot.

## Phase 3 — a durable admission and refusal record

- [x] **3.1 Move the Phase-3.1 answers out of the PR body into a committed
      ledger.** Follow the precedent the tree already set for findings rather than
      inventing a format: `check_finding_dispositions.ts` is the reader, its
      rejection of comments is the reason, and a committed file is what it accepts.
      verify: **`agents/decisions/skill-admissions.jsonl` + `check_skill_admissions`,
      forward-only, and a correction to this roadmap's own reading.**

      **The authoring gate DOES exist and is documented** — this roadmap's Context
      implies otherwise by quoting only its storage line.
      `skill-writing/references/procedure.md` § 0b asks all five questions
      (family · capability · why-not-extend · why-not-a-guideline · visibility) and
      already tells the author to surface overlap first. What was wrong was the
      one sentence *"answer these in the PR body"*, and that is now
      *"answer these in the ledger"*, with the reason written beside it:
      `check_finding_dispositions.ts:11` rejects that exact surface for findings in
      its own words — a comment is *"mutable and unaudited; it is transport, not a
      record"*.

      The gate is FORWARD-ONLY by diff rather than by list: only skills added
      since the base ref need a row, so the 299 already in the tree are
      grandfathered **by construction** and cannot be forgotten off a grandfather
      file. It rejects an answer under 12 characters, because a one-word answer is
      the boilerplate the gate exists to catch.

      Two properties found by building it rather than by planning it:

      - **The gate must see UNTRACKED skills, not only committed ones.** The first
        version read `git diff --diff-filter=A` alone, so
        `check_gate_coverage --canary` planted a skill, the gate stayed green, and
        the canary correctly reported the gate **dead**. Now it reads
        `git ls-files --others` too — which is also the right direction for a
        contributor, and the same scope `check_secret_leak` uses.
      - **An empty ledger is a legitimate green and a missing one is not.**
        `allowEmpty: EMPTY_VALID:` covers the shipped state (0 rows, everything
        grandfathered); `readLedger` THROWS on a missing or malformed file. Without
        that split the allowEmpty would be the hole.

      17 tests and an 8-case `--self-test` (6 rejecting, floor 8), every case
      sabotage-then-repair over a real throwaway git repo — the forward-only scope
      IS a `git diff`, so a fixture without history would exercise a different
      code path than the one that runs. `--canary` now catches the plant at
      exit 1.
- [x] **3.2 Record refusals, not only admissions.** A ledger of what shipped is a
      changelog; the reviewer's ask is a visible "no".
      verify: **`decision: rejected` is a first-class state with its own
      consistency check, and the absence of any historical refusal is recorded as
      the finding it is.**

      A rejected row needs `skill`, `decision`, `date` and `instead` — not the five
      admission answers, since it is not an admission, and a test pins that the
      two findings are never confused (a refusal must not be asked for admission
      answers). The check that makes the state mean something: **a rejected row may
      not name a skill that exists.** A record saying a capability was refused
      while it ships is worse than no record, and it is the shape a ledger drifts
      into once someone rejects a proposal that later lands under the same name.

      **No historical refusal was backfilled, because none exists**, and that is
      recorded in the ledger's own `_absence_of_refusals` line rather than left as
      an empty file. A grep over `archive/`, `later/` and `stubs/` returns the
      recurring OBSERVATION that the count keeps climbing
      (`road-to-capability-governance.md:46`) and one 2026-05-01 audit that
      captured the count as data (`road-to-governance-cleanup.md:64`). **No skill
      proposal was ever refused in a form the tree records** — which is exactly
      what a ledger kept in PR bodies produces, so it is the defect rather than a
      gap in this backfill. The first genuine `rejected` row will be the first
      visible no.

## Phase 4 — the first tranche, gated on Phase 1

- [~] **4.1 Retire the candidates Phase 1 ranked, in one reviewable batch.**
      Not "retire aggressively": retire the set whose evidence Phase 1 produced,
      and leave the rest.
      verify: **TRANSFERRED — the input does not exist, and the mechanism does.**
      AI council 2/2 (2026-08-25) for option (a) over three alternatives, moved to
      [`stubs/road-to-skill-retirement-signal.md`](stubs/road-to-skill-retirement-signal.md).

      This step says *"retire the set whose evidence Phase 1 produced"*, and
      Phase 1.3 produced a published null. Re-measured 2026-08-25 rather than
      recalled from that record: `audit_skill_overlap` **0 pairs ≥ 70 %** over 299
      skills · `lint_handoffs` 18 findings, **all `handoff_tier_mismatch`**, a
      `tier` backfill backlog on the linked-TO skills and **0** retirement
      candidates · `skill_eval_coverage` 42/299 · `skillRanking.ts` a per-query
      ranker with no dead-skill threshold · **never triggered → `none`**, with
      `grep -cE 'appendFileSync|writeFileSync' src/scripts/hooks/skill_route_hook.ts`
      returning **0**. Estate unchanged at 299 / 11,461 / 0 deprecated.

      **Three alternatives were refused, each for its own reason.** Building the
      missing instrument here (b) is work this roadmap never scoped plus a
      wall-clock window a run does not have. Re-scoping to "retire what the
      existing signals nominate" (c) closes 4.1 on the empty set — vacuous
      completion. Retiring the 257 skills with no eval (d) was refused by both
      seats independently and on the same ground: **"no eval coverage" means
      UNMEASURED, not unnecessary**, so those 257 are the un-instrumented
      majority rather than candidates.

      **The stub gates on BOTH** the instrument and a maintainer-approved tranche.
      Neither substitutes for the other: the instrument supplies evidence, the
      maintainer supplies authority, and a prior council call SPLIT on whether an
      autonomous run may retire consumer-visible capabilities at all. That split
      stands and is why the authority half is gated separately.
- [x] **4.2 Record the net direction per release from here.** The reviewer's ask is
      *"netto sinkender Skill Count"* — a falling net, not a single tranche.
      verify: **`agents/evidence/metrics/skill-estate-per-release.jsonl`, with
      FOUR historical readings rather than the two this step asked for.**

      One council seat held that two readings necessarily wait for another
      release; the other said to try a historical backfill first. The backfill
      works: `git archive <tag> src/skills | tar -x` then `measureSkillEstate` on
      the extracted tree — and `git archive` is usable here precisely where it is
      not for the roadmap estate, because `.gitattributes` carries
      `/agents export-ignore` and no such rule for `src/skills`.

      | ref | skills | description tokens |
      |---|---:|---:|
      | 14.0.0 | 290 | 11,124 |
      | 14.9.0 | 291 | 11,165 |
      | 14.10.0 | 291 | 11,133 |
      | 14.11.0 | 299 | 11,461 |
      | HEAD | 299 | 11,461 |

      **The dimensions move independently in real history, not only in a
      fixture:** 14.9.0 → 14.10.0 holds the count at 291 while the tokens FALL
      11,165 → 11,133 — a description edit with no file change, invisible to a
      count ratchet. That is the anti-gaming case the second dimension was added
      for, observed rather than constructed, and it is the strongest available
      evidence that one metric would not have been enough.

      Net 14.0.0 → HEAD: **+9 skills, +337 tokens.** The direction is rising, and
      the file is where a falling one will be read.

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
- **Status:** resolved.
- **Resolution (2026-08-24) — (a) for the ratchet AND (c) gated beside it, not
  published informationally.** AI council 2/2. This goes FURTHER than the
  recommendation above, on an argument the recommendation did not make: a
  `SKILL.md` count alone does not measure what a skill costs, because merging
  four large skills into one file satisfies a count ratchet while the description
  payload a host must carry stays put. So both dimensions are gated, both with
  allowance 0.

  **(b) and (d) were eliminated by measurement rather than by argument**, and the
  measurements are the reason the choice is not a preference:

  - **(b) catalogue bytes read 0** on a real checkout. `readProjectedCatalogue`
    walks `.claude/skills`, which is empty in any tree where `task
    generate-tools` cannot complete — it fails under `projection.mode=scoped`
    without the config package. A ratchet whose reading depends on whether a
    generator ran reds for the environment, not for the change.
  - **(d) host-listing slots are the host's decision.** A measured install
    published its own budget event stating it had stripped every description and
    dropped 402 entries. Not reproducible from the repository, so it cannot carry
    a floor.

  Committed in `src/config/estate-count-budget.json` §
  `metric.skill_count`, `metric.skill_description_tokens`, and
  `metric.skill_metric_rejected_candidates` — the last so a later reader finds
  the eliminations rather than re-running them.

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
- **Status:** resolved for the MECHANISM; the tranche itself is owner-reserved.
- **Resolution (2026-08-24) — `lifecycle: deprecated` for one release, then
  delete.** AI council 2/2 on the mechanism, and this blocker's own description
  of the vocabulary was wrong in a way worth correcting rather than carrying.

  **The four-word lifecycle it names — `experimental → validated → recommended →
  deprecated` — is not what the skill schema carries.**
  `src/scripts/schemas/skill.schema.json` defines
  `lifecycle: active | deprecated | experimental | archived` (ADR-013), default
  `active`. `deprecated` exists, which is what the recommendation needed; the
  other three words of the quoted chain do not, and `archived` is a fourth the
  quote omits. **0 skills carry `deprecated` today.**

  `archive/` under `src/skills/` was REJECTED, on a reason neither the blocker
  nor the recommendation gave: one seat noted it risks remaining discoverable and
  pack-eligible, and git history already provides the archive after a delete. A
  directory that looks retired but still ships is worse than either endpoint.

  **The mechanism is wired into the gate, not only recorded.**
  `_lib/skill_estate.ts` EXCLUDES deprecated skills from both metrics, and a
  test proves deprecating one LOWERS the count. That property is load-bearing:
  with deprecated skills counted, deprecation would create no headroom and the
  mechanism would be unusable against its own gate.

  **Still open, deliberately:** the deprecation CONTRACT one seat listed —
  installable during the transition release, visibly communicated, new rule and
  pack references prevented, replacement named or its absence explained, removal
  release recorded, all lint-enforced rather than prose. None of that is built
  here, and `lint_rule_skill_pack_reach` has not been run against a proposed
  tranche because no tranche exists (see 1.3's published null).

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
- **Status:** resolved.
- **Resolution (2026-08-24) — extend `estate-count-budget.json`.** AI council 2/2
  with the recommendation. `lint_budget_ownership` reports **12 budget config(s)**
  and that file is one of them, so the metric lives somewhere the ownership gate
  already sees, with no second `owner` / `review_by` pair to keep fresh.

  Both seats added the same refinement, which the implementation follows: the
  metrics are **separate named entries** carrying their own basis, not a widened
  scalar bolted onto the roadmap description. `metric.basis` is extended to state
  that the skill side needs a SECOND materialised subtree — `materialiseSubtree`
  takes one prefix — and that the two are independent so a base ref without
  `src/skills` drops the skill metrics and leaves the roadmap metrics
  ratcheting.

  The category-error worry this blocker raised is real and is answered in the
  file rather than dismissed: the `_comment` still describes a roadmap-estate
  ratchet, and the skill entries say in as many words that they are a fourth and
  fifth corpus on the same machinery. A reader who opens the file for the roadmap
  estate is not misled about what else it now gates.

## Risk Register

<!-- risk-review: v1 | reviewed: 2026-08-24 | reviewer: analyze-inbox -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The ratchet imports the exemption asymmetry it is modelled on | implementation | The gate being reused has a documented defect: `status: draft` lets a roadmap leave the measured set, and promotion is charged while addition is exempted — 13 identical `estate_offset_exempt` claims in one PR. A skill ratchet with a `draft`-shaped escape reproduces it. | Non-goals state no skill-side equivalent of `draft`, and 2.2 proves the gate fires rather than assuming it. | Phase 2 — the ratchet, as a fourth metric on the existing budget |
| 2 | Tiering is read as admission headroom | product | The reviewer names this directly: *"Wir können jetzt noch 200 Skills hinzufügen, weil sie ja nicht alle stehen."* Tiered projection reduces what is *delivered*, not what exists, and conflating the two turns a delivery win into an admission licence. | The metric counts what exists, never what is projected; the Non-goals say so. | Context | <!-- md-language-check: ignore -->
| 3 | A retirement tranche is chosen by convenience | implementation | Ranking 299 skills produces a long tail, and the cheapest candidates to delete are the ones nobody will defend rather than the ones that fail a signal. | 4.1 requires every retirement to cite its 1.3 row, so the evidence precedes the choice. | Phase 4 — the first tranche, gated on Phase 1 |
| 4 | Phase 1 lands and Phases 2–4 never do | product | This is the shape the reviewer warns about elsewhere: a measurement pass that documents a problem better without changing it. | 2.1 is the artifact a later reviewer can check for; a Phase 1 that lands alone leaves `skill_count` absent from the gate output, which is the visible signal it did not finish. | Phase 2 — the ratchet, as a fourth metric on the existing budget |
| 5 | Three of the five signals turn out unmeasurable | implementation | "No unique outcome" and "duplicate responsibility" may have no instrument, and an unmeasurable signal cannot gate a retirement. | 1.2 admits `none` as a row value; an honest null on three signals still leaves two that work, and the ratchet in Phase 2 does not depend on any of them. | Phase 1 — measure before gating |

## Acceptance Criteria

- [x] **AC-1** — `check_estate_count` prints a `skill_count` row with a floor measured on the base ref, and a test proves the floor is not read from config.
      **Met.** `skill_count 299 (floor 299 at origin/main, +0)` plus a second
      dimension the AC did not ask for. The floor-provenance test drives the real
      binary over a git repo whose base ref carries a committed skill tree,
      asserts `floor 4 at main`, then greps the budget file to show it holds no
      skill number that could have supplied it.
- [x] **AC-2** — the gate is demonstrated red on an added skill and green on its removal, by sabotage.
      **Met, twice over and in both dimensions.** Live tree: one added skill →
      `299 → 300`, exit 1; removed → exit 0. Token-only: one description
      lengthened, count unchanged at 299, tokens `11461 → 11482`, exit 1; restored
      → exit 0. Exit codes captured directly, never through a pipe. Seven fixture
      cases drive the real CLI over temp git repos.
- [x] **AC-3** — the five retirement signals each carry an instrument path or the word `none`, with no blank row.
      **Met, and three of the five instruments were RUN rather than named** — the
      table in 1.2 carries readings. The finding is the reading: `audit_skill_overlap`
      returns 0 pairs ≥ 70 %, `lint_handoffs` returns 0 dead links (its 18 findings
      are a `tier` backfill backlog), `skill_eval_coverage` covers 42/299, and
      *never triggered* — the reviewer's strongest signal — carries the word `none`
      because no persistence path exists.
- [x] **AC-4** — a new skill cannot pass its authoring gate without a committed ledger row, and the row survives a squash.
      **Met.** `check_skill_admissions` reds on an added skill with no row and
      greens when the row lands — proven both ways in 17 tests and an 8-case
      `--self-test`, and by `check_gate_coverage --canary` catching a planted
      skill at exit 1. The row survives a squash because it is a committed line in
      `agents/decisions/skill-admissions.jsonl`, which is the entire point of
      moving it out of the PR body: `grep '"skill":"<name>"' agents/decisions/skill-admissions.jsonl`
      answers after the squash, a PR comment does not.
- [x] **AC-5** — the ledger schema carries a rejected state, and either one historical refusal is backfilled or the absence of any is recorded.
      **Met by the second branch, and the branch taken is itself the finding.**
      `decision: rejected` is a first-class state with a consistency check of its
      own — a rejected row may not name a skill that exists. No refusal was
      backfilled because none exists in any form the tree records; the absence is
      written into the ledger's `_absence_of_refusals` line with the grep that
      establishes it, rather than left as an empty file a later reader would read
      as an unfinished backfill.
- [-] **AC-6** — `skill_count` is lower than 299 and every retirement cites its ranking row.
      **UNMET in this roadmap; objective carried forward.** Measured
      `skill_count`: **299**. Phase 1 produced no evidence-backed retirement
      candidates, so Phase 4 never ran.

      **The council split on how to say this, and the split is the record.** Both
      seats rejected the bare word *failed* — it reads as *the mechanism did not
      work*, and the mechanism was never exercised. One argued **TRANSFERRED
      (blocked on 4.1)**: a criterion that could not be *attempted* is blocked
      rather than failed, and calling it failed inverts a positive finding — the
      estate was checked and no slimming was indicated. The other argued that a
      work item may transfer while an **acceptance criterion records an
      outcome**: AC-6 says below 299, the measurement is 299, so it is unmet here
      whatever blocked it.

      **The stricter accounting is adopted**, because it also contains the first
      seat's objection: *"UNMET in this roadmap; objective carried forward"*
      states the outcome without implying the mechanism failed. The objective
      lives in
      [`stubs/road-to-skill-retirement-signal.md`](stubs/road-to-skill-retirement-signal.md);
      the unmet criterion stays here, where it was declared.
- [x] **AC-7** — two consecutive per-release readings of the net direction are committed.
      **Met with four readings, not two.** Backfilled from release tags
      (`git archive <tag> src/skills | tar -x`, then `measureSkillEstate`) rather
      than waiting two releases, in `agents/evidence/metrics/skill-estate-per-release.jsonl`.
      One seat held two readings must wait for a future release; the other said to try
      the backfill first, and the backfill worked.

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
