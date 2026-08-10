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

# Era: 9.27.x — current

> Started at `9.27.0`. Full entries live inline below.
> The drift test caps this era at 250 lines of entry body; growth past
> that forces a new era split (`# Era: 9.28.x`, etc.) — see
> [`docs/contracts/CHANGELOG-conventions.md § Era splits`](docs/contracts/CHANGELOG-conventions.md).

## [9.30.0](https://github.com/event4u-app/agent-config/compare/9.29.0...9.30.0) (2026-08-10)

### Release highlights

<!-- Curated head: fill before merge, keep it under 10 lines, and leave `_none_` where it is genuinely the answer. The generated log below is unchanged. -->
- **Behaviour changes:** _auto-derived, rewrite before merge:_ rule/schema diffs, breaking commits or removed public surface in ded8e1a.
- **Default changes + migration:** _none_
- **Security and correctness:** _none_
- **Honest nulls:** _auto-derived, rewrite before merge:_ commits carrying an honest-null marker in 133baf3, fcb689a, 5b86045.
- **Known limitations:** _none_

### Features

* **roadmap:** the cost-parity family, cut down to what the tree does not already own ([41e52d1](https://github.com/event4u-app/agent-config/commit/41e52d18c66a0b8f5cb8bb1eac389313a51a32b8))
* **gates:** the bootstrap flag closes itself instead of relying on memory ([b9d2e3b](https://github.com/event4u-app/agent-config/commit/b9d2e3ba8a3ea6c3725969de09f347a3ef0e2dae))
* **self-repair:** name the surfaces a patch may never target ([4ae482a](https://github.com/event4u-app/agent-config/commit/4ae482ab669702be45ecc50eebb03246e43df3ad))
* **doctor:** surface what the host actually receives, without inventing a baseline ([50ded4c](https://github.com/event4u-app/agent-config/commit/50ded4c32fe13d29379c9c279c85b29d944efc9f))
* **conformance:** join delivery, activation and compliance into one funnel view ([0f33281](https://github.com/event4u-app/agent-config/commit/0f3328196838c8399343e861890ddeb5b64d8c89))
* **explain:** a dispatch decision explains its whole ladder walk, truthfully ([c665b6c](https://github.com/event4u-app/agent-config/commit/c665b6c4af2d251168c825accd54cbd238d985cf))
* **cli:** gates — the open decisions that need you, rendered as actions ([530365a](https://github.com/event4u-app/agent-config/commit/530365ad7e0abb767953176d211cb633a7497b76))
* **gates:** a new rule declares its enforcement, or states the gap ([71a1c30](https://github.com/event4u-app/agent-config/commit/71a1c303beb046c1f96c186d286d8d332dcb7872))
* **gates:** twelve gates account per target, or name why they cannot ([200a2fb](https://github.com/event4u-app/agent-config/commit/200a2fb9795896d1a153f79da7653b3848b36a62))
* **recycling:** session-eol Stop carrier, committed threshold, compact fallback, metric registrations (P3+P4) ([117991f](https://github.com/event4u-app/agent-config/commit/117991f720861b477af51641d34cb913f5af601b))
* **recycling:** main-session recycle envelope — schema variant, producer, consumer, round-trip (P2) ([62881e2](https://github.com/event4u-app/agent-config/commit/62881e2a0c25a1f0af75622c919f177f20271ee8))
* **recycling:** session end-of-life scanner, report and measured baseline (P1) ([cb760c1](https://github.com/event4u-app/agent-config/commit/cb760c1270e0aeb5de4490abc3efbbd78c8444d2))
* **cache-economy:** rtk corpus extension + unbounded-output cap advisory + metric registrations (P4-P6) ([0e46dff](https://github.com/event4u-app/agent-config/commit/0e46dff8fbaa77fcd66eb2a3bfc5db8e9ccd7f41))
* **cache-economy:** injection anatomy spike, stability lint, injection budget (token-economy-cache P1-P3) ([1176f77](https://github.com/event4u-app/agent-config/commit/1176f77b4e57e882a3a2d1399828a0c564883b31))
* **settings:** subagent model ceiling as explicit class-C spend cap (token-economy-dispatch P5) ([3fd63fc](https://github.com/event4u-app/agent-config/commit/3fd63fcb3ad9a343d3f40fdeb9354535aa8eda51))
* **ladder:** rung 0.5 ask transport below the spawn boundary (token-economy-dispatch P3+P4) ([5b86045](https://github.com/event4u-app/agent-config/commit/5b860459bf3a039200af37de91fea15e83f335d4))
* **hooks:** role axis in the hook manifest (token-economy-dispatch P2) ([60e804d](https://github.com/event4u-app/agent-config/commit/60e804d5ffa510cdd62e44744a9399b29793533f))
* **telemetry:** register dispatch-floor + rules-efficiency metrics (token-economy-dispatch P1) ([083fbb1](https://github.com/event4u-app/agent-config/commit/083fbb1d9ab5045a10bc0438d4a74bef6cec8b01))
* **scripts:** measure the turn-end-gate detectors against a real corpus ([b5c9bfe](https://github.com/event4u-app/agent-config/commit/b5c9bfe9ea85b3489f060401e7ff8a07a230f38d))
* **hooks:** re-emit the language pin across the compaction boundary ([a1812b4](https://github.com/event4u-app/agent-config/commit/a1812b41ba23745c3c4f21d3532ec0e822284d7c))
* **hooks:** add turn-end-gate, the first concern that can refuse a turn-end ([9e2edfc](https://github.com/event4u-app/agent-config/commit/9e2edfcba6c633a8746d8b28aac7069313123c32))

### Bug Fixes

* **roadmap:** apply the council pass and the second review-gate round ([425b461](https://github.com/event4u-app/agent-config/commit/425b461329eb1eac781364d1496cc6bcbb4c5f17))
* **roadmap:** the divergence figure measures cache staleness, not the source ([a955e1f](https://github.com/event4u-app/agent-config/commit/a955e1fc2cb8ad86c8a809e35b96b0da2888ab27))
* **roadmap:** close all ten review-gate findings and add inbox snapshot provenance ([133baf3](https://github.com/event4u-app/agent-config/commit/133baf30fe2a2fd3d9dbff0535bf5b01fd845581))
* **roadmap:** risk types in the cost-parity family must be product or implementation ([5fb28c4](https://github.com/event4u-app/agent-config/commit/5fb28c46509761585ed154b7e222d1396562ec94))
* **evidence:** fill the registration SHA the council caught shipping unfilled ([a368a0c](https://github.com/event4u-app/agent-config/commit/a368a0ca815b70b61faa39b6cf72526e16b8f0f4))
* **review:** address the four PR advisories, three of them by stating what is true ([87b9202](https://github.com/event4u-app/agent-config/commit/87b92028f01df4f77f1495f5d422b0b6c1e083c2))
* **explain:** the ladder trail carries rung 0.5 after the merge ([9c77684](https://github.com/event4u-app/agent-config/commit/9c77684f134dc9e004c3d26ae2e08363643c4d37))
* **rules:** preservation-guard states its whole prohibition in its Iron Law ([ded8e1a](https://github.com/event4u-app/agent-config/commit/ded8e1ad2c435f657d7dbed8f4fea5cb40834080))
* **recycling:** pin session-eol in the worker-drop set the role-axis test asserts ([1a4370d](https://github.com/event4u-app/agent-config/commit/1a4370df8cc6bf97cc2c988fd6d10e9f91249212))
* **hooks:** point the pre-commit roadmap gate at the live script path ([fd8c565](https://github.com/event4u-app/agent-config/commit/fd8c565123d3a61d9a883fa079a60378552936fc))
* **cache-economy:** cast reread-guard ledger reads via unknown for the strict changed-files typecheck ([7159adf](https://github.com/event4u-app/agent-config/commit/7159adf91ed90c51cb4e645c27b6dc1042e97dbd))
* **deps:** bump the npm-production group with 5 updates ([2e388f1](https://github.com/event4u-app/agent-config/commit/2e388f1a611417d5b740448a5f1d49f8953ac69c))
* **tests:** add returnChannelChars to the two DispatchFacts literals ([4621d20](https://github.com/event4u-app/agent-config/commit/4621d20bdff8b97ddbe9101343e5a7db0a4fa160))
* **roadmap:** ref-ignore the deliberately-absent budget file path ([b017e88](https://github.com/event4u-app/agent-config/commit/b017e888f815c49af2217fbda0f935d7f82aec67))
* **roadmap:** risk-type enum on the two sibling registers ([042b0d8](https://github.com/event4u-app/agent-config/commit/042b0d87fcd6b066e4b0b85bd8dbba1140a8ecba))
* **review:** close the neutral-review findings on the dispatch-economy delta ([ecf4808](https://github.com/event4u-app/agent-config/commit/ecf4808211b58912e76ca5c62f4c3d5be9c7cb42))
* **review:** stamp R2 roadmap snapshots with the check-refs exemption ([2882267](https://github.com/event4u-app/agent-config/commit/2882267fa460862172f27fc80793620dc29bb0fb))
* **review:** address all four zcs-close R2 findings ([3cfe707](https://github.com/event4u-app/agent-config/commit/3cfe70733884874a2427db931fa5d56436212e4c))
* **contracts:** drop the two deleted ask-enum keys from settings-classes prose ([eab16c6](https://github.com/event4u-app/agent-config/commit/eab16c6b981909024e4205c10c449628fed10116))

### Documentation

* **roadmap:** pull the 109-divergent-rules finding out of the blockers ([2346ee0](https://github.com/event4u-app/agent-config/commit/2346ee0bbda2e7922d7df28ce1545809fafb4819))
* **roadmap:** archive road-to-feedback-9-29 - all sixteen steps closed ([99f5bec](https://github.com/event4u-app/agent-config/commit/99f5bec04902001539d484d34f31c4c023dd9a4a))
* **contracts:** document the consent sidecar's record shape, and the ledger retention policy ([4804bf9](https://github.com/event4u-app/agent-config/commit/4804bf9aa0732e0c08e8c62e977af3361b112047))
* **adr:** propose the host-native-first ladder (ADR-221) ([57c4658](https://github.com/event4u-app/agent-config/commit/57c465881ce9931b20a8963ba3be41f1f9b8a548))
* **evidence:** measure drill coverage and delivered rule tokens, decide nothing ([fe00143](https://github.com/event4u-app/agent-config/commit/fe00143e26401bcd6257a9cb0f937f33bdfaf458))
* **evidence:** pre-register the scoped-rule absence experiment, and correct its headline ([9321fb2](https://github.com/event4u-app/agent-config/commit/9321fb21e84db815504ce5a419cd3b1b573980fc))
* **claims:** publish the advisory-vs-blocking measurement as a bound claim ([a3f340b](https://github.com/event4u-app/agent-config/commit/a3f340b8e5cd3243eec7c090adfec2aae68e53f9))
* **changelog:** curate the auto-derived highlight heads for 9.27 to 9.29 ([fcb689a](https://github.com/event4u-app/agent-config/commit/fcb689ae8b7a3bd798ed26879bb0077e7d0ec15d))
* **cache-economy:** batching fire/no-fire pair in the process-loop context (P6.3) ([0ce8675](https://github.com/event4u-app/agent-config/commit/0ce867553cd005a823a401817ca3357f136cbe57))
* **roadmap:** archive token-economy-dispatch, spawn blocked follow-up ([3009a02](https://github.com/event4u-app/agent-config/commit/3009a0285ce0d78e803fc0dfc48c39661d3a76f5))
* **review:** re-bind the manifest roadmap/ac hashes after the fix pass ([7fb09cc](https://github.com/event4u-app/agent-config/commit/7fb09cc48ffd33cfdea53f1d8e79857b7d5c3807))
* **roadmap:** add token-economy series from inbox analysis ([6c0a1a5](https://github.com/event4u-app/agent-config/commit/6c0a1a5f30518b1c86f605584d8a09f8e83a6ae5))
* **roadmap:** close round 5, resolve the stop-refusal blocker, record it in round 6 ([ed98d05](https://github.com/event4u-app/agent-config/commit/ed98d05703c2995e58d5b4cf715387144e2caf54))
* **review:** re-bind the R2 findings scope after the CI fix ([b14f2ae](https://github.com/event4u-app/agent-config/commit/b14f2ae8eb594f69a656c85435c3995a52d3bdab))
* **review:** re-bind the R2 findings scope after the main merge ([143c8a3](https://github.com/event4u-app/agent-config/commit/143c8a3b44378345a02fb381820d3404a41877f7))
* **review:** re-bind R2 findings to the post-fix review scope (contract 2.1 in-place re-bind) ([30461c9](https://github.com/event4u-app/agent-config/commit/30461c9c198ccc870ea22d0be7f4574bf934ddfc))
* **review:** commit the R2 completion-review findings for the zcs close ([b92cb6c](https://github.com/event4u-app/agent-config/commit/b92cb6ce41dc3ea86d299db656f2dc1f3181d07a))
* **roadmap:** verify always-on-orchestration acceptance criteria and Phase-7 non-goals ([e09189f](https://github.com/event4u-app/agent-config/commit/e09189ff3f7b30f4aa58ed5b309f814bef46e614))

### Refactoring

* **roadmap:** park parts 1 and 2 in later/ per the council convergence ([95711d0](https://github.com/event4u-app/agent-config/commit/95711d0256c3a4e96bd8be029c8b9df93b02654a))

### Tests

* **settings:** pin the two first-run entry-count cases from the council condition ([ffb33d6](https://github.com/event4u-app/agent-config/commit/ffb33d69c4dc075ac625933da1b193d6ad57c094))

### Build

* **install:** refresh the install bundle after the settings-schema addition ([a1c4daa](https://github.com/event4u-app/agent-config/commit/a1c4daa686a0644911f69d850c25b3f6ec4f1b4d))

### Chores

* **roadmap:** close road-to-token-economy-recycling — all phases landed, archived ([c5207f4](https://github.com/event4u-app/agent-config/commit/c5207f4ad6952b6499bc93c2bff4bb87f0f154f4))
* **roadmap:** close road-to-token-economy-cache - archive + census follow-up in later/ ([a87a2af](https://github.com/event4u-app/agent-config/commit/a87a2af343c02a425769e4f1b879ed56c39fcdb7))
* **deps:** bump actions/upload-artifact in the github-actions group ([f2b13ab](https://github.com/event4u-app/agent-config/commit/f2b13ab0dcbb558539e4d25f4e2a7b16fa9cced7))
* **deps-dev:** bump the npm-development group with 4 updates ([9e4310d](https://github.com/event4u-app/agent-config/commit/9e4310d0ea4fc6a3cb420cb5fe9d40180dee9e1f))
* **hooks:** bind turn-end-gate to claude stop and language-mirror to pre_compact ([6e3a5b4](https://github.com/event4u-app/agent-config/commit/6e3a5b40acbae2da22025a74e74a50307fc2142d))
* **roadmap:** close road-to-zero-ceremony-settings on the council condition, transfer the one deferral ([d7bc46a](https://github.com/event4u-app/agent-config/commit/d7bc46aeb63336afe1ea31c1c3661de60461d458))

Tests: 12691 (+253 since 9.29.0)

## [9.29.0](https://github.com/event4u-app/agent-config/compare/9.28.0...9.29.0) (2026-08-09)

### Release highlights

<!-- Curated head: fill before merge, keep it under 10 lines, and leave `_none_` where it is genuinely the answer. The generated log below is unchanged. -->
- **Behaviour changes:** Always-on orchestration: a five-rung judgment ladder (deterministic script → single lite slice → parallel → team → council) replaces the activation gate — `classifyTask` drops the enabled/auto settings while the emergency halt and the host `subagent_spawn` capability remain, and ambiguity stays an ask verdict (1a2dd51). The activation settings (`subagents.enabled`/`auto`/`host_capabilities`/`budget_routing`, `ai_team.enabled`) leave the template, the zod schema and the settings-classes contract; `emergency.orchestration_halt` is the one surviving switch, and leftover keys warn once per process and are then ignored (0304406). The ADR-217 body link in token-budget-discipline becomes plain text because ADRs never ship into the dist projection, so the link could not resolve there (1008212).
- **Default changes + migration:** The council's shipped transport default flips `api` → `auto` (CLI-first; explicitly configured modes unchanged), a pass now concludes at majority quorum with absent members carrying reasons, and a machine-readable handoff envelope is emitted — the same commit fixes the CLI-client construction defect that made every default-path CLI member throw (51088bd). The new read-only forensics analyzers ship as a default-off pack (`default_install: false`, surface tier lab) (b7b4cb0). 2590391 is roadmap bookkeeping only — the rule-delivery-integrity roadmap closes and its deferred measurement migrates to a successor roadmap; it changes no consumer-facing default.
- **Security and correctness:** _none_
- **Honest nulls:** _none_
- **Known limitations:** _none_

### Features

* **team:** availability replaces the master switch; teams readiness ([a94a91a](https://github.com/event4u-app/agent-config/commit/a94a91a30b916909c391939320ae4fb2b04e0b31))
* **council:** CLI-first shipped default, quorum, absent members, handoff ([51088bd](https://github.com/event4u-app/agent-config/commit/51088bdaaf3633c4918ea05182c5becf65593cf2))
* **dispatch:** judgment ladder replaces the activation gate ([1a2dd51](https://github.com/event4u-app/agent-config/commit/1a2dd5177b02b9ca752588a022d8a72c6afe51f5))
* **settings:** activation gates die, one audited incident switch survives ([0304406](https://github.com/event4u-app/agent-config/commit/0304406a536e29d66f44ce19f5f0187383b8af4e))
* **ci:** lint_never_silent - no shipped guidance may direct a silent re-run ([c7b3d83](https://github.com/event4u-app/agent-config/commit/c7b3d8382ac34a992727c1a042cc65298e56adaa))
* **self-repair:** fork-aware egress ladder, issue form, detector corpus gate ([5b50807](https://github.com/event4u-app/agent-config/commit/5b5080710e9800bbb4e1eec5773d9c5ff79de866))
* **self-repair:** fork-aware egress, detector corpus gate, never-silent lint ([4e046aa](https://github.com/event4u-app/agent-config/commit/4e046aa5d992cbefa31717430bd05a9e37798f4f))
* **rules:** emit Claude Code rules with the host-native paths key ([872c267](https://github.com/event4u-app/agent-config/commit/872c267589995668bfbfffdc2c0128b9d89532dd))
* **forensics:** read-only forensic analyzers as a default-off pack (Phase 3) ([b7b4cb0](https://github.com/event4u-app/agent-config/commit/b7b4cb05e2247737786e96ff52cf4d739dff68c4))
* **bench:** critic-protocol A/B result — no promotion, published both directions (Phase 2) ([bc0054b](https://github.com/event4u-app/agent-config/commit/bc0054b8406dc6fe280fcca7b10104547e2380b1))
* **council:** critic_protocol config + pre-registered load_bearing A/B harness (Phase 2, pre-run) ([e75ae51](https://github.com/event4u-app/agent-config/commit/e75ae514b765205a2f86c5ffaae40a5c81523d87))
* **hosts:** add worker_respawn to the host-capability manifest ([a30102d](https://github.com/event4u-app/agent-config/commit/a30102d0f30d197ced06248c5712722006032447))
* **subagents:** emit the capsule at a budget watermark, in shadow ([572d280](https://github.com/event4u-app/agent-config/commit/572d28066be1871f43242056af175ddbd023002c))
* **subagents:** add the CHECKPOINT capsule as the worker handoff shape ([8340f5e](https://github.com/event4u-app/agent-config/commit/8340f5e11219c296030084432e9f403818552df9))
* **premortem:** four-part failure register + optional roadmap Pre-mortem section (Phase 1) ([da95e9e](https://github.com/event4u-app/agent-config/commit/da95e9e4880394ab06ea0aaf818e893c695d4657))

### Bug Fixes

* **build:** rebuild the committed install bundle for the settings teardown ([6d9e667](https://github.com/event4u-app/agent-config/commit/6d9e6672bee69178d0ce8d86bd574e248abca54b))
* **spike:** escape the shape-key separator instead of a raw NUL byte ([1dd9a28](https://github.com/event4u-app/agent-config/commit/1dd9a281d5fc38ce228a04035a43a35b295114e5))
* **self-repair:** resolve the four R2 completion-review findings ([3474bf7](https://github.com/event4u-app/agent-config/commit/3474bf797321a99e5a7dd5a484a70a8a8748add6))
* **roadmap:** risk-register marker, allowed risk types, resolvable anchors ([f06f6ed](https://github.com/event4u-app/agent-config/commit/f06f6edb1f9f3b08c4763c542e789272f4dbd091))
* **scorer:** repoint skill-selection scoring at the live skills tree ([589b2c3](https://github.com/event4u-app/agent-config/commit/589b2c3e11eaf64a32e7bc7269807b3a9af648a2))
* **ci:** unlink the ADR-217 body link that can never resolve in the dist projection ([1008212](https://github.com/event4u-app/agent-config/commit/100821272c9254d4aae70876c9bfa65af67d1d4d))
* **forensics:** review findings — schema-valid finding ids, fail-before-write, hermetic smoke test, honest config scope ([0509647](https://github.com/event4u-app/agent-config/commit/050964793ec76e0100199a59fefd5b8cc4ad59e4))
* **release:** tolerate the concurrent tag-push race in step 8 ([049e8b2](https://github.com/event4u-app/agent-config/commit/049e8b24296a97f946c4597418cfd79457018e3c))
* **hooks:** self-heal a stale hook bundle in preflight instead of blocking the push ([9256633](https://github.com/event4u-app/agent-config/commit/9256633996be6d86e09df8c288837a8970d456e7))

### Documentation

* **council:** describe the runtime responses artefact without the pruned path literal ([04e8a0f](https://github.com/event4u-app/agent-config/commit/04e8a0feecb2fc19326f9abf894cf49f38424c6b))
* **roadmap:** always-on orchestration - verified claims, council cut, honest blockers ([d202556](https://github.com/event4u-app/agent-config/commit/d202556efa32376c4fc5fedba7fb95414cb4f4b4))
* always-on doctrine reaches the always-loaded surfaces ([9eead89](https://github.com/event4u-app/agent-config/commit/9eead8923e604f584541afbdac6d1feac3b02e5c))
* **review:** re-derive the context-manifest scope_hash for the re-bound round (contract 5 header-manifest agreement) ([2ebdb87](https://github.com/event4u-app/agent-config/commit/2ebdb87f0286a167d24cc26b3a658306274748c6))
* **review:** add fix-commit refs to the four resolved R2 findings ([9adbf83](https://github.com/event4u-app/agent-config/commit/9adbf83bcb530db4d702d4ff9425f685124b8a2f))
* **review:** re-bind R2 findings to the post-fix review scope (contract 2.1 in-place re-bind) ([752c29c](https://github.com/event4u-app/agent-config/commit/752c29cf11a66ded030bff60aeac45763c36c2ed))
* **review:** R2 completion-review findings for feat/road-to-rule-delivery-integrity (1 medium, 3 low, all open) ([0267568](https://github.com/event4u-app/agent-config/commit/02675686ef102552a80ce35861e1c5c094fb3f31))
* **roadmap:** close rule-delivery-integrity, migrate the measurement out ([2590391](https://github.com/event4u-app/agent-config/commit/25903915772394a776b069991e3d939bcf3f0e70))
* **adr:** ADR-220 skill invocation attestation — specified, check deferred (Phase 4) ([c8f3dbb](https://github.com/event4u-app/agent-config/commit/c8f3dbb31762a7df7ef3abf7ef70f1e17741afa4))
* **roadmap:** land phases 0 and 1 of worker-generation recycling ([06c7347](https://github.com/event4u-app/agent-config/commit/06c7347b49809a81b7ee169f42e3c742e5211812))
* **claims:** pre-register the capsule trigger-arm comparison ([2acfc56](https://github.com/event4u-app/agent-config/commit/2acfc56982d257331243094d2a580ca4f5926c6c))

### Chores

* **roadmap:** close Phase 4 of road-to-rule-delivery-integrity ([5db59bc](https://github.com/event4u-app/agent-config/commit/5db59bc4410488eb22717c8d0606b8eca10bcfa4))
* **roadmap:** park round-6 and worker-generation-recycling in later/ ([e5ebedc](https://github.com/event4u-app/agent-config/commit/e5ebedcd9ba0b3ddaba10938af74fcab9d79f03a))
* **generated:** regenerate proof.md + CAPABILITIES.yaml for the 289th skill post-merge ([d0f348d](https://github.com/event4u-app/agent-config/commit/d0f348d0b75b507d10199941185969a633563f63))
* **roadmap:** close Phase 5 + acceptance criteria — roadmap fully closed ([c993660](https://github.com/event4u-app/agent-config/commit/c9936607fe77e06f1b510a3ee3ccf8390f49a8d6))
* **generated:** rebuild the install bundle for the settings-schema change ([5b1260d](https://github.com/event4u-app/agent-config/commit/5b1260de7b889a16e94a5e5d5bc6f22f23dc558e))
* **generated:** regenerate proof.md for the new ledger entry ([76ab0a9](https://github.com/event4u-app/agent-config/commit/76ab0a9e1ccdb09e436f562c1cf8416989d921ef))

Tests: 12438 (+297 since 9.28.0)

## [9.28.0](https://github.com/event4u-app/agent-config/compare/9.27.0...9.28.0) (2026-08-09)

### Release highlights

<!-- Curated head: fill before merge, keep it under 10 lines, and leave `_none_` where it is genuinely the answer. The generated log below is unchanged. -->
- **Behaviour changes:** Two new always-loaded rules land — the self-repair loop (cb8d560) and the council-config-is-user-global fact (36a0e4c) — both later condensed to re-anchor the token baseline (103a22b), and AGENTS.md plus delegation-policy now carry the delegate-by-default and end-review obligations on the surface sessions actually read (63825ba). Settings resolution changes behaviour: the user-global loader now reads the canonical `settings/.agent-settings.yml` the wizard, server and installer write (previously silently inert), the onboarding gate checks the canonical project path so it can actually fire, and `MERGEABLE_KEYS` follows the key migration additively (ae6f30e, recorded as ADR-219). Four capability probes ship (`packs:active`, `settings:get`, `mcp:available`, `brand:status`) and rules are rewritten to name them plus `hooks:status` and the settings resolution chain (909235c, 3d684ef); 9cd21cb only fixes CI (ADR-219 frontmatter, three consumer-path ref-ignore markers) with no behaviour change.
- **Default changes + migration:** _none_
- **Security and correctness:** _none_
- **Honest nulls:** The SK-2 loaded-but-violated detector resolves its precision question as an honest null: 0 flags over 137 sessions makes precision over the flag set UNDEFINED, not 100%, so a 15-test discrimination proof replaces the number — and only 3 of the 110 skill-obligation lines are mechanically checkable, with the remainder reported uncovered rather than approximated (2837fb7).
- **Known limitations:** _none_

### Features

* **hooks:** register the three orchestrator-discipline concerns ([b170fbc](https://github.com/event4u-app/agent-config/commit/b170fbc9c8a90bdb69ba97929a8c13b08c90ccb3))
* **hooks:** advisory end-review-nudge concern on stop ([3d2c1a0](https://github.com/event4u-app/agent-config/commit/3d2c1a0bc1087960d634e1d489867da78069ed8c))
* **hooks:** conditional delegation-nudge concern on user_prompt_submit ([761b793](https://github.com/event4u-app/agent-config/commit/761b793ad2e9a9371ade2272848e2d7aa856faae))
* **hooks:** deterministic orchestration-record concern on post_tool_use ([36e24c9](https://github.com/event4u-app/agent-config/commit/36e24c936e8e05281220574fbe9e924bd787c152))
* **host-capability:** committed registry for known hosts ([04e31f7](https://github.com/event4u-app/agent-config/commit/04e31f7c6274815db376fd545869f4bb80a3d225))
* **cli:** four capability probes for the gaps that had none ([909235c](https://github.com/event4u-app/agent-config/commit/909235ce713beaafec0dc0560ae21d47fca3df2e))
* **scripts:** measure the rule tokens a session actually receives ([406f986](https://github.com/event4u-app/agent-config/commit/406f98647fe3fca8a25cfa8f7a2e447f787bd5a6))
* **install:** refuse to create a silently doubled rule corpus ([9f2608f](https://github.com/event4u-app/agent-config/commit/9f2608f8da62ccf4ba2873845e4117b61cb91280))
* **rules:** detect when the rule corpus is delivered twice ([d9b6618](https://github.com/event4u-app/agent-config/commit/d9b6618c96f1cc0a328ac5e677ef16eb340b0c84))
* **scripts:** SK-2 loaded-but-violated, and the 3-of-110 coverage that is the finding ([2837fb7](https://github.com/event4u-app/agent-config/commit/2837fb7c1f44b303f97a6eb61c497679f36020ae))
* **conformance:** delivered rule payload by carrier, and the forward rate series ([78c19fd](https://github.com/event4u-app/agent-config/commit/78c19fdb1af6c02e81802da33f2e593e2599b9e1))
* **scripts:** name the rules the two carriers deliver differently ([cc6c8fb](https://github.com/event4u-app/agent-config/commit/cc6c8fbd307e4dc65ee4716208cd50084b32cf36))
* **wiring:** bind the self-repair concern and register its two CLI verbs ([a619cfc](https://github.com/event4u-app/agent-config/commit/a619cfc982965fb77a5c02f8480108be80661c92))
* **rules:** the self-repair loop as an always-loaded obligation ([cb8d560](https://github.com/event4u-app/agent-config/commit/cb8d56076ac09b351a565216b98a68789acd5e60))
* **self-repair:** detect agent defects and queue them as fixable records ([76b95ec](https://github.com/event4u-app/agent-config/commit/76b95ec7a524d482f333b701015f0a490cc4907d))
* **gate:** fail when no always-loaded rule carries the council user-global fact ([a56f28b](https://github.com/event4u-app/agent-config/commit/a56f28bf436c24b8f803711fa546ba713412c5c3))
* **rules:** carry the council user-global fact on the always-loaded surface ([36a0e4c](https://github.com/event4u-app/agent-config/commit/36a0e4cc6af6e83a47d120718a0fed7b5abb13cb))
* **gates:** refuse a push from a branch behind its base, asked of the remote ([bbdac53](https://github.com/event4u-app/agent-config/commit/bbdac539f5f3f2c8e86113f2a6a3a184a253a239))
* **report:** skill-activation census — the unmeasurable half, measured ([5719fd0](https://github.com/event4u-app/agent-config/commit/5719fd09e723bc7988fc0e90719c46d8a5f222f1))

### Bug Fixes

* **routing-doctor:** report whether the platform was observed or assumed ([2c176b2](https://github.com/event4u-app/agent-config/commit/2c176b212021bc05421233cb724677d4a1e44697))
* **routing-doctor:** resolve host capabilities through the committed registry ([9875177](https://github.com/event4u-app/agent-config/commit/9875177b73b65810eaae9e2c1a8f2c66c8648da3))
* **hooks:** harden transcript read, full session key, mutation-measure flag ([c908bbf](https://github.com/event4u-app/agent-config/commit/c908bbf41c944a9564dfd0efc9198472693a7f36))
* **ci:** ADR frontmatter and three consumer paths the reference gate read as repo paths ([9cd21cb](https://github.com/event4u-app/agent-config/commit/9cd21cb4182c205205b49f352c0a1745e11ff33e))
* **build:** rebuild the install bundle for the settings-cascade change ([dbcb658](https://github.com/event4u-app/agent-config/commit/dbcb658c51a31b7af028f0d745db4d23b3b5bf35))
* **settings:** four adjacent path defects that made the intuitive file wrong ([ae6f30e](https://github.com/event4u-app/agent-config/commit/ae6f30ee29c3e79bff20501adbfd394489de53df))
* **build:** rebuild the committed install bundle for the install.ts change ([0d362ce](https://github.com/event4u-app/agent-config/commit/0d362ce2242debe7fffc798e457fcad02a0e6426))
* **roadmap:** conform the Risk Register to the R1 gate grammar ([8a4f388](https://github.com/event4u-app/agent-config/commit/8a4f388c67d5351bbea7c76faf631dbd40a5aa29))
* **roadmap:** inline the council provenance instead of linking a path that rots ([5268154](https://github.com/event4u-app/agent-config/commit/5268154d686717d7ff64deb059c78779607c27b6))
* **skills:** lead nine descriptions with what they do, not with the guard ([bee0a72](https://github.com/event4u-app/agent-config/commit/bee0a72f90c97c67b57a949ac3c0d85756ad4db8))
* **scripts:** repair the round-2 review findings, incl. a second inverted polarity ([6ab06f7](https://github.com/event4u-app/agent-config/commit/6ab06f759c02774f02f37dd5b85aaf6009da44d4))
* **scripts:** repair all 14 R2 completion-review findings ([0ee1275](https://github.com/event4u-app/agent-config/commit/0ee1275af82ae1dfbe1f0e6eaa48337e71905aa1))
* **rules:** condense both new rules and re-anchor the token baseline ([103a22b](https://github.com/event4u-app/agent-config/commit/103a22b10c8830e87bf28ab0dddebf02d6354f85))
* **tests:** name the retired container by role, not by its dead literal path ([d7147ce](https://github.com/event4u-app/agent-config/commit/d7147ce2f4940c7095c94c91e731243a6c0ee495))
* **cli:** list council:status in usage(), the trunk was red without it ([1ca2ad0](https://github.com/event4u-app/agent-config/commit/1ca2ad00648533595d1d48794fd551c6e4e437d6))
* **tests:** two suites left directories in the tracked tree, and a third gate read them ([df70f14](https://github.com/event4u-app/agent-config/commit/df70f1436a325d0da2167f86ea464ee4ea074556))
* **council:** the refusal messages named the wrong config file ([62c6872](https://github.com/event4u-app/agent-config/commit/62c6872fe4647bc057835466414268cbf6da6971))
* **council:** stop the agent inferring council availability from a project file ([45f46b5](https://github.com/event4u-app/agent-config/commit/45f46b521ec4cb16a6d3d22c8a0db3009a68ea84))
* **conformance:** one trigger definition, and the count it was hiding ([8e131b4](https://github.com/event4u-app/agent-config/commit/8e131b41371a25255193702a23fd5820490db415))
* **hooks:** block what bash runs, not what the splitter finds readable ([bbc9b11](https://github.com/event4u-app/agent-config/commit/bbc9b11a949e2b6aad074fa11723d75609423b23))

### Documentation

* **review:** re-bind the R2 findings scope after the main merge ([8c85ea0](https://github.com/event4u-app/agent-config/commit/8c85ea05c707c0a379d3f8caf7c8c53d09df05fe))
* **review:** re-bind the R2 findings after the fix pass ([6728b67](https://github.com/event4u-app/agent-config/commit/6728b679853a9c4aea691d8348d060a4c892469d))
* **contexts:** carry the three open orchestrator-carrier decisions forward ([3c17c11](https://github.com/event4u-app/agent-config/commit/3c17c11f7246b0f2eb95e3e5904e9b43c0270b07))
* **review:** R2 completion-review findings for the closeout branch ([8217034](https://github.com/event4u-app/agent-config/commit/82170344f6fef8457c22ce125aa5adf51801a9fb))
* **roadmap:** close orchestrator-discipline-carriers on measured evidence ([e01b6f2](https://github.com/event4u-app/agent-config/commit/e01b6f284affa9bab5ec323e1c9c415962366fb7))
* **roadmap:** post-merge council pass, fd47df62 disposition, calibration biases ([ed8710d](https://github.com/event4u-app/agent-config/commit/ed8710d47bab07b4e428eac8f18b5560315d204e))
* **hooks:** correct stale cowork binding claim in delegation-nudge header ([d2f6e99](https://github.com/event4u-app/agent-config/commit/d2f6e99bf1a0ac11d0365f7854cab9177ff6692f))
* **roadmap:** orchestrator-discipline-carriers - measured defect, council pass, honest exits ([9a1798c](https://github.com/event4u-app/agent-config/commit/9a1798c6692f4c99c8cfcd418dbd2a9b1178b9cc))
* state the delegation and end-review obligations where sessions read ([63825ba](https://github.com/event4u-app/agent-config/commit/63825ba757524bbded04cf58e787585b4e3699e9))
* **rules:** make the capability answers reachable without knowing they exist ([3d684ef](https://github.com/event4u-app/agent-config/commit/3d684ef1403541fb707ec2a47026320dc734ae82))
* **roadmap:** the delivery-integrity roadmap, its council pass, and where it halts ([cd33314](https://github.com/event4u-app/agent-config/commit/cd333144c3a6636dd4209aa3c24e22b12484de77))
* **evidence:** three measurements behind the delivery findings ([cdf5b3f](https://github.com/event4u-app/agent-config/commit/cdf5b3f45165d374148ff87a3ba3240216c0d167))
* **contracts:** the router is compile-time, and no host reads it at runtime ([b1fdc72](https://github.com/event4u-app/agent-config/commit/b1fdc72a152d9d8250e713d8b5b8b482e3bd1acf))
* **roadmaps:** record what the two review rounds cost and the contract step I got wrong ([1e51900](https://github.com/event4u-app/agent-config/commit/1e51900fb143eb939bd8917d982ce76ff9fe6252))
* **reviews:** commit the binding completion-review artefact, re-bound to the shipping scope ([82e5909](https://github.com/event4u-app/agent-config/commit/82e5909e6ea5289b5f856f6343d38408e653b84b))
* **roadmaps:** close round 6 phases 3-4, and record the premises that came out false ([dc9b6b0](https://github.com/event4u-app/agent-config/commit/dc9b6b0a68ae3df99b1eee37d65bfc54edfd2d18))
* **gates:** the unregistered-emitter backstop covers one of the two emit shapes ([a032f0c](https://github.com/event4u-app/agent-config/commit/a032f0ccc2aceabf15ea92e1fcc86aa439d76e5f))
* **memory:** say which repo the intake sharing-boundary line describes ([466bdfc](https://github.com/event4u-app/agent-config/commit/466bdfcd050e58c47bef38a29fe7f24be59ffb51))
* **roadmap:** twelve places the agent must guess whether a capability exists ([9453c16](https://github.com/event4u-app/agent-config/commit/9453c162fd78f31f257eaea4dd5db68ff4513056))
* **roadmap:** the census, round 5 accounting, and a criterion that contradicted its own cancelled step ([3bac223](https://github.com/event4u-app/agent-config/commit/3bac22325f16287511c0f8dc3345a798cb0d47f6))
* **archive:** file superseded substrate-adoption roadmap ([f435453](https://github.com/event4u-app/agent-config/commit/f435453d3faa882a657b21475f467b13b332831e))
* **roadmap:** record the third #1208 defect, found by PR #1211 not by the review ([25d2d12](https://github.com/event4u-app/agent-config/commit/25d2d12e6f1c7ea56e7e99ba3fffd294638c3be5))
* **roadmap:** fold the challenge pass and four council verdicts into round 6 ([01f3286](https://github.com/event4u-app/agent-config/commit/01f3286d91ee34d155a175ce687679181602f838))

### Refactoring

* **scripts:** one definition of the cross-carrier rule comparison ([0a22a90](https://github.com/event4u-app/agent-config/commit/0a22a901fc95ed13e28afc44ce9f84fba9c7c5e2))

### Chores

* **tests:** drop dead subprocess scaffolding the changed-files lint surfaced ([2f786b9](https://github.com/event4u-app/agent-config/commit/2f786b91c31724561761a9489d118c3ccb50c7a6))
* **index:** regenerate index and catalog for the nine rewritten descriptions ([593330f](https://github.com/event4u-app/agent-config/commit/593330ff34e60711b40562b38e8eb880b45cc6c8))
* **tasks:** register the two new advisory reports as named tasks ([033732c](https://github.com/event4u-app/agent-config/commit/033732c56499f081ae614eed37a3fe43657bc01f))
* **generated:** reproject the council-availability rule after the probe rewrite ([9bac533](https://github.com/event4u-app/agent-config/commit/9bac533be54adad9f1d5bbe4b3965cbcf3c010eb))
* **generated:** counts, index, catalog, router, proof for the self-repair rule ([83e81ae](https://github.com/event4u-app/agent-config/commit/83e81ae48dc463d17f82edd89edd821f8b7fdb35))
* **generated:** router_rules count 108 -> 109 for the new routed rule ([bf00135](https://github.com/event4u-app/agent-config/commit/bf00135202a3ac84814a0324947dbecc57172bfd))
* **generated:** regenerate index, catalog, and router for the new rule ([188c434](https://github.com/event4u-app/agent-config/commit/188c4346428c7754b434bc86c4c3dfa8c8b203ee))
* **budgets:** record the 88 to 89 CLI verb move for council:status ([fa7404b](https://github.com/event4u-app/agent-config/commit/fa7404bf9483d241cd5d245cbc872cfd5406d851))

Tests: 12141 (+391 since 9.27.0)

## [9.27.0](https://github.com/event4u-app/agent-config/compare/9.26.0...9.27.0) (2026-08-07)

### Release highlights

<!-- Curated head: fill before merge, keep it under 10 lines, and leave `_none_` where it is genuinely the answer. The generated log below is unchanged. -->
- **Behaviour changes:** Rule frontmatter gains an `obligation_frequency` field — 105 rules declare it with a file:line citation, the nine kernel rules report `unclassified` because the kernel-prefix hash and write guard forbid the edit, and the enforcement-coverage join now runs per hook-capable platform (dd89970); the obligation citations themselves shrink from quoted sentences to line pointers across the always-loaded surface after the +5% cost cliff fired (e82cc1f). The session-canary carrier is re-bound into two hook slots (full contract at `session_start`, a one-line beat per `user_prompt_submit`) and three rules scope their enforcement claims to the hosts whose slots can actually carry them (b3b5ee7); a second conformance audit is recorded in the rule — the carrier fires, compliance did not follow (24 of 29 task starts dropped the greeting) — and ui-audit-gate plus design-review-after-ui-write now declare `enforced_by: none` in frontmatter where their prose already said it (6b06006).
- **Default changes + migration:** An absent-vs-default audit found nine settings keys where an absent value does not resolve to the template default — sharpest is `quality.local_auto_run`, where omitting the key silently disarms the gate the template arms; all nine are carved out as documented divergences read from the live template at emit time rather than fixed at their readers, so no migration is required and no default value changes (6d1af3a).
- **Security and correctness:** _none_
- **Honest nulls:** The orchestration dispatch backfill (39 metric-bearing dispatches across 103 sessions) resolves to an honest null — every family verdict flips with the choice of baseline, both gate inputs are unmeasurable without a counterfactual, and telemetry capture ran at 0.27% (8e6765b); the pre-registered sibling claim orchestration-observed-dispatch-cost was resolved to the same null the day it was registered (6208186). The parallel-session-coordination archive records a further null: all 71 TTL records came from a single host, so no per-host TTL table could be derived and none was invented (f60bd6a).
- **Known limitations:** _none_

### Features

* **orchestration:** backfill telemetry from the host transcript corpus ([ed28a6d](https://github.com/event4u-app/agent-config/commit/ed28a6d8aa62b3c5fc30525e5bd356c6e3c83945))
* **conformance:** record pin distance and compaction per language violation ([b103537](https://github.com/event4u-app/agent-config/commit/b103537c69020d1bb81698a389d1dc9d97e0a145))
* **gates:** assert rule-projection completeness and freshness ([e42ea1d](https://github.com/event4u-app/agent-config/commit/e42ea1d7fdbbaf0d87ff37d4efd40ff3d96d97f8))
* **roadmap-next:** close the claim window, and say who carries the check ([9617664](https://github.com/event4u-app/agent-config/commit/9617664291d51176dceafbdf0ac68608dcffd0d7))
* **cli:** sessions:list and sessions:claim ([44d5eba](https://github.com/event4u-app/agent-config/commit/44d5eba9f88e2f52c534aa1f8f350ba1a89c4eeb))
* **hooks:** bind the register, and keep stop out of deregistration ([736f4e1](https://github.com/event4u-app/agent-config/commit/736f4e1255641a8997b2bd8f9753ac4232ccbcda))
* **sessions:** the shared per-session register, with its measured TTL ([6ab61fd](https://github.com/event4u-app/agent-config/commit/6ab61fda9d7e7faa22fc4d33325c02c05363b6ef))
* **rules:** declare how often each obligation comes due, and join it ([dd89970](https://github.com/event4u-app/agent-config/commit/dd89970afb7cc82846caf9c6e0029ddc73176874))
* **coverage:** the lattice that says whether a carrier fires often enough ([53d501e](https://github.com/event4u-app/agent-config/commit/53d501e9860b0f72d3d78df8f6a7cfc0eff16245))
* **settings:** a fresh install writes 35 lines, not 1,360 ([8504ca8](https://github.com/event4u-app/agent-config/commit/8504ca880d8c5bc5c921add50f7a7fc0b39ee03d))
* **settings:** audit absent-vs-default, and carve out the nine keys that diverge ([6d1af3a](https://github.com/event4u-app/agent-config/commit/6d1af3aba30d5378510fc2659532f9ad16be7b37))

### Bug Fixes

* **orchestration:** drop the pairing key from the emitted line ([d10004a](https://github.com/event4u-app/agent-config/commit/d10004a9e7d2efd1dab9597c1cd364f4d176d38c))
* **orchestration:** drop free-text fields from backfilled lines ([bdf976f](https://github.com/event4u-app/agent-config/commit/bdf976f1223a2e601a3eb613d9c94f933a56837e))
* **hooks:** the language pin no longer treats a synthetic turn as a prompt ([439c20e](https://github.com/event4u-app/agent-config/commit/439c20e00721ed9a238f69478fbd807a58d5fe23))
* **hooks:** two git guards stop refusing read-only commands ([17c5fa5](https://github.com/event4u-app/agent-config/commit/17c5fa57441a095276bfe8e8b46a57152f1a1353))
* **cli:** list the sessions verbs in usage() too ([d4f4429](https://github.com/event4u-app/agent-config/commit/d4f44290f2c8f18b27cfbfac35a5002b88a9e8e2))
* **release:** stop treating "no checks reported" as a pass when checks ARE required ([1af0f03](https://github.com/event4u-app/agent-config/commit/1af0f0316f39191603d5031145153e209e1778ad))
* **rules:** pay for the citation with a line number, not a quoted sentence ([e82cc1f](https://github.com/event4u-app/agent-config/commit/e82cc1f4d032578b1e5749ceb6756d6a82beeaf7))
* **canary:** bind the carrier to a slot that reaches a task boundary ([b3b5ee7](https://github.com/event4u-app/agent-config/commit/b3b5ee75e95ac7be3908529f3d52c5d47432d6bb))
* **settings-surface:** treat a free-form map as a leaf, not an empty group ([7a68cb7](https://github.com/event4u-app/agent-config/commit/7a68cb785ccff4bf190c01b5c52927f1fd94fbeb))
* **gates:** a zero-tool checkout is an absent surface, not a dead scan scope ([2828561](https://github.com/event4u-app/agent-config/commit/28285610d22c340460b02be675047efdbe24c8ac))

### Documentation

* **roadmap:** conformance round 6, starting with the regress round 5 shipped ([353cac1](https://github.com/event4u-app/agent-config/commit/353cac1d9e71d38eaa97a891fb037f47e7299e1a))
* **proof:** regenerate the derived page after the CLAIMS entry ([6660a23](https://github.com/event4u-app/agent-config/commit/6660a231e08d41aea39e597a85843d0d0cda1e9d))
* **roadmap:** archive road-to-orchestrator-first-execution, stopped at Phase 2 ([b24a991](https://github.com/event4u-app/agent-config/commit/b24a991d603fc9beea0e26a1252ef766059298c8))
* **orchestration:** record the observed-dispatch measurement and its verdict ([8e6765b](https://github.com/event4u-app/agent-config/commit/8e6765bc7fb05f6602abc998d231b270721accdf))
* **claims:** pre-register and resolve orchestration-observed-dispatch-cost ([6208186](https://github.com/event4u-app/agent-config/commit/6208186fe6393f5a98c6b9d90ae2138959724590))
* **proof:** re-render after the two enforced_by declarations ([7e36dbb](https://github.com/event4u-app/agent-config/commit/7e36dbb009a06d51cbcbb0d92167954e9adb64d3))
* **roadmap:** give conformance round 5 its Risk Register ([7e837bb](https://github.com/event4u-app/agent-config/commit/7e837bb8c85d78631effdf8e18f96762e779dab3))
* **roadmap:** conformance round 5, the first post-fix measurement ([95d4db9](https://github.com/event4u-app/agent-config/commit/95d4db9d9c971778f583c7081c7277d1f4ba661e))
* **rules:** replace two unmeasured enforcement claims with the measurement ([6b06006](https://github.com/event4u-app/agent-config/commit/6b0600608a33a56f35e7ec76ab6c5ba60711249f))
* **roadmap:** archive parallel-session-coordination with its measurements ([f60bd6a](https://github.com/event4u-app/agent-config/commit/f60bd6a3fba74e669a6361724070ce9d6d037b7b))
* **roadmap:** give the parallel-session plan its Risk Register ([f13ebba](https://github.com/event4u-app/agent-config/commit/f13ebba5a4f7856b5be0acdd19244e86adaca126))
* **roadmap:** add the obligation-carrier audit and the parallel-session register ([20391f6](https://github.com/event4u-app/agent-config/commit/20391f62f2c6c3f294467481956b1b2d2b0f9255))
* **roadmap:** close Phase 3, resolve the blocker, and say why 4.2 stays open ([2ba1e78](https://github.com/event4u-app/agent-config/commit/2ba1e7894ded9571f38dbe12de1680b4f1db57fd))
* **settings:** generate the settings reference the shrinking file no longer carries ([9e34b23](https://github.com/event4u-app/agent-config/commit/9e34b238523187f4ae7c9826c8bef6e4b89efe8d))

### Refactoring

* **git:** extract the common-dir resolution so it has one answer ([1f04331](https://github.com/event4u-app/agent-config/commit/1f04331dd2f81c64a5217f843ddbcf49f2d9be9b))

### Build

* **install:** refresh the installer bundle for the surface-flattener fix ([cc4ae5e](https://github.com/event4u-app/agent-config/commit/cc4ae5e5e20b51d681686258b0cc6411d0218c05))

### Chores

* **budgets:** move cli_help_command_count 86 to 88 for the sessions verbs ([c8ba2c3](https://github.com/event4u-app/agent-config/commit/c8ba2c34edd5bcda97d2c5cab85a3dcf2055f8de))
* **sync:** re-project session-canary after the frequency-override note ([d68c02f](https://github.com/event4u-app/agent-config/commit/d68c02f4e18233cf1c51146cc56dcc01f8d9cc53))

Tests: 11750 (+107 since 9.26.0)

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
