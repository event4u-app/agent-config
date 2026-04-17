# Multi-Package Architecture Roadmap

Source: GPT strategic analysis (April 2026) on modular distribution for agent-config.

## Goal

Transform from a single monolithic package into a **monorepo with multi-package distribution** —
like Laravel/Symfony: developed together, distributed separately.

**Model:** Monorepo for development, multi-package for distribution, full-package as aggregator.

## Why this matters

| Problem | How multi-package solves it |
|---|---|
| W1: Entry barrier too high | `core` package = minimal install, instant value |
| W3: No minimal mode | `core` IS the minimal mode — no config needed |
| W2: Distribution not optimal | Each package has clear scope and install path |
| T3: Overengineering perception | Users only see what they install |
| O4: Enterprise adoption | Full package for teams, core for individuals |

## Architecture Decision: Monorepo (not Multi-Repo)

**Chosen:** Monorepo with `packages/` directory and split distribution.

**Why not Multi-Repo:**
- Still stabilizing architecture
- Still building plugin/marketplace integration
- One CI, one release process, one source of truth
- No different teams owning different parts (yet)
- Multi-repo adds coordination overhead we don't need

**Why Monorepo:**
- Shared tests, CI, docs, release logic
- Cross-package changes in one commit
- Dependency management is trivial
- Laravel, Symfony, React all use this model

---

## Package Design

### Package 1: `agent-config-core`

**What:** The essential governed agent system. Install this and your agent improves immediately.

**Contents:**
- All rules (`.augment/rules/`)
- Core skills (~30 most-used): laravel, pest-testing, eloquent, php-coder, git-workflow,
  quality-tools, docker, security, database, api-design, livewire, blade-ui, composer-packages,
  artisan-commands, laravel-validation, laravel-middleware, laravel-mail, laravel-notifications,
  jobs-events, performance, multi-tenancy, openapi, sql-writing, developer-like-execution,
  improve-before-implement, validate-feature-fit, bug-analyzer, sequential-thinking,
  conventional-commits-writing, readme-writing
- Core commands (~20 most-used): commit, create-pr, fix-ci, fix-pr-comments, quality-fix,
  review-changes, jira-ticket, compress, tests-create, tests-execute, bug-investigate,
  bug-fix, module-explore, module-create, context-create, roadmap-create, roadmap-execute,
  feature-plan, feature-explore
- All guidelines (`.augment/guidelines/`)
- All templates (`.augment/templates/`)
- All contexts (`.augment/contexts/`)
- install.sh, setup.sh, generate_tools.sh
- skill_linter.py (core linter)

**Dependencies:** None.
**Standalone:** Yes — this is the primary install for most users.
**Token overhead:** Zero (governance only, no runtime).

### Package 2: `agent-config-runtime`

**What:** Execution layer for assisted/automated skill running.

**Contents:**
- scripts/runtime_registry.py
- scripts/runtime_dispatcher.py
- scripts/runtime_pipeline.py
- scripts/runtime_execute.py
- scripts/runtime_session.py
- scripts/runtime_hooks.py
- scripts/runtime_errors.py
- scripts/runtime_events.py
- scripts/runtime_logger.py
- scripts/runtime_metrics.py
- scripts/event_schema.py
- Runtime-capable skills (analysis-autonomous-mode, etc.)

**Dependencies:** `agent-config-core`
**When to install:** When you want skills to execute automatically, not just guide.

### Package 3: `agent-config-tools`

**What:** Controlled external tool integration.

**Contents:**
- scripts/tool_registry.py
- scripts/tools/base_adapter.py
- scripts/tools/github_adapter.py
- scripts/tools/jira_adapter.py
- Tool-integrated commands (fix-pr-bot-comments, fix-pr-developer-comments, etc.)

**Dependencies:** `agent-config-core`
**When to install:** When your agent needs GitHub/Jira integration.

### Package 4: `agent-config-observability`

**What:** Metrics, reports, feedback, and lifecycle management.

**Contents:**
- scripts/persistence.py
- scripts/report_generator.py
- scripts/ci_summary.py
- scripts/feedback_collector.py
- scripts/feedback_governance.py
- scripts/skill_lifecycle.py
- Observability skills (logging-monitoring, grafana, dashboard-design, etc.)

