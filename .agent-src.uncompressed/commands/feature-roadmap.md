---
name: feature-roadmap
skills: [agent-docs-writing]
description: Generate implementation roadmap(s) from a feature plan and link them
disable-model-invocation: true
suggestion:
  eligible: true
  trigger_description: "turn this feature into a roadmap, generate the implementation roadmap"
  trigger_context: "existing feature plan without linked roadmap"
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

### 2. Analyze the feature

- Read the feature file completely.
- Read `agents/roadmaps/template.md` for the roadmap structure.
- Research the codebase for affected areas mentioned in the feature.

Determine how many roadmaps are needed:

- **Single roadmap:** Small/medium features that fit in one document.
- **Multiple roadmaps:** Large features that span multiple phases or modules.

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

### 3. Plan the phases

For each roadmap, work through the phases interactively:

**Phase planning questions:**
- "What order makes sense? I suggest: {order}"
- "Soll {X} ein eigener Schritt sein oder Teil von {Y}?"
- "Are there dependencies between the steps?"

**Use codebase knowledge:**
- Reference specific files that need changes.
- Identify existing patterns to follow.
- Flag potential conflicts with other work.

**Phase structure per roadmap step:**
```markdown
### Phase {N}: {title}

- [ ] {concrete task with file reference}
- [ ] {concrete task}
- [ ] Tests: {what to test}
- [ ] Quality: PHPStan + Rector
```

### 4. Generate the roadmap(s)

- Read `.augment/templates/roadmaps.md` for the format.
- Determine the target directory from the feature's location:
  - Feature in `agents/features/` → roadmap in `agents/roadmaps/`
  - Feature in `app/Modules/{Module}/agents/features/` → roadmap in `app/Modules/{Module}/agents/roadmaps/`
- Create the target directory if it doesn't exist.

**Naming convention:**
- Single: `agents/roadmaps/{feature-name}.md`
- Multiple: `agents/roadmaps/{feature-name}-{aspect}.md`

### 5. Link roadmaps in the feature plan

Update the feature file's `## Roadmaps` section:

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

Update the feature status to `🗺️ Roadmapped`.

### 6. Show the result

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

- **Option 1:** Start Phase 1 using the roadmap context.
- **Option 2:** Discuss changes and update the roadmap.
- **Option 3:** Done.

### Rules

- **Do NOT commit or push.**
- **Do NOT include commit steps in the roadmap** unless the user explicitly
  requested them. See [`commit-policy`](../rules/commit-policy.md#never-write-commit-steps-into-roadmaps-unsolicited).
- **Do NOT modify the feature plan** beyond updating the Roadmaps section and status.
- **Always link roadmaps back to the feature** and vice versa.
- **Use the roadmap template** from `agents/roadmaps/template.md`.
- **Reference specific files** in roadmap tasks — not vague descriptions.
- **Include quality gates** (PHPStan, Rector, tests) in every phase.
- **Research the codebase** to make tasks concrete and realistic.

## See also

- [`role-contracts`](../guidelines/agent-infra/role-contracts.md#planner) — Planner mode output contract (Goal / Constraints / Option set / Recommendation / Dependencies / Rollback)
