<!-- evidence-type: analysis -->

# The undeclared local-only gates — a complete reading

Phase 1 of `road-to-local-gates-wired-while-they-are-green`. Taken on the
branch base `257e87de0` (`origin/main`, 2026-10-13), in the branch worktree,
on one machine.

Every gate `check_ci_local_parity` reports as **undeclared local-only** was run
once, serially, with the arguments its own task passes. The reading records,
per gate: the task that owns it, the command, the exit code, the wall-clock
seconds and the first finding or verdict line it printed.

## What the parity gate reported at the base

```
ci-parity:local-only: 163 violation(s), baseline 165 — ratchet is loose.
✅  CI ↔ local parity: 212 CI gate(s), 345 local, 36 declared CI-only, 7 declared local-only.
```

## Method, and the two defects the method had first

The gate list is `undeclared_local_only` from `check_ci_local_parity --format
json`, not a hand-written list. The command per gate is extracted from the
parsed `Taskfile.yml` + `taskfiles/*.yml` task bodies — **parsed, not grepped**,
and the reason is that the first pass of this reading grepped and was wrong
twice:

1. **Template variables leaked.** A grep over the raw YAML captured
   `{{.QUIET_FLAG}}` and `{{.CLI_ARGS}}` verbatim, and the gates then refused
   them as unrecognised arguments. **41 gates read red that are green** —
   an exit code produced by the measurement, not by the tree.
2. **Write variants were picked over check variants.** Three generators expose
   both a writing task and a `--check` task. The grep took the shorter line, so
   the first pass *ran the writer*, reported exit 0, and silently modified five
   tracked files in the worktree. The reading now prefers a `--check` variant
   where one exists and skips any `--write` / `--fix` / `--apply` variant.

Both passes are recorded here rather than only the corrected one, because the
second defect is the sharper lesson: a measurement that mutates its own subject
reports a green it manufactured.

## The counts

| | Count |
|---|---:|
| Undeclared local-only gates at the base | **163** |
| With a replayable task command | **161** |
| Exit 0 | **137** |
| Non-zero | **24** |
| Serial wall-clock for all 161 | **91 s** |
| Serial wall-clock for the 119 `wire`-class gates | **35.6 s** |

The single slowest gate, `audit_command_surface`, is **43.5 s** of the 91 s —
48 %. Removing it leaves 47.5 s for the other 160.

## The classes

Step 1.2 asks for four: `wire`, `calendar`, `machine`, `slow`. They are
assigned to the **green** gates; a gate that is red at the base is `red` and
carries its disposition instead, because a class is a wiring decision and a red
gate is not wirable at all.

| Class | Count | Rule applied |
|---|---:|---|
| `wire` | 119 | exit 0, under 10 s, no clock read this reading can name, no developer-machine state |
| `calendar` | 13 | calls `checkRatchet` (a baseline unchanged for `STALE_AFTER_DAYS = 56` fails with no diff), or prints an `as-of:` verdict line |
| `machine` | 6 | reads or writes the developer's checkout, branch or installed host layer |
| `slow` | 1 | exit 0 and ≥ 10 s |
| `red` | 24 | non-zero at the base |

**How `calendar` is decided, and what the decision does not claim.** Two
decidable signals are used: a `checkRatchet` call in the gate's source (23
scripts in the tree, 11 of them in this set), and the six gates the roadmap
names as printing an `as-of:` verdict line. A gate outside both signals may
still read the wall clock for something other than its verdict — 117 scripts
under `src/scripts/` mention `Date.now()` or `new Date()`, most of them only to
stamp output. This reading does **not** claim the other 119 are clock-free; it
claims they match neither decidable signal. The mitigation for the residue is
the batch size and the fact that a wired gate's first CI run is the real test.

### `calendar` — 13

`check_knowledge_pages` · `check_reach_staleness` · `check_roadmap_trackable` ·
`domain_soundness_status` · `lint_artefact_frontmatter` · `lint_handoffs` ·
`lint_hook_manifest` · `lint_one_off_age` · `lint_provenance_vocabulary` ·
`lint_roadmap_blockers` · `lint_roadmap_later_disposition` ·
`lint_symptom_intake` · `skill_eval_coverage`

### `machine` — 6

| Gate | Why |
|---|---|
| `check_branch_freshness` | compares the local branch against its remote; the forge owns mergeability in CI |
| `sync_pr_branch` | updates the developer's branch from its base |
| `check_branch_work_committed` | no task command — the pre-push hook is its only caller |
| `check_installed_hooks_fresh` | no task command — compares installed git hooks against the tree |
| `complexity_report` | **writes** `internal/reports/complexity-report.md`; a generator with no `--check` mode, so there is nothing to wire |
| `check_review_prompt_binding` | its task wraps it in a shell block that downgrades exit 2 to advisory; the bare call is not what CI would run |

None of the six is declared under `local_only:` in this change. Step 1.2 allows
a declaration only where the reason has the structural shape the 2026-08-13
decision established — "there is no remote equivalent to write" — and the
cheaper, more honest move for all six is the one that step names as the
default: **they stay in the backlog with their class written down.** Declaring
them would lower the violation count without wiring anything, which is the
move the decision calls out by name.

### `slow` — 1

`audit_command_surface`, 43.5 s. **Routed nowhere, and this line is corrected
from the one it replaced** — which said it joins the `calendar` gates on the
scheduled workflow, as step 2.3 prescribes for the `slow` class. It did, and
was taken back out: it is a GENERATOR, not a checker. `audit_command_surface.ts`
writes `agents/reports/command-surface.json` and `.md` — both tracked —
unconditionally at the end of every run, and `--check-new` does not suppress
that. A scheduled run would mutate its tree to compute an answer it then
discards, since on the default branch `origin/main` and `HEAD` are the same
commit and `--check-new` has nothing to find.

It therefore stays in the local-only backlog with its class recorded, which is
what this page is for. Wiring it needs a `--check`-shaped mode it does not have
today, and a test pins that it must appear in neither job.

## The 24 reds, split three ways

### Owned elsewhere — 7, listed and left alone

| Gate | Owning file |
|---|---|
| `check_trigger_evals` | `later/road-to-trigger-eval-freshness-has-no-writer` |
| `lint_eval_freshness` | `road-to-corpus-refresh-cadence-shape` |
| `lint_rule_enforcement_declaration` | `later/road-to-rule-triggers-and-links-that-hold` |
| `check_gate_completeness` | `stubs/road-to-the-ledger-ratchet-that-drifted` |
| `check_rule_invariants` | `stubs/road-to-kernel-clause-1-restore` |
| `audit_user_type_axis` | `later/road-to-a-trunk-whose-own-gates-are-green-carried` |
| `lint_agents_layout` | `stubs/road-to-agents-layout-memory-quarantine` |

Each path was checked to exist in `agents/roadmaps/` at the base. None is
touched here.

### Build-dependent — 4, green once the generated tree exists

`check_artefact_checksums` · `lint_featured_skills` · `lint_trust_coherence` ·
`validate_discovery_manifest`

All four fail on a fresh checkout with *"manifest not found at
dist/discovery/discovery-manifest.json — run `task build-discovery`"*. That
path is gitignored (`/dist/*`), so no checkout carries it. **Re-run after
`task build-discovery`: all four exit 0.** They are not findings; they are a
missing build step, and wiring them needs that step in front of them rather
than a fix in the tree. Out of this change's batches for that reason.

`probe_projection_fidelity` is the fifth gate of this shape and the one the
roadmap predicted would behave this way — *"only because a fresh checkout has
no generated tool directories"*. **Corrected from reproduction:** it is still
red after `task build-discovery`, `task sync` **and** `task generate-tools`, at
16 failing rows naming `.augment`, `.claude`, `cursor_mdc` and `cline` paths it
cannot find. Its remaining dependency is the *installed* host layer, which a
runner has no equivalent of, so it is recorded as `machine`-scoped and left in
the backlog rather than counted as a fixable red.

### No live owner — 12

`check_public_links` · `generate_ownership_matrix` ·
`check_augment_description_cap` · `check_token_quality_golden` ·
`lint_subagent_determinism` · `generate_cookbook` ·
`generate_role_experiences_catalog` · `check_council_layout` ·
`lint_readme_jargon` · `lint_readme_serial_comma` · `check_knowledge_cards` ·
**`check_trigger_eval_presence`**

Eleven are the set the roadmap derived. The twelfth is a correction.

**`check_trigger_eval_presence` — decision D5 does not hold at this base.** The
roadmap dropped its step on the reading that it exits 0 on `d41121927`. At
`257e87de0` it exits 1:

```
❌ check-trigger-eval-presence: presence-ratchet violation(s):
   - form-handler: has evals/triggers.json but is still in the grandfather allowlist — remove the entry (shrink-only ratchet)
   - judge-security-auditor: has evals/triggers.json but is still in the grandfather allowlist — remove the entry (shrink-only ratchet)
```

This is the shrink-only-allowlist shape: two skills gained a trigger corpus and
their grandfather entries were not removed in the same change, so the ratchet
reds for everyone. The fix is to shrink the allowlist by those two entries,
which is what D5's own revisit condition — *"It turns red again"* — asks for.

## The checkout artefact, as its own row

The reading was taken in a git worktree created from `origin/main`, with
`node_modules` copied as a real directory rather than symlinked (a symlink
inflates the composed hook bundle and reds an unrelated gate). Before the
build-dependent gates were re-run, `task build-discovery`, `task sync` and
`task generate-tools` were run; none of the three left a tracked file modified.
The five tracked files the first pass had modified were restored with `git
checkout --` before the recorded run, and the recorded run left only
`internal/reports/complexity-report.md` modified, by `complexity_report`, which
is the finding that put that gate in the `machine` class.

