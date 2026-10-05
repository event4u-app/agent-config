---
complexity: structural
status: ready
execution:
  mode: phase-checkpoints
depends: [road-to-a-rule-carrier-that-works-outside-the-repo, road-to-rule-laws-that-can-stand]
estate_offset_exempt: "Round inbox-2026-10-c reproduced the host's 150k notice on a fresh install: 102 unconditional files and 338,225 chars under ~/.claude/rules, because install.ts has zero references to lean_projection and the delivery flip ADR-267 shipped thins only the project tree consumers do not get. The subject has arrived in at least 22 consumed rounds and no active roadmap owns the installed layer; this file is the only one whose done state removes the notice."
estate_growth_exempt: "+1 open_blockers for `default-flip-of-the-installed-layer`. Newly discovered, not a repaired undercount: changing what every consumer's default install writes is a consumer-facing default flip, which an agent may prepare and measure but not take, so the owner decision has to exist as a blocker before Phase 3 can be scheduled."
relates:
  - slug: road-to-a-rule-carrier-that-works-outside-the-repo
    relation: depends
    note: Phase 1 here may not start before that file's Phase 1 has merged; thinning before the carrier works turns over-delivery into under-delivery.
  - slug: road-to-rule-laws-that-can-stand
    relation: depends
    note: The stub-plus-law form and the consequence class come from that file's Phase 2.
  - slug: road-to-standing-rule-delivery-per-machine
    relation: extends
    note: Stub. Its AC-0 becomes dischargeable once Phase 3 here ships.
  - slug: road-to-delivery-on-hook-hosts
    relation: disjoint
    note: Later. Owns `host-injection-effect.json`; step 2.4 here only reads its row and records the new exposure state.
---
# Road to an installed layer that is thinned

> **Source:** `agents/tmp.old/inbox-2026-10-c/` — a round of four roadmap drafts
> and one transcript on the host's 150k instruction-budget notice, pinned to
> `main` @ `9bc8cd4f2` (16.2.0). Verified against `main` @ `a03f60c46` on
> 2026-10-01. Council record:
> `agents/evidence/council/inbox-2026-10-c-standing-form.md`.

## Goal

The layer a Claude install writes under `~/.claude/rules` is the thinned one,
first as an opt-in and then as the default, with one setting to roll back.
Done means: an opted-in install stands under 75,000 package-owned characters and
under the 65,000 target on the default scope; an arrival record from a real
session shows the stubs and standing laws loaded and every matched delivery
under the budget; and the default changes only after the owner decides it on
those records.

## Context

Reproduced on 2026-10-01:

- The global install step copies `dist/agent-src/rules` verbatim and rewrites
  frontmatter only (`src/scripts/install.ts:1806-1814`, `:3073-3100`);
  `grep -c lean_projection src/scripts/install.ts` returns 0. Thinning happens
  only in `generate_rule_symlinks`, the maintainer projection
  (`src/scripts/condense.ts:1118`, `:1182`).
- The round's real install into an empty `HOME` measured 102 unconditional
  files and 338,225 characters, the three largest being the three the host
  named. The maintainer machine's notice reported 120 files and 377.7k; the
  difference includes instruction files that are not this package's.
- The thin stub's body pointer is project-relative
  (`src/scripts/project_thin_rules.ts:309`) and resolves nowhere from
  `~/.claude/rules`.
- The shipped template sets `lean_projection.mode: delivery`
  (`src/config/agent-settings.template.yml:212-214`). Once the installer reads
  the mode through the shared resolver, the template value alone would thin
  every consumer — a default flip by side effect. Phase 1 therefore keys the
  installer on an explicitly set value, never on the template.
- ADR-267 decision 2 confines thinning to the projector; ADR-228 is `accepted`
  while `claudeRuleRewrite.ts:213` emits `paths:` on the global layer.

## Phase 1 — An opt-in thinned install

- [x] **1.1 The installer applies the projector's predicate when asked.** With
      `lean_projection.mode: delivery` set on a layer other than the shipped
      template, the global install step for `claude-code` writes the stub form —
      stub plus law for the consequence class, pointer stub for the rest;
      kernel, trigger-less and path-only rules stay full as `build_thin`
      decides. The body pointer is absolute. Ownership keys survive.
      verify: `npx vitest run tests/scripts/install_thin_layer.test.ts` -> 0
