---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
estate_offset_exempt: "Round inbox-2026-10-t verified at 5fa963cec that `upgrade` runs only on explicit invocation, that `update_check.enabled` is the only settings key on the whole surface (agent-settings.template.yml:1529), that the notice is emitted solely by the CLI dispatcher and suppressed on non-TTY (update_check.ts:239-255, sole caller check_update_banner.ts:149) while consumption is global-only through hosts (README.md:188), and that SECURITY.md:21-22 backports nothing — so an install that is not current is unsupported and nothing tells its user. No active, parked or stub roadmap owns this: a grep over agents/roadmaps/{*,later,stubs} for cmd_upgrade, update_check, unattended and probe_throttle returns nothing. Archiving or parking costs more because the support consequence is live on every install today; merging into road-to-a-release-that-says-whether-it-needs-you would put an install transaction behind a release-numbering decision the owner has not taken."
estate_growth_exempt: "Adds three blockers above the open_blockers floor measured at origin/main. Two are owner blockers (`node-floor-raise`, `auto-default-for-existing-installs`) above the open_blockers floor measured at origin/main. Both are consumer-facing commitments — a minimum-runtime raise and a default flip on installs that already exist — which template rule 27 records as structured blockers rather than as decisions the agent takes. Measure the delta with `./scripts-run src/scripts/check_estate_count` on the landed commit rather than reading this sentence. The third, `dsse-trust-root`, is Class 2 and council-decidable: step 2.1 closed the half of the provenance gate that could be closed without a dependency decision, and the half that remains — pinning a sigstore trust root, or shelling out to the npm client, or recording the certificate-bound check as the floor — trades bytes against bandwidth against coverage with no measurement in this tree to separate them. Recording it as a structured blocker is what keeps the gate's real limit readable; the alternative was a docstring nobody greps."
relates:
  - slug: road-to-a-release-that-says-whether-it-needs-you
    relation: depends
    note: "Consumes the impact map, the comparator and `classifyUpdate` built there. This file builds no classifier of its own and changes no release logic."
  - slug: road-to-truthful-surfaces
    relation: extends
    note: "Phase 3 keeps the CLI banner as the fallback for hosts with no session slot; that banner must name the right command first. It now does — that file closed AC-8 and archived on 2026-10-17 (#2446), so this is no longer a wait. Relation moved from `depends` to `extends` because an archived file lands nothing and a `depends` row naming one is a failure since this batch."
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

- [x] **1.1 Probe the mid-session swap.** Run an `upgrade` activation while a
      second session fires hooks, including the fail-closed guards. Record
      every error, with its event and its exit code.
      verify: the probe log is committed under `agents/evidence/` with a
      numeric error count and an `evidence-type` marker. A probe with no
      recorded count has not measured anything.
- [x] **1.2 Branch on the count.** Zero errors → stage-and-activate-at-a-
      boundary ships as Phase 2 describes. Non-zero → activation waits on a
      live-session register, which requires lifting
      `src/scripts/session_register_hook.ts` from repository scope to global
      scope. That lift is its own step and is **not** assumed by anything
      below.
      verify: the branch taken is recorded in `## Decisions` as D6 with the
      count that chose it.
- [x] **1.3 Baseline the hook budget.** p50 and p95 hook latency and bytes
      before any new concern lands, so Phase 3 has something to be measured
      against.
      verify: the figures are in the same evidence file as 1.1.
- [x] **1.4 Lift the live-session register to global scope.** 1.2 took the
      non-zero branch (D6: 490 failed hook invocations of 4,190 during four
      swap rounds), so activation waits on a register that can say no session
      is live on this machine. Today `src/scripts/session_register_hook.ts`
      registers sessions per repository only. Until this lands,
      `ACTIVATION_BLOCKED` in `src/scripts/_cli/upgrade_unattended.ts` keeps the
      production wiring of `upgrade --unattended` from swapping anything.
      verify: a fixture with a live session registered from a second
      repository makes the unattended run refuse, and one with none lets it
      reach the swap.

> **Measured 2026-10-18:** `agents/evidence/analysis/mid-session-swap-probe-2026-10-18.md`.
> The 487 exit-127 failures are the binary missing from `PATH` while npm
> replaces it; under the real hook wrapper that window also makes a
> fail-closed `pre_tool_use` guard silently exit 0. Steps 3.2, 4.2 and 4.3
> activate or install, so they wait on 1.4; 3.1, 3.3–3.5 and 4.1 do not swap
> anything and can land before it.

## Phase 2 — A safety envelope on the verb that already exists

