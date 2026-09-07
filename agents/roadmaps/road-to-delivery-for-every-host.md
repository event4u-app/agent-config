---
complexity: structural
status: ready
execution:
  mode: phase-checkpoints
owner: maintainer
depends: road-to-mixed-trigger-activation-cost
relates:
  - slug: road-to-mixed-trigger-activation-cost
    relation: depends
    note: >
      Parked. Phase 2 labels exactly the mixed triggers that roadmap prices; its
      cost model consumes this file's corpus, not the reverse.
  - slug: road-to-host-enforcement-truth
    relation: extends
    note: >
      Archived. Its 2026-09-07 host table is this file's host axis — Phase 1 reads
      it rather than re-deriving which hosts bind which slots.
  - slug: road-to-thin-flip-under-anchor-scoring
    relation: disjoint
    note: >
      Parked on the thin quality A/B behind ADR-202. This file flips `delivery`,
      which re-delivers identical bytes and needs a recall floor, not a judge.
  - slug: road-to-deferred-rule-retriever
    relation: disjoint
    note: >
      Parked behind ADR-124. This file adds no retriever and no daemon (K8).
estate_growth_exempt: "Owner-instructed 2026-09-07. Charges +1 active roadmap. Measured at 0918def55: `active_roadmaps` floor 4 at origin/main — the floor is the base-ref measurement, not a stored number (ADR-243 emptied `estate-count-budget.json`), so any addition needs this claim. The lever it flips is built and measured (`docs/CLAIMS.md:365`) and held by no active roadmap; its former owners sit in later/ on gates this roadmap does not need (see relates). The grace ceiling in `src/config/preamble-payload-budget.json:81-83` expires 2026-11-10 and the measured total at this pin is 138,200 against it — 73 tokens of headroom."
estate_offset_exempt: "Offsets nothing at promotion. Phase 7 dispositions `later/road-to-token-saving.md` and `later/road-to-token-saving-HUMAN-MEASUREMENT.md` for the rule layer under owner ruling E7, but that disposition is work inside this file rather than an archive move in this change, so the one-in-one-out half is claimed here instead of satisfied by a move."
---

# Road to delivery for every host

> **Source.** Owner instruction 2026-09-07 out of analysis round `inbox-2026-09-u`,
> consumed to `agents/tmp.old/inbox-2026-09-u/`. Every number below was **re-measured at
> `0918def55` (v14.20.0)** with the repo's own instruments before this file was authored;
> where re-measurement contradicted the draft, the corrected figure carries
> `corrected-from-reproduction`. Owner rulings E1/E2/E7 are **decided in this file** — they
> are not blockers, not council questions, and not open for re-litigation by any run.

## Goal

Claude Code sessions start with at most 40,000 standing tokens (rules bucket ≤ 20,000)
instead of 138,200, every host not in `lean_projection.hosts` keeps a rule tree
byte-identical to `eager-all`, and nothing is removed from any install — witnessed by
`check_preamble_payload_budget` before and after, and by a per-host tree diff that is empty
for every non-Claude host.

## Prerequisites

- [ ] Read `AGENTS.md`, `docs/enforcement-by-host.md:18-28`, `docs/CLAIMS.md:365`,
      `src/config/hook-token-budget.json:33-34,39-40`.
- [ ] Run `agent-config roadmap:context --roadmap road-to-delivery-for-every-host` and
      record the probe's `scanned:` line against the `relates:` block above.
- [ ] Run [`plan-confidence-gate`](../../src/agent-src/contexts/execution/plan-confidence-gate.md)
      before the first checkbox.

## Context

Measured at `0918def55` with `./scripts-run src/scripts/check_preamble_payload_budget`:

| Bucket | Measured |
|---|---|
| project-scope rules | 122,608 tok |
| preloaded skills catalog | 14,846 tok |
| CLAUDE.md hierarchy (project only) | 746 tok |
| **measured total** | **138,200 tok** |

