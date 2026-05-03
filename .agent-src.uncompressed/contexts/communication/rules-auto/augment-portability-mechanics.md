# Augment portability — mechanics

`task`-to-script translation table, the `./agent-config` consumer-CLI
table, and the rationale behind both for the
[`augment-portability`](../../../rules/augment-portability.md) rule.
The portability obligation, the agnostic-content rules, and the
enforcement script reference live in the rule; this file is the
lookup material when an agent is about to write or edit an artefact
that mentions a runtime invocation.

## Why no `task` commands inside artefacts

Skills, rules, commands, guidelines, personas, and context docs
shipped by this package run in **consumer projects**. Consumer
projects may not have [Task](https://taskfile.dev) installed —
they might use npm scripts, Composer scripts, Make, or nothing at
all. A skill that instructs an agent to run `task <something>`
silently breaks in every project without a `Taskfile.yml`.

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

## Translation table — `task` → script

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