- [x] **1.2 One rollback.** `lean_projection.mode: eager-all` plus a reinstall
      writes today's full layer again.
      verify: `npx vitest run tests/scripts/install_thin_layer.test.ts -t rollback` -> 0
- [x] **1.3 Upgrades converge.** An upgrade from a 16.2.0-shaped `HOME` ends at
      the thinned layer when opted in; user-modified rule files are preserved
      and reported, never overwritten; the receipt prints both standing totals.
      verify: `npx vitest run tests/scripts/install_thin_layer.test.ts -t upgrade` -> 0
- [x] **1.4 A combined-total warning.** At install, the receipt reports
      package-owned and foreign instruction characters against the host's
      published limit, and warns when the combined total crosses 80 % of it.
      verify: `npx vitest run tests/scripts/installed_layer_report.test.ts -t combined` -> 0

> **Closed 2026-10-05.** A second obstacle sat under the stated one and is
> repaired in the same branch: `lean_projection.*` was absent from
> `MERGEABLE_KEYS`, so `load_agent_settings` read the user-global layer and threw
> the value away. On an ADR-020 global-only install that layer is the ONLY one
> that can carry the opt-in, so 1.1 was unsatisfiable on exactly the install
> shape it is about. Measured both directions on an isolated probe before and
> after the whitelist row. The stub body pointer is absolute now
> (`absoluteBodyLinkPrefix`); the shipped relative prefix resolved from an
> installed layer never, not merely imprecisely.

## Phase 2 — Records from opted-in machines

- [ ] **2.1 An arrival record per host version.** From the instruction-load
      observer of the carrier roadmap's step 0.2, one real session per supported
      host version: which stubs and standing laws loaded at start and after
      compaction; whether a user-layer `paths:` rule loads on `Read`, `Edit`, a
      `Write` that creates the file and a Bash-first edit; every matched
      delivery under the 8,000 budget and none replaced by a preview.
      verify: `grep -c 'host version' agents/evidence/analysis/installed-arrival-*.md` -> /^[1-9]/
- [x] **2.2 A standing-only fixture.** With the carrier disabled, the loaded
      text of an opted-in install contains every consequence-class law
      byte-equal to its source section.
      verify: `npx vitest run tests/scripts/install_thin_layer.test.ts -t standing-only` -> 0
- [ ] **2.3 Does a stub get used?** Per session, reads of a rule body path that
      were not preceded by a delivery of that rule, from records the dispatcher
      already writes; and per rule, deliveries against the characters it stands
      at, zeros included. A rule never delivered and never read is a candidate
      for the owner, not an automatic removal.
      verify: `grep -c 'self-served' agents/evidence/analysis/stub-use-*.md` -> /^[1-9]/
- [ ] **2.4 The injection-effect row, on its own terms.** After the opt-in, the
      injected copy is the only copy for the thinned rules; record the new
      exposure state beside `src/config/host-injection-effect.json:8` without
      changing that file's verdict, which `road-to-delivery-on-hook-hosts` owns.
      verify: `grep -c 'thinned' agents/evidence/analysis/installed-arrival-*.md` -> /^[1-9]/

> **2.1, 2.3 and 2.4 need a real opted-in machine**, which this branch cannot
> produce: each one's verify greps an `agents/evidence/analysis/` record written
> from a live session after an install has actually been opted in. 2.2 is the
> exception and is closed — it is a fixture, not a session record.

## Phase 3 — The default, decided

- [ ] **3.1 Flip the default.** Only after blocker
      `default-flip-of-the-installed-layer` is resolved: the installer thins by
      default for `claude-code`, the receipt announces both numbers, and the
      rollback of 1.2 stays one setting.
      verify: `npx vitest run tests/scripts/install_thin_layer.test.ts -t default` -> 0
- [ ] **3.2 The ceiling becomes required.** The installed-layer report fails CI
      above the measured thinned total plus 10 %, never above 75,000, and moves
      down only.
      verify: `npx vitest run tests/scripts/installed_layer_report.test.ts -t ceiling` -> 0
- [ ] **3.3 The decision record.** An ADR extends ADR-267 decision 2 from the
      projector to the installer, records why the template value is not a
      consent, and marks ADR-228's global-layer statement superseded.
      verify: `./scripts-run src/scripts/check_adr_frontmatter` -> 0
