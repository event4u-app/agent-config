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

### Fixed

- **The release's written obligation is now answerable, not only refusable.**
  Across 14.18.0, 14.19.0 and 14.20.0 the governance-versus-product response was
  discharged **by hand, mid-release**: `task release` bumped the version, refused
  over the placeholder sentinel, and a human typed the sentence into the aborted
  tree. At 14.19.0 the answer had already been staged in `## [Unreleased]` one
  commit earlier (`a9bd75d55`) — nothing read it, so it was moved into the
  section by hand anyway. The answer was prepared and the pipeline still refused
  over it; that, not a missing answer, is the defect. `guard_release_curation`
  now tries three routes in cost order: a `> Next cycle ships …` and/or
  `> **Previous cycle:** …` line **staged** under `## [Unreleased]` is consumed
  into the section and cleared from `[Unreleased]`; failing that, a reachable
  terminal is **asked** and what the human types is written; failing that, the
  run refuses exactly as before, which is what keeps CI and scripted releases
  honest. `ADR-253` is untouched — the generator still never writes the answer,
  the measured level is never staged (it stays freshly measured so a stale
  number cannot ride in), and every guard predicate still runs over a staged or
  typed answer. The read-back obligation joined the mix response at this guard in
  the same change: until now `check_release_highlights` was the earliest gate
  reading it, so a section answering the mix and not the promise passed locally
  and died on the PR.

- **The 14.19.0 start-position fix shipped incomplete; this is its other half.**
  It taught `preflightPosition` to accept `release/{target}`, and 14.20.0 then
  failed with `release must run from 'main' or 'release/14.21.0', currently on
  'release/14.20.0'`. Step 2 had already bumped `package.json`, so a plain
  re-run computed the bump from the **already bumped** version and asked the
  preflight about a version one higher than the one in flight — the start-position
  fix could not help, it was asked about the wrong target.
  `_detect_in_flight_target` needed no flag for either of its branches (HEAD on a
  release branch; a manifest version whose tag is not published), and the comment
  at the call site already stated that intent — the `args.resume ?` gate narrowed
  it to resumed runs. The probe now runs unconditionally, so an abandoned bump can
  no longer be silently released as the NEXT version either. A wiring assertion
  pins it, because the probe's own unit tests passed throughout: they never asked
  whether anything called it unconditionally.

- **The curated-head refusal is recoverable again — its own remedy was refused
  by the preflight.** `guard_release_curation` stops between step 2 and step 3,
  leaving HEAD on the local `release/X.Y.Z` with the generated section
  uncommitted, and tells the operator to curate the head and re-run
  `task release`. Measured on 14.19.0, every spelling of that re-run died
  *before step 1*: a plain run on `release must run from 'main'`, and
  `--resume` on `working tree is not clean` — against the pipeline's own
  step-2 output. The only way through was to hand-craft the `release: X.Y.Z`
  commit the pipeline makes for itself one step later.
  `docs/release-runbook.md` claimed this had been closed on 2026-09-03; that
  fix landed in `checkout_release_branch`, which is step 1 and therefore
  unreachable from the position the guard creates — the claim was not wrong
  about step 1, it was wrong that step 1 was reachable. The start position is
  now one pure verdict, `preflightPosition`: `release/{target}` is legal with
  or without `--resume`, and a dirty tree is accepted **there only**, with the
  swept files printed. A dirty `main` still refuses, because there the same
  tree is an operator's unrelated work about to enter a release commit. Pinned
  by `tests/scripts/release.test.ts` § `preflightPosition`, including a wiring
  assertion so a pure verdict nobody calls cannot pass.

