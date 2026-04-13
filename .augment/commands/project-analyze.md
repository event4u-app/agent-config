---
skills: [project-analyzer]
description: Full project analysis — detect stack, inventory modules, audit docs, create missing contexts
---

# project-analyze

## Instructions

Multi-phase interactive analysis. Show findings per phase, ask before creating docs.

### Phase 1: Project detection

Gather in parallel:
- `composer.json` → PHP version, framework, key packages
- `package.json` → Node.js, frontend framework (if exists)
- Check for: `artisan`, `Makefile`, `Taskfile.yml`, `docker-compose.yml`
- Check for: `phpstan.neon`, `ecs.php`, `rector.php`, `config-dev/`
- Check for: `.github/workflows/`, `CODEOWNERS`, `.editorconfig`
- Check for: `app/Modules/`, multi-tenant indicators (`customer_database`)
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

Ask:

```
> 1. Continue with Phase 2 — architecture analysis
> 2. Stop here — keep the overview only
```

### Phase 2: Architecture mapping

Map dirs, count components, detect patterns/multi-tenancy/API versioning:

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

### Phase 3: Module inventory (if `app/Modules/` exists)

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

Identify domains, map models → services → controllers → jobs → events:

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

Ask: create domain files? For confirmed → `agents/analysis/domains/{domain}.md`.

### Phase 6: API surface & service map

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

Ask: create API/service files? (`endpoints-v1.md`, `endpoints-v2.md`, `contracts.md`, `service-map.md`)

### Phase 7: Write remaining analysis files

Per file ask create/skip: `overview.md`, `architecture/{database,api,infrastructure,patterns}.md`, `models/{api,customer}-database.md`, `modules/{module}.md`, `testing/test-map.md`

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

Ask: `1. Create missing` / `2. Review existing` / `3. Cleanup` / `4. Save as roadmap` / `5. Done`

### Rules

- Do NOT commit/push or modify code — analysis only
- Confirm before each creation
- Skip `vendor/` and `node_modules/`
- Present incrementally, flag gaps honestly
- Don't overwrite existing docs — offer updates
- Reference `agents/docs/`, `agents/contexts/` — don't duplicate
- Analysis files must include actual names/signatures, not "see code"

