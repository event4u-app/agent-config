# Getting Started

## Installation

```bash
# Composer (PHP) — two steps: install, then run the orchestrator
composer require --dev event4u/agent-config
php vendor/bin/install.php
# Equivalent: bash vendor/event4u/agent-config/scripts/install

# npm (JavaScript/TypeScript) — the orchestrator runs via postinstall
npm install --save-dev @event4u/agent-config
# Re-run or pick a profile:
# bash node_modules/@event4u/agent-config/scripts/install --profile=balanced
```

That's it. Your agent now follows your team's standards. The orchestrator
runs a bash payload sync and a Python bridge generator (Python 3 is
recommended; without it the payload sync still runs). No Task or Make
required for end users.

## First Run

Open your agent and try the 3 tests below. That's it — no additional tools needed.

**Optional:** For a guided walkthrough, run `task first-run` (requires [Task](https://taskfile.dev/)).

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

This is enforced automatically by 41 rules. No configuration needed.

---

## Profiles

The system supports four configuration profiles:

| Profile | What's active | Token overhead | Best for |
|---|---|---|---|
| `minimal` | Rules + Skills + Commands | Zero | New users, solo devs |
| `balanced` | + Runtime dispatcher (shell handler) | Low | Most teams |
| `full` | + Tool adapters (GitHub / Jira, read-only) | Moderate | Platform teams |

Set your profile in `.agent-settings`:

```ini
cost_profile=minimal
```

You can override any individual setting. See [Customization](customization.md) for details.

---

## Available commands

Your agent now understands slash commands:

| Command | What it does |
|---|---|
| `/commit` | Stage and commit with Conventional Commits |
| `/create-pr` | Create PR with Jira-linked description |
| `/fix-ci` | Fetch and fix GitHub Actions failures |
| `/quality-fix` | Run and fix all quality checks |

→ [Browse all 59 commands](../.agent-src/commands/)

---

## Next steps

1. **Stay on `minimal`** — use it for a few days, see if the difference is noticeable
2. **Try commands** — `/commit`, `/create-pr`, `/fix-ci` are great starting points
3. **Upgrade when ready** — switch to `balanced` to let the runtime dispatcher execute skills that declare a shell command
4. **Customize** — add [project overrides](customization.md) for your team's specific patterns

→ [Full documentation](../README.md#documentation)
