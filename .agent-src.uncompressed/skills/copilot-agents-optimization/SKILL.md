---
name: copilot-agents-optimization
description: "Use when optimizing AGENTS.md or copilot-instructions.md — deduplicates against .augment/ content, enforces line budgets, and focuses each file on its audience."
source: package
execution:
  type: assisted
  handler: internal
  allowed_tools: []
---

# Copilot & AGENTS Optimizer Skill

## When to use

Use this skill when:
- Running `/docs-optimize` to refactor AGENTS.md and copilot-instructions.md
- Adding new content to either file and needing to check if it belongs there
- After changes to `.augment/` (new skills, rules, guidelines) that may make content in these files redundant
- When either file exceeds the line budget


Do NOT use when:
- Writing application code
- Creating new skills or commands

## Procedure: Optimize copilot/agents files

### 0. Analyze current state

Before changing anything, read and understand:

1. **Read `AGENTS.md`** — current content, line count, what's duplicated vs. unique.
2. **Read `.github/copilot-instructions.md`** — same analysis.
3. **Scan `.augment/`** — which skills, rules, and guidelines already cover topics from the files above.
4. **Identify duplication** — what content exists in both AGENTS.md and `.augment/`?

Only after this analysis, proceed with optimization.

### `AGENTS.md` — Project Entry Point for AI Agents

| Property | Value |
|---|---|
| **Audience** | Augment Agent, other AI agents |
| **Can read `.augment/`?** | ✅ Yes — can follow references |
| **Line budget** | Max 1000, ideal ≤ 500 |
| **Purpose** | Project-specific setup, Docker, testing, quality tools |

**What belongs here:**
- Tech stack and framework versions
- Development setup (Docker, Make targets, env files)
- Database and multi-tenancy setup
- Testing framework, suites, and conventions
- Quality tool commands (PHPStan, Rector, ECS)
- Project structure overview (brief, link to module docs)
- Agent infrastructure overview (layer table, key references)

**What does NOT belong here:**
- Coding standards (→ `.augment/rules/` and `.augment/guidelines/`)
- Architecture principles like SOLID, KISS, DRY (→ `.augment/rules/architecture.md`)
- PHP conventions (→ `.augment/guidelines/php/`)
- Scope control rules (→ `.augment/rules/scope-control.md`)
- Language/tone rules (→ `.augment/rules/language-and-tone.md`)
- Detailed module documentation (→ `app/Modules/README.md`)

### `.github/copilot-instructions.md` — Self-Contained for Copilot

| Property | Value |
|---|---|
| **Audience** | GitHub Copilot (Code Review bot + Chat) |
| **Can read `.augment/`?** | ❌ Code Review cannot, ✅ Chat can |
| **Line budget** | Max 1000, ideal ≤ 500 |
| **Purpose** | Coding standards, review rules, architecture constraints |

**What belongs here:**
- Architecture rules (thin controllers, service layer, policies)
- PHP 8.2 patterns (readonly, final, enums — with exceptions)
- Project-specific conventions (custom helpers, environment config, naming)
- Code review scope and comment behavior rules
- Language rules (English comments, bilingual PR comments)
- Known issues / false positives that Copilot should avoid
- Package management rules

