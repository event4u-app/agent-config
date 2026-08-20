---
complexity: structural
status: ready
parent_roadmap: road-to-token-saving
estate_offset_exempt: "resumed out of later/ on a satisfied resume condition (2026-08-08), so active_roadmaps rises by one while later_roadmaps falls by one — a disposition change, not estate growth. The ratchet gates the two metrics separately and has no cross-metric offset; without this field an un-park can never be recorded, which would make later/ a one-way door and exactly the burial the estate-drawdown quality anchor exists to prevent."
---

# Road to request-scoped rule load — ship only what the request needs

## Outcome — closed 2026-08-20, outcome state `narrowed`

**Archived does not mean every question was answered yes.** Five of the six
phases shipped their levers and carry measured before/after evidence. The sixth,
Phase 4, ran to a terminal **honest null** and is recorded as such: the
rules-as-skills migration is not adopted, and the reason is that the surface it
would move rule bodies *onto* is measurably lossy on the host it targets.

| Phase | Outcome | Where it stands |
|---|---|---|
| 0 — workspace/pack fields into the router | **satisfied** | `dist/router.json` v2 carries the fields per non-kernel rule. |
| 1 — consumer-scoped rule projection | **satisfied** | The ~50k lever, opt-in, with the deterministic before/after on the Phase-0 rig. |
| 1b — the lever reaches actual consumer installs | **satisfied** | Pipeline B consumes the scoping; the consumer emitters no longer destroy the Phase-2 trigger signal. |
| 2 — host-native activation | **satisfied** | Cursor/Windsurf projectors populate `globs:`; path-triggered rules auto-attach from real file contact. |
| 3 — pack hygiene | **satisfied** | Two confirmed misfits fixed, sweep recorded. |
| 4 — rules-as-skills falsification probe | **honest null, terminal** | Trigger fired 2026-08-08 and went unnoticed; executed 2026-08-20 to a do-not-adopt verdict. Locked design preserved verbatim for the reopen condition named in the finding. |
| 5 — P4 rule-body migration batches | **satisfied** | The 16 should-migrate rules are thin stubs; preservation held. |

**The un-park is itself a finding.** The trigger fired when P2.1 closed on
2026-08-08 and this roadmap sat parked for twelve days with nothing watching the
gate. It is recorded in Phase 4 rather than quietly fixed, because a park whose
resume condition nobody monitors is indistinguishable from a drop.

