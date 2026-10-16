---
complexity: structural
status: ready
execution:
  mode: phase-checkpoints
relates:
  - slug: road-to-design-system-onramp
    relation: extends
    note: "Archived. Opened the `design-system` cluster (generate/import/capture) under the lock 'zero new settings keys, no browser runtime, optional by invocation'. This adds the fourth door, `sync`, under the same lock."
  - slug: road-to-design-system-extraction-contract
    relation: extends
    note: "Archived. Owns `design-system.json` and the three import lanes. Phase 3 adds a lane and an alias record under `_meta`; the contract shape is unchanged."
  - slug: road-to-visual-review-loop
    relation: extends
    note: "Archived. Owns the review loop whose staleness trap is prose (`design-review/SKILL.md:303`). Phase 7 turns it into a stamp."
  - slug: road-to-frontend-power
    relation: extends
    note: "Archived. Produced the one `ui_authority` schema and resolver. Phase 5 consumes the resolver's posture instead of writing a second precedence table."
  - slug: road-to-a-declared-component-contract
    relation: disjoint
    note: "Archived. Its blocker resolution (AI council, 2026-09-21, uphold; owner ruling 2026-09-27) refused a workshop axis on the stack detector and a declared component level. This roadmap adds neither; the third arrival of that subject is recorded on that file."
estate_offset_exempt: "Adds one active roadmap with nothing to offset: no active, parked or stub roadmap owns the host's design-sync surface, the handover-predicate drift, the reserved-name gap or the Consistency Lock carrier (an overlap grep for each returns nothing under agents/roadmaps/), and the four neighbours it extends are archived."
---
# Road to a canvas the code owns

