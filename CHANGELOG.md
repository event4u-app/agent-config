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

# Era: pre-13.0.0 — archived

> All entries before `13.0.0` live in
> [`docs/archive/CHANGELOG-pre-13.0.0.md`](docs/archive/CHANGELOG-pre-13.0.0.md).
> The archive is read-only; git tags remain the canonical
> source for what shipped. Splitting them out of the main file
> keeps the active era under the 250-line drift cap enforced by
> `tests/test_changelog_eras.py`.

# Era: 13.0.x — current

> Started at `13.0.0`. Full entries live inline below.
> The drift test caps this era at 250 lines of entry body; growth past
> that forces a new era split (`# Era: 13.1.x`, etc.) — see
> [`docs/contracts/CHANGELOG-conventions.md § Era splits`](docs/contracts/CHANGELOG-conventions.md).

## [13.0.0](https://github.com/event4u-app/agent-config/compare/12.1.0...13.0.0) (2026-08-17)

### Release highlights

<!-- Curated head: fill before merge, keep it under 10 lines, and leave `_none_` where it is genuinely the answer. The generated log below is unchanged. -->
- **Behaviour changes:** _auto-derived, rewrite before merge:_ rule/schema diffs, breaking commits or removed public surface in 43d4e1b, 0cb9e5d, 3573525, 866bd98, 1bf6a9a.
- **Default changes + migration:** _none_
- **Security and correctness:** _auto-derived, rewrite before merge:_ security-scoped commits or fixes to executable surface in 441c2d8, f296b41, e11b9e1, b0de33a, 4eee75f, 8d49432 +9 more.
- **Honest nulls:** _auto-derived, rewrite before merge:_ commits recording a null, waived or falsified result in e8e6447.
- **Known limitations:** _none_

### BREAKING CHANGES