- [ ] **2.1 `upgrade --unattended`, no new verb.** ADR-041 is accepted; this
      is a flag on `cmd_upgrade.ts`. It refuses unless every gate passes: a
      72 h release age, a provenance check against the OIDC publish
      (`publish-npm.yml:62`), a `deprecated` check in the same fetch, and the
      `engines` comparison from the sibling roadmap.
      verify: a fixture per gate shows the refusal and its reason.
      *Open on one gate (2026-10-18).* The flag, the age, `deprecated`,
      `engines` and impact-map gates landed with a refusal fixture each. The
      provenance gate checks that an attestation is present and carries an
      SLSA provenance predicate; it does **not** verify the attestation's
      signature or tie it to `publish-npm.yml`. That verification is what
      keeps this step open. Harmless today: the production wiring swaps
      nothing until 1.4.
      *The `running_origin` half is fixed (2026-10-19).* `_is_source_repo`
      answers "am I standing in an agent-config tree", and **both** of its
      positive signals — a `dist/agent-src/` directory and a `package.json`
      named `@event4u/agent-config` — are in every published tarball, so every
      installed package read as a source checkout and `quiet_context`
      suppressed the unattended run on all of them. The `.git`-at-package-root
      test is now the one shared definition
      (`doctor_install_mode.isSourceCheckoutPackage`), used by
      `running_origin` and by `doctor_update_verdict` so the two cannot drift;
      `_is_source_repo` itself is unchanged, because its three remaining
      callers ask the question it actually answers. Measured on a real packaged
      install (`npm pack` → `npm install --omit=dev --ignore-scripts` into an
      empty directory outside the repo → `upgrade --unattended --dry-run`):
      **before** `not installing — suppressed: source checkout`, **after**
      `not installing (installed: 16.5.0) — candidate 16.5.0 is not newer than
      16.5.0` — the origin gate now passes and the refusal is the honest one.
      A real checkout still reads `source-checkout`.
      *The signature half landed half-closed (2026-10-20), and the half that
      did not is now a blocker rather than a sentence.* `provenance_verify`
      gained `verify_attestation_signature`: the DSSE envelope's signature is
      verified against the public key of the certificate the bundle carries,
      over a real pre-authentication encoding, and that certificate's own SAN
      must name `publish-npm.yml` in this repository — so a payload edited
      after signing, a signature that does not belong to its own certificate,
      and a bundle whose payload claims one identity while its certificate
      carries another are all refused. Fixtures are real: an EC P-256 key and
      a certificate minted with `openssl`, a genuine signature, both
      directions asserted
      (`tests/lib/provenance_signature.test.ts`).
      **What is NOT closed:** there is no trust root — no Fulcio issuer check,
      no Rekor inclusion proof — so a self-signed certificate carrying the
      expected SAN passes, and that is asserted as a known limitation in the
      same test file rather than left to be discovered. Closing it is a
      dependency decision, registered as `### blocker: dsse-trust-root`.
      A sentence this step used to rest on was also false and is retracted
      rather than quietly dropped: `upgrade_unattended.ts` claimed the
      signature half was `npm audit signatures` "in the install step", and
      `install_steps` never ran an audit.
      **This step stays open on `dsse-trust-root`.**
<!-- blocked-by: dsse-trust-root -->
- [x] **2.2 Single-flight.** A lock with a TTL and an owner PID under
      `~/.event4u/agent-config/`; the previous version read from
      `installed_lock.ts:42-45`.
      verify: two concurrent invocations produce exactly one install and one
      recorded refusal.
- [x] **2.3 Failure restores and degrades.** Any failure restores the
      previous version and drops to `notify` with the reason. `EACCES` prints
      the exact command to run and never invokes `sudo`.
      verify: fault injection for offline, 403, 404, disk full, SIGTERM,
      partial settings sync and a concurrent caller — after each, the
      installed version equals the version before.
- [x] **2.4 Global surfaces only.** The unattended path never touches
      `agent_config_version` (`cmd_update.ts:11-13`) and never writes into a
      project.
      verify: a project carrying a pin is byte-identical before and after.
- [x] **2.5 Add `--skip <version>`, and do not add `--to`.** `update --to`
      already exists (`cmd_update.ts:412`); a second near-identical flag on
      the confusable verb is the defect its sibling roadmap is fixing.
      verify: `grep -c "'--to'" src/scripts/_cli/cmd_upgrade.ts` -> /^0$/

## Phase 3 — Delivery into the session, without entering the model