> **Source:** `agents/tmp.old/inbox-2026-10-m/` — a maintainer transcript asking for
> one command and workflow that connects the host's design canvas with the existing
> frontend skills, visual regression and review gates **without a second design
> system that drifts from the source code**, and that reconciles a design system
> that already exists; then a request for a three-loop deep analysis down to a final
> roadmap. Delivered beside it: three revisions of one plan (two hosts, the newest a
> consolidation that omitted the other host's third-loop plan), two command drafts
> and two analyses. Every claim below was re-verified at `main@17f028941`; the host
> facts marked **host-2.1.296** were read offline from the installed host binary.
> Steps tagged `corrected-from-reproduction` differ from the source because running
> the source's own step gave a different result.
>
> **The constraint that governs the plan** is the transcript's: *no second design
> system that diverges from the source code*. It is AC-1, AC-6 and a non-goal, not a
> phase step.

## Goal

The repository is the only **store** of the design system. The host's canvas holds a
projection of it, which the host's own `/design-sync` produces and which only the
user starts. A design system that already exists on the canvas is reconciled
**into the code** before any sync, through one ledger the user sees. Which side a
conflicting row is proposed from comes from the existing `ui_authority` posture,
never from a new table; every row still gets a user disposition. Components are
handed to the existing UI owner. Visual baselines carry the commit the projection
was made from, and only the user accepts them. Nothing remote is overwritten,
deleted or left as a silent twin without a row the user has seen.

## Context — reproduced at `main@17f028941`

**Host facts.**

- **host-2.1.296:** the installed binary registers `design-sync` with
  `disableModelInvocation` and the menu text "Push your design system components to
  claude.ai/design" — a one-way push the user starts. It also registers `design`
  ("Make a new Design artifact from a brief"), `design-login`, and two hidden
  commands, `design-consent` and `design-revoke`.
- **host-2.1.296:** the binary carries `.design-sync/config.json`,
  `.design-sync/previews/`, `.render-check.json`, `variantsIdentical`,
  `deletePaths`, `finalize_plan` and `dsCard`. It does **not** carry `ds-bundle`,
  `_ds_sync.json`, `.sync-diff.json`, `styleSha` or `renderHashes` in plain
  strings — names the source took from an extract of an older host version. Absence
  from plain strings is not proof of absence; it is why `blocker:
  host-sync-layout-at-current-host` exists.
- Version history on the canvas, the write globs of a re-sync and the absence of a
  non-interactive authorization are **unverified here** (no network); the plan is
  built so that none of them is load-bearing — the base is a git commit (3.3), not
  the host's anchor.

**Tree facts to build on.**

- `ui_authority`: one schema, one resolver, no second partial decision table
  (`docs/contracts/ui-authority.md:17`); precedence stated once (`:43-51`).
  `resolveUiAuthority` returns a **posture** — `primary_source`, `change_intent`,
  `constraints.preserve_*`, `verification` — and `hard_constraints` takes
  `preserve_*` keys, not token values (`src/scripts/_lib/ui_authority.ts:91-113`).
- Taxonomy: the detector records the project's own tier names, never a canonical
  set (`src/agent-src/templates/scripts/work_engine/taxonomy/detect.ts:9-20`,
  `MIN_TIERS = 2` at `:130`).
- One UI owner per run, polish capped at two rounds (`src/skills/fe-design/SKILL.md:23, :109, :118`);
  the engine already records `honoured | translated | flagged` per mechanic
  (`docs/contracts/design-artifact-lifecycle.md:95`).
- The isolated asset renderer treats an asset as untrusted
  (`src/cli/commands/uiRenderAssetIsolation.ts:1-14`); visual tests need a pinned
  renderer (`src/skills/playwright-architect/SKILL.md:130-132`).
- A clustered command projects as `/cluster:sub` and is skipped before the
  reserved-name check (`src/scripts/condense.ts:1834-1851`), so
  `/design-system:sync` cannot shadow `/design-sync`.
- Lock: `docs/contracts/command-clusters.md:70` — zero new settings keys, no browser
  runtime; `sync` is an approved verb (`src/config/discovery/command-verbs.yml:25`).

**Defects — each reproduced.**

- **D1 The tree is blind to the sync surface.** `.design-sync`, `ds-bundle`,
  `_ds_sync`, `dsCard`, `render-check` occur under `src/`, `docs/`, `tests/` in one
  unrelated file (`tests/scripts/ai_council/synthesis_check.test.ts`).
- **D2 Handover predicates disagree.** `src/rules/design-fidelity.md:30`,
  `src/scripts/hooks/ui_route_nudge_hook.ts:175` and
  `src/scripts/hooks/design_pass_hook.ts:260` accept `*.dc.html`;
  `isHandoverPath` (`src/scripts/hooks/source_first_gate_hook.ts:183-187`) does not,
  while its docblock (`:170-181`) says the shapes are pinned against each other.
- **D3 Three host names are not reserved.** The list was fetched 2026-07-10
  (`src/scripts/_lib/claude_builtin_names.ts:22`) and holds `design-login` and
  `design-sync` (`:50-51`). `is_claude_builtin_name` returns `false` for `design`,
  `design-consent` and `design-revoke`. The package ships a flat `/design` router
  (`src/domains/engineering-base/design/command.md:3`, maintainer workspace).
- **D4 No import lane reads a canvas design system.** Lanes are `native`, `dtcg`,
  `dembrandt` (`src/domains/engineering-base/design-system/import/command.md:25-27`).
- **D5 Alias chains are discarded, and a cycle is misreported.** A DTCG fixture with
  `action.primary` and `link` both aliasing `{color.blue.600}` imports as two equal
  hex values with no alias record (`src/scripts/_lib/design_system_import.ts:486-498`);
  a self-referencing token is reported as "points at a token this file does not
  define" although it is defined.
- **D6 A design-system claim has no carrier.**
  `src/skills/design-system-capture/SKILL.md:131-132` says a value outside a declared
  Consistency Lock "is off-system; the anti-slop detector flags it". A fixture with
  `Colour Lock: teal` and a CSS rule using `#e11d48` passes `lint_design_slop` clean;
  `lint_design_quality` excludes palette opinions by design
  (`src/scripts/lint_design_quality.ts:21-25`).
- **D7 Visual baselines are unfenced.** `--update-snapshots` is taught with no
  acceptance step (`src/skills/playwright-testing/SKILL.md:143`); `classify_target`
  knows allowlists, `baselines.json` and budgets, not snapshot files
  (`src/scripts/hooks/block_config_weakening.ts:141-150`).
- **D8 Fidelity is model-carried.** `src/rules/design-fidelity.md:43` declares
  `instruction-only`; nothing reads the host's render-check counts.

## Phase 0 — The control readings

- [ ] **0.1 Blind spot.** A test greps `src/`, `docs/`, `tests/` for the host sync
      artefact names and asserts today's count (one file, unrelated).
      verify: `npx vitest run tests/scripts/design_sync_surface.test.ts -t control --reporter=verbose` -> /✓.*control/
- [ ] **0.2 Predicate drift, red.** A parity test asserts that `isHandoverPath`,
      `isArtifactRead` and `HANDOVER_TRIGGERS` accept one path set; it fails on
      `*.dc.html` in `isHandoverPath`. Run and record the failure before 1.1.
      verify: `npx vitest run tests/hooks/handover_predicate_parity.test.ts -t control --reporter=verbose` -> /✓.*control/
- [ ] **0.3 Reserved list, red** (`corrected-from-reproduction`: the source named
      only `design`). A new `tests/scripts/claude_builtin_names.test.ts` asserts that
      every name in a pinned host fixture (`tests/fixtures/host-builtins/2.1.296.json`,
      read offline from the installed binary) is reserved; it fails on `design`,
      `design-consent` and `design-revoke`.
      verify: `npx vitest run tests/scripts/claude_builtin_names.test.ts -t pinned-host-control --reporter=verbose` -> /✓.*pinned-host-control/
- [ ] **0.4 Alias loss and cycle misreport, red** (`corrected-from-reproduction`).
      The D5 fixture asserts an alias record for both roles and a cycle reported as
      a cycle; both fail today.
      verify: `npx vitest run tests/scripts/design_system_import.test.ts -t alias-control --reporter=verbose` -> /✓.*alias-control/
- [ ] **0.5 Lock without carrier, red.** The D6 fixture asserts a rebuttable finding
      for `#e11d48`; no tool produces one today.
      verify: `npx vitest run tests/scripts/design_lock_carrier.test.ts -t control --reporter=verbose` -> /✓.*control/

## Phase 1 — The small fixes (immediate PR)

- [ ] **1.1 One handover predicate.** Export one shape list; `isHandoverPath`,
      `isArtifactRead` and `HANDOVER_TRIGGERS` read it, and `*.dc.html` is accepted
      everywhere. Measure the hook bundle before and after; 0.2 goes green.
      verify: `npx vitest run tests/hooks/handover_predicate_parity.test.ts tests/hooks/source_first_gate.test.ts --reporter=verbose` -> /✓/
- [ ] **1.2 Three host names reserved** (`corrected-from-reproduction`). Add
      `design`, `design-consent`, `design-revoke`, refresh the source date and name
      the pinned fixture as the refresh trigger. The flat `/design` router is then
      withheld on Claude Code by the existing guard; 0.3 goes green.
      verify: `npx vitest run tests/scripts/claude_builtin_names.test.ts --reporter=verbose` -> /✓.*pinned-host-control/
- [ ] **1.3 The router keeps a reachable name.** Apply the council's (a) of
      2026-10-16: the maintainer router becomes `/agent-design` and carries
      `replaces: [design]`. Sequences strictly after 1.2, which is what puts
      `design` into the built-in set in the first place.
      verify: `npx tsx src/scripts/lint_no_new_atomic_commands.ts` -> 0

## Phase 2 — The tree sees the sync surface

- [ ] **2.1 Near-miss rows first.** Add a row for `.design-sync/` that tests the
      direction its trigger opens (a plain `sync/` folder), red-then-green, per
      `docs/guidelines/design-fidelity-routing.md:85-92`.
      verify: `npx vitest run tests/scripts/design_fidelity_routing.test.ts --reporter=verbose` -> /✓/
- [ ] **2.2 Trigger.** `path_prefix: .design-sync/` on `design-fidelity`, carried by
      the shared list from 1.1. (`ds-bundle/` waits for the host-layout blocker.)
      verify: `npx vitest run tests/hooks/handover_predicate_parity.test.ts --reporter=verbose` -> /✓/

## Phase 3 — A lane that keeps meaning

- [ ] **3.1 Alias record and cycles.** `dtcg` and the new lane keep each role's
      chain under `_meta.alias_of` (role → referenced path); the value stays
      resolved and outputs outside `_meta` stay byte-stable. A cycle is recorded
      under `_meta.alias_cycles`, not counted as undefined. 0.4 goes green.
      verify: `npx vitest run tests/scripts/design_system_import.test.ts -t alias-record --reporter=verbose` -> /✓.*alias-record/
- [ ] <!-- blocked-by: host-sync-layout-at-current-host | asked: no — authored from inbox round inbox-2026-10-m, which carried no owner turn on this question --> **3.2 `claude-design` lane.** Reads a user-exported snapshot directory
      or the local bundle whose layout the blocker pins: tokens and the
      custom-property closure of the stylesheet, component contracts from the
      `.d.ts` files, guidelines into `_meta`. Every `var(--x)` with no definition in
      the closure is listed in `_meta.unresolved_custom_properties`. Offline,
      provenance mandatory, unknown files in `_meta.unmapped`, never dropped.
      verify: `npx vitest run tests/scripts/design_system_import.test.ts -t claude-design --reporter=verbose` -> /✓.*claude-design/
- [ ] **3.3 The base is a commit, not the anchor.** With a projection commit in the
      ledger, each row is classified three ways (base, code, remote) and the base
      is read with `git show <commit>:<path>`. Without one it is two-way and the
      class is `unknown`, never a guessed three-way. Rows are keyed by token path or
      component export name; equal values alone never make two rows equal.
      verify: `npx vitest run tests/scripts/design_sync_plan.test.ts -t three-way --reporter=verbose` -> /✓.*three-way/
- [ ] **3.4 A snapshot is data.** Nothing in the lane or the ledger executes
      snapshot content; a visual look goes through the isolated asset renderer only.
      verify: `npx vitest run tests/scripts/design_sync_plan.test.ts -t snapshot-inert --reporter=verbose` -> /✓.*snapshot-inert/

## Phase 4 — The ledger and the command

- [ ] **4.1 Ledger schema** (`corrected-from-reproduction`: the anchor hash is
      optional). One `.claude/design-system/sync-ledger.json` per
      `.design-sync/config.json`, with `scope_root`. Row classes: `in-sync`,
      `code-only`, `remote-generated`, `remote-only:collides`, `remote-only:twin`,
      `conflict`, `orphan`, `unknown`. `projection { projectId, commit,
      anchor_hash?, state }` with `state` one of `prepared`, `user-reported-ran`,
      `host-artifacts-observed`, `picker-confirmed`. A row without a disposition
      fails validation.
      verify: `npx vitest run tests/scripts/sync_ledger_schema.test.ts --reporter=verbose` -> /✓/
- [ ] **4.2 `/design-system:sync plan|reconcile|verify`.** Lands as
      `src/domains/engineering-base/design-system/sync/command.md` with
      `disable-model-invocation: true`, the cluster row in
      `docs/contracts/command-clusters.md:70`, the head's sub-command table, a
      `design-system/sync` row under `implementation:` in
      `src/flows/surface-map.yaml:62-68`, and the command count re-derived by
      `update_counts`. The body follows the source's command draft minus four
      parts this roadmap does not carry: a workshop-axis read, a canvas MCP rung, a
      default tier vocabulary and a story-first order.
      verify: `npx tsx src/scripts/lint_no_new_atomic_commands.ts && npx tsx src/scripts/lint_command_flow_coverage.ts && npx tsx src/scripts/check_command_count_messaging.ts` -> 0
- [ ] **4.3 Two counts, and unknown is not empty.** `plan` prints **overwrite**
      (`remote-only:collides` + `conflict`) and **twin** (`remote-only:twin`).
      Fixture: two remote-only components, one at a colliding path, plus one
      conflicting token gives overwrite 2 and twin 1. An unreachable remote yields
      `unknown` rows and no handover recommendation; a missing `projectId` pin
      blocks the handover.
      verify: `npx vitest run tests/scripts/design_sync_plan.test.ts -t counts --reporter=verbose` -> /✓.*counts/
- [ ] **4.4 No upload route.** The command and its scripts name no `DesignSync`
      method and no canvas write endpoint, and never invoke `/design-sync`.
      verify: `npx vitest run tests/scripts/design_sync_plan.test.ts -t no-upload-route --reporter=verbose` -> /✓.*no-upload-route/
- [ ] **4.5 Idempotent.** A second `plan` over unchanged inputs writes a
      byte-identical ledger and no other file.
      verify: `npx vitest run tests/scripts/design_sync_plan.test.ts -t idempotent --reporter=verbose` -> /✓.*idempotent/

## Phase 5 — One authority, one store

- [ ] **5.1 The resolver sets the posture; the user disposes each row**
      (`corrected-from-reproduction`). `reconcile` calls `resolveUiAuthority` once
      per scope — the canvas snapshot as `reference` with its maturity, the code
      scan as `incumbent`, a registered palette or type lock as
      `hard_constraints: ['preserve_palette' | 'preserve_type_family']`, the
      user's stated intent as `user`. Each `conflict` row is pre-filled from that
      posture (`primary_source`, `constraints`) and carries it as provenance; the
      resolver's own `conflicts[]` are copied verbatim. No value ranking exists
      beside the resolver. The command is added to `ui-authority.md`
      § Declared consumers.
      verify: `npx vitest run tests/scripts/design_sync_reconcile.test.ts -t authority-posture --reporter=verbose` -> /✓.*authority-posture/
- [ ] <!-- blocked-by: host-sync-layout-at-current-host | asked: no — authored from inbox round inbox-2026-10-m, which carried no owner turn on this question --> **5.2 Conventions block.** `DESIGN.md` usage rules render into the host's
      human-editable conventions file between markers; text outside the markers
      stays byte-identical, and a drift check fails on a divergent block.
      verify: `npx tsx src/scripts/check_conventions_block.ts --root tests/fixtures/design-sync/drifted` -> 1
- [ ] **5.3 The extraction floor names its place.**
      `design-system-capture` § Design-system extraction floor points React stacks
      at the host's own sync and stays the artefact for a manual projection.
      verify: `rg -n 'manual projection' src/skills/design-system-capture/SKILL.md` -> /manual projection/

## Phase 6 — Components through the existing owner

- [ ] **6.1 A brief, not a write.** For each `remote-only` row the user imports,
      `reconcile` emits a brief — the remote markup as the spec, its `.d.ts`
      contract — and hands it to the run's UI owner (`fe-design` ad hoc,
      `directives/ui/*` in the engine), whose existing coverage records each
      mechanic as honoured, translated or flagged. The command writes no component.
      verify: `npx vitest run tests/scripts/design_sync_reconcile.test.ts -t brief-handoff --reporter=verbose` -> /✓.*brief-handoff/
