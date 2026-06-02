---
status: ready
complexity: structural
parent_roadmap: road-to-6.0.0-a-positioning-and-validation
---

# Road to 6.0.0-B — Pack-scoped projection (the breaking change)

> Second of three `road-to-6.0.0-*` roadmaps. This is the **load-bearing
> breaking change**: stop projecting every artefact into every host tool;
> project only the active profile + packs' artefacts. Depends on
> [`road-to-6.0.0-a-positioning-and-validation.md`](road-to-6.0.0-a-positioning-and-validation.md)
> (the Execution-Model ADR must land first). Sequenced **metadata-first** per
> the AI-council convergence — pure-metadata changes ship and get validated
> before any behavioural change, so a half-migrated state is never broken.

## Goal

`npm install` + a chosen profile projects ~18 commands and ~45 skills into the
host tool, not 150 commands and 223 skills. The mechanism is **projection-time
filtering** in the build/install path (NOT a runtime daemon — see the
Execution-Model ADR from 6.0.0-A). Existing installs do not break on
`npm update`: 6.0.0 ships with `legacy-all` as the default (opt-in profile
mode), and the default flip is a later, evidence-gated release.

## Context

**Verified reality (2026-06-02).** Activation today = static projection
(everything written to every host tool) + the rule-router (`dist/router.json`,
rules only). The pack loader (`scripts/config/packs.py`) is "Phase 2 — not
shipped". 149/150 commands have **no `pack:` ownership** (only the 1 pack-fun
command is pack-owned). The discovery manifest already records per-artefact
`packs`/`workspaces`/`lifecycle`/`trust`/`install`
(`scripts/build_discovery_manifest.py` → `dist/discovery/`), and all 223 skills
carry a `packs:` field — so the *data* for filtering largely exists; what's
missing is (a) command pack-ownership and (b) the projector honouring the active
set.

**The two real landmines the council named:**

1. **Command pack-ownership is a data migration with product decisions inside.**
   Assigning the 149 commands to packs will surface packs over their declared
   budget (e.g. a "developer" pack with 15 commands vs a ≤8 visible cap). Which
   commands become `visibility: internal`, which relocate, which stay visible —
   those are product calls, not linter rules. So this roadmap separates
   *assignment* (mechanical) from *budget enforcement* (decision-bearing) into
   distinct phases with a maintainer review between them.
2. **The compat break is real.** Upgrading 5.x → 6.0.0 must not surface nothing
   (broken install) nor silently keep surfacing everything (pointless break).
   The resolution is a staged rollout with `legacy-all` as the 6.0.0 default.

> **Council convergence (claude-sonnet-4-5 + gpt-4o, 2026-06-02):** "Metadata
> first — add `pack:` to all 149 commands with NO budget enforcement; commit as
> metadata-only; THEN run the budget audit and make the keep/hide/relocate
> calls; THEN ship projection filtering; THEN enable the budget lint in CI.
> Dependency edges: projection depends on clean pack metadata; budget
> enforcement depends on the migration decisions; the `remove_after: 7.0`
> calendar deletion is user-hostile — use an evidence-gated default flip."

> Migration ordering risk (council, Scenario B): relocating a command to a
> different pack to fit a budget can make it invisible under a profile that
> doesn't include that pack. The budget-audit phase must check the
> profile→pack→command reachability of every relocation before applying it.

## Phase 1: Command pack-ownership metadata (no behaviour change)

- [ ] **Step 1:** Add a `pack:` field to the command frontmatter schema
  (`scripts/schemas/command.schema.json`) as the canonical owner (distinct from
  the existing `cluster:` which is the naming/colon-syntax owner per ADR-003).
  Document the `cluster:` ↔ `pack:` relationship: cluster = invocation namespace
  (`roadmap:process-full`), pack = ownership/surfacing unit. They may coincide
  (a `git` pack owning the `git` cluster) but need not.
- [ ] **Step 2:** Assign `pack:` to all 149 unowned core commands (best-guess
  mapping from cluster → pack, using the discovery manifest's existing skill
  `packs` taxonomy as the reference vocabulary). **NO budget enforcement, NO
  visibility change** in this step — pure metadata. Commit as a metadata-only
  change so it is independently reviewable and trivially revertible.
