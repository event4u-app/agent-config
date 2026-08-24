# Getting Started

`agent-config` is a stack-agnostic orchestration contract for coding
agents. Installation is npx-first; the package itself is npm-published
and works in any project regardless of language.

## Installation

Pick one entrypoint:

```bash
# Recommended — one-shot, no local dependency
npx @event4u/agent-config init --tools=claude-code,cursor

# Registry-independent path — curl | bash entrypoint (downloads a tarball).
# Also needs Node >= 20; what it skips is npm dependency resolution.
curl -sSL https://raw.githubusercontent.com/event4u-app/agent-config/main/setup.sh | bash

# Global CLI (one install per machine, all projects)
npm install -g @event4u/agent-config
agent-config --help
```

That's it. Your agent now follows your team's standards. The orchestrator
runs a bash payload sync and a TypeScript bridge generator (shipped
pre-bundled as `dist/install/install.mjs`, run with plain `node`). Python is
not involved. No Task or Make required for end users — those are
contributor-only.

> **PATH matters for hooks.** The Claude Code plugin resolves `agent-config`
> from your `PATH`. If `npm install -g` did not put the npm global bin dir on
> `PATH`, hooks (including the roadmap-progress dashboard) silently no-op.
> Run `agent-config doctor` — it flags a missing-from-PATH binary and version
> drift, with the fix for each.

### Keeping current

The suite is global-only (ADR-020) — refresh the global install and every
project sees the new skills, rules, and hooks at once, no per-repo bump:

```bash
agent-config upgrade            # fetch + install the latest globally (content + hooks)
agent-config refresh --global   # idempotent re-install, same version
agent-config init --project     # initialize a project's minimal surface — bridge
                                # marker, agents/overrides/, .gitignore (no wizard)
agent-config refresh --project  # refresh that surface (same writer, idempotent)
agent-config config             # open the configuration GUI (global settings hub)
agent-config config --project   # open the project configuration surface
agent-config doctor             # PATH, hook wiring, duplicate surfaces, bridge presence
```

Claude Code is single-surface: the file projection carries content AND the
managed hooks in `~/.claude/settings.json` — there is no marketplace plugin
to keep in sync anymore. A leftover plugin from an older install is flagged
by `doctor` as `claude-plugin: duplicate surface` (fix:
`claude plugin uninstall agent-config@event4u-agent-config`).

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

This is enforced automatically by 120 rules. No configuration needed.

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
| `/fix quality` | Run and fix all quality checks |
| `/chat-history import` | Pull a prior session into the current chat (resume) |

→ [Browse all 202 active commands](../dist/agent-src/commands/)

---

## Team mode — cross-model review (default off)

Team mode is a governed access layer with a read-only multi-host
fallback: a second strong model reviews the **real diff** in your
working tree and returns its findings. It is the depth complement to the
[AI council](../dist/agent-src/skills/ai-council/SKILL.md): the council
collects many cheap, neutral opinions on an artefact's *text*; team mode
puts one strong, opinionated reviewer *inside the repo*. An iterated
build→review→fix loop is gated future work — it unlocks only with a
positive verdict from the pre-registered benchmark.

| Axis | Council | Team mode |
|---|---|---|
| Repo access | none — members see only the artefact text | full — the reviewer reads the real diff and git state |
| Shape | breadth — N neutral opinions, one round | depth — one strong reviewer on the real diff |
| Cost model | API-billed members (per-token) | subscription-authed `codex` CLI (runs under your existing plan) |

**Host support.** Only Claude Code with the Codex plugin gets the native
path; every other host runs a reduced, read-only fallback — no host
outside Claude Code has feature parity.

| Host | Path | Capability |
|---|---|---|
| Claude Code + Codex plugin | native — wrappers delegate to the plugin's `/codex:*` commands | full wrapper set: review, adversarial, status (incl. plugin job view), delegate (double-opt-in write path) |
| Any other host | read-only fallback via the `codex` CLI (repo-diff bundle) | review-shaped output only — no plugin job control, no background jobs, no delegate write path |

**Setup.** Run `agent-config doctor --check team` — it verifies the
`codex` binary + auth and, on Claude Code hosts, the Codex plugin, and
prints the exact remediation command for anything missing.

**Availability, not a setting.** `/team` carries no on/off flag — it
becomes available the moment the `codex` CLI is installed and
authenticated (`agent-config doctor --check team` verifies both); until
then every invocation degrades with one clear line. The one incident-only
override is `emergency.orchestration_halt` (halts subagents, council, and
team together).

**No lift claim.** Whether cross-model team review catches more real
defects than single-model adversarial self-review is **unproven** — the
package makes no review-quality claim until the pre-registered benchmark
has run and its verdict is recorded.

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

Use your host's native transcript / session view any time to inspect
the log size, last entries, and current fingerprint. For the rare case
where auto-adopt misfires (corrupted file, hook misconfiguration), run
`./agent-config chat-history:adopt` as the manual recovery lever.

See [`agents/settings/contexts/chat-history-platform-hooks.md`](../agents/settings/contexts/chat-history-platform-hooks.md)
and [`scripts/chat_history.py`](../src/scripts/chat_history.py) for the mechanics.

---

## Next steps

1. **Stay on `minimal`** — use it for a few days, see if the difference is noticeable
2. **Try commands** — `/commit`, `/create-pr`, `/fix ci` are great starting points
3. **Upgrade when ready** — switch to `balanced` to let the runtime dispatcher execute skills that declare a shell command
4. **Customize** — add [project overrides](customization.md) for your team's specific patterns

→ [Full documentation](../README.md#documentation)