- [ ] **6.2 Tiers only as the detector records them.** The brief carries the tier
      names `detect_component_taxonomy` recorded for the project. When it records
      none, the brief carries no tier and proposes no vocabulary.
      verify: `npx vitest run tests/scripts/design_sync_reconcile.test.ts -t taxonomy-recorded --reporter=verbose` -> /✓.*taxonomy-recorded/

## Phase 7 — Baselines the user accepts

- [ ] **7.1 Snapshot surfaces classified.** `classify_target` returns `advisory` for
      `*-snapshots/**` and `__screenshots__/**`; a Bash call carrying
      `--update-snapshots` on a visual runner warns with the acceptance step. Warn,
      never block (`block_config_weakening.ts:28-33`). Measure the hook bundle
      before and after.
      verify: `npx vitest run tests/scripts/hooks/block_config_weakening.test.ts -t snapshot --reporter=verbose` -> /✓.*snapshot/
- [ ] **7.2 Baseline stamp.** Baselines touched in a run are listed in the ledger
      with the projection commit; `verify` reports a baseline older than the current
      projection as `stale`.
      verify: `npx vitest run tests/scripts/design_sync_verify.test.ts -t stale-baseline --reporter=verbose` -> /✓.*stale-baseline/
- [ ] **7.3 The taught line.** `playwright-testing/SKILL.md:143` gains one sentence:
      baseline updates are shown as a diff and land in a commit of their own, on the
      pinned renderer of `playwright-architect/SKILL.md:130-132`.
      verify: `rg -n 'commit of their own' src/skills/playwright-testing/SKILL.md` -> /commit of their own/

