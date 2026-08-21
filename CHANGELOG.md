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

# Era: pre-14.3.0 — archived

> All entries before `14.3.0` live in
> [`docs/archive/CHANGELOG-pre-14.3.0.md`](docs/archive/CHANGELOG-pre-14.3.0.md).
> The archive is read-only; git tags remain the canonical
> source for what shipped. Splitting them out of the main file
> keeps the active era under the 250-line drift cap enforced by
> `tests/test_changelog_eras.py`.

# Era: pre-14.5.0 — archived

> All entries before `14.5.0` live in
> [`docs/archive/CHANGELOG-pre-14.5.0.md`](docs/archive/CHANGELOG-pre-14.5.0.md).
> The archive is read-only; git tags remain the canonical
> source for what shipped. Splitting them out of the main file
> keeps the active era under the 250-line drift cap enforced by
> `tests/test_changelog_eras.py`.

# Era: 14.5.x — current

> Started at `14.5.0`. Full entries live inline below.
> The drift test caps this era at 250 lines of entry body; growth past
> that forces a new era split (`# Era: 14.6.x`, etc.) — see
> [`docs/contracts/CHANGELOG-conventions.md § Era splits`](docs/contracts/CHANGELOG-conventions.md).

## [14.7.0](https://github.com/event4u-app/agent-config/compare/14.6.0...14.7.0) (2026-08-21)

### Release highlights

<!-- Curated head: fill before merge, keep it under 10 lines, and leave `_none_` where it is genuinely the answer. The generated log below is unchanged. -->
- **Behaviour changes:** _auto-derived, rewrite before merge:_ rule/schema diffs, breaking commits or removed public surface in 629b6bc, 3863e8e, 2af3ff9, 0b819cc, a95cce6, f27ece4 +7 more.
- **Default changes + migration:** _auto-derived, rewrite before merge:_ commits naming a default, migration or migrate in a74051c, 258d697, 319d339.
- **Security and correctness:** _auto-derived, rewrite before merge:_ security-scoped commits or fixes to executable surface in 5003707, d805a04, 955378e, 8278340, 629b6bc, 49cc421 +22 more.
- **Honest nulls:** _auto-derived, rewrite before merge:_ commits recording a null, waived or falsified result in a6d2275, 4190772, 80aab39, c5290e0, 4c038b7, f4cfeb4 +2 more.
- **Known limitations:** _none_

### Features

