---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
estate_offset_exempt: "Round inbox-2026-10-t verified at 5fa963cec that `upgrade` runs only on explicit invocation, that `update_check.enabled` is the only settings key on the whole surface (agent-settings.template.yml:1529), that the notice is emitted solely by the CLI dispatcher and suppressed on non-TTY (update_check.ts:239-255, sole caller check_update_banner.ts:149) while consumption is global-only through hosts (README.md:188), and that SECURITY.md:21-22 backports nothing — so an install that is not current is unsupported and nothing tells its user. No active, parked or stub roadmap owns this: a grep over agents/roadmaps/{*,later,stubs} for cmd_upgrade, update_check, unattended and probe_throttle returns nothing. Archiving or parking costs more because the support consequence is live on every install today; merging into road-to-a-release-that-says-whether-it-needs-you would put an install transaction behind a release-numbering decision the owner has not taken."
estate_growth_exempt: "Adds two owner blockers (`node-floor-raise`, `auto-default-for-existing-installs`) above the open_blockers floor measured at origin/main. Both are consumer-facing commitments — a minimum-runtime raise and a default flip on installs that already exist — which template rule 27 records as structured blockers rather than as decisions the agent takes. Measure the delta with `./scripts-run src/scripts/check_estate_count` on the landed commit rather than reading this sentence."
relates:
  - slug: road-to-a-release-that-says-whether-it-needs-you
    relation: depends
    note: "Consumes the impact map, the comparator and `classifyUpdate` built there. This file builds no classifier of its own and changes no release logic."
  - slug: road-to-truthful-surfaces
    relation: depends
    note: "Phase 3 keeps the CLI banner as the fallback for hosts with no session slot; that banner must name the right command first."
  - slug: road-to-a-hook-carrier-that-is-never-silent
    relation: disjoint
    note: "Owns whether a hook carrier that cannot reach the dispatcher says so. Phase 3 adds a concern that runs when the carrier works; it changes no fallthrough behaviour."
  - slug: road-to-a-cold-start-paid-once
    relation: disjoint
    note: "Owns what a first run costs. Phase 3's concern is day-throttled through the existing probe throttle and is budgeted against Phase 1's measured baseline, not against that file's."
depends:
  - road-to-a-release-that-says-whether-it-needs-you
  - road-to-truthful-surfaces
---
# Road to an update that installs itself only when it is safe

> **Source:** `agents/tmp.old/inbox-2026-10-t/topic-1/` — one transcript and
> four supplied plans, pinned at `main@a10aa16a`, re-read at `main@5fa963cec`
> on 2026-10-16. Readings marked *(executed)* ran against this tree in a
> scratch directory outside the repository.

## Goal

A global install stays on a supported, patched release without ever mutating a
running session, moving a team's pin, or flipping a default on an install that
already exists. Where it cannot be sure, it does not act — it says why.

This is a **support** property, not a growth one: `SECURITY.md:21-22` backports
nothing, so an install that is not current is an install that is unpatched.
Nothing in this file argues for adoption and nothing in it depends on that
question.

## Prerequisites

- `road-to-a-release-that-says-whether-it-needs-you` Phases 3–4 landed:
  the impact map, the real comparator and `classifyUpdate`.
- `npx vitest` runs locally; Phase 1's probe needs two concurrent sessions on
  one machine.

## Context — read at `main@5fa963cec`

