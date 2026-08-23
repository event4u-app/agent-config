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

# Era: pre-14.8.0 — archived

> All entries before `14.8.0` live in
> [`docs/archive/CHANGELOG-pre-14.8.0.md`](docs/archive/CHANGELOG-pre-14.8.0.md).
> The archive is read-only; git tags remain the canonical
> source for what shipped. Splitting them out of the main file
> keeps the active era under the 250-line drift cap enforced by
> `tests/test_changelog_eras.py`.

# Era: pre-14.9.0 — archived

> All entries before `14.9.0` live in
> [`docs/archive/CHANGELOG-pre-14.9.0.md`](docs/archive/CHANGELOG-pre-14.9.0.md).
> The archive is read-only; git tags remain the canonical
> source for what shipped. Splitting them out of the main file
> keeps the active era under the 250-line drift cap enforced by
> `tests/test_changelog_eras.py`.

# Era: 14.9.x — current

> Started at `14.9.0`. Full entries live inline below.
> The drift test caps this era at 250 lines of entry body; growth past
> that forces a new era split (`# Era: 14.10.x`, etc.) — see
> [`docs/contracts/CHANGELOG-conventions.md § Era splits`](docs/contracts/CHANGELOG-conventions.md).

## [14.9.0](https://github.com/event4u-app/agent-config/compare/14.8.0...14.9.0) (2026-08-23)

### Release highlights

<!-- Curated head: fill before merge, keep it under 10 lines, and leave `_none_` where it is genuinely the answer. The generated log below is unchanged. -->
- **Behaviour changes:** _auto-derived, rewrite before merge:_ rule/schema diffs, breaking commits or removed public surface in 8ecb988, 6840a13, 480b635.
- **Default changes + migration:** _auto-derived, rewrite before merge:_ commits naming a default, migration or migrate in 6af4d14, 9216bcc.
- **Security and correctness:** _auto-derived, rewrite before merge:_ security-scoped commits or fixes to executable surface in 6e65f1e, a082710, 3a118b1, 6840a13, dfeb0fc, 93a0af6 +9 more.
- **Honest nulls:** _auto-derived, rewrite before merge:_ commits recording a null, waived or falsified result in d6b6bb9, 23e37ec, fecd633, fda347e, fb2cdc2, 67dc2e3.
- **Known limitations:** _none_

### Features

