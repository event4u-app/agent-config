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

**Carry the hooks into the repository (opt-in).** Run, in the repository:

```bash
agent-config doctor --repair cloud-reach
git add .claude/settings.json && git commit -m "chore: carry agent-config hooks into cloud sessions"
```

This writes the hook matrix into `.claude/settings.json`, which a cloud session
loads. What each carried command does:

- **Locally it does nothing.** Every command starts with
  `[ "$CLAUDE_CODE_REMOTE" = "true" ] || exit 0`, so beside your global install
  no hook fires twice.
- **In a cloud session, SessionStart installs agent-config once** —
  `npm i -g --ignore-scripts @event4u/agent-config@<version>`, the exact version
  that wrote the file — unless a trusted dispatcher is already there. The
  default network level (Trusted) allows `registry.npmjs.org`. The entry carries
  a 300-second timeout because the install can outlast the host's default.
- **The trust boundary is the local one.** The dispatcher is resolved only from
  the staged runtime or an absolute `agent-config` outside the project directory,
  so a repository cannot supply its own. With no dispatcher, a tool call is
  refused, as it is locally.
- **If the install fails** (network level `None`, registry unreachable), the
  session context says so in one line, and every tool call is refused until the
  network level allows npm or you remove the carried entries.

Limits: hooks load only in a session with **one** repository; the pinned version
does not follow your global upgrades — re-run the repair after upgrading and
commit the change. A setup script (`npm i -g … && agent-config init`) is not an
alternative for the hooks: it writes `~/.claude/settings.json`, which a cloud
session does not read.

agent-config no longer writes an `enabledPlugins` entry into
`.claude/settings.json`: repo-declared plugins are not installed in a cloud
session, and the marketplace plugin is deprecated.

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
