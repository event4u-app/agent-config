# Claude Code cloud sessions

> **Status:** reference. What a Claude Code session running in the cloud
> receives from agent-config, and what it does not. Host statements below were
> read from the vendor documentation on **2026-11-02**; the host can change them
> on its own schedule, so re-check before acting on one.

## The short answer

agent-config installs Claude Code into your home directory — `~/.claude/` and
`~/.event4u/agent-config/` (ADR-020, global-only consumer scope). A cloud
session does not have your home directory. It starts on a **fresh clone of the
repository** and reads only what is committed plus server-managed settings.

So a cloud session on a repository with a normal agent-config install receives
**no agent-config skills, no rules and no hooks** — including the three
fail-closed guards (`block-no-verify`, `block-kernel-rule-writes`,
`block-plumbing-writes`). Measured on this repository on 2026-11-02:
`agents/evidence/analysis/cloud-clone-baseline-2026-11-02.json` (0 skills,
0 rules, 0 agents, 0 commands, 0 managed hooks).

`agent-config doctor` reports this as the `cloud-reach` check: inside a cloud
session (`CLAUDE_CODE_REMOTE=true`) with no agent-config hook in the committed
`.claude/settings.json` it warns; locally it states what a clone would carry.
To see what a clone of your own repository carries without a cloud session:

```bash
./scripts-run src/scripts/cloud_clone_probe /path/to/your/repo   # in this repo's checkout
```

## Anthropic-hosted sessions (claude.ai/code, `claude --cloud`, cloud routines)

What the host loads, per
[cloud-environments § What carries over from your setup](https://code.claude.com/docs/en/cloud-environments)
and [settings § Settings in cloud sessions](https://code.claude.com/docs/en/settings)
(both read 2026-11-02):

| Source | Loaded in a cloud session? |
|---|---|
| repo `CLAUDE.md`, `.claude/skills|agents|commands|rules` | yes — part of the clone |
| repo `.claude/settings.json` hooks | yes in a session with **one** repository; no with several |
| repo `.mcp.json` | yes in a session with one repository |
| user `~/.claude/settings.json` (where agent-config registers its hooks) | **no** |
| user `~/.claude/skills|agents|commands` | **no** |
| plugins a repo enables under `enabledPlugins` / `extraKnownMarketplaces` | **no** — not installed |
| server-managed settings | yes |

The session VM sets `CLAUDE_CODE_REMOTE=true`; it is never `true` locally.

**Delivery options — not shipped yet.** Two ways to carry agent-config into the
clone exist, and neither is built:

- *Setup script* (`npm i -g @event4u/agent-config && agent-config init`): runs
  as root before the session, and the docs confirm a file it writes to
  `~/.claude/CLAUDE.md` is loaded. It does **not** carry hooks, because user
  `~/.claude/settings.json` is not read in a cloud session.
- *Hooks committed to the repository* (`.claude/settings.json`) plus a
  SessionStart bootstrap that installs the runtime from npm when
  `CLAUDE_CODE_REMOTE=true`. The default network level (Trusted) allows
  `registry.npmjs.org`. This is the only path that can carry the guards; it
  writes into your repository, so it waits for an owner decision.

The `enabledPlugins` entry agent-config writes into `.claude/settings.json` has
no effect in a cloud session (repo-declared plugins are not installed) and
points at the deprecated marketplace plugin.

## Self-hosted runners

The host runs hooks an operator seeded into the runner's `~/.claude/`
([cloud-environments § Setup scripts vs. SessionStart hooks](https://code.claude.com/docs/en/cloud-environments),
read 2026-11-02). To give such a runner agent-config, seed **both**
`~/.claude/` and `~/.event4u/agent-config/` into the runner image from a normal
`agent-config init` on a machine of the same OS, one user per runner. Whether
seeded skills load the same way is not stated by the host docs.

## Remote Control

Remote Control sessions use your machine's files and network, not a cloud
environment, so the local install applies unchanged. (The host docs state the
machine is local; that it reads your `~/.claude` is inferred from that, not
stated.)

## See also

- [`claude-code`](per-ide/claude-code.md) — the local install.
- ADR-020 — why consumer installs are global-only.
