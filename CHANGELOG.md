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

# Era: pre-16.0.0 — archived

> All entries before `16.0.0` live in
> [`docs/archive/CHANGELOG-pre-16.0.0.md`](docs/archive/CHANGELOG-pre-16.0.0.md).
> The archive is read-only; git tags remain the canonical
> source for what shipped. Splitting them out of the main file
> keeps the active era under the 250-line drift cap enforced by
> `tests/test_changelog_eras.py`.

# Era: 16.0.x — current

> Started at `16.0.0`. Full entries live inline below.
> The drift test caps this era at 250 lines of entry body; growth past
> that forces a new era split (`# Era: 16.1.x`, etc.) — see
> [`docs/contracts/CHANGELOG-conventions.md § Era splits`](docs/contracts/CHANGELOG-conventions.md).

## [16.0.0](https://github.com/event4u-app/agent-config/compare/15.0.0...16.0.0) (2026-09-12)

### Release highlights

- **Behaviour changes:** pay the ratchets this branch moved, in the way both prescribe (6b5c574); the instrument's turn boundary was not the gate's (c510f01); pay for Iron Law 3 out of user-interaction's own prose (fa08eab); the gate cited a law that did not state the obligation (4729859); say what check_reply_consistency does, without the lint tell (755014f); a decision handed to the user outlives the turn (4b093d5); +3 more.
- **Default changes + migration:** _none_
- **Security and correctness:** refuse a repair over a file with no reading to preserve (0339e07); a dead flat key told the reader the opposite of the truth (9476a4e); drop the three imports that left with detector E (f414ee0); pay the ratchets this branch moved, in the way both prescribe (6b5c574); the instrument's turn boundary was not the gate's (c510f01); an empty checkout is not an empty instrument (fc7cdae); +12 more.
- **Honest nulls:** _none_
- **Known limitations:** _none_

> **Governance mix:** governance-only 57 vs consumer-only 16 (taxonomy 1.1.0).

### BREAKING CHANGES

