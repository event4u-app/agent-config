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

# Era: 10.3.x — current

> Started at `10.3.0`. Full entries live inline below.
> The drift test caps this era at 250 lines of entry body; growth past
> that forces a new era split (`# Era: 10.4.x`, etc.) — see
> [`docs/contracts/CHANGELOG-conventions.md § Era splits`](docs/contracts/CHANGELOG-conventions.md).

## [11.0.0](https://github.com/event4u-app/agent-config/compare/10.4.0...11.0.0) (2026-08-13)

### Release highlights

<!-- Curated head: fill before merge, keep it under 10 lines, and leave `_none_` where it is genuinely the answer. The generated log below is unchanged. -->
- **Behaviour changes:** _auto-derived, rewrite before merge:_ rule/schema diffs, breaking commits or removed public surface in 7d4af2c, 9e4cc35.
- **Default changes + migration:** _none_
- **Security and correctness:** _none_
- **Honest nulls:** _none_
- **Known limitations:** _none_

### BREAKING CHANGES

* **settings:** delete worktrees.mode — worktree creation is instruction-only ([9e4cc35](https://github.com/event4u-app/agent-config/commit/9e4cc35513a69b9e107b639ff9dc78622d42b09e))

### Features

* **council:** replace the per-run spend confirmation with a ceiling ([945d6c0](https://github.com/event4u-app/agent-config/commit/945d6c08b6e9a5519858fa6f4bb6ddece461621b))
* **gates:** resolve the PR base before judging branch freshness ([f77da9a](https://github.com/event4u-app/agent-config/commit/f77da9a6618d0ef982cd4b9bb83201179e26e818))
* **grounding:** the three 1-10 design dials, re-derived not ported ([1516fa8](https://github.com/event4u-app/agent-config/commit/1516fa8adda1c772a71062fb1950598f336b1c5e))
* **corpus:** vendor motion.csv and a gsap search domain; decline the rest ([0a82fa2](https://github.com/event4u-app/agent-config/commit/0a82fa2128ffdbc3273b85efd83152ead8e1da28))

### Bug Fixes

* **settings:** correct the class-count summaries after the deletion ([b1cf141](https://github.com/event4u-app/agent-config/commit/b1cf1419366bd1a8bc338ce4a11e310724143627))
* **session-register:** gate the context block on a real collision ([c1dcf0e](https://github.com/event4u-app/agent-config/commit/c1dcf0e599e709f465903805a3f8147cc079fecd))
* **council:** align the command surfaces with the ceiling bound ([2e3ad3f](https://github.com/event4u-app/agent-config/commit/2e3ad3f74947fba2ff73c2017515e5954b19cefb))
* **session-register:** anchor the record on the session checkout, not the chdir target ([7b64d4e](https://github.com/event4u-app/agent-config/commit/7b64d4e3d0db42e6f177692cdf2c47eba3634d72))
* **review:** put the skip declaration on one line ([d6d3736](https://github.com/event4u-app/agent-config/commit/d6d3736fef1509eda589dbb8f36a3b806f30bcf3))
* **docs:** drop maintainer-only invocations from the shipped surfaces ([4e89881](https://github.com/event4u-app/agent-config/commit/4e8988172a773be43b8a9b3d93d3676f76fc5adf))
* **roadmap:** relocate distillation's two maintainer-gated items and archive it ([c19fcf6](https://github.com/event4u-app/agent-config/commit/c19fcf6072f499a5e0b5149985e238ee8eb5511e))
* **corpus:** advance last_checked in the manifest too, not only in ATTRIBUTION ([ca40b92](https://github.com/event4u-app/agent-config/commit/ca40b92b83db4a1951b4dc1328b21ecfdf7919f4))
* **provenance:** correct a falsified compliance record, and shrink two diffs ([88e095d](https://github.com/event4u-app/agent-config/commit/88e095d8342106111bd36d69f410f39646deb558))
* **grounding:** make the dials reach a reader, and make the variance claim true ([af919d3](https://github.com/event4u-app/agent-config/commit/af919d30d91a2c379819135fa7e34446a7da33a3))
* **gates:** carve out the two license-attribution surfaces for code borrows ([2a969a0](https://github.com/event4u-app/agent-config/commit/2a969a0c4835e9a4db031d01e70ebcb5e0bb051d))
* **records:** close all seven R2 findings, including a false claim of mine ([5ca4290](https://github.com/event4u-app/agent-config/commit/5ca4290795560d4fca8a054db6439e39e5bb6b42))

### Documentation

* **skills:** hardcode the instruction-only worktree rule across every surface ([7d4af2c](https://github.com/event4u-app/agent-config/commit/7d4af2c9b51714fe3a6ae636b379f835f7dc0cbc))
* **adr:** record ADR-229 — worktree creation is instruction-only ([b20e3a5](https://github.com/event4u-app/agent-config/commit/b20e3a56a05402d95f88a66ade4075b3d211e53d))
* **adr:** record ADR-230 — the council spend bound is a ceiling ([1f35330](https://github.com/event4u-app/agent-config/commit/1f35330a6203c336a9ddced6593cf7f8e09fdbdc))
* **review:** declare the completion-review skip for a docs-only branch ([3ad11bf](https://github.com/event4u-app/agent-config/commit/3ad11bf5109088bca10a80954dffbd280e2586c1))
* **roadmap:** close Phase 0 Step 3 and re-scope Phases 1 and 2 on the measurement ([d9a888e](https://github.com/event4u-app/agent-config/commit/d9a888e793977be05af7c2c2b345655956e3eb8e))
* **evidence:** reproduce #58109 and record what the ledger cannot see ([21b8d2d](https://github.com/event4u-app/agent-config/commit/21b8d2dfbcd0dff415bfda7306788a86f3b3809b))
* **review:** re-bind the skip declaration after merging main ([3e03c75](https://github.com/event4u-app/agent-config/commit/3e03c75c4465ceac9d02bdfb76e8ad0091387965))
* **git:** route the pre-PR freshness check through the gate ([c0edb1f](https://github.com/event4u-app/agent-config/commit/c0edb1f36c001087d1118ef1fac3e7cb5e10f333))
* **review:** re-scope the skip declaration after the main merge ([7184ae8](https://github.com/event4u-app/agent-config/commit/7184ae89ec9e9385aca59ecba9bdd2eacc336c08))
* **review:** re-bind the findings artefact after the corpus-staleness fix ([47131d4](https://github.com/event4u-app/agent-config/commit/47131d403539cdaebf67e7b514267562835ae5c1))
* **review:** re-bind the findings artefact to the post-fix scope ([6a48f11](https://github.com/event4u-app/agent-config/commit/6a48f11ba78b1086209dfa06928bfe1f7addc743))
* **roadmap:** correct three overclaims, re-depth the archive links, stale watchlist ([c4e95d3](https://github.com/event4u-app/agent-config/commit/c4e95d36a6efcaf44f1aa693816806111e823165))
* **review:** bind the R2 findings for feat-design-system-onramp-blockers ([2092734](https://github.com/event4u-app/agent-config/commit/2092734d3438ac2647bdcdde5faf05be49b7b0dc))
* **review:** re-bind the artefact after the third main merge ([3b4bdb6](https://github.com/event4u-app/agent-config/commit/3b4bdb6a08f46181d869a2d4bd4dfb16af3e4349))
* **review:** re-bind the R2 artefact after the fix pass ([5bfc84c](https://github.com/event4u-app/agent-config/commit/5bfc84c8bfea61a9522f21f8cbb7f72acdcc7450))
* **council:** record the two unblocking decisions, and their honest standing ([8cd7182](https://github.com/event4u-app/agent-config/commit/8cd71823c1b1ce3c6002d16cb444d1b96b70f3fa))
* **review:** the real R2 review, replacing the skip — 7 findings ([834e7f1](https://github.com/event4u-app/agent-config/commit/834e7f10f26e0d93911f0c92d0720f72c8ee0fc2))

### Tests

* **settings:** re-point two vacuous assertions and assert the deletion ([933f320](https://github.com/event4u-app/agent-config/commit/933f3208efd38a22854e147e7d3c7ddee2bacde1))

### Chores

* **roadmap:** regenerate the dashboard after the main merge ([2653222](https://github.com/event4u-app/agent-config/commit/26532222c07d0784f1f608a0fc4185ed9b02274b))
* **roadmap:** regenerate the dashboard after the third main merge ([b271d07](https://github.com/event4u-app/agent-config/commit/b271d078b70d3c177571fc152cc00315b5780aba))
* **roadmap:** close design-system-onramp at 12/12 and archive it ([14bce9c](https://github.com/event4u-app/agent-config/commit/14bce9c59b193631737f7b2a19157fd53d4e6de4))

Tests: 13818 (+50 since 10.4.0)

## [10.4.0](https://github.com/event4u-app/agent-config/compare/10.3.0...10.4.0) (2026-08-13)

### Release highlights

<!-- Curated head: fill before merge, keep it under 10 lines, and leave `_none_` where it is genuinely the answer. The generated log below is unchanged. -->
- **Behaviour changes:** _none_
- **Default changes + migration:** _none_
- **Security and correctness:** _none_
- **Honest nulls:** _auto-derived, rewrite before merge:_ commits carrying an honest-null marker in 5a9f530.
- **Known limitations:** _none_

### Features

* **commands:** /design-system cluster — three doors onto machinery that already ships ([e56eaf4](https://github.com/event4u-app/agent-config/commit/e56eaf4a5496bed575e421df997ad60bd2cfac08))
* **scripts:** three-lane adapter into the design-system.json contract ([d1dd006](https://github.com/event4u-app/agent-config/commit/d1dd00610d4c2c97aa5adf0fa7baa120167b6aa2))
* **hooks:** an open subagent dispatch is an explicit turn-end allow ([39daf4e](https://github.com/event4u-app/agent-config/commit/39daf4e2c3ba70fa4e43b57fc82bc1bf9eb5b613))
* **hooks:** ship Phase 3 runaway containment in shadow posture ([b9efa4e](https://github.com/event4u-app/agent-config/commit/b9efa4ec618b3f26c1c07a8eb335866545c4274c))
* **hooks:** register subagent lifecycle events and bind the ledger ([a6a4023](https://github.com/event4u-app/agent-config/commit/a6a4023529074069f03f8542d0513ee77f3adfde))
* **hooks:** add the capture-only subagent-ledger concern ([f393ec4](https://github.com/event4u-app/agent-config/commit/f393ec4686422d247bc5862cf13e04459d64ace5))
* **gates:** adopt the self-test harness in lint_rule_skill_pack_reach ([a758153](https://github.com/event4u-app/agent-config/commit/a7581533b8d5ed8672f985337dc87d21508fa451))

### Bug Fixes

* **design-system:** drop maintainer-only invocations from shipped surfaces ([122760a](https://github.com/event4u-app/agent-config/commit/122760aad5f2a6f4a19c7571da5fcfb732e5e1a8))
* **scripts:** close nine silent-loss paths in the design-system import adapter ([ed4c7e3](https://github.com/event4u-app/agent-config/commit/ed4c7e39ad3bd732b034c24952460332bb7cb503))
* **docs:** regenerate proof.md after the command-count change ([c5cb075](https://github.com/event4u-app/agent-config/commit/c5cb07529d8e1903ad15bbf300ce4156fb5a11b2))
* **ci:** wire check_gate_coverage locally too, and correct three numbers ([a62745c](https://github.com/event4u-app/agent-config/commit/a62745cea249ace8e89a453e9f5950e7179721ce))
* **ci:** wire the two meta-gates, re-anchor the parity floor ([ea13fc7](https://github.com/event4u-app/agent-config/commit/ea13fc77f2cceecc127933b7f56a5fbcc5a07709))
* **commands:** register analyze:conformance in the table it already belonged in ([2c307f3](https://github.com/event4u-app/agent-config/commit/2c307f392061eb4ff24a15b1c29b7ddc5c162b71))
* **hooks:** close the round-2 completion-review findings ([a3de33b](https://github.com/event4u-app/agent-config/commit/a3de33beacff72725b48e4ebdd0bb58b4258bee1))
* **contracts:** drop the roadmap link from the activation policy ([4d49029](https://github.com/event4u-app/agent-config/commit/4d49029266a04d8d025e110be0a574553634acea))
* **roadmap:** sync the Phase 2 record with the shipped floors, and own the red ([f98d9d5](https://github.com/event4u-app/agent-config/commit/f98d9d52998c016ad865334ffdf3964b4e01a8e3))
* **hooks:** close the twelve R2 completion-review findings in the subagent ledger ([4415ff5](https://github.com/event4u-app/agent-config/commit/4415ff54c2e8f47375aeeada5e5d9776eccefa86))
* **gates:** emit a parseable scan line, and refuse a valueless --root ([8ec2334](https://github.com/event4u-app/agent-config/commit/8ec2334a526572dd549b571f40bf9a24928dbd35))
* **refs:** re-point the archived roadmap and record a two-gate contradiction ([9671002](https://github.com/event4u-app/agent-config/commit/9671002114d27fcbd112d3f77d79dfaacc94c821))
* **roadmap:** tag the corpus-scoping roadmap lightweight, not standard ([b6676b0](https://github.com/event4u-app/agent-config/commit/b6676b09f87c48aa083feb98f2ff7343c837bd18))

### Documentation

* **review:** re-bind the findings artefact after the consumer-path fix ([fcb8ab4](https://github.com/event4u-app/agent-config/commit/fcb8ab408c9b2fbfd51d98e261ead5c572e5cf7a))
* **review:** re-bind the findings artefact after the second main merge ([cfd2695](https://github.com/event4u-app/agent-config/commit/cfd2695162708c3db80b699667dbc7108c9e057c))
* **review:** re-bind the findings artefact to the post-fix scope ([2674827](https://github.com/event4u-app/agent-config/commit/267482700c5d00db465722005888f823d50acc4c))
* **review:** re-bind the skip declaration to the merged scope ([6518a6a](https://github.com/event4u-app/agent-config/commit/6518a6a12a69bc640c70febcf36d176ae05b8992))
* **design-system:** correct two claims the review showed were too broad ([49b6e47](https://github.com/event4u-app/agent-config/commit/49b6e4741aa21a18c72c3f51f9775981f980bb1f))
* **review:** bind the R2 completion-review findings for feat-design-system-onramp ([3be0b77](https://github.com/event4u-app/agent-config/commit/3be0b771bf99816ab4b0a7d9d69c51ea8e41a848))
* **roadmap:** close road-to-local-only-gate-reds and archive it ([cfeeacc](https://github.com/event4u-app/agent-config/commit/cfeeacc81c2b09f18d7e5fcfd7a312b05dd0b209))
* **roadmap:** archive road-to-august-program on its own falsifier ([3fd5a77](https://github.com/event4u-app/agent-config/commit/3fd5a776750447e6967137be31ee76a6e1c7b4b4))
* **roadmap:** resolve the three release-integrity blockers and archive it ([9d66d73](https://github.com/event4u-app/agent-config/commit/9d66d73f45b28ed8c17b842ca0f730cf11ca614d))
* **contract:** publish the curated-head recurrence rate, (b) stands ([310b49b](https://github.com/event4u-app/agent-config/commit/310b49b1d4b5f8fe7a12d6199c84429257cc4e0c))
* **adr:** ADR-228 — the global install does not emit paths: ([d9bcbf5](https://github.com/event4u-app/agent-config/commit/d9bcbf5c46e7d4c100f1bceabe429c0df6b42990))
* **adr:** accept ADR-221, the host-native-first ladder ([a55a37f](https://github.com/event4u-app/agent-config/commit/a55a37f6f88eb08326d56a0562c22324fa1746dc))
* **review:** re-bind the round-2 findings after the fix pass ([f1403f1](https://github.com/event4u-app/agent-config/commit/f1403f1896b4570b6eb83c9ac0f1c28b1d504914))
* **review:** bind round 2 of the completion review, and keep round 1 ([7914694](https://github.com/event4u-app/agent-config/commit/7914694b9055c4b47caf5c01c49699cb1aa77f01))
* **design-system:** name the supply path where the contract is refused ([0bef92d](https://github.com/event4u-app/agent-config/commit/0bef92d6314c82978bce578effaff7e43e24ea6c))
* **roadmap:** record the Phase 3 council pass and flip its three steps ([e1c99ad](https://github.com/event4u-app/agent-config/commit/e1c99ad25ece149cd80c0879957b01702148cc00))
* **contracts:** write the concern activation policy three roadmaps cited and none wrote ([130a9d9](https://github.com/event4u-app/agent-config/commit/130a9d98ad691888a3d41bec71f170e8e6d853c3))
* **review:** re-bind the round-2 artefact to the fixed scope ([1cba2b1](https://github.com/event4u-app/agent-config/commit/1cba2b111a3759d565ec0071ee1607c7c0d6bbec))
* **review:** round 2 of the completion review, over the merged scope ([57e4fc5](https://github.com/event4u-app/agent-config/commit/57e4fc58491b80ce70f994963fbcaa6fbe972be4))
* **review:** re-bind the findings artefact after the fix pass ([b58fcd5](https://github.com/event4u-app/agent-config/commit/b58fcd59ea10b899d6feaa1b7afa632c437f3d77))
* **review:** bind the R2 completion-review findings for feat-subagent-lifecycle-integrity ([79b7c8e](https://github.com/event4u-app/agent-config/commit/79b7c8eb27f114ae6d40d6c168fa5c992be1b650))
* **review:** re-bind the completion-review artefact to the fixed scope ([c714668](https://github.com/event4u-app/agent-config/commit/c71466897e1053bc28387d3da1240a3773534a0b))
* **review:** R2 completion review for feat-local-only-gate-reds ([3c87378](https://github.com/event4u-app/agent-config/commit/3c87378c83b36da10a82af729ffa224d506716a8))
* **roadmap:** record the Phase 0/1/5 findings and the Phase 3 stop ([3fc4332](https://github.com/event4u-app/agent-config/commit/3fc433269cc36520bb10e5f08f302cdfdffc5d5a))
* **review:** declare the completion-review skip for a zero-code-path branch ([ac92f16](https://github.com/event4u-app/agent-config/commit/ac92f1686a44ca8d52cf652fb3c35ec71224d800))
* **adr:** record that paths scoping is saturated, not a corpus lever ([6c062d9](https://github.com/event4u-app/agent-config/commit/6c062d9d57e290a50b0eb544448e83b8ec03c396))
* **roadmap:** record the four closed steps, and a fifth red the repair left ([637c009](https://github.com/event4u-app/agent-config/commit/637c00913b9936d5ceb8fe5cdffa8eddd610ef47))

### Chores

* **dist:** re-project the design-system doc and halt-text changes ([070f4ce](https://github.com/event4u-app/agent-config/commit/070f4ce7b48ca0f206b6fae413a8f529d3f5bf0b))
* **roadmap:** regenerate the dashboard after the main merge ([54250e3](https://github.com/event4u-app/agent-config/commit/54250e3f6de110ba8881386e6e8c95be38b9b8d4))
* **roadmap:** close design-system-onramp Phases 1, 2 and 4; file two blockers ([80573dd](https://github.com/event4u-app/agent-config/commit/80573dd7d75ab27d026138e54ef06119daec59e8))
* **roadmaps:** regenerate the dashboard after the main merge ([d54aba9](https://github.com/event4u-app/agent-config/commit/d54aba956229302c3bc7323ddf8cafd7bd4ccb3c))
* **roadmap:** regenerate the dashboard after the second main merge ([b1a283b](https://github.com/event4u-app/agent-config/commit/b1a283bb04d9a881aa13495c28f0779557792670))
* **roadmap:** close always-loaded-corpus-scoping on its honest null ([5a9f530](https://github.com/event4u-app/agent-config/commit/5a9f53009a920ff16b9cc92e39167497a51d92ab))

Tests: 13768 (+89 since 10.3.0)

## [10.3.0](https://github.com/event4u-app/agent-config/compare/10.2.0...10.3.0) (2026-08-13)

### Release highlights

<!-- Curated head: fill before merge, keep it under 10 lines, and leave `_none_` where it is genuinely the answer. The generated log below is unchanged. -->
- **Behaviour changes:** _auto-derived, rewrite before merge:_ rule/schema diffs, breaking commits or removed public surface in 40a8b5e, d3b0f8a, c375e49, 084c220, 17efefc, 01f92df +2 more.
- **Default changes + migration:** _auto-derived, rewrite before merge:_ commits naming a default, migration or migrate in c375e49.
- **Security and correctness:** _none_
- **Honest nulls:** _none_
- **Known limitations:** _none_

### Features

* **design-slop:** promote six catalog thresholds to deterministic rules ([e87c3eb](https://github.com/event4u-app/agent-config/commit/e87c3eb55a772939b8d1e19725113db095a2c7ca))
* **gates:** verify the prompt to verdict binding that nothing checked ([658986a](https://github.com/event4u-app/agent-config/commit/658986a315d10c3f989251f3cfc91d53158cd128))
* **bench:** measure the design-slop false-positive rate against a clean corpus ([e5701fb](https://github.com/event4u-app/agent-config/commit/e5701fb10ce45f9026909137bf7be67c1eebc460))
* **design-fidelity:** the source is the data basis, and adopting the code is the default ([c375e49](https://github.com/event4u-app/agent-config/commit/c375e49133192f4ee570a9cebedfd42abc7625c7))
* **ui-route-nudge:** capture whether the artifact was read before the first UI write ([c5b22f2](https://github.com/event4u-app/agent-config/commit/c5b22f27f8b5acacc9dd8c69b325ffa1c3b0969e))
* **gates:** make the catalog-to-rule traceability claim checkable ([c280258](https://github.com/event4u-app/agent-config/commit/c28025896181c3f3c1d0f0f08fcfd21c4cf8872e))
* **skills:** enforce the published 400-line cap with a router-head gate ([3fadbfc](https://github.com/event4u-app/agent-config/commit/3fadbfc1272d08c4e4961273039d8d024ac84758))
* **judge-synthesis:** mark an uncited panelist assertion instead of dropping it ([473bf72](https://github.com/event4u-app/agent-config/commit/473bf72a95d5201dfceff884b54c90de6988042d))
* **personas:** add optional sources scoping to persona frontmatter ([084c220](https://github.com/event4u-app/agent-config/commit/084c220f0827a5e756e13c87e7991d7eeb16a43f))
* **analyze:** close the reference-repo exit with ledger rows and seed blocks ([3f2585d](https://github.com/event4u-app/agent-config/commit/3f2585d2408a4bd66c38bedbbea9ca81ce068e65))
* **rules:** extend code-provenance to the knowledge layer ([17efefc](https://github.com/event4u-app/agent-config/commit/17efefc0d00d3b43e639aa432b00aa697793849d))
* **provenance:** add a harvest ledger for externally-sourced knowledge claims ([01f92df](https://github.com/event4u-app/agent-config/commit/01f92df91060d77accea9151ca7640bb81d5de0f))
* **gates:** surface retired-container roots in non-gate scripts ([a5cb1ab](https://github.com/event4u-app/agent-config/commit/a5cb1ab3edef572cf98e72e3e08d98ab4c721f65))
* **active-remediation:** close the note-without-decision hole ([cbf1320](https://github.com/event4u-app/agent-config/commit/cbf132045f1428fbd9bfc78876cecadb211b6da7))
* **cli:** report surface-reduction candidates as a flag on commands ls ([f9d432b](https://github.com/event4u-app/agent-config/commit/f9d432b6dc82291fa4ccb390a46e232a993df8d1))

### Bug Fixes

* **evals:** repoint the orchestrator tests, and repair the teardown they hid ([a4a03a6](https://github.com/event4u-app/agent-config/commit/a4a03a60912fd4454e37c6e5b995c7bbe39bef54))
* **gates:** the parity checker counted comment text as a CI invocation ([0d70e7a](https://github.com/event4u-app/agent-config/commit/0d70e7a67a52bf5c083b18c7930a01ea9b09599c))
* **roadmap-writing:** keep the gate-test inside the skill size budget ([becd652](https://github.com/event4u-app/agent-config/commit/becd6521c76e7cde50725cb6c0c954b1f8720684))
* **evals:** resolve the eval orchestrator against the live skills tree ([4551601](https://github.com/event4u-app/agent-config/commit/455160160fb680a5e2f480054fd51f4844dccc2c))
* **roadmaps:** send a contested technical decision to the council, not the user ([cc01b0c](https://github.com/event4u-app/agent-config/commit/cc01b0c12589d88b499b351f33d3a96d51de87d7))
* **council:** raise the CLI transport timeout to match the API path ([6780f59](https://github.com/event4u-app/agent-config/commit/6780f592b4116d7d323eafade6af03b19d564c32))
* **source-first:** close the third-round findings ([4f7744d](https://github.com/event4u-app/agent-config/commit/4f7744dc6107942ca990cebdc89ee3b93a7315bc))
* **source-first:** repair the second-round findings, including a false claim in my own evidence ([40a8b5e](https://github.com/event4u-app/agent-config/commit/40a8b5e94db4b6a2eadfeb18a66d71aae6151cec))
* **gates:** act on the R2 review - exit-code contract, steering acknowledgement, IO ([85d72ca](https://github.com/event4u-app/agent-config/commit/85d72ca1fe30607b12eca0f253962c904d0af641))
* **roadmap:** capitalise the Acceptance Criteria heading so the extractor finds it ([1425280](https://github.com/event4u-app/agent-config/commit/14252809d1b1fc92e849f520b70b0113490fc27f))
* **design-fidelity:** repair the ten completion-review findings ([d3b0f8a](https://github.com/event4u-app/agent-config/commit/d3b0f8a7d83656614b05529fb0f5829a044d4bfe))
* **skills:** drop a bare threshold from the seed-intake note ([2ef65a8](https://github.com/event4u-app/agent-config/commit/2ef65a8056e12dc7eb192f08489b7dc088b4e99f))
* **design-slop:** demote the colour-lock rule, which fired on four clean files ([76a437f](https://github.com/event4u-app/agent-config/commit/76a437f1cdb1c26b700c2839fa2443b4d125e47c))
* **gates:** name the retired container by reference, not by path ([1d1c9f2](https://github.com/event4u-app/agent-config/commit/1d1c9f210dba39ee2f19f8d32a0dbf8ca0bea4aa))
* **cli:** stop the report calling canonical commands deprecation shims ([f13e151](https://github.com/event4u-app/agent-config/commit/f13e15179e81d73101814c83d68fae2e7dd5d823))
* **active-remediation:** keep the rule under the eager-load token cliff ([5a65eea](https://github.com/event4u-app/agent-config/commit/5a65eea03470aa51477f018299fb7c733b0ffd53))
* **cli:** render every visibility bucket so the breakdown sums to the total ([fe52612](https://github.com/event4u-app/agent-config/commit/fe52612f3ec88a1f54a5a0f6553cabc1d7e05b2d))

### Reverts

* **review:** drop the hand-written findings artefact, it cannot carry a verified manifest ([f930ba2](https://github.com/event4u-app/agent-config/commit/f930ba2416fc819d27b6a8bf6a6fedd16c83c7f1))

### Documentation

* **review:** re-bind after the parity wiring ([2fbf6bf](https://github.com/event4u-app/agent-config/commit/2fbf6bf3f6fc292870a24d99f4c3e883bf7309fb))
* **review:** withdraw the docs-only justification, the addition is code now ([9cf9c7c](https://github.com/event4u-app/agent-config/commit/9cf9c7c7e5f47161f78a6e880b8dc89735218833))
* **roadmap:** record the parity defect and answer Phase 4 step 1 ([6b6eed2](https://github.com/event4u-app/agent-config/commit/6b6eed24eaf29592ee588d54e50af48447d7e5a2))
* **review:** re-bind after the second main merge ([8f852d3](https://github.com/event4u-app/agent-config/commit/8f852d3c0e3ae3844e2826406700d0a03ce74121))
* **roadmaps:** close the eval-loop plan on the council-checked disposition ([afae05d](https://github.com/event4u-app/agent-config/commit/afae05d1b6639d04992d5e0f3b3515322aafb170))
* **gates:** re-measure the denominator after the main merge ([746f3fd](https://github.com/event4u-app/agent-config/commit/746f3fd383fe85b8510ddc0231c3e1525dcedf7c))
* **review:** re-bind after the main merge, and record it ([fb5426d](https://github.com/event4u-app/agent-config/commit/fb5426dd06e671f4f27658e86ffff070da581ca1))
* **review:** re-bind after the roadmap addition, and say what it did not cover ([7de39cd](https://github.com/event4u-app/agent-config/commit/7de39cd46644d983a8b00255cd8a7be81e66bbb2))
* **roadmap:** capture the four gates that are red on main and unseen ([578b336](https://github.com/event4u-app/agent-config/commit/578b33663d3aee9c30b5e4b486cef7195351ae79))
* **review:** re-bind after the main merge and the code-provenance resolution ([a2d1b78](https://github.com/event4u-app/agent-config/commit/a2d1b7803b8e2a1a6b385d375b840c8f0d87fe69))
* **proof:** regenerate the proof page for the new claims-ledger entry ([d8dc88f](https://github.com/event4u-app/agent-config/commit/d8dc88f795a6355c3dc96e02f1be86321b8e2b72))
* **review:** re-bind the findings to the repaired scope, all six terminal ([25b4478](https://github.com/event4u-app/agent-config/commit/25b4478ac299541e767a2143de9b4ef57148b61a))
* **review:** bind the third review round, 6 findings, no high or critical ([b30c87b](https://github.com/event4u-app/agent-config/commit/b30c87b0e3bd1be1395141c1dfc17e96ba8a2a6a))
* **review:** re-bind the R2 artefact after the fix pass ([3e094ce](https://github.com/event4u-app/agent-config/commit/3e094ce3cf3bfd709d44889896c73717c596807c))
* correct two false premises the R2 review caught ([491020a](https://github.com/event4u-app/agent-config/commit/491020a989021ef29db713823184e2bb4972275f))
* **roadmap:** re-review the Risk Register against what actually fired ([afcb8cb](https://github.com/event4u-app/agent-config/commit/afcb8cbde6a22095ce529e260928352888f15929))
* **review:** record the R2 completion review before the fixes ([beb439c](https://github.com/event4u-app/agent-config/commit/beb439c13d5fde35e5e8048103f539971632d8fd))
* **review:** record the completion review, 10 findings before any fix ([fbefeed](https://github.com/event4u-app/agent-config/commit/fbefeed6515bf57d72b7ad77dba10c816e359f3c))
* **roadmaps:** archive the design-detector evidence plan, fully executed ([c9a9b89](https://github.com/event4u-app/agent-config/commit/c9a9b89508157d1d71027bb945dc20d91a557830))
* **claims:** publish the phase-3 delta in the same corpus epoch ([ed2b16a](https://github.com/event4u-app/agent-config/commit/ed2b16a59d2174a7e963c6879a1324a3c588cbd5))
* **roadmap:** close structured-guard-input Phase 2 and archive it ([6ea0809](https://github.com/event4u-app/agent-config/commit/6ea08095c11b1e2ee0309ecd3aa5e350b751a831))
* **r2:** the dispatcher docstring claimed a comparison that never ran ([f9cb36d](https://github.com/event4u-app/agent-config/commit/f9cb36d2de540464486045880336fea004bb38d1))
* **roadmap:** close 11 of 18 steps, and name what blocks the other seven ([db91d7c](https://github.com/event4u-app/agent-config/commit/db91d7c369f595b338b441a92ac9dd7459eb0690))
* **roadmaps:** close phase 2 of the design-detector evidence plan ([5a228f7](https://github.com/event4u-app/agent-config/commit/5a228f76e100c71f865d27f5a96fa185a041d3c0))
* **claims:** publish the design-slop false-positive baseline ([72e3d88](https://github.com/event4u-app/agent-config/commit/72e3d8892d0079157179068d55b5ca0ac7aff2e6))
* **context:** harvest verdicts on the design-corpus upstream ([681e378](https://github.com/event4u-app/agent-config/commit/681e378474273b149ac2317d4493b12bac521278))
* **evidence:** the ad-hoc port measurement, and why it is inconclusive ([6955709](https://github.com/event4u-app/agent-config/commit/6955709fd7ae1c91ef6e2c1dba71220056055531))
* **bench:** pre-register the design-slop false-positive measurement ([65fa996](https://github.com/event4u-app/agent-config/commit/65fa996c19c4693bd0d9e3492b089482f01762c8))
* **roadmap:** correct the risk register anchor and stale gate names ([f87c5c3](https://github.com/event4u-app/agent-config/commit/f87c5c38b6395991e0322d11a0b7034cbb1b077f))
* **roadmaps:** close phase 1 of the design-detector evidence plan ([8d6f981](https://github.com/event4u-app/agent-config/commit/8d6f981fefa8cb59f3cf06072a92085458dbc8fe))
* **roadmap:** record the distillation inbox harvest and what it cancelled ([5dcd809](https://github.com/event4u-app/agent-config/commit/5dcd809616ef944fa597d84ab0483776666c1263))
* **roadmaps:** adopt the design-detector evidence plan, cut twenty of the sources twenty-five items ([6ceaa08](https://github.com/event4u-app/agent-config/commit/6ceaa080eb4beac7924affbcb19a4d1b4e85aa6a))
* **roadmaps:** triage the behavioral-proof harvest to its one live finding ([2e78aad](https://github.com/event4u-app/agent-config/commit/2e78aadaeffec0cdee75d0a376e3210881601fbb))
* **review:** re-bind after ADR-226 and the release merge ([1eff521](https://github.com/event4u-app/agent-config/commit/1eff52101d2a1015cb91f976a9efab8e03789914))
* **adr:** record that this repository keeps both rule layers ([2423a54](https://github.com/event4u-app/agent-config/commit/2423a543e177a85debcdd63a028d2ccaa0eaae13))
* **review:** re-bind after the main merge and the register fix ([408b561](https://github.com/event4u-app/agent-config/commit/408b5616278cfbc96336212ca5a5531f9efe45ba))
* **roadmaps:** park the corpus-knowledge plan until the first two corpora are named ([4c17c61](https://github.com/event4u-app/agent-config/commit/4c17c614c870f13158cae5bab0fdc49decc22fa3))
* **roadmap:** give the scoping roadmap its Risk Register ([35028ca](https://github.com/event4u-app/agent-config/commit/35028ca4aa09927e2b32e87d0b0eeac7671d9d7f))
* **review:** record the completion review that caught the shim inversion ([880f5e2](https://github.com/event4u-app/agent-config/commit/880f5e29dbb42ec8812a4f3e9978dff92d25958d))
* **review:** re-bind after the authorised re-anchor and its roadmap ([f6516fc](https://github.com/event4u-app/agent-config/commit/f6516fcccc62a5d62bb0f23cfea5065625b4bcbc))
* **roadmap:** track scoping the always-loaded rule corpus ([027bd7f](https://github.com/event4u-app/agent-config/commit/027bd7fb94b25ace176c17ea1912aa4d6dc2bbb0))
* **review:** re-bind to the derived-page scope, record the infra red ([65572bc](https://github.com/event4u-app/agent-config/commit/65572bcf4b08b1650a67fcb3834a3d4aa98d5edf))
* **proof:** regenerate after the enforced_by declaration ([6b08b8e](https://github.com/event4u-app/agent-config/commit/6b08b8e5cf0617a00b88feb61e96bad4a3847794))
* **review:** re-bind the skip declaration to the token-budget scope ([d895ad7](https://github.com/event4u-app/agent-config/commit/d895ad7056837e006b99bdc7c7ef398ab79db9a4))
* **review:** declare the remediation-ladder completion a no-code-surface skip ([b24bd16](https://github.com/event4u-app/agent-config/commit/b24bd1626809da2a14b2be5bffa2ad8538446657))
* **roadmap:** close 3.4 of -release-integrity with its three recorded decisions ([a8c8e49](https://github.com/event4u-app/agent-config/commit/a8c8e49794b9e7e7d0b8f4c13bcc17fdb4bd2e83))

### Refactoring

* **design-slop:** rename the two rules that broke the id-to-catalog convention ([6fe9111](https://github.com/event4u-app/agent-config/commit/6fe911105e52d3be31793e40cbc8d0da8ad803ab))

### Tests

* **gates:** assert the prompt-binding invariant, not a frozen count ([ee5a61c](https://github.com/event4u-app/agent-config/commit/ee5a61c841fc4a8564899eea24a1674a50b814aa))

### CI

* wire the design-antipattern parity gate into a workflow ([b93df01](https://github.com/event4u-app/agent-config/commit/b93df013381e38ae0ca594c810905866b204ed71))
* wire the harvest-ledger and router-head gates into task ci ([729811f](https://github.com/event4u-app/agent-config/commit/729811f6ef724cb51c108cd8e4cf4dfb582b2977))

### Chores

* **roadmaps:** regenerate the dashboard after the main merge ([d189ea6](https://github.com/event4u-app/agent-config/commit/d189ea67076d6a0aaea4bb99bb16ef270661d499))
* **roadmap:** regenerate the dashboard after the main merge ([fde4d00](https://github.com/event4u-app/agent-config/commit/fde4d00cd943f7296c10b98bde0ce67a05bbaa8a))
* **index:** regenerate index and catalog after the harvest changes ([e5dc63f](https://github.com/event4u-app/agent-config/commit/e5dc63fc99e58566ab74da72655265a1e1cd2022))
* **roadmap:** regenerate the dashboard after the second main merge ([bc6ba86](https://github.com/event4u-app/agent-config/commit/bc6ba8693b106335cbb5e1c2ded74163d9ab2c5b))
* **roadmap:** regenerate the dashboard after merging main ([1e1ada7](https://github.com/event4u-app/agent-config/commit/1e1ada7eb4809507e67167b0070ad59777da449c))
* **tokens:** re-anchor the eager-rule-load baseline, itemised ([4a9110f](https://github.com/event4u-app/agent-config/commit/4a9110f5a7771dfab5dca7b10aa0891d42792143))

Tests: 13679 (+173 since 10.2.0)

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
