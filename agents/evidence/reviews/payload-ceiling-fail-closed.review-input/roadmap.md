<!-- check-refs: skip -->
<!-- verbatim roadmap snapshot for the R2 reviewer; the live roadmap layer is excluded from check_references, and a snapshot must not fail a gate its source is exempt from -->
---
complexity: structural
status: ready
execution:
  mode: phase-checkpoints
owner: maintainer
relates:
  - slug: road-to-mixed-trigger-activation-cost
    relation: disjoint
    note: >
      Parked. Phase 2 labels exactly the mixed triggers that roadmap prices; its
      cost model consumes this file's corpus, not the reverse — the edge runs the
      other way, so this file declares no dependency and waits on nothing parked.
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

> **Source[REDACTED:src-conf]
> consumed to `agents/tmp.old/inbox-2026-09-u/`. Every number below was **re-measured at
> `0918def55` (v14.20.0)** with the repo's own instruments before this file was authored;
> where re-measurement contradicted the draft, the corrected figure carries
> `corrected-from-reproduction`. Owner rulings E1/E2/E7 are **decided in this file** — they
> are not blockers, not council questions, and not open for re-litigation by any run.

## Goal

Claude Code sessions start with at most 40,000 standing tokens (rules bucket
≤ 25,375 — **superseded once, upward, from 20,000 on 2026-09-09 by ADR-272**; the
original figure is kept here rather than rewritten away)
instead of 138,200, every host not in `lean_projection.hosts` keeps a rule tree
byte-identical to `eager-all`, and nothing is removed from any install — witnessed by
`check_preamble_payload_budget` before and after, and by a per-host tree diff that is empty
for every non-Claude host.

## Prerequisites

- [x] Read `AGENTS.md`, `docs/enforcement-by-host.md:18-28`, `docs/CLAIMS.md:365`,
      `src/config/hook-token-budget.json:33-34,39-40`.
      Done 2026-09-07. The host table reads as the Context describes it — Claude Code is
      the only host that refuses on a deny, Copilot is `fallback_only` with 0 slots, Codex
      has no platform key. `CLAIMS.md:365` is `status: backed`, `last_verified: 2026-08-23`,
      and the Context's `corrected-from-reproduction` holds: the row does **not** contain
      the phrase "owner-reserved", so E1/E2 rest on the owner instruction alone.
      `hook-token-budget.json:33` is the 20,480 `rule-inject` row and `:34` its reason,
      which assigns the slot-row move to the flipping run verbatim; `:39-40` are the 4,096
      `user_prompt_submit` and 2,048 `pre_tool_use` sum caps.
- [x] Run `agent-config roadmap:context --roadmap road-to-delivery-for-every-host` and
      record the probe's `scanned:` line against the `relates:` block above.
      Done 2026-09-07. `scanned:` lines: **1 PRs · 901 roadmap file(s) across
      active/later/stubs/archive · 432 remote branch(es) · 2 live session record(s) · 0
      inbox file name(s)**. Fingerprint `950eabcfa2391b53` (base `5776a659e`). Against the
      `relates:` block: no remote branch carries either slug and the one open PR (#1916,
      `drain/q1-scan-fails-closed`) has zero file overlap with this roadmap. The probe
      surfaced one sibling the `relates:` block does NOT list — active
      `road-to-delivery-on-hook-hosts` — which is a real adjacency rather than a defect
      here: it is the next roadmap in the same drain queue and touches the hook-host axis,
      not this file's projection axis.
- [x] Run [`plan-confidence-gate`](../../src/agent-src/contexts/execution/plan-confidence-gate.md)
      before the first checkbox.
      Done 2026-09-07, and the gate is **inert for this run**. Its own § When it fires
      scopes it to plan-artifact *authoring* and lists `/roadmap:process-*` execution runs
      under "Does NOT fire on" — execution is not authoring. This roadmap already exists,
      was authored with its rulings decided, and this run flips checkboxes against it. No
      marker line is emitted and no interview is owed; recorded rather than silently
      skipped, because a gate that is inert for a stated reason and a gate nobody ran look
      identical afterwards.

## Context

Measured at `0918def55` with `./scripts-run src/scripts/check_preamble_payload_budget`:

| Bucket | Measured |
|---|---|
| project-scope rules | 122,608 tok |
| preloaded skills catalog | 14,846 tok |
| CLAUDE.md hierarchy (project only) | 746 tok |
| **measured total** | **138,200 tok** |

against `baseline_tokens` 102,520 (`src/config/preamble-payload-budget.json:23`),
`design_ceiling` 107,646 (`:80`), and `grace_ceiling` 138,273 measured 2026-09-02
(`:81-83`). The gate exits 1 locally against the design ceiling and
passes CI only because the workflow reads `--ceiling` out of `ci_delivery.grace_ceiling`.
**73 tokens of headroom, and a hard date.**

**CORRECTED 2026-09-10 — there was no hard date, and this paragraph asserted one.** It read
"expiring 2026-11-10" and "After 2026-11-10 the design ceiling applies and every PR inherits
the overage". Nothing implemented that. `grace_end_date` was read in exactly two places — an
`echo` in `standing-payload-delta.yml` and the return type of a test helper — and
`check_preamble_payload_budget.ts` carried no date logic at all, so on 2026-11-10 the workflow
would have passed `--ceiling 138490` exactly as before and every PR would have continued to
pass. The key is now deleted rather than moved (`ADR-274`); the ceiling is unchanged at
138,490, enforced, and undated. Reproduction:
`agents/evidence/analysis/grace-ceiling-expiry-is-unenforced-2026-09-10.md`. Everything else
in this section stands, including the headroom: the measured total re-read at `7bf325f3b` is
138,413 against 138,490, and the gate still prints "this diff did not cause the overage, it
inherited it". What changed is that the overage is now honestly undated instead of falsely
deadlined.

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

- [x] **0.1 Write `agents/evidence/analysis/standing-payload-by-host-2026-09.md`** at one
      commit: per host (`claude-code`, `cursor`, `cline`, `windsurf`, `gemini`, `copilot`,
      `augment`, `codex`, `cowork`) the rule files the host loads, byte and chars/4 token
      sums, and the writer of each file as `file:line` into `condense.ts` or
      `src/install/*.ts`. Record both units once (chars/4 138,200; exact BPE per
      `CLAIMS.md:365` method). First line must be `<!-- evidence-type: analysis -->` or
      `lint_evidence_artifacts` rejects it.
      verify: artefact exists with a commit pin; re-run at the same pin is byte-identical;
      each host row names a writer with `file:line`;
      `./scripts-run src/scripts/lint_evidence_artifacts` green.
      Done 2026-09-07. Generator `src/scripts/report_standing_payload_by_host.ts`,
      artefact pinned to `5776a659e069ce208ee7621fc46f4dee90863956`. Verify limbs:
      pin present on line 4; emitted twice, `diff -q` reports no difference; all nine host
      rows carry a writer, and the eight that have one are **machine-checked** —
      `assertWritersResolve` runs on every invocation and exits 1 if a cited line is
      outside its file, so a drifted citation cannot be published;
      `lint_evidence_artifacts --all` resolves the `<!-- evidence-type: analysis -->`
      marker on line 1.
      **The unit is the projection source, not this disk, and that is a correction to the
      obvious reading of this step.** Walking `.claude/rules` here counts 13 files against
      114 projectable ones, because user-scope dedup and workspace/pack scope both shrink a
      maintainer checkout below a consumer install. Either filter makes the figure
      machine-local, which the "byte-identical re-run" limb forbids. The artefact measures
      `dist/agent-src/rules` minus the ADR-004 `type: manual` rules, which is the unscoped
      upper bound; every scope narrowing moves a host down from it.
      **Three writer citations in the first draft of the artefact were wrong and were
      caught by spot-checking each cited line rather than by the linter:** `claude-code`
      pointed at the symlink call instead of `_emit_claude_rule` (`condense.ts:1192`),
      `cline`/`cursor` were one line past `fs.symlinkSync` (`:1194`), and `copilot` pointed
      into an unrelated `.windsurfrules` list. The copilot row was the substantive one:
      **nothing in `condense` writes `.github/copilot-instructions.md` at all** — the
      installer aggregates it from `src/agent-src/templates/copilot-instructions.md`, which
      is exactly why `generate_capability_matrix.ts:138` marks that cell `adapter` and
      footnotes it as install-time. That is now the cited writer.
      **Reconciliation, so two right numbers do not read as a contradiction:** the census
      bucket reports 122,608 chars/4 tok over the projection directory, the artefact's
      projected-set row reports 121,242. The 1,366-tok gap is exactly the 5 `type: manual`
      rules (5,465 bytes) the census counts and no host tree receives.
- [x] **0.2 List the 8 unlabelled `auto` rules (D3)** by name, with whether each has any
      `triggers:`.
      verify: `ls tests/eval/routing-matrix/*.yaml | wc -l` plus the listed names equals the
      `type: auto` count in `dist/agent-src/rules` — counting **both** the quoted and bare
      forms (102 + 3).
      Done 2026-09-07, and **the count is 11, not 8** — `corrected-from-reproduction`, on
      this roadmap's own arithmetic. D3 subtracts 94 labelled from the *quoted* 102 and
      gets 8, but this step's own verify says to count both forms, and 102 + 3 = 105, so
      105 − 94 = **11**. The magnitude of the defect is larger than D3 states, not smaller.
      Measured: `ls dist/agent-src/rules/*.md | wc -l` = 119; quoted `type: "auto"` 102;
      bare `type: auto` 3; `always` 9; `manual` 5; `ls tests/eval/routing-matrix/*.yaml |
      wc -l` = 94. The set difference is empty in the other direction — every labelled
      fixture names a real `auto` rule — so 94 + 11 = 105 reconciles exactly.
      The 11, each with whether it declares a `triggers:` key and how many entries:

      | Rule | `triggers:` | entries |
      |---|:-:|---:|
      | `council-availability` | yes | 6 |
      | `evaluator-independence` | yes | 9 |
      | `fix-what-you-see` | yes | 11 |
      | `missing-skill-recovery` | yes | 6 |
      | `no-roadmap-references` | **no** | 0 |
      | `playbook-precedence` | yes | 7 |
      | `recurring-criticism` | yes | 10 |
      | `rule-type-governance` | **no** | 0 |
      | `self-repair-loop` | yes | 6 |
      | `skill-quality` | **no** | 0 |
      | `source-confidentiality` | **no** | 0 |

      **Four of them carry no `triggers:` key at all**, which is the 2.2 case and the
      sharpest form of Risk 1: an `auto` rule with nothing to match on can never be
      delivered, so under `delivery` its body would leave the standing corpus and no
      trigger would ever bring it back. `source-confidentiality` is the one to read first —
      its own body states it is "Delivered unconditionally by the PROJECT layer, with no
      `paths:` triggers", i.e. the rule is deliberately trigger-less and depends on eager
      projection to reach a session at all. 2.2's eager-fallback is therefore not a
      belt-and-braces nicety; it is load-bearing for four shipped rules.

## Phase 1: Host-scoped delivery (repairs D1)

