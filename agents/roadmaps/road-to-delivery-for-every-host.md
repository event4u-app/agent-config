---
complexity: structural
execution:
  mode: phase-checkpoints
estate_growth_exempt: "Owner-instructed, 2026-09-07. Charges +1 active roadmap. The lever it flips is built and measured (`docs/CLAIMS.md:365`) and held by no active roadmap; its former owners sit in later/ on gates this roadmap does not need (see Relates). The grace ceiling in `src/config/preamble-payload-budget.json:81-83` expires 2026-11-10 with 73 tokens of headroom at 6a98e0e."
estate_offset_exempt: "Offsets nothing at promotion. Phase 7 dispositions `later/road-to-token-saving.md` and `later/road-to-token-saving-HUMAN-MEASUREMENT.md` for the rule layer under owner ruling E7."
---

# Road to delivery for every host

> **Source:** owner instruction 2026-09-07, verified against the tree at `6a98e0e` (v14.20.0). Every number below was reproduced at that pin with the repo's own instruments. Owner rulings E1/E2/E7 are **decided in this file**; they are not blockers, not council questions, and not open for re-litigation by any run.

## Goal

Claude Code sessions start with at most 40,000 standing tokens (rules bucket ≤ 20,000) instead of 138,200, every host not in `lean_projection.hosts` keeps a rule tree byte-identical to `eager-all`, and nothing is removed from any install — witnessed by `check_preamble_payload_budget` before and after, and by a per-host tree diff that is empty for every non-Claude host.

## Prerequisites

- [ ] Read `AGENTS.md`, `docs/enforcement-by-host.md:18-44`, `docs/CLAIMS.md:365`, `src/config/hook-token-budget.json:33,39-40`.
- [ ] Run `agent-config roadmap:context` for this file and record the Relates rows below with the probe's `scanned:` line.
- [ ] Run [`plan-confidence-gate`](../../src/agent-src/contexts/execution/plan-confidence-gate.md) before the first checkbox.

## Context

Measured at 6a98e0e with `./scripts-run src/scripts/check_preamble_payload_budget`: project-scope rules 119 files (102 `type: auto`, 9 `always`, 5 `manual`, 3 quoted-`auto`), preloaded skills catalog 299 skills, CLAUDE.md hierarchy — total **138,200 tok** (chars/4) against baseline 102,520 (`preamble-payload-budget.json:23`), design ceiling 107,646 (`:80`), grace ceiling 138,273 measured 2026-09-02, expiring 2026-11-10 (`:81-83`).

What exists:
- `lean_projection.mode ∈ {eager-all, thin, delivery}`, default `eager-all` (`src/scripts/_lib/lean_projection_mode.ts:19,21`), read from `.agent-settings.yml` by `_lib/hook_settings.ts:82-104`.
- `delivery` writes thin stubs (`src/scripts/project_thin_rules.ts`, `build_thin`) and the `rule-inject` concern (`src/scripts/hooks/rule_inject_hook.ts`, manifest `src/scripts/hook_manifest.yaml:820`) re-delivers a rule body on trigger match, bound on `user_prompt_submit`, `pre_tool_use`, `pre_compact` (`:1221-1222,1240`). Measured: 120,582 → 18,573 exact-BPE standing tokens, 579/579 byte-equal deliveries, 94/94 labelled rules reachable, 0 false fires on 194 near-misses, p95 0.61 ms gate-open (`docs/CLAIMS.md:365`).
- Unpaid activation charge: `rule-inject` budget row 20,480 bytes (`hook-token-budget.json:33`) above slot sums `user_prompt_submit` 4,096 and `pre_tool_use` 2,048 (`:39-40`). The row's own reason text names the flip as the run that must move those rows.

