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

- **Every release PR was red on its first run — the generator and the
  highlight gate contradicted each other.** `release.ts` wrote `_none_` into
  all five curated-head fields; `check_release_highlights` (added 2026-08-03)
  fails a `_none_` the release span contradicts. Because every release of this
  package touches `src/rules/` or `src/scripts/schemas/`, "Behaviour changes"
  is *always* substantiated, so the gate reliably red-flagged the generator's
  own default — 9.17.0 (run 30871194277) and 9.18.0 (run 30909511315) both
  failed on that one step, and each release had to be unblocked by hand.
  - The span → category classifier now lives once, in
    `src/scripts/_lib/release_highlights.ts`, and is shared by the generator
    and the gate; the two duplicated label lists are gone with it.
  - `release.ts` **pre-fills** each substantiated label with the deriving
    reason plus its citing SHAs (capped at 6, remainder stated, never silently
    truncated). `_none_` is now a fallback for labels the span does not
    substantiate, not a blanket default — so the tool no longer asserts five
    things it never checked.
  - The gate keeps full teeth for the failure it was actually built for: a
    **human** editing a substantiated line back down to `_none_`, which is what
    produced the false 9.13.0 and 9.14.0 heads. An unrewritten auto-derived
    line is advisory (a prose gap, not a false claim) and never blocks.
  - Derivation is best-effort in the generator: a git failure degrades to the
    `_none_` skeleton with a warning instead of aborting a release.

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

# Era: pre-9.15.0 — archived

> All entries before `9.15.0` live in
> [`docs/archive/CHANGELOG-pre-9.15.0.md`](docs/archive/CHANGELOG-pre-9.15.0.md).
> The archive is read-only; git tags remain the canonical
> source for what shipped. Splitting them out of the main file
> keeps the active era under the 250-line drift cap enforced by
> `tests/test_changelog_eras.py`.

# Era: pre-9.18.0 — archived

> All entries before `9.18.0` live in
> [`docs/archive/CHANGELOG-pre-9.18.0.md`](docs/archive/CHANGELOG-pre-9.18.0.md).
> The archive is read-only; git tags remain the canonical
> source for what shipped. Splitting them out of the main file
> keeps the active era under the 250-line drift cap enforced by
> `tests/test_changelog_eras.py`.

# Era: pre-9.23.0 — archived

> All entries before `9.23.0` live in
> [`docs/archive/CHANGELOG-pre-9.23.0.md`](docs/archive/CHANGELOG-pre-9.23.0.md).
> The archive is read-only; git tags remain the canonical
> source for what shipped. Splitting them out of the main file
> keeps the active era under the 250-line drift cap enforced by
> `tests/test_changelog_eras.py`.

# Era: pre-9.27.0 — archived

> All entries before `9.27.0` live in
> [`docs/archive/CHANGELOG-pre-9.27.0.md`](docs/archive/CHANGELOG-pre-9.27.0.md).
> The archive is read-only; git tags remain the canonical
> source for what shipped. Splitting them out of the main file
> keeps the active era under the 250-line drift cap enforced by
> `tests/test_changelog_eras.py`.

# Era: pre-9.31.0 — archived

> All entries before `9.31.0` live in
> [`docs/archive/CHANGELOG-pre-9.31.0.md`](docs/archive/CHANGELOG-pre-9.31.0.md).
> The archive is read-only; git tags remain the canonical
> source for what shipped. Splitting them out of the main file
> keeps the active era under the 250-line drift cap enforced by
> `tests/test_changelog_eras.py`.

# Era: pre-9.34.0 — archived

> All entries before `9.34.0` live in
> [`docs/archive/CHANGELOG-pre-9.34.0.md`](docs/archive/CHANGELOG-pre-9.34.0.md).
> The archive is read-only; git tags remain the canonical
> source for what shipped. Splitting them out of the main file
> keeps the active era under the 250-line drift cap enforced by
> `tests/test_changelog_eras.py`.

# Era: pre-9.36.0 — archived

> All entries before `9.36.0` live in
> [`docs/archive/CHANGELOG-pre-9.36.0.md`](docs/archive/CHANGELOG-pre-9.36.0.md).
> The archive is read-only; git tags remain the canonical
> source for what shipped. Splitting them out of the main file
> keeps the active era under the 250-line drift cap enforced by
> `tests/test_changelog_eras.py`.

# Era: pre-10.3.0 — archived

> All entries before `10.3.0` live in
> [`docs/archive/CHANGELOG-pre-10.3.0.md`](docs/archive/CHANGELOG-pre-10.3.0.md).
> The archive is read-only; git tags remain the canonical
> source for what shipped. Splitting them out of the main file
> keeps the active era under the 250-line drift cap enforced by
> `tests/test_changelog_eras.py`.

# Era: pre-12.0.0 — archived

> All entries before `12.0.0` live in
> [`docs/archive/CHANGELOG-pre-12.0.0.md`](docs/archive/CHANGELOG-pre-12.0.0.md).
> The archive is read-only; git tags remain the canonical
> source for what shipped. Splitting them out of the main file
> keeps the active era under the 250-line drift cap enforced by
> `tests/test_changelog_eras.py`.

