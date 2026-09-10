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

- **The self-review gate reviews again — it had reviewed nothing for four
  consecutive releases.** 14.17.0, 14.18.0, 14.19.0 and 14.20.0 each returned
  `HTTP 400 prompt is too long` and each recorded an honest null in
  `agents/evidence/release-findings/`. The release path sets the analysis base
  to the previous tag, so the whole release span went into **one** request.
  **All four** recorded a figure against the 200000 cap — 235472 (14.17.0),
  413191 (14.18.0), 450336 (14.19.0), 260998 (14.20.0) — and the smallest
  exceeded it by 17.7 %. (An earlier draft of this entry said three releases
  recorded a figure and put the smallest at 30 % over; both were wrong, and the
  omitted reading was the one nearest the cap — the one that most constrains
  the budget. The conclusion does not depend on the error: every span observed
  exceeds the cap.) `buildPlan` already computed `promptChars` and only
  *reported* it, so nothing consulted the number before spending the call.
  The diff is now partitioned **per file** into requests under a character
  budget, each is reviewed, and findings are merged and deduplicated on the
  finding id the ledger already uses. Verified against the live span that had
  been failing: 5 requests, no path left out.
  **Nothing is truncated**, and that is the load-bearing decision: a silently
  shortened diff yields findings about a fragment while reading as a review of
  the whole change, which is the false green this repository's honest-null
  discipline exists to prevent. So a single file larger than one request is
  **named as unreviewed** rather than cut mid-hunk, a per-run request ceiling
  bounds the spend and reports its remainder, a chunk whose call fails no longer
  discards the chunks that succeeded, and the rendered PR comment carries a
  **Coverage** block stating what was not read — including the sentence that
  absence of a finding for an unreviewed path is not evidence about that path.
  `--dry-run` now prints the request count rather than only a token estimate,
  because this gate spends per request, and warns when a span sits at the
  ceiling. The budget factor is a character proxy **derived from those four
  failures** (measured diff chars / reported tokens = 3.13 and 3.18) and set
  below them, because the ratio is content-dependent — cl100k over this repo's
  own diffs reads ~3.9 for `src/`, ~4.1 for prose and ~2.75 for a lockfile. A
  call that still overflows a budgeted chunk falsifies that number, not the
  partitioning.
  **A neutral reviewer on the first version found three defects that are fixed
  here rather than shipped.** The coverage line counted every file in a dropped
  chunk as reviewed — 59 of 60 for a run that read 4, because the partition
  packed to opaque strings and reported one aggregate row; it ignored chunks
  whose call had failed, computing the number before those were appended; and a
  non-ASCII filename was silently skipped **and** counted as read, because
  `git diff --name-only` renders it quoted and the quoted form then matches no
  pathspec. Coverage is now summed from the chunks that actually returned, every
  dropped chunk names its own files, and paths are read with
  `core.quotePath=false`. Correcting the budget ratio shrank each request, so
  the same span needed five: the request ceiling moved from four to six rather
  than paying for tokenizer safety with silent coverage loss.
  Known limits, stated rather than implied: coverage lives in prose, so an
  `--enforce` run over a partial review still returns 0, and
  `check_finding_dispositions --ingest` reads only `.findings`, so the durable
  ledger does not record the coverage the artifact now carries.

### Added

- **A push no longer ships a branch whose tree contradicts its own commits.**
  `check_branch_work_committed` runs first in the pre-push hook, and it exists
  because this branch produced the defect it guards: a merge-reconciled baseline
  was written into `gate-violation-baselines.json` **after** `git add`, so
  `git commit --no-edit` captured the staged side, the reconciled number stayed
  in the working tree, and the push went out asserting a baseline the tree
  contradicted. The operator found it, not the pipeline — and **no CI gate
  could have**: CI checks out the pushed commit, and the working tree holding
  the lost edit does not exist there. That is why this gate is pre-push and
  local-only, the same reach `check_branch_freshness` has.
  It blocks by **authorship**, not on a dirty tree, because a blanket
  clean-tree rule would fire on every gate script's own report output and train
  the operator to set the skip variable: staged-and-changed-since (the measured
  shape), staged at all (`git add` is recorded intent, and a push carries
  commits rather than the index), and dirty files this branch's own commits
  touch. A parallel session's edit and a gate's report output are named and
  waved through. One residual limit is stated in the header rather than hidden:
  a file this branch created and neither staged nor committed cannot be told
  apart from a foreign untracked file; the staged rule closes it at the first
  `git add`, and that rule exists because testing the gate against the live
  tree put its own source file in the advisory class.

### Fixed

- **`task release` no longer asks the releaser to write anything, and the
  written-answer obligation is deleted (ADR-261).** This entry replaces the one
  that stood here — *"the release's written obligation is now answerable, not
  only refusable"* — because that mechanism landed and was removed in the same
  cycle, and shipping its description would be a false claim about 14.21.0.

  The obligation: when governance-only commits outnumbered consumer-only ones
  over the release span, the section had to carry human prose naming the next
  cycle's consumer work, and the following release had to read that promise back
  as `shipped` / `did not ship` / `withdrawn`. Four refusal sites, two
  placeholder sentinels, a length floor, an outcome vocabulary, a
  `## [Unreleased]` staging channel and an interactive prompt stood behind two
  sentences. Across 14.18.0, 14.19.0 and 14.20.0 it was discharged **by hand,
  mid-release**, after the pipeline had bumped the version and aborted.

  The mechanism built to fix that ran for the first time on 14.21.0 and made it
  worse: `staged_response` located its markers with an unanchored
  `body.indexOf(marker)` over the whole `## [Unreleased]` body, so it matched
  the **prose of the changelog entry describing itself**, cut two sentences out
  of the middle of that entry, pasted them into the 14.21.0 release head as
  orphan fragments, and prompted for the answer anyway. A `task release` run
  corrupted both sections of the file it was governing. Both are repaired here.

  The owner removed the obligation rather than the bug: this package exists to
  make the maintainer's work cheaper, and a gate that halts a green pipeline
  until a human types prose about a cycle that has not happened yet moves cost
  onto the person the tool is for. `> **Governance mix:** …` stays as a
  one-line measurement the generator renders end to end.

  **Untouched:** every honesty control about a claim *this* release makes —
  `_auto-derived, rewrite before merge:_` still blocks, the authoring-instruction
  sentinel still blocks, the `_none_` contradiction check still blocks, the
  `Tests: N` footer is still required. Those refuse an unreviewed statement about
  the release being published; the deleted one refused the absence of a statement
  about a future one. ADR-253's actual decision — the decline of the per-PR
  user-artifact gate — stands.

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

  **Superseded within the same cycle — read the ADR-261 entry above.** The
  placeholder sentinel, `mix_response_blockers` and the whole written-answer
  obligation this entry describes are deleted; the `> **Governance mix:**` line
  survives as a pure measurement. What still holds from this entry: the
  locality registry, the `Tests: N` footer as a section-level blocker, and the
  push-time refusal for the curated head.

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

# Era: pre-14.23.0 — archived

> All entries before `14.23.0` live in
> [`docs/archive/CHANGELOG-pre-14.23.0.md`](docs/archive/CHANGELOG-pre-14.23.0.md).
> The archive is read-only; git tags remain the canonical
> source for what shipped. Splitting them out of the main file
> keeps the active era under the 250-line drift cap enforced by
> `tests/test_changelog_eras.py`.

# Era: 14.23.x — current

> Started at `14.23.0`. Full entries live inline below.
> The drift test caps this era at 250 lines of entry body; growth past
> that forces a new era split (`# Era: 14.24.x`, etc.) — see
> [`docs/contracts/CHANGELOG-conventions.md § Era splits`](docs/contracts/CHANGELOG-conventions.md).

## [15.0.0](https://github.com/event4u-app/agent-config/compare/14.23.0...15.0.0) (2026-09-10)

### Release highlights