## Phase 8 — Review gates that read the projection

- [ ] **8.1 Render check consumed.** `verify` reads `.render-check.json`; any
      non-zero failure count, `variantsIdentical` included, without a disposition
      fails the run. The fixture uses the field names the 2.1.296 binary carries.
      verify: `npx vitest run tests/scripts/design_sync_verify.test.ts -t render-check --reporter=verbose` -> /✓.*render-check/
- [ ] **8.2 The Lock gets its carrier.** A changed UI file whose colour, radius or
      spacing value lies outside a declared Consistency Lock is a rebuttable
      finding, flags-not-blocks; a brownfield baseline counts only new drift. 0.5
      goes green and `design-system-capture/SKILL.md:131-132` becomes true.
      verify: `npx vitest run tests/scripts/design_lock_carrier.test.ts --reporter=verbose` -> /✓/
- [ ] **8.3 Matrix rows from the ledger.** `design-review`'s fidelity matrix gets one
      row per reconciled component, with the evidence kind named.
      verify: `npx vitest run tests/scripts/design_sync_reconcile.test.ts -t matrix-rows --reporter=verbose` -> /✓.*matrix-rows/
- [ ] **8.4 One verdict vocabulary.** A gate that could not run reports
      `unverified` or `degraded` with a reason, from `ui_authority`'s `verification`
      field; `design-fidelity.md:43` names the ledger and the render-check reader as
      its mechanical leg for synced systems.
      verify: `rg -n 'sync-ledger' src/rules/design-fidelity.md` -> /sync-ledger/