**What does NOT belong here:**
- Docker setup or Make targets (Copilot doesn't run commands)
- Testing setup details (Copilot doesn't run tests)
- Agent infrastructure (Copilot doesn't use agents/)
- Things auto-enforced by ECS/Rector (code style, formatting, trailing commas)
- Detailed pattern documentation (too long, Copilot needs concise rules)

## Deduplication Strategy

### Rule: Content lives in ONE canonical place

```
.augment/rules/         ← Canonical for behavior rules
.augment/guidelines/    ← Canonical for coding conventions
.augment/skills/        ← Canonical for domain expertise
agents/                 ← Canonical for project-specific docs
```

### When duplication is acceptable

`copilot-instructions.md` **must** duplicate essential rules because Copilot Code Review
cannot read other files. But keep duplicated content:
- **Concise** — one-liner summaries, not full explanations
- **Focused** — only what Copilot needs for code suggestions and PR reviews
- **Stable** — rules that rarely change (architecture, naming, key conventions)

### When duplication is NOT acceptable

`AGENTS.md` should **never** duplicate `.augment/` content because Augment Agent can read
both. Instead, reference with a table:

```markdown
| What | Where |
|---|---|
| PHP coding rules | `.augment/rules/php-coding.md` |
| Controller guidelines | `.augment/guidelines/php/controllers.md` |
```

## Line Budget Enforcement

| File | 🟢 Good | 🟡 Warning | 🔴 Over budget |
|---|---|---|---|
| `AGENTS.md` | ≤ 500 | 501–800 | > 1000 |
| `copilot-instructions.md` | ≤ 500 | 501–800 | > 1000 |

### Reduction strategies (when over budget)

1. **Extract to `agents/`** — Move project-specific details to dedicated files in `agents/`
   and link from AGENTS.md (e.g., `agents/docs/database-setup.md`, `agents/docs/testing.md`)
2. **Remove duplicates** — If content exists in `.augment/`, remove from AGENTS.md
3. **Compress** — Turn verbose explanations into concise tables or bullet points
4. **Remove ECS/Rector-enforced rules** — From copilot-instructions.md (auto-fixed anyway)
5. **Move examples to guidelines** — Detailed code examples belong in `.augment/guidelines/`

## Portability and Stack Coherence

Duplication is not the only way these files go wrong. They also **lie
about the project** over time:

- **Legacy identifiers** — references to a former repo name, a sibling
  project in the same monorepo, or content that was copied from another
  codebase as a starting template and never adapted.
- **Stack drift** — the file claims "Laravel 11 + MariaDB" but the repo
  was converted to a Python library; or it names Docker services that
  no longer exist.
- **Dead commands** — `make start` in the docs, but `Makefile` no
  longer has that target.

Before deduplicating, run three scans:

1. **Legacy identifier scan** — compare both files against the package's
   `FORBIDDEN_IDENTIFIERS` blocklist (see `scripts/check_portability.py`)
   plus any project names from `agents/` module docs that don't match
   the current project.
2. **Stack coherence scan** — auto-detect the actual stack from
   `composer.json` / `package.json` / `pyproject.toml` / etc. and flag
   any claim that no longer matches reality.
3. **Dead-command scan** — verify every `make X`, `task X`, `composer X`,
   `php artisan X`, or `npm X` still resolves.

Every hit from scan 1 is a 🔴 blocker: leaking another project's name
into a consumer's own docs is the failure mode this skill exists to
prevent. Fix or remove those BEFORE any dedup/compress work — there's
no point deduplicating content that is about to be rewritten.

When the drift is severe (whole sections are wrong), recommend
`/copilot-agents-init` to scaffold a clean replacement rather than
patching forever.

## Optimization Checklist

When optimizing either file, check:

- [ ] No identifiers from other projects (FORBIDDEN_IDENTIFIERS blocklist)?
- [ ] Tech stack claims match actual project dependencies?
- [ ] All referenced commands/targets exist (Makefile, composer scripts, artisan, task)?
- [ ] Line count within budget?
- [ ] No content duplicated with `.augment/rules/`?
- [ ] No content duplicated with `.augment/guidelines/`?
- [ ] No content duplicated between the two files unnecessarily?
- [ ] AGENTS.md references `.augment/` instead of duplicating?
- [ ] copilot-instructions.md is self-contained for Code Review?
- [ ] No ECS/Rector-enforced rules in copilot-instructions.md?
- [ ] Project structure is brief (link to module docs for details)?
- [ ] All sections still relevant (no outdated references)?
- [ ] Cross-references to `agents/` docs are valid?

## Related

- **Command:** `/copilot-agents-optimize`
- **Skill:** `copilot-config` — Copilot behavior and PR review patterns
- **Skill:** `agent-docs-writing` — documentation hierarchy
- **Context:** `augment-infrastructure.md` — full `.augment/` overview


## Output format

1. Optimized file(s) with deduplication applied and line budget respected
2. Summary of what was removed, moved, or consolidated
3. Line count before/after for each file

## Gotcha

- AGENTS.md is read by GitHub Copilot and other tools — changes affect all AI assistants, not just Augment.
- Don't remove content from AGENTS.md that other tools depend on — verify cross-tool compatibility first.
- The model tends to over-optimize by removing "obvious" content that other models actually need.

## Do NOT

- Do NOT add content to AGENTS.md that belongs in .augment/ files.
- Do NOT exceed the recommended line budget for copilot-instructions.md.
- Do NOT duplicate rules between AGENTS.md and .augment/rules/.

## Auto-trigger keywords

- AGENTS.md optimization
- copilot-instructions
- deduplication
