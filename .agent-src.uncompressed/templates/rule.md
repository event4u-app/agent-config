# Rule Template

> Template for creating new rules in `.agent-src.uncompressed/rules/{rule-name}.md`.
> Rules ship to `.agent-src/rules/` (compressed) and `.augment/rules/` (projected).
> Schema: `scripts/schemas/rule.schema.json`.

## Instructions

1. Pick a kebab-case `{rule-name}` matching the file stem.
2. Copy the template below into `.agent-src.uncompressed/rules/{rule-name}.md`.
3. Replace placeholders, drop sections that don't apply.
4. Run `task lint-skills` and `python3 scripts/lint_load_context.py`.
5. Compress: `bash scripts/compress.sh --changed` then follow the agent flow.

## Path conventions — load-bearing

Two different fields, two different rules. Mixing them up will either
break linting or produce paths that resolve to nothing in the
consumer's `.augment/`.

### `load_context:` / `load_context_eager:` — logical names

Use **logical names** rooted at the source — never the
`.agent-src.uncompressed/` prefix. The compress-time rewriter
(`scripts/compress.py::_rewrite_paths`) resolves logical names to
deployment-correct relative paths; the schema regex
(`scripts/schemas/rule.schema.json`) and `scripts/lint_load_context.py`
both reject the legacy prefix.

| Write this (logical) | Forbidden (legacy) |
|---|---|
| `contexts/execution/verification-mechanics.md` | `.agent-src.uncompressed/contexts/execution/verification-mechanics.md` |
| `contexts/authority/commit-mechanics.md` | `.agent-src.uncompressed/contexts/authority/commit-mechanics.md` |
| `agents/contexts/local.md` (project-local) | `.agent-src.uncompressed/contexts/...` for project-only material |

### `triggers[].path_prefix:` — literal match pattern, not a file path

`path_prefix:` is a **literal match pattern** the host evaluates against
the file the agent is editing — it is **not** a file reference and is
**not rewritten**. Rules that fire when the agent edits source-of-truth
files legitimately keep the `.agent-src.uncompressed/` prefix (see
`skill-quality`, `docs-sync`, `rule-type-governance`,
`augment-portability`). Rules that fire on consumer-project paths use
`agents/`, `lang/`, `.augment/`, etc.

| Use case | Example `path_prefix:` |
|---|---|
| Fires when editing source-of-truth artifacts | `.agent-src.uncompressed/skills/` |
| Fires when editing consumer project files | `agents/`, `lang/`, `app/`, `src/` |
| Fires when editing the projected layer | `.augment/` |

### Body links — `../../docs/...` is fine in source

Source files keep verbatim `../../docs/guidelines/...` and
`../../docs/contracts/...` links so they work in any markdown viewer.
The rewriter rewrites them to depth-aware single-up form at compress
time and is idempotent. Do not pre-rewrite in source.

### Why "logical, depth-aware, idempotent"

A rule at `rules/foo.md` resolves `contexts/x.md` to `../contexts/x.md`
in the compressed output; a nested file at `commands/cluster/sub.md`
resolves to `../../contexts/x.md`. Re-running the rewriter does not
double-prefix. See Phase 1-3 of `agents/roadmaps/road-to-path-fixes.md`
for the full decision history.

## Template

````markdown
---
type: "always"
tier: "kernel"
description: "{One-line trigger sentence — what fires this rule}"
source: package
load_context:
  - contexts/{area}/{file}.md
triggers:
  - path_prefix: "{project-relative path or .augment/...}"
  - keyword: "{trigger-keyword}"
routes_to:
  - "skill:{target-skill}"
---

# {Rule Title}

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

## Size budget

- Kernel rules: ≤ 4 000 chars (Iron-Law overrides documented in `docs/contracts/iron-law-overrides.txt`).
- Non-kernel rules: ≤ 2 500 chars.
- Enforced by `task lint-rule-budget`.
