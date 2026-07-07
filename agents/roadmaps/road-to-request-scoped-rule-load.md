---
complexity: structural
status: ready
parent_roadmap: road-to-token-saving
---

# Road to request-scoped rule load — ship only what the request needs

> Close the two structural gaps the thin-projection work does not touch:
> (1) **consumer scoping** — 63 of 95 shipped rules are exclusively
> maintainer-workspace-scoped (~50k tok eager) yet land in every consumer
> install because the 6.0.0-B pack filter deliberately exempted rules
> ("rules stay router-driven") and the router carries no workspace/pack
> fields; (2) **host-native activation** — the Cursor/Windsurf projectors
> emit `globs:` empty, discarding the deterministic
> `file_pattern`/`path_prefix` trigger signal rules already declare.
> Council-integrated per
> `agents/settings/contexts/token-program-integration-verdict.md`: both
> levers run NOW, in parallel with `road-to-discipline-profile-tiering`;
> neither depends on the thin flip or its gates.

## Goal

A consumer who installs the suite pays context only for (a) rules relevant to
their installed workspaces/packs and (b) — on Cursor/Windsurf — rule bodies
their current files actually trigger. Concretely: cut the consumer rule
surface from 95 shipped rules to the ~32 non-maintainer ones **before** any
projection-mode question applies, and give path-triggered rules deterministic
host-native activation. Every cut lands behind the existing Phase-0
measurement rig (`road-to-token-saving` D0); no lever ships on an estimate
alone.

## Context — verified on the live checkout, 2026-07-07

- **Rule layer, eager vs thin** (`project_thin_rules --measure`, tiktoken
  exact): eager 77,534 / thin 13,509 / saved 64,025 GPT tok (82.6%). The thin
  flip itself is owned by `later/road-to-token-saving-HUMAN-MEASUREMENT.md`
  and is **out of scope here**; per the weak-host-lift verdict it is
  additionally deferred until `discipline_profile: essential` ships and is
  baseline-measured (then re-swept as a sub-mechanism of essential).
- **Consumer dead weight:** `dist/agent-src/rules/` holds 95 rules; **63 are
  exclusively `workspaces: [agent-config-maintainer]`**, 32 other.
  `GLOBAL_DEPLOY_SOURCES` (`src/install/wizard-plan.ts`) ships the directory
  wholesale. 6.0.0-B's pack loader filtered commands + skills only;
  `dist/router.json` (9 kernel / 24 tier_1 / 58 tier_2) carries **no
  workspace or pack fields**, so neither projection nor a compliant host can
  filter rule pointers by installation.
- **Discarded native activation:** `_emit_cursor_mdc` and
  `_emit_windsurf_rule` (`src/scripts/condense.ts` ~1054/1073) hard-code
  `globs: ` (empty). Rules like `ui-audit-gate` declare
  `path_prefix: resources/views/` / `resources/js/` — exactly what Cursor's
  glob auto-attach and Windsurf's `glob` trigger consume natively.
- **Pack hygiene (corrected against the external draft):** only 2 rules are
  actually misfiled — `ui-audit-gate` sits in pack `meta`, `design-fidelity`
  in `engineering-base`. `icon-consistency` is already in `frontend-design`;
  `brand-consistency` and `brand-source-of-truth` are in `brand` (correct).
- **Intent-only rules (thin blind spot):** `telegraph-speak` (retirement
  council-decided — skip), `user-interaction`, `think-before-action`,
  `artifact-drafting-protocol` carry ONLY `intent:` triggers — zero
  mechanical signal for any conditional-load mechanism, never matched by
  telemetry replay.

**Covered elsewhere — do not duplicate here:** RTK, cache-aware ordering,
always-loaded budget linter — `road-to-token-saving`. Thin flip, telegraph
retirement, condensation ROI — HUMAN-MEASUREMENT track. Discipline-rule
tiering (`essential`, host gating) — `road-to-discipline-profile-tiering`.
Program sequencing — `road-to-token-proof-and-story` Phase 1 (single
tracking table; this roadmap links, never copies).

## Automation & human gates

