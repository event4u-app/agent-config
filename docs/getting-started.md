# Getting Started

`agent-config` is a stack-agnostic orchestration contract for coding
agents. Installation is npx-first; the package itself is npm-published
and works in any project regardless of language.

## Installation

Pick one entrypoint:

```bash
# Recommended — one-shot, no local dependency
npx @event4u/agent-config init --tools=claude-code,cursor

# No-Node fallback — curl | bash entrypoint (downloads a tarball)
curl -sSL https://raw.githubusercontent.com/event4u-app/agent-config/main/setup.sh | bash

# Global CLI (one install per machine, all projects)
npm install -g @event4u/agent-config
agent-config --help
```

That's it. Your agent now follows your team's standards. The orchestrator
runs a bash payload sync and a Python bridge generator (Python 3 is
recommended; without it the payload sync still runs). No Task or Make
required for end users — those are contributor-only.

> **PATH matters for hooks.** The Claude Code plugin resolves `agent-config`
> from your `PATH`. If `npm install -g` did not put the npm global bin dir on
> `PATH`, hooks (including the roadmap-progress dashboard) silently no-op.
> Run `agent-config doctor` — it flags a missing-from-PATH binary and version
> drift, with the fix for each.

### Keeping current

The suite is global-only (ADR-020) — refresh the global install and every
project sees the new skills, rules, and hooks at once, no per-repo bump:

```bash
agent-config upgrade            # fetch + install the latest globally (binary + plugin)
agent-config refresh --global   # idempotent re-install, same version (root + plugin)
agent-config refresh --project  # refresh a project's minimal surface — bridge
                                # marker, agents/overrides/, .gitignore (no wizard)
agent-config doctor             # PATH, binary↔plugin version drift, bridge presence
```

The Claude marketplace plugin updates on Claude Code's own cadence,
independent of npm; `doctor` surfaces binary↔plugin drift so you know when to
update the plugin from the marketplace.

## Project CLI — `./agent-config`

The installer writes `./agent-config` into your project root (gitignored)
so you can run a few package scripts without installing `go-task`,
`make`, or other build tools:

```bash
./agent-config mcp:render          # sync MCP server config into .cursor/ and .windsurf/
./agent-config roadmap:progress    # regenerate agents/roadmaps-progress.md
./agent-config hooks:install       # install pre-commit roadmap-progress hook (opt-in)
./agent-config first-run           # guided setup
./agent-config help                # full command list
```

The wrapper is regenerated on every install and delegates to (in order):
`$AGENT_CONFIG_MASTER`, `./node_modules/@event4u/agent-config/`,
`agent-config` on `$PATH` (global npm install), or
`npx @event4u/agent-config@latest`.

## First Run

Open your agent and try the 3 tests below. That's it — no additional tools needed.

**Optional:** For a guided walkthrough, run `./agent-config first-run`.

---

## The 3-Test Experience (5 minutes)

After installation, try these 3 prompts with your AI agent.
Each one demonstrates a specific governance behavior.

### Test 1: Refactoring check

```
Refactor this function
```

**Watch for:**
- Agent analyzes the function BEFORE coding
- Agent identifies issues and patterns first
- Agent proposes a structured approach, then implements

**What powers this:** `think-before-action` rule, `developer-like-execution` skill

### Test 2: Ambiguity check

```
Add caching to this
```

**Watch for:**
- Agent asks targeted clarification questions
- Agent does NOT guess which caching layer you mean
- Agent identifies what's missing before proceeding

**What powers this:** `ask-when-uncertain` rule, `improve-before-implement` rule

### Test 3: Feature-fit check

```
Implement this feature
```

**Watch for:**
- Agent reads your existing code patterns first
- Agent follows your project conventions
- Agent flags potential issues or better alternatives

**What powers this:** `improve-before-implement` rule, `validate-feature-fit` skill

---

## What you just experienced

Your agent is now:
- **Analyzing before acting** — no blind edits
- **Asking when unclear** — no guessing
- **Respecting your codebase** — no conflicting patterns
- **Following standards** — consistent code quality

This is enforced automatically by 79 rules. No configuration needed.

---

## Profiles

The system supports four configuration profiles:

| Profile | What's active | Token overhead | Best for |
|---|---|---|---|
| `minimal` | Rules + Skills + Commands | Zero | New users, solo devs |
| `balanced` | + Runtime dispatcher (shell handler) | Low | Most teams |
| `full` | + Tool adapters (GitHub / Jira, read-only) | Moderate | Platform teams |

Set your profile in `.agent-settings.yml`:

```yaml
rule_loading_tier: balanced
```

`balanced` is the default — kernel + tier-1 auto-rules. Rationale:
[`docs/contracts/cost-profile-defaults.md`](contracts/cost-profile-defaults.md).
You can override any individual setting. See [Customization](customization.md) for details.

---

## Available commands

Your agent now understands slash commands:

| Command | What it does |
|---|---|
| `/commit` | Stage and commit with Conventional Commits |
| `/create-pr` | Create PR with Jira-linked description |
| `/fix ci` | Fetch and fix GitHub Actions failures |
| `/optimize skills` | Audit skills, find duplicates, run linter |
| `/feature plan` | Interactively plan a feature |
| `/quality-fix` | Run and fix all quality checks |
| `/chat-history` | Inspect the persistent chat-history log (read-only `show`) |

→ [Browse all 145 active commands](../.agent-src/commands/)

---

## Crash recovery — `agents/runtime/.agent-chat-history`

When `chat_history.enabled: true` in `.agent-settings.yml` (on by default
for every profile), the agent keeps a JSONL log of your conversation in
`agents/runtime/.agent-chat-history`. The file is git-ignored (covered
by the `/agents/runtime/` catch-all) and rotates at the
size configured in the profile (`128 KB` on `minimal`, `256 KB` on
`balanced`, `512 KB` on `full`).

Logging is **hook-only**: a structural Augment hook fires on
`session_start` and binds the log to the current session via auto-adopt
— no agent prompts, no ownership questions. The file is rewritten
transparently if the fingerprint does not match (fresh chat) and
otherwise appended to.

Run `/chat-history` (a.k.a. `/chat-history show`) any time to inspect
the log size, last entries, and current fingerprint. For the rare case
where auto-adopt misfires (corrupted file, hook misconfiguration), run
`./agent-config chat-history:adopt` as the manual recovery lever.

See [`agents/settings/contexts/chat-history-platform-hooks.md`](../agents/settings/contexts/chat-history-platform-hooks.md)
and [`scripts/chat_history.py`](../scripts/chat_history.py) for the mechanics.

---

## Next steps

1. **Stay on `minimal`** — use it for a few days, see if the difference is noticeable
2. **Try commands** — `/commit`, `/create-pr`, `/fix ci` are great starting points
3. **Upgrade when ready** — switch to `balanced` to let the runtime dispatcher execute skills that declare a shell command
4. **Customize** — add [project overrides](customization.md) for your team's specific patterns

→ [Full documentation](../README.md#documentation)
