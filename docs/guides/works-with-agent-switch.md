# Works with agent-switch

`agent-config` (AC) and [`agent-switch`](https://github.com/event4u-app/agent-switch)
(AS) are companion tools that compose without depending on each other:

- **agent-switch isolates accounts.** One machine, several agent accounts
  (work / personal / client) — AS keeps each in its own profile
  (`CLAUDE_CONFIG_DIR` and sibling provider variables point into
  `~/.agent-switch/<provider>/<name>/config`), so switching accounts never
  means logging out and back in.
- **agent-config governs what the agents do** inside whichever account is
  active — skills, rules, commands, quality gates, review discipline.

Neither tool requires the other. This page documents what AC does when the
two meet.

## The wizard recommendation (passive, self-retiring)

The setup wizard's tooling step lists agent-switch as a companion tool —
a passive row, not a promotion card. This shape is deliberate
(pre-registered in the reciprocal-ecosystem roadmap and confirmed by an
AI-council review, 2026-07-28): AC cannot distinguish a multi-account user
from a single-account user with a fixed list of filesystem checks, so a
proactive card would be indiscriminate. The row therefore:

- shows only while agent-switch is **not** installed (detected by the
  `agent-switch` binary on `PATH` or a `~/.agent-switch/` directory —
  either counts, so an unusual install is not told to install again);
- disappears permanently once installed (self-retiring — there is no
  "outdated" state; AS's own updater owns updates, AC never reports on
  AS's version currency);
- is **permanently dismissible** — "Don't show again" persists to the
  user-global config root and survives package updates;
- only **shows** the install command (`npm install -g @event4u/agent-switch`)
  for you to copy. AC never runs a package install you did not initiate —
  the same stance it takes for every companion tool.

Detection is served by `GET /api/v1/wizard/detect-agent-switch`
(`{ installed, version, installCommand, repo, dismissed }`); dismissal by
`POST /api/v1/wizard/dismiss-recommendation`.

## Running agent-config under an agent-switch profile

This is the substantive half of the integration — correctness, not
promotion. When AC runs inside an AS profile (a provider config variable
such as `CLAUDE_CONFIG_DIR` points into the AS profile tree), AC:

1. **Says so.** `GET /api/v1/ping` advertises the active profile
   (`agentSwitchProfile: { active, provider, profile }`), and the settings
   hub shows a banner naming it. Settings shown and saved there are
   profile-scoped — switching profiles shows that profile's own settings;
   nothing is lost.
2. **Warns before writing through a shared symlink.** AS's `share on`
   links files across profiles; a write AC believes is profile-local can
   land through such a symlink and change **every** profile. Before a
   settings-hub write, AC `lstat`s the target (and its ancestors inside
   the profile tree). If the write would go through a symlink, the save
   is blocked by an explicit confirm — "Write (affects all profiles)" or
   "Cancel" — with a pointer to `agent-switch share off` for
   profile-local writes. AC never breaks or rewrites AS's symlinks
   itself, and the check is topology-free: AC does not need to
   understand AS's share model.
3. **Accepts a host-supplied config root.** AS (or any host) can spawn
   AC with `--config-root <path>` or `EVENT4U_CONFIG_HOME`, so AC's own
   settings, state, and tokens are profile-scoped instead of colliding
   in the global `~/.event4u/agent-config/`. The capability is
   discoverable — `agent-config --version --json` and
   `GET /api/v1/ping` advertise `capabilities.configRoot` (and
   `capabilities.sessionList`, the versioned
   [`sessions:list --json --schema`](../contracts/session-list.md)) — so an older
   AS against a newer AC (or vice versa) degrades to a clear
   "not supported" instead of silent breakage.

## What AC guarantees under a profile

A profile is a directory behind `CLAUDE_CONFIG_DIR` or `CODEX_HOME`. Whether
agent-switch set it or you did, AC reads the session's state from that
directory, resolved in one place (`src/scripts/_lib/provider_home.ts`):

- **The right login.** On macOS, Claude Code keeps a profile's subscription
  under a suffixed Keychain service (`Claude Code-credentials-<8 hex>`), so
  AC asks for that one. The default account's subscription is never
  reported for a profile that has none, so the USD gate stays on.
- **The profile's sessions.** `agent-config handoff` lists Claude
  transcripts from `$CLAUDE_CONFIG_DIR/projects` and Codex sessions from
  `$CODEX_HOME/sessions`.
- **An honest doctor.** A `CODEX_HOME` that points at a missing directory is
  reported as such, not as "run `codex login`". A set `GEMINI_CLI_HOME` is
  named as not evaluated yet; the Gemini login is still read from
  `~/.gemini`.
- **A session signal.** Each session record carries
  `profile: { provider, name, via }`, and `sessions:list --json --schema 1`
  gives agent-switch one stable shape to read
  ([contract](../contracts/session-list.md)).

Not yet established: whether AC's user-scope rules reach a profile session.
AC installs them to `~/.claude/` and `~/.codex/`, and agent-switch shares
`skills/`, `commands/`, `agents/` and `settings.json` from there, but not
`rules/`. Whether the host reads `<profile>/rules` needs a run with real
accounts first.

## The link: limits and the switch question

From agent-switch 2.13.0 the two tools can talk through a local MCP server,
`agent-switch mcp serve` ([contract](../contracts/agent-switch-link.md)).
The link is on by default and switched off only in agent-switch
(`agent-switch link off`). Through it AC:

- **Reads limits.** Every account's 5-hour and weekly fill, reset time, and
  whether it can take work now. A stale reading counts as unknown, never as
  usable.
- **Asks.** When a session nears its limit, AC opens a switch request and names
  it in the limit notice. The same question shows in the agent-switch app.
- **Records your answer.** If you answer in the session, AC records it; the host
  confirms that call with you first. The first answer counts in both tools,
  whichever tool it came from.
- **Relays.** A decision made in agent-switch, and the outcome of the move, are
  reported once in the session.

With agent-switch absent, the link off, or a contract version AC does not know,
AC behaves exactly as before: the limit notice without a request.

The limit notice and AC's status-line segment are per account either way: a
session running under an agent-switch profile reads only that profile's plan
windows, so two logins on one machine no longer share one verdict. A session
outside any profile reads the default login's windows.

`agent-config install` registers the link's MCP server in `.mcp.json` when
agent-switch reports the link on, and removes that entry on the next install once you switch the
link off. `agent-config mcp:available` shows the link's state. The switch
question is opt-in: set `AGENT_CONFIG_SWITCH_QUESTION=1` and it is asked in a
session running under an agent-switch profile, once per limit cycle, and when you approve a move, AC leaves the run
checkpoint before the turn ends so the session the work moves to can resume
the step. If agent-switch stops answering, AC stops asking it for that session
after three tries until the next reset and tells you once. Never put `switch_decide` (or the whole `agent-switch` server) on an
auto-allow list: the decision is yours, and `lint_mcp_config_security` fails
such an entry. Seat placement by limits is still being built
(`road-to-a-link-with-agent-switch` Phase 5).

## What AC never does

- Add, log in, or refresh accounts, or keep an account store.
- Move a session to another account, pick the target for you, or switch
  automatically. Through the link AC reads, asks and relays; agent-switch
  carries out the move you approved.
- Run a daemon for accounts. AC runs inside a session, not above it.
- Write into a profile tree or agent-switch's share manifest.
- Depend on agent-switch. Everything above also holds for variables you
  set by hand.

**Remote and Superset.** On a server over SSH, or as a Superset agent
command, start the agent through agent-switch's own CLI
(`agent-switch run <name> -- <agent args>`). AC needs no snippet of its own
there: it reads whatever profile that command sets.

## Boundaries

- Exactly **one** recommendation surface in AC (the wizard tooling row).
- AC never auto-installs agent-switch.
- AC never reports on agent-switch's version currency.
- The profile-awareness above ships and works whether or not the
  recommendation row exists — it is correctness work, valuable on its own.

agent-switch's own README carries the mirror-image mention of
agent-config; the long-form description of the composition lives here, on
purpose, so the two descriptions cannot drift into contradiction.