* **payload:** delete the stored standing-payload ceiling ([0b20000](https://github.com/event4u-app/agent-config/commit/0b20000d48801fe4e0661660da610e1372642f7d))

### Features

* **contract:** the stop slot was never measured, and now it is once ([bf0bc03](https://github.com/event4u-app/agent-config/commit/bf0bc033e79df9e9cfb7251aed54690d6bf68248))
* **measure:** detector E was scored by nothing, so the question could only be argued ([4445246](https://github.com/event4u-app/agent-config/commit/44452468f59d79e2333e4c80956bf202ae5febf3))
* **rules:** the gate cited a law that did not state the obligation ([4729859](https://github.com/event4u-app/agent-config/commit/472985999ef97288c5791dcbba28146517ac7b76))
* **rules:** a decision handed to the user outlives the turn ([4b093d5](https://github.com/event4u-app/agent-config/commit/4b093d510213b32d9277d7ead3f69f81662d49af))
* **turn-end-gate:** record the host prompt id beside the derived ordinal ([f72ce5d](https://github.com/event4u-app/agent-config/commit/f72ce5d4cac6592435c7874f5349cf9238ce30f7))
* **measure:** score detectors C and E over a real transcript corpus ([2edc4d3](https://github.com/event4u-app/agent-config/commit/2edc4d3667d92063360ba1403d13e82e30030fa9))
* **turn-end-gate:** detector E — an untested change cannot claim done ([6e9bdb4](https://github.com/event4u-app/agent-config/commit/6e9bdb43b4f5ac29cff384c2f1a02e0ed23de1da))
* **end-review-nudge:** charge a session for its own mutation, not the tree's ([6b92b2f](https://github.com/event4u-app/agent-config/commit/6b92b2f9f7c1a4516a86e9020f4a6c9f8fcd1c0a))
* **turn-end-gate:** refuse a turn that dropped its own question ([b3fb1fd](https://github.com/event4u-app/agent-config/commit/b3fb1fdb34e7eddcbb28c5b033b9255484db86cc))
* **payload:** wire the gate to the measured ceiling and pin it to the base ref ([ed67bc2](https://github.com/event4u-app/agent-config/commit/ed67bc2da90c7f5ff0abf500b8d6584147e57554))
* **payload:** compute the standing-payload ceiling instead of storing it ([887dc77](https://github.com/event4u-app/agent-config/commit/887dc77d13b6feb7c643cb68e763c24f69c01f3a))
* **payload:** read the payload at a git ref without losing an export-ignored surface ([fd00e39](https://github.com/event4u-app/agent-config/commit/fd00e39f16b1ea552b94f5e1da593113652cbe71))
* **release:** the ingest moves into CI; the release only verifies ([f9ddbf8](https://github.com/event4u-app/agent-config/commit/f9ddbf849890df6a00676a71bdf332934a803858))
* **release:** the release settles its own findings ledger, or stops ([dc05687](https://github.com/event4u-app/agent-config/commit/dc056874369c942a63144bb60dceee27fb01d7ef))

### Bug Fixes

* **dialect:** two house-dialect occurrences in prose this branch authored ([72d2b1b](https://github.com/event4u-app/agent-config/commit/72d2b1b688f02700a2da762db2eda383017a798b))
* **ci:** the rule edit shrank a payload and the census was never re-emitted ([9a0216f](https://github.com/event4u-app/agent-config/commit/9a0216f4c7b1655af72d4e7c03b0fdc30a9b03b3))
* **settings:** refuse a repair over a file with no reading to preserve ([0339e07](https://github.com/event4u-app/agent-config/commit/0339e07c79ea2e1d8bd9318df2928026982edef9))
* **settings:** a dead flat key told the reader the opposite of the truth ([9476a4e](https://github.com/event4u-app/agent-config/commit/9476a4e7efa4381abb0ddb1db9b77139d5b65a6d))
* **ci:** the two reds the rule edits produced downstream ([d205e49](https://github.com/event4u-app/agent-config/commit/d205e49fbef28e1d9b95e9c90081c40ef1b37701))
* **turn-end-gate:** drop the three imports that left with detector E ([f414ee0](https://github.com/event4u-app/agent-config/commit/f414ee0505f2168cd78fc6ea0db2b476625b7597))
* **ci:** pay the ratchets this branch moved, in the way both prescribe ([6b5c574](https://github.com/event4u-app/agent-config/commit/6b5c5742ff1955d27bd12ae9ada207eb7e929b84))
* **measure:** the instrument's turn boundary was not the gate's ([c510f01](https://github.com/event4u-app/agent-config/commit/c510f016302a6e7e3af379c30e1717d6df2d399e))
* **rules:** say what check_reply_consistency does, without the lint tell ([755014f](https://github.com/event4u-app/agent-config/commit/755014fac789b2cb5c3b052368443bc45ff4481f))
* **interruption-report:** an empty checkout is not an empty instrument ([fc7cdae](https://github.com/event4u-app/agent-config/commit/fc7cdae49d2dbed1c90e969ab97dcfa67e75adc2))
* **turn-end-gate:** read the closing reply from the field the host hands us ([dae0f5a](https://github.com/event4u-app/agent-config/commit/dae0f5a57cb7a9e927896f69084822a4658bb85a))
* **ci:** the two reds the merge produced — house dialect and a stale census ([32e10c6](https://github.com/event4u-app/agent-config/commit/32e10c639da1dc8a07025c6d397ae37d10b089d0))
* **census:** drop the census hunk main reverted out from under it ([1e5003f](https://github.com/event4u-app/agent-config/commit/1e5003fb89225e650c4fa9dbb28169530cfc6a25))
* **guidance:** the suite argued against the diagnostics the developer needs ([17eca4f](https://github.com/event4u-app/agent-config/commit/17eca4f39de90e9e97b48f8a8bdc45838db1d8fd))
* **hooks:** act on the R2 completion review — six fixed, four recorded as limits ([16d7354](https://github.com/event4u-app/agent-config/commit/16d7354fdfecad08562cb9cf30e06b2b87c5d1db))
* **hooks:** act on the neutral review of this branch ([2ffd518](https://github.com/event4u-app/agent-config/commit/2ffd51848b8f026bdb17e908475544f47c0fcbed))
* **census:** re-emit the standing-payload census main left stale ([c545a2e](https://github.com/event4u-app/agent-config/commit/c545a2ea7bd4c32cb6f356470051d55b2ff63fb9))
* **payload:** an unestablished ceiling reports, it does not report over-budget ([c8dbd3f](https://github.com/event4u-app/agent-config/commit/c8dbd3f3504ec526adfdd4daf234fbdb55ce54b8))
* **payload:** clear three gates this branch reddened ([52624be](https://github.com/event4u-app/agent-config/commit/52624bed54f18a9dd864eb08816448639aa48772))
* **release:** the three red checks, and the round-4 critical underneath one of them ([41a5825](https://github.com/event4u-app/agent-config/commit/41a5825e733eed95fc5cb1104afc6b30558d125b))
* **release:** finish the step renumbering, with the grep that finds the rest ([e77ff05](https://github.com/event4u-app/agent-config/commit/e77ff059fb84bb490127c5b26d411070cd5be91b))
* **release:** step 7 asks both its questions on every path, including the merged one ([a8584b5](https://github.com/event4u-app/agent-config/commit/a8584b53ac1be78902ac1b79359435cdaf1325ba))
* **ci:** the ledger job can actually produce a ledger, and its push creates checks ([6fdeb02](https://github.com/event4u-app/agent-config/commit/6fdeb02ccb4e50c4e6572731990febe204d2572a))
* **release:** the round-2 findings that do not depend on where step 7 sits ([fa65049](https://github.com/event4u-app/agent-config/commit/fa650493d2c6412e7e6b1a7879fc575bd6c42fee))
* **release:** every finding the independent review raised against step 7 ([096975b](https://github.com/event4u-app/agent-config/commit/096975b11df53a0895bde015e130b47af19d501d))
* **contracts:** state the mechanism in the contract instead of linking a roadmap stub ([633372e](https://github.com/event4u-app/agent-config/commit/633372e7c4281bd64927c36931abfcfe68cfe363))
* **release:** carry the integrity fields the ingest used to drop ([fa6ee54](https://github.com/event4u-app/agent-config/commit/fa6ee54d6baa3e2453589e2053bedb72801fd96c))
* **roadmap:** name the file this roadmap creates without a code span ([18c756a](https://github.com/event4u-app/agent-config/commit/18c756a01bbb0e85d05b9818c1f72932a2219203))
* **roadmap:** make every open blocker decidable and every cited path resolve ([4c5e758](https://github.com/event4u-app/agent-config/commit/4c5e758efd4689b1056e7be1408d5f8156b81c90))

### Documentation

* **roadmap:** settings-writer residual debt closes at 7/7 ([b4ebd39](https://github.com/event4u-app/agent-config/commit/b4ebd39b3c76ba6808cf597719fea77accf76916))
* **roadmap:** three blockers close, and all three rested on a wrong premise ([33866bd](https://github.com/event4u-app/agent-config/commit/33866bd4aee9e0fdc54d59cc03c4ff982d732387))
* **hooks:** cite the blocker by id, not by roadmap path ([75c3182](https://github.com/event4u-app/agent-config/commit/75c31820bbc8267a64202d8eb86524bdee4ae5e6))
* **roadmap:** close a blocker parked on a premise the tree refutes ([d10780e](https://github.com/event4u-app/agent-config/commit/d10780e6d869fe6654c929a8ff29037cc2f558d4))
* **hooks:** say what an advisory stop verdict does not establish ([2b30bbe](https://github.com/event4u-app/agent-config/commit/2b30bbeaa0797b483434d5ca91bb378661588137))
* **roadmap:** record the second arrival on the roadmap it produced ([07d3e6a](https://github.com/event4u-app/agent-config/commit/07d3e6a9dfdf4158bd6bd7aab0d5c2f69038a7f5))
* **roadmap:** plan the stop slot that knows it continues ([b7cec61](https://github.com/event4u-app/agent-config/commit/b7cec6186e6d2ad6594f9213160eda950f84d9d1))
* detector E measured — 1 fire in 335 turns, and it is the reported failure ([b775eb7](https://github.com/event4u-app/agent-config/commit/b775eb7a77b2d912272d9831e391704bad36f6f9))
* **review:** re-bind the findings artefact to the final scope ([1db000d](https://github.com/event4u-app/agent-config/commit/1db000d48f770646a55e20a0378eb85f22b614ef))
* record why the suite did not require a test, and ADR-277 ([9266727](https://github.com/event4u-app/agent-config/commit/926672786a52cbdeac69ca1d8862c68ffa58fbcd))
* **review:** re-bind the findings artefact and disposition all ten rows ([e5067ed](https://github.com/event4u-app/agent-config/commit/e5067edaa389c48805e48fee9e760956d81acfa0))
* **review:** the R2 completion review of this branch, as returned ([bd8cf02](https://github.com/event4u-app/agent-config/commit/bd8cf020a4c8765940d2bfcb1c45d7c1e4408ea5))
* **adr:** record the bypass-recovery drill and retract the limit it removes ([bddb1f2](https://github.com/event4u-app/agent-config/commit/bddb1f26935a918797bad78157c31112f89fb11a))
* **roadmap:** close every step of road-to-a-question-that-survives-the-turn ([1db53fb](https://github.com/event4u-app/agent-config/commit/1db53fb04dfe26fa202a4a77d1fd38b15aa3fe88))
* **roadmap:** a question that survives the turn ([7ff3d16](https://github.com/event4u-app/agent-config/commit/7ff3d16af47a6a09cc241fc298860f8a6dd91f54))
* **evidence:** the last two beta windows, read against evidence and not a date ([66b3d0c](https://github.com/event4u-app/agent-config/commit/66b3d0c5c0cd5c7e3fce32780756952b8e57cc98))
* **payload:** record ADR-276 for the stage-2 deletion and the required check ([367a789](https://github.com/event4u-app/agent-config/commit/367a78913aa9f028a6ba7e817ddaf126f1b3b2d7))
* **harness-expectations:** repair the deferred-tool pointer by measuring it ([ee0a3ed](https://github.com/event4u-app/agent-config/commit/ee0a3ed7212232acc432445e38be00b304bd7861))
* **evidence:** the four contracts lapsing 2026-09-15, read one at a time ([a1e7016](https://github.com/event4u-app/agent-config/commit/a1e7016f2584febc3a006485ec3ac7334163128b))
* **adr:** give ADR-275 the Evidence section its accepted status owes ([1a77527](https://github.com/event4u-app/agent-config/commit/1a775272b1f104d7eb99f63f0d8830e25d845a9d))
* **payload:** bump the risk-register review marker to this change ([37e8c3b](https://github.com/event4u-app/agent-config/commit/37e8c3b4fa9ff008fa9a5c3d83d55e7e53f1bfc9))
* **payload:** record ADR-275 and keep roadmap step 4.4 open on the sequencing verdict ([9185b58](https://github.com/event4u-app/agent-config/commit/9185b58287dcb4899cc878e7f91db35c5f1ad4af))
* **evidence:** round-4 review — the PAT fixed the push and step 7 still cannot see the ledger ([fb5a102](https://github.com/event4u-app/agent-config/commit/fb5a102bab0fc0c38f1cf1895a2d6a860f4f7993))
* **release:** the PAT is a requirement now, and --no-wait means something else ([582e34c](https://github.com/event4u-app/agent-config/commit/582e34ca55ab348e600cd576b061b4a35b0bc010))
* **evidence:** round-3 review — the CI design does not work either ([7d1d33c](https://github.com/event4u-app/agent-config/commit/7d1d33cfe2db39b102d45925ba3c1ed23b93e890))
* **evidence:** round-2 review of step 7, before its fixes ([b4e0db5](https://github.com/event4u-app/agent-config/commit/b4e0db535538fcb4d358e81d1b48f0dd39d491ef))
* **evidence:** drop the skip declaration the code made false ([2c64869](https://github.com/event4u-app/agent-config/commit/2c6486910bc3a0bfa803245aa109a99d099c3db9))
* **evidence:** the independent review of the findings-ledger step, before its fixes ([27feb3b](https://github.com/event4u-app/agent-config/commit/27feb3b0683a206e7f44c4f3826f99c9590229ea))
* **release:** teach the runbook staleness check about step 7 ([0aaebec](https://github.com/event4u-app/agent-config/commit/0aaebec7e14e34112724d4a9df6aa35a2f5aa4b0))
* **release:** three surfaces that said a human runs the ingest ([b8cddc3](https://github.com/event4u-app/agent-config/commit/b8cddc341b9c0e29ce58767cef66c7c96f1f6eaa))
* **evidence:** re-declare the completion-review skip after the arrival record ([f7187c1](https://github.com/event4u-app/agent-config/commit/f7187c1385fb2773825a37af8464d04b11d19329))
* **roadmap:** arrival 6 on the missing release ledger, recorded instead of paid off ([57163ae](https://github.com/event4u-app/agent-config/commit/57163ae3cf23ad7386fc4079627f8003c33b1839))
* **evidence:** re-declare the completion-review skip for the round-z receiver ([c3188ab](https://github.com/event4u-app/agent-config/commit/c3188ab6cb35f52ffbc604a440d7d47d795fca70))
* **roadmap:** one receiver for inbox round inbox-2026-09-z, and three corrected counts ([3ba9d04](https://github.com/event4u-app/agent-config/commit/3ba9d04a27d8ebb106d62969d5ec474f4bb88206))
* **evidence:** re-declare the completion-review skip for the grown scope ([5d7497a](https://github.com/event4u-app/agent-config/commit/5d7497ac2fd612dc7df98183ec4067d5dc701f4e))
* **roadmap:** record that stability is evidence-driven, and that the date gate is going ([e198ad1](https://github.com/event4u-app/agent-config/commit/e198ad15060a3702c48e20304a5b8474fe61b8bb))
* **roadmap:** record the council reading on release-sizing, and the fact it did not have ([625aca4](https://github.com/event4u-app/agent-config/commit/625aca4855cecb376a87a0d14c24f4f710e2ce62))
* **roadmap:** record that the first of the six beta lapses has fired ([b4c077b](https://github.com/event4u-app/agent-config/commit/b4c077ba94567eecaceda73ef6020ddd43eb859b))
* **evidence:** declare the completion-review skip for a markdown-only diff ([a0922a3](https://github.com/event4u-app/agent-config/commit/a0922a3d02e968b3571786a4c9f328ceaad08528))
* **roadmap:** put the arrival count on the held objects that absorb the repeats ([2dc60dc](https://github.com/event4u-app/agent-config/commit/2dc60dc5ff633e32d266787b51e8fcebf91851e3))
* **roadmap:** ten receivers from inbox rounds inbox-2026-09-y and the deferred w batch ([9d3e40a](https://github.com/event4u-app/agent-config/commit/9d3e40ab08d5212d7aa42f92ab3308d277d3c939))

### Refactoring

* **rules:** pay for Iron Law 3 out of user-interaction's own prose ([fa08eab](https://github.com/event4u-app/agent-config/commit/fa08eab6c3a966883a426c5f7c13f81ec8b82184))

### Tests

* **payload:** give the host-reading fixture a base ref the CI resolver can find ([88ffd25](https://github.com/event4u-app/agent-config/commit/88ffd2592997d5d5739bc17c23e1ff8e4639c4dd))
* **payload:** pin the stored ceiling's ABSENCE and move the ratchet to its new subject ([4d4071d](https://github.com/event4u-app/agent-config/commit/4d4071d52159b30d97e3f7864b6401b86d4f19cc))
* **install-layout:** port the conformance test the contract has been claiming ([3232bde](https://github.com/event4u-app/agent-config/commit/3232bded67f4e118010d77c4b4a871726246866b))
* **install-scopes:** restore the safety regression the contract has been missing ([c6c5d93](https://github.com/event4u-app/agent-config/commit/c6c5d934a1a17464d4455916a435debad1b03e19))
* **payload:** pin the measured ceiling, the ledger contract and the base reading ([6fd17f1](https://github.com/event4u-app/agent-config/commit/6fd17f177292d68eaa199ff343f52815e2de3c46))

### Build

* **install:** carry the bundle the new export changes ([4d2824c](https://github.com/event4u-app/agent-config/commit/4d2824c80d2db671892187fdfcf0151a45e5101c))

### Chores

* **roadmap:** archive road-to-a-stop-slot-that-knows-it-continues ([b4a0d7d](https://github.com/event4u-app/agent-config/commit/b4a0d7db716621077e126f7a56c534345db05cd5))
* **review:** rebind the findings artefact across the merge, and say what moved ([ca8b1d5](https://github.com/event4u-app/agent-config/commit/ca8b1d58ed15becb5874de745cb8fdb76764b6ab))
* **roadmap:** archive road-to-settings-writer-residual-debt ([d5c7d80](https://github.com/event4u-app/agent-config/commit/d5c7d801da1619ffb70c472a9d4ba626fe91e439))
* **review:** rebind once more — the CI fixes moved the reviewed content again ([ad3edbd](https://github.com/event4u-app/agent-config/commit/ad3edbd9b276e4b92700c212fef3d60dc3e46de7))
* **census:** re-emit the standing-payload census and its derived table ([0361c66](https://github.com/event4u-app/agent-config/commit/0361c660930bd6ba39de8459393a521b392965f7))
* **review:** rebind the findings artefact to the scope its fixes produced ([4f19709](https://github.com/event4u-app/agent-config/commit/4f1970935696688ce330b88e745236071ff4e432))
* **review:** bind a fresh completion review to the new scope ([184a5aa](https://github.com/event4u-app/agent-config/commit/184a5aadec7dadb17db3eba267737b5efcbca16e))
* **roadmap:** archive road-to-a-question-that-survives-the-turn ([5bbcafa](https://github.com/event4u-app/agent-config/commit/5bbcafaa8e84aa3f3cd212aa3ea2e2652d757629))
* regenerate the projection after the rule amendment ([23d173e](https://github.com/event4u-app/agent-config/commit/23d173e1744e352ea911148dc5704d1748e434f3))
* **admissions:** record the review-baseline concern admission ([7fc661f](https://github.com/event4u-app/agent-config/commit/7fc661f148898f63944b8d4011e238a7df245d8e))
* **adr:** re-render the evidence census after the ADR-276 edit ([4a08cdf](https://github.com/event4u-app/agent-config/commit/4a08cdf08f975c34c60b4ab14f505e6dccb712a8))
* **continuity-surface:** record the review-baseline state as excluded ([76e53e2](https://github.com/event4u-app/agent-config/commit/76e53e2084d92f31cbd3f89fadeacd87e74649e6))
* drill paragraph to exercise the payload bypass recovery ([008c073](https://github.com/event4u-app/agent-config/commit/008c0737dffeab85b543c98ff337d11617a9109d))
* **adr:** re-render the evidence census after the base merge ([82ae9a4](https://github.com/event4u-app/agent-config/commit/82ae9a47a7806e3855061ff094d041dac78c537d))
* **adr:** regenerate the evidence census for ADR-275 ([664292a](https://github.com/event4u-app/agent-config/commit/664292a6aba5648c56c0a30493f1bfa9989f6829))

### Other

* Revert "chore: drill paragraph to exercise the payload bypass recovery" ([7ca40bd](https://github.com/event4u-app/agent-config/commit/7ca40bdb589c386ca6b8b2d5e39f323b6d55247c))
* **contracts:** promote surface-tiers to stable, on evidence ([5b7909f](https://github.com/event4u-app/agent-config/commit/5b7909f6bed749fddefe0e4aa49a732fed4fc123))
* **gates:** a passed keep-beta-until stops reding CI ([5c5d87a](https://github.com/event4u-app/agent-config/commit/5c5d87a8c711ce6082ce8dc53b31c4f6dd65070a))
* **r2:** re-bind the skip declaration to the scope its own commit produced ([7f455bf](https://github.com/event4u-app/agent-config/commit/7f455bfbf99790c6c04fd9ddc0b22ddcf3db7b48))
* carry the review's own independence declaration into the ledger, and declare the docs-only skip ([f4a9ddc](https://github.com/event4u-app/agent-config/commit/f4a9ddc7db8f08de05bc10ed50e6df58b4729596))
* ingest and disposition the 15.0.0 release findings ([353a36a](https://github.com/event4u-app/agent-config/commit/353a36acd81cd99ce22e853e6c87490d6c798b1e))
* split release-sizing on its lapse, promoting only the half with a record ([b7fb300](https://github.com/event4u-app/agent-config/commit/b7fb3000112da6b5c86bf8fd042473a5bd8c86e5))
* restore run 21, and file this run as run 24 ([3121bd7](https://github.com/event4u-app/agent-config/commit/3121bd7eff4cee3c97d2792b85523ffe7de6b081))
* the drain run summary -- one roadmap parked, four council rounds, one reversal ([f8ce3d2](https://github.com/event4u-app/agent-config/commit/f8ce3d2a2c51db7b50c9b6c939bb6a4bed69180b))
* the primary-goal obligation is 0 of 6, and the disposition is not the agent's to take ([c928c53](https://github.com/event4u-app/agent-config/commit/c928c532e015091bea94deca000a68542ebcfa2a))
* **contracts:** promote release-sizing to stable, on evidence rather than on a date ([106dd5a](https://github.com/event4u-app/agent-config/commit/106dd5a3ea65560fe46f00d72309fbf773b54056))
* the confound, and the census regenerated onto a pin that resolves ([5c9e3ac](https://github.com/event4u-app/agent-config/commit/5c9e3ac32eb8ce3815cfa1bb4d2947fbe5e1a92c))
* **delivery-on-hook-hosts:** tick two ACs on their own terms, record three council rounds, park behind an enforceable wake ([7f80272](https://github.com/event4u-app/agent-config/commit/7f80272acdb31ff41f9add7a621d96c2b5817e13))
* the claude injection row stays unobserved, and says what tried to move it ([392d016](https://github.com/event4u-app/agent-config/commit/392d0164b1a7a2f2011aa7b484d139f0fcb7d704))
* four ordinary-work turns judged against E3, and the confound that invalidates all four ([fa11d3b](https://github.com/event4u-app/agent-config/commit/fa11d3b820a76612071ff45ee7a959fc5519d92c))

Tests: 23089 (+199 since 15.0.0)

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
