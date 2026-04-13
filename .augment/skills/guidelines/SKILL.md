---
name: guidelines
description: "Manages coding guidelines — understands the guideline structure, when to read/create/update guidelines, and how they differ from rules and skills."
---

# guidelines

## When to use

Project conventions, new guidelines, checking existing guidelines. NOT for: reading patterns directly, creating rules.

Guidelines = coding conventions/patterns per language. **How** to write code.

### Guidelines vs. Rules vs. Skills

| | Guidelines | Rules | Skills |
|---|---|---|---|
| **What** | Coding conventions & patterns | Always-active behavior constraints | Agent capabilities & workflows |
| **Where** | `.augment/guidelines/{lang}/` | `.augment/rules/` | `.augment/skills/` |
| **When read** | When writing/reviewing code | Always (auto-loaded) | On demand (matched by topic) |
| **Example** | "Controllers use single-action pattern" | "Never commit without permission" | "How to create an API endpoint" |
| **Audience** | Agent writing code | Agent behavior | Agent workflow |

**Key difference:** Rules are **always active** (loaded automatically). Guidelines are **reference material**
that skills and commands point to when relevant.

## File structure

```
.augment/guidelines/
├── php/                    # PHP guidelines
│   ├── controllers.md      # Controller conventions
│   ├── eloquent.md         # Eloquent model patterns
│   ├── git.md              # Git workflow conventions
│   ├── jobs.md             # Queue job patterns
│   ├── php.md              # General PHP style guide
│   ├── resources.md        # API Resource conventions
│   ├── validations.md      # FormRequest patterns
│   ├── patterns.md         # Design patterns index
│   └── patterns/           # Detailed pattern docs
│       ├── service-layer.md
│       ├── repositories.md
│       ├── dtos.md
│       ├── events.md
│       ├── policies.md
│       ├── dependency-injection.md
│       ├── factory.md
│       ├── pipelines.md
│       └── strategy.md
├── javascript/             # JavaScript guidelines (future)
├── typescript/             # TypeScript guidelines (future)
└── vue/                    # Vue.js guidelines (future)
```

### Language directories

Guidelines are organized by language/framework:
- `php/` — PHP, Laravel, Eloquent, Pest
- Future: `javascript/`, `typescript/`, `vue/`, etc.

Each language directory follows the same internal structure:
- **Topic files** (e.g., `controllers.md`) for specific areas
- **`patterns/`** subdirectory for design pattern documentation

## Guideline file format

Each guideline file should follow this structure:

```markdown
# {Topic} Guidelines

> {One-line summary of what this guideline covers}

## Rules

- {Concrete rule with rationale}
- {Another rule}

## Examples

### ✅ Correct

{code example}

### ❌ Wrong

{code example}

## Patterns

{Common patterns for this topic}

## References

- {Links to related guidelines, skills, or external docs}
```

## New guideline: repeating pattern, inconsistency, new tech. NOT for: one-off, rules, workflows.

Skills reference guidelines, rules enforce them.
Guidelines provide the detailed explanation that rules summarize.

### Discovery
Agents discover `.augment/guidelines/` automatically — no index file needed.


## Auto-trigger keywords

- coding guidelines
- style guide
- conventions
- guideline structure

## Do NOT

- Do NOT put guidelines in `agents/guidelines/` — they live in `.augment/guidelines/`.
- Do NOT duplicate content from `.github/copilot-instructions.md` — reference it.
- Do NOT create guidelines for obvious language features — only for project-specific conventions.
- Do NOT create empty guideline files — only create when there's content to document.
