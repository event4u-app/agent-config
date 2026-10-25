---
complexity: lightweight
status: ready
tree_pin: c073ca2e5a
execution:
  mode: phase-checkpoints
estate_offset_exempt: "Round inbox-2026-10-aw, searched 2026-10-25 with `grep -rlF` over agents/roadmaps/*.md, agents/roadmaps/later and agents/roadmaps/stubs for release_impact_entry, parse_impact_trailers, classifyUpdate major floor, orderStages, warnRemovedKeys, RULE_PACKS_LEGACY_WINDOW, check_new_adr_evidence and legal-safety-floor shipping with its skills: no roadmap owns any of them (road-to-an-update-that-installs-itself-only-when-it-is-safe consumes the impact map but owns neither its parser nor its writer; road-to-a-setup-that-decides-itself closed rule_packs at 4.9 and records D14's revisit-if without a step). The owner asked this run to process what it writes, so the roadmap is active; active count goes 3 -> 4, inside the WIP cap of 5. Parking it in later/ was rejected because the owner asked this run to execute it, and folding it into road-to-an-update-that-installs-itself-only-when-it-is-safe was rejected because that roadmap owns the consent path, not the parser or the safety-floor scope."
estate_growth_exempt: "THIS CHANGE (2026-10-25) grows active_roadmaps 3 -> 4 by adding this roadmap at the owner's request to process it in the same run (`/analyze:inbox` round inbox-2026-10-aw, then `/roadmap:process-full`). No finished roadmap exists to offset it, the count stays inside the WIP cap of 5 from the 2026-10-24 owner directive, and this roadmap archives itself when its steps close in the same PR."
relates:
  - slug: road-to-an-update-that-installs-itself-only-when-it-is-safe
    relation: disjoint
    note: "Owns the update classifier's consent path and the ring-0 exit. Phase 1 here corrects the impact map the classifier reads and adds one floor for a major the map does not describe; nothing here touches 4.3 or the ask."
  - slug: road-to-a-setup-that-decides-itself
    relation: disjoint
    note: "Retired projection.rule_packs (4.9) and recorded D14's revisit-if (a rule that applies regardless of its pack). Phase 3 here is that revisit, routed to the council; Phase 5 schedules the window it left open."
---
# Road to records that agree after eighteen

> **Source:** `agents/tmp.old/inbox-2026-10-aw/` — 17 external reviews of
> release 18.0.0 and four planning files, verified against `c073ca2e5a`
> (18.2.0). Every step below is a claim reproduced in that tree.

## Goal

The consumer-impact class a release publishes agrees with the bump it takes and
with `BREAKING_CHANGES.md`. A major the impact map does not describe can never be
installed silently. A guard runs where its header says it runs. A safety-floor
rule ships wherever a skill that obeys it ships. A legacy window has a recorded
end. Each of these is a test or a lint that can go red.

## Phase 1 — The impact class agrees with the bump

- [x] **1.1 Let a wrapped `BREAKING CHANGE:` footer continue onto unindented
      lines.** `parse_trailer_paragraph`
      (`src/scripts/_lib/consumer_impact.ts:89-97`) discards the whole paragraph
      when one line is not a trailer. Both 18.0.0 breaking commits
      (`79cb86c0dd`, `a3d4596078`) end with a wrapped `BREAKING CHANGE:` footer in
      the same paragraph as `Consumer-Impact: action`, so the parse returns
      `none, recorded: false`. `corrected-from-reproduction`: the planned
      "trailing run" reading made a quoted `Consumer-Impact:` line in prose a
      trailer and reddened an existing case, so only the footer's own
      continuation lines are admitted.
      verify: a red-first test in `tests/lib/consumer_impact.test.ts` with the
      `79cb86c0dd` body shape yields `action, recorded: true`; the existing cases
      stay green.
      Landed 2026-10-25: red, then green with 438/438 in the impact and release suites.
- [x] **1.2 An unrecorded breaking commit classes as `action`.** `span_bump`
      (`impact_bump.ts:88`) already reads a breaking commit with no valid trailer
      as a major (ADR-300); `release_impact_entry`
      (`consumer_impact.ts:168-176`) ignores it, so one span produced a major bump
      and a `notice` class. Apply the same reading there.
      verify: a test where a span holds one `breaking: true, recorded: false`
      commit yields `{ impact: 'action' }`.
      Landed 2026-10-25: the span test that pinned `none` for this case was the
      defect itself; it now expects `action` and was seen red first.
- [x] **1.3 Correct the 17.0.0 and 18.0.0 entries of the impact map.**
      `package.json` `agentConfig.impact` read `notice` for both;
      `BREAKING_CHANGES.md` says `action` for both. Set them to `action`, so an
      installed pre-17 or pre-18 updater is asked rather than notified.
      `corrected-from-reproduction`: re-running the fixed code over
      `16.5.0..17.0.0` showed 17.0.0 carries the same disagreement.
      verify: `node -p "JSON.stringify(require('./package.json').agentConfig.impact)"`
      prints `action` for both versions; the fixed `release_impact_entry` over
      `git log 17.4.0..18.0.0` and `16.5.0..17.0.0` returns `action` for each, and
      `18.0.0..18.1.0`, `18.1.0..18.2.0` return `none`, matching their absence.
      Landed 2026-10-25: all four spans reproduced with the shipped readers.
