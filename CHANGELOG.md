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

# Era: 14.5.x — current

> Started at `14.5.0`. Full entries live inline below.
> The drift test caps this era at 250 lines of entry body; growth past
> that forces a new era split (`# Era: 14.6.x`, etc.) — see
> [`docs/contracts/CHANGELOG-conventions.md § Era splits`](docs/contracts/CHANGELOG-conventions.md).

## [14.6.0](https://github.com/event4u-app/agent-config/compare/14.5.0...14.6.0) (2026-08-19)

### Release highlights

- **Behaviour changes:** a blocked decision lock is now re-evaluated by the AI council by default instead of interrupting the owner, and only an owner-reserved transition still reaches a human (cafb8a2). ADR reopen authority became a property of the *transition* rather than of the document, carried by a new `reopen_policy` field (e8543f4). An R2 review of the ADR sweep confirmed five findings and refuted one (6ebae09).
- **Default changes + migration:** _none_
- **Security and correctness:** run-continuation gained `blocked` as a terminal outcome and had four state defects repaired, including state keyed on the roadmap rather than the reader (3245188, 5fd366f, 084b5c3). Gate work closed its own R2 findings with a test that discriminates rather than one that merely passes (4510f6d, 406cb22). The layer-overlap notice moved out of `condense.ts` (2de07e2), and `check_single_delivery` was added — it immediately found a third duplicated artefact type (e666899).
- **Honest nulls:** ADR-234 shipped together with the honest null on pointer liveness (93c30da).
- **Known limitations:** _none_

### Features

