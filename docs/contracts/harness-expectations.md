---
stability: beta
keep-beta-until: 2026-09-04
---

# Harness Expectations — when AI tool behaviour looks like a package bug but isn't

**Status:** Active (Phase D of `road-to-clean-skill-distribution-channels.md`)
**Owner:** maintainer-team
**Inputs:** Phase D roadmap steps + the 2026-05-25 misdiagnosis chat session that opened this track.

## The case for this document

On 2026-05-25 a Claude Code session surfaced three behaviours that looked like `event4u/agent-config` bugs. Two of the three turned out to be **host-harness behaviour** the package has no control over. The third (cross-scope skill drift) was a real package-side bug fixed in Phases A–C. This document captures the host-side three so the next agent / onboarding session / opened issue does not re-run the misdiagnosis loop.

## Class A — Plugin-namespaced peer skills

### Symptom

The session shows skills under namespaces like `codex:`, `cc-gemini-plugin:`, or another `<vendor>:` prefix:

```
- codex:setup
- cc-gemini-plugin:gemini-agent
- codex:rescue
```

These names do NOT appear in `event4u/agent-config`'s skill catalog, the README, or the contracts.

### What's actually happening

Claude Code (and similar harnesses) supports **sibling plugins** in addition to the primary `event4u/agent-config` install. Each sibling plugin owns its own skills, namespaced by the plugin id. The harness surfaces every loaded plugin's skills in the same `<available_skills>` list during the session.

- `codex:*` skills come from a sibling plugin that wraps the Codex CLI.
- `cc-gemini-plugin:*` skills come from a sibling plugin that wraps Gemini-CLI integration.

`event4u/agent-config` does not ship, control, or update these plugins. They are independent installs by independent maintainers.

### What the package can do

Nothing — sibling plugins are out of scope by construction. The user can:

- Remove the sibling plugin if it is unwanted (via the harness's plugin management — outside this package).
- Ignore the namespaced names; they will not collide with this package's skill IDs because the prefix differs.

### Where to look for the true source

Per Claude Code: `claude plugin list` (or equivalent) shows every loaded plugin. Each `<vendor>:` namespace traces back to a plugin row in that listing. Bug reports for those skills go to the respective plugin maintainer.

## Class B — Deferred tools that need ToolSearch

### Symptom

A session sees a `<system-reminder>` block like:

```
The following deferred tools are now available via ToolSearch.
Their schemas are NOT loaded — calling them directly will fail with
InputValidationError. Use ToolSearch with query "select:<name>[,<name>...]"
to load tool schemas before calling them:
TaskCreate
WebFetch
Monitor
mcp__claude_ai_Linear__authenticate
...
```

The named tools are real — they show up in the harness's runtime — but the agent cannot call them directly because the tool **schema** isn't loaded yet.

### What's actually happening

Claude Code's tool-loading is **context-budgeted**. The full tool registry (TaskCreate, WebFetch, every MCP tool from every registered server, etc.) can be many kilobytes of JSON-schema. Loading every schema on every turn would blow the context budget for routine reads. The harness solves this by registering tool **names** up-front and deferring schema load until `ToolSearch` is called — that's the on-ramp.

This is not a package issue, and `event4u/agent-config` cannot pre-load these schemas — the harness owns the budget.

### What the package can do

Nothing — the loading strategy is the harness's contract with the model. Skills that want to use a deferred tool must:

1. Run `ToolSearch` with `select:<name>` to load the schema.
2. Call the tool with the now-known parameters.

Skills in this package that need deferred tools document the load step explicitly (see `agents-md-thin-root` § Tool loading for the pattern).

### Where to look for the true source

Per Claude Code's documentation on tool surfaces and the `ToolSearch` primitive. The package does not own this behaviour.

## Class C — Duplicate skill registration (real package bug, fixed in Phases A–C)

### Symptom

The same skill appears twice in `<available_skills>` with different `description:` strings, or behaves inconsistently across calls.

### What's actually happening

A user-global install (e.g. `~/.claude/skills/`) and a project-local install (`./.claude/skills/`) coexist at **different versions**. The harness loads both. The earlier register wins the description in some calls, the later in others.

Unlike Classes A and B, this is a real package-side issue.

### What the package does

1. **Default install is filesystem-only** ([`skill-distribution-channels.md`](skill-distribution-channels.md)).
2. **Pre-flight scope guard** refuses installs that would create cross-scope drift ([`install-scopes.md`](install-scopes.md)).
3. **Post-install probe** surfaces any remaining drift after install (`task probe:skills`).
4. **Cleanup script** for stale other-scope installs (`bash scripts/cleanup_other_scope.sh --confirm`).

### Where to look for the true source

```bash
task probe:skills
```

The probe lists every duplicate / drift finding with the exact source paths so the cause is visible in one read.

## When in doubt — diagnostic sequence

1. Run `task probe:skills` — rules out Class C.
2. If the suspicious skill carries a `<vendor>:` prefix you don't recognise → Class A. Check `claude plugin list`.
3. If the harness logs `deferred tools … available via ToolSearch` → Class B. The skill needs an explicit `ToolSearch` step.
4. None of the above → file an issue at https://github.com/event4u-app/agent-config with the output of `task probe:skills` attached.

## See also

- [`skill-distribution-channels.md`](skill-distribution-channels.md) — canonical channel per tool.
- [`install-scopes.md`](install-scopes.md) — scope guard contract.
- [`agents/evidence/audits/2026-05-distribution-channels/`](../../agents/evidence/audits/2026-05-distribution-channels/) — the underlying audits.
- [`README.md` § Harness expectations](../../README.md#harness-expectations) — front-of-house pointer to this contract.
