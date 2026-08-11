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

# Era: 9.31.x — current

> Started at `9.31.0`. Full entries live inline below.
> The drift test caps this era at 250 lines of entry body; growth past
> that forces a new era split (`# Era: 9.32.x`, etc.) — see
> [`docs/contracts/CHANGELOG-conventions.md § Era splits`](docs/contracts/CHANGELOG-conventions.md).

## [9.33.0](https://github.com/event4u-app/agent-config/compare/9.32.0...9.33.0) (2026-08-11)

### Release highlights

<!-- Curated head: fill before merge, keep it under 10 lines, and leave `_none_` where it is genuinely the answer. The generated log below is unchanged. -->
- **Behaviour changes:** _auto-derived, rewrite before merge:_ rule/schema diffs, breaking commits or removed public surface in e625e69, 9ec8042.
- **Default changes + migration:** _auto-derived, rewrite before merge:_ commits naming a default, migration or migrate in 2588c5b.
- **Security and correctness:** _auto-derived, rewrite before merge:_ security-scoped commits in b17d1f3.
- **Honest nulls:** _auto-derived, rewrite before merge:_ commits carrying an honest-null marker in 9e999d6, b86a4a9.
- **Known limitations:** _none_

### Features

* **gates:** add --reply, the reply-close projection over open blockers ([dd88d21](https://github.com/event4u-app/agent-config/commit/dd88d2116dcc73a1351e292047c0b22a8f84fdd7))
* **funnel:** the missing Opportunity stage ([ca5aabd](https://github.com/event4u-app/agent-config/commit/ca5aabd834db73755f2a6eba8efa5dc2edd2bb1b))
* **recycle:** --verify validates without writing, plus an envelope mutation suite ([a9ad7d8](https://github.com/event4u-app/agent-config/commit/a9ad7d88ea214f2eb9dd12e406f93e9cbfb7bc17))
* **conformance:** --why <id> traces one conformance check ([807a85c](https://github.com/event4u-app/agent-config/commit/807a85caed1a7b79499f1071d4202ed17142b6e2))
* **doctor:** --anatomy renders the injection anatomy from existing measurements ([6ed0aac](https://github.com/event4u-app/agent-config/commit/6ed0aac994ef14b42d5e65bd86a5c4734648cceb))
* **cost-summary:** report what caching bought, when spend happened, and where input went ([3dbc570](https://github.com/event4u-app/agent-config/commit/3dbc57082506a00a51dca76fdb06610e720a754d))
* **cost-ledger:** record the model that actually answered, not the one asked for ([8b79067](https://github.com/event4u-app/agent-config/commit/8b790671bb780629fd30a06a47dacf957da93c3d))
* **council:** mark a solo-concluded pass in the rendered quorum line ([b6a90ab](https://github.com/event4u-app/agent-config/commit/b6a90ab405a2d0a5bdee655f8fa34f45b3ae4d74))
* **ci:** resolve workflow path filters against the tree, and repair 20 dead ones ([77f200f](https://github.com/event4u-app/agent-config/commit/77f200f0885d5ac6b28c9d5b98d737665d847954))
* **council:** make a solo-concluded quorum distinguishable in the event log ([5addcd0](https://github.com/event4u-app/agent-config/commit/5addcd0a9bee200ec2fbc529a6365254c397e68f))
* **budget:** register the three attendance metrics before any data exists ([b6bf44d](https://github.com/event4u-app/agent-config/commit/b6bf44dd799c2854e7caa576ca3cd2d29889f560))
* **council:** make a solo-concluded pass visible in the event log ([ec8ede6](https://github.com/event4u-app/agent-config/commit/ec8ede6ec50b8aa5e9daecfcc35c26486ad1bb14))
* **budget:** the cost-parity target table, with a gate that refuses an untraceable number ([b86a4a9](https://github.com/event4u-app/agent-config/commit/b86a4a9d4efc2ab1dff74ba56724b07061850b8e))

### Bug Fixes

* **cost-ledger:** repair the seven findings from the R2 completion review ([4204a99](https://github.com/event4u-app/agent-config/commit/4204a99a118ab8e8ed04fb3674821b69c0616f1a))
* **changelog:** curate the shipped v9.32.0 head, record the cadence decision ([27616e6](https://github.com/event4u-app/agent-config/commit/27616e6046424b12d5b203399dbd3435fb535c48))
* **install:** record the .vscode bridge merge, surface trampoline removal failures ([c1f15c1](https://github.com/event4u-app/agent-config/commit/c1f15c18f1da0d6e079a2bc4e16f311af6b1ccba))
* **pricing:** stop pricing a dated model alias at nothing, and stop hiding it ([3fbcc52](https://github.com/event4u-app/agent-config/commit/3fbcc52c436bbdc063aa1476b9a3dc281b38180e))
* **wedge:** regenerate the production-validator projection after the pragma ([8ab3012](https://github.com/event4u-app/agent-config/commit/8ab3012ab40a54d228d11fadfd0ba072a0fa08fa))
* **security-lint:** the bare-shell detector had never read a subagent ([b17d1f3](https://github.com/event4u-app/agent-config/commit/b17d1f33653438ab6489c64f33dce403a4f8d2c1))
* **test:** drop the last v1 label the schema bump left behind ([6f53010](https://github.com/event4u-app/agent-config/commit/6f530100a3b2af7cc4b43b7e58fcb2862df9a48a))
* **council:** measure the dispatch shape, and stop dividing entries by clients ([d716386](https://github.com/event4u-app/agent-config/commit/d7163864715e15d879ce6af1c1f6db028832d824))
* **council:** make the attendance metrics able to answer their own questions ([8f92902](https://github.com/event4u-app/agent-config/commit/8f929020301bfdb50e6d788a71e1050f9ff58d43))
* **ci:** describe the retired tree without naming its dead path ([bd2e726](https://github.com/event4u-app/agent-config/commit/bd2e726883aecf5106522fa7324c1d11aa3a0473))
* **roadmap:** re-date the index risk review after the substantial rewrite ([6f71cb4](https://github.com/event4u-app/agent-config/commit/6f71cb4f23cfbf2eb344be4a070281e45b2c1fdf))
* **schema:** let a subagent express the scoped tool grant tool-safety asks for ([9ec8042](https://github.com/event4u-app/agent-config/commit/9ec8042d2c73162931c0d7900826934fdaafccfa))
* **review-routing:** give the role vocabulary a home that exists ([ec4d392](https://github.com/event4u-app/agent-config/commit/ec4d392faf4feaaf5fbf0694bc028b6e54d0fe2c))
* **skills:** re-home two sections the rule migration dropped ([2588c5b](https://github.com/event4u-app/agent-config/commit/2588c5be9f82bab41ebedcddd0ad4302dbfc245a))
* **review:** name the skip artefact so the gate can discover it ([b693b61](https://github.com/event4u-app/agent-config/commit/b693b61e94e5ded5463c22124acb20a1ca776d00))
* **roadmap:** correct three false premises in the gate-integrity kernel blocker ([2e6c07e](https://github.com/event4u-app/agent-config/commit/2e6c07e66eec04ddf8afb8e233340c2e628141fa))
* **roadmap:** stop two sub-headings from parsing as phantom phases ([05ed949](https://github.com/event4u-app/agent-config/commit/05ed9493b153c19253fcad3c98a939d76dd09f31))

### Documentation

* **adr:** ADR-222 — blocker handover is delivered, not remembered ([961ac12](https://github.com/event4u-app/agent-config/commit/961ac12705db642f54119f39dfef9ac5cbea870c))
* **reply-close:** state the blocker handover as part of the one summary ([ec761e0](https://github.com/event4u-app/agent-config/commit/ec761e04b13e05ea671ba906bfbfd05999e25563))
* **review:** re-bind the completion review to the repaired scope ([0a585db](https://github.com/event4u-app/agent-config/commit/0a585db2279c83bbf09a1b3afd18852833795c89))
* **roadmap:** release-surface integrity, 11 of 12 steps closed ([70cec30](https://github.com/event4u-app/agent-config/commit/70cec30255f61de1aeaa39551e008992c63f606c))
* **context:** Continuation Protocol v1 decided, the runtime graph deferred ([3bafcc0](https://github.com/event4u-app/agent-config/commit/3bafcc075c6db2bcaf9a9725ee87fdb190bd7a73))
* **contracts:** the model ceiling escalates, never silently degrades ([e625e69](https://github.com/event4u-app/agent-config/commit/e625e696fb4f2d90110f8678dd86e208ec0f4729))
* **cli:** name the three new flags in the registry synopses and dispatcher help ([1f43731](https://github.com/event4u-app/agent-config/commit/1f4373195ca2d477d06e1fcaa467df2120d8043b))
* **context:** give the corrected carrier-divergence figure a stable surface ([4812f9d](https://github.com/event4u-app/agent-config/commit/4812f9de9d6bd96b6109776001191a8fbb95feb9))
* **proof:** re-render after the surgical-uninstall claim moved to exec evidence ([5e489ee](https://github.com/event4u-app/agent-config/commit/5e489ee7b58428f79fc211d07fda754c76efda0e))
* **review:** record the R2 completion-review findings before any fix ([2954d66](https://github.com/event4u-app/agent-config/commit/2954d663fa26980113331653c31d3dc3ef88c649))
* **roadmap:** restore install-lifecycle 2.3 to open-and-blocked ([4b61e7f](https://github.com/event4u-app/agent-config/commit/4b61e7f4ba61c560bd3a836368ebb73864e0d285))
* **roadmap:** land the org-pack reopening brief, close install-lifecycle Phase 2 ([b172d28](https://github.com/event4u-app/agent-config/commit/b172d28ed0a8f2f112a3b0fb43c4e5fe9c54edd6))
* **roadmap:** close install-lifecycle Phase 1, cancel 1.2 on a failed premise ([920910b](https://github.com/event4u-app/agent-config/commit/920910bc2d6acf978ebe70f5fdb844420b2002c4))
* **install-layout:** correct the untracked-surfaces list and the vscode pointer shape ([26982c6](https://github.com/event4u-app/agent-config/commit/26982c62eafd452f4c2cf6cd929a7a74dd68dbc6))
* **roadmap:** record the unapplied Phase 1 implementation and its two open calls ([25fc56d](https://github.com/event4u-app/agent-config/commit/25fc56da7356e446f13bbb1da866a4ddc70091d1))
* **roadmap:** carry the re-homing the merge commit described but did not contain ([a7a469f](https://github.com/event4u-app/agent-config/commit/a7a469f87592580fab38a1180e17d2320e861337))
* **roadmap:** council dispositions and four cited corrections ([10c25c4](https://github.com/event4u-app/agent-config/commit/10c25c4753212c2c4b93e972707b3090e06cb431))
* **review:** re-bind round 2 — six fixed, one accepted as debt ([7b451cb](https://github.com/event4u-app/agent-config/commit/7b451cb75f65b787f4c5ebf3903b49e90382c98a))
* **review:** record round 2 — the fixes introduced two of their own ([4a0504c](https://github.com/event4u-app/agent-config/commit/4a0504cfcf302b00a3f9773ba89eb284f2b7f573))
* **review:** re-bind the findings to what the fixes actually did ([baba417](https://github.com/event4u-app/agent-config/commit/baba417297bbb6db0d0d250785e3c049f7e33fd7))
* **review:** record the completion review before any fix lands ([7dc1f1f](https://github.com/event4u-app/agent-config/commit/7dc1f1f4ea511bcd30a67ac416937511c6420721))
* **roadmap:** split the 2026-08-10 harvest into eight executable roadmaps ([72a1078](https://github.com/event4u-app/agent-config/commit/72a10788336fc54cff25833ae1568328765f4011))
* **roadmap:** close Phase 1 and steps 3.2 / 3.5 / 3.8, and re-frame 3.6 ([dc12894](https://github.com/event4u-app/agent-config/commit/dc128947b844d0afb147b9e413c12c1dadbc7346))
* **roadmap:** close Phase 1 — the quorum-attendance defect ([12e0bc1](https://github.com/event4u-app/agent-config/commit/12e0bc14f7813691c8708d25b6eb23c8bcf4f116))
* **review:** declare the no-code-surface skip for this completion ([3771eaf](https://github.com/event4u-app/agent-config/commit/3771eafda510306cf238539f3c910481f7e36b1a))
* **ledger:** record that the three dangling pointers were repaired ([03cf5f8](https://github.com/event4u-app/agent-config/commit/03cf5f8699dce20224479a58a6ece39509deb6a0))
* **roadmap:** triage the 2026-08-10 inbox batch ([9e999d6](https://github.com/event4u-app/agent-config/commit/9e999d64eb3b34612bcbe7d8d4e91bad56c7cc54))
* **roadmap:** correct two roadmap claims the tree contradicts ([e1f271e](https://github.com/event4u-app/agent-config/commit/e1f271e6bbe50f9ebaf9814ce47b83bc4111d871))
* **roadmap:** add the risk register the telemetry record made due ([82268d7](https://github.com/event4u-app/agent-config/commit/82268d7e4e417e688bfb453d9c75f0ded1b0991e))
* **roadmap:** record the measured telemetry state on both orchestration blockers ([10a2790](https://github.com/event4u-app/agent-config/commit/10a2790e19b245280dd5764cdbfcb873ff586be7))
* **roadmap:** close and archive the cost-parity program — 23 steps, 6 criteria, every claim re-verified ([af57abf](https://github.com/event4u-app/agent-config/commit/af57abf96ae30234de73446f965d93eba45423f7))
* **decision:** give the router-is-unused finding an owner before someone acts on it ([bf70104](https://github.com/event4u-app/agent-config/commit/bf701040cf44e873b4fb1eb115a599ed39f7190f))
* **cost-parity:** one ledger for the family's order, and the per-host table the diet actually needs ([fa188ee](https://github.com/event4u-app/agent-config/commit/fa188ee44ecddf4898abf8feea3c4a12155b1f29))

### Tests

* **subagent:** assert the tool-grant behaviour, not which keyword rejected it ([59ee093](https://github.com/event4u-app/agent-config/commit/59ee0938eac9289a7f711600eb3bf45500ded1d4))
* **workspace-inbox:** re-record the inline snapshot that embeds the docker skill ([f395d79](https://github.com/event4u-app/agent-config/commit/f395d79dec3d7e5e39cded83871d384f1008594e))
* **pricing:** cross-check the two cache-rate tables that nothing compared ([e623e0c](https://github.com/event4u-app/agent-config/commit/e623e0c8fe285dd5ff8e824ac58b7a7cf2d222b0))

### Build

* **install:** refresh dist/install/install.mjs for the vscode bridge and trampoline warning ([440b046](https://github.com/event4u-app/agent-config/commit/440b046fb75448bfbe6cf854f0084ae19fd9c8f4))

Tests: 12935 (+117 since 9.32.0)

## [9.32.0](https://github.com/event4u-app/agent-config/compare/9.31.0...9.32.0) (2026-08-10)

### Release highlights

<!-- Curated head: fill before merge, keep it under 10 lines, and leave `_none_` where it is genuinely the answer. The generated log below is unchanged. -->
- **Behaviour changes:** the work-engine's two red-check lanes now run a bounded self-fix loop before halting to `BLOCKED` — at most three attempts per validation target, stopped early when a verdict signature repeats (1f01490, wired in 10c8f7e). e05de77 edits a rule file only and changes no behaviour.
- **Default changes + migration:** _none_
- **Security and correctness:** _none_
- **Honest nulls:** _none_
- **Known limitations:** _none_

### Features

* **work-engine:** route both red-check lanes through the self-fix loop ([10c8f7e](https://github.com/event4u-app/agent-config/commit/10c8f7eafbf21fc03a5f301163c941a20df4a885))
* **work-engine:** bounded self-fix loop primitive + executable dod schema ([1f01490](https://github.com/event4u-app/agent-config/commit/1f0149035c1a27729b729dab1dedd861ccdf9812))
* **envelope:** drift anchor, scripted grounding, verbatim error strings ([6c9187e](https://github.com/event4u-app/agent-config/commit/6c9187e30f41c87553764759096a3f7f4d19a126))
* **envelope:** successor tailoring, mandatory failed_approaches, data-never-instruction boundary ([b03beac](https://github.com/event4u-app/agent-config/commit/b03beac1ad1325253c89a63eac9abc9f051269d3))
* **orchestration:** report per-field provenance for host capabilities ([f4958de](https://github.com/event4u-app/agent-config/commit/f4958decf4a70b445a38747bff768ab449877d52))

### Bug Fixes

* **gates:** stop the R2 review-input copy from laundering fixture secrets ([c63d350](https://github.com/event4u-app/agent-config/commit/c63d3502013e7bc261096d02e2c102a52e2f1ec7))
* **golden:** teach the replay the delegated bad-verdict surface, re-lock baselines ([1ff480c](https://github.com/event4u-app/agent-config/commit/1ff480c6adeb88af32198a19d41838e2f9f5dcc0))
* **envelope:** close the eight R2 review findings ([b0d153c](https://github.com/event4u-app/agent-config/commit/b0d153cb3084dac2a20093b73d28a3ce3c12324c))
* **tests:** type the self-fix state helpers against the wire types ([60d2724](https://github.com/event4u-app/agent-config/commit/60d272419b07b5abea1ce6ffa430faf127fcde4a))
* **handoff:** stop offering the caller its own empty session ([b72f772](https://github.com/event4u-app/agent-config/commit/b72f772a03207aa4feeded3acd5b68823e3fd79c))
* **tests:** narrow regex captures in the capability parity block ([6f27615](https://github.com/event4u-app/agent-config/commit/6f276154b83781404d6551113c6d43e5cf040423))
* **carrier:** a paths: disagreement is a delivery defect, not inert metadata ([318fb81](https://github.com/event4u-app/agent-config/commit/318fb818eb543f27fc4c3b138ce762dc8c9e9640))

### Documentation

* **review:** re-bind the findings artefact to the post-fix scope ([7a9bbbb](https://github.com/event4u-app/agent-config/commit/7a9bbbb2d7f4f04786771914bf7b3b68aba23e10))
* **review:** record the R2 completion-review findings before fixing them ([27322e8](https://github.com/event4u-app/agent-config/commit/27322e876c76f96d6a67131f9e96a1759290a8f5))
* **roadmap:** P2.2 build half shipped, its threshold unevaluated with a blocker ([1e478fd](https://github.com/event4u-app/agent-config/commit/1e478fdc317fdf12df001c1b98ef264df54a3742))
* **contracts:** the flow contract documents the self-fix loop and the dod slot ([0ebaaba](https://github.com/event4u-app/agent-config/commit/0ebaabae9e12c75446efefc5be6f6b33b9d0435f))
* **roadmap:** capability-answerability Phase 1 closed, blocker narrowed to one question ([c37af04](https://github.com/event4u-app/agent-config/commit/c37af045ecbf62b31e6878befdc88d763498d7a9))
* **rules:** delegation-policy names the capability provenance check ([e05de77](https://github.com/event4u-app/agent-config/commit/e05de771d74e8284e2e64e91e33be66b1bd15e23))
* **contracts:** the host-capability contract documents six fields, not five ([566b984](https://github.com/event4u-app/agent-config/commit/566b984681d1a1a5ef76643fa6f90f297c284e81))

### Tests

* **work-engine:** pin the loop contract and update the changed halt shapes ([eb88aa6](https://github.com/event4u-app/agent-config/commit/eb88aa695121a01c0c1e10de9804f1df3424c334))

### Other

* **carrier:** re-bind to the post-merge scope — the fixed point ([884104c](https://github.com/event4u-app/agent-config/commit/884104c15d8257579a320932c671b489d96e7b06))
* **carrier:** re-bind the R2 round to the shipping content, all 6 terminal ([9bbfbc3](https://github.com/event4u-app/agent-config/commit/9bbfbc35388f54c77fdae27315025843a6ea79f5))
* **carrier:** R2 completion review round 1 — 6 findings, all open ([75be940](https://github.com/event4u-app/agent-config/commit/75be940f4f9bcbf71e1f1248467637fc51c6b63b))

Tests: 12818 (+89 since 9.31.0)

## [9.31.0](https://github.com/event4u-app/agent-config/compare/9.30.0...9.31.0) (2026-08-10)

### Release highlights

<!-- Curated head: fill before merge, keep it under 10 lines, and leave `_none_` where it is genuinely the answer. The generated log below is unchanged. -->
- **Behaviour changes:** _none_
- **Default changes + migration:** _none_
- **Security and correctness:** _none_
- **Honest nulls:** _none_
- **Known limitations:** _none_

### Features

* **settings:** give the scripts read path the template-defaults layer ([a67a640](https://github.com/event4u-app/agent-config/commit/a67a640cbf64262d07026853b7b5ead21b509e5d))

### Bug Fixes

* **carrier:** a frontmatter-only difference is not body divergence ([c48b6c8](https://github.com/event4u-app/agent-config/commit/c48b6c88cf274e3e24b0795d8fb4d19be7637557))
* **hooks:** replace the fence regex with a scanner, and stop shipping a moving figure ([2fe01e7](https://github.com/event4u-app/agent-config/commit/2fe01e79804c37380e8c968b6efdf71b7d9d33fa))
* **hooks:** per-session pin marker, atomic write, enforced read cap ([67abbb6](https://github.com/event4u-app/agent-config/commit/67abbb63028ab79fa6d04083523fbb6ffb9033c3))
* **scripts:** measure the gate per TURN, and withdraw the figures that were not ([313e665](https://github.com/event4u-app/agent-config/commit/313e665354c1dd0512aceb21475dbc532f6b9ba5))
* **hooks:** turn-end-gate — key the guard on the turn, not the prompt text ([b3392e6](https://github.com/event4u-app/agent-config/commit/b3392e60ceeae500b639040e8849b801fc661008))

### Documentation

* **carrier:** the header says three classes and there are now four ([1955234](https://github.com/event4u-app/agent-config/commit/195523465db8fabb84be3f4ad27f8293cf5e4ac5))
* **evidence:** classify the 109 carrier divergences, and correct two records ([c2fc109](https://github.com/event4u-app/agent-config/commit/c2fc109f7ca30f621455a9a754803055a0b1a0d9))
* **evidence:** map the scripts settings read path against the server one ([858a256](https://github.com/event4u-app/agent-config/commit/858a25646352fd3603800e5657527591a00e16ae))
* **review:** record the R2 findings on the fix pass, before touching it ([65aee68](https://github.com/event4u-app/agent-config/commit/65aee68691d85bdba928b4de65f4e28025c80852))
* **review:** record the R2 findings for turn-end-gate before fixing anything ([9f204c5](https://github.com/event4u-app/agent-config/commit/9f204c55a73a45bada0baa7925bc000df7bee912))

### Build

* **install:** rebuild the bundle without the worktree symlink poison ([741806c](https://github.com/event4u-app/agent-config/commit/741806c91a9774b1b521ae34487d271d0c5dee93))
* **install:** refresh the committed install bundle ([7bbcfdc](https://github.com/event4u-app/agent-config/commit/7bbcfdce9355708ef6785ec640af64d23a5ac4a0))

### Chores

* **roadmap:** close carrier-layer-convergence Phases 1-2 on the measurement ([bc42809](https://github.com/event4u-app/agent-config/commit/bc42809689634578e52501470f299822624e15ae))
* **roadmap:** archive road-to-scripts-settings-defaults, complete ([e3af4c5](https://github.com/event4u-app/agent-config/commit/e3af4c56c1149a96254f1e7e3c1807a8f53744b5))
* **budget:** re-baseline the packed-tarball cap, 6.9 to 7.8, maintainer-decided ([04ca7d8](https://github.com/event4u-app/agent-config/commit/04ca7d84f93c33999b02361c9baa4e61a181a07c))

Tests: 12729 (+38 since 9.30.0)

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
