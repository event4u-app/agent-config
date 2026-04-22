---
type: auto
source: package
description: "When a CLI tool needed for the task is not installed — ask before working around it; do NOT install silently"
---

# Missing Tool Handling

When a CLI tool is needed and **not installed** (`command not found`,
`which X` empty), **STOP and ask** before working around it or installing it.

## The rule

- **Never install silently.** Installing changes the user's system —
  requires explicit permission (`scope-control`).
- **Never silently work around** a missing tool with a brittle substitute
  (awk for YAML, `grep` for JSON, string splicing) when a proper tool is
  the standard answer. The workaround hides the dependency.
- **Ask with numbered options** (`user-interaction`). State the tool, why
  it fits, the install command, and the workaround cost.

## When it applies

- Shell returns `command not found` for a tool the task genuinely needs
  (yq, jq, rtk, gh, docker, mkcert, terraform, …).
- A skill or spike needs the idiomatic tool but it's absent locally.
- You're about to substitute a verbose script for a single tool call
  because the tool isn't there.

## When it does NOT apply

- Nice-to-have — clean substitute already present (e.g. `jq` available →
  no `yq` needed just for JSON).
- Tool is forbidden by project policy (check `scope-control` and
  tool-allowlists first).
- Missing library dependency → use `composer`, `npm`, `pip` per package
  rules, still with explicit permission.

## How to ask

```
> `yq` is not installed. It's the cleanest way to parse the ticket YAML
> in the Bash prototype — the alternative is shelling out to python3,
> which adds ~50ms to every run.
>
> 1. Install via `brew install yq` (recommended — one-time, stays on PATH)
> 2. Use the python3 fallback — slower but no install needed
> 3. Drop YAML — convert fixtures to JSON, use `jq` only
> 4. Skip this path — I propose a different approach
```

After the user picks: if **install**, wait for confirmation or run the
documented command only if explicitly authorised this turn. If
**workaround**, record the decision in the artefact (comment or ADR).

## Capture the learning

If the same tool keeps missing across tasks, flag it in the project's
setup docs or `.agent-settings.yml` prerequisites.

See also: `scope-control` · `ask-when-uncertain` · `user-interaction` ·
`tool-safety`.