| # | Defect | Evidence |
|---|---|---|
| J1 | **There is no automatic path at all.** `upgrade` already does the four right things — global binary, global re-install, plugin refresh, settings sync (`src/scripts/_cli/cmd_upgrade.ts:20-45`) — and runs `doctor` last, every time (`:618-624`). It runs only when a human types it. *(executed)* the only settings key on this surface is `update_check.enabled` (`src/config/agent-settings.template.yml:1529`); there is no `update:` block. |
| J2 | **The notice cannot reach a user who never opens a terminal.** It is emitted by the CLI dispatcher after a subcommand (`src/scripts/_dispatch.bash:1754`, `:1849`) and suppressed on non-TTY (`update_check.ts:239-255`). *(executed)* the sole functional caller is `src/scripts/check_update_banner.ts:149`; no session-start concern calls it. Consumption is global-only through hosts (`README.md:188`), so the one surface that tells a user about an update is the one surface most users never see. |
| J3 | **Four update surfaces, and one of them is a team decision.** Global binary, global projection, the plugin snapshot (`cmd_upgrade.ts:30`), and the per-project `agent_config_version` pin, which only `update` may move (`src/scripts/_cli/cmd_update.ts:11-13`) and which `installed-tools.lock` reproduces across a team (`README.md:357`). An updater that moves a pin breaks reproducibility for everyone else on that repo. |
| J4 | **Staleness is unsupported, not merely old.** `SECURITY.md:21-22`: fixes land on the latest published version; older releases are not backported. |
| J5 | **There is no known safe moment to swap global files, and nobody has measured it.** Hooks re-invoke the dispatcher per event, so a session running while `upgrade` rewrites the global install executes new code mid-session. The register that could answer "is anything running" is scoped to one repository (`src/scripts/session_register_hook.ts:5`). Whether the swap actually breaks anything is **unmeasured** — and it is the one thing the whole file rests on. |
| J6 | **The runtime floor is past its support window.** `package.json:78` declares `">=20.11.0"`; *(executed)* **45 of 59** CI `node-version` pins are Node 20. An unattended updater with no `engines` check would eventually install a version that cannot start, taking every hook of every session with it. |

## Bestand — reuse, do not rebuild

Standing consent (`cmd_upgrade.ts:578-586`, the recorded 2026-07-07 council
model) · the day throttle (`src/scripts/hooks/probe_throttle.ts:50`) ·
install-origin detection (`src/scripts/_cli/doctor_install_mode.ts`) ·
`installed.lock` carrying version, layout and install date
(`src/scripts/_lib/installed_lock.ts:42-45`) · OIDC trusted publishing with
provenance (`.github/workflows/publish-npm.yml:62`) · the `next` / `latest`
channels (`:154-168`) · curated release heads
(`src/scripts/_lib/release_highlights.ts:35-41`) · post-upgrade `doctor`.
None of this is rebuilt here.

## Phase 1 — Measure the hazard before building on it

- [ ] **1.1 Probe the mid-session swap.** Run an `upgrade` activation while a
      second session fires hooks, including the fail-closed guards. Record
      every error, with its event and its exit code.
      verify: the probe log is committed under `agents/evidence/` with a
      numeric error count and an `evidence-type` marker. A probe with no
      recorded count has not measured anything.
- [ ] **1.2 Branch on the count.** Zero errors → stage-and-activate-at-a-
      boundary ships as Phase 2 describes. Non-zero → activation waits on a
      live-session register, which requires lifting
      `src/scripts/session_register_hook.ts` from repository scope to global
      scope. That lift is its own step and is **not** assumed by anything
      below.
      verify: the branch taken is recorded in `## Decisions` as D6 with the
      count that chose it.
- [ ] **1.3 Baseline the hook budget.** p50 and p95 hook latency and bytes
      before any new concern lands, so Phase 3 has something to be measured
      against.
      verify: the figures are in the same evidence file as 1.1.

## Phase 2 — A safety envelope on the verb that already exists

- [ ] **2.1 `upgrade --unattended`, no new verb.** ADR-041 is accepted; this
      is a flag on `cmd_upgrade.ts`. It refuses unless every gate passes: a
      72 h release age, a provenance check against the OIDC publish
      (`publish-npm.yml:62`), a `deprecated` check in the same fetch, and the
      `engines` comparison from the sibling roadmap.
      verify: a fixture per gate shows the refusal and its reason.
