---
status: ready
complexity: moderate
execution:
  mode: phase-checkpoints
---

# Road to a reciprocal ecosystem — AC recommends AS the way AS already recommends AC

> The promotion is currently one-way. agent-switch ships a designed, tested,
> three-state agent-config banner. AC mentions agent-switch **nowhere** in
> `src/`, `README.md`, or any wizard/settings surface (grep-verified; the
> only repo-wide hit is a GitHub PR URL inside a test fixture,
> `tests/scripts/pr_url_reminder_hook.test.ts:19`). An AC user running two
> Claude accounts by logging in and out has a problem AS solves, and AC
> never tells them. Making it mutual costs one detection and one card — and
> it is the second half of the distribution loop the adoption gap needs.
> Pairs with agent-switch's `road-to-agent-setup-hub` Phase 2 (the
> Ecosystem section).

## Goal

Give AC a **single, self-retiring** agent-switch recommendation on the
surface where it is actually relevant (the wizard's tooling step), plus the
profile-awareness that makes AC behave correctly when it *is* running under
AS — without turning AC's GUI into a promotion surface.

## Context (verified 2026-07-23 at agent-config@9.7.0 / agent-switch@1.6.1, do not relitigate)

- **AS's side is already built and is the reference implementation.**
  `agent-switch/gui/src/agent-config.ts` — `deriveAgentConfigView(status,
  devMode)` returns `install` (not present) · `update` (newer release
  available) · `installed` (dev-mode info only, otherwise **hidden**). The
  banner *disappears* once the user is installed and current. That
  self-retiring property is the part worth copying; the permanent-strip
  placement is not (AS is itself moving it into an Ecosystem section).
- **AC already has the detection plumbing**:
  `src/install/toolDetection.ts` (`isBinaryOnPath`, tool signals with
  `homePaths`/`absPaths`) and the wizard endpoint pattern. Note the
  shapes differ: `/api/v1/wizard/detect-rtk` returns
  `{ installed, platform, repo, installCommand }` (`wizard.ts:727-732`) —
  **that** is the shape to mirror; `/detect-tools` returns
  `{ tools, configured }` and is a different contract.
- **AC already chose the right install stance**: surface the command for
  the user to copy rather than shelling out an unverified install
  (`wizard.ts:708-711`). The AS recommendation inherits it —
  `npm install -g @event4u/agent-switch` is shown, not silently run.
- **AS's install path is npm-global** (`@event4u/agent-switch`, Node ≥ 20
  per its root `package.json`), same command on every OS — no per-OS map
  needed, unlike rtk.
- **The relevance signal exists in AC's own domain**: AC writes to
  `~/.event4u/agent-config/` globally, but a user with multiple agent
  accounts wants per-account config. That is precisely AS's
  `CLAUDE_CONFIG_DIR` isolation — an env var AC already knows from its
  Claude-Code plugin-registry handling (`doctor`/`upgrade` paths). The
  recommendation is substantive, not cross-selling.

### The restraint rule for this roadmap

`road-to-surface-consolidation` established that the package is
**complexity-limited, not capability-limited**, and that no new mechanism
ships without naming what it replaces. A promotion card adds surface for
zero user capability. Therefore this roadmap is bounded hard:

> **One card. One surface. Self-retiring. Dismissible permanently. No
> second placement, ever.** If it cannot earn its place under those
> constraints, it does not ship.

## Landed 2026-07-25 — the host-blocking config-root only

This PR ships ONLY the Phase-2 host-supplied config-root (the
`ac-profile-config-root` blocker agent-switch's `road-to-ac-embedded-settings`
Phase 3 waits on): `--config-root <path>` (flag) / `EVENT4U_CONFIG_HOME` (env),
advertised as `capabilities.configRoot` in `agent-config --version --json` +
`GET /api/v1/ping`. The rest of this roadmap (Phase-0 verdict, the recommendation
card, docs symmetry) is NOT in this PR — it remains for the AC maintainer.

## Phase 0 — Falsification spike

- [x] S0.1 — **Is the recommendation even relevant to AC's users?**
      Determine whether AC can cheaply detect *multi-account intent* —
      concretely: a handful of `existsSync` checks against the known host
      credential locations `toolDetection.ts` already models
      (`homePaths`/`absPaths` signals), plus `~/.agent-switch/` presence.
      **No filesystem scanning** — if the answer needs more than a fixed
      list of stat calls, it is too expensive and the answer is "cannot
      target". If AC cannot tell a multi-account user from a
      single-account one, the card would show to everyone —
      indiscriminate promotion, failing the restraint rule. In that case
      ship it **only** as a passive row in the tooling step (listed among
      companion tools, never as a proactive card).

Exit: a verdict on targeted-vs-passive. This determines the entire shape.

