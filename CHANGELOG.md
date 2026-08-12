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

## [9.36.0](https://github.com/event4u-app/agent-config/compare/9.35.0...9.36.0) (2026-08-12)

### Release highlights

<!-- Curated head: fill before merge, keep it under 10 lines, and leave `_none_` where it is genuinely the answer. The generated log below is unchanged. -->
- **Behaviour changes:** _auto-derived, rewrite before merge:_ rule/schema diffs, breaking commits or removed public surface in 9f69017, 924cad8, 3c20d47, 72bb1bc.
- **Default changes + migration:** _none_
- **Security and correctness:** _none_
- **Honest nulls:** _none_
- **Known limitations:** _none_

### Features

* **consultation-rate:** compute the half of the metric that is computable ([36064ef](https://github.com/event4u-app/agent-config/commit/36064efa1a85c9ea1c6c2beb427fe684177ca2a8))
* **analyze:** anchor-first direction, claim gate, interop probe and bounded --deep ([5bee62a](https://github.com/event4u-app/agent-config/commit/5bee62a5828ba6d3cf38a7d5d685004716d8addf))
* **lint-roadmap:** warn when a gate rests on a population the project cannot produce ([e5c0b56](https://github.com/event4u-app/agent-config/commit/e5c0b569417d80ee937fd7ec955680c724abe3e1))
* **demand-gate:** the L0-L4 ladder measures market demand, and now says so ([9f69017](https://github.com/event4u-app/agent-config/commit/9f69017632aead1f2a0e20eb8518ae4d8508ea1a))
* **fe-design:** outside the ticket engine, this skill is the executor ([2946655](https://github.com/event4u-app/agent-config/commit/294665543cfb1a3c896e25024fd08551af629bb2))
* **ui-route-nudge:** the first runtime consumer the UI rule triggers ever had ([6bf216e](https://github.com/event4u-app/agent-config/commit/6bf216e649febf3d95162e7f9b222f43ae2bd407))
* **pack-reach:** report where a rule and the skills it routes to cannot meet ([4bc28e6](https://github.com/event4u-app/agent-config/commit/4bc28e660f9eaef87b1e8f5ed4bbbd1914a7d3e4))
* **catalogue:** measure the skill-catalogue delivery defect, and publish the null ([b2adebe](https://github.com/event4u-app/agent-config/commit/b2adebe17320109a98a41eb4b0fc69233b567e47))
* **ui-surface:** one definition of a UI surface, and it covers Blade ([e9ba053](https://github.com/event4u-app/agent-config/commit/e9ba0533110da9aa9bbd276ab3ced2004c2d5d50))

### Bug Fixes

* **proof:** regenerate docs/proof.md after the new pre-registered claim ([6a8bc44](https://github.com/event4u-app/agent-config/commit/6a8bc446abcc06cee3cc55ffd75f7668037542ea))
* **baseline:** repair the measurement table split by the unit note ([afa1ea0](https://github.com/event4u-app/agent-config/commit/afa1ea0f1369293a8e392e132343dc05c126ccda))
* **consultation-rate:** close the R2 findings, unit first ([c53b3da](https://github.com/event4u-app/agent-config/commit/c53b3da53111a089d07c59186d1aa1124adc2d31))
* **agents-md:** keep the corrected pointer inside the Thin-Root char cap ([858963f](https://github.com/event4u-app/agent-config/commit/858963f956d516d5200d9e27c9014aee41938973))
* **agents-md:** the consumer template contradicted itself on always-active rules ([639ce5e](https://github.com/event4u-app/agent-config/commit/639ce5e26d8e4d3ca70d8e4f1f6953548f72322f))
* **dist:** rebuild the install bundle without build-machine paths ([55f4e64](https://github.com/event4u-app/agent-config/commit/55f4e6449ad0eb9d8c79bdeffea6c174ddda66f2))
* **cli-delegate:** close the six R2 findings, two of them on this fix ([6c26dd4](https://github.com/event4u-app/agent-config/commit/6c26dd45187b374a473df5bba241b0bd502accd2))
* **cli-delegate:** four shipped commands were silent no-ops in their own bundle ([1ea3f67](https://github.com/event4u-app/agent-config/commit/1ea3f67012929f7c00604bc9cda6a85b1d783e32))
* **ci:** three downstream surfaces the new triggers, key and gate opened ([924cad8](https://github.com/event4u-app/agent-config/commit/924cad87f91eb57acf4e8619015f3089e07a956c))
* **capture,lint,docs:** close the remaining R2 findings ([396d58f](https://github.com/event4u-app/agent-config/commit/396d58fbff2704cddce10577e2cbd82db9c5003c))
* **ui-surface,nudge,settings:** three predicates that were wider than their claims ([36e1632](https://github.com/event4u-app/agent-config/commit/36e1632287a85c0934bec8a43752b8761dfa19d6))
* **ui-rules:** the nudge does not read the rules, and six surfaces said it did ([3c20d47](https://github.com/event4u-app/agent-config/commit/3c20d47dee794e1c9ddbf6a895527953788c31ff))
* **ui-rules:** reach the consumers the design skills were written for ([72bb1bc](https://github.com/event4u-app/agent-config/commit/72bb1bc3943c8fb721db9d44b5daa5334bcb956f))

### Documentation

* **review:** re-bind the R2 artefact to the fixed scope ([0cc9057](https://github.com/event4u-app/agent-config/commit/0cc9057d97b78cf82fd957afd96ec9205bfc7fc0))
* **review:** record the R2 findings before fixing any of them ([b42227a](https://github.com/event4u-app/agent-config/commit/b42227a6e32b041c6b9b82f373bb23c2d15cc03a))
* **baseline,roadmap:** the first measurement, and what its denominator says ([347cb47](https://github.com/event4u-app/agent-config/commit/347cb4702b55f22723ecf4d7fb00fe202fb4d72c))
* **roadmaps:** archive the completed cross-repo differential loop roadmap ([f90b42b](https://github.com/event4u-app/agent-config/commit/f90b42b918813c0f354037abd5965bd45afb7a5d))
* **claims:** pre-register the reference-loop upgrade value claim ([67c1ba4](https://github.com/event4u-app/agent-config/commit/67c1ba400531ca0eead1c282a6dd802c55080eb5))
* **roadmap:** archive the cross-corpus verification roadmap, complete ([483acc6](https://github.com/event4u-app/agent-config/commit/483acc654e8d8a2a3b9cecbc96be6e79e8da12a0))
* **adr:** record what the cross-corpus proposal measurements survived ([87e81d8](https://github.com/event4u-app/agent-config/commit/87e81d8faadc35f070163d3ec3288b78cad19d1d))
* **roadmap:** the demand-gate audience roadmap and its follow-up ([079f22c](https://github.com/event4u-app/agent-config/commit/079f22cbd16df95ceebcccdb9a4ae3bcc73390ef))
* **review:** re-bind after the CI fixes, and name what is unreviewed ([f9e66de](https://github.com/event4u-app/agent-config/commit/f9e66de977d9a33766edcfd84936ef12ba09358d))
* **review:** state precisely what moved between the two re-binds ([8b2bdd4](https://github.com/event4u-app/agent-config/commit/8b2bdd4267307cbbaec410d6305b9d91f98cc7c1))
* **review:** re-bind the R2 artefact after the generated-file regen ([03e1029](https://github.com/event4u-app/agent-config/commit/03e102989d92f2cc913dc839b05986cf7d4db1f3))
* **roadmap:** the frontend-skill-application plan and its first run ([c1bd64f](https://github.com/event4u-app/agent-config/commit/c1bd64fe559a60a6b6f6248ffc3ff0127df5fe46))
* **dispatch:** a UI-shaped slice carries its design context across the boundary ([aae1e52](https://github.com/event4u-app/agent-config/commit/aae1e5242d3f5ed4a99c9a33d4551ca9183b8f77))

### Refactoring

* **skills:** one spelling for the disclosure directory, and an authoring section that names it ([3cd3103](https://github.com/event4u-app/agent-config/commit/3cd3103962d8d632c9fe18691016b6044ffc084b))

### Tests

* **demand-gate:** pin both halves, and name what these tests are not ([0a1da08](https://github.com/event4u-app/agent-config/commit/0a1da086689b0c3b5d4df3097df4e731b6506481))
* **cli-delegate:** execute every delegate bundle, because reading cannot see this ([5d8a741](https://github.com/event4u-app/agent-config/commit/5d8a7410da9caba0e77714dc9e5e92c370a1614e))

### Chores

* **roadmap:** archive the completed roadmap in the PR that completes it ([1d05116](https://github.com/event4u-app/agent-config/commit/1d05116c62f316b64fb1d6a8e86381d03f3f22fe))
* **review:** re-bind the artefact after the bundle rebuild ([b0bf837](https://github.com/event4u-app/agent-config/commit/b0bf837046718823c52f4db9216d27192f8a131b))
* **dist:** rebuild the committed install bundle after the guard change ([0d7b0ae](https://github.com/event4u-app/agent-config/commit/0d7b0ae2709d7a6fcf0eb5ecd9e1e0241a28c06d))
* **review:** re-bind the artefact after merging main ([ab4272b](https://github.com/event4u-app/agent-config/commit/ab4272b98a53628fa00544b134a49b7e97545ad4))
* **review:** re-bind the artefact and mark all six findings fixed ([c1eb64a](https://github.com/event4u-app/agent-config/commit/c1eb64ab051a663a45a1a76696a282a7e7dfb6c0))
* **review:** record six R2 findings before fixing them ([872fc7b](https://github.com/event4u-app/agent-config/commit/872fc7b0a7e735e7ebd13d357b7270b8a1140046))
* **index:** regenerate the artefact index and public catalog ([cfc75b6](https://github.com/event4u-app/agent-config/commit/cfc75b6b26bbf6bd09c0536ca0f553a52fbd09a9))
* **dist:** regenerate the router after merging main ([4bab07c](https://github.com/event4u-app/agent-config/commit/4bab07c67ec7d5778f957789bc6d427ec6274641))

Tests: 13333 (+120 since 9.35.0)

## [9.35.0](https://github.com/event4u-app/agent-config/compare/9.34.0...9.35.0) (2026-08-12)

### Release highlights

<!-- Curated head: fill before merge, keep it under 10 lines, and leave `_none_` where it is genuinely the answer. The generated log below is unchanged. -->
- **Behaviour changes:** _auto-derived, rewrite before merge:_ rule/schema diffs, breaking commits or removed public surface in af968b5, 6d3c9f7.
- **Default changes + migration:** _none_
- **Security and correctness:** _none_
- **Honest nulls:** _none_
- **Known limitations:** _none_

### Features

* **leakage-allowlist:** validate the exemptions before scanning, retire position keys ([97d2c29](https://github.com/event4u-app/agent-config/commit/97d2c29ba763af06c45c5e4a4aebbed7fb531561))
* **sessions:** refuse a claim a peer holds, and report the branch axis ([39cb3b4](https://github.com/event4u-app/agent-config/commit/39cb3b4f2e6d3c0602e5544b7079f242f5a7cd9f))
* **council:** record the ADR-224 solo floor without enforcing it ([be09d0f](https://github.com/event4u-app/agent-config/commit/be09d0fa8f75e03b3d767f225d67cda53dd36ee8))
* **turn-end-gate:** refuse a turn that edited a file and verified nothing ([647eca9](https://github.com/event4u-app/agent-config/commit/647eca9830a6ea9b6597a3404f37aac2fe41360d))
* **gates:** enumerate staged confirmations behind gates --pending ([9cccf4e](https://github.com/event4u-app/agent-config/commit/9cccf4eb789f68dcc67bbf8534824212ea507845))
* **work-engine:** exactly-once confirmed execution for a staged action ([8588e54](https://github.com/event4u-app/agent-config/commit/8588e54377062126df888b42f02155ad9e28c3b5))
* **schemas:** add requires_confirmation to the skill and command contracts ([af968b5](https://github.com/event4u-app/agent-config/commit/af968b533a72c2358897fabcfe61bfb1baa7dc87))
* **cli:** hooks:status --pending enumerates staged confirmations ([442bde3](https://github.com/event4u-app/agent-config/commit/442bde3bb0b047ca85d8b0e5dcb973af4343209c))
* **work-engine:** exactly-once confirmation store plus a decision-gate seam ([9fe068c](https://github.com/event4u-app/agent-config/commit/9fe068c96a698c1d30ae74d65545b9fa301e72a3))
* **schemas:** declare requires_confirmation on skills and commands ([6d3c9f7](https://github.com/event4u-app/agent-config/commit/6d3c9f73ccc224517a81effb5f9874f388e140ee))

### Bug Fixes

* **tests:** a matched grep must not fail the assertion — echo | grep -q under pipefail ([e7352cc](https://github.com/event4u-app/agent-config/commit/e7352ccedbd9cd996220db0293faf6d42a67529e))
* **leakage-allowlist:** close the seven R2 findings, including two on this PR ([c859249](https://github.com/event4u-app/agent-config/commit/c8592492f32d6c5072eb361fde9081457855d5a7))
* **sessions:** drop the ROADMAP_CLAIM_REL import that lost its last reference ([0d6a1c0](https://github.com/event4u-app/agent-config/commit/0d6a1c0e4670a30f7f00475d7463b986f8fa697b))
* **session-register:** work in the PR review — path containment, token-boundary match, claim lifetime ([8e108ca](https://github.com/event4u-app/agent-config/commit/8e108ca07bae79a6058608a4bfd4b316e8d12e31))
* **testing-anti-patterns:** close the R2 findings on the new anti-pattern ([67b747e](https://github.com/event4u-app/agent-config/commit/67b747e95bfdbf2026f5e8286a960045eb864568))
* **session-register:** all 15 R2 findings, three of them the same shape as the bug ([871c00a](https://github.com/event4u-app/agent-config/commit/871c00a6275ed0ecf6bc3a9ea2783aa134388ec5))
* **session-register:** key the roadmap claim on the session, and reject a stale slug ([64a9ce7](https://github.com/event4u-app/agent-config/commit/64a9ce71ad4a410fdcbed361fb8a2829c4a306ac))
* **session-register:** compare the roadmap, not the branch name ([e338113](https://github.com/event4u-app/agent-config/commit/e338113b0adcb8d5ccb4239478bb9f2033cbc2e4))
* **staged-confirmation:** close the round-2 findings on the hardening itself ([fa47ef6](https://github.com/event4u-app/agent-config/commit/fa47ef6253b4ae1d1612db972ed39c856ee29314))
* **staged-confirmation:** sound the type guard and refuse a traversing token ([75dbdb3](https://github.com/event4u-app/agent-config/commit/75dbdb35fce020568fbeba978f14b521599aee67))
* **test:** stop pipefail reporting a matched grep as a failure ([29916d1](https://github.com/event4u-app/agent-config/commit/29916d1e96e6118d9a15e84cc6eeac6de3516705))
* **council:** record min_present on the quorum line, schema v3 to v4 ([53fe036](https://github.com/event4u-app/agent-config/commit/53fe0362b2d403455b6f7eb4e66952b1dd42e161))
* **cli:** refuse hooks:status --pending --strict instead of exiting 0 ([7e752a9](https://github.com/event4u-app/agent-config/commit/7e752a9d6da83b7c73d97cb2996fbc7d465caf4c))
* **confirmation:** close R2 findings 1-5 and 7 in the store and the seam ([42c6f5b](https://github.com/event4u-app/agent-config/commit/42c6f5b5b4e9f2c5835dbbf14567a6944bab13dc))
* **council:** judge the shadow floor against the configured roster ([9cde092](https://github.com/event4u-app/agent-config/commit/9cde092cf6c745c55d9468ebb4480ffb2a11259a))
* three CI reds — a raw NUL in a source, and a settings key declared once ([b128645](https://github.com/event4u-app/agent-config/commit/b128645e8aa29e1b8ccbab31fd3b5509e73da0da))

### Documentation

* **review:** re-bind the review artefact after the pipefail fix ([d4b23e1](https://github.com/event4u-app/agent-config/commit/d4b23e1c9f2620778564d81c7e0c3180e3b60eb8))
* **review:** re-bind the review artefact after merging main ([3fc625f](https://github.com/event4u-app/agent-config/commit/3fc625f8b5d02320f62af217f7805cf85c95e91d))
* **review:** re-bind the completion-review artefact to the fixed scope ([0fc9e82](https://github.com/event4u-app/agent-config/commit/0fc9e822c2f863216f7e721f471b070d50718157))
* **review:** record the R2 findings before any fix ([9c66161](https://github.com/event4u-app/agent-config/commit/9c66161c76484a856b1293918074bcf387683d9b))
* **testing-anti-patterns:** the negative test that passes for the wrong reason ([8fb3f84](https://github.com/event4u-app/agent-config/commit/8fb3f84a7a9c009a53dd383ac8a86bfe00de4fe6))
* state the collision that cost a PR, and the two axes that catch it ([60c0df8](https://github.com/event4u-app/agent-config/commit/60c0df808af87a748643d1fbfe2310a9a08f2c25))
* **review:** record the R2 completion-review findings before fixing them ([35570a5](https://github.com/event4u-app/agent-config/commit/35570a5df0be0cd402f8cc9ed3e5f5cf817a02d1))
* **roadmap:** close and archive the solo-floor roadmap ([128b2cd](https://github.com/event4u-app/agent-config/commit/128b2cddbadf12825bb220cc2aef261976ccb023))
* **adr:** answer ADR-224 three open questions in an amendment ([ff2362e](https://github.com/event4u-app/agent-config/commit/ff2362e1971dadd3b547fbfeadf2650dbb3a4c3f))

### Refactoring

* **leakage-allowlist:** key 35 exemptions on content, drop 3 that were dead ([de96358](https://github.com/event4u-app/agent-config/commit/de96358ddb309be1d4ffa4035d3b8e55e8e08458))

### Tests

* **session-register:** pin all five failure modes, each with the case that was silent ([7f35c3b](https://github.com/event4u-app/agent-config/commit/7f35c3bce8118d3112217af6d20dabdae487b301))
* **schemas:** validate the command surface instead of reading its shape ([5b75e64](https://github.com/event4u-app/agent-config/commit/5b75e64cc6f988212aabaaa84e82ebb4940681e0))

### Build

* refresh dist/install/install.mjs for the new settings key ([a4a99ed](https://github.com/event4u-app/agent-config/commit/a4a99edd6132f92d6e975ccba3261939964c015b))

### Chores

* **review:** re-bind the artefact and mark all seven findings fixed ([fb6283f](https://github.com/event4u-app/agent-config/commit/fb6283fa2011650986c89eb514e0be80d2ffd9c0))
* **memory:** drop three docblock claims about the removed agent-memory path ([307a355](https://github.com/event4u-app/agent-config/commit/307a3550fce6e81dfeb42b0124e276b762da9d66))
* **review:** record seven R2 findings before fixing them ([c86bf3d](https://github.com/event4u-app/agent-config/commit/c86bf3daa3e3281416c9ce426fe1560084dbb1b7))
* **mcp:** drop the agent-memory declaration ADR-094 left behind ([4283a8e](https://github.com/event4u-app/agent-config/commit/4283a8efad4ee9ed721404d3a68aff0b367ad690))
* **review:** re-bind the artefact and mark all three findings fixed ([d2a0c54](https://github.com/event4u-app/agent-config/commit/d2a0c544c80a5e20f0cd7b7d338cbf17684b7c87))
* **review:** record the R2 findings on the anti-pattern addition ([b382dd1](https://github.com/event4u-app/agent-config/commit/b382dd1bfe1b4c3a1301358eb667692e5bc606d0))
* **lint:** re-anchor the leakage allowlist after the inserted paragraph ([8bef27e](https://github.com/event4u-app/agent-config/commit/8bef27e8adae4e742350970323232981d8b499d0))
* **dist:** project the testing-anti-patterns addition ([c6fcd4a](https://github.com/event4u-app/agent-config/commit/c6fcd4ae50fbd6caaa7cc3d7b3fcf8751283815f))
* **review:** re-bind round 2 and mark its three findings fixed ([40e110c](https://github.com/event4u-app/agent-config/commit/40e110c7203b121b0e15f6ad5de0217efb1d90c8))
* **review:** record the R2 round-2 findings before fixing them ([0e477f3](https://github.com/event4u-app/agent-config/commit/0e477f357071e4bc2dc69786ce4e24c1ebf50e75))
* **review:** re-bind the R2 artefact after merging main ([756b226](https://github.com/event4u-app/agent-config/commit/756b226de64ec1a581338b07954a2e4e948b758f))
* **roadmap:** regenerate the dashboard after the main merge ([ba9a0ad](https://github.com/event4u-app/agent-config/commit/ba9a0ade70f40447b6eb3a43736b32376bad56e1))
* **review:** re-bind the R2 artefact and mark all eight findings fixed ([081ffff](https://github.com/event4u-app/agent-config/commit/081ffffbee9d0c9d28e380e148ce29f27aa5d793))
* **review:** record the R2 completion review for dispatch-safety Phase 2 ([661947d](https://github.com/event4u-app/agent-config/commit/661947def61068d05c832146723366fd5abda225))
* **config:** register shadow_floor_fire_rate as the fifth attendance metric ([70abe5c](https://github.com/event4u-app/agent-config/commit/70abe5c0118085fadd01a2eec14433814bf405c5))
* **roadmap:** close dispatch-safety 2.1-2.3 and 4.3, regenerate the dashboard ([bb8dd69](https://github.com/event4u-app/agent-config/commit/bb8dd69b31893ea235e3159ef48b5180e3385b6d))
* **dist:** project the confirmation module and the gate seam ([d6905af](https://github.com/event4u-app/agent-config/commit/d6905af2385948a7bb44dbdb3a9025834b91afb2))
* **roadmap:** close dispatch-safety Phase 2, record the 4.3 severity probe ([be0f893](https://github.com/event4u-app/agent-config/commit/be0f893e57001ca8a3a8c4c4a21538f37266f410))

Tests: 13213 (+145 since 9.34.0)

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