- [ ] **2.2 Single-flight.** A lock with a TTL and an owner PID under
      `~/.event4u/agent-config/`; the previous version read from
      `installed_lock.ts:42-45`.
      verify: two concurrent invocations produce exactly one install and one
      recorded refusal.
- [ ] **2.3 Failure restores and degrades.** Any failure restores the
      previous version and drops to `notify` with the reason. `EACCES` prints
      the exact command to run and never invokes `sudo`.
      verify: fault injection for offline, 403, 404, disk full, SIGTERM,
      partial settings sync and a concurrent caller — after each, the
      installed version equals the version before.
- [ ] **2.4 Global surfaces only.** The unattended path never touches
      `agent_config_version` (`cmd_update.ts:11-13`) and never writes into a
      project.
      verify: a project carrying a pin is byte-identical before and after.
- [ ] **2.5 Add `--skip <version>`, and do not add `--to`.** `update --to`
      already exists (`cmd_update.ts:412`); a second near-identical flag on
      the confusable verb is the defect its sibling roadmap is fixing.
      verify: `grep -c "'--to'" src/scripts/_cli/cmd_upgrade.ts` -> /^0$/

## Phase 3 — Delivery into the session, without entering the model

- [ ] **3.1 A `session_start` concern beside `wrapper-freshness`.**
      Registered in `src/scripts/hook_manifest.yaml`, day-throttled through
      `probe_throttle.ts:50`, a 1 s budget, fail-open, effect `notification`,
      addressed to the **user**.
      verify: p95 hook latency stays inside the Phase 1.3 baseline.
- [ ] **3.2 Stage and verify only; activate at a boundary.** The concern never
      swaps files mid-session; activation happens at the next `session_start`
      before the dispatcher reads anything.
      verify: a fixture session observes no file change between its first and
      last hook invocation.
- [ ] **3.3 One line from the shipped curated head.** After an update, the
      line comes from `release_highlights.ts:35-41` in the **installed**
      package, plus any `notice` entry from the impact map. Fetched release
      notes are remote untrusted text and never enter model context.
      verify: a fixture with a hostile remote changelog produces no model-
      visible token from it.
- [ ] **3.4 A security release is loud in every mode but `off`.** The notice
      names the latest-only policy at `SECURITY.md:21`.
      verify: a fixture with `Security: yes` in range produces the notice
      under `notify` and under `ask`.
- [ ] **3.5 Hosts with no session slot keep the CLI banner.**
      verify: a fixture in which `agent-config hooks:status` reports no
      `session_start` binding still yields the banner path.

## Phase 4 — Consent and rollout, nothing flipped silently

- [ ] **4.1 One settings key.** `update.mode: auto | ask | notify | off` in
      `src/config/agent-settings.template.yml` beside `update_check:` at
      `:1529`, reusing the standing-consent model at `cmd_upgrade.ts:578-586`.
      An absent key behaves exactly as today.
      verify: a settings file with no `update:` block produces byte-identical
      behaviour to the current release, asserted against recorded output.
- [ ] **4.2 Ring 0 on the channel that already exists.** Maintainer machines
      on the `next` dist-tag (`publish-npm.yml:154-168`) at `mode: auto`.
      Exit condition: four consecutive releases installed unattended with
      zero rollbacks and zero errors in the Phase 1 probe.
      verify: the ring-0 record is committed before 4.3 lands.
- [ ] **4.3 Ask once, at a moment that earned it.** After the ring-0 exit, one
      host-native question in the `stop` slot, after a turn that ended on a
      verified success. It carries a permanent "never". Existing installs are
      **asked**, never flipped.
      verify: a fixture asserts zero prompts under CI, non-TTY, headless,
      `--json` output and a subagent run.
- [ ] **4.4 A pin advisor for teams.** `update --check` in a pinned project
      lists what lies between the pin and latest, read from the impact map.
      It proposes; it never moves the pin.
      verify: the command's exit code and the pin are unchanged by it.