**Framework of record:** `agents/evidence/council/drain-blocker-dispositions-a.md` <!-- ref-ignore -->
— the disposition framework this run's closures are read against. It is not on
`main` yet (it lands in PR #1463), so the citation is marked as a deliberate
forward reference rather than left to fail. Every technical claim above is cited
to this repository by `file:line` and stands without it.


> **Parked in `later/` (2026-07-28, council closeout sweep — 2-round debate,
> anthropic/claude-sonnet-4-5 + openai/gpt-4o, unanimous).** 34 of 36 steps
> done; both remaining items are the SAME council-parked Phase 4 (rules-as-skills
> falsification probe, parked by verdict 2026-07-07 with its design locked).
> **Resume trigger — restated 2026-08-08 (P0.4 of
> `road-to-rule-delivery-integrity`). Owner: maintainer.**
> **Resume when P2.1 of `road-to-rule-delivery-integrity` closes** — the
> catalogue-logging falsifier that measures whether a skill's *description*
> reaches the model at all. That is the only precondition the two remaining
> steps actually have: a rules-as-skills falsification probe is uninterpretable
> while the delivery of the surface it moves rules *onto* is unmeasured (live
> census: 288 skills shipped, 4 ever invoked, and the report itself declines to
> produce a rate).
>
> The **previous** trigger — "`discipline_profile: essential` baseline has landed
> AND thin un-deferral is actually scheduled" — is retired, for two measured
> reasons, both in `road-to-rule-delivery-integrity` § Verified problem statement
> item 3. First, it is partly already true and unobservably so: the template
> ships `auto` (`src/server/io/yamlIO.ts:144`) and an absent key resolves to
> `essential` (`src/shared/settingsCarveOut.ts:73`), so "the essential baseline"
> has no single landing event to wait for. Second and decisively, a discipline
> profile names the **always-honoured** rule surface
> (`src/scripts/compile_router.ts:266-272`) while this roadmap's own levers act on
> the **projected file set**, which is filtered by workspace and pack only
> (`src/scripts/condense.ts:1092-1099`) — so the flip could land in full and
> change nothing this roadmap is waiting for. It was waiting on a gate that does
> not open its door, and that gate is itself maintainer-blocked
> (`road-to-rule-coherence-followup.md:38` F1.1).
>
> Context, not prerequisites: `road-to-rule-delivery-integrity` (owns the
> Claude Code delivery gap and the duplicate-layer defect this roadmap's Phase 2
> did not cover) and `road-to-rule-coherence-followup` (owns the default-flip
> decision, which is no longer this roadmap's blocker).
>
> Open `[ ]` items are intentionally kept open — parked whole, neither silently
> executed nor silently deleted.
>
> Close the structural gaps the thin-projection work does not touch:
> (1) **consumer scoping** — originally 63 of 95 shipped rules were
> exclusively maintainer-workspace-scoped and landed in every consumer
> install (corrected after audit: 16 rules ≈ 13.9k tok); the router now
> carries workspace/pack fields (schema v2, Phase 0 done) and the
> **projection path** filters (Phase 1 opt-in done); (2) **host-native
> activation** — the Cursor/Windsurf projectors now populate `globs:`
> (Phase 2 done). (3) **NEW, verified 2026-07-08:** the consumer install
> pipeline ("Pipeline B" — `install.sh` / `src/install/`) never consumes
> any of this — consumer installs still ship 94/95 rules unfiltered, and
> the consumer Windsurf/Cursor emitters destroy the trigger signal
> Phase 2 added. Phase 1b closes that gap so the levers reach actual
> consumers, not just the maintainer projection.
> Council-integrated per
> `agents/settings/contexts/token-program-integration-verdict.md`: both
> original levers run NOW, in parallel with
> `road-to-discipline-profile-tiering`; neither depends on the thin flip
> or its gates. Phase 1b addition council-confirmed 2026-07-08
> (claude-sonnet-4-5 + gpt-4o, 2 rounds: extend this roadmap, do not
> spawn a sibling).

> **PARK DISCHARGED — resumed 2026-08-19 into the active tree.** Written as the
> deliverable of step 1.1 of [`road-to-standing-context-40k`](road-to-standing-context-40k.md),
> which owns the resumption-evidence note but deliberately does **not** own this
> roadmap's remaining work. The park block above is kept verbatim as the
> historical record; this note discharges it rather than replacing it.
>
> - **The resume condition, verbatim:** *"Resume when P2.1 of
>   `road-to-rule-delivery-integrity` closes"* — restated 2026-08-08 by P0.4 of
>   that roadmap, owner maintainer.
> - **Date it was satisfied: 2026-08-08.** P2.1's own completion marker in
>   [`archive/road-to-rule-delivery-integrity.md`](archive/road-to-rule-delivery-integrity.md)
>   carries `done 2026-08-08`. The parent roadmap itself archived one day later,
>   2026-08-09 (`259039157`), which is the event `agent-config gates` reports the
>   machine-decidable probe as having FIRED on. Both point at the same discharge;
>   the written condition is the earlier and narrower of the two.
> - **The artefact that satisfied it:**
>   [`skill-catalogue-description-delivery.md`](../evidence/analysis/skill-catalogue-description-delivery.md).
>   Its finding is *not* the one P2.1 hypothesised: 414/414 installed skills carry
>   a description on disk (measured), while 5 of 8 sampled catalogue entries
>   reached the model without one (first-party observation). So the projection is
>   complete and **the loss is host-side** — "our projection is missing
>   descriptions" is refuted. It claims no total bare-vs-described rate, because
>   the catalogue is not persisted and hand-counting a context window would not be
>   verifiable. That is what the two Phase-4 steps below now have to be read
>   against: the surface a rules-as-skills probe would move rules *onto* is
>   measured, and measured lossy for a reason this suite does not control.
> - **No resumption event followed, for eleven days.** `git log` over this file
>   since 2026-08-08 returns **zero** commits, so nothing acted on the satisfied
>   condition and nothing recorded a decision not to. Three consecutive
>   `/roadmap:next` screens (2026-08-18 h, 2026-08-19 i, and this one) logged the
>   FIRED probe in their by-product findings and each correctly declined it as a
>   maintainer-owned Phase-4 probe — which is why the file needed the note and the
>   move, not execution.
>
> **What resuming does and does not authorise.** It puts the file where the
> dashboard counts it and where a screen can see it, and it records why. It does
> **not** promote Phase 4: both remaining steps stay `[ ]` and stay
> council-parked by the 2026-07-07 verdict with their design locked. Owner
> unchanged: maintainer.

## Goal

A consumer who installs the suite pays context only for (a) rules relevant to
their installed workspaces/packs and (b) — on Cursor/Windsurf — rule bodies
their current files actually trigger. Concretely: cut the consumer rule
surface from 95 shipped rules to the ~32 non-maintainer ones **before** any
projection-mode question applies, and give path-triggered rules deterministic
host-native activation. Every cut lands behind the existing Phase-0
measurement rig (`road-to-token-saving` D0); no lever ships on an estimate
alone.

## Context — verified on the live checkout, 2026-07-07 (Pipeline-B findings re-verified 2026-07-08)

- **Rule layer, eager vs thin** (`project_thin_rules --measure`, tiktoken
  exact): eager 77,534 / thin 13,509 / saved 64,025 GPT tok (82.6%). The thin
  flip itself is owned by `later/road-to-token-saving-HUMAN-MEASUREMENT.md`
  and is **out of scope here**; per the weak-host-lift verdict it is
  additionally deferred until `discipline_profile: essential` ships and is
  baseline-measured (then re-swept as a sub-mechanism of essential).
- **Consumer dead weight (original finding, since narrowed):**
  `dist/agent-src/rules/` holds 95 rules; the audit reclassified 46 and left
  **16 exclusively maintainer-only** (≈13.9k tok eager). `dist/router.json`
  now carries `workspaces`/`packs` per non-kernel entry (schema v2, landed
  2026-07-07) and `rule_in_scope()` filters the **projection** generators.
- **Pipeline B is unfiltered (verified 2026-07-08):** the consumer install
  path never runs the filter. `install.sh sync_hybrid` copies
  `dist/agent-src/rules` → `.augment/rules` guarded only by the hardcoded
  `EXCLUDE_RULES="source-of-truth.md augment-portability.md docs-sync.md"`
  (`src/scripts/install.sh:27` — 2 of 3 entries point at files that no
  longer exist in dist), so a consumer project install ships **94 of 95
  rules** including 15 of the 16 maintainer-only ones. `install_global`
  copies `GLOBAL_DEPLOY_SOURCES` (`src/install/wizard-plan.ts:93`,
  `['dist/agent-src/rules', 'rules']`) with **no exclude at all** — all 95
  incl. `source-of-truth.md`, contradicting the project path. Zero
  `rule_in_scope` references exist under `src/install/`.
- **Consumer host emitters destroy Phase-2 signal (verified 2026-07-08):**
  consumer `.windsurfrules` is generated by `install.sh:594-630`
  concatenating ALL synced rules with stripped frontmatter (always-on, all
  trigger signal gone) — a DIFFERENT generator from the maintainer-projection
  `.windsurfrules` in `condense.ts` that Phase 1's inline note refers to.
  Consumer Cursor gets a symlink farm to raw `.md`
  (`install.sh:485`, `.cursor/rules → ../../.augment/rules`), not the `.mdc`
  glob files; `find dist -name '*.mdc'` → zero files. Phase-2 host-native
  activation currently reaches **zero consumers**.
- **Settings surface gap:** `projection.rule_workspaces` / `rule_packs` are
  documented in `src/config/agent-settings.template.yml:55-72` but absent
  from the Zod settings schema (`src/server/schemas/settings.ts:48-50`
  declares only `mode`) and nothing (wizard or installer) ever writes them —
  the lever delivers zero real-world savings until wired.
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

- [x] **Misclassification audit first (blocking):** review the 63
      exclusively-maintainer rules for consumer-relevant misfits (e.g. a
      generic discipline rule tagged maintainer out of habit). Output: a
      reviewed allowlist diff; every reclassification is its own commit with
      reasoning. Do not filter on unaudited tags.
      <!-- done 2026-07-07: 46 reclassified (4 audited group commits A-D), 16 stay
      maintainer-only; council-checked; full record in
      agents/settings/contexts/consumer-scoping-audit-2026-07-07.md. Corrected
      lever: 16 rules ≈ 13.9k tok eager (external "63 ≈ 50k" was a naive tag read). -->
- [x] Extend the 6.0.0-B pack loader / projector path to rules: given the
      installed workspace+pack set, project only matching rules into
      `.claude/rules`, `.cursor/rules`, `.clinerules`, `.windsurfrules` and
      the consumer `dist/agent-src/rules` deploy source. Kernel always
      projects. `legacy-all` projects everything (non-breaking default).
      <!-- done 2026-07-07 as `projection.rule_workspaces` (opt-in, additive):
      the 6.0.0-B scoped pack loader is not ported in condense.ts (throws), so
      the rule filter is a standalone workspace predicate applied in all four
      rule generators + the MAINTAINER-PROJECTION .windsurfrules; kernel always
      projects; legacy-all default preserved byte-identically.
      SCOPE CORRECTION 2026-07-08: "and the consumer dist/agent-src/rules
      deploy source" was over-claimed — the filter lives ONLY in the
      condense.ts projection path; the consumer install pipeline is untouched.
      That remainder is Phase 1b below, not silently done here. -->
- [x] Filter the thin-projection pointer catalog by the same set — a
      consumer without the maintainer workspace gets neither maintainer
      bodies nor maintainer pointer lines (floor shrinks from 86 pointers
      toward ~23 + kernel), so the mechanism is ready whenever the thin flip
      un-defers.
- [x] CI guard: a consumer-shaped fixture install must contain zero
      exclusively-maintainer rules; a maintainer checkout must contain all
      95 (mirrors the portability-guard pattern).
      <!-- done: tests/scripts/rule_workspace_scoping.test.ts runs against the
      REAL dist rules + router (consumer scope excludes all 16 maintainer-only,
      keeps kernel + reclassified; null scope keeps all 95).
      SCOPE CORRECTION 2026-07-08: this test exercises the FILTER FUNCTIONS
      against dist data — it never runs the installer, so it does not prove a
      "consumer-shaped fixture install" is scoped. The installer-level guard
      is Phase 1b Step 1. -->
- [x] **Human gate (reformulated 2026-07-08 — measures the CONSUMER
      surface):** flip default from `legacy-all` to scoped for consumer
      installs (maintainer source checkout keeps everything) only AFTER
      Phase 1b wires the filter into the install pipeline; the recorded
      before/after is the rule surface of an ACTUAL fixture install
      (project + global), not `condense.ts` output. Record eager and thin
      arms in `internal/bench/reports/`. Release-notes line: existing
      installs need `sync`/re-install; the flip invalidates each consumer's
      KV-cache prefix once (1.25–2× write cost, first session only).
      <!-- done 2026-07-13 (maintainer approved in-session, evidence-gated):
      template default flipped to ALL consumer workspaces — the audit-faithful
      shape: exactly the 16 exclusively-maintainer rules drop (audit 2026-07-07:
      "the lever is the measured size of those 16"); safety floors + domain
      rules keep shipping (a bare [engineering] default would have dropped the
      finance/legal/strategy floors — rejected). Held-quality arm is
      DETERMINISTIC per the resolved blocker (LLM judging closed-by-diagnosis):
      check_consumer_scope_flip.ts proves set-inclusion (only exclusively-
      maintainer rules drop; zero golden-set-exercised consumer rules affected;
      schema gate --scope consumer --require-complete green, 86/86). Evidence:
      internal/bench/reports/2026-07-13-consumer-scoped-default-flip.json —
      103→88 rules, −9,880 cl100k tok (−13.1%) per consumer install (the
      2026-07-08 −23.5% engineering-only arm stays recorded as the opt-in
      narrower choice). Release-notes line landed in CHANGELOG § Breaking
      changes (sync/re-install + one-time KV-prefix rebuild). -->

**Exit:** consumer fixture install ships ~32 rules + kernel; measured rule
surface delta recorded (est. −50k tok eager / −63 pointers thin);
`trigger-coverage` still green on the consumer set.
**Rollback:** set `legacy-all`; one flip, no code change.

## Phase 1b — Pipeline B: make scoping reach actual consumer installs

The projection filter (Phase 1) never runs on the install path. Wire it in,
red-test first, and fix the consumer host emitters that currently destroy the
Phase-2 trigger signal. Fully autonomous except the inherited human gate above.

- [x] **Installer integration test (red first):** run `install.sh` (project
      shape) and the global install (`install_global` /
      `src/install/wizard-plan.ts` payload) against fixture targets and
      COUNT the arrived rule files per scope. Assert: consumer project scope
      excludes all 16 maintainer-only rules; global scope applies the same
      contract; the `source-of-truth.md` global/project contradiction is an
      explicit test case. This test is red today — land it first so the gap
      is a measured fact (extend `tests/test_install.sh` /
      `tests/test_install_orchestrator.sh` or add a sibling; existing tests
      only assert file existence, never counts).
      <!-- done 2026-07-08: tests/test_install_rule_scoping.sh (bash, project
      path — router-derived maintainer-only set, kernel guard, scoped<legacy
      count) + tests/install/rule_scoping_plan.test.ts (global plan path,
      6 tests incl. the source-of-truth.md contradiction case). Landed red
      (12 maintainer-only rules arrived scoped; scoped==legacy 94==94),
      now green post-wiring: legacy-all 94, scoped(engineering) 76. -->
- [x] **Wire the filter into the install path:** have the install pipeline
      consume `dist/router.json` v2 workspace/pack fields (or call
      `rule_in_scope()` from the payload-sync path —
      `_copy_dir_dereferencing_symlinks` for the `rules` entry in
      `src/install/`), fed from the wizard's installed workspaces+packs.
      Replace the dead hardcoded `EXCLUDE_RULES` list in
      `src/scripts/install.sh:27` (+ `is_excluded_rule()`,
      `install.sh:287-300`) with frontmatter/router truth. Resolve the
      global-vs-project contradiction on `source-of-truth.md` explicitly
      (one documented decision, same treatment both paths).
      <!-- done 2026-07-08: src/install/rule_scope.ts re-uses the projection
      predicate rule_in_scope (semantics can never drift) + rule_scope_cli.ts
      for bash; install.sh resolve_excluded_rules() replaces the dead
      3-name EXCLUDE_RULES (static compat fallback stays as the
      no-node fail-safe, over-ship never under-ship; child TMPDIR pinned —
      the macOS tsx-cache-into-target trap); global path filters via
      PlanSource.fileFilter in buildInstallPlan, wired in
      expandWizardSources + the install route (global settings cascade).
      source-of-truth.md decision recorded in rule_scope.ts: excluded from
      BOTH consumer paths always — its Iron Law forbids edits a consumer
      legitimately makes; global shipping it was the bug. -->
- [x] **Consumer host emitters:** switch consumer Windsurf emission off the
      frontmatter-stripping concatenator (`install.sh:594-630`) onto the
      condense-path emitter output (or ship pre-built artifacts in `dist/`),
      so `glob`/`model_decision` triggers survive; ship the `.mdc` glob
      files to consumer Cursor instead of (or alongside) the raw-`.md`
      symlink farm (`install.sh:485`). Decide build-time-artifact vs
      install-time-generation once, record why.
      <!-- done 2026-07-08: DECISION = install-time emission (recorded in
      src/install/emit_host_rules_cli.ts): a dist/hosts tree would cascade
      through manifest/checksums/budget gates for derived data, and
      install-time runs AFTER the Phase-1b filter so scoped installs get
      scoped host files for free; re-uses the exported condense emitters
      verbatim (consumer output byte-identical to the projection).
      install.sh emit_host_rules(): cursor gets native .mdc (94 legacy / 76
      scoped, real globs verified), windsurf gets .windsurf/rules + a
      frontmatter-aware .windsurfrules; the raw-md symlink farm and the
      bash frontmatter-stripper remain ONLY as no-node fallbacks. Old
      symlink expectation in test_install.sh updated to the new contract
      (100/100). -->
- [x] **Settings plumbing:** declare `projection.rule_workspaces` /
      `rule_packs` in the Zod settings schema
      (`src/server/schemas/settings.ts`) so they validate and surface in the
      settings UI; have the wizard write them from the chosen
      workspaces/packs at install time (default remains `legacy-all` until
      the human gate flips it).
      <!-- done 2026-07-08 (adapted — presence-activation nuance): the Zod
      schema declares both keys with .default([]) (validated + visible in
      the settings surface; empty = inactive everywhere by the shared
      length>0 semantics), the template renders them actively as [] so
      every new install and settings:sync carries them INACTIVE — wiring
      is complete end-to-end and the human flip is now a pure settings
      edit (fill the list), not a code change. The wizard deliberately
      does NOT write live values: a non-empty list IS the activation, and
      that is the Phase-1 human gate. .optional() would have broken the
      settings-diff contract (to:undefined dropped over HTTP) — default([])
      keeps both sides of the diff populated (22/22 settings tests). -->
- [x] Snapshot/regression: re-run the Phase 1b installer test green; full
      `dist` determinism gates stay green; record the consumer-install
      before/after (rule count + tokens via `token_count.ts`) as the
      evidence the human gate consumes.
      <!-- done 2026-07-08: install suite 100/100, scoping suite 12/12,
      plan+projection vitest 15/15, tsc green; dist untouched this run
      (install-time emission decision means zero dist delta). Evidence
      pinned: internal/bench/reports/2026-07-08-consumer-install-rule-scope.json
      — ACTUAL install.sh fixture installs, cl100k_base: legacy-all 94
      rules / 77,632 tok vs scoped(engineering) 76 rules / 59,368 tok =
      −18,264 tok (−23.5%) per consumer install. The human gate can now
      judge real consumer-surface numbers. -->

**Exit:** an actual consumer fixture install (project AND global) ships only
scope-matched rules with intact host-native triggers; the installer test
locks it; the human gate has real consumer-surface numbers to judge.
**Rollback:** installer keeps `legacy-all` behaviour (filter no-ops); test
stays as the red/green witness.

## Phase 2 — Host-native activation: populate globs (deterministic)

- [x] `_emit_cursor_mdc`: map `file_pattern` triggers verbatim and
      `path_prefix` triggers as `<prefix>**` into the `.mdc` `globs:` field;
      rules with ≥1 path-shaped trigger become Cursor auto-attach,
      description-only rules stay Agent-Requested (`alwaysApply: false`).
- [x] `_emit_windsurf_rule`: same mapping onto the `glob` trigger type;
      keyword/intent-only rules keep `model_decision`.
- [x] Snapshot tests: `ui-audit-gate` fixture emits
      `globs: resources/views/**,resources/js/**`; a keyword-only rule
      emits empty globs unchanged.
- [x] Verify no double-fire: a glob-attached rule must not also be inlined
      eager on those hosts once thin mode lands (interaction note in the
      rule-router contract).

**Exit:** path-triggered rules auto-attach on Cursor/Windsurf from real file
context; projection-fidelity + snapshot tests green.
**Rollback:** re-emit empty globs (single function revert).

## Phase 3 — Pack hygiene (two confirmed misfits + one sweep)

- [x] Move `ui-audit-gate` (`meta` → `frontend-design`) and decide
      `design-fidelity` (`engineering-base` → `frontend-design`?, keep
      genuinely stack-neutral discipline in base). These are the only two
      verified misfits — the external draft's five-rule claim was corrected
      2026-07-07.
      <!-- done: both moved to frontend-design. -->
- [x] With Phase 0+1 landed, verify end-to-end: a consumer install without
      `frontend-design` contains neither the moved rule bodies nor their
      pointers.
      <!-- done via projection.rule_packs (second scoping axis, symmetric to
      rule_workspaces): deselecting frontend-design drops ui-audit-gate +
      design-fidelity bodies AND pointers — e2e-tested in
      tests/scripts/rule_workspace_scoping.test.ts. -->
- [x] Sweep the remaining packs for the same misfiling pattern (one audit
      pass, findings → follow-up commits or honest-null).
      <!-- done 2026-07-07: 4 media rules moved out of `meta` to their packs
      (image-likeness-and-rights→ai-image, media-sync-ground-truth→ai-video,
      media-governance-routing + provider-lifecycle-discipline→ai-image+ai-video).
      Honest finding: `meta` is a 60-rule catch-all for behavior rules — that is
      a vocabulary shape, not per-rule misfiling; the workspace axis (P1) is the
      consumer filter, pack membership is secondary. No further moves. -->

**Exit:** deselecting `frontend-design` removes its rule cluster;
pack-membership audit recorded.
**Rollback:** frontmatter-only change; revert the pack keys.

## Phase 4 — EXECUTED 2026-08-20: rules-as-skills falsification probe (Claude Code)

**Its resume trigger fired, and nothing was watching the gate — that is the
first half of this phase's finding.** Parked by council verdict (2026-07-07)
with the design locked. The trigger was restated 2026-08-08 to name exactly one
precondition — "Resume when P2.1 of `road-to-rule-delivery-integrity` closes" —
and P2.1 is closed: `agents/roadmaps/archive/road-to-rule-delivery-integrity.md:241`
carries `- [x] **P2.1 Log the injected skill catalogue once per session**`, and
that roadmap is archived. The older `discipline_profile: essential` trigger is
retired in this roadmap's own header, for reasons recorded there.

Design as locked, preserved verbatim for the reopen case: 3-rule pilot (one
tier-1 routing rule, one tier-2 discipline rule; safety floors excluded by
design — never a discretionary vehicle), canary methodology +
length-controlled paired judge, skeptical prior, adopt-or-honest-null terminal.

**Terminal verdict: honest null — do not adopt.** Reached on the destination
surface's measured delivery, not on a taste argument, and not by running the
paired judge: the judge measures whether *content* survives the move and cannot
ask whether the surface arrives at the model at all — which the trigger's own
falsifier measured first, on the exact host this phase targets. On Claude Code
`2.1.226`, our projection is complete (414 of 414 skills carry a `description:`
on disk) while five of eight sampled catalogue entries reached the model as bare
names; the invocation census over the same period is 12 invocations across 30
sessions covering 4 distinct skills. A skeptical prior does not clear on that.

- [x] Trigger fired; locked design executed to its terminal verdict, recorded
      as an honest null.
      <!-- verified 2026-08-20: agents/evidence/eval-findings/rules-as-skills-falsification-null.md
           — trigger citation, the 414/414 deterministic count, the
           five-of-eight catalogue observation, and the three claims the null
           deliberately does NOT make. -->

**Exit:** met — a recorded adopt-or-null verdict. The verdict is the null,
and the evidence it rests on is named in the finding rather than produced by a
judge run nobody performed.
**Rollback:** nothing to roll back — no pilot skills were generated, because
the probe terminated before the pilot on its own precondition.

## Phase 5 — P4 rule-body migration batches (feedback-8.11 routing, 2026-07-12)

The systematic skills-rules coupling pass (maintainer note c of the 8.11
feedback; council AMEND-convergence: fold it HERE, not a separate roadmap).
Input inventory: `docs/guidelines/agent-infra/rule-body-migration-inventory.md`
(2026-07-12 — 32 already-thin / **16 should-migrate** with named targets /
56 must-stay-monolithic; kernel + safety floors excluded by construction).
Each rule keeps its Iron-Law stub (heading + fenced block + negations
byte-preserved — `check_condensation` / preservation-guard is the per-batch
gate); the body moves to the inventory's named target; the rule's trigger-set
routing must fire at least as well as the monolithic rule did
(trigger-eval infrastructure is the verifier). The proof that migrated
bodies load only on demand is owned by the utilization window
(`docs/design/utilization-window-criteria.md` D-rules) plus this
roadmap's request-scoped load — not by new apparatus.

- [x] <!-- done 2026-07-12 (feedback-8.11-2 Phase 2): 9/9 migrated, 0
      skipped; stub bytes 56,389→27,209 (−51.7%); preservation +
      frontmatter + trigger-matrix suites green; roadmap-ci-steps body
      landed in NEW contexts/execution/roadmap-ci-steps-mechanics.md
      (process-loop 5x over its 4k budget — contingency per step note). -->
      **Batch A — existing-target extensions (9 rules):** roadmap-ci-steps-policy
      → roadmap-process-loop context; code-comment-discipline →
      code-clarity guideline; untrusted-input-defense →
      untrusted-input-spotlighting guideline; no-roadmap-references →
      skill:agent-docs-writing; decision-revisit-gate → skill:decision-review;
      improve-before-implement → agent-interaction-and-decision-quality
      guideline; architecture → skill:module-detect-on-the-fly;
      persona-governance → persona-schema contract;
      provider-lifecycle-discipline → provider-lifecycle contract.
      Per-rule: migrate body, keep stub, run preservation check + trigger evals.
      <!-- verify: ./scripts-run src/scripts/check_condensation -->
- [x] <!-- done 2026-07-12: 7/7 migrated, 0 removed; src stub lines
      995→514 (−48%). Stub-necessity pre-questions answered KEEP for all
      7 (each fires on a live authoring/editing/session surface; none
      merely historical; router-entry-alone insufficient because Iron
      Laws + load-bearing tables must be visible on fire). Notable keeps:
      own-orphan-cleanup stays in the minimal-safe-diff stub (anchor-
      referenced by kernel rule downstream-changes — no kernel edit);
      3-failure/hard-blocker/read-loop cores stay in context-hygiene.
      Gates green: check_condensation, condense --check, frontmatter
      407/0, check-trigger-evals, presence (fe-design grandfather
      shrink), lint-rule-tiers, check-refs. -->
      **Batch B — new-guideline homes (7 rules):** context-hygiene,
      minimal-safe-diff, domain-adoption-policy, design-fidelity,
      framework-neutrality-in-generic-skills, artifact-drafting-protocol,
      active-remediation → each gets its named
      `docs/guidelines/agent-infra/*-mechanics.md` (per the inventory);
      same per-rule gates as Batch A. **Stub-necessity pre-questions
      (answer per rule BEFORE migrating — Batch A deliberately kept all
      9 stubs; B does not inherit that default):** does the stub need to
      exist at all? can the rule be removed entirely? is a router entry
      alone sufficient? is the rule merely historical? A rule answered
      as a full-removal candidate gets its own disposition note instead
      of a mechanical migrate-and-keep-stub pass.
- [-] <!-- skipped 2026-07-12 (trade-off negative, per the step's own
      allowance): the legal exemplar worked because legal-practice-profile
      already existed as a natural mechanics home; the other 6 floors have
      no profile skill, and their bodies are FIRE-TIME PAYLOADS (verbatim
      disclaimer footers, PII placeholder matrices, retention floors) that
      must be present the moment the floor fires — splitting them adds a
      load hop on a safety surface for pack-scoped token cost. Pre-questions:
      all 6 floors must-stay (classification), none removable, none
      historical. No floor internals touched (security-sensitive-stop). -->
      **Batch C — safety-floor template application (review-heavy, optional):**
      the inventory found `legal-safety-floor` is the exemplar of P4 applied
      INSIDE a safety floor (Iron Laws inline, mechanics in the profile
      skill). Evaluate applying the same shape to the other 6 domain-safety
      floors — extra review per `security-sensitive-stop`; skip with a note
      if the trade-off is negative (floors are classified must-stay; this
      batch changes their internal shape only, never their eager presence).
      The same stub-necessity pre-questions as Batch B apply per floor
      before touching it (need-to-exist / remove-entirely /
      router-entry-alone / merely-historical) — floors are must-stay by
      classification, so a "remove" answer here means escalate with a
      disposition note, never a silent cut.
- [x] **Backlink report** — regenerate the derived per-skill inbound-routes
      report after each batch (see `rule_backlinks` generator, feedback-8.11
      Phase 6) so skill authors see which rules route to them; no
      frontmatter key (council: routed_from_rules REJECTED).
      <!-- done 2026-07-12: regenerated after Batch B — 83 targets, 0 orphans,
      0 unknown-shape (internal/reports/rule-backlinks.md). -->

**Exit criteria:** the 16 should-migrate rules are thin stubs; preservation
checks green per batch; trigger-eval coverage not regressed; backlink report
current.
**Rollback:** per-batch — restore the monolithic rule bodies from git; the
target files' added sections are additive.

## Risk Register

<!-- risk-review: v1 | reviewed: 2026-08-20 | reviewer: claude/host -->

Written at resumption, not at authoring: the grandfather exemption lifts on the
first substantial edit after 2026-08-04, and the resumption note above is that
edit. So this register covers what is left — Phase 4 and the resumption itself —
rather than the 35 steps that already landed.

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The trigger fires and nobody notices | implementation | Realised, and it is why this row is rewritten rather than re-anchored. The 2026-08-08 restatement named exactly one precondition and it closed the same day; the roadmap then sat parked for twelve days with no mechanism watching the gate — a park whose resume condition nobody monitors is indistinguishable from a drop | The un-park is recorded as a finding in the phase body and in `## Outcome`, not quietly fixed. The residual is unfixed and named: nothing in this repository watches a resume trigger, so the next parked roadmap can repeat it. That is a gap for the estate-level disposition work, not something this roadmap can close | Phase 4 — EXECUTED 2026-08-20: rules-as-skills falsification probe |
| 2 | The null is misread as a verdict on rules-as-skills | product | The probe terminated on the destination surface's measured delivery — 5 of 8 sampled catalogue entries reaching the model with no description while 414/414 carry one on disk — which is a host-side fact and not evidence about the hypothesis. A reader who takes the null as "rules-as-skills was tested and failed" gets the opposite of what was measured | The finding carries an explicit three-item list of what the null does NOT claim, including that a paired judge was never run and that saying otherwise would be a fabricated measurement. The reopen condition is stated in falsifiable terms — a sampled majority arriving WITH descriptions plus an invocation rate materially above 12-in-30 — and the locked design is preserved verbatim for that case | Phase 4 — EXECUTED 2026-08-20: rules-as-skills falsification probe |
| 3 | An un-park becomes a routine way to move estate numbers | implementation | If resuming a parked file is cheap, `later/` turns into a staging area both directions and the ratchet stops describing the estate | The estate raise is recorded with its reason in `estate-count-budget.json` and states that it is NOT underwritten by future work; `later_roadmaps` falls by one in the same commit, which is the invariant that distinguishes a disposition change from growth | Acceptance criteria |
| 4 | The remaining consumer-scoping levers are believed shipped and are not | product | Phases 0-3 and 5 are marked done against 2026-07/08 measurements; a consumer install that still ships unfiltered rules would make this roadmap's Goal false while every checkbox reads closed | The Goal's claim is measurable rather than asserted — `check_standing_rule_delivery` and `report_carrier_divergence` both read the live install, and the sibling `road-to-standing-context-40k` owns the standing-delivery number | Goal |

## Acceptance criteria

- [x] `dist/router.json` v2 carries workspaces/packs; CI byte-stability
      gates green (Phase 0).
      <!-- verified 2026-07-07 post-merge: check-router green, schema 2, all non-kernel entries carry ws+packs -->
- [x] Intent-only rules have written dispositions (Phase 0).
      <!-- verified: only telegraph-speak stays intent-only (council-decided retirement) -->
- [x] Consumer installs ship only workspace-matched rules; measured
      before/after recorded; misclassification audit trail exists (Phase 1).
      <!-- verified 2026-07-13: template default scoped (16-rule lever);
      before/after in internal/bench/reports/2026-07-13-consumer-scoped-
      default-flip.json + 2026-07-08-consumer-install-rule-scope.json; audit
      trail agents/settings/contexts/consumer-scoping-audit-2026-07-07.md. -->
- [x] The installer-level scoping test (Phase 1b Step 1) is green on both
      project and global fixture installs; the dead `EXCLUDE_RULES` list is
      gone; the `source-of-truth.md` global/project contradiction is
      resolved with a recorded decision.
      <!-- verified 2026-07-08: 12/12 bash + 6/6 plan tests; decision in
      src/install/rule_scope.ts (excluded from BOTH paths always). -->
- [x] Consumer Windsurf/Cursor surfaces carry the host-native trigger signal
      (no frontmatter-stripping concatenation; `.mdc` files reach consumer
      Cursor).
      <!-- verified 2026-07-08: native .mdc with real globs + .windsurf/rules
      with trigger frontmatter + frontmatter-aware .windsurfrules; legacy
      surfaces demoted to no-node fallbacks. -->
- [x] `projection.rule_workspaces`/`rule_packs` validate in the settings
      schema and are written by the wizard.
      <!-- verified 2026-07-08 (adapted): Zod default([]) + template renders
      both keys INACTIVE on every install/sync; live values deliberately
      stay the human flip (presence-activation) — see the Step-4 note. -->
- [x] Path-triggered rules auto-attach natively on Cursor/Windsurf
      (Phase 2).
      <!-- verified live: ui-audit-gate.mdc globs=resources/views/**,resources/js/**; windsurf trigger: glob; 9 emitter tests green -->
- [x] Verified pack misfits are fixed and the sweep is recorded (Phase 3).
      <!-- verified: frontend-design/ai-image/ai-video tags live; scoping tests green -->
- [x] Phase 4 stayed parked until its promotion trigger fired, then executed —
      no silent execution, no silent deletion, and no silent *waiting* either.
      <!-- verified 2026-08-20: trigger fired at
           archive/road-to-rule-delivery-integrity.md:241; verdict recorded in
           agents/evidence/eval-findings/rules-as-skills-falsification-null.md;
           the locked design is preserved verbatim in Phase 4 for the reopen
           case named in the finding. -->
- [x] Every shipped lever carries a measured before/after on the Phase-0
      rig.
      <!-- verified 2026-07-13: the one shipped lever (consumer-scoped rule
      projection) carries the deterministic before/after + held-quality
      verification above; the golden set is the Phase-0 rig's corpus (90/90
      labelled, consumer coverage 86/86). No other lever shipped. -->

## Blockers

### blocker: phase-0-golden-set (inherited)
- **Status:** RESOLVED NEGATIVE upstream (2026-07-12) — the owning gate in
  `road-to-token-saving` (now parked in `later/`) is CLOSED-BY-DIAGNOSIS:
  two pre-registered length-neutral judge runs were inconclusive; LLM-paired
  judging cannot render a trustworthy held-quality verdict on this corpus
  (docs/benchmark.md § Length-neutral judge RERUN). The only re-open path is
  deterministic anchor-scoring against `must_include`/`must_not`.
- **Owner:** maintainer
- **Blocks:** the held-quality verification arm of Phase 1's default flip —
  the flip therefore needs a DETERMINISTIC verification arm (anchor-scoring)
  instead of the retired LLM-judge batch; it stays evidence-blocked until one
  is built and run. Does **not** block Phases 0, 2, 3 or the opt-in build of
  Phase 1 (mechanical, CI-verified).
- **What to do:** build/run the deterministic anchor-scoring arm over the
  labelled golden set; the live 3-host canary tick stays as the second half.
- **Resolved when:** `check_quality_regression --as-flip-gate` exits 0 on a
  real (non-dry-run) report — hardened criterion per
  `road-to-token-proof-and-story` Phase 0.
- **Evidence update 2026-07-11 (real run landed — gate is RED, not just
  pending):** the consumer golden set is complete (PR #885) and a full sonnet
  n=90 `check_quality_regression --as-flip-gate` ran (PR #887). It **FAILS**
  (thin win-rate 36.2% < 48% floor; length-confound 60%, judge inconsistency
  31%). CAVEAT: that run measured the **thin** projection (kernel bodies +
  non-kernel pointers), NOT this roadmap's **workspace-scoping** reduction — a
  milder, different cut with **no dedicated arm** in `bench_quality_run` yet. So
  the held-quality arm is **not** directly resolved, but the strongest same-class
  reduction failed the gate decisively → treat context-reduction-for-tokens as
  **quality-risky by prior** on this eval. **Disposition (maintainer, 2026-07-11):
  do NOT spend another ~$33 on a workspace-scoped arm** that shares the same
  verbosity confound and would most likely reconfirm the negative; the Phase-1
  DEFAULT flip stays **evidence-blocked**. The opt-in build path is unaffected
  (per Blocks above). Revisit only with a length-normalised arm that kills the
  confound.