- [x] **3.1 A `session_start` concern beside `wrapper-freshness`.**
      Registered in `src/scripts/hook_manifest.yaml`, day-throttled through
      `probe_throttle.ts:50`, a 1 s budget, fail-open, effect `notification`,
      addressed to the **user**.
      verify: p95 hook latency stays inside the Phase 1.3 baseline.
      Written and tested 2026-10-20 as `update-notice`
      (`src/scripts/update_notice_hook.ts`), and **not registered**: the
      manifest binds it on no event of any host, and its test asserts exactly
      that, so the commit that registers it turns the test red and has to carry
      the new council verdict. File reads only — the cached registry probe, the installed
      `package.json` and `CHANGELOG.md`, the session register — so it opens no
      socket; measured p95 over 20 in-process runs is asserted under 100 ms
      against the 1.3 `session_start` baseline of 160 ms for the WHOLE
      dispatch. **Registering it will need room first.** The conditional chunk
      that made room for it (D10) was split out of this change on 2026-10-20:
      it touches four ratification-watched files, the round that would ratify
      it alone could not run on exhausted council quota, and without the two
      concerns it buys nothing. Without it the bundle stands at 1,549,984 of
      1,550,000 B, so the next round has to bring the room back with the
      registration.
- [x] **3.2 Stage and verify only; activate at a boundary.** The concern never
      swaps files mid-session; activation happens at the next `session_start`
      before the dispatcher reads anything.
      verify: a fixture session observes no file change between its first and
      last hook invocation.
      Written 2026-10-20, then narrowed by review (D13): `updateNotice` STAGES
      and reports and returns `activate: null` on every path, so the concern
      installs nothing at all — activation stays with `upgrade --unattended`,
      which refuses while `any_live_session` reports a foreign session. The
      fixture asserts a byte-identical install tree across five invocations.
      Open with 3.1, because a concern nobody registers delivers nothing.
- [x] **3.3 One line from the shipped curated head.** After an update, the
      line comes from `release_highlights.ts:35-41` in the **installed**
      package, plus any `notice` entry from the impact map. Fetched release
      notes are remote untrusted text and never enter model context.
      verify: a fixture with a hostile remote changelog produces no model-
      visible token from it.
      Landed 2026-10-20, as a SHAPE rather than as a scrubbing pass. The
      update-check cache is the sanitising boundary: `_cacheable_impact` keeps
      only keys that parse as versions and values from the published enum, so
      a hostile description, version label or nested object is dropped once at
      write time instead of being re-checked by every reader, and
      `sanitiseImpactMap` applies the same reduction again on read. Prose comes
      from `parseCuratedHead` over the INSTALLED `CHANGELOG.md` or from
      sentences written in `_lib/update_notice.ts`; a cached version string
      that does not parse produces no line at all. The concern exits 0 and
      writes to stderr, so nothing it emits is model context on any host.
- [x] **3.4 A security release is loud in every mode but `off`.** The notice
      names the latest-only policy at `SECURITY.md:21`.
      verify: a fixture with `Security: yes` in range produces the notice
      under `notify` and under `ask`.
      Landed 2026-10-20, asserted under `notify`, `ask`, `auto` and an unset
      mode, and asserted silent under `off`. It fires on live data rather than
      on the fixture alone because the probe now caches the impact block beside
      the version (`fetch_latest_document`) — one fetch, two readers; without
      that the security branch could never have fired in production.
- [x] **3.5 Hosts with no session slot keep the CLI banner.**
      verify: a fixture in which `agent-config hooks:status` reports no
      `session_start` binding still yields the banner path.
      True by construction today, because no host binds `update-notice` and
      `_dispatch.bash` still calls `check_update_banner`. The claim this step
      makes — `copilot`, the one host with no `session_start` slot, keeps the
      banner once the concern is bound elsewhere — is only checkable after 3.1
      registers it.

## Phase 4 — Consent and rollout, nothing flipped silently

- [x] **4.1 One settings key.** `update.mode: auto | ask | notify | off` in
      `src/config/agent-settings.template.yml` beside `update_check:` at
      `:1529`, reusing the standing-consent model at `cmd_upgrade.ts:578-586`.
      An absent key behaves exactly as today.
      verify: a settings file with no `update:` block produces byte-identical
      behaviour to the current release, asserted against recorded output.
      Landed 2026-10-20 as a class-C `consent` key — only a hand-edit or the
      GUI write route may set it, because `auto` is something a user cannot
      un-see happening to their machine. "Byte-identical" is asserted the one
      way it is falsifiable: `updateNotice` under an unset mode and under
      `notify` return `toStrictEqual` outcomes, and so does `ask` until the
      ring-0 exit ships a prompt — so an absent block is not merely similar to
      today, it is the same value. The reader is user-global ONLY: a repository
      cannot decide how its contributors' global installs update themselves,
      which is J3's pin hazard pointed the other way.