- [~] <!-- blocked-by: host-sync-layout-at-current-host | asked: no — authored from inbox round inbox-2026-10-m, which carried no owner turn on this question --> **8.5 One live round trip, human-run.** On the fixture React package, the
      maintainer runs `plan`, then `/design-sync`, then `verify`, and records the
      ledger's `projection.state` reaching `picker-confirmed`. Needs a canvas
      account and network; never run by an agent.
      verify: `npx vitest run tests/scripts/design_sync_verify.test.ts -t live-record --reporter=verbose` -> /✓.*live-record/

## Non-goals

- No call to `DesignSync`, no write into a canvas project, no creating or
  re-adopting a remote project, no unattended or CI sync.
- No second store, schema, precedence table or UI owner; no new settings key, skill
  or verb.
- No workshop axis on the stack detector, no tier vocabulary proposed to a project,
  no prescribed order between story and component — all three were refused by the
  council on 2026-09-21 (Decision D7).
- No pixel diff as proof of token fidelity; no hosted visual service required; no
  metrics pipeline or canary rollout.
- No rewrite of the `DESIGN.md` format; no change to `ui-component-architect`'s
  order paragraph.

## Acceptance Criteria

- [ ] AC-1 — After `reconcile`, the repository holds every design value the user
      imported, and no ledger row is left without a disposition; the canvas is
      never written by this package.