against `baseline_tokens` 102,520 (`src/config/preamble-payload-budget.json:23`),
`design_ceiling` 107,646 (`:80`), and `grace_ceiling` 138,273 measured 2026-09-02 and
expiring 2026-11-10 (`:81-83`). The gate exits 1 locally against the design ceiling and
passes CI only because the workflow reads `--ceiling` out of `ci_delivery.grace_ceiling`.
**73 tokens of headroom, and a hard date.** After 2026-11-10 the design ceiling applies and
every PR inherits the overage — the gate already prints "this diff did not cause the
overage, it inherited it".

The rule corpus, re-derived: 119 files in `dist/agent-src/rules`, of which **102 carry
`type: "auto"` (quoted), 9 `always`, 5 `manual`, and 3 carry bare unquoted `auto`**.
`corrected-from-reproduction`: the draft had the quoting inverted, reading 102 unquoted and
3 quoted. The magnitudes were right and the parser reads both, so nothing downstream
changes — but a step that greps for one form would have missed 102 files instead of 3.

What exists:

- `lean_projection.mode ∈ {eager-all, thin, delivery}`, default `eager-all`
  (`src/scripts/_lib/lean_projection_mode.ts:19,21`; template ships `eager-all` at
  `src/config/agent-settings.template.yml:198-199`), read from `.agent-settings.yml` by
  `src/scripts/_lib/hook_settings.ts:90-112` (`corrected-from-reproduction`: the draft cited
  `:82-104`, which is the doc comment plus signature; the reading body is `:90-112`).
- `delivery` writes thin stubs (`src/scripts/project_thin_rules.ts:214`, `build_thin`) and
  the `rule-inject` concern (`src/scripts/hooks/rule_inject_hook.ts`, manifest
  `src/scripts/hook_manifest.yaml:820`) re-delivers a rule body on trigger match, bound under
  the `claude:` platform block on `user_prompt_submit` (`:1221`), `pre_tool_use` (`:1222`)
  and `pre_compact` (`:1240`). Measured: 120,582 → 18,573 exact-BPE standing tokens,
  579/579 byte-equal deliveries, 94/94 labelled rules reachable, 0 false fires on 194
  near-misses, p95 0.61 ms gate-open (`docs/CLAIMS.md:365`, `status: backed`,
  `last_verified: 2026-08-23`).
- Unpaid activation charge: `rule-inject` budget row 20,480 bytes
  (`src/config/hook-token-budget.json:33`) above slot sums `user_prompt_submit` 4,096 and
  `pre_tool_use` 2,048 (`:39-40`). The row's own reason (`:34`) names the flip as the run
  that must move those rows: *"The run that flips `lean_projection.mode: delivery` is the
  run that must move those two slot rows — that is the activation charge step 1.7 defers,
  and it is recorded here so the flip cannot be taken without meeting it."*

**One draft claim did not survive, and it matters for how E2 is argued.**
`corrected-from-reproduction`: `docs/CLAIMS.md:365` does **not** describe the flip as
"owner-reserved". It says the flip is Claude-only, default-off, and carries the unpaid
activation charge, and that the run recording it does not reopen ADR-202. So the
authorization for E1/E2 below rests on the owner instruction of 2026-09-07 alone — not on a
governance label in the CLAIMS row. Stating that plainly is cheaper than a later reader
finding the label absent and treating the whole ruling as unsourced.

Defects this roadmap repairs:

- **D1 — the flip is not host-scoped.** Under `thin`/`delivery`, `condense` writes stubs
  into every `TOOL_DIRS` entry (`.claude/rules`, `.cursor/rules`, `.clinerules`;
  `src/scripts/condense.ts:741-745`); the write at `:1187-1188` sits inside the
  `Object.entries(tool_dirs)` loop and **before** the `tool_dir === '.claude/rules'` branch,
  so it is host-independent. Only Claude Code refuses on a deny
  (`docs/enforcement-by-host.md:18-28`, table corrected 2026-09-07 at `:21-23`); whether
  Cursor/Cline inject hook stdout into context is unmeasured. A project-wide flip today
  would reduce two hosts' `.md` trees to pointers.