- [ ] **Step 3:** Extend `build_discovery_manifest.py` to emit command
  pack-ownership into the manifest (it already emits skills' packs); add a
  determinism check so the command→pack map is reproducible.

## Phase 2: Budget audit + migration decisions (maintainer-gated)

- [ ] **Step 4:** Build the budget-audit report (extend
  `scripts/audit_command_surface.py`, which already does overlap detection):
  for each pack, list its commands and flag packs over the proposed visible
  budget (core ≤8, small ≤2, medium ≤5, large ≤8, platform ≤10). For each
  over-budget command, surface the deciding signals — external citation count
  (`grep docs/`), tier (0/1/2), and any usage data if available. Output to
  `agents/reports/`.
- [ ] **Step 5:** *Maintainer-gated.* Review the over-budget report and record,
  per command, the decision: keep-visible / set `visibility: internal` /
  relocate-to-pack-X. **Reachability check (council Scenario B):** any relocate
  decision must verify the command stays reachable under at least one profile
  that includes the new pack — a relocation that orphans a command from every
  profile is rejected. Capture decisions in a context note; this is a product
  call, not autonomous.
- [ ] **Step 6:** Apply the Phase-2 decisions: set `visibility: internal` on the
  hidden set, relocate the moved set (with deprecation shims via the existing
  `superseded_by` / `deprecated_in` machinery for any renamed invocation), and
  update docs/examples that cite relocated commands. No command is deleted —
  re-parent + hide + alias only.

## Phase 3: Projection-time filtering (the breaking change, opt-in)

- [ ] **Step 7:** Implement the pack loader (`scripts/config/packs.py`, the
  "Phase 2 — not shipped" piece) — given the active profile + pack set, resolve
  the active artefact set (commands + skills; rules stay router-driven). This is
  the deterministic resolver the Execution-Model ADR scopes as build/install-time.
- [ ] **Step 8:** Wire the projector (install path + `agent-config use
  --profile=<id>`) to project only the active set when a profile is selected,
  and **everything** when the profile is `legacy-all`. Default in 6.0.0 =
  `legacy-all` (non-breaking upgrade). Selecting a real profile = scoped
  projection. Atomic write (temp → move) with previous-projection preservation
  on failure, per the ADR rollback mechanism.
- [ ] **Step 9:** Console notice on `legacy-all`: "Profile mode available —
  scoped, focused surface. Run `agent-config use --profile=developer`." No hard
  warning, no forced migration in 6.0.0.
- [ ] **Step 10:** Coverage — golden tests proving: (a) `legacy-all` projects the
  full set (byte-identical to 5.x projection for at least one host tool), (b) a
  scoped profile projects only its active set, (c) a profile switch is atomic
  and reversible, (d) an inactive-pack command/skill is absent from the scoped
  projection but present in `legacy-all`.

## Phase 4: Staged-rollout scaffolding (the flip is a later release)

- [ ] **Step 11:** Document the staged-rollout plan in the CHANGELOG/release
  notes for 6.0.0: 6.0.0 default `legacy-all` (opt-in profiles) → 6.1.0 default
  flips to profile mode with a `--legacy` escape → 7.0.0 removes `legacy-all`
  **only if** evidence shows <10% usage. This roadmap ships 6.0.0 only; the
  flip and removal are explicitly out of scope here and gated on the telemetry
  from 6.0.0-C.

## Acceptance Criteria

- [ ] All 150 commands carry `pack:`; discovery manifest emits command ownership
  deterministically; Phase-1 was a pure metadata commit (no behaviour change).
- [ ] Budget-audit report exists; over-budget decisions recorded with the
  reachability check; hidden/relocated commands handled via internal-visibility
  + deprecation shims, zero deletions.
- [ ] Pack loader (`scripts/config/packs.py`) ships; projector honours the
  active profile/pack set; `legacy-all` reproduces the 5.x full projection.
- [ ] 6.0.0 ships with `legacy-all` default (non-breaking `npm update`); scoped
  projection is opt-in via profile selection; switch is atomic + reversible.
- [ ] Golden tests cover legacy-all / scoped / switch-atomicity / inactive-pack
  absence. Staged-rollout plan documented; default-flip + removal NOT shipped
  here.
