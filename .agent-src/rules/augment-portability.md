---
type: "auto"
description: "Editing or creating files inside .augment/ directory — skills, rules, commands, templates, contexts must be project-agnostic"
source: package
---

# Package Portability

Everything shipped with `event4u/agent-config` MUST be **project-agnostic**:

- `.augment/` (skills, rules, commands, guidelines, templates, contexts)
- Package root `AGENTS.md`
- Package `.github/copilot-instructions.md`

All three are either installed into consumer projects (`.augment/` via
`install.sh`) or read by AI tools working on the package itself. Leaking
consumer-specific content pollutes downstream or misleads agents.

## Rules

- NEVER reference a specific consumer project, repo, domain, or tech
  stack. The package repo itself (`event4u/agent-config`) MAY appear
  in its own root `AGENTS.md` / `copilot-instructions.md` — meta about
  the package, not a leak.
- NEVER hardcode consumer-project paths, class names, or conventions.
- Write content so it works as a reusable package across any project.
- Project-specific behavior belongs in the **consumer's**
  `.agent-settings.yml`, `AGENTS.md`, or `agents/` — never here.
- If a skill/rule needs project-specific input: read from
  `.agent-settings.yml` or accept as parameter.
- Always ask when editing package files: "Would this still make sense
  in a completely different project?"

## Runtime invocations — no `task` commands

Skills, rules, commands, guidelines, personas, contexts shipped by this
package run in **consumer projects** that may not have Task installed.
NEVER reference a `task <name>` invocation inside any artefact file
under `.agent-src.uncompressed/{skills,rules,commands,guidelines,personas,contexts}/`
(or the compressed mirror under `.agent-src/`). Use the direct script:

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
| `task ci` | run each underlying script directly |

Task stays a convenience for package maintainers (`Taskfile.yml`,
`AGENTS.md`, README). Artefact files must assume Task is absent.

## Consumer CLI — `./agent-config`

A subset of scripts is exposed through a project-local CLI wrapper
`./agent-config` (written into the project root by the installer,
gitignored). Artefacts MUST prefer the CLI over raw `python3 scripts/…`
paths for every command it covers — raw paths only resolve inside the
package repo, in consumer projects the scripts live under
`node_modules/` or `vendor/`.

| ❌ Forbidden in artefacts | ✅ Portable |
|---|---|
| `python3 scripts/mcp_render.py` | `./agent-config mcp:render` |
| `python3 scripts/mcp_render.py --check` | `./agent-config mcp:check` |
| `python3 .augment/scripts/update_roadmap_progress.py` | `./agent-config roadmap:progress` |
| `python3 .augment/scripts/update_roadmap_progress.py --check` | `./agent-config roadmap:progress-check` |
| `bash scripts/first-run.sh` | `./agent-config first-run` |

Commands not covered by the CLI stay as direct script invocations
(e.g. `bash scripts/compress.sh --sync`) — maintainer-only, not
reachable from a consumer project anyway.

## Enforcement

`scripts/check_portability.py` scans `.augment/`, `.agent-src.uncompressed/`,
and the package root `AGENTS.md` + `.github/copilot-instructions.md` for
forbidden identifiers, for any `task <name>` invocation, and for direct
script invocations that bypass the `./agent-config` CLI. Runs in CI —
must pass before any PR.
