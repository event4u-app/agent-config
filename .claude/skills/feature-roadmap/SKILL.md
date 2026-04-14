---
name: feature-roadmap
description: "Create a roadmap for a feature from its plan"
disable-model-invocation: true
---

# feature-roadmap

## Instructions

### 1. Find the feature

- List feature plans in `agents/features/`.
- Also check module-level `app/Modules/*/agents/features/`.

If the user specified a feature name, load it directly.
Otherwise show a list and ask:

```
📂 Feature plans:

  #  Name                              Status
  ─  ──────────────────────────────    ──────
  1  import-csv-validation.md          📋 Planned
  2  webhook-retry-logic.md            📋 Planned

Which feature should get a roadmap?
```

If no features exist or all are `💡 Idea`:
```
⚠️  No feature ready for a roadmap.
Create a plan first with /feature-plan or refine with /feature-refactor.
```
Stop.

### 2. Analyze feature

Read feature + `agents/roadmaps/template.md`. Research codebase. Single vs multiple roadmaps:

```
I've analyzed the feature:

📄 {feature title}
📐 Scope: {scope summary}
🔧 Affected areas: {modules, models, services}

───────────────────────────────────────────────
ROADMAP PROPOSAL:
───────────────────────────────────────────────

{Option A: Single roadmap}
  📄 agents/roadmaps/{feature-name}.md
  Phasen: {phase count}
  Estimated effort: {rough estimate}

{Option B: Multiple roadmaps — only if feature is large}
  📄 agents/roadmaps/{feature-name}-database.md (Schema & Migrations)
  📄 agents/roadmaps/{feature-name}-backend.md (Services, API)
  📄 agents/roadmaps/{feature-name}-frontend.md (UI, if applicable)

Which fits better? Or do you have a different breakdown in mind?
```

### 3. Plan phases interactively

Questions: order, granularity, dependencies. Reference specific files, existing patterns, conflicts.

**Phase structure per roadmap step:**
```markdown
### Phase {N}: {title}

- [ ] {concrete task with file reference}
- [ ] {concrete task}
- [ ] Tests: {what to test}
- [ ] Quality: PHPStan + Rector
```

### 4. Generate roadmap(s)

Template: `.augment/templates/roadmaps.md`. Target dir mirrors feature location. Single: `{name}.md`, Multiple: `{name}-{aspect}.md`.

### 5. Link in feature plan

```markdown
## Roadmaps

- [`agents/roadmaps/{feature-name}.md`](../roadmaps/{feature-name}.md) — Main implementation roadmap
```

Or for multiple:
```markdown
## Roadmaps

- [`agents/roadmaps/{name}-database.md`](../roadmaps/{name}-database.md) — Schema & Migrations
- [`agents/roadmaps/{name}-backend.md`](../roadmaps/{name}-backend.md) — Services & API
- [`agents/roadmaps/{name}-frontend.md`](../roadmaps/{name}-frontend.md) — UI Components
```

Status → `🗺️ Roadmapped`.

### 6. Show result

```
═══════════════════════════════════════════════
  🗺️ ROADMAP(S) CREATED
═══════════════════════════════════════════════

Feature: {title}
Status:  🗺️ Roadmapped

───────────────────────────────────────────────
DATEIEN:
───────────────────────────────────────────────

  📄 agents/roadmaps/{name}.md ({phase count} Phasen)
  📄 agents/features/{name}.md (status updated, roadmaps linked)

───────────────────────────────────────────────
PHASE OVERVIEW:
───────────────────────────────────────────────

  Phase 1: {title} — {summary}
  Phase 2: {title} — {summary}
  Phase 3: {title} — {summary}

═══════════════════════════════════════════════
```

### 7. Next steps

```
What's next?

1. 🚀 Start with Phase 1
2. ✏️ Adjust roadmap
3. ✅ Done for now
```

### Rules

- No commit/push. Only update feature's Roadmaps section + status.
- Link roadmaps ↔ feature. Use template. Reference specific files. Include quality gates. Research codebase.
