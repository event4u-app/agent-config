---
type: auto
tier: "2a"
source: package
description: "When a CLI tool needed for the task is not installed — ask before working around it; do NOT install silently"
---

# Missing Tool Handling

When a CLI tool is needed to solve the task cleanly and is **not installed**
(`command not found`, `which X` empty, missing from `$PATH`), **STOP and ask**
before working around it or installing it.

## The rule

- **Never install silently.** Installing is an action that changes the user's
  system — it requires explicit permission (see `scope-control`).
- **Never silently work around** a missing tool with a brittle substitute
  (awk-regex for YAML, `grep` for JSON, string splicing) when a proper tool
  is the standard answer for the job. The workaround hides the real
  dependency and makes the decision invisible to the user.
- **Ask with numbered options** (see `user-interaction`). State which tool,
  why it's the best fit, the install command, and the workaround cost.

## When it applies

- Any shell command fails with `command not found` for a tool the task
  genuinely needs (yq, jq, rtk, gh, docker, mkcert, terraform, …).
- A skill or spike requires a tool that is the idiomatic answer but is
  absent locally.
- You are about to substitute a verbose script for a single tool invocation
  because the tool isn't there.

## When it does NOT apply

- The tool is a nice-to-have and a clean substitute already exists in the
  repo (e.g. `jq` present → no need for `yq` just for JSON).
- The tool is explicitly forbidden by project policy (check
  `scope-control` and tool-allowlists first).
- The missing artefact is a library dependency — those go through
  `composer require`, `npm install`, `pip install` per the package-manager
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

After the user picks: if **install**, wait for confirmation that it is
done (or run the documented install command only if the user explicitly
authorises it in this turn). If **workaround**, record the decision in
the artefact (comment or ADR) so the cost is visible.

## Capture the learning

If the same tool keeps coming up as missing across multiple tasks, flag
it in the project's setup docs or `.agent-settings.yml` prerequisites.
Don't make every session re-discover the gap.

See also: `scope-control` · `ask-when-uncertain` · `user-interaction` ·
`tool-safety`.