- [ ] **4.5 Plan the Node-22 floor as the first `action` release.** Move the
      45 Node-20 CI pins in the same release, so the ask path is exercised on
      a real case rather than a fixture.
      verify: blocked on `node-floor-raise`; nothing lands until it resolves.

## Blockers

### blocker: node-floor-raise

- **Status:** open
- **Owner:** repository owner
- **Blocks:** step 4.5 only. Phases 1–3 and steps 4.1–4.4 run without it.
- **What to do:** pick exactly one — (a) raise `engines.node` to `>=22` in the
  next release and move the 45 Node-20 CI pins with it, cut as the first
  `action` release; or (b) raise it with the next release that is a major for
  other reasons, and keep Node 20 working until then; or (c) do not raise it
  yet and record the date the decision is revisited.
- **Resolved when:** an ADR or a release decision under `docs/decisions/`
  records (a), (b) or (c), and this blocker's Status reads
  `resolved — <record>`.
- **Recommendation:** (a), **and an AI council of 2026-10-16 agrees while
  confirming this reaches the owner.** Both seats (`anthropic`, `openai`, prompt
  mode, two rounds, 2/2, no split) returned **ESCALATE** — dropping Node 20
  *removes a compatibility commitment*, whatever the runtime's own support
  status — and both picked **(a)**. Record:
  `agents/evidence/council/owner-blocker-routing-20261016.md`.

  **The framing `anthropic` added changes what is being asked.** Cut as a
  **semver-major**, the question is no longer *"may we break Node 20 in a
  minor?"* but *"may we cut a major now?"* — a documented contract point rather
  than an unannounced removal. Both seats require the `engines.node` change and
  the CI pins to move **atomically**, and both require migration notes naming
  the last Node-20-compatible version and stating plainly that it receives no
  security, bug or compatibility backports.

  `openai`'s decisive reading: CI pins Node 20 while `SECURITY.md:21` backports
  nothing to it, so the repository already emits *"a compatibility signal the
  project will not actually honor"*.

  **Re-measured 2026-10-16, because this entry quotes a count.** `engines.node`
  is `>=20.11.0`; the workflows carry **38** literal `node-version: '20'` pins
  across **20** files plus **3** matrix lists `node: ['20', '22']` in 2 more —
  41 sites in 21 files, not the 45 below. The figure does not change the
  decision.

  *Original reasoning:* Node 20 passed its support window on 2026-04-30,
  `SECURITY.md:21` backports nothing, and the raise is the only consumer-facing
  `action` release in sight — which makes it the honest first test of the ask
  path rather than a fixture standing in for one.
- **If you do nothing:** the floor rises eventually anyway, and the first time
  it does it will be under an unattended updater that has never exercised the
  ask path on a real release.

### blocker: auto-default-for-existing-installs

- **Status:** open
- **Owner:** repository owner
- **Blocks:** step 4.3's default. The question is not whether `auto` exists —
  4.1 ships it as an opt-in — but whether an install that already exists may
  ever arrive at it without being asked.
- **What to do:** pick exactly one — (a) `auto` may become the default for new
  installs only, and existing installs are asked once, with a permanent
  "never"; or (b) `ask` is terminal — `auto` stays opt-in forever and no
  default ever changes under an existing install; or (c) `auto` may become the
  default everywhere after the ring-0 exit, with a release note.
- **Resolved when:** an ADR records (a), (b) or (c) and this blocker's Status
  reads `resolved — <adr>`.
