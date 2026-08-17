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

## [13.0.0](https://github.com/event4u-app/agent-config/compare/12.1.0...13.0.0) (2026-08-17)

### Release highlights

<!-- Curated head: fill before merge, keep it under 10 lines, and leave `_none_` where it is genuinely the answer. The generated log below is unchanged. -->
- **Behaviour changes:** _auto-derived, rewrite before merge:_ rule/schema diffs, breaking commits or removed public surface in 395912e, 357fa52, f224177, 43d4e1b, 0cb9e5d, 3573525 +2 more.
- **Default changes + migration:** _none_
- **Security and correctness:** _auto-derived, rewrite before merge:_ security-scoped commits or fixes to executable surface in 184a3f1, 64e48f1, 498f174, e3ce6a5, 532c29b, d36c665 +15 more.
- **Honest nulls:** _auto-derived, rewrite before merge:_ commits recording a null, waived or falsified result in e8e6447.
- **Known limitations:** _none_

### BREAKING CHANGES

* **council:** archive the budget-routing decision layer and permit lifecycle ([43d4e1b](https://github.com/event4u-app/agent-config/commit/43d4e1b2a83c25611e8d90c3ed28b5de13f09e29))

### Features

* **bench:** report T5 as its own verdict in the stats layer ([538708f](https://github.com/event4u-app/agent-config/commit/538708fd063a33cc8c5fb05943335b1637a97966))
* **bench:** score T5 search adherence at the pre-registered k=2 ([5d5575e](https://github.com/event4u-app/agent-config/commit/5d5575e49c91ff5eb3bdf01e0c90542f496a9372))
* **bench:** preserve each trial's transcript beside its clone ([f487622](https://github.com/event4u-app/agent-config/commit/f487622a06ad7c2237cd2060d0135c967be65a63))
* **bench:** score T4 offline against the preserved workspaces ([ee770eb](https://github.com/event4u-app/agent-config/commit/ee770ebc129c2464a8d3f585b05131b1b1a103d5))
* **bench:** add the T4 safety tier to the v2 corpus ([6bb7561](https://github.com/event4u-app/agent-config/commit/6bb7561436ac569712c5cebfba73099998cbb37f))
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

* **release:** keep release.ts off the source-size ratchet ([184a3f1](https://github.com/event4u-app/agent-config/commit/184a3f107ba24467eaf363bbfac7d02fd80152ef))
* **release:** recognise the stale-lease push rejection as a moved ref ([64e48f1](https://github.com/event4u-app/agent-config/commit/64e48f1894a6dcbbc8292207215e0145bf9bd9d5))
* **bench:** drop the own-orphans the extraction left in the runner ([498f174](https://github.com/event4u-app/agent-config/commit/498f174359e18e59f9ea98cd329ccaca329a9fbf))
* **roadmaps:** resolve the dangling risk anchor in road-to-context-fidelity ([19b653a](https://github.com/event4u-app/agent-config/commit/19b653a016f683f733ff23e4f9a2122a15dff08f))
* **bench:** pay back the source-size ratchet by extraction ([e3ce6a5](https://github.com/event4u-app/agent-config/commit/e3ce6a5539c0e47fb439e5c43a14dca40b47b923))
* **bench:** repair the nine findings the completion review raised ([532c29b](https://github.com/event4u-app/agent-config/commit/532c29b722a6b80da06c338d033100ef9894b327))
* **schemas:** the requires_confirmation descriptions carried the same claim ([395912e](https://github.com/event4u-app/agent-config/commit/395912ed6c8ec313c3a3d8c4547768f7d711d938))
* **rules:** stop certifying two hosts that never deny, and name four gap hosts ([357fa52](https://github.com/event4u-app/agent-config/commit/357fa52c740f93a26022a352dfb6a45bdac9d583))
* **contracts:** model the fourth host state — bound, and ignored ([2a30650](https://github.com/event4u-app/agent-config/commit/2a3065070281fcb3185939b182f41423a4adeb46))
* **hooks:** correct the same claim in the ui-route-nudge header ([d36c665](https://github.com/event4u-app/agent-config/commit/d36c665b5b5d6918d0200710d3df489b10084782))
* **rules:** correct the pre_tool_use coverage reason, not the count ([f224177](https://github.com/event4u-app/agent-config/commit/f224177f523b15585149fbe3524fa5ac915bebbb))
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

* **evidence:** re-bind the review after the own-orphan cleanup ([575258b](https://github.com/event4u-app/agent-config/commit/575258b6867db4670f7bbe0c0b50bb4dee664b7a))
* **roadmaps:** add road-to-release-review-p0 and regenerate the dashboard ([7ac1bfb](https://github.com/event4u-app/agent-config/commit/7ac1bfba699b53f29e151570789f29801c6b20c1))
* **roadmaps:** add road-to-metric-loop-and-review-integrity ([2bec54e](https://github.com/event4u-app/agent-config/commit/2bec54e62ddc5f4dd14d63bb749f2e1a3309d473))
* **roadmaps:** add road-to-org-telemetry ([5a8f5fd](https://github.com/event4u-app/agent-config/commit/5a8f5fdd838fb0b5c83b24fedb0b6d8f8657da71))
* **roadmaps:** add road-to-context-fidelity ([ca373a6](https://github.com/event4u-app/agent-config/commit/ca373a667f972aace506597d75667f66dba0ab70))
* **roadmaps:** add road-to-user-out-of-the-loop ([53166c7](https://github.com/event4u-app/agent-config/commit/53166c720e1c0e0c31e54a5741ac4a742f34abd6))
* **evidence:** re-bind the review after the CI repair ([71457e0](https://github.com/event4u-app/agent-config/commit/71457e0bb1fcb9ebf5eed1783f3ee87c2dde1d05))
* **evidence:** close the nine findings and re-bind the review scope ([f54a02f](https://github.com/event4u-app/agent-config/commit/f54a02f4c71aae43a24815d021e30a81ed890e71))
* **evidence:** record the R2 completion review before fixing anything ([02e7b69](https://github.com/event4u-app/agent-config/commit/02e7b697c2c3240fe1944e5625fd3bbf28f0fd4c))
* **bench:** discharge PREREG precondition 3 and close step 3.4 ([06b8e2d](https://github.com/event4u-app/agent-config/commit/06b8e2d9e68444a7f66d1218664dcaa30a4240b0))
* **evidence:** re-bind the findings after the six fixes ([81d611d](https://github.com/event4u-app/agent-config/commit/81d611d2716a0947aa74978d42300591e7410939))
* **evidence:** record the R2 findings before the fixes ([18e62fa](https://github.com/event4u-app/agent-config/commit/18e62fa49e9aa2b53f1da2c8892d7d5eddf54f78))
* **contracts:** tabulate which hosts carry pre_tool_use ([36211a9](https://github.com/event4u-app/agent-config/commit/36211a9652cabff813fc9851080a0497c14fbc7d))
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

* **roadmap:** regenerate dashboard after merging main ([308faf8](https://github.com/event4u-app/agent-config/commit/308faf8e960c2f9a94a345809c12e2e1698a3902))
* **evaluator:** record the 19 -> 20 mcp_public_tool_count move ([5a8a77f](https://github.com/event4u-app/agent-config/commit/5a8a77fca840e5dc4d5c35abcf9c3cb27e78b684))
* **roadmap:** regenerate the dashboard for the ledger-truth archival ([daa3d0d](https://github.com/event4u-app/agent-config/commit/daa3d0d0b633d7aba27126b7512aa9f7be520790))
* **roadmap:** regenerate the dashboard after the main merge ([8b40272](https://github.com/event4u-app/agent-config/commit/8b402725818fed47424b788de20ef9de516233a5))
* **roadmap:** regenerate the dashboard after merging main ([9d2ff18](https://github.com/event4u-app/agent-config/commit/9d2ff180612fcfec1531fe6ed7a118b0c1dbde63))
* **index:** regenerate the artefact index for the new guideline ([ce19de0](https://github.com/event4u-app/agent-config/commit/ce19de0baf25ed9982f9cdce97dc2f92a4d104fd))
* **provenance:** record the prompt-optimizer non-entry and ratchet the source ([be9b9e2](https://github.com/event4u-app/agent-config/commit/be9b9e2f68394a2cbcac2101049f0470d5a39d02))
* **reports:** refresh the originality audit for the grown corpus ([43054b8](https://github.com/event4u-app/agent-config/commit/43054b8e663d771e29dd102a41bbc639dfe194a7))
* **roadmaps:** archive the completed scheduled-deprecation roadmap ([f74cabe](https://github.com/event4u-app/agent-config/commit/f74cabe009a14e7410c70cd06a481c42be304808))
* **docs:** routed-rule count 110 -> 111 for missing-skill-recovery ([6b8a9a6](https://github.com/event4u-app/agent-config/commit/6b8a9a6726a3234a20a435bf71be9ebb942ffe70))
* **roadmaps:** archive two completed roadmaps ([5cbe55d](https://github.com/event4u-app/agent-config/commit/5cbe55d6d78d340d25752505784e945aedee15df))

Tests: 14173 (+181 since 12.1.0)

## [12.1.0](https://github.com/event4u-app/agent-config/compare/12.0.0...12.1.0) (2026-08-16)

### Release highlights

<!-- Curated head: fill before merge, keep it under 10 lines, and leave `_none_` where it is genuinely the answer. The generated log below is unchanged. -->
- **Behaviour changes:** _auto-derived, rewrite before merge:_ rule/schema diffs, breaking commits or removed public surface in 3b06e61, 5861eab, 78c3a31.
- **Default changes + migration:** _auto-derived, rewrite before merge:_ commits naming a default, migration or migrate in ad1fdd5, 1dd2211.
- **Security and correctness:** _auto-derived, rewrite before merge:_ security-scoped commits or fixes to executable surface in f5873b2, a05cd1c, f92bc37, 33c7c20, cdae71b, 5efb150 +8 more.
- **Honest nulls:** _auto-derived, rewrite before merge:_ commits recording a null, waived or falsified result in 7e2ee70, 03732f5, 87b85c4, c94b9ee, 5ba91ea.
- **Known limitations:** _none_

### Features

* **telemetry:** make an unmapped band distinguishable from a silent host ([6ebce93](https://github.com/event4u-app/agent-config/commit/6ebce93068075f7ed7a087ede2ad439bb288791c))
* **tiers:** reopen ADR-035 and add the frontier band ([78c3a31](https://github.com/event4u-app/agent-config/commit/78c3a311efdc53425a396029bb2477c1cac26cca))
* **gates:** probe blockers for decidability, on a ratchet ([024ab06](https://github.com/event4u-app/agent-config/commit/024ab0664df6c15f39c54c16f5f79dde184d1ad6))
* **gates:** lead with the recommendation, and say when there is none ([d7d6dba](https://github.com/event4u-app/agent-config/commit/d7d6dbace4b3c874f89cc2b60363b068ea908eb8))
* **release:** refuse a major cut with an overdue scheduled deprecation ([b09374a](https://github.com/event4u-app/agent-config/commit/b09374afc6d83189abd79d11e28976caa059e438))
* **gates:** check scheduled deprecations by arithmetic, not by memory ([dfc8088](https://github.com/event4u-app/agent-config/commit/dfc8088698c25a26ad5729a291cfbe2c0e153055))
* **janitor:** collect session-scoped state, and print the zero ([eaba741](https://github.com/event4u-app/agent-config/commit/eaba741def2af781e8fd93a13c56616e09efd66e))
* **context:** read state-destroyed and state-captured together ([53c9d3b](https://github.com/event4u-app/agent-config/commit/53c9d3b739f8bf71c9a8833be63e529f94f03c08))
* **context:** meter tool results, and capture before compaction ([bc20d3e](https://github.com/event4u-app/agent-config/commit/bc20d3e6cce59e91d75204aedc106fdde95076a4))
* **evidence:** probe which review-binding hash segment actually moves ([4183ac0](https://github.com/event4u-app/agent-config/commit/4183ac017b64481c86035020f7dabaea5933566b))
* **release-head:** derive the correctness half, and recorded nulls beyond the marker ([5ba91ea](https://github.com/event4u-app/agent-config/commit/5ba91ea4f9c227fe0b82e95f8eebb452cc78bc16))
* **install:** ask an existing install about scoped projection, on measured evidence ([fc8046a](https://github.com/event4u-app/agent-config/commit/fc8046a3e79ac6c111cde763aaf90f0a2bb9c89d))
* **cli:** workspace:doctor — read-only identity and worktree pressure ([98c24cb](https://github.com/event4u-app/agent-config/commit/98c24cbed5cd42b75abf4a37d4ee08936305d698))
* **workspace:** one resolver for the five workspace-identity questions ([c8a5ec3](https://github.com/event4u-app/agent-config/commit/c8a5ec3c4ad58a4d1456f6c1b1fd6166606df5a4))
* **install:** warn when a deploy crosses a MEASURED host catalogue limit ([794698b](https://github.com/event4u-app/agent-config/commit/794698beb49c35d65ee1361c668f9de264e17eb3))
* **catalogue:** read codex truncation off the host instead of a self-report ([dc5bf40](https://github.com/event4u-app/agent-config/commit/dc5bf40647fd83525b43b675cce63180c2a255e2))
* **install:** warn when a host drops most of the catalogue it was handed ([358304c](https://github.com/event4u-app/agent-config/commit/358304c73bef17573e4bb7ff6915bf1dd14f99f2))
* **catalogue:** read codex truncation off the host event, per host ([7514d64](https://github.com/event4u-app/agent-config/commit/7514d649d566d1e40f8d5f8ae9604370ef575906))

### Bug Fixes

* **rules:** revert the scoping pass — the routing matrix refuted all four ([3b06e61](https://github.com/event4u-app/agent-config/commit/3b06e61f1adb960168ca5481d4c6227c1ccd9c43))
* **rules:** scope the four rules that can be, and record why fifteen cannot ([5861eab](https://github.com/event4u-app/agent-config/commit/5861eabd267b63c8547a498cc894f345c9b58bcb))
* **review:** re-derive the prompt_hash after the round-3 re-bind ([6fa3037](https://github.com/event4u-app/agent-config/commit/6fa30379de34427d340b50c8a4bdea1dd885ba71))
* close round 3's low findings, and correct their dispositions ([f5873b2](https://github.com/event4u-app/agent-config/commit/f5873b283cd6beb59528f346a552a60846f9ae9d))
* **gates:** stop reporting green over zero comparisons ([a05cd1c](https://github.com/event4u-app/agent-config/commit/a05cd1cd223c60de70c980d07ecbe8bb154217e5))
* **gates:** read a withdrawn commitment as a tracked state ([a73a563](https://github.com/event4u-app/agent-config/commit/a73a563b83e635eb467d20a1b20a9fdc8fcd09ad))
* **gates:** close review round 2 — 12 findings ([f92bc37](https://github.com/event4u-app/agent-config/commit/f92bc375fb948fe92f1fa50691d6eb0605236128))
* **rules:** stop scoping from silently deleting a rule's keyword reach ([33c7c20](https://github.com/event4u-app/agent-config/commit/33c7c201211d39ec68f3333773a6a9957ab94b20))
* **evidence:** correct the paths-coverage headline, and the finding under it ([21651b5](https://github.com/event4u-app/agent-config/commit/21651b508742dff1ea1c935533e5a00ef7181b00))
* **gates:** measure the cut against the target, and close the review's 11 findings ([cdae71b](https://github.com/event4u-app/agent-config/commit/cdae71b306da55b6dbb1aa6122c5f228eee98a6a))
* **roadmap-writing:** keep the blocker guidance inside the 400-line skill cap ([4e041c1](https://github.com/event4u-app/agent-config/commit/4e041c1db8ded58bc52a267c0c7be5288b4402a8))
* **review:** re-bind every manifest segment, not just the scope ([6f62fa3](https://github.com/event4u-app/agent-config/commit/6f62fa3165c0284047a243f646d8c05e9422ad01))
* **evidence:** address all nine R2 findings, and the ratio tightens ([5efb150](https://github.com/event4u-app/agent-config/commit/5efb15097a8567ce2666b06669dbcbdb45e90bfb))
* **release-head:** close the four code findings, one of them a true positive I had narrowed away ([c94b9ee](https://github.com/event4u-app/agent-config/commit/c94b9eebd386296f3f3dbfc65f598d71354b1196))
* **workspace:** repair the review's three high findings and six others ([6c3f220](https://github.com/event4u-app/agent-config/commit/6c3f220a17ae68cfe96ff0bd269a962b1a139b7b))
* **evidence:** anonymise a named third-party service in the harvest register ([9f895bd](https://github.com/event4u-app/agent-config/commit/9f895bde48c4d9907d0a1df971f4d41e7a1cd3e2))
* **review:** close the twelve completion-review findings ([2bf0c47](https://github.com/event4u-app/agent-config/commit/2bf0c479582fae419a6bc634f6380c3aaefa56b8))
* **ai-team:** stop pinning a model the codex transport refuses ([272dcd0](https://github.com/event4u-app/agent-config/commit/272dcd001bcf9f3dea3db1a9c26ff4ab0f3a35d0))
* **catalogue:** drop unused imports from the split library and fix the test helper ([81428a0](https://github.com/event4u-app/agent-config/commit/81428a07d7140869d9c01ac9e4f9d957f728deeb))
* **council:** the DEGRADED marker shipped on stdout and not on the artefact ([a4af80c](https://github.com/event4u-app/agent-config/commit/a4af80ccbdd21b0620a9536eae92d5ffacb4bd43))
* **council:** the openai seat was dead on every subscription account ([7ec3246](https://github.com/event4u-app/agent-config/commit/7ec32467645617c33eb5c010ae5bde580478be72))
* **council:** repair the openai seat, dead for three independent reasons ([d1f8f3b](https://github.com/event4u-app/agent-config/commit/d1f8f3b7e3b9c4d66113761f8d695251d735ea3a))

### Documentation

* **review:** re-bind round 3 to the final scope ([ddbecf1](https://github.com/event4u-app/agent-config/commit/ddbecf18679a8a6c3d296de7e89ebf685bba671a))
* **review:** re-bind round 2 to the fixed scope ([005ed2b](https://github.com/event4u-app/agent-config/commit/005ed2b9504908f739602bb46140e6d1d2b8506c))
* **roadmaps:** resolve the code-graph and trigger-eval blockers ([7e2ee70](https://github.com/event4u-app/agent-config/commit/7e2ee701dafd9836209ed125ccdba505d344a31d))
* **roadmap:** make the code-graph blocker decidable, and lower the ratchet ([9a1cc8a](https://github.com/event4u-app/agent-config/commit/9a1cc8a78a1a97158d833b44755c4ccb89a49e1d))
* **roadmaps:** make the three remaining blockers decidable ([2fb8a38](https://github.com/event4u-app/agent-config/commit/2fb8a38a6505579711f2ec782f5d7a3dfe589e53))
* **review:** re-bind the completion review to the fixed scope ([1a884c7](https://github.com/event4u-app/agent-config/commit/1a884c7dde2f2b531d7cce664c0f5c57b19988a7))
* **review:** R2 completion review for feat-scheduled-deprecation ([ee6db3a](https://github.com/event4u-app/agent-config/commit/ee6db3a716605f7c221289b726d36ecff327eca1))
* **roadmap:** close release-head-truth on the two maintainer decisions ([0c11537](https://github.com/event4u-app/agent-config/commit/0c1153797673097f2d89333741a37a56cd6bac30))
* **roadmaps:** a blocker must be decidable, not merely described ([fdbc469](https://github.com/event4u-app/agent-config/commit/fdbc469667954c6183289425ffc86e1350a26569))
* **migration:** give the two loose surfaces a tracked state ([ad1fdd5](https://github.com/event4u-app/agent-config/commit/ad1fdd561e84b171106574a79352d8be61c38aa3))
* **review:** re-bind after the main merge moved the base ([e11f113](https://github.com/event4u-app/agent-config/commit/e11f1137effad9149bdf12555d65cb8cefc7edbd))
* **review:** re-bind to the post-finding scope ([49b1b7c](https://github.com/event4u-app/agent-config/commit/49b1b7c95ce2ffca4a59294fe16ce1f8938d1c95))
* **evidence:** re-check the scoped-projection claim live after merging main ([67bd479](https://github.com/event4u-app/agent-config/commit/67bd4797ccf07881a7d6c1c5c95edd72ea7b472e))
* **evidence:** the window null, the paths census, and a dated payload route ([82daf5e](https://github.com/event4u-app/agent-config/commit/82daf5e5d8b3afaee29991251d50622c21e610fc))
* **roadmaps:** five roadmaps from the 2026-08-d inbox harvest ([3b8f6ee](https://github.com/event4u-app/agent-config/commit/3b8f6ee3a3ca60fac50c2c924c6ff601c88dc347))
* **review:** re-bind the R2 artefact to the fixed scope, all eleven dispositions terminal ([1ab43c8](https://github.com/event4u-app/agent-config/commit/1ab43c8ac1a1b09c1b6b040132ac5d8cc7afe035))
* **review:** re-bind the R2 artefact after the fix pass, all nine terminal ([6c03182](https://github.com/event4u-app/agent-config/commit/6c03182ac98223f12ad7c8f96712d43bfe68e9f3))
* **roadmap:** register the AC 3 decision as a blocker so the gates surface it ([acbe275](https://github.com/event4u-app/agent-config/commit/acbe275c5f0dbe1172d7b2a162fbcf0b526fdd03))
* **contracts:** say that falsifier 2 has fired, instead of re-affirming the lock over it ([03732f5](https://github.com/event4u-app/agent-config/commit/03732f5dafacc9326b9d2a5db8da7932144f4063))
* **evidence:** state the three scopes, fix the honest-null split, drop the line citations ([87b85c4](https://github.com/event4u-app/agent-config/commit/87b85c499e4e50468a4f609df85d8a4a94407853))
* **review:** R2 completion review of the drift probe - 9 findings ([9d9ece9](https://github.com/event4u-app/agent-config/commit/9d9ece9efd3093e129b8547e88063e6b30d6d7cf))
* **review:** record the R2 findings before fixing any of them ([9ee99ce](https://github.com/event4u-app/agent-config/commit/9ee99ce8e0d6cc6acde3d39ed2f8b11799359ab3))
* **evidence:** Phase 2 stops - code causes 79 percent of re-binds ([e3b035c](https://github.com/event4u-app/agent-config/commit/e3b035ce8b50918e857a88993c8710f9488cbb23))
* **roadmap:** close release-head-truth Phases 1 to 3, leave AC 3 open on its measurement ([6f5d0f4](https://github.com/event4u-app/agent-config/commit/6f5d0f4aaeb85732c28ac29a70a260b852e56baf))
* **contracts:** the derivation is the load-bearing half of the retro-curation lock ([ebc21d0](https://github.com/event4u-app/agent-config/commit/ebc21d08062fe4fa874153cd07fbca06c92a7377))
* **evidence:** measure the release-head derivation before widening it ([a389919](https://github.com/event4u-app/agent-config/commit/a3899191abcace5049de6c2209eb85eb7692db64))
* **review:** re-bind after the origin/main merge, with the measurement that justifies it ([04a92fc](https://github.com/event4u-app/agent-config/commit/04a92fca8218083123b650a941a12c3effc388c5))
* **review:** re-bind the completion review to the post-fix scope ([2c99f94](https://github.com/event4u-app/agent-config/commit/2c99f94213482459eb4c5590319df9a81a6d0eb5))
* **review:** R2 completion review — 13 findings, three high ([371e891](https://github.com/event4u-app/agent-config/commit/371e891274116dd249d6179848f1559d5f1e9d47))
* **roadmap:** archive road-to-skill-catalogue-budget ([1056718](https://github.com/event4u-app/agent-config/commit/1056718c1527d89d940e53dd32655a93d4ada62a))
* **roadmap:** close and archive workspace-identity, blocker resolved to report-only ([1141051](https://github.com/event4u-app/agent-config/commit/1141051719d9e43fa102394954100f4fdd7afbd9))
* **evidence:** the workspace-identity census, with its three refusals ([530db41](https://github.com/event4u-app/agent-config/commit/530db418f33cc79cfadcf24e0c67ad313199773f))
* **evidence:** re-bind the completion-review skip after the anonymisation fix ([591825d](https://github.com/event4u-app/agent-config/commit/591825da3615dde236836a0cfe761e7b5c30aa5e))
* **evidence:** declare the docs-only skip for the 2026-08-c harvest ([6b97fe3](https://github.com/event4u-app/agent-config/commit/6b97fe324427e254fcb372208e7cf5644a7b6496))
* **roadmaps:** four roadmaps from the 2026-08-c inbox harvest ([9fd881d](https://github.com/event4u-app/agent-config/commit/9fd881dfb41f183f40c2b644072f940ccd5eb6ce))
* **evidence:** record the 2026-08-c inbox triage and its not-adopted register ([5b0fb6f](https://github.com/event4u-app/agent-config/commit/5b0fb6f02cebee3f65fe5210573bab22bd837c98))
* **review:** finding 11 is accepted-risk, not an invented status ([1fcf44a](https://github.com/event4u-app/agent-config/commit/1fcf44a11cc96d61233f20b6f2b63fb85a4f5c9e))
* **review:** re-bind the findings artefact to the post-fix scope ([385265f](https://github.com/event4u-app/agent-config/commit/385265f1a5e0a4a4678d2e371993ef281ebd1fb7))
* **review:** record the completion-review findings before any fix ([20c83dd](https://github.com/event4u-app/agent-config/commit/20c83dd4388b855c44d54ca577f601b382018626))
* **roadmap:** re-review the risk register against what executing it found ([66b83ba](https://github.com/event4u-app/agent-config/commit/66b83ba40c27d94b8cb26a1337155b0d42d6caa6))
* **evidence:** two hosts in the corpus, and the double-count reading ruled out ([cfb9670](https://github.com/event4u-app/agent-config/commit/cfb967066a8f1d894a1b861774c694e35f012e84))
* **roadmap:** re-review the skill-catalogue-budget Risk Register ([1abb479](https://github.com/event4u-app/agent-config/commit/1abb479ed874b7e5791bb4f3529582cae00cc18e))
* **roadmap:** close skill-catalogue-budget Phases 1-3 with the measured findings ([2723dea](https://github.com/event4u-app/agent-config/commit/2723deadb01dec6e8fce1f69e5550c2941a5337b))

### Refactoring

* **scripts:** migrate seven identity call sites onto the shared resolver ([1dd2211](https://github.com/event4u-app/agent-config/commit/1dd221176a9eae251846d8874f884ba57fdc4bd6))

### Tests

* **rules:** cover the mixed-plus-placeholder rule instead of orphaning its fixture ([121d26f](https://github.com/event4u-app/agent-config/commit/121d26ff1dd0ba039a6a0fa4073ec7b10d94acfd))

### Chores

* **build:** rebuild the install bundle for the frontier tier enum ([7daaa62](https://github.com/event4u-app/agent-config/commit/7daaa62cbf84d338f3e8e29013c4497a777b5f7a))
* **roadmap:** regenerate the dashboard after the 2026-08-d harvest ([f0c79e2](https://github.com/event4u-app/agent-config/commit/f0c79e2f0e5f565b8a299584a683ecd2e65a16bf))
* **roadmaps:** regenerate the dashboard after merging origin/main ([a75f60f](https://github.com/event4u-app/agent-config/commit/a75f60f96f76ea4e0061ede2c91518668bc12c13))
* **reports:** refresh the adversarial secret-scanner stamp ([af2dcff](https://github.com/event4u-app/agent-config/commit/af2dcff6a1941d0e731039a1df767db0c65c06d0))
* **build:** rebuild the install bundle for the extracted catalogue library ([8bce204](https://github.com/event4u-app/agent-config/commit/8bce20467987e4345cabbdca4b504f2e386fae61))
* **reports:** regenerate generated reports the drift gate flagged ([6a8f7ff](https://github.com/event4u-app/agent-config/commit/6a8f7ffad009d2686dd8ec85b65397f11f85edeb))

Tests: 13992 (+148 since 12.0.0)

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