- [x] **4.2 Ring 0 on the channel that already exists.** Maintainer machines
      on the `next` dist-tag (`publish-npm.yml:154-168`) at `mode: auto`.
      Exit condition: four consecutive releases installed unattended with
      zero rollbacks and zero errors in the Phase 1 probe.
      verify: the ring-0 record is committed before 4.3 lands.
      The record is committed:
      `agents/evidence/analysis/ring-0-unattended-record-2026-10-20.md`,
      enrolled and NOT exited, zero rows. **The step is the instrument, not
      the exit** — the exit needs four real releases and cannot be reached in
      a change. The record carries one machine-readable line,
      `ring-0-exit: no`, written by a human after reading the table and
      recomputed by nothing, and that line is what 4.3's gate reads.
- [x] **4.3 Ask once, at a moment that earned it.** After the ring-0 exit, one
      host-native question in the `stop` slot, after a turn that ended on a
      verified success. It carries a permanent "never". Existing installs are
      **asked**, never flipped.
      verify: a fixture asserts zero prompts under CI, non-TTY, headless,
      `--json` output and a subagent run.
      Landed 2026-10-20 as `update-auto-invite`
      (`src/scripts/update_invite_hook.ts`), bound on `stop` and nowhere else.
      All five contexts are asserted to produce zero prompts, and so are a
      recorded "never", a second run, a mode the user already chose, and a turn
      that did not end on a verified success — the last read through
      `readRunEvidence`, the same evidence the turn-end gate uses.
      **It is closed today by the 4.2 record, not by a flag:** it returns
      before reading anything else while `ring-0-exit: no`, which is every
      install. It never writes `update.mode`; the invitation says how, and the
      "never" it records lives in its own state file and binds nothing else.
      The question reaches the user through the warn path, in the host's
      declared `ask:` shape (native tool where a host offers one, the numbered
      text block otherwise).
      **Narrowed 2026-10-20 to the council's (d):** the invitation now needs
      `update.mode: ask` — a class-C value only a human can write — before it
      reads the ring-0 record, which stays as a second kill switch. An absent
      key and `notify` ask nothing, asserted. Not registered, like 3.1.
- [x] **4.4 A pin advisor for teams.** `update --check` in a pinned project
      lists what lies between the pin and latest, read from the impact map.
      It proposes; it never moves the pin.
      verify: the command's exit code and the pin are unchanged by it.
- [x] **4.5 Plan the Node-22 floor as the first `action` release.** Move the
      45 Node-20 CI pins in the same release, so the ask path is exercised on
      a real case rather than a fixture.
      verify: blocked on `node-floor-raise`; nothing lands until it resolves.
      Unblocked 2026-10-18: ADR-290 chose (a). Both council seats prefer this
      major to also carry the settings-key removals of
      `road-to-a-setup-that-decides-itself` Phase 4; that coupling is open there.
      The plan is committed:
      `agents/evidence/analysis/node-22-floor-release-plan-2026-10-20.md`.
      **Planned, not executed** — a semver-major that removes a compatibility
      commitment is a release run, and that is the maintainer's. Re-measured at
      HEAD: **48 CI sites in 27 files** (45 literal `node-version: 20` lines in
      26 files plus 3 `node: ['20','22']` matrix lists in 2), not the 45 this
      step quotes nor the 41 the blocker corrected to on 2026-10-16 — the
      number moves as workflows are added, so the plan re-counts rather than
      trusting a table. The `--target=node20` esbuild flags are deliberately
      out of scope and the plan says why. One claim the plan refuses to make:
      this release exercises the `action` REFUSAL path on real registry data,
      not the consent path, because no prompt ships until the ring-0 exit.

## Blockers

### blocker: concerns-refused-as-authority-expansion

- **Status:** resolved 2026-10-20 — round 2 returned `ratified` 2/2 (anthropic +
  openai), recorded at `agents/evidence/ratifications/`
  `update-concerns-declared-20261020.md`. Both concerns are registered, under
  two effect terms the same ratification added: `update-notice` is
  `state_change`, `update-auto-invite` is `interaction`. Four of the six
  conditions the seats attached are tests rather than sentences
  (`tests/scripts/update_concerns_declared_effects.test.ts`); condition 6 —
  documenting whether staged state is visible, replaceable and clearable — is
  NOT discharged and is named here rather than quietly dropped, because
  `reversible` may not be assumed merely because activation is deferred.
  Was: open — raised 2026-10-20 by a council verdict, not by a missing
  decision. The work exists, is tested and is reverted out of the manifest.