* **envelope:** a test_authorship field where absence resolves to unknown ([c91c01f](https://github.com/event4u-app/agent-config/commit/c91c01f1e42cae53679a2f5bfdd2fe4f73837736))
* **hooks:** wire the measured encoding layer into the injection scanner ([fc0912d](https://github.com/event4u-app/agent-config/commit/fc0912d605e2d39b9099b1a38f9253240ac17a75))
* **gates:** make files[] and .npmignore drift a diff a reviewer reads ([0d7daf1](https://github.com/event4u-app/agent-config/commit/0d7daf1a2534922683ad4f753289c048489ec05a))
* **gates:** make the publish boundary visible — content classes and a pack-payload secret scope ([2f0141d](https://github.com/event4u-app/agent-config/commit/2f0141dea5e004c6659e7ed89b04513992a14257))
* **estate:** measure the ratchet floor at the base ref, drop the stored baseline ([aab7971](https://github.com/event4u-app/agent-config/commit/aab797116ef8239f25adfdb66d6f72c6dbc75e72))
* **council:** an offline gate for model-pin staleness ([845e620](https://github.com/event4u-app/agent-config/commit/845e62067e272718f380d06c3c984cdee0da7ae4))
* **ci:** pin every action to a commit SHA, drop the ambient credentials ([aa59af9](https://github.com/event4u-app/agent-config/commit/aa59af97fde313017dfb939be0a913997258acf2))
* **review:** one structural telemetry line per review, and an honest report ([bc18d7f](https://github.com/event4u-app/agent-config/commit/bc18d7f8e8b945b9b85b7f97c0a69715411550bc))
* **synthesis:** give spec findings their own dimension, off the severity axis ([3c2082e](https://github.com/event4u-app/agent-config/commit/3c2082e59aef01b9d78c0da61067b79b66a6b086))
* **review:** add a spec-compliance judge to the default review path ([6af4d14](https://github.com/event4u-app/agent-config/commit/6af4d14ec11f23a4597b794585dfa3d8fefad165))
* **gates:** requirement-to-acceptance-to-evidence inventory, exit 0 always ([a02bb8b](https://github.com/event4u-app/agent-config/commit/a02bb8bf6c0997bb39c8e5c18bbadc2baa991e8c))
* **envelope:** deliver the pointer on the dominant path, publish the rate ([69bf665](https://github.com/event4u-app/agent-config/commit/69bf665a1c19b51cf0be1acbf4f75720da4f33d1))
* **pack:** strip compiled test artefacts and check payload content classes ([af5c429](https://github.com/event4u-app/agent-config/commit/af5c429107bf489cb591d6f6f6585195a63d3121))
* **humanizer:** context-aware carrier-Unicode strip for output prose ([8d3d773](https://github.com/event4u-app/agent-config/commit/8d3d773ffa210b62fcca4452d07e1888a1da1a9b))
* **gates:** report which gates have no negative control, with the reason ([be7ce75](https://github.com/event4u-app/agent-config/commit/be7ce7534b25602986f34893f6c23c4baae024a5))
* **supervise:** tell a quota-parked run apart from a dead one ([77d3da3](https://github.com/event4u-app/agent-config/commit/77d3da39a3e640bcc0a443bf7f12c445a1d66c4d))
* **gates:** route and date every candidate row in an ADR evidence sweep ([3343dd4](https://github.com/event4u-app/agent-config/commit/3343dd44358864f03c542ef28f16317d9eefd262))
* **adr:** surface provenance and evidence in the index and area READMEs ([2c30b87](https://github.com/event4u-app/agent-config/commit/2c30b87af7c5c0071c1f79e71999e66ff4055ff8))
* **council:** run-scoped billing grant, answered once per run ([7d19880](https://github.com/event4u-app/agent-config/commit/7d19880fcd165f07a25bb38f53cb7b89859ddb43))
* **council:** api_on_quota gains an 'ask' posture that parks the seat ([fe38597](https://github.com/event4u-app/agent-config/commit/fe3859737565aff53a02b6f073770c67531c351a))
* **subagent-ledger:** split fail into near-miss and foreign object ([f700755](https://github.com/event4u-app/agent-config/commit/f7007558858ea15417faed41d9c6525a68280776))
* **roadmaps:** three roadmaps from the second inbox drain ([67dc2e3](https://github.com/event4u-app/agent-config/commit/67dc2e3e772c436181bf7fa2817f0ba12d1f5ed8))
* **roadmaps:** fold four verified findings into the artefacts that own them ([ac839ff](https://github.com/event4u-app/agent-config/commit/ac839ff5c84569606b03e0588818a36bf5ad8a86))
* **gates:** refuse a reintroduced stub-inventory table in CI ([053142f](https://github.com/event4u-app/agent-config/commit/053142f2158142ee7ec685d2c7dcb06f633f2cba))

### Bug Fixes

* **deps:** bump the npm-production group with 2 updates ([a4970a3](https://github.com/event4u-app/agent-config/commit/a4970a37a9ff669f3d80bd31e84d106e231eb3c6))
* **git-auth:** split the merge op, and stop a negation from authorizing a merge ([6e65f1e](https://github.com/event4u-app/agent-config/commit/6e65f1e502bc986e0aa09c00ce4396d7916b8a9d))
* **claims:** bind the injection-scan corpus rates instead of dropping the numbers ([a082710](https://github.com/event4u-app/agent-config/commit/a0827106812c196a0aefb409e97fb8efee3c67c8))
* **rules:** split the injection-detector note, then raise the stub ceiling +89 ([8ecb988](https://github.com/event4u-app/agent-config/commit/8ecb9883e97216c4387a4c8776db36c754e81f20))
* **evals:** allow the `_why` annotation the new scenarios carry ([480b635](https://github.com/event4u-app/agent-config/commit/480b63500f80713f5276b1b984ec4d08e38c6813))
* **gates:** an un-extractable census root is not a gate that read nothing ([dfeb0fc](https://github.com/event4u-app/agent-config/commit/dfeb0fc2940d8c7d68e9e9747d6f6a8e9c3c2319))
* **gates:** close the four gate defects #1548's own additions opened ([93a0af6](https://github.com/event4u-app/agent-config/commit/93a0af61ea5303e5df69b86ad17c93ee821eb54a))
* **gate-coverage:** state check_requirements_trace's canary gap, verified ([1072c9c](https://github.com/event4u-app/agent-config/commit/1072c9cf88bf49bfc1e11cb31a86ca9ee268e535))
* **gate-coverage:** give lint_adr_sweep_routing a real canary, not a false gap ([58483e7](https://github.com/event4u-app/agent-config/commit/58483e7fe08f1b91ac6dafd56a144e4348dba858))
* **council:** refresh the stale model pins, and let the config notice its own age ([fecd633](https://github.com/event4u-app/agent-config/commit/fecd6337de4716728c29c5bef6828b58a1f853e1))
* **lint:** drop the now-dangling FIRST_PARTY_OWNERS export ([bd6dcd4](https://github.com/event4u-app/agent-config/commit/bd6dcd433ef708eb5797ee0d81b8d0626e4e45c0))
* **gates:** declare why lint_adr_sweep_routing has no canary recipe ([3b0a249](https://github.com/event4u-app/agent-config/commit/3b0a24900f9302c0bffd8f7062092746f16b67cd))
* **humanizer:** consumer-safe paths in step 5b and the Do NOT entry ([041c4cb](https://github.com/event4u-app/agent-config/commit/041c4cbe9d3aa4edef8bd75e3f44dd0481f10ced))
* **evidence:** refresh the ADR evidence census after the ADR-122/124 edits ([fee9204](https://github.com/event4u-app/agent-config/commit/fee92045b082d8b5f46da425fcca83ec9677f5da))
* **tests:** retry the fixture-repo removal that ENOTEMPTY'd on three PRs ([049b31c](https://github.com/event4u-app/agent-config/commit/049b31c1a7be64f032e78f795c9aad39aa1993b8))
* **humanizer:** write carriers as escapes, not literal invisible characters ([53213ff](https://github.com/event4u-app/agent-config/commit/53213ffc304a711ed7bfa182eae937c7d0325c48))
* **code-graph:** honour the dispatcher's root instead of the module's own tree ([e4e0d49](https://github.com/event4u-app/agent-config/commit/e4e0d495a1af71d514dbfda4a4cc9d4026da7328))
* **code-graph:** extract TS bindings and class properties that hold functions ([f3c2ce8](https://github.com/event4u-app/agent-config/commit/f3c2ce814e92d93b0a360096ce4cdd0320cfb475))
* **tests:** match pointer LINES, not every backticked path in the prose ([7f50f56](https://github.com/event4u-app/agent-config/commit/7f50f5677502a0816e9e81d52737aa33f7a912d0))
* **adr:** regenerate the index after the ADR-208 decision-slug change ([0e603f9](https://github.com/event4u-app/agent-config/commit/0e603f900ac7435890463829f6e273c0414b0f01))
* **test:** build the resume plan against the real ResumeTarget shape ([fa282ef](https://github.com/event4u-app/agent-config/commit/fa282effbfb56a26cd26e0e83b6bedbd7a22e016))
* **tests:** Violation carries no line field — assert on the message instead ([edb32a6](https://github.com/event4u-app/agent-config/commit/edb32a6bd665da18fc5c0ee9fb2bd9debc38c792))
* **evidence:** declare the reopen-condition record as `analysis` ([c512dde](https://github.com/event4u-app/agent-config/commit/c512ddec12d636849ef49a8d6f132bdc98eb5439))
* **adr:** replace six permanence claims with the reopen conditions they carry ([8eef980](https://github.com/event4u-app/agent-config/commit/8eef9807b332c331e2a5367d5f8a2085895b496f))
* **evidence:** declare the evidence type on the lifecycle close-out record ([122bc41](https://github.com/event4u-app/agent-config/commit/122bc418dbc7dfbc4a92a2ca3e233fe387357c24))
* **evidence:** declare the analysis artifact type ([13bc0f6](https://github.com/event4u-app/agent-config/commit/13bc0f6981643e5733b73e25eddbcbfafd871e01))
* **estate:** the twenty-first flip, three real exemptions, and the measured baseline ([65c7c78](https://github.com/event4u-app/agent-config/commit/65c7c78c9644a5d99e03701a7ac2717b6f4d81f8))
* **roadmaps:** correct three falsifiable claims in yesterday's drain output ([9035d78](https://github.com/event4u-app/agent-config/commit/9035d78b33920f28095fddaac0127b79f97b2e05))
* **roadmaps:** mark eight unresolvable references as declared exemptions ([64baf40](https://github.com/event4u-app/agent-config/commit/64baf40803df60c305a218e5eea57dcc9b5c4682))

### Documentation

* **roadmap-writing:** a carve-out for recording a merge the user directed ([ad61e1c](https://github.com/event4u-app/agent-config/commit/ad61e1c65a3153a2b6d18e34e9b7881af550e395))
* **evidence:** the mutation census, an unmeasurable claim, and an empty window ([e080f48](https://github.com/event4u-app/agent-config/commit/e080f4836e0c03ef935546380b6f52dfbbda1d84))
* **evidence:** pre-register both thresholds before measuring anything ([2f63c73](https://github.com/event4u-app/agent-config/commit/2f63c73770ed8c23263fec9cf1317c13e6595ea0))
* **roadmap:** inline the council question instead of linking a pruned path ([19eb53f](https://github.com/event4u-app/agent-config/commit/19eb53fd3b952b61a0b51417dc53420875431119))
* **evidence:** number the widened injection detector, and park Phase 3 ([71f35ed](https://github.com/event4u-app/agent-config/commit/71f35ed0f86e7a09d351a97b772c394b4e7a35ef))
* **security:** say what the tree does about injection, in four states ([6840a13](https://github.com/event4u-app/agent-config/commit/6840a13f0239543a50875cd43382e84131a8c3cc))
* **adr:** ADR-243 - the estate floor is measured at the base ref, not stored ([95627eb](https://github.com/event4u-app/agent-config/commit/95627eb3a1ec2dc50b60f063cc61c7b4e2000239))
* **evidence:** the skip census, the mutation null, and a decision made alone ([b622b38](https://github.com/event4u-app/agent-config/commit/b622b38ff3de7b3da452b8aa70f355edff816178))
* **contract:** migrate § 2c mechanics out, under the depth ceiling ([9216bcc](https://github.com/event4u-app/agent-config/commit/9216bcc722df200257dd382adb51b75aa82227e4))
* **host-capability:** re-cite the claude row, record seven silences ([363df53](https://github.com/event4u-app/agent-config/commit/363df5349e076ac8a0a1c9842f15d3bf48836d8a))
* **contract:** an observation protocol for host-capability rows ([d422882](https://github.com/event4u-app/agent-config/commit/d42288246d61654ca9408447d09126445a7b117c))
* **roadmap:** close road-to-requirements-traceability-minimal ([cd0d7a4](https://github.com/event4u-app/agent-config/commit/cd0d7a436bfde40b9c29b418192de3a1980422f0))
* **contract:** § 2c traceability — a repeated trace ROW, optional everywhere ([ee439f5](https://github.com/event4u-app/agent-config/commit/ee439f55aaa64123d300747ab06ebfaa594b8497))
* **roadmap:** close road-to-subagent-envelope-adoption ([87e0027](https://github.com/event4u-app/agent-config/commit/87e002779ecaeeb5d987fcc06efaef0a719270e2))
* **contract:** reconcile the three-way envelope divergence into one shape ([c36042f](https://github.com/event4u-app/agent-config/commit/c36042fc774d21fc25cbbe645facac2dc81c7409))
* **roadmap:** record the publish-boundary Phase 1 landing and both blockers ([614b3e5](https://github.com/event4u-app/agent-config/commit/614b3e56cd1adf8c9661ebc1aa0497483f21b000))
* **roadmap:** close road-to-code-graph-extractor-defect as an honest null ([fda347e](https://github.com/event4u-app/agent-config/commit/fda347ea9967cb4c0b811ba86072f968d36e1dfc))
* **roadmap:** close road-to-carrier-unicode-strip ([1aa691e](https://github.com/event4u-app/agent-config/commit/1aa691e98b3d114e07a568b3b1a380c39d8ef996))
* **humanizer:** opt-in step 5b, its audit line, and two refusals ([f09a5e5](https://github.com/event4u-app/agent-config/commit/f09a5e53c760b627f11a54c0fce007d665785a3d))
* **roadmap:** close road-to-governance-vocabulary-and-negative-controls ([08d4e08](https://github.com/event4u-app/agent-config/commit/08d4e08828cd9658ae39e28b622352556e55c424))
* **concepts:** index the terms whose meaning here is not the obvious one ([8eeefdb](https://github.com/event4u-app/agent-config/commit/8eeefdb6d2e0669ab6431d55ec5a336b544966c6))
* **roadmaps:** harvest agent-cost-gate-2, and record S-6 as a headless null ([fb2cdc2](https://github.com/event4u-app/agent-config/commit/fb2cdc2017e7d811613da8b669c67f396cd33dde))
* **evidence:** record that the unattended-spawn refusal's condition fired ([4965970](https://github.com/event4u-app/agent-config/commit/4965970afa3bcf4c2b51679bbd9c3afc8f830591))
* **roadmap:** the close-out content the rename commit did not carry ([c984e35](https://github.com/event4u-app/agent-config/commit/c984e35ec6a04323b776b7e144ae3febeae1e521))
* **roadmap:** close road-to-evidence-based-adr-governance ([6c2111e](https://github.com/event4u-app/agent-config/commit/6c2111e1468713e0399af3def7aa14cf240f91d4))
* **roadmaps:** archive the delivered half, park the detection half ([52da895](https://github.com/event4u-app/agent-config/commit/52da8950cf419d951732a2556a7ca8b897163c7a))
* **roadmap:** close road-to-subagent-lifecycle-integrity ([b00a967](https://github.com/event4u-app/agent-config/commit/b00a967a5148d13a8253ee7b66067d608c23d7f7))
* park one program roadmap, add one gated stub, keep one audit trail ([38a243a](https://github.com/event4u-app/agent-config/commit/38a243ac2172b21442b249e334db139db78b6044))
* **roadmaps:** park two drained roadmaps and add one gated stub ([9048562](https://github.com/event4u-app/agent-config/commit/904856242aa8c7a2b5cf3000084b841444f7fab5))
* **roadmaps:** three draft roadmaps on output hygiene, vocabulary and CI pins ([1ce47b8](https://github.com/event4u-app/agent-config/commit/1ce47b8e647ce29c4fd34b8807dee1c5b6ef4f48))
* **roadmaps:** two draft roadmaps on design fidelity and observability ([21950d1](https://github.com/event4u-app/agent-config/commit/21950d10d325f1a13523c74e5ae4f72f947af8e2))
* **roadmaps:** three draft roadmaps on authorization, injection and publish ([67aec69](https://github.com/event4u-app/agent-config/commit/67aec696e266c4445f97d5b135e246f412b98c3c))
* **roadmaps:** three draft roadmaps on who reviews and what a review asks ([4fe7d89](https://github.com/event4u-app/agent-config/commit/4fe7d892d71adc8f9c4bc022257edd3327255337))
* **roadmaps:** two draft roadmaps on council seating and evidence integrity ([4c25d16](https://github.com/event4u-app/agent-config/commit/4c25d16edb9d1fe132d4aeec7bd95a2901214760))
* **roadmaps:** two draft roadmaps on override efficacy and host observation ([f8e2beb](https://github.com/event4u-app/agent-config/commit/f8e2beb7eaa1faff9555afbdc62e5bb8a3935208))
* **roadmaps:** five draft roadmaps on standing-context and projection economy ([d5ee84f](https://github.com/event4u-app/agent-config/commit/d5ee84f09856cdcae5ce3617b08f3ca7cd73a00d))

### Refactoring

* **roadmaps:** stop hiding the drain behind status draft ([cec48f9](https://github.com/event4u-app/agent-config/commit/cec48f98c0856504f4b063206fdade2ae52ec9ae))

### Tests

* **git-auth:** one case per vector, each naming the op it asserts ([6b3ea3c](https://github.com/event4u-app/agent-config/commit/6b3ea3ca3ba9403655f0c7b32720b4f5e82da6dc))
* **workflow-security:** make the clean fixture clean, and add the missing negative control ([3a118b1](https://github.com/event4u-app/agent-config/commit/3a118b15fd8f27c631a62c1fa523d1d745242734))
* **hooks:** drive the injection scanner over the frozen corpus ([f18a64e](https://github.com/event4u-app/agent-config/commit/f18a64e4fe892e00cf62a811aed9c1b2f73d0a38))
* **estate:** cover the measured floor in both directions, and three sabotage probes ([615594e](https://github.com/event4u-app/agent-config/commit/615594e96211dfd71793e9344a5db77494780432))
* **ci:** put the supply-chain regression net where it can actually block ([fb6a54d](https://github.com/event4u-app/agent-config/commit/fb6a54d01fde595e271bc2bfea8c97eb4022628a))
* **review:** pin the spec axis, and prove the pre-state deterministically ([d5a490c](https://github.com/event4u-app/agent-config/commit/d5a490c41901e659e1ef13f09420aa788abbfa94))
* **supervise:** pin quota-parked, with both mechanisms sabotaged first ([8012ce7](https://github.com/event4u-app/agent-config/commit/8012ce72c1a61763213b62fb22970c00d229984b))
* **council:** pin the billing-cliff gate, with the mechanisms sabotaged first ([b76f986](https://github.com/event4u-app/agent-config/commit/b76f9868c880e589f00ccbb95226621f61bfc78d))

### Build

* **lint:** close the eslint warn tier at the zero it already sat at ([cea85cd](https://github.com/event4u-app/agent-config/commit/cea85cd694390e8335dcb112ef022efc32c42960))

### Chores

* **adr:** refresh the evidence census after the ADR-123 follow-up ([41ff21b](https://github.com/event4u-app/agent-config/commit/41ff21bd08b0d744bf10de2b5bea813a778d7ef8))
* **deps-dev:** bump the npm-development group with 2 updates ([400b6a8](https://github.com/event4u-app/agent-config/commit/400b6a81a40fb000a15d1d86deb1343a050ce7d3))
* **deps:** bump the site group in /site with 3 updates ([e605a32](https://github.com/event4u-app/agent-config/commit/e605a32abca0f8eea018be1f918aab03a83a83e3))
* **deps-dev:** bump the telemetry-worker group ([acd75f5](https://github.com/event4u-app/agent-config/commit/acd75f53a6254936a74f00f6ab6508a30a415f35))
* **sync:** project the roadmap-writing carve-out into dist ([27299e6](https://github.com/event4u-app/agent-config/commit/27299e6805b01ea9491540ed3993cd9a3a81bd2a))
* **roadmap:** ship Phases 1-4, revert Phase 5, leave both blockers open ([bbc8d67](https://github.com/event4u-app/agent-config/commit/bbc8d67de3845c352797ac874bf50e8946e0d0d9))
* **generated:** regenerate docs/proof.md for the new ledger entry ([9424378](https://github.com/event4u-app/agent-config/commit/94243780774352ff7e685995c0fb5ebd9a70739c))
* **generated:** regenerate the skill-overlap report for the added skill ([2b7d2dd](https://github.com/event4u-app/agent-config/commit/2b7d2dd23fef1f25d3a58504f87fbab8bd446dd7))
* **generated:** regenerate CAPABILITIES.yaml and docs/proof.md for the added skill ([6e043d1](https://github.com/event4u-app/agent-config/commit/6e043d136f75b7a7031070db39ec4fe4fed3ba34))
* **roadmap:** route the spike, resolve both blockers, park the tool question ([ae0d90a](https://github.com/event4u-app/agent-config/commit/ae0d90a86226c5ceb0c0ca2360a445bcd84f238a))
* **publish:** drop a dead .npmignore rule the new artefact surfaced ([192d632](https://github.com/event4u-app/agent-config/commit/192d6322167975e33f74bfa87c1d1c004368f3a8))
* **roadmap:** archive road-to-publish-boundary-evidence ([c386261](https://github.com/event4u-app/agent-config/commit/c386261b36fedd7bab98e42ba88a3fd4f50e1da7))
* **counts:** regenerate the README skill badge for the skill this PR adds ([a64d82d](https://github.com/event4u-app/agent-config/commit/a64d82dca43be3b8a4f23523f587736734b81949))
* **generated:** regenerate README counts and index after the merge ([5c15674](https://github.com/event4u-app/agent-config/commit/5c156742c0d5e572340b6b0c40c3200a0e40a0f8))
* **adr:** regenerate the ADR evidence census for ADR-243 ([ce4b643](https://github.com/event4u-app/agent-config/commit/ce4b643beecf662f5aac8629045ed820c5602d81))
* **estate:** re-state against main's merged floor after a sibling merge ([ac8e75d](https://github.com/event4u-app/agent-config/commit/ac8e75d7441f5efd750265c94860f74d68d154e7))
* **estate:** stop calling the budget file a measured baseline downstream ([d44aa5a](https://github.com/event4u-app/agent-config/commit/d44aa5a0197a857bfab5a05d47a5062708c21670))
* **estate:** re-state the blocker walk against main's merged floor ([f87ea71](https://github.com/event4u-app/agent-config/commit/f87ea717e3138307e36b300cabfa3514511945a3))
* **roadmap:** resolve both council-seat blockers, record Phase 1 as shipped ([23e37ec](https://github.com/event4u-app/agent-config/commit/23e37ec5246eb5d833d61869aa10ba9ad6eb2520))
* **estate:** re-state the walk against main's merged floor ([a001223](https://github.com/event4u-app/agent-config/commit/a00122345732539705b5c8509a3f656d30cd1e16))
* **roadmap:** archive road-to-ci-supply-chain-integrity, walk the estate ([03538d0](https://github.com/event4u-app/agent-config/commit/03538d091f1fb55da5b9f5d286b08e77039cdd97))
* **index:** regenerate for the sixth judge ([382604d](https://github.com/event4u-app/agent-config/commit/382604dc9a00ffc35133444e4ab082b61426adbc))
* **roadmap:** archive road-to-spec-axis-in-review, walk the estate down ([f18c9c0](https://github.com/event4u-app/agent-config/commit/f18c9c0b3b2bec8884880258dacb8ba14c6045db))
* **index:** regenerate after adding the traceability mechanics guideline ([99e7a45](https://github.com/event4u-app/agent-config/commit/99e7a45f903ab167407405ac47e780255143583f))
* **proof:** regenerate after the new CLAIMS entry ([eb76376](https://github.com/event4u-app/agent-config/commit/eb76376f2589bb61eaa8f6250196ff6f9f183cfe))
* **estate:** walk active_roadmaps 24 -> 23, the measurement main already carried ([6a61d3c](https://github.com/event4u-app/agent-config/commit/6a61d3cd1050d00a70d4aa3ef1230a63fbb02943))
* **estate:** re-measure against the merged tree (24 -> 23) ([9a0e237](https://github.com/event4u-app/agent-config/commit/9a0e237d6de6c63371feea6e3257a7b3d7920836))
* **estate:** re-measure active_roadmaps against the merged tree ([5b67333](https://github.com/event4u-app/agent-config/commit/5b67333c69dafccecb9091e00c7420d25a2eb7d4))
* **dist:** project the humanizer strip fixture and skill edits ([cf7334b](https://github.com/event4u-app/agent-config/commit/cf7334be8e0ab684074519aaeacfa3dd3aa7e3f8))
* **estate:** move three ratchets for what this change actually did ([7598104](https://github.com/event4u-app/agent-config/commit/759810485106f3217dc20f2ce1ed82bebaac0177))
* **evidence:** type the council record ([9ff4359](https://github.com/event4u-app/agent-config/commit/9ff435982d354fb8380709ef28c1af66b3300a5a))
* **estate:** one baseline entry for the whole drain accounting ([b572d5c](https://github.com/event4u-app/agent-config/commit/b572d5c8f07559497c1834c605eb67a3b8ae8ddf))
* **estate:** charge the twenty drain drafts as one reviewable exemption line ([4b87615](https://github.com/event4u-app/agent-config/commit/4b87615478281bd83db06e83d14d57eac8ae7464))
* **estate:** raise later_roadmaps baseline 55 -> 57 for two parked drains ([f73b523](https://github.com/event4u-app/agent-config/commit/f73b523281ceb030c3a798cd9a4691918f5196ee))

### Other

* execute two unanimous council verdicts, archive the closed roadmap ([dc6e75a](https://github.com/event4u-app/agent-config/commit/dc6e75aa07bbc0037c0dbdd3ca2f9bac61370a94))
* **fidelity:** merge the four surviving scroll-storytelling items as Phase 9 ([22362db](https://github.com/event4u-app/agent-config/commit/22362dbc8169a5479b4f1ee1bc5b956e04237a4c))
* **draft:** land six roadmaps from the 2026-08-22 inbox run, drop ten ([a2976c4](https://github.com/event4u-app/agent-config/commit/a2976c4cbd8cc3bf2518d65e90d513ec6f24925e))
* give the three flipped roadmaps the Risk Register the flip made due ([d6b6bb9](https://github.com/event4u-app/agent-config/commit/d6b6bb993761c68014aea20f36db922892d05684))
* flip the last inbox run's seven drafts to ready ([d42283c](https://github.com/event4u-app/agent-config/commit/d42283c599d34a41d6d509a3cf36246c430f7cc9))
* **draft:** repair three broken references in the landed roadmaps ([4a984dd](https://github.com/event4u-app/agent-config/commit/4a984dd21560a684286216b683b53191029f17be))
* **draft:** anonymise the external harvest sources per source-confidentiality ([56e76dc](https://github.com/event4u-app/agent-config/commit/56e76dc9e88566bcc9e1624c048037e9654b46d9))
* **draft:** pay the one-in-one-out charge on the three landed roadmaps ([e7c1fd9](https://github.com/event4u-app/agent-config/commit/e7c1fd93abc146fa22ad99644f2fcd7f567a0802))
* **draft:** skill delivery over MCP, with the harvest that corrected its premise ([eb2d7e5](https://github.com/event4u-app/agent-config/commit/eb2d7e50b4b9a688fbed93c89654cb6f6cd62e1d))
* **draft:** agentic engineering assurance, plus three demand-gated stubs ([ead379f](https://github.com/event4u-app/agent-config/commit/ead379f1a49580d672a978d49a77c1e60e7d0c2f))
* **draft:** monorepo detection, component-library lifecycle, repo playbooks ([5d3793b](https://github.com/event4u-app/agent-config/commit/5d3793b93e8d4a6e8126be51be8288e174ce63d7))
* **review:** write the report to stdout directly, per the no-console rule ([5e26c60](https://github.com/event4u-app/agent-config/commit/5e26c60fc9db4b9f291cefc2930338681cd2ff1f))
* **per-turn-hook-economy:** carry the two deferred items, then archive ([780f3e6](https://github.com/event4u-app/agent-config/commit/780f3e6633f028daa38c78473642e6e5fac23e51))

Tests: 16374 (+199 since 14.8.0)

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