**Dependencies:** `agent-config-core`, optionally `agent-config-runtime`
**When to install:** When you want to measure, understand, and improve agent behavior.

### Package 5: `agent-config` (full / aggregator)

**What:** Everything. One install, all features.

**Contents:** Re-exports all packages above.
**Dependencies:** core + runtime + tools + observability
**When to install:** Teams that want the full system. Current default behavior.

---

## What belongs in core (strategic)

`core` must be the **best first experience** — not just "something small".

### Rules for core
- think-before-action
- ask-when-uncertain
- scope-control
- verify-before-complete
- improve-before-implement (this is a unique differentiator — must be in core)
- All other always-active rules

### Skills for core (~30)
- **Coding:** laravel, php-coder, eloquent, livewire, blade-ui, artisan-commands
- **Testing:** pest-testing, api-testing
- **Quality:** quality-tools, laravel-validation, sql-writing
- **Git/PR:** git-workflow, conventional-commits-writing, command-routing
- **Infrastructure:** docker, database, composer-packages, multi-tenancy
- **Design:** api-design, security, performance, fe-design
- **Analysis:** developer-like-execution, improve-before-implement, validate-feature-fit,
  bug-analyzer, sequential-thinking, project-docs
- **Writing:** readme-writing, skill-writing, agent-docs-writing

### What does NOT belong in core
- GitHub/Jira-specific adapters → `tools`
- Runtime registry, dispatcher, pipeline → `runtime`
- Lifecycle reports, health scoring → `observability`
- Feedback collection and governance proposals → `observability`
- Audit logging → `observability`
- Heavy packaging/compression logic → stays in dev scripts at root

`core` must be **light, fast, clear**.

---

## Package Manifest Format

Every package includes a `package.manifest.json` defining identity, dependencies, and profiles.

**Example: core**
```json
{
  "name": "agent-config-core",
  "version": "1.0.0",
  "description": "Core governance package — rules, skills, commands, guidelines",
  "depends_on": [],
  "includes": ["rules", "skills", "commands", "guidelines", "templates", "contexts"],
  "profiles": ["minimal", "balanced", "full", "enterprise"]
}
```

**Example: full (aggregator)**
```json
{
  "name": "agent-config-full",
  "version": "1.0.0",
  "description": "Full governed agent system — all packages bundled",
  "depends_on": [
    "agent-config-core",
    "agent-config-runtime",
    "agent-config-tools",
    "agent-config-observability"
  ],
  "includes": ["bundles", "profiles"],
  "profiles": ["balanced", "full", "enterprise"]
}
```

---

## Profiles (orthogonal to packages)

**Packages** control what's INSTALLED. **Profiles** control what's ACTIVE.

| Profile | Active packages | Token overhead | Target user |
|---|---|---|---|
| `minimal` | core (rules + skills only) | Zero | Solo devs, new users |
| `balanced` | core + runtime | Low | Small teams |
| `full` | core + runtime + tools + observability | Moderate | Platform teams |
| `enterprise` | full + stricter rules + more reporting | Moderate-High | Governance teams |

Profiles are configured via `.agent-settings`:
```ini
cost_profile=minimal   # or balanced, full, enterprise
```

### Profile definitions as JSON

Profiles live in `packages/full/profiles/` and define exactly what's active:

**minimal.profile.json:**
```json
{
  "name": "minimal",
  "packages": ["agent-config-core"],
  "settings": {
    "runtime_enabled": false,
    "observability_reports": false,
    "feedback_collection": false,
    "ci_summary_enabled": false,
    "tool_audit_enabled": false,
    "runtime_auto_read_reports": false
  }
}
```

**full.profile.json:**
```json
{
  "name": "full",
  "packages": ["agent-config-core", "agent-config-runtime", "agent-config-tools", "agent-config-observability"],
  "settings": {
    "runtime_enabled": true,
    "observability_reports": true,
    "feedback_collection": true,
    "ci_summary_enabled": true,
    "tool_audit_enabled": true,
    "runtime_auto_read_reports": false
  }
}
```

