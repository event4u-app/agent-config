---
stability: beta
---

# Skill Domains — 6-domain taxonomy

> **Status:** active · **Stability:** beta · **Owner:** road-to-better-skills-and-profiles Block B
> · **Linter:** `scripts/skill_linter.py` enforces the `domain:` field against this allow-list
> · **Schema:** `scripts/schemas/skill.schema.json` § `domain`

Locks the canonical 6-domain taxonomy that classifies every skill in
`.agent-src.uncompressed/skills/`. Each skill MUST declare exactly one
`domain:` value from the allow-list below in its `SKILL.md` frontmatter.

## § 1 — Allow-list

```
engineering · product · quality · devops · process · discovery
```

Unknown values fail `lint-skills`. Missing `domain:` fails `lint-skills`.
No multi-domain assignment — pick the dominant axis.

## § 2 — Domain definitions

### `engineering`

Application and framework code authoring — controllers, models,
services, jobs, validation, queues, mail, broadcasting, ORMs, and
language-level idioms (PHP, async patterns, error handling). The
"writing the app" axis. Where the agent ships features into the
production codebase.

**Examples:** `eloquent` · `laravel-validation` · `php-coder`

### `product`

Discovery, refinement, and ticket / prompt shaping before code is
written. Turns a fuzzy ask into a refined backlog item, an estimated
unit of work, or a model-ready prompt. The "what should we build"
axis — upstream of engineering.

**Examples:** `refine-ticket` · `estimate-ticket` · `refine-prompt`

### `quality`

Test authoring, review, and verification gates. Pest, Playwright,
the judge family, code review, threat modelling, security audits,
testing anti-patterns. The "is it correct, safe, and reviewable"
axis — runs alongside or after engineering.

**Examples:** `pest-testing` · `judge-bug-hunter` · `review-routing`

### `devops`

Infrastructure, deployment, runtime, and observability. AWS, Docker,
Terraform, Terragrunt, CI pipelines, Traefik, Grafana, secrets,
DevContainers, package publishing. The "how it runs in production"
axis.

**Examples:** `terraform` · `github-ci` · `docker`

### `process`

Workflow, orchestration, and meta-tooling. Git workflow, slash-command
routing, subagent orchestration, agent docs, skill / rule / command
authoring, learnings capture, branch finishing, PR mechanics. The
"how the agent works the codebase" axis.

**Examples:** `git-workflow` · `command-routing` · `subagent-orchestration`

### `discovery`

Audit, diagnostic, and investigative analysis. Bug hunting, blast
radius mapping, data flow tracing, performance and security audits,
framework-specific project analysis, hypothesis-driven debugging.
The "understand what's there before changing it" axis.

**Examples:** `bug-analyzer` · `blast-radius-analyzer` · `project-analysis-laravel`

## § 3 — Boundary heuristics (when in doubt)

- **engineering vs quality** — does the skill **write production code**
  (engineering) or **assert / review** production code (quality)?
- **engineering vs devops** — does the artifact run **inside the app**
  (engineering) or **around the app** (devops)?
- **product vs process** — does the skill produce a **work item**
  (product) or **drive the workflow** that delivers work items
  (process)?
- **discovery vs quality** — discovery **reads to understand**;
  quality **reads to gate / approve**. A judge skill is `quality`; a
  blast-radius skill is `discovery`.
- **discovery vs engineering** — if the skill ends in a production
  edit, it's `engineering`; if it ends in a written analysis or
  finding, it's `discovery`.

Tiebreaker: pick the axis that matches the skill's **primary output
artifact**, not its auxiliary side-effects.

## § 4 — Skill assignment by domain

Snapshot from B3 back-fill (regenerate via `python3 scripts/_emit_domain_table.py`).
Source-of-truth for the assignment is each skill's `domain:` frontmatter —
this table is a derived view, kept readable for reviewers.

### engineering (36)

