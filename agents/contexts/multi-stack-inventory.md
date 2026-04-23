# Multi-stack skill inventory

> Phase 0 deliverable for [`road-to-multi-stack.md`](../roadmaps/road-to-multi-stack.md).
> Maps every existing Laravel-flavoured or shared skill to its Symfony,
> React, Next.js, and Zend/Laminas equivalent — or marks it *shared*
> when no stack-specific version is needed. "Target" skills are not
> implemented; the row is a scoping hint, not a commitment.
>
> Last refreshed: 2026-04-22.

## Convention

- **Namespace:** `<stack>-<capability>` (lowercase, hyphenated).
  Examples: `symfony-messenger`, `nextjs-server-actions`.
- **Stack prefix omitted** when the skill is framework-agnostic
  (`php-coder`, `security`, `api-design`).
- **One capability = one skill per stack.** No stack-free umbrella skill.

## Core capability matrix

| Capability | Laravel (shipped) | Symfony (Track A) | React/Next.js (Track B) | Zend/Laminas (Track C) | Shared / plain |
|---|---|---|---|---|---|
| Framework idioms | `laravel` | `symfony` *(target)* | `react-components`, `nextjs-app-router` *(target)* | `laminas-mvc` *(target, adoption-gated)* | — |
| Controllers / routing | `laravel` (folded) | `symfony-controllers` *(target)* | `nextjs-app-router` *(target)* | `laminas-mvc` *(target)* | `api-design`, `api-endpoint` |
| Request validation | `laravel-validation` | `symfony-validation` *(target)* | (framework-managed) | `laminas-input-filter` *(target)* | — |
| Dependency injection | (folded in `laravel`) | `symfony-services` *(target)* | — | `laminas-service-manager` *(target)* | — |
| ORM / persistence | `eloquent` | `doctrine-orm` *(target)* | — | `laminas-hydrators` *(target)* | `database`, `sql-writing` |
| Migrations | (folded in `eloquent`) | `doctrine-migrations` *(target)* | — | — | — |
| DB driver layer | (folded) | `doctrine-dbal` *(target)* | — | — | `database`, `sql-writing` |
| Queues / async | `laravel-horizon` | `symfony-messenger` *(target)* | — | — | `jobs-events` (shared) |
| Scheduling | `laravel-scheduling` | `symfony-scheduler` *(target)* | — | — | — |
| Mail | `laravel-mail` | `symfony-mailer` *(target)* | — | — | — |
| Notifications | `laravel-notifications` | `symfony-notifier` *(target)* | — | — | — |
| Feature flags | `laravel-pennant` | (roll your own) | (vendor libs) | — | — |
| Observability dashboard | `laravel-pulse` | (profiler + third-party) | (Sentry + Vercel) | — | `grafana`, `logging-monitoring` |
| WebSockets | `laravel-reverb` | (Mercure) | (native) | — | `websocket` (shared) |
| UI (server-rendered) | `blade-ui`, `livewire`, `flux` | (Twig) | — | — | — |
| UI (client-rendered) | — | — | `react-components`, `react-hooks`, `react-state-management`, `tailwind`, `shadcn-ui`, `radix-ui` *(all target)* | — | `fe-design`, `dashboard-design` |
| Testing | `pest-testing` | (PHPUnit via shared quality) | `react-testing`, `vitest` *(target)* | (PHPUnit via shared) | `api-testing`, `playwright-testing`, `test-performance` |
| Debugging | `php-debugging` (Xdebug) | `php-debugging` (shared) | (browser devtools) | `php-debugging` (shared) | `systematic-debugging`, `bug-analyzer` |
| Commands / CLI | `artisan-commands` | `symfony-console` *(target)* | — | (Laminas CLI) | — |
| Middleware | `laravel-middleware` | `symfony-controllers` (covers) | (Next.js middleware in `nextjs-app-router`) | — | — |

## Infrastructure (already stack-agnostic)

`aws-infrastructure` · `docker` · `devcontainer` · `terraform` ·
`terragrunt` · `traefik` · `github-ci` · `composer-packages` ·
`api-design` · `api-testing` · `openapi` · `security` ·
`security-audit` · `performance` · `performance-analysis` ·
`database` · `sql-writing` · `logging-monitoring` · `grafana` ·
`multi-tenancy` · `websocket`

Plain-PHP-suitable (Track A.4 verification target): `php-coder`,
`php-service`, `php-debugging`, `composer-packages`, `security`,
`api-design`. No new skills expected; Track A.4 is a
*leakage-check* pass.

## Gaps / unmapped

- No Node.js-native backend skill line; `project-analysis-node-express`
  is the only touchpoint today. Scheduling TBD per Q19 table.
- No Ruby / Go / Python tracks. Out of scope for this roadmap.
- Agent-infra skills (`skill-writing`, `rule-writing`,
  `guideline-writing`, `command-writing`, `lint-skills`,
  `check-refs`, `compress`) are package-internal — never
  stack-specific.

## Coverage snapshot (2026-04-22)

| Stack | Shipped authoring skills | Target authoring skills (this roadmap) |
|---|---|---|
| Laravel | 12 | — (maintain only) |
| Plain PHP | 4 (shared) | 0 (verify leakage) |
| Symfony | 0 | 14 *(Waves A.1-A.3)* |
| Next.js / React | 0 | 11 *(Waves B.1-B.4)* |
| Zend / Laminas | 0 *(analysis only)* | 4 *(Wave C.2 — adoption-gated)* + 1 migration skill |

Every "target" cell expands into a separate artifact-drafting
session per the roadmap's Phase 1+ discipline.

## See also

- [`../roadmaps/road-to-multi-stack.md`](../roadmaps/road-to-multi-stack.md) — governing roadmap
- [`../roadmaps/road-to-stronger-skills.md`](../roadmaps/road-to-stronger-skills.md) — pattern-compliance baseline for new skills
- [`../../.agent-src.uncompressed/rules/augment-portability.md`](../../.agent-src.uncompressed/rules/augment-portability.md) — portability gate
