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

# Era: 9.10.x — current

> Started at `9.10.0`. Full entries live inline below.
> The drift test caps this era at 250 lines of entry body; growth past
> that forces a new era split (`# Era: 9.11.x`, etc.) — see
> [`docs/contracts/CHANGELOG-conventions.md § Era splits`](docs/contracts/CHANGELOG-conventions.md).

## [9.10.0](https://github.com/event4u-app/agent-config/compare/9.9.0...9.10.0) (2026-07-31)

### Features

* **bench:** attempt 2 of the anchor instrument — structured verdicts + retry ([363b45f](https://github.com/event4u-app/agent-config/commit/363b45f8f73c157e1a239670fcabe2fcccc35ee0))
* **bench:** build the anchor-evaluation instrument, and record it as a null ([3c83dfe](https://github.com/event4u-app/agent-config/commit/3c83dfe5054caed5c3dcb53069fdf91cdd2eccbb))
* **rules:** land the P4 migration the narrowed lock now permits ([4e4a5f0](https://github.com/event4u-app/agent-config/commit/4e4a5f0c0a3b46db3025702ecf60d884ad568fcd))
* **gates:** narrow the safety-floor lock to substantive changes ([dbf96a2](https://github.com/event4u-app/agent-config/commit/dbf96a2848689866896b1b3af9c1f19da79956a4))
* **golden-set:** complete rule coverage — 20 tasks for the uncovered rules ([b77c0e3](https://github.com/event4u-app/agent-config/commit/b77c0e3b5d85339634fe8c2f63bd9213d3f81af1))
* **memory:** wire the miner's last mile into the global observation buffer ([bee7de4](https://github.com/event4u-app/agent-config/commit/bee7de44c2e4cd287120eed727a87c2c0177f60f))
* **cache-economy:** ratchet the per-spawn payload, document the dormancy route ([e0e3024](https://github.com/event4u-app/agent-config/commit/e0e30245d97bf16d9507baa44d6b4c900fc2ee1b))
* **projection:** scope-dedup the rule projection — C-3 measured at 38.0% ([6428430](https://github.com/event4u-app/agent-config/commit/6428430d274f1f6576249617a3c7e848f4cf0874))
* **user-memory:** global user layer — profile cascade, learning channel, delete path ([fa7b8e0](https://github.com/event4u-app/agent-config/commit/fa7b8e0381aee0e989212a2e77d029bb7b4879e1))
* **cache-economy:** measure prompt-cache realization without a daemon ([3b8a54a](https://github.com/event4u-app/agent-config/commit/3b8a54a978f045e11724f329a3776be5bfeb956e))
* **gates:** a parity gate for the CI-vs-local drift, and wire the 10 it found ([678ef79](https://github.com/event4u-app/agent-config/commit/678ef79435632372b80dd8ffd41a3614da33f7ab))
* **condense:** read staleness off the projection, drop the hash cache ([23f189a](https://github.com/event4u-app/agent-config/commit/23f189a581de821fe7d4b043c53781bae42fc2d8))
* **gates:** assert dist == rewrite(src) byte-for-byte ([fb4c9a5](https://github.com/event4u-app/agent-config/commit/fb4c9a591a7676b63976324fab9edb8e3678a08c))
* **projection:** copy .md verbatim and honour compile-time toggles ([0464d4d](https://github.com/event4u-app/agent-config/commit/0464d4d043033f47040d00c6e65ebcac5b067f41))
* **bench:** export blinded answer pairs for an external instrument ([c509f9f](https://github.com/event4u-app/agent-config/commit/c509f9fe467286b9df320dcd4606b0808843375b))
* **telegraph:** make the rule dormant by default per ADR 0001 ([c41bb4e](https://github.com/event4u-app/agent-config/commit/c41bb4ee306e7fa7e1495a9deca6f8e82c84f09d))
* **gates:** add a coverage guard that fails gates which scan nothing ([72a12c2](https://github.com/event4u-app/agent-config/commit/72a12c29566ea3c34cee74e3efa4e7a8dd30f081))
* **encoding:** close the visible-layer gap, measured against the frozen corpus ([0ba6c16](https://github.com/event4u-app/agent-config/commit/0ba6c162c7c7e07aa096b6a3e38a43e6256d28dc))
* **corpus:** freeze a labelled text-layer encoding corpus before any detector ([4aadfb1](https://github.com/event4u-app/agent-config/commit/4aadfb10d90de1b003dc33ae9cf157585ed5c31e))
* **lint:** extend the hidden-unicode gate to raw control bytes in sources ([c38e9bd](https://github.com/event4u-app/agent-config/commit/c38e9bdc22893c4ab4e4aaab864fe0f17556ed0e))
* **gates:** add scan-scope assertions so a gate that read nothing cannot pass ([2934905](https://github.com/event4u-app/agent-config/commit/2934905f6392dae47d7847358977235613223b91))

### Bug Fixes

* **lint:** drop the unused pathToFileURL import in the anchor runner ([bf7d9f3](https://github.com/event4u-app/agent-config/commit/bf7d9f3fe93abcf855ae8e80f66b65f0f42719a0))
* **council:** gpt-5 was never unusable — it missed the reasoning branch ([af3ed6e](https://github.com/event4u-app/agent-config/commit/af3ed6e7ea611ac2e1bf7f1152c752974ca5c106))
* **ci:** let a label actually override the kernel-rule bundle gate ([cd1537f](https://github.com/event4u-app/agent-config/commit/cd1537f5f5a75e245954b2dd6e364ce049f40656))
* **ci:** scope actionlint to the workflow files the PR changes ([1ed8a40](https://github.com/event4u-app/agent-config/commit/1ed8a4054843831d2c022fee8de8c59646a41cbf))
* **ci:** repair the Consistency workflow — a duplicate run: key broke it ([c78d26b](https://github.com/event4u-app/agent-config/commit/c78d26b833aa57fab6ea1138a164206978bc9301))
* **review:** resolve the review-gate and council findings on #1055 ([1e7c3a0](https://github.com/event4u-app/agent-config/commit/1e7c3a00da5d7381da6706fb928ca035127e8dba))
* **portability:** drop the vendor env-var name from a portable command body ([a56f059](https://github.com/event4u-app/agent-config/commit/a56f059f7ea3d87031a8023fa940128e5043e63a))
* **portability:** drop the vendor env-var name from a portable command body ([95714c9](https://github.com/event4u-app/agent-config/commit/95714c93fdca37c566339024d2f930c32ae2be8d))
* **ci:** regenerate the derived surfaces the count bump left stale ([b043d80](https://github.com/event4u-app/agent-config/commit/b043d803e90f5e23a892c791e9edfd2352480b09))
* **ci:** regenerate the derived surfaces the count bump left stale ([171ff8c](https://github.com/event4u-app/agent-config/commit/171ff8c665e74b682e39bf4730a5552695945b21))
* **rules:** bring no-cheap-questions back under its concentration ceiling ([1a450f6](https://github.com/event4u-app/agent-config/commit/1a450f6bc4d99fb70c8bf1be81044975ca136c0d))
* **ci:** run the token-regression gate in CI and re-anchor its baseline ([dbcc3b4](https://github.com/event4u-app/agent-config/commit/dbcc3b4b33d474faddca72dc43e0fa28f299146e))
* **ai-council:** thread daily_limit_usd from config so the spend ledger can exist ([3fd0da1](https://github.com/event4u-app/agent-config/commit/3fd0da1c8f1da4e470a36aee8b446e605c53868f))
* **ai-council:** price the realized cost with cache multipliers, add a gated TTL key ([485d792](https://github.com/event4u-app/agent-config/commit/485d7928b9a75a3699e1ec3d1bb8bbb2915dc580))
* **commands:** give /tdd the non-interactive contract section it declares ([224b3df](https://github.com/event4u-app/agent-config/commit/224b3dfb5e009f2b0460dbd57ef966cfde5fbe21))
* **commands:** conform the team dispatcher's sub-command table header ([874004f](https://github.com/event4u-app/agent-config/commit/874004fade359aa129cfbbfa054d65809c9ce9ff))
* **index:** point the shipped catalog's proof link at the published URL ([e375fe0](https://github.com/event4u-app/agent-config/commit/e375fe0eeb0e7bd14619984d76734fd42fe8a14e))
* **index:** drop compile-disabled rules from the artefact index ([54f7a2b](https://github.com/event4u-app/agent-config/commit/54f7a2bf5152a376d5d93444987e5a52846bb9d3))
* **skills:** cite humanizer's declared context-spine slots ([315138d](https://github.com/event4u-app/agent-config/commit/315138dcf04699be9afe815b647e4cfeb86bbbab))
* **skills:** persona-governance is a rule, not a required skill ([8f26e7a](https://github.com/event4u-app/agent-config/commit/8f26e7ab4a8261da0e9028a3568111bf8b2df1c6))
* **gates:** drop an unused constant in the parity checker ([c87024d](https://github.com/event4u-app/agent-config/commit/c87024de17b61a0830073a4f120d6acc4ebe7fe2))
* **tests:** omit the optional key instead of setting it undefined ([62df5a9](https://github.com/event4u-app/agent-config/commit/62df5a9ca41c41e01f6a2487dd035adfff0ab99a))
* **gates:** delete the vacuous per-pack matrix, close the second silent-green ([743eb52](https://github.com/event4u-app/agent-config/commit/743eb525d2f7e26db722ced633b93cdb14c2f074))
* **gates:** ban the Python-twin claim shape, not the word twin ([c323a7b](https://github.com/event4u-app/agent-config/commit/c323a7baffc62122996fc98a4fad2dc0f4caaf88))
* **projection:** keep a compile-disabled rule out of the per-tool symlinks ([09a6907](https://github.com/event4u-app/agent-config/commit/09a690728c0d1684d6da84f099705bf100d200db))
* **gates:** stop the count checker judging a gitignored generated file ([d0e1d56](https://github.com/event4u-app/agent-config/commit/d0e1d56a8d2b9164f2220e9bf87ab12522418295))
* **ci:** run check-index, the gate that only existed locally ([7d6a0f5](https://github.com/event4u-app/agent-config/commit/7d6a0f5e74c726b9be3edb394db260b87cb62268))
* **generated:** regenerate the artefact index and catalog ([ac02e4a](https://github.com/event4u-app/agent-config/commit/ac02e4abad8072c6117bfd2cacb087a339ae55ca))
* **rules:** clear the long_rule warning on the two rules that carried it ([d291e46](https://github.com/event4u-app/agent-config/commit/d291e469183056e9e7cd6d4a208a410e75e95cac))
* **ci:** three reds the local gate sweep did not cover ([db671a6](https://github.com/event4u-app/agent-config/commit/db671a66c9d85b12045cd987c466cdae98386e35))
* **tests:** close four reds this branch introduced ([a5d4ef7](https://github.com/event4u-app/agent-config/commit/a5d4ef779fe9b8475ad15a94978037ed0383f79a))
* **gates:** import the real path rewriter instead of a copy of it ([9da906f](https://github.com/event4u-app/agent-config/commit/9da906f76086be7ba34ff849c05cf6b2291395b3))
* **annotate-discovery:** stop writing the condensation-hash ledger ([f23260f](https://github.com/event4u-app/agent-config/commit/f23260f8235b41828059c057838f64a974c8a91c))
* **sync:** teach the consistency gate the compile-time toggle ([712c9a4](https://github.com/event4u-app/agent-config/commit/712c9a4bb44940b42fc7b0c65f964c1aaf1ee907))
* **load-context:** normalise a disallowed relative root ([ef503b5](https://github.com/event4u-app/agent-config/commit/ef503b533180219032cd7d2e845c8bdd8cf4747b))
* **rules:** bring sixteen auto-rule descriptions under the 150-char cap ([5629855](https://github.com/event4u-app/agent-config/commit/5629855c915c72765050053d1c2e29429b4c023f))
* **dist:** restore nine defects the blind checker had hidden ([8dc351b](https://github.com/event4u-app/agent-config/commit/8dc351bc1e207023fea87c87c29b35c1fc904a0b))
* **rules:** repoint eight dead path_prefix triggers at the real source tree ([ea868e8](https://github.com/event4u-app/agent-config/commit/ea868e897233e61bf86d0a504c9dc986d7a95e0a))
* **gates:** widen the legacy-path guard to tests/ ([ffc813b](https://github.com/event4u-app/agent-config/commit/ffc813b0ada1efe943590d0857ea9f3bb25e99ac))
* **gates:** retarget five gates off the tree emptied by ADR-051 ([fa07047](https://github.com/event4u-app/agent-config/commit/fa07047b89505dadfaf2dd817e627ad797559dc8))
* **lint:** widen the source pass to DEL and C1, which bytes alone missed ([3e83b5d](https://github.com/event4u-app/agent-config/commit/3e83b5dfa9cf4cb64460eab9a08a1800f85510da))
* **corpus:** stop the freeze test from mutating the committed corpus ([1621031](https://github.com/event4u-app/agent-config/commit/16210316b4ea291d1e9bc7700f424c9c5b8f75aa))
* **retrieval:** run the sanitize floor on every read surface, not just v1 ([62c2a8c](https://github.com/event4u-app/agent-config/commit/62c2a8c242b6e38f407f8546470a99725526dc5b))
* **encoding:** escape raw control bytes so text sources stay tool-readable ([6f5db06](https://github.com/event4u-app/agent-config/commit/6f5db06f5dca4818d2f0c2c8137ad60db7eea998))
* **gates:** drop the legacy-path retention the ADR-051 guard rejects ([941bff8](https://github.com/event4u-app/agent-config/commit/941bff82a3f07b74bf523e7d438452a0b4d03f84))
* **gates:** repoint the iron-law and new-skill gates at the real source roots ([5eb3256](https://github.com/event4u-app/agent-config/commit/5eb3256bc38fc8ea9b41d22d41e09b5334b58669))
* **gates:** make the safety-floor guard capable of failing ([0912323](https://github.com/event4u-app/agent-config/commit/0912323012409082f0587d06a186fdb0cebd2f6b))

### Reverts

* **rules:** take the guarded safety-floor rules back out of this PR ([f50f946](https://github.com/event4u-app/agent-config/commit/f50f946f53f433ca9aabfab479bd4004d516bfdc))

### Documentation

* **dedup:** close the reachability strand with a maintainer refusal (#1066) ([1bb6c98](https://github.com/event4u-app/agent-config/commit/1bb6c985812ab01ab64863429ff2965004c5bda5))
* close ADR-202 — instrument not achievable with available evaluators ([5d08b15](https://github.com/event4u-app/agent-config/commit/5d08b1598990ce575be3b7367d7d35536b06fcf5))
* **roadmaps:** park the gate-blocked zero-ceremony work in later/ ([a5c87e9](https://github.com/event4u-app/agent-config/commit/a5c87e94eb5501b28cccaa4f2e6f6283113382ac))
* **roadmaps:** add the two active zero-ceremony roadmaps ([f03d6fd](https://github.com/event4u-app/agent-config/commit/f03d6fda92efc8bd656901c79d2ad397c6e7db43))
* **decisions:** record the zero-ceremony inbox cut ([c8b3f30](https://github.com/event4u-app/agent-config/commit/c8b3f30d664efa964d020f6e2b8da062bc915125))
* **dedup:** close scope de-duplication as an honest null and draft its reachability strand ([3eb6136](https://github.com/event4u-app/agent-config/commit/3eb61364741ba802d484a16d95094fa3b4354bd6))
* **adr:** record the operator tie-break on the split safety-floor council ([a14a8ac](https://github.com/event4u-app/agent-config/commit/a14a8ac393cd0910786b985abdc6b2fb4620258c))
* **roadmap:** sequence the thin flip under anchor-scoring ([0245572](https://github.com/event4u-app/agent-config/commit/02455721c91aa036ac5c80490e31f9e0e40c70e9))
* **adr:** register the hybrid threshold and transcript freezing ([41582b7](https://github.com/event4u-app/agent-config/commit/41582b7a81e81a921122827cf77ea4b5dab70a9f))
* **golden-set:** spell out that a path in the prompt is not a path_prefix match ([442fb08](https://github.com/event4u-app/agent-config/commit/442fb08fb99f2217bcf04dd4e9f3789248b8b507))
* **roadmaps:** archive both roadmaps — all 8 deferrals resolved ([06137ee](https://github.com/event4u-app/agent-config/commit/06137ee6e698bdbd8694d133119c11eb789418e5))
* **cost:** cancel the two breadth counters, mark stale cost claims ([39658d4](https://github.com/event4u-app/agent-config/commit/39658d493f43554c655473e9bc8249041e147991))
* **adr:** record anchor-scoring as the thin-projection quality instrument ([785829a](https://github.com/event4u-app/agent-config/commit/785829ae3fc5689c9a4d0c5bd8320b2d029fbd54))
* **cache-economy:** pre-register the C-3 reduction, metric and threshold ([e62183f](https://github.com/event4u-app/agent-config/commit/e62183ff0cb15f318dc2631fa490a936735c7f2c))
* **roadmaps:** execute both roadmaps — measured verdicts and honest deferrals ([955ce26](https://github.com/event4u-app/agent-config/commit/955ce26c5445a7809e981c33996b41861fa2ff9b))
* **cache-economy:** correct the Claude Code cache guidance, record the refusals ([a43b260](https://github.com/event4u-app/agent-config/commit/a43b260a542853ca287f700940f3e1f0a3e11f79))
* **roadmaps:** record where local-CI trust stops and why ([275cb18](https://github.com/event4u-app/agent-config/commit/275cb18da9fd99c737da7451a8a98931b0e844c0))
* correct the command count in the README badge and getting-started ([5da637e](https://github.com/event4u-app/agent-config/commit/5da637e7f1f0ab3f009f46a9fd41aec12f272a63))
* **contracts:** add the beta review marker to the five newly tagged contracts ([edb88c5](https://github.com/event4u-app/agent-config/commit/edb88c520513c8140a0f5d629c1fb429ef11f8d9))
* **contracts:** tag five contracts with their stability level ([b3dd89a](https://github.com/event4u-app/agent-config/commit/b3dd89af01972e6ef1bee88cd9429746b5265655))
* **roadmaps:** add the global user-memory layer roadmap ([2d8b104](https://github.com/event4u-app/agent-config/commit/2d8b1043197cda85e344bf4b6b57f0a3d97459f2))
* **contexts:** record the global user-memory council cut ([216b033](https://github.com/event4u-app/agent-config/commit/216b03396ce4ae2afe90a5210aff3377c9d6a783))
* **adr:** raise ADR-201 step 4 from deferred to executed ([8e1eaf6](https://github.com/event4u-app/agent-config/commit/8e1eaf607564be51adaaec60e95b2b2f898e5388))
* **maintainers:** state byte-exactness where hash tracking was documented ([864e479](https://github.com/event4u-app/agent-config/commit/864e479a2f140230df438c534d54080e24cd1fb4))
* **agents:** remove the mark-as-condensed step from every agent surface ([2aef848](https://github.com/event4u-app/agent-config/commit/2aef84899a029a934d507e5dec6e67fe2c6eb332))
* **adr:** record why ADR-201 step 4 was not executed ([15d747b](https://github.com/event4u-app/agent-config/commit/15d747b67e16bcef2ec7dcbb70895cff67a7c86e))
* **condense:** retire the prose-rewrite step and its preservation clause ([debf2b5](https://github.com/event4u-app/agent-config/commit/debf2b5425c72f31d029107c66376b8a9e5181fb))
* **roadmaps:** record the H2/H3 measurements and the council verdicts ([8c8328f](https://github.com/event4u-app/agent-config/commit/8c8328f1f7c0291120c3478a279ba2dd9f19271b))
* **council:** mechanism claims need a probe, not a second opinion ([cc60b13](https://github.com/event4u-app/agent-config/commit/cc60b13bdf146dd5f24d8092039aa8eeaaba5693))
* **adr:** record ADR-201, remove the LLM .md condensation ([04e1168](https://github.com/event4u-app/agent-config/commit/04e116876316165c3103d3befcdf179ba2a48583))
* **contracts:** mark the locked condensation rate as contradicted ([42c4b1e](https://github.com/event4u-app/agent-config/commit/42c4b1e24987cb004df5c69183a6d723ce9b6d20))
* **claims:** bind the encoding floor's coverage boundary to the ledger ([31c699b](https://github.com/event4u-app/agent-config/commit/31c699bb4d6d0691321a3cc32f6a03d085a34e5c))
* **roadmaps:** close and archive runtime encoding hardening ([976f32e](https://github.com/event4u-app/agent-config/commit/976f32eba06c6fe0fe11e459f5bcbea5eacbd128))
* **evidence:** measure text-layer channel coverage and fix the disposition ([8a35666](https://github.com/event4u-app/agent-config/commit/8a35666d18e3e999450fed8ea9a0ee2def210d5b))
* **roadmaps:** close Phase 0 of runtime encoding hardening ([6ed2ee7](https://github.com/event4u-app/agent-config/commit/6ed2ee75366e386cb03685cede3e385ba0baa1c6))
* **roadmaps:** land the minimalism borrow on two axes, park the obsolescence lifecycle ([c025072](https://github.com/event4u-app/agent-config/commit/c025072b65ab2a0792c80ed9a20dc133e3ad84ea))
* **roadmaps:** open the two adversarial-hardening roadmaps, and correct a claim I read as fact ([73d9247](https://github.com/event4u-app/agent-config/commit/73d92473d3d40c59e55889d64cd9ab2f0056465e))
* **contexts:** record the elder/ponytail harvest cut and its verified findings ([ea3fac7](https://github.com/event4u-app/agent-config/commit/ea3fac77b6d9f861112d90d375a848840a39e3e6))
* **roadmap:** open road-to-gates-that-can-fail and record Phase 1/2 progress ([2a6a723](https://github.com/event4u-app/agent-config/commit/2a6a723205c2a86e248dad6c0d33c3e4eafeac15))
* **contexts:** record the two post-mortems behind the gate work ([086b641](https://github.com/event4u-app/agent-config/commit/086b641ea92baefcee77ee998f8542ad75bd419b))

### Refactoring

* **rules:** bring the kernel bucket back under its cap ([3f34dbd](https://github.com/event4u-app/agent-config/commit/3f34dbd669e66a247411b1cc4f5ab65b91788d5e))
* **confusables:** extract the TR39 signature to one shared definition ([1a62a9b](https://github.com/event4u-app/agent-config/commit/1a62a9b9158803527abd30739c6c3275700ad072))

### Tests

* **rig:** isolate the spawn rig's HOME before wiring any global write ([3b5cb08](https://github.com/event4u-app/agent-config/commit/3b5cb087ba1c7e26bc5de96e59bd4a8287f84558))
* **condense:** pin the staleness basis, including what the cache could not see ([b983fe2](https://github.com/event4u-app/agent-config/commit/b983fe29c615a87fd6b1f93588a6e64d13615e75))

### Build

* **install:** resync rule_scope output with its source ([f6940f2](https://github.com/event4u-app/agent-config/commit/f6940f2021cd7d7727a8ee4d729a74ae314431d5))
* **install:** ship the missing compiled output for three tracked sources ([8757544](https://github.com/event4u-app/agent-config/commit/87575449056a0ecce152bc6d823059faabfac8fd))

### CI

* **gates:** add actionlint and run the kernel budget on every PR ([7100628](https://github.com/event4u-app/agent-config/commit/710062886d55e1e3fba70f6f092e88c451803492))
* **gates:** run the kernel-rule budget in CI, not only on a laptop ([f2cc8a9](https://github.com/event4u-app/agent-config/commit/f2cc8a9c33a0278c0e31cffee9e1a3ff8f9174e1))
* **static-checks:** fail the build when dist/install drifts from its source ([06360e1](https://github.com/event4u-app/agent-config/commit/06360e180d8bfab2b19b0a5e551b0c4c4ed83694))

### Chores

* **lint:** clear the two standing lint-report entries ([d437ca8](https://github.com/event4u-app/agent-config/commit/d437ca84e265e85a8f8077072006a06dc7cc179d))
* **generated:** regenerate the roadmap dashboard after merging main ([ee0823e](https://github.com/event4u-app/agent-config/commit/ee0823e73317d45331d9f6a32fe4577dac17e72c))
* **generated:** resync the meta pack README after the main merge ([c3b25ef](https://github.com/event4u-app/agent-config/commit/c3b25ef2c8c4caaf9bdeeb5ac7772123bf1cbc1c))
* **generated:** regenerate counts for the new /agents user delete leaf ([bd3e7a4](https://github.com/event4u-app/agent-config/commit/bd3e7a43d7d38664269fd51713cb06503e1d5453))
* **generated:** regenerate the file-ownership matrix ([b55e5b0](https://github.com/event4u-app/agent-config/commit/b55e5b059d19c5dd5003b5e3fde08e3697898066))
* **scripts:** classify ai_team and code_graph as lab ([2a2d938](https://github.com/event4u-app/agent-config/commit/2a2d938c9ebf8c46482bd8eda9f5aa519350fc5a))
* **skills:** omit the defaulted source field on three skills ([4ef14f8](https://github.com/event4u-app/agent-config/commit/4ef14f83f98fb5f4420bae1e4a65555d2434e95c))
* **dist:** project the seven new trigger-eval sets ([a9b03b4](https://github.com/event4u-app/agent-config/commit/a9b03b4e107d620a568b72e02e9f09b702c74b92))
* **ci:** replace the hash gate with the byte-exactness gate ([656f04a](https://github.com/event4u-app/agent-config/commit/656f04af0e4913bb4b9c529698b80e3eaa74c5e8))
* **generated:** regenerate counts and pack READMEs ([480508e](https://github.com/event4u-app/agent-config/commit/480508ed636bfd9453a62cb5c83e8cc5cf4a7d0b))
* **dist:** drop six build artefacts this branch did not author ([6369f8f](https://github.com/event4u-app/agent-config/commit/6369f8f930ea8af8f31e11b9f1d0ab8407b0fc8d))
* **dist:** collapse the projection to a deterministic derivation ([9caa43f](https://github.com/event4u-app/agent-config/commit/9caa43f2e0b4ac378294e1c54a1cac3a1e55baf3))
* **reports:** refresh the derived outputs the consistency gate regenerates ([2e49aa3](https://github.com/event4u-app/agent-config/commit/2e49aa397270b3812d1e92cd594c8af3b8ad6c6f))
* **lint:** clear the ESLint errors the pre-push gate surfaced ([19ba531](https://github.com/event4u-app/agent-config/commit/19ba5311e3689d9db34d8bbb024a730e02ea6898))

Tests: 9470 (+390 since 9.9.0)

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
