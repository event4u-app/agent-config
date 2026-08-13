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
