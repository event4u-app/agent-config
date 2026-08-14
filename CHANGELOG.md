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

# Era: 12.0.x — current

> Started at `12.0.0`. Full entries live inline below.
> The drift test caps this era at 250 lines of entry body; growth past
> that forces a new era split (`# Era: 12.1.x`, etc.) — see
> [`docs/contracts/CHANGELOG-conventions.md § Era splits`](docs/contracts/CHANGELOG-conventions.md).

## [12.0.0](https://github.com/event4u-app/agent-config/compare/11.0.0...12.0.0) (2026-08-15)

### Release highlights

<!-- Curated head: fill before merge, keep it under 10 lines, and leave `_none_` where it is genuinely the answer. The generated log below is unchanged. -->
- **Behaviour changes:** _auto-derived, rewrite before merge:_ rule/schema diffs, breaking commits or removed public surface in d0ef0ea, 0be9450, 3b4210f, 90ad47a.
- **Default changes + migration:** _auto-derived, rewrite before merge:_ commits naming a default, migration or migrate in e4aec99.
- **Security and correctness:** _none_
- **Honest nulls:** _none_
- **Known limitations:** _none_

### BREAKING CHANGES

* **discovery:** stop emitting tier and bump the manifest to v3 ([3b4210f](https://github.com/event4u-app/agent-config/commit/3b4210f8b07419b4b5c9a14287946782a559065c))
* **commands:** drop the tier: alias from every command source ([90ad47a](https://github.com/event4u-app/agent-config/commit/90ad47ad5204c7c77116cb6a1a99dcbc5274d33c))

### Features

* **bench:** build the scale-history producer, the half the bench never had ([9d898a0](https://github.com/event4u-app/agent-config/commit/9d898a0104fcc9660806039b7f46a3ab3518f142))
* **settings:** carry the measured discipline profile as an opt-in preset, not a default flip ([e4aec99](https://github.com/event4u-app/agent-config/commit/e4aec999330c30f4f47258ab68268993c1dc9af7))
* **schema:** add harness_compat beside compatibility, additively ([d0ef0ea](https://github.com/event4u-app/agent-config/commit/d0ef0eaa81eb09a9cb3c3adcc766514eae61dae2))
* **ledger:** scope subagent ledger lines by session, and re-anchor a comment that rotted three times ([a4eb631](https://github.com/event4u-app/agent-config/commit/a4eb6318102bf949b41fae2ec6b0f723f86c2cdc))
* **manifest:** set the tier sunset, and record that the soak was waived not met ([ef5ca46](https://github.com/event4u-app/agent-config/commit/ef5ca469fe61b967c2cb2e2a7cd61949d241b7bd))
* **settings:** record the three class-B verdicts, and name what class B actually says ([c440e6a](https://github.com/event4u-app/agent-config/commit/c440e6a2775b9e0bb81dc2eeb2daa5d806f1e23c))
* **roadmaps:** close and archive two roadmaps on maintainer answers ([3cfed05](https://github.com/event4u-app/agent-config/commit/3cfed05eb9c3b82d31b2737ba33aa173860943bb))
* **skill-linter:** gate the write path of strict-mode skills ([fea9bc8](https://github.com/event4u-app/agent-config/commit/fea9bc8d1a8c4dd5a7ec897826e08509cc99284e))

### Bug Fixes

* **bench:** per-family model selection, fail-fast, and resume that retries failures ([2dbf26e](https://github.com/event4u-app/agent-config/commit/2dbf26e88ca496699cf261cb34930ea3e0a4a7fa))
* **bench:** stage lint input outside the workspace, and project wall-clock per family ([fde46ae](https://github.com/event4u-app/agent-config/commit/fde46ae1d21f3f9557e28632d337eae1fb2f7a6f))
* **roadmaps:** surface a user-owned blocker that was buried in HTML comments ([853490d](https://github.com/event4u-app/agent-config/commit/853490df3fe5876caea5eb31abf2c9878b40c4f6))
* **gates:** close the nine round-2 findings on check_branch_freshness ([81db7fb](https://github.com/event4u-app/agent-config/commit/81db7fb02e9f3f34b7f3ad395eb128b80a835957))
* **originality:** anchor the scaffold baseline to the base revision ([a75b796](https://github.com/event4u-app/agent-config/commit/a75b7962a82e687e211929ffda22b4b54cc9ad9c))
* **dispatch:** refuse a cli-delegate bundle older than its sources ([591369c](https://github.com/event4u-app/agent-config/commit/591369cf497537c693d19fb859212c084aa24767))
* **worktrees:** judge location against the main worktree, and teach the two missing conditions ([5cf7450](https://github.com/event4u-app/agent-config/commit/5cf7450da168fa67944ed83c411737f56bb8b2a1))
* **worktrees:** the inventory misclassifies from inside a worktree, totally ([52d7fe1](https://github.com/event4u-app/agent-config/commit/52d7fe1b8fa269efc8bde5b79e5b26423c7176ad))
* **roadmap:** call fifteen blocked steps blocked, and tick the one that shipped ([a06c529](https://github.com/event4u-app/agent-config/commit/a06c52965b5d4916691d29be028361ed04c1b094))
* **roadmap:** restore the ADR acceptance leg my own correction wrongly removed ([ac4e795](https://github.com/event4u-app/agent-config/commit/ac4e795d7b46730e35c2c72767551adf2aa496ee))
* **gates:** clear the two preflight blockers this branch hit ([f525ed3](https://github.com/event4u-app/agent-config/commit/f525ed3e324af95b626149b9c00545d669dbbb5b))
* **roadmap:** repair the ci-economy blocker that pointed at the wrong ADR ([7101666](https://github.com/event4u-app/agent-config/commit/71016663fb4b2fe34bd244840882c5a8d9087caa))
* **gates:** close all eleven R2 findings, including two false claims of mine ([d6c8067](https://github.com/event4u-app/agent-config/commit/d6c8067275915ee5f073879f202fa6ef8eaf9551))

### Documentation

* **roadmap:** add the Risk Register required by gate R1 ([eae55a5](https://github.com/event4u-app/agent-config/commit/eae55a5749f74cac14d0a674cc2970dfc0408723))
* **roadmap:** plan the skill-catalogue budget fix with Codex as second host ([81288a5](https://github.com/event4u-app/agent-config/commit/81288a5477e6a9c0976c4bde9a71632bb0078410))
* **roadmap:** close codex-family-auth, both bench families proven live ([89e8e1e](https://github.com/event4u-app/agent-config/commit/89e8e1ef3616f0d442df2229bfb40d3c7953c62f))
* **roadmap:** the scale-history runner landed, and a second family gap opened ([f21e8fa](https://github.com/event4u-app/agent-config/commit/f21e8fa04831394e484caf09f997047416ee015c))
* **review:** re-bind the skip to the final scope, and name what three re-binds cost ([9222716](https://github.com/event4u-app/agent-config/commit/922271617cfe28df69c08ac053549ddb8d81eab3))
* **evidence:** record the deferral disposition and the roadmap closure as an addendum ([cf073c7](https://github.com/event4u-app/agent-config/commit/cf073c7e24d16de44bf7e27f1575dbab3f7e8739))
* **review:** re-bind the completion-review skip after the roadmap closure ([f16bfa6](https://github.com/event4u-app/agent-config/commit/f16bfa68ac681e0acb1d81369897bb98a2b503c3))
* **review:** re-bind the completion-review skip to the post-report scope ([4094b92](https://github.com/event4u-app/agent-config/commit/4094b92f9cde39294678a0ef751e1e79de1df7bd))
* **evidence:** publish the continuation sweep report and file a truthful review skip ([7781cdd](https://github.com/event4u-app/agent-config/commit/7781cddafdb5c3314d5a3fe4765c414d0497ca41))
* **roadmaps:** record that P2.2 is done on the work and open only on Iron Law 3 ([fa5728a](https://github.com/event4u-app/agent-config/commit/fa5728aaa2c21f28a9568f296a3083f270f036c9))
* **roadmaps:** repair two premises that the tree has already overtaken ([a727302](https://github.com/event4u-app/agent-config/commit/a727302b00359ad564e5cf5f6f607adfe5a3c229))
* **roadmap:** correct the scale-history bench from spend-blocked to build-blocked ([19abd67](https://github.com/event4u-app/agent-config/commit/19abd67aa74c1bb85450f466cbbcf3e694e0da4e))
* **evidence:** record the continuation delta as an addendum, and regenerate the dashboard ([13dc4bb](https://github.com/event4u-app/agent-config/commit/13dc4bb8f0bdd3b066d1a393221dfd36aac37ca6))
* **roadmap:** record that the orchestration evidence gate was bypassed, not answered ([e9bc08d](https://github.com/event4u-app/agent-config/commit/e9bc08da66155b2ac6389f8b94b6143fea21d8eb))
* **evidence:** disclose the standing completion-review advisory, and why no skip was filed ([c31f5a5](https://github.com/event4u-app/agent-config/commit/c31f5a59acb527da3190a57fe659dffaddafc06f))
* **roadmap:** give maintainer-bus-factor the Risk Register its edit now requires ([f481b52](https://github.com/event4u-app/agent-config/commit/f481b52c5b7d75abfed3d9a649944e23e12a287e))
* **evidence:** record the roadmap completion sweep of 2026-08-14 ([9e9f827](https://github.com/event4u-app/agent-config/commit/9e9f827b43428a5122a9676eb657379e370fa34e))
* **review:** re-bind round 2 to the post-fix scope, all nine terminal ([e63511e](https://github.com/event4u-app/agent-config/commit/e63511efd6dc2d093acb2b22c23fcb054de033b6))
* **review:** archive round 1 and bind the round 2 findings — 9 open ([2ba9982](https://github.com/event4u-app/agent-config/commit/2ba998259326d8d5e4db87e8158b5ed408c4df21))
* **tier:** record the removal in ADR-231 and fix every doc it falsified ([2211d62](https://github.com/event4u-app/agent-config/commit/2211d62cc8528a1680f2bfe3483f771469cac281))
* **roadmap:** date the blocker premises that were asserted rather than measured ([26b8796](https://github.com/event4u-app/agent-config/commit/26b8796def8cf0cfb3d1d8ab8f0f5be94883331a))
* **review:** bind the R2 findings for pr-target-base-freshness — 11 open ([451df8f](https://github.com/event4u-app/agent-config/commit/451df8fb85d2474724621c127d0c6355d4fbbb30))

### Refactoring

* **roadmaps:** extract the settings deletion queue to a durable context, archive its roadmap ([e4c6aec](https://github.com/event4u-app/agent-config/commit/e4c6aecc4235ea7b28ede922a6c840f7a99774ac))
* **commands:** read visibility alone in the schema, linter and readers ([0be9450](https://github.com/event4u-app/agent-config/commit/0be9450cac743c1a9c63cebf9aa264720cc05a54))

### Chores

* **roadmaps:** close and archive inbox-harvest-2026-08, migrating its four deferrals ([71639ea](https://github.com/event4u-app/agent-config/commit/71639ea095f23e53d3da61f37d35ee2c7a2f8d86))
* **ci-economy:** accept ADR-223, and hand back the two repo-admin acts with their exact procedure ([df70b7c](https://github.com/event4u-app/agent-config/commit/df70b7cf05b997f8d471749a7ca17481999c6e05))
* **roadmap:** discharge the consolidation breaking-change permission for all tranches ([348d7f7](https://github.com/event4u-app/agent-config/commit/348d7f7a0d4dfeb6e7107bd3e6069d688df72890))
* **roadmaps:** resolve self-fix-halt-telemetry on an outside opinion, and record the three verdicts not yet implemented ([026dce4](https://github.com/event4u-app/agent-config/commit/026dce42f5e4e12bc4330e10351a7a213ec5d539))
* **roadmaps:** grant the two bench budgets, defer the second reviewer, dedupe a step ([b7fe2b5](https://github.com/event4u-app/agent-config/commit/b7fe2b539fed12066b662ffcb75a7a10e8d91d4a))
* **roadmaps:** archive the harvest-b family index on closure ([27253a1](https://github.com/event4u-app/agent-config/commit/27253a1046603278302ac31671f6fac8a4da9a85))
* **roadmaps:** close the harvest-b index and the dispatch-safety decisions ([b68d576](https://github.com/event4u-app/agent-config/commit/b68d576dac06c14fce14c3804c4551d370bc1710))
* **roadmap:** archive road-to-tier-removal at 100% ([61542dc](https://github.com/event4u-app/agent-config/commit/61542dc072fc275c5bde659f25b7a327aea8ad99))

Tests: 13844 (+26 since 11.0.0)

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