Note: Even in `full` profile, `runtime_auto_read_reports` defaults to `false` to avoid
unnecessary token injection. Users opt in explicitly.

Core always activates rules + skills. Runtime, tools, and observability only activate
when their package is installed AND the profile enables them.


---

## Release Strategy

**Phase 1: Shared versioning** — all packages share one version number.
Example: core 1.4.0, runtime 1.4.0, full 1.4.0.
Simpler, less version drift, correct for our team size.

**Phase 2 (later): Independent versions** — only when we have many external consumers
and packages evolve at different speeds. Not needed initially.

---

## Distribution Model

### For development
Everything lives in the monorepo. One CI, one test suite, one release process.

### For users — three paths

| Path | Install command | Who |
|---|---|---|
| **Core only** | `composer require --dev event4u/agent-config-core` | New users, solo devs |
| **Full bundle** | `composer require --dev event4u/agent-config` | Teams wanting everything |
| **Compose** | `composer require --dev event4u/agent-config-core event4u/agent-config-runtime` | Teams picking modules |

### For plugin marketplaces

The build step generates plugin packages from `packages/`:

```
dist/
  plugins/
    core/
      plugin.json
      .augment/              ← core rules, skills, commands only
    full/
      plugin.json
      .augment/              ← everything
```

This means: internal package split → external plugin generation. Clean separation.

---

## Target Directory Structure

```
agent-config/                          ← Monorepo root (current repo)
├── packages/
│   ├── core/
│   │   ├── composer.json              ← "event4u/agent-config-core"
│   │   ├── package.json               ← "@event4u/agent-config-core"
│   │   ├── package.manifest.json      ← Package identity, deps, profiles
│   │   ├── .augment/
│   │   │   ├── rules/                 ← ALL rules
│   │   │   ├── skills/                ← Core skills (~30)
│   │   │   ├── commands/              ← Core commands (~20)
│   │   │   ├── guidelines/            ← ALL guidelines
│   │   │   ├── templates/             ← ALL templates
│   │   │   └── contexts/              ← ALL contexts
│   │   └── scripts/
│   │       ├── install.sh
│   │       ├── setup.sh
│   │       ├── generate_tools.sh
│   │       └── skill_linter.py
│   │
│   ├── runtime/
│   │   ├── composer.json              ← "event4u/agent-config-runtime"
│   │   ├── .augment/skills/           ← Runtime-specific skills
│   │   └── scripts/
│   │       ├── runtime_registry.py
│   │       ├── runtime_dispatcher.py
│   │       ├── runtime_pipeline.py
│   │       ├── runtime_execute.py
│   │       ├── runtime_session.py
│   │       ├── runtime_hooks.py
│   │       ├── runtime_errors.py
│   │       ├── runtime_events.py
│   │       ├── runtime_logger.py
│   │       ├── runtime_metrics.py
│   │       └── event_schema.py
│   │
│   ├── tools/
│   │   ├── composer.json              ← "event4u/agent-config-tools"
│   │   ├── .augment/skills/           ← Tool-integrated skills
│   │   └── scripts/
│   │       ├── tool_registry.py
│   │       └── tools/
│   │           ├── base_adapter.py
│   │           ├── github_adapter.py
│   │           └── jira_adapter.py
│   │
│   ├── observability/
│   │   ├── composer.json              ← "event4u/agent-config-observability"
│   │   ├── .augment/skills/           ← Observability skills
│   │   └── scripts/
│   │       ├── persistence.py
│   │       ├── report_generator.py
│   │       ├── ci_summary.py
│   │       ├── feedback_collector.py
│   │       ├── feedback_governance.py
│   │       └── skill_lifecycle.py
│   │
│   └── full/
│       ├── composer.json              ← "event4u/agent-config" (aggregator)
│       ├── package.json               ← "@event4u/agent-config"
│       ├── package.manifest.json      ← Aggregator manifest
│       └── profiles/
│           ├── minimal.profile.json
│           ├── balanced.profile.json
│           ├── full.profile.json
│           └── enterprise.profile.json
│
├── .augment.uncompressed/             ← Source of truth (stays at root)
├── .augment/                          ← Compressed output (stays at root for dev)
├── docs/                              ← Package documentation
├── agents/                            ← Dev documentation
├── scripts/                           ← Shared dev scripts (compress, lint, CI)
├── tests/                             ← All tests
├── Taskfile.yml                       ← Dev task runner
└── README.md
```