- [x] **1.4 A major's absence from the map means a declared `none`, and only that.**
      `classifyUpdate` (`src/scripts/_lib/classify_update.ts:131-170`) returns
      `auto` when the range crosses a major with no map entry.
      `corrected-from-reproduction`: the planned classifier floor reddened the
      recorded no-action majors 13.0.0 and 16.0.0 (`tests/lib/classify_update.test.ts:72-84`),
      which are absent BY DESIGN because `with_release_impact` omits a `none`
      span. The defect was the writer producing that absence for an undeclared
      break, which 1.2 closes; this step pins it at the writer instead.
      verify: `npx vitest run tests/lib/consumer_impact.test.ts` passes "never
      omits a span carrying an undeclared break", and neutralising the 1.2 line
      turns it red.
      Landed 2026-10-25: red with the 1.2 line neutralised, green restored; the
      classifier and its 72 cases are unchanged.

## Phase 2 — Guards that run where they say they run

- [x] **2.1 Run the shipped-Pending-row check with history in CI.** The
      real-index test (`tests/scripts/release_head_prefill.test.ts:253-270`) skips
      in `node-tests`, whose checkout is shallow, and no full-history job runs it.
      Run it in a job with full history and tags, where a skip fails.
      verify: the workflow step exists in a full-history job; locally, forcing
      the skip condition under the require-history switch fails the test.
      Landed 2026-10-25: `rule-backstops.yml` step with `RELEASE_PENDING_REQUIRE_HISTORY=1`; probed red with a missing commit and with `79cb86c0dd` (in 18.0.0), green restored.
- [x] **2.2 A dependency cycle is a plan error, not a crash.** `orderStages`
      (`src/scripts/_lib/invocation_plan.ts:211-215`) takes `ready[0]` unguarded;
      a hard-edge cycle (including `A dependsOn A`) throws a TypeError. Detect it
      in `validate` and throw `InvocationPlanError` naming the cycle.
      verify: red-first case G15 in `tests/scripts/invocation_plan.test.ts`
      (self-loop and two-stage cycle) expects `InvocationPlanError`.
      Landed 2026-10-25: `validate` names the cycle; the guard case was red first, 22/22 green.
- [x] **2.3 A key honoured during a window does not print "ignored".**
      `warnRemovedKeys` (`src/scripts/_lib/settings_removed_keys.ts:207`) appends
      `; ignored.` to every removed key, including `projection.rule_packs`, whose
      own reason says an explicit value is still honoured. Print the window
      instead of "ignored" for that key.
      verify: a test captures stderr for `projection.rule_packs` and finds no
      "ignored".
      Landed 2026-10-25: red first, then "still honoured until its window closes".
- [x] **2.4 The star-ask unwritable-state test holds as root.**
      `tests/scripts/star_ask_hook.test.ts:158-176` relies on `chmod`, which root
      ignores. Skip it when `process.getuid?.() === 0`, as
      `classify_merge_risk_base_revision.test.ts` does.
      verify: the test file contains the guard and passes.
      Landed 2026-10-25: `it.skipIf(process.getuid?.() === 0)`; not probed as root on this host.
- [x] **2.5 Drop the stale "stays on 20" comments.** `.github/workflows/tests.yml:310,645`
      says other jobs stay on Node 20; `engines.node` is `>=22` and no job pins 20.
      verify: `grep -c 'stays on 20' .github/workflows/tests.yml` is 0.
      Landed 2026-10-25: three blocks replaced; the count is 0.

## Phase 3 — A floor ships where its skills ship

- [x] **3.1 Put D14's revisit-if to the council.** On claude-code and codex every
      skill ships (`src/install/scoped_projection.ts:480-488`), but
      `legal-safety-floor` (`packs: [legal-review-prep]`) and
      `finance-safety-floor` ship only with their pack, while `contract-review`
      says it obeys the first. Question: does a pack-scoped safety-floor rule
      ship whenever a skill that names it ships?
      verify: a council record under `agents/evidence/council/` and a row in
      `## Decisions`.
      Landed 2026-10-25: 2/2 seats, option 1 (D3);
      `agents/evidence/council/safety-floor-with-its-skills-20261025.md`.
- [x] **3.2 Implement the verdict with an install test.** If the council says
      yes: the rule scope adds a pack-scoped rule tagged a safety floor when any
      projected skill names it. Either way, the test pins the outcome.
      verify: an install test asserts the chosen behaviour for `contract-review`
      on claude-code with no active pack.
      `corrected-from-reproduction`: the rule scope is host-blind
      (`src/install/ruleInScope.ts`), so the floor passes the pack axis whenever
      its `routes_to` names a skill — over-shipping on hosts without a listing
      lever, the fail-safe direction the predicate already takes.
      Landed 2026-10-25: `tests/install/safety_floor_follows_skill.test.ts` (red
      first) asserts the three floors ship with no pack, `image-likeness-and-rights`
      stays pack-scoped, every `routes_to` skill exists and every skill that says
      it obeys a floor is in that floor's `routes_to` (which added
      `legal-practice-profile`); `rule_packs_auto.test.ts` now pins the floors as kept.