- [ ] AC-2 — All handover carriers accept one path set, including `*.dc.html` and
      `.design-sync/`.
- [ ] AC-3 — `design`, `design-consent` and `design-revoke` are reserved, and no
      package entry shadows a host name in the pinned fixture.
- [ ] AC-4 — Imports keep alias chains and report cycles as cycles.
- [ ] AC-5 — `plan` on the fixture reports overwrite 2 and twin 1, an unreachable
      remote reports `unknown`, and a second run changes nothing.
- [ ] AC-6 — Conflict rows are pre-filled from `resolveUiAuthority`'s posture; no
      other ranking of values exists in the change.
- [ ] AC-7 — The command writes no component; it hands a brief to the UI owner and
      proposes no tier vocabulary.
- [ ] AC-8 — A baseline older than the projection commit is `stale`, and a
      snapshot update warns.
- [ ] AC-9 — A value outside a declared Consistency Lock is flagged, which makes the
      capture skill's claim true.

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| D1 | reversible-technical | evidence | Own roadmap, not folded into a design master | no active, parked or stub roadmap on this surface (overlap grep empty); the design masters the source names never landed | a design master lands |
| D2 | deterministic | evidence | Name `/design-system:sync` | nested commands cannot collide (`condense.ts:1834-1851`); `design-sync` is reserved; `design` is not a locked cluster (`command-clusters.md:70`) | the host adds a `:`-namespaced command |
| D3 | deterministic | evidence | Reserve `design`, `design-consent`, `design-revoke` | the list's own contract: never shadow the host (`claude_builtin_names.ts:1-8`); host-2.1.296 registers all three | the host drops a name |
| D4 | reversible-technical | evidence | Conflict rows pre-filled from the resolver's posture, never from a new table; grow `Signals` only if a 5.1 fixture cannot be stated | `resolveUiAuthority` returns posture, not per-value winners (reproduced); `ui-authority.md:17` | a fixture needs a field `Signals` lacks |
| D5 | reversible-technical | evidence | Remote-only rows have no default; `plan` offers import-as-brief and keep-as-exploration and the user picks per row | every row needs a disposition (4.1) | — |
| D6 | reversible-technical | evidence | Non-React stacks: manual projection via the existing extraction floor, no new code | `design-system-capture/SKILL.md:280` already describes it | the host adds a non-React shape |
| D7 | product-owned | council: 2026-09-21 uphold | No workshop axis, no tier vocabulary, no story-first order in this roadmap | archived `road-to-a-declared-component-contract` blocker resolution; owner ruling 2026-09-27 | the owner answers the third-arrival question recorded on that file |
| D8 | reversible-technical | evidence | Snapshot fence warns, never blocks | baselines warn by policy (`block_config_weakening.ts:28-33`) | an agent-committed baseline is observed |
| D9 | reversible-technical | agent | The remote snapshot is written under `.claude/design-system/remote-snapshot/<date>/` and never committed by the command | the command never commits (4.2 body); snapshot content may be proprietary | a consumer asks for committed snapshots |
| D10 | reversible-technical | evidence | Remote reachability: user export, then local files; no canvas MCP rung | no read-tool names for a canvas MCP exist in the tree or the source set | a read-only canvas MCP is documented |
| D11 | deterministic | agent | Closure pass 2026-10-12: seven `unfalsifiable-verify` listings (0.4, 3.1, 3.2, 5.3, 7.1, 7.3, 8.4) name a `-t` title absent from an existing test file or an `rg` pattern absent from its target today, so each verify fails until its step lands; zero owner questions — the two owner-owned items are the blockers below | `closure_scan` on this file: 7 listings, 0 owner questions | a step lands without its title or sentence |

## Blockers