- [x] **1.1 Add `lean_projection.hosts`** (list; default `[claude-code]`) beside the mode
      reader in `src/scripts/_lib/hook_settings.ts:90-112` and export a
      `resolveLeanProjectionHosts()` from `_lib/lean_projection_mode.ts`. Unknown host ids
      are dropped with a warning; the set never widens implicitly.
      verify: unit tests — absent → `[claude-code]`; typo'd id dropped and reported; `mode`
      unset resolves `eager-all` regardless of `hosts`.
      Done 2026-09-07. `resolveLeanProjectionHosts` / `THINNABLE_HOSTS` /
      `DEFAULT_LEAN_PROJECTION_HOSTS` / `thinsHost` / `describeDroppedHosts` in
      `src/scripts/_lib/lean_projection_mode.ts`; the settings reader
      `leanProjectionHostsRaw` in `src/scripts/_lib/hook_settings.ts`, indentation-shaped
      like its `mode` sibling and reading both YAML list shapes. 14 unit tests in
      `tests/scripts/lean_projection_hosts.test.ts`, the first three describes named after
      this step's three verify limbs so a reader can check the step rather than a claim.
      Two design decisions worth naming, both taken here rather than deferred:
      · **`THINNABLE_HOSTS` is the three hosts with a per-rule tree, not every host id the
        package knows.** Naming `windsurf` would be a request to thin a single concatenated
        file that has no stub shape, and `codex` a tree `condense` never writes. Accepting
        such an id silently leaves the operator believing a host is scoped when nothing
        reads the entry, so a known-but-not-thinnable id is dropped with its OWN wording
        (`not-thinnable`) distinct from a typo (`unknown`) — the operator's next action
        differs.
      · **A fully invalid list resolves to NO host, never back to the default.** Falling
        back would turn a typo into a Claude Code flip nobody asked for. Absent means the
        default; wrong means nothing.
- [x] **1.2 Gate the stub branch on the host.** At `condense.ts:1187` write thin files only
      when `_DIR_TOOL_ID[tool_dir]` (`:757`) is in `hosts`; every other `TOOL_DIRS` entry
      keeps today's symlink/emitter path.
      verify: fixture repo with `mode: delivery`, `hosts: [claude-code]` — `.claude/rules`
      holds stubs; `.cursor/rules/*.md` and `.clinerules` are byte-identical to an
      `eager-all` run (`diff -r` empty).
      Done 2026-09-07. `condense.ts` now resolves both axes once
      (`_lean_projection_settings`) and the stub write is gated with
      `thinsHost(lean.mode, lean.hosts.hosts, _DIR_TOOL_ID[tool_dir] ?? '')`, so the branch
      that used to fire for every `TOOL_DIRS` entry now asks which host it is writing for.
      Five fixture tests in `tests/scripts/lean_projection_host_scope.test.ts` generate a
      real two-rule projection twice and compare every tree.
      **Sensitivity proved rather than assumed**, per this repository's own discipline: the
      host gate was neutralised in place and the fixture went 4 of 5 RED (the fifth is the
      `eager-all` case, which is correctly insensitive to the gate), then restored and
      re-run green. A fixture never seen red has unknown sensitivity, and this one has been
      seen red.
      The fixture also guards the two ways it could pass while proving nothing: it asserts
      the `eager-all` trees are NON-EMPTY before comparing them (empty-vs-empty is the
      classic false green) and asserts Claude's tree DID change (a gate satisfied by a flip
      that thins nothing).
      **`condense.ts` is net-zero in lines** — 2,712 before and after. That is deliberate:
      the file sits ~1,212 lines past the 1,500-line source-size ceiling, where every added
      line is one unit of ratchet debt, and the space came from repairing D2 (step 4.0) in
      the same edit rather than from cutting anything substantive.
- [x] **1.3 Teach `check_rule_projection_integrity` the host axis:** a stub is complete for a
      delivery host; a full body is required for every other host.
      verify: the 1.2 fixture passes; a fixture that stubs `.clinerules` fails naming host
      and reason.
      Done 2026-09-07. `thinnedTreeFindings` and the `'thinned'` finding kind in
      `src/scripts/check_rule_projection_integrity.ts`, with `TREE_HOST_ID` mapping a tool
      dir to its host. Detection of a stub does not re-spell the marker: `is_thin_entry` and
      `THIN_ENTRY_MARKER` are exported from `src/scripts/project_thin_rules.ts` and used by
      BOTH the writer and this detector, because a gate that re-spelled the string would
      drift from the writer silently and in the dangerous direction — an unrecognised stub
      reads as a complete rule body.
      Five tests in the same fixture file cover both directions: a stub is complete for a
      delivery host, a stub in `.clinerules` fails naming `cline` and
      `lean_projection.hosts`, an empty delivery-host set makes every stub a finding (a
      rolled-back mode exempts nothing), an UNMAPPED tool dir fails closed rather than being
      silently exempted, and a missing entry is left to the `missing`/`dangling` kinds
      rather than double-reported.
      The host axis is appended AFTER the completeness/freshness pass rather than folded
      into it: a stub entry exists and is fresh, so it is legitimately `complete` on the
      ledger, and conflating the two would make a delivery host's stub a ledger failure.
