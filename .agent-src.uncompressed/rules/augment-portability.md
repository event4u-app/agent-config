---
type: "auto"
description: "Editing or creating files inside .augment/ directory — skills, rules, commands, templates, contexts must be project-agnostic"
source: package
---

# Package Portability

Everything that ships with the `event4u/agent-config` package MUST be
**project-agnostic**. That includes:

- Everything inside `.augment/` (skills, rules, commands, guidelines,
  templates, contexts)
- The package repo's own root `AGENTS.md`
- The package repo's own `.github/copilot-instructions.md`

All three are either installed into consumer projects (`.augment/` via
`install.sh`) or read by AI tools when working on the package itself
(`AGENTS.md`, `copilot-instructions.md`). Leaking consumer-specific
content into any of them pollutes downstream projects or misleads agents.

## Rules

- NEVER reference a specific consumer project, repo name, domain, or tech
  stack directly. The package repo itself (`event4u/agent-config`) MAY be
  named inside its own root `AGENTS.md` and `copilot-instructions.md` —
  that is meta about the package, not a leak.
- NEVER hardcode consumer-project paths, class names, or conventions.
- Write content so it works as a **reusable package** across any project.
- Project-specific behavior belongs in the **consumer's** `.agent-settings.yml`,
  `AGENTS.md`, or `agents/` — never in files shipped by this package.
- If a skill or rule needs project-specific input, read it from
  `.agent-settings.yml` or accept it as a parameter.
- When reviewing or editing package files, always ask: "Would this still
  make sense in a completely different project?"

## Runtime invocations — no `task` commands

Skills, rules, commands, guidelines, personas, and context docs
shipped by this package run in **consumer projects**. Consumer
projects may not have [Task](https://taskfile.dev) installed —
they might use npm scripts, Composer scripts, Make, or nothing at
all. A skill that instructs an agent to run `task <something>`
silently breaks in every project without a `Taskfile.yml`.

**Rule:** Never reference a `task <something>` invocation inside any
artefact file under `.agent-src.uncompressed/{skills,rules,commands,guidelines,personas,contexts}/`
(and therefore also not in the compressed mirror under `.agent-src/`).
Use the direct script invocation instead:

| ❌ Forbidden | ✅ Portable |
|---|---|
| `task sync` | `bash scripts/compress.sh --sync` |
| `task sync-check` | `bash scripts/compress.sh --check` |
| `task sync-check-hashes` | `bash scripts/compress.sh --check-hashes` |
| `task sync-changed` | `bash scripts/compress.sh --changed` |
| `task sync-mark-done -- X` | `bash scripts/compress.sh --mark-done X` |
| `task generate-tools` | `python3 scripts/compress.py --generate-tools` |
| `task lint-skills` | `python3 scripts/skill_linter.py --all` |
| `task check-refs` | `python3 scripts/check_references.py` |
| `task check-portability` | `python3 scripts/check_portability.py` |
| `task check-compression` | `python3 scripts/check_compression.py` |
| `task validate-schema` | `python3 scripts/validate_frontmatter.py` |
| `task counts-check` | `python3 scripts/update_counts.py --check` |
| `task roadmap-progress` | `./agent-config roadmap:progress` |
| `task ci` | run each underlying script directly (no single portable equivalent) |

Task remains a convenience shortcut for maintainers working on the
package repo itself — `task ci` is the recommended local gate before
a PR and lives in `Taskfile.yml`, `AGENTS.md`, and the package README.
Those maintainer-facing surfaces are outside the scope of this rule.
Artefact files must assume Task is absent.

The detection pattern *"if the consumer has a `Makefile` / build
script, prefer its targets over raw commands"* is still allowed when
the skill adapts to the **consumer's own** tooling (e.g.
`tests-execute` detecting `php artisan test` vs `vendor/bin/pest`).
It is not allowed to reference `task <name>` as the detected target —
every direct invocation must resolve to a real script path.

## Consumer CLI — `./agent-config`

A subset of package scripts is exposed through a project-local CLI
wrapper `./agent-config` (written into the project root by the
installer, gitignored). Artefacts MUST prefer the CLI over raw
`python3 scripts/…` paths for every command the CLI already covers,
because the raw paths only resolve inside the package repo — in a
consumer project the scripts live under `node_modules/` or `vendor/`.

| ❌ Forbidden in artefacts | ✅ Portable |
|---|---|
| `python3 scripts/mcp_render.py` | `./agent-config mcp:render` |
| `python3 scripts/mcp_render.py --check` | `./agent-config mcp:check` |
| `python3 .augment/scripts/update_roadmap_progress.py` | `./agent-config roadmap:progress` |
| `python3 .augment/scripts/update_roadmap_progress.py --check` | `./agent-config roadmap:progress-check` |
| `bash scripts/first-run.sh` | `./agent-config first-run` |
| `PYTHONPATH=… python3 -m implement_ticket` | `./agent-config implement-ticket` |
| `python3 scripts/memory_lookup.py` | `./agent-config memory:lookup` |
| `python3 scripts/memory_signal.py` | `./agent-config memory:signal` |
| `python3 scripts/memory_hash.py` | `./agent-config memory:hash` |
| `python3 scripts/check_memory.py` | `./agent-config memory:check` |
| `python3 scripts/check_memory_proposal.py` | `./agent-config memory:check-proposal` |
| `python3 scripts/check_proposal.py` | `./agent-config proposal:check` |
| `python3 scripts/refine_ticket_detect.py` | `./agent-config refine-ticket:detect` |

Commands not covered by the CLI stay as direct script invocations
(e.g. `bash scripts/compress.sh --sync`) — those are maintainer-only
and not reachable from a consumer project anyway.

## Enforcement

`scripts/check_portability.py` scans `.augment/`, `.agent-src.uncompressed/`,
and the package repo's root `AGENTS.md` + `.github/copilot-instructions.md`
for forbidden identifiers, for any `task <name>` invocation inside
artefact files, and for direct script invocations that bypass the
`./agent-config` CLI. It runs in CI and must pass before any PR.