- **D2 — a stale parking comment ties delivery to the thin quality null.**
  `src/scripts/condense.ts:1131-1134`, verbatim: *"Flipping it is parked behind the
  thin-projection honest null (thin win-rate 36.2% < the 48% pre-registered threshold), and
  nothing here disturbs that verdict."* That gate belongs to `thin`, judged by an instrument
  ADR-202 closed. `delivery` re-delivers the same bytes and is licensed by `CLAIMS.md:365`
  on delivery equivalence and cost; it needs a recall floor, not a quality judge. Every run
  that read D2 parked the flip.
- **D3 — 8 `auto` rules are outside the labelled corpus** (102 `type: auto` against 94
  files in `tests/eval/routing-matrix/`). Unlabelled means unmeasured reachability.

**Owner rulings (decided 2026-09-07, final):**

- **E1** — the package ships `lean_projection.mode: delivery` with
  `lean_projection.hosts: [claude-code]` as the **default**. Consumers may set `eager-all`;
  rollback is one setting. Rationale: the completeness invariant holds — every rule file is
  written and every body delivered on match — and an opt-in nobody flips is no flip;
  `delivery` has been "available" since it was measured and has never been taken.
- **E2** — slot strategy: the concern delivers on `user_prompt_submit` and `pre_compact`;
  `pre_tool_use` delivery is disabled unless Phase 3.1 shows a labelled rule reachable
  **only** there. The `user_prompt_submit` sum cap moves to the measured p90 gate-open fire
  size rounded up to 512 bytes; `pre_tool_use` stays 2,048. This is the activation charge the
  budget file itself defers to the flipping run; it is **not** config weakening — and
  `src/scripts/hooks/block_config_weakening.ts:96-98` independently classifies
  `*-budget.json` as `advisory`, so its `decide()` path returns `warn`, never a block
  (`:174-181`). Treat that warning as expected and documented.
- **E7** — `later/road-to-token-saving.md` and
  `later/road-to-token-saving-HUMAN-MEASUREMENT.md` are archived for the rule layer once
  Phase 7.1 flips the claim; any non-rule-layer residue moves to a stub with a `review_by`.

- **Feature:** none
- **Jira:** none

## Phase 0: Freeze the baseline per host

- [ ] **0.1 Write `agents/evidence/analysis/standing-payload-by-host-2026-09.md`** at one
      commit: per host (`claude-code`, `cursor`, `cline`, `windsurf`, `gemini`, `copilot`,
      `augment`, `codex`, `cowork`) the rule files the host loads, byte and chars/4 token
      sums, and the writer of each file as `file:line` into `condense.ts` or
      `src/install/*.ts`. Record both units once (chars/4 138,200; exact BPE per
      `CLAIMS.md:365` method). First line must be `<!-- evidence-type: analysis -->` or
      `lint_evidence_artifacts` rejects it.
      verify: artefact exists with a commit pin; re-run at the same pin is byte-identical;
      each host row names a writer with `file:line`;
      `./scripts-run src/scripts/lint_evidence_artifacts` green.
- [ ] **0.2 List the 8 unlabelled `auto` rules (D3)** by name, with whether each has any
      `triggers:`.
      verify: `ls tests/eval/routing-matrix/*.yaml | wc -l` plus the listed names equals the
      `type: auto` count in `dist/agent-src/rules` — counting **both** the quoted and bare
      forms (102 + 3).

## Phase 1: Host-scoped delivery (repairs D1)

- [ ] **1.1 Add `lean_projection.hosts`** (list; default `[claude-code]`) beside the mode
      reader in `src/scripts/_lib/hook_settings.ts:90-112` and export a
      `resolveLeanProjectionHosts()` from `_lib/lean_projection_mode.ts`. Unknown host ids
      are dropped with a warning; the set never widens implicitly.
      verify: unit tests — absent → `[claude-code]`; typo'd id dropped and reported; `mode`
      unset resolves `eager-all` regardless of `hosts`.
