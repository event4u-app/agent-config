# Onboarding — using `event4u/agent-config` in this project

A short tour for new developers joining a project that ships with `event4u/agent-config`.

## What you just installed

A shared agent-configuration package — skills, rules, commands, and guidelines that make AI coding assistants (Claude Code, Augment, Cursor, Cline, Windsurf, Copilot, Gemini CLI) behave consistently across this project. Detail: [`agents/reference/docs/onboarding.md`](../../agents/reference/docs/onboarding.md) in the package source.

## How the AI tools see it

Each AI tool reads its own subtree under the project root — `.claude/skills/`, `.augment/`, `.cursor/rules/`, `.clinerules/`, `.windsurf/rules/`, `.github/copilot-instructions.md`. The installer projects the same content into each subtree from the canonical source so the agent behaves the same in every tool.

## When something looks wrong — read this first

The package has well-known **harness behaviours** that look like bugs but are not. Before opening an issue or rolling back, check the [`harness-expectations`](../../docs/contracts/harness-expectations.md) contract:

1. **Sibling-plugin namespaces** — skills like `codex:*` or `cc-gemini-plugin:*` are from other AI plugins, not from this package.
2. **Deferred tools** — the harness exposes some tools (TaskCreate, WebFetch, MCP tools) only after `ToolSearch` for context-budget reasons. Not a package bug.
3. **Duplicate skill registration** — same skill showing twice usually means a stale install at the **other scope** (user-global vs project-local). Run `task probe:skills` to confirm, then `bash scripts/cleanup_other_scope.sh --confirm` to clean.

The first step on every "this looks broken" report is:

```bash
task probe:skills
```

This surfaces every registration across all six tools and flags `DUPLICATE` / `DRIFT` findings before you go further. Background: [`docs/contracts/install-scopes.md`](../../docs/contracts/install-scopes.md) + [`docs/contracts/skill-distribution-channels.md`](../../docs/contracts/skill-distribution-channels.md).

## Next steps

- Run `agent-config setup` to open the GUI wizard if you haven't.
- Read [`AGENTS.md`](../../AGENTS.md) — the universal cross-tool contract.
- Pick a starter command: `/work` to plan, `/implement-ticket` to execute, `/commit` to ship.
- If you maintain the package itself: [`AGENTS.md` § Emergency triage](../../AGENTS.md) and [`docs/customization.md`](../../docs/customization.md) point at the rest.

## See also

- [`docs/contracts/harness-expectations.md`](../../docs/contracts/harness-expectations.md) — "looks like a bug, isn't" diagnostics.
- [`docs/contracts/install-scopes.md`](../../docs/contracts/install-scopes.md) — when to use project-local vs user-global.
- [`docs/customization.md` § Troubleshooting](../../docs/customization.md#troubleshooting) — the troubleshooting front door.
- [`agents/reference/docs/onboarding.md`](../../agents/reference/docs/onboarding.md) — the longer, package-side onboarding doc.