* **council:** archive the budget-routing decision layer and permit lifecycle ([43d4e1b](https://github.com/event4u-app/agent-config/commit/43d4e1b2a83c25611e8d90c3ed28b5de13f09e29))

### Features

* **cost:** re-price rate_missing ledger rows against the observed shape ([50b3c5d](https://github.com/event4u-app/agent-config/commit/50b3c5d2c9511ff517d7a3d2dfa189d4da45be1f))
* **bench:** offline re-scorer retro-fits the size pair onto finished sweeps ([0fd111e](https://github.com/event4u-app/agent-config/commit/0fd111ebf0b9075002e1a8d462da70fa20fe473d))
* **bench:** refuse a size win on golfing or a safety regression ([ae52635](https://github.com/event4u-app/agent-config/commit/ae52635b227e9a43e37c41edad9580fda62e91d5))
* **bench:** cognitive complexity per changed function (delta #11) ([5e6f177](https://github.com/event4u-app/agent-config/commit/5e6f177731c12be4f57efbaccf2584718cdb6201))
* **design-fidelity:** URL / live-page handover extracts into files first ([0cb9e5d](https://github.com/event4u-app/agent-config/commit/0cb9e5d8e8db5ced9b236e29f061233dbff47fc4))
* **gates:** adopt per-target completeness ledgers in four more gates ([6fc4458](https://github.com/event4u-app/agent-config/commit/6fc445804ca845778e6521a1ddec8964ed072435))
* **contracts:** declare the eight rule pairs the audit left arbitrated by nobody ([0499a0f](https://github.com/event4u-app/agent-config/commit/0499a0fe411e045c8562b94b95e2089379e4a4d1))
* **prompt-optimizer:** de-inflate a prompt before polishing it ([8e22d2b](https://github.com/event4u-app/agent-config/commit/8e22d2b4667b59232a0aa2b26de4882da27f6c74))
* **ci:** keep the archive index from going stale in the PR that stales it ([89ad466](https://github.com/event4u-app/agent-config/commit/89ad466950d818b56348bd5f49819bd0000d8ebf))
* **scripts:** index the roadmap archive, deterministically ([725e4b3](https://github.com/event4u-app/agent-config/commit/725e4b376fd5b58ef47d82da777aaa30313ee76d))
* **gates:** ratchet the excess lines over a 1,500-line source ceiling ([7e051f9](https://github.com/event4u-app/agent-config/commit/7e051f94af00b1652eabeca0064b28ef760c75db))
* **mcp:** recover what the host dropped — real ranker tool + a route to it ([866bd98](https://github.com/event4u-app/agent-config/commit/866bd9861b42db575da1869790290cf4062eadfd))
* **skills:** give skill triggers a schema, a validator, and a first tranche ([1bf6a9a](https://github.com/event4u-app/agent-config/commit/1bf6a9ab9d15909fcbd6e6dbe7f5d7e925cca18a))
* **hooks:** bind the deterministic skill ranker to user_prompt_submit ([0da18b4](https://github.com/event4u-app/agent-config/commit/0da18b48956b2374e64e88bf3159e88581403178))
* **catalogue:** report projected skill counts per projection mode ([8a6d7df](https://github.com/event4u-app/agent-config/commit/8a6d7df4ff15213a54c01f52895f5cebace78ab9))
* **routing:** bound inherit at high, cap the judge ladder, floor the split ([7863ebc](https://github.com/event4u-app/agent-config/commit/7863ebca390cfd353dabc46bebb505fabacfa435))

### Bug Fixes

* **roadmaps:** make the feasibility-screen inputs true again ([e8e6447](https://github.com/event4u-app/agent-config/commit/e8e64471659bddd7510861d70e0bbe250a7d9ad3))
* **build:** rebuild the install bundle without the worktree symlink ([441c2d8](https://github.com/event4u-app/agent-config/commit/441c2d8edf4ed6836a483cb4c3ab15da75c0cfb1))
* **cost:** repair all seven completion-review findings ([f296b41](https://github.com/event4u-app/agent-config/commit/f296b41e477fa7c3a34bde0e03ddb7b558422d42))
* **council,roadmap:** apply the R2 fix pass on the archival ([e11b9e1](https://github.com/event4u-app/agent-config/commit/e11b9e18c2ab37d400fd2ec7c799099b6928848d))
* **ci:** green the source-size ratchet and the reference check ([b0de33a](https://github.com/event4u-app/agent-config/commit/b0de33a29a2ab4c2476545c3b44ee2ce8b91de87))
* **bench:** repair the ten completion-review findings ([4eee75f](https://github.com/event4u-app/agent-config/commit/4eee75f9c959b0c9710e37229bc41ce36640965c))
* **roadmap,council:** apply the R2 fix pass ([8d49432](https://github.com/event4u-app/agent-config/commit/8d49432a615fd5f3f67f9ef9be1f0885912739fd))
* **roadmap:** record both (b) votes, and correct three claims the last PR left stale ([4da97c5](https://github.com/event4u-app/agent-config/commit/4da97c5804f8eaf3c5f333f31e471ecc27d89356))
* **council:** correct a comment that claimed the spawn inherits the caller cwd ([f3c1509](https://github.com/event4u-app/agent-config/commit/f3c1509d1f51eb5973184313618222517a062bd7))
* **docs:** regenerate proof.md after the claims edit ([722c123](https://github.com/event4u-app/agent-config/commit/722c123a1bbdc10034aef606e14d3b48aeae9d63))
* **roadmap:** picktier-wire-or-archive is gated on infrastructure, not judgement ([4ad4701](https://github.com/event4u-app/agent-config/commit/4ad4701cb6a882bab2581c23e8c9608b13459b46))
* **claims:** the budget-routing entry described a binding that was deleted ([6712475](https://github.com/event4u-app/agent-config/commit/671247590b2a0be54f46d0d59dbb4568ea5c1798))
* **gates:** drop a bootstrap flag whose window has closed ([cfc27b4](https://github.com/event4u-app/agent-config/commit/cfc27b4303cf2cdc6c0c64b338473e7b1356f511))
* **roadmap:** stop the disposition note from naming the token it scrubbed ([e2b0858](https://github.com/event4u-app/agent-config/commit/e2b0858a45589ea887ba020030b43805fa9ba54f))
* **roadmaps:** make six held blockers decidable, and lower the ratchet to match ([9aff993](https://github.com/event4u-app/agent-config/commit/9aff993d64698754c4253f30ef98a913a7325c3b))
* **gates:** exclude declarations and tests, emit real JSON, stop swallowing reads ([09c7a84](https://github.com/event4u-app/agent-config/commit/09c7a84d680437a17a3d24fb665f236a9827e8b3))
* **roadmap:** terminate a blocker field on ANY labelled bullet, not eight names ([8216fab](https://github.com/event4u-app/agent-config/commit/8216fab38bea09dc5d3051cd454dac26ab359235))
* **ci:** pin skill-route in the worker-drop set ([179fc09](https://github.com/event4u-app/agent-config/commit/179fc09e9f8734b335aac5dc222ef243da76cef9))
* **ci:** re-point the trigger census and rebuild the install bundle ([ec7b34b](https://github.com/event4u-app/agent-config/commit/ec7b34b37649a238dca949c98bf4458c4ebca69e))
* **review:** close all 13 R2 findings ([3573525](https://github.com/event4u-app/agent-config/commit/35735256cbefccea79455a61c323cd37685920c3))
* **routing:** address all 7 R2 review findings ([aa57107](https://github.com/event4u-app/agent-config/commit/aa571070882084f8653a7cff13a0c930d7690bcf))
* **routing-doctor:** report cool-down state as unavailable, not as false ([4fed9ec](https://github.com/event4u-app/agent-config/commit/4fed9ec7b91777e198d2596d58c2868246072ac9))

### Documentation

* **evidence:** declare the completion-review skip for the corrections ([75c8d89](https://github.com/event4u-app/agent-config/commit/75c8d898b9187b491f16f3d756c5668d3f80194c))
* **evidence:** re-bind the completion review after the main merge ([3ce343d](https://github.com/event4u-app/agent-config/commit/3ce343dac8101e1e8d37a689296ce63820811b94))
* **evidence:** re-bind the findings after the bundle rebuild ([35a178d](https://github.com/event4u-app/agent-config/commit/35a178d6e3ef7aca8f3c4c1da0c7775918491d37))
* **evidence:** record the fix commit on each repaired finding row ([7cfc6ff](https://github.com/event4u-app/agent-config/commit/7cfc6ff2bdf274612f7ae0444229b5d6dbc6bb2c))
* **evidence:** re-bind the completion review after the seven repairs ([b043aef](https://github.com/event4u-app/agent-config/commit/b043aef11a1eb9f02f1fd4ae8cd11be0ed6a78cc))
* **evidence:** re-bind the R2 findings and record the dispositions ([80252df](https://github.com/event4u-app/agent-config/commit/80252df5e61ee215627da4a072b235126cfd336a))
* **evidence:** completion review for the ledger-truth backfill, rows open ([f1dfe04](https://github.com/event4u-app/agent-config/commit/f1dfe0404e8e70745c4df67cbe26c669a0d67c19))
* **evidence:** record the R2 findings on the archival before fixing ([f840dbc](https://github.com/event4u-app/agent-config/commit/f840dbc1ae0eca2a1e651277ca2f1e5c25821690))
* **cost:** document the re-pricing pass in the cost report command ([d7021a5](https://github.com/event4u-app/agent-config/commit/d7021a57e299e83c5763943ffe5385a915789e3c))
* **roadmap:** close ledger-truth 2.5, resolve its blocker, archive the roadmap ([8d6c8a2](https://github.com/event4u-app/agent-config/commit/8d6c8a2a6b43da0549965c4ace23e9ae7085147b))
* **evidence:** record the observed rate_missing row, and why it waited three days ([d56147c](https://github.com/event4u-app/agent-config/commit/d56147c6869c35b29be061d791cf79767a1eff64))
* **roadmap:** close 4.1 on the converged verdict ([01da09c](https://github.com/event4u-app/agent-config/commit/01da09ce167ef38af10bbe43b62e3c56c3d4f0ab))
* **evidence:** re-bind the completion review after the CI repairs ([218b6eb](https://github.com/event4u-app/agent-config/commit/218b6eb8f5b202f9ff013673a387a86aba9fd01d))
* **evidence:** re-bind the completion review, all ten rows fixed ([17a8ad0](https://github.com/event4u-app/agent-config/commit/17a8ad09c673150561ebdb72340d8e99fd382b20))
* **evidence:** completion review for the Phase-3 metric pair, rows open ([df12c39](https://github.com/event4u-app/agent-config/commit/df12c39e18630757fd34da19dbea79a17a2809b0))
* **evidence:** record the R2 findings before the fix pass ([1aae520](https://github.com/event4u-app/agent-config/commit/1aae5201e9e7b74238cf095ed026e33cf5fcd0a8))
* **roadmap:** record delta #11 and repoint five stale blocked-by annotations ([d6f5d59](https://github.com/event4u-app/agent-config/commit/d6f5d5929596ce813a4920bc78dfc95525adba0d))
* **evidence:** re-bind the completion-review skip after the main merge ([7594467](https://github.com/event4u-app/agent-config/commit/7594467ce4e38391537329c4d92696fbdf7f747b))
* **evidence:** declare the docs-only skip for this completion ([7041aae](https://github.com/event4u-app/agent-config/commit/7041aae477d9b1b051796236440a6b99263496b2))
* **evidence:** re-declare the skip after the forward-merge and index regen ([f2ffe38](https://github.com/event4u-app/agent-config/commit/f2ffe38e83d12da0a1255436f1596c33ad5b7328))
* **evidence:** re-declare the docs-only skip at the post-split scope ([90409ae](https://github.com/event4u-app/agent-config/commit/90409ae8c915a70d0d64d466bbdebff3560a036c))
* **roadmap:** close source-first Phase 4 Steps 1-2, correct a stale blocker claim ([314e3ea](https://github.com/event4u-app/agent-config/commit/314e3eaf9157ce87003c5ca5447118b756bf7e28))
* **roadmap:** close F4.1 with the re-adjudication, and correct a header that was false ([0b96569](https://github.com/event4u-app/agent-config/commit/0b9656992832fe4f7a3f87e109af26c474c0c011))
* **roadmap:** close and archive the prompt-deinflation roadmap ([a14f7be](https://github.com/event4u-app/agent-config/commit/a14f7be15d165df34bca2d3167084cb9dd84d4d7))
* **roadmap:** publish the saving reading, route the authoring surface, archive ([ee3d0ef](https://github.com/event4u-app/agent-config/commit/ee3d0efcfd851e9b45017e433961b4450bbbe4df))
* **review:** re-bind the completion review after the fix pass ([8941d59](https://github.com/event4u-app/agent-config/commit/8941d599f5351b167c93da8ecc97fd32bc10328b))
* **review:** record the R2 completion-review findings for this branch ([1e4c3a2](https://github.com/event4u-app/agent-config/commit/1e4c3a27025166026b575aee4d6ebf162c633b32))
* **review:** re-bind the findings after the originality refresh ([620613f](https://github.com/event4u-app/agent-config/commit/620613f3ba21b72f2aff1f38cc4658fe58c8ee9e))
* **review:** re-bind the findings after the worker-drop pin ([a326d59](https://github.com/event4u-app/agent-config/commit/a326d59f0234dc366b3e53ee9a3a6bbb531a5fea))
* **roadmap:** close R3 and R4, make both residual blockers decidable ([358c91d](https://github.com/event4u-app/agent-config/commit/358c91db0bd44aa0c65c9f8aad000f7e2c98f3ac))
* **skills:** record the snapshot preference order for design-system capture ([bcbb0ca](https://github.com/event4u-app/agent-config/commit/bcbb0ca8f3b81e59368fab31e07fd8963b39e0c8))
* **review:** re-bind the findings after the CI-fix commit ([cfe225c](https://github.com/event4u-app/agent-config/commit/cfe225cde464f5d67a0458b94ef3f9673c5f8155))
* **review:** re-bind the findings after the main merge ([24b0916](https://github.com/event4u-app/agent-config/commit/24b0916629169c61d053592bd24694289feccb64))
* **review:** re-bind the findings to the post-fix scope, 13/13 fixed ([871a96c](https://github.com/event4u-app/agent-config/commit/871a96c675f4de2693b6b97a520c19ff6bb9181d))
* **review:** record the R2 completion review — 13 findings ([113b9ed](https://github.com/event4u-app/agent-config/commit/113b9edfc76ec796fa4ceea6dc36ea56c6818a0e))
* **review:** re-bind the R2 findings after the fix pass ([80c994e](https://github.com/event4u-app/agent-config/commit/80c994e8c0ed491374c6bb77010a9ff845159dae))
* **review:** R2 completion review for feat-top-band-model-economy ([2f25030](https://github.com/event4u-app/agent-config/commit/2f250301491a4d3c305be148159b7803ed4ff511))
* **roadmap:** close runtime-skill-routing, 14 of 14 ([793a75e](https://github.com/event4u-app/agent-config/commit/793a75ea4af9c7ecfba08a31c3de4c1b2940b0b6))
* **roadmap:** close Phase 3 and 4.2, open the pickTier decision as a blocker ([1c078db](https://github.com/event4u-app/agent-config/commit/1c078dbbdfcd65074434707fa8cb61fee53fe05b))
* **evidence:** publish the downshift-versus-cache reading ([3a27719](https://github.com/event4u-app/agent-config/commit/3a27719964ada44c7d2744a3aa928e258f997047))

### Refactoring

* **design-fidelity:** split the handover section out under the depth ceiling ([ee113c3](https://github.com/event4u-app/agent-config/commit/ee113c3c65d86e44bae34314f22a1eaaeabb8639))

### Chores

* **roadmap:** regenerate the dashboard for the ledger-truth archival ([daa3d0d](https://github.com/event4u-app/agent-config/commit/daa3d0d0b633d7aba27126b7512aa9f7be520790))
* **roadmap:** regenerate the dashboard after the main merge ([8b40272](https://github.com/event4u-app/agent-config/commit/8b402725818fed47424b788de20ef9de516233a5))
* **roadmap:** regenerate the dashboard after merging main ([9d2ff18](https://github.com/event4u-app/agent-config/commit/9d2ff180612fcfec1531fe6ed7a118b0c1dbde63))
* **index:** regenerate the artefact index for the new guideline ([ce19de0](https://github.com/event4u-app/agent-config/commit/ce19de0baf25ed9982f9cdce97dc2f92a4d104fd))
* **provenance:** record the prompt-optimizer non-entry and ratchet the source ([be9b9e2](https://github.com/event4u-app/agent-config/commit/be9b9e2f68394a2cbcac2101049f0470d5a39d02))
* **reports:** refresh the originality audit for the grown corpus ([43054b8](https://github.com/event4u-app/agent-config/commit/43054b8e663d771e29dd102a41bbc639dfe194a7))
* **roadmaps:** archive the completed scheduled-deprecation roadmap ([f74cabe](https://github.com/event4u-app/agent-config/commit/f74cabe009a14e7410c70cd06a481c42be304808))
* **docs:** routed-rule count 110 -> 111 for missing-skill-recovery ([6b8a9a6](https://github.com/event4u-app/agent-config/commit/6b8a9a6726a3234a20a435bf71be9ebb942ffe70))
* **roadmaps:** archive two completed roadmaps ([5cbe55d](https://github.com/event4u-app/agent-config/commit/5cbe55d6d78d340d25752505784e945aedee15df))

Tests: 14076 (+84 since 12.1.0)

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