- **Class:** 2 — council. The seats named what the next round has to carry, so
  the question is what they asked for, not who owns it.
- **Owner:** council
- **Blocks:** 3.1, 3.2, 3.3, 3.4, 3.5 and 4.3 — every item whose delivery was
  `update-notice` or `update-auto-invite`. Nothing else: the session register,
  the provenance tie and Phase 4's settings key stand on their own and stay
  closed. The lazy-concern chunk does not stand here any more — it was split
  out of this change and returns with the registration.
- **Question:** On what terms do a `session_start` concern that may initiate
  `upgrade --unattended`, and a `stop` concern that may open a question with
  the user, return?
- **What to do:** the seats converged 2/2 and asked for four things
  (`agents/evidence/council/lazy-concern-authority-expansion-20261020.md`) —
  (a) split both concerns out of the chunk change — done, and since
  2026-10-20 the chunk is out of this change too;
  (b) declare them as authority expansions rather than as advisory
  notifications, because `fail_closed: false` and `severity: advisory`
  describe failure and classification, never side effects;
  (c) keep `update-notice` read-only — notify or stage, then require an
  explicit user command or a recorded opt-in before anything activates;
  (d) gate `update-auto-invite` on a user-owned setting, with the ring-0
  record kept only as an additional kill switch, because a rollout switch is
  not consent.
- **State at 2026-10-20, so the next round starts from the tree:** (c) holds —
  `updateNotice` returns `activate: null` on every path (D13). (d) holds —
  `autoInviteDecision` refuses without `update.mode: ask` before it reads the
  ring-0 record (D14). What is left is (b) and the registration itself, both
  in `hook_manifest.yaml`, which is ratification-watched; that round could
  not run on 2026-10-20 because both council seats were quota-exhausted. Its
  prompt package for the chunk alone exists as an unrun draft in the
  originating lane and was not committed, because a prompt with no response
  is not evidence of a round.
- **Recommendation:** take (c) and (d) as written rather than arguing the
  classification. Both are smaller than the capability they replace — a
  concern that stages and reports needs no authority argument at all — and
  they turn the ratification question from "may a hook decide this" into
  "does this hook still decide anything", which is the version a reviewer can
  settle from the diff.
- **If you do nothing:** the chunk and the register ship without the surface
  they were built for, so a user who never opens a terminal still learns
  about an update from nowhere — the gap Phase 3 opened against. The six
  items stay open with their implementation already written and reverted,
  which is the state most likely to be rediscovered as "why is this not
  wired" six months from now.
- **Resolved when:** a council round records a verdict on a change that
  carries (b), (c) and (d), and the two concerns are registered again under
  it.
- **The argument that lost, recorded because it is the one a later reader
  will make again:** neither concern introduces a new primitive — `upgrade`
  already owns the mutation, notifications already exist, and the invoked
  command re-runs every one of its own gates. Both seats answered that the
  gates constrain **how** an install happens and never **who may start one**,
  so moving that decision into a lifecycle hook is the expansion, whatever
  the primitives already allow.

### blocker: dsse-trust-root

- **Status:** open
- **Class:** 2
- **Owner:** council
- **Blocks:** step 2.1 only. Phases 3 and 4 run without it, and the gate it
  bounds already refuses more than it did: the tie to `publish-npm.yml`, the
  DSSE signature against the bundle's own certificate, and that certificate's
  SAN are all checked.
- **What to do:** pick exactly one — (a) take a sigstore verification
  dependency (`@sigstore/verify` or equivalent), pin the Fulcio roots, verify
  the issuer chain and the Rekor inclusion proof in process, and absorb the
  bytes in the pack budget; or (b) shell out to `npm audit signatures` against
  a throwaway install of the candidate before the global swap, paying one
  extra download per upgrade and depending on the npm client's own trust
  store; or (c) record that the certificate-bound check is the floor this
  package verifies, state the residue in `SECURITY.md`, and close 2.1 on that.
- **Resolved when:** one of (a), (b) or (c) is recorded as a Decision row in
  this file or as an ADR under `docs/decisions/`, and this blocker's Status
  reads `resolved — <record>`.