## The reading

| # | Gate | Task | Command | Exit | Seconds | Class | First finding / verdict line |
|---:|---|---|---|---:|---:|---|---|
| 1 | `audit_command_surface` | `lint-command-budget` | `./scripts-run src/scripts/audit_command_surface --check-new --quiet` | 0 | 43.53 | `slow` | — |
| 2 | `audit_mcp_tools` | `lint-mcp-inventory` | `./scripts-run src/scripts/audit_mcp_tools --check --quiet` | 0 | 0.21 | `wire` | — |
| 3 | `audit_skill_overlap` | `audit-skill-overlap` | `./scripts-run src/scripts/audit_skill_overlap --quiet --print-table --strict` | 0 | 0.62 | `wire` | 0.733  test-driven-development ↔ testing-anti-patterns  [engineering-base] |
| 4 | `audit_user_type_axis` | `lint-user-type-axis` | `./scripts-run src/scripts/audit_user_type_axis --quiet` | 1 | 0.23 | `red` | ❌  audit_user_type_axis: baseline of 1 has not moved in 72 days (limit 56). A baseline that never drops is suppression with extra steps. Fix the findi |
| 5 | `bench_hook_injection` | `bench-hook-injection` | `./scripts-run src/scripts/bench_hook_injection` | 0 | 0.73 | `wire` | per-turn aggregate      922 B (ceiling 59392 B, reported, not gated) |
| 6 | `check_agent_artifact_location` | `check-agent-artifact-location` | `./scripts-run src/scripts/check_agent_artifact_location --quiet` | 0 | 0.36 | `wire` | scanned: 5039 |
| 7 | `check_artefact_checksums` | `check-artefact-checksums` | `./scripts-run src/scripts/check_artefact_checksums --quiet` | 1 | 0.23 | `red` | error: manifest not found at <repo>/.claude/worktrees/agent-aaee720cbf462dabe/dis |
| 8 | `check_artefact_count_messaging` | `check-artefact-counts` | `./scripts-run src/scripts/check_artefact_count_messaging --quiet` | 0 | 0.26 | `wire` | Canonical: skills=300 commands=205 rules=122 guidelines=121 personas=29 |
| 9 | `check_augment_description_cap` | `check-augment-description-cap` | `./scripts-run src/scripts/check_augment_description_cap` | 1 | 0.21 | `red` | Augment workspace-guidelines budget (cap: src/config/budgets.yml). Trim to ≤ 150. |
| 10 | `check_branch_freshness` | `preflight` | `./scripts-run src/scripts/check_branch_freshness --quiet` | 0 | 4.70 | `machine` | scanned: 1 |
| 11 | `check_branch_work_committed` | — | — | — | — | `machine` | no task command |
| 12 | `check_ci_strict_superset` | `check-ci-strict-superset` | `./scripts-run src/scripts/check_ci_strict_superset --quiet` | 0 | 0.20 | `wire` | ✅  ci-strict ⊇ ci by construction (delegates to 'ci', plus 4 strict-only entries). |
| 13 | `check_cluster_patterns` | `check-cluster-patterns` | `./scripts-run src/scripts/check_cluster_patterns` | 0 | 0.21 | `wire` | ✅  25 cluster dispatcher(s) match the Phase-1 reference pattern; 0 flag-cluster(s) verified present. |
| 14 | `check_command_count_messaging` | `check-command-count` | `./scripts-run src/scripts/check_command_count_messaging --quiet` | 0 | 0.21 | `wire` | Canonical counts: 205 files · 0 shims · 205 active |
| 15 | `check_context_paths` | `check-context-paths` | `./scripts-run src/scripts/check_context_paths` | 0 | 0.91 | `wire` | ✅  No context-path violations. |
| 16 | `check_council_config_location` | `check-council-config-location` | `./scripts-run src/scripts/check_council_config_location --quiet` | 0 | 0.22 | `wire` | — |
| 17 | `check_council_layout` | `check-council-layout` | `./scripts-run src/scripts/check_council_layout --quiet` | 1 | 0.23 | `red` | ❌  Council layout violations: |
| 18 | `check_council_references` | `check-council-references` | `./scripts-run src/scripts/check_council_references --quiet` | 0 | 0.31 | `wire` | — |
| 19 | `check_gate_completeness` | `check-gate-completeness` | `./scripts-run src/scripts/check_gate_completeness --quiet` | 1 | 0.24 | `red` | ❌  check_gate_completeness: 238 violation(s) against a baseline of 214 — 24 new. A ratchet only turns one way: fix the new violation(s). Raising the b |
| 20 | `check_gate_paths` | `check-gate-paths` | `./scripts-run src/scripts/check_gate_paths` | 0 | 0.44 | `wire` | ✅  check-gate-paths: 4 enforced target(s) across 4 gate(s) resolve under the source tree. |
| 21 | `check_generated_artefact_headers` | `check-generated-artefact-headers` | `./scripts-run src/scripts/check_generated_artefact_headers --quiet` | 0 | 0.21 | `wire` | — |
| 22 | `check_generator_output_coverage` | `check-generator-output-coverage` | `./scripts-run src/scripts/check_generator_output_coverage --quiet` | 0 | 0.20 | `wire` | — |
| 23 | `check_gitignore_freshness` | `check-gitignore-freshness` | `./scripts-run src/scripts/check_gitignore_freshness --quiet` | 0 | 0.20 | `wire` | not_applicable_kind ×2 — the target is a kind of artifact this check does not apply to |
| 24 | `check_hook_bundle_freshness` | `preflight` | `./scripts-run src/scripts/check_hook_bundle_freshness` | 0 | 0.21 | `machine` | ✅  OK  hook bundle: no self-hosted dist/hooks/dispatch.js — the installed package copy is in use, nothing to check |
| 25 | `check_installed_hooks_fresh` | — | — | — | — | `machine` | no task command |
| 26 | `check_knowledge_cards` | `check-knowledge-cards` | `./scripts-run src/scripts/check_knowledge_cards` | 1 | 0.25 | `red` | 3 violation(s) across 1 card(s). |
| 27 | `check_knowledge_pages` | `check-knowledge-pages` | `./scripts-run src/scripts/check_knowledge_pages` | 0 | 0.21 | `calendar` | check_knowledge_pages.ts: no warnings. |
| 28 | `check_module_management_neutral` | `check-module-management-neutral` | `./scripts-run src/scripts/check_module_management_neutral` | 0 | 0.20 | `wire` | ✅  src/skills/module-management/SKILL.md framework-neutral check: clean |
| 29 | `check_no_local_settings_committed` | `check-no-local-settings` | `./scripts-run src/scripts/check_no_local_settings_committed` | 0 | 0.22 | `wire` | ✅  No tracked .agent-settings.local.yml files. |
| 30 | `check_no_roadmap_refs` | `check-no-roadmap-refs` | `./scripts-run src/scripts/check_no_roadmap_refs` | 0 | 0.24 | `wire` | ✅  No roadmap-file references in stable artifacts. |
| 31 | `check_one_off_location` | `check-one-off-location` | `./scripts-run src/scripts/check_one_off_location --quiet --quiet` | 0 | 0.21 | `wire` | — |
| 32 | `check_originality_freshness` | `check-originality-freshness` | `./scripts-run src/scripts/check_originality_freshness --quiet` | 0 | 1.43 | `wire` | ✅  originality report is fresh. |
| 33 | `check_overlay_cascade_subdirs` | `check-overlay-cascade-subdirs` | `./scripts-run src/scripts/check_overlay_cascade_subdirs` | 0 | 0.24 | `wire` | ✅  agents/ overlay cascade in sync · 3 cascade-eligible, 1 user-global-eligible |
| 34 | `check_public_catalog_links` | `check-public-catalog-links` | `./scripts-run src/scripts/check_public_catalog_links --quiet` | 0 | 0.21 | `wire` | — |
| 35 | `check_public_links` | `check-public-links` | `./scripts-run src/scripts/check_public_links` | 1 | 0.22 | `red` | summary: 10 error(s), 21 warning(s) |
| 36 | `check_quality_regression` | `check-quality-regression` | `./scripts-run src/scripts/check_quality_regression` | 0 | 0.26 | `machine` | ⚠️  no quality-run report (internal/bench/reports/quality-run.json) — gate inert. Produce it with a thin-vs-eager judge run (operator/cost gate). |
| 37 | `check_reach_channels` | `check-reach-channels` | `./scripts-run src/scripts/check_reach_channels --quiet` | 0 | 0.25 | `wire` | — |
| 38 | `check_reach_staleness` | `check-reach-staleness` | `./scripts-run src/scripts/check_reach_staleness --quiet` | 0 | 0.25 | `calendar` | ⚠️  as-of: unpinned run — using the wall clock (2026-10-13T05:38:12.199Z); this verdict is not reproducible. Pass --as-of <iso> or set AC_AS_OF to pin |
| 39 | `check_release_trunk_sync` | `check-release-trunk-sync` | `./scripts-run src/scripts/check_release_trunk_sync` | 0 | 0.21 | `machine` | — |
| 40 | `check_reply_consistency` | `check-reply-consistency` | `./scripts-run src/scripts/check_reply_consistency --quiet --scan-dir .agent-src.uncondensed` | 0 | 0.26 | `wire` | — |
| 41 | `check_review_prompt_binding` | `ci-fast:review-prompt-binding` | `./scripts-run src/scripts/check_review_prompt_binding` | 0 | 0.28 | `machine` | prompt bindings: 193 package(s) · 191 binding · 0 steered (0 acknowledged) · 2 broken (2 baselined) |
| 42 | `check_roadmap_trackable` | `check-roadmap-trackable` | `./scripts-run src/scripts/check_roadmap_trackable --quiet` | 0 | 0.22 | `calendar` | — |
| 43 | `check_role_doc_links` | `check-role-doc-links` | `./scripts-run src/scripts/check_role_doc_links --quiet` | 0 | 0.21 | `wire` | — |
| 44 | `check_rule_invariants` | `check-rule-invariants` | `./scripts-run src/scripts/check_rule_invariants` | 1 | 0.21 | `red` | A kernel rule lost a load-bearing clause — likely a merge or condensation dropped it silently (see the #840/#844 incident in this file header). Restor |
| 45 | `check_score_contract` | `check-score-contract` | `./scripts-run src/scripts/check_score_contract --quiet` | 0 | 0.24 | `wire` | scanned: 23 |
| 46 | `check_skill_requires` | `check-skill-requires` | `./scripts-run src/scripts/check_skill_requires` | 0 | 0.27 | `wire` | ✅  check_skill_requires: 9 composition edge(s) across 5 skill(s) — all sub-skills co-available. |
| 47 | `check_source_pointer_freshness` | `check-source-pointer-freshness` | `./scripts-run src/scripts/check_source_pointer_freshness` | 0 | 0.22 | `wire` | ✅  No retired source-of-truth pointers in authoring files. |
| 48 | `check_static_layer_stability` | `check-static-layer-stability` | `./scripts-run src/scripts/check_static_layer_stability` | 0 | 0.23 | `wire` | ✅  check_static_layer_stability: 112 non-kernel always-loaded file(s) clean |
| 49 | `check_structural_breaking` | `check-structural-breaking` | `./scripts-run src/scripts/check_structural_breaking --quiet` | 0 | 0.26 | `wire` | — |
| 50 | `check_suppression_hygiene` | `check-suppression-hygiene` | `./scripts-run src/scripts/check_suppression_hygiene --quiet` | 0 | 0.81 | `wire` | scanned: 14 |
| 51 | `check_surface_tiers` | `check-surface-tiers` | `./scripts-run src/scripts/check_surface_tiers` | 0 | 0.24 | `wire` | ✅ surface-tiers: 23 clusters classified, no unguarded core→lab imports. |
| 52 | `check_test_coverage_diff` | `check-test-coverage-diff` | `./scripts-run src/scripts/check_test_coverage_diff` | 0 | 0.24 | `wire` | coverage-diff: warned=0 suppressed=0 |
| 53 | `check_token_optimizer_freshness` | `check-token-optimizer-freshness` | `./scripts-run src/scripts/check_token_optimizer_freshness` | 0 | 0.21 | `wire` | token-optimizer freshness: 8 catalog rows, 6 internal targets checked, 0 drift signal(s) |
| 54 | `check_token_quality_golden` | `check-token-quality-golden` | `./scripts-run src/scripts/check_token_quality_golden` | 2 | 0.23 | `red` | ❌  golden set has structural errors (see above). |
| 55 | `check_tracked_but_ignored` | `check-tracked-but-ignored` | `./scripts-run src/scripts/check_tracked_but_ignored --quiet` | 0 | 0.29 | `wire` | — |
| 56 | `check_trigger_eval_presence` | `check-trigger-eval-presence` | `./scripts-run src/scripts/check_trigger_eval_presence --quiet` | 1 | 0.21 | `red` | ❌ check-trigger-eval-presence: presence-ratchet violation(s): |
| 57 | `check_trigger_evals` | `check-trigger-evals` | `./scripts-run src/scripts/check_trigger_evals --quiet` | 1 | 0.22 | `red` | - src/skills/worktree-lifecycle/evals/triggers.json: 'last_eval' 2026-07-10 is 95d old (> 90d) — re-run skill_trigger_eval and bump it |
| 58 | `compile_router` | `check-router` | `./scripts-run src/scripts/compile_router --check` | 0 | 0.27 | `wire` | ✅  router.json is up to date |
| 59 | `complexity_report` | `complexity-report` | `./scripts-run src/scripts/complexity_report` | 0 | 0.33 | `machine` | complexity_report: wrote internal/reports/complexity-report.md |
| 60 | `domain_soundness_status` | `check-domain-soundness` | `./scripts-run src/scripts/domain_soundness_status --check` | 0 | 0.23 | `calendar` | ✅  domain-soundness ratchet: validated 9/20 (floor 9). |
| 61 | `generate_capabilities_index` | `generate-capabilities-index-check` | `./scripts-run src/scripts/generate_capabilities_index --check` | 0 | 0.24 | `wire` | ✅  CAPABILITIES.yaml up to date (21 KB, 34ms). |
| 62 | `generate_capability_matrix` | `generate-capability-matrix-check` | `./scripts-run src/scripts/generate_capability_matrix --check` | 0 | 0.19 | `wire` | generate_capability_matrix: OK — docs/capability-matrix.md up to date |
| 63 | `generate_command_flows` | `generate-command-flows-check` | `./scripts-run src/scripts/generate_command_flows --check` | 0 | 0.28 | `wire` | generate_command_flows: OK — docs/command-flows.md up to date |
| 64 | `generate_cookbook` | `generate-cookbook-check` | `./scripts-run src/scripts/generate_cookbook --check` | 1 | 0.22 | `red` | generate_cookbook: docs/cookbook.md is stale — run './scripts-run src/scripts/generate_cookbook' |
| 65 | `generate_ownership_matrix` | `check-ownership-matrix` | `./scripts-run src/scripts/generate_ownership_matrix --check` | 1 | 0.29 | `red` | ❌  ownership matrix is stale — run 'task generate-ownership-matrix' and commit |
| 66 | `generate_role_experiences_catalog` | `generate-role-experiences-catalog-check` | `./scripts-run src/scripts/generate_role_experiences_catalog --check` | 1 | 0.19 | `red` | generate_role_experiences_catalog: docs/role-experiences.md is stale — run './scripts-run src/scripts/generate_role_experiences_catalog' |
| 67 | `generate_settings_reference` | `check-settings-reference` | `./scripts-run src/scripts/generate_settings_reference --check` | 0 | 0.21 | `wire` | ✅  docs/settings-reference.md is up to date. |
| 68 | `lint_abstraction_thresholds` | `lint-abstraction-thresholds` | `./scripts-run src/scripts/lint_abstraction_thresholds --quiet` | 0 | 0.25 | `wire` | scanned: 611 |
| 69 | `lint_agent_skill_names` | `lint-skill-names` | `./scripts-run src/scripts/lint_agent_skill_names --quiet` | 0 | 0.23 | `wire` | — |
| 70 | `lint_agents_layout` | `lint-agents-layout` | `./scripts-run src/scripts/lint_agents_layout --quiet` | 1 | 0.21 | `red` | ❌  agents/ layout violations (unknown flat files): |
| 71 | `lint_archived_skills` | `lint-archived-skills` | `./scripts-run src/scripts/lint_archived_skills --quiet` | 0 | 0.26 | `wire` | — |
| 72 | `lint_artefact_frontmatter` | `lint-artefact-frontmatter` | `./scripts-run src/scripts/lint_artefact_frontmatter --quiet` | 0 | 0.27 | `calendar` | scanned: 655 |
| 73 | `lint_behavioural_eval_freshness` | `lint-behavioural-eval-freshness` | `./scripts-run src/scripts/lint_behavioural_eval_freshness --quiet` | 0 | 0.21 | `wire` | — |
| 74 | `lint_bench_ab` | `lint-bench-ab` | `./scripts-run src/scripts/lint_bench_ab --quiet` | 0 | 0.24 | `wire` | — |
| 75 | `lint_bench_corpus` | `lint-bench` | `./scripts-run src/scripts/lint_bench_corpus --quiet` | 0 | 0.27 | `wire` | — |
| 76 | `lint_breaking_changes_index` | `lint-breaking-changes-index` | `./scripts-run src/scripts/lint_breaking_changes_index --quiet` | 0 | 0.27 | `wire` | — |
| 77 | `lint_changelog_rollback` | `lint-changelog-rollback` | `./scripts-run src/scripts/lint_changelog_rollback` | 0 | 0.21 | `wire` | ✅  CHANGELOG Rollback: gate clean (cutoff 16.5.0, CHANGELOG.md). |
| 78 | `lint_command_flow_coverage` | `lint-command-flow-coverage` | `./scripts-run src/scripts/lint_command_flow_coverage --quiet` | 0 | 0.24 | `wire` | — |
| 79 | `lint_command_routing` | `lint-command-routing` | `./scripts-run src/scripts/lint_command_routing --quiet` | 0 | 0.28 | `wire` | — |
| 80 | `lint_command_verbs` | `lint-command-verbs` | `./scripts-run src/scripts/lint_command_verbs --quiet` | 0 | 0.38 | `wire` | — |
| 81 | `lint_context_spine_usage` | `lint-context-spine-usage` | `./scripts-run src/scripts/lint_context_spine_usage --quiet` | 0 | 0.23 | `wire` | — |
| 82 | `lint_discovery_vocabulary` | `lint-discovery-vocab` | `./scripts-run src/scripts/lint_discovery_vocabulary --quiet` | 0 | 0.24 | `wire` | — |
| 83 | `lint_documented_commands` | `lint-documented-commands` | `./scripts-run src/scripts/lint_documented_commands` | 0 | 0.30 | `wire` | ✅  Every documented package command resolves. |
| 84 | `lint_empty_roadmaps` | `lint-empty-roadmaps` | `./scripts-run src/scripts/lint_empty_roadmaps --quiet` | 0 | 0.30 | `wire` | — |
| 85 | `lint_eval_fixture_citations` | `lint-eval-fixture-citations` | `./scripts-run src/scripts/lint_eval_fixture_citations --quiet` | 0 | 0.40 | `wire` | — |
| 86 | `lint_eval_freshness` | `lint-eval-freshness` | `./scripts-run src/scripts/lint_eval_freshness --quiet` | 1 | 0.22 | `red` | - threat-modeling: ships evals/triggers.json + a SHA-pinned manifest but has no 'upstream.last_eval' — run the live eval and 'agent-config eval:record |
| 87 | `lint_examples` | `check-examples-shape` | `./scripts-run src/scripts/lint_examples --quiet` | 0 | 0.22 | `wire` | — |
| 88 | `lint_featured_skills` | `lint-featured-skills` | `./scripts-run src/scripts/lint_featured_skills --quiet` | 1 | 0.23 | `red` | error: manifest not found at dist/discovery/discovery-manifest.json |
| 89 | `lint_flows` | `lint-flows` | `./scripts-run src/scripts/lint_flows --quiet` | 0 | 0.32 | `wire` | — |
| 90 | `lint_framework_leakage` | `lint-framework-leakage` | `./scripts-run src/scripts/lint_framework_leakage --quiet` | 0 | 0.46 | `wire` | scanned: 414 |
| 91 | `lint_frontmatter_boilerplate` | `lint-frontmatter-boilerplate` | `./scripts-run src/scripts/lint_frontmatter_boilerplate --quiet` | 0 | 0.29 | `wire` | — |
| 92 | `lint_ghostwriter_source` | `lint-ghostwriter-source` | `./scripts-run src/scripts/lint_ghostwriter_source --quiet` | 0 | 0.24 | `wire` | — |
| 93 | `lint_glama_drift` | `mcp:glama-drift-check` | `./scripts-run src/scripts/lint_glama_drift` | 0 | 0.20 | `wire` | ✅  internal/glama/README.md matches build/run scripts — no drift. |
| 94 | `lint_handoffs` | `lint-handoffs` | `./scripts-run src/scripts/lint_handoffs --quiet` | 0 | 0.27 | `calendar` | ⚠️   lint_handoffs: 18 violation(s) at baseline, age 15d — known debt, not new breakage. All 18 are 'handoff_tier_mismatch': a senior-tier skill links |
| 95 | `lint_harvest_provenance` | `lint-harvest-provenance` | `./scripts-run src/scripts/lint_harvest_provenance --quiet` | 0 | 0.26 | `wire` | lint_harvest_provenance ledger: scanned=20 planned=20 skipped=0 |
| 96 | `lint_hook_concern_budget` | `lint-hook-concern-budget` | `./scripts-run src/scripts/lint_hook_concern_budget` | 0 | 0.23 | `wire` | error: concerns.block-no-verify: fail_closed=true but not declared in hooks.concern_budget.tier1_concerns. Promotion to Tier-1 is explicit opt-in (Pha |
| 97 | `lint_hook_manifest` | `lint-hook-manifest` | `./scripts-run src/scripts/lint_hook_manifest` | 0 | 0.24 | `calendar` | warn: host_lowering copilot/any: 'verified.host_version' is null — the row is admissible but not fully cited. |
| 98 | `lint_knowledge_scale` | `lint-knowledge-scale` | `./scripts-run src/scripts/lint_knowledge_scale --quiet` | 0 | 0.21 | `wire` | — |
| 99 | `lint_load_context` | `lint-load-context` | `./scripts-run src/scripts/lint_load_context --quiet` | 0 | 0.25 | `wire` | scanned: 274 |
| 100 | `lint_marketplace_install_completeness` | `lint-marketplace-install` | `./scripts-run src/scripts/lint_marketplace_install_completeness` | 0 | 0.20 | `wire` | ✅  lint-marketplace-install: 10 hook command(s) checked, all resolve to known dispatcher subcommands. |
| 101 | `lint_metric_consumers` | `lint-metric-consumers` | `./scripts-run src/scripts/lint_metric_consumers --quiet` | 0 | 0.20 | `wire` | lint_metric_consumers ledger: scanned=13 planned=13 skipped=0 |
| 102 | `lint_missions` | `lint-missions` | `./scripts-run src/scripts/lint_missions --quiet` | 0 | 0.20 | `wire` | — |
| 103 | `lint_model_tier_coverage` | `lint-model-tier-coverage` | `./scripts-run src/scripts/lint_model_tier_coverage --quiet` | 0 | 0.25 | `wire` | — |
| 104 | `lint_motion_authority_drift` | `lint-motion-authority-drift` | `./scripts-run src/scripts/lint_motion_authority_drift --quiet` | 0 | 0.19 | `wire` | scanned: 128 |
| 105 | `lint_namespace` | `lint-namespace` | `./scripts-run src/scripts/lint_namespace --quiet` | 0 | 0.23 | `wire` | scanned: 656 |
| 106 | `lint_namespace_collisions` | `lint-namespace-collisions` | `./scripts-run src/scripts/lint_namespace_collisions` | 0 | 0.27 | `wire` | ✅  627 skill/rule/command names unique within each namespace (normalized). |
| 107 | `lint_new_skill_gate` | `lint-new-skill-gate` | `./scripts-run src/scripts/lint_new_skill_gate --quiet` | 0 | 0.40 | `wire` | — |
| 108 | `lint_no_activation_gates` | `lint-no-activation-gates` | `./scripts-run src/scripts/lint_no_activation_gates --quiet` | 0 | 0.22 | `wire` | not_applicable_kind ×112 — the target is a kind of artifact this check does not apply to |
| 109 | `lint_no_new_atomic_commands` | `lint-no-new-atomic-commands` | `./scripts-run src/scripts/lint_no_new_atomic_commands` | 0 | 0.24 | `wire` | ✅  No new commands added under src/domains (baseline: main). |
| 110 | `lint_no_python_twin_rationale` | `lint-no-python-twin-rationale` | `./scripts-run src/scripts/lint_no_python_twin_rationale --quiet` | 0 | 0.29 | `wire` | — |
| 111 | `lint_one_off_age` | `lint-one-off-age` | `./scripts-run src/scripts/lint_one_off_age` | 0 | 0.20 | `calendar` | ✅  No one-off-script age violations. |
| 112 | `lint_orchestrator_auto_detect` | `lint-orchestrator-auto-detect` | `./scripts-run src/scripts/lint_orchestrator_auto_detect --quiet` | 0 | 0.21 | `wire` | — |
| 113 | `lint_pack_dependencies` | `lint-pack-dependencies` | `./scripts-run src/scripts/lint_pack_dependencies` | 0 | 2.44 | `wire` | ✅  pack dependencies in sync; pack-graph is acyclic (29 pack home(s) scanned). |
| 114 | `lint_pack_first_win` | `lint-pack-first-win` | `./scripts-run src/scripts/lint_pack_first_win --quiet` | 0 | 0.20 | `wire` | ✅ pack first-win lint OK — 5 featured packs |
| 115 | `lint_pack_risk_class` | `lint-pack-risk-class` | `./scripts-run src/scripts/lint_pack_risk_class --quiet` | 0 | 0.20 | `wire` | — |
| 116 | `lint_profile_overlay_set_only` | `lint-profile-overlay-set-only` | `./scripts-run src/scripts/lint_profile_overlay_set_only --quiet` | 0 | 0.23 | `wire` | — |
| 117 | `lint_profile_personas` | `lint-profile-personas` | `./scripts-run src/scripts/lint_profile_personas --quiet` | 0 | 0.22 | `wire` | scanned: 6 |
| 118 | `lint_provenance` | `lint-provenance` | `./scripts-run src/scripts/lint_provenance --quiet` | 0 | 0.21 | `wire` | — |
| 119 | `lint_provenance_vocabulary` | `lint-provenance-vocabulary` | `./scripts-run src/scripts/lint_provenance_vocabulary --quiet` | 0 | 0.58 | `calendar` | — |
| 120 | `lint_readme_jargon` | `lint-readme-jargon` | `./scripts-run src/scripts/lint_readme_jargon --quiet` | 1 | 0.20 | `red` | FAIL  README.md: 8 jargon hits above the fold (lines 1..120, limit 3). |
| 121 | `lint_readme_serial_comma` | `lint-readme-serial-comma` | `./scripts-run src/scripts/lint_readme_serial_comma --quiet` | 1 | 0.20 | `red` | FAIL  README.md: 16 serial-comma violation(s) in prose (house style: no comma before a final "and" / "or"). |
| 122 | `lint_roadmap_blockers` | `lint-roadmap-blockers` | `./scripts-run src/scripts/lint_roadmap_blockers --quiet` | 0 | 0.28 | `calendar` | — |
| 123 | `lint_roadmap_complexity` | `lint-roadmap-complexity` | `./scripts-run src/scripts/lint_roadmap_complexity --quiet` | 0 | 0.24 | `wire` | excluded_directory ×1041 — the target sits under a directory this gate deliberately does not walk |
| 124 | `lint_roadmap_family_cap` | `lint-roadmap-family-cap` | `./scripts-run src/scripts/lint_roadmap_family_cap --quiet` | 0 | 0.18 | `wire` | — |
| 125 | `lint_roadmap_later_disposition` | `lint-roadmap-later-disposition` | `./scripts-run src/scripts/lint_roadmap_later_disposition` | 0 | 0.22 | `calendar` | ✅  lint_roadmap_later_disposition:wake-condition: 17 violation(s) at baseline, age 4d — known debt, not new breakage. Parked roadmaps carrying no … |
| 126 | `lint_role_experiences` | `lint-role-experiences` | `./scripts-run src/scripts/lint_role_experiences --plain-language` | 0 | 0.25 | `wire` | ✅ lint_role_experiences: all role experiences pass (300 known skill(s) indexed) |
| 127 | `lint_rule_enforcement_declaration` | `lint-rule-enforcement-declaration` | `./scripts-run src/scripts/lint_rule_enforcement_declaration --quiet` | 1 | 0.24 | `red` | ❌  src/rules/neighbour-precedence.md  declares a model-carried gap in frontmatter but never states it in its body — the honesty convention is one pros |
| 128 | `lint_rule_interactions` | `lint-rule-interactions` | `./scripts-run src/scripts/lint_rule_interactions --quiet` | 0 | 0.23 | `wire` | — |
| 129 | `lint_rule_skill_pack_reach` | `lint-rule-skill-pack-reach` | `./scripts-run src/scripts/lint_rule_skill_pack_reach --quiet` | 0 | 0.28 | `wire` | advisory run: 11 unreachable-route finding(s) reported, exit 0. Promote with --strict once the set is empty. |
| 130 | `lint_showcase_sessions` | `lint-showcase-sessions` | `./scripts-run src/scripts/lint_showcase_sessions` | 0 | 0.20 | `wire` | ✅  lint_showcase_sessions: 0 sessions referenced, 0 on disk (Phase 1.3-1.5 deferred to manual host-agent runs) |
| 131 | `lint_skill_descriptions` | `lint-skill-descriptions` | `./scripts-run src/scripts/lint_skill_descriptions --quiet` | 0 | 0.41 | `wire` | — |
| 132 | `lint_skill_originality` | `lint-skill-originality` | `./scripts-run src/scripts/lint_skill_originality --quiet` | 0 | 0.28 | `wire` | — |
| 133 | `lint_skill_router_head` | `lint-skill-router-head` | `./scripts-run src/scripts/lint_skill_router_head --quiet` | 0 | 0.22 | `wire` | lint_skill_router_head ledger: scanned=300 planned=300 skipped=0 |
| 134 | `lint_skill_scripts_readonly` | `lint-skill-scripts-readonly` | `./scripts-run src/scripts/lint_skill_scripts_readonly --quiet` | 0 | 0.21 | `wire` | — |
| 135 | `lint_skill_tools` | `lint-skill-tools` | `./scripts-run src/scripts/lint_skill_tools --quiet` | 0 | 0.21 | `wire` | — |
| 136 | `lint_spawn_payload` | `lint-spawn-payload` | `./scripts-run src/scripts/lint_spawn_payload` | 0 | 0.21 | `wire` | ✅  lint_spawn_payload: clean — no spawn-payload contract violations found. |
| 137 | `lint_store_boundary` | `lint-store-boundary` | `./scripts-run src/scripts/lint_store_boundary` | 0 | 0.20 | `wire` | ✅  store boundary clean — no global-root literal in index code. |
| 138 | `lint_subagent_determinism` | `lint-subagent-determinism` | `./scripts-run src/scripts/lint_subagent_determinism --quiet` | 1 | 0.23 | `red` | - src/subagents/_prompt-defense.md: no parseable frontmatter |
| 139 | `lint_surface_matrix` | `lint-surface-matrix` | `./scripts-run src/scripts/lint_surface_matrix` | 0 | 0.27 | `wire` | No issues found. |
| 140 | `lint_symptom_intake` | `lint-symptom-intake` | `./scripts-run src/scripts/lint_symptom_intake --quiet` | 0 | 0.18 | `calendar` | not_applicable_kind ×2 — the target is a kind of artifact this check does not apply to |
| 141 | `lint_ticket_buildable` | `lint-tickets` | `./scripts-run src/scripts/lint_ticket_buildable` | 0 | 0.22 | `wire` | ✅ ticket bundles build-ready (6 ticket(s), 1 warning(s)) |
| 142 | `lint_token_budget_discipline` | `lint-token-budget-discipline` | `./scripts-run src/scripts/lint_token_budget_discipline --quiet` | 0 | 0.32 | `wire` | scanned: 300 |
| 143 | `lint_trigger_precision` | `lint-trigger-precision` | `./scripts-run src/scripts/lint_trigger_precision --quiet` | 0 | 0.20 | `wire` | ✅  trigger precision: 22 short (≤3 char) keyword triggers / budget 22 |
| 144 | `lint_trust_coherence` | `lint-trust-coherence` | `./scripts-run src/scripts/lint_trust_coherence --quiet` | 1 | 0.20 | `red` | Run 'task build-discovery' first. |
| 145 | `lint_ui_stack_bundles` | `lint-ui-stack-bundles` | `./scripts-run src/scripts/lint_ui_stack_bundles --quiet` | 0 | 0.21 | `wire` | — |
| 146 | `lint_versioned_cache` | `lint-versioned-cache` | `./scripts-run src/scripts/lint_versioned_cache --quiet` | 0 | 0.30 | `wire` | — |
| 147 | `measure_augment_budget` | `check-augment-budget-strict` | `./scripts-run src/scripts/measure_augment_budget --check` | 0 | 0.18 | `wire` | ✅  OK — utilisation 4.6% |
| 148 | `memory_replay` | `check-memory-replay` | `./scripts-run src/scripts/memory_replay --check` | 0 | 0.48 | `wire` | ✅  memory_replay --check: index payload within baseline (+5%). |
| 149 | `probe_projection_fidelity` | `lint-projection-fidelity` | `./scripts-run src/scripts/probe_projection_fidelity` | 1 | 0.20 | `red` | fail    command:commit                           windsurf_workflows file not found |
| 150 | `rebuild_hook_bundle` | `preflight` | `./scripts-run src/scripts/rebuild_hook_bundle` | 0 | 0.22 | `wire` | ✅  OK  rebuild_hook_bundle: no self-hosted dist/hooks/dispatch.js — nothing runs stale code, nothing to heal |
| 151 | `report_imperative_density` | `report-imperative-density` | `./scripts-run src/scripts/report_imperative_density` | 0 | 0.23 | `wire` | files: 490 |
| 152 | `runtime_dispatcher` | `runtime-e2e` | `./scripts-run src/scripts/runtime_dispatcher run --skill check-refs` | 0 | 0.70 | `wire` | ✅  check-refs · shell · exit=0 (467ms) |
| 153 | `second_brain_retrieval` | `check-second-brain-retrieval` | `./scripts-run src/scripts/second_brain_retrieval --dry-run` | 0 | 0.27 | `wire` | dry-run: precision@5=100% (9/9) · mean-tie-set=4.1 · on=27/27 off=0/27 placebo=0/27 · PASS · calls=0 |
| 154 | `second_brain_score` | `check-second-brain-scorer` | `./scripts-run src/scripts/second_brain_score --dry-run` | 0 | 0.22 | `wire` | ✅  second_brain_score --dry-run: 9 good→pass, 3 bad→fail (deterministic, no spend). |
| 155 | `skill_eval_coverage` | `check-eval-coverage` | `./scripts-run src/scripts/skill_eval_coverage --check` | 0 | 0.30 | `calendar` | ✅  priority-tier eval floor: every rich/default-surface/router skill covered or exempted-with-reason. |
| 156 | `smoke_quickstart` | `smoke-quickstart` | `./scripts-run src/scripts/smoke_quickstart` | 0 | 0.35 | `wire` | ✅  smoke-quickstart: install → settings → decision_engine green |
| 157 | `sync_pr_branch` | `dev:sync-pr-branch` | `./scripts-run src/scripts/sync_pr_branch` | 0 | 6.86 | `machine` | scanned: 1 |
| 158 | `validate_agent_settings` | `validate-agent-settings` | `./scripts-run src/scripts/validate_agent_settings` | 0 | 0.22 | `wire` | agent-settings schema: OK (1 file(s) validated) |
| 159 | `validate_decision_engine` | `validate-decision-engine` | `./scripts-run src/scripts/validate_decision_engine` | 0 | 0.23 | `wire` | — |
| 160 | `validate_discovery_manifest` | `validate-discovery-manifest` | `./scripts-run src/scripts/validate_discovery_manifest --quiet` | 1 | 0.20 | `red` | error: committed manifest not found at dist/discovery/discovery-manifest.json — run 'task build-discovery' and commit the output. |
| 161 | `validate_flow_teams` | `validate-flow-teams` | `./scripts-run src/scripts/validate_flow_teams --quiet` | 0 | 0.27 | `wire` | — |
| 162 | `validate_pack_yaml` | `validate-pack-yaml` | `./scripts-run src/scripts/validate_pack_yaml` | 0 | 0.26 | `wire` | ✅  29 pack.yaml manifest(s) valid (schema + references resolve). |
| 163 | `validate_reach_prescriptions` | `check-reach-prescriptions` | `./scripts-run src/scripts/validate_reach_prescriptions --quiet` | 0 | 0.28 | `wire` | — |
| 164 | `check_artefact_checksums` | `check-artefact-checksums` | `./scripts-run src/scripts/check_artefact_checksums --quiet` | 0 | 0.27 | `machine` | — |
| 165 | `lint_featured_skills` | `lint-featured-skills` | `./scripts-run src/scripts/lint_featured_skills --quiet` | 0 | 0.19 | `machine` | — |
| 166 | `lint_motion_authority_drift` | `lint-motion-authority-drift` | `./scripts-run src/scripts/lint_motion_authority_drift --quiet` | 0 | 0.17 | `wire` | — |
| 167 | `lint_trust_coherence` | `lint-trust-coherence` | `./scripts-run src/scripts/lint_trust_coherence --quiet` | 0 | 0.19 | `machine` | — |
| 168 | `validate_discovery_manifest` | `validate-discovery-manifest` | `./scripts-run src/scripts/validate_discovery_manifest --quiet` | 0 | 0.44 | `machine` | — |

## 2026-10-14 — the six remaining unowned reds, fixed and wired (step 3.2)

Read on branch `drain/local-gates-and-never-ran`, off `origin/main` at
`7b236a00f` with `main` merged twice since. Each row was red at that base with
the command shown, was fixed in its own commit, exited 0 afterwards with the
same command, and became a step of `Standing payload delta + budget gate`
behind the `The local-only drain — batch 2` marker. Batch 1's twenty are
unchanged and still bounded by the batch-1 case.

| Gate | Red at the base | Fix | Where the fix sits |
|---|---|---|---|
| `lint_readme_serial_comma` | 17 hits | each comma before a final "and" / "or" dropped, or the clause rejoined with a semicolon | the tree (`README.md`) |
| `lint_readme_jargon` | 8 hits above the fold, limit 3 | two ADR link texts become what they name; "gate" and "drift" become plain words; one "projection" stays because `update_counts` reads that phrase | the tree (`README.md`); now 3 of 3 |
| `check_augment_description_cap` | 5 auto-rule descriptions at 161-187 chars | each shortened at its source in `src/rules/`; projection, pack passports, `agents/index.md`, `docs/catalog.md` regenerated | the tree |
| `check_token_quality_golden` | 6 structural errors, exit 2 | four were the checker reading a routed rule with `triggers: []` as never firing; two were corpus entries (a tag on the merged `brand-consistency` stub, a prompt exercising none of its rule's triggers) | the checker and the corpus |
| `check_public_links` | 10 contracts with no `stability:` frontmatter | each declares `experimental`, the level that promises nothing; none is linked from a surface an experimental contract may not be | the tree (`docs/contracts/`) |
| `check_council_layout` | 11 `council-*` files under `agents/evidence/` | a narrow allowlist of three tracked evidence homes (council 2026-10-14, 2/2); the seven analyses moved into `agents/evidence/council/` with their names | the checker and the tree |

**What did not move.** The parity baseline stays at 130 although the branch
reads 124 locally. The entry's own record says why: it moves on the enforcing
environment's reading, and a local one was once wrong by exactly one. The
lowering is a one-line change on the first CI reading of this branch.

## 2026-10-14 — step 2.2, first batch (2.2a)

Read on branch `drain/local-gates-batch-2`, off `origin/main` at `144c0b20b`.
At that base `check_ci_local_parity --format json` lists **124** undeclared
local-only gates: **105** classed `wire` above with no workflow caller yet, and
19 in the other classes or red. 105 is more than five times the twenty a change
the 2026-10-13 council bounded, so step 2.2 is split into numbered batches in the
roadmap and this page records the first.

**Selection rule, so the next batch reproduces it:** the 105 in name order,
twenty at a time, skipping a gate only for a reason written here. Four inside
this batch's window were skipped:

| Gate | Why it is not in 2.2a |
|---|---|
| `check_hook_bundle_freshness` | `machine`-shaped: its verdict depends on whether a self-hosted `dist/hooks/dispatch.js` was built, which a checkout and CI answer differently |
| `check_quality_regression` | inert until an operator-run `internal/bench/reports/quality-run.json` exists; wiring it arms a gate that can red unrelated pull requests the day that file lands |
| `check_release_trunk_sync` | reads branch state |
| `check_reply_consistency` | its task's `--scan-dir .agent-src.uncondensed` names a directory the tree does not contain, so its exit 0 is vacuous; wiring it needs its argument decided first |

The twenty, each run with the argv its workflow step uses, on the branch base,
serially. `git status --short` was empty afterwards, so none of them writes a
tracked file (the risk register's rank-5 check). Serial sum 4.3 s.

| Gate | Argv | Exit | Seconds |
|---|---|---|---|
| `audit_mcp_tools` | `--check --quiet` | 0 | 0.19 |
| `check_agent_artifact_location` | `--quiet` | 0 | 0.36 |
| `check_artefact_count_messaging` | `--quiet` | 0 | 0.25 |
| `check_ci_strict_superset` | `--quiet` | 0 | 0.18 |
| `check_cluster_patterns` | — | 0 | 0.21 |
| `check_command_count_messaging` | `--quiet` | 0 | 0.21 |
| `check_council_config_location` | `--quiet` | 0 | 0.20 |
| `check_council_references` | `--quiet` | 0 | 0.29 |
| `check_generated_artefact_headers` | `--quiet` | 0 | 0.19 |
| `check_generator_output_coverage` | `--quiet` | 0 | 0.19 |
| `check_gitignore_freshness` | `--quiet` | 0 | 0.20 |
| `check_module_management_neutral` | — | 0 | 0.19 |
| `check_no_local_settings_committed` | — | 0 | 0.20 |
| `check_no_roadmap_refs` | — | 0 | 0.23 |
| `check_one_off_location` | `--quiet` | 0 | 0.19 |
| `check_overlay_cascade_subdirs` | — | 0 | 0.19 |
| `check_public_catalog_links` | `--quiet` | 0 | 0.20 |
| `check_reach_channels` | `--quiet` | 0 | 0.21 |
| `check_role_doc_links` | `--quiet` | 0 | 0.19 |
| `check_score_contract` | `--quiet` | 0 | 0.25 |

Two reads inside the twenty were checked rather than assumed. `audit_mcp_tools`
rewrites its inventory without `--check`, so the step passes `--check`, and a
test pins it. `check_score_contract` asks `git merge-base --is-ancestor` about
evidence SHAs, which a shallow clone would answer wrongly; the host job checks
out with `fetch-depth: 0`.

**Still a local reading.** `check_ci_local_parity` reads **104** on this branch,
124 - 20. The baseline stays at 124 in this change, for the reason the entry
records twice: it moves on the enforcing environment's reading. The host job's
duration with the batch is likewise not recorded until CI has run it.

**Left for 2.2b onward: 85 gates**, the 81 after this window in name order plus
the four skipped above if their reasons are resolved. Four of the 81 are
writer-shaped by name or by their first output line and need the `git status`
check before anything else — `rebuild_hook_bundle`, `report_imperative_density`,
and the two `second_brain_*` gates run `--dry-run`.

## 2026-10-15 — step 2.2, second batch (2.2b), and a re-reading of what is left

Read on branch `drain/local-gates-wired-20261015`, off `origin/main` at
`a10aa16a1`, in a fresh worktree after `npm ci`. At that base
`check_ci_local_parity --format json` lists **104** undeclared local-only gates,
the number the 2.2a closure recorded: **85** of them classed `wire` above (the
81 after 2.2a's window plus the four it skipped) and 19 in the other classes or
red.

**All 85 were re-run before choosing the batch**, serially, with the argv in the
table above, and `git status --short` checked after each. 84 exit 0 and none
leaves the tree dirty. One is red: `lint_marketplace_install_completeness` exits
1 with `10 issue(s) in hooks/hooks.json`. It was green at the 2026-10-13 reading;
it is outside 2.2b's window, and the batch that reaches it skips it and records
it here, as step 2.2 says of any gate found red at wiring time.

**The twenty**, being the next twenty in name order after 2.2a's window. None in
this window was skipped. Serial sum 8.9 s, of which 1.3 s is
`generate_capabilities_index --check`.

| Gate | Argv | Exit | Seconds |
|---|---|---|---|
| `check_skill_requires` | — | 0 | 0.29 |
| `check_source_pointer_freshness` | — | 0 | 0.27 |
| `check_static_layer_stability` | — | 0 | 0.29 |
| `check_structural_breaking` | `--quiet` | 0 | 0.42 |
| `check_surface_tiers` | — | 0 | 0.43 |
| `check_test_coverage_diff` | — | 0 | 0.37 |
| `check_token_optimizer_freshness` | — | 0 | 0.34 |
| `check_tracked_but_ignored` | `--quiet` | 0 | 0.41 |
| `generate_capabilities_index` | `--check` | 0 | 1.33 |
| `generate_capability_matrix` | `--check` | 0 | 0.58 |
| `generate_command_flows` | `--check` | 0 | 0.47 |
| `generate_settings_reference` | `--check` | 0 | 0.79 |
| `lint_abstraction_thresholds` | `--quiet` | 0 | 0.36 |
| `lint_agent_skill_names` | `--quiet` | 0 | 0.38 |
| `lint_archived_skills` | `--quiet` | 0 | 0.43 |
| `lint_behavioural_eval_freshness` | `--quiet` | 0 | 0.33 |
| `lint_bench_ab` | `--quiet` | 0 | 0.38 |
| `lint_bench_corpus` | `--quiet` | 0 | 0.42 |
| `lint_breaking_changes_index` | `--quiet` | 0 | 0.35 |
| `lint_changelog_rollback` | — | 0 | 0.26 |

Two reads inside the twenty were checked rather than assumed. The four
generators each rewrite their document without `--check`, so each step passes
`--check` and the batch's test case pins it. Four gates —
`check_structural_breaking`, `check_test_coverage_diff`, `lint_archived_skills`,
`lint_breaking_changes_index` — diff the branch against `origin/main` through a
merge-base; they are pull-request gates by design, and the host job checks out
with `fetch-depth: 0`, so the base ref exists there. None of the twenty calls
`checkRatchet` or reads the wall clock for its verdict.

**Still a local reading.** `check_ci_local_parity` reads **84** on this branch,
104 - 20, and `check_gate_reachability` and `check_gate_coverage` exit 0 with the
batch wired. The baseline moves on CI's reading of this branch, as for 2.2a.

**Left for 2.2c onward: 65 gates** — 61 in name order from
`lint_command_flow_coverage`, plus 2.2a's four skipped gates for 2.2f.

## 2026-10-16 — step 2.2, third batch (2.2c), and the baseline on CI's reading

Read on branch `drain/local-gates-wired-2c-20261016`, off `origin/main` at
`5fa963cec`. At that base `check_ci_local_parity --format json` lists **84**
undeclared local-only gates, 65 of them `wire`-class: the 61 left after 2.2b plus
2.2a's four skipped gates, which stay for 2.2f.

**The baseline moves on CI's reading.** The consistency job on main at
`73eb69439` (run 38849726162), after 2.2b merged, printed
`ci-parity:local-only: 84 violation(s), baseline 104 — ratchet is loose`. The
baseline is lowered 104 -> 84 in this change; 104 - 84 = 20, 2.2b's twenty.

**The twenty**, the next in name order from `lint_command_flow_coverage`. Each was
run serially with the argv in the table at the top and `git status --short`
checked after it: all twenty exit 0 and leave the tree clean, and none calls
`checkRatchet`, reads the wall clock or reaches the network. **One skipped:**
`lint_marketplace_install_completeness`, still red with the finding the
2026-10-15 re-reading recorded, so the window reaches one gate further to
`lint_model_tier_coverage`.

> **Correction, 2026-10-22 (release finding `e88d5329c9a1`).** "Exit 0" is
> not "clean" for `lint_hook_concern_budget`. Without `--strict` it is
> warn-only by design (`hard_fail = DEFAULT_HARD_FAIL || strict`,
> `src/scripts/lint_hook_concern_budget.ts`), and it printed three `error:`
> lines here — `block-no-verify`, `block-kernel-rule-writes` and
> `block-plumbing-writes` are `fail_closed` but not in
> `hooks.concern_budget.tier1_concerns` — while exiting 0; re-run on
> 2026-10-22 it still does. The step wired here
> (`standing-payload-delta.yml`, no `--strict`) therefore records those
> findings and cannot fail on them. Counting it `wire` with no caveat
> overstated what the step enforces.

| Gate | Argv | Exit | Seconds |
|---|---|---|---|
| `lint_command_flow_coverage` | `--quiet` | 0 | 0.24 |
| `lint_command_routing` | `--quiet` | 0 | 0.26 |
| `lint_command_verbs` | `--baseline origin/main --quiet` | 0 | 0.34 |
| `lint_context_spine_usage` | `--quiet` | 0 | 0.22 |
| `lint_discovery_vocabulary` | `--quiet` | 0 | 0.22 |
| `lint_documented_commands` | — | 0 | 0.28 |
| `lint_empty_roadmaps` | `--quiet` | 0 | 0.34 |
| `lint_eval_fixture_citations` | `--quiet` | 0 | 0.55 |
| `lint_examples` | `--quiet` | 0 | 0.20 |
| `lint_flows` | `--quiet` | 0 | 0.23 |
| `lint_frontmatter_boilerplate` | `--quiet` | 0 | 0.24 |
| `lint_ghostwriter_source` | `--quiet` | 0 | 0.22 |
| `lint_glama_drift` | — | 0 | 0.20 |
| `lint_harvest_provenance` | `--quiet` | 0 | 0.26 |
| `lint_hook_concern_budget` | — | 0 | 0.24 |
| `lint_knowledge_scale` | `--quiet` | 0 | 0.21 |
| `lint_load_context` | `--quiet` | 0 | 0.26 |
| `lint_metric_consumers` | `--quiet` | 0 | 0.19 |
| `lint_missions` | `--quiet` | 0 | 0.19 |
| `lint_model_tier_coverage` | `--quiet` | 0 | 0.24 |

**A stale exemption, corrected rather than kept.** Wiring `lint_glama_drift`
makes the task `mcp:glama-drift-check` reachable, and
`check_gate_reachability --gate` refuses its exemption row. The row's reason —
"queries an external registry, network-dependent" — does not describe the task:
`taskfiles/mcp.yml` calls it a fast, Docker-free guard, and the script compares
`internal/glama/README.md` with the two scripts beside it. The row is removed.

**Still a local reading.** `check_ci_local_parity` reads **64** on this branch,
84 - 20, and `check_gate_reachability --gate` and `check_gate_coverage` exit 0
with the batch wired. The baseline moves to 64 on CI's reading of this change.

**Left for 2.2d onward: 45 gates** — 40 `wire`-class in name order from
`lint_namespace`, `lint_marketplace_install_completeness` while it stays red, and
2.2a's four skipped gates for 2.2f.

**Corrected on CI's first reading of 2.2c.** `lint_command_verbs` defaults its
`--baseline` to the local branch name `main`, which a checkout exists to have and
the CI runner does not: the first run of this batch failed `Drain 2.2c-1` with
`fatal: ambiguous argument 'main...HEAD'`. The step now passes
`--baseline origin/main`, which exits 0 locally too. The local reading above could
not have caught it — every developer checkout carries `main`.

**The baseline at 64, on CI's reading of this branch.** After the base fix, the
consistency job at `1db488224` (run 38861614919) printed
`ci-parity:local-only: 64 violation(s), baseline 84`. The baseline is lowered to
64 in the same pull request, so 2.2c's twenty cannot be given back by a later
change. A test now pins that `lint_command_verbs` is called with
`--baseline origin/main`; without the argument it reads red.

## 2026-10-16 — step 2.2, fourth batch (2.2d)

Read on branch `drain/local-gates-wired-2d-20261016`, off `origin/main` after
2.2c merged. `check_ci_local_parity --format json` lists **64** undeclared
local-only gates, 45 of them `wire`-class.

**The twenty**, the next in name order from `lint_namespace`, none skipped. Each
ran serially with the argv below and `git status --short` checked after it: all
twenty exit 0 and leave the tree clean, and none calls `checkRatchet`, reads the
wall clock or reaches the network. **Two carry 2.2c's trap:**
`lint_new_skill_gate` and `lint_no_new_atomic_commands` default `--baseline` to
the local branch `main`; both run with `--baseline origin/main`, exit 0 locally,
and a test now pins the argument for all three such gates.

| Gate | Argv | Exit | Seconds |
|---|---|---|---|
| `lint_namespace` | `--quiet` | 0 | 0.28 |
| `lint_namespace_collisions` | — | 0 | 0.33 |
| `lint_new_skill_gate` | `--baseline origin/main --quiet` | 0 | 0.46 |
| `lint_no_activation_gates` | `--quiet` | 0 | 0.25 |
| `lint_no_new_atomic_commands` | `--baseline origin/main` | 0 | 0.29 |
| `lint_no_python_twin_rationale` | `--quiet` | 0 | 0.52 |
| `lint_orchestrator_auto_detect` | `--quiet` | 0 | 0.23 |
| `lint_pack_first_win` | `--quiet` | 0 | 0.22 |
| `lint_pack_risk_class` | `--quiet` | 0 | 0.25 |
| `lint_profile_overlay_set_only` | `--quiet` | 0 | 0.30 |
| `lint_profile_personas` | `--quiet` | 0 | 0.29 |
| `lint_provenance` | `--quiet` | 0 | 0.29 |
| `lint_roadmap_complexity` | `--quiet` | 0 | 0.29 |
| `lint_roadmap_family_cap` | `--quiet` | 0 | 0.19 |
| `lint_role_experiences` | `--plain-language` | 0 | 0.25 |
| `lint_rule_interactions` | `--quiet` | 0 | 0.26 |
| `lint_rule_skill_pack_reach` | `--quiet` | 0 | 0.32 |
| `lint_showcase_sessions` | — | 0 | 0.20 |
| `lint_skill_descriptions` | `--quiet` | 0 | 0.44 |
| `lint_skill_originality` | `--quiet` | 0 | 0.27 |

**Still a local reading.** `check_ci_local_parity` reads **44** on this branch,
64 - 20; `check_gate_reachability --gate` and `check_gate_coverage` exit 0. The
baseline moves on CI's reading of this branch.

**Left for 2.2e onward: 25 gates** — 20 `wire`-class in name order from
`lint_skill_router_head`, `lint_marketplace_install_completeness` while it stays
red, and 2.2a's four skipped gates for 2.2f.

## 2026-10-16 — step 2.2, fifth batch (2.2e), the window emptied

Read on branch `drain/local-gates-wired-2e-20261016`, off `origin/main` after
2.2d merged. `check_ci_local_parity --format json` lists **44** undeclared
local-only gates; the `wire`-class ones left in name order from
`lint_skill_router_head` number **nineteen**, and this batch wires all of them —
the window is empty after it.

Each ran serially and `git status --short` was checked after it: all nineteen
exit 0 and leave the tree clean. That includes the four writer-shaped gates the
roadmap names, checked first: `rebuild_hook_bundle` (no self-hosted bundle on a
checkout, nothing to heal), `report_imperative_density`, and both
`second_brain_*` under `--dry-run`. `second_brain_retrieval` calls the network
only under `--run`; `--dry-run` stubs the model arms. None of the nineteen calls
`checkRatchet`, reads the wall clock or defaults its base to a local branch.

| Gate | Argv | Exit | Seconds |
|---|---|---|---|
| `lint_skill_router_head` | `--quiet` | 0 | 0.21 |
| `lint_skill_scripts_readonly` | `--quiet` | 0 | 0.20 |
| `lint_skill_tools` | `--quiet` | 0 | 0.19 |
| `lint_spawn_payload` | — | 0 | 0.21 |
| `lint_store_boundary` | — | 0 | 0.20 |
| `lint_surface_matrix` | — | 0 | 0.32 |
| `lint_ticket_buildable` | — | 0 | 0.23 |
| `lint_token_budget_discipline` | `--quiet` | 0 | 0.35 |
| `lint_trigger_precision` | `--quiet` | 0 | 0.20 |
| `lint_ui_stack_bundles` | `--quiet` | 0 | 0.20 |
| `lint_versioned_cache` | `--quiet` | 0 | 0.45 |
| `rebuild_hook_bundle` | — | 0 | 0.23 |
| `report_imperative_density` | — | 0 | 0.22 |
| `second_brain_retrieval` | `--dry-run` | 0 | 0.26 |
| `second_brain_score` | `--dry-run` | 0 | 0.23 |
| `validate_agent_settings` | — | 0 | 0.22 |
| `validate_decision_engine` | — | 0 | 0.23 |
| `validate_flow_teams` | `--quiet` | 0 | 0.22 |
| `validate_reach_prescriptions` | `--quiet` | 0 | 0.35 |

The batch test's twenty-a-batch bound now allows the batch that empties the
window to hold fewer: it is marked `final`, and every other batch is still held
to exactly twenty.

**Still a local reading.** `check_ci_local_parity` reads **25** on this branch,
44 - 19; `check_gate_reachability --gate` exits 0. The baseline moves on CI's
reading of this branch.

**Left for 2.2f: five wire-class gates** — 2.2a's four skipped
(`check_hook_bundle_freshness`, `check_quality_regression`,
`check_release_trunk_sync`, `check_reply_consistency`) and
`lint_marketplace_install_completeness`, red since 2026-10-15. The other twenty
of the 25 are in classes that are not `wire`.

## 2026-10-16 — step 2.2, the residue (2.2f)

Read on branch `drain/local-gates-wired-2f-20261016`, off `origin/main` after
2.2e and its baseline follow-up merged. Five `wire`-class gates were left; each
reason was re-checked against the tree rather than carried forward.

| Gate | Reason recorded | Holds now? | Outcome |
|---|---|---|---|
| `lint_marketplace_install_completeness` | red: 10 issues in `hooks/hooks.json` | **no** | fixed and wired |
| `check_reply_consistency` | its task scanned a directory the tree lacks, so exit 0 was vacuous | **no** | task repointed and wired |
| `check_hook_bundle_freshness` | verdict depends on whether a self-hosted bundle was built | yes | backlog |
| `check_release_trunk_sync` | reads branch state | yes | backlog |
| `check_quality_regression` | inert until an operator-run `internal/bench/reports/quality-run.json` exists | yes — the file is still absent | backlog |

**`lint_marketplace_install_completeness` was a false positive.** #2360 made the
plugin's no-dispatcher branch echo a sentence that contains the words
"agent-config hook"; the lint's command pattern read that prose as an invocation
of a subcommand `hook`, ten times, once per event. The invocation on the same line
is `"$BIN" dispatch:hook`. The lint now drops single-quoted text — what a line
prints, never what it runs — before matching; a test pinning that line failed
first (received `hook`, expected `dispatch:hook`) and passes now, and the lint
exits 0 on the tree.

**`check_reply_consistency` was never vacuous in effect.** Given a directory that
does not exist, it falls back to `src/agent-src` and `src` and says so. The task
now names `src`, the source tree ADR-051 moved the old one into, and a planted
`(recommended)` inline tag in a scratch directory reds it (exit 2), so the scan
can see what it is for.

**Still a local reading.** `check_ci_local_parity` reads **23** on this branch,
25 - 2. The baseline moves on CI's reading of this branch.

**What 2.2 leaves.** Three `wire`-class gates stay local-only with their reasons
written above, as 2.2f says; none is declared under `local_only:` to move the
number. AC-2 ("every `wire`-class gate has a pull-request caller") therefore does
not hold yet for those three, and step 2.2 stays open with it.
**Superseded by the 2026-10-17 section below**, which re-reads all three, finds
every reason still standing, and records the class each reason describes instead
of leaving the table saying `wire`. They stay in the backlog and in the count;
what changes is the label, and AC-2 with it.

## 2026-10-17 — step 2.2, the sixth batch (2.2g) and the end of the window

Read on branch `drain/road-to-local-gates-wired-while-they-are-green-20261017`,
off `origin/main` at `8c90aad26`. `check_ci_local_parity --format json` lists
**23** undeclared local-only gates, which is the baseline, so the previous batch
landed exactly what it said.

**Five of the 23 LOOKED `wire`-class with no caller, and none of them was in
this page's table. CI reduced that to one, and the reduction is the finding.** Four entered `task ci` after the 2026-10-11 reading was taken,
so they were never inside a batch window at all:
`check_artefact_checksums`, `lint_featured_skills`, `lint_trust_coherence`,
`validate_discovery_manifest`. The fifth, `lint_motion_authority_drift`, **was**
inside the window and was missed: 2.2c ended at `lint_model_tier_coverage` and
2.2d began at `lint_namespace`, and in name order `lint_motion_authority_drift`
sits between them. The selection rule said "the 105 in name order, twenty at a
time" and the batch boundaries were written from the list rather than recomputed
from it, so one name fell through the seam. Recorded rather than quietly wired,
because the lesson is about the seam and not about the gate.

All five were run on the branch base with the argv their task passes, serially,
with `git status --short` checked after each: **all five exit 0 and leave the
tree clean** on a developer's machine, so none writes a tracked file (the risk
register's rank-5 check). Serial sum 1.26 s. None calls `checkRatchet`, reads
the wall clock, or shells out to git — grepped per file for `checkRatchet`,
`Date.now`, `new Date`, `as-of`, `execSync`, `origin/main`.

**Four of them are `machine`-class, and only CI could say so.** Wired as a
five-gate step, `Drain 2.2g` failed on its first run
(run 39012371929, job 117337430453) with

```
error: manifest not found at dist/discovery/discovery-manifest.json
error: committed manifest not found at dist/discovery/discovery-manifest.json
  — run `task build-discovery` and commit the output.
```

`check_artefact_checksums`, `lint_featured_skills`, `lint_trust_coherence` and
`validate_discovery_manifest` all read
`dist/discovery/discovery-manifest.json`. It is a **build output** that the
tree does not commit and that `Standing payload delta + budget gate` does not
produce — `tests.yml`'s Node Tests job builds it explicitly before its suites,
and this job has no equivalent step. So the four exit 0 in any checkout that
has run `npm run build` and exit 1 in the host job: a checkout and CI answer
them differently, which is the `machine` class exactly. Their rows above are
corrected from `wire` to `machine` and they stay in the backlog. **Nothing was
declared.**

This is the local-reading limit the page has recorded since 2026-10-13 arriving
in the only way it can — a gate's class is a claim about two environments, and
one machine can only ever see one of them. The grep for `execSync` and the
clock would not have caught it: these four read a FILE, and the file is present
on the machine that took the reading.

**So the batch is one gate, `lint_motion_authority_drift`, and it is `final`.**
Twenty is the council's ceiling, not a quota, and the window is empty at one:
padding it would mean wiring a gate whose class nobody read, which is the move
the 2026-08-13 decision refuses in its other direction.

### The three residue gates are reclassified, not declared

2.2f left three `wire`-class gates in the backlog with their reasons. Each
reason describes a class, and the class was never written back into the table —
so the table said `wire` while the prose beside it said `machine`-shaped, and
AC-2 read as unmet on a label rather than on a gap. Step 1.2 names the move for
exactly this case: a gate whose reason does not have the structural shape the
2026-08-13 decision requires for a `local_only:` declaration "stays in the
backlog with its class written down". That is done here.

| Gate | Re-checked 2026-10-17 | Class recorded | Still in the count? |
|---|---|---|---|
| `check_hook_bundle_freshness` | exit 0, `no self-hosted dist/hooks/dispatch.js — the installed package copy is in use` — the verdict depends on whether a self-hosted bundle was built, which a checkout and CI answer differently | `machine` | yes |
| `check_release_trunk_sync` | exit 0; reads branch state | `machine` | yes |
| `check_quality_regression` | exit 0 with `no quality-run report (internal/bench/reports/quality-run.json) — gate inert`; the file is still absent, and it is an operator artefact a checkout and CI answer differently | `machine` | yes |

**Nothing was declared and no number moved by this.** All three are still
counted by `check_ci_local_parity`, `local_only:` still holds seven entries, and
the parity baseline falls by one — `lint_motion_authority_drift`, the one gate
that gained a caller — from 23 to 22. (Corrected 2026-10-22, release finding
`9f8399a273fa`: this read "falls by five — the five gates that gained a caller
— not by eight", written before CI moved four of the five to `machine`.)

### What 2.2 leaves, and what closes with it

After 2.2g the undeclared set is **22**, and **no gate in it is `wire`-class**:
seven are red and owned by a named file (`audit_user_type_axis`,
`check_gate_completeness`, `check_rule_invariants`, `check_trigger_evals`,
`lint_agents_layout`, `lint_eval_freshness`,
`lint_rule_enforcement_declaration`), one is the `slow` writer
`audit_command_surface`, and fourteen are `machine`-class — the three residue
gates and the four above, plus `check_branch_freshness`,
`check_branch_work_committed`, `check_installed_hooks_fresh`,
`check_review_prompt_binding`, `complexity_report`, `probe_projection_fidelity`
and `sync_pr_branch`.
`probe_projection_fidelity` exits 1 here for the reason the first reading gave:
it reads generated tool directories a checkout and CI answer differently.

AC-2 is therefore met: every `wire`-class gate has a pull-request caller, and
the parity baseline is lower by the count that gained one. That reading depends
on the `machine` class as recorded in this drain — seven of the fourteen were
moved there in this section — so it is a statement about the classification,
not a count of gates CI now runs. Step 2.2 closes with
it. The sentence this section replaces said the opposite, and it is corrected
rather than deleted — it was true of 2.2f's tree.
