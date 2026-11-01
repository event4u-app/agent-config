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
    The image-floor grant nears expiry (2027-01-27) or an offset for it appears.
  when: >
    Before 2027-01-27; 1.7 is the only open step.
  who: >
    The owner.
estate_growth_exempt: "THIS CHANGE (2026-10-29) adds one later/ roadmap and one open blocker: later_roadmaps +1, open_blockers +1. Every other item of this roadmap is done in the same change; what is left is one owner decision (b-preamble-grant, OQ-42) on a rights-floor fix that was built and ratified 2/2 and then held back only because the per-spawn preamble on main sits exactly at its zero-growth ceiling. Parking it here keeps the item alive instead of dropping it; it closes on the owner's answer."
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
>
> **Arrivals:** 2 — latest `inbox-2026-11-d` (2026-11-01): the 19.1.0 and
> 19.2.0 review sets re-verified at `2ccb435632`; eight record drifts with no
> other owner landed as Phase 3. Earlier: `inbox-2026-10-bk` / `-bl`.

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
- [x] **1.2 The image floor follows every skill that names it.** <!-- receipt: class=R1 · shadow · would-skip=council,evidence,retro,revalidation,review · bound=test-only change -->
      `image-likeness-and-rights` carried `consequence_class` and `packs:
      [ai-image]` but no `routes_to`, so a host that ships every skill whatever
      the packs (claude-code, codex) installed the six image skills without the
      rights check they tell the agent to run. It now routes to all six, on the
      owner's answer to OQ-42 (2026-10-29), which grants the +43 tokens of
      per-spawn preamble this costs (`src/config/preamble-payload-exceptions.json`,
      `oq-42-image-floor-routes-to`). Measured and declined along the way:
      reading any Markdown link to `rules/<id>.md` as a dependency flagged 20
      skill→rule pairs, nearly all "See also" links — too noisy for a gate.
      verify: `npx vitest run tests/install/safety_floor_follows_skill.test.ts -t "image floor"` -> 0 (red without the `routes_to`)
- [ ] **1.7 Repay the image-floor grant before it expires.** The grant is a
      loan against the zero-growth ceiling: by 2027-01-27 the per-spawn
      preamble returns to its watermark 135,824 through a reduction elsewhere
      that does not weaken a floor, and `repaid_at` records the measurement —
      or a fresh grant is approved.
      verify: `jq -e '.exceptions[] | select(.id=="oq-42-image-floor-routes-to") | .repaid_at != null' src/config/preamble-payload-exceptions.json` -> 0
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

## Phase 3 — Records the 19.1.0 and 19.2.0 reviews caught

Round `inbox-2026-11-d`, verified at `2ccb435632`. Each item is a record that
says one thing while the code or the owner's own words say another, plus the
cheap check that would have caught it.

- [x] **3.1 "The owner records it" is tied to the owner's words.** The
      2026-10-31 directive made a ledger entry the owner's approval, and the
      approvals step then passed `--approved` for every live grant read from the
      pull request's own checkout: a grant written with `approval_event: "ok"`
      approved itself (executed, `computeCeiling`). The step now honours a live
      grant only when its `approval_event` cites an owner-directive file that
      already exists at the merge-base — the predicate `check_new_adr_evidence`
      applies to owner ADRs — so the pull request adding a grant cannot also
      write its approval, and no second person is added. The module header
      (rule 2), its error text and the ledger's `entry_shape` / `honest_limit`
      described the superseded platform-review rule and now describe this one.
      Executed both ways: the live `oq-42` grant is approved at `HEAD`; a grant
      citing a directive the same change adds, and one citing none, are not.
      verify: `grep -c 'exists at the merge-base' .github/workflows/standing-payload-delta.yml` -> /^[1-9]/
- [x] **3.2 The #2754 bypass record says who executed it.** It read "Who
      acted: the repository owner", while the owner's quoted words in the
      directive's addendum ("Du mergst selbst …") say the agent merged; the #2768
      record already split decided/executed. Now the same split. Whether the
      directive's line 26 ("an agent never runs `gh pr merge --admin`") or the
      addendum stands is the owner's, not a record correction: OQ-56.
      verify: `grep -c 'Who executed:' agents/evidence/bypass-records/2026-10-29-standing-bypass-2754.md` -> /^1$/
