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

> **Retro-curation disposition, 2026-09-01** — roadmap
> `road-to-publication-integrity-hard-fail`, blocker `b-retro-curation-scope`,
> option (c). The `### Release highlights` heads of 14.9.0 through 14.13.0 were
> written by the release generator and published without the editorial pass they
> ask for. Two things were repaired: the generator's own authoring instruction,
> which was never release content, is deleted from this file, and the writer no
> longer emits it. The generator-derived head lines below are **preserved as
> published** and deliberately not paraphrased — rewriting a derived claim is
> editorial judgement two prior councils reserved, and a paraphrase of the
> generator's own reason would be truthfully documented uselessness.
> [`docs/archive/`](docs/archive/) is left untouched as historical record. The
> annotated tag messages and the published GitHub Release bodies for 14.9.0
> through 14.13.0 are **immutable** and cannot be repaired at all.

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

# Era: pre-14.12.0 — archived

> All entries before `14.12.0` live in
> [`docs/archive/CHANGELOG-pre-14.12.0.md`](docs/archive/CHANGELOG-pre-14.12.0.md).
> The archive is read-only; git tags remain the canonical
> source for what shipped. Splitting them out of the main file
> keeps the active era under the 250-line drift cap enforced by
> `tests/test_changelog_eras.py`.

# Era: pre-14.14.0 — archived

> All entries before `14.14.0` live in
> [`docs/archive/CHANGELOG-pre-14.14.0.md`](docs/archive/CHANGELOG-pre-14.14.0.md).
> The archive is read-only; git tags remain the canonical
> source for what shipped. Splitting them out of the main file
> keeps the active era under the 250-line drift cap enforced by
> `tests/test_changelog_eras.py`.

# Era: pre-14.17.0 — archived

> All entries before `14.17.0` live in
> [`docs/archive/CHANGELOG-pre-14.17.0.md`](docs/archive/CHANGELOG-pre-14.17.0.md).
> The archive is read-only; git tags remain the canonical
> source for what shipped. Splitting them out of the main file
> keeps the active era under the 250-line drift cap enforced by
> `tests/test_changelog_eras.py`.

# Era: 14.17.x — current

> Started at `14.17.0`. Full entries live inline below.
> The drift test caps this era at 250 lines of entry body; growth past
> that forces a new era split (`# Era: 14.18.x`, etc.) — see
> [`docs/contracts/CHANGELOG-conventions.md § Era splits`](docs/contracts/CHANGELOG-conventions.md).

## [14.17.0](https://github.com/event4u-app/agent-config/compare/14.16.0...14.17.0) (2026-09-05)

### Release highlights

- **Behaviour changes:** the corpus is held — the wave that proved it, preserved (removes src/skills/ai-council/evals/triggers.json, src/skills/dependency-upgrade/evals/triggers.json, src/skills/judge-bug-hunter/evals/triggers.json, src/skills/judge-code-quality/evals/triggers.json, src/skills/judge-security-auditor/evals/triggers.json, src/skills/judge-test-coverage/evals/triggers.json, src/skills/quality-tools/evals/triggers.json, src/skills/recursive-verification/evals/triggers.json, src/skills/requesting-code-review/evals/triggers.json, src/skills/review-routing/evals/triggers.json, src/skills/rtk-output-filtering/evals/triggers.json, src/skills/sql-writing/evals/triggers.json, src/skills/subagent-orchestration/evals/triggers.json, src/skills/using-git-worktrees/evals/triggers.json) (a502114); hold commit-conventions at its stub ceiling (1ebf5ac); measured house commit convention outranks the shipped default (7651c88).
- **Default changes + migration:** measured house commit convention outranks the shipped default (7651c88).
- **Security and correctness:** anchor_coverage_gaps honours the dated-measurement marker (3df2156); re-derive the two description-dependent pins (fc1d6f4); no check may report passed on input it cannot see (3ad7d26).
- **Honest nulls:** _none_
- **Known limitations:** _none_