- **Release gates now refuse before the push, not on the release PR.** 14.17.0
  (PR #1856) failed `check_release_highlights` on a missing
  `> **Governance mix:**` line — an assertion reproducible locally in under two
  seconds, discovered instead after a branch, a pull request and a CI run had
  been spent. It was the second instance of the shape in three releases
  (14.14.0 / PR #1812 was the first, on the curated head), and
  `docs/contracts/CHANGELOG-conventions.md` had **recorded** the gap rather than
  closed it. Three changes: `render_changelog_entry` now emits the response
  block with the measured level and a placeholder sentinel the guards refuse
  (never a finished answer — a generator that discharged a written-answer
  obligation for itself would make it a formality); one predicate
  (`mix_response_blockers`) is read by the CI gate and both local guards, so the
  two sides cannot drift; and the missing `Tests: N` footer joins it as a
  section-level publication blocker, which until now also existed only inside
  `release-validation.yml`.

### Added

- **A release-gate locality registry, so the next orphan cannot land silently.**
  `src/config/release-gate-locality.yml` relates every job in
  `release-validation.yml` to the command that reproduces it locally;
  `tests/scripts/release_gate_locality.test.ts` fails when a job has no row, or
  when a row claims a script that is not in the tree, or when a missing local
  command carries no classified `NEEDS_*` reason. `task release:verify` runs the
  reproducible set from that same registry — and `task release` now runs its
  `--cheap` subset itself, before the branch is pushed. Three jobs genuinely
  cannot run pre-PR; the registry names which and why, and a green run prints
  what it did not cover rather than reading as a clearance.

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

# Era: pre-14.18.0 — archived

> All entries before `14.18.0` live in
> [`docs/archive/CHANGELOG-pre-14.18.0.md`](docs/archive/CHANGELOG-pre-14.18.0.md).
> The archive is read-only; git tags remain the canonical
> source for what shipped. Splitting them out of the main file
> keeps the active era under the 250-line drift cap enforced by
> `tests/test_changelog_eras.py`.

# Era: pre-14.19.0 — archived

> All entries before `14.19.0` live in
> [`docs/archive/CHANGELOG-pre-14.19.0.md`](docs/archive/CHANGELOG-pre-14.19.0.md).
> The archive is read-only; git tags remain the canonical
> source for what shipped. Splitting them out of the main file
> keeps the active era under the 250-line drift cap enforced by
> `tests/test_changelog_eras.py`.

# Era: pre-14.20.0 — archived

> All entries before `14.20.0` live in
> [`docs/archive/CHANGELOG-pre-14.20.0.md`](docs/archive/CHANGELOG-pre-14.20.0.md).
> The archive is read-only; git tags remain the canonical
> source for what shipped. Splitting them out of the main file
> keeps the active era under the 250-line drift cap enforced by
> `tests/test_changelog_eras.py`.

# Era: 14.20.x — current

> Started at `14.20.0`. Full entries live inline below.
> The drift test caps this era at 250 lines of entry body; growth past
> that forces a new era split (`# Era: 14.21.x`, etc.) — see
> [`docs/contracts/CHANGELOG-conventions.md § Era splits`](docs/contracts/CHANGELOG-conventions.md).

## [14.20.0](https://github.com/event4u-app/agent-config/compare/14.19.0...14.20.0) (2026-09-07)

### Release highlights

- **Behaviour changes:** drop a stale self-referential suppression from untrusted-input-defense (3fb3405); bind every suppression pragma to the evidence it accepts (98e9af2).
- **Default changes + migration:** _none_
- **Security and correctness:** a parity-pinned pair carries one bound hash per identity (8a08504); house dialect in the lines this branch authored (085279f); drop a stale self-referential suppression from untrusted-input-defense (3fb3405); bind every suppression pragma to the evidence it accepts (98e9af2); the scout's security gate reads what a candidate says (35bcf7e); the agent-security umbrella publishes what it read, and carries a floor (a416ef8); +8 more.
- **Honest nulls:** _none_
- **Known limitations:** _none_

> **Governance mix:** governance-only 16 vs consumer-only 3 (taxonomy 1.0.0).
> Next cycle ships the ask surface: a decision this package needs from its user
> reaches the user instead of parking in a roadmap `blocked-by:` marker, an
> `## Open questions` section nothing obliges the next session to read, or a
> printed `{count}` where a question belonged — tracked in
> `agents/roadmaps/road-to-asked-not-parked.md`, which stands at zero of its
> twenty-five steps at this tag.

> **Previous cycle:** the 14.19.0 head promised the installed MCP bridge repair —
> a version-pinned server entry instead of an `npx -y` resolution of `latest`, a
> registration that migrates itself when the bridge shape changes under an update,
> and setup docs matching the command the installer actually writes. It **shipped**,
> in this span: `mcpBridgeEntry` now emits `@event4u/agent-config@<version>` read
> from the installed manifest and leaves the spec unpinned rather than guessed when
> the version cannot be read (`src/scripts/_lib/mcp_bridge.ts:52-60`, commit
> d01873a88); the documented client snippets are gated against the installer entry
> (21c215e54) and `grep -c "/absolute/path/to/agent-config" docs/mcp-server.md`
> returns 0; MCP registration is gated on the capability axis with the consent
> residual named (55de37904). `road-to-mcp-bridge-integrity-and-reach-truth` closed
> at seventeen of seventeen steps. The promise stood outstanding across 14.18.0 and
> 14.19.0 and is now discharged.

### Features

* **publish:** classify the packed surface by type, bound per entry ([d08656d](https://github.com/event4u-app/agent-config/commit/d08656dfe50bee05579691b9229b9b1dfb23870c))
* **security:** bind every suppression pragma to the evidence it accepts ([98e9af2](https://github.com/event4u-app/agent-config/commit/98e9af29744a8ad76192eb48615764a5bc3fa8d2))
* **security:** the scout's security gate reads what a candidate says ([35bcf7e](https://github.com/event4u-app/agent-config/commit/35bcf7e972679dae961b7c812a6e397c5a1d68c2))
* **security:** the agent-security umbrella publishes what it read, and carries a floor ([a416ef8](https://github.com/event4u-app/agent-config/commit/a416ef8ce3b89e35aa2459f5204599ff5d9066db))
* **handoff:** carry falsifiable uncertainty, and capture rather than chase ([83de12e](https://github.com/event4u-app/agent-config/commit/83de12e0760a592060f30a94575d9dc9898215bf))
* **self-repair:** give a model-noticed observation a target-addressed record ([32c8302](https://github.com/event4u-app/agent-config/commit/32c83025e421072ed6084f06e612622b0b9da965))
* **continuity:** key the record by session and give the schema what worked ([72c0962](https://github.com/event4u-app/agent-config/commit/72c096257210e9f12f9dfdc7a24be686aed30eea))
* **install:** gate MCP registration on the capability axis, and name the residual ([55de379](https://github.com/event4u-app/agent-config/commit/55de379047c3e1ae6cbeabfa563290117e20bc6e))
* **telemetry:** publish the MCP-lite reading, zero included ([b2e3f20](https://github.com/event4u-app/agent-config/commit/b2e3f207b737f725dfd28b9a9ce0c06a329d56fc))
* **mcp:** emit one collector row per stdio-lite tools/call ([6fb0fe9](https://github.com/event4u-app/agent-config/commit/6fb0fe90c21114096507406c58158a312792bb4b))
* **mcp:** serve the standard resource annotations, and add the MCP capability axis ([3dfd70a](https://github.com/event4u-app/agent-config/commit/3dfd70a028ef6e9f60f75c4d28fc9f76ed75658f))
* **mcp:** make the documented client snippets match the installer, and gate it ([21c215e](https://github.com/event4u-app/agent-config/commit/21c215e54d423a6abda8a47b9fdafb2c2475497b))
* **mcp:** pin the bridge entry to the installed version, and repair it on update ([d01873a](https://github.com/event4u-app/agent-config/commit/d01873a88cd2800dd49f201cbb64f2cf4c640488))

### Bug Fixes

* **security:** a parity-pinned pair carries one bound hash per identity ([8a08504](https://github.com/event4u-app/agent-config/commit/8a0850449d8f9f89b262a74af218a5f895aa4412))
* **security:** drop a stale self-referential suppression from untrusted-input-defense ([3fb3405](https://github.com/event4u-app/agent-config/commit/3fb34055b2df64b21d435f221c7cb967d0e0c5ef))
* **deps:** bump open from 11.0.1 to 11.0.2 in the npm-production group ([0dd9c23](https://github.com/event4u-app/agent-config/commit/0dd9c2364436dad56a308fccf15a595f7ade93d8))
* **security:** the agent-security umbrella fails closed on a child that did not answer ([6a9411f](https://github.com/event4u-app/agent-config/commit/6a9411fc60f226b16c9efcaa1c6c5cf209e06207))
* **ci:** clear lint_code_comments on this branch's own new comments ([e2589b0](https://github.com/event4u-app/agent-config/commit/e2589b0d7b21a7a78c4c5dd353861326f7c9a96d))
* **gates:** make the park gate read a wake condition, not a status word ([4636ad8](https://github.com/event4u-app/agent-config/commit/4636ad80da321fce0012bd20b5b52bee4515428b))
* **audit:** make rules_applied an observation, retiring the constant and its card ([bffae3d](https://github.com/event4u-app/agent-config/commit/bffae3dd1d1f8feee8fbb86ca3557b7a803b34fa))
* **ci:** rewrite two docblocks as prose, and record the 14.19.0 review null ([83bc671](https://github.com/event4u-app/agent-config/commit/83bc671e6653110877ff525add31b66ff6f9e955))
* **release:** record why 14.19.0's findings ledger is empty ([e6aab8f](https://github.com/event4u-app/agent-config/commit/e6aab8fdaa0ceb62a10d7c17f870d2d142890436))
* **release:** make the curated-head refusal recoverable from where it stops ([5affd8a](https://github.com/event4u-app/agent-config/commit/5affd8adcb8f56e9bd4999e483d5bfeef5530710))

### Documentation

* **roadmap:** re-review the risk register against what the six risks actually did ([79f05a1](https://github.com/event4u-app/agent-config/commit/79f05a1a78aa187c8b96deba664a17f9a5b92d58))
* **roadmap:** resolve both blockers of road-to-scan-that-fails-closed ([1b7de23](https://github.com/event4u-app/agent-config/commit/1b7de235ffdb6649194223b988594ee0f4e6eee6))
* **roadmaps:** drain 20 disposition -- 0 of 38 closed, every trigger re-measured ([0d39f15](https://github.com/event4u-app/agent-config/commit/0d39f1502d88a0cc5729d0de63dbf9a420162a5b))
* **roadmaps:** record the carrier-transition-vocabulary trigger as fired ([82da6e9](https://github.com/event4u-app/agent-config/commit/82da6e9f006f62f57a7bfc5b70761aed36a5a0b0))
* **security:** state the umbrella's child-completion gap before repairing it ([e9ccd26](https://github.com/event4u-app/agent-config/commit/e9ccd26ecfa9b16a3e20f01a072071acd120108b))
* **roadmap:** close road-to-observed-learning-signal and its four blockers ([07f47bd](https://github.com/event4u-app/agent-config/commit/07f47bdcd896dd959846aeeac8b384f555c84c5b))
* correct the two documents that mislead the next reader ([2f319f7](https://github.com/event4u-app/agent-config/commit/2f319f7882e80113f606a1652dbe14684c41a4ef))
* **roadmap:** close Phases 1-2, record the council sequencing for 3-4 ([5378030](https://github.com/event4u-app/agent-config/commit/5378030e0f93b71d4a6696fd32816baface27ac5))
* **adr:** disclose what ADR-256 rests on, and what it does not ([b634daa](https://github.com/event4u-app/agent-config/commit/b634daadb43a9d3c182caf86e33336a07f26c20c))
* **hosts:** reconcile the enforcement surface with what the manifest binds ([909e606](https://github.com/event4u-app/agent-config/commit/909e606e443e9fb46b230bf2db7c0bfb85827b45))
* **adr:** record the four MCP blocker rulings, and close the roadmap ([adedaf4](https://github.com/event4u-app/agent-config/commit/adedaf485a8379051012692b1c5b39867638d398))

### Refactoring

* **mcp:** pay the size ratchet rather than raise it, and fix two CI reds ([08e011a](https://github.com/event4u-app/agent-config/commit/08e011ab8837213ea86aefcc632ebabd85b5fa8b))
* **release:** move the start-position verdict into _lib ([97b74ad](https://github.com/event4u-app/agent-config/commit/97b74ad48eda3a96ef5e4830dd4963041decab79))
* **continuity:** retire HANDOFF.md and decide the two colliding words ([ffd8dd7](https://github.com/event4u-app/agent-config/commit/ffd8dd754fc85ab8c928e45522d8c21f7c2460dd))

### Tests

* **security:** freeze the umbrella's failure corpus against today's fail-open ([b4bed8c](https://github.com/event4u-app/agent-config/commit/b4bed8c563348a94592083466859367b0352aed3))

### Chores

* **gates:** recount the coverage denominator on the merged tree, re-pin the canary ([1918abb](https://github.com/event4u-app/agent-config/commit/1918abb972748b52868cc8e6f2ab79104ad9319d))
* **deps:** bump the github-actions group across 1 directory with 3 updates ([720bc5e](https://github.com/event4u-app/agent-config/commit/720bc5e17a6263f525e2c2e4e949d8687a0009ae))
* **deps-dev:** bump the npm-development group with 6 updates ([a449541](https://github.com/event4u-app/agent-config/commit/a449541c4961ab8f72588158b204aff7212224d9))
* **evidence:** use the reconciled 14.19.0 ledger text ([a692fe3](https://github.com/event4u-app/agent-config/commit/a692fe39443e0b2bb1e68f6e809133fc922c3abd))
* **roadmap:** archive road-to-observed-learning-signal ([b52fed5](https://github.com/event4u-app/agent-config/commit/b52fed5f44dd23fb377f4e060de67dfd6ae1d827))
* **reports:** regenerate skill-overlap after the TDD skill edit ([67f2c16](https://github.com/event4u-app/agent-config/commit/67f2c168adaf7ad7fdb076064f5c805e5466edbe))
* **census:** refresh the ADR evidence census for ADR-256 ([5aa4e7c](https://github.com/event4u-app/agent-config/commit/5aa4e7cbb8852edb2f2704dbf881f6580c6fd983))
* **evidence:** record the 14.19.0 findings ledger ([88ba528](https://github.com/event4u-app/agent-config/commit/88ba5286a58314e4a027f28ce76d489072f27a68))
* **roadmap:** archive road-to-mcp-bridge-integrity-and-reach-truth ([02c016e](https://github.com/event4u-app/agent-config/commit/02c016e367128f2b9e604cef9b4fc906a8922e56))

### Other

* **security:** house dialect in the lines this branch authored ([085279f](https://github.com/event4u-app/agent-config/commit/085279f9cc1e84ea87a48c56bc21021873ef7704))
* carry the closure content the archival move left behind ([cbf0b5d](https://github.com/event4u-app/agent-config/commit/cbf0b5dd69bd69ba2b5be88e12eb66d8df016876))
* close road-to-one-continuity-record around the sequenced half ([ffab0c2](https://github.com/event4u-app/agent-config/commit/ffab0c262e0a72817e41a2b13a25ae8fabc63ff6))

Tests: 21606 (+130 since 14.19.0)

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