- **Recommendation:** (b) until the ring-0 record exists, then reconsider.
  `non-destructive-by-default` treats a silent change to an install the user
  already has as the thing a default flip must not be, and nothing measured so
  far argues the other way.

  **An AI council split on this one, 2026-10-16 — the only split in ten rounds —
  so it escalates on the escalation condition rather than on a reading.** Record:
  `agents/evidence/council/owner-blocker-routing-20261016.md`.

  `anthropic` — **DECIDE, (b)**: the reserved list names *externally binding,
  liability-creating* commitments, and an internal policy about how
  conservatively defaults evolve is none of those. Its sharpest point:
  **neither (a) nor (b) weakens the floor** — both ask before changing — so the
  choice is how conservative to be, not whether to preserve the user's agency.
  Only (c), which neither seat picked, would weaken it.

  `openai` — **ESCALATE, (a)**: whether an existing install may acquire
  materially different update behaviour is a public behavioural commitment. (a)
  preserves the consent state of existing installs without freezing the product
  forever: new installs may default to `auto`, existing ones keep `notify`
  unless they accept a one-time invitation carrying a durable "never".

  **Worth stating for whoever answers: the seats are one step apart, not
  opposed.** (a) and (b) differ only in whether a single invitation may ever be
  shown to an existing install. Both forbid a silent flip, and both leave (c)
  refused.
- **If you do nothing:** 4.3 ships the question and the default stays `notify`,
  which is the conservative behaviour and is a complete outcome — this blocker
  exists so that staying there is a choice rather than an omission.

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| D1 | deterministic | agent | A flag on `upgrade`, never a new verb | ADR-041 accepted | ADR-041 is superseded |
| D2 | critical-technical | evidence | The unattended path never touches a project pin | `cmd_update.ts:11-13` makes the pin a team decision reproduced through `installed-tools.lock` | the lock stops being the team reproducibility surface |
| D3 | critical-technical | evidence | Remote release-note text never enters model context | it is attacker-influenceable input on a path that would otherwise reach the model | never |
| D4 | contested-technical | evidence | Ring 0 is the existing `next` dist-tag, not a new voluntary diagnostic ring | the channel already exists at `publish-npm.yml:154-168`; a second ring is a second thing to maintain | the channel is retired |
| D5 | critical-technical | evidence | Uncertainty never resolves to `auto` | inherited from the classifier's own rule; an updater that guesses is the failure this file exists to avoid | never |
| D6 | contested-technical | agent | Let the Phase 1.1 probe's error count decide whether activation needs a global live-session register, and design nothing on either assumption before it | the hazard is unmeasured, and a design built on a guess about it is the failure this phase exists to prevent | the probe is re-run on a host with different hook timing |

D6 closes a deferral, not a design: what was decided is that the register
question is settled by the Phase 1.1 probe's error count rather than by
assumption, and that no step before 1.2 may be written as if either outcome
had already happened.

## What this roadmap deliberately does not do

- It does not ask for a star, submit to a directory, or make any adoption
  argument. The support case stands on `SECURITY.md:21` alone.
- It does not classify updates — that is its sibling. This file acts on a
  verdict it is given.
- It does not move a project pin, write into a repository, or change
  `installed-tools.lock`.
- It does not run a resident daemon, a background process or a postinstall
  script.
- It does not flip a default on an install that already exists; 4.3 asks, and
  the blocker above is why that is a decision rather than an omission.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-16 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | An unattended install breaks a running session | implementation | Hooks re-invoke the dispatcher per event; a swap mid-session runs new code against old state. | Phase 1 measures it before anything is built on it, and 1.2 makes a non-zero count block the design rather than annotate it; activation happens at a boundary, never during. | Phase 1 — Measure the hazard before building on it |
