---
stability: stable
---

# Namespace contract — skills, rules, commands, personas

> Every artefact name is a **stable identifier**: routed to from
> `dist/router.json`, cited from skills, surfaced in `/help`, embedded
> in command paths, and back-referenced in test fixtures. Drift breaks
> all five surfaces silently.
>
> **Source:** Step-11 Phase 5 Step 1
> (an internal parity roadmap (local-only)).
> **Enforcer:** [`scripts/lint_namespace.py`](../../src/scripts/lint_namespace.py),
> wired into `task lint-skills`.

## 1. Shape

```
<stem>-<intent>    kebab-case, ASCII, lowercase
```

| Component | Rule |
|---|---|
| Charset | `[a-z0-9-]+` only |
| Separator | single `-` between tokens; never `_`, `.`, or camelCase |
| Length | skills: 3 ≤ name ≤ 64 · rules / commands / personas: 2 ≤ name ≤ 64 (two-letter slot reserved for intentional acronyms — `pr`, `ci`, `qa`, `me`) |
| First char | `[a-z]` (digits and `-` forbidden at start) |
| Last char | `[a-z0-9]` (trailing `-` forbidden) |
| Run | no consecutive `--` |

The `<stem>` carries the **subject** (`commit`, `eloquent`,
`livewire`); the `<intent>` (optional) carries the **verb / lens**
(`-writing`, `-architect`, `-routing`). Single-token names are
permitted when the stem already encodes both (`commit`, `eloquent`,
`docker`).

## 2. Reserved names — forbidden as artefact names

| Name | Reason |
|---|---|
| `pattern` | Reserved for trigger-pattern fixtures (see `tests/fixtures/triggers/`). |
| `claude-memories` | Reserved for the `~/.claude/CLAUDE.md` shape — host-agent state, not a package artefact. |
| `default` | Ambiguous with profile / mode defaults; collides with `.agent-settings.yml` keys. |
| `index` | Reserved for auto-generated INDEX.md files. |
| `router` | Reserved for `dist/router.json` and the router contract. |

Reserved names apply at the **top level** of each artefact type. A
sub-verb under a namespaced group (e.g. `council/default.md` →
`/council:default`) is **not** a top-level identifier — the group
prefix disambiguates it, and reserved-name enforcement is skipped
for sub-verbs by the linter. A future artefact `pattern-foo` at the
top level is fine; bare `pattern` is not.

`README.md` and `INDEX.md` are documentation, not artefacts, and are
skipped by the linter.

## 3. Per-type conventions

| Type | Source path | Naming nuance |
|---|---|---|
| Skill | `.agent-src.uncondensed/skills/<name>/SKILL.md` | Directory name == frontmatter `name`. |
| Rule | `.agent-src.uncondensed/rules/<name>.md` | Filename stem == frontmatter `id` (when present). |
| Command | `.agent-src.uncondensed/commands/<name>.md` or `<group>/<verb>.md` | Slash-command invocation `<name>` or `<group>:<verb>`. |
| Persona | `.agent-src.uncondensed/personas/<name>.md` | Cited from skill frontmatter `personas:` list. |

Sub-namespacing (`commit/in-chunks.md` →  `/commit:in-chunks`) uses
the same charset rules per segment; the joining colon is implicit.

## 4. Linter — `scripts/lint_namespace.py`

Walks the four source roots above, asserts each artefact name:

1. Matches the regex `^[a-z][a-z0-9]*(-[a-z0-9]+)*$`.
2. Length 3 ≤ name ≤ 64.
3. Not in the reserved-names list.
4. Skill: directory name matches frontmatter `name`.

Exit codes:

| Exit | Meaning |
|---|---|
| `0` | All names valid. |
| `1` | At least one name fails a rule. |
| `2` | Linter crashed (filesystem error, malformed frontmatter). |

Diagnostic format: one issue per line — `<path>: <rule> — <detail>`.

## 5. Adding a new artefact

Pick the name; verify locally:

```bash
./scripts-run src/scripts/lint_namespace --name <candidate>
# or full run:
./scripts-run src/scripts/lint_namespace
```

If the candidate fails, the linter prints the rule it violated.
**Renames after release are expensive** — touch `dist/router.json`,
every skill citing the old name, the bench corpus, and consumer settings.
Pay the naming cost once, upfront.

## 6. Relationship to the frontmatter contract

The **shape** lives here. The **frontmatter keys** that carry the
name (`name:` in skills, `id:` in rules) live in
[`frontmatter-contract.md`](../../agents/reference/docs/frontmatter-contract.md).
Both contracts share the regex; this file is the source of truth for
the regex string.

## 7. Why this exists

`dist/router.json` resolves `<kind>:<id>` strings at session start. Any
artefact rename breaks every routing entry pointing at the old name
without compile-time error. The linter catches the rename at the PR
boundary, not at runtime in a consumer.

## 8. Out of scope

- File-system case sensitivity (we rely on lowercase-only names).
- Cross-tool aliases (Augment / Claude / Cursor all consume the same
  name — projection is by content, not by alias).
- Versioning suffixes (`-v2`, `-legacy`). Use `status: superseded`
  in frontmatter instead; never rename in place.