- **Fully autonomous:** Phases 0–3 (schema/compiler/projector/linter work,
  verified by existing CI gates: `check-router`, `lint-projection-fidelity`,
  `check-artefact-checksums`, `trigger-coverage`, `check-token-regression`,
  plus new tests per phase). Deltas recorded with
  `measure_projection_bytes` / `audit-tokens`.
- **One human gate:** Phase 1 Step 4 — flipping consumer-scoped rule
  projection from opt-in to default (mirrors the 6.0.0-B `legacy-all`
  pattern: non-breaking first, scoped by opt-in, default flip as a reviewed
  release decision).
- **Phase 4 is PARKED** (council verdict) — promotion trigger is explicit,
  not a date.

## Phase 0 — Workspace/pack fields into the router (schema, additive)

The router is the only artifact both the thin projector and a compliant host
read; scoping data must live there before anything can filter on it.

- [x] Extend `docs/contracts/rule-router.md`: each non-kernel router entry
      gains `workspaces: []` and `packs: []` copied verbatim from rule
      frontmatter. Kernel entries stay bare (kernel is unconditional and
      workspace-independent — assert this in the linter).
- [x] `compile_router.ts`: emit the new fields, deterministic sort preserved
      (`check-router` must stay byte-stable across two clean builds).
- [x] Linter: every non-kernel rule must declare ≥1 workspace; unknown
      workspace/pack ids (vs `src/config/discovery/{workspaces,packs}.yml`)
      fail lint.
- [x] Bump `schema_version` → 2 with a reader that accepts v1 (additive
      fields only; downstream readers ignore unknown keys).
- [x] **Intent-only backstop audit:** for `user-interaction`,
      `think-before-action`, `artifact-drafting-protocol` (skip
      `telegraph-speak`): add ≥1 keyword/phrase backstop trigger, or argue
      kernel promotion, or record why intent-only is acceptable — no rule
      stays intent-only without a written disposition.

**Exit:** `dist/router.json` v2 carries workspaces/packs per non-kernel
entry; `check-router` + full `task ci` green; zero behavioural change.
**Rollback:** revert compiler emit; v1 readers unaffected.

## Phase 1 — Consumer-scoped rule projection (the ~50k lever)

Close the 6.0.0-B exemption: filter rules at projection/install time by the
installed workspace set, exactly as ADR-040 scopes it (projection-time
filtering, no runtime resolver).

- [ ] **Misclassification audit first (blocking):** review the 63
      exclusively-maintainer rules for consumer-relevant misfits (e.g. a
      generic discipline rule tagged maintainer out of habit). Output: a
      reviewed allowlist diff; every reclassification is its own commit with
      reasoning. Do not filter on unaudited tags.
- [ ] Extend the 6.0.0-B pack loader / projector path to rules: given the
      installed workspace+pack set, project only matching rules into
      `.claude/rules`, `.cursor/rules`, `.clinerules`, `.windsurfrules` and
      the consumer `dist/agent-src/rules` deploy source. Kernel always
      projects. `legacy-all` projects everything (non-breaking default).
- [ ] Filter the thin-projection pointer catalog by the same set — a
      consumer without the maintainer workspace gets neither maintainer
      bodies nor maintainer pointer lines (floor shrinks from 86 pointers
      toward ~23 + kernel), so the mechanism is ready whenever the thin flip
      un-defers.
- [ ] CI guard: a consumer-shaped fixture install must contain zero
      exclusively-maintainer rules; a maintainer checkout must contain all
      95 (mirrors the portability-guard pattern).
- [ ] **Human gate:** flip default from `legacy-all` to scoped for consumer
      installs (maintainer source checkout keeps everything). Record the
      measured before/after (eager and thin arms) in
      `internal/bench/reports/`. Release-notes line: existing installs need
      `sync`/re-install; the flip invalidates each consumer's KV-cache
      prefix once (1.25–2× write cost, first session only).

**Exit:** consumer fixture install ships ~32 rules + kernel; measured rule
surface delta recorded (est. −50k tok eager / −63 pointers thin);
`trigger-coverage` still green on the consumer set.
**Rollback:** set `legacy-all`; one flip, no code change.