| 2 | A version that cannot start is installed | implementation | An `engines` floor the local runtime does not satisfy takes every hook down at once. | The engines comparison is a refusal gate in 2.1, inherited from the sibling's classifier; 2.3 restores the previous version on any failure. | Phase 2 — A safety envelope on the verb that already exists |
| 3 | The new session concern costs latency on every session | product | A per-session probe on a surface that currently costs nothing. | 1.3 baselines before, 3.1 budgets to 1 s and fails open, and the day throttle already exists. | Phase 3 — Delivery into the session, without entering the model |
| 4 | A user is silently moved onto a default they did not pick | product | The opt-in becomes a default by momentum rather than by decision. | 4.1 makes an absent key behave as today, asserted against recorded output; the second blocker makes the flip an owner decision with a recorded answer. | Phase 4 — Consent and rollout, nothing flipped silently |
| 5 | Fault injection misses the failure that actually happens | implementation | Seven injected faults are the ones their author thought of. | The restore invariant is asserted uniformly — installed version before equals after — so an unanticipated fault fails the same assertion rather than needing its own case. | Phase 2 — A safety envelope on the verb that already exists |
| 6 | The ring-0 exit is declared on a reading nobody recorded | implementation | "Four clean releases" becomes an impression. | 4.2 requires the record committed before 4.3 lands, and AC-7 asserts the file exists. | Phase 4 — Consent and rollout, nothing flipped silently |

## Acceptance Criteria

- [ ] **AC-1** The Phase 1 probe log exists under `agents/evidence/` with a
      numeric error count, and `auto` ships nowhere while that count is
      non-zero and the session register is repository-scoped.
- [ ] **AC-2** Under `CI=1`, a non-TTY stdout, a source checkout and
      `AGENT_CONFIG_NO_UPDATE_CHECK=1`, an end-to-end run produces zero
      filesystem writes outside the state file, asserted by a tree diff.
- [ ] **AC-3** A project carrying `agent_config_version` is byte-identical
      before and after an unattended run.
- [ ] **AC-4** For each of offline, 403, 404, disk-full, SIGTERM and EACCES,
      the installed version after the run equals the version before, and a
      reason is printed.
- [ ] **AC-5** A release published less than 72 h ago, or carrying
      `deprecated`, or with unmet `engines`, or with missing provenance, is
      never installed unattended.
- [ ] **AC-6** A settings file with no `update:` block produces byte-identical
      behaviour to the current release.
- [ ] **AC-7** The ring-0 exit record is committed before step 4.3 lands.
- [ ] **AC-8** No fetched release-note text reaches model context, asserted by
      a fixture with a hostile remote changelog.
- [ ] **AC-9** `grep -c "'--to'" src/scripts/_cli/cmd_upgrade.ts` returns 0.
- [ ] **AC-10** `task ci` green.

## Provenance

Source-derived under template rule 19; same source set as
`road-to-truthful-surfaces`, not named here per `source-confidentiality`,
links `ENC1`-encrypted in the round's intake note.

| Proposed | Verdict | Why |
|---|---|---|
| Unattended upgrade with a safety envelope | KEEP | J1: no automatic path exists; J4 makes staleness a support state. |
| Session delivery of the notice | KEEP | J2 executed: the sole caller is the CLI dispatcher. |
| Mid-session-swap probe before auto | KEEP | J5: unmeasured, and everything else rests on it. |
| `engines` check before install | KEEP | J6: 45 of 59 CI pins on a runtime past its window. |
| A new `share` verb | CUT | ADR-041; already killed in the source's own register. |
| `upgrade --to <version>` | CUT | `update --to` exists; the duplication is the confusion being fixed. |
| A resident update daemon | CUT | Killed in the source's register and incompatible with the hook model. |
| Post-install messages | CUT | Dropped from this package in 2.0.0. |
| Measuring update adoption | CUT | Install telemetry is inert and the privacy floor forbids consumer telemetry; the source withdraws its own hypothesis on this. |
| A star prompt at the same moment | CUT | Owner-reserved record; out of scope by construction. |

## Notes — how this file was derived

Three extraction passes, converged at pass 2. J2 and J6 were reproduced
offline; J5 is explicitly **not** reproduced and is Phase 1's whole subject.
The supplied plans sequenced consent before measurement; that order is
inverted here, because a consent question about a swap nobody has measured is
a question the user cannot answer.
