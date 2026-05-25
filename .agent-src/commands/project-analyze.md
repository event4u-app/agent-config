---
name: project-analyze
tier: 1
skills: [project-analyzer]
description: Full project analysis — detect stack, inventory modules, audit docs, create missing contexts
disable-model-invocation: true
suggestion:
  eligible: true
  trigger_description: "analyze the project structure, do a full project audit"
  trigger_context: "new project or after a major refactor"
workspaces:
  - agent-config-maintainer
packs:
  - meta
lifecycle: active
trust:
  level: core
  confidence: high
  human_review_required: false
install:
  default: true
  removable: false
---

# project-analyze

## Instructions

This is a **multi-phase, interactive analysis**. Walk through each phase, show findings,
and ask before creating any documents.

### Phase 1: Project detection

Gather in parallel:
- `composer.json` → PHP version, framework, key packages
- `package.json` → Node.js, frontend framework (if exists)
- Check for: `artisan`, `Makefile`, `Taskfile.yml`, `docker-compose.yml`
- Check for: `phpstan.neon`, `ecs.php`, `rector.php`, `config-dev/`
- Check for: `.github/workflows/`, `CODEOWNERS`, `.editorconfig`
- Check for module roots (resolve via `scripts/_lib/agent_settings.py::enumerate_modules()`; Laravel shape: `app/Modules/`), multi-tenant indicators (`customer_database`)
- Read: `AGENTS.md`, `.github/copilot-instructions.md` (if exist)

Display:

```
═══════════════════════════════════════════════
  🔍 PROJECT ANALYSIS
═══════════════════════════════════════════════

📦 Projekt:    {name from composer.json or directory}
🏗️  Framework:  {Laravel 11 / Standalone PHP / etc.}
🐘 PHP:        {version constraint}
📊 Type:       {Modular Laravel SaaS / Monolith / Package / Legacy}

───────────────────────────────────────────────
TECH STACK:
───────────────────────────────────────────────

  Backend:     {Laravel, PHP 8.x}
  Database:    {MariaDB / MySQL / SQLite / etc.}
  Queue:       {Redis + Horizon / sync / etc.}
  Cache:       {Redis / file / array}
  Search:      {Meilisearch / Algolia / none}
  Frontend:    {Vue / React / Blade / none}
  Testing:     {Pest / PHPUnit}

───────────────────────────────────────────────
TOOLING:
───────────────────────────────────────────────

  Task Runner:     {Makefile ✅ | Taskfile ✅ | none ⚠️}
  Docker:          {✅ docker-compose.yml | ❌}
  Quality:         {PHPStan ✅ Level {n} | ❌}
                   {Rector ✅ | ❌}
                   {ECS ✅ | ❌}
  CI/CD:           {GitHub Actions ✅ | ❌}
  Editor Config:   {✅ | ❌}

───────────────────────────────────────────────
LEGACY CHECK (indicators):
───────────────────────────────────────────────

  strict_types:     {✅ in most files | ⚠️ missing in many | ❌ absent}
  Typed properties: {✅ | ⚠️ partial | ❌}
  Debug functions:  {✅ none found | ⚠️ var_dump/dd found}
  Tests:            {✅ good coverage | ⚠️ few tests | ❌ no tests}

═══════════════════════════════════════════════
```

Per `verbosity.routine_confirmations` (default `false`):

- `false` → continue to Phase 2 silently (user invoked `/project-analyze`
  for the full pass; "continue" is dominant).
- `true` → ask:
  ```
  > 1. Continue with Phase 2 — architecture analysis
  > 2. Stop here — keep the overview only
  ```

### Phase 2: Architecture mapping

Analyze the directory structure:

- Map top-level directories with file counts
- Identify pattern: MVC, modules, services, repositories, DTOs
- Count: Models, Controllers, Services, Jobs, Commands, Events, Policies
- Detect: multi-tenancy, API versioning, queue usage

Display:

```
───────────────────────────────────────────────
ARCHITECTURE:
───────────────────────────────────────────────

  Pattern:      {Modular MVC + Service Layer + Repository}
  API:          {Versioned REST (/api/v1/, /api/v2/)}
  Multi-Tenant: {✅ Dual-DB (api_database + customer_database) | ❌}

───────────────────────────────────────────────
CODE INVENTORY:
───────────────────────────────────────────────

  Models:        {count}  (api_database: {n}, customer_database: {n})
  Controllers:   {count}
  Services:      {count}
  Repositories:  {count}
  Jobs:          {count}
  Commands:      {count}
  Events:        {count}
  Policies:      {count}
  Migrations:    {count}
  Tests:         {count}  (Unit: {n}, Component: {n}, Integration: {n})

═══════════════════════════════════════════════
```

### Phase 3: Module inventory (if modules exist)

If `enumerate_modules()` returns any modules (Laravel shape: `app/Modules/` exists), analyze each module:

```
───────────────────────────────────────────────
MODULES:
───────────────────────────────────────────────

  #  Module           Controllers  Services  Models  Tests  Agent Docs  Context
  ─  ───────────────  ───────────  ────────  ──────  ─────  ──────────  ───────
  1  ApiClient        0            1         0       2      1 roadmap   ❌
  2  Backoff          0            1         0       5      1 doc       ❌
  3  ClientSoftware   8            12        5       45     6 roadmaps  ❌
  4  Grafana          2            3         1       8      6 roadmaps  ❌
  5  Stubbing         0            2         0       3      1 doc       ❌

═══════════════════════════════════════════════
```

