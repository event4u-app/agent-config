# Windsurf Setup

Windsurf reads two rule formats:

- **Wave-8 (`.windsurf/rules/`)** — per-rule `.md` files with
  `trigger`, `description`, `globs` frontmatter. Preferred for
  Windsurf 1.5+.
- **Legacy (`.windsurfrules`)** — single-file aggregate at the repo
  root. Older Windsurf builds and the Cascade chat fallback both still
  read it.

The package ships **both**.

## Prerequisites

- Windsurf 1.0+ (Codeium): <https://codeium.com/windsurf>.
- Node.js ≥ 18.

## Project install

```bash
npx @event4u/create-agent-config init --tools=windsurf
```

Populates:

- `.windsurf/rules/*.md`        — modern Wave-8 per-rule files
- `.windsurf/workflows/*.md`    — slash-command workflows
- `.windsurfrules`              — legacy single-file aggregate
- `.agent-settings.yml`         — per-project knobs

Combine with other surfaces:

```bash
npx @event4u/create-agent-config init --tools=windsurf,claude-code,cursor
```

## Wave-8 frontmatter

Each rule under `.windsurf/rules/` has the Windsurf-shaped header:

```md
---
trigger: always_on
description: Scope control — no unsolicited architectural changes
globs:
---

# Scope Control
...
```

- `trigger: always_on` ↔ source `type: "always"` (kernel rules).
- `trigger: model_decision` ↔ Cascade decides per turn (auto rules).
- `globs:` is intentionally empty in the package's projection — set
  per-rule in your fork if you want path-scoped triggering.

## Workflows

`.windsurf/workflows/<slug>.md` mirrors `.claude/commands/`. Cluster
commands flatten to `<cluster>-<name>.md`. Cascade lists all workflow
files in its workflow palette.

## Cascade integration

Cascade (Windsurf's built-in agent) reads `.windsurf/rules/` and
`.windsurf/workflows/` automatically. No separate registration step is
needed once the files are on disk.

When Cascade asks a clarifying question, the package's `user-interaction`
rule (kernel, `always_on`) applies — Cascade will surface numbered
options with a single recommendation.

## Workspace vs global precedence

| Layer | Path | Precedence |
|---|---|---|
| Workspace | `.windsurf/rules/` + `.windsurf/workflows/` | wins on conflicts |
| Global | `~/.codeium/windsurf/global_workflows/` | falls back when workspace silent |

Reuse the same `--tools=windsurf` flag for both — `init` writes
workspace, `global` writes user-level.

## Verification

```bash
ls .windsurf/rules/     | head -5      # *.md per-rule files
ls .windsurf/workflows/ | head -5      # *.md workflow files
test -f .windsurfrules                 # legacy aggregate exists
```

In Windsurf itself: open Cascade → Workflows panel — listed workflows
should match `ls .windsurf/workflows/`.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Rules not picked up | Windsurf < 1.0 — upgrade or rely on `.windsurfrules`. |
| Workflow not in Cascade panel | Reload window after `task generate-tools`. |
| Global workflows missing | Check `~/.codeium/windsurf/global_workflows/` exists. |
| Frontmatter parse error | Re-run `python3 scripts/compress.py --generate-tools`. |

## Cross-references

- [`docs/installation.md`](../../installation.md) — install matrix index.
- [`templates/windsurf-rule.md.j2`](../../../templates/windsurf-rule.md.j2)
  — template used by the projection generator.
- [`AGENTS.md`](../../../AGENTS.md) — package self-orientation.