# Era: pre-14.0.0 — archived

> All entries before `14.0.0` live in
> [`docs/archive/CHANGELOG-pre-14.0.0.md`](docs/archive/CHANGELOG-pre-14.0.0.md).
> The archive is read-only; git tags remain the canonical
> source for what shipped. Splitting them out of the main file
> keeps the active era under the 250-line drift cap enforced by
> `tests/test_changelog_eras.py`.

# Era: 14.0.x — current

> Started at `14.0.0`. Full entries live inline below.
> The drift test caps this era at 250 lines of entry body; growth past
> that forces a new era split (`# Era: 14.1.x`, etc.) — see
> [`docs/contracts/CHANGELOG-conventions.md § Era splits`](docs/contracts/CHANGELOG-conventions.md).

## [14.1.0](https://github.com/event4u-app/agent-config/compare/14.0.0...14.1.0) (2026-08-18)

### Release highlights

<!-- Curated head: fill before merge, keep it under 10 lines, and leave `_none_` where it is genuinely the answer. The generated log below is unchanged. -->
- **Behaviour changes:** _none_
- **Default changes + migration:** _none_
- **Security and correctness:** _auto-derived, rewrite before merge:_ security-scoped commits or fixes to executable surface in 2ee0642, d8c14a2, 4a60aeb, 3952d49, c9753b1, aa48d84 +1 more.
- **Honest nulls:** _auto-derived, rewrite before merge:_ commits recording a null, waived or falsified result in 7ebc802.
- **Known limitations:** _none_

### Features