### Key decisions in this structure

1. **Source of truth stays at root** — `.augment.uncompressed/` is NOT split.
   Compression produces per-package outputs into `packages/*/`.
2. **Rules are NOT split** — all rules go into `core`. Rules are the foundation.
3. **Skills are split by package** — each package owns its domain-specific skills.
4. **Guidelines, templates, contexts go into core** — they are reference material.
5. **Tests stay at root** — shared test runner, cross-package integration tests.
6. **install.sh gets smarter** — detects which packages are installed, merges outputs.

---

## Dependency Graph

```
agent-config (full)
├── agent-config-core          ← required by all
├── agent-config-runtime       ← depends on core
├── agent-config-tools         ← depends on core
└── agent-config-observability ← depends on core, optional: runtime
```

Rules:
- `core` MUST work alone — zero dependencies on other packages
- `runtime` MUST NOT require `tools` or `observability`
- `tools` MUST NOT require `runtime` or `observability`
- `observability` MUST NOT require `tools`
- `observability` MAY optionally enhance `runtime` (if both installed)
- `full` requires ALL packages

---

## Implementation Phases

### Phase 1: Prepare internal structure (low risk)

**Goal:** Reorganize code internally without changing external distribution.

- [ ] Create `packages/` directory structure
- [ ] Map every file to its target package (core/runtime/tools/observability)
- [ ] Create skill assignment list: which skills go into which package
- [ ] Create command assignment list: which commands go into which package
- [ ] Identify cross-package dependencies in scripts
- [ ] Document the split decision in agents/docs/

**Output:** Documentation and plan. No code moves yet.
**Risk:** None — pure planning.

### Phase 2: Split `core` out as standalone (medium risk)

**Goal:** `packages/core/` works as a standalone installable package.

- [ ] Move core skills into `packages/core/.augment/skills/`
- [ ] Move core commands into `packages/core/.augment/commands/`
- [ ] Copy all rules, guidelines, templates, contexts into core
- [ ] Create `packages/core/composer.json` with `event4u/agent-config-core`
- [ ] Create `packages/core/package.json` with `@event4u/agent-config-core`
- [ ] Adapt install.sh to work from `packages/core/`
- [ ] Adapt generate_tools.sh for core-only output
- [ ] Write integration test: install core into empty project, verify all basics work
- [ ] Verify: rules load, skills activate, commands available, no errors

**Output:** Working `core` package that can be installed standalone.
**Risk:** Medium — install.sh and generate_tools.sh need adaptation.

### Phase 3: Extract runtime, tools, observability (medium risk)

**Goal:** Each package is independently installable with clear boundaries.

- [ ] Move runtime scripts into `packages/runtime/scripts/`
- [ ] Move tool scripts into `packages/tools/scripts/`
- [ ] Move observability scripts into `packages/observability/scripts/`
- [ ] Move package-specific skills into respective packages
- [ ] Create composer.json and package.json for each
- [ ] Add dependency declarations (runtime → core, tools → core, etc.)
- [ ] Write integration tests for each package combination
- [ ] Test: core alone, core+runtime, core+tools, core+observability, all together

**Output:** 4 independently installable packages.
**Risk:** Medium — cross-package imports need careful handling.

### Phase 4: Create aggregator `full` package (low risk)

**Goal:** `agent-config` (full) installs everything via dependencies.

- [ ] Create `packages/full/composer.json` requiring all 4 sub-packages
- [ ] Create `packages/full/package.json` requiring all 4 sub-packages
- [ ] Ensure existing `composer require event4u/agent-config` still works
  (the full package keeps the original package name)
- [ ] Existing users get zero breaking changes
- [ ] Write migration guide: "nothing changes for full users"

**Output:** Backwards-compatible full package.
**Risk:** Low — just aggregation.

### Phase 5: Adapt compression pipeline (medium risk)

**Goal:** Compression produces per-package outputs from single source of truth.