- **Recommendation:** none offered, deliberately. Each option trades a
  different thing — (a) bytes and a dependency, (b) bandwidth and a shell-out
  on the install path, (c) coverage — and the measurement that would separate
  them does not exist in this tree: nothing here knows the pack-budget cost of
  a sigstore dependency or the wall-clock cost of a second download. A
  recommendation written without either would be a preference wearing a
  measurement's clothes.

  **What the residue actually is, stated so the council is not deciding in the
  abstract.** `verify_attestation_signature` verifies the DSSE envelope
  against the public key of the certificate the bundle carries, and requires
  that certificate's SAN to name this repository's `publish-npm.yml`. Nothing
  checks who ISSUED that certificate. So an attacker who can serve the
  registry response an install reads can mint a self-signed certificate with
  the expected SAN, sign their own payload with it, and pass. The check
  defeats a partial compromise — a mis-scoped workflow, an edited payload, a
  bundle reused from another build — and does not defeat a forged bundle.
  `tests/lib/provenance_signature.test.ts` asserts that limit as a test rather
  than describing it, so the day a root is pinned the test flips red and says
  so.

  **Why this is Class 2 and not owner-reserved:** every option is a reversible
  internal engineering trade-off inside an envelope the owner already
  authorised, and none of them lowers a recorded floor — (c) RECORDS the
  current floor rather than weakening it, and (a) and (b) raise it. The
  owner-reserved test would fire if an option removed a check that exists
  today; none does.
- **If you do nothing:** 2.1 stays open with a gate that is strictly stronger
  than the one it replaced and weaker than its own docstring used to claim.
  That is a worse state than either closing it or raising it, because a gate
  whose limit is written down only in a blocker is a gate the next reader
  over-trusts.

### blocker: node-floor-raise

- **Status:** resolved — `docs/decisions/ADR-290-node-floor-22-as-a-major.md`: (a), `engines.node` to `>=22` as a semver-major with every Node-20 CI site moved in the same change. Decided by: AI council (2/2, 2026-10-18), under the owner's delegation of 2026-10-18 ("versuche die offenen entscheidungen im ai council zu lösen"); record `agents/evidence/council/node-floor-raise-20261018.md`. Was: open — owner-reserved (council 2026-10-16, 2/2 ESCALATE before the delegation, both recommending (a) as a semver-major).
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
- **Recommendation:** moved verbatim to `agents/evidence/analysis/update-installs-itself-resolved-blocker-reasoning-2026-10-20.md`; the blocker is resolved and the Status line names its record.
- **If you do nothing:** the floor rises eventually anyway, and the first time
  it does it will be under an unattended updater that has never exercised the
  ask path on a real release.

### blocker: auto-default-for-existing-installs