- [x] **3.3 Name the lost coverage in the 18.0.0 migration.** `docs/MIGRATION.md`
      § 18.0.0 lists the eight rules but not what stops firing (contract, NDA,
      valuation, likeness triggers) or the one-line restore.
      verify: the section names the four floor rules, their trigger class and
      `runtime.active_packs` as the restore.
      Landed 2026-10-25: `docs/MIGRATION.md` § 18.0.0 names the four, their
      triggers, the restore, and the correction from 3.2.

## Phase 4 — Records census and the open window

- [x] **4.1 Run the owner-claim predicate once over existing ADRs.**
      `check_new_adr_evidence` checks only added records. Apply
      `claimsOwnerDecision` + `citesOwnerDirective` to every accepted ADR since
      ADR-282 and append each miss to `agents/owner-questions.md` as a question,
      not a fix.
      verify: the census output is committed under `agents/evidence/analysis/`
      with its count, and every miss has a question.
      Landed 2026-10-25: 14 misses from ADR-282 on, 8 naming the owner as decision-maker; ADR-286 is already corrected, the other 7 are OQ-18.
      `corrected-from-reproduction`: one question for the 7, not one per record, so the list stays readable.
- [x] **4.2 Schedule the `rule_packs` legacy window.** `RULE_PACKS_LEGACY_WINDOW`
      (`src/install/rule_scope.ts:122`) is prose with no end; 18.1.0 and 18.2.0
      shipped since. Add a `docs/MIGRATION.md` § Scheduled deprecations row for
      the legacy honouring and the `ProjectionMode` residue in `mcp_bridge.ts`,
      with removal due at the next major (not pinned).
      verify: `lint_scheduled_deprecations` passes with the row present.
      `corrected-from-reproduction`: the row reads "next major after 18.x", which the lint resolves to 19, so the window gets teeth instead of staying unpinned.
      Landed 2026-10-25: 4 rows parsed, none due.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-25 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Parser widening reads prose as a trailer | implementation | A body paragraph ending in `Key: value` lines is read as a trailer block | Only a `BREAKING CHANGE:` footer may continue onto unindented lines; the existing quoted-prose cases stay green | Phase 1 — The impact class agrees with the bump |
| 2 | Map correction shifts consumer prompts | product | Pre-17 and pre-18 installs see `ask` instead of `notify` | That is the class `BREAKING_CHANGES.md` records; the classifier is unchanged | Phase 1 — The impact class agrees with the bump |
| 3 | Floor shipping grows the standing layer | implementation | Extra rules on lever hosts cost tokens per spawn | The council weighs it in 3.1; the install test pins whichever side wins | Phase 3 — A floor ships where its skills ship |

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| D1 | reversible-technical | agent | A fully encrypted lineage vault and "Evolution Graph 2.0" are not planned here | No observed failure: private views are local, `0600` and refused inside a git tree (`src/scripts/_lib/lineage_ledger.ts:72-76`); field sealing is by design | a private lineage view or ledger is found in a backup, a git tree or a log |
| D2 | product-owned | owner | Star-ask default stays as shipped | ADR-301 carries `reopen_policy: owner`; `star_ask.mode: off` and `AGENT_CONFIG_NO_STAR_ASK=1` exist | the owner reopens ADR-301 |
| D3 | contested-technical | council:agents/evidence/council/safety-floor-with-its-skills-20261025.md | Option 1: a consequence-class floor ships wherever a skill in its `routes_to` can ship; `image-likeness-and-rights` stays pack-scoped (deferred, not decided). Both seats prefer a dedicated `requires_rules` field over `routes_to` long-term; this change validates `routes_to` both ways instead and adds no settings key (owner directive 2026-10-12) | 2/2 seats converged on option 1; option 4 rejected as a known missing control | host-matrix evals show the guarded skills fail closed without the floor, or dependency-following projection harms unrelated tasks; for the image rule, an inventory shows image generation reachable without `ai-image` |

## Acceptance Criteria

- [x] AC-1 — For every release in the impact map, the class equals what the fixed
      parser computes over its span, and an unrecorded breaking commit yields
      `action`.
- [x] AC-2 — No span carrying an undeclared break is absent from the impact
      map, so a major's absence means a declared `none` (1.4 as corrected).
- [x] AC-3 — The behavioural guards in Phase 2 (2.1–2.3) each have a test that was seen red; 2.4 (root-only) and 2.5 (a comment) have no red to see.
- [x] AC-4 — Whether a safety floor ships with its skills is decided, recorded,
      and pinned by an install test.
