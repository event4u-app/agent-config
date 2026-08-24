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

## [14.11.0](https://github.com/event4u-app/agent-config/compare/14.10.0...14.11.0) (2026-08-24)

### Release highlights

<!-- Curated head: fill before merge, keep it under 10 lines, and leave `_none_` where it is genuinely the answer. The generated log below is unchanged. -->
- **Behaviour changes:** _auto-derived, rewrite before merge:_ rule/schema diffs, breaking commits or removed public surface in 625002e, 8cc71ba, 990ba0f, 04609d9, 6fa1005, f8dbcee +13 more.
- **Default changes + migration:** _auto-derived, rewrite before merge:_ commits naming a default, migration or migrate in 40ac22c, 6bca87c.
- **Security and correctness:** _auto-derived, rewrite before merge:_ security-scoped commits or fixes to executable surface in 1eb4259, 52f675c, 4b1c1e9, 330ed37, 8cc71ba, 73a8040 +25 more.
- **Honest nulls:** _auto-derived, rewrite before merge:_ commits recording a null, waived or falsified result in 4442a81, 3374443, 33464b5, 6079797, 7ca2809, ff73698 +9 more.
- **Known limitations:** _none_

### Features

* **skills:** declare where a skill may write ([f8dbcee](https://github.com/event4u-app/agent-config/commit/f8dbceeadb5ca679045d4e690c07c8678449ea7c))
* **gates:** one citable enforcement denominator, with its frame ([7b91b7a](https://github.com/event4u-app/agent-config/commit/7b91b7a614c2fb1bbf801729275097f2baf900be))
* **gates:** ratchet the wall clock out of check_/lint_ scripts ([c6547fb](https://github.com/event4u-app/agent-config/commit/c6547fbef0c2d404ae81c796e8881d08367effa1))
* **gates:** resolve "now" through one asOf() seam ([08b548b](https://github.com/event4u-app/agent-config/commit/08b548bbd3e439a55f2b14c58c294285383ad0e9))
* **fidelity:** land the scroll-narrative surface and close the roadmap ([3374443](https://github.com/event4u-app/agent-config/commit/33744432940e9ec234c7761bca460e145d599300))
* **design:** surface-job axis, source-led port, craft floor, /design router, pack-reach ADR ([b4a3567](https://github.com/event4u-app/agent-config/commit/b4a3567f2956537bac74ca025e9625286e9eebbc))
* **council:** CLI least-agency parity, proven where it could be proven ([33464b5](https://github.com/event4u-app/agent-config/commit/33464b542a1c60aea946a143e395ca35d566a45a))
* **council:** whether the seats agreed is a field on quorum_result ([5c50c82](https://github.com/event4u-app/agent-config/commit/5c50c82f7306f278c46c21dedd9e722e1edc7f8e))
* **council:** recorded findings-parse corpus and its rate row ([2ff546e](https://github.com/event4u-app/agent-config/commit/2ff546eb45ee6dd208c35e2f3a746b85727f38eb))
* **bench:** score the four endpoints, and leave the default where it is ([6bca87c](https://github.com/event4u-app/agent-config/commit/6bca87c4cdec5b27b932f0f27b4a3ed3c2ad380d))
* **ai-video:** calibrate the modeled cost against what was actually charged ([c08e0dd](https://github.com/event4u-app/agent-config/commit/c08e0dd11bff5a50e4225271ee0693ff957b172c))
* **ai-video:** manifest schema v2 — the frame axis the tree already implied ([e520fe6](https://github.com/event4u-app/agent-config/commit/e520fe6c41b251dc90b85311b952dc6c7f241a37))
* **monorepo:** ship the workspace facts the UI lane needs ([a332515](https://github.com/event4u-app/agent-config/commit/a33251548e6b6279a44fd0dbe7f4f279643a3233))
* **work-engine:** route the UI lane through the detected scope ([771bb60](https://github.com/event4u-app/agent-config/commit/771bb60d5455c69d6deaabf53fa3f5910f128dac))
* **work-engine:** detect the monorepo shape that exists in the wild ([b8e1f8c](https://github.com/event4u-app/agent-config/commit/b8e1f8cdaf04f25226ca28c84d5d65e4622568f8))
* **evidence:** the deterministic tiering arm, and both nulls it produces ([d5fa8a9](https://github.com/event4u-app/agent-config/commit/d5fa8a9fb2fcb76f41e236ee42624781dd39e159))
* **hooks:** design pass on post_tool_use and stop; ui-audit-gate names a carrier ([19373c8](https://github.com/event4u-app/agent-config/commit/19373c8b019feb2d3ce6e9bda5eae7f91b758f72))
* **rules:** pin the normative fraction of a rule body with `norm` ([b8adf41](https://github.com/event4u-app/agent-config/commit/b8adf41b61769bf8bb58a014e2b3b43a52a52ca7))
* **skills:** ratchet skill-trigger coverage, and seed tranche 1 from Tier B ([741909e](https://github.com/event4u-app/agent-config/commit/741909ea934f65c7b3f2f839556b4ef6b8d6ece7))
* **assurance:** pre-register the four enforcement thresholds, all null ([c2929f0](https://github.com/event4u-app/agent-config/commit/c2929f01d98b09fef5bae3779124a6e9f9d89c93))
* **assurance:** register the capability vocabulary as a naming contract ([4474760](https://github.com/event4u-app/agent-config/commit/447476070fcc80c22b2151df25951dc1874edda0))
* **hooks:** rule-inject — the delivery twin of skill-route ([4b400d9](https://github.com/event4u-app/agent-config/commit/4b400d94f1751e6ea613f6dfe9a76f0668ebfc6f))
* **rules:** add R-A12 finite-resource readiness to scale-discipline ([a483088](https://github.com/event4u-app/agent-config/commit/a483088c1f6d5cba042b66230c439ebcf23fc7ec))
* **skills:** add server-hardening for the one genuinely ownerless gap ([a6ec440](https://github.com/event4u-app/agent-config/commit/a6ec44036411fb38843885f926a4b53923213b5e))
* **projection:** a third projection mode, and the residue it cannot deliver ([b5a0277](https://github.com/event4u-app/agent-config/commit/b5a02778e85a02fb992f0e8278bb210d7cc92c29))
* **skills:** add operational-readiness -- an enum with a floor, never a score ([88e6550](https://github.com/event4u-app/agent-config/commit/88e65506239c689412bf689bb2317e6068136de2))
* **rules:** one matcher for offline pricing and runtime delivery ([26a4b6f](https://github.com/event4u-app/agent-config/commit/26a4b6f0100617d24718e45f014d0ff12f0dda29))
* **ai-video:** a continuity path beside the hard cut ([b669dcc](https://github.com/event4u-app/agent-config/commit/b669dcca628ede60ff468ea9c644aba1c66df912))
* **install:** add projection.mode tiered, and name the other lever beside it ([3fe3f17](https://github.com/event4u-app/agent-config/commit/3fe3f1791d3c4b048bfccdde9b1580ed4841baf1))
* **ai-video:** frame-lock probe, seam-score diagnostic, cost calibration loop ([1a7b3fc](https://github.com/event4u-app/agent-config/commit/1a7b3fc842614d48ee846138d34d1d7027f5ca6f))
* **gates:** lint_adapter_tier — a stable tier must resolve to dated evidence ([fd757fe](https://github.com/event4u-app/agent-config/commit/fd757fe86217c0b5207707b96a6680274a62fcdf))
* **ai-video:** reviewer-reachable trace index, ASSUMED census, dated traces ([840558c](https://github.com/event4u-app/agent-config/commit/840558c9c690a225bf1fc6d5881c1f7747440ca9))
* **cli:** ui:audit and ui:render as Class-A commands ([90bcac3](https://github.com/event4u-app/agent-config/commit/90bcac372d14ad88e2e35a014d44537d5d535217))
* **lint_handoffs:** guard the scoped-dangle instrument before counting ([57ea17d](https://github.com/event4u-app/agent-config/commit/57ea17d43a7f12c70aabbe7d62f7c1e6c4137add))
* **skills:** add alerting-doctrine -- what earns a page, stated neutrally ([b258448](https://github.com/event4u-app/agent-config/commit/b2584485476c79b730fa3a29b696e8f5265963c3))
* **skills:** restate logging-monitoring as an observability capability model ([c6cd05d](https://github.com/event4u-app/agent-config/commit/c6cd05d32c75e940ff62a95452ffe5c8b8605910))
* **hooks:** re-read advisory rides the hot-context cache, advisory only ([f3b3d9a](https://github.com/event4u-app/agent-config/commit/f3b3d9a80b5de784ec9831eebd4a38904e6ae2e9))
* **scripts:** rank token sinks with the denominator published in-band ([30df524](https://github.com/event4u-app/agent-config/commit/30df524e811381ac803d2099ea216b6f58e13826))
* **scripts:** measure in-leg re-reads over the transcript store ([d004f2c](https://github.com/event4u-app/agent-config/commit/d004f2c23d648c70c9a26cb0b8bbe1bc7ea9d4e2))
* **mcp:** index trigger prose, and stop the recovery tool returning Tier A ([c501e51](https://github.com/event4u-app/agent-config/commit/c501e515617375cf409a8bd2b1607728229a8ba7))
* **skills:** compute the host-listing tier split, with the order that produced it ([358c700](https://github.com/event4u-app/agent-config/commit/358c70096a94e704b6d5af88b622f1b130866935))
* **roadmap:** mid-run context refresh, four reactions, superseded outcome ([fae147a](https://github.com/event4u-app/agent-config/commit/fae147afc6f4ed8add1ce551bda54f443708b701))
* **install:** register the MCP server in .mcp.json so the Iron Law is fulfillable ([e6de039](https://github.com/event4u-app/agent-config/commit/e6de039ce499a32273288aae7d63fbec0392693a))
* **ui:** one ui_authority object — schema, resolver, contract ([f83d342](https://github.com/event4u-app/agent-config/commit/f83d34279c9e6426f8defefddfca748eac79d30e))
* **lint_media_policy_linkage:** parity pass for adapter lifecycle tags ([4f2e644](https://github.com/event4u-app/agent-config/commit/4f2e6442be5aee2636f1ec3e1ca440f1582b46ba))
* **fidelity:** make the static-scoped verdict readable and register the render skips ([a49cd85](https://github.com/event4u-app/agent-config/commit/a49cd8589f68fe2e2643d84132aa3ccfb7860185))
* **release:** give the shipped Augment manifest version an owner ([67d42d6](https://github.com/event4u-app/agent-config/commit/67d42d6c193d1197ebac407ccd70d392b69fe959))
* **fidelity:** wire the deterministic token_violation channel and bound the ad-hoc loop ([71e24d4](https://github.com/event4u-app/agent-config/commit/71e24d4d4646d8eb407312f699abb5c4fd38fb69))
* **ci:** report the per-PR standing-payload delta against the merge-base ([438955a](https://github.com/event4u-app/agent-config/commit/438955a3f9aa242c35a8be38f99ea7f8e8c0baa4))
* **lint_archived_skills:** rule 6 — a skill cannot leave the tree unnoted ([8c318c1](https://github.com/event4u-app/agent-config/commit/8c318c1cd8aa44bd7139399e020123ce1eabeaa5))
* **roadmap:** declare relations with a ratcheted relates: field ([64fd5aa](https://github.com/event4u-app/agent-config/commit/64fd5aa484dfd48b9dd18028363122779ad544a3))
* **evidence:** model the host listing budget and pin the two baselines ([aee8172](https://github.com/event4u-app/agent-config/commit/aee8172b92b95bc68cf1195e80e85fb2045672c4))
* **mcp:** serve two read-only skill-discovery tools on the turnkey server ([3897015](https://github.com/event4u-app/agent-config/commit/3897015ddf3e839e90cf483fa57a889ba464a50e))
* **mcp:** single-source the skill-relevance formula in src/shared ([a9f7375](https://github.com/event4u-app/agent-config/commit/a9f7375ad32990dcc827b2acd543af3aaef09aaf))
* **lint_handoffs:** scan every SKILL.md body for dead cross-skill links ([ee23890](https://github.com/event4u-app/agent-config/commit/ee238904307467e6de871aa6864c043871b2f481))
* **sessions:** add owned_paths, the third collision axis ([adda28b](https://github.com/event4u-app/agent-config/commit/adda28b039f05690d880391e3a7622fa405bf981))
* **fidelity:** inventory the frontend fidelity assertions and pre-register the falsifiers ([bfb17cb](https://github.com/event4u-app/agent-config/commit/bfb17cbfe8903b071219c7b8d4a9356d8af95f22))
* **roadmap:** add the roadmap:context situational-awareness probe ([c228df9](https://github.com/event4u-app/agent-config/commit/c228df9ea549eaf431177948e41346e0249d73a0))
* **library:** publish a registry, and inventory what the library owns ([a622b4b](https://github.com/event4u-app/agent-config/commit/a622b4b55e86bce13be331b1cea96fec835044d4))
* **library:** storybook-workshop — one concept per story, and one a11y finding without a browser ([27436da](https://github.com/event4u-app/agent-config/commit/27436da327ce0c9e67aaa547fc9579de95b4804e))
* **library:** js-library-packaging reads the package surface, and never builds ([bab97ce](https://github.com/event4u-app/agent-config/commit/bab97ce5d5e9c7f5bd683aadc1763258cb13d0b5))
* **ui-lane:** the repository's own procedure goes ahead of the stack skill ([2a9d41b](https://github.com/event4u-app/agent-config/commit/2a9d41b542f8cf9d603a9c551120fe991a22e7d3))
* **playbooks:** consumer-side staleness gate, with both remediations and no third ([0aede41](https://github.com/event4u-app/agent-config/commit/0aede41394f2d953aee5c212ce28ae10de44b2d1))
* **playbooks:** playbook precedence, router hint, and the 4.1 pre-registration ([432b422](https://github.com/event4u-app/agent-config/commit/432b422ca5c90dfc436760f35e715fed68779fa2))
* **playbooks:** per-workspace AGENTS.md points at its playbooks, never restates them ([55fea90](https://github.com/event4u-app/agent-config/commit/55fea90184a39df1c9af144a70d0b454845f6121))
* **playbooks:** playbook-authoring derives graded playbooks from the real config ([09c5d83](https://github.com/event4u-app/agent-config/commit/09c5d83423bbe53d64974a3d00fb285032eb63d5))
* **design-fidelity:** artefact maturity is a second axis, not instruction mandate ([55d0dcd](https://github.com/event4u-app/agent-config/commit/55d0dcd6be756c45bcfe4c34f9d84a7321eb6eca))
* **templates:** the playbook template, and close Phase 0 + 1.1 ([c77c68c](https://github.com/event4u-app/agent-config/commit/c77c68c0112740db50b48512a7b0f9b6d7837d8f))
* **review:** warn when a captured judge prompt states an expectation ([e7829aa](https://github.com/event4u-app/agent-config/commit/e7829aaabe6bf797661121e53343ce73f22d8d96))
* **review:** add the author-relation axis, and a second producer for the record ([f85a50a](https://github.com/event4u-app/agent-config/commit/f85a50aa1628711bd741fff01a2d2c24a9281fd1))
* **review:** route /review:changes to a reviewer with no implementation context ([70422cf](https://github.com/event4u-app/agent-config/commit/70422cf4964c0b1f35283a4acba92d1a7f978b70))
* **doctor:** report override delivery, and refuse the efficacy vocabulary ([8bdc2a3](https://github.com/event4u-app/agent-config/commit/8bdc2a353ba37b960204a4fcee7bda79165c5792))
* **overrides:** generate the precedence table and wire both checks into CI ([298658f](https://github.com/event4u-app/agent-config/commit/298658fb35f29b666be636ef32fa7172d5eaf123))
* **assurance:** nightly R3-rate drift metric for the risk classifier ([dbc9f01](https://github.com/event4u-app/agent-config/commit/dbc9f01727bb5db5fbc6a4802d6f4a73236bbdec))
* **assurance:** deterministic risk classifier, no model call ([f506416](https://github.com/event4u-app/agent-config/commit/f506416decaeac435fff8791cf25188c1856cbe0))
* **mcp:** fingerprint third-party MCP tool definitions ([b540909](https://github.com/event4u-app/agent-config/commit/b5409094cf6bf3661d30d407ea874bb7346696cb))
* **bench:** make the per-turn composite arming precondition evaluable ([ee7af9c](https://github.com/event4u-app/agent-config/commit/ee7af9c8de0b562c4c1d3436025e6b657374c6a9))
* **analyze:** grade a target repo's assurance readiness, min over knockouts ([3b345e1](https://github.com/event4u-app/agent-config/commit/3b345e1836d87912303b88d0436ba05e23fb6dd0))
* **gates:** a partial pack-conformance fixture harness, honest about the gap ([dba7f7f](https://github.com/event4u-app/agent-config/commit/dba7f7fa50dfa792d9651fbdaa2a809ee98b7f85))
* **gates:** ratchet the settings key space shut against auto-merge ([279b82f](https://github.com/event4u-app/agent-config/commit/279b82f969e69870d93e8bec9ea71b2089be1a83))

### Bug Fixes

* **gates:** route lint_adapter_tier through asOf, restate the superseded § 5 pins ([1eb4259](https://github.com/event4u-app/agent-config/commit/1eb42593c2c0da88e9d3cccbdce8f286be6983ef))
* **merge:** re-measure the size ratchet and the pinned listing sample ([52f675c](https://github.com/event4u-app/agent-config/commit/52f675cd6e7822220b020997c625f9acf07b4a8c))
* **merge:** recompile the manifest JSON and re-measure the size ratchet ([c046508](https://github.com/event4u-app/agent-config/commit/c046508ab4c473cdb2544cabab7346a0eeaf8c10))
* **evidence:** re-measure the backed-claims denominator on the merged tree ([905f59a](https://github.com/event4u-app/agent-config/commit/905f59a5b80330a3d6a7a4646e5be44ea60b6c14))
* **gates:** route lint_handoffs through asOf, annotate a non-denominator figure ([4b1c1e9](https://github.com/event4u-app/agent-config/commit/4b1c1e980763779b79da868337b594cdc99d5764))
* **gates:** wire check_standing_payload_delta locally, keep depth ratchet green ([625002e](https://github.com/event4u-app/agent-config/commit/625002e843f2a6b241feb03bf85cbfc3d41598ca))
* **gates:** regenerate proof.md and raise the framework-neutrality ceiling ([f5e0399](https://github.com/event4u-app/agent-config/commit/f5e0399f57ab5fedeb358a3f74923385e5d2cf1b))
* **ci:** rebuild the install bundle and regenerate the proof page ([330ed37](https://github.com/event4u-app/agent-config/commit/330ed3789d81d8afccb1347dbae6e7f53b435c1c))
* **hooks:** the P0 stop verdict is reported, not enforced — and say so everywhere ([8cc71ba](https://github.com/event4u-app/agent-config/commit/8cc71baa9da18d708e54599c8a1745fb952fef16))
* **build:** rebuild the install bundle without the worktree symlink path ([73a8040](https://github.com/event4u-app/agent-config/commit/73a8040403e922786446934a208bec717f9e6907))
* **cli:** drop the runtime edge from ui:audit into the work-engine template tree ([7a013c6](https://github.com/event4u-app/agent-config/commit/7a013c6fe3579c1ca3bc6031b960045c84747764))
* **secrets:** re-pin the gate-coverage canary allow-entry, 291 -> 306 ([9952efb](https://github.com/event4u-app/agent-config/commit/9952efb039dd08f7f9b8107533e41ac920c88b8f))
* **ci:** the downstream surfaces two new CLI verbs and a settings key touch ([990ba0f](https://github.com/event4u-app/agent-config/commit/990ba0f0c71b1a9fd3a84564f9954d447cd45d13))
* **ci:** pay the three real CI failures — a fixture, a coverage floor, and the golden baselines ([f6b34ff](https://github.com/event4u-app/agent-config/commit/f6b34ff18b66984d1d19b4a6e63d07309a513a6b))
* **rules:** teach the enforcement-declaration gate the new spelling ([04609d9](https://github.com/event4u-app/agent-config/commit/04609d956a9246e94c1a72c16dd2c11de5b85e13))
* **ci:** re-anchor thin_rule_load as a definition change, repoint the A1 ledger rows ([7bc0c3b](https://github.com/event4u-app/agent-config/commit/7bc0c3be8da05fe27b56fb36d3a5a057976ed0f7))
* **skills:** move the scope-verification check off the 4,742-line linter ([34863a4](https://github.com/event4u-app/agent-config/commit/34863a41a5a82b700025e2c52faab90034066001))
* **ai-video:** make the two CI-only failures impossible, not skipped ([8320c50](https://github.com/event4u-app/agent-config/commit/8320c5024e1015a2c5a1b7a3bdae5840e24d509d))
* **ci:** satisfy skill-lint, the leakage carve-out and the trace floor ([6fa1005](https://github.com/event4u-app/agent-config/commit/6fa1005e53b9e7ef8974cfa673c2f315bff74a13))
* **gates:** justify the trace index's missing cache-version namespace ([9c2252f](https://github.com/event4u-app/agent-config/commit/9c2252f19babbd9a99a806bd930d464fc1a3c9e8))
* **gates:** satisfy noUncheckedIndexedAccess in the two new gates ([3f31414](https://github.com/event4u-app/agent-config/commit/3f31414a7513ee36b211af7c5d9d3eef8f2fab7e))
* **lint:** clear four ESLint errors on the new TypeScript ([6cc2c03](https://github.com/event4u-app/agent-config/commit/6cc2c03686e146af9a28819f5297e4b606b18f67))
* **claims:** reword census counts out of the artefact-count anchor shape ([81d2921](https://github.com/event4u-app/agent-config/commit/81d2921868f6f66c5f929d89f4129c13c5b13102))
* **hooks:** make the design-pass concern synchronous, as ConcernMain requires ([952e6b9](https://github.com/event4u-app/agent-config/commit/952e6b9a15df01601efcefa910dc71a801d4f838))
* **secrets:** move the gate-coverage PEM-canary allow pin 291 -> 301 ([c6efb63](https://github.com/event4u-app/agent-config/commit/c6efb633e16ff8ed2608fcffcfaecc1f199220eb))
* **contracts:** re-point the migration-ledger anchor after § 5 was regenerated ([40ac22c](https://github.com/event4u-app/agent-config/commit/40ac22c05124e3764d72f0a36926924559bf3833))
* **lint_archived_skills:** drop a retired-path literal from the rule-6 note ([a7f5f00](https://github.com/event4u-app/agent-config/commit/a7f5f00accd500a9381023be8e17129041992509))
* **types:** a tiered install is already narrowed, and CLI opts respect exactOptional ([34312a9](https://github.com/event4u-app/agent-config/commit/34312a90b451c5f4e96769f7acff384b02188fea))
* **assurance:** two CI reds this change caused, both fixed at the cause ([d2b534d](https://github.com/event4u-app/agent-config/commit/d2b534d5cf5e1486660939b652309563dfe9dabe))
* **ai-video:** keep /video:from-script's argument-hint under the 120-char cap ([d781599](https://github.com/event4u-app/agent-config/commit/d781599f50d1d266a5400927a87b992d94967e1e))
* **fidelity:** type the evidence artefacts and re-anchor the drifted citations ([b676a38](https://github.com/event4u-app/agent-config/commit/b676a38c8b0934f6eda18c148dbd408d31475cc1))
* **council:** satisfy exactOptionalPropertyTypes on the new surfaces ([cc884f6](https://github.com/event4u-app/agent-config/commit/cc884f6ac1092562ff6d906143049e0f1b7e1a51))
* **council:** a member whose answer no parser could read is present-unparsed ([987ba8a](https://github.com/event4u-app/agent-config/commit/987ba8abbdf3607f460214c2bb9fc94e46a73a6c))
* **gates:** lower check_requirements_trace's floor off the exact live count ([ae88cb3](https://github.com/event4u-app/agent-config/commit/ae88cb3149669088cf9df092c2092c602f4bdbdf))
* **rules:** close missing-skill-recovery's unreachable-tool branch ([1bfdfc3](https://github.com/event4u-app/agent-config/commit/1bfdfc35a0aec99a6d9f034dcee3fe7bfd620cbc))
* **mcp:** stop citing a superseded ADR from the stdio dispatcher ([243c363](https://github.com/event4u-app/agent-config/commit/243c363589139ea1efccafd3ad3bb6be9b5cba77))
* **design:** scope T7 and T8 by register so the Inter contradiction resolves ([5b54933](https://github.com/event4u-app/agent-config/commit/5b54933f51f1c0dbae47e647c6e5b2aaac142207))
* **roadmap:** correct the MCP roadmap's R2 token figure to a reproduced one ([26ad410](https://github.com/event4u-app/agent-config/commit/26ad410284ac0c5a985eb7c944eb2b6485ff2d51))
* **skills:** repair all 16 dead cross-skill links by provenance ([fbf081b](https://github.com/event4u-app/agent-config/commit/fbf081b71f0a3ed098e5cee61a85536daadae8c6))
* **gate:** split the import procedure out of design-system-capture, resync counts ([b1a2eb9](https://github.com/event4u-app/agent-config/commit/b1a2eb9b937822679de2d066a34e2079bf183f03))
* **docs:** regenerate proof.md — I hand-edited a generated page ([dc4a9f1](https://github.com/event4u-app/agent-config/commit/dc4a9f11e5a8de72a05daf9d98d7bbb46b855149))
* **playbooks:** cite ADR-244 by number — a rule body may not link outside the projection ([29b9f2e](https://github.com/event4u-app/agent-config/commit/29b9f2efebad4d52318b5213b861a7e3e2ccf6c1))
* **gate:** re-anchor the activation census for playbook-precedence ([9684e25](https://github.com/event4u-app/agent-config/commit/9684e25ae72ad2fd0bb7ea9b21b5ffd72b72bd48))
* **playbooks:** consumer-safe skill text, and the four generated surfaces one skill moves ([00914bc](https://github.com/event4u-app/agent-config/commit/00914bc0b3d5b367d7d24670f815d94a99f2d9e2))
* **gate:** state the design-fidelity ceiling raise the second axis needs ([708fc0b](https://github.com/event4u-app/agent-config/commit/708fc0b3b8ad55ad559cd7ac31460b8279fce6ad))
* **design-fidelity:** fit the migrated maturity section under the depth ceiling ([a6e0829](https://github.com/event4u-app/agent-config/commit/a6e08297684f6d7bc654fc589919fbd69ffa67a9))
* **gate:** split the asset & imagery discipline out of design-fidelity-mechanics ([178b892](https://github.com/event4u-app/agent-config/commit/178b8923563fc22209baf69cdaeffba1bbd5b6cb))
* **templates:** the playbook template's frontmatter is the PLAYBOOK's, not its own ([558f29a](https://github.com/event4u-app/agent-config/commit/558f29a861f0a806e31c05874d9bd0e32a0b32f2))
* **gate:** set the size baseline to the merged tree total (18,571) ([72116ed](https://github.com/event4u-app/agent-config/commit/72116ed5208394bb3c3c189b5618056692f02962))
* **skill:** drop a bare src/scripts/ path from the shipped skill ([15d1318](https://github.com/event4u-app/agent-config/commit/15d131871a088a0e86b4469a5710a226d5c5802b))
* **council:** distinguish a parse failure from a clean zero-findings review ([c6ac33a](https://github.com/event4u-app/agent-config/commit/c6ac33a4eee98731513ab1f991061416a2807c0e))
* **council:** attribute peer review per reviewer, and seed the label order ([7c4a19d](https://github.com/event4u-app/agent-config/commit/7c4a19d363e28c95e6818a0ac7575f3b18073fc6))
* **gate:** re-anchor the size baseline onto main's floor after the merge ([5d51fc4](https://github.com/event4u-app/agent-config/commit/5d51fc4487276f6228c0de00e8e9aaa404b2c061))
* **hooks:** correct the cause recorded for the rtk wrapper's advisory degradation ([89c38cf](https://github.com/event4u-app/agent-config/commit/89c38cfd8f579375ad11b405bab0df03a7a26f4f))
* **ci:** declare the nightly drift gates as CI-only ([85d4f7d](https://github.com/event4u-app/agent-config/commit/85d4f7d404852d02d253fc407b17a590dbbd85d8))
* **gate:** set the size-budget baseline to the exact live total ([87e4611](https://github.com/event4u-app/agent-config/commit/87e4611f52365446da5be369b91463f813ac812c))
* **test:** type the absent-vs-null case under exactOptionalPropertyTypes ([457ceb1](https://github.com/event4u-app/agent-config/commit/457ceb115fa4d70d2de5326ea70de74c44387ee5))
* **ci:** drop matrix.os from the artifact name — that job has no matrix ([d72e9b4](https://github.com/event4u-app/agent-config/commit/d72e9b49ef091a003769c89210461dcb1cf37c6d))
* **gates:** harden check_composite_arming's scan scope, and stop the report gating ([207103c](https://github.com/event4u-app/agent-config/commit/207103cab0782b627a824a835d02184e38579f13))
* **ci:** SHA-pin upload-artifact, and stop citing a file that does not exist yet ([3b88112](https://github.com/event4u-app/agent-config/commit/3b88112996ad500d525e8b96ed0a0311571c737f))
* **gates:** satisfy exactOptionalPropertyTypes in the readiness grader ([8153f21](https://github.com/event4u-app/agent-config/commit/8153f2175fe92107bfe95f190c03e6491dfacbb9))
* **gates:** re-pin the gate-coverage secret-allow entry to line 291 ([dc10388](https://github.com/event4u-app/agent-config/commit/dc10388b7bd042ae09b58412995b85d87c30b67e))
* **roadmap:** stop a narrative heading from parsing as a phase ([3be678c](https://github.com/event4u-app/agent-config/commit/3be678c248c5d87a69cbfb5e12cf5119b32a4822))
* **gates:** re-pin the gate-coverage secret-allow entry to line 282 ([e991a1c](https://github.com/event4u-app/agent-config/commit/e991a1c0bddf1bb4528861e389d4733011134121))

### Performance

* **hooks:** take the tokenizer out of every dispatch — cap in bytes ([366d27f](https://github.com/event4u-app/agent-config/commit/366d27f21ebc60f1bd292ab600fd9f5321b57fdf))

### Documentation

* **evidence:** record the third PR-drain pass (2026-08-23/24) ([b3b9858](https://github.com/event4u-app/agent-config/commit/b3b9858b5e54af205418cd2d654d7c87d7fdecab))
* **evidence:** record Run D — the full-estate drain, 15 roadmaps ([5a79585](https://github.com/event4u-app/agent-config/commit/5a795854bcb8342573c0e5dbce2ccc74b598c45d))
* correct the latency figure everywhere it landed, and record why it moved ([04c39c5](https://github.com/event4u-app/agent-config/commit/04c39c51973c878d138bb7ec89b51d7a154d31de))
* **stub:** record the language-pin short-lead defect, both directions ([9c43251](https://github.com/event4u-app/agent-config/commit/9c43251d24ef39706c4a3edfc4e4c7a6ec34443f))
* **roadmap:** close deterministic-time-in-gates, minus one criterion ([d30306c](https://github.com/event4u-app/agent-config/commit/d30306c52c52ab27e3cfb494c9a378a0a0766908))
* **harvest:** land the four routed-out items in their named destinations ([9d08e09](https://github.com/event4u-app/agent-config/commit/9d08e094f3a7084a3a251821181af096955e58c8))
* **gates:** qualify the hook-bundle mtime green, ordering is not equivalence ([25908b3](https://github.com/event4u-app/agent-config/commit/25908b3005d08980234540d7875a0197128fd334))
* **rules:** five amendments — A1 through A5 ([ea5d563](https://github.com/event4u-app/agent-config/commit/ea5d56338bbb1aaf07eb7fb6f7e83dc2ab375907))
* **adr:** disclose ADR-245's evidence basis ([d38bef4](https://github.com/event4u-app/agent-config/commit/d38bef4f996d4fbf3aa7a9b5dc349abf78e716a8))
* **roadmap:** close skill-delivery-over-mcp at measured-null and archive it ([eeb5717](https://github.com/event4u-app/agent-config/commit/eeb5717d7f1e90bbf5accee37ad0a010d43dde3b))
* **evidence:** re-measure the diet after merging main — delta invariant ([7425269](https://github.com/event4u-app/agent-config/commit/742526982ff47f62c7be08dddc6450e66c69a1d3))
* **roadmap:** close chained-clip-continuity-and-provider-truth 30/30 and archive ([6079797](https://github.com/event4u-app/agent-config/commit/6079797eb374743cd26c97e0ef849410cdcab3ee))
* **roadmap:** close standing-payload-diet — both blockers, one descope ([a232e12](https://github.com/event4u-app/agent-config/commit/a232e12c921401b687327dbad82362285ba600e5))
* **roadmap:** close monorepo-scope-and-detection, 17/17 with four premise defects ([bced98e](https://github.com/event4u-app/agent-config/commit/bced98eddab50f909bdb39220380d0b57e884716))
* **existing-ui-audit:** components.json lives at the workspace root ([2493055](https://github.com/event4u-app/agent-config/commit/24930556a4753abb386df0e3d97d434a95574c39))
* **evidence:** record M1/M2/M3, the council null, and the deferral disposition ([7ca2809](https://github.com/event4u-app/agent-config/commit/7ca28097f6a0a70b1ab64faedd2d7fab4cf9f0c1))
* **roadmaps:** close agentic-engineering-assurance and archive it ([ff73698](https://github.com/event4u-app/agent-config/commit/ff73698ec66874f3743c9c9c0fcf035e28ad92db))
* **roadmaps:** transfer Phase 8 to an assurance-benchmark stub ([55feb4d](https://github.com/event4u-app/agent-config/commit/55feb4d4c8f280373a180f345cfcb4c6336962f7))
* **roadmap:** discharge all 12 steps and 8 criteria, archive the plate ([8e62695](https://github.com/event4u-app/agent-config/commit/8e626950f01d65533b9fc98ef8d95f03f81a69b7))
* **roadmap:** close and archive skill-link-integrity-and-manifest-sync ([37922af](https://github.com/event4u-app/agent-config/commit/37922afd48eb681f640f3e8f2abb717c9015df6b))
* **evidence:** pre-register the seam-score falsifier before any data exists ([3664d47](https://github.com/event4u-app/agent-config/commit/3664d47203ebdb2a266b7b58783b60e27819883f))
* **evidence:** the drain-run evidence and the Phases 1-2 cancellation stub ([e8de228](https://github.com/event4u-app/agent-config/commit/e8de2289c185d6c3019f85966646aceadde34f95))
* **roadmap:** reconcile the loop size budget, record the --all exception ([1ef3050](https://github.com/event4u-app/agent-config/commit/1ef305021cf8fd42b17be986068e388ef3a5cc13))
* **bench:** pre-register the frontend metrics, census the locks, freeze the baseline ([4a7762d](https://github.com/event4u-app/agent-config/commit/4a7762d8c07a19f2cd07f883996062f6bd9ef7f8))
* **evidence:** re-derive the standing-payload inflow attribution ([2024d47](https://github.com/event4u-app/agent-config/commit/2024d47c7da7c95b5f5a010c11f381b4bb52e958))
* **evidence:** pin the link census and mark the day-one tier table historical ([05e6e55](https://github.com/event4u-app/agent-config/commit/05e6e55c8162f252ace51465f6ce8b5201911d5c))
* **roadmap:** resolve b-plate-vs-skill-sprawl via AI council 2/2 ([9a3b3f5](https://github.com/event4u-app/agent-config/commit/9a3b3f5dfe3f7939ec9d2270191bde42f674988e))
* **evidence:** record the 2026-08-23 PR drain run ([39671e5](https://github.com/event4u-app/agent-config/commit/39671e53001f11af16e39032b19dd0dd207d17db))
* **roadmap:** component-library Phase 2 closed with its null; generated surfaces resynced ([aedfff8](https://github.com/event4u-app/agent-config/commit/aedfff83e8ceea2d0b203732de8a1f1c3f7fefc2))
* **evidence:** Run C — frontend-priority continuation, 3 PRs, 3 council decisions, 5 self-caught defects ([ff9cb06](https://github.com/event4u-app/agent-config/commit/ff9cb06600901e1200df2aaac1673f7ce96e70c8))
* **library:** the pre-state, measured off the skills' own text ([d3d72ba](https://github.com/event4u-app/agent-config/commit/d3d72ba7010764c522683669e5c61fd28d5f8aaf))
* **roadmap:** repo-playbooks complete — 4.2 published, 6 AC discharged, archived ([bfd11e8](https://github.com/event4u-app/agent-config/commit/bfd11e863da07a528d029e29293fbf0ec852b538))
* **roadmap:** frontend-fidelity Phase 0 closed, two council blockers resolved ([0779abb](https://github.com/event4u-app/agent-config/commit/0779abbd7e8a72133b4e998e0eca7b9d1bbd5329))
* **adr:** ADR-244 — a playbook is a sixth context type, not a new artefact class ([929df92](https://github.com/event4u-app/agent-config/commit/929df926b92d6e88a898553e22ca2c19619bdc44))
* **evidence:** the second drain run of 2026-08-23 — 10 PRs, 8 roadmaps closed ([1a06d9b](https://github.com/event4u-app/agent-config/commit/1a06d9b1a2721b666601cf9daf73562a73c05aa9))
* **roadmap:** close and archive road-to-review-independence ([88efb3b](https://github.com/event4u-app/agent-config/commit/88efb3b02caa1481a14d7cb52b20355f18dc5482))
* **evidence:** rotation returns a null; consensus-confidence handed to its owner ([6c07e00](https://github.com/event4u-app/agent-config/commit/6c07e008d074d303deda11e012cfadd3de7bd65e))
* **rules:** correct evaluator-independence's enforcement claims in both directions ([351c7bc](https://github.com/event4u-app/agent-config/commit/351c7bc7a445891e36b570aabef519111f4ada26))
* **roadmap:** close road-to-terminal-token-economy, and re-evaluate its own lock ([ee376f1](https://github.com/event4u-app/agent-config/commit/ee376f1de0b3ab6c134d83e81bcc82b139dd354d))
* **evidence:** choose the warn-only wrapper, and register the re-bench ([fc0d99e](https://github.com/event4u-app/agent-config/commit/fc0d99ee1753136ad56dd351ac642af5a0d0ff1b))
* **evidence:** the host DOES offer a transparent input rewrite — the shipped claim was wrong ([9412db9](https://github.com/event4u-app/agent-config/commit/9412db9165e264a9c29dcd4e365d1f94639072b0))
* **roadmap:** close road-to-override-efficacy-proof, carrying the unfunded run ([a89a093](https://github.com/event4u-app/agent-config/commit/a89a093e7445b7a2ee0ff7cd56502ad9322720a1))
* **roadmap:** transfer the human-corpus blocker to a stub and archive ([1d3ee12](https://github.com/event4u-app/agent-config/commit/1d3ee124d7ab571b364b482e90d5595bd345fe1b))
* **roadmap:** route road-to-target-project-assurance-readiness to its null ([6af4161](https://github.com/event4u-app/agent-config/commit/6af4161898b9360dc4708912b5fc7f2e492f80dd))
* **evidence:** publish the risk-classifier null with a numeric reopen threshold ([0b84ae5](https://github.com/event4u-app/agent-config/commit/0b84ae5cc79bae277a5fee78331e66a44dcac630))
* **evidence:** pre-register the risk-classifier comparison before any number ([d142988](https://github.com/event4u-app/agent-config/commit/d142988f29706bb7a0ae81e1c13ff12f239d48b1))
* **evidence:** record the parallel drain that shared this queue ([3bd0008](https://github.com/event4u-app/agent-config/commit/3bd0008944a662c5893e3d3e762ea0c5b932891f))
* **roadmap:** close and archive road-to-unowned-resume-conditions ([b460d82](https://github.com/event4u-app/agent-config/commit/b460d82b89d7e45814aaa5b200f37dfab9f32b48))
* **roadmap:** give both unowned resume conditions an owner and a channel ([96f3721](https://github.com/event4u-app/agent-config/commit/96f3721a0474e924b2155913937641e0f47c4b00))
* **evidence:** inventory every parked roadmap's resume condition ([4e429c4](https://github.com/event4u-app/agent-config/commit/4e429c43b8b4a20841ead208fc90071698fc4719))
* **evidence:** the background-task notification overwrites the git-authorization ledger ([5d1f2b6](https://github.com/event4u-app/agent-config/commit/5d1f2b660c8d8db0897891191edb68ff47597058))
* **roadmap:** close and archive road-to-release-publication-integrity at Phase 1 ([4e13188](https://github.com/event4u-app/agent-config/commit/4e13188aea62242adae6c5bd90c6b203c84bb3a3))
* **evidence:** the three Phase-1 artefacts for the publication guard ([8640bf2](https://github.com/event4u-app/agent-config/commit/8640bf2033038bce90128de86aae937964023c65))
* **roadmap:** close and archive road-to-mcp-runtime-integrity ([342f5ae](https://github.com/event4u-app/agent-config/commit/342f5ae96943337d8d3f00c20a5dd56dcbc12f93))
* **evidence:** record the MCP fingerprint slot measurement as a null ([4810385](https://github.com/event4u-app/agent-config/commit/48103851b5f37b827db148ceb1debb403f861bd4))
* **evidence:** declare the cost-comparison artefact's evidence type ([076c977](https://github.com/event4u-app/agent-config/commit/076c977498773c7103cc7680dcae27c9272433bd))
* **roadmap:** close and archive road-to-per-turn-hook-economy-carry ([4266fe9](https://github.com/event4u-app/agent-config/commit/4266fe9d1dad6c3690235131fd9dd85faa42bbce))
* **evidence:** measure the Stop async split's cost against its saving ([8e24c39](https://github.com/event4u-app/agent-config/commit/8e24c39782416873651fc1fbd5ea95efc19843d5))
* **evidence:** the fourth drain pass — #1572, and the detector that read no authorization ([9549297](https://github.com/event4u-app/agent-config/commit/95492974756a195eb831298ad2f5a8f01378e2e9))
* **evidence:** add the CI-only defect class to the drain-run summary ([c8e3f1e](https://github.com/event4u-app/agent-config/commit/c8e3f1e208759016b665fe02be9f461d889c3ecb))
* **evidence:** the drain-run summary — 8 PRs, 9 council sessions, 4 transfers ([52f9ff1](https://github.com/event4u-app/agent-config/commit/52f9ff1c79ed07afe289b61616d2e8ab4f6c0ac5))
* **roadmap:** defer the override-efficacy paired run on POPULATION, not budget ([42578d4](https://github.com/event4u-app/agent-config/commit/42578d4b62d2a395062249e89475ade32acb7130))
* **roadmap:** defer the rtk re-bench on SUBJECT, not on budget ([f521b43](https://github.com/event4u-app/agent-config/commit/f521b434de0834857617d364ce1c4a17c76916ae))
* **rtk:** make the 33% savings figure carry its own scope and staleness ([e09adbd](https://github.com/event4u-app/agent-config/commit/e09adbde7e1bf98b8f137e96b5f424c0a78bb0f1))
* **roadmap:** close Phase A1 of per-turn-hook-economy-carry ([b78d501](https://github.com/event4u-app/agent-config/commit/b78d5014c310051779378c4535a41c32dabaf1dd))
* **roadmap:** close Phase 1 of target-project-assurance-readiness, add its blocker ([89787c0](https://github.com/event4u-app/agent-config/commit/89787c0e63175b5a6465692ef19ba2b27a5a4fa9))
* **evidence:** record the 2026-08-23 PR-drain pass ([307a5e5](https://github.com/event4u-app/agent-config/commit/307a5e563d5ec4b198d5f4eba72097a42de32503))
* **roadmap:** record the parked disposition on road-to-mcp-runtime-integrity ([b51498b](https://github.com/event4u-app/agent-config/commit/b51498bf779159aee45d7d5bee504064158c6941))
* **roadmap:** close road-to-org-pack-fitness 16/16, Phase 3 cancelled ([44ef773](https://github.com/event4u-app/agent-config/commit/44ef7735b73164cd65d996e68a293b21a7ba442d))
* **stub:** record the agents/memory-quarantine layout red ([9af7395](https://github.com/event4u-app/agent-config/commit/9af7395aed27676b84c08b986f2bd2d7e0113640))
* **inbox:** triage the 14.10.0 reviewer drop, two roadmaps out of eleven ([7c54556](https://github.com/event4u-app/agent-config/commit/7c5455698906935ea5f4f9790580ac93493535c7))
* **roadmap:** close road-to-test-independence-and-mutation-evidence 13/13 ([3bab19e](https://github.com/event4u-app/agent-config/commit/3bab19e27a516540e576d2a2f2b9c53455793c59))
* **roadmap:** close road-to-merge-op-split-and-negation-guard 18/18 ([29898c7](https://github.com/event4u-app/agent-config/commit/29898c78963146943b490716a89d93a548d0c2a7))

### Refactoring

* **council:** one definition for each CLI agency bound ([6a2e722](https://github.com/event4u-app/agent-config/commit/6a2e72225af0a17a0fd3c648f72d60c94d2fecf0))
* **skill:** retrofit roadmap-writing as a router head ([3630245](https://github.com/event4u-app/agent-config/commit/36302452912d3573a98be5345cecab4d99f66b97))
* **rules:** retire the bare enforced_by "none" for instruction-only ([25489ef](https://github.com/event4u-app/agent-config/commit/25489ef7172d115789404d77743476655d36442b))
* **install:** extract the MCP bridge, and pay the size ratchet with it ([27adc67](https://github.com/event4u-app/agent-config/commit/27adc671a7439a21bb5abee53ab293eb55493e67))
* **council:** one scale for evidence quality, each survivor named ([6ed7296](https://github.com/event4u-app/agent-config/commit/6ed72961202dc0e68c8a463229f402728a09b392))
* **release:** extract both manifest-version writers to release_env ([afaa057](https://github.com/event4u-app/agent-config/commit/afaa05764cd2ab19c7f12c634e91be9c0d0a7f33))
* **rules:** diet three rule bodies, declaring `norm` on each ([daa328a](https://github.com/event4u-app/agent-config/commit/daa328ac322a8d676a22c19177b3551adf6112c7))
* **council:** pay for Phases 1-2 by extracting data carriers ([76c1352](https://github.com/event4u-app/agent-config/commit/76c1352afba847a71147ed97cb82dfdd444995a3))
* **doctor:** pay for the override check by extracting, not by bumping a baseline ([402989a](https://github.com/event4u-app/agent-config/commit/402989ac932b33b9e68359d30ff1e59a4aedb0d6))
* **release:** extract publication and env units out of release.ts ([71e6adf](https://github.com/event4u-app/agent-config/commit/71e6adff99c1e48d5e4576b13bd5631eedba1488))

### Tests

* **work-engine:** move the monorepo lane rows onto real fixtures ([559c629](https://github.com/event4u-app/agent-config/commit/559c62922dfe06c0d2b2eda280359923e0d84a8c))
* **stack:** add realistic monorepo fixtures with measured pre-state ([4a76722](https://github.com/event4u-app/agent-config/commit/4a7672231f9841b859247fc2b28c6856a6460db5))
* **ci:** make the delta gate's zero-delta case ref-against-ref ([c4e4572](https://github.com/event4u-app/agent-config/commit/c4e45723e4fb7a5b0bbb0e3a1b98069f43a023f0))
* **assurance:** pin two invariants that held but were unasserted ([d691d27](https://github.com/event4u-app/agent-config/commit/d691d2747f355d24f0064e90d8d19f475c1eb6ea))
* **eval:** freeze the frontend benchmark corpus before any engine commit ([34f7dc4](https://github.com/event4u-app/agent-config/commit/34f7dc4005607d6b400f076945cd4d21a1dbaedf))
* **observability:** land the plate contract test red ([2c89fd9](https://github.com/event4u-app/agent-config/commit/2c89fd9ac1a1c80fae28522373b510ba0fc2d9ff))
* **library:** a two-root package-surface fixture, and what it refuses to claim ([d9a7db6](https://github.com/event4u-app/agent-config/commit/d9a7db6d0cd6ac87b3428a782fa32dc6d712f948))
* **design-fidelity:** assert the maturity axis instead of only carrying it ([75a117e](https://github.com/event4u-app/agent-config/commit/75a117eff5001d6426ce7a277c674db4d6ac140c))
* **design-fidelity:** pin the wireframe maturity pair, baselines recorded pre-fix ([73b66cf](https://github.com/event4u-app/agent-config/commit/73b66cf4a6c38d0571f6f106341dcf4cca91583f))
* **playbooks:** the negative control — a generator the suite never reaches ([c317db1](https://github.com/event4u-app/agent-config/commit/c317db151235fca357d20a3420ecbbeedaeb5999))
* **overrides:** prove an override is delivered, discovered and named ([d168bd2](https://github.com/event4u-app/agent-config/commit/d168bd294c3a15379f66351b7e22111d45e6d4d2))
* **release:** give the drill a controlled changelog instead of the live file ([45f7657](https://github.com/event4u-app/agent-config/commit/45f7657832f76bd42f97034d8daa5552090309ca))
* **hooks:** pin the P3 call sites and the reset's negative control ([61f7e5f](https://github.com/event4u-app/agent-config/commit/61f7e5f105512b348a803922a0452e8d9d146d04))

### Chores

* **generated:** regenerate router.json for the new guideline route ([2b25398](https://github.com/event4u-app/agent-config/commit/2b25398420d47c8ce083bf5a9b2f9bc722efea31))
* **gates:** re-baseline the packed payload cap 8.4 -> 9.1, with the plan it defers ([cbc331e](https://github.com/event4u-app/agent-config/commit/cbc331e0b592a558c9c702b8b3bf4ae83488a5a1))
* **budget:** re-baseline packed_size_mb 8.4 -> 9.2 (ratchet reset) ([4ddcf4a](https://github.com/event4u-app/agent-config/commit/4ddcf4ac833f6d10d27d1cf9553648ee058d78d9))
* **gates:** retune check_requirements_trace floor for the drain (10 -> 2) ([9bee0aa](https://github.com/event4u-app/agent-config/commit/9bee0aacd94e72a38ae1c86c82902fffc8910592))
* **generated:** regenerate the skill-overlap report for 299 skills ([a83b271](https://github.com/event4u-app/agent-config/commit/a83b271d2557541f8b783473d9fbdb7d16954b1b))
* **gates:** tighten check_roadmap_trackable:relates ratchet 9 -> 8 ([864f7af](https://github.com/event4u-app/agent-config/commit/864f7af9b998b0f8843f14a39f6d880ad81725fb))
* **generated:** regenerate CAPABILITIES.yaml for the three new skills ([4981ab3](https://github.com/event4u-app/agent-config/commit/4981ab3997a32a699b3766369621c3f720337fa6))
* **adr:** refresh the evidence census after ADR-245 ([111a941](https://github.com/event4u-app/agent-config/commit/111a9410d74c48e9dacdcb2b72d2ede498f7bf3d))
* **coverage:** re-baseline the enforcement ratchet — the gap rose by visibility ([1f37c6b](https://github.com/event4u-app/agent-config/commit/1f37c6b02b0ff38402e401ddac3701b25514a233))
* **generated:** regenerate the artefact index and catalog ([247c51e](https://github.com/event4u-app/agent-config/commit/247c51e0962cdd77294347d89159b480bc3956e9))
* **generated:** regenerate docs/proof.md for the three new claims ([f322c5c](https://github.com/event4u-app/agent-config/commit/f322c5cffe03288da99ca20355c2bd4fce964267))
* **evidence:** declare the evidence type on both new artefacts ([48a5fd8](https://github.com/event4u-app/agent-config/commit/48a5fd808563e7ed4a93cc9b2814532a3f07c53b))
* **generated:** refresh the originality report for the new artefacts ([8810ce7](https://github.com/event4u-app/agent-config/commit/8810ce701d08c478deac393a76ced458533c1f1c))
* **generated:** regenerate docs/proof.md after the claims ledger gained an entry ([b0fdc12](https://github.com/event4u-app/agent-config/commit/b0fdc125ea9b34b3c78982b20278b391132ba145))
* **generated:** regenerate the engineering-base passport after the merge ([17b6b58](https://github.com/event4u-app/agent-config/commit/17b6b585c9462ac46ac1665f625af2a131cbe722))
* **budget:** record the 104 -> 105 cli_help_command_count move ([0e617e1](https://github.com/event4u-app/agent-config/commit/0e617e13a22cdd5bae731be3fd396efd77dd44c0))
* **generated:** regenerate docs/proof.md after the new claim row ([7ec2deb](https://github.com/event4u-app/agent-config/commit/7ec2deb51bdd24e1005342eadf79a337434dc767))
* **gates:** lower the roadmap coverage floor and re-review the MCP register ([04f107c](https://github.com/event4u-app/agent-config/commit/04f107c5ac99fe32db4f7f04432e727cda0dd2b1))
* **generated:** regenerate router.json for the new routes_to ([87bc74a](https://github.com/event4u-app/agent-config/commit/87bc74a1d3b2380d8ae9114fdf00f964e9fc7cbb))
* **gates:** lower check_requirements_trace's floor 15 -> 14 after archival ([9d1a911](https://github.com/event4u-app/agent-config/commit/9d1a91195ec76f81c970b846bb91d47f86e53a84))
* **gates:** lower check_requirements_trace floor 15 -> 10, the drain reached it ([2ce5a83](https://github.com/event4u-app/agent-config/commit/2ce5a83dca66aa9b1f0fe13dc8ab6a3f5b41dd9b))
* **generated:** resync index, counts, packs and projections for 296 skills ([4a78824](https://github.com/event4u-app/agent-config/commit/4a788242a00f0228c3cbca3f2443298f21317662))
* **generated:** resync counts to 297 after merging origin/main ([b8a3007](https://github.com/event4u-app/agent-config/commit/b8a3007ae596ba065b2131b8f709e552bf87da61))
* **generated:** sync projections and pack passport after the ai-video changes ([450b326](https://github.com/event4u-app/agent-config/commit/450b32613579f9956a0b9884937ad2a47e083ec6))
* **generated:** regenerate counts after merging main ([0f6fb6b](https://github.com/event4u-app/agent-config/commit/0f6fb6baf4cf0acfd6eb607a2c4467b29ff0fdea))
* **metrics:** retire rules_efficiency as a gate datum, replace it with the match rate ([5c45a7a](https://github.com/event4u-app/agent-config/commit/5c45a7ac37a53a519e37f3edc7ae3caf772f44d1))
* **generated:** regenerate counts, pack manifest and proof page ([3eb090d](https://github.com/event4u-app/agent-config/commit/3eb090de076c9378c3e57de49c48e496adf27d26))
* **generated:** regenerate the skill-overlap report for 294 skills ([5ce9a38](https://github.com/event4u-app/agent-config/commit/5ce9a3860aaded641d30f8e14d0f7f95a0821273))
* **generated:** regenerate docs/proof.md after the skill and rule count moved ([f54c0b6](https://github.com/event4u-app/agent-config/commit/f54c0b61342e9873fc5fac67159d29513ce4492d))
* **generated:** pack passport after merging the census re-anchor ([bec9168](https://github.com/event4u-app/agent-config/commit/bec9168be113852783ea4b1e1b9c875e322299a1))
* **generated:** counts, index, catalog and overlap for js-library-packaging ([f4d8e64](https://github.com/event4u-app/agent-config/commit/f4d8e640e8e8e65e718be11ca472630cdcbce5fe))
* **generated:** resync counts, index and catalog after the main merge ([d9939ba](https://github.com/event4u-app/agent-config/commit/d9939ba3023900e054268950d36aeafd7cf6676f))
* **generated:** router picks up playbook-precedence (113 -> 114 routed rules) ([68870a4](https://github.com/event4u-app/agent-config/commit/68870a4ede43ba36f6bcdbd1b32e7a712be4a0db))
* **generated:** pack passport after the main merge ([7326eec](https://github.com/event4u-app/agent-config/commit/7326eecf6d0f13f2e8481cdb22770bf533db45b7))
* **generated:** index, catalog and pack passport for playbook-authoring ([1e954fe](https://github.com/event4u-app/agent-config/commit/1e954fe10bc8f282096419764de093906103098a))
* **pack:** regenerate the engineering-base token passport after the merge ([09a114e](https://github.com/event4u-app/agent-config/commit/09a114ea8fe6749b491512ad16e72a5dc9108643))
* **adr:** regenerate the evidence census for ADR-244 ([0b4ad9f](https://github.com/event4u-app/agent-config/commit/0b4ad9f58b6b7b07211817026fcb15e9f246b3f6))
* drop the orphaned import and regenerate the projection ([2338bd2](https://github.com/event4u-app/agent-config/commit/2338bd243cb3c9833513190c42e660dadca577c3))
* **dist:** regenerate projections and token passports ([ae5c6b1](https://github.com/event4u-app/agent-config/commit/ae5c6b1011376d8e0fb39e117b82cd9877fb7910))
* **dist:** regenerate the projection for the rtk skill's updated label ([600c1bb](https://github.com/event4u-app/agent-config/commit/600c1bb83ea65fa059b6216351cf2cfb91e3cafd))
* **release:** drop the imports the extraction orphaned ([9b93fad](https://github.com/event4u-app/agent-config/commit/9b93fadfe2cfac9de3f5f0e2dfa7a895f0d8018e))
* **config:** extend observe-only for the per-turn composite, with n = 0 named ([5187101](https://github.com/event4u-app/agent-config/commit/5187101f17f29cea8431e601a5c862068c07c9b2))
* **generated:** project the rtk staleness label into dist/agent-src ([72f3268](https://github.com/event4u-app/agent-config/commit/72f3268681c212ed06327a1e28d3e31ceb72ee00))
* **ci:** record a composite reading per gate run, and upload it ([fcf1f7a](https://github.com/event4u-app/agent-config/commit/fcf1f7a7415f5f545b8fd2243f2d54cd0b80c0d9))
* **generated:** project the READINESS section and refresh pack counts ([228ac9f](https://github.com/event4u-app/agent-config/commit/228ac9f8beb4ae3574953458a33a5ff83241207d))
* **ci:** wire the readiness grader and its discriminate-check ([351ff91](https://github.com/event4u-app/agent-config/commit/351ff912ed4f6388f5781f3295c2147f4b6825a0))
* **ci:** register the pack-conformance harness under CI-identical argv ([34a0d1d](https://github.com/event4u-app/agent-config/commit/34a0d1d252cd5314263ca2ce62b54040d7557da6))
* **ci:** register check_no_automerge_key across its six surfaces ([cef2195](https://github.com/event4u-app/agent-config/commit/cef2195036294c90cc1abc8fa57db76ba71208be))

### Other

* Revert "chore(gates): tighten check_roadmap_trackable:relates ratchet 9 -> 8" ([e91f4f5](https://github.com/event4u-app/agent-config/commit/e91f4f503cc08ca1c09e6d7ad87d45a9b3b4c304))
* **lint:** drop two unused imports from model_rule_injection ([c427d7b](https://github.com/event4u-app/agent-config/commit/c427d7b75fdf2899929eb8adf82287724b2703f3))
* close and archive road-to-frontend-power ([9cc8b07](https://github.com/event4u-app/agent-config/commit/9cc8b07186d1493922ca711a30180e8a8c96649a))
* **tests:** type the .mcp.json reader instead of any ([94e271f](https://github.com/event4u-app/agent-config/commit/94e271fa3e4c4f8725743dd9a514d9143197fcda))
* complete trigger-delivered-rule-bodies and archive it ([4442a81](https://github.com/event4u-app/agent-config/commit/4442a81cc33c7ed50eccb1512a8f0e48d40ecf36))
* **thin-inject:** four endpoints, committed before any reading of them ([48d5fbe](https://github.com/event4u-app/agent-config/commit/48d5fbe7be57cb79124cc4d21dc1b5813302de43))
* **subagent:** probe what subagent_start actually carries ([e37b1d6](https://github.com/event4u-app/agent-config/commit/e37b1d6e68e1b6698abda5005c83bc777f0cb881))
* complete role-scoped-spawn-profiles and archive it ([f929d63](https://github.com/event4u-app/agent-config/commit/f929d6396ead62c75253aff768b2d564ded938b6))
* **playbooks:** write to stdout directly — the repo bans console.log in scripts ([1e199eb](https://github.com/event4u-app/agent-config/commit/1e199eb33101cbfbc862d643441c40ba5c162354))

Tests: 17224 (+834 since 14.10.0)

## [14.10.0](https://github.com/event4u-app/agent-config/compare/14.9.0...14.10.0) (2026-08-23)

### Release highlights

<!-- Curated head: fill before merge, keep it under 10 lines, and leave `_none_` where it is genuinely the answer. The generated log below is unchanged. -->
- **Behaviour changes:** _auto-derived, rewrite before merge:_ rule/schema diffs, breaking commits or removed public surface in ed95d9c, a7c0f2e.
- **Default changes + migration:** _none_
- **Security and correctness:** _auto-derived, rewrite before merge:_ security-scoped commits or fixes to executable surface in 85138ab, f9958f8, 302abc9, f9e106a.
- **Honest nulls:** _none_
- **Known limitations:** _none_

### Features

* **packs:** publish the ranking, and report coverage instead of a false gate ([130cb32](https://github.com/event4u-app/agent-config/commit/130cb32b18310ef2b327b033285e9fd9be10178b))
* **packs:** a token passport per pack, so growth is attributable ([ed95d9c](https://github.com/event4u-app/agent-config/commit/ed95d9cd83bf5dc8d85b0497864150a1b03d2ebd))
* **council:** let a run declare what its seats are for, resolved once and frozen ([243c18b](https://github.com/event4u-app/agent-config/commit/243c18b8cae6471eb3bd2983874986a458ed75eb))
* **descriptions:** ceiling 220 -> 200, and price the lever honestly ([a7c0f2e](https://github.com/event4u-app/agent-config/commit/a7c0f2e32c86b05a19539579173ffbbef8afa99e))

### Bug Fixes

* **tests:** pin the spec-axis pre-state to a commit, not the merge-base ([85138ab](https://github.com/event4u-app/agent-config/commit/85138ab3127a05ec2591a02950a11659b6142bef))
* **packs:** regenerate token passports after the description-ceiling change ([0f32bdc](https://github.com/event4u-app/agent-config/commit/0f32bdcce062385ff0175a91032181df777af611))
* **gates:** register the passport reconciliation report, with a self-test ([f9958f8](https://github.com/event4u-app/agent-config/commit/f9958f82e3b2c1219febda3f3f18413a243bbaec))
* **tests:** stop the fixture teardown race at its source, not only in the retry ([302abc9](https://github.com/event4u-app/agent-config/commit/302abc9bb18be673536c4ec0cd078022767971c7))
* **roadmap:** name the absorbed stub instead of linking a file this change deletes ([633e768](https://github.com/event4u-app/agent-config/commit/633e76834953741923a2618b884a4a802d1aec4f))
* **council:** extract the seat-constraint parser instead of growing config.ts ([f9e106a](https://github.com/event4u-app/agent-config/commit/f9e106a07990caba91eb8a53feee32c27118cbbd))

### Documentation

* **evidence:** the /roadmap:ai-council parity table, and what it decided ([8b6fdcb](https://github.com/event4u-app/agent-config/commit/8b6fdcb0390d1f1ba241bc10ce74967fd5295b90))
* **budget:** classify the three un-bucketed prose corpora, and bank the nulls ([6f78c41](https://github.com/event4u-app/agent-config/commit/6f78c41b379dd8c4881a9b85ab711a44e65b58a9))

### Refactoring

* **roadmaps:** absorb the host-aware-projection stub, corrected ([989d3c5](https://github.com/event4u-app/agent-config/commit/989d3c599696b6cc9f31504a519f51ba3c485f40))

### Chores

* **roadmap:** record Phase 1 of org-pack-fitness and what its own band refuted ([182ac8a](https://github.com/event4u-app/agent-config/commit/182ac8a7ae273f2cf9b161f05f30acac3b23d890))
* **roadmap:** route Phases 2-3 of council-seat-selection on the evidence ([1d7619a](https://github.com/event4u-app/agent-config/commit/1d7619a6d53127b3eb79179290c4e8a6b0edd07e))
* **estate:** claim the later/ growth where it happened ([17fbf2b](https://github.com/event4u-app/agent-config/commit/17fbf2b90fd418b0de64dff7131ec091c65ab6d9))
* **estate:** re-state against main's merged floor after a sibling merge ([8d80306](https://github.com/event4u-app/agent-config/commit/8d80306370f7009dfe6cd1063057e50d4e2abdd9))
* **index:** regenerate after the description tightening ([c3c7a80](https://github.com/event4u-app/agent-config/commit/c3c7a80fb2ab859f3aae1b5b375ae92a5bc010c5))
* **estate:** re-state the walk against main's merged floor ([a8c7835](https://github.com/event4u-app/agent-config/commit/a8c78350f4eaddf38f98912c47cee3916ebc6752))
* **generated:** refresh pack READMEs for the tightened descriptions ([d39fbf5](https://github.com/event4u-app/agent-config/commit/d39fbf57aa332d13d27ea17cdc8d25f0577a34e1))
* **roadmap:** archive road-to-catalog-and-projection-economy, walk the estate ([3d03add](https://github.com/event4u-app/agent-config/commit/3d03add6e8921be04e248d746ab98a03121d41bb))

Tests: 16390 (+16 since 14.9.0)

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
