# 👩‍💻 The `developer` experience

> Set `profile.id: developer` (the wizard's first question, or
> `agent-config use --profile=developer`). **Preset default: `balanced`.**

## Who it's for

The IC engineer — implement a ticket end-to-end, fix CI red, self-review before
the PR. Stack-aware across Laravel · Symfony · Next.js · React · Node.

## First three tasks

1. **Implement a ticket** — `/implement-ticket` refines it, plans, edits, tests, verifies.
2. **Fix a red build** — `/fix:ci` reads the failure and drives it green.
3. **Self-review the diff** — `/review-changes` dispatches five judges (bug, security, tests, quality, architecture).

## First commands

`/work` · `/implement-ticket` · `/review-changes` · `/fix` · `/commit`

## Packs that activate

`engineering-base` (+ `meta`, always on). Language/framework packs (laravel, php,
react, …) overlay per session from the project's detected stack.

## Flows that apply

All four — this is the home profile for the developer journey:
**[discovery](../flows.md) → implementation → review → delivery**.

## What is NOT loaded

No `gtm-marketing`, `ai-video`, `finance-*`, or `founder-strategy` packs — no
ghostwriter, video, DCF, or fundraising surfaces. The profile stays focused on
shipping code.

## Example

> *"Implement PROJ-412."* → `/implement-ticket` refines acceptance criteria,
> plans the change, edits with `minimal-safe-diff`, runs the suite via
> `test-driven-development`, and stops on fresh green evidence
> (`verify-completion-evidence`) — then `/review-changes` before you open the PR.

## See also

[Profile (deep)](../profiles.md#profile-developer) ·
[Role guide](../getting-started-by-role.md#developer-the-original-audience) ·
[Flows](../flows.md) ·
key skills: `developer-like-execution` · `verify-completion-evidence` · `minimal-safe-diff` · `systematic-debugging` · `test-driven-development`.