* **session-register:** price "join anyway" where the collision is announced ([6a18748](https://github.com/event4u-app/agent-config/commit/6a187485f67c98cea1acdfaaf142fba36db6245a))
* **roadmap:** pass --archive from the two explicit regen call sites ([22e3d4b](https://github.com/event4u-app/agent-config/commit/22e3d4b9f6545695226a47e79d244792cdd233aa))
* **roadmap:** archive completed roadmaps instead of warning about them ([778b697](https://github.com/event4u-app/agent-config/commit/778b697526ef3bb1c1684c8bb877ac196074091a))
* **gates:** make the decision sheet record which option was answered ([82d6556](https://github.com/event4u-app/agent-config/commit/82d6556a2a89aaddabd3b504656685b5843ce4f6))
* **gates:** run class-1 gates under the standing budget, and receipt them ([6a6a7cf](https://github.com/event4u-app/agent-config/commit/6a6a7cf6f1fb9b60e45e48b8d9f005edc53f4368))
* **settings:** register the class-1 gate budget caps ([9370e03](https://github.com/event4u-app/agent-config/commit/9370e034bf37058cfe4468fcb480794873b7b678))
* **self-repair:** Class-B render plus a digest-bound approval gate ([a930c04](https://github.com/event4u-app/agent-config/commit/a930c04e7cf6b026255bfa291321407f987104e1))
* **telemetry:** Class-A shadow when the self-repair loop queues a defect ([e384643](https://github.com/event4u-app/agent-config/commit/e38464303b3a3b3f1d4f41beb408f8c5e00f0762))
* **subagent-ledger:** split the envelope verdict four ways ([0cd3a3e](https://github.com/event4u-app/agent-config/commit/0cd3a3e1b202a08f58703ff752e50f469564f625))
* **metrics:** repair the dead usage-report paths and add the sink source ([fdb43da](https://github.com/event4u-app/agent-config/commit/fdb43da71f3b456da20a84fff68b4f2f3cf7c060))
* **telemetry:** enqueue-at-write spool plus detached session-end sender ([90af183](https://github.com/event4u-app/agent-config/commit/90af1831591d6152b8ad026b5ba40f92056623b6))
* **bench:** pin a v2 corpus task to an external repository at a SHA ([3d9f8b4](https://github.com/event4u-app/agent-config/commit/3d9f8b45287ca7a72c35af680e75e698d181de38))
* **roadmap:** add the multi-host screenshot census stub as a drain-run transfer ([d26a204](https://github.com/event4u-app/agent-config/commit/d26a20423869a07171de57581109c41dee712e89))
* **roadmap:** execute the parked rules-as-skills probe to a terminal honest null ([f4cfeb4](https://github.com/event4u-app/agent-config/commit/f4cfeb4f6e1f4812555ec7ecd2a06e833279a86b))
* **hooks:** add source-first-gate concern in shadow posture ([d8f3a01](https://github.com/event4u-app/agent-config/commit/d8f3a01a7cc3492ab71d058f57b16c7e3ac9ff12))
* **roadmap:** add the host-aware-skill-projection transfer stub and its own gate group ([5e440ca](https://github.com/event4u-app/agent-config/commit/5e440caac6cbab500f76a5a14f0469407213ae60))
* **md:** section edits anchored on a line, and a shape assertion that is loud ([34f9d23](https://github.com/event4u-app/agent-config/commit/34f9d23c74d0fc0812b6fb44f4558db8950d2fda))
* **ci:** a settle helper that never reports a verdict it did not read ([0b819cc](https://github.com/event4u-app/agent-config/commit/0b819cc7fffaaf6f5fb795f68e0659ad3be50703))
* **council:** sub-help lists its flags, and an unconfirmed run says so first ([ae3f931](https://github.com/event4u-app/agent-config/commit/ae3f93108ae6ed1589ca31a9fdead2f62ada0c80))
* **roadmap:** emit a gate-clean skeleton, and repair eight invented complexity values ([d0d1837](https://github.com/event4u-app/agent-config/commit/d0d18378007dfbd24a7919185c6b06152e5994be))
* **governance:** process-full is an end-to-end delegation, ADR-237 supersedes ADR-235 ([8408977](https://github.com/event4u-app/agent-config/commit/84089778acbae49896ed319a39fdb4c5bf67406c))
* **delivery:** partition the two artefact layers on a verified host fingerprint ([ad0b6b6](https://github.com/event4u-app/agent-config/commit/ad0b6b6a6af70ec50f5204bb3f2b19ef2aa8c9df))
* **rules:** fix-what-you-see — ownership is never a disposition ([85d11d1](https://github.com/event4u-app/agent-config/commit/85d11d1b72e82328e2e5441027e617d6244d0d0d))
* **recurrence:** treat repeated criticism as evidence about the system ([8e72336](https://github.com/event4u-app/agent-config/commit/8e7233671ce432890f5f5602c96ca77da10e4356))
* **analyze-inbox:** reproduce the dropped file steps, not just read them ([fa3a295](https://github.com/event4u-app/agent-config/commit/fa3a2955ffade17e763588d659abfe41c975a479))
* **roadmaps:** list parked work in the dashboard, with what brings each one back ([0303b11](https://github.com/event4u-app/agent-config/commit/0303b115da8b718b53c4e7531e2df36ad3856dec))
* **preflight:** bind check_single_delivery, with a test that proves it is live ([ec9aa05](https://github.com/event4u-app/agent-config/commit/ec9aa05f63f2e7166fada73467dd094e5fe79075))

### Bug Fixes

* **test:** re-base the R2 vacuity guard on the corpus, not a pinned count ([5003707](https://github.com/event4u-app/agent-config/commit/5003707f7bbea3461a6e429bb14546006c3f34af))
* **stubs:** elide the external source name a quoted stash message carried in ([5931d15](https://github.com/event4u-app/agent-config/commit/5931d152f0375d5710d366cdc126d69cda98d7e8))
* **roadmap:** re-depth the archived file's links and qualify the producer ([c8d2b3b](https://github.com/event4u-app/agent-config/commit/c8d2b3bb06cdcc57c9659b94da068c86ed48fce5))
* **tasks:** scope the consistency check to the paths it regenerates ([33cf9e2](https://github.com/event4u-app/agent-config/commit/33cf9e2fb2d4601b1c289ea77728dc5475616488))
* **sync:** the compiled hook manifest is GENERATED, not AUTHORED ([d805a04](https://github.com/event4u-app/agent-config/commit/d805a04b66fcfd2b8211e81b656893a103f0da5f))
* **settings:** correct the falsified reason for "absent audience resolves to public" ([1f60006](https://github.com/event4u-app/agent-config/commit/1f600066825abd34f733f060df0fac3278b94d10))
* **ci:** state the rule-stub ceiling raise Iron Law 1 earned ([a6c74bd](https://github.com/event4u-app/agent-config/commit/a6c74bdcb7edc962267f1bb1b3e6874ec2b47487))
* **ci:** extract the archival sweep so the source ratchet stays put ([955378e](https://github.com/event4u-app/agent-config/commit/955378e8317bd82cab41ea119e17302d1574890f))
* **ci:** stop two gates contradicting each other over a frozen record ([8278340](https://github.com/event4u-app/agent-config/commit/827834062520f421aba60f5e05a9fa84c21b2d9e))
* **ci:** put the archival contract where there is room for it ([629b6bc](https://github.com/event4u-app/agent-config/commit/629b6bcc18856bf6f85f0a46bacbf76f548ad656))
* **gates:** repoint the framework-leakage exemption at the file the content moved to ([6391c8c](https://github.com/event4u-app/agent-config/commit/6391c8c07fe8412ec60ce7ace24983ccba5d30bb))
* **roadmap:** encode the scale-history transfer as Status resolved ([7fdb1bc](https://github.com/event4u-app/agent-config/commit/7fdb1bc6e458771ae21f922f08e1429e8d455d96))
* **roadmap:** re-measure AC-2's empty-population figure at HEAD ([7299803](https://github.com/event4u-app/agent-config/commit/7299803eeaf7a99233aa58f9fd45cc34a5c8c1a1))
* **roadmaps:** correct the dashboard-rendering claim in the Outcome ([3c86dcd](https://github.com/event4u-app/agent-config/commit/3c86dcdc62df16d3156c3795aceb3c2924b18232))
* **roadmap:** use the blocker status token the gates actually read ([1883c07](https://github.com/event4u-app/agent-config/commit/1883c07dbb36be0b6475ec0067da0a32d2419934))
* **gates:** read the acceptance-criteria heading case-insensitively in R1 ([49cc421](https://github.com/event4u-app/agent-config/commit/49cc421b4aa316e446412543fd1e46ec62af3672))
* **roadmap:** resolve ui-session-capture-window as transferred, with the destination verified ([51c42ca](https://github.com/event4u-app/agent-config/commit/51c42ca552d43627f89449e755d843b959071fdc))
* **roadmap:** re-review the frontend-skill-application risk register ([1fac63a](https://github.com/event4u-app/agent-config/commit/1fac63a5b7c91f1d8b6f7470170f329963397d0d))
* **counts:** stop counting `__`-prefixed scratch packs as commands ([dc2e3ca](https://github.com/event4u-app/agent-config/commit/dc2e3ca10fee837a9fcb5897f52f73a9bc45a154))
* **state:** make the lock primitive honest about scope, staleness and outcome ([bcbb038](https://github.com/event4u-app/agent-config/commit/bcbb0380b8cddfb259aaafbfd83efcb482acd30a))
* **state:** read the verify state from the path its producer writes ([57f896b](https://github.com/event4u-app/agent-config/commit/57f896b510fd4f3287e79c92a6d95231dc4546b1))
* **succession:** correct the tracked bus-factor and its truncating recompute ([2232b47](https://github.com/event4u-app/agent-config/commit/2232b477df49e3368d7be4505f2eae45b9530147))
* **rules:** move the CI-waiter mechanics to the guideline the rule points at ([2af3ff9](https://github.com/event4u-app/agent-config/commit/2af3ff910741a0b9c5c3b7cb71e842a978b146e4))
* **council:** extract the help renderer — it pushed council_cli over the size ratchet ([f7ed05e](https://github.com/event4u-app/agent-config/commit/f7ed05e182821ba6e4811f8a1fd2f0c72aa71fca))
* **context:** drop the duplicated ADR-237 notes from the two budget-critical contexts ([5559aba](https://github.com/event4u-app/agent-config/commit/5559aba0ae742e999eacbd3321b5cd54aa75ae7c))
* **hooks:** a missing space disabled the no-verify guard, in both directions ([89a408f](https://github.com/event4u-app/agent-config/commit/89a408fd7479a8c2fac1aafda7d1f42ae6ef9f85))
* **rules:** keep the path-scoping rationale in one place, per the stub ceiling ([a95cce6](https://github.com/event4u-app/agent-config/commit/a95cce622aad46251ccec306e41f3d5fc227dd4e))
* **scope-guard:** print the duplicate count on DRIFT, not only on WARN ([3b43526](https://github.com/event4u-app/agent-config/commit/3b435262f9b7024c83e87ba57a95f46702170faa))
* **rules:** the four package-only rules load unconditionally, not path-scoped ([f27ece4](https://github.com/event4u-app/agent-config/commit/f27ece428828b58e1771234f2db6c4ab50b5b187))
* **release:** condense the probe doc to keep the source-size ratchet green ([5ac7efb](https://github.com/event4u-app/agent-config/commit/5ac7efbcd9e5e754f3bec84230ba4d0c1e409154))
* **gates:** the published-gate asks origin, not the local tag list ([424507c](https://github.com/event4u-app/agent-config/commit/424507c1cc0d8401532aa511e14e07360ec3f524))
* **release:** a local-only tag is not a completed release ([224f3fb](https://github.com/event4u-app/agent-config/commit/224f3fbed31b938751700b83c041d7dacd33436f))
* **rules:** replace two substring-prone triggers with phrases ([e351ff8](https://github.com/event4u-app/agent-config/commit/e351ff87e3cf789e3f0a34d974e26e9c558bf4d6))
* **roadmap:** untrack the peer session's roadmap I committed by accident ([00223ef](https://github.com/event4u-app/agent-config/commit/00223ef2be9a464edff279bc1b941a921c153623))
* **docs:** regenerate proof.md for the post-merge rule count ([6e8d971](https://github.com/event4u-app/agent-config/commit/6e8d971f2e2135b0480db29e0264e37228a263d4))
* **guideline:** drop the frontmatter that split the MCP resource URI ([2dbdaff](https://github.com/event4u-app/agent-config/commit/2dbdaff523f75f9dcd2fb6cb8113b4f438a7fe1b))
* **rules:** correct the pack value, and close the gap that let it through ([baae17f](https://github.com/event4u-app/agent-config/commit/baae17f946482166603e95d1684d2928fd4a3357))
* **rules:** route the mechanics, and name the tools a red check is read with ([560a285](https://github.com/event4u-app/agent-config/commit/560a285583f7105dce5e2cb91c9829e2a7957eb1))
* **rules:** fix-what-you-see ships `auto` — the always-budget has 2 chars free ([99fe76e](https://github.com/event4u-app/agent-config/commit/99fe76e32ebad501aa28b7cd8e2c44276eca5e9f))
* **pack:** raise the uncondensed proxy cap to 6 MiB, with measured numbers ([e417887](https://github.com/event4u-app/agent-config/commit/e417887ccf89b2080fdbce13ff4034af71b490f5))
* **tests:** neutralise the ambient locale, and test the branch it was hiding ([b77b6c3](https://github.com/event4u-app/agent-config/commit/b77b6c3fe3a3e7765453f5e392f84d7739b27a9e))
* **recurrence:** shrink the rule, migrate depth, re-anchor the census ([319d339](https://github.com/event4u-app/agent-config/commit/319d33936309c432987f43759fcced7ffd25ed33))
* **docs:** regenerate command-flows for the analyze-inbox description ([8c70c11](https://github.com/event4u-app/agent-config/commit/8c70c111380737f0fcffcbeb35a7ee7aca93f94b))
* **turn-end-gate:** check state ownership in the readers that consume it ([c9b0270](https://github.com/event4u-app/agent-config/commit/c9b027001d028cb2c8fb57969995e7026f7783f3))
* **language-mirror:** exact state ownership, an injectable writer, and a snapshot-safe counter ([b52342e](https://github.com/event4u-app/agent-config/commit/b52342e9743afae25ddcf53df735cdd95bf3de07))
* **state-io:** make the session-state pruner non-destructive under concurrency ([e7dabdd](https://github.com/event4u-app/agent-config/commit/e7dabdd73ef851bd480977f8b14fdfd8390343e4))
* **pack:** re-baseline the packed cap 7.8 to 7.9, trim the concern comments ([8304545](https://github.com/event4u-app/agent-config/commit/830454529c885c64939365c2696533da3ec74b03))
* **roadmaps:** exempt the parked rows from the reference check, because a resume condition names what does not exist yet ([a4824b9](https://github.com/event4u-app/agent-config/commit/a4824b9ad5870b6b24eca78ee64a3afdb9bae3df))
* **hooks:** gate ship-diff-volume on the command tool, descend partial envelopes, surface a stubbed body ([15785e5](https://github.com/event4u-app/agent-config/commit/15785e5d56deb2e352ff8dcfe93cc9632269591d))
* **gates:** list --quiet in check_single_delivery --help ([b637664](https://github.com/event4u-app/agent-config/commit/b637664b3bb12d56e5d55652ab5d057e9f1bac12))
* **roadmaps:** re-depth the moved links, and stop the parked section printing a saving ([51ec40b](https://github.com/event4u-app/agent-config/commit/51ec40b88bfbaac194859edce1cc54b2f935955b))
* **hooks:** read ship-diff-volume off the payload, not the envelope root ([e7bccc6](https://github.com/event4u-app/agent-config/commit/e7bccc6bec30c8fb9fb261dc531101fb81f19c6f))
* **gates:** repair the four R2 findings that mattered, including a governance one ([d3d1cfe](https://github.com/event4u-app/agent-config/commit/d3d1cfe4b0e31bb7c9973941ffb54329e779e4c6))

### Documentation

* **roadmap:** correct the Outcome tallies against the markers ([92e53ed](https://github.com/event4u-app/agent-config/commit/92e53ed2a7dd942cfb2d8a3931efc5a0dd6c5a40))
* **stubs:** transfer the session-closeout residue that needs an owner ([73435d7](https://github.com/event4u-app/agent-config/commit/73435d771c7e2356775805c2f5a56c00d83280b6))
* **stubs:** register the cost-parity-1 transfer row ([90173a3](https://github.com/event4u-app/agent-config/commit/90173a35246b6518017de782d8d68d063431d303))
* **roadmap:** close cost-parity part 1 with per-step dispositions ([f2d129f](https://github.com/event4u-app/agent-config/commit/f2d129f50ebc7c55b0ba551a64928f38ee0dad3d))
* **gates:** say where check_single_delivery is meaningful, and drop a stale halt ([7ed29b9](https://github.com/event4u-app/agent-config/commit/7ed29b92320a328a4b6e10d6e8d547f327781c19))
* **changelog:** curate the two heads that shipped uncurated ([a6d2275](https://github.com/event4u-app/agent-config/commit/a6d2275234ab56f39d7c4749ee9931d82fad21ee))
* **roadmap:** re-depth the archived roadmap's own links ([ebcbd2a](https://github.com/event4u-app/agent-config/commit/ebcbd2a52e255c7349950b988d6997fdd0ddfd1b))
* **roadmap:** correct the two-questions wording now that Item 2 is abandoned ([a36c644](https://github.com/event4u-app/agent-config/commit/a36c6443e76a8bcc0e0c26eda13ad82bcdce5d0b))
* **roadmap:** correct the refuted and drifted figures in cost-parity part 1 ([ba0fc3c](https://github.com/event4u-app/agent-config/commit/ba0fc3c282db8ba4c66427eced2865b5767c951f))
* **roadmap:** add the Risk Register the substantial change now requires ([a4c1748](https://github.com/event4u-app/agent-config/commit/a4c1748e3d233be7b2e9d0ea14ea0bbe7d7989a3))
* **evidence:** re-point the migration note's citations after the guideline edit ([a74051c](https://github.com/event4u-app/agent-config/commit/a74051cf3a6c429602b702a4f62a2e1b4a5a2b64))
* **evidence:** add the 4.1a window-feasibility reading ([9ffd48d](https://github.com/event4u-app/agent-config/commit/9ffd48d02913be291370135423d6bd180427a0fb))
* **stubs:** transfer the four release-gated items to a stub ([64cd25f](https://github.com/event4u-app/agent-config/commit/64cd25f9377f9e6986404550fd011100b2105aa1))
* **evidence:** record cost-parity part 1 drain readings ([85fc0b4](https://github.com/event4u-app/agent-config/commit/85fc0b45ec0ceec24ccb1e6f76e60a5c7e7c8d94))
* **roadmap:** drain road-to-demand-gate-audience-followup to partially satisfied ([e6e170f](https://github.com/event4u-app/agent-config/commit/e6e170f96bb91039a76772eb4529dd65e2ff02ab))
* **roadmap:** classify all 54 open lines before executing any of them ([5556bd2](https://github.com/event4u-app/agent-config/commit/5556bd2b84ed63c0e675bbc6fe4384ff33641b2f))
* **evidence:** read the live state of the CI-native release path ([2c3cd98](https://github.com/event4u-app/agent-config/commit/2c3cd98d8d7089f24209a3dea542422334707db2))
* **evidence:** record the drain-run handoff notes the recycle envelope points at ([609e108](https://github.com/event4u-app/agent-config/commit/609e108c4be958d7d14138aa65915e26f1790bf5))
* **roadmap:** record that the regen reconciles the estate, not reports it ([3863e8e](https://github.com/event4u-app/agent-config/commit/3863e8e4f383f289f5df2116249ac0ffc2662c37))
* **stubs:** repair the drain-run transfers section into one table ([65ffd9d](https://github.com/event4u-app/agent-config/commit/65ffd9d10a9421e14c983e8e1e7b6b4c428de0c4))
* **roadmap:** close road-to-distillation-followups honestly ([33c205b](https://github.com/event4u-app/agent-config/commit/33c205b72036cd631835aad78564f72c71b799ba))
* **stubs:** transfer the first true reference-analysis run to a stub ([0bff97d](https://github.com/event4u-app/agent-config/commit/0bff97d1559bd149f672c11a89958f36f9abf5f4))
* **roadmap:** re-review the org-telemetry risk register at closure ([f226d9b](https://github.com/event4u-app/agent-config/commit/f226d9bf51eff76abc4ffccf913c9b758e426d6c))
* **roadmap:** close b-consolidated-decision-sheet and record the outcome ([4190772](https://github.com/event4u-app/agent-config/commit/4190772cc0399cd4f3f0df6c928ea9f0384ff6bd))
* **roadmaps:** write the sheet answer at each originating blocker ([0322e8d](https://github.com/event4u-app/agent-config/commit/0322e8d58913e2e879037b76be95199960b6af4e))
* **decisions:** answer the consolidated decision sheet — option (a), applied per row ([64623c3](https://github.com/event4u-app/agent-config/commit/64623c3aa756173da0069249bf5b0384cffa387b))
* **roadmap:** close road-to-org-telemetry with an honest outcome ([9264bb7](https://github.com/event4u-app/agent-config/commit/9264bb736954bbd8e6e37653883ceaffe28f4323))
* **roadmaps:** transfer the org-telemetry sink and enablement blockers ([234fffb](https://github.com/event4u-app/agent-config/commit/234fffbb7c578a38e8a695647468845b8cae5c06))
* **roadmap:** close road-to-gate-autonomy against its outcome states ([db91bc6](https://github.com/event4u-app/agent-config/commit/db91bc66bb02df75541e3da86bd5627d315b4451))
* **roadmap:** re-review the value-realization risk register, row by row ([2c9f151](https://github.com/event4u-app/agent-config/commit/2c9f151d677faf219cdb6080eff0167c0f99cd04))
* **roadmap:** close road-to-scale-history-bench-run as transferred ([80aab39](https://github.com/event4u-app/agent-config/commit/80aab392a5f1bfdc87d9870c71f87cf3f4065edc))
* **stubs:** add the scale-history PRIMARY-rating transfer stub ([72ba5e2](https://github.com/event4u-app/agent-config/commit/72ba5e2802d8ee6bfe93937ab3e3ea9d778c70ca))
* **evidence:** record that the scale-history bench harness is runnable ([04e156b](https://github.com/event4u-app/agent-config/commit/04e156b59cae9b1edc3209296b814d7fabe1cd98))
* **roadmap:** state the post-run box tally exactly in the Outcome header ([c415649](https://github.com/event4u-app/agent-config/commit/c4156497b2fb265ff6ded64f252104292dfd70f9))
* **roadmap:** close the standing-context-40k checkpoint honestly ([0c8c35e](https://github.com/event4u-app/agent-config/commit/0c8c35eca1907125f2466f8381461631f5cc4c7c))
* **roadmaps:** close subagent-value-realization-followup, five items transferred ([39fa73b](https://github.com/event4u-app/agent-config/commit/39fa73be2f944dd8639aced796f49f144af1a52c))
* **orchestration:** record the 2026-08-20 evidence pass on the flip verdict ([f6aa459](https://github.com/event4u-app/agent-config/commit/f6aa459e769b25ed66819b1960c161517e134e3b))
* **roadmaps:** close skill-description-measurement as transferred ([2b09ab9](https://github.com/event4u-app/agent-config/commit/2b09ab95f92c0ab3d506cbda2983466805c959f9))
* **roadmaps:** add the shared live-trigger-eval transfer stub ([98bb243](https://github.com/event4u-app/agent-config/commit/98bb24304c4158f06cdd77c1b5198e7cfc1f1361))
* **roadmap:** close road-to-subagent-lifecycle-integrity against outcome states ([102df9a](https://github.com/event4u-app/agent-config/commit/102df9af46575554a75df60c348149add5c289cb))
* **stubs:** transfer the raw subagent payload capture ([8e2b8d5](https://github.com/event4u-app/agent-config/commit/8e2b8d562cd7c4031be5f67ee4b1ef88a1045615))
* **evidence:** publish the subagent-lifecycle drain-close measurements ([9a7aff3](https://github.com/event4u-app/agent-config/commit/9a7aff34afc0eeedc3f6bbf8f9bbc5a7bea0bdc6))
* **roadmap:** give the solution-minimalism transfer a stub to live in ([8172e26](https://github.com/event4u-app/agent-config/commit/8172e2657f51b61f81133533afde933cffbdd46c))
* **scripts:** correct the acceptance-heading claim in the roadmap skeleton ([d50f5fb](https://github.com/event4u-app/agent-config/commit/d50f5fb3a8ccd308bc0a7f1b2fa5ca7012d07a06))
* **roadmap:** record what the local gate run does and does not prove ([7c65017](https://github.com/event4u-app/agent-config/commit/7c650176b3e4e4ac29852c8c0acdd34ba7e11b75))
* **roadmap:** drop the misclassified Phase 3 blocker and author the Risk Register ([113d5db](https://github.com/event4u-app/agent-config/commit/113d5db9bcd4d8efb2356e4ac7f9b87813483986))
* **roadmap:** close council-blind-review honestly — Ü1 landed, Ü2/Ü3 transferred ([c5290e0](https://github.com/event4u-app/agent-config/commit/c5290e036b60bb0256321e9a7c7d0221beb72c5d))
* **stubs:** transfer the council Ü2/Ü3 maintainer blind ratings to a stub ([4e8f859](https://github.com/event4u-app/agent-config/commit/4e8f85978f7a54d1cf52b9866a933ed45d4ef52e))
* **roadmap:** close ui-track-integrity-followup with outcome state abandoned ([7ee6501](https://github.com/event4u-app/agent-config/commit/7ee6501a32e622ed61806a13da474da240de106a))
* **proof:** re-render after the corrected bus-factor claim ([397be27](https://github.com/event4u-app/agent-config/commit/397be27b0ddfaf8e0cf5349674bb0832dde33dff))
* **roadmaps:** close the CI-economy roadmap with transferred outcomes ([195a4da](https://github.com/event4u-app/agent-config/commit/195a4da0e404f34da116fd92baa00a1f96f83d02))
* **roadmaps:** add the main-protection-ruleset repo-admin stub ([420e02a](https://github.com/event4u-app/agent-config/commit/420e02ae3ff6cb208ae25ef9d9ecb7d26c69387f))
* **roadmap:** close out road-to-frontend-skill-application against its evidence ([2ac1773](https://github.com/event4u-app/agent-config/commit/2ac1773d79f94bdcddd917aec368f8d88f370153))
* **evidence:** record the frontend-skill-application closeout finding ([4c038b7](https://github.com/event4u-app/agent-config/commit/4c038b7c4e3b7605fb7dec67a0136061a4a76be0))
* **roadmap:** close road-to-hook-state-followups and tag it lightweight ([54a28d4](https://github.com/event4u-app/agent-config/commit/54a28d4fa781170cbeae00d768140eb7f73e7654))
* **roadmap:** name the decider substitution in the resolved-when field ([d2ec3ae](https://github.com/event4u-app/agent-config/commit/d2ec3aed1ac179a30bd6920fc8226043a759e7fe))
* **roadmap:** close the evidence-lifecycle roadmap on the no-compaction decision ([a134bc6](https://github.com/event4u-app/agent-config/commit/a134bc69ffbee7e180f48b8b1d1d99d6a63006bf))
* **evidence:** re-measure review-binding drift at 1d2f73c40 ([b56cb55](https://github.com/event4u-app/agent-config/commit/b56cb550d9231bcfbcad72f2e4ded08d066a8b3e))
* **roadmap:** close source-first-frontend with outcome state transferred ([eddcbe5](https://github.com/event4u-app/agent-config/commit/eddcbe5256e5d64ac04dc1e08531519e6858a4ec))
* **roadmap:** hand the live AC-extractor miss to the roadmap that owns the decision ([7344038](https://github.com/event4u-app/agent-config/commit/734403879d648c99513d355e6346c71cf6d42c1a))
* **roadmap:** close bus-factor against outcome states, not a percentage ([29ac175](https://github.com/event4u-app/agent-config/commit/29ac175d7e4755d49705b942a7daad73bc208d7e))
* **stubs:** transfer the four bus-factor external actions to a stub ([56f413e](https://github.com/event4u-app/agent-config/commit/56f413e8d07890892b5d9cb341a2a268ec98a22f))
* **roadmap:** park the round-7 push-authorization decision in later/ ([a91c968](https://github.com/event4u-app/agent-config/commit/a91c96869c65c4910b5e83e306edaff09960bb76))
* **roadmap:** record the end-to-end dispatcher evidence for source-first-gate ([5d2b70d](https://github.com/event4u-app/agent-config/commit/5d2b70dcc2175247dfb9e32e964bf914cc2ffcda))
* **evidence:** declare the evidence type on the rules-as-skills null ([f9c1233](https://github.com/event4u-app/agent-config/commit/f9c1233e60bc53fe217a70aa585a2524a510d0ae))
* **roadmap:** close source-first-frontend Phases 3 and 6, record Phase 4 Step 3 cancelled ([d7739db](https://github.com/event4u-app/agent-config/commit/d7739db1320c57c92b896e545e5262984d8b456d))
* **roadmap:** close plan-gates-measurement as data-gated and file the live R1 matcher miss ([99e2288](https://github.com/event4u-app/agent-config/commit/99e2288120835019d2b137f297aff0188424352c))
* **council:** declare the evidence type on both disposition records ([29962e6](https://github.com/event4u-app/agent-config/commit/29962e6bdbc498cc065449cfd8768371775bcd31))
* **roadmap:** disposition the four maintainer-only bus-factor items ([02407a0](https://github.com/event4u-app/agent-config/commit/02407a0c484b6b3d647b5744e6a16a6426cdd238))
* **council:** record the drain-run blocker dispositions for all 44 open blockers ([c7342d1](https://github.com/event4u-app/agent-config/commit/c7342d11c7b3f739ce690eec7801167370ec13dc))
* **roadmap:** hold the round-7 push-authorization decision as an open blocker ([8d5dc9f](https://github.com/event4u-app/agent-config/commit/8d5dc9fa8d8ab5e4e9e42557563832c91b3feb39))
* **roadmap:** close release-review-p0 with outcome state transferred ([e4d1395](https://github.com/event4u-app/agent-config/commit/e4d1395364b01c8b6c521fce764538e2d7bd62cb))
* **roadmap:** re-review the release-review-p0 risk register after the criteria change ([9e99009](https://github.com/event4u-app/agent-config/commit/9e99009dd2beed2b8e2f9ed2633bfbf3212f3fda))
* **roadmap:** close release-review-p0 traceability criteria and correct the Phase 1 blocker ([75df234](https://github.com/event4u-app/agent-config/commit/75df23424386cecca34b5e6600f55f5a174d2bb4))
* **roadmap:** file the six defects that made one session 21 percent correction ([9af68cc](https://github.com/event4u-app/agent-config/commit/9af68cca1b3758ee72bce9f8980367effee7582f))
* **roadmap:** close and archive road-to-single-delivery ([c7add37](https://github.com/event4u-app/agent-config/commit/c7add377d04eed55580d1d61f92b21490f7848d3))
* **roadmap:** take the three decisions in council, and drop every blocker ([b809f1c](https://github.com/event4u-app/agent-config/commit/b809f1c0bf72e63b3ac01359de975b7d2d8d8363))
* **roadmap:** file the residue of fifty sessions as one roadmap ([76099f2](https://github.com/event4u-app/agent-config/commit/76099f23fcf2a68404ebb3230aa53025196199df))
* **roadmap:** track the hook-state follow-ups nobody owned ([efcfc21](https://github.com/event4u-app/agent-config/commit/efcfc216e9ae1dcf7c6ba216256d24392ba28ef5))
* **review:** declare the evidence type and stop pinning a moving scope ([e7c4652](https://github.com/event4u-app/agent-config/commit/e7c465227a8ab21565ef61ef7f28ff78e107d202))
* **review:** record the council verdicts and what is still open ([87e1a65](https://github.com/event4u-app/agent-config/commit/87e1a658f151dd43dc1737be518f6200c0ea5a30))
* **state-io:** record why the tombstone sweep is not the stale-breaker defect ([c9018ae](https://github.com/event4u-app/agent-config/commit/c9018ae944917caeb5dc2ccc5c48aee8a3e7d526))
* **verdict:** record council round 3 and the peer conditions on the link fix ([8079b37](https://github.com/event4u-app/agent-config/commit/8079b37b096547cb30da21208e7e6ef2eeb050ab))
* **claims:** record the ownership check in the claim ledger ([c164c35](https://github.com/event4u-app/agent-config/commit/c164c35f2b98523428d3b0570b34445df882461d))
* **review:** re-bind the findings artefact after the second main merge ([b2803e2](https://github.com/event4u-app/agent-config/commit/b2803e2b16986c3775d776444355a822fe3861a8))
* **review:** re-bind the findings artefact after the main merge ([1d04be5](https://github.com/event4u-app/agent-config/commit/1d04be5e9592c09be5999b180c46c256eced70fb))
* **review:** re-bind after merging the 14.6.0 base ([b22162b](https://github.com/event4u-app/agent-config/commit/b22162b814496812d25ee98b74c55b65858dee67))
* **review:** re-bind after the reference-check fix ([c704fd8](https://github.com/event4u-app/agent-config/commit/c704fd8945753ef7aad83b04d63dd01e8b752827))
* **review:** re-bind after the fixes ([028ad5f](https://github.com/event4u-app/agent-config/commit/028ad5fcbb745f0ebc52391d27fb82dad9889a9f))
* **review:** close the estate-disposition findings against their fixes ([df83ccc](https://github.com/event4u-app/agent-config/commit/df83cccf46d8f927231437892589c53f9871af50))
* **roadmap:** record option (b) at b-payload-mis-nested-readers, split the security half ([3d04312](https://github.com/event4u-app/agent-config/commit/3d04312ea006b0c13c7815d3c8889182cd99e7d1))
* **review:** record the estate-disposition findings before their fixes ([09d6303](https://github.com/event4u-app/agent-config/commit/09d6303f3627c84894fa76efcdf1a6f8f439b852))
* **roadmaps,ratchet:** record the three-phase criterion as contingent, and walk the estate ([222bbdf](https://github.com/event4u-app/agent-config/commit/222bbdfa2d8477d669a2089ca9aef054a42f1222))
* **review:** re-bind the findings artefact to the current scope ([911d8be](https://github.com/event4u-app/agent-config/commit/911d8be494746a7009462e5c8ab528d92d68c05d))
* **review:** record the disposition of all ten R2 findings ([120f2a5](https://github.com/event4u-app/agent-config/commit/120f2a550ca6f0aa3393d820af027f5edfe56291))
* **review:** record the 10 R2 findings before any repair ([69a861d](https://github.com/event4u-app/agent-config/commit/69a861d5daaf73347887908fa2091297303dd2a5))
* **roadmaps:** halt Phase 2 on an undecidable predicate, and record a defect in Phase 3 ([0602d58](https://github.com/event4u-app/agent-config/commit/0602d588c9aaf5d03c964dbf2825c75fef6ecbaf))

### Refactoring

* **skills:** retrofit the four K6 offenders into router heads ([b261289](https://github.com/event4u-app/agent-config/commit/b2612892733f2f9d9e5176eebdacad399356ec1a))
* **projection:** extract the Claude paths plan, and pay the ratchet down ([8660a22](https://github.com/event4u-app/agent-config/commit/8660a22492d53694acbec78c453f63601bc67c1b))

### Tests

* **demand-gate:** decouple the market-path counter-test from the shipped default ([258d697](https://github.com/event4u-app/agent-config/commit/258d697de2b05da4d7c1444ca47bc27ee927473a))
* **hook-role-axis:** pin the pre_tool_use exemption as provenance-independent ([5c12382](https://github.com/event4u-app/agent-config/commit/5c1238205bce92f6078b06589c791160e00a3472))
* **e2e:** build the gitignored artefacts the e2e suites assert on ([f7f54d4](https://github.com/event4u-app/agent-config/commit/f7f54d47087d4bebdfa970d59e7da475cd2c2e11))
* **routing:** pin the four rules as unconditional, not as routed ([b687e8b](https://github.com/event4u-app/agent-config/commit/b687e8b8e9a79fca70695bd2d4da7d3719ddbf14))
* **hook-state:** make the lock and ownership tests able to fail ([80efdfc](https://github.com/event4u-app/agent-config/commit/80efdfcbe1bf8c8187c9878b5749fbb0cb427de9))

### Chores

* block unauth git ([af48425](https://github.com/event4u-app/agent-config/commit/af48425a46e52b79f214475c5fe734f8e5bb78e7))
* merge origin/main and re-measure the ratchets ([9e165b7](https://github.com/event4u-app/agent-config/commit/9e165b7277bcd5e4a1a8057952aa5bdb28686463))
* **roadmap:** regenerate the archive index after the merge ([cdf36e6](https://github.com/event4u-app/agent-config/commit/cdf36e632db49477ce8355bee7161e0866d615a2))
* **roadmap:** archive session-closeout, re-depth its links, walk the estate down ([83e0b89](https://github.com/event4u-app/agent-config/commit/83e0b89854242c8503150173598eeef94cc7d207))
* **roadmap:** archive cost-parity part 1 and walk both ratchets down ([d2a43ac](https://github.com/event4u-app/agent-config/commit/d2a43ac5591a3ac580cbd696c2acffdeed947867))
* **gates:** walk the ci-parity local-only baseline down 166 to 165 ([6bbd065](https://github.com/event4u-app/agent-config/commit/6bbd0650ef3af47360027ff675eb3d90fd6f54e6))
* **estate:** walk the active-roadmap baseline 25 -> 24 ([75c9153](https://github.com/event4u-app/agent-config/commit/75c915310190e90e8c7c10b41b1ac3df2791dd9a))
* **roadmap:** archive the six completed roadmaps the warning never moved ([8b63eaa](https://github.com/event4u-app/agent-config/commit/8b63eaaae62df2c42b2525e8a8fce46fd08ba7af))
* **roadmap:** regenerate the dashboard after the trunk merge ([f648a7d](https://github.com/event4u-app/agent-config/commit/f648a7d2b376ca59e3607e4c7205e26cd1711374))
* **generated:** regenerate the compiled manifest and dist projections ([9aec43a](https://github.com/event4u-app/agent-config/commit/9aec43a6ee683db5a07e8b61d834f12a08af15cf))
* **gates:** walk two ratchets down for the two resolved blockers ([0ad26c8](https://github.com/event4u-app/agent-config/commit/0ad26c8fadcb0c3b9e2587336d9459ad85c5ccb5))
* **roadmaps:** regenerate the progress dashboard ([28b5741](https://github.com/event4u-app/agent-config/commit/28b5741ce18c7b387b9cdd60aa0ab4344c113a11))
* **roadmap:** regenerate the progress dashboard ([86be52f](https://github.com/event4u-app/agent-config/commit/86be52f1fed0a6265de2e821fef8856978c1a321))
* **roadmap:** park the kernel question-triangle amendment in later/ ([442098e](https://github.com/event4u-app/agent-config/commit/442098e5c4bbf644490cc8c1ee3e64d70de2319b))
* **estate:** record the draft-to-parked accounting change in the ratchet ([e66bbc1](https://github.com/event4u-app/agent-config/commit/e66bbc1556c134e2f6b3df664e526a445b2c325a))
* **estate:** walk the open-blockers ratchet down to 68 ([e71665c](https://github.com/event4u-app/agent-config/commit/e71665c56e01a4b3a2ea1206afc86015ebcd9f00))
* **gates:** tighten the blocker-decidability ratchet 20 to 17 ([c2650f6](https://github.com/event4u-app/agent-config/commit/c2650f66e8b7ef925f0ada7a614ae547a70ee9bf))
* **gates:** lower the blocker-decidability baseline 20 to 19 ([0488aea](https://github.com/event4u-app/agent-config/commit/0488aeac19e843c6f504efda0773dd0fa8f46eaf))
* **roadmap:** park plan-gates-measurement in later/ on a falsifiable event trigger ([2da2338](https://github.com/event4u-app/agent-config/commit/2da233888221916cf5e95fe94cab61e0c56c35e2))
* **roadmap:** close and archive road-to-agent-velocity, and place its two prose changes where they fit ([0a01643](https://github.com/event4u-app/agent-config/commit/0a01643beeeafc1af67f48b55c8b6b5234e549b9))
* **estate:** walk the ratchet down 32/74 -> 31/70 for the completed roadmap ([ca8a5ef](https://github.com/event4u-app/agent-config/commit/ca8a5eff92e9a36f10b9941e5890e145f32e43c5))
* **consistency:** re-sync router.json and correct the single-delivery gate text ([a665980](https://github.com/event4u-app/agent-config/commit/a6659808921a3f3bc6da0071bf12f06e2a0bf95c))
* **docs:** the routed-rule count follows the new rule ([2a76c3d](https://github.com/event4u-app/agent-config/commit/2a76c3d7b8188bae0d7d34c0cbb99e2ffb9caa3d))
* **router:** regenerate after the main merge ([1a94145](https://github.com/event4u-app/agent-config/commit/1a941454938d25c7ec5605b4b78fda721a7639a4))
* **census:** re-anchor the activation baseline, and state what it exposes ([5a49aa6](https://github.com/event4u-app/agent-config/commit/5a49aa6a619e14604d4f5167e08af7a61f9e7b09))
* **router:** pick up fix-what-you-see as a tier-2a route ([ded6c20](https://github.com/event4u-app/agent-config/commit/ded6c208fa65f276398ce72814838c310424dc3f))
* **index:** regenerate the catalogs for the new rule ([b360282](https://github.com/event4u-app/agent-config/commit/b360282891b7578feb5ebae37ad9db73e03797d5))
* **budget:** re-baseline the pack cap 7.8 -> 8.4, on the maintainer's decision ([1aa0988](https://github.com/event4u-app/agent-config/commit/1aa09886eb6f1163377cfa1ff264ff3e711651c3))
* **roadmaps:** condense the generator's own comments, the pack budget has 8 KB of headroom ([856dd7b](https://github.com/event4u-app/agent-config/commit/856dd7b4f3c75ec6c85480121185bae085f0e990))
* **roadmaps:** park both autonomous candidates, neither has runnable work ([ca7724c](https://github.com/event4u-app/agent-config/commit/ca7724c9b26dc7a3ab363a2d21346487d565104f))
* **estate:** re-measure the baseline at the merge and record why net-zero is real ([da98a89](https://github.com/event4u-app/agent-config/commit/da98a89f19b9e750a0c14d94844adbabd379bc48))

### Other

* close road-to-session-closeout against explicit outcome states ([3c12e2f](https://github.com/event4u-app/agent-config/commit/3c12e2f4ba709fd650e5a9bc71678cf2de919afe))
* close road-to-ci-native-release-first-run honestly ([a3ab312](https://github.com/event4u-app/agent-config/commit/a3ab3128979a7dfe6c3caf63a297b97b8be49a24))
* **hook-payload-unwrap:** re-bind the R2 artefact after the base merge ([94ffadc](https://github.com/event4u-app/agent-config/commit/94ffadcc12f47f6572b01224997a61e6ad4ab7ab))
* **hook-payload-unwrap:** re-bind the R2 artefact to the pack-cap scope ([f2d8eed](https://github.com/event4u-app/agent-config/commit/f2d8eed3b9978e2720b5a41ece8f6fcfb1b221e5))
* **hook-payload-unwrap:** re-bind the R2 artefact to the post-fix scope, all 6 findings terminal ([29b558e](https://github.com/event4u-app/agent-config/commit/29b558e2194105d6760f791a459d4161e5211603))
* **hook-payload-unwrap:** R2 completion review — 6 findings (3 medium, 3 low) ([606205c](https://github.com/event4u-app/agent-config/commit/606205c5bf250e0da08c7c7b359e502bec743186))

Tests: 15769 (+372 since 14.6.0)

## [14.6.0](https://github.com/event4u-app/agent-config/compare/14.5.0...14.6.0) (2026-08-19)

### Release highlights

- **Behaviour changes:** a blocked decision lock is now re-evaluated by the AI council by default instead of interrupting the owner, and only an owner-reserved transition still reaches a human (cafb8a2). ADR reopen authority became a property of the *transition* rather than of the document, carried by a new `reopen_policy` field (e8543f4). An R2 review of the ADR sweep confirmed five findings and refuted one (6ebae09).
- **Default changes + migration:** _none_
- **Security and correctness:** run-continuation gained `blocked` as a terminal outcome and had four state defects repaired, including state keyed on the roadmap rather than the reader (3245188, 5fd366f, 084b5c3). Gate work closed its own R2 findings with a test that discriminates rather than one that merely passes (4510f6d, 406cb22). The layer-overlap notice moved out of `condense.ts` (2de07e2), and `check_single_delivery` was added — it immediately found a third duplicated artefact type (e666899).
- **Honest nulls:** ADR-234 shipped together with the honest null on pointer liveness (93c30da).
- **Known limitations:** _none_

### Features

* **adr:** sweep the twelve locks that blocked work, and wire two dead gates ([56276c9](https://github.com/event4u-app/agent-config/commit/56276c90c0fd1c5330df806b8d436bcd3c0964f9))
* **adr:** make an amended decision visible — reciprocal links, index columns ([d06c95e](https://github.com/event4u-app/agent-config/commit/d06c95ee304528fd3945e21d766a18e7bab9fbae))
* **adr-layout:** reopen authority — the transition decides, not the document ([e8543f4](https://github.com/event4u-app/agent-config/commit/e8543f4f75bdb3bbaa56eb5bc38efb838da87be2))
* **adr:** add adr_cite_check — evaluate a decision before citing it as a blocker ([1bba5ff](https://github.com/event4u-app/agent-config/commit/1bba5ffb828e269d5cf3a157efbbedac0934ffb2))
* **decision-revisit-gate:** route lock re-evaluation to the council, not the user ([cafb8a2](https://github.com/event4u-app/agent-config/commit/cafb8a2553f1105ef1d90e4f62068fc84f5f07c9))
* **generate-tools:** say what writing the project layer costs ([7fbfe02](https://github.com/event4u-app/agent-config/commit/7fbfe02c38b39149cc2d4c040888e1e7a7ecbd60))
* **gates:** add check_single_delivery, and it finds a third duplicated type ([e666899](https://github.com/event4u-app/agent-config/commit/e6668993f2270a27992d0d51ab6a05d8ddbdd248))
* **install:** make the scope guard report what a same-version duplicate costs ([4db44f1](https://github.com/event4u-app/agent-config/commit/4db44f182ca898da17a73ba48c5a87e13a87a16f))
* **roadmap:** a runnable-work precondition and a blocked terminal outcome ([f14a287](https://github.com/event4u-app/agent-config/commit/f14a28735059ec5ba604a019a6d53ee227e494d0))
* **memory:** stamp the curated store and run the ladder once ([803a392](https://github.com/event4u-app/agent-config/commit/803a3921947e8b41bb0d312756e47a981facdd7c))
* **memory:** three instruments for the curated store — pointers, duplicates, eviction ([4b00f6f](https://github.com/event4u-app/agent-config/commit/4b00f6f62dd68edcf9c293bc7d7ad0dd1f22ee02))

### Bug Fixes

* **adr:** respond to the R2 review — five confirmed, one refuted ([6ebae09](https://github.com/event4u-app/agent-config/commit/6ebae092658839b4d1103ae8536817a704be2c15))
* **hooks:** clear the state on blocked, and stop deleting a legacy file nobody adopted ([5fd366f](https://github.com/event4u-app/agent-config/commit/5fd366f83276e7726d3338ca24cbb7814df17f46))
* **size-budget:** move the overlap notice out of condense.ts entirely ([2de07e2](https://github.com/event4u-app/agent-config/commit/2de07e2fd672e428d173794f0f36f398f125424a))
* **hooks:** give run-continuation the blocked terminal, and repair four state defects ([3245188](https://github.com/event4u-app/agent-config/commit/32451887c0db1df9c22b4cf2841e1ca985e71570))
* **gates:** close the remaining R2 findings, with a test that discriminates ([4510f6d](https://github.com/event4u-app/agent-config/commit/4510f6daee89ae3dcc5344730a3779a0a6bb5d72))
* **gates:** repair the three high R2 findings in this branch's own work ([406cb22](https://github.com/event4u-app/agent-config/commit/406cb22a0a3c512abdfea9e3bfbab6c3b7db50a6))
* **hooks:** key the run state on the roadmap, and stop one absence from reclaiming a budget ([084b5c3](https://github.com/event4u-app/agent-config/commit/084b5c3002f45e43f21b34912e1abaac87dc97bc))
* **hooks,register:** close all seven round-6 findings ([61e6910](https://github.com/event4u-app/agent-config/commit/61e69100f9dc564f301454e7368b5506c3e2d457))
* **hooks,register:** close all eleven round-5 findings ([544f0fb](https://github.com/event4u-app/agent-config/commit/544f0fba55b3580a54234ccd0f8dd2592cdfead1))
* **memory:** drop the retired-path literal from the pointer-report docstring ([ac2b338](https://github.com/event4u-app/agent-config/commit/ac2b33869eef14bfce2d73900984261e1a8c560f))
* **hooks,register:** stop the fallback from masking an archival, and name the file read ([a01b5a0](https://github.com/event4u-app/agent-config/commit/a01b5a0bcb2761b953871c57fc728e4fe027f4d3))
* **hooks,register:** resolve the run against the session tree, and walk up to it ([5fa347a](https://github.com/event4u-app/agent-config/commit/5fa347a5ae9496eb0b4876ffd0e93361f03048ef))
* **memory:** strip a raw NUL byte from the pointer report and unbreak two cf04 citations ([dd2f09e](https://github.com/event4u-app/agent-config/commit/dd2f09e4eefeca54c0ce22671b526bfe81f006ef))
* **hooks:** close the five round-3 findings that are not the two-tree decision ([2c73756](https://github.com/event4u-app/agent-config/commit/2c73756b04fcf3003630fb38a66022567e163c79))
* **memory:** satisfy noUncheckedIndexedAccess in the three new scripts and their tests ([d6f9cc7](https://github.com/event4u-app/agent-config/commit/d6f9cc715d55ebbab2ebc09762c7136d1e4def78))
* **hooks:** make a degraded session-root resolution readable, and correct the discriminator prose ([7db8896](https://github.com/event4u-app/agent-config/commit/7db889696374c2c9f8d001d5b905d262f1e6cecf))
* **capsule,roadmaps:** answer the R2 findings ([cda1a53](https://github.com/event4u-app/agent-config/commit/cda1a53cb9e30a547d2beeadeafbc198649a6914))
* **roadmap:** reopen the acceptance criterion its own text asked to reopen ([4822ff6](https://github.com/event4u-app/agent-config/commit/4822ff6a6c8ba89253ca108e6a9809f1daf1eb3a))
* **hooks:** derive the two-tree provenance from the session tree, not the reader ([19001b7](https://github.com/event4u-app/agent-config/commit/19001b759a4762c5520d68e588cd5c3b133bb7eb))
* **capsule:** enforce the path-ref shape do_not_touch already claimed ([2ca6fc6](https://github.com/event4u-app/agent-config/commit/2ca6fc66640b999546097aa003ad779f94f55885))

### Documentation

* **review:** re-bind round 9 after the base merge ([f17a613](https://github.com/event4u-app/agent-config/commit/f17a6130db8f898b6ed710534945ea340d65d0c7))
* **review:** close round 9's seven findings against their fixes ([6b8d007](https://github.com/event4u-app/agent-config/commit/6b8d0071587069c64fe15a9fafd44139b8455314))
* **ratchet:** reconcile the open_blockers row instead of asserting it ([11c5aef](https://github.com/event4u-app/agent-config/commit/11c5aeffadeb8dd12a94ccf644593bbbea432972))
* **review:** record round 9 findings before their fixes ([243c547](https://github.com/event4u-app/agent-config/commit/243c547aafb61dc36a174d5010c16d7112c35214))
* **review:** re-bind after the size-budget repair ([110d7a6](https://github.com/event4u-app/agent-config/commit/110d7a6eb873049f7e166ade3784ba72c6fc8ff6))
* **review:** close round 8's eight findings against their fixes ([08fd977](https://github.com/event4u-app/agent-config/commit/08fd977d849f1b1b4a3d6bb864dc33fd1468a3b4))
* **roadmap:** couple the two blockedness predicates, and stop quoting a count that keeps going stale ([bf72169](https://github.com/event4u-app/agent-config/commit/bf72169cef2bc14257d09afd8da8fdfa8e3a2edf))
* **review:** re-bind after the evidence-type declaration ([6ec2095](https://github.com/event4u-app/agent-config/commit/6ec209555495e77037e43cffb18da2964c5151b8))
* **evidence:** declare the census's evidence type ([7f3fd03](https://github.com/event4u-app/agent-config/commit/7f3fd034f383c726f63e8b6db4772bf9f9a1c7f1))
* **review:** re-bind after the base merge and ADR renumber ([ef2b3c1](https://github.com/event4u-app/agent-config/commit/ef2b3c122eafeeaccadaef92c76f36679d366d57))
* **review:** re-bind the findings artefact to the current scope ([f9b7be6](https://github.com/event4u-app/agent-config/commit/f9b7be68244566555fa5c52562cd8201f63e2a18))
* **review:** record round 8 findings before their fixes ([00ea023](https://github.com/event4u-app/agent-config/commit/00ea0239a99feedf87a021710d32e203cb29fc2f))
* **review:** fill the 17 R2 findings with their dispositions ([f28ffeb](https://github.com/event4u-app/agent-config/commit/f28ffebf23d70a18d91b4d949a164a90d916ccc4))
* **roadmaps:** correct the backwards CI claim and close four satisfied criteria ([d52c41e](https://github.com/event4u-app/agent-config/commit/d52c41e9c0c90170fbeb2c3b25227b6634a904f5))
* **review:** record the 17 R2 findings before any repair ([7ca43da](https://github.com/event4u-app/agent-config/commit/7ca43da318805898824dfd8cc44075df9a0f3111))
* **roadmaps:** halt single-delivery Phase 2 on an unstated precondition ([60671af](https://github.com/event4u-app/agent-config/commit/60671af4ddf3d9f3d05c67d83730f0bbe53f1faf))
* **adr:** supersede ADR-226 with ADR-235 one-artefact-one-layer ([b96115b](https://github.com/event4u-app/agent-config/commit/b96115bb96d278841b002258997d02de50eb3791))
* **evidence:** pin the single-delivery census with its projection shape ([4cfe282](https://github.com/event4u-app/agent-config/commit/4cfe282623da421facb2a2184cf76920a3d00bb4))
* **roadmaps:** adopt road-to-single-delivery from a four-draft inbox reconciliation ([6c743c1](https://github.com/event4u-app/agent-config/commit/6c743c181498ac4e1fac403ea11e9baf62c689f1))
* **adr:** record the blocked terminal outcome for process-full ([a0bc6af](https://github.com/event4u-app/agent-config/commit/a0bc6af62f9ab0dd7723e26e0860b477e75dba2d))
* **roadmap:** record the second partial on 0.1 and refute its blocker premise ([1ac0cf0](https://github.com/event4u-app/agent-config/commit/1ac0cf061d4434607862a63176510cb2d5016fbc))
* **roadmap:** re-review the risk register after the Phase 2 close ([8ecc398](https://github.com/event4u-app/agent-config/commit/8ecc3982001e9773dcb41f73b1e7612633331eba))
* **roadmap:** close Phase 2 of road-to-context-fidelity ([cf5505d](https://github.com/event4u-app/agent-config/commit/cf5505db4e72495e4f8276d20ae83908e564738c))
* **memory:** ADR-234 plus the honest null on pointer liveness ([93c30da](https://github.com/event4u-app/agent-config/commit/93c30dab88a7bef4f70d414899fa3b383f61307b))
* **roadmap:** record the live event that refuted the provenance fields ([03360b2](https://github.com/event4u-app/agent-config/commit/03360b28c7dfb66f2d820dcc5bd35716b8c730be))
* **review:** unwrap the verification table the findings parser reads as rows ([244ba2c](https://github.com/event4u-app/agent-config/commit/244ba2c3257f3f39fda533667246a7843b9906ef))
* **review:** declare the completion-review skip for a no-code-surface change ([a306f7e](https://github.com/event4u-app/agent-config/commit/a306f7e2a45091d8de709accff1e8e9888bfbe3f))
* **roadmaps:** regenerate the dashboard for the resumed roadmap ([9fb938a](https://github.com/event4u-app/agent-config/commit/9fb938a9b100f57b74ef5a6556e53827888c6be9))
* **roadmaps:** resume request-scoped-rule-load out of later/ on a satisfied condition ([abab942](https://github.com/event4u-app/agent-config/commit/abab94288b3d6e981ed471e967a9207b6a5ed2df))

### Chores

* **router:** regenerate router.json for the new decision-revisit-gate triggers ([6e05281](https://github.com/event4u-app/agent-config/commit/6e05281b1eada88d00d3e749e0295d399760ce92))
* **roadmaps:** archive road-to-adr-revisit-governance, fully closed ([9e0a331](https://github.com/event4u-app/agent-config/commit/9e0a331e19402e92b4ee3d6b944a1db0aa7aa8ac))
* **roadmap:** park run-continuation-observation, its open work is gated on a run the estate cannot supply ([42e8c05](https://github.com/event4u-app/agent-config/commit/42e8c056aceb9953e45d6e572e8d28f43f0a8a6c))
* **regen:** regenerate derived outputs after the base merge and ADR renumber ([c69068e](https://github.com/event4u-app/agent-config/commit/c69068ed1d4a89edafb8553a5ec135a0bb2cbdd1))
* **review:** close round 7 — 55 findings over seven rounds, six of seven highs in the previous round ([c1bb91d](https://github.com/event4u-app/agent-config/commit/c1bb91d8587bda81051251ad1329b6cf72e9e6e6))
* **roadmaps:** regenerate the dashboard after the second base merge ([5586c26](https://github.com/event4u-app/agent-config/commit/5586c26124e488badc93e0db856ad54f08753c32))
* **review:** record round 7 findings before their fixes — two high, both in round 6 ([1d420fe](https://github.com/event4u-app/agent-config/commit/1d420fe9f9c6c85b80c79d74de6709ea0f025196))
* **review:** archive round 6 and bind round 7 on the maintainer call ([c97dcfd](https://github.com/event4u-app/agent-config/commit/c97dcfd37c7b40bb8cfb025b7f12bccd46c090cf))
* **review:** close round 6 and state where the loop stopped ([4f49346](https://github.com/event4u-app/agent-config/commit/4f493467a502614abc001ccec8d10abbc2a0a3f2))
* **review:** record round 6 findings before their fixes ([3ef7320](https://github.com/event4u-app/agent-config/commit/3ef7320699e45932a64ce89827c0e0af8f516897))
* **review:** archive round 5 and bind round 6 ([d320319](https://github.com/event4u-app/agent-config/commit/d320319f4e21f5969d461bb99a7d583a056a5e17))
* **ratchet:** walk open_blockers 71 -> 70 after resolving memory-sweep-instrument ([7d5114d](https://github.com/event4u-app/agent-config/commit/7d5114dbd4ef3340e992717921eb6b919165136a))
* **review:** record round 5 findings before their fixes — eleven, two high ([cc62940](https://github.com/event4u-app/agent-config/commit/cc62940004d811c5927381de00fef6aced7d3ded))
* **review:** archive round 4 and bind round 5 to the fixed head ([578d021](https://github.com/event4u-app/agent-config/commit/578d02189621c62f304eb5780068d2ff22cf32ba))
* **roadmap:** regenerate the dashboard after merging origin/main ([b7b0838](https://github.com/event4u-app/agent-config/commit/b7b0838c8cd57e633226f58760e8e57d09269ffe))
* **review:** record round 4 findings before their fixes ([31e5895](https://github.com/event4u-app/agent-config/commit/31e58953462127e5d07f8fef6819a6ad7717a8ee))
* **roadmaps:** regenerate the dashboard after merging the un-park ([58ddc41](https://github.com/event4u-app/agent-config/commit/58ddc415b9d7f8e07814926fb1fce90e2a7728c5))
* **review:** archive round 3 and bind round 4 to the fixed head ([ccac473](https://github.com/event4u-app/agent-config/commit/ccac4736a8fa25cf74a7cd7518fd32ff2407849a))
* **estate:** walk the ratchet down to the estate this closure earned ([c2d744c](https://github.com/event4u-app/agent-config/commit/c2d744cd50097ad31d320b1513553a032b15eb60))
* **review:** record round 3 findings before their fixes — two highs ([14b9ddd](https://github.com/event4u-app/agent-config/commit/14b9ddd7dd4f82336d1d29db0d713f4c41bd2d46))
* **review:** archive round 2 and re-bind the live artefact to the fixed head ([03dc008](https://github.com/event4u-app/agent-config/commit/03dc0080b13d5da2f1448150f73fe6ad0b3f3605))
* **review:** record round 2 findings before their fixes ([45426cc](https://github.com/event4u-app/agent-config/commit/45426cc59ad5fea501313afcfa5ceb98f6a58651))
* **review:** close the nine findings and re-type the artefact as historical ([b7ecf02](https://github.com/event4u-app/agent-config/commit/b7ecf0207a049570f62cf24ab12247878cda31a6))
* **review:** bind the R2 review scope for this branch before the reviewer runs ([34dcdab](https://github.com/event4u-app/agent-config/commit/34dcdab73dae97539882bb78fa9c057045af1b51))
* **roadmaps:** re-review the lifecycle-integrity risk register for the relocated step ([0bc79b0](https://github.com/event4u-app/agent-config/commit/0bc79b09bae0c025ea54920616c195667e0c76a2))
* **ratchet:** record the un-park in the estate baseline ([4254a87](https://github.com/event4u-app/agent-config/commit/4254a87628912fcc8439e714c204d7281f0cfd41))
* **roadmaps:** regenerate the dashboard after merging origin/main ([411bb74](https://github.com/event4u-app/agent-config/commit/411bb74164e1bc70f43b7fc4c651ade784e91394))
* **roadmaps:** archive dispatch-safety, its last step closed ([5b25cbe](https://github.com/event4u-app/agent-config/commit/5b25cbee9ebfe4eb00ea76c3290db03fdfe598a0))
* **review:** record the R2 findings before their fixes ([da6f4a7](https://github.com/event4u-app/agent-config/commit/da6f4a70eb965f1fdc287daa91e20bef84666c88))
* **roadmaps:** close dispatch-safety 3.4 and relocate the guard intact ([4ca5ebd](https://github.com/event4u-app/agent-config/commit/4ca5ebd66bdec0d08531dfc073dcff4039bd84cf))

### Other

* **adr-revisit-governance:** re-bind to the router-regen scope ([7c248f2](https://github.com/event4u-app/agent-config/commit/7c248f2e975fea9e1be836edcc8cd8916aa5a116))
* **adr-revisit-governance:** re-bind after the base merge, commit the input package ([921df0c](https://github.com/event4u-app/agent-config/commit/921df0c03291accccb458e941224ee67f3a1007a))
* **adr-revisit-governance:** re-bind the R2 artefact to the post-fix scope ([330ece6](https://github.com/event4u-app/agent-config/commit/330ece6332c861d4a2152f2d50ff5fe53b44a453))
* **adr-revisit-governance:** R2 completion-review findings, before any fix ([3389935](https://github.com/event4u-app/agent-config/commit/3389935977f182961f32ddb9f90e89eaf8d4db04))
* **dispatch-safety-do-not-touch:** re-bind all three anchors after the second merge ([91653ad](https://github.com/event4u-app/agent-config/commit/91653ad11107eaa7572943a53b3d0e9532fe222c))
* **dispatch-safety-do-not-touch:** carry the roadmap hash through the re-bind too ([43ed4d7](https://github.com/event4u-app/agent-config/commit/43ed4d76aab920f3dbc23dc6fdcba06e6594fb48))
* **dispatch-safety-do-not-touch:** re-bind after merging the un-park ([2528af7](https://github.com/event4u-app/agent-config/commit/2528af7356264a53b08303eb8f857cd589acdc30))
* **dispatch-safety-do-not-touch:** re-bind after the ratchet walk-down ([ed2caa5](https://github.com/event4u-app/agent-config/commit/ed2caa5f2e75446a241dc7fd14f58d725262977a))
* **dispatch-safety-do-not-touch:** dispose the findings and re-bind ([c87d86c](https://github.com/event4u-app/agent-config/commit/c87d86cea2cad02fa38589c74d1bf0b8962642bf))
* **dispatch-safety-do-not-touch:** the R2 findings, before any fix ([ac03a25](https://github.com/event4u-app/agent-config/commit/ac03a257c4b5cdcd64f742d5d637f0ec9e4ba105))

Tests: 15397 (+125 since 14.5.0)

## [14.5.0](https://github.com/event4u-app/agent-config/compare/14.4.0...14.5.0) (2026-08-19)

### Release highlights

- **Behaviour changes:** _none_
- **Default changes + migration:** _none_
- **Security and correctness:** seven R2 findings on the hook-hardening branch were closed (1b787fe), and the injection ceiling now charges only the bytes the host actually receives rather than everything the concern produced (7f65655).
- **Honest nulls:** no null was recorded in this span. The commit the generator matched here (c45093d) binds the R2 review scope *before* the reviewer runs, which is review hygiene rather than a null result — stated rather than left as `_none_`, because the derived category was populated and a bare `_none_` would contradict it.
- **Known limitations:** _none_

### Features

* **hooks:** carry the two-tree provenance on every run-continuation event ([fcc3272](https://github.com/event4u-app/agent-config/commit/fcc32722c7566532e01ca1ebbb05eb219959e2e3))
* **register:** resolve a claim to its slug AND the file it came from ([e882235](https://github.com/event4u-app/agent-config/commit/e8822358d16ed74567ada8369398e27de745fa42))

### Bug Fixes

* **hooks:** close the seven R2 findings on the hardening branch ([1b787fe](https://github.com/event4u-app/agent-config/commit/1b787fea177c151362fd2af8ec163b0a8dd182b4))
* **hooks:** charge the injection ceiling only for bytes the host receives ([7f65655](https://github.com/event4u-app/agent-config/commit/7f656558c9beb91353a0cb2031ef99023f2d5641))

### Documentation

* **roadmap:** record the first run-continuation engagement outside a test ([d9e040b](https://github.com/event4u-app/agent-config/commit/d9e040bd2bc6199363b367aa784a42a8cbbcccc6))
* **review:** re-bind the hardening findings after the fixes and the base merge ([5507a19](https://github.com/event4u-app/agent-config/commit/5507a19e15d869db9dabe56e346d7fd400c6937e))
* **review:** mark the seven hardening findings fixed at 1b787fea1 ([1c031f0](https://github.com/event4u-app/agent-config/commit/1c031f0a3f51c7a9adbad19fb79dffdebb0212ce))
* **review:** record the R2 review of the hardening branch ([363a1ef](https://github.com/event4u-app/agent-config/commit/363a1ef4f38821266d1fc37f62c1188d660d50f2))

### Chores

* **estate:** raise the open-blocker baseline by one, with the reason ([7762ca5](https://github.com/event4u-app/agent-config/commit/7762ca5592f61e42090d5f53e86794e750b1290d))
* **review:** bind the R2 review scope before the reviewer runs ([c45093d](https://github.com/event4u-app/agent-config/commit/c45093d8c5549183447ef2313f31968ebb129400))

Tests: 15272 (+18 since 14.4.0)

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
