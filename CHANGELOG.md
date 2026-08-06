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

# Era: 9.23.x — current

> Started at `9.23.0`. Full entries live inline below.
> The drift test caps this era at 250 lines of entry body; growth past
> that forces a new era split (`# Era: 9.24.x`, etc.) — see
> [`docs/contracts/CHANGELOG-conventions.md § Era splits`](docs/contracts/CHANGELOG-conventions.md).

## [9.24.0](https://github.com/event4u-app/agent-config/compare/9.23.0...9.24.0) (2026-08-06)

### Release highlights

<!-- Curated head: fill before merge, keep it under 10 lines, and leave `_none_` where it is genuinely the answer. The generated log below is unchanged. -->
- **Behaviour changes:** _auto-derived, rewrite before merge:_ rule/schema diffs, breaking commits or removed public surface in cb126e8, f908f19.
- **Default changes + migration:** _none_
- **Security and correctness:** _none_
- **Honest nulls:** _auto-derived, rewrite before merge:_ commits carrying an honest-null marker in 7a1ca1b.
- **Known limitations:** _none_

### Features

* **commands:** add /analyze:inbox — verify a dropped artifact before planning on it ([fa7b278](https://github.com/event4u-app/agent-config/commit/fa7b278507d61606232ba47da0393915a178ea1f))
* **scripts:** make the absoluta census reproducible, and correct its own number ([de96a36](https://github.com/event4u-app/agent-config/commit/de96a36d89e7b08c49744d01361ce05a269d4225))

### Bug Fixes

* **index:** regenerate the artefact index and catalog after the description edit ([c1f306b](https://github.com/event4u-app/agent-config/commit/c1f306b01cdbaabe9a349a3fbdcea127254bd0ae))
* **preflight:** run the skill linter CI runs, so its failures never reach CI ([755e050](https://github.com/event4u-app/agent-config/commit/755e0508ad21dafad3c61b5ce507a572c2f5088e))
* **command:** bring the analyze-inbox description under the 200-char cap ([f72573b](https://github.com/event4u-app/agent-config/commit/f72573b7f8ce2fa83eea2671bc6142253f020182))
* **docs:** repair the broken install-profile example; keep dead ends in handoffs ([7a1ca1b](https://github.com/event4u-app/agent-config/commit/7a1ca1b5f4c88e1288235b272416fe55d521d8ac))
* **adr:** give ADR-218 the required frontmatter and a review_trigger ([854d3ef](https://github.com/event4u-app/agent-config/commit/854d3efdd83ab678189c7d6ccf3fd7850efdcaad))

### Documentation

* **create-pr:** resolve the duplicate 4d heading and its ambiguous refs ([315d6fe](https://github.com/event4u-app/agent-config/commit/315d6fe64eea7e39cd2b14a9ac57a2d2ac585654))
* **roadmap:** harvest 16 inbox artifacts — mostly into cancellations ([de84205](https://github.com/event4u-app/agent-config/commit/de842055f439b9f3ea0d2d979059e1d6a8dae18c))
* **rules:** act on council round 3 — falsifiable trigger, honest bound, ADR-218 ([cb126e8](https://github.com/event4u-app/agent-config/commit/cb126e88c3dd4d58bed92fe168bd090ee83d6a99))
* **rules:** mark the declared-protocol cap provisional, propagate the census correction ([f908f19](https://github.com/event4u-app/agent-config/commit/f908f19c3463a0d19607637cfffa4393899177f8))

Tests: 11309 (+10 since 9.23.0)

## [9.23.0](https://github.com/event4u-app/agent-config/compare/9.22.0...9.23.0) (2026-08-06)

### Release highlights

<!-- Curated head: fill before merge, keep it under 10 lines, and leave `_none_` where it is genuinely the answer. The generated log below is unchanged. -->
- **Behaviour changes:** _auto-derived, rewrite before merge:_ rule/schema diffs, breaking commits or removed public surface in 3d1ed67, e5e4c48, a7ecd7b, ff146a0, 927ff8a, 420e833 +1 more.
- **Default changes + migration:** _auto-derived, rewrite before merge:_ commits naming a default, migration or migrate in 9da7146, c1d9093.
- **Security and correctness:** _none_
- **Honest nulls:** _auto-derived, rewrite before merge:_ commits carrying an honest-null marker in c4a4920, 9242d41, 927ff8a.
- **Known limitations:** _none_

### Features

* **review:** severity is carried, confidence is its own field, density stays advisory ([9242d41](https://github.com/event4u-app/agent-config/commit/9242d416e77518f6d1b593184ae0123f3b0ecb34))
* **rules:** land the conflict audit, close its findings, archive the roadmap ([a7ecd7b](https://github.com/event4u-app/agent-config/commit/a7ecd7b73b99166baaee3838c4e8a5f7668bf580))
* **authoring:** require the primary bias, and lead rich artifacts with their obligation ([ff146a0](https://github.com/event4u-app/agent-config/commit/ff146a0f11f89c4f093d80aaf705915eb918c7bb))
* **rules:** a removal disposition, and the classification that stops "another rule" ([484596e](https://github.com/event4u-app/agent-config/commit/484596e1dc41e003c70678ec301ef4f801939736))
* **rules:** mandated lines at the decision point, and the two rules they need ([927ff8a](https://github.com/event4u-app/agent-config/commit/927ff8a83eb17a8d41f234dbfabe3d9caedcf066))
* **budget:** measure the rich-class band, lower it to what the corpus uses, gate it ([420e833](https://github.com/event4u-app/agent-config/commit/420e83368298029b4e01a412897ec1f0cec4286e))
* **settings:** add settings:set and fence the GUI write route ([3ffb705](https://github.com/event4u-app/agent-config/commit/3ffb7057d3ab4e963f3b09d49fbb8de57c6956ae))
* **settings:** fence every settings key behind an A/B/C class ([b09e84e](https://github.com/event4u-app/agent-config/commit/b09e84e9ce540ac6e4215538bef731c87ad7c91b))
* **gates:** self-test mode, estate-level result handling, and one equality-without-validity fix ([f7a022a](https://github.com/event4u-app/agent-config/commit/f7a022a7d039e03c5240eca94f7f9306ef5ed456))
* **gates:** make shrink-only mechanical against the base ref ([3e7eb9d](https://github.com/event4u-app/agent-config/commit/3e7eb9d9d35fe79d0655c51ef86ffabbe1f0a1b8))
* **gates:** ratchet ledger adoption, and stop rendering unmeasured categories ([678ba92](https://github.com/event4u-app/agent-config/commit/678ba92b862d6041c1e2af8d91a85252d53d687b))
* **gates:** adopt the ledger in three gates whose scan roots have failed before ([c04b9a5](https://github.com/event4u-app/agent-config/commit/c04b9a5785d4d5a02da317b44cdebc02bc83e3b4))
* **gates:** add a per-target completeness ledger ([fea6d7b](https://github.com/event4u-app/agent-config/commit/fea6d7b5181ba7815931cf83833946f1c405979f))
* **gate:** enforce the roadmap concurrency cap mechanically ([8add433](https://github.com/event4u-app/agent-config/commit/8add433b93d68191ffd44dab5c8f4f68102f1c17))

### Bug Fixes

* **authoring:** revert the two kernel-rule routing edges, state the gap instead ([3d1ed67](https://github.com/event4u-app/agent-config/commit/3d1ed67c3fd6ac8277f32d4c4d6bac1b274427e8))
* **authoring:** close all fourteen R2 findings ([e5e4c48](https://github.com/event4u-app/agent-config/commit/e5e4c48d6b993854fc41b681ea4c585e6b265f40))
* **review:** six real pre-filter instances — the keyword grep had missed all of them ([c4a4920](https://github.com/event4u-app/agent-config/commit/c4a49204dfefae74e518f284ee11f04fff511e63))
* **rules:** declare the 3 authority collisions, decline the gate ([943ad06](https://github.com/event4u-app/agent-config/commit/943ad067d68b3dfa31d15865d2c936cad2281767))
* **rules:** declare the two kernel-vs-kernel conflicts and fix the halt list ([c4ab544](https://github.com/event4u-app/agent-config/commit/c4ab5449b0c50c691e47793d247b980feec1b21b))
* **rules:** make ui-audit-gate satisfiable, invert the read cap, exempt file sets ([b47752d](https://github.com/event4u-app/agent-config/commit/b47752de370607ed1d691fdbc22ff10af3dd806d))
* **projection:** stop injecting ADR-004 manual rules into per-tool trees ([5d40a6c](https://github.com/event4u-app/agent-config/commit/5d40a6c184883844dff2a23154959accfef1022e))
* **cli:** route and document settings:set in the dispatcher ([0d2c6c5](https://github.com/event4u-app/agent-config/commit/0d2c6c58cbc9769e34e2c0c5d289c6de7c690501))
* **pack:** ship yamlIO with the writer, re-baseline the packed-size budget ([87b6fc1](https://github.com/event4u-app/agent-config/commit/87b6fc1328d90d140ffbbf31afc9ebb5452e00e2))
* **settings:** close all ten R2 findings ([84e4596](https://github.com/event4u-app/agent-config/commit/84e4596c7d42afbe3d26ee2e2b2e36836b754c97))
* **settings:** satisfy exactOptionalPropertyTypes in the settings:set argv parser ([a03d21b](https://github.com/event4u-app/agent-config/commit/a03d21b5960c0e13b910c01d86cb5c4f99a4ad77))
* **hooks:** forward the concern's own reason on a block; fix stale exit assertion ([b64cd4b](https://github.com/event4u-app/agent-config/commit/b64cd4bf2a4569c3fd3ea5fae85d9095bbf0d33f))
* **hooks:** translate verdicts to per-host native semantics ([f39698c](https://github.com/event4u-app/agent-config/commit/f39698cd8e626756c8add6a045e4e66b9b00751d))

### Documentation

* **roadmap:** record what landed and what the remaining phases actually cost ([15df545](https://github.com/event4u-app/agent-config/commit/15df545937dcf88e910240b7af45b2dfc6d464e9))
* **roadmap:** close both blockers and Phase 1, record the migration inventory ([9da7146](https://github.com/event4u-app/agent-config/commit/9da7146dbaea153bb4e2eae31069066663378dcb))
* **roadmap:** close P0.3-P1.6, record the two round-2 reversals ([cc67d73](https://github.com/event4u-app/agent-config/commit/cc67d73b287f0ce91f4c0690df824b670c4c604e))
* **roadmap:** file the absent-is-not-default blocker, close Phase 2 ([c1d9093](https://github.com/event4u-app/agent-config/commit/c1d90934b05168cba6ac3667d92d7a20602735b2))
* **roadmap:** record what the prerequisite re-read caught, close Phase 1 ([ba9b0f0](https://github.com/event4u-app/agent-config/commit/ba9b0f0f0e148857a8574faa2e512b64c099d2e4))
* **roadmap:** record the remote-CI verdict on the gate-integrity roadmap ([4e52e53](https://github.com/event4u-app/agent-config/commit/4e52e530e1c5adeab421af6f351d4d0f86bbcc55))
* regenerate the artefact index and catalog for the two new guidelines ([619d283](https://github.com/event4u-app/agent-config/commit/619d28377bc6180948336e98ad4eec58efd41659))
* bump the guideline count for the two new gate guidelines ([e5b3331](https://github.com/event4u-app/agent-config/commit/e5b333174587acf3218811e7f049b401a2436e1d))
* **roadmap:** close 33 of 35 gate-integrity steps, file the kernel blocker ([818b637](https://github.com/event4u-app/agent-config/commit/818b6379ab91a4f739cb1fe7a11d499582f3039b))
* **gates:** the authoring path, the false-green catalogue, and the CI delta ([554b9a9](https://github.com/event4u-app/agent-config/commit/554b9a992fb77e532344aadd298234cd63804278))
* **roadmap:** add Risk Register to road-to-rule-coherence ([4641101](https://github.com/event4u-app/agent-config/commit/4641101a9f234fd32beacecce01426b4f77a8d73))
* **roadmap:** add road-to-rule-coherence with measured scope cuts ([55a3957](https://github.com/event4u-app/agent-config/commit/55a395783dbbcfdba6346be9312fd04dec285f5c))
* **roadmap:** unblock everything the adoption gate was holding ([8878a88](https://github.com/event4u-app/agent-config/commit/8878a88b02422d5b93d820968a53c161a795ca64))
* **adr:** strike external adoption as a gate, re-anchor restraint to capacity ([e98221e](https://github.com/event4u-app/agent-config/commit/e98221e7de7b7bddf0655823ebcc5994bb9c4da6))
* **roadmap:** open two verification roadmaps, park the rest by arm ([d415dad](https://github.com/event4u-app/agent-config/commit/d415dada95c2ad7a89327831462870cc1fed8fd8))
* **adr:** lift the harvest freeze for verification infrastructure only ([11df060](https://github.com/event4u-app/agent-config/commit/11df0606810508f4fcfec404dc67cd975a92ef91))
* **sweep:** record the 40-source skill-ecosystem deep-dive ([45c55a2](https://github.com/event4u-app/agent-config/commit/45c55a222b61430ed39a572a4ff083cd383b81c7))

### CI

* register the three new gates, and close the CI-local parity delta ([2c709c3](https://github.com/event4u-app/agent-config/commit/2c709c3f1069a29c7a5f8a1cd1829b1377a40c34))

### Chores

* **sync:** regenerate the projection and tool trees ([f0ebea5](https://github.com/event4u-app/agent-config/commit/f0ebea51b823bd50e979ccf6ba66660bec3eef83))
* **roadmap:** regenerate dashboard after merging main ([4e3810a](https://github.com/event4u-app/agent-config/commit/4e3810a4ce364df32f22eead045a4526cf98be40))

### Other

* **authoring:** mark all fourteen findings fixed, drop the regenerable input ([f3d6e2a](https://github.com/event4u-app/agent-config/commit/f3d6e2a03eeca77adaac9b62f12d277d7d47b3a0))
* **authoring:** R2 completion review — 14 findings, all open ([703b8eb](https://github.com/event4u-app/agent-config/commit/703b8ebc5a5c55facfdc6cf468642eb0f03b2a71))
* **settings:** mark all ten findings fixed, drop the regenerable input ([0a96cca](https://github.com/event4u-app/agent-config/commit/0a96cca52a0116a4330ad51dbfe96b6269721d1b))
* **settings:** R2 completion review — 10 findings, all open ([36139ac](https://github.com/event4u-app/agent-config/commit/36139ac2f4d83b296222fd8f89db4c75d73c4f20))

Tests: 11299 (+208 since 9.22.0)

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