- [x] **3.3 Owner-question ids are issued once.** OQ-36 and OQ-37 were each
      issued twice (rescore K3). The logging-route pair is renumbered OQ-54/55
      (its one inbound reference, `road-to-a-map-that-knows-what-happened` L.6,
      updated); the observation-provider and `--verify` pair keep their ids,
      which code and the active roadmap cite. A test now refuses a repeated id.
      verify: `npx vitest run tests/contracts/owner_question_ids_unique.test.ts` -> 0
- [x] **3.4 A release that touched the installer says so without a trailer.**
      19.2.0 carried 0 `Consumer-Impact:` trailers in 187 commits while adding a
      `stop` binding on seven platforms (`6060f0cb3c`), and shipped as `none`.
      A span with no recorded trailer that changed `src/scripts/hook_manifest.yaml`
      or `src/install/` is now floored at `notice`; an explicit declaration,
      `none` included, still wins. The 19.2.0 entry is added to the impact map
      as `notice`. A parity reading (v29) found "nothing contradicts `none`"
      because it spot-checked `src/install` and settings only, not the hook
      manifest.
      verify: `npx vitest run tests/lib/consumer_impact.test.ts -t "consumer surface"` -> 0
- [x] **3.5 ADR-240's amendment clause has a reader.** "An amendment to an
      existing record must meet [the floor] as well" was checked by nothing:
      `check_new_adr_evidence` read added records only. It now reads the
      amendment sections a diff adds to an existing record; one that claims an
      owner decision must cite an existing owner-directive file. Replayed against
      `19.1.0`, it refuses exactly ADR-297's two amendments of 2026-11-01; against
      `origin/main` it passes. Forward-only, as ADR-240 is: the two existing
      amendments are not rewritten.
      verify: `npx vitest run tests/scripts/check_new_adr_evidence.test.ts -t "amendments"` -> 0
- [x] **3.6 The context-fill comment stops citing a function that does not
      exist.** `sessionContextFill` delegated "a compaction since" to
      `cold_return.lastResponse`, which exists nowhere and no caller checks. The
      comment now states the limit: a just-compacted session can read its
      pre-compaction fill until the status line writes a fresh snapshot, which is
      unmeasured.
      verify: `grep -c 'lastResponse' src/scripts/_lib/pressure.ts` -> /^0$/
- [x] **3.7 `BREAKING_CHANGES.md` states the 2026-10-30 major rule.** Its
      "Why majors are frequent" said an installer-path change "legitimately
      trips a Major"; the owner directive and ADR-300 say only a removed
      consumer-facing path does, and installer source needs
      `Consumer-Impact: action`.
      verify: `grep -c 'removing a consumer-facing installer path' BREAKING_CHANGES.md` -> /^1$/
- [x] **3.8 A consumer skill stops linking a maintainer-only rule.**
      `react-shadcn-ui` linked `rules/source-confidentiality.md`, which a
      consumer install does not ship (workspace `agent-config-maintainer`); the
      sentence now states the policy without the dead link.
      verify: `grep -c 'rules/source-confidentiality.md' src/skills/react-shadcn-ui/SKILL.md` -> /^0$/

## Blockers

### blocker: b-preamble-grant

- **Status:** resolved — 2026-10-29, owner answer OQ-42 (a)
  (`agents/evidence/owner-directives/2026-10-29-oq-42-image-floor-grant.md`).
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
| 3 | The impact floor over-notifies | product | A span touching `hook_manifest.yaml` only for a maintainer-only concern now reads `notice` to every consumer | An explicit `Consumer-Impact: none` trailer still wins; the floor fires only on a span with no trailer at all | Phase 3 — Records the 19.1.0 and 19.2.0 reviews caught |
| 2 | `invalid` trailer flips a release | implementation | Reporting a wrapped trailer as invalid could change the computed release class | 1.3 asserts the class is unchanged | Phase 1 — Records a reader acts on |

## Acceptance Criteria

- [x] AC-1 — Every Phase 1 verify line passes.
- [x] AC-2 — Phase 2 items each carry a council record or stay deferred with
      their blocker named.
- [x] AC-3 — Every Phase 3 verify line passes.