- [ ] **1.2 Gate the stub branch on the host.** At `condense.ts:1187` write thin files only
      when `_DIR_TOOL_ID[tool_dir]` (`:757`) is in `hosts`; every other `TOOL_DIRS` entry
      keeps today's symlink/emitter path.
      verify: fixture repo with `mode: delivery`, `hosts: [claude-code]` — `.claude/rules`
      holds stubs; `.cursor/rules/*.md` and `.clinerules` are byte-identical to an
      `eager-all` run (`diff -r` empty).
- [ ] **1.3 Teach `check_rule_projection_integrity` the host axis:** a stub is complete for a
      delivery host; a full body is required for every other host.
      verify: the 1.2 fixture passes; a fixture that stubs `.clinerules` fails naming host
      and reason.
- [ ] **1.4 Non-regression gate (no new CLI verb):** a check in the consistency workflow
      asserting that every host not in `hosts` produces a rule tree byte-identical to
      `eager-all` under any `lean_projection` setting.
      verify: green on the tree; red on a planted one-byte change in a Cline entry.

## Phase 2: Recall floor for Claude before the flip

- [ ] **2.1 Label the 8 rules from 0.2** in `tests/eval/routing-matrix/` with ≥ 1 positive
      and ≥ 1 near-miss row each.
      verify: `./scripts-run src/scripts/model_rule_injection --corpus tests/eval/routing-matrix --endpoints`
      reports 102/102 reachable, 0 false fires; near-miss count ≥ 202.
- [ ] **2.2 An `auto` rule with an empty `triggers:` list is never thinned.** In
      `build_thin`, such a rule projects eagerly on every host and the run prints
      `D3: trigger-less auto rule <file>`.
      verify: fixture rule `type: auto`, no triggers → full body in `.claude/rules` under
      `delivery`, D3 line printed.
- [ ] **2.3 MUST-LOAD floor covers every `always` rule.** Re-run the `trigger-coverage`
      floor (`src/scripts/_lib/value_ladder.ts:480`, currently 26/26 green); add any
      `type: always` rule outside it.
      verify: `./scripts-run src/scripts/trigger_coverage` reports N/N with N ≥ 26.
- [ ] **2.4 Re-delivery after compaction is a fixture.** State in the `rule_inject_hook.ts`
      header what is re-delivered after `pre_compact` and add one fixture: one matched rule,
      one compaction, one further matching turn → body present.
      verify: fixture green.

## Phase 3: Pay the activation charge (E2)

- [ ] **3.1 Measure per-fire bytes per slot** gate-open on the frozen corpus: p50/p90/max
      for `user_prompt_submit`, `pre_tool_use`, `pre_compact`; record which labelled rules
      (if any) are reachable only on `pre_tool_use`.
      verify: numbers in the Phase 0 artefact with the producing command.
- [ ] **3.2 Apply E2.** Remove `rule-inject` from the `pre_tool_use` binding
      (`hook_manifest.yaml:1222`) unless 3.1 lists a rule reachable only there — then keep
      it and say which; set the `user_prompt_submit` sum cap in
      `src/config/hook-token-budget.json:39` to the 3.1 p90 rounded up to 512;
      `pre_tool_use` stays 2,048; the `rule-inject` row stays 20,480; write the `_reason` per
      the file's own raise rule, citing this roadmap and E2.
      verify: hook token budget gate green with `mode: delivery` in this repo's
      `.agent-settings.yml`; the diff touches exactly the rows E2 names; the
      `block_config_weakening` output is the expected `advisory` warn, not a block.
- [ ] **3.3 Latency gate green:** `pre_tool_use` p95 ≤ 175 ms, `user_prompt_submit`
      gate-open measured and recorded.
      verify: CI latency gate green on the flipped repo.

## Phase 4: Flip for Claude Code (E1)

