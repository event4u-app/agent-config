# Rule Template

> Template for creating new rules in `.agent-src.uncondensed/rules/{rule-name}.md`.
> Rules ship to `dist/agent-src/rules/` (condensed) and `.augment/rules/` (projected).
> Schema: `scripts/schemas/rule.schema.json`.

## Instructions

1. Pick a kebab-case `{rule-name}` matching the file stem.
2. Copy the template below into `.agent-src.uncondensed/rules/{rule-name}.md`.
3. Replace placeholders, drop sections that don't apply.
4. Run `task lint-skills` and `python3 scripts/lint_load_context.py`.
5. Condense: `bash scripts/condense.sh --changed` then follow the agent flow.

## Path conventions — load-bearing

Two different fields, two different rules. Mixing them up will either
break linting or produce paths that resolve to nothing in the
consumer's `.augment/`.

### `load_context:` / `load_context_eager:` — logical names

Use **logical names** rooted at the source — never the
`.agent-src.uncondensed/` prefix. The condense-time rewriter
(`scripts/condense.py::_rewrite_paths`) resolves logical names to
deployment-correct relative paths; the schema regex
(`scripts/schemas/rule.schema.json`) and `scripts/lint_load_context.py`
both reject the legacy prefix.

| Write this (logical) | Forbidden (legacy) |
|---|---|
| `contexts/execution/verification-mechanics.md` | `.agent-src.uncondensed/contexts/execution/verification-mechanics.md` |
| `contexts/authority/commit-mechanics.md` | `.agent-src.uncondensed/contexts/authority/commit-mechanics.md` |
| `agents/settings/contexts/local.md` (project-local) | `.agent-src.uncondensed/contexts/...` for project-only material |

### `triggers[].path_prefix:` — literal match pattern, not a file path

`path_prefix:` is a **literal match pattern** the host evaluates against
the file the agent is editing — it is **not** a file reference and is
**not rewritten**. Rules that fire when the agent edits source-of-truth
files legitimately keep the `.agent-src.uncondensed/` prefix (see
`skill-quality`, `rule-type-governance`,
`augment-edit-discipline`). Rules that fire on consumer-project paths use
`agents/`, `lang/`, `.augment/`, etc.

| Use case | Example `path_prefix:` |
|---|---|
| Fires when editing source-of-truth artifacts | `.agent-src.uncondensed/skills/` |
| Fires when editing consumer project files | `agents/`, `lang/`, `app/`, `src/` |
| Fires when editing the projected layer | `.augment/` |

### Body links — `../../docs/...` is fine in source

Source files keep verbatim `../../docs/guidelines/...` and
`../../docs/contracts/...` links so they work in any markdown viewer.
The rewriter rewrites them to depth-aware single-up form at condense
time and is idempotent. Do not pre-rewrite in source.

### Why "logical, depth-aware, idempotent"

A rule at `rules/{name}.md` resolves `contexts/{area}/{file}.md` to
`../contexts/{area}/{file}.md` in the condensed output; a nested
file at `commands/{cluster}/{sub}.md` resolves to
`../../contexts/{area}/{file}.md`. Re-running the rewriter does not
double-prefix. The full decision history lives in the archived
path-fixes roadmap under `agents/roadmaps/archive/`.

## Template

````markdown
---
type: "always"
tier: "kernel"
description: "{One-line trigger sentence — what fires this rule}"
source: package
# council_depth: deep   # uncomment for rules that gate architecture/refactor/bug-diagnose flows
load_context:
  - contexts/{area}/{file}.md
triggers:
  - path_prefix: "{project-relative path or .augment/...}"
  - keyword: "{trigger-keyword}"
routes_to:
  - "skill:{target-skill}"
---

# {Rule Title}

<!-- Default-terse per the
  [Frugality Charter](../contexts/contracts/frugality-charter.md):
  start with the obligation. No "This rule explains…" / "The purpose of
  this rule is…" / narrative intro before the Iron Law. Body sections
  are pointers, not playbooks — defer detail to skills/guidelines. -->

**Iron Law.** {The single non-negotiable behavior the rule enforces.}

## When this fires

{1–3 bullets on the trigger surface — what the agent is doing when this rule applies.}

## What to do

{Numbered procedure or short directive list. Reference skills / guidelines
for full detail; rules are pointers, not playbooks.}

## What NOT to do

- {Anti-pattern 1}
- {Anti-pattern 2}

## See also

- [`{related-rule}`](./{related-rule}.md)
- [`{guideline-ref}`](docs/guidelines/{group}/{name}.md) — full pattern catalog
````

## Field reference

| Field | Required | Notes |
|---|---|---|
| `type` | yes | `always` or `auto`. Always-rules load every turn; auto-rules require trigger match. |
| `tier` | yes | `kernel` (Iron Law floor), `tier-1` (default), `tier-2` (full profile only). Legacy values still accepted. |
| `description` | yes | One sentence, ≤ 500 chars. Trigger-clarity wins over poetry. |
| `source` | yes | `package` (this repo) or `project` (consumer override). |
| `load_context` | no | Lazy context list — logical names only. Budget enforced by `lint_load_context.py`. |
| `load_context_eager` | no | Eager context list — counts against per-rule char budget. |
| `triggers` | no | Required on non-kernel rules per `rule-router.md`. |
| `routes_to` | no | `skill:`, `guideline:`, `command:`, `contract:` targets. Forbidden on kernel rules. |
| `alwaysApply` | no | Cursor/Cline sidecar — by convention `true` for `type: always`. |
| `council_depth` | no | Only `deep` is accepted; **omit the key for default depth** (`standard` is the implicit default and is rejected by the schema — every frontmatter byte counts). Set `deep` when this rule gates AI Council on architecture, refactoring, or bug-diagnosis flows. Host translates to `--depth deep` on the council CLI. See `.augment/skills/ai-council/SKILL.md`. |

## Size budget

- Kernel rules: ≤ 4 000 chars (Iron-Law overrides documented in `docs/contracts/iron-law-overrides.txt`).
- Non-kernel rules: ≤ 2 500 chars.
- Enforced by `task lint-rule-budget`.