- **Status:** resolved — `docs/decisions/ADR-291-existing-installs-are-asked-never-flipped.md`: (a), `auto` may default for new installs only; an existing install is asked once, after the ring-0 exit and the live-session register, with a binding "never", and dismissal keeps `notify`. Decided by: AI council (2/2, 2026-10-18), under the owner's delegation of 2026-10-18 ("versuche die offenen entscheidungen im ai council zu lösen"); record `agents/evidence/council/auto-default-existing-installs-20261018.md`. Was: open — council 2026-10-16 split (`anthropic` DECIDE (b), `openai` ESCALATE (a)), before the delegation.
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
- **Recommendation:** moved verbatim to `agents/evidence/analysis/update-installs-itself-resolved-blocker-reasoning-2026-10-20.md`; the blocker is resolved and the Status line names its record.
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
| D6 | contested-technical | agent | Let the Phase 1.1 probe's error count decide whether activation needs a global live-session register, and design nothing on either assumption before it | the hazard is unmeasured, and a design built on a guess about it is the failure this phase exists to prevent. **Branch taken 2026-10-18: non-zero.** The 1.1 probe counted **490** failed hook invocations of **4,190** fired during four swap rounds (16.4.0 ⇄ 16.5.0; 487 exit-127, 3 exit-1), against 0 of 100 in the baseline — so activation waits on a global live-session register (step 1.4) | the probe is re-run on a host with different hook timing |
| D7 | product-owned | council:agents/evidence/council/node-floor-raise-20261018.md | Blocker `node-floor-raise` → (a): `engines.node` `>=22` as a semver-major, the first `action` release, `engines` and every Node-20 CI site in one change, migration notes naming the last Node-20-compatible version with no backports (ADR-290) | AI council 2026-10-18, `anthropic` + `openai`, prompt mode, one round, 2/2, $0.00, under the owner's delegation of 2026-10-18 ("versuche die offenen entscheidungen im ai council zu lösen") | consumer-usage evidence shows a material share of installs stranded on Node 20 |
| D8 | product-owned | council:agents/evidence/council/auto-default-existing-installs-20261018.md | Blocker `auto-default-for-existing-installs` → (a): `auto` may default for new installs; an existing install is asked once with a binding "never", only after the ring-0 exit and step 1.4, never under CI, headless, non-TTY, `--json` or a subagent run (ADR-291) | AI council 2026-10-18, `anthropic` + `openai`, prompt mode, one round, 2/2, $0.00, under the owner's delegation of 2026-10-18 ("versuche die offenen entscheidungen im ai council zu lösen") | an unattended release rolls back or breaks a live session |
| D9 | reversible-technical | council:agents/evidence/council/hook-bundle-ceiling-20261018.md | The hook-bundle ceiling (`src/config/hook-bundle-budget.json`, 1,547,451 of 1,550,000 B at `f55e5a760`) is not raised for 3.1 and 3.3–3.5: room is made first — a per-module byte ranking from the metafile, then the largest narrow-event module moved behind a conditional import, proven inside `hook-latency-budget.json`; a raise only as the evidence-backed fallback, sized from all blocked work | AI council 2026-10-18, `anthropic` + `openai`, prompt mode, one round, 2/2, $0.00, under the owner's delegation of 2026-10-18 ("versuche die offenen entscheidungen im ai council zu lösen") | no extraction frees meaningful room within the latency and reliability budgets |
| D10 | reversible-technical | agent | Make room for 3.1 by moving `chat_history` — the largest narrow-event module in the metafile ranking — into a conditional chunk, rather than raising the dispatch ceiling | D9 settled the mechanism on 2026-10-18 and ordered it: extraction first, a raise only where no extraction frees meaningful room. 121,219 bytes of exclusive closure for a concern bound on one event is meaningful room, so the raise's own precondition does not hold. Measured 1,549,961 -> 1,429,414 B before the new concerns | an extraction stops freeing room and a raise becomes the evidence-backed fallback D9 describes. **Withdrawn from this change 2026-10-20** (D14): the chunk returns with the concerns' registration |
| D11 | critical-technical | evidence | The per-concern stdin override lives on `globalThis`, not in a module-local binding | a chunk is a second module graph in one process, so the dispatcher set its own copy and the lazily loaded concern read another, fell through to an already-consumed fd 0, and wrote nothing at exit 0. Measured on `chat-history`; pinned by `tests/scripts/hooks/hook_stdin_cross_graph.test.ts`, which goes red in both directions when the binding is made local again | a chunk boundary stops existing, i.e. every concern is inlined again. **Withdrawn with D10 on 2026-10-20** — the revisit condition fired: with the chunk out, every concern is inlined again, and the override is module-local as on `main` |
| D12 | critical-technical | agent | Close the half of 2.1's provenance signature that needs no dependency, and register the trust root as a blocker instead of asserting it | the DSSE signature against the bundle's own certificate and that certificate's SAN are checkable with `node:crypto` alone and stop an edited payload, a borrowed signature and a mismatched identity. A Fulcio issuer check and a Rekor proof are not, and the three ways to get them trade bytes, bandwidth and coverage with no measurement in this tree to separate them — so the choice is the council's, recorded as `dsse-trust-root` | the blocker resolves, or a measurement of the pack-budget cost of a sigstore dependency appears |
| D13 | critical-technical | evidence | `update-notice` stages and reports; it never installs. The activation seam it first shipped was removed rather than the `effect:` vocabulary widened | an independent provider review (openai, 2026-10-20, direct CLI, `refused`) held that `effect: notification` means "tells the human something and changes nothing else" and that `fail_closed`/`severity` describe failure handling rather than permitted effects. Widening a closed vocabulary to fit one concern is how the vocabulary stops meaning anything | a future step genuinely needs a hook-triggered install, in which case it needs its own effect value and its own review |
| D14 | reversible-technical | agent | Split the lazy-concern chunk out of this change, and gate `update-auto-invite` on `update.mode: ask` | the chunk touches four ratification-watched files (`hook_manifest.{yaml,json}`, `dispatch_hook.ts`, `hook-bundle-budget.json`) and only made room for two concerns the council refused; the round to ratify it alone could not run, both seats being quota-exhausted. Without it the rest fits the unchanged ceiling — 1,549,984 of 1,550,000 B, base 1,549,699 B. The `ask` gate is the council's (d) taken literally: a value only a human can write stands in front of the rollout switch | the next council round reads ADR-291's "an existing install is asked once" as requiring the question without an opt-in, in which case the gate moves back behind ring-0 |

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
<!-- risk-review: v1 | reviewed: 2026-10-20 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | An unattended install breaks a running session | implementation | Hooks re-invoke the dispatcher per event; a swap mid-session runs new code against old state. **Measured 2026-10-18: 490 of 4,190 hook invocations failed during four swaps**, and the missing-binary window also makes a fail-closed guard exit 0 unseen. | The count was non-zero, so 1.2 took the blocking branch, and step 1.4 has landed: every session now also registers in a machine-wide register, and `upgrade --unattended` refuses while it reports a foreign live session. Residual, re-reviewed 2026-10-20: the register write is best-effort, so a session that cannot reach the global root reads as absent, and the run then leans on its lock and age gates. No hook activates anything (D13). | Phase 1 — Measure the hazard before building on it |
| 2 | A version that cannot start is installed | implementation | An `engines` floor the local runtime does not satisfy takes every hook down at once. | The engines comparison is a refusal gate in 2.1, inherited from the sibling's classifier; 2.3 restores the previous version on any failure. | Phase 2 — A safety envelope on the verb that already exists |
| 3 | The new session concern costs latency on every session | product | A per-session probe on a surface that currently costs nothing. | 1.3 baselines before, 3.1 budgets to 1 s and fails open, and the day throttle already exists. Re-reviewed 2026-10-20: no concern is registered in this change, so the cost today is zero; it returns with the registration, which also has to bring room back into a bundle that stands 16 B under its ceiling. | Phase 3 — Delivery into the session, without entering the model |
| 4 | A user is silently moved onto a default they did not pick | product | The opt-in becomes a default by momentum rather than by decision. | 4.1 makes an absent key behave as today, asserted against recorded output; the second blocker makes the flip an owner decision with a recorded answer. | Phase 4 — Consent and rollout, nothing flipped silently |
| 5 | Fault injection misses the failure that actually happens | implementation | Seven injected faults are the ones their author thought of. | The restore invariant is asserted uniformly — installed version before equals after — so an unanticipated fault fails the same assertion rather than needing its own case. | Phase 2 — A safety envelope on the verb that already exists |
| 6 | The ring-0 exit is declared on a reading nobody recorded | implementation | "Four clean releases" becomes an impression. | 4.2 requires the record committed before 4.3 lands, and AC-7 asserts the file exists. | Phase 4 — Consent and rollout, nothing flipped silently |