- [ ] **3.4 A new routed rule declares its cost.** A routed rule added after
      the flip fails CI without a law section under 2,000 characters and at
      least one trigger a prompt can fire.
      verify: `npx vitest run tests/scripts/lint_rule_law_section.test.ts -t new-rule` -> 0
- [ ] **3.5 No other host worse.** `check_host_tree_parity` is unchanged, and
      the installed-layer report adds one row per host with a published limit.
      verify: `./scripts-run src/scripts/check_host_tree_parity` -> 0
      > Both limbs already hold as of 2026-10-05 — `check_host_tree_parity`
      > exits 0 (`2 non-delivery host tree(s) byte-identical to eager-all`) and
      > the report carries one row per host with its limit. Left OPEN anyway:
      > the step asks whether the FLIP made another host worse, and there has
      > been no flip, so closing it now would assert a guarantee about a state
      > that does not exist. It closes with 3.1, on a re-run, not on this note.

## What this roadmap deliberately does not do

- No thinning of any other host (ADR-267).
- No kernel-plus-index layer in place of stubs: it changes the file set ADR-267
  decision 5 protects, and 2.3 is the record that would justify proposing it.
- No `rule_packs` default change in the same window, so the two movements stay
  attributable.
- No behavioural judge as an exit condition (ADR-202 closed it); the gates are
  arrival, standing-only presence and stub use.

## Blockers

### blocker: default-flip-of-the-installed-layer
- **Status:** open
- **Owner:** owner
- **Blocks:** 3.1
- **What to do:** pick exactly one — (a) flip the default for `claude-code`
  once `agents/evidence/analysis/installed-arrival-*.md` exists for the current
  host version and the step 2.2 fixture is green, or (b) keep the thinned layer
  opt-in and record in the ADR of step 3.3 that consumers choose it.
- **Resolved when:** the ADR of step 3.3 names (a) or (b), with the arrival
  record it relied on.
- **Recommendation:** (a) — every default install otherwise keeps tripping the
  host notice at 2.25 times its limit, and the opt-in records are the evidence
  the council asked for before an irreversible-looking change.
- **If you do nothing:** opted-in machines stand under the limit, every other
  install keeps loading 338,225 characters, and the notice keeps arriving as an
  inbox round.

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| D1 | contested-technical | council:inbox-2026-10-c-standing-form | Opt-in first, default only after records | Both seats, 2/2, rejected a default flip before measurement | The opt-in records are not obtainable on any machine this repository observes |
| D2 | contested-technical | council:inbox-2026-10-c-standing-form | Target 65,000, hard 75,000 package-owned standing characters | Both seats; the host limit is shared with the user's own files | The host publishes a different limit or a per-file rule |
| D3 | reversible-technical | agent | The template value is not consent to thin | The template already says `delivery`; reading it would flip every consumer as a side effect of the resolver fix | — |
| D4 | product-owned | owner | Whether the default flips | Consumer-facing default change; blocker `default-flip-of-the-installed-layer` | — |

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-01 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | A missed trigger leaves a pointer where a body was | product | Prompt-only reach is 305/335; after thinning a miss costs the rule's mechanics in that session. | The consequence class keeps its law standing; 2.3 counts self-served reads; the rollback stays one setting. | Phase 2 — Records from opted-in machines |
| 2 | The upgrade overwrites a consumer's edited rule | implementation | Converging an existing install rewrites files in place. | 1.3 preserves and reports user-modified files and fails its test if one is overwritten. | Phase 1 — An opt-in thinned install |
| 3 | The host stops honouring user-layer files the way 2.1 recorded | implementation | Host versions change load semantics without notice. | 2.1 is per host version, and 3.2's report names the host version it read. | Phase 3 — The default, decided |

## Acceptance Criteria

- [ ] AC-1 — An opted-in install into an empty `HOME` stands under 75,000
      package-owned characters, read by the installed-layer report.
- [ ] AC-2 — One committed arrival record per supported host version.
- [ ] AC-3 — The standing-only fixture shows every consequence-class law loaded
      with the carrier off.
- [ ] AC-4 — The default changed only through the resolved blocker, and every
      non-Claude host tree is unchanged.
