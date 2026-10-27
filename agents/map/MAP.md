# Map of agent-config

> Map built at `aec3d00f96eb` · 2026-10-27 by `agent-config code-graph map` — this describes that commit; compare it with HEAD yourself.
> Deterministic, no model call. Rebuild with `agent-config code-graph map`; never edit by hand.

**11681 files · 103 areas · 79369 trusted links · guess share 18.7 %**

Thresholds: seed 42 · infrastructure above in-degree 58 · areas under 3 files fold into "small parts" · an area above 25 % is split once · lists capped at 15.

Convention providers: Laravel (verified, `tests/fixtures/code-graph/correctness/p1-blog`, `tests/fixtures/code-graph/correctness/p2-tenant`, `tests/fixtures/code-graph/correctness/p5-partner`, `tests/fixtures/code-graph/data/clean`, `tests/fixtures/code-graph/data/drift`, `tests/fixtures/code-graph/demo`, `tests/fixtures/code-graph/interfaces/p5`, `tests/fixtures/procedure-cursor-eval/cand-pa-01/repo`, `tests/fixtures/procedure-cursor-eval/cand-pa-12/repo`, `tests/fixtures/procedure-cursor-eval/cand-ui-09/repo`, `tests/fixtures/procedure-cursor-eval/cand-ui-10/repo`, `tests/fixtures/stack/laravel`) · Express (partial, `tests/fixtures/code-graph/express`, `tests/fixtures/code-graph/hub/beta`, `tests/fixtures/code-graph/interfaces/drift`, `tests/fixtures/procedure-cursor-eval/cand-pa-02/repo`) · Spring Boot (partial, `tests/fixtures/code-graph/spring`) · Go routers (net/http, Gin, Echo, chi) (partial, `tests/fixtures/code-graph/go-http`, `tests/fixtures/stack/go`) · Symfony (partial, `tests/fixtures/code-graph/symfony`, `tests/fixtures/procedure-cursor-eval/cand-pa-04/repo`) · WordPress (partial, `tests/fixtures/code-graph/wordpress/plugin`, `tests/fixtures/code-graph/wordpress/site`) · FastAPI (partial, `tests/fixtures/code-graph/fastapi`) · Flask (partial, `tests/fixtures/code-graph/flask`) · Django (partial, `tests/fixtures/code-graph/django`) · SQLAlchemy / SQLModel (partial, `tests/fixtures/code-graph/sqlalchemy`) · React Router (partial, `tests/fixtures/code-graph/react-router`) · Next.js (partial, `tests/fixtures/code-graph/nextjs`, `tests/fixtures/procedure-cursor-eval/cand-pa-03/repo`, `tests/fixtures/procedure-cursor-eval/cand-ui-11/repo`, `tests/fixtures/procedure-cursor-eval/cand-ui-12/repo/apps/portal`, `tests/fixtures/stack/mono-pnpm-turbo/apps/web`) · NestJS (partial, `tests/fixtures/code-graph/nestjs`) · Angular (partial, `tests/fixtures/code-graph/angular`) · Vue Router (partial, `tests/fixtures/code-graph/vue-router`) · Nuxt (partial, `tests/fixtures/code-graph/nuxt`) · SvelteKit (partial, `tests/fixtures/code-graph/sveltekit`) · TypeORM (partial, `tests/fixtures/code-graph/typeorm`) · ASP.NET Core (partial, `tests/fixtures/code-graph/aspnetcore/src/Api`) · Ruby on Rails (partial, `tests/fixtures/code-graph/rails`) — plus the framework-neutral default.

## Health — C, 48.7 of 100

| Part | Value | Points |
|---|---|---|
| Dead code files | 0.4 % | 24.5 / 25 |
| File cycles | 42 | 1.3 / 25 |
| Guessed edges | 18.7 % | 9.4 / 25 |
| Hotspot files | 2.3 % | 13.5 / 25 |

Formula: `health.formula` in `code/map.json`.

Top findings:

- 42 file cycles
- no layers.yaml, so no layer breaches checked
- 8 dead files (exports unchecked: the extractor records no exportedness, so an exported but unimported file counts as dead; entry files and files reached by a guessed link are never counted)
- hotspot `package-lock.json`: 134 commits × 8068 lines
- hotspot `src/scripts/install.ts`: 71 commits × 5011 lines

## Knowledge areas

Beside Code, each area is filled by its own reader. Every fact carries a witness (file, line, hash) and its confirm state in `code/map.json` → `areas`, and data, interfaces, runtime and delivery also in a folder each.

