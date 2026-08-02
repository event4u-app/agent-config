# Changelog

All notable changes to `event4u/agent-config` are documented here.
Format loosely follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
versioning policy is documented in [CONTRIBUTING.md](CONTRIBUTING.md#versioning-policy).
Entry-shape contract: [`docs/contracts/CHANGELOG-conventions.md`](docs/contracts/CHANGELOG-conventions.md).

> Entries before 1.3.3 were reconstructed from git history after the fact.
> Early releases did not maintain release notes.
>
> History is split into **eras**. The current era keeps full entries
> inline; prior eras collapse into a single pointer to an archive file
> under [`docs/archive/`](docs/archive/). A drift test
> (`tests/lib/changelog_eras.test.ts`) forces an era split before the
> current era grows past 250 lines.

## [Unreleased]

### Changed

- **Docs hygiene — retired stale authoring-source pointers.** 43 stale
  "edit `.agent-src.uncondensed/`" *authoring* pointers across 28 `.md` files
  repointed at `src/` (the authoring source of truth per ADR-051); continues
  the #989 README/thin-root fixes. `check_source_pointer_freshness`'s allowlist
  broadened (2 → 16 files) to lock the cleaned files against regression. Live
  `.agent-src.uncondensed/` **code constants, pipeline descriptions, and
  catalog paths were deliberately left untouched** — that tree is a live
  generated intermediate, not dead debt; a blind sweep was explicitly rejected.

### Added

- **Internet-reach operator tooling** — upstream-tool health and install-pinning
  discipline for the tools a reach recipe needs. The router skill this was
  scoped around was **cancelled pre-authoring by its own benchmark gate**: the
  pre-registered run returned 0/12 outright wins against the host's native web
  tools (`band: stop`), so no skill, no triggers, no capability-area claim. The
  null is published in [`docs/benchmark.md`](docs/benchmark.md) § internet-reach;
  the decision is [ADR-126](docs/decisions/ADR-126-internet-reach-operator-tooling.md).
  - `reach:doctor` — new read-only command: per-channel probe status,
    `active_backend`, tier, lifecycle, and the exact **pinned** fix command for
    the current platform when a backend is missing or broken. No writes, no
    installs, no network (`--deep` is the explicit opt-in that makes one real
    request per backend and still writes nothing).
  - `src/config/reach-channels.yml` + `reach-channels.schema.json` — ordered
    backend candidates per channel (swapping a backend is a config reorder, not
    a code edit), the four-value lifecycle vocabulary reused from
    `provider-lifecycle`, `last_verified` staleness metadata, and an install
    pattern that **rejects** unpinned versions, `latest`/`main`/`HEAD` refs and
    archive-URL install sources.
  - `tool_probe` — five-state probe taxonomy (`ok`/`missing`/`broken`/`timeout`/
    `error`) with stale-shim detection (resolvable shim, dead interpreter),
    exit-126/127 mapping, timeout-only single retry, and per-channel error
    isolation. Every spawn routes through `hardenedSpawnEnv()`.
  - `check-reach-channels` + `check-reach-prescriptions` CI gates — pinning and
    intake-record discipline is machine-checked, not an honour system; a
    prescription that cannot be pinned does not ship.
  - `check-reach-staleness` CI gate — offline: a channel unverified for >90 days,
    a `deprecated` channel with no `replacement`, or a channel past its
    `removal_after` date and still present fails the build.
  - Registry trust is enforced at runtime, not just in CI: `reach:doctor` (incl.
    `--registry <path>`) validates the registry against its schema and refuses to
    probe on any violation (exit 2). `probe_args` is a flag-shaped **allowlist**
    and `probe_cmd` must equal its backend `id`, so a registry entry can neither
    smuggle a shell payload nor label a row with a binary other than the one that
    ran — both closed by an adversarial pre-merge review, with permanent
    regression fixtures.

- **Doc-follows-code discipline** — deterministic, framework-agnostic mechanism
  so documentation is updated when code changes.
  - `downstream-changes` rule gains a first-class **Doc-Impact** obligation:
    a change to a public surface (route, exported signature, CLI flag, config/
    settings key, env var, DB schema, event payload) is incomplete until the
    doc that describes it is updated in the same change; escape hatch for
    refactor-only / no-surface changes.
  - `agent-docs-writing` skill: the advisory doc-sync table becomes an
    actionable, cross-stack Doc-Impact procedure with a falsifiable-claim
    fire/no-fire test.
  - `check_source_pointer_freshness` CI gate — fails when an authoring file
    names the retired `.agent-src.uncondensed/` tree as source of truth.
  - Opt-in consumer CI template `github-workflows/doc-impact.yml` (warn-first,
    `[docs:not-needed]` / `refactor:` escape hatch, `STRICT` toggle).

### Fixed

- **`/team delegate` double gate is now enforced in code, not only in prose**
  (team mode stays default-off; closing `road-to-team-mode`). The gate on the
  only write-access wrapper existed as agent-followed instructions in the
  command doc — nothing mechanical checked `ai_team.allow_delegate`, and no
  test covered any of the three flag combinations. Added
  `assert_delegate_allowed()` + `TeamDelegateDisabledError` in
  `src/scripts/ai_team/team_dispatch.ts` (mirroring the existing
  `run_team_review` fail-closed shape) plus a `--delegate-gate` CLI mode that
  exits non-zero with the opt-in pointer unless **both** `ai_team.enabled` and
  `ai_team.allow_delegate` are true; all three combinations are test-pinned.
- **Default-off parity for team mode is now pinned where it was only
  claimed**: the Stop-hook E2E covered `enabled: true` + `managed: false`
  only, so the shipped default posture (`ai_team` absent, or
  `enabled: false`) was never exercised — two new pins assert a strict no-op
  (exit 0, no stdout, no state, no ledger). The command-suggestion surface
  gained its own pin (exactly one eligible team command, its
  `trigger_context` carrying the `ai_team.enabled is true` agent-side
  precondition, all sub-commands ineligible, and zero `ai_team` awareness in
  the deterministic suggester — so its output is invariant with respect to
  that config).
- Stale `not yet manifest-wired` header comments in
  `src/scripts/ai_team/review_gate.ts` and
  `src/scripts/team_review_gate_hook.ts`: the Stop-concern registration
  landed with team-mode Phase 4 (`hook_manifest.yaml`, claude `stop` chain),
  so the comments told a reviewer auditing default-off that the hook was
  still inert.
- Source-of-truth pointer drift: `src/agent-src/README.md` and the
  `agents-md-thin-root` skill named the retired `.agent-src.uncondensed/`
  tree; corrected to `src/`.
- **Embed-contract docs completed + de-drifted**
  ([`docs/contracts/local-server-ports.md`](docs/contracts/local-server-ports.md),
  [`docs/contracts/local-server-api.md`](docs/contracts/local-server-api.md)):
  the host-facing contract now carries the framing-DENY council reasoning, the
  `local-server.json` discovery-file rules (`url` embeds `?token=` — hosts
  rebuild from `port` + a fresh token read; `0600` is a contract invariant),
  the `?token=` accepted-risk statement, the wizard-out-of-scope-for-embed-v1
  note, and a Host-lifecycle section (idle-shutdown watchdog + keepalive,
  headless refusal). `local-server-api.md` had three stale claims corrected:
  the token IS persisted (`local-server.token`, mode `0600`) — not
  "never written to disk"; headless `ui:serve` refuses with exit 2 — it does
  not silently boot browserless; the ping example now shows the
  `capabilities` block. Plus an explicit `capabilities.embed` assertion in
  `tests/server/app.test.ts`. Closes `road-to-ac-embeddable-gui`.

> The former "6.0.0 at a glance" overview was drained on 2026-07-21 to
> [`docs/archive/CHANGELOG-6.0.0-overview.md`](docs/archive/CHANGELOG-6.0.0-overview.md).

# Era: pre-4.5.0 — archived

> All entries before `4.5.0` live in
> [`docs/archive/CHANGELOG-pre-4.5.0.md`](docs/archive/CHANGELOG-pre-4.5.0.md).
> The archive is read-only; git tags remain the canonical
> source for what shipped. Splitting them out of the main file
> keeps the active era under the 250-line drift cap enforced by
> `tests/lib/changelog_eras.test.ts`.

# Era: pre-5.4.0 — archived

> All entries before `5.4.0` live in
> [`docs/archive/CHANGELOG-pre-5.4.0.md`](docs/archive/CHANGELOG-pre-5.4.0.md).
> The archive is read-only; git tags remain the canonical
> source for what shipped. Splitting them out of the main file
> keeps the active era under the 250-line drift cap enforced by
> `tests/lib/changelog_eras.test.ts`.

# Era: pre-5.9.0 — archived

> All entries before `5.9.0` live in
> [`docs/archive/CHANGELOG-pre-5.9.0.md`](docs/archive/CHANGELOG-pre-5.9.0.md).
> The archive is read-only; git tags remain the canonical
> source for what shipped. Splitting them out of the main file
> keeps the active era under the 250-line drift cap enforced by
> `tests/lib/changelog_eras.test.ts`.

# Era: pre-6.0.0 — archived

> All entries before `6.0.0` live in
> [`docs/archive/CHANGELOG-pre-6.0.0.md`](docs/archive/CHANGELOG-pre-6.0.0.md).
> The archive is read-only; git tags remain the canonical
> source for what shipped. Splitting them out of the main file
> keeps the active era under the 250-line drift cap enforced by
> `tests/lib/changelog_eras.test.ts`.

# Era: pre-7.0.0 — archived

> All entries before `7.0.0` live in
> [`docs/archive/CHANGELOG-pre-7.0.0.md`](docs/archive/CHANGELOG-pre-7.0.0.md).
> The archive is read-only; git tags remain the canonical
> source for what shipped. Splitting them out of the main file
> keeps the active era under the 250-line drift cap enforced by
> `tests/lib/changelog_eras.test.ts`.

# Era: pre-8.0.0 — archived

> All entries before `8.0.0` live in
> [`docs/archive/CHANGELOG-pre-8.0.0.md`](docs/archive/CHANGELOG-pre-8.0.0.md).
> The archive is read-only; git tags remain the canonical
> source for what shipped. Splitting them out of the main file
> keeps the active era under the 250-line drift cap enforced by
> `tests/lib/changelog_eras.test.ts`.

# Era: pre-8.1.0 — archived

> All entries before `8.1.0` live in
> [`docs/archive/CHANGELOG-pre-8.1.0.md`](docs/archive/CHANGELOG-pre-8.1.0.md).
> The archive is read-only; git tags remain the canonical
> source for what shipped. Splitting them out of the main file
> keeps the active era under the 250-line drift cap enforced by
> `tests/lib/changelog_eras.test.ts`.

# Era: pre-8.9.0 — archived

> All entries before `8.9.0` live in
> [`docs/archive/CHANGELOG-pre-8.9.0.md`](docs/archive/CHANGELOG-pre-8.9.0.md).
> The archive is read-only; git tags remain the canonical
> source for what shipped. Splitting them out of the main file
> keeps the active era under the 250-line drift cap enforced by
> `tests/lib/changelog_eras.test.ts`.

# Era: pre-8.12.0 — archived

> All entries before `8.12.0` live in
> [`docs/archive/CHANGELOG-pre-8.12.0.md`](docs/archive/CHANGELOG-pre-8.12.0.md).
> The archive is read-only; git tags remain the canonical
> source for what shipped. Splitting them out of the main file
> keeps the active era under the 250-line drift cap enforced by
> `tests/lib/changelog_eras.test.ts`.

# Era: pre-9.2.0 — archived

> All entries before `9.2.0` live in
> [`docs/archive/CHANGELOG-pre-9.2.0.md`](docs/archive/CHANGELOG-pre-9.2.0.md).
> The archive is read-only; git tags remain the canonical
> source for what shipped. Splitting them out of the main file
> keeps the active era under the 250-line drift cap enforced by
> `tests/lib/changelog_eras.test.ts`.

# Era: pre-9.9.0 — archived

> All entries before `9.9.0` live in
> [`docs/archive/CHANGELOG-pre-9.9.0.md`](docs/archive/CHANGELOG-pre-9.9.0.md).
> The archive is read-only; git tags remain the canonical
> source for what shipped. Splitting them out of the main file
> keeps the active era under the 250-line drift cap enforced by
> `tests/test_changelog_eras.py`.

# Era: pre-9.10.0 — archived

> All entries before `9.10.0` live in
> [`docs/archive/CHANGELOG-pre-9.10.0.md`](docs/archive/CHANGELOG-pre-9.10.0.md).
> The archive is read-only; git tags remain the canonical
> source for what shipped. Splitting them out of the main file
> keeps the active era under the 250-line drift cap enforced by
> `tests/test_changelog_eras.py`.

# Era: pre-9.13.0 — archived

> All entries before `9.13.0` live in
> [`docs/archive/CHANGELOG-pre-9.13.0.md`](docs/archive/CHANGELOG-pre-9.13.0.md).
> The archive is read-only; git tags remain the canonical
> source for what shipped. Splitting them out of the main file
> keeps the active era under the 250-line drift cap enforced by
> `tests/test_changelog_eras.py`.

# Era: 9.13.x — current

> Started at `9.13.0`. Full entries live inline below.
> The drift test caps this era at 250 lines of entry body; growth past
> that forces a new era split (`# Era: 9.14.x`, etc.) — see
> [`docs/contracts/CHANGELOG-conventions.md § Era splits`](docs/contracts/CHANGELOG-conventions.md).

## [9.14.0](https://github.com/event4u-app/agent-config/compare/9.13.0...9.14.0) (2026-08-02)

### Release highlights

<!-- Curated head: fill before merge, keep it under 10 lines, and leave `_none_` where it is genuinely the answer. The generated log below is unchanged. -->
- **Behaviour changes:** _none_
- **Default changes + migration:** _none_
- **Security and correctness:** _none_
- **Honest nulls:** _none_
- **Known limitations:** _none_

### Features

* **gates:** fail on any count position the generator cannot rewrite ([71c8761](https://github.com/event4u-app/agent-config/commit/71c8761e1a7ba5a7d89e234c30b22daa41f2ee3f))
* **counts:** generate the scoped-projection and active-command figures ([0a69bad](https://github.com/event4u-app/agent-config/commit/0a69bad08a166295fbe0cf5be018742600f02450))

### Documentation

* **roadmap:** close and archive road-to-reproducible-artefact-counts ([2599fc4](https://github.com/event4u-app/agent-config/commit/2599fc470e8390bc7f03dbc3787f74933e5cd5a7))
* **claims:** bind the default-install claim to the emitter, date the snapshot ([222c83c](https://github.com/event4u-app/agent-config/commit/222c83c0fb64105ff4819add5220c27182020cb6))

### Refactoring

* **install:** extract the scoped-projection predicate into _lib ([59be75f](https://github.com/event4u-app/agent-config/commit/59be75f3d7d9105a29e110424acce4bfeae1950e))

### Tests

* **counts:** witness that the two gates now move together ([14ac65b](https://github.com/event4u-app/agent-config/commit/14ac65b73355363204784585d76640a23b98e3c9))

### Build

* **install:** rebuild the install bundle for the extracted predicate ([00cc359](https://github.com/event4u-app/agent-config/commit/00cc359ce6a0582857b62f662b19e4cfd809b0b9))

Tests: 10054 (+12 since 9.13.0)

## [9.13.0](https://github.com/event4u-app/agent-config/compare/9.12.0...9.13.0) (2026-08-02)

### Release highlights

<!-- Curated head: fill before merge, keep it under 10 lines, and leave `_none_` where it is genuinely the answer. The generated log below is unchanged. -->
- **Behaviour changes:** _none_
- **Default changes + migration:** _none_
- **Security and correctness:** _none_
- **Honest nulls:** _none_
- **Known limitations:** _none_

### Features

* **gates:** full-population dead-scan-root sweep with a dispositions ledger ([3711ff3](https://github.com/event4u-app/agent-config/commit/3711ff3e1f8727c31ceac3f5b56fefedf07d8df3))
* **skills:** add the over-build review lens with a golden-set gate ([071a44a](https://github.com/event4u-app/agent-config/commit/071a44aa573d5cfc89fcd254649e4e3a7c0e106e))
* **rules:** land the solution-size ladder as extensions, not a new rule ([42c4960](https://github.com/event4u-app/agent-config/commit/42c49604682d659312cb4f0cffe3a61f6b301a8c))
* **lint:** clustered-only positive description checks ([64d3ce4](https://github.com/event4u-app/agent-config/commit/64d3ce4784e4dcd7918d01e4a5e409784220c79f))
* **release:** put a curated head above the generated log ([47ad07d](https://github.com/event4u-app/agent-config/commit/47ad07d56c946dd18988be36fd23695493db0316))
* **bench:** bench:ui — score a port against its ground truth, no model in the path ([48202e3](https://github.com/event4u-app/agent-config/commit/48202e3e5364913c8a2a8462b0654d3ad6ca7f0a))
* **design:** a provided artifact outranks anti-slop, house taste last ([0014df8](https://github.com/event4u-app/agent-config/commit/0014df856aa17dbce1c8b37f31426efd4c2aaf5b))
* **ui-track:** honour a provided design contract, or state the loss first ([cd43b9b](https://github.com/event4u-app/agent-config/commit/cd43b9b50a31997297a6a9cb0717e858857c5b3d))
* **design-fidelity:** route the handover prompts people actually write ([e94688f](https://github.com/event4u-app/agent-config/commit/e94688ff6da463e500f2ad7076ca6c1ec2fbf64c))

### Bug Fixes

* **gates:** drop retired-container literals from the sweep test ([38e5694](https://github.com/event4u-app/agent-config/commit/38e5694d4e0ce8b22b31b03e32d14ecf4bfcf366))
* **tests:** keep the lean-crud fixture out of vitest's collection glob ([7736f2f](https://github.com/event4u-app/agent-config/commit/7736f2f7f5c710901b0cf801300618bb09e6fc65))
* **gates:** make the lint-regression baseline actually collect and compare ([cea1b6d](https://github.com/event4u-app/agent-config/commit/cea1b6dc5cb978846ad28c6b7b5762d943f1b781))
* **lint:** re-anchor the drifted supply-chain-intake leakage exemption ([f4aca87](https://github.com/event4u-app/agent-config/commit/f4aca87449abb6d45d54617790f26aa24257ed3c))
* **runtime:** resolve an automated tool grant against the trusted registry ([f4470e1](https://github.com/event4u-app/agent-config/commit/f4470e1f4c6fe4784d8fa01e5729edc911ad6f0e))
* **hooks:** gate the effect, not the shape of one action ([3e0dab1](https://github.com/event4u-app/agent-config/commit/3e0dab1a3e4b35c776fdc618c5af432cf1badf85))
* **deps:** keep the parser pair as a devDependency, not a bare removal ([d934461](https://github.com/event4u-app/agent-config/commit/d934461b223d1e61b0e0f8cc337d7ef0b99e2e99))
* **build:** rebuild the installer bundle against a real node_modules ([02deabf](https://github.com/event4u-app/agent-config/commit/02deabfcfa982574639e305b08730a3d99f780e9))
* **council:** a member who responded counts toward the quorum ([a4f4eb8](https://github.com/event4u-app/agent-config/commit/a4f4eb8e669251bf526c8cd59a2a5eff5104e45f))
* **overlap:** repair the skill-overlap instrument and make it blocking ([30a16f5](https://github.com/event4u-app/agent-config/commit/30a16f575055473b9b2eb1cf4239138903030353))
* **ci:** attach the SC2016 directive to the command it covers ([4309f5d](https://github.com/event4u-app/agent-config/commit/4309f5d4fcf156c0feed4833522f81bc9e09629b))
* **release:** escape the dedup key separator instead of embedding it raw ([4ad743e](https://github.com/event4u-app/agent-config/commit/4ad743ee32b2111ece5511378b0b3b0ffbd056f4))
* **release:** make the release-PR content checks see the release ([5dc9491](https://github.com/event4u-app/agent-config/commit/5dc9491de0df996c4b8dcbc25c6df1b67226056e))
* **docs:** stop the reference checker reading a JSON key as a rule name ([3b627c3](https://github.com/event4u-app/agent-config/commit/3b627c3b340b3550261284c8054e1c4b639a6aa0))
* **roadmap:** correct the per-pack version count from 12 to 28 ([76e70ea](https://github.com/event4u-app/agent-config/commit/76e70ea9af29ef714de6bf6d497dc02a254ef4ae))
* **roadmap:** replace the illegal `contained` complexity value with `lightweight` ([3a2aa50](https://github.com/event4u-app/agent-config/commit/3a2aa50945b60571300d6d285e1686403d873034))

### Documentation

* **gates:** publish the full-population sweep findings and advance the census step ([85fc5f8](https://github.com/event4u-app/agent-config/commit/85fc5f86e276734026c4397471f7f8730880573e))
* **context:** correct the subagent-event finding in the harvest-cut record ([2f3c2d7](https://github.com/event4u-app/agent-config/commit/2f3c2d7d3563e026814bc970f93971a6c631a1df))
* **roadmap:** close solution-minimalism Phases 0-2, halt Phase 3 ([e784d93](https://github.com/event4u-app/agent-config/commit/e784d93e0be3ec78eda2fcc4399a921312f54431))
* **evidence:** record the solution-minimalism Phase-0 spikes ([5ae52d4](https://github.com/event4u-app/agent-config/commit/5ae52d4480fc164e2ddb38f937f791de2f0a3925))
* **activation:** close the not-projected confound and scope the refusal ([8b79b18](https://github.com/event4u-app/agent-config/commit/8b79b18cef9eba7a06d9a7caf283ea5a43de1732))
* **activation:** reject ADR-054 and refuse the runtime resolver permanently ([ce204ab](https://github.com/event4u-app/agent-config/commit/ce204aba6ffdd9c3a06af95cc4482ea7722ecc50))
* **activation:** the corpus produced no red baseline — 0 of 5 required ([216c16d](https://github.com/event4u-app/agent-config/commit/216c16d44618e50e88da70a3f742a9a7660c3f7c))
* **activation:** pre-register the red-baseline search before looking ([21007b2](https://github.com/event4u-app/agent-config/commit/21007b2703a6bad085195eb12f79400c76d1ec60))
* **governance:** publish the three spike verdicts from a pinned report ([e6aa2e0](https://github.com/event4u-app/agent-config/commit/e6aa2e0d96b66c285be04d10cdb0029e33152ac8))
* **roadmap:** record the Phase-0 run — one null, one finding, one not run ([c2fe0b7](https://github.com/event4u-app/agent-config/commit/c2fe0b7b123b7ae14149a5afc6731e4775baef51))
* **overlap:** publish the canonical re-measurement and archive the roadmap ([174726d](https://github.com/event4u-app/agent-config/commit/174726d489732990b72a44d2b5328e75f37e1ba0))
* **claims:** condition the 38% and close two nulls that were filed as debt ([48a3509](https://github.com/event4u-app/agent-config/commit/48a350917581e82aa8c5ca4a7c2c0fc824a7083e))
* **roadmap:** add four roadmaps from the 9.x feedback disposition ([198ac26](https://github.com/event4u-app/agent-config/commit/198ac26d2df7c3c22038f0267f88c753a2d29d25))
* **council:** record the feedback-9x disposition and its verified state ([76cb2e4](https://github.com/event4u-app/agent-config/commit/76cb2e463650e27bc6710e9511446f06bf9a41fc))

### Refactoring

* **router:** remove the intent trigger type ([b6fc9b5](https://github.com/event4u-app/agent-config/commit/b6fc9b5631305a681bc4e7708827e724e2b22f1b))
* **deps:** stop shipping the disabled engine's parser pair ([c859822](https://github.com/event4u-app/agent-config/commit/c85982266ea055e255766380967cdd43389d7714))
* **packs:** drop the duplicated per-pack version field ([e2cfd42](https://github.com/event4u-app/agent-config/commit/e2cfd42ea57101abc6a6261e2e48c2bba2211027))
* **skills:** one policy-preamble pointer + sibling routing for the ai-video cluster ([c5199a7](https://github.com/event4u-app/agent-config/commit/c5199a7f0f239da66242bf3143f794b73b238ee9))
* **skills:** stop the analysis router describing the work it routes to ([f41fe72](https://github.com/event4u-app/agent-config/commit/f41fe721ba3c2230f96741714ba9b83cda29be23))

### Tests

* **rules:** gate rule trigger-set collisions ([9fec17e](https://github.com/event4u-app/agent-config/commit/9fec17ee1f0e8feb9b9a5344695cb8d2b564b0d3))
* **activation:** the sweep and adjudication-bundle instruments ([613bf41](https://github.com/event4u-app/agent-config/commit/613bf417601ffa230fc79c46b734f2332f05d2a2))
* **governance:** the S0.2 spike and the four adjacent properties ([5eb2874](https://github.com/event4u-app/agent-config/commit/5eb2874cee18fdf6785ef3c9182eed23a59501c2))
* **governance:** two Phase-0 falsification spikes — one null, one finding ([49cb95d](https://github.com/event4u-app/agent-config/commit/49cb95debef4c642274b58168d5992f35f92b86d))
* **design-artifacts:** measure the provided-artifact port failure ([414de6b](https://github.com/event4u-app/agent-config/commit/414de6b7e2bcde43b02a10f3aaaa09fc5bfed155))

### Chores

* **gates:** merge main and reconcile the sweep report with the merged tree ([9e04c0c](https://github.com/event4u-app/agent-config/commit/9e04c0c5aaf56fa81827227663853d40453851f9))
* **sync:** regenerate counts, index, router and proof for 288 skills ([d7e66a5](https://github.com/event4u-app/agent-config/commit/d7e66a54cca675afa0d4d2841f2c85967a5fe30d))
* **roadmap:** archive road-to-governance-invariants — all phases closed ([ec01798](https://github.com/event4u-app/agent-config/commit/ec017980e824ad9d4d97784389363bb85a91bcba))
* **tests:** drop the probe scaffolding audit_auto_rules.test.ts orphaned ([4ac5516](https://github.com/event4u-app/agent-config/commit/4ac55160046dc2ae912db42e10c578eeb78ee933))
* **sync:** regenerate projections and archive the completed roadmap ([e2d01b8](https://github.com/event4u-app/agent-config/commit/e2d01b89a7304da544722ae4cb179baa98b57e1a))
* **ci:** clear the two shellcheck findings skill-lint.yml already carried ([03cc57c](https://github.com/event4u-app/agent-config/commit/03cc57c8d762c4c622173a3a5296be34848565fb))
* drop the spawnSync imports the probe conversion orphaned ([bde29ca](https://github.com/event4u-app/agent-config/commit/bde29cab31ddd1b44ff10b8cae5472582e418576))
* **tests:** drop the dead py2ts twin scaffolding from two UI directive tests ([e64db74](https://github.com/event4u-app/agent-config/commit/e64db74ea33deea9cecc07002b69f5b24ec6ee67))
* **router:** recompile the router projection for the new fidelity triggers ([d2eb947](https://github.com/event4u-app/agent-config/commit/d2eb9478ef673d8a4dabb7d7b418dce7e9f97ac2))

Tests: 10042 (+223 since 9.12.0)

# Era: pre-4.0.0 — archived

> All entries from `3.2.0` and `3.3.0` live in
> [`docs/archive/CHANGELOG-pre-4.0.0.md`](docs/archive/CHANGELOG-pre-4.0.0.md).
> The archive is read-only; git tags `3.2.0` and `3.3.0` remain the
> canonical source for what shipped. Splitting them out of the main
> file keeps the active era under the 250-line drift cap enforced by
> `tests/lib/changelog_eras.test.ts`.

# Era: pre-3.2.0 — archived

> All entries from `3.1.0` and `3.1.1` live in
> [`docs/archive/CHANGELOG-pre-3.2.0.md`](docs/archive/CHANGELOG-pre-3.2.0.md).
> The archive is read-only; git tags `3.1.0` and `3.1.1` remain the
> canonical source for what shipped. Splitting them out of the main
> file keeps the active era under the 250-line drift cap enforced by
> `tests/lib/changelog_eras.test.ts`.

# Era: pre-3.1.0 — archived

> All entries from `3.0.0` live in
> [`docs/archive/CHANGELOG-pre-3.1.0.md`](docs/archive/CHANGELOG-pre-3.1.0.md).
> The archive is read-only; git tag `3.0.0` remains the canonical
> source for what shipped. Splitting it out of the main file keeps
> the active era under the 250-line drift cap enforced by
> `tests/lib/changelog_eras.test.ts`.

# Era: pre-3.0.0 — archived

> All entries from `2.26.0` and `2.25.0` live in
> [`docs/archive/CHANGELOG-pre-3.0.0.md`](docs/archive/CHANGELOG-pre-3.0.0.md).
> The archive is read-only; git tags `2.26.0` and prior remain the
> canonical source for what shipped. Splitting these out of the main
> file keeps the active era under the 200-line drift cap enforced by
> `tests/lib/changelog_eras.test.ts`.

# Era: pre-2.25.0 — archived

> All entries from `2.24.0` through `2.20.0` live in
> [`docs/archive/CHANGELOG-pre-2.25.0.md`](docs/archive/CHANGELOG-pre-2.25.0.md).
> The archive is read-only; git tags `2.24.0` and prior remain the
> canonical source for what shipped. Splitting these out of the main
> file keeps the active era under the 200-line drift cap enforced by
> `tests/lib/changelog_eras.test.ts`.

# Era: pre-2.20.0 — archived

> All entries from `2.19.0` through `2.17.0` live in
> [`docs/archive/CHANGELOG-pre-2.20.0.md`](docs/archive/CHANGELOG-pre-2.20.0.md).
> The archive is read-only; git tags `2.19.0` and prior remain the
> canonical source for what shipped. Splitting these out of the main
> file keeps the active era under the 200-line drift cap enforced by
> `tests/lib/changelog_eras.test.ts`.

# Era: pre-2.17.0 — archived

> All `2.16.0` entries live in
> [`docs/archive/CHANGELOG-pre-2.17.0.md`](docs/archive/CHANGELOG-pre-2.17.0.md).
> The archive is read-only; git tag `2.16.0` remains the canonical
> source for what shipped. Splitting these out of the main file keeps
> the active era under the 200-line drift cap enforced by
> `tests/lib/changelog_eras.test.ts`.

# Era: pre-2.16.0 — archived

> All `2.15.0` entries live in
> [`docs/archive/CHANGELOG-pre-2.16.0.md`](docs/archive/CHANGELOG-pre-2.16.0.md).
> The archive is read-only; git tag `2.15.0` remains the canonical
> source for what shipped. Splitting these out of the main file keeps
> the active era under the 200-line drift cap enforced by
> `tests/lib/changelog_eras.test.ts`.

# Era: pre-2.15.0 — archived

> All entries from `2.14.0` through `2.11.0` live in
> [`docs/archive/CHANGELOG-pre-2.15.0.md`](docs/archive/CHANGELOG-pre-2.15.0.md).
> The archive is read-only; git tags `2.14.0` and prior remain the
> canonical source for what shipped. Splitting these out of the main
> file keeps the active era under the 200-line drift cap enforced by
> `tests/lib/changelog_eras.test.ts`.

# Era: pre-2.11.0 — archived

> All entries from `2.10.0` through `2.7.0` live in
> [`docs/archive/CHANGELOG-pre-2.11.0.md`](docs/archive/CHANGELOG-pre-2.11.0.md).
> The archive is read-only; git tags `2.10.0` and prior remain the
> canonical source for what shipped. Splitting these out of the main
> file keeps the active era under the 200-line drift cap enforced by
> `tests/lib/changelog_eras.test.ts`.


# Era: pre-2.7.0 — archived

> All entries from `2.6.1` through `2.2.0` live in
> [`docs/archive/CHANGELOG-pre-2.7.0.md`](docs/archive/CHANGELOG-pre-2.7.0.md).
> The archive is read-only; git tags `2.6.1` and prior remain the
> canonical source for what shipped. Splitting these out of the main
> file keeps the active era under the 200-line drift cap enforced by
> `tests/lib/changelog_eras.test.ts`.

# Era: pre-2.2.0 — archived

> All entries from `2.1.0` and earlier live in
> [`docs/archive/CHANGELOG-pre-2.2.0.md`](docs/archive/CHANGELOG-pre-2.2.0.md).
> The archive is read-only; git tags `2.1.0` and prior remain the
> canonical source for what shipped. Splitting these out of the main
> file keeps the active era under the 200-line drift cap enforced by
> `tests/lib/changelog_eras.test.ts`.
