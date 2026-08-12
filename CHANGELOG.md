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

# Era: 9.36.x — current

> Started at `9.36.0`. Full entries live inline below.
> The drift test caps this era at 250 lines of entry body; growth past
> that forces a new era split (`# Era: 9.37.x`, etc.) — see
> [`docs/contracts/CHANGELOG-conventions.md § Era splits`](docs/contracts/CHANGELOG-conventions.md).

## [10.1.0](https://github.com/event4u-app/agent-config/compare/10.0.0...10.1.0) (2026-08-12)

### Release highlights

<!-- Curated head: fill before merge, keep it under 10 lines, and leave `_none_` where it is genuinely the answer. The generated log below is unchanged. -->
- **Behaviour changes:** _auto-derived, rewrite before merge:_ rule/schema diffs, breaking commits or removed public surface in 0992c92, 20a8606, 63aeba1.
- **Default changes + migration:** _none_
- **Security and correctness:** _none_
- **Honest nulls:** _auto-derived, rewrite before merge:_ commits carrying an honest-null marker in 0f3ce9b.
- **Known limitations:** _none_

### Features

* **untrusted-content:** tag external content where it enters, with an unforgeable boundary ([7a313ec](https://github.com/event4u-app/agent-config/commit/7a313ecfae4eadd06ff547a4a67d363a6758707b))
* **skill-schema:** structured runtime requirements, and the rule that gives them teeth ([63aeba1](https://github.com/event4u-app/agent-config/commit/63aeba1070af3d72bcaac0c7f999788d3b833354))

### Bug Fixes

* **roadmap,context:** satisfy the two gates this branch newly tripped ([e61d461](https://github.com/event4u-app/agent-config/commit/e61d46142a9dc41841c98360377cc89176ce1057))
* **roadmap-archival:** an open blocker outlives its steps, and the sweep did not look ([710dc26](https://github.com/event4u-app/agent-config/commit/710dc266a27a82aad9a527c525650e8d43accfdc))
* **review:** close all eight R2 findings, one of them by admitting a gap instead of papering it ([0992c92](https://github.com/event4u-app/agent-config/commit/0992c92219364bc646e78c29fa3072b5e46361ef))
* **diff:** drop a regenerated report my git add -A swept in ([3aec031](https://github.com/event4u-app/agent-config/commit/3aec031b160a8bc676053be370b2fddfbeab250c))
* **skill-schema:** rename requires to runtime_requires — the key was already taken ([20a8606](https://github.com/event4u-app/agent-config/commit/20a86065cc5d9c86e9fdf0710c51ddf850ca7ae4))
* **roadmap:** anonymize the harvest source per source-confidentiality ([195e444](https://github.com/event4u-app/agent-config/commit/195e444a7b1f9d7d05ac5cb768b0be17a1ac58ea))

### Documentation

* **changelog:** curate the 10.0.0 head, which shipped the same placeholder hours later ([0f3ce9b](https://github.com/event4u-app/agent-config/commit/0f3ce9b22c1858e12556a4b0fe95bec1931dde91))
* **roadmap:** the verified residue of five external release reviews ([a25579f](https://github.com/event4u-app/agent-config/commit/a25579fdf4d13cf6057ccdfeba5dc87990dd11e0))
* **analysis:** threat-model the confirmation store, and enumerate the buried decisions ([8b18f1c](https://github.com/event4u-app/agent-config/commit/8b18f1c4a850a9b08906aceccbe3562f381de7c3))
* **records:** three figures five reviews keep re-deriving, corrected at the source ([1612a70](https://github.com/event4u-app/agent-config/commit/1612a70e3e13daa0572fefb4803533708c1273f0))
* **changelog:** curate the 9.36.0 head that shipped its own placeholder ([83a3922](https://github.com/event4u-app/agent-config/commit/83a3922f63efbe5aca280e775acc85b36573c3f4))
* **review:** re-bind after the count correction ([9dd75ec](https://github.com/event4u-app/agent-config/commit/9dd75ecf178152641f8744a8f1b81f045befde7b))
* **roadmap:** correct the test count the review fixes moved ([ec52c42](https://github.com/event4u-app/agent-config/commit/ec52c421ba69dc85ee78095323f8495b93f3dd26))
* **review:** re-bind the R2 artefact to the fixed scope, dispositions terminal ([e601648](https://github.com/event4u-app/agent-config/commit/e6016487e883f611b2b7b989f23ed682796a6a73))
* **review:** record the R2 findings before fixing any of them ([1cf8d78](https://github.com/event4u-app/agent-config/commit/1cf8d787c015f51261bdd22b7388e47d127003f6))
* **roadmap:** add the Acceptance Criteria the completion review needs to bind to ([f35becd](https://github.com/event4u-app/agent-config/commit/f35becd885c09a5ac7f5a678adf29a360e776efa))
* **roadmap:** follow the schema key rename, and record why the obvious name was unavailable ([5720847](https://github.com/event4u-app/agent-config/commit/572084763fef97eb66fa91fd722d75a9c527440a))
* **roadmap:** the executable-payload harvest, with four source claims corrected ([2f4d8a8](https://github.com/event4u-app/agent-config/commit/2f4d8a8be5891d6045d4605a4a6d8fe3dc28a65e))

### Tests

* **council-cli:** the quota case asserted a property of the developer machine ([35037f9](https://github.com/event4u-app/agent-config/commit/35037f96d3e631d6ee1a235415e716e2a29f8f8c))

Tests: 13411 (+27 since 10.0.0)

## [10.0.0](https://github.com/event4u-app/agent-config/compare/9.36.0...10.0.0) (2026-08-12)

### Release highlights

- **Behaviour changes:** council transport is **resolved per machine rather than
  configured** — the breaking change this major carries (4eda4ff); every member
  now resolves as `auto`, so a configured CLI call budget applies wherever a
  council config exists. The turn-end gate is armed unconditionally and loses its
  settings surface (42cd613). Conformance round 7 records its downgrades rather
  than restating them (030ca0d, c1bc2aa).
- **Default changes + migration:** _none_
- **Security and correctness:** _none_
- **Honest nulls:** a blocker whose resolution condition no passage of time could
  satisfy — a default-OFF gate cannot soak, so the switch removal discharges it
  and the original wording stays verbatim beside the resolution, because the
  unsatisfiable condition is itself the finding (7c6b404).
- **Known limitations:** _none_

### BREAKING CHANGES

* **council:** transport is resolved per machine, not configured ([4eda4ff](https://github.com/event4u-app/agent-config/commit/4eda4ff0f518cb30778dc139852576efd35bd57a))

### Features

* **ci:** the parity gate learns about preflight, which it never inspected ([44151b0](https://github.com/event4u-app/agent-config/commit/44151b02cd765aff16d7e95459752ec553c1d57b))
* **conformance:** a fifth check, an era guard, and the denominator the rate was missing ([f7edbdc](https://github.com/event4u-app/agent-config/commit/f7edbdc99533d433ff2b1857bac5bc7fb2929fe8))
* **hooks:** refuse a completion claim while the last CI read is unsettled ([1ea7536](https://github.com/event4u-app/agent-config/commit/1ea753629ce6a468e061af1ee2f7ac3f38f6bebd))
* **turn-end-gate:** arm it unconditionally, with no settings surface ([42cd613](https://github.com/event4u-app/agent-config/commit/42cd6131761a5b6681583abd8b7100f4415d84bf))

### Bug Fixes

* **round7:** close the R2 findings — the two high ones are in my own Phase 1 ([030ca0d](https://github.com/event4u-app/agent-config/commit/030ca0d6e1a6b27ebbebf74a34caa1403cc98dfa))
* **council:** validate the output path before spending, and count attendance from answers ([a23d6c8](https://github.com/event4u-app/agent-config/commit/a23d6c84d4963f17ca94838bdbc9f7067b72e77a))
* **hooks:** block-no-verify stops failing closed on heredoc prose ([7ac5cd2](https://github.com/event4u-app/agent-config/commit/7ac5cd227d34dbc92f9f0438746ff5cd1317e5d2))
* **taskfile:** block-scalar the bridge-derivation desc so the taskfile parses ([9b0f7b9](https://github.com/event4u-app/agent-config/commit/9b0f7b90ba9bac04c7b0e80dbeaeb99a3aab4cc3))
* **council:** use a Json-typed sentinel for the ignored-key presence check ([29b9f42](https://github.com/event4u-app/agent-config/commit/29b9f42e505c187f2b35abcb81cc6e7055d5507f))
* **detection:** find the Claude subscription in the macOS Keychain ([72de870](https://github.com/event4u-app/agent-config/commit/72de8706812ea2cf30940697887964ae1406a3e4))
* **gates:** scope bridge-derivation to the roots this checkout writes ([ea1b1d4](https://github.com/event4u-app/agent-config/commit/ea1b1d4e230375db0ae1c8e01226d8527a08a1e7))

### Documentation

* **review:** re-bind the R2 artefact to the fixed scope ([304b898](https://github.com/event4u-app/agent-config/commit/304b89866880c23f68106c096df20ce18ed207b7))
* **review:** record the R2 findings before fixing any of them ([bdf45c2](https://github.com/event4u-app/agent-config/commit/bdf45c2e86b2839f3c64d432d50285f043f08d3d))
* **roadmaps:** the fifth check makes two Context claims stale, in both directions ([6915456](https://github.com/event4u-app/agent-config/commit/6915456005fd164bc525103c6f0b59f05dbc8169))
* **analyze:** the conformance command documented four checks, there are five ([d05f97e](https://github.com/event4u-app/agent-config/commit/d05f97e13b03cc04036d83aba4df6635e0323932))
* **conformance:** round 7 — the honest downgrades and the archived roadmap ([c1bc2aa](https://github.com/event4u-app/agent-config/commit/c1bc2aaef41b04aa76024f9949c9e10eacd9886c))
* **council:** the template and contract stop documenting a setting that is gone ([49d58fa](https://github.com/event4u-app/agent-config/commit/49d58fa28778359416459465cf066b7d8fccb363))
* **roadmap:** close the stop-refusal blocker, open the two follow-up tracks ([7c6b404](https://github.com/event4u-app/agent-config/commit/7c6b4045c2cadf023d1f434ff851cec86372613a))

### Refactoring

* **condense:** expose the active-tool set root-parameterised ([d795d6a](https://github.com/event4u-app/agent-config/commit/d795d6a666f57be451d0dd5462b8725b56e44e75))
* **settings:** delete hooks.turn_end_gate.* and give REMOVED_KEYS per-key reasons ([f5b316b](https://github.com/event4u-app/agent-config/commit/f5b316b4bc531e2cf7ce0d65556c4a2737cbe0dc))

### Tests

* **hooks:** prove the completion detector is wired, not just correct ([4d284ef](https://github.com/event4u-app/agent-config/commit/4d284efa10ba939066edfc42c4a735d94e794def))

### Chores

* **condense:** re-project session-canary after the reproduction-command fix ([2d344c4](https://github.com/event4u-app/agent-config/commit/2d344c4d2183a608986f9dce485f1e5006e48863))

Tests: 13384 (+51 since 9.36.0)

## [9.36.0](https://github.com/event4u-app/agent-config/compare/9.35.0...9.36.0) (2026-08-12)

### Release highlights

- **Behaviour changes:** the demand gate reads `project.audience` and is inert at
  `self` — a market-demand ladder no longer fires on a project that intends no
  market (9f69017). The two UI rules stop claiming the `ui-route-nudge` concern
  reads their `keyword:` triggers; it does not, and six surfaces said it did
  (3c20d47). The design skills now reach the consumers they were written for
  (72bb1bc). The CI-side change in 924cad8 is internal to the pipeline and
  changes no consumer-visible behaviour.
- **Default changes + migration:** _none_
- **Security and correctness:** _none_
- **Honest nulls:** _none_
- **Known limitations:** _none_

### Features

* **consultation-rate:** compute the half of the metric that is computable ([36064ef](https://github.com/event4u-app/agent-config/commit/36064efa1a85c9ea1c6c2beb427fe684177ca2a8))
* **analyze:** anchor-first direction, claim gate, interop probe and bounded --deep ([5bee62a](https://github.com/event4u-app/agent-config/commit/5bee62a5828ba6d3cf38a7d5d685004716d8addf))
* **lint-roadmap:** warn when a gate rests on a population the project cannot produce ([e5c0b56](https://github.com/event4u-app/agent-config/commit/e5c0b569417d80ee937fd7ec955680c724abe3e1))
* **demand-gate:** the L0-L4 ladder measures market demand, and now says so ([9f69017](https://github.com/event4u-app/agent-config/commit/9f69017632aead1f2a0e20eb8518ae4d8508ea1a))
* **fe-design:** outside the ticket engine, this skill is the executor ([2946655](https://github.com/event4u-app/agent-config/commit/294665543cfb1a3c896e25024fd08551af629bb2))
* **ui-route-nudge:** the first runtime consumer the UI rule triggers ever had ([6bf216e](https://github.com/event4u-app/agent-config/commit/6bf216e649febf3d95162e7f9b222f43ae2bd407))
* **pack-reach:** report where a rule and the skills it routes to cannot meet ([4bc28e6](https://github.com/event4u-app/agent-config/commit/4bc28e660f9eaef87b1e8f5ed4bbbd1914a7d3e4))
* **catalogue:** measure the skill-catalogue delivery defect, and publish the null ([b2adebe](https://github.com/event4u-app/agent-config/commit/b2adebe17320109a98a41eb4b0fc69233b567e47))
* **ui-surface:** one definition of a UI surface, and it covers Blade ([e9ba053](https://github.com/event4u-app/agent-config/commit/e9ba0533110da9aa9bbd276ab3ced2004c2d5d50))

### Bug Fixes

* **proof:** regenerate docs/proof.md after the new pre-registered claim ([6a8bc44](https://github.com/event4u-app/agent-config/commit/6a8bc446abcc06cee3cc55ffd75f7668037542ea))
* **baseline:** repair the measurement table split by the unit note ([afa1ea0](https://github.com/event4u-app/agent-config/commit/afa1ea0f1369293a8e392e132343dc05c126ccda))
* **consultation-rate:** close the R2 findings, unit first ([c53b3da](https://github.com/event4u-app/agent-config/commit/c53b3da53111a089d07c59186d1aa1124adc2d31))
* **agents-md:** keep the corrected pointer inside the Thin-Root char cap ([858963f](https://github.com/event4u-app/agent-config/commit/858963f956d516d5200d9e27c9014aee41938973))
* **agents-md:** the consumer template contradicted itself on always-active rules ([639ce5e](https://github.com/event4u-app/agent-config/commit/639ce5e26d8e4d3ca70d8e4f1f6953548f72322f))
* **dist:** rebuild the install bundle without build-machine paths ([55f4e64](https://github.com/event4u-app/agent-config/commit/55f4e6449ad0eb9d8c79bdeffea6c174ddda66f2))
* **cli-delegate:** close the six R2 findings, two of them on this fix ([6c26dd4](https://github.com/event4u-app/agent-config/commit/6c26dd45187b374a473df5bba241b0bd502accd2))
* **cli-delegate:** four shipped commands were silent no-ops in their own bundle ([1ea3f67](https://github.com/event4u-app/agent-config/commit/1ea3f67012929f7c00604bc9cda6a85b1d783e32))
* **ci:** three downstream surfaces the new triggers, key and gate opened ([924cad8](https://github.com/event4u-app/agent-config/commit/924cad87f91eb57acf4e8619015f3089e07a956c))
* **capture,lint,docs:** close the remaining R2 findings ([396d58f](https://github.com/event4u-app/agent-config/commit/396d58fbff2704cddce10577e2cbd82db9c5003c))
* **ui-surface,nudge,settings:** three predicates that were wider than their claims ([36e1632](https://github.com/event4u-app/agent-config/commit/36e1632287a85c0934bec8a43752b8761dfa19d6))
* **ui-rules:** the nudge does not read the rules, and six surfaces said it did ([3c20d47](https://github.com/event4u-app/agent-config/commit/3c20d47dee794e1c9ddbf6a895527953788c31ff))
* **ui-rules:** reach the consumers the design skills were written for ([72bb1bc](https://github.com/event4u-app/agent-config/commit/72bb1bc3943c8fb721db9d44b5daa5334bcb956f))

### Documentation

* **review:** re-bind the R2 artefact to the fixed scope ([0cc9057](https://github.com/event4u-app/agent-config/commit/0cc9057d97b78cf82fd957afd96ec9205bfc7fc0))
* **review:** record the R2 findings before fixing any of them ([b42227a](https://github.com/event4u-app/agent-config/commit/b42227a6e32b041c6b9b82f373bb23c2d15cc03a))
* **baseline,roadmap:** the first measurement, and what its denominator says ([347cb47](https://github.com/event4u-app/agent-config/commit/347cb4702b55f22723ecf4d7fb00fe202fb4d72c))
* **roadmaps:** archive the completed cross-repo differential loop roadmap ([f90b42b](https://github.com/event4u-app/agent-config/commit/f90b42b918813c0f354037abd5965bd45afb7a5d))
* **claims:** pre-register the reference-loop upgrade value claim ([67c1ba4](https://github.com/event4u-app/agent-config/commit/67c1ba400531ca0eead1c282a6dd802c55080eb5))
* **roadmap:** archive the cross-corpus verification roadmap, complete ([483acc6](https://github.com/event4u-app/agent-config/commit/483acc654e8d8a2a3b9cecbc96be6e79e8da12a0))
* **adr:** record what the cross-corpus proposal measurements survived ([87e81d8](https://github.com/event4u-app/agent-config/commit/87e81d8faadc35f070163d3ec3288b78cad19d1d))
* **roadmap:** the demand-gate audience roadmap and its follow-up ([079f22c](https://github.com/event4u-app/agent-config/commit/079f22cbd16df95ceebcccdb9a4ae3bcc73390ef))
* **review:** re-bind after the CI fixes, and name what is unreviewed ([f9e66de](https://github.com/event4u-app/agent-config/commit/f9e66de977d9a33766edcfd84936ef12ba09358d))
* **review:** state precisely what moved between the two re-binds ([8b2bdd4](https://github.com/event4u-app/agent-config/commit/8b2bdd4267307cbbaec410d6305b9d91f98cc7c1))
* **review:** re-bind the R2 artefact after the generated-file regen ([03e1029](https://github.com/event4u-app/agent-config/commit/03e102989d92f2cc913dc839b05986cf7d4db1f3))
* **roadmap:** the frontend-skill-application plan and its first run ([c1bd64f](https://github.com/event4u-app/agent-config/commit/c1bd64fe559a60a6b6f6248ffc3ff0127df5fe46))
* **dispatch:** a UI-shaped slice carries its design context across the boundary ([aae1e52](https://github.com/event4u-app/agent-config/commit/aae1e5242d3f5ed4a99c9a33d4551ca9183b8f77))

### Refactoring

* **skills:** one spelling for the disclosure directory, and an authoring section that names it ([3cd3103](https://github.com/event4u-app/agent-config/commit/3cd3103962d8d632c9fe18691016b6044ffc084b))

### Tests

* **demand-gate:** pin both halves, and name what these tests are not ([0a1da08](https://github.com/event4u-app/agent-config/commit/0a1da086689b0c3b5d4df3097df4e731b6506481))
* **cli-delegate:** execute every delegate bundle, because reading cannot see this ([5d8a741](https://github.com/event4u-app/agent-config/commit/5d8a7410da9caba0e77714dc9e5e92c370a1614e))

### Chores

* **roadmap:** archive the completed roadmap in the PR that completes it ([1d05116](https://github.com/event4u-app/agent-config/commit/1d05116c62f316b64fb1d6a8e86381d03f3f22fe))
* **review:** re-bind the artefact after the bundle rebuild ([b0bf837](https://github.com/event4u-app/agent-config/commit/b0bf837046718823c52f4db9216d27192f8a131b))
* **dist:** rebuild the committed install bundle after the guard change ([0d7b0ae](https://github.com/event4u-app/agent-config/commit/0d7b0ae2709d7a6fcf0eb5ecd9e1e0241a28c06d))
* **review:** re-bind the artefact after merging main ([ab4272b](https://github.com/event4u-app/agent-config/commit/ab4272b98a53628fa00544b134a49b7e97545ad4))
* **review:** re-bind the artefact and mark all six findings fixed ([c1eb64a](https://github.com/event4u-app/agent-config/commit/c1eb64ab051a663a45a1a76696a282a7e7dfb6c0))
* **review:** record six R2 findings before fixing them ([872fc7b](https://github.com/event4u-app/agent-config/commit/872fc7b0a7e735e7ebd13d357b7270b8a1140046))
* **index:** regenerate the artefact index and public catalog ([cfc75b6](https://github.com/event4u-app/agent-config/commit/cfc75b6b26bbf6bd09c0536ca0f553a52fbd09a9))
* **dist:** regenerate the router after merging main ([4bab07c](https://github.com/event4u-app/agent-config/commit/4bab07c67ec7d5778f957789bc6d427ec6274641))

Tests: 13333 (+120 since 9.35.0)

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