* **gates:** adopt per-target ledgers in two new arrivals ([a0f3326](https://github.com/event4u-app/agent-config/commit/a0f332632ac4769184cf993c8efd58b2063d0e6f))

### Bug Fixes

* **tests:** a raw NUL byte where a space was meant ([2ee0642](https://github.com/event4u-app/agent-config/commit/2ee0642ddcc99e2eba2a30ba2655263c5048b36a))
* **hooks:** keep an authorization from being clobbered by a parallel session ([d8c14a2](https://github.com/event4u-app/agent-config/commit/d8c14a2da7238e03b3b34c6ed56cfdcb58ed5525))
* **review:** unbreak the reference the findings row created, and replicate ([4708792](https://github.com/event4u-app/agent-config/commit/47087927fff242380c03cf95853e9d4106e1b054))
* **gates:** stop three ledgers reporting targets they never read ([4a60aeb](https://github.com/event4u-app/agent-config/commit/4a60aeb09f429b5fff348b09c5fd5626f7e3f38e))
* **bench:** give the consumer hook path its own budget, which it never had ([c9753b1](https://github.com/event4u-app/agent-config/commit/c9753b151dfd7a0aa95af08e59cff298c4220318))
* **gates:** finding 6 — deduplicate the manifest ids before planning ([aa48d84](https://github.com/event4u-app/agent-config/commit/aa48d845a0ec1e81368ad103336b27438c6fcc16))
* **gates:** apply the R2 review — all 11 findings ([8ec1dbb](https://github.com/event4u-app/agent-config/commit/8ec1dbb65b0a3840865aac0d91c8301eea9cbb1c))

### Documentation

* **roadmap:** carry the replication into step 0.5 ([1219376](https://github.com/event4u-app/agent-config/commit/1219376feca58df91c76e1f24f99d162ab5f7e95))
* **roadmap:** re-review the risk register the Phase 0 addition invalidated ([c6ff0ed](https://github.com/event4u-app/agent-config/commit/c6ff0ed14b39621765458d9ec39b654bff684b71))
* **roadmap:** record the path split in Phase 0, where the question already lived ([9fc8cf9](https://github.com/event4u-app/agent-config/commit/9fc8cf9f9f6651e6872d3026d5707191dcaffcdf))
* **review:** the measurement settles finding 6 — the dispatcher regressed ([7ebc802](https://github.com/event4u-app/agent-config/commit/7ebc8027aba369b34a500377dc588ac526b2ac4f))
* **review:** close 18 of 20 round-2 findings, name the two that stay open ([80ba9cc](https://github.com/event4u-app/agent-config/commit/80ba9cc12fbf0e336f912766719d61b421f902cd))
* **baselines:** describe what the ratchet lowering actually landed ([0ce7a17](https://github.com/event4u-app/agent-config/commit/0ce7a17baefad295c2fcb1849b02cca4a07f6bd9))
* **review:** record round 2 of the completion review, rows open ([41e8a1e](https://github.com/event4u-app/agent-config/commit/41e8a1e4ffc3b378fc2ff2bb9add9c31c3e4936f))
* **review:** re-bind the findings to the post-fix scope ([43847c1](https://github.com/event4u-app/agent-config/commit/43847c1e1bd07c3d5ebe2ff38060a761e8552e9b))
* **review:** all 11 findings terminal, with their fix refs ([957a53e](https://github.com/event4u-app/agent-config/commit/957a53e860a973b87b32bba07479b50f43b4f6f1))
* **review:** the R2 completion review, 11 findings, all rows open ([f7d9581](https://github.com/event4u-app/agent-config/commit/f7d9581ceac1388786fc6a8e0f9b6192c5f10502))
* **gates:** exempt check_pr_ci_current from the ledger, with the reason ([080e17c](https://github.com/event4u-app/agent-config/commit/080e17c41dd7904fe1bc76c7556417ffb7f525b4))

### CI

* **bench:** measure both hook paths on one runner, without gating either ([7d8be6e](https://github.com/event4u-app/agent-config/commit/7d8be6e1bee4f04d902d660b04f05b03ed1109d7))

### Chores

* **gates:** lower the ledger-adoption baseline 216 to 215 ([6868213](https://github.com/event4u-app/agent-config/commit/686821324b2ad94533a277a43cb857d21bb600c6))

### Other

* Revert "fix(bench): give the consumer hook path its own budget, which it never had" ([3952d49](https://github.com/event4u-app/agent-config/commit/3952d49bf3a3af770cb522dafc540c1458050f3d))

Tests: 14592 (+72 since 14.0.0)

## [14.0.0](https://github.com/event4u-app/agent-config/compare/13.0.0...14.0.0) (2026-08-18)

### Release highlights

<!-- Curated head: fill before merge, keep it under 10 lines, and leave `_none_` where it is genuinely the answer. The generated log below is unchanged. -->
- **Behaviour changes:** the council quorum plumbing moved behind an extracted seam and the size ratchet dropped with it (`f001382`, breaking); a HIGH-tier command-suggestion match now routes directly instead of always emitting the options block (`2fcb2af`); the two path-dominant UI rules regained path scoping (`0518426`); review independence and the evaluator-output contract became declared, gated properties instead of conventions (`1b224f1`, `ca25bc3`).
- **Default changes + migration:** _none_
- **Security and correctness:** the release pipeline no longer dies with the PR body in a stack trace on a GitHub 5xx (`2c611bb`), and it bounds a changelog section at the era banner rather than only at the next version (`6bcc273`) — the second had already pushed 12 archived-era banners into this release's own first PR body; the bench spend cap reaches the task runner on paid targets (`6efb8a7`); 19 R2 review findings closed, one of them structural (`3b85af7`).
- **Honest nulls:** two Phase-0 measurements were published against their own pre-registrations and falsified them (`f29953f`, `ab5d2f7`); the context-fidelity and user-out-of-the-loop baselines are pre-registered before anything is measured (`a8c0edc`, `fe15fc5`).
- **Known limitations:** the CI-native release path merges and publishes unattended once checks go green — the "Approve workflows to run" checkpoint that `release.yml` documents for a repo without `RELEASE_PR_TOKEN` did not materialise here, so a dispatched release has to be cancelled by hand if a human gate before merge is wanted.

### BREAKING CHANGES

* **council:** extract the quorum plumbing, and lower the size ratchet ([f001382](https://github.com/event4u-app/agent-config/commit/f0013821e005888f781e54a43a9bd3d260e74f76))

### Features

* **gates:** the JSON surface carries the gate class and its command ([2d15422](https://github.com/event4u-app/agent-config/commit/2d154224d13721b147a541c7eac476efaacfc4de))
* **gates:** register the stub-ceiling gate under CI-identical argv ([8bb5bd0](https://github.com/event4u-app/agent-config/commit/8bb5bd0f8b332f623b5fb00baed11a63bf840ec0))
* **rules:** hold a migrated rule at the size its pointer claims ([797e5e0](https://github.com/event4u-app/agent-config/commit/797e5e071332aac95fde2d1cf40c1019b8cdbbdc))
* **gates:** resolve a class-0 gate by running it, render everything else ([fdc44de](https://github.com/event4u-app/agent-config/commit/fdc44de895c3959de3c3c2e8375a4f776b65957b))
* **hooks:** skip idempotent Stop concerns on a refusal retry ([d852555](https://github.com/event4u-app/agent-config/commit/d85255518134ec6ab8378cd31d274e06c54bae0a))
* **hooks:** report the turn-end refusal rate in the hooks doctor ([d1d854a](https://github.com/event4u-app/agent-config/commit/d1d854ac3b70ea7843d3c6862ebdacbca4c4d829))
* **hooks:** prune refusal state and surface this session count ([c285a30](https://github.com/event4u-app/agent-config/commit/c285a30ab1891d34ea4401e162357ee01d5efd0f))
* **hooks:** count turn-end refusals per detector instead of overwriting ([0a42f28](https://github.com/event4u-app/agent-config/commit/0a42f2829dacaae5d44c701ef3fc635234d5b010))
* **gates:** report parked roadmaps whose resume condition has fired ([8519948](https://github.com/event4u-app/agent-config/commit/8519948b435d329bd47b539736b2362d1c94f3ae))
* **roadmaps:** adopt road-to-rule-stub-projection, scope narrowed by verification ([be9db6a](https://github.com/event4u-app/agent-config/commit/be9db6a66d81366e47de0970e5e73123916bf67d))
* **blockers:** a gate declares its class, and a runnable class names its command ([e2259ca](https://github.com/event4u-app/agent-config/commit/e2259ca914862fb49ddf8ded4f2aac52839bc16a))
* **gate:** report where a skill keeps its obligation block, at warn level ([ea00e76](https://github.com/event4u-app/agent-config/commit/ea00e76ef4311dd5a28c11ccde2d9a44e363f74f))
* **evidence:** the two Phase 0 censuses, and the instrument that reads 0.0 % ([9115922](https://github.com/event4u-app/agent-config/commit/9115922663405c880cb37181d814d7aed6080b54))
* **rules:** restore path scoping on the two path-dominant UI rules ([0518426](https://github.com/event4u-app/agent-config/commit/051842644ab9edc72de94283da5de32aaf5f471b))
* **rules:** measure rule activation from source, and pin the two unmatrixed rules ([ea068b8](https://github.com/event4u-app/agent-config/commit/ea068b804dc40f36be46e6bb6642bb3596899af9))
* **suggestion:** route a HIGH-tier match directly, with a narrow carve-out ([2fcb2af](https://github.com/event4u-app/agent-config/commit/2fcb2afb865239b86b3db55cd0242d8bdf0e73e1))
* **contexts:** add the contract decision sheet as the single elicitation surface ([367c5bf](https://github.com/event4u-app/agent-config/commit/367c5bf23e90a02dede67fe781bc2e276a1bdbb5))
* **scripts:** add interruption_report for the contact and wall-clock axes ([9cb33d2](https://github.com/event4u-app/agent-config/commit/9cb33d23346ab71a9bf0ae4faf7e447b20c6a183))
* **hooks:** add the interruption-ledger concern on the stop slot ([4b5fc26](https://github.com/event4u-app/agent-config/commit/4b5fc26bbd72aeb5795771276f44d859417b46f1))
* **cli:** reach council:quota from agent-config, and name who spent the budget ([7d4d503](https://github.com/event4u-app/agent-config/commit/7d4d503721da1104615445ab339d034ede830536))
* **council:** route judgement calls to the council before the user ([3655fb4](https://github.com/event4u-app/agent-config/commit/3655fb4d68ca70738752475c00e737698c735ac1))
* **git:** make a fix-the-CI instruction reach the remote, and verify it there ([764bb23](https://github.com/event4u-app/agent-config/commit/764bb23cc081eb92f8c216eba857637ce071acf7))
* **claims:** pre-register both capability claims, and record what is NOT shown ([a16e413](https://github.com/event4u-app/agent-config/commit/a16e41369ceef8a1309c774f14bb9ab93ff44128))
* **ship-gate:** warn on shipping-intent diff volume, threshold derived here ([c4285a6](https://github.com/event4u-app/agent-config/commit/c4285a62b84de3332d354485d016ac1e3a92db5a))
* **experiment-loop:** a bounded keep-or-revert loop against a scalar metric ([4239173](https://github.com/event4u-app/agent-config/commit/42391730909bf794082c1446fe322567b7b2c2b7))
* **review:** make review independence a declared property, not a silence ([1b224f1](https://github.com/event4u-app/agent-config/commit/1b224f178ff729b4344ffd97924f4e086b45b4a8))
* **evaluator:** the evaluator-output contract, its error semantics, and its gate ([ca25bc3](https://github.com/event4u-app/agent-config/commit/ca25bc39971aef58f72eb35afc9d22988516dc16))
* **evidence:** one definition of what an evidence artifact is, and a forward-looking check ([3ddbb5c](https://github.com/event4u-app/agent-config/commit/3ddbb5ce4c647c4347144e5601749ebb54674ebb))
* **council:** gate pre-run attendance on qualification, and record what a pass observed ([13d1abd](https://github.com/event4u-app/agent-config/commit/13d1abdeec2dc31b03c76009c22c5c28d47ad0aa))
* **council:** four-value provider qualification and its observation store ([bc506a5](https://github.com/event4u-app/agent-config/commit/bc506a52adf5403e58816c4c2cc829ac676e8978))
* **review:** write the evidence type at creation, not later ([5a70ae6](https://github.com/event4u-app/agent-config/commit/5a70ae6662e086361a99266c64fccb15336132aa))
* **gates:** enforce the evidence-artifact type contract ([adfe57d](https://github.com/event4u-app/agent-config/commit/adfe57d79ecbca40225631bdbd3016a7678b7016))
* **metric-loop:** Phase 0 falsification spikes, four kills evaluated ([052a25d](https://github.com/event4u-app/agent-config/commit/052a25d24545c4caa768fe1b1a1e30622c60d23e))

### Bug Fixes

* **docs:** stop claiming the spend cap is fixed in a tree where it is not ([3a517f3](https://github.com/event4u-app/agent-config/commit/3a517f3aa760cc1c325fe87d87a3931fba2c232e))
* **release:** retry GitHub 5xx instead of dying with the PR body in the stack trace ([2c611bb](https://github.com/event4u-app/agent-config/commit/2c611bb2f596116dba751bfbbbf6a547ce966cca))
* **release:** bound a changelog section at the era banner, not only at the next version ([6bcc273](https://github.com/event4u-app/agent-config/commit/6bcc273515e198a429fc124c0a93c87e0487d7cf))
* **bench:** let the spend cap reach the task runner on paid targets ([6efb8a7](https://github.com/event4u-app/agent-config/commit/6efb8a70817d56a12cf63a5135ea37c459b0cf0d))
* **evidence:** retract the legal-safety-floor contradiction, it was a misreading ([0cfba5a](https://github.com/event4u-app/agent-config/commit/0cfba5a9025e0b0ce7ae29e98c7816205b1e27cf))
* **roadmaps:** repair two owner values the class write-back truncated ([5f9ba2a](https://github.com/event4u-app/agent-config/commit/5f9ba2a9f49a1963f13d144f9388f7b0231c5090))
* **gates:** correct the manifest header denominators for the new row ([aae8fad](https://github.com/event4u-app/agent-config/commit/aae8fadc1de38f2a565df2231ab284c919e15052))
* **rules:** apply the R2 review — all 19 findings, one of them structural ([3b85af7](https://github.com/event4u-app/agent-config/commit/3b85af7b164bf680c992eee3a69535fcab6c32b0))
* **roadmap:** re-depth the archived roadmap links and regenerate the dashboard ([1ac4426](https://github.com/event4u-app/agent-config/commit/1ac4426a73bf7fb7b848e7d1dfb5da0414d6cdf8))
* **tests:** the gates fixture builds a whole Blocker again ([718f543](https://github.com/event4u-app/agent-config/commit/718f5432097766a0bea50d89d0b0aba9aa661fcf))
* **gates:** apply the R2 review — 18 of 19 findings, one recorded as unmeetable ([3c9abbf](https://github.com/event4u-app/agent-config/commit/3c9abbf6bef50a8479bc5e01c501fe52cc1f19d5))
* **hooks:** recognise phpstan and lint_ scripts as verification ([b302f56](https://github.com/event4u-app/agent-config/commit/b302f568dd0e07dd141d74cf08c8b2b3128db508))
* **roadmap:** a status carrying its own resolution still counts as resolved ([233ee59](https://github.com/event4u-app/agent-config/commit/233ee59b8539bae95ccb91d37e7e95c611b36812))
* **roadmaps:** apply the verified residue from the performance-regression drafts ([179e8c0](https://github.com/event4u-app/agent-config/commit/179e8c067fded5d3007be6babd94516206e99548))
* **ci:** clear the four red gates on PR 1398 ([b879d6b](https://github.com/event4u-app/agent-config/commit/b879d6b5a1f7933c655c33dc377b87f01f85551e))
* **evidence,roadmap:** apply R2 findings 6, 7 and 8 — the three that survived ([c19e0df](https://github.com/event4u-app/agent-config/commit/c19e0df8e45d04ec7f574858ab7361578345043d))
* **census:** drop the unused derive_trigger_globs import ([c61b3c0](https://github.com/event4u-app/agent-config/commit/c61b3c02a5a7e30b04912fd511e8ddbcb184152d))
* **roadmaps:** satisfy the evidence-type and risk-anchor contracts ([893284d](https://github.com/event4u-app/agent-config/commit/893284d2f9ab626fba3ec6be0557cd234179f6a9))
* **evidence:** declare both censuses as analysis artifacts ([fb49e4c](https://github.com/event4u-app/agent-config/commit/fb49e4c767cf99b6736f34b7308b247fcff7dbff))
* **roadmap-loop:** derive the execution mode instead of silently defaulting ([ffd2a01](https://github.com/event4u-app/agent-config/commit/ffd2a016b2283ac3f26973b21da249bc97135f98))
* **ai-team:** read the quota bucket the run actually books into ([19f9551](https://github.com/event4u-app/agent-config/commit/19f9551f67a5157553143eb0291fb4a0e5add530))
* **council:** resolve the CLI-call cap from a single authority ([95be8b0](https://github.com/event4u-app/agent-config/commit/95be8b07be6c85308a5d466e5ca0cb831b7c4b57))
* **council:** make the shared CLI-call counter atomic and attributable ([9c10ddf](https://github.com/event4u-app/agent-config/commit/9c10ddfc12befe1872a2cefe6cbdac3fa33cf2df))
* **ci:** declare check_pr_ci_current as intentionally local-only ([909209c](https://github.com/event4u-app/agent-config/commit/909209c86765a109beabdb3d390891af565b2391))
* **ci:** regenerate the two count-derived artefacts the new skill invalidated ([d74d4e0](https://github.com/event4u-app/agent-config/commit/d74d4e09dc73cdfed971ee604f2d1851748e59a5))
* **deps:** bump the npm-production group across 1 directory with 3 updates ([5c041de](https://github.com/event4u-app/agent-config/commit/5c041de900e8ea0e7d3c0326c1b7dee6176c864b))
* **council,evidence:** apply the R2 review — the high finding reopened the defect one layer down ([e69a10b](https://github.com/event4u-app/agent-config/commit/e69a10b52a94d0cb8920d11430f3c29ecd93f9b0))
* **roadmaps:** stop check_references reading prose as a rule reference ([45a7dd7](https://github.com/event4u-app/agent-config/commit/45a7dd73d35ca044fb79fed7887818a9b08adc80))
* **gates:** close the 11 R2 findings on the evidence-type gate ([21c9865](https://github.com/event4u-app/agent-config/commit/21c9865c8865c0b6bd09368b91d86b7928a05707))

### Reverts

* **gate:** withdraw lint_skill_top_position — the obligation already ships ([059250e](https://github.com/event4u-app/agent-config/commit/059250e9b423abbbf6fcecac4c0794beed4245a9))

### Documentation

* **review:** declare the completion-review skip for a zero-code-path diff ([d0cf1cb](https://github.com/event4u-app/agent-config/commit/d0cf1cbd6ccd977702bd1fba68bf9676333fb840))
* **roadmap:** close Phase 2 Step 1 and say why it was never gated on the baseline ([0e3ee68](https://github.com/event4u-app/agent-config/commit/0e3ee6888d65b5f1baeb9a11344caf33282a3c48))
* **evidence:** correct the symptom number on the reproduced return-channel failure ([bfe0296](https://github.com/event4u-app/agent-config/commit/bfe0296175e52de92a7a4b0ede6bbf8474ec3574))
* **contracts:** a worker final message is text-only, and the envelope hits disk first ([4dbdccf](https://github.com/event4u-app/agent-config/commit/4dbdccf1dd267712041a6dfa49274c0d693dd66d))
* **review:** re-bind and state which review covers which half of the branch ([8022676](https://github.com/event4u-app/agent-config/commit/80226766d30cc7abe1d05e6240d58dc6c0376347))
* the spend-cap claims describe the tree again, and name a commit not an event ([86f1f40](https://github.com/event4u-app/agent-config/commit/86f1f40c67618c4cd19bf2b7180948c825459e9b))
* **review:** fill the R2 findings and re-bind to the post-fix scope ([7b3e707](https://github.com/event4u-app/agent-config/commit/7b3e707fb380d91b59ff7a67f8b350ffde24ccc8))
* **review:** rescope the R2 review to match the gate scope ([c2bfba0](https://github.com/event4u-app/agent-config/commit/c2bfba0b1a89fae57382097cde8b3b9d77c4a44a))
* **review:** open the R2 review for the follow-up decisions ([4a8a488](https://github.com/event4u-app/agent-config/commit/4a8a488809212bf828e1877f0623381cafa80375))
* record the three follow-up decisions and resolve their blocker ([5684754](https://github.com/event4u-app/agent-config/commit/5684754b8f0b23e1e93bd2b4103a6c634bbe36e8))
* **roadmaps:** reclassify the twelve gates whose swept class was not materialisable ([ad7fe04](https://github.com/event4u-app/agent-config/commit/ad7fe04bbfe2064bad0395634e15df7eebf3dbab))
* **review:** restore the merged findings artefact and declare a skip for the retraction ([132f07d](https://github.com/event4u-app/agent-config/commit/132f07d56965b19bc42493763a86326dabdea14d))
* **review:** re-bind the findings after the retraction ([8728f00](https://github.com/event4u-app/agent-config/commit/8728f00cf09d78c38f497e477a3bac31ce76af73))
* **review:** commit the R2 input package the reviewer actually read ([13f37aa](https://github.com/event4u-app/agent-config/commit/13f37aa02a1a79fd2051b08961e66bd470540a61))
* **review:** re-bind the findings to the post-merge scope ([6a0240e](https://github.com/event4u-app/agent-config/commit/6a0240e22e0ed419ee0c9d0b7adc0b415f091cc7))
* **review:** re-bind the findings after the archive-index regeneration ([1e12c2f](https://github.com/event4u-app/agent-config/commit/1e12c2f6419e5bce016cc06377d19534628d3104))
* **review:** fill the R2 findings with their outcomes ([92b385c](https://github.com/event4u-app/agent-config/commit/92b385c72c933affb7c26e565f9b59d4767eeefb))
* correct the write-back counts and track the three follow-ups ([23c74e1](https://github.com/event4u-app/agent-config/commit/23c74e1a53670509bf8b28d76fbc512ee02d2291))
* **review:** re-bind the findings artefact after merging main ([58552ee](https://github.com/event4u-app/agent-config/commit/58552ee481c8185c656eb6c0a0f2db2740c99c7b))
* **review:** re-bind the findings and record the ordering round-trip on row 6 ([b536924](https://github.com/event4u-app/agent-config/commit/b536924bea59f9cfe135a7476dc604a01199eb1b))
* **review:** the R2 completion review, 19 findings, all rows open ([d8e2ee6](https://github.com/event4u-app/agent-config/commit/d8e2ee6559f630e0ec94f778829aa01c2d8e6904))
* **review:** open the R2 completion review for the class write-back ([b40d124](https://github.com/event4u-app/agent-config/commit/b40d1249f62c8decbb4b7f169954ff0b44d77e51))
* **gates:** correct the manifest header denominators for the new row ([0d12acd](https://github.com/event4u-app/agent-config/commit/0d12acd1c9cc02075a380eba250b67b3ed16c06c))
* **evidence:** record that the swept class-0 and class-1 verdicts cannot be materialised ([585a1c1](https://github.com/event4u-app/agent-config/commit/585a1c1abc6ad378721b3f69ce92b007073cbe1e))
* **roadmaps:** materialise the swept gate class into 34 blocker entries ([6e40b7e](https://github.com/event4u-app/agent-config/commit/6e40b7e0af4f559c49e92971703e3d7e61f7c1d2))
* **roadmap:** close rule-stub-projection and hand the sized residue to its owner ([20d0f14](https://github.com/event4u-app/agent-config/commit/20d0f144a6e7333de11cce0eb7d4578210464a17))
* **evidence:** the Phase-0 measurement, and it falsifies its own pre-registration ([f29953f](https://github.com/event4u-app/agent-config/commit/f29953f57fb92c317044f1fa3fb01d3f3b8bf48e))
* **roadmap:** mark stop-gate-honesty 2.1 open rather than deferred ([aff95dc](https://github.com/event4u-app/agent-config/commit/aff95dce1eaab2a4952a7bdcf50834a13148883b))
* **review:** give every fixed row its resolvable fix ref ([f10d7b8](https://github.com/event4u-app/agent-config/commit/f10d7b803a6d94193666585aae06643e92a944e1))
* **review:** re-bind the R2 findings to the post-fix scope, 18 fixed and 1 deferred ([02ced8e](https://github.com/event4u-app/agent-config/commit/02ced8e8a40690af8391d43355554f49cccafe38))
* **roadmap:** close stop-gate-honesty phases 1 to 3 ([1dd54a1](https://github.com/event4u-app/agent-config/commit/1dd54a10daf0285f3dd006698c55071e4f374dd1))
* **evidence:** the gate-class sweep falsifies its own pre-registration ([ab5d2f7](https://github.com/event4u-app/agent-config/commit/ab5d2f73e7bc7a827584901e0dd88aa1d9a5dd2c))
* **roadmap:** close gate-autonomy 1.1 and pre-register the 1.2 share ([b5a5151](https://github.com/event4u-app/agent-config/commit/b5a51510aa841cb5ecc1e9adf755f2d2aef15a05))
* **review:** re-bind the findings to the post-fix scope, all 13 terminal ([8f2176d](https://github.com/event4u-app/agent-config/commit/8f2176da07dd542191877739847188ad6e0a17f5))
* **review:** the R2 completion review, 13 findings, all rows open ([7ec6be6](https://github.com/event4u-app/agent-config/commit/7ec6be613624a62242616f0eb3948031b0b95a2c))
* **roadmap:** re-verify the Context table, and make the human gate countable ([73c242b](https://github.com/event4u-app/agent-config/commit/73c242bd21d7d244c61b85698a686b36d4a67577))
* **claims:** pre-register the two context-fidelity measurements ([a8c0edc](https://github.com/event4u-app/agent-config/commit/a8c0edc3c2b4ed944c1b9ebab14dd88ac2161215))
* **roadmaps:** adopt the mixed-trigger-cleanup cohort after claim verification ([80d80d4](https://github.com/event4u-app/agent-config/commit/80d80d4626536eba09d47ac32b097fe186715802))
* **roadmap:** close Phase 0 and six of seven Phase 1 steps ([e74a956](https://github.com/event4u-app/agent-config/commit/e74a9565f5a634160a408a9f0562538ea768a07c))
* **claims:** pre-register the two user-out-of-the-loop baselines ([fe15fc5](https://github.com/event4u-app/agent-config/commit/fe15fc59d3b96b46d8793eaa580a8e71436dad99))
* **roadmaps:** record the council-quota accounting verification and its result ([ed2e566](https://github.com/event4u-app/agent-config/commit/ed2e5668e5897d8ed2b80808ff1c1449870e5def))
* **evidence:** re-bind the R2 artefact after merging main ([baecdfb](https://github.com/event4u-app/agent-config/commit/baecdfbfe9a8c23869c684cbe38e3b70f8d0c3f7))
* **evidence:** re-bind marker AND manifest after the main merge ([b426d8e](https://github.com/event4u-app/agent-config/commit/b426d8e3804781b4af7ce5f49ba864df566bceae))
* **evidence:** re-bind the R2 artefact after the quorum extraction ([4c0047e](https://github.com/event4u-app/agent-config/commit/4c0047eef2e92392d455dc67d7bac1d39dc52809))
* **evidence:** re-bind the R2 artefact after the fixes, all 16 rows terminal ([13c854a](https://github.com/event4u-app/agent-config/commit/13c854aebf976aabcdffd881f7ca91acdd26c2f1))
* **evidence:** re-bind after the cross-reference fix ([74ee5e8](https://github.com/event4u-app/agent-config/commit/74ee5e89fdc8a0b1c82ebe515b9166f753c555f0))
* **evidence:** record the R2 completion review, all 16 rows open ([0f07cac](https://github.com/event4u-app/agent-config/commit/0f07cac8e615a09fbeaa02f3fc42cca39853f89f))
* **evidence:** re-bind the findings at the final head ([a1476cb](https://github.com/event4u-app/agent-config/commit/a1476cbf5aaf35ff583a38ea9f12c05652ad3b85))
* **evidence:** re-bind the R2 findings at the post-merge scope ([acf8229](https://github.com/event4u-app/agent-config/commit/acf8229b4e3de0b0138e1bc7343893572eebe2dd))
* **roadmaps:** close release-review-p0 Phases 2 and 3, and record why Phase 1 did not start ([11ce2ea](https://github.com/event4u-app/agent-config/commit/11ce2ea372d534300e0fcfa032bb764393af3b49))
* **evidence:** record the R2 review of the evidence-type gate ([fc1a1aa](https://github.com/event4u-app/agent-config/commit/fc1a1aabf0fe1e583b00f67d9bda8790e3e336f3))
* **roadmaps:** close release-review-p0 Phase 2 ([e16b1d1](https://github.com/event4u-app/agent-config/commit/e16b1d1fbae2f221ffe67bf567b726eec5287424))
* **contracts:** define what kind of evidence a stored artifact is ([dbcf664](https://github.com/event4u-app/agent-config/commit/dbcf66472a03063df0d2b1dddbf8fab9362b2f52))

### Refactoring

* **gates:** withdraw run from the JSON surface, keep class ([a168122](https://github.com/event4u-app/agent-config/commit/a16812274d7270a7e563f6844cf34b6087b29266))
* **council:** extract the parity serialiser and lower the size ratchet ([0982ff2](https://github.com/event4u-app/agent-config/commit/0982ff2bbba1f6d50720520c1d99357c9b316f71))
* **council:** extract the CLI-call budget into its own module ([ece9d45](https://github.com/event4u-app/agent-config/commit/ece9d45789b0a0490e3c149d07c3303462911504))
* **council:** extract the qualification seam out of council_cli.ts ([0422b86](https://github.com/event4u-app/agent-config/commit/0422b86f072de75dd44fab03ba9d65b96d9204e2))

### Tests

* **census:** give the activation gate a self-test so it proves discrimination ([0b0d4fc](https://github.com/event4u-app/agent-config/commit/0b0d4fc5f6137d74e68773acfa946a1a441b9915))
* **review:** follow the skeleton placeholder change downstream ([de3015c](https://github.com/event4u-app/agent-config/commit/de3015c7a02e9f3f2e72948dbf6dd5d906c1c39f))

### CI

* run the evidence-type gate, and correct the gate-script population figure ([676a1fa](https://github.com/event4u-app/agent-config/commit/676a1faf13220d47ec3a7e3aaf7a554aef4887a3))

### Chores

* **roadmap:** regenerate the archive index for the newly archived roadmap ([4a6ec0d](https://github.com/event4u-app/agent-config/commit/4a6ec0db0dceb1da526482e4683795b379842df6))
* **roadmap:** regenerate the dashboard after merging main ([1add1cd](https://github.com/event4u-app/agent-config/commit/1add1cd2a16fd8b6f2899da2ccea4b625fb3f333))
* **gates:** revert the header denominators, to re-land them after the findings ([03f9836](https://github.com/event4u-app/agent-config/commit/03f98362c95f40a82422a3053c80ddaae1d33fbf))
* **roadmap:** archive rule-stub-projection, complete at 17 of 17 steps ([7c67f62](https://github.com/event4u-app/agent-config/commit/7c67f6233bb960f87a1d06d9d681aad806bd3a13))
* **dist:** regenerate the agent-src projection ([186ddaa](https://github.com/event4u-app/agent-config/commit/186ddaa747062b527400676967d14676a8dd672f))
* **sync:** regenerate the dist projection ([7124ae6](https://github.com/event4u-app/agent-config/commit/7124ae6a1dae48b418a7828e68ef995a9a2c0c85))
* **roadmaps:** archive the completed council-quota roadmap ([fbb729a](https://github.com/event4u-app/agent-config/commit/fbb729a223cb4b9586d0fe773e2c320a082fadeb))
* **evals:** move cli_help_command_count 98 -> 99 for council:quota ([e0c46d6](https://github.com/event4u-app/agent-config/commit/e0c46d66665df4c12a30397bbd593afbdf5f5cdc))
* **dist:** re-project the edited commands and the council skill ([41b6b1e](https://github.com/event4u-app/agent-config/commit/41b6b1e4a036ed9f374ab63a648bc8ec139cd71f))
* **deps-dev:** bump the npm-development group across 1 directory with 5 updates ([01872a8](https://github.com/event4u-app/agent-config/commit/01872a8baf6bc03c16884395c10e9a99b83a8277))
* **index:** regenerate agents/index.md + docs/catalog.md after the merge ([f2e3d4d](https://github.com/event4u-app/agent-config/commit/f2e3d4d881465c3a89a35926e798c539a841f5d0))
* **roadmaps:** archive road-to-metric-loop-and-review-integrity ([bf3e144](https://github.com/event4u-app/agent-config/commit/bf3e144f2b84045639eb12118f3b03ff096adc8a))
* **ci:** register the evidence-type gate on both its scopes ([16239d4](https://github.com/event4u-app/agent-config/commit/16239d4880adff8959af2fa8e684bd62b6df67f9))

Tests: 14520 (+347 since 13.0.0)

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