### blocker: host-sync-layout-at-current-host
- **Status:** open — raised 2026-10-12 from inbox round `inbox-2026-10-m`; the bundle layout came from an extract of an older host version, and an offline read of host 2.1.296 finds only part of it.
- **Owner:** maintainer — answering it needs a canvas account and network, which no agent run may use.
- **Blocks:** steps 3.2, 5.2 and 8.5.
- **What to do:** pick exactly one — (a) run `/design-sync` once on `tests/fixtures/design-sync/react-package/` with a canvas account and commit the resulting listing of `.design-sync/` and of the local build output into `tests/fixtures/design-sync/host-observed/`; or (b) narrow 3.2 to a user-exported snapshot directory only and drop 5.2, keeping to the names the 2.1.296 binary carries (`.design-sync/config.json`, `previews/`, `.render-check.json`).
- **Resolved when:** `tests/fixtures/design-sync/host-observed/` exists, or 3.2 and 5.2 are rewritten per (b) and `npx vitest run tests/scripts/design_system_import.test.ts -t claude-design` exits 0.
- **Recommendation:** (a). The lane exists to read what the host writes; a fixture invented from an old extract would test the extract, not the host.

  **An AI council split on this, 2026-10-16, and the split rests on a gap this
  entry can close.** Record:
  `agents/evidence/council/owner-blocker-routing-20261016.md`.

  `anthropic` — **DECIDE, (b)**: the three names come from reading the 2.1.296
  binary, so (b) makes a **smaller verified** claim rather than a larger
  invented one, and (a) stays available as a later upgrade. It adds that the old
  extract is itself the risk — using it would test obsolete behaviour whether or
  not a fixture is "invented".

  `openai` — **ESCALATE, (a)**: not on the merits, but because *"what step 5.2
  delivers and what happens to 8.5 is absent, so the impact of (b) is
  unknowable"* — the reserved row **cannot be bounded from the evidence
  available**. It agrees the three-name scope is verified rather than invented.

  **Both missing facts, read from this roadmap 2026-10-16 so the gap is closed
  in writing rather than left for the next reader.**

  - **5.2 delivers the conventions block**: `DESIGN.md` usage rules rendered
    into the host's human-editable conventions file between markers, text
    outside the markers byte-identical, with a drift check that reds on a
    divergent block. That is the nameable capability (b) drops — not an
    unspecified one.
  - **8.5 is unaffected by this choice.** It is already `[~]` and already
    human-run by its own text — *"Needs a canvas account and network; never run
    by an agent"* — under **either** option. (b) does not change its state, and
    the `Blocks` field listing it alongside 3.2 and 5.2 is what made it look
    like it might.

  With both facts in hand the escalating seat's stated row no longer obviously
  applies, since the impact of (b) is now bounded: lose the conventions block,
  keep everything else, 8.5 unchanged. Recorded rather than acted on — a seat's
  escalation is not for the agent to withdraw on the agent's own reading.
- **If you do nothing:** Phases 0–2, 4, 6–8 land unchanged; the lane reads only a user export, and the conventions block stays unbuilt.

### blocker: maintainer-design-router-name
- **Status:** resolved — **(a)**, as `/agent-design` with `replaces: [design]`. AI
  council 2026-10-16, 2/2 concluded, no split, both seats `DECIDE`: the router is
  maintainer-facing, the change is reversible, and `replaces:` is the package's
  own declared mechanism for exactly this move, so no reserved row is crossed.
  Record: `agents/evidence/council/owner-blocker-routing-20261016.md`.
- **Owner:** owner — a shipped command taking a different name is a public-surface change. **The council read the transition instead and found it maintainer-facing: the label records who raised it, not who must answer.**
- **Blocks:** step 1.3.
- **What to do:** **(a), with the name settled: `/agent-design`.** Give
  `src/domains/engineering-base/design/command.md` that name and
  `replaces: [design]`. Superseded alternative, kept so the choice is legible:
  (b) keep `/design` and record in its body that it is withheld on Claude Code
  after 1.2 and reachable on the other hosts only — refused because the router
  then *silently* disappears from the host the work happens on.

  **Verified on this tree, 2026-10-16, so the pick is applicable rather than
  plausible:** `agent-design` is held by no command and is absent from
  `CLAUDE_CODE_BUILTIN_NAMES` (103 entries), so the predicate returns `false`
  for it as (a) requires. `design` itself is **not yet** in that set either —
  it carries `design-login` and `design-sync` only — which is what step 1.2
  adds, so 1.3 sequences strictly after 1.2.

  **`/design:router` was considered and refused** (`openai`): colon portability
  across every supported host is not established in this tree, and the name
  describes implementation rather than intent.

  **What the alias does and does not buy, checked rather than assumed.** Both
  seats asked whether `replaces:` is metadata-only. It is not —
  `src/cli/commands/commands.ts` reads it at runtime, printing
  `<slug>  <-  absorbed: <names>` in the listing (`:248`) and a `replaces:` line
  in the detail view (`:414`). The limit runs the other way: a maintainer who
  types `/design` on Claude Code reaches **the host's own built-in**, which this
  package cannot decorate, so the forward pointer exists in the package CLI and
  cannot exist on the host's slash surface. That is the host's property, not a
  gap in the migration — and it is the whole reason (b) was refused.
