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

# Era: 14.3.x — current

> Started at `14.3.0`. Full entries live inline below.
> The drift test caps this era at 250 lines of entry body; growth past
> that forces a new era split (`# Era: 14.4.x`, etc.) — see
> [`docs/contracts/CHANGELOG-conventions.md § Era splits`](docs/contracts/CHANGELOG-conventions.md).

## [14.3.0](https://github.com/event4u-app/agent-config/compare/14.2.0...14.3.0) (2026-08-19)

### Release highlights

<!-- Curated head: fill before merge, keep it under 10 lines, and leave `_none_` where it is genuinely the answer. The generated log below is unchanged. -->
- **Behaviour changes:** _none_
- **Default changes + migration:** _none_
- **Security and correctness:** _auto-derived, rewrite before merge:_ security-scoped commits or fixes to executable surface in c50e92b, d80398a, a0ec3b9, 4ffee76, 9c7e0cf, b3b42ad +3 more.
- **Honest nulls:** _auto-derived, rewrite before merge:_ commits recording a null, waived or falsified result in fbed7cc, 0d53c42, 231d8ea.
- **Known limitations:** _none_

### Features

* **gates:** add `gates --sheet` — one decision sheet with per-row provenance ([9e58315](https://github.com/event4u-app/agent-config/commit/9e5831536f14b178f13094e9f9842e15b3ab53c0))
* **gates:** ratchet the roadmap estate and make a new roadmap pay for itself ([6f808e6](https://github.com/event4u-app/agent-config/commit/6f808e6b85d8da6df49f0e11f62bc33b6bddbd00))
* **hooks:** register the per-turn composite as an observe-only budget row ([1d810b3](https://github.com/event4u-app/agent-config/commit/1d810b39053ed0795d1d66fa5f40ec98d192bc4e))
* **bench:** add a --bundle override so a two-version latency run is a flag ([231d8ea](https://github.com/event4u-app/agent-config/commit/231d8eaaf0a675828157b1d93385d1573adc5eb3))

### Bug Fixes

* **hooks:** drop the BodyClass import the extraction orphaned ([c50e92b](https://github.com/event4u-app/agent-config/commit/c50e92b6d04b54b394e488b22d39c844c4e779cf))
* **config:** correct the estate baseline to the trunk value it never described ([6a5ad7f](https://github.com/event4u-app/agent-config/commit/6a5ad7fc800b3c08928f7a8464860c7d6676ab73))
* **hooks:** apply the R2 fix pass — 6 of 7 findings ([d80398a](https://github.com/event4u-app/agent-config/commit/d80398ab24f8ca9c0731623b8cb53a918c3e135b))
* **hooks:** make fd 0 non-blocking on purpose — the two stdin properties are coupled ([a0ec3b9](https://github.com/event4u-app/agent-config/commit/a0ec3b9d1f55be220d3eb76ed1555828eb7e4b35))
* **config:** give the estate-count budget the review_by every budget needs ([c1789aa](https://github.com/event4u-app/agent-config/commit/c1789aa28ce4d9c4eb2dba59a271989e40a75667))
* **hooks:** cap the first-byte wait — the stdin fix was hanging idle callers ([4ffee76](https://github.com/event4u-app/agent-config/commit/4ffee765d588b88fa50a221364840b06fdf10d19))
* **gates:** close all 11 R2 findings — the ratchet now reads its base ref ([9c7e0cf](https://github.com/event4u-app/agent-config/commit/9c7e0cfc66e8c61639973b8ccf76d3c093d377e0))
* **roadmaps:** draft the six missing recommendations, and repair a red ratchet ([fbed7cc](https://github.com/event4u-app/agent-config/commit/fbed7cc624b35af4652d7da86c49bb35f5d934ff))
* **review:** let the R2 reviewer see inline acceptance criteria ([b3b42ad](https://github.com/event4u-app/agent-config/commit/b3b42ada2acba3dcb5ccbc56b51db29a67cb969a))
* **hooks:** apply the R2 fix pass — 14 fixed, 1 split into a policy blocker ([ef0f2dc](https://github.com/event4u-app/agent-config/commit/ef0f2dc785ce289c24dafd60943db9e5a648559a))
* **test:** type the spawn env so the tests typecheck reaches it ([173aaa2](https://github.com/event4u-app/agent-config/commit/173aaa2185ce98a717a9e83fac0a68c4f4b22b2c))
* **hooks:** guards were blind above the pipe buffer; publish the Phase 1 null ([bcd73ed](https://github.com/event4u-app/agent-config/commit/bcd73ed2d74d62e7e7b58e1323dd982a130e1947))

### Performance

* **hooks:** measure only the bodies some concern actually loses ([6b7463b](https://github.com/event4u-app/agent-config/commit/6b7463b96d223dc771ba92cb718808ed82cadbff))
* **hooks:** payload opt-in — a concern gets the bodies it declares ([b4ef8e5](https://github.com/event4u-app/agent-config/commit/b4ef8e548c67659404d78dd9894892805265ffcb))
* **hooks:** take both per-write spawns off the hot path ([ae7e097](https://github.com/event4u-app/agent-config/commit/ae7e097c4a019ab120369525f813d4306d76dc43))

### Documentation

* **review:** re-bind the findings after merging the PR base ([b320587](https://github.com/event4u-app/agent-config/commit/b320587ddf2273cff09d89d3100c4354e126f612))
* **review:** re-bind the findings after the orphan removal ([9364896](https://github.com/event4u-app/agent-config/commit/9364896c7f905024ba24e040ac1293717ed450da))
* **review:** re-bind the findings after the source-size extraction ([c6910f5](https://github.com/event4u-app/agent-config/commit/c6910f5e339a9a986252adc62aac420a8361cf79))
* **review:** re-bind the skip declaration and correct the inherited-red section ([6f69dc7](https://github.com/event4u-app/agent-config/commit/6f69dc789fc9f6be1ac3e5fea00b258a49409b9e))
* **roadmap:** record that the estate-ratchet breach was closed on the base ([d818131](https://github.com/event4u-app/agent-config/commit/d8181316288d2400899865f14e3ec3f6a73b26c3))
* **review:** re-bind the findings after merging the base ([e572ed3](https://github.com/event4u-app/agent-config/commit/e572ed339adff51ef6bd80525fa81aa158ba8048))
* **review:** re-bind the skip declaration to the moved review scope ([29ad745](https://github.com/event4u-app/agent-config/commit/29ad745286c6a44ed3f15f171ecc45e8831ef6c8))
* **roadmap:** restore two mismarked deferrals and refute both tempting reasons ([2c2b6ca](https://github.com/event4u-app/agent-config/commit/2c2b6ca547ab619f33d07d8f612451297a435e76))
* **review:** declare the completion review skipped — no code surface ([fd7017e](https://github.com/event4u-app/agent-config/commit/fd7017ebfa1f0696d04f1f141c043a696d7a8fbc))
* **roadmap:** close ci-economy 3.4 and restore two mismarked deferrals ([604451f](https://github.com/event4u-app/agent-config/commit/604451ff5765f684495f5bad5a56ff2c71a60049))
* **review:** re-bind the findings after the CI fix pass ([1cf1b81](https://github.com/event4u-app/agent-config/commit/1cf1b8189391f5d66325c7eb11a07a66e0a0165f))
* **review:** re-bind the findings artefact after the fix pass ([31ba213](https://github.com/event4u-app/agent-config/commit/31ba213c0c2d4d748d661f7bfbb4ccec36bae930))
* **review:** disposition all 7 R2 findings with commit refs ([342a71a](https://github.com/event4u-app/agent-config/commit/342a71a8b08390869f6b3082c2f22b2a1f09c1ca))
* **roadmap:** defer 5.3 with its classification, and re-measure AC-2 after the fix pass ([8e7a1dd](https://github.com/event4u-app/agent-config/commit/8e7a1dd2410cc278b22f212ded86a868ff345dad))
* **review:** commit the R2 reviewer input package ([2f91955](https://github.com/event4u-app/agent-config/commit/2f91955f26b5f18626b6b218fb2a81a26ab4f75b))
* **review:** commit the R2 findings skeleton before the fix pass ([42490e3](https://github.com/event4u-app/agent-config/commit/42490e395fa094cbd656b674e60c47846c1341ab))
* **roadmap:** close Phase 2 and publish the AC-2 null ([b59572e](https://github.com/event4u-app/agent-config/commit/b59572e6e648ecee4777c7f88a3998180af398a9))
* **review:** declare the Phase 0 completion skip — zero code paths of five files ([37e3084](https://github.com/event4u-app/agent-config/commit/37e3084d384525ef75dfd8d412da99f0b14c28e4))
* **roadmaps:** close org-telemetry Phase 0 and record what it changed downstream ([c86fa4a](https://github.com/event4u-app/agent-config/commit/c86fa4aa72e5c7f1f6ab303e4ee70bf0356c028c))
* **evidence:** publish the three org-telemetry Phase 0 spike findings ([71a9f2f](https://github.com/event4u-app/agent-config/commit/71a9f2f53fc83d176a9d6eb41afe7251ee54a81b))
* **review:** re-bind the findings after merging the PR head ([9c8a5fc](https://github.com/event4u-app/agent-config/commit/9c8a5fc1251d2cbb1dd2eed7a173b338aaa90dc7))
* **review:** re-bind the findings after the non-blocking fd fix ([2788770](https://github.com/event4u-app/agent-config/commit/2788770284a64bc0c49fb86a3f7980fa7ae36479))
* **review:** re-bind after the CI fix ([8ca01d6](https://github.com/event4u-app/agent-config/commit/8ca01d6023cfde6f8942e00f99b414edb2de6967))
* **review:** mark the six committed reviews that were dispatched AC-blind ([295ced9](https://github.com/event4u-app/agent-config/commit/295ced9d90ec82a47b92e8ca0215cea1ca0b3982))
* **review:** re-bind after the trunk merge, and correct finding 11's ref ([348c9aa](https://github.com/event4u-app/agent-config/commit/348c9aad43afa7e80e40b71502c4f992894f9d29))
* **review:** re-bind the findings after the first-byte-cap fix ([485a302](https://github.com/event4u-app/agent-config/commit/485a3027c54e8db260d3042bff2723ecc20daef9))
* **review:** re-bind the R2 artefact and record the dispositions ([0ab50ca](https://github.com/event4u-app/agent-config/commit/0ab50ca2d8b2bb3b7c2d3d12512aa0ed497988a7))
* **review:** record the R2 findings for estate-drawdown 0.1 + 3.1 ([479c993](https://github.com/event4u-app/agent-config/commit/479c993267db052b61a32cc4f3db7dbd8a2b435b))
* **roadmap:** land the decision sheet and close estate-drawdown 0.1 + 3.1 ([1b9a034](https://github.com/event4u-app/agent-config/commit/1b9a034df50db3d57c24de2d57c402b5862888f9))
* **review:** re-bind the findings after the base merge moved the scope ([5198659](https://github.com/event4u-app/agent-config/commit/51986599cec38a73427dc5b4f124d7aed74978c2))
* **review:** bind the findings to the fix pass and re-derive the manifest ([12e2aff](https://github.com/event4u-app/agent-config/commit/12e2aff17981ee0a440c4b7785ef657904348595))
* **review:** land the R2 findings, all rows open, before any fix pass ([8ea8731](https://github.com/event4u-app/agent-config/commit/8ea8731a1c2d9850ebbd0bea97f34a1fe7f57911))
* **review:** commit the R2 findings skeleton before any fix pass ([e17a9fe](https://github.com/event4u-app/agent-config/commit/e17a9fe4e5a7be612f16c04d2a492009a891eb36))
* **hooks:** record the host's matcher/if semantics, and cancel 5.1 on them ([606fb93](https://github.com/event4u-app/agent-config/commit/606fb9391074d0bd1aa3fb8491fef55f1407a408))

### Refactoring

* **hooks:** move the payload shaping plan out of the dispatcher ([a9637d0](https://github.com/event4u-app/agent-config/commit/a9637d0015e4c40f98a3bf5e38ec601b6b09d8da))

### Tests

* **hooks:** pin the payload opt-in from the concern side of stdin ([b319c6a](https://github.com/event4u-app/agent-config/commit/b319c6a07b91ee3511b91916795c72156c711909))
* **bench:** add a large-payload cell, and pre-register the Phase 1 A/B bars ([0d53c42](https://github.com/event4u-app/agent-config/commit/0d53c42ba490be92039a04b0f2f6c980ac2dcb30))

### CI

* **tests:** drop the falsified balanced-shards claim from the exclusion comment ([2cc2060](https://github.com/event4u-app/agent-config/commit/2cc2060be8e3085b0e47dc0c91a2112cd9680d3b))
* **economy:** re-measure the shard baseline over 50 runs and settle the fold-back ([b23afc0](https://github.com/event4u-app/agent-config/commit/b23afc03ab6db9cda0876dfd8a36c9b97ad36f1e))

### Chores

* **gates:** raise the estate open-blockers baseline 67 to 72, with the split measured ([7de21d6](https://github.com/event4u-app/agent-config/commit/7de21d6a788ce73f2df8c78c8728b00b90c8161f))
* **sync:** project the roadmap_gates --sheet renderer into dist/agent-src ([e184eb9](https://github.com/event4u-app/agent-config/commit/e184eb9e2aa56acdce4613564dad62e353529375))
* **roadmap:** regenerate the dashboard after the base merge ([f8469f3](https://github.com/event4u-app/agent-config/commit/f8469f390b4eac90945582cffdcfed85b1433ca9))
* **roadmap:** regenerate the dashboard after the fix pass ([297731a](https://github.com/event4u-app/agent-config/commit/297731a36e7813c9a931c417864445465b826af0))
* **roadmap:** regenerate the dashboard after the Phase 0/4/5 flips ([baa7517](https://github.com/event4u-app/agent-config/commit/baa7517b31bc9f1593fcb1ded68864ff64057bfd))

Tests: 14730 (+101 since 14.2.0)

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