### Phase 4: Agent docs audit

Scan all existing agent docs:

```
───────────────────────────────────────────────
AGENT DOCS AUDIT:
───────────────────────────────────────────────

📄 Project Root (agents/):
  ✅  Current:     {list of docs that reference existing code}
  ⚠️  Review:      {list of docs that might be outdated}
  ❌  Stale:       {list of docs referencing deleted code}

📄 Module Level:
  ClientSoftware:  6 Roadmaps  (✅ 2 active, ⚠️ 3 possibly outdated, ❌ 1 completed)
  Grafana:         6 Roadmaps  (⚠️ review all)
  ...

📄 Missing:
  ❌  No context documents found
  ❌  No feature plans found
  ⚠️  No module descriptions for: ApiClient, ClientSoftware, Grafana

═══════════════════════════════════════════════
```

### Phase 5: Business domains

Identify domains from models, services, routes, and directory structure.
For each domain: map models → services → controllers → jobs → events.

```
───────────────────────────────────────────────
BUSINESS DOMAINS:
───────────────────────────────────────────────

  #   Domain          Models  Services  Endpoints  Jobs  Events
  ──  ──────────────  ──────  ────────  ─────────  ────  ──────
  1   Projects        5       3         8          2     4
  2   Planning        4       2         6          1     3
  3   Users           3       2         5          0     1
  4   Equipment       4       2         6          1     3
  5   Working Times   3       3         5          1     5
  6   Reports         3       1         4          0     2
  7   Customers       4       3         3          2     2
  8   Imports         5       6         4          3     1
  ...

═══════════════════════════════════════════════
```

Per `verbosity.routine_confirmations` (default `false`):

- `false` → create domain analysis files silently (user invoked
  `/project-analyze`; "yes, create" is dominant).
- `true` → ask:
  ```
  > 1. Yes — create domain analysis files
  > 2. Skip — continue with next phase
  ```

For each confirmed domain, create `agents/evidence/analysis/domains/{domain}.md` using the template
from the `project-analyzer` skill.

### Phase 6: API surface & service map

List all endpoints per version. Map all services with dependencies.

```
───────────────────────────────────────────────
API SURFACE:
───────────────────────────────────────────────

  v1 Endpoints:  {count}
  v2 Endpoints:  {count}
  Shared (v1=v2): {count} (via fallback)

───────────────────────────────────────────────
SERVICE MAP:
───────────────────────────────────────────────

  Total Services:     {count}
  With Repository:    {count}
  God Services (>10 methods): {list}

═══════════════════════════════════════════════
```

Per `verbosity.routine_confirmations` (default `false`):

- `false` → create API + service analysis files silently.
- `true` → ask:
  ```
  > 1. Yes — create API and service analysis files
  > 2. Skip — continue with next phase
  ```

Create:
- `agents/evidence/analysis/api/endpoints-v1.md`
- `agents/evidence/analysis/api/endpoints-v2.md`
- `agents/evidence/analysis/api/contracts.md`
- `agents/evidence/analysis/services/service-map.md`

### Phase 7: Write analysis files

Write all remaining analysis files that haven't been created yet:

- `agents/evidence/analysis/overview.md` — project profile, tech stack summary
- `agents/evidence/analysis/architecture/database.md` — schema, connections, multi-tenancy
- `agents/evidence/analysis/architecture/api.md` — versioning, routes, middleware, auth
- `agents/evidence/analysis/architecture/infrastructure.md` — Docker, CI/CD, deployment
- `agents/evidence/analysis/architecture/patterns.md` — design patterns used
- `agents/evidence/analysis/models/api-database.md` — all api_database models
- `agents/evidence/analysis/models/customer-database.md` — all customer_database models
- `agents/evidence/analysis/modules/{module}.md` — one per module
- `agents/evidence/analysis/testing/test-map.md` — test suites, coverage, strategy

Per `verbosity.routine_confirmations` (default `false`):

- `false` → create all listed files silently (per-file picker is pure
  noise once the user invoked `/project-analyze`).
- `true` → for each file, ask:
  ```
  > 1. Create — {filename}
  > 2. Skip
  ```

### Phase 8: Gap analysis & action plan

```
───────────────────────────────────────────────
RECOMMENDED ACTIONS:
───────────────────────────────────────────────

Priority 1 — Missing analysis files:
  📄 {domains/modules that weren't created yet}

Priority 2 — Update docs:
  ✏️  {outdated docs that reference deleted code}

Priority 3 — Cleanup:
  🗑️  {stale roadmaps, orphaned docs}

───────────────────────────────────────────────
```

Ask the user (in their language) what they want to do next:

```
1. 📄 Create missing analysis files
2. ✏️  Review and update existing docs
3. 🗑️  Cleanup (stale docs, completed roadmaps)
4. 📋 Save everything as a roadmap (for later)
5. ✅ Done
```

### Rules

- **Do NOT commit or push.**
- **Do NOT create documents without asking** — always confirm before each creation.
- **Do NOT modify code** — this is analysis only.
- **Do NOT analyze `vendor/` or `node_modules/`.**
- **Present findings incrementally** — don't dump everything at once.
- **Be honest about gaps** — flag missing docs and outdated references.
- **Respect existing docs** — don't overwrite, offer to update.
- **Reference existing `agents/reference/docs/` and `agents/settings/contexts/`** — don't duplicate their content
  in analysis files. Link to them instead.
- **Analysis files should be self-contained enough to rebuild** — include actual table names,
  column names, class names, method signatures. Not just "see the code".
