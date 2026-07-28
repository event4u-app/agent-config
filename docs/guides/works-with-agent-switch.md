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
   `GET /api/v1/ping` advertise `capabilities.configRoot` — so an older
   AS against a newer AC (or vice versa) degrades to a clear
   "not supported" instead of silent breakage.

## Boundaries

- Exactly **one** recommendation surface in AC (the wizard tooling row).
- AC never auto-installs agent-switch.
- AC never reports on agent-switch's version currency.
- The profile-awareness above ships and works whether or not the
  recommendation row exists — it is correctness work, valuable on its own.

agent-switch's own README carries the mirror-image mention of
agent-config; the long-form description of the composition lives here, on
purpose, so the two descriptions cannot drift into contradiction.