* **adr:** sweep the twelve locks that blocked work, and wire two dead gates ([56276c9](https://github.com/event4u-app/agent-config/commit/56276c90c0fd1c5330df806b8d436bcd3c0964f9))
* **adr:** make an amended decision visible — reciprocal links, index columns ([d06c95e](https://github.com/event4u-app/agent-config/commit/d06c95ee304528fd3945e21d766a18e7bab9fbae))
* **adr-layout:** reopen authority — the transition decides, not the document ([e8543f4](https://github.com/event4u-app/agent-config/commit/e8543f4f75bdb3bbaa56eb5bc38efb838da87be2))
* **adr:** add adr_cite_check — evaluate a decision before citing it as a blocker ([1bba5ff](https://github.com/event4u-app/agent-config/commit/1bba5ffb828e269d5cf3a157efbbedac0934ffb2))
* **decision-revisit-gate:** route lock re-evaluation to the council, not the user ([cafb8a2](https://github.com/event4u-app/agent-config/commit/cafb8a2553f1105ef1d90e4f62068fc84f5f07c9))
* **generate-tools:** say what writing the project layer costs ([7fbfe02](https://github.com/event4u-app/agent-config/commit/7fbfe02c38b39149cc2d4c040888e1e7a7ecbd60))
* **gates:** add check_single_delivery, and it finds a third duplicated type ([e666899](https://github.com/event4u-app/agent-config/commit/e6668993f2270a27992d0d51ab6a05d8ddbdd248))
* **install:** make the scope guard report what a same-version duplicate costs ([4db44f1](https://github.com/event4u-app/agent-config/commit/4db44f182ca898da17a73ba48c5a87e13a87a16f))
* **roadmap:** a runnable-work precondition and a blocked terminal outcome ([f14a287](https://github.com/event4u-app/agent-config/commit/f14a28735059ec5ba604a019a6d53ee227e494d0))
* **memory:** stamp the curated store and run the ladder once ([803a392](https://github.com/event4u-app/agent-config/commit/803a3921947e8b41bb0d312756e47a981facdd7c))
* **memory:** three instruments for the curated store — pointers, duplicates, eviction ([4b00f6f](https://github.com/event4u-app/agent-config/commit/4b00f6f62dd68edcf9c293bc7d7ad0dd1f22ee02))

### Bug Fixes

* **adr:** respond to the R2 review — five confirmed, one refuted ([6ebae09](https://github.com/event4u-app/agent-config/commit/6ebae092658839b4d1103ae8536817a704be2c15))
* **hooks:** clear the state on blocked, and stop deleting a legacy file nobody adopted ([5fd366f](https://github.com/event4u-app/agent-config/commit/5fd366f83276e7726d3338ca24cbb7814df17f46))
* **size-budget:** move the overlap notice out of condense.ts entirely ([2de07e2](https://github.com/event4u-app/agent-config/commit/2de07e2fd672e428d173794f0f36f398f125424a))
* **hooks:** give run-continuation the blocked terminal, and repair four state defects ([3245188](https://github.com/event4u-app/agent-config/commit/32451887c0db1df9c22b4cf2841e1ca985e71570))
* **gates:** close the remaining R2 findings, with a test that discriminates ([4510f6d](https://github.com/event4u-app/agent-config/commit/4510f6daee89ae3dcc5344730a3779a0a6bb5d72))
* **gates:** repair the three high R2 findings in this branch's own work ([406cb22](https://github.com/event4u-app/agent-config/commit/406cb22a0a3c512abdfea9e3bfbab6c3b7db50a6))
* **hooks:** key the run state on the roadmap, and stop one absence from reclaiming a budget ([084b5c3](https://github.com/event4u-app/agent-config/commit/084b5c3002f45e43f21b34912e1abaac87dc97bc))
* **hooks,register:** close all seven round-6 findings ([61e6910](https://github.com/event4u-app/agent-config/commit/61e69100f9dc564f301454e7368b5506c3e2d457))
* **hooks,register:** close all eleven round-5 findings ([544f0fb](https://github.com/event4u-app/agent-config/commit/544f0fba55b3580a54234ccd0f8dd2592cdfead1))
* **memory:** drop the retired-path literal from the pointer-report docstring ([ac2b338](https://github.com/event4u-app/agent-config/commit/ac2b33869eef14bfce2d73900984261e1a8c560f))
* **hooks,register:** stop the fallback from masking an archival, and name the file read ([a01b5a0](https://github.com/event4u-app/agent-config/commit/a01b5a0bcb2761b953871c57fc728e4fe027f4d3))
* **hooks,register:** resolve the run against the session tree, and walk up to it ([5fa347a](https://github.com/event4u-app/agent-config/commit/5fa347a5ae9496eb0b4876ffd0e93361f03048ef))
* **memory:** strip a raw NUL byte from the pointer report and unbreak two cf04 citations ([dd2f09e](https://github.com/event4u-app/agent-config/commit/dd2f09e4eefeca54c0ce22671b526bfe81f006ef))
* **hooks:** close the five round-3 findings that are not the two-tree decision ([2c73756](https://github.com/event4u-app/agent-config/commit/2c73756b04fcf3003630fb38a66022567e163c79))
* **memory:** satisfy noUncheckedIndexedAccess in the three new scripts and their tests ([d6f9cc7](https://github.com/event4u-app/agent-config/commit/d6f9cc715d55ebbab2ebc09762c7136d1e4def78))
* **hooks:** make a degraded session-root resolution readable, and correct the discriminator prose ([7db8896](https://github.com/event4u-app/agent-config/commit/7db889696374c2c9f8d001d5b905d262f1e6cecf))
* **capsule,roadmaps:** answer the R2 findings ([cda1a53](https://github.com/event4u-app/agent-config/commit/cda1a53cb9e30a547d2beeadeafbc198649a6914))
* **roadmap:** reopen the acceptance criterion its own text asked to reopen ([4822ff6](https://github.com/event4u-app/agent-config/commit/4822ff6a6c8ba89253ca108e6a9809f1daf1eb3a))
* **hooks:** derive the two-tree provenance from the session tree, not the reader ([19001b7](https://github.com/event4u-app/agent-config/commit/19001b759a4762c5520d68e588cd5c3b133bb7eb))
* **capsule:** enforce the path-ref shape do_not_touch already claimed ([2ca6fc6](https://github.com/event4u-app/agent-config/commit/2ca6fc66640b999546097aa003ad779f94f55885))

### Documentation

* **review:** re-bind round 9 after the base merge ([f17a613](https://github.com/event4u-app/agent-config/commit/f17a6130db8f898b6ed710534945ea340d65d0c7))
* **review:** close round 9's seven findings against their fixes ([6b8d007](https://github.com/event4u-app/agent-config/commit/6b8d0071587069c64fe15a9fafd44139b8455314))
* **ratchet:** reconcile the open_blockers row instead of asserting it ([11c5aef](https://github.com/event4u-app/agent-config/commit/11c5aeffadeb8dd12a94ccf644593bbbea432972))
* **review:** record round 9 findings before their fixes ([243c547](https://github.com/event4u-app/agent-config/commit/243c547aafb61dc36a174d5010c16d7112c35214))
* **review:** re-bind after the size-budget repair ([110d7a6](https://github.com/event4u-app/agent-config/commit/110d7a6eb873049f7e166ade3784ba72c6fc8ff6))
* **review:** close round 8's eight findings against their fixes ([08fd977](https://github.com/event4u-app/agent-config/commit/08fd977d849f1b1b4a3d6bb864dc33fd1468a3b4))
* **roadmap:** couple the two blockedness predicates, and stop quoting a count that keeps going stale ([bf72169](https://github.com/event4u-app/agent-config/commit/bf72169cef2bc14257d09afd8da8fdfa8e3a2edf))
* **review:** re-bind after the evidence-type declaration ([6ec2095](https://github.com/event4u-app/agent-config/commit/6ec209555495e77037e43cffb18da2964c5151b8))
* **evidence:** declare the census's evidence type ([7f3fd03](https://github.com/event4u-app/agent-config/commit/7f3fd034f383c726f63e8b6db4772bf9f9a1c7f1))
* **review:** re-bind after the base merge and ADR renumber ([ef2b3c1](https://github.com/event4u-app/agent-config/commit/ef2b3c122eafeeaccadaef92c76f36679d366d57))
* **review:** re-bind the findings artefact to the current scope ([f9b7be6](https://github.com/event4u-app/agent-config/commit/f9b7be68244566555fa5c52562cd8201f63e2a18))
* **review:** record round 8 findings before their fixes ([00ea023](https://github.com/event4u-app/agent-config/commit/00ea0239a99feedf87a021710d32e203cb29fc2f))
* **review:** fill the 17 R2 findings with their dispositions ([f28ffeb](https://github.com/event4u-app/agent-config/commit/f28ffebf23d70a18d91b4d949a164a90d916ccc4))
* **roadmaps:** correct the backwards CI claim and close four satisfied criteria ([d52c41e](https://github.com/event4u-app/agent-config/commit/d52c41e9c0c90170fbeb2c3b25227b6634a904f5))
* **review:** record the 17 R2 findings before any repair ([7ca43da](https://github.com/event4u-app/agent-config/commit/7ca43da318805898824dfd8cc44075df9a0f3111))
* **roadmaps:** halt single-delivery Phase 2 on an unstated precondition ([60671af](https://github.com/event4u-app/agent-config/commit/60671af4ddf3d9f3d05c67d83730f0bbe53f1faf))
* **adr:** supersede ADR-226 with ADR-235 one-artefact-one-layer ([b96115b](https://github.com/event4u-app/agent-config/commit/b96115bb96d278841b002258997d02de50eb3791))
* **evidence:** pin the single-delivery census with its projection shape ([4cfe282](https://github.com/event4u-app/agent-config/commit/4cfe282623da421facb2a2184cf76920a3d00bb4))
* **roadmaps:** adopt road-to-single-delivery from a four-draft inbox reconciliation ([6c743c1](https://github.com/event4u-app/agent-config/commit/6c743c181498ac4e1fac403ea11e9baf62c689f1))
* **adr:** record the blocked terminal outcome for process-full ([a0bc6af](https://github.com/event4u-app/agent-config/commit/a0bc6af62f9ab0dd7723e26e0860b477e75dba2d))
* **roadmap:** record the second partial on 0.1 and refute its blocker premise ([1ac0cf0](https://github.com/event4u-app/agent-config/commit/1ac0cf061d4434607862a63176510cb2d5016fbc))
* **roadmap:** re-review the risk register after the Phase 2 close ([8ecc398](https://github.com/event4u-app/agent-config/commit/8ecc3982001e9773dcb41f73b1e7612633331eba))
* **roadmap:** close Phase 2 of road-to-context-fidelity ([cf5505d](https://github.com/event4u-app/agent-config/commit/cf5505db4e72495e4f8276d20ae83908e564738c))
* **memory:** ADR-234 plus the honest null on pointer liveness ([93c30da](https://github.com/event4u-app/agent-config/commit/93c30dab88a7bef4f70d414899fa3b383f61307b))
* **roadmap:** record the live event that refuted the provenance fields ([03360b2](https://github.com/event4u-app/agent-config/commit/03360b28c7dfb66f2d820dcc5bd35716b8c730be))
* **review:** unwrap the verification table the findings parser reads as rows ([244ba2c](https://github.com/event4u-app/agent-config/commit/244ba2c3257f3f39fda533667246a7843b9906ef))
* **review:** declare the completion-review skip for a no-code-surface change ([a306f7e](https://github.com/event4u-app/agent-config/commit/a306f7e2a45091d8de709accff1e8e9888bfbe3f))
* **roadmaps:** regenerate the dashboard for the resumed roadmap ([9fb938a](https://github.com/event4u-app/agent-config/commit/9fb938a9b100f57b74ef5a6556e53827888c6be9))
* **roadmaps:** resume request-scoped-rule-load out of later/ on a satisfied condition ([abab942](https://github.com/event4u-app/agent-config/commit/abab94288b3d6e981ed471e967a9207b6a5ed2df))

### Chores

* **router:** regenerate router.json for the new decision-revisit-gate triggers ([6e05281](https://github.com/event4u-app/agent-config/commit/6e05281b1eada88d00d3e749e0295d399760ce92))
* **roadmaps:** archive road-to-adr-revisit-governance, fully closed ([9e0a331](https://github.com/event4u-app/agent-config/commit/9e0a331e19402e92b4ee3d6b944a1db0aa7aa8ac))
* **roadmap:** park run-continuation-observation, its open work is gated on a run the estate cannot supply ([42e8c05](https://github.com/event4u-app/agent-config/commit/42e8c056aceb9953e45d6e572e8d28f43f0a8a6c))
* **regen:** regenerate derived outputs after the base merge and ADR renumber ([c69068e](https://github.com/event4u-app/agent-config/commit/c69068ed1d4a89edafb8553a5ec135a0bb2cbdd1))
* **review:** close round 7 — 55 findings over seven rounds, six of seven highs in the previous round ([c1bb91d](https://github.com/event4u-app/agent-config/commit/c1bb91d8587bda81051251ad1329b6cf72e9e6e6))
* **roadmaps:** regenerate the dashboard after the second base merge ([5586c26](https://github.com/event4u-app/agent-config/commit/5586c26124e488badc93e0db856ad54f08753c32))
* **review:** record round 7 findings before their fixes — two high, both in round 6 ([1d420fe](https://github.com/event4u-app/agent-config/commit/1d420fe9f9c6c85b80c79d74de6709ea0f025196))
* **review:** archive round 6 and bind round 7 on the maintainer call ([c97dcfd](https://github.com/event4u-app/agent-config/commit/c97dcfd37c7b40bb8cfb025b7f12bccd46c090cf))
* **review:** close round 6 and state where the loop stopped ([4f49346](https://github.com/event4u-app/agent-config/commit/4f493467a502614abc001ccec8d10abbc2a0a3f2))
* **review:** record round 6 findings before their fixes ([3ef7320](https://github.com/event4u-app/agent-config/commit/3ef7320699e45932a64ce89827c0e0af8f516897))
* **review:** archive round 5 and bind round 6 ([d320319](https://github.com/event4u-app/agent-config/commit/d320319f4e21f5969d461bb99a7d583a056a5e17))
* **ratchet:** walk open_blockers 71 -> 70 after resolving memory-sweep-instrument ([7d5114d](https://github.com/event4u-app/agent-config/commit/7d5114dbd4ef3340e992717921eb6b919165136a))
* **review:** record round 5 findings before their fixes — eleven, two high ([cc62940](https://github.com/event4u-app/agent-config/commit/cc62940004d811c5927381de00fef6aced7d3ded))
* **review:** archive round 4 and bind round 5 to the fixed head ([578d021](https://github.com/event4u-app/agent-config/commit/578d02189621c62f304eb5780068d2ff22cf32ba))
* **roadmap:** regenerate the dashboard after merging origin/main ([b7b0838](https://github.com/event4u-app/agent-config/commit/b7b0838c8cd57e633226f58760e8e57d09269ffe))
* **review:** record round 4 findings before their fixes ([31e5895](https://github.com/event4u-app/agent-config/commit/31e58953462127e5d07f8fef6819a6ad7717a8ee))
* **roadmaps:** regenerate the dashboard after merging the un-park ([58ddc41](https://github.com/event4u-app/agent-config/commit/58ddc415b9d7f8e07814926fb1fce90e2a7728c5))
* **review:** archive round 3 and bind round 4 to the fixed head ([ccac473](https://github.com/event4u-app/agent-config/commit/ccac4736a8fa25cf74a7cd7518fd32ff2407849a))
* **estate:** walk the ratchet down to the estate this closure earned ([c2d744c](https://github.com/event4u-app/agent-config/commit/c2d744cd50097ad31d320b1513553a032b15eb60))
* **review:** record round 3 findings before their fixes — two highs ([14b9ddd](https://github.com/event4u-app/agent-config/commit/14b9ddd7dd4f82336d1d29db0d713f4c41bd2d46))
* **review:** archive round 2 and re-bind the live artefact to the fixed head ([03dc008](https://github.com/event4u-app/agent-config/commit/03dc0080b13d5da2f1448150f73fe6ad0b3f3605))
* **review:** record round 2 findings before their fixes ([45426cc](https://github.com/event4u-app/agent-config/commit/45426cc59ad5fea501313afcfa5ceb98f6a58651))
* **review:** close the nine findings and re-type the artefact as historical ([b7ecf02](https://github.com/event4u-app/agent-config/commit/b7ecf0207a049570f62cf24ab12247878cda31a6))
* **review:** bind the R2 review scope for this branch before the reviewer runs ([34dcdab](https://github.com/event4u-app/agent-config/commit/34dcdab73dae97539882bb78fa9c057045af1b51))
* **roadmaps:** re-review the lifecycle-integrity risk register for the relocated step ([0bc79b0](https://github.com/event4u-app/agent-config/commit/0bc79b09bae0c025ea54920616c195667e0c76a2))
* **ratchet:** record the un-park in the estate baseline ([4254a87](https://github.com/event4u-app/agent-config/commit/4254a87628912fcc8439e714c204d7281f0cfd41))
* **roadmaps:** regenerate the dashboard after merging origin/main ([411bb74](https://github.com/event4u-app/agent-config/commit/411bb74164e1bc70f43b7fc4c651ade784e91394))
* **roadmaps:** archive dispatch-safety, its last step closed ([5b25cbe](https://github.com/event4u-app/agent-config/commit/5b25cbee9ebfe4eb00ea76c3290db03fdfe598a0))
* **review:** record the R2 findings before their fixes ([da6f4a7](https://github.com/event4u-app/agent-config/commit/da6f4a70eb965f1fdc287daa91e20bef84666c88))
* **roadmaps:** close dispatch-safety 3.4 and relocate the guard intact ([4ca5ebd](https://github.com/event4u-app/agent-config/commit/4ca5ebd66bdec0d08531dfc073dcff4039bd84cf))

### Other

* **adr-revisit-governance:** re-bind to the router-regen scope ([7c248f2](https://github.com/event4u-app/agent-config/commit/7c248f2e975fea9e1be836edcc8cd8916aa5a116))
* **adr-revisit-governance:** re-bind after the base merge, commit the input package ([921df0c](https://github.com/event4u-app/agent-config/commit/921df0c03291accccb458e941224ee67f3a1007a))
* **adr-revisit-governance:** re-bind the R2 artefact to the post-fix scope ([330ece6](https://github.com/event4u-app/agent-config/commit/330ece6332c861d4a2152f2d50ff5fe53b44a453))
* **adr-revisit-governance:** R2 completion-review findings, before any fix ([3389935](https://github.com/event4u-app/agent-config/commit/3389935977f182961f32ddb9f90e89eaf8d4db04))
* **dispatch-safety-do-not-touch:** re-bind all three anchors after the second merge ([91653ad](https://github.com/event4u-app/agent-config/commit/91653ad11107eaa7572943a53b3d0e9532fe222c))
* **dispatch-safety-do-not-touch:** carry the roadmap hash through the re-bind too ([43ed4d7](https://github.com/event4u-app/agent-config/commit/43ed4d76aab920f3dbc23dc6fdcba06e6594fb48))
* **dispatch-safety-do-not-touch:** re-bind after merging the un-park ([2528af7](https://github.com/event4u-app/agent-config/commit/2528af7356264a53b08303eb8f857cd589acdc30))
* **dispatch-safety-do-not-touch:** re-bind after the ratchet walk-down ([ed2caa5](https://github.com/event4u-app/agent-config/commit/ed2caa5f2e75446a241dc7fd14f58d725262977a))
* **dispatch-safety-do-not-touch:** dispose the findings and re-bind ([c87d86c](https://github.com/event4u-app/agent-config/commit/c87d86cea2cad02fa38589c74d1bf0b8962642bf))
* **dispatch-safety-do-not-touch:** the R2 findings, before any fix ([ac03a25](https://github.com/event4u-app/agent-config/commit/ac03a257c4b5cdcd64f742d5d637f0ec9e4ba105))

Tests: 15397 (+125 since 14.5.0)

## [14.5.0](https://github.com/event4u-app/agent-config/compare/14.4.0...14.5.0) (2026-08-19)

### Release highlights

- **Behaviour changes:** _none_
- **Default changes + migration:** _none_
- **Security and correctness:** seven R2 findings on the hook-hardening branch were closed (1b787fe), and the injection ceiling now charges only the bytes the host actually receives rather than everything the concern produced (7f65655).
- **Honest nulls:** no null was recorded in this span. The commit the generator matched here (c45093d) binds the R2 review scope *before* the reviewer runs, which is review hygiene rather than a null result — stated rather than left as `_none_`, because the derived category was populated and a bare `_none_` would contradict it.
- **Known limitations:** _none_

### Features

* **hooks:** carry the two-tree provenance on every run-continuation event ([fcc3272](https://github.com/event4u-app/agent-config/commit/fcc32722c7566532e01ca1ebbb05eb219959e2e3))
* **register:** resolve a claim to its slug AND the file it came from ([e882235](https://github.com/event4u-app/agent-config/commit/e8822358d16ed74567ada8369398e27de745fa42))

### Bug Fixes

* **hooks:** close the seven R2 findings on the hardening branch ([1b787fe](https://github.com/event4u-app/agent-config/commit/1b787fea177c151362fd2af8ec163b0a8dd182b4))
* **hooks:** charge the injection ceiling only for bytes the host receives ([7f65655](https://github.com/event4u-app/agent-config/commit/7f656558c9beb91353a0cb2031ef99023f2d5641))

### Documentation

* **roadmap:** record the first run-continuation engagement outside a test ([d9e040b](https://github.com/event4u-app/agent-config/commit/d9e040bd2bc6199363b367aa784a42a8cbbcccc6))
* **review:** re-bind the hardening findings after the fixes and the base merge ([5507a19](https://github.com/event4u-app/agent-config/commit/5507a19e15d869db9dabe56e346d7fd400c6937e))
* **review:** mark the seven hardening findings fixed at 1b787fea1 ([1c031f0](https://github.com/event4u-app/agent-config/commit/1c031f0a3f51c7a9adbad19fb79dffdebb0212ce))
* **review:** record the R2 review of the hardening branch ([363a1ef](https://github.com/event4u-app/agent-config/commit/363a1ef4f38821266d1fc37f62c1188d660d50f2))

### Chores

* **estate:** raise the open-blocker baseline by one, with the reason ([7762ca5](https://github.com/event4u-app/agent-config/commit/7762ca5592f61e42090d5f53e86794e750b1290d))
* **review:** bind the R2 review scope before the reviewer runs ([c45093d](https://github.com/event4u-app/agent-config/commit/c45093d8c5549183447ef2313f31968ebb129400))

Tests: 15272 (+18 since 14.4.0)

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