Defects this roadmap repairs:
- **D1 — the flip is not host-scoped.** Under `thin`/`delivery`, `condense` writes stubs into every `TOOL_DIRS` entry (`.claude/rules`, `.cursor/rules`, `.clinerules`; `src/scripts/condense.ts:741-745`), the branch at `:1187-1188` being host-independent. Only Claude Code honours a hook verdict (`docs/enforcement-by-host.md:18-28`, corrected 2026-09-07); whether Cursor/Cline inject hook stdout into context is unmeasured. A project-wide flip today would reduce two hosts' `.md` trees to pointers.
- **D2 — a stale parking comment ties delivery to the thin quality null.** `condense.ts:1131-1134` says the flip "is parked behind the thin-projection honest null (36.2% < 48%)". That gate belongs to `thin`, judged by an instrument ADR-202 closed. `delivery` re-delivers the same bytes and is licensed by `CLAIMS.md:365` on delivery equivalence and cost; it needs a recall floor, not a quality judge. Every run that read D2 parked the flip.
- **D3 — 8 `auto` rules are outside the labelled corpus** (102 `type: auto` vs 94 files in `tests/eval/routing-matrix/`). Unlabelled means unmeasured reachability.

**Owner rulings (decided 2026-09-07, final):**
- **E1** — the package ships `lean_projection.mode: delivery` with `lean_projection.hosts: [claude-code]` as the **default**. Consumers may set `eager-all`; rollback is one setting. Rationale: the completeness invariant holds (every rule file is written, every body delivered on match), and an opt-in nobody flips is no flip — `delivery` has been "available" since it was measured.
- **E2** — slot strategy: the concern delivers on `user_prompt_submit` and `pre_compact`; `pre_tool_use` delivery is disabled unless Phase 3.1 shows a labelled rule reachable **only** there. The `user_prompt_submit` sum cap moves to the measured p90 gate-open fire size rounded up to 512 bytes; `pre_tool_use` stays 2,048. This is the activation charge the budget file itself defers to the flipping run; it is **not** config weakening.
- **E7** — `later/road-to-token-saving.md` and `later/road-to-token-saving-HUMAN-MEASUREMENT.md` are archived for the rule layer once Phase 7.1 flips the claim; any non-rule-layer residue moves to a stub with a `review_by`.

