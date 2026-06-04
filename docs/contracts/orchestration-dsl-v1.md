---
stability: beta
keep-beta-until: 2026-08-12
---

# Orchestration DSL v1

**Purpose.** Pin the YAML schema that the `/orchestrate` command
reads to chain personas / skills / sub-agents into reproducible
pipelines. A pipeline file is a deterministic, reviewable artifact
that re-runs the same step sequence with the same inputs.

**Scope.** Defines the file location, top-level shape, step kinds,
input / output wiring, and the linter contract. Does **not** define
the runtime semantics of each step kind — those live in the
[`/orchestrate`](../../.agent-src.uncondensed/commands/orchestrate.md)
command and the `work_engine` directive modules it delegates to.

Last refreshed: 2026-05-11.

## File location

```
.agent-config/orchestrations/<name>.yaml
```

`<name>` is kebab-case, matches the `name` field inside the file,
and is unique across the consumer project's orchestrations directory.
The directory is opt-in — `/orchestrate` falls back to the prompt
when no file exists.

## Top-level shape

```yaml
schema_version: 1
name: pr-readiness-check
description: |
  Run the four review-lens judges against the current diff, then
  consolidate verdicts into a single Markdown report.
inputs:
  - id: diff_target
    description: Git ref to diff against. Default origin/main.
    default: origin/main
steps:
  - id: bug
    kind: skill
    ref: judge-bug-hunter
    with:
      diff_target: ${{ inputs.diff_target }}
  - id: security
    kind: skill
    ref: judge-security-auditor
    with:
      diff_target: ${{ inputs.diff_target }}
  - id: tests
    kind: skill
    ref: judge-test-coverage
    with:
      diff_target: ${{ inputs.diff_target }}
  - id: quality
    kind: skill
    ref: judge-code-quality
    with:
      diff_target: ${{ inputs.diff_target }}
  - id: consolidate
    kind: command
    ref: review-changes
    with:
      verdicts:
        - ${{ steps.bug.output }}
        - ${{ steps.security.output }}
        - ${{ steps.tests.output }}
        - ${{ steps.quality.output }}
outputs:
  report: ${{ steps.consolidate.output }}
```

## Field semantics

| Field | Type | Required | Meaning |
|---|---|---|---|
| `schema_version` | int | yes | Always `1`. Major bump on breaking changes. |
| `name` | string | yes | Kebab-case identifier; matches filename. |
| `description` | string | yes | One-paragraph statement of intent. |
| `inputs[]` | list | no | Named pipeline inputs. Each has `id`, `description`, optional `default`. |
| `steps[]` | list | yes | Ordered list of steps. Min 1, max 32. |
| `steps[].id` | string | yes | Snake-case identifier; unique within the pipeline. |
| `steps[].kind` | enum | yes | One of `skill` · `command` · `persona` · `subagent`. |
| `steps[].ref` | string | yes | Reference id matching the `kind` namespace. |
| `steps[].with` | map | no | Inputs to the step. Values MAY use `${{ inputs.X }}` / `${{ steps.Y.output }}` interpolation. |
| `steps[].when` | string | no | Conditional expression — runs the step only if truthy. Limited to `${{ steps.X.output }}` equality and `success` / `failure` predicates. |
| `outputs` | map | no | Named pipeline outputs. Surfaced in the final delivery report. |

## Step kinds

| `kind` | `ref` resolves to | Runtime |
|---|---|---|
| `skill` | `.agent-src.uncondensed/skills/<ref>/SKILL.md` | Dispatched via `work_engine` directive matching the skill's domain. |
| `command` | `.agent-src.uncondensed/commands/<ref>.md` | Same dispatch path the slash-command takes when typed by the user. |
| `persona` | `.agent-src.uncondensed/personas/<ref>.md` | Sets `roles.active_role` for the next dependent step; does not produce its own output. |
| `subagent` | `subagent-orchestration` mode name | Spawned per [`subagent-orchestration`](../../.agent-src.uncondensed/skills/subagent-orchestration/SKILL.md). |

## Interpolation

Two namespaces only:

```
${{ inputs.<input-id> }}
${{ steps.<step-id>.output }}
```

Unknown namespaces hard-fail at lint time. The interpolation engine
does string substitution — there are no expressions, no arithmetic,
no shell-out.

## Linter contract

`scripts/lint_orchestration_dsl.py` hard-fails on:

- missing or malformed top-level keys (`schema_version`, `name`,
  `description`, `steps`)
- `schema_version != 1`
- `name` not matching `[a-z][a-z0-9-]*` or not matching the filename
- duplicate `steps[].id`
- `steps[].kind` outside the enum
- `steps[].ref` pointing at a non-existent skill / command / persona
- `${{ ... }}` reference to an unknown input or step id
- `steps[]` length > 32 or < 1
- `outputs` referencing an unknown step

Exit codes mirror [`lint_hook_manifest.py`](../../src/scripts/lint_hook_manifest.py): `0` clean, `1` failure, `2` schema-load error.

## Privacy floor

Pipeline files are committed artifacts. They MUST NOT contain:

- Secrets, tokens, environment values.
- Conversation bodies or transcripts.
- File contents (only paths and refs).

## Stability

Beta. Breaking changes between v1 and v2 are allowed in a minor
release if the change appears in `CHANGELOG.md` under a `### Breaking`
heading. Engines MUST gate on `schema_version` and refuse unknown
majors.

## Cross-references

- Command surface: [`/orchestrate`](../../.agent-src.uncondensed/commands/orchestrate.md).
- Linter: [`lint_orchestration_dsl.py`](../../src/scripts/lint_orchestration_dsl.py).
- Runtime dispatcher precedent: [`implement-ticket-flow.md`](implement-ticket-flow.md).
- Subagent runtime: [`subagent-orchestration`](../../.agent-src.uncondensed/skills/subagent-orchestration/SKILL.md).