## Phase 2 — Host-native activation: populate globs (deterministic)

- [ ] `_emit_cursor_mdc`: map `file_pattern` triggers verbatim and
      `path_prefix` triggers as `<prefix>**` into the `.mdc` `globs:` field;
      rules with ≥1 path-shaped trigger become Cursor auto-attach,
      description-only rules stay Agent-Requested (`alwaysApply: false`).
- [ ] `_emit_windsurf_rule`: same mapping onto the `glob` trigger type;
      keyword/intent-only rules keep `model_decision`.
- [ ] Snapshot tests: `ui-audit-gate` fixture emits
      `globs: resources/views/**,resources/js/**`; a keyword-only rule
      emits empty globs unchanged.
- [ ] Verify no double-fire: a glob-attached rule must not also be inlined
      eager on those hosts once thin mode lands (interaction note in the
      rule-router contract).

**Exit:** path-triggered rules auto-attach on Cursor/Windsurf from real file
context; projection-fidelity + snapshot tests green.
**Rollback:** re-emit empty globs (single function revert).

## Phase 3 — Pack hygiene (two confirmed misfits + one sweep)

- [ ] Move `ui-audit-gate` (`meta` → `frontend-design`) and decide
      `design-fidelity` (`engineering-base` → `frontend-design`?, keep
      genuinely stack-neutral discipline in base). These are the only two
      verified misfits — the external draft's five-rule claim was corrected
      2026-07-07.
- [ ] With Phase 0+1 landed, verify end-to-end: a consumer install without
      `frontend-design` contains neither the moved rule bodies nor their
      pointers.
- [ ] Sweep the remaining packs for the same misfiling pattern (one audit
      pass, findings → follow-up commits or honest-null).

**Exit:** deselecting `frontend-design` removes its rule cluster;
pack-membership audit recorded.
**Rollback:** frontmatter-only change; revert the pack keys.

## Phase 4 — PARKED: rules-as-skills falsification probe (Claude Code)

Parked by council verdict (2026-07-07) — do not run while the thin flip is
deferred. **Promotion trigger:** `discipline_profile: essential` baseline has
landed AND thin un-deferral is actually scheduled (HUMAN-MEASUREMENT resumed).
Design locked for when it promotes: 3-rule pilot (one tier-1 routing rule,
one tier-2 discipline rule; safety floors excluded by design — never a
discretionary vehicle), canary methodology + length-controlled paired judge,
skeptical prior, adopt-or-honest-null terminal.

- [ ] Parked — promote only on the trigger above; then execute the locked
      design and record the verdict.

**Exit (when promoted):** a recorded adopt-or-null verdict with paired
evidence.
**Rollback:** delete the generated pilot skills.

## Acceptance criteria

- [ ] `dist/router.json` v2 carries workspaces/packs; CI byte-stability
      gates green (Phase 0).
- [ ] Intent-only rules have written dispositions (Phase 0).
- [ ] Consumer installs ship only workspace-matched rules; measured
      before/after recorded; misclassification audit trail exists (Phase 1).
- [ ] Path-triggered rules auto-attach natively on Cursor/Windsurf
      (Phase 2).
- [ ] Verified pack misfits are fixed and the sweep is recorded (Phase 3).
- [ ] Phase 4 stays parked until its promotion trigger fires — no silent
      execution, no silent deletion.
- [ ] Every shipped lever carries a measured before/after on the Phase-0
      rig.

## Blockers

### blocker: phase-0-golden-set (inherited)
- **Status:** open — owned by `road-to-token-saving` / HUMAN-MEASUREMENT
- **Blocks:** the held-quality verification arm of Phase 1's default flip.
  Does **not** block Phases 0, 2, 3 or the opt-in build of Phase 1
  (mechanical, CI-verified).
- **Resolved when:** `check_quality_regression --as-flip-gate` exits 0 on a
  real (non-dry-run) report — hardened criterion per
  `road-to-token-proof-and-story` Phase 0.
