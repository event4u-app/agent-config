# Consumer Settings Templates

These templates show how to configure your project to use `agent-config` as a native plugin
instead of copying files via `install.sh`.

## Quick Setup by Tool

### Augment CLI

1. Add marketplace: `auggie plugin marketplace add event4u-app/agent-config`
2. Install plugin: `auggie plugin install governed-agent-system@event4u-agent-config`
3. Optional: Copy `augment-settings.json` into your project's `.augment/settings.json` to auto-recommend for your team.

### Claude Code

1. Add marketplace: `claude plugin marketplace add event4u-app/agent-config`
2. Install plugin: `claude plugin install governed-agent-system@event4u-agent-config`
3. Optional: Copy `claude-settings.json` into your project's `.claude/settings.json`.

### Copilot CLI

1. Add marketplace: `copilot plugin marketplace add event4u-app/agent-config`
2. Install plugin: `copilot plugin install governed-agent-system@event4u-agent-config`
3. Optional: Copy `copilot-settings.json` into your project's `.github/copilot/settings.json`.

### Cursor / Cline / Windsurf / Augment VSCode

These tools do **not** support plugins yet. Use the classic `install.sh` approach:

```bash
bash vendor/event4u/agent-config/scripts/install.sh --target .
```

## What the plugin provides

When installed as a plugin, the agent gets access to:

- **Rules** — Always-active behavior constraints (`.augment/rules/`)
- **Skills** — On-demand domain expertise (`.augment/skills/`)
- **Commands** — Workflow automations (`.augment/commands/`)
- **Guidelines** — Coding standards (`.augment/guidelines/`)

## Auto-updates

Plugin marketplaces auto-update in the background (Augment CLI and Claude Code).
No manual `git pull` or `install.sh` re-runs needed.