- **Behaviour changes:** retire /chat-history and /chat-history import (removes src/domains/meta/chat-history/command.md, src/domains/meta/chat-history/import/command.md) (8b5226a); the deny stays — the replacement was refused 2/2 (03e4eb7); stop asserting a mechanism that no longer exists (9c3f86b); retire the kernel-rule tool-call deny and the 24h soak (288190b); the reuse qualification, condensed then paid for (db46568); four red jobs, all four consequences of projecting docs/guidelines (c4d9ef2); +4 more.
- **Default changes + migration:** arm the automatic record by default, retire the recycle advisory (956954c).
- **Security and correctness:** make the settings writers idempotent, and repair what the old one broke (#2000) (a063516); repair a file the old writer already corrupted, or say why not (7f3a8c3); ask whether a key is present, never infer it from the write (aea618a); name the payload job what it does, before the name is pinned (#1999) (5d58896); make the payload check report on every PR, so it can be required (#1998) (97466af); tell an unverifiable bound apart from a risen one (#1994) (f01f85f); +28 more.
- **Honest nulls:** the drain-run summary, as the last commit of the run (ef06ab8).
- **Known limitations:** _none_

> **Governance mix:** governance-only 76 vs consumer-only 10 (taxonomy 1.1.0).

### BREAKING CHANGES

* **commands:** retire /chat-history and /chat-history import ([8b5226a](https://github.com/event4u-app/agent-config/commit/8b5226aff24d93f8a5fecfa7525b9419d58524af))
* **governance:** retire the kernel-rule tool-call deny and the 24h soak ([288190b](https://github.com/event4u-app/agent-config/commit/288190b1a5a09a964cf4cc29fa356791bbfb8069))

### Features

* **release:** prove the release can read local settings before the bump ([4ee7eb8](https://github.com/event4u-app/agent-config/commit/4ee7eb86fe881eb7230d53f99e080f53a114bb69))
* **ci:** wire the platform anchor now that the forge satisfies it ([8924414](https://github.com/event4u-app/agent-config/commit/8924414f533ec54293c1fab19f397570b28e636e))
* **continuity:** arm the automatic record by default, retire the recycle advisory ([956954c](https://github.com/event4u-app/agent-config/commit/956954c91d851976ccd77eb08a4eac8cb172d02a))
* **governance:** measure the platform anchor instead of assuming it ([11bd907](https://github.com/event4u-app/agent-config/commit/11bd907d0a9030394b2571f0143b00f786f3cc70))
* **chain-nudge:** carry the write-through-shell shape, and latch per class ([c68b0fd](https://github.com/event4u-app/agent-config/commit/c68b0fd51617d6c21ebf1174122c038a7bba6168))
* **friction:** measure category-A coverage over real Bash traffic ([169dfb5](https://github.com/event4u-app/agent-config/commit/169dfb51b6c9309f7485f1494fbe0dcf5251afcd))
* **governance:** the ratification record, and the round-3 conditions it carries ([56fea01](https://github.com/event4u-app/agent-config/commit/56fea0136cc3040d348f208f6cd67b70afa52bb2))
* **governance:** check_kernel_edit_ratified — the CI gate that replaces a deny ([66a2ecb](https://github.com/event4u-app/agent-config/commit/66a2ecb919e323630a03ece329cbc05f854f079d))
* **governance:** the ratification artifact, ADR-268 § 4's control ([0446070](https://github.com/event4u-app/agent-config/commit/04460704d2188d2f8e9efaa426486e339d675ec9))
* **design-fidelity:** turn the claim into a measurement, and close the roadmap ([450ee30](https://github.com/event4u-app/agent-config/commit/450ee30cd5ac3eb19e0c2fc319b6a660abd93472))
* **design-fidelity:** maturity and reconciliation as fields, with the numbers deliberately absent ([b168ca1](https://github.com/event4u-app/agent-config/commit/b168ca120de4813a78e761c84a1cd1268c7ee3fc))
* **design-fidelity:** route the canvas artboard, record the artifact read, carve out ported icons ([21fb2fe](https://github.com/event4u-app/agent-config/commit/21fb2fe3798d0b0461e9a1901886d43e37914893))
* **design-fidelity:** gate the route, cascade the mode, and land the arbitration where both rules reach it ([c0fa95d](https://github.com/event4u-app/agent-config/commit/c0fa95d40693a7105e3ed1c5ce802fdf14719c26))
* **condense:** project docs/guidelines/ so the routed tier exists where it is read ([acc2451](https://github.com/event4u-app/agent-config/commit/acc24516330968f1324bf97d3246f350519b2531))
* **budgets:** the payload gate gains a host reading, and the ratchet keeps its own ([b6af20d](https://github.com/event4u-app/agent-config/commit/b6af20db552fdbcc5e8507cd6a1d314925740ba8))

### Bug Fixes

* **settings:** make the settings writers idempotent, and repair what the old one broke (#2000) ([a063516](https://github.com/event4u-app/agent-config/commit/a0635168042f854fc8402a2de5d516a4f85d76ed))
* **settings:** repair a file the old writer already corrupted, or say why not ([7f3a8c3](https://github.com/event4u-app/agent-config/commit/7f3a8c3f38a18cc42dbbcadaa30380bf9c090869))
* **settings:** ask whether a key is present, never infer it from the write ([aea618a](https://github.com/event4u-app/agent-config/commit/aea618a21688edf3cfa67f50b3a73dab53aeda62))
* **ci:** name the payload job what it does, before the name is pinned (#1999) ([5d58896](https://github.com/event4u-app/agent-config/commit/5d58896fa43212ae6b76d591529732dc140bbde7))
* **ci:** make the payload check report on every PR, so it can be required (#1998) ([97466af](https://github.com/event4u-app/agent-config/commit/97466afddcb4018991185a66ff70c61b00a6e02a))
* **gate:** tell an unverifiable bound apart from a risen one (#1994) ([f01f85f](https://github.com/event4u-app/agent-config/commit/f01f85f6ccfd5f60d4f5af567d00a0eadb5e95bd))
* **ci:** record why the anchor target is manual, and what would make it run ([7481b00](https://github.com/event4u-app/agent-config/commit/7481b005ee914307c78cab7a01091b0d3d50bd8a))
* **ci:** the anchor gate cannot run in CI — the token scope does not exist ([7648ae3](https://github.com/event4u-app/agent-config/commit/7648ae318bc86f7005a85739d41c6668dc94d83a))
* **gates:** keep the self-test fixtures out of the shipped-import scan, and pay the size ratchet ([597c11b](https://github.com/event4u-app/agent-config/commit/597c11bd2ba8f92c269963c9acedac00528ee3c5))
* **gates:** close the three findings the reachability review returned ([621d44f](https://github.com/event4u-app/agent-config/commit/621d44fc2b6ade0b2c6f375a803fbe786dd9adc8))
* **gates:** reach the lossy module instead of being pointed at it ([0a9837a](https://github.com/event4u-app/agent-config/commit/0a9837ab444a4067866ac05bae2f24535063520c))
* **review:** bind the skip declaration to the scope it actually covers ([90ad454](https://github.com/event4u-app/agent-config/commit/90ad454d8b042f02aadf94e3f94eb0cda110e1a8))
* **evidence:** restore run 21, and give this run its own numbered record ([775ce56](https://github.com/event4u-app/agent-config/commit/775ce565ae54df748e758bb34329131ab0380392))
* **ci:** three gate reds from this branch's own prose and one crossed ceiling ([fc5735c](https://github.com/event4u-app/agent-config/commit/fc5735cbbd914b65089934211ec14ef77c15c7a5))
* **decisions:** refresh the derived index and census after the grade came down, and record what the census then did ([c4658aa](https://github.com/event4u-app/agent-config/commit/c4658aa959c9b4f4b29f1afef26e15cbc18c2bcb))
* **review:** mark three shell-command backticks as non-references ([0746d16](https://github.com/event4u-app/agent-config/commit/0746d168b4ab59ee0aebbe5ce53047ffb76220c7))
* **friction:** finish the argument half, and pin what could still drift ([a469e71](https://github.com/event4u-app/agent-config/commit/a469e717e61fdd497851ae674a0799f03ee2f5d4))
* **chain-nudge:** four regressions the round-1 fixes introduced ([49fc069](https://github.com/event4u-app/agent-config/commit/49fc069f5301d76fccfd407601e544f982b6c9ad))
* **governance:** close the floor's selector door and three fail-open reads ([217139b](https://github.com/event4u-app/agent-config/commit/217139b67f42ca0062b33584c6c63c4b28e0cd59))
* **review:** close all nine completion-review findings, two of them the same defect this change removes ([fd54b35](https://github.com/event4u-app/agent-config/commit/fd54b3585493c289c27acc83b625789f7bfbf17d))
* **docs:** keep the mechanics file under the depth ceiling ([fbce688](https://github.com/event4u-app/agent-config/commit/fbce68847c607f9bd421d5a486a6622b0b6b9a29))
* **gates:** the loss-class gate scanned nothing, and route (a) could not have fixed it ([02711d3](https://github.com/event4u-app/agent-config/commit/02711d3508538c2c7c43c3c363cd70151a99968b))
* **friction:** make the probe honest about its buckets and reproducible ([cd64ac7](https://github.com/event4u-app/agent-config/commit/cd64ac727e06da2974560ee0f6a9369300fb24f0))
* **chain-nudge:** three false negatives and a false positive, per review ([0aa3e6e](https://github.com/event4u-app/agent-config/commit/0aa3e6e0a8709ca563040350e0da4d12f8d20d69))
* **budget:** delete the unenforced grace_end_date, keep the enforced ceiling ([2294402](https://github.com/event4u-app/agent-config/commit/229440218c9ccdac83057cd694a50406f2d350ed))
* **tests:** follow the build chain instead of matching one flat string ([c56809b](https://github.com/event4u-app/agent-config/commit/c56809b134f4d39665016a23b556dc517cdcfe25))
* **evidence:** keep the record English, per language-and-tone ([824c1dc](https://github.com/event4u-app/agent-config/commit/824c1dcbf445944c8f1ea5fea700a2e1c0a3a1bf))
* **tests:** type the newest-note lookup so tsc can see the index is checked ([794c291](https://github.com/event4u-app/agent-config/commit/794c2913f4d71d102ee10464310c78ce56be78d6))
* **pack:** bind both defect fixes to the surface, not to one script ([368ccf2](https://github.com/event4u-app/agent-config/commit/368ccf2376e186980c543e311ade4b4e2750da8c))
* **tests:** pin the cap derivation instead of one superseded reset ([293f5fc](https://github.com/event4u-app/agent-config/commit/293f5fc17505acc25d71a2ed155313d8ed955ca5))
* **config:** reset both pack-size caps on a reconstructed clean baseline ([0d6b337](https://github.com/event4u-app/agent-config/commit/0d6b3372d72be7acddb83a2229a97c4b665e4bbf))
* **build:** clean the cli-delegate outdir, which had shipped 105 orphan chunks ([1ff6f5e](https://github.com/event4u-app/agent-config/commit/1ff6f5ec3d9acfbc0dab4023d8d24c777ee3450b))
* **flows:** map the two retired commands out, and the orphan that was already there in ([31516c5](https://github.com/event4u-app/agent-config/commit/31516c52ac473f2b77ad645e234c1e8b6684e126))
* **adr:** inline the council convergence instead of linking the session file ([249b82c](https://github.com/event4u-app/agent-config/commit/249b82caf663fe3204b932779430da89a83c8d03))
* **budget:** the ratification note pays its own always-budget cost ([6382956](https://github.com/event4u-app/agent-config/commit/63829565a59bb1cc81c83535e448c29e97f5798c))
* **governance:** route the scanned count through _lib/scan_scope ([e30720e](https://github.com/event4u-app/agent-config/commit/e30720e994dbfee2dd11200dfa24442ce5425308))
* **ci:** the task desc shadowed its own script in the reachability checker ([d456959](https://github.com/event4u-app/agent-config/commit/d4569590904bba70e852ac2506122ce7be20b49f))
* **docs:** one house-dialect word in the new contract ([f417b09](https://github.com/event4u-app/agent-config/commit/f417b09a97895f86886b3d4a8045a6047eccbf34))
* **guidelines:** nine characters over the depth ceiling ([fb5edd5](https://github.com/event4u-app/agent-config/commit/fb5edd5a289ab0f739cefaf9074218eab56fcade))
* **guidelines:** eleven `task <x>` invocations that a consumer cannot run ([2491b5d](https://github.com/event4u-app/agent-config/commit/2491b5d1d96c13e132711e1372a91a2f08d803ab))
* **tests:** three Node-shard failures, three different consequences of this branch ([d421f13](https://github.com/event4u-app/agent-config/commit/d421f13224820ea01a2e022310acb5f0afb43081))
* **condense:** src/ and src/agent-src/ are two trees, and re-anchor the kernel prefix ([f27d7b9](https://github.com/event4u-app/agent-config/commit/f27d7b9bdc0a1c57bd6003494c3d32249455c5a7))
* **ui-audit-gate:** the reuse qualification, condensed then paid for ([db46568](https://github.com/event4u-app/agent-config/commit/db46568aa0b5f461a589a6768e964c529bed9d71))
* **design-fidelity:** the blind review's three high findings, and nine more ([9717ee3](https://github.com/event4u-app/agent-config/commit/9717ee3ac53edad2d350adfa856411706cfd6d15))
* **ci:** four red jobs, all four consequences of projecting docs/guidelines ([c4d9ef2](https://github.com/event4u-app/agent-config/commit/c4d9ef2150d6e866f9f5f31a77d3b7dcf7c8678d))
* **lint:** type-only import in tolerance_shadow ([30aa704](https://github.com/event4u-app/agent-config/commit/30aa704cf91612f3675838202e902bdda3f98cf6))
* **design-fidelity:** close Phase 1 — the icon assertion, the unfollowable instruction, the prescribed order ([f6bb2a6](https://github.com/event4u-app/agent-config/commit/f6bb2a60f5b56805153ac1ee2b10d0fe4591af4e))
* **code-graph:** refuse an option-shaped rev before git runs ([41897a6](https://github.com/event4u-app/agent-config/commit/41897a6f55fdf821b0b247f5d6b24c21d4fc15d1))
* **budgets:** the host cross-check compares only what a fresh checkout can reproduce ([7f253c3](https://github.com/event4u-app/agent-config/commit/7f253c345b76bb96585f08de5dbd419625e2a8b4))
* **tests:** drop the unused tmpdir scaffolding from the cost-table tests ([15c1650](https://github.com/event4u-app/agent-config/commit/15c165090d799ce8fc5a93d6dbf6666210db6d44))

### Reverts

* **governance:** the deny stays — the replacement was refused 2/2 ([03e4eb7](https://github.com/event4u-app/agent-config/commit/03e4eb7de6b8c637cf41bbe60acb489b3a6658af))

### Documentation

* **roadmap:** record the four residuals the council agreed to ship ([053669d](https://github.com/event4u-app/agent-config/commit/053669d46334e34b98a2f0a563bb3034b683f182))
* **roadmap:** the E3 injection gate is closed by configuration, not by a stale bundle (#1997) ([4a77fe2](https://github.com/event4u-app/agent-config/commit/4a77fe23c2d4d095c75ed84499a3aebc7cb72a53))
* **governance:** record the approval-floor rollback and plan the bounded waiver (#1993) ([2a38337](https://github.com/event4u-app/agent-config/commit/2a38337f0d3b63ee80635d665c680bacbde1192c))
* **roadmap:** decide prerequisites 3 and 4 for a measured payload ceiling (#1996) ([09d9bc7](https://github.com/event4u-app/agent-config/commit/09d9bc7600de4e1535d0f164079339c104d6782c))
* **roadmap:** the headroom question, asked and answered 2/2 ([e808be2](https://github.com/event4u-app/agent-config/commit/e808be27b6eefe4b0558ab559b9a37e0bb935bc1))
* **roadmap:** four fifths of 4.4's rejection premise was already solved in the tree ([c42a72b](https://github.com/event4u-app/agent-config/commit/c42a72b668b5b4f8305c8e24f4bc8edfb5480ba3))
* **review:** rebind the findings artefact to the CI-fix head ([19ebbfe](https://github.com/event4u-app/agent-config/commit/19ebbfe19b76829aebbad0108c1ee71c339b96cd))
* **review:** record the reachability review and its three dispositions ([838ab93](https://github.com/event4u-app/agent-config/commit/838ab932560e8ebe9a8ae235cff69529840301c4))
* **evidence:** correct the run record — three of its PRs were merged meanwhile ([cb38480](https://github.com/event4u-app/agent-config/commit/cb38480c7dcf49b7fa5505c73eea9d1dbf77ba42))
* **evidence:** the drain-run summary, as the last commit of the run ([ef06ab8](https://github.com/event4u-app/agent-config/commit/ef06ab825a549c5d23cf2930d4fce1e0dfb30cf9))
* **roadmap:** record why three roadmaps stay open, and correct two premises ([5d7066e](https://github.com/event4u-app/agent-config/commit/5d7066e17f0edbd9258e6594986cc840773c1f7d))
* **review:** re-bind round 2 in place, dispositions and post-fix scope ([70e99e0](https://github.com/event4u-app/agent-config/commit/70e99e06b9d54c3dbc580e317f10399ad66d4424))
* the write share is a floor, the SHA is a base, the delta is not a result ([2655175](https://github.com/event4u-app/agent-config/commit/26551751e3d41232e616b88742df2f398a1e1849))
* **review:** round 2, and round 1 archived beside it ([252e64a](https://github.com/event4u-app/agent-config/commit/252e64a3e4aa2571a2912a2845dcb6e29fe63e34))
* **review:** rebind the findings artefact to the publish-surface head ([9d3e82b](https://github.com/event4u-app/agent-config/commit/9d3e82be5b57a9590a6163b3fc6c617be66dcaee))
* **roadmap:** close road-to-continuity-writer-activation — 10 satisfied, 1 cancelled ([2ae48cc](https://github.com/event4u-app/agent-config/commit/2ae48ccf65895536f294fb2df3dac66ea1b01b7e))
* **review:** dispositions for all thirteen findings, with the fixing commits ([65e260d](https://github.com/event4u-app/agent-config/commit/65e260d78f63121b31f92020e4939fff33bc2780))
* **roadmap:** reopen a blocker that closed on a claim the tree contradicts ([2ea4201](https://github.com/event4u-app/agent-config/commit/2ea42016ea0776da426f4218f2350fc2af6f4ac2))
* **contracts:** stop claiming a platform anchor the platform does not hold ([6bab400](https://github.com/event4u-app/agent-config/commit/6bab400a881b601e9e0bd3281c02de4f67ce055e))
* one population for every figure, and two denominators kept apart ([84d1c07](https://github.com/event4u-app/agent-config/commit/84d1c074b578d9e3888b74bbe9651977f0555497))
* **roadmap:** record why 4.4 stays open, and correct the date every reader planned against ([1d36c6c](https://github.com/event4u-app/agent-config/commit/1d36c6ca56c5e5458a1cbc24accf5feb4b3e47ce))
* **review:** rebind the findings artefact and re-derive its manifest ([439349b](https://github.com/event4u-app/agent-config/commit/439349ba68d0df937a34efd6030f4b24d154771f))
* **decisions:** the grace ceiling never expired, and three rounds decided on that premise ([85666cb](https://github.com/event4u-app/agent-config/commit/85666cbbaa5eadc880d447d954f4aef8541a588c))
* **review:** the completion-review findings, before any of them is fixed ([ed7c80e](https://github.com/event4u-app/agent-config/commit/ed7c80e1829df44e1d31bcf392d2560a84b33d56))
* **evidence:** why the confirmations recur, and which half is reachable ([ce0450c](https://github.com/event4u-app/agent-config/commit/ce0450cfbe09738a2fd80d39b8834b338bb856ef))
* **token-efficiency:** the re-measured figures, and a correction to the table ([f1dffea](https://github.com/event4u-app/agent-config/commit/f1dffea03296ec990da2fbffc50219b0f2b09e0c))
* **review:** rebind the findings artefact to the type-fix head ([da25cdf](https://github.com/event4u-app/agent-config/commit/da25cdf080f238752596374e36d9c776ed994c4c))
* **review:** record the completion review and its ten dispositions ([59cefb3](https://github.com/event4u-app/agent-config/commit/59cefb3b76e387a073abae229561e2a596964e36))
* **roadmap:** close the packed-payload cap, and record which axis it was ([d009289](https://github.com/event4u-app/agent-config/commit/d00928977a5a10c71cd076f2e7f30f0f4e8187a4))
* **roadmap:** re-review the risk register against what 3.4 actually changed ([b7f68e8](https://github.com/event4u-app/agent-config/commit/b7f68e8b4f449cb2bd2ff21cb144dcb3bc46de12))
* **roadmap:** close 3.4, resolve both its blockers, record what could not ship ([7975d41](https://github.com/event4u-app/agent-config/commit/7975d4105176231bd08ab4dadf1b062ad954fc80))
* **roadmap:** close 4.2 on ADR-272, and escalate 4.4's split to the owner ([e7faccc](https://github.com/event4u-app/agent-config/commit/e7faccc84257afaf89f0466b9f21cd25358bec01))
* **adr:** the Evidence section ADR-272 owed, and the census it moves ([6800c2f](https://github.com/event4u-app/agent-config/commit/6800c2f0096b2f33608c9464d3daa90842d2112e))
* **adr:** ADR-272 supersedes the rules-bucket ceiling once, upward, at 25,375 ([d454f90](https://github.com/event4u-app/agent-config/commit/d454f9055c50730b85c26b726a1460eb11cac06b))
* **roadmap:** re-review the risk register against what 3.1 actually changed ([5947c63](https://github.com/event4u-app/agent-config/commit/5947c631b2907e5c09c68cdf76ec388a9d538514))
* **roadmap:** close 3.1, and correct the two predictions it got wrong ([6b4ba55](https://github.com/event4u-app/agent-config/commit/6b4ba555cd32ac7e3e1fe875bf382c7b142c0bdb))
* the seven surfaces that described a cache which no longer exists ([5daa82a](https://github.com/event4u-app/agent-config/commit/5daa82a675882bbd6ae74ffce66ae8ad54b90171))
* **loss-classes:** record that the gated corpus is now empty, and why ([90e67be](https://github.com/event4u-app/agent-config/commit/90e67bed5e8ad0135fdbda4c2c7afbbbf1981145))
* **roadmap:** 5.1 closed, 5.2 and 0.2 open with the refusal recorded ([5abc3a4](https://github.com/event4u-app/agent-config/commit/5abc3a40bbdb3d1996032f49798e58ef701ad295))
* **governance:** stop asserting a mechanism that no longer exists ([9c3f86b](https://github.com/event4u-app/agent-config/commit/9c3f86bdcf25c0eab3f4e4f8788e1195ad109228))
* **adr:** ADR-271 discloses its evidence, and the install bundle is fresh ([3fb8ad6](https://github.com/event4u-app/agent-config/commit/3fb8ad622129bed9f1ebd0e43d7654e825b56856))
* **evidence:** the 14.23.0 findings ledger, 13 blocking dispositions ([409d96a](https://github.com/event4u-app/agent-config/commit/409d96a77e9be07a096d0f9dbfb87419c38704e3))
* **roadmap:** three council rounds on 1:1 fidelity and Storybook-first ([8e00a5e](https://github.com/event4u-app/agent-config/commit/8e00a5e7932ac58fc9291b31df1a7e30b3b4ea13))
* **decisions:** ADR-270 splits source corpus from host payload, and records what the council would not decide ([c8615ae](https://github.com/event4u-app/agent-config/commit/c8615aee89325dc3aca5a1c32902a30a0275220d))
* **contracts:** publish the per-host standing cost, re-pinned to a census that matches the tree ([e8a41a9](https://github.com/event4u-app/agent-config/commit/e8a41a98782706585818bf00feac6346ca3f68d6))
* **decisions:** ADR-269 abandons the Iron Law reserve, the strict ceiling stands ([dc88915](https://github.com/event4u-app/agent-config/commit/dc88915b8af53edc33d9fcfefddb2a0ed7689b85))

### Refactoring

* **hooks:** retire the hot-context cache, keep the session-index restore ([6b08a37](https://github.com/event4u-app/agent-config/commit/6b08a37d0c73fccac807c484fda1c8975f3a7d3f))
* **condense:** the projected-link rewriter moves to the lane that owns it ([514761b](https://github.com/event4u-app/agent-config/commit/514761b77cfcc997989991bbb20addeddf9b5e05))

### Tests

* **hooks:** the three sub-tests step 3.1's verify line asks for ([4a3834d](https://github.com/event4u-app/agent-config/commit/4a3834d54e557f5572230f8a6487d08fc7580337))
* **governance:** prove the base-revision invocation, which CI cannot exercise here ([f098916](https://github.com/event4u-app/agent-config/commit/f0989169ec24cea3d717b9179a5a84d015572690))
* **security:** pin the properties four 14.23.0 review findings said were missing ([e758465](https://github.com/event4u-app/agent-config/commit/e758465188a24a400f921720af11c982f62f5afd))

### Chores

* **review:** declare the completion-review skip, no code surface ([7c30e41](https://github.com/event4u-app/agent-config/commit/7c30e41e4c35ff02298a7b45f87ec7648e0db75a))
* **review:** re-bind the skip declaration after the exemption row ([82218b2](https://github.com/event4u-app/agent-config/commit/82218b212e79cf2c40328bc12de17dac60689051))
* **review:** re-bind the skip declaration to the corrected scope ([1c65494](https://github.com/event4u-app/agent-config/commit/1c65494a3c35b8175bb4a5cc435fee57e2fe671c))
* **review:** declare the completion-review skip for the wiring diff ([d1eb452](https://github.com/event4u-app/agent-config/commit/d1eb452ec40104b56acc77f653cd05546c1c372e))
* **review:** re-derive the manifest roadmap hash after the finding-8 fix ([d54ed6a](https://github.com/event4u-app/agent-config/commit/d54ed6a3e14925b67e7599c0b277b9ea8fb9430a))
* **review:** disposition all twelve findings and re-bind the round ([7b0740b](https://github.com/event4u-app/agent-config/commit/7b0740b49c7aaec71d3112cac94f10a1899bb350))
* **config:** record the publish-surface change the pyc negations caused ([4ddf345](https://github.com/event4u-app/agent-config/commit/4ddf34525643292f6c5949f0725557b6b5341a84))
* **review:** record the completion review before its findings are fixed ([726b9b8](https://github.com/event4u-app/agent-config/commit/726b9b8b9d4d79376d06862abbf08d2cf5437227))
* **ratification:** record the artifact for the platform-anchor change ([19b88df](https://github.com/event4u-app/agent-config/commit/19b88df6645802a199e0ee7114dd1d58fdb618f6))
* **hooks:** recompile the manifest after the comment edit ([6c543f0](https://github.com/event4u-app/agent-config/commit/6c543f0a268124d8018b108566d8561348623dc3))
* **roadmap:** archive the packed-payload cap, 6/6 with its blocker resolved ([d0c6a96](https://github.com/event4u-app/agent-config/commit/d0c6a9677ba65953b08e04a56d3689d256f9b1ca))
* **sync:** regenerate every surface the two retired commands were counted in ([5e16fe9](https://github.com/event4u-app/agent-config/commit/5e16fe9c7b0c9a107e37ba733b778a981fcd6ca5))
* **sync:** regenerate projections after merging origin/main ([51c7534](https://github.com/event4u-app/agent-config/commit/51c7534bf1367bb54ec22e41878a8bc987b1cac0))
* **evidence:** re-bind after the depth-ceiling fix ([e1b3a01](https://github.com/event4u-app/agent-config/commit/e1b3a01d234784b29f3a49d995ed2cf8fdc99d8f))
* **evidence:** re-bind after the portability fix ([098e6ef](https://github.com/event4u-app/agent-config/commit/098e6ef67866a55e43929a1502325ac59d8f45d8))
* **evidence:** re-bind after the ADR-evidence and bundle fix ([7f5fd9f](https://github.com/event4u-app/agent-config/commit/7f5fd9fb5fcd25783ddef4bd049a85b1a74dcdc2))
* **evidence:** re-bind after the Node-shard fixes ([bd8d7ef](https://github.com/event4u-app/agent-config/commit/bd8d7ef50b31f85674e5c148462183a6c7ac45b2))
* **evidence:** re-emit the census and host cost table at the current pin ([a3c855e](https://github.com/event4u-app/agent-config/commit/a3c855e6ea7fb6d6ab2b01b673a7270774d73e06))
* **evidence:** re-bind after the two-tree fix and the kernel re-anchor ([ebe1dfc](https://github.com/event4u-app/agent-config/commit/ebe1dfc4718913dc07bdbb3cbc3c9cef3cb300e1))
* **evidence:** re-bind after the stub-ceiling fix ([b50fd49](https://github.com/event4u-app/agent-config/commit/b50fd49d89b6f8002b9ebbf2100d098ed6753644))
* **evidence:** re-bind the findings artefact after the size-budget payback ([04cae66](https://github.com/event4u-app/agent-config/commit/04cae668f747028c290a705bf80653dec8f0c620))
* **evidence:** re-bind the R2 findings artefact to the post-fix scope ([7cfc849](https://github.com/event4u-app/agent-config/commit/7cfc849ffdd125b386cc3c8fdc673ae6c2dc29e2))
* **evidence:** re-emit the per-host standing-payload census at the merged pin ([469a075](https://github.com/event4u-app/agent-config/commit/469a07566f2fbcad069d5bf222f18a016b582dd3))
* **roadmap:** continuity-writer-activation — five of six blockers resolved by council ([7e2f548](https://github.com/event4u-app/agent-config/commit/7e2f54878b8cb18bfae4eff3348dd38e78bdf7d0))
* **roadmap:** packed-payload-cap — reproduce the baseline, and the passing reading is the wrong one ([4d5a214](https://github.com/event4u-app/agent-config/commit/4d5a21493c16676cf55773d9c84197343f3810cb))
* **evidence:** disposition the 14.23.0 findings, and answer the stub's open question ([d6053c0](https://github.com/event4u-app/agent-config/commit/d6053c0d2d6b4935dfae9fd7f147bc95fb5ba6e3))
* **roadmap:** delivery-on-hook-hosts — prerequisite met, and the E3 bar was never the obstacle ([bdb6a59](https://github.com/event4u-app/agent-config/commit/bdb6a597eb3c56eeeb8f1a62c69df5baf8cc0911))
* **evidence:** re-run the ADR census after merging main ([5becc38](https://github.com/event4u-app/agent-config/commit/5becc38871ed1167dd5c3b955a95e7d1ffd9ba77))
* **roadmap:** re-review the risk register after the surface decision ([460017a](https://github.com/event4u-app/agent-config/commit/460017a17d1accb36c4aa7750d53fbe70e17b8db))
* **roadmap:** archive iron-law-reserve-activation, re-depth its links ([36a18bb](https://github.com/event4u-app/agent-config/commit/36a18bb7bebf0a5d4dcb19985a7467edc2fd959c))
* **roadmap:** close iron-law-reserve-activation on the decide-against branch ([4b1e101](https://github.com/event4u-app/agent-config/commit/4b1e101c2aa9fdd4eb90762fa70fefbdddbab959))

### Other

* the anchor measures the trust model you chose, with a dated waiver for the risk you accepted (#1995) ([d81f2a6](https://github.com/event4u-app/agent-config/commit/d81f2a6ed24d196851fd85b280476ce534cb7a92))
* **r2:** retract the previous correction, which had the diagnosis backwards ([8b8a18f](https://github.com/event4u-app/agent-config/commit/8b8a18f0f11d534a5867769895c2e7ccfd227da1))
* **r2:** correct two prose defects in the delivery-for-every-host findings ([6e560d1](https://github.com/event4u-app/agent-config/commit/6e560d1bc19b61d1351555bc2375e9cf3ffb1bbf))
* **r2:** third re-bind, owed by the main merge and the ADR renumber ([431024d](https://github.com/event4u-app/agent-config/commit/431024d7e98f42d6a418be29bf00a465d21723d1))
* **r2:** second re-bind, owed by the derived-file half of finding 6 ([f7fb052](https://github.com/event4u-app/agent-config/commit/f7fb052ffe367dece22c5890ec5ead0082b8c700))
* **r2:** disposition all nine findings and re-bind the round to the current scope ([6d7b833](https://github.com/event4u-app/agent-config/commit/6d7b8334a85e1ebc71ed1fc2e9f9a0fb74d518e1))
* **r2:** dispatch a fresh completion review bound to the current scope ([5213861](https://github.com/event4u-app/agent-config/commit/5213861760eead0f1a96c0f4f49a9d4ff2e828a6))

Tests: 22890 (+427 since 14.23.0)

## [14.23.0](https://github.com/event4u-app/agent-config/compare/14.22.0...14.23.0) (2026-09-09)

### Release highlights

- **Behaviour changes:** the artifact-versus-brand split does not fit the standing payload (b798f4f); one skill taught the failure design-fidelity forbids (1c04ccd); name `killed-if` as the field a falsified rejection reads (7f21116); stop a vacuous parity comparison reading as a pass, and record two contracts honestly (f121cf9); compensate the standing-payload growth instead of raising the ceiling (4bdca0f); move the horizon reference material out of the per-spawn body (89658f1); +2 more.
- **Default changes + migration:** deterministic session-end record writer, default-off (1dc768d); MIGRATION entry for the readers, and regenerate the skills catalog (3fa7886); pay the activation charge and flip the default for Claude Code (ffb09a6).
- **Security and correctness:** repair the regressions #1964 introduced — a blocking guard is weakened on main (#1966) (bdbd5b7); Fix: a successor now finds its predecessor's recycle envelope (#1965) (f58ba26); block-speaking-inbox-dir refused reads it was never scoped to (82169c5); repair all seven R2 findings on the trust contract (ced1322); repair all five R2 round-2 findings (bd9962e); repair all three R2 completion-review findings (30ea290); +15 more.
- **Honest nulls:** _none_
- **Known limitations:** _none_

> **Governance mix:** governance-only 62 vs consumer-only 13 (taxonomy 1.1.0).

### Features

* **ci-settle:** refuse a verdict about a head that stopped mattering ([7a07631](https://github.com/event4u-app/agent-config/commit/7a076319734f501cdb0559ef6310340592e8479a))
* **roadmap:** the recycle envelope is written but never read — measured ([45f372a](https://github.com/event4u-app/agent-config/commit/45f372a3263375a70d3076377e5b3b92f46ac665))
* **memory:** wire the trust contract, and the corpus fixture that proves it ([b6b464c](https://github.com/event4u-app/agent-config/commit/b6b464c0aaa6deb2c62f2983760eb66d65349cc1))
* **memory:** the six-property trust contract for the session-start index ([0296fb5](https://github.com/event4u-app/agent-config/commit/0296fb5981f8de8dbb148c794ab62fbbe3b895d4))
* **hook-hosts:** close step 4.2 and resolve the predecessor blocker ([26b1876](https://github.com/event4u-app/agent-config/commit/26b1876ef8943c3d9869108c6a6ef4d9ff0985f5))
* **vendor:** anchor the vendored grammars to the locked upstream ([ca37441](https://github.com/event4u-app/agent-config/commit/ca374419226924b6a9aca50597348108acf17b6f))
* **gate:** no blocker id may be open in both an active and an archived roadmap ([85883c6](https://github.com/event4u-app/agent-config/commit/85883c600bccbe172c8bd7499dc41d291cdf4e6f))
* **autonomy:** ADR-268 plus the three receiver roadmaps from the inbox-2026-09-w drain ([9f2e714](https://github.com/event4u-app/agent-config/commit/9f2e714ae38bb8246c74a0157188b6675559169c))
* **pr-merge:** activate section 9 under ADR-266 ([0f24135](https://github.com/event4u-app/agent-config/commit/0f241359eb786f1356ab109c0883b0eeb263b545))
* **continuity:** three independent kill switches and the rollback note ([8a23f6b](https://github.com/event4u-app/agent-config/commit/8a23f6b0840a50c3635b21beb6c2b9f8e744946f))
* **continuity:** deterministic session-end record writer, default-off ([1dc768d](https://github.com/event4u-app/agent-config/commit/1dc768d442d06e9f553bc48c83b4386e799acaf7))
* **continuity:** settle the record-slot capacity policy before any writer ([7bb1bf5](https://github.com/event4u-app/agent-config/commit/7bb1bf53a6cfd0f41a1203d909b4d78b79a36dba))
* **notes:** name `killed-if` as the field a falsified rejection reads ([7f21116](https://github.com/event4u-app/agent-config/commit/7f2111668d68d2a3144c49a99a30bf1863371285))
* **mcp:** five graph tools, the pinned install hint, and the skill description ([9452f29](https://github.com/event4u-app/agent-config/commit/9452f29b4b82790c867b1e62b93ca7e82003f539))
* enforce the shrink-only standing-payload grace ceiling ([7c0d109](https://github.com/event4u-app/agent-config/commit/7c0d1096e32c93381a16cd669fecc034712237bd))
* **regression-selector:** select over the native code graph ([2d900fc](https://github.com/event4u-app/agent-config/commit/2d900fc4a2aa2166dd3472d4c8fb3148187c2442))
* **code-graph:** four gate verbs — impact, tests-for, untested, dead ([a8ff075](https://github.com/event4u-app/agent-config/commit/a8ff075c59d8a6f774b6cb02d6866e400fa647ac))
* **code-graph:** derive the tests relation and move GraphState into the engine ([a31335f](https://github.com/event4u-app/agent-config/commit/a31335f9a21acc51e66ea801f7509acf88894d7e))
* **delivery:** pay the activation charge and flip the default for Claude Code ([ffb09a6](https://github.com/event4u-app/agent-config/commit/ffb09a604b5328d9e27cad5c10f2e2dd58c91646))
* **reasoning:** a commitment horizon that is decidable, and a reopen that ends ([306df03](https://github.com/event4u-app/agent-config/commit/306df03ec6ef866519a9c81e4cd051bb38082cc4))
* **delivery:** scope thinning to a host, and prove the other hosts are untouched ([9ae0ff2](https://github.com/event4u-app/agent-config/commit/9ae0ff2889ce3c30d5cbd9432d659fc624685b2b))
* **delivery:** freeze the standing payload per host, and correct D3 from 8 to 11 ([afd1579](https://github.com/event4u-app/agent-config/commit/afd15798d798ca38b139d3721179496b20d4ae14))

### Bug Fixes

* **budgets:** record the mcp_public_tool_count move 20 -> 25 ([#1968](https://github.com/event4u-app/agent-config/pull/1968)) ([7b76059](https://github.com/event4u-app/agent-config/commit/7b76059585e30dc646ee899ff5d8620299505910))
* **hooks,design:** repair the regressions #1964 introduced — a blocking guard is weakened on main (#1966) ([bdbd5b7](https://github.com/event4u-app/agent-config/commit/bdbd5b762a1943c75040014198b7c8aba5030660))
* **design:** one skill taught the failure design-fidelity forbids ([1c04ccd](https://github.com/event4u-app/agent-config/commit/1c04ccd158c44f089ac1a18372d4062c398e9c42))
* **hooks:** block-speaking-inbox-dir refused reads it was never scoped to ([82169c5](https://github.com/event4u-app/agent-config/commit/82169c5cfa4987027a86547c52a94b66e0244636))
* **memory:** repair all seven R2 findings on the trust contract ([ced1322](https://github.com/event4u-app/agent-config/commit/ced1322f266a02ae567a32293e334b0416c16e3c))
* **continuity:** dispose of the session-index latch in the inventory ([1f8e051](https://github.com/event4u-app/agent-config/commit/1f8e05166d22c5c67da69b568daba27bba54a459))
* **hook-hosts:** move the 4.2 note under its own step, re-review the risk register ([88608f2](https://github.com/event4u-app/agent-config/commit/88608f22f522ce44e1efc5c647d107c47ff0571f))
* **review:** repair all five R2 round-2 findings ([bd9962e](https://github.com/event4u-app/agent-config/commit/bd9962e046f4132c06d33130d88a53cd6b330857))
* **review:** repair all three R2 completion-review findings ([30ea290](https://github.com/event4u-app/agent-config/commit/30ea290301b3270fc060aef459cb5a1595688857))
* **adr-263:** the 187 figure is an arithmetic error; 189 stands ([f6de539](https://github.com/event4u-app/agent-config/commit/f6de5393679268d064292964d0ab10bf8bd5c1ed))
* **archival:** refuse to archive a roadmap whose staged blockers differ from the working tree ([c3f6c00](https://github.com/event4u-app/agent-config/commit/c3f6c00565f247f3256ef25edf56e97cf013d7b7))
* **adr:** give ADR-266 the Evidence section it owes ([2876dd9](https://github.com/event4u-app/agent-config/commit/2876dd91eca6f881b26b5094ea70398450988ba5))
* **roadmap:** correct 192 -> 193, and record the drift as the finding ([a9d1bfe](https://github.com/event4u-app/agent-config/commit/a9d1bfe6e6a59a7b2bce9b20546f09572a51d72a))
* **estate:** claim the one-in-one-out offset the second receiver needs ([abdfa4e](https://github.com/event4u-app/agent-config/commit/abdfa4e4eca22eaa1759d2f0672f8a535cea6dbf))
* **contracts:** keep-beta-until must sit inside the 90-day window ([fcdfc30](https://github.com/event4u-app/agent-config/commit/fcdfc300b4a5278418fb39976a8ae58abfedfdee))
* **settings:** the two downstream surfaces the continuity section missed ([adaa5c3](https://github.com/event4u-app/agent-config/commit/adaa5c387f384ff5571f07a8298344120266b882))
* **release-findings:** disposition the eleven 14.22.0 blocking findings ([7151087](https://github.com/event4u-app/agent-config/commit/71510872cbcaec3f7e4af7e9132577b2033c9bbd))
* **roadmap:** land the blocker pointer that git mv left unstaged ([7c7d2f7](https://github.com/event4u-app/agent-config/commit/7c7d2f76d3b9a1d4edb4a59863ebd735da1c5ce7))
* **release-findings:** ingest the 14.22.0 self-review, envelope included ([4a35059](https://github.com/event4u-app/agent-config/commit/4a350592b8dfc12a125806ea45affb1e28d1cb3d))
* **ci:** the generator self-reference rule, and re-measure the delivery-set record ([3d0ce92](https://github.com/event4u-app/agent-config/commit/3d0ce9213025b5a22a791772c4e7556cd9a42dc3))
* mark the not-yet-existing ledger path as a deliberate non-reference ([2066776](https://github.com/event4u-app/agent-config/commit/2066776bbdbbd194cc8fca0d30557410fa3066fe))
* **code-graph:** repair every defect an independent completion review found ([62bfb0e](https://github.com/event4u-app/agent-config/commit/62bfb0e80395f2919849c8f8b0763200e46fc308))
* **lint:** drop the roadmap path from a source docblock ([a0b9d20](https://github.com/event4u-app/agent-config/commit/a0b9d20635c72e970e4ad0b75681693a5b29384f))
* **report:** derive the census figure instead of hardcoding a literal that went stale ([23e390b](https://github.com/event4u-app/agent-config/commit/23e390baff4bd7f88b981fd2b6520eccf82efcb7))
* **estate:** trim the skill description by one word to hold the token floor ([a2ca885](https://github.com/event4u-app/agent-config/commit/a2ca8851751de9230e556f9a49a357be8b33689a))
* **delivery:** close R2 finding 1 by measuring the shipped reach, and de-duplicate the router sets ([0870750](https://github.com/event4u-app/agent-config/commit/08707501c63ce528809c3f599b1fb3fd5293a1a5))
* **lint:** drop markdown headings and box rules from the new comments ([dac3f12](https://github.com/event4u-app/agent-config/commit/dac3f12c4e457d538c5843385c883868286de2e3))
* **budget:** reconcile the rule-inject cap onto the owner-specified charge, downward ([80769d7](https://github.com/event4u-app/agent-config/commit/80769d76a3df743d7a94d4f3395fd6d7a0e39e02))
* **report:** make the standing-payload report's own guards as strong as its sentences ([2145f18](https://github.com/event4u-app/agent-config/commit/2145f184429954c0f8b55b9958eb09d84add37e1))
* **gates:** stop a vacuous parity comparison reading as a pass, and record two contracts honestly ([f121cf9](https://github.com/event4u-app/agent-config/commit/f121cf975e18c93e825abf6830b2805ba2ddc514))
* **delivery:** make both lean_projection readers agree — same-indent hosts list, host-aware gate ([e1743b5](https://github.com/event4u-app/agent-config/commit/e1743b508480088d60ba9f0df8ee7718b90c1ae4))
* **adr:** finish the 263 -> 265 renumber inside the record itself ([0949257](https://github.com/event4u-app/agent-config/commit/0949257ab41a720fc83fb24708b41c3a2e0840d2))
* **settings:** admit lean_projection delivery + hosts in the server schema ([767b007](https://github.com/event4u-app/agent-config/commit/767b00791c26813cf64ad4312e03885ccd775e5e))
* **ci:** carry the four measurements this branch moved, none of them a threshold ([f7f0986](https://github.com/event4u-app/agent-config/commit/f7f0986f91d45c8323523fef95c0607a465e5dc0))
* **tests:** the repair record quoted the literal its own gate forbids ([4803b9d](https://github.com/event4u-app/agent-config/commit/4803b9dafda0ac8d8eb75b15ab84b72643bf5457))
* **thin-rules:** the repair record reproduced the literal the gate forbids ([b197df8](https://github.com/event4u-app/agent-config/commit/b197df81ed85f2776ee1736abffe3d4dcca2da97))

### Performance

* **mcp:** trim the graph tool surface, then re-anchor only mcp_schemas ([a904c00](https://github.com/event4u-app/agent-config/commit/a904c0046361a0ca4bbe4a4a16f217bd574bd363))
* **bench:** re-anchor thin_rule_load onto the post-E2 projection, attribution measured ([12ccf11](https://github.com/event4u-app/agent-config/commit/12ccf1158f796216d9ec775ec1efc5f0c7437085))
* **rule:** compensate the standing-payload growth instead of raising the ceiling ([4bdca0f](https://github.com/event4u-app/agent-config/commit/4bdca0f4cc6018207de8793cc2ca50e9b966ad21))
* **rule:** move the horizon reference material out of the per-spawn body ([89658f1](https://github.com/event4u-app/agent-config/commit/89658f16c0dc094a25345f492da34861530c397a))

### Reverts

* **brand:** the artifact-versus-brand split does not fit the standing payload ([b798f4f](https://github.com/event4u-app/agent-config/commit/b798f4fc0b092ead6bd67f3219b0151cefc1f81e))

### Documentation

* **roadmap:** pass 3 finds a step no first reading produced — reuse under conformity ([ff80052](https://github.com/event4u-app/agent-config/commit/ff8005276b4b6cc5bbc795f25ddcd32c29dee6ad))
* **roadmap:** road-to-design-intent-conformance — the contract is written, contradicted and unreachable ([b40531a](https://github.com/event4u-app/agent-config/commit/b40531ab91c3331867592cade6f774cb89dd9e20))
* **git-workflow:** carry the new ci_settle refusal to both surfaces that state it ([762e3a3](https://github.com/event4u-app/agent-config/commit/762e3a362074cc26391fe042fb0cd036de0e4a06))
* **vendor:** write the binary predicate threat boundary down ([620ec78](https://github.com/event4u-app/agent-config/commit/620ec78658552741f3e422890f11c0e0637eb027))
* **adr:** disposition the three adversarial findings on ADR-266 ([b57a946](https://github.com/event4u-app/agent-config/commit/b57a9469bf496ab536f1dad369b8935f2935492f))
* **adr:** record the owner ruling that activates /pr:merge merging ([c82c385](https://github.com/event4u-app/agent-config/commit/c82c385d96d0bea0b0899b967459406f46805e65))
* **roadmap:** record what Phase 1 closed, and three findings that correct it ([e2349bd](https://github.com/event4u-app/agent-config/commit/e2349bd2505a1203e3ef5927936010be3758a20f))
* **grammars:** point the refresh checklist at the manifest that exists ([9e70bc2](https://github.com/event4u-app/agent-config/commit/9e70bc29a0d1942d6cce28f234be7472bfb39a55))
* **review:** the independent completion-review findings, with dispositions ([885bc2a](https://github.com/event4u-app/agent-config/commit/885bc2a2f9bc8caa6387ffc32d356a120e583f11))
* **stub:** record the 14.22.0 findings-ledger recurrence on the existing 14.21.0 stub ([cbb26d3](https://github.com/event4u-app/agent-config/commit/cbb26d378fc54365751f1dc58b813dd79fca5a73))
* MIGRATION entry for the readers, and regenerate the skills catalog ([3fa7886](https://github.com/event4u-app/agent-config/commit/3fa7886e32eff9fbed1ece6491e6e88ad8c41e5e))
* **claims:** repoint the delivery-equivalence claim at the report that carries its figures ([ae3267f](https://github.com/event4u-app/agent-config/commit/ae3267ff56a17afc3aa07fa1cae6ead5c270bffc))
* restate the MCP standing-cost claim at the measured figure ([9716817](https://github.com/event4u-app/agent-config/commit/971681741def028ab7957563409d0026f7f0366e))
* ADR-265 gains its Evidence section ([2d6882f](https://github.com/event4u-app/agent-config/commit/2d6882f83cbc1670e6e34b10fcda558c8a5813b7))
* ADR-265 — the Iron Law reserve is refused, verifier is inside the change ([c310efa](https://github.com/event4u-app/agent-config/commit/c310efa9e4ecfd37b0ddfd348c9b3742028dc190))
* **adr-262:** disclose the evidence the accepted record rests on ([c9f064d](https://github.com/event4u-app/agent-config/commit/c9f064dda6522d0242756c8f113ea815cd2ae9ea))
* **roadmap:** re-review the risk register, and record that Risk 3 is refuted ([4e5fcf7](https://github.com/event4u-app/agent-config/commit/4e5fcf7333af24bdd2cc8d16b82ed1e9818d3978))
* **roadmap:** settle the acceptance criteria against what was actually measured ([07aaf83](https://github.com/event4u-app/agent-config/commit/07aaf831e205770688a86e14dc99af7b406718ab))
* **claims:** the delivery row said not-shipped, and 4.3 made that false ([b02ba95](https://github.com/event4u-app/agent-config/commit/b02ba958ff9341dfab8f6c9d70011738bf9ca723))

### Refactoring

* **continuity:** move is_substantive and resolvePredecessor into _lib ([117e5c2](https://github.com/event4u-app/agent-config/commit/117e5c275701f9dc632bed300c59545c51fda992))

### Tests

* **continuity:** parity in both halves the council separated ([ed06343](https://github.com/event4u-app/agent-config/commit/ed063430624a767454bdf771d0b23bd90549df5d))
* **notes:** pin the boundary set closed and the reopen cap at one ([4edecf7](https://github.com/event4u-app/agent-config/commit/4edecf7217e2b5cf07989b9273a7b845860f5e22))
* **mcp:** pair the entry-point escape case with an accepted nested path ([7bdaaec](https://github.com/event4u-app/agent-config/commit/7bdaaec90cabddd914e86a12b156578e081c27c2))
* **lean-projection:** repoint the held-change tripwire onto the shipped state ([8d52e84](https://github.com/event4u-app/agent-config/commit/8d52e84eb469daab03e9e8324d40800925a54df8))

### Build

* rebuild the install bundle after the ADR renumber ([4039b88](https://github.com/event4u-app/agent-config/commit/4039b880fc1d798a2a58bef4288a46406204d332))
* recompile hook_manifest.json after the R2 finding-1 comment landed in the YAML ([b887fe2](https://github.com/event4u-app/agent-config/commit/b887fe2a556750447cc6e1f26606c8b0e1bf6814))
* rebuild the stale install bundle and regenerate the ADR evidence census ([8e791d8](https://github.com/event4u-app/agent-config/commit/8e791d822c5ef2bf5dbaec7156f46321bf853374))

### Chores

* **estate:** claim the one-in-one-out offset the committed roadmap fires ([72dfa5d](https://github.com/event4u-app/agent-config/commit/72dfa5d90601da16bde06d9ed761663baab69848))
* **roadmap:** 3.1's second half is under-specified — record it, do not invent it ([d542bf1](https://github.com/event4u-app/agent-config/commit/d542bf14ff2eec0ce46ee4ba66fb93f5bf9ca9d8))
* **roadmap:** park road-to-skill-menu-economy — its own review trigger fired ([11ecf8a](https://github.com/event4u-app/agent-config/commit/11ecf8aedda395cecfa2dd992de328d609576adc))
* **review:** disposition the seven findings, record what the failure teaches ([39dce8a](https://github.com/event4u-app/agent-config/commit/39dce8adbb855b496b2e60fbbb87bee04d31fd85))
* **review:** R2 completion review — the trust contract does NOT hold ([a1f50ea](https://github.com/event4u-app/agent-config/commit/a1f50eaa832e5cce3f2ac8129fdbb96d9e86969d))
* **roadmap:** record 3.1's precondition as discharged, and the step as open ([4545420](https://github.com/event4u-app/agent-config/commit/4545420a941ce65a67c192a9970e45e91641c95d))
* **roadmap:** close road-to-limited-commitment-horizon Phase 3 unbuilt ([2e1b644](https://github.com/event4u-app/agent-config/commit/2e1b644bcffa1c27f7227c2300f8a88400a7a338))
* **roadmap:** apply E7 — archive the two token-saving roadmaps, carry the residue ([6d53a9b](https://github.com/event4u-app/agent-config/commit/6d53a9bc947ca9802a108f0dbaf4faf08c5a3dac))
* **roadmap:** close and archive road-to-the-14-22-0-findings-ledger ([ea3a973](https://github.com/event4u-app/agent-config/commit/ea3a973767eea70b850f8aae2a7b19b396e50ba8))
* **review:** disposition the five round-2 findings against bd9962e04 ([45c8ae8](https://github.com/event4u-app/agent-config/commit/45c8ae82535c7314641f11b039ff1a77f2edd66e))
* **review:** R2 round 2 — 5 findings, round 1 preserved ([368ba2b](https://github.com/event4u-app/agent-config/commit/368ba2bbe9a81a0cb41eda96af55d067017e5446))
* **adr:** regenerate the evidence census after the ADR-263 amendment ([ed9746f](https://github.com/event4u-app/agent-config/commit/ed9746f7c0e825b285771cc1d0e9f1b19e5f61fa))
* **review:** disposition the three R2 findings against 30ea29030 ([57dd539](https://github.com/event4u-app/agent-config/commit/57dd53925c12ab9140e54d6b3b8e4835cc7f7f76))
* **review:** R2 completion review for the 14.22.0 residuals branch ([faabcff](https://github.com/event4u-app/agent-config/commit/faabcff4a9998412b1fb2634c7f6a80217b0327a))
* **roadmap:** stub the census-store defect, repoint the archived refs ([4d0f978](https://github.com/event4u-app/agent-config/commit/4d0f978abf152f69b461bc477df9e9be55df79de))
* **roadmap:** close and archive road-to-a-blocker-that-cannot-hide-in-the-archive ([32e3ff0](https://github.com/event4u-app/agent-config/commit/32e3ff05eb51889c02502cb2441d6aa809031a52))
* **index:** regenerate the catalog for the /pr:merge description change ([bf743f0](https://github.com/event4u-app/agent-config/commit/bf743f068577689e8aeef1e95b2977bbca2ce36b))
* **adr:** regenerate the index and the evidence census for ADR-266 ([3b5a0c4](https://github.com/event4u-app/agent-config/commit/3b5a0c43c00e46a0da7b83c08b4802c1e5c9aedf))
* **review:** rebind the findings artefact after the base merge ([9d4ebfb](https://github.com/event4u-app/agent-config/commit/9d4ebfb62b542175314c06e1d24b05340a46f7cd))
* **stubs:** close the 14.22.0 ledger instance — another lane landed it ([0cd51a2](https://github.com/event4u-app/agent-config/commit/0cd51a2515b2aac52f38c4f6123f1e8130c218a7))
* **review:** final scope rebind ([c6965d1](https://github.com/event4u-app/agent-config/commit/c6965d114bf2aa2ad3fb0c42d53d8f7d98a3c7a0))
* **review:** rebind the findings artefact to the post-trim scope ([529cc55](https://github.com/event4u-app/agent-config/commit/529cc5580750e80a75be906fdde435a9c958c33f))
* **review:** rebind the findings artefact after the pointer commit ([9fa5777](https://github.com/event4u-app/agent-config/commit/9fa5777adf7371a40f3692aa98c0ca00bc776def))
* **review:** rebind the findings artefact to the post-archival scope ([4bd39e4](https://github.com/event4u-app/agent-config/commit/4bd39e4d777d4b4c546c2049d8d761c55b7bbaae))
* **roadmap:** close Phases 1 and 2 of limited-commitment-horizon ([8f350dd](https://github.com/event4u-app/agent-config/commit/8f350ddf30c56acf2bd8a79a8ae4fe5e2b2a3740))
* record the 14.22.0 findings-ledger gap as arrival 4 ([7c5dc50](https://github.com/event4u-app/agent-config/commit/7c5dc50ae4f31005e241f034bd6989d6b38de298))
* refresh the ADR evidence census after ADR-265 gained its Evidence section ([7685ab1](https://github.com/event4u-app/agent-config/commit/7685ab13c43697f8779a7df9af86e25018b00d4b))
* regenerate the artefact index, and record the pack-size re-measurement ([b37fcfa](https://github.com/event4u-app/agent-config/commit/b37fcfa82179ca8ef2e0d8d7765468dcfacafcb8))
* archive road-to-a-standing-budget-with-headroom ([225a4eb](https://github.com/event4u-app/agent-config/commit/225a4ebb898b017fa1ebecf616d5fbcb3f2977ff))
* **review:** dispatch the R2 completion review for drain/delivery-for-every-host ([7925dbb](https://github.com/event4u-app/agent-config/commit/7925dbba34443211ffff62c96e5c497eace2fa5f))
* **adr:** regenerate the evidence census after ADR-262 gained its Evidence section ([b9276f8](https://github.com/event4u-app/agent-config/commit/b9276f80e5454da6e2e4b418d0593aea07db427c))

### Other

* Fix: a successor now finds its predecessor's recycle envelope (#1965) ([f58ba26](https://github.com/event4u-app/agent-config/commit/f58ba2654e1c067a6892e78c35b5e4d36b4b8c56))
* a receiver for the archive-exclusion gap in two ratcheted gates ([f639efb](https://github.com/event4u-app/agent-config/commit/f639efbe945702ec9520e7ecdbe3827e917618ff))
* **docs:** house dialect on the lines this branch authored ([0567287](https://github.com/event4u-app/agent-config/commit/05672878156bd075757bee137d846d8f573dc4a7))
* the three residuals the 14.22.0 dispositions could not close ([8fab9b6](https://github.com/event4u-app/agent-config/commit/8fab9b6e16ac0721551f2ce1fae04192d7faad61))
* relocate the pack-size blocker, and archive a-graph-that-is-shipped ([db5c4d3](https://github.com/event4u-app/agent-config/commit/db5c4d391e59a4d3fe07ea6f5df82465fca3c367))
* Merge remote-tracking branch 'origin/main' into drain/standing-budget-approval-store ([34029ed](https://github.com/event4u-app/agent-config/commit/34029ed8847d20f090ef9d75ae3f3a703edc90d9))
* the 14.22.0 findings ledger is missing and reds the required check ([30c0c0f](https://github.com/event4u-app/agent-config/commit/30c0c0f912411fd55fcad7cf3e660697a7eaca32))
* **r2:** disposition all 14 findings and re-bind the round to the current scope ([0d5d8c9](https://github.com/event4u-app/agent-config/commit/0d5d8c9f9281bb90ce4713e7c11ef200b1b387fc))
* **payload:** re-emit the standing-payload artifact from a clean tree, with an honest pin ([87f94ac](https://github.com/event4u-app/agent-config/commit/87f94ac47682ca68d84feb99a0ee68479a85f6cd))
* **bench:** track the re-scored thin-inject report the ADR and CLAIMS cite ([9669409](https://github.com/event4u-app/agent-config/commit/966940967c222bb1bd4887edb5b2f76cdd7694b5))
* re-review the Risk Register at close, all five rows ([ae537fd](https://github.com/event4u-app/agent-config/commit/ae537fd7568d316c9e1b8e4457e0a507ca0cb326))
* close 1.3 and 2.3 on council verdicts, and discharge AC-4/5/6 ([9e4c6cd](https://github.com/event4u-app/agent-config/commit/9e4c6cd262aa5167c59b67a86fcbfeb909944002))
* **r2:** 14 findings on drain/delivery-for-every-host — 3 high, 6 medium, 5 low ([2678861](https://github.com/event4u-app/agent-config/commit/2678861a315964bf1bb3b4d5646f2769652c1a4f))
* defer standing-budget 1.3 to a named receiver, resolve its blocker ([3be6fd6](https://github.com/event4u-app/agent-config/commit/3be6fd63c541e2c5e5c1a9e19ce3f0b8b59ad90a))
* Merge remote-tracking branch 'origin/main' into drain/delivery-for-every-host ([c2273db](https://github.com/event4u-app/agent-config/commit/c2273db25d553887e56cfb8f36ee7481a8059b8a))

Tests: 22463 (+318 since 14.22.0)

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