`api-design`, `api-endpoint`, `artisan-commands`, `async-python-patterns`, `blade-ui`, `code-refactoring`, `composer-packages`, `database`, `dependency-upgrade`, `dto-creator`, `eloquent`, `error-handling-patterns`, `fe-design`, `flux`, `jobs-events`, `laravel`, `laravel-horizon`, `laravel-mail`, `laravel-middleware`, `laravel-notifications`, `laravel-pennant`, `laravel-pulse`, `laravel-reverb`, `laravel-scheduling`, `laravel-validation`, `livewire`, `migration-creator`, `multi-tenancy`, `openapi`, `performance`, `php-coder`, `php-debugging`, `php-service`, `react-shadcn-ui`, `sql-writing`, `websocket`

### product (12)

`dcf-modeling`, `estimate-ticket`, `feature-planning`, `funnel-analysis`, `okr-tree-modeling`, `prompt-engineering-patterns`, `prompt-optimizer`, `refine-prompt`, `refine-ticket`, `rice-prioritization`, `technical-specification`, `unit-economics-modeling`

### quality (25)

`adversarial-review`, `api-testing`, `authz-review`, `code-review`, `defense-in-depth`, `design-review`, `judge-bug-hunter`, `judge-code-quality`, `judge-security-auditor`, `judge-test-coverage`, `mobile-e2e-strategy`, `pest-testing`, `playwright-testing`, `quality-tools`, `readme-reviewer`, `review-routing`, `security`, `security-audit`, `skill-reviewer`, `test-driven-development`, `test-performance`, `testing-anti-patterns`, `threat-modeling`, `validate-feature-fit`, `verify-completion-evidence`

### devops (13)

`aws-infrastructure`, `dashboard-design`, `devcontainer`, `docker`, `github-ci`, `grafana`, `logging-monitoring`, `react-native-setup`, `secrets-management`, `sentry-integration`, `terraform`, `terragrunt`, `traefik`

### process (48)

`adr-create`, `agent-docs-writing`, `agents-md-thin-root`, `ai-council`, `check-refs`, `command-routing`, `command-writing`, `context-authoring`, `context-document`, `conventional-commits-writing`, `copilot-agents-optimization`, `copilot-config`, `description-assist`, `developer-like-execution`, `file-editor`, `finishing-a-development-branch`, `git-workflow`, `guideline-writing`, `jira-integration`, `learning-to-rule-or-skill`, `lint-skills`, `markitdown`, `mcp`, `mcp-builder`, `md-language-check`, `merge-conflicts`, `module-management`, `override-management`, `persona-writing`, `project-docs`, `readme-writing`, `readme-writing-package`, `receiving-code-review`, `repomix-packer`, `requesting-code-review`, `roadmap-management`, `roadmap-writing`, `rtk-output-filtering`, `rule-writing`, `script-writing`, `sequential-thinking`, `skill-improvement-pipeline`, `skill-management`, `skill-writing`, `subagent-orchestration`, `token-optimizer`, `upstream-contribute`, `using-git-worktrees`

### discovery (19)

`analysis-autonomous-mode`, `analysis-skill-router`, `blast-radius-analyzer`, `bug-analyzer`, `data-flow-mapper`, `deep-reading-analyst`, `existing-ui-audit`, `performance-analysis`, `project-analysis-core`, `project-analysis-hypothesis-driven`, `project-analysis-laravel`, `project-analysis-nextjs`, `project-analysis-node-express`, `project-analysis-react`, `project-analysis-symfony`, `project-analysis-zend-laminas`, `project-analyzer`, `systematic-debugging`, `universal-project-analysis`

**Total: 153 skills.**

## § 5 — Versioning

Domain rename or new-domain proposal → ADR + lint-skills allow-list
update + back-fill of affected skills in the same PR. Domain
deletion is breaking and requires a major version bump in the package
release notes.

## See also

- [`skill-quality`](../../.agent-src.uncompressed/rules/skill-quality.md) — frontmatter contract for skills
- [`rule-classification`](rule-classification.md) — sister taxonomy for rules (kernel vs auto)
- `road-to-better-skills-and-profiles.md` — Block B (taxonomy lock + back-fill + folder reorg)