> **Governance mix:** governance-only 31 vs consumer-only 13 (taxonomy 1.0.0).
> Next cycle ships the rows four shipped-skill lists are missing — the render
> state matrix, the plan criteria the two planning skills judge against, and what
> a transactional email needs to survive a mail client — tracked in
> `agents/roadmaps/road-to-checklist-rows.md`.

### Features

* **delivery-mode:** a held change set and an owner decision packet, nothing flipped ([14330b8](https://github.com/event4u-app/agent-config/commit/14330b86810483e5d8f471826c9dbd0666977abb))
* **triggers:** a 14-file corpus wave, selected by a declared rule ([1ce64c8](https://github.com/event4u-app/agent-config/commit/1ce64c8b9dd2a411361c2f9e575a732bf57812b8))
* **commands:** /fix commit-messages — retro-fit past subjects to one convention ([47ff61d](https://github.com/event4u-app/agent-config/commit/47ff61ddfc4ef38ffbcde9e2638a624fcde6ee22))
* **rules:** measured house commit convention outranks the shipped default ([7651c88](https://github.com/event4u-app/agent-config/commit/7651c884debeaa80daf6cbb51608a54fa1391f89))
* **production-validator:** bind check_web_launch_readiness, its first non-test consumer ([56acac8](https://github.com/event4u-app/agent-config/commit/56acac87d0537fefea0e71d04bd78c3dcebef802))
* **release:** refuse a release that owes a governance-mix response ([f76b334](https://github.com/event4u-app/agent-config/commit/f76b3341a3f69af6b9546f20c0385e89f3afb3e6))
* **release:** measure the governance-vs-product mix of a release ([ef91095](https://github.com/event4u-app/agent-config/commit/ef910954544a7a6e66af00476b9a73c63236c137))
* **threat-modeling:** add an infrastructure surface class and its threat rows ([279061c](https://github.com/event4u-app/agent-config/commit/279061c2f01582f3699359d24218a934c4558832))
* **analyze-inbox:** give every extracted point a disposition it cannot escape ([176e7db](https://github.com/event4u-app/agent-config/commit/176e7db8971ba8f65f833621cf4f12508097c076))

### Bug Fixes

* **contracts:** review the sixteen beta deadlines that lapsed on 2026-09-04 ([183cd68](https://github.com/event4u-app/agent-config/commit/183cd6804365e2541571da7c2184338850550db3))
* **evidence:** re-derive the 5.1 routing-signal record after the body rewrite ([77ca9f9](https://github.com/event4u-app/agent-config/commit/77ca9f9766e103aefd7cacd6ab82c73e93ae1cc3))
* **roadmaps:** risk-register ranks must ascend ([8867c7e](https://github.com/event4u-app/agent-config/commit/8867c7e1d0915adea31669387afc5f02d8ad7618))
* **proof:** regenerate docs/proof.md after the corpus revert ([59a19ed](https://github.com/event4u-app/agent-config/commit/59a19ed0847ba63f32549329c368c3f24b12e19a))
* repair the defects a neutral review found in both procedures ([ef33f92](https://github.com/event4u-app/agent-config/commit/ef33f921266ff9627931bc2fee6e2180c247145a))
* **gate:** anchor_coverage_gaps honours the dated-measurement marker ([3df2156](https://github.com/event4u-app/agent-config/commit/3df21567ab47659180e506e896143ade471570ec))
* **tests:** re-derive the two description-dependent pins ([fc1d6f4](https://github.com/event4u-app/agent-config/commit/fc1d6f40eadcf609634371741d06e0a4f0c6ac22))
* **rules:** hold commit-conventions at its stub ceiling ([1ebf5ac](https://github.com/event4u-app/agent-config/commit/1ebf5ac16778499b13ff44716bc6ce4a7c6104d5))
* **skills:** name manifest peers so the tier-1 probe stays framework-neutral ([152af29](https://github.com/event4u-app/agent-config/commit/152af29b7977394de4424e1976275e9a9dd755e1))
* **web-launch-readiness:** no check may report passed on input it cannot see ([3ad7d26](https://github.com/event4u-app/agent-config/commit/3ad7d268bdcc090efc2834018cfda629548fb82f))
* **skills:** drop the duplicated grounding invocation from both IaC sections ([42cfa5b](https://github.com/event4u-app/agent-config/commit/42cfa5b3d9ce4d8b32f9e04c807b5b1b7930c674))
* **terraform:** correct the encryption backstop grep flags ([8c43c49](https://github.com/event4u-app/agent-config/commit/8c43c4925c5fa9e83efaf43080a92742ddd9a973))
* **analyze-inbox:** write the new prose in the canonical house dialect ([a7a1275](https://github.com/event4u-app/agent-config/commit/a7a1275fcd793320f14c3de6592710046c2001fe))

### Reverts

* **triggers:** the corpus is held — the wave that proved it, preserved ([a502114](https://github.com/event4u-app/agent-config/commit/a502114a9fa0e87ab883c8a5ca00dbe8681f7860))

### Documentation

* **evidence:** record the council round, the split, and the two required repairs ([3d5033d](https://github.com/event4u-app/agent-config/commit/3d5033db93c4c5abb999dc36302b00024af85d2e))
* **evidence:** record the run-20 drain, its two open roadmaps and its carrier ([2be3bb3](https://github.com/event4u-app/agent-config/commit/2be3bb3fcadc1b03777c0de308e6ccfb36a6ec82))
* **roadmaps:** close road-to-the-tenth-arrival with its per-step evidence ([2df5556](https://github.com/event4u-app/agent-config/commit/2df5556570df82548500b4ea372f9ad14f56a02b))
* **claims:** publish the skill-activation census as its own ledger row ([5fad7e3](https://github.com/event4u-app/agent-config/commit/5fad7e3ed29a3d2a5e46863f5752e6f105480fc6))
* **disposition:** the lock cited over the ninth arrival gates a different question ([f1324ce](https://github.com/event4u-app/agent-config/commit/f1324ce3ed0c9c7d3142e54319c0fc334f9fb128))
* **roadmaps:** AC-6 stays open, awaiting owner disposition ([287f5ec](https://github.com/event4u-app/agent-config/commit/287f5ec54c4f55ec314ca0f5018a01e706cf620e))
* **roadmaps:** record the outcome of road-to-the-check-that-cannot-see ([d238f3d](https://github.com/event4u-app/agent-config/commit/d238f3d13c761de1cb397f4cc14c5a6ef87de136))
* **roadmaps:** stop citing a superseded contract as the live-app reason ([c2a1d8f](https://github.com/event4u-app/agent-config/commit/c2a1d8f27db651ab6567588faae6f888c3522ace))
* **evidence:** describe the council response tree without naming its path ([ee0af99](https://github.com/event4u-app/agent-config/commit/ee0af993ffd5ec22911f294dc06af33638322169))
* **roadmaps:** close road-to-meta-ratio-measured ([6aaabdf](https://github.com/event4u-app/agent-config/commit/6aaabdf42c1fe3ee29432b431ba65518c6d87273))
* **evidence:** publish the first two release-mix readings as levels ([eadf59a](https://github.com/event4u-app/agent-config/commit/eadf59ae141fdc3a09d4d0ce5a60fa4ed6d765d7))
* **decisions:** decline the same-PR user-artefact gate (ADR-253) ([b23bb45](https://github.com/event4u-app/agent-config/commit/b23bb45e5ee1973b16c7cd100b954c831be74159))
* **roadmaps:** close road-to-decided-but-not-done at 12 of 12 ([43ecfa1](https://github.com/event4u-app/agent-config/commit/43ecfa1e0a849463fe90619f0018508a193af81d))
* **roadmaps:** name the receiver the carried-to promise pointed at ([29c4ad2](https://github.com/event4u-app/agent-config/commit/29c4ad20cee638a7d663d8e268367dd5cd1c5961))
* **evidence:** record whether secret scanning reaches a consumer IaC diff ([afd17bc](https://github.com/event4u-app/agent-config/commit/afd17bc446eb21e523767a11905fdf8a72420a9d))
* **skills:** give terraform and aws-infrastructure the permissiveness canon ([e33e233](https://github.com/event4u-app/agent-config/commit/e33e233dba49468f87c1f75f16d0a95b6b32e9d6))
* **roadmaps:** two roadmaps from the 2026-09-f and -g proposal rounds ([a978b66](https://github.com/event4u-app/agent-config/commit/a978b661cdba3709a64324fdcbefd18eb3ab25cb))
* **evidence:** verify and disposition the inbox-2026-09-f and -g rounds ([26dac19](https://github.com/event4u-app/agent-config/commit/26dac198f966a41adbb3e4a3d4d055786cb77afc))
* **roadmaps:** the gate reported this analysis diff as ten findings ([9caefb6](https://github.com/event4u-app/agent-config/commit/9caefb62c36b1c187200d66e62d61046feef143a))
* **roadmaps:** satisfy the relates, language and evidence-type gates ([8f53476](https://github.com/event4u-app/agent-config/commit/8f534765c7611cbebc1a3172afa5b8703da2a5a2))
* **roadmaps:** claim the one-in-one-out half of the estate ratchet ([89901b6](https://github.com/event4u-app/agent-config/commit/89901b6d0939aaafd349563bd188dd58fbfb3c03))
* **evidence:** verify and disposition the inbox-2026-09-e round ([f3e3579](https://github.com/event4u-app/agent-config/commit/f3e3579f91e6caebe899307671bc6f20e59655d3))
* **evidence:** declare the completion-review skip for the inbox-2026-09-d diff ([c28d094](https://github.com/event4u-app/agent-config/commit/c28d09446840231f75966286462ee60897054a7b))
* **roadmaps:** three roadmaps from the inbox-2026-09-d round ([f83b75f](https://github.com/event4u-app/agent-config/commit/f83b75f35fa0b942ffcdce3f35f95c77fa7ef7b6))
* **evidence:** record the inbox-2026-09-d verification and disposition ([77ab8e5](https://github.com/event4u-app/agent-config/commit/77ab8e5636a48b0f4382c7be2f964e1569dfacdc))

### Refactoring

* remove attest_artifact, enforcing the 2026-08-25 ruling ([e58e11f](https://github.com/event4u-app/agent-config/commit/e58e11f9bb3dcf482086d51e99eb21e14adffd1e))
* **explain-last:** drop the .agent-memory sidecar read path ([aaf049d](https://github.com/event4u-app/agent-config/commit/aaf049dbb8cb319f7af195c63ccd814f24b52697))

### Tests

* **distribution:** cover the canonical-channel invariant, which had no test ([d978081](https://github.com/event4u-app/agent-config/commit/d9780819b6e8303d163ce63093753f028d1d8d00))

### Chores

* **roadmaps:** archive road-to-the-tenth-arrival ([249ab53](https://github.com/event4u-app/agent-config/commit/249ab535ec20805aef4dca2ebcbe204013e6ceef))
* **wedge:** re-sync the production-validator wedge doc after the gate binding ([7f95d05](https://github.com/event4u-app/agent-config/commit/7f95d056d6a356cbc99b8c097c04dedd9217f2fc))
* **web-launch-readiness:** stop retyping the check count ([9ec7544](https://github.com/event4u-app/agent-config/commit/9ec754461d941b441ca9536d4a781c4a1180dcc4))
* **roadmaps:** archive road-to-meta-ratio-measured ([ffd65ff](https://github.com/event4u-app/agent-config/commit/ffd65ff92ff176c6798d0211c6655ccd9b76d032))
* **adr:** regenerate the evidence census for ADR-253 ([5b29d74](https://github.com/event4u-app/agent-config/commit/5b29d74b04bd1c47b920cbd0601451937ba1be2a))
* **roadmaps:** archive road-to-decided-but-not-done ([11b0222](https://github.com/event4u-app/agent-config/commit/11b0222b3a81da07d0a0786b2771883654d8b9c7))
* **roadmaps:** archive road-to-infra-threat-floor ([81007b4](https://github.com/event4u-app/agent-config/commit/81007b45af35528c8834a5e6a46603db8f21a3ca))

### Other

* **dialect:** write the new prose in the canonical house dialect ([e051ed8](https://github.com/event4u-app/agent-config/commit/e051ed8fcc20a387012d4ec16f645199fe4b1a86))

Tests: 21007 (+33 since 14.16.0)

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