- **Resolved when:** the command file carries (a)'s new name or (b)'s sentence, and `npx tsx src/scripts/lint_no_new_atomic_commands.ts` exits 0.
- **Recommendation:** (a). After 1.2 the router silently disappears from Claude Code under (b), which is the host the transcript works in.
- **If you do nothing:** 1.2 still lands and the host's `design` stops being shadowed; the maintainer router is unreachable on Claude Code.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-12 | reviewer: claude-opus -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Host surface drifts | implementation | Bundle and anchor names came from an older host; 2.1.296 already differs | 3.3 bases on a git commit, not the anchor; the anchor hash is optional (4.1); the layout blocker pins a real listing | Phase 3 — A lane that keeps meaning |
| 2 | `/design-sync` run before `plan` | product | Colliding remote work is overwritten anyway | The head offers `plan` whenever `.design-sync/` is present; the overwrite count is printed first | Phase 4 — The ledger and the command |
| 3 | Twins accumulate | product | Remote-only components never imported become a second system — the transcript's constraint, broken quietly | Twin count printed separately (4.3); every row needs a disposition (4.1) | Phase 4 — The ledger and the command |
| 4 | Hook bundle exceeds its budget | implementation | 1.1 and 7.1 touch bundled hook concerns that have little headroom | Both steps measure the bundle before and after and land the smaller form | Phase 1 — The small fixes (immediate PR) |
| 5 | Agent accepts its own baselines | implementation | Visual gates become self-graded | 7.1 warning, 7.3 taught step, D8 | Phase 7 — Baselines the user accepts |
| 6 | Posture cannot express a design-system-wide choice | implementation | 5.1 needs a field `Signals` lacks | D4: grow the schema only on a failing fixture | Phase 5 — One authority, one store |
| 7 | Two writers for usage rules | implementation | `DESIGN.md` and the host's conventions file diverge | 5.2 marker block and drift check | Phase 5 — One authority, one store |

## Provenance

- Maintainer transcript (three turns), three plan revisions, two command drafts and
  two analyses, all dated 2026-10-12. External field reports the analyses cite are
  not named here; nothing in this roadmap rests on them alone.
- The consolidated revision omitted the other host's third-loop plan from its
  parent list; that plan's items are discharged below, not left silent.
- No council was consulted for this roadmap; D7 cites an earlier council verdict.

| Item | Origin | Disposition |
|---|---|---|
| Pin host version and native names in a fixture | third-loop plan | KEEP — 0.3 |
| Remote unreachable is `unknown`, not empty; missing pin blocks handover | third-loop plan | KEEP — 4.3 |
| Handover states prepared / ran / observed / picker-confirmed | third-loop plan | KEEP — 4.1 `projection.state` |
| Alias cycles handled | third-loop plan | KEEP, corrected — 3.1 records the cycle instead of blocking the import |
| Unresolved custom properties fail token fidelity | third-loop plan | KEEP — 3.2 list |
| Live round trip on a React package | third-loop plan, host-B plan | KEEP as human-run — 8.5 |
| `honoured / translated / flagged` per mechanic | third-loop plan | ALREADY — `design-artifact-lifecycle.md:95` via 6.1 |
| `/design-system:sync` must not flatten onto `/design-sync` | third-loop plan | ALREADY — `condense.ts:1834-1851` |
| Environment fingerprint and story id on baselines | third-loop plan | CUT — the pinned renderer and the projection commit cover it; no failing case |
| Interaction, viewport, theme and keyboard matrix in the command | third-loop plan | CUT — owned by `design-review`, `storybook-workshop` and `playwright-testing` |
| Secret masking, digest cache, licence preservation in the lane | third-loop plan | CUT — the lane reads only token, contract and guideline files; no measured cost |
| Code value preselected in a conflict | first revision, third-loop plan | CUT — D4 |
| Origin classification from the anchor | first revision | CUT — the anchor holds no values; 3.3 |
| General raw-value drift outside token files | first revision | CUT — palette opinions are excluded by design (`lint_design_quality.ts:21-25`); 8.2 is the Lock-scoped form |
| Workshop axis; tier vocabulary default; story-first order | all revisions | CUT — D7 |
| Upload by the package; two-way or CI sync; new skill, IR library or authority contract; new status words; metrics and canary | host-B plan, host-B command | CUT — non-goals |