**Relates** (fill from the probe):
- `later/road-to-thin-flip-under-anchor-scoring.md` — disjoint (thin quality A/B; this roadmap flips delivery, not thin).
- `later/road-to-deferred-rule-retriever.md` — disjoint (retriever behind ADR-124; this roadmap adds no retriever).
- `later/road-to-mixed-trigger-activation-cost.md` — depends (Phase 2 labels exactly the mixed triggers it costs).
- `archive/road-to-host-enforcement-truth.md` — extends (its 2026-09-07 host table is Phase 1's host axis).
- `road-to-delivery-on-hook-hosts.md`, `road-to-skill-menu-economy.md` — successors; both depend on this file's Phase 1.

- **Feature:** none
- **Jira:** none

## Phase 0: Freeze the baseline per host

- [ ] **0.1 Write `agents/evidence/analysis/standing-payload-by-host-2026-09.md`** at one commit: per host (`claude-code`, `cursor`, `cline`, `windsurf`, `gemini`, `copilot`, `augment`, `codex`, `cowork`) the rule files the host loads, byte and chars/4 token sums, and the writer of each file as `file:line` into `condense.ts` or `src/install/*.ts`. Record both units once (chars/4 138,200; exact BPE per `CLAIMS.md:365` method).
      verify: artefact exists with a commit pin; re-run at the same pin is byte-identical; each host row names a writer with `file:line`.
- [ ] **0.2 List the 8 unlabelled `auto` rules (D3)** by name, with whether each has any `triggers:`.
      verify: `ls tests/eval/routing-matrix/*.yaml | wc -l` plus the listed names equals the `type: auto` count in `dist/agent-src/rules`.

## Phase 1: Host-scoped delivery (repairs D1)

- [ ] **1.1 Add `lean_projection.hosts`** (list; default `[claude-code]`) beside the mode reader in `_lib/hook_settings.ts:82-104` and export a `resolveLeanProjectionHosts()` from `_lib/lean_projection_mode.ts`. Unknown host ids are dropped with a warning; the set never widens implicitly.
      verify: unit tests — absent → `[claude-code]`; typo'd id dropped and reported; `mode` unset resolves `eager-all` regardless of `hosts`.
- [ ] **1.2 Gate the stub branch on the host.** At `condense.ts:1187` write thin files only when `_DIR_TOOL_ID[tool_dir]` (`:757-760`) is in `hosts`; every other `TOOL_DIRS` entry keeps today's symlink/emitter path.
      verify: fixture repo with `mode: delivery`, `hosts: [claude-code]` — `.claude/rules` holds stubs; `.cursor/rules/*.md` and `.clinerules` are byte-identical to an `eager-all` run (`diff -r` empty).
- [ ] **1.3 Teach `check_rule_projection_integrity` the host axis:** a stub is complete for a delivery host; a full body is required for every other host.
      verify: the 1.2 fixture passes; a fixture that stubs `.clinerules` fails naming host and reason.
- [ ] **1.4 Non-regression gate (no new CLI verb):** a check in the consistency workflow asserting that every host not in `hosts` produces a rule tree byte-identical to `eager-all` under any `lean_projection` setting.
      verify: green on the tree; red on a planted one-byte change in a Cline entry.

## Phase 2: Recall floor for Claude before the flip

- [ ] **2.1 Label the 8 rules from 0.2** in `tests/eval/routing-matrix/` with ≥ 1 positive and ≥ 1 near-miss row each.
      verify: `model_rule_injection --corpus tests/eval/routing-matrix --endpoints` reports 102/102 reachable, 0 false fires; near-miss count ≥ 202.
- [ ] **2.2 An `auto` rule with an empty `triggers:` list is never thinned.** In `build_thin`, such a rule projects eagerly on every host and the run prints `D3: trigger-less auto rule <file>`.
      verify: fixture rule `type: auto`, no triggers → full body in `.claude/rules` under `delivery`, D3 line printed.
- [ ] **2.3 MUST-LOAD floor covers every `always` rule.** Re-run the `trigger-coverage` floor (`_lib/value_ladder.ts:480`); add any `type: always` rule outside it.
      verify: floor reports N/N with N ≥ 26 and N ≥ 9.
- [ ] **2.4 Re-delivery after compaction is a fixture.** State in `rule_injection.ts`'s header what is re-delivered after `pre_compact` and add one fixture: one matched rule, one compaction, one further matching turn → body present.
      verify: fixture green.

## Phase 3: Pay the activation charge (E2)

- [ ] **3.1 Measure per-fire bytes per slot** gate-open on the frozen corpus: p50/p90/max for `user_prompt_submit`, `pre_tool_use`, `pre_compact`; record which labelled rules (if any) are reachable only on `pre_tool_use`.
      verify: numbers in the Phase 0 artefact with the producing command.
- [ ] **3.2 Apply E2.** Remove `rule-inject` from the `pre_tool_use` binding unless 3.1 lists a rule reachable only there (then keep it and say which); set `user_prompt_submit` sum cap in `hook-token-budget.json:39` to the 3.1 p90 rounded up to 512, `pre_tool_use` stays 2,048, `rule-inject` row stays 20,480; write the `_reason` per the file's own raise rule, citing this roadmap and E2.
      verify: hook token budget gate green with `mode: delivery` in this repo's `.agent-settings.yml`; the diff touches exactly the rows E2 names.
- [ ] **3.3 Latency gate green:** `pre_tool_use` p95 ≤ 175 ms, `user_prompt_submit` gate-open measured and recorded.
      verify: CI latency gate green on the flipped repo.

## Phase 4: Flip for Claude Code (E1)

- [ ] **4.0 Repair D2.** Replace the comment at `condense.ts:1131-1134` with: `thin` is parked behind the thin quality null (ADR-202); `delivery` is licensed by `docs/CLAIMS.md:365` on delivery equivalence and its recall floor (Phase 2 of this roadmap) and is not gated by that null.
      verify: `grep -n '36.2' src/scripts/condense.ts` returns a line that names `thin` only.
- [ ] **4.1 ADR recording E1** (`delivery` default, `hosts: [claude-code]`, rollback = `eager-all`, completeness invariant statement, per-host scope). It amends the CLAIMS row and states what it does not reopen (ADR-202, ADR-094).
      verify: ADR exists; `DEFAULT_LEAN_PROJECTION_MODE` and the hosts default match it.
- [ ] **4.2 Flip this repo first.** `.agent-settings.yml` → `delivery`/`[claude-code]`; full gate set green.
      verify: `check_preamble_payload_budget` on the repo reports rules ≤ 20,000 tok, total ≤ 40,000.
- [ ] **4.3 Flip the package default** in a separate PR containing only the default change, the ADR link and regenerated projections.
      verify: fresh install fixture on a Claude Code host measures ≤ 40,000 total; on a Cursor-only fixture the tree equals `eager-all`.
- [ ] **4.4 Lower the baseline, retire the grace ceiling.** `preamble-payload-budget.json:23` becomes the measured post-flip total; the `grace_ceiling` block (`:79-83`) is removed in the same commit with a `history` entry naming this roadmap. Ceilings move down only.
      verify: gate green at the new baseline; `grep -c grace_ceiling src/config/preamble-payload-budget.json` returns 0.
- [ ] **4.5 Rollback fixture.** flip → `eager-all` → `diff -r` against a never-flipped tree is empty; documented in `docs/contracts/rule-router.md`.
      verify: fixture green.

## Phase 7: Truth surfaces

- [ ] **7.1 Flip `docs/CLAIMS.md:365`** to a backed claim scoped `claude-code` only, evidence = the Phase 0 artefact plus post-flip census; `non_inference` states the per-host scope. No README wording added.
      verify: `check_claims` green; the evidence pointer resolves.
- [ ] **7.2 Per-host cost table** generated from the census into the contract README points at; the generator fails when the census is missing.
      verify: table numbers equal the census.
- [ ] **7.3 Apply E7** to the two `later/` token roadmaps.
      verify: both files have a disposition; `lint_roadmap_later_disposition` green.

## Acceptance Criteria

- [ ] `check_preamble_payload_budget` on a Claude Code install: total ≤ 40,000 tok, rules ≤ 20,000.
- [ ] Every host not in `lean_projection.hosts`: rule tree byte-identical to `eager-all` (Phase 1.4 gate in CI, green).
- [ ] 102/102 `auto` rules reachable, 0 false fires; MUST-LOAD floor N/N.
- [ ] 119 rule files, 299 skills, all personas/contexts/commands still installed.
- [ ] Rollback fixture green; grace ceiling gone; all quality gates green.

## Kill register (this roadmap's IDs)

- **K1** Rule-MCP (pull cannot carry obligations).
- **K3** Thinning any host outside `hosts`.
- **K4** Raising `design_ceiling`, any stub ceiling, or the `rule-inject` row.
- **K5** Cutting rule prose to hit the budget.
- **K6** New CLI verb (ADR-041).
- **K7** Citing ADR-202 / the thin null as a gate for `delivery`.
- **K8** A daemon or retriever for delivery.
- **K9** Moving this file to `later/`, descoping steps to a carrier, or rewriting an AC. A step that fails enters a fix loop; a step that needs a decision this file does not contain is reported as a question in the PR body, and the step stays `[ ]` with the question quoted.

## Notes

- Completeness invariant (owner directive 2026-08-30): every user receives 100 % of the package. Stubs are a form, not a subset. Phase 1.4 witnesses the non-Claude hosts; 2.2 witnesses that no `auto` rule vanishes through an empty trigger list.
- Source-silence: no external repository is referenced or needed.