- [ ] **4.0 Repair D2.** Replace the comment at `src/scripts/condense.ts:1131-1134` with:
      `thin` is parked behind the thin quality null (ADR-202); `delivery` is licensed by
      `docs/CLAIMS.md:365` on delivery equivalence and its recall floor (Phase 2 of this
      roadmap) and is not gated by that null.
      verify: `grep -n '36.2' src/scripts/condense.ts` returns a line that names `thin`
      only.
- [ ] **4.1 ADR recording E1** (`delivery` default, `hosts: [claude-code]`, rollback =
      `eager-all`, completeness invariant statement, per-host scope). It amends the CLAIMS
      row and states what it does not reopen (ADR-202, ADR-094). Check the highest live ADR
      number at the moment of authoring — 260 at this pin — and regenerate both
      `adr/regenerate_index --dir docs/decisions` and `adr/evidence_census`.
      verify: ADR exists; `DEFAULT_LEAN_PROJECTION_MODE` and the hosts default match it;
      `Rule backstops` CI job green on census freshness.
- [ ] **4.2 Flip this repo first.** `.agent-settings.yml` → `delivery`/`[claude-code]`; full
      gate set green.
      verify: `check_preamble_payload_budget` on the repo reports rules ≤ 20,000 tok, total
      ≤ 40,000.
- [ ] **4.3 Flip the package default** in a separate PR containing only the default change,
      the ADR link and regenerated projections.
      verify: fresh install fixture on a Claude Code host measures ≤ 40,000 total; on a
      Cursor-only fixture the tree equals `eager-all`.
- [ ] **4.4 Lower the baseline, retire the grace ceiling.**
      `src/config/preamble-payload-budget.json:23` becomes the measured post-flip total; the
      `grace_ceiling` block (`:79-83`) is removed in the same commit with a `history` entry
      naming this roadmap. Ceilings move down only; `design_ceiling` (`:80`) is not raised.
      **`corrected-from-reproduction`:** the file carries a `grace_ceiling` key *and* a
      `grace_ceiling_history` block, so the exit-condition grep counts two. Both go, or the
      check never reaches 0 — the history entry's content moves into the `baseline_history`
      note that records this flip.
      verify: gate green at the new baseline;
      `grep -c grace_ceiling src/config/preamble-payload-budget.json` returns 0 — which
      requires the history block deleted, not only the key.
- [ ] **4.5 Rollback fixture.** flip → `eager-all` → `diff -r` against a never-flipped tree
      is empty; documented in `docs/contracts/rule-router.md`.
      verify: fixture green.

## Phase 7: Truth surfaces

- [ ] **7.1 Flip `docs/CLAIMS.md:365`** to a backed claim scoped `claude-code` only,
      evidence = the Phase 0 artefact plus the post-flip census; `non_inference` states the
      per-host scope. No README wording added.
      verify: `./scripts-run src/scripts/check_claims` green; the evidence pointer resolves;
      `./scripts-run src/scripts/build_proof` re-run in the same change.
- [ ] **7.2 Per-host cost table** generated from the census into the contract the README
      points at; the generator fails when the census is missing.
      verify: table numbers equal the census.
- [ ] **7.3 Apply E7** to the two `later/` token roadmaps.
      verify: both files have a disposition;
      `./scripts-run src/scripts/lint_roadmap_later_disposition` green.

## Kill register (this roadmap's IDs)