> **Verdict (2026-07-28): B — passive row (honest null, cannot target).**
> AI-council debate, 2 rounds, unanimous round-1 convergence
> (claude-sonnet-4-5 + gpt-4o; transcript not cited by path — council
> output is gitignored and auto-pruned; date + members are the durable
> trace). Grounds: `toolDetection.ts` models tool presence (one config-dir
> slot per host, e.g. `~/.claude`); a second account via native
> login/logout reuses the same credential slot and leaves no separate
> fixed-path trace. `~/.agent-switch/` presence and `CLAUDE_CONFIG_DIR`
> pointing into it are both self-retiring states (user already has AS).
> Multiple host configs (`.claude` + `.codex`) signal multi-*tool*, not
> multi-*account*. The round-2 counter-arguments (home-dir `readdir`
> scanning, project-dir config paths, access-frequency heuristics,
> telemetry) all violate the pre-registered fixed-stat-list constraint or
> the package's no-telemetry stance. Consequence: Phase 1 ships the
> recommendation as a **passive row** among companion tools in the
> wizard's tooling step — never a proactive card; endpoint, two states,
> placement, and permanent dismissal proceed unchanged.

## Phase 1 — Detection + the single card

- [x] Add an AS probe alongside the rtk one:
      `GET /api/v1/wizard/detect-agent-switch` →
      `{ installed, version|null, installCommand }` (mirroring
      `/detect-rtk`'s shape). Detect by binary on PATH **and** the
      presence of `~/.agent-switch/`, so a user who installed it another
      way is not told to install it again.
      <!-- done 2026-07-28: src/install/agentSwitchDetection.ts + wizard.ts endpoint (ungated, next to detect-rtk); tests/install/agentSwitchDetection.test.ts + tests/server/wizard.detectAgentSwitch.test.ts -->
- [x] Two states only: not installed → recommend · installed → **hidden**
      (self-retiring, the property worth copying from
      `deriveAgentConfigView`). There is deliberately **no** "outdated"
      state — classifying it would require exactly the version-currency
      check the acceptance criteria forbid; AS's own updater owns updates.
      <!-- done 2026-07-28: installCommand null when installed; AgentSwitchRow renders null unless installed === false; no latest-release fetch anywhere -->
- [x] Place it on the wizard's tooling step (per S0.1: card or passive
      row) and nowhere else. Copy stays substantive: what AS does
      (per-account isolation, no re-login), that it is free and MIT, one
      command.
      <!-- done 2026-07-28: passive row (S0.1 verdict B) on the identity step next to RtkRow, WizardPage.tsx AgentSwitchRow; single placement, grep-verified -->
- [x] **Permanently dismissible**, persisted. A dismissed recommendation
      never returns.
      <!-- done 2026-07-28: src/install/wizardDismissals.ts (user-global wizard-dismissals.json, no un-dismiss API) + POST /api/v1/wizard/dismiss-recommendation -->


## Phase 2 — Behave correctly under AS (the part that is not promotion)

This is where AC earns the integration rather than advertising it.
**Ships even if Phase 1 is cut** — it is correctness work.

- [x] **Detect that AC is running under an AS profile** —
      `CLAUDE_CONFIG_DIR` (or the sibling provider env var) pointing
      inside `~/.agent-switch/`.
      <!-- done 2026-07-28: src/install/agentSwitchProfile.ts (pure env/path logic, CLAUDE_CONFIG_DIR + CODEX_HOME vs AGENT_SWITCH_HOME ?? ~/.agent-switch); tests/install/agentSwitchProfile.test.ts -->
- [x] When detected, **say so in the settings hub**: which profile is
      active, and that writes are profile-scoped. An AC user who switches
      profiles and sees different settings must not think AC lost their
      config.
      <!-- done 2026-07-28: ping advertises agentSwitchProfile {active,provider,profile}; AgentSwitchProfileBanner in SettingsHubPage next to SettingsChangesBanner -->
- [x] **Warn on the share collision.** AS's `share on` symlinks
      `settings.json`, `keybindings.json`, `CLAUDE.md`, `skills/`,
      `commands/`, `agents/` across profiles (`agent-switch/src/
      share.ts:37-43`). A write AC believes is profile-local can land
      through a symlink and change every profile. Detection is
      **AC-local and topology-free**: `lstat` the write target (or its
      nearest ancestor inside the profile dir) for a symlink — AC never
      needs to understand AS's share model. The warning is a **blocking
      confirm, not a toast** (a missable toast = silent cross-profile
      corruption), with exactly two choices: "Write (affects all profiles
      via the shared tree)" / "Cancel" — plus a pointer to
      `agent-switch share off` for users who want profile-local writes.
      AC never breaks AS's symlinks itself.
      <!-- done 2026-07-28: src/server/io/sharedWriteCheck.ts (lstat walk bounded to the AS root) gating PUT /settings + PUT /user-md with 409 shared-write; SharedWriteModal blocking confirm (Write-all-profiles / Cancel + `agent-switch share off` pointer); confirmed writes resolve THROUGH the symlink so AS's links are never broken; tests/server/sharedWriteCheck.test.ts -->