- data: data lane (migrations, dumps, snapshots) found nothing — no migration, schema file, committed dump or snapshot was found
- systems: 2 runtimes, 21 frameworks, 1310 packages, 13 findings — systems lane (lockfiles, manifests, version files, images, CI)
- interfaces: 3 services, 10 operations, 2 findings — interfaces lane (call sites, contracts, configuration names)
- runtime: 0 resources, 3 services, 0 environments, 1 finding — runtime lane (compose, Dockerfiles, Terraform, Kubernetes, task files)
- delivery: 36 workflows, 72 jobs, 0 findings — delivery lane (GitHub Actions, GitLab CI)
- impact: review-risk over the working diff found nothing — no change against HEAD
- agent: 15 verbs, 0 findings — code-graph CLI and MCP surface

## Since the last map

- a2 src/scripts/code\_graph/cli.ts: +16 / −0 files
- a22 src/scripts/\_lib/candidate\_record.ts: +0 / −4 files
- a28 src/scripts/bench\_ab\_v2\_run.ts: +9 / −0 files
- merged into a16 src/scripts/retro\_queue.ts: `src/scripts/retro_queue.ts`, `src/scripts/analysis_analysts.ts`

## Infrastructure

Files used by more than 58 other files. They are drawn apart and do not decide areas.

- `internal/workers/mcp/package-lock.json` — used by 2277 files
- `package-lock.json` — used by 470 files
- `src/agent-src/templates/scripts/work_engine/delivery_state.ts` — used by 86 files
- `src/cli/registry.ts` — used by 69 files
- `src/scripts/_lib/agent_settings.ts` — used by 125 files
- `src/scripts/_lib/agent_src.ts` — used by 82 files
- `src/scripts/_lib/egress_rules.ts` — used by 78 files
- `src/scripts/_lib/gate_ledger.ts` — used by 103 files
- `src/scripts/_lib/gate_self_test.ts` — used by 115 files
- `src/scripts/_lib/scan_scope.ts` — used by 380 files
- `src/scripts/_lib/user_global_paths.ts` — used by 73 files
- `src/scripts/ai_council/clients.ts` — used by 104 files
- `src/scripts/ai_council/config.ts` — used by 63 files
- `src/scripts/check_kernel_edit_ratified.ts` — used by 71 files
- `src/scripts/code_graph/build.ts` — used by 90 files
- `src/scripts/code_graph/types.ts` — used by 119 files
- `src/scripts/condense.ts` — used by 86 files
- `src/scripts/hooks/dispatch_hook.ts` — used by 135 files
- `src/scripts/hooks/hook_stdin.ts` — used by 97 files
- `src/scripts/install.ts` — used by 136 files
- `src/server/schemas/settings.ts` — used by 77 files

## Surprising links

Links between two areas that are otherwise barely connected, rarest first.

- `agents/evidence/analysis/gate-ledger-executions.mjs` → `src/scripts/lint_rule_enforcement_declaration.ts`
- `agents/evidence/analysis/gate-ledger-reconcile.mjs` → `src/scripts/_lib/as_of.ts`
- `deploy/telemetry-worker/src/index.ts` → `src/agent-src/templates/scripts/telemetry/flush_sender.mjs`
- `deploy/telemetry-worker/src/index.ts` → `src/scripts/_lib/llm_proposer_transport.ts`
- `src/agent-src/templates/scripts/work_engine/directives/backend/index.ts` → `src/agent-src/templates/scripts/work_engine/directives/backend/plan.ts`
- `src/scripts/_cli/cmd_doctor.ts` → `src/scripts/_lib/install_reach_checks.ts`
- `src/scripts/_cli/cmd_doctor.ts` → `src/scripts/dispatch_economy_report.ts`
- `src/scripts/_cli/cmd_uninstall.ts` → `src/scripts/_lib/fs_atomic.ts`
- `src/scripts/_cli/cmd_upgrade.ts` → `src/scripts/_lib/claude_plugin.ts`
- `src/scripts/_lib/activation_receipt_producer.ts` → `src/scripts/_lib/privacy_class.ts`
- `src/scripts/_lib/egress_sender_scan.test.ts` → `src/scripts/_lib/llm_proposer_transport.ts`
- `src/scripts/_lib/egress_sender_scan.test.ts` → `src/scripts/ai_council/api_transport.ts`
- `src/scripts/_lib/install_reach_checks.ts` → `src/scripts/_lib/installed_lock.ts`
- `src/scripts/_lib/knowledge_global_promote.ts` → `src/scripts/_lib/knowledge_global.ts`
- `src/scripts/_lib/repeated_failure.ts` → `src/scripts/_lib/evidence_basis.ts`

## Entry points

- `deploy/telemetry-worker/src/index.ts`

## Files by role

*isolated* means no trusted link in or out — never "dead": a file reached by reflection,
a string path or a framework convention the engine does not read is isolated too.

| Role | Files |
|---|---|
| code | 2121 |
| test | 3360 |
| entry | 1 |
| config | 6 |
| doc | 6101 |
| infra | 21 |
| isolated | 71 |

> Budget of 2000 tokens reached — cut: Areas, Cycles, Request paths, Artefact layer, External dependencies, Guesses. They are in `code/map.json`, in the per-area pages and in `index.html`.