- [ ] Extend compress.sh to output into `packages/*/` instead of single `.augment/`
- [ ] Each package gets only its own compressed content
- [ ] Skill linter validates per-package completeness
- [ ] CI checks per-package integrity
- [ ] Source of truth (`.augment.uncompressed/`) stays at root — never split

**Output:** Compression pipeline that feeds per-package distributions.
**Risk:** Medium — compression scripts need significant changes.

### Phase 6: Adapt install.sh for multi-package (medium risk)

**Goal:** install.sh merges content from all installed packages into target project.

- [ ] install.sh detects which packages are installed (core, runtime, tools, etc.)
- [ ] Merges rules, skills, commands from all installed packages
- [ ] No duplicates, no conflicts
- [ ] Handles partial installations gracefully
- [ ] Plugin manifests reference correct package
- [ ] Write integration tests for all combinations

**Output:** Smart installer that works with any combination of packages.
**Risk:** Medium — merging logic is the most complex part.

### Phase 7: Profile system (low risk)

**Goal:** Profiles control what's active regardless of what's installed.

- [ ] Define profile presets in `.agent-settings` template
- [ ] `minimal`: rules + core skills, no runtime, no observability
- [ ] `balanced`: + runtime, limited observability
- [ ] `full`: everything active
- [ ] Profile detection in install.sh (only symlink what the profile activates)
- [ ] Document profiles in docs/customization.md
- [ ] Update README modes section to reference profiles

**Output:** Configurable profiles that control activation.
**Risk:** Low — builds on existing `cost_profile` setting.

### Phase 8: Distribution & marketplace (depends on ecosystem)

**Goal:** Each package is installable via plugin marketplaces.

- [ ] Register `agent-config-core` as standalone marketplace plugin
- [ ] Register `agent-config` (full) as marketplace plugin
- [ ] Plugin manifests per package
- [ ] Marketplace auto-updates per package
- [ ] Consumer settings templates per package

**Output:** Native marketplace distribution for all packages.
**Risk:** Depends on marketplace API maturity.

---

## User Journey Examples

### Solo developer (new user)

```bash
composer require --dev event4u/agent-config-core
bash vendor/event4u/agent-config-core/scripts/setup.sh
# Done. Rules + 30 skills + 20 commands. Zero overhead.
```

### Small team (growing)

```bash
composer require --dev event4u/agent-config-core event4u/agent-config-runtime
# Now agents can execute skills automatically
```

### Platform team (full system)

```bash
composer require --dev event4u/agent-config
# Everything. Full governance, runtime, tools, observability.
```

### Existing users (migration)

```bash
# Nothing changes. agent-config now depends on all sub-packages.
# composer update pulls the new structure transparently.
```

---

## What NOT to do

- **Don't split rules** — all rules belong in core. Rules are the foundation.
- **Don't split guidelines** — they are reference material, not execution logic.
- **Don't create too many packages** — 4 + aggregator is enough. Resist the urge to go finer.
- **Don't move to multi-repo** — monorepo is the right model for our team size and workflow.
- **Don't break existing installs** — `event4u/agent-config` stays, becomes full aggregator.
- **Don't duplicate content** — each file exists once in `.augment.uncompressed/`, compression distributes.
- **Don't split lifecycle separately** — keep it in observability (not enough content for own package).

---

## Success Criteria

- [ ] `agent-config-core` installs in <30 seconds and provides immediate value
- [ ] Existing `agent-config` users have zero breaking changes
- [ ] Each package has its own composer.json, package.json, and works standalone
- [ ] install.sh handles any combination of packages correctly
- [ ] Compression pipeline produces per-package outputs from single source
- [ ] All tests pass for every package combination
- [ ] README shows clear upgrade path: core → runtime → tools → full

## Scoring Impact

| Area | Current | After multi-package |
|---|---|---|
| Entry barrier (W1) | High | **Low** (core = minimal install) |
| No minimal mode (W3) | Missing | **Solved** (core IS minimal mode) |
| Distribution (W2) | Single package | **Per-need packages** |
| Overengineering perception (T3) | Real risk | **Mitigated** (users only see what they install) |
| Adoption / Installability | 7/10 | **9/10** |
| Overall score | 8.5/10 | **9+/10** |