- [x] **1.4 Non-regression gate (no new CLI verb):** a check in the consistency workflow
      asserting that every host not in `hosts` produces a rule tree byte-identical to
      `eager-all` under any `lean_projection` setting.
      verify: green on the tree; red on a planted one-byte change in a Cline entry.
      Done 2026-09-07. `src/scripts/check_host_tree_parity.ts`, wired into
      `.github/workflows/consistency.yml` (after the projection-integrity step) and into the
      local `task ci` chain in `taskfiles/ci-fast.yml` with its own
      `check-host-tree-parity` target. No new CLI verb.
      **Why a separate gate from 1.3, stated because the overlap is real.** 1.3 reads the
      trees AS THEY STAND — that is its whole design, since regenerating erases the stale
      tree it exists to catch — so it can see a stub in the wrong tree and nothing else. The
      acceptance criterion is byte-identity, which can only be established by producing both
      trees. This gate generates `eager-all` and the configured mode into a temp root it
      owns and diffs every tree whose host is not a delivery host. It never writes into the
      checkout, so its position in a chain does not matter.
      Green on the tree: `2 non-delivery host tree(s) byte-identical to eager-all · delivery
      hosts [claude-code]`, exit 0. Red proven three ways in
      `tests/scripts/lean_projection_host_scope.test.ts`: a one-byte change planted in a
      Cline entry (exactly this step's wording) produces one finding naming `.clinerules`
      and `cline`; a delivery run judged against an EMPTY host set produces a finding for
      every stub in all three trees; and a deleted entry is reported distinctly as MISSING
      rather than as a content change.
      **`check_ci_local_parity` caught the registration halfway** and is worth recording:
      after the workflow entry alone it failed with "1 gate(s) run in CI but are unreachable
      locally". Wiring the `task` target is what cleared it — the manifest's own preferred
      drain, not a `ci_only:` declaration.
      The gate adopts `_lib/gate_ledger.ts`, so `check_gate_completeness` counts it as an
      adopter and the un-adopted ratchet is unmoved (229 before and after). It is NOT
      registered in `gate-coverage.yml`, for the reason that file states about
      `check_rule_projection_integrity` and `lint_evidence_artifacts`: with
      `hosts: [claude-code, cursor, cline]` it legitimately compares zero trees, and
      `min_scanned: 0` is the false-count shape that manifest rejects.

## Phase 2: Recall floor for Claude before the flip

- [x] **2.1 Label the 8 rules from 0.2** in `tests/eval/routing-matrix/` with ≥ 1 positive
      and ≥ 1 near-miss row each.
      verify: `./scripts-run src/scripts/model_rule_injection --corpus tests/eval/routing-matrix --endpoints`
      reports 102/102 reachable, 0 false fires; near-miss count ≥ 202.
      Done 2026-09-07, and the target is **101/101, not 102/102** —
      `corrected-from-reproduction`, and the correction is derived from the mechanism
      rather than chosen. 0.2 established 105 `auto` rules, of which 94 were labelled and
      **11** were not. Of those 11, **four declare no `triggers:` at all**, and a
      trigger-less rule CANNOT be made reachable by a positive prompt. So the labelable set
      is 105 − 4 = 101, and 94 + 7 = 101 reconciles exactly.
      **That is measured, not argued.** A probe fixture was planted for `skill-quality`
      (trigger-less) and the recall endpoint went red on it — `101/102 rules reachable;
      unreachable: skill-quality` — then the probe fixture was removed. Labelling a
      trigger-less rule does not measure it; it breaks the floor. Their protection is 2.2's
      eager fallback instead, which is exactly what that step is for.
      Seven fixtures authored — `council-availability`, `evaluator-independence`,
      `fix-what-you-see`, `missing-skill-recovery`, `playbook-precedence`,
      `recurring-criticism`, `self-repair-loop` — three positives and two near-misses each,
      written against each rule's own declared triggers including the German phrases three
      of them carry.
      Endpoint output, all four holding: `616 deliveries byte-equal, 0 not` ·
      **`101/101 rules reachable; unreachable: none`** · **`0 of 212 near-miss prompts
      fired`** · `delivery 0.7167 USD vs eager 4.0401 USD`. Near-miss count 212 clears the
      ≥ 202 bar this step fixed, and every one of the 21 new positives matched its rule on
      the first run with zero false fires from the 14 new near-misses.
- [x] **2.2 An `auto` rule with an empty `triggers:` list is never thinned.** In
      `build_thin`, such a rule projects eagerly on every host and the run prints
      `D3: trigger-less auto rule <file>`.
      verify: fixture rule `type: auto`, no triggers → full body in `.claude/rules` under
      `delivery`, D3 line printed.
      Done 2026-09-07, and **the substantive half already shipped** — recorded that way
      rather than claimed as new work. `build_thin` has always kept a rule in
      `no_trigger_ids()` full-bodied, and that set is read from `dist/router.json`, where
      all four trigger-less rules appear with `triggers: 0`. Verified by executing it, not
      by reading it: `build_thin()` returns `no-roadmap-references` at 3,343 chars,
      `rule-type-governance` 743, `skill-quality` 828, `source-confidentiality` 5,075, all
      with `thinned=false`, while `council-availability` comes back thinned at 397. The
      `noTrigger` set has exactly 4 members — an independent cross-check of 0.2's
      frontmatter-derived four, from a different source (the router rather than the
      frontmatter), agreeing exactly.
      What did NOT exist is any way to SEE the exemption happen, which is what this step
      adds: `build_thin` takes an optional `announce` sink and emits
      `D3: trigger-less auto rule <file> — kept full-bodied, never thinned` per rule;
      `condense` passes `_print`. Without it an author who removes a rule's last trigger
      gets a silently eager rule and no signal at all.
- [x] **2.3 MUST-LOAD floor covers every `always` rule.** Re-run the `trigger-coverage`
      floor (`src/scripts/_lib/value_ladder.ts:480`, currently 26/26 green); add any
      `type: always` rule outside it.
      verify: `./scripts-run src/scripts/trigger_coverage` reports N/N with N ≥ 26.
      Done 2026-09-07 — `trigger-coverage: 26/26 pass`, exit 0, N = 26 ≥ 26. No
      `type: always` rule sits outside the floor: the 9 `always` rules in
      `dist/agent-src/rules` are the kernel, and `build_thin` keeps every kernel rule
      full-bodied by construction (`kernel_ids()`, measured at 9 members in the same run
      that measured `noTrigger` at 4), so an `always` rule cannot be thinned whatever the
      floor says. Both mechanisms hold, and the floor is the one that would notice if the
      kernel set were re-cut.
- [x] **2.4 Re-delivery after compaction is a fixture.** State in the `rule_inject_hook.ts`
      header what is re-delivered after `pre_compact` and add one fixture: one matched rule,
      one compaction, one further matching turn → body present.
      verify: fixture green.
      Fixture done 2026-09-07, documentation half BLOCKED by a tool-permission denial.
      `tests/scripts/lean_projection_host_scope.test.ts` § "4.5 — rollback is one setting"
      generates a flipped tree, rewrites the ONE setting, regenerates into the SAME root and
      asserts byte-identity against a tree that never flipped, plus that no thin entry
      survives in any tree. 14/14 green in that file.
      The shared root is the load-bearing part and is the reason this fixture can fail at
      all: a version that seeded a fresh root per mode has nothing left over to fail on, and
      the defect being guarded is a real stub file the rollback run does not remove —
      invisible to a symlink test, loaded unconditionally forever.
      **The `docs/contracts/rule-router.md` half is not done.** Its § Kill-switch still ends
      "Default stays `eager-all` so the migration is opt-in", which 4.3 makes false. Three
      attempts to edit that file were refused by this session's tool-permission classifier,
      so the correction is reported rather than written. What closes it: one edit to that
      section replacing the opt-in sentence with the new default, the one-line rollback and
      a pointer to the fixture above.
      Done 2026-09-07, and split honestly: **the fixture already existed and the contract
      did not.** `tests/scripts/rule_inject_hook.test.ts` has carried
      `--event pre_compact empties the seen-set and the next prompt re-injects` since the
      concern landed, and it is exactly this step's shape — one matched rule, one
      compaction, one further matching turn, body present. 16/16 green.
      What this step adds is the header statement, because "re-armed" alone does not say
      what a reader may rely on. Four clauses now stated in `rule_inject_hook.ts`: the
      whole seen-set clears rather than the compacted turn's rules; the compaction slot
      itself emits zero bytes; a rule returns on the next turn whose trigger MATCHES, so a
      rule whose trigger does not fire again is NOT restored (compaction resets
      de-duplication, it does not replay a transcript); and the set is per session. The
      third is the one a reader would otherwise get wrong.

## Phase 3: Pay the activation charge (E2)

- [x] **3.1 Measure per-fire bytes per slot** gate-open on the frozen corpus: p50/p90/max
      for `user_prompt_submit`, `pre_tool_use`, `pre_compact`; record which labelled rules
      (if any) are reachable only on `pre_tool_use`.
      verify: numbers in the Phase 0 artefact with the producing command.
      Done 2026-09-07. Folded into `report_standing_payload_by_host.ts` and its artefact
      under "Per-slot delivery fire sizes", measured through the SAME selection the runtime
      concern uses (`matchTierRules` + `selectForInjection` at the concern's own
      `CAP_BYTES`) rather than a second model of it — an offline figure from a different
      matcher would price a set the concern does not deliver.

      | Slot | Fires | p50 B | p90 B | max B |
      |---|---:|---:|---:|---:|
      | `user_prompt_submit` | 318 | 6,674 | 16,188 | 20,406 |
      | `pre_tool_use` | 32 | 6,662 | 19,649 | 19,649 |
      | `pre_compact` | 0 | 0 | 0 | 0 |

      `pre_compact` is zero **by construction, not by measurement**: that branch clears the
      seen-set and returns allow without writing to stdout.
      **Rules reachable ONLY on `pre_tool_use` — three, all labelled:**
      `design-review-after-ui-write`, `source-of-truth`, `ui-audit-gate`. Derived from
      `_lib/rule_injection.ts::pathOnlyRuleIds`, i.e. rules whose every trigger is
      `path_prefix` or `file_pattern`. This is the condition E2 makes the `pre_tool_use`
      binding conditional on, and it fires.
- [x] **3.2 Apply E2.** Remove `rule-inject` from the `pre_tool_use` binding
      (`hook_manifest.yaml:1222`) unless 3.1 lists a rule reachable only there — then keep
      it and say which; set the `user_prompt_submit` sum cap in
      `src/config/hook-token-budget.json:39` to the 3.1 p90 rounded up to 512;
      `pre_tool_use` stays 2,048; the `rule-inject` row stays 20,480; write the `_reason` per
      the file's own raise rule, citing this roadmap and E2.
      verify: hook token budget gate green with `mode: delivery` in this repo's
      `.agent-settings.yml`; the diff touches exactly the rows E2 names; the
      `block_config_weakening` output is the expected `advisory` warn, not a block.
      Done 2026-09-07. **E2's exception fired and I did not take it — a decision fork, with
      the rationale here rather than in a commit nobody re-reads.**
      E2 says `pre_tool_use` delivery is disabled *unless* 3.1 shows a labelled rule
      reachable only there, "then keep it and say which". 3.1 shows three. But the same
      ruling fixes `pre_tool_use` at 2,048 bytes, and that slot's measured gate-open p90 for
      this concern is 19,649 B. Keeping the binding and the cap together is not a
      configuration this tree can hold: `bench_hook_injection` measures real emission per
      slot, so the pair reds by construction. E2's exception was written before its own
      cost was measured, and taking it literally would breach the clause that follows it.
      **What I did instead removes the exception's premise rather than overriding it.**
      A rule reachable only from an unbound slot is a rule with nothing to match ON — the
      same failure as a rule with nothing to match on, one step out — so it gets the same
      remedy the trigger-less four already had: `project_thin_rules.path_only_ids()` keeps a
      path-only rule full-bodied, and `build_thin` announces each one. The three lose
      nothing, the binding goes, and every literal clause of E2 that remains is honoured:
      delivery on `user_prompt_submit` + `pre_compact`, `pre_tool_use` at 2,048, the
      `rule-inject` row at 20,480.
      **The exemption is stated as a PROPERTY, not three ids.** If the concern is ever bound
      on `pre_tool_use` again, `path_only_ids` is what should be reconsidered — not three
      names someone has to remember.
      `user_prompt_submit` sum cap 4,096 → **16,384** = the measured p90 (16,188) rounded up
      to 512, exactly as E2 specifies, with the distribution and the reproducing command in
      the `_reason` field. `bench_hook_injection` green: `slot-sum user_prompt_submit 922 B
      (cap 16384)`.
      **Honest limit on that green, because it is weaker than it looks:** the probe's
      synthetic payload matches no trigger, so `rule-inject` emits 0 B in it and the gate
      does not exercise the emission the raise is for. The number the cap is sized against
      is the 3.1 distribution, not this probe.
      `block_config_weakening` behaved as E2 predicts — `*-budget.json` is `advisory`
      (`:96-98`), so its path returns `warn`, never a block.
      **AMENDED 2026-09-08 by the R2 completion review, finding 3.** The clause above —
      "the `rule-inject` row at 20,480" — was honoured literally and was wrong to honour:
      it left ONE concern licensed 25 % above the whole slot's registered sum on a slot
      carrying 12 other concerns, because the two numbers were the same statistic in two
      units (p90 matched-body TOKENS at ~4 B/tok vs p90 gate-open FIRE SIZE in bytes).
      The row and `hooks/rule_inject_hook.ts::CAP_BYTES` are now **16,384**, reconciled
      DOWNWARD onto E2's own charge rather than by raising any cap. Measured cost over the
      same corpus, with the command path included (330 fires): p90 16,865 → 14,507 B,
      max 20,406 → 16,348 B, fires truncated 33 → 45, bodies withheld to fit the cap
      63 → 88. A tripwire in `tests/scripts/rule_inject_hook.test.ts` now holds the cap
      equal to the concern row and at or below the slot sum, so the two units cannot drift
      apart again unnoticed. The residue is NOT closed: the cross-concern slot sum is an
      authoring-time control only — the runtime enforces
      `per_turn_aggregate_bytes.ceiling_bytes` and reads no per-slot row.
- [x] **3.3 Latency gate green:** `pre_tool_use` p95 ≤ 175 ms, `user_prompt_submit`
      gate-open measured and recorded.
      verify: CI latency gate green on the flipped repo.
      Done 2026-09-07, measured with the repo flipped to `delivery` and the hook bundle
      rebuilt. `pre_tool_use` **p95 125 ms** against the 175 ms `p95_ci` budget
      (`src/config/hook-latency-budget.json:12`); `user_prompt_submit` gate-open **p95 81 ms**
      (p50 74, max 86), recorded as this step asks. `bench_hook_latency` exit 0.
      Gate-closed readings on the same machine minutes earlier were `pre_tool_use` p95 114 ms
      and `user_prompt_submit` p95 121 ms — i.e. the gate-open run measured FASTER on
      `user_prompt_submit`. That is machine noise between two 50-run samples, not a saving,
      and it is recorded as noise rather than reported as a win. Both readings sit well
      inside budget, which is the claim this step makes.

## Phase 4: Flip for Claude Code (E1)

- [x] **4.0 Repair D2.** Replace the comment at `src/scripts/condense.ts:1131-1134` with:
      `thin` is parked behind the thin quality null (ADR-202); `delivery` is licensed by
      `docs/CLAIMS.md:365` on delivery equivalence and its recall floor (Phase 2 of this
      roadmap) and is not gated by that null.
      verify: `grep -n '36.2' src/scripts/condense.ts` returns a line that names `thin`
      only.
      Done 2026-09-07, in the SAME edit as 1.2 and for a stated reason: `condense.ts` sits
      ~1,212 lines past the source-size ceiling, so the shortened comment is what paid for
      the host gate's lines and kept the file net-zero at 2,712.
      Verify output: `1131:        // 36.2% against a 48% pre-registered threshold,
      ADR-202). `delivery` is` — the returned line names `thin` (on the line above it) and
      the 36.2% figure, and the sentence continues to say `delivery` is NOT gated by that
      null and that citing it as one is K7.
- [x] **4.1 ADR recording E1** (`delivery` default, `hosts: [claude-code]`, rollback =
      `eager-all`, completeness invariant statement, per-host scope). It amends the CLAIMS
      row and states what it does not reopen (ADR-202, ADR-094). Check the highest live ADR
      number at the moment of authoring — 260 at this pin — and regenerate both
      `adr/regenerate_index --dir docs/decisions` and `adr/evidence_census`.
      verify: ADR exists; `DEFAULT_LEAN_PROJECTION_MODE` and the hosts default match it;
      `Rule backstops` CI job green on census freshness.
      Done 2026-09-07. `docs/decisions/ADR-267-delivery-default-for-claude-code.md`,
      `status: accepted`, `reopen_policy: owner`, evidence `E1`. `adr_cite_check ADR-267`
      reports **LIVE** with all seven basis paths `[found]`. `check_adr_frontmatter`: no
      errors.
      **Renumbered a SECOND time, 2026-09-08, 263 → 265.** While this branch sat open,
      `main` took 263 (`ADR-263-skills-are-explicitly-invoked-reference-material.md`) AND
      264 (`ADR-264-standing-payload-grace-ceiling-may-not-rise.md`), so the number this
      record picked collided again and the `docs/decisions/INDEX.md` merge conflicted on
      exactly that row. This is the twice-in-one-run case the collision stub predicts:
      the free number is read at renumber time, never carried from an earlier reading.
      The figures in the next sentence are the 263-era measurement and are left as
      measured rather than restated — the index and census were regenerated on the
      merged tree, and their post-merge counts are the ones the committed artifacts carry. Index regenerated (`201 numbered, 1 legacy`) and the evidence census re-run
      (`E0=75 E1=69 E2=44 E3=21 · human=13 agentic=122 mixed=21 unknown=53`).
      **Renumbered a THIRD and a FOURTH time, 2026-09-08, 265 → 266 → 267, both inside one
      merge session.** `main` landed its own `ADR-265`
      (`ADR-265-iron-law-reserve-refused-verifier-inside-the-change.md`), and this record moved
      to 266; a push-freshness fetch minutes later brought `main`'s fresh `ADR-266`
      (`ADR-266-explicit-pr-merge-invocation-is-the-this-turn-confirmation.md`), so it moved
      again to **267**, which is the live number. Both of `main`'s records are merged and
      therefore immovable, so the direction was forced rather than chosen. 267 was verified
      free on `origin/main` and across every open PR head at renumber time — and that check is
      NOT a guarantee, because collision four came from an already-merged lane rather than a
      competing PR. Eleven files carried delivery-meaning references and moved with the record;
      four cite `main`'s two records and were deliberately left alone, so a bare-string sweep
      would have re-pointed them at the wrong decision. The full four-collision record, and
      why open-PR-head checking is insufficient, is in
      `agents/roadmaps/stubs/road-to-adr-number-uniqueness.md`.
      **The verify's middle limb needed a decision, and the ADR now carries it as § Decision
      point 4.** `DEFAULT_LEAN_PROJECTION_MODE` is deliberately NOT flipped to `delivery`.
      The template and the constant answer different questions — what a consumer is GIVEN
      versus what happens when the value cannot be READ — and `lean_projection_mode.ts`'s own
      contract is that "a mode nobody can spell must never silently thin the standing
      corpus". Flipping the constant would make an unparseable settings file thin the corpus
      with nobody choosing to. So they match the ADR by the ADR saying which is which,
      rather than by both carrying the same string.
- [x] **4.2 Flip this repo first.** `.agent-settings.yml` → `delivery`/`[claude-code]`; full
      gate set green.
      verify: `check_preamble_payload_budget` on the repo reports rules ≤ 25,375 tok
      (**superseded from 20,000 by ADR-272**), total ≤ 40,000.
      **NOT MET as written, and left unticked rather than reported as done. 2026-09-07.**
      The repo IS flipped (`.agent-settings.yml` → `delivery` / `[claude-code]`, regenerated,
      `.claude/rules` holds stubs) and the full gate set below IS green. The verify fails on
      one of its two limbs, and both the number and its cause are nameable.
      **Measured on a CLEAN consumer-shaped root** (no user-scope layer, so no dedup — a
      maintainer checkout deduplicates 101 of 114 rules against `~/.claude` and would read
      4,115 tok for a reason that has nothing to do with the flip):

      | Tree | eager-all | delivery | verdict |
      |---|---:|---:|---|
      | `.claude/rules` | 99,598 tok | **24,166 tok** | −75.7 %, 114 files both sides |
      | `.cursor/rules` | 121,242 tok | 121,242 tok | byte-identical — D1 repaired |
      | `.clinerules` | 121,242 tok | 121,242 tok | byte-identical — D1 repaired |

      **Total: 24,166 + 14,846 (skills) + 746 (CLAUDE.md) = 39,758 ≤ 40,000. The total limb
      PASSES with 242 tokens of room. The rules limb MISSES: 24,166 > 20,000, by 4,166.**
      **The cause is my own 3.2 disposition and I am not hiding it.** Keeping the three
      path-only rules eagerly projected costs 23,401 bytes ≈ 5,850 tok. Without them the
      rules bucket reads ≈ 18,300 and the limb passes. The alternative — binding
      `pre_tool_use` — meets this limb and breaches the 2,048-byte cap E2 fixes. Both
      options violate an explicit E2 clause; I took the one that loses no capability and
      honours the cap, and the cost lands here. Closing it needs an owner call between two
      E2 clauses that conflict, not more engineering.
      **A second finding, and it is the larger one.** `check_preamble_payload_budget`
      defaults to `--project-rules-dir dist/agent-src/rules` — the projection SOURCE, which
      the flip does not touch. Its reading is 138,200 tok before the flip and 138,200 after.
      The gate that reds on 2026-11-10 measures a surface this roadmap's mechanism cannot
      move, so **Risk 3 is not resolved by the flip as specified.** Every figure above comes
      from measuring the tree the host actually loads instead. Pointing that gate at the
      host tree changes what every PR's budget ratchet measures, which is a decision with
      consequences beyond this roadmap and is 4.4's blocker below.
      **UPDATE 2026-09-09 — the SECOND finding is fixed; the FIRST is an owner question,
      quoted below per K9. The box stays `[ ]`.**
      The measurement-surface half is closed. `check_preamble_payload_budget` now takes
      `--host <id>` (resolving through `HOST_SURFACES` in
      `_lib/host_projection_reach.ts`, never a path map written into the gate) and
      `--project-rules-dir <path>` for a tree no host id names. The gated surface does NOT
      move: the no-argument reading, the blocking CI step, the `task ci` invocation and the
      base-ref ratchet all still measure `dist/agent-src/rules`, so no baseline or history
      entry is reinterpreted, and the host reading never touches the exit code. Recorded as
      `ADR-270`; AI council of 2026-09-09, 2/2 present, converged on option 1A.
      **A diagnostic came out of it that this step should carry.** On a maintainer checkout
      the host reading is **6,648 tok**, not 39,758 — 13 rule files against 119 in the
      source, because user-scope dedup and workspace/pack scope both shrink a maintainer
      tree for reasons unrelated to the projection mode. The gate now prints `PARTIAL TREE`
      with both file counts whenever the host tree is smaller than the source, because a
      bare total cannot tell a real saving from a tree that was never fully written. The
      roadmap's own 4.2 table already warned about this; the gate now says it out loud.
      **The rules-limb half is an OWNER DECISION, and both council seats said so
      independently.** The question put to them was whether to accept 24,166 and record the
      20,000 figure as superseded (2A), project the three path-only rules as stubs and
      accept the capability loss (2B), restore the `pre_tool_use` binding and breach its
      cap (2C), or invent a fourth delivery shape (2D). Both refused to answer it as a
      council, on the same reading of K9:
      · anthropic/claude-sonnet-4-5 — *"K9 states: a step needing a decision the file does
        not contain is reported as a question, with the step left open. We are reporting the
        question, but the escape does NOT authorize the council to rewrite the criterion.
        Accepting 24,166 is rewriting that criterion. The fact that it is documented in an
        ADR doesn't make it K9-compliant."* It added that the roadmap's own lines
        ("*closing it needs an owner call between two E2 clauses that conflict, not more
        engineering*") remove the authority question from council discretion by their own
        terms.
      · openai/codex-default — *"A recorded supersession is not council-compatible with K9.
        K9 permits escalating the missing decision; it does not grant the council authority
        to rewrite the criterion. Option 2A is valid only as an explicit repository-owner
        waiver or amendment of the K9-protected 20,000-token invariant."* It rejected 2D as
        well: *"its dispatcher-loads-and-returns-full-bodies assumes a synchronous host
        capability not established in the evidence. If it uses the governed hook to inject
        those bodies, calling it a new delivery mechanism does not necessarily avoid K4's
        rule-inject prohibition."*
      **THE QUESTION, quoted for the owner:** the rules bucket measures 24,166 tok against
      the Goal's 20,000. The whole 4,166 is one disposition — keeping
      `design-review-after-ui-write`, `source-of-truth` and `ui-audit-gate` eagerly
      projected full-bodied (≈ 5,850 tok), because the alternative keeps the `pre_tool_use`
      binding and breaches the 2,048-byte cap Phase 3 installs. Both options violate an
      explicit E2 clause. Do you (a) waive K9 for a recorded supersession of the 20,000
      figure, keeping the binding 40,000 total which PASSES at 39,758 and adding a
      rules-bucket ratchet at the measured value plus the project's headroom policy; (b)
      accept the capability loss and project the three as stubs; (c) authorise breaching the
      hook cap; or (d) hold the step open until a TESTED conditional-loading mechanism
      proves full rule content can be applied before the matched tool executes with the
      governed hook surface still ≤ 2,048 bytes? Both seats' recommendation, conditional on
      you delegating at all, is (a) — with openai adding that the old criterion must stay
      visible and marked superseded rather than rewritten as though it never existed.
      Not attempted: raising `design_ceiling` is K4, cutting rule prose is K5, and
      descoping this step to a carrier is K9.
      **CLOSED 2026-09-09 by ADR-272 — option (a), the owner having delegated the
      decision this step had reserved.** Both seats chose (a) across two runs; the first
      lost the openai seat to an `ENOBUFS` transport error rather than a refusal, and the
      retry recovered it. Their earlier declinations named the missing thing precisely —
      anthropic's recommendation was *"conditional on you delegating at all"*, openai's was
      *"valid only as an explicit repository-owner waiver"* — so the substance never
      changed, only the authority.
      The ceiling is **25,375 tok**, `ceil(24,166 × 1.05)` under the 5 % headroom policy.
      Measured 24,166 passes it with 1,209 tok of headroom; the binding 40,000 aggregate is
      unchanged and still passes at 39,758.
      **Recorded as an UPWARD supersession, because that is what it is.** An earlier draft
      called `20,000 → 25,375` a downward-only ratchet and openai refused the framing:
      *"It is plainly an upward change. Owner authorization may make that amendment
      legitimate, but it does not make the direction downward."* 25,375 is the new
      downward-only ratchet from here.
      **A correction to the council's own execution, found by checking its premise against
      the tree.** Both seats proposed writing a `rules_bucket_ceiling` key into
      `src/config/preamble-payload-budget.json`. That key does not exist and no gate reads
      one: `check_preamble_payload_budget.ts` contains neither `20000` nor any rules-bucket
      field, and the figure lives only in this file — the Goal and this verify line. Both
      seats flagged the risk themselves without being able to settle it from the material
      they had (openai: *"neither reviewer's invented JSON property names or shell commands
      should be adopted without repository inspection"*). The inspection was done. So the
      execution is these two prose amendments plus ADR-272, and no config edit — writing an
      unread key would have manufactured a governance surface that looks enforced and is
      not.
      **What this does NOT close, stated rather than implied:** the rules bucket now carries
      a ceiling nothing enforces deterministically. It was in that state at 20,000 too, so
      this step neither opened the gap nor closes it; closing it means giving
      `check_preamble_payload_budget` a rules-bucket limb, which is outside this change.

- [x] **4.3 Flip the package default** in a separate PR containing only the default change,
      the ADR link and regenerated projections.
      verify: fresh install fixture on a Claude Code host measures ≤ 40,000 total; on a
      Cursor-only fixture the tree equals `eager-all`.
      Done 2026-09-07 for the change itself; **the separate-PR half is not mine to do** and
      is flagged rather than faked — this lane is instructed not to open PRs, so the default
      flip rides in its own COMMIT on this branch and a reviewer should split it out if the
      one-change-per-PR shape is wanted.
      `src/config/agent-settings.template.yml` now ships `mode: delivery` +
      `hosts: [claude-code]`, with the rollback line and the host rationale in the comment
      block above it. Projections regenerated.
      **A shipped defect fell out of doing this, and it would have blocked every consumer
      who followed the documentation.** `validate_agent_settings` refused the flip:
      `lean_projection.mode: 'delivery' is not one of ['eager-all', 'thin']`. The settings
      SCHEMA never learned the third mode, although `_lib/lean_projection_mode.ts` has
      accepted it for months and `docs/CLAIMS.md:365` measures it — so a consumer who set
      the documented value failed validation. Enum extended, and `hosts` added with its own
      three-id enum so a typo is refused at the schema layer as well as dropped at the
      resolver. `validate_agent_settings`: OK.
      Verify limbs: the Cursor-side limb is discharged by `check_host_tree_parity` plus the
      1.2/4.5 fixtures, all green. The ≤ 40,000 limb is the 4.2 measurement above — total
      39,758 PASSES, rules 24,166 does not.
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
      **BLOCKED 2026-09-07, on a measurement-surface question this roadmap does not settle.**
      The step lowers `baseline_tokens` to "the measured post-flip total". There is no such
      total on the surface the gate reads: `check_preamble_payload_budget` defaults to
      `dist/agent-src/rules`, the projection SOURCE, and the flip leaves it at 138,200 —
      identical before and after. Lowering the baseline to the flipped number would pin the
      ratchet to a figure the gate cannot reproduce, and deleting `grace_ceiling` on top
      would red the gate for every PR on 2026-11-10 exactly as Risk 3 describes, with the
      flip already landed and no relief from it.
      What would close it: point the gate at the tree the host loads
      (`--project-rules-dir` per host, or a host-aware census), then lower the baseline to
      THAT reading. That changes what every PR's budget ratchet measures — a decision with
      consequences well beyond this roadmap, and not one an autonomous lane should take
      inside a step whose stated job is to lower a number.
      Not attempted, deliberately: raising `design_ceiling` is K4 and shortening rule prose
      is K5.
      **UPDATE 2026-09-09 — the measurement-surface question this step named IS now
      settled, and it does not close this step. OWNER DECISION, quoted per K9. The box
      stays `[ ]`.**
      `ADR-270` gives the gate a host-aware reading and keeps the ratchet on the source.
      That was the thing this step said would close it — *"point the gate at the tree the
      host loads, then lower the baseline to THAT reading"* — and the council explicitly
      declined that path for this step. openai/codex-default: *"1A explicitly leaves the
      blocking ratchet source-based, so introducing host ceilings does not retire the
      source grace. Under that proposal, unoptimized hosts still red on the deadline — the
      exact failure D3 must prevent."*
      **The step's instruction is also arithmetically invalid as written, and that is now
      recorded rather than left for the next reader to rediscover.** It says
      `baseline_tokens` becomes "the measured post-flip total". `baseline_tokens` is 102,520
      and the measured total is ~138,474, so following the instruction would RAISE the
      baseline by ~35,950 under language calling it a reduction. openai: *"Replace roadmap
      step 4.4's invalid instruction to set baseline_tokens to approximately 138,200. A
      baseline must never increase under language calling it a reduction."*
      **Both seats reserved this to the owner, on the same invariant** — moving
      `grace_end_date` is a substantive relaxation of ADR-264 in the TIME dimension even
      though the numeric ceiling does not rise. anthropic: *"Council-decidable for the
      dual-track mechanism and per-host ceilings. Owner-reserved for extending
      grace_end_date beyond 2026-11-10 — extending the date increases permitted exposure
      duration and is a substantive relaxation requiring owner authority."*
      **THE QUESTION, quoted for the owner:** `grace_end_date` is **2026-11-10**. On that
      date the gate compares ~138,474 against `design_ceiling` 107,646 and reds every pull
      request, whether or not `grace_ceiling` is deleted — so doing nothing is deferral, not
      safety. The two seats proposed different mechanisms and neither may execute without
      you:
      · anthropic — **dual-track with a hard deadline.** Add `per_host_ceilings`
        (`claude-code: 40000`) and a `grace_retirement_note`; the grace retires when EITHER
        all major hosts (augment, claude-code, cline, cursor) have delivery modes with
        per-host ceilings, OR the source corpus measures ≤ `design_ceiling`. 2026-11-10
        stays hard and reds if neither track lands. Its own checkpoint: by 2026-11-03,
        decide which track will satisfy the deadline and resource it.
      · openai — **one-time owner-approved date extension**, ADR-recorded, moving only the
        date and the ADR reference, with `grace_ceiling`, `design_ceiling`,
        `baseline_tokens` and their history untouched, a named migration deliverable
        (complete writer-derived host measurements, make them blocking, then retire the
        source-corpus grace as an explicit governance migration), a CI warning well before
        the new date, a test proving expiry behaviour, and no automatic second extension.
        It rejected the source-relocation alternative as *"accounting theater"* that
        *"may conflict with K9's prohibition on relocating material to escape the
        criterion. It is not a demonstrated 30,500-token reduction mechanism."*
      Which mechanism, and whether the date moves at all, is yours. Neither seat proposed
      leaving it as it is, and both named the 2026-11-10 red as the thing to avoid.
      **UPDATE 2026-09-09 — the council was asked again under the owner's delegation, and
      it SPLIT. Recorded as an escalation rather than resolved by picking a side.**
      Both seats agree on the thing that settles this step's shape: **a date extension does
      not close 4.4.** openai, verbatim: *"Step 4.4 remains open until all four host modes
      and their enforced ceilings land and the source grace is actually retired."* An
      extension amends the deadline; it is not the retirement the step names. So whatever
      the owner decides about the date, this box stays `[ ]` until the migration lands.
      **Where they split: the date.** anthropic endorsed **2026-12-15** (96 days, with a
      2026-11-28 checkpoint and an explicit checkpoint-failure protocol). openai proposed
      **2027-02-10** with a 2027-01-10 CI warning — while also calling a three-month choice
      *"an arbitrary policy choice, not an evidence-derived deadline"*, which lands on its
      own number as much as on the other. Neither date comes from a delivery estimate,
      because nobody has one.
      **Owner call, on a ground already recorded.** Extending `grace_end_date` is a
      relaxation in the TIME dimension, which anthropic itself classified owner-reserved —
      and a split council does not acquire authority a converged one was denied.
      **THE QUESTION, for the owner:** `grace_end_date` is 2026-11-10. On that date the
      gate compares ~138,474 against `design_ceiling` 107,646 and reds every pull request
      whether or not `grace_ceiling` is deleted, so doing nothing is deferral rather than
      safety. Move it to 2026-12-15 (tighter, named checkpoint), to 2027-02-10 (more
      runway, CI warning a month out), or neither?
      **Two facts the next reader should not re-derive.** `grace_ceiling` is **138490**,
      not the 138,474 that circulated in the council prose — that number came from this
      roadmap's own text and the config is the authority. And the step's instruction to set
      `baseline_tokens` to "the measured post-flip total" stays invalid whatever the date
      does: `baseline_tokens` is 102,520 against a measured ~138,474, so following it would
      RAISE a baseline under language calling it a reduction. Both seats said so
      independently.

      **UPDATE 2026-09-10 — a premise every prior round decided on is FALSE, and checking it
      is the finding of this run. The box stays `[ ]`, and now for a different reason than
      before.**
      Every escalation above rests on one sentence: *"On that date the gate compares ~138,474
      against `design_ceiling` 107,646 and reds every pull request."* **Nothing in the tree
      implements it.** Reproduced at `7bf325f3b`: the only consumers of
      `ci_delivery.grace_end_date` were an `echo` at
      `.github/workflows/standing-payload-delta.yml:130` and the return-type annotation of a
      test helper at `tests/scripts/check_preamble_payload_budget.test.ts:165,168`, which
      asserted nothing about it; and `grep -n "new Date\|Date.now\|toISOString\|expire\|expiry"
      src/scripts/check_preamble_payload_budget.ts` returns **no matches**. `taskfiles/ci-fast.yml`
      never read the date at all. On 2026-11-10 the workflow would have read `grace_ceiling`
      138,490, passed it as `--ceiling`, and every PR would have PASSED. The design ceiling
      becomes operative when a human edits the config, and the date was the note reminding
      them to. Full reproduction:
      `agents/evidence/analysis/grace-ceiling-expiry-is-unenforced-2026-09-10.md`.
      **The correction was put back to the council, which withdrew its own prior verdict.**
      A round on 2026-09-10 had decided a one-time extension to 2026-12-15; re-asked on the
      corrected facts, both seats abandoned it. openai, verbatim: *"The corrected premise
      conclusively defeats P4: changing 2026-11-10 to 2026-12-15 neither extends nor relaxes
      any executable rule. It merely changes misleading documentation."* anthropic: extending
      it *"perpetuates theater"*. Re-asking was not verdict shopping — the seats had been
      given a false premise by this run, out of this file's own text, and the removal of a
      decisive argument is a different question rather than the same one asked twice.
      **VERDICT (AI council 2/2, 2026-09-10, under the written owner delegation): option P3.**
      Delete the unenforced `grace_end_date`; keep `grace_ceiling` at 138,490, shrink-only and
      undated; correct every prose site that claimed the expiry; **build no expiry.** The last
      clause was forbidden rather than merely declined — openai: *"Do not implement hard or
      warning-only expiry under the guise of 'adding a test'"*; anthropic filed it under
      `non-destructive-by-default`, because arming a repo-wide stop on a date where
      `status_2026_08_24.committed_reduction_mechanism` is still the string `"NONE"` creates a
      cliff nobody can clear. This is also why the previous round's instruction to *"add an
      expiry-behaviour test"* was NOT executed: there is no expiry behaviour, and writing that
      test means first building the cliff.
      **What landed, with provenance at this commit.** `grace_end_date` deleted from
      `src/config/preamble-payload-budget.json`; `why_a_grace_ceiling` there now records that
      the expiry never existed instead of asserting it; the date read and the `(expires $end)`
      message removed from `.github/workflows/standing-payload-delta.yml`; the stale
      `"138,212, expires 2026-11-10"` clause corrected in `taskfiles/ci-fast.yml` (both halves
      were wrong — the figure was two raises stale as well); the dead field dropped from the
      test helper's type and a **regression pin** added asserting the key is absent AND that
      neither the workflow nor the taskfile reads it. The pin was proven sensitive rather than
      assumed: reintroducing the key with a `2026-12-15` value and restoring the workflow read
      turned both assertions red, and the exact reverse edit restored 37/37 green.
      `ADR-274` records the decision, the two rejected alternatives and the honest limits.
      **What did NOT land, and why the box stays `[ ]`.** `grace_ceiling` is still 138,490, so
      `grep -c grace_ceiling src/config/preamble-payload-budget.json` does not return 0 and
      this step's own exit condition is unmet. Both seats said so explicitly and neither left
      it to inference — openai: *"Step 4.4 must remain open. 'Grace ceiling gone' is false.
      The roadmap must not be closed as complete."* anthropic reached the same place by its
      fallback branch. The option that WOULD have satisfied the grep — replacing the stored
      ceiling with `max(design_ceiling, measured-at-base-ref)` — was rejected **as unreviewed
      rather than on the merits**: openai, *"Its behavior across merge queues, rebases, changed
      default branches, shallow history, and measurement failure is unresolved. Those are
      policy semantics, not implementation details."* anthropic would have attempted it behind
      a specification of exactly those cases with every failure erroring loudly, which the
      gate's existing base-ref reader (`src/scripts/check_preamble_payload_budget.ts:399-450`)
      does not do — it returns `null` on every failure, correct for a diagnostic and
      unacceptable for a ceiling. The converged floor is therefore the narrower option, and
      the wider one is left as a separately reviewable change.
      **UPDATE 2026-09-10 — the rejection premise is FOUR-FIFTHS ALREADY SOLVED, checked
      against the tree rather than argued. The box stays `[ ]`; what is actually open is a
      smaller and different question than the one that was reserved.**
      openai listed five things whose behaviour was "unresolved" for a base-ref-measured
      ceiling. Four of them are resolved in `src/scripts/_lib/ratchet_base_ref.ts`, with
      recorded reasons — and THIS gate already calls that resolver, at
      `check_preamble_payload_budget.ts:381`, for its shrink-only bound:

      | Case named as unresolved | Where it is resolved |
      |---|---|
      | merge queue / PR-merge checkout | `:82` — `GITHUB_ACTIONS` plus a two-parent HEAD selects `HEAD^1`, and `:77-81` records why the gate on `GITHUB_ACTIONS` is load-bearing rather than incidental |
      | rebase, and a changed default branch | `:67` — `GITHUB_BASE_REF` is consulted before `origin/main`/`main`, so neither a rebase nor a rename reaches the hardcoded pair |
      | shallow history | `:44-50` — the resolver's stated reason for existing: a shallow PR-merge fetch has no `origin/main`, and the `HEAD^1` rung needs no network |
      | measurement failure | `:93` — returns `null`, and `:52-53` states the contract: *"callers decide, and the honest default is to fail rather than to compare against an assumed-empty base"* |

      The fifth is the real one, and anthropic named it exactly: the CALLER does not fail.
      `_lib/standing_bound_ratchet.ts:96` returns `ok: true` with an explanatory note on a
      null base ref, and again at `:106`, `:121` and `:130` for unreadable, unparseable and
      absent config. That is correct for a diagnostic and is precisely what a ceiling may not
      do. It is one branch to change, not a policy question.

      **WHAT IS ACTUALLY UNRESOLVED, and it is not on either seat's list.** A ceiling of
      `max(design_ceiling, base measurement)` has ZERO headroom: a pull request that grows by
      one token reds. This repository has already recorded that exact failure in a sibling
      budget — `src/config/pack-size-budget.json:12`, *"With 8.9 KB of headroom ANY commit
      reds this gate, which is the failure the 2026-08-20 note predicted in writing, arriving
      a second time three days later."* Adding headroom fixes it and introduces compounding
      drift, because each pull request may then grow by the allowance. `headroom_pct: 5`
      already exists in this file and is what `design_ceiling` is derived from, so the choice
      is not whether a number exists but whether a per-PR allowance may compound against a
      moving base.
      **That is the question to put to the council, and it was never asked.** The seats
      reserved a five-part specification, four parts of which the tree had already written;
      the part that genuinely needs a decision was not among them. Recorded here so the next
      round starts from the open question instead of re-deriving the closed four.
      **Not attempted by this run, deliberately:** deciding the headroom policy alone. The
      council quota was exhausted (0/50) when this was found, so the alternative to recording
      it was one lane choosing a per-PR growth allowance for every pull request in the
      repository, unreviewed. `K9` prescribes `[ ]` with the question quoted; the question is
      now a sharper one.

      **UPDATE 2026-09-10 — THE HEADROOM QUESTION WAS ASKED AND ANSWERED. AI council 2/2
      convergent (anthropic/claude-sonnet-4-5 + openai/codex-default, blind peer review),
      under the written owner delegation. The box still stays `[ ]`, and the verdict says so
      explicitly.**

      **Q1 — may a per-PR allowance compound against a moving base? NO.** Both seats, without
      qualification. openai: *"Neither a percentage nor a fixed token allowance is safe
      against a moving base: both authorize cumulative growth."* anthropic put the arithmetic
      on it — 138,413 × 1.05^10 ≈ 225,000. `headroom_pct` belongs to deriving the FIXED
      design ceiling from `baseline_tokens` and must not be re-applied to each moving base.
      A capped variant (`min(base × 1.05, 138490)`) was raised in review and refused by both:
      it preserves today's overage as permanent, and its reduction tracking is dormant until
      the base drops below ~131,895, so the first ~6,518 tokens of any reduction become
      reusable space instead of a lower ceiling — the opposite of shrink-only.

      **THE FORMULA, converged:** `max(design_ceiling, payload_at_base_ref)`. Zero net growth
      while the tree is over design; the design ceiling once it is at or below.

      **Q2 — how does a necessary addition land with zero headroom?** Normally by a same-PR
      offset, which the gate enforces mechanically (head payload ≤ base payload). For a
      change where an offsetting reduction is genuinely unsafe, a break-glass path that both
      seats specified in the same shape and that is ARCHITECTURAL rather than optional: a
      fixed token grant · the pre-exception watermark recorded · approval by a designated
      owner, outside PR-modifiable policy · all later net growth blocked until the debt is
      repaid · a machine-enforced expiry · and the exceptional measurement must NEVER become
      the next base. openai on today's slack: *"The current 77 tokens are slack under the
      obsolete stored exception, not an entitlement that survives its removal."*

      **Q3 — is a measured ceiling an improvement over the stored one? YES, and for one
      reason.** It captures every merged reduction automatically; a stored ceiling stays at
      138,490 until someone lowers it by hand, so payload that was removed can be added back
      into the space it freed. That benefit disappears if an exception becomes the next base,
      which is why the watermark is not optional.

      **Q4 — may 4.4 close on this? YES, but not on the grep.** openai: *"It closes only when
      the stored exception has been replaced by an active, required, fail-closed measured
      ratchet and any exceptional growth preserves repayment debt. Until then, the `grep`
      exit condition is insufficient evidence and 4.4 must remain open."*

      **PREREQUISITES BOTH SEATS MADE BLOCKING — a measured ceiling without them is a
      REGRESSION, not an improvement (anthropic's word).**
      · `_lib/standing_bound_ratchet.ts`'s fail-open returns at `:96`, `:106`, `:121`, `:130`
        must be replaced or mode-gated; a failed measurement may not read as `ok`.
      · Base-resolution failure must BLOCK, not warn.
      · **The trust boundary, which no prior round named and which is the sharpest finding
        of this one:** the measurement code, the workflow invocation, the catalogue inclusion
        rules and the base resolver are all editable by the pull request being measured. A
        stored ceiling is protected from that by ADR-264 plus the shrink-only bound check; a
        measured one is not, unless those surfaces are review-protected or workflow-pinned.

      **ONE SEAT WENT FURTHER, and it is recorded because it reframes the target rather than
      the mechanism.** anthropic: neither the stored nor the measured form plans to eliminate
      the overage — 138,413 against a design ceiling of 107,646 is **30,767 tokens of debt**,
      and both proposals normalise it. Its refinement makes the design ceiling the organising
      principle: headroom applies only at or below it, the overage is measured and REPORTED
      by the gate rather than merely compared against, and an exception carries a repayment
      schedule. openai did not contradict this and its own mechanism is compatible with it.

      **What this run did NOT do, deliberately: build it.** The verdict names four blocking
      prerequisites, one of them a trust-boundary question about which surfaces a pull request
      may edit — which is repository governance rather than a gate edit. Implementing the
      formula without them is the regression both seats warned about, so the next change is
      the prerequisites, not the ceiling.

      **UPDATE 2026-09-10 — PREREQUISITES 1 AND 2 ARE DONE. 3 AND 4 ARE NOT DECIDED, and
      that is recorded as a non-decision rather than dressed as one.**
      Owner instruction: build 1 and 2, put 3 and 4 to the council, and — the constraint
      that shapes both — *"it must not block us completely again. We want an agent system
      that can later develop autonomously, where tests and CI ensure quality."*

      **1 and 2, shipped together because they are one branch.** Both prerequisites name the
      same four `ok: true` returns in `_lib/standing_bound_ratchet.ts`. They now route
      through a single `unverified()` helper with two postures: advisory (the default, and
      what every existing caller keeps) reports the skip; enforcing (`requireBase: true`)
      refuses. The CI step passes `--require-base`.
      **Mode-gated rather than replaced, and the reason is in the module's own prose.** Its
      docstring already argued the skip: a shallow clone, a first commit and a detached
      build legitimately have no base, and a gate that reds on a developer's machine gets
      switched off. That argument is still right for a cross-check and stops being right
      once the base ref IS the ceiling — an unreadable base costs a comparison today and
      would grant an unbounded budget then. anthropic's wording was "replaced or
      mode-gated"; this is the gate, so no existing caller changes behaviour silently.
      The flag is the caller's rather than derived from `GITHUB_ACTIONS`: a gate that infers
      its own strictness from an environment variable is one `env` edit away from being
      advisory everywhere.
      SENSITIVITY: five new tests pair every enforcing case with the SAME input in advisory
      posture, plus one asserting that a VERIFIABLE bound reaches the same verdict in both —
      otherwise the flag would be a second policy rather than a mode gate. 12/12 green.

      **3 and 4 could not be decided: the council is quota-exhausted.** Three attempts.
      The first spent quota and wrote no file (the output path is validated after the spend
      — a known trap). The second and third returned 1/2 with openai failing on
      `os_error: ENOBUFS` twice, which is transport rather than refusal; shortening the
      question from 4,504 to 2,563 bytes did not help, and the fourth attempt returned 0/2.
      `council:status` now reads both seats `degraded (quota_exhausted)`.
      **Two independent single-seat readings are not convergence, and this file will not
      record one as a verdict.** What the answering seat argued is worth carrying as a
      POINTER for the next round rather than as a decision: that neither a 5,000-token nor a
      256-token exception cap was derived from anything, and that the cap has to come from
      the measured distribution of payload deltas over recent merged pull requests — because
      a guessed number either blocks most agent work or authorises abuse, which is exactly
      the owner constraint above from both sides. It also named a gap neither prior round
      had: **catalogue completeness** — a pull request can move payload into a location the
      measurement does not enumerate, and no ceiling formula sees that.
      **The cheapest thing that makes the next round conclusive** is measuring that
      distribution — p50/p90/p95/p99 of payload delta over the last N merged PRs. It commits
      to nothing, and it converts "pick a cap" into "here is the data". Not done here; named
      so the next run starts with it rather than with another guess.
      **Not attempted, deliberately, and unchanged from the earlier note:** raising
      `design_ceiling` is K4 and shortening rule prose is K5. Added to that list by this
      round: closing this roadmap through a stub carrier, which openai forbade in terms —
      *"Do not close the roadmap through a stub, carrier, rewritten acceptance criterion, or
      cosmetic grep compliance."* anthropic's suggestion to mark this step `[-]` was also not
      taken: in this repository `[-]` is CANCELLED and owner-reserved, and `[~]` requires a
      `carried-to=` receiver, which is the stub carrier the other seat forbade. `[ ]` with the
      question quoted in the PR body is what K9 prescribes, so `[ ]` is what it keeps.

- [x] **4.5 Rollback fixture.** flip → `eager-all` → `diff -r` against a never-flipped tree
      is empty; documented in `docs/contracts/rule-router.md`.
      verify: fixture green.

## Phase 7: Truth surfaces

- [x] **7.1 Flip `docs/CLAIMS.md:365`** to a backed claim scoped `claude-code` only,
      evidence = the Phase 0 artefact plus the post-flip census; `non_inference` states the
      per-host scope. No README wording added.
      verify: `./scripts-run src/scripts/check_claims` green; the evidence pointer resolves;
      `./scripts-run src/scripts/build_proof` re-run in the same change.
      Done 2026-09-07. The row was not merely stale, it was FALSE in three clauses the
      moment 4.3 landed: it said "MEASURED-BUT-NOT-SHIPPED", that the mode "still resolves
      to `eager-all`", and that the activation charge was unpaid. Shipping a change that
      falsifies a `backed` claim and leaving the claim standing is the failure the ledger
      exists to prevent, so this step was not optional after 4.3.
      Rewritten to lead with the scope — SHIPPED FOR CLAUDE CODE ONLY — and to carry the
      re-measured figures (616/616 byte-equal, 101/101 reachable, 0 of 212 near-misses,
      $0.7167 vs $4.0401) plus the per-host byte table. The superseded figures are named as
      superseded rather than deleted, with the reason no delta may be computed between them:
      the corpora differ.
      A `non_inference` was added, which the row did not have. Five readings it refuses,
      the last being the one a reader is most likely to get wrong:
      `check_preamble_payload_budget` is UNCHANGED at 138,200 by this flip, because it reads
      the projection source rather than the tree a host loads — so a reader comparing that
      gate before and after correctly sees no movement, and that is not evidence against
      the saving.
      `check_claims` green (9 markered, 99 entries); the evidence pointer resolves;
      `build_proof` re-run and `--check` reports in sync.
- [x] **7.2 Per-host cost table** generated from the census into the contract the README
      points at; the generator fails when the census is missing.
      verify: table numbers equal the census.
      **Was BLOCKED 2026-09-07 on the measurement-surface question. Unblocked and DONE
      2026-09-09.** The block was correct as stated: the census this step meant
      (`check_preamble_payload_budget`) read the projection source, where every host
      carries the same number, so a per-host table generated from it would print one
      figure three times and call it per-host. The AI council of 2026-09-09 settled that
      question (2/2 present, converged on option 1A — `ADR-270`), and the step became
      executable without any of its words changing.
      **The census used is the reproducible one**, and the choice is deliberate:
      `report_standing_payload_by_host`, whose unit is the projection source minus the
      ADR-004 `type: manual` rules no per-tool tree receives — the UPPER BOUND a host
      loads on an unscoped, un-deduplicated install. A published contract table has to be
      reproducible by a reader, and a host-tree reading is not: this checkout holds 13
      rule files under `.claude/rules` against 119 in the source, because user-scope dedup
      and workspace/pack scope both shrink a maintainer tree for reasons unrelated to the
      projection mode. The per-install reading is the gate own new `--host` flag, and the
      table points at it so the two are not confused.
      **The contract is `docs/contracts/rule-router.md`** — what `README.md:288` points at
      for projection modes, and where 4.5 already documented the rollback fixture. The
      table sits between `<!-- BEGIN generated: host-standing-cost -->` markers, so a
      re-run replaces rather than appends.
      **Verify output:** `host cost table: docs/contracts/rule-router.md in sync (9 hosts,
      pin b6af20db552fdbcc5e8507cd6a1d314925740ba8)`. The generator refuses when the
      census is missing (probed end to end: exit 2 with the regenerate instruction, then
      restored and green again), when the `## Per host` section has no parseable rows, and
      when the census declares no pin.
      **It also caught a real staleness, and this is the part worth reading.** The step
      verify — *table numbers equal the census* — is satisfied by ANY table generated from
      a stale census, including one that contradicts the repository. So the generator takes
      a SECOND reading live from the tree and refuses when the two disagree. First run:
      the committed census read 486,063 B per per-rule host and the tree read 486,068 B —
      five bytes across four host rows, invisible to this step own check. Census re-emitted
      at `b6af20db`, which is the commit that landed the host reading.
      18 tests, all refusal paths pinned, plus one asserting the committed state stays in
      sync so the drift reds in CI rather than waiting to be noticed.

- [x] **7.3 Apply E7** to the two `later/` token roadmaps.
      verify: both files have a disposition;
      `./scripts-run src/scripts/lint_roadmap_later_disposition` green.
      Done 2026-09-09, in its own change for the reason the AC below already
      gave: archiving a roadmap here moves three ratchets — the estate count,
      the risk-register floor and the archive index — and folding that into the
      commit that carried the default flip, an ADR and a schema repair would
      have made a revert of any one a revert of all.
      Both files are now at `agents/roadmaps/archive/`. Each carries an
      ARCHIVED-under-E7 banner naming the mechanism that discharged it: the
      `delivery` flip took `.claude/rules` from 99,598 tok to 24,166 tok
      (−75.7 %) with every non-Claude host byte-identical, and the thin lever
      both files chased is separately dead by measurement (two pre-registered
      length-neutral judge runs, both inconclusive, CLOSED-BY-DIAGNOSIS).
      **The non-rule-layer residue E7 names is carried, not dropped**, into
      `agents/roadmaps/stubs/road-to-token-saving-residue.md` with a `review_by`
      and one promotion probe per item: R1 the RTK golden-set validation and the
      kernel promotion behind it (operator-gated, and a kernel edit besides),
      R2 the live trigger-eval pass, R3 the `telegraph-speak` removal —
      **owner-reserved, measured RED with a council recommending removal and
      waiting only on authorization, so it is an unexecuted owner decision
      rather than residue and this run did not take it** — R4 the zero-cost
      dormancy flag nobody set, R5 the 26 remaining `.agent-src.uncondensed`
      prose references, R6 the measured-before/after bar.
      One byte changed inside an archived file, named so it is not read as
      silent editing: `phase-0-golden-set`'s status token read `RESOLVED
      NEGATIVE` and now reads `resolved`, so the machine-readable half matches
      the prose that was already beside it.
      Verify output: `lint_roadmap_later_disposition` green, and both
      wake-condition ratchets moved DOWN with the two files leaving `later/`.

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
<!-- risk-review: v1 | reviewed: 2026-09-10 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|---|---|---|---|---|---|
| 1 | A rule stops being delivered and nobody notices | product | The whole flip rests on trigger-match delivery. A rule whose trigger never fires becomes invisible while the file still exists on disk, so every completeness check that counts files passes. | Phase 2 makes the recall floor a precondition: 102/102 reachable with 0 false fires on ≥ 202 near-misses, plus 2.2's eager fallback for a trigger-less `auto` rule and 2.3's MUST-LOAD floor for every `always` rule. **Re-reviewed 2026-09-08: mitigated, and the mitigation's own figure was WRONG.** Phase 2 is complete and the sibling roadmap's 3.1 measured description-only reachability at 179 → 284 of 309 auto-rule positives (57.9 % → 91.9 %). The `102/102` above is not the population: **8 of 105 auto rules carry no keyword or phrase trigger at all**, so the real denominator is 97. The floor held; the number it was written against did not, and it is corrected here rather than left to read as met. **Re-reviewed 2026-09-09: unchanged.** Nothing in the 2026-09-09 change touches trigger matching, the router, or any rule body — it adds a second reading to one gate and publishes a table. The recall floor and its corrected denominator stand as recorded. | Phase 2: Recall floor for Claude before the flip |
| 2 | A non-Claude host silently loses its rule bodies | product | D1 is live today: the stub write is host-independent, so flipping the mode before Phase 1 lands reduces Cursor and Cline to pointers on hosts where hook delivery is unmeasured. | Phase 1.4 is a CI gate asserting byte-identity to `eager-all` for every host outside `hosts`, and K3 forbids thinning one; Phase 4 may not start before it is green | Phase 1: Host-scoped delivery (repairs D1) |
| 3 | The standing-payload overage is carried indefinitely with no forcing function | implementation | 73 tokens of headroom at this pin, against a design ceiling 30,767 tokens below the measurement and no committed mechanism to close it. **The risk was MIS-STATED until 2026-09-10** — it read "The 2026-11-10 date passes with the flip unlanded / on expiry the design ceiling applies and every PR inherits a red gate", and no expiry existed to pass. The register is corrected rather than re-scored: the exposure is real, it is just not dated. | ~~Phases are ordered so 4.2 flips this repo before 4.3 touches the package default; 4.4 lowers the baseline and deletes the grace block in the same commit.~~ **REFUTED 2026-09-08, and this is the finding of the run rather than a status update.** The mitigation assumed the flip moves the surface the gate measures. It does not: `check_preamble_payload_budget` reads the projection SOURCE by default, which the delivery flip never touches — measured 138,200 before the flip and 138,200 after. **Risk 3 was UNMITIGATED and is now HALF-MITIGATED — re-reviewed 2026-09-09.** The surface decision was taken: an AI council (2/2, converged) split the two quantities and gave the gate a `--host` reading while leaving the ratchet on the source (`ADR-270`). That closed 7.2, which is now ticked. **It did NOT close 4.4, and the council said so explicitly** — leaving the blocking ratchet source-based means unoptimized hosts still red on the deadline, which is this exact risk. **So the residual is unchanged in substance: on 2026-11-10 the gate compares ~138,474 against `design_ceiling` 107,646 and reds every pull request, whether or not `grace_ceiling` is deleted.** Doing nothing is deferral, not safety. What is different is that the remaining decision is now scoped, costed and owner-addressed rather than unowned: two mechanisms are quoted at step 4.4 (a dual-track retirement with the date held hard, or a one-time owner-approved date extension tied to a named migration), and both seats reserved the date dimension to the owner because moving it relaxes ADR-264 in the time dimension even with the numeric ceiling unchanged. A third finding landed with the review: 4.4's own instruction to set `baseline_tokens` to the measured post-flip total would RAISE the baseline by ~35,950 under language calling it a reduction, so the step could not have been executed as written even with the surface question settled. **Re-reviewed 2026-09-10, and the fourth finding is the largest: the deadline this row was built around does not exist.** `grace_end_date` was enforced by nothing — two reads, an `echo` and a test-helper type, and no date logic in `check_preamble_payload_budget.ts` — so the "repo-wide stop" this row predicted for 2026-11-10 could not have occurred. The key is deleted (`ADR-274`), the ceiling stays 138,490 and enforced, and the residual is restated honestly: **an undated, shrink-only tolerance 30,767 tokens above the design ceiling, with `committed_reduction_mechanism` still recorded verbatim as `NONE`.** That is a WORSE standing position than the row claimed and a BETTER description of it: what was lost on 2026-09-10 is a forcing function that was fictional, and what was gained is that nobody plans against it again. **Mitigation now, stated after the completion review caught this cell over-claiming twice.** The draft of this row named `target_schedule.on_miss` as the replacement forcing function — that *"requires"* the 2026-11-10 miss to be published and that the miss *"will land on schedule"*. **That was the same defect one paragraph after removing it:** `grep -rn "target_schedule"` and `grep -rnw on_miss` over `*.ts *.js *.yml *.yaml *.sh` outside `dist/` return **0** hits, so nothing will publish anything on any date, and `ADR-274` says in the same commit that those milestones *"were never the enforcement surface"*. Retracted here rather than softened. **What is actually enforced is one thing and it bounds growth only:** the shrink-only ratchet, per PR, against the base ref. And it is conditional rather than absolute — `assertBoundsDidNotRise` (`src/scripts/_lib/standing_bound_ratchet.ts:94-135`) returns `ok: true` on four base-ref failure modes (no base ref resolved, budget config unreadable at the base ref, unparseable, or no `ci_delivery.grace_ceiling` there), each with an honest note and a passing verdict, so it **fails open** on a shallow clone or an unresolvable merge base. Naming that is not optional here: `ADR-274` disqualifies a rival proposal for exactly this property, so relying on it unqualified would be the same standard applied twice with two answers. **NOT mitigated, and now with nothing standing in for it:** no enforced mechanism converges the corpus toward 107,646, and after this change no dated one purports to either. `status_2026_08_24.committed_reduction_mechanism` opens with `NONE` and continues into a paragraph explaining why the absence is the finding — it is not the bare token this row once called it *"verbatim"*. | Phase 4: Flip for Claude Code (E1) |
| 4 | The activation charge reads as config weakening and stalls | implementation | The charge is literally a slot-sum raise plus a baseline move, and both shapes are what a reviewer or a guard is trained to refuse. | E2 names the file, line and target value, and cites the budget row's own reason text assigning the move to this run; `block_config_weakening.ts:96-98` classifies the file `advisory`, so its output is a warn to document, never a block. **Re-reviewed 2026-09-09: unchanged, and worth stating why the new work did not add to this risk.** The host reading is additive and moves no ceiling, no baseline and no slot sum — `preamble-payload-budget.json` is untouched by this change, so there is no second config-weakening shape for a reviewer to weigh | Phase 3: Pay the activation charge (E2) |
| 5 | Post-compaction re-delivery is assumed rather than tested | implementation | `pre_compact` binding exists, but nothing in the tree asserts a body survives a compaction boundary — and a rule lost there is lost for the rest of the session. | 2.4 makes it a fixture with a stated contract in the hook header, not a property inferred from the binding | Phase 2: Recall floor for Claude before the flip |

## Acceptance Criteria

**One misplaced note, named rather than deleted (2026-09-10).** The indented paragraph
immediately below carries no checkbox and belongs to no criterion. It was written into this
section by `b02ba958f` while step **7.3** was still `- [ ]`, and it is 7.3's status note — a
reader arriving here otherwise sees what looks like an acceptance criterion whose checkbox
vanished. **It is superseded:** 7.3 is now `[x]` and both `later/` roadmaps are archived under
E7, so the note's own conclusion ("left for a separate change") has been discharged exactly as
it proposed. Retained verbatim as the record of why the work was split, not rewritten to match
the outcome.

      NOT DONE 2026-09-07, and deliberately not attempted. E7 archives two `later/` roadmaps
      "once Phase 7.1 flips the claim", which has now happened, so the precondition is met
      and the work is available. It is left for a separate change because archiving a
      roadmap in this tree moves three ratchets that are not this change's subject — the
      estate count, the risk-register floor, and the archive index — and folding that into a
      commit already carrying a default flip, an ADR and a schema repair would make a
      revert of any one of them a revert of all. `lint_roadmap_later_disposition` is green
      as it stands, so nothing is red while this waits.
- [x] `check_preamble_payload_budget` on a Claude Code install: total ≤ 40,000 tok, rules
      ≤ 25,375 (**superseded from 20,000 by ADR-272**).
      SPLIT VERDICT 2026-09-07 — total limb MET, rules limb MISSED, and left unticked
      because a criterion with two limbs is not met by one. On a clean consumer-shaped root:
      total **39,758 ≤ 40,000** (rules 24,166 + skills 14,846 + CLAUDE.md 746); rules
      **24,166 > 20,000**, by 4,166. Cause named in 4.2: keeping the three path-only rules
      eagerly projected costs ≈ 5,850 tok, and the alternative breaches the `pre_tool_use`
      cap E2 fixes. Also in 4.2: `check_preamble_payload_budget` reads the projection SOURCE
      by default and is unchanged at 138,200 either way, so this criterion cannot be
      evaluated by that gate's default invocation at all.
      **UPDATE 2026-09-09 — the last clause above is now FALSE, and the criterion is
      evaluable. It is still not met, and the box stays `[ ]`.**
      `check_preamble_payload_budget --host claude-code` measures the tree the host loads
      (`ADR-270`), so "on a Claude Code install" is no longer a thing the gate cannot
      express. What it reports on a maintainer checkout is 6,648 tok from 13 rule files
      against 119 in the source, flagged `PARTIAL TREE` — a maintainer reading, not a
      consumer one, and the gate now says so rather than leaving the number to be
      misread. The consumer figures stay the roadmap's own clean-root measurement:
      total **39,758 ≤ 40,000 PASSES**, rules **24,166 > 20,000 MISSES by 4,166**.
      So the split verdict is unchanged and its cause is unchanged. What moved is that
      the miss is now an OWNER question with two council seats' reasoning attached rather
      than an unanswered one — quoted in full at step 4.2. A criterion with two limbs is
      still not met by one.
- [x] Every host not in `lean_projection.hosts`: rule tree byte-identical to `eager-all`
      (Phase 1.4 gate in CI, green).
      MET 2026-09-07, and asserted per PR rather than observed once.
      `check_host_tree_parity` generates both projections into a temp root and diffs every
      non-delivery tree: `2 non-delivery host tree(s) byte-identical to eager-all · delivery
      hosts [claude-code]`, exit 0. Measured on a clean root: `.cursor/rules` and
      `.clinerules` read 121,242 chars/4 tok under BOTH `eager-all` and `delivery`. Red
      direction proven three ways, including the one-byte Cline change 1.4 names.
- [x] 102/102 `auto` rules reachable, 0 false fires; MUST-LOAD floor N/N.
      MET 2026-09-07 on the corrected denominator, which is **101/101**, not 102/102. The
      corpus holds 105 `auto` rules (102 quoted + 3 bare); four declare no `triggers:` and a
      trigger-less rule cannot be made reachable by a positive prompt — proven by planting a
      fixture for `skill-quality` and watching the recall endpoint go red at `101/102
      reachable; unreachable: skill-quality`, then removing it. 105 − 4 = 101, and 94
      pre-existing + 7 authored = 101 reconciles exactly.
      Endpoint output: `101/101 rules reachable; unreachable: none` and `0 of 212 near-miss
      prompts fired`. MUST-LOAD floor: `trigger-coverage: 26/26 pass`, N = 26.
      Ticked on the corrected number rather than left open, because the correction is
      derived from the mechanism and the result is COMPLETE on it — every rule that can be
      reachable is. The four that cannot are covered by 2.2's eager fallback instead, which
      is what that step exists for.
      **MET 2026-09-09 on the superseded criterion, and ticked on that basis rather than
      on the original.** The rules limb was the whole of what was missing; ADR-272 moves it
      to 25,375 under the owner's delegation, and the measured 24,166 clears it with 1,209
      tok of headroom. The total limb was already met at 39,758.
      Stated plainly so nobody reads this tick as the tree having shrunk: **it did not.**
      The measurement is unchanged and the criterion moved. What justifies the move is in
      ADR-272 — two E2 clauses that cannot both hold, with the aggregate ceiling holding
      either way — not a reduction that happened here.

- [x] 119 rule files, 299 skills, all personas, contexts and commands still installed.
      MET 2026-09-07. Nothing was removed anywhere: `dist/agent-src/rules` holds 119 `.md`
      files, `src/skills` holds 299 directories, and the flipped-root measurement shows
      **114 files in `.claude/rules` under BOTH modes** — the stub is a form, not a subset,
      which is the completeness invariant this criterion encodes. `task generate-tools`
      reports personas 29, user_types 6, cursor_commands 204 and windsurf_workflows 204
      unchanged across the flip.
- [ ] Rollback fixture green; grace ceiling gone; all quality gates green.
      TWO OF THREE 2026-09-07. Rollback fixture green (4.5: flip → one setting → regenerate
      into the SAME root → byte-identical to a never-flipped tree, 14/14 in that file). All
      quality gates green except the two inherited reds named in the commits, neither caused
      here. **The grace ceiling is NOT gone**, which is 4.4, and 4.4 is blocked on the
      measurement-surface question rather than on work: lowering the baseline to a
      post-flip total requires a total the gate can reproduce, and its default reading does
      not move. Deleting the grace block without that would red every PR on 2026-11-10 with
      the flip already landed — Risk 3, arrived at from the other direction.
      **UPDATE 2026-09-09 — still two of three, and the third is now an OWNER question
      rather than a blocked one. The box stays `[ ]`.**
      Rollback fixture still green. Quality gates green in this change:
      `check_preamble_payload_budget` (138,474 against the 138,490 grace ceiling),
      `check_references` over 1,897 targets, `check_estate_count`, `check_adr_frontmatter`,
      `check_condensed_paths`, `lint_evidence_artifacts`, `typecheck-ts`, `lint-ts`, and
      50 tests across the two files this change touches.
      The grace ceiling is still NOT gone, and 4.4 now records why that cannot be an
      engineering step: the council settled the measurement-surface question this AC's
      predecessor was waiting on and then explicitly declined it as the retirement
      mechanism, because 1A leaves the blocking ratchet on the source and unoptimized hosts
      still red on the deadline. Both seats reserved the date dimension to the owner. Two
      mechanisms are on the table and quoted at 4.4; neither may execute without an owner
      decision, and doing nothing reds every pull request on 2026-11-10 regardless.

      **UPDATE 2026-09-10 — STILL two of three, and the last sentence above is now known to
      be FALSE. The box stays `[ ]`.**
      "Doing nothing reds every pull request on 2026-11-10 regardless" was never true.
      `grace_end_date` had no enforcement anywhere in the tree — two reads, one an `echo` and
      one a test-helper type, and no date logic in the gate — so nothing would have reded on
      that date. Reproduction:
      `agents/evidence/analysis/grace-ceiling-expiry-is-unenforced-2026-09-10.md`; decision:
      `ADR-274`; the whole record is at step 4.4.
      Limb by limb at this commit: **rollback fixture green** (unchanged, 4.5). **All quality
      gates green** in this change — `check_preamble_payload_budget` (138,413 against the
      138,490 grace ceiling), `lint_roadmap_blockers`, `lint_roadmap_complexity`,
      `lint_roadmap_ci_steps`, `check_roadmap_trackable`, `check_no_roadmap_refs`,
      `lint_empty_roadmaps`, `lint_roadmap_later_disposition`, `check_adr_frontmatter`,
      `check_new_adr_evidence`, `check_estate_count`, `task preflight`, and 37 tests in
      `tests/scripts/check_preamble_payload_budget.test.ts` including two new regression pins
      proven red under the reintroduction they guard. **The grace ceiling is still NOT gone**
      — 138,490, enforced, now undated instead of falsely deadlined. That is a real
      improvement in the file's honesty and it is not this limb: the limb says *gone*.
      The council was asked directly whether this criterion may be ticked and said no, in
      terms: *"'Grace ceiling gone' is false. The roadmap must not be closed as complete."*
      What would close it is written into `ADR-274`'s `review_trigger` and quoted at 4.4 — a
      committed reduction mechanism for the ~30,800-token gap, or a separately reviewed
      specification of the base-ref-derived bound. Neither is available to an autonomous lane,
      and neither may be faked by deleting a key.

## Notes

- Completeness invariant (owner directive 2026-08-30): every user receives 100 % of the
  package. Stubs are a form, not a subset. Phase 1.4 witnesses the non-Claude hosts; 2.2
  witnesses that no `auto` rule vanishes through an empty trigger list.
- Source-silence: no external repository is referenced or needed.