- [x] Accept the host-supplied config root from AS's spawn (pairs with
      agent-switch's `road-to-ac-embedded-settings` Phase 3), so
      profile-scoped AC settings work rather than silently colliding.
      The flag/env is **discoverable** — advertised in the version/ping
      capability readout — so an older AS against a newer AC (or vice
      versa) degrades to a clear "not supported" instead of silent
      breakage.
      <!-- done (landed 2026-07-25, commit a9f003863, verified 2026-07-28): src/cli/configRoot.ts (--config-root flag + EVENT4U_CONFIG_HOME), capabilities.configRoot in --version --json (src/shared/capabilities.ts) + GET /api/v1/ping (ping.ts); tests: src/cli/configRoot.test.ts, src/shared/capabilities.test.ts, tests/server/app.test.ts -->


## Phase 3 — Symmetry in the docs

- [x] One "Works with agent-switch" section in AC's README, mirroring AS's
      existing agent-config mention. Not a badge wall — a short section
      explaining the composition (AS isolates accounts, AC governs what
      the agents do inside them).
      <!-- done 2026-07-28: README.md § "Works with agent-switch" (after § Supported tools) -->
- [x] The long-form explainer of how the two compose is **owned by AC's
      docs** (this repo publishes a docs site; one owner, no third
      artefact). AS's README section is a two-sentence summary **plus the
      link** — so even a broken link degrades to still-correct text, and
      the two descriptions cannot drift into contradiction.
      <!-- done 2026-07-28: docs/guides/works-with-agent-switch.md, published on the docs site (site/sync-docs.mjs PAGES + Guides sidebar section in site/astro.config.mjs) -->


## Acceptance criteria (pre-registered)

- [x] **Exactly one AS recommendation surface in AC.** A second placement
      requires naming what it retires.
      <!-- verified 2026-07-28: grep — exactly one render site, WizardPage.tsx identity step -->
- [x] **Self-retiring:** invisible to users who already have AS.
      <!-- verified 2026-07-28: AgentSwitchRow renders null unless installed === false; installCommand null when installed; test-covered -->
- [x] **Permanently dismissible**, and the dismissal survives updates.
      <!-- verified 2026-07-28: wizard-dismissals.json lives in the user-global config root (not the package install), no un-dismiss API exists -->
- [x] **AC never auto-installs AS**, and never runs a package install the
      user did not initiate — same stance as rtk.
      <!-- verified 2026-07-28: AGENT_SWITCH_INSTALL_COMMAND is only ever returned/displayed for copy, never spawned (grep: 3 hits, all display-path) -->
- [x] **AC does not report on AS's version currency.** AS owns its
      updates.
      <!-- verified 2026-07-28: no latest-release fetch anywhere in agentSwitchDetection.ts; version is a local --version probe only, no comparison -->
- [x] **Phase 2 ships even if Phase 1 is cut.** Profile-awareness and the
      share-collision warning are correctness work, valuable with or
      without any promotion.
      <!-- verified 2026-07-28: zero imports of agentSwitchDetection/wizardDismissals from any Phase-2 file (grep) -->
- [x] **Honest-null path:** if S0.1 shows AC cannot target the
      recommendation, the proactive card is dropped and only the passive
      tooling row ships. Record the negative result rather than showing an
      untargeted ad to every user.
      <!-- verified 2026-07-28: S0.1 verdict B recorded above (council convergence); shipped surface is a passive row, no proactive card exists -->


## Blockers

### blocker: restraint-review
- **Status:** resolved (2026-07-23)
- **Owner:** maintainer
- **Blocks:** — (was: Phase 1 shipping at all)
- **Decision:** affirmed — the distribution value outweighs the surface cost. Phase 1 ships, under the unchanged hard bound: **one card, one surface, self-retiring, permanently dismissible, no second placement ever.**
- **Resolved when:** ~~the decision is recorded either way~~ — recorded here.

### blocker: adoption-measurement
- **Status:** open
- **Owner:** user
- **Blocks:** knowing whether reciprocal promotion moves anything
- **What to do:** both directions are now mechanisms without a measurement. AC has no telemetry and should not grow any for this; the accepted evidence is an explicit user report (GitHub issue/discussion/direct message) of having found one package through the other.
- **Resolved when:** ≥1 external user reports (issue/discussion/direct message) arriving at either package through the other.

## Provenance

Read 2026-07-23, re-verified by an independent second pass:
`agent-switch@358059d` v1.6.1 (`gui/src/agent-config.ts`,
`gui/src/AgentConfigBanner.tsx`, `src/share.ts`, root `package.json` for
the npm name + Node floor) and `agent-config@9.7.0`
(`src/install/toolDetection.ts`, `src/server/routes/wizard.ts`,
`agents/roadmaps/road-to-surface-consolidation.md` for the restraint
rule). The absence of any agent-switch mention in AC's `src/` + root docs
was verified by grep; the single repo-wide hit is a test-fixture PR URL.