- **K1** Rule-MCP (pull cannot carry obligations).
- **K3** Thinning any host outside `hosts`.
- **K4** Raising `design_ceiling`, any stub ceiling, or the `rule-inject` row.
- **K5** Cutting rule prose to hit the budget.
- **K6** New top-level CLI verb (ADR-041's leading-token allowlist).
- **K7** Citing ADR-202 or the thin null as a gate for `delivery`.
- **K8** A daemon or retriever for delivery.
- **K9** Moving this file to `later/`, descoping steps to a carrier, or rewriting an AC. A
  step that fails enters a fix loop; a step that needs a decision this file does not contain
  is reported as a question in the PR body, and the step stays `[ ]` with the question
  quoted.

## Provenance

- **Source:** an owner-directed external LLM ideation round, consumed to
  `agents/tmp.old/inbox-2026-09-u/`. No third-party repository, product or vendor is a
  source of this plan.
- **Gap table:** every claim in the draft was audited against the tree before this file was
  authored. `KEEP` — the mode/`delivery` machinery, the budget rows, the grace-ceiling date,
  the host table, D1, D2, D3, and every corpus count except the two below. `KEEP, corrected`
  — the `hook_settings.ts` line span (`:90-112`, not `:82-104`), the Cowork row
  (`enforcement-by-host.md:21`, not `:20`), and the `type: auto` quoted/unquoted split
  (inverted in the draft). `CUT` — the draft's supporting note that `CLAIMS.md:365` labels
  the flip "owner-reserved": that phrase is not in the row, so the ruling rests on the owner
  instruction alone and the Context says so.
- **Council:** none. E1/E2/E7 are owner rulings; ADR-260 § 4's Alternatives section rejects
  routing an owner-reserved question to a council.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-09-07 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|---|---|---|---|---|---|
| 1 | A rule stops being delivered and nobody notices | product | The whole flip rests on trigger-match delivery. A rule whose trigger never fires becomes invisible while the file still exists on disk, so every completeness check that counts files passes. | Phase 2 makes the recall floor a precondition: 102/102 reachable with 0 false fires on ≥ 202 near-misses, plus 2.2's eager fallback for a trigger-less `auto` rule and 2.3's MUST-LOAD floor for every `always` rule | Phase 2: Recall floor for Claude before the flip |
| 2 | A non-Claude host silently loses its rule bodies | product | D1 is live today: the stub write is host-independent, so flipping the mode before Phase 1 lands reduces Cursor and Cline to pointers on hosts where hook delivery is unmeasured. | Phase 1.4 is a CI gate asserting byte-identity to `eager-all` for every host outside `hosts`, and K3 forbids thinning one; Phase 4 may not start before it is green | Phase 1: Host-scoped delivery (repairs D1) |
| 3 | The 2026-11-10 date passes with the flip unlanded | implementation | 73 tokens of headroom at this pin. On expiry the design ceiling applies and every PR inherits a red gate, which converts one owner decision into a repo-wide stop. | Phases are ordered so 4.2 flips this repo before 4.3 touches the package default; 4.4 lowers the baseline and deletes the grace block in the same commit rather than leaving both live | Phase 4: Flip for Claude Code (E1) |
| 4 | The activation charge reads as config weakening and stalls | implementation | The charge is literally a slot-sum raise plus a baseline move, and both shapes are what a reviewer or a guard is trained to refuse. | E2 names the file, line and target value, and cites the budget row's own reason text assigning the move to this run; `block_config_weakening.ts:96-98` classifies the file `advisory`, so its output is a warn to document, never a block | Phase 3: Pay the activation charge (E2) |
| 5 | Post-compaction re-delivery is assumed rather than tested | implementation | `pre_compact` binding exists, but nothing in the tree asserts a body survives a compaction boundary — and a rule lost there is lost for the rest of the session. | 2.4 makes it a fixture with a stated contract in the hook header, not a property inferred from the binding | Phase 2: Recall floor for Claude before the flip |

## Acceptance Criteria

- [ ] `check_preamble_payload_budget` on a Claude Code install: total ≤ 40,000 tok, rules
      ≤ 20,000.
- [ ] Every host not in `lean_projection.hosts`: rule tree byte-identical to `eager-all`
      (Phase 1.4 gate in CI, green).
- [ ] 102/102 `auto` rules reachable, 0 false fires; MUST-LOAD floor N/N.
- [ ] 119 rule files, 299 skills, all personas, contexts and commands still installed.
- [ ] Rollback fixture green; grace ceiling gone; all quality gates green.

## Notes

- Completeness invariant (owner directive 2026-08-30): every user receives 100 % of the
  package. Stubs are a form, not a subset. Phase 1.4 witnesses the non-Claude hosts; 2.2
  witnesses that no `auto` rule vanishes through an empty trigger list.
- Source-silence: no external repository is referenced or needed.