## Acceptance Criteria

- [x] **AC-1** The Phase 1 probe log exists under `agents/evidence/` with a
      numeric error count, and `auto` ships nowhere while that count is
      non-zero and the session register is repository-scoped.
- [x] **AC-2** Under `CI=1`, a non-TTY stdout, a source checkout and
      `AGENT_CONFIG_NO_UPDATE_CHECK=1`, an end-to-end run produces zero
      filesystem writes outside the state file, asserted by a tree diff.
      Asserted 2026-10-20, and strictly: the suppressed contexts produce zero
      writes of ANY kind, not merely zero outside the state file — the
      suppression decision is taken before the day-throttle stamp, which is
      itself a write. Six contexts (`CI=1`, a non-TTY, the opt-out, `mode:
      off`, a source checkout, and an end-to-end `scripts-run` under CI) plus a
      file-list diff of the project tree and of the global root.
- [x] **AC-3** A project carrying `agent_config_version` is byte-identical
      before and after an unattended run.
- [x] **AC-4** For each of offline, 403, 404, disk-full, SIGTERM and EACCES,
      the installed version after the run equals the version before, and a
      reason is printed.
- [x] **AC-5** A release published less than 72 h ago, or carrying
      `deprecated`, or with unmet `engines`, or with missing provenance, is
      never installed unattended.
- [x] **AC-6** A settings file with no `update:` block produces byte-identical
      behaviour to the current release.
      Asserted 2026-10-20 as value equality rather than as a recorded-output
      comparison, which is the stronger reading available: `updateNotice` under
      an unset mode and under `notify` return `toStrictEqual` outcomes, so the
      two are the same decision rather than two decisions that happen to look
      alike. `ask` is equal too, because the notice has no prompt of its own,
      and no mode reaches an activation seam since D13 removed it.
- [x] **AC-7** The ring-0 exit record is committed before step 4.3 lands.
      `agents/evidence/analysis/ring-0-unattended-record-2026-10-20.md` is in
      this change, and 4.3's gate reads its `ring-0-exit:` line rather than a
      constant. A test asserts the committed record exists AND has not exited,
      so the day the line flips the gate opens and the test says so.
- [x] **AC-8** No fetched release-note text reaches model context, asserted by
      a fixture with a hostile remote changelog.
      Asserted 2026-10-20 three ways: a planted marker in an impact map's
      description, version key and impact value appears in no emitted line; a
      cached version string with a marker appended produces no line at all;
      and the concern exits 0 writing to stderr, so nothing it emits is model
      context on any host.
- [x] **AC-9** `grep -c "'--to'" src/scripts/_cli/cmd_upgrade.ts` returns 0.
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
