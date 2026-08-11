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

# Era: 9.34.x — current

> Started at `9.34.0`. Full entries live inline below.
> The drift test caps this era at 250 lines of entry body; growth past
> that forces a new era split (`# Era: 9.35.x`, etc.) — see
> [`docs/contracts/CHANGELOG-conventions.md § Era splits`](docs/contracts/CHANGELOG-conventions.md).

## [9.34.0](https://github.com/event4u-app/agent-config/compare/9.33.0...9.34.0) (2026-08-11)

### Release highlights

<!-- Curated head: fill before merge, keep it under 10 lines, and leave `_none_` where it is genuinely the answer. The generated log below is unchanged. -->
- **Behaviour changes:** _none_
- **Default changes + migration:** _auto-derived, rewrite before merge:_ commits naming a default, migration or migrate in 4420340.
- **Security and correctness:** _auto-derived, rewrite before merge:_ security-scoped commits in 4420340, b2fc429.
- **Honest nulls:** _none_
- **Known limitations:** _none_

### Features

* **handoff-envelope:** a checkable off-limits path list, and a validated reversibility tag ([33fd14c](https://github.com/event4u-app/agent-config/commit/33fd14ca8c8aa3ade0081e5f5bf33b6baef6f3f7))
* **r2-dispatch:** tell the three stale-artefact states apart, and route each to its contract path ([ca417a1](https://github.com/event4u-app/agent-config/commit/ca417a13ebd7890bbefedec89399add96a3f8eca))
* **lint-handoffs:** make a blank Open-questions section a finding, not a pass ([a22534b](https://github.com/event4u-app/agent-config/commit/a22534bbf8e80eb5e32d7e547651b8efa55a47dc))
* **self-repair:** bound record creation per source, and count what the cap refuses ([76aa7b5](https://github.com/event4u-app/agent-config/commit/76aa7b56dd53212f0b4f5d556cae27054bb2a358))
* **discovery:** add a dormancy report that names an unavailable signal ([99cfa2f](https://github.com/event4u-app/agent-config/commit/99cfa2f632320b7e1300e0d539292e1c038437a6))
* **discovery-graph:** add a zero-inbound query, per-pass stats and error containment ([ed3d532](https://github.com/event4u-app/agent-config/commit/ed3d5325285476e86fae62c679b6d20cbbff923f))
* **lint-hedge-words:** diff-scoped advisory hedge lint with a declared stage ([364ef70](https://github.com/event4u-app/agent-config/commit/364ef707dce9e29917d4bc9f5d2b2aeedc4572da))
* **claims:** bind six external research cites, gate the successor pointer ([37cc8fe](https://github.com/event4u-app/agent-config/commit/37cc8fee84343b8cb92edf7778b97ce235086dc8))
* **skill-linter:** gate Security constraints on script-bearing skills ([b2fc429](https://github.com/event4u-app/agent-config/commit/b2fc4292540fe140ca9ead90b32bebaac133d2d0))
* **council:** check a synthesis verdict against its own stance tally ([37103c3](https://github.com/event4u-app/agent-config/commit/37103c3e68efd749dd1d386f3402b8bc0679255d))

### Bug Fixes

* **tests:** satisfy exactOptionalPropertyTypes in the two new spec files ([4f9cd9b](https://github.com/event4u-app/agent-config/commit/4f9cd9b46370920daa0a39aa5cb10a65b70e70a4))
* **security-lint:** report the corpus a gate actually walked, not the shared default ([4420340](https://github.com/event4u-app/agent-config/commit/4420340cba6f5f091d2b836f21e747878fd71ed3))
* **roadmap-archival:** never rewrite path strings inside frozen records ([8805814](https://github.com/event4u-app/agent-config/commit/88058140884f14c275737e0e612daee005db2bd7))
* **review:** re-align the round-3 dispositions and escape the table pipes ([c569ba5](https://github.com/event4u-app/agent-config/commit/c569ba54c95e0d16ab315cb7a5223a33d34f3268))
* **review:** close the round-3 findings, including four npm ci sites the verify regex could not see ([57867df](https://github.com/event4u-app/agent-config/commit/57867dfd5dbb2d00bbc02deace9c0312e999b423))
* **review:** repair the round-2 findings, including a self-falsifying cost table ([90cb3ca](https://github.com/event4u-app/agent-config/commit/90cb3caff641d4bb4ef515813b7ec44af92d6636))
* **lint-hedge-words:** harden the gate scope so the coverage ratchet holds ([d0c9d9e](https://github.com/event4u-app/agent-config/commit/d0c9d9e9b6812d59a7a89e8287bc4b89800aa28d))
* **council:** let the reserved split label yield to a real option ([30328d8](https://github.com/event4u-app/agent-config/commit/30328d8811bd65f35f2bf42bc6b4fbe8cc76fa4c))
* **council:** address the R2 completion-review findings ([02c786c](https://github.com/event4u-app/agent-config/commit/02c786c28646da19e8c9cee94ab49b826f91a611))
* **review:** repair the seven completion-review findings ([efa7cc1](https://github.com/event4u-app/agent-config/commit/efa7cc1d150e0679678db22252dedbbcb838051f))
* address the nine R2 completion-review findings ([02cdfbb](https://github.com/event4u-app/agent-config/commit/02cdfbb28f04e432cccff7c14ba9f12e177feb0e))
* **ci-time-ratio:** correct the output-path docstring and register a task target ([1e28e18](https://github.com/event4u-app/agent-config/commit/1e28e1884ea8be49f6b8412e3b1c2d8c7240e9c9))

### Performance

* **tests:** render the proof page once in build_proof.test.ts ([c4d699b](https://github.com/event4u-app/agent-config/commit/c4d699ba61c4ad5a1a19ca292b4d3218748069b5))

### Documentation

* **dispatch-safety:** close 3.1, 3.2 and 3.3, and record why 3.4 waits for producers ([9efe07e](https://github.com/event4u-app/agent-config/commit/9efe07e11b40eb5231d267f89968045af87163d9))
* **dispatch-safety:** ADR-109 amendment 4, and close 1.3, 1.4 and 4.1 ([5f7e83a](https://github.com/event4u-app/agent-config/commit/5f7e83ad61488c1098ce5696731664b24a13ac2f))
* **review:** declare the no-code-surface skip for the org-pack decision ([4a573c0](https://github.com/event4u-app/agent-config/commit/4a573c0565854f0f561de8258eb776b1f51eb1fd))
* **council:** record the gate-scoped solo-attendance floor as ADR-224 ([686c23d](https://github.com/event4u-app/agent-config/commit/686c23df83b84c33f5bfac5257d1b187a0174f73))
* **roadmap:** close estate-lifecycle Phases 2-4 and record the two refusals ([f64b7fc](https://github.com/event4u-app/agent-config/commit/f64b7fc87fd6c0701ff5601676f067af2fe024fe))
* **governance:** separate the two lifecycle vocabularies and answer the deferred field ([212a38c](https://github.com/event4u-app/agent-config/commit/212a38c45622b9ee2329fe2929db2949a2c612de))
* **decision:** decline the external pack source root ([87f8943](https://github.com/event4u-app/agent-config/commit/87f894310ec1b07d64d86cef7d9b8a3cb5595a0a))
* **review:** disposition the round-3 findings ([c78afd5](https://github.com/event4u-app/agent-config/commit/c78afd510497d08b3684fc5fe42230b7a82b2af3))
* **review:** disposition the round-2 findings and preserve both rounds ([59b4561](https://github.com/event4u-app/agent-config/commit/59b45613fdd7eb3ffef275b5062f36c366428015))
* **review:** re-bind the findings after the gate-hardening fix ([0928422](https://github.com/event4u-app/agent-config/commit/092842250cb6b861e9cc217e0708bc63d411513b))
* **review:** disposition the seven findings against the repair commit ([910f7c4](https://github.com/event4u-app/agent-config/commit/910f7c4e85886f194f214ceeafe06c2b479b154e))
* **review:** record the completion-review findings for ci-economy ([d5e1fbd](https://github.com/event4u-app/agent-config/commit/d5e1fbdd3184adc4cd0c4f2a88776ae475e99422))
* **roadmap:** resolve the council-integrity deferral into a READY follow-up ([94f25c2](https://github.com/event4u-app/agent-config/commit/94f25c25d7911ef9fc177db21dba0e294e7e143a))
* **review:** re-bind the completion-review findings to the post-fix scope ([0208175](https://github.com/event4u-app/agent-config/commit/0208175e677af8db7632be58e7384209dceae45e))
* **roadmap:** close 15 of 16 ci-economy steps, cancel the build fan-out ([3a3523d](https://github.com/event4u-app/agent-config/commit/3a3523de29b269b9b580fd9bd071d94cafa0a2cd))
* **adr:** ADR-223 records no required-check demotion on cost grounds ([6e0d45a](https://github.com/event4u-app/agent-config/commit/6e0d45ae673f2cd8fa8c0e36f09110b4a573de7e))
* **development:** correct the testing section and document the in-process runner ([53ce1f6](https://github.com/event4u-app/agent-config/commit/53ce1f6fa2ef56ff3bc1737c987dd6e918c81928))
* **ci-cost-budget:** re-anchor the baseline to CI-recorded figures ([2972545](https://github.com/event4u-app/agent-config/commit/2972545e966319ebf4c632e1931ebc8c084b8816))
* **review:** R2 completion-review findings for the authoring-contract branch ([d97c428](https://github.com/event4u-app/agent-config/commit/d97c42860ea1ce4b6b63a347c824f00a536d853f))
* **failure-signatures:** stable ids, per-row drills, capability-claim row ([c18295e](https://github.com/event4u-app/agent-config/commit/c18295e0108955418eabf064502b591432cdeb1a))
* **skill-writing:** reclassify two unenforced sections, add three patterns ([07d8ce1](https://github.com/event4u-app/agent-config/commit/07d8ce1198699833f0154112831ae7fcf4703ba0))
* **roadmap:** close council-integrity 2.1 and 3.1, record two premise corrections ([088f7ab](https://github.com/event4u-app/agent-config/commit/088f7ab87de41ecbe21c46d7efefef1ed5f04a60))

### Refactoring

* one definition of the env kill-switch predicate ([689cc55](https://github.com/event4u-app/agent-config/commit/689cc5558a55ccab4728175955459973a5b03e4e))

### Build

* **toolchain:** enable tsc incremental buildinfo and the eslint cache ([344bf97](https://github.com/event4u-app/agent-config/commit/344bf979e7c355c1a97d7407706f198fd5bf78ee))

### CI

* **workflows:** add PR-scoped concurrency and flag the bare npm ci calls ([522c052](https://github.com/event4u-app/agent-config/commit/522c05283ea2f5d4b7ca65c5862d21520291f0db))

### Chores

* **roadmap:** regenerate the dashboard after the second main merge ([92bf6fb](https://github.com/event4u-app/agent-config/commit/92bf6fb58e50170176a76d5892098b0d19d21e8c))
* **dist:** project the reversibility-tag paragraphs into the command tree ([2d33951](https://github.com/event4u-app/agent-config/commit/2d339519eee0dd84b4b876de8222e5503c08d04c))
* **tests:** drop two dead symbols left by the py2ts parity teardown ([cfecb9d](https://github.com/event4u-app/agent-config/commit/cfecb9dd1466af91791ad60fcdb768a85ab5cf4f))
* **roadmap:** close council-integrity-followup, open the implementation plan ([6efce85](https://github.com/event4u-app/agent-config/commit/6efce8541f6e3ec48789d2e4dc6333adcfb8148d))
* **roadmap:** archive install-lifecycle and re-depth its moved links ([6790d85](https://github.com/event4u-app/agent-config/commit/6790d857c0869cf2d08c8d74c149d94dcf0a346b))
* **tests:** drop the dead tail in the discovery-manifest test ([fe258f9](https://github.com/event4u-app/agent-config/commit/fe258f9da91b594f06837694619a5f6934e5a0dc))
* **roadmap:** archive the authoring-contract roadmap ([4aea8f7](https://github.com/event4u-app/agent-config/commit/4aea8f7a241a063ed371edd1f53fad31e56340a4))

### Other

* **council-integrity:** re-bind after merging origin/main a second time ([dd58e0c](https://github.com/event4u-app/agent-config/commit/dd58e0c7c46c27ec0784621096c7f091fd29c44e))
* **council-integrity:** re-bind after merging origin/main ([eb84ecb](https://github.com/event4u-app/agent-config/commit/eb84ecb6c0bee33c4d9ec43b85b50493badf4b26))
* **council-integrity:** re-bind the findings artefact to the fixed scope ([267ff3f](https://github.com/event4u-app/agent-config/commit/267ff3f3b4dae46a82bc38a4d1399d93b0304e57))
* **council-integrity:** record R2 completion-review findings before any fix ([ccf6650](https://github.com/event4u-app/agent-config/commit/ccf6650bbe7287a92e58177d6fe9ef8fc1cbb6a3))

Tests: 13068 (+133 since 9.33.0)

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
