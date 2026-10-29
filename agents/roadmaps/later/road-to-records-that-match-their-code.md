---
complexity: small
status: ready
execution:
  mode: phase-checkpoints
owner: maintainer
review_by: 2026-11-26
capability_gap: none
tree_pin: 566cccf600
relates:
  - slug: road-to-a-map-that-knows-what-happened
    relation: disjoint
    note: "Stage L reads how a consumer logs; step 6 here only stops the package from mandating one helper"
entry_condition:
  what: >
    The owner answers OQ-42 (a preamble grant for the image floor's routes_to).
  when: >
    On that answer; nothing else in this file is open.
  who: >
    The owner.
estate_offset_exempt: "Owner search run 2026-10-29 for every subject below: grep -rlF over agents/roadmaps/*.md, later/ and stubs/ for 'Consumer-Impact', 'image-likeness-and-rights', 'external-code-graph-interop', 'max_calls_per_day', 'bypass_actors', 'MonitoringHelper', 'OQ-32' returned no roadmap owning any of them (image-likeness appears only as a catalogue row in later/road-to-mixed-trigger-activation-cost). The slot is the one road-to-map-views-from-the-handover freed when it archived in the same change; the active count stays at 5."
---
# Road to records that match their code

> **Source:** `agents/tmp.old/inbox-2026-10-bk/` and `agents/tmp.old/inbox-2026-10-bl/`
> — a 19.0.0 release review set and a later version of the map plan, verified at
> `566cccf600`. Everything those rounds asked of an existing owner landed on that
> owner (graph-that-wins 4.8, map-holds 4.7/4.8/5.8, routing-assurance 4.4,
> map-knows Phase 5). What is left here are the drifts no roadmap owns: a record —
> a rule description, a contract, a shipped skill, a comment — that says one
> thing while the code or a later decision says another.

## Goal

Every item below ends with the record and the code saying the same thing, and a
check that would have caught the drift where one is cheap.

## Phase 1 — Records a reader acts on

- [x] **1.1 The code-graph rule's description matches its body.** The <!-- receipt: class=R0 · shadow · would-skip=council,evidence,retro,revalidation,review · bound=every touched path is non-behavioural -->
      description of `src/rules/external-code-graph-interop.md` says "query IT
      first … do not grep from scratch"; the body and ADR-303 say the graph is an
      index, find with it and confirm with the source, and that no measured class
      beat grep. The description says the same as the body.
      verify: `grep -c 'do not grep from scratch' src/rules/external-code-graph-interop.md` -> /^0$/
- [~] **1.2 The image floor follows every skill that names it.**
      `image-likeness-and-rights` carries `consequence_class` and `packs:
      [ai-image]` but no `routes_to`, so a host that ships every skill whatever
      the packs (claude-code, codex) installs the six image skills without the
      rights check they tell the agent to run. The fix — `routes_to` naming all
      six — was built, tested and ratified 2/2 by the council (questions
      `agents/evidence/council/image-floor-routes-to-ratification-r1-20261029.question.md`
      and `-r2-`), then taken back out: it adds 43–57 tokens to the per-spawn
      preamble, which on `main` sits exactly at its zero-growth ceiling, and the
      only offsets were cuts to other safety rules. Deferred on blocker
      `b-preamble-grant`. Measured and declined along the way: reading any
      Markdown link to `rules/<id>.md` as a dependency flagged 20 skill→rule
      pairs, nearly all "See also" links — too noisy for a gate.
      verify: `npx vitest run tests/install/safety_floor_follows_skill.test.ts` -> 0 with a test asserting the rule ships with no pack active and that `routes_to` equals the skills naming it (written, seen red, removed with the change)
- [x] **1.3 A wrapped `Consumer-Impact:` trailer is reported, not dropped.** <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/_lib/consumer_impact.ts -->
      `_lib/consumer_impact.ts` returns no block for a paragraph whose value wraps
      onto an unindented line, so the trailer reads as absent rather than
      `invalid`. A paragraph that starts `Consumer-Impact:` and yields no block is
      `invalid` with its reason; the release class is unchanged (ADR-300). A
      `Consumer-Impact:` line quoted inside a prose paragraph stays absent, as
      the existing tests require.
      verify: `npx vitest run tests/lib/consumer_impact.test.ts -t 'wrapped Consumer-Impact'` -> 0 (red before)
- [x] **1.4 The council config comment says what the resolver does.** <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/ai_council/config.ts -->
      `ai_council/config.ts` says the daily call cap ships populated at 50/day;
      `cli_call_budget.ts` seeds nothing.
      verify: `grep -c 'SHIPS POPULATED' src/scripts/ai_council/config.ts` -> /^0$/
- [x] **1.5 The branch-protection contract names the standing bypass.** <!-- receipt: class=R0 · shadow · would-skip=council,evidence,retro,revalidation,review · bound=every touched path is non-behavioural -->
      `docs/contracts/branch-protection-policy.md` still states
      `bypass_actors: []`; the owner directive of 2026-10-25 set a
      pull-request-only bypass for the repository-admin role.
      verify: `grep -c 'standing-pull-request-bypass' docs/contracts/branch-protection-policy.md` -> /^[1-9]/
- [x] **1.6 Shipped guidance names a monitoring helper as an example, never a <!-- receipt: class=R0 · shadow · would-skip=council,evidence,retro,revalidation,review · bound=every touched path is non-behavioural -->
      mandate.** `sentry-integration`, `php-coder`, `bug-analyzer` and
      `docs/guidelines/php/logging.md` tell every consumer to use a
      project-specific `MonitoringHelper` and never the SDK directly. They say:
      use the project's declared wrapper if it has one, else the SDK.
      verify: `grep -rn 'never the Sentry SDK directly\|Always use the project.s .MonitoringHelper' src/skills docs/guidelines` -> /^$/

## Phase 2 — Records only a council can reconcile

- [x] **2.1 ADR-287 D1 and the WIP cap.** ADR-287 D1 says the active estate is <!-- receipt: class=R0 · shadow · would-skip=council,evidence,retro,revalidation,review · bound=every touched path is non-behavioural -->
      not capped at any number; `_lib/estate_wip.ts` caps it at 5 from the owner
      directive of 2026-10-24, which the ADR never cites. An amendment citing the
      directive is a record correction, council-decidable. Council 2026-10-29
      (2/2, `agents/evidence/council/records-that-match-their-code-20261029.prompt.md`
      and `.responses.md`): ADR-287 D1 is stale; annotate D1 only, citing the
      directive, without a whole-document `superseded_by`. Applied.
      verify: `grep -c '2026-10-24-throughput-over-ceremony' docs/decisions/ADR-287*.md` -> /^[1-9]/
- [x] **2.2 The T3 contract and the project registry.** <!-- receipt: class=R0 · shadow · would-skip=council,evidence,retro,revalidation,review · bound=every touched path is non-behavioural -->
      `docs/contracts/runtime-persistence-tiers.md` says no code writes T3; the
      ADR-299 project registry is cross-repository and kept indefinitely, and
      `later/road-to-a-memory-the-consumer-owns` records a global registry as
      rejected. Council 2026-10-29: resolve on ADR-299's own text first. ADR-299
      (accepted, owner and council) opens exactly this registry, machine-local,
      by use, no daemon — so the contract lacked the citation and the decline is
      history. Applied: the contract names ADR-299 as the one opening of T3 (its
      Iron Law fence is unchanged), the decline gains a resolution note.
      verify: `grep -c 'project_registry\|ADR-299' docs/contracts/runtime-persistence-tiers.md` -> /^[1-9]/

## Blockers

### blocker: b-preamble-grant

- **Status:** open — 2026-10-29.
- **Owner:** the owner (a preamble-payload grant is human-approved by
  `src/config/preamble-payload-exceptions.json`'s contract).
- **Unblocks:** 1.2.
- **Closes when:** the owner grants ~45 tokens for the image floor's
  `routes_to` (OQ-42), or names an offset, or declines — then 1.2 becomes
  `[-]` with that answer.

### blocker: b-council-reconcile-records

- **Status:** resolved — 2026-10-29, council round 2/2 present, no split;
  both corrections landed
  (`agents/evidence/council/records-that-match-their-code-20261029.responses.md`).
- **Owner:** council.

## Risk Register

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Floor widening installs the image rule for consumers who never use images | product | `routes_to` follows six skills; a consumer of one of them now receives the rule | The rule only fires on image work; the skills already depend on it | Phase 1 — Records a reader acts on |
| 2 | `invalid` trailer flips a release | implementation | Reporting a wrapped trailer as invalid could change the computed release class | 1.3 asserts the class is unchanged | Phase 1 — Records a reader acts on |

## Acceptance Criteria

- [ ] AC-1 — Every Phase 1 verify line passes.
- [x] AC-2 — Phase 2 items each carry a council record or stay deferred with
      their blocker named.
