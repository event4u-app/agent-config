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

- **`agent-config init` no longer overwrites a managed file you have edited.**
  Owner ruling, 2026-09-21, taken after an AI council split 1/1 on it. Until
  now the installer's `_resolve_file_conflict` returned `write` for every
  deployed file and its header recorded `--force` as an accepted no-op
  "because installs always overwrite" — while the planner had, since the
  preceding change, produced a list naming exactly the files you had edited.
  The report named the file and the next install replaced it.
  A managed file whose bytes diverge from the SHA-256 the install manifest
  recorded is now **preserved**, and the package content it would have been
  replaced with is staged beside it as `<path>.agent-config.new` — a
  tool-owned suffix, not a bare `.new`, so the installer never claims a
  namespace other tools already write into.
  **The staleness is deliberately loud, and that is the load-bearing half.**
  Preserving an edit leaves the active installation not-current, and a stale
  install exiting `0` would make that silent. So a run that preserved anything
  exits **`3`** (new, distinct from `0` success, `1` failure and `2` usage),
  names each preserved file on stderr with the sentence "the active
  installation is not current", and prints a count. Under `--progress-ndjson`
  the count also rides on the terminal `done` frame, which the wizard's apply
  route forwards as `summary.conflicts`; a zero-conflict run's frames are
  byte-identical to before. **`--force` is now a real escape hatch** — it
  replaces the managed file and exits `0`.
  Scripts that treat any non-zero exit from `init` as a failure will see `3`
  on a tree with local edits. That is the intended signal, not a regression:
  the install did complete, and the tree is not current.
  Three things are deliberately absent. There is **no semantic
  classification** — one byte of divergence from the recorded digest is the
  whole test, because a format-aware diff would pull per-format parsers into
  the installer's trusted computing base and a syntactically trivial edit can
  still be intentional. There is **no fallback to overwriting** under conflict
  volume or resource pressure, and no bulk accept flag. And an **existing
  sidecar is never clobbered**: identical bytes are a no-op, anything else
  fails the run with the package content staged nowhere, because a pathname
  matching the convention is not proof the installer wrote it.
  The verdict is computed from a re-hash of the destination **at the moment of
  the write**, not from the plan: the planner's conflict list is advisory
  state, and a plan-time verdict is blind to an edit made in between.

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

# Era: pre-16.1.0 — archived

> All entries before `16.1.0` live in
> [`docs/archive/CHANGELOG-pre-16.1.0.md`](docs/archive/CHANGELOG-pre-16.1.0.md).
> The archive is read-only; git tags remain the canonical
> source for what shipped. Splitting them out of the main file
> keeps the active era under the 250-line drift cap enforced by
> `tests/test_changelog_eras.py`.

# Era: 16.1.x — current

> Started at `16.1.0`. Full entries live inline below.
> The drift test caps this era at 250 lines of entry body; growth past
> that forces a new era split (`# Era: 16.2.x`, etc.) — see
> [`docs/contracts/CHANGELOG-conventions.md § Era splits`](docs/contracts/CHANGELOG-conventions.md).

## [16.1.0](https://github.com/event4u-app/agent-config/compare/16.0.0...16.1.0) (2026-09-28)

### Release highlights

- **Behaviour changes:** design-fidelity becomes provable, and the auto-rule bucket gets a ratchet (#2058) (107a210); split the ladder context and pay both size ratchets back (27daf4e); restore the concrete verification tools in autonomous-execution (e12e3c2); clear the six reds this branch created, and pay the payload cost honestly (bbdbcad); a delivery block, Class C at every key (018f729); tests are evaluators, and two gates that see the cheap half (64fcc3d); +8 more.
- **Default changes + migration:** regenerate the install bundle for the per_phase schema default (a5759da); move both MIGRATION.md refusals out of release.ts (ad5f26b); register the migration-section gate outside the ratification self-watch (d0ff02a); refuse a major cut whose BREAKING section has no migration entry (2bb5176); give 15.0.0 and 16.0.0 the sections their BREAKING entries earn (d720135); separate the template default from the parser fallback, in ten places (295e753).
- **Security and correctness:** stop the reach:doctor witness watching shared mutable state (f83ce46); repoint the codex writer citation after the second line shift (4ad8939); surface preserved files instead of swallowing every conflict channel (2d96040); stop the rule rewrite from dropping a preserved file's frontmatter (78e77b1); stage the file the installer would have written, and record it (eecbaa0); repoint the codex writer citation after the line shift (157482d); +29 more.
- **Honest nulls:** record a third exposure reading and the first near-miss (fabcaa5); record the independence level per group, closing AC-2 (af398a1); record the post-merge exposure reading as a dated addendum (dfa5bcb); prepare the rule-13 split as one verified, unapplied decision (2615000); pre-register release-hold-refuses-declared-state as unbacked (f599a4b).
- **Known limitations:** surface preserved files instead of swallowing every conflict channel (src/ui/pages/WizardPage.tsx declares a residual) (2d96040); stage the file the installer would have written, and record it (src/scripts/install.ts declares a residual) (eecbaa0); keep recorded digests across runs, so preservation survives (src/scripts/install.ts declares a residual) (539b08c); move the preservation state machine out of install.ts (src/scripts/install.ts declares a residual) (dfb10aa); preserve a user-modified managed file instead of overwriting it (src/scripts/install.ts declares a residual) (86fb653); write the transaction log from the headless apply path (#2057) (src/scripts/install.ts declares a residual) (5ca2d5b); +10 more.

> **Governance mix:** governance-only 89 vs consumer-only 21 (taxonomy 1.1.0).

### Features

* **corpus:** re-derive threat-modeling and database corpora ([6991eea](https://github.com/event4u-app/agent-config/commit/6991eeab900adb08f89b13b36960b4c20aba1016))
* **install:** preserve a user-modified managed file instead of overwriting it ([86fb653](https://github.com/event4u-app/agent-config/commit/86fb653f2304d743fc668546c2e4a5d5c1a6201f))
* **install:** write the transaction log from the headless apply path (#2057) ([5ca2d5b](https://github.com/event4u-app/agent-config/commit/5ca2d5b1ac0cc28deb4a2104458f6547c75dc1b4))
* design-fidelity becomes provable, and the auto-rule bucket gets a ratchet (#2058) ([107a210](https://github.com/event4u-app/agent-config/commit/107a21051f659aea4b9f362ecc7bd2d03903376d))
* **roadmap-template:** split rule 13, add release-holds rule 28 (#2055) ([47bb077](https://github.com/event4u-app/agent-config/commit/47bb0771991ee696d880857f2e2d7fd8209fa174))
* **lib:** a per-test independence record, so a level can be checked ([ca0dbca](https://github.com/event4u-app/agent-config/commit/ca0dbcae86ef1fbb3c67a9add1fb1f1d2080d3aa))
* **continuity:** the mission record, council transport, and the authority path ([85b9a55](https://github.com/event4u-app/agent-config/commit/85b9a55c1396a4fe9f2b5fb95310b426956dddd7))
* **guardrails:** what rides along, the typed-op watch, and the council's veto ([53fd5dc](https://github.com/event4u-app/agent-config/commit/53fd5dc755e243e3f07c5272614f680ea802c993))
* **sync:** a cascade base, and an unenumerated conflict routes instead of halting ([7d69218](https://github.com/event4u-app/agent-config/commit/7d692181d39654d222ab3a706da01e47f429ac10))
* **forge:** the six required layers, and doctor reads forge protection ([43bcf72](https://github.com/event4u-app/agent-config/commit/43bcf725ba7211ae8b68dc1d3d2076b8405c8ac1))
* **docs:** a per-host destructive column, measured rather than asserted ([0e100f1](https://github.com/event4u-app/agent-config/commit/0e100f17c560b2afd43fb72b7789f6290e063f7b))
* **roadmap:** prepare the rule-13 split as one verified, unapplied decision ([2615000](https://github.com/event4u-app/agent-config/commit/26150006d28a9b491c02f6ef8e8ef83c7bf5898f))
* **loops:** give the run-terminal vocabulary its three consumers ([fb3aa4e](https://github.com/event4u-app/agent-config/commit/fb3aa4ed7911907777f3ededc67ad9a6f19bf0a7))
* **claims:** pre-register release-hold-refuses-declared-state as unbacked ([f599a4b](https://github.com/event4u-app/agent-config/commit/f599a4b264a824d797b2b2e99915bb99b3bff82c))
* **roadmap:** land release-holds Phase 0.1-0.3 with three measured corrections ([104f08c](https://github.com/event4u-app/agent-config/commit/104f08c120847c6bb0c0b1132fe70ab128dd2712))
* **gates:** add a _lib-export-reach axis to check_gate_reachability ([496482a](https://github.com/event4u-app/agent-config/commit/496482a3c4279f56e6a8449e7fb71f004a7e52ea))
* **config:** declare the five loop surfaces and their instruments ([dc6d96d](https://github.com/event4u-app/agent-config/commit/dc6d96d26889b34d5791b2881d391279cd849b77))
* **install:** three-state ownership in the conflict matrix ([71a4580](https://github.com/event4u-app/agent-config/commit/71a4580070b49489951c25b7ed463b2a106dbfac))
* **settings:** a delivery block, Class C at every key ([018f729](https://github.com/event4u-app/agent-config/commit/018f7294360b662bad3a978937a10b69f37b93b3))
* **install:** read the recorded per-file digest the manifest already carries ([8624ca5](https://github.com/event4u-app/agent-config/commit/8624ca5bcfd110577a976dfb3dec3e4f71f4308a))
* **conformance:** the txlog check can go non-green, and its remedy is true ([a2bc8ef](https://github.com/event4u-app/agent-config/commit/a2bc8ef76b1ddf2444841b1230743db8d370d912))
* **gates:** tests are evaluators, and two gates that see the cheap half ([64fcc3d](https://github.com/event4u-app/agent-config/commit/64fcc3da23caf0492fce20a70336e91ad05d747b))
* **execution:** route mid-run residue by the same ownership table ([8585311](https://github.com/event4u-app/agent-config/commit/85853118c16ae11efc14d66490ef47dcc3753da5))
* **scope:** enumerate scope growth by ownership, not by size ([0bd6db4](https://github.com/event4u-app/agent-config/commit/0bd6db4b3dfe47a8073c3acb7690b1b27b533681))
* **hooks:** add the turn-end obligation reader, in shadow ([70b3559](https://github.com/event4u-app/agent-config/commit/70b3559bd06204732c3d1c27dde3cb4dc7713399))
* **census:** four axes, and the two targets that are actually measurable ([89a3838](https://github.com/event4u-app/agent-config/commit/89a3838f4dd40cacc394809a95518ea419e5c3b7))
* **run-continuation:** a run cannot end with red CI while its checkboxes read complete ([6baf897](https://github.com/event4u-app/agent-config/commit/6baf89735d2b98f86b4f231476f9ddf7f04e1f5c))
* **rules:** the fix-loop bound triggers a strategy change, never a question ([06a9f0b](https://github.com/event4u-app/agent-config/commit/06a9f0b896e713960e274f74ec378f9b833aba5e))
* **ask:** use the host's native primitive, and ask residue instead of filing it ([e236e88](https://github.com/event4u-app/agent-config/commit/e236e88e8dd3fc0abeeb409fac7ce4903711f260))
* **hooks:** mount the conformance verdict in shadow, block path untouched ([09be9ca](https://github.com/event4u-app/agent-config/commit/09be9ca0f9f88bc46756ac11afadc6ef06e441a3))
* **hooks:** record each host's ask shape as a manifest row ([4c52daf](https://github.com/event4u-app/agent-config/commit/4c52daf8d5470ba49f999d6e84cb3fac598f635c))
* **blockers:** a judgement call is closed, never parked ([5ed431b](https://github.com/event4u-app/agent-config/commit/5ed431b046c8bf82f89e974755257d8ed7a0b5d6))
* **hooks:** give the delivered-obligation record a ledger and two doctor lines ([ee388dc](https://github.com/event4u-app/agent-config/commit/ee388dc764106cfbe146f97ac30b220cf62f99e1))
* **skills:** contract the five behavioural stories and the breakpoint rows ([74ae80b](https://github.com/event4u-app/agent-config/commit/74ae80bd4e21e9abef36529ae2a07350943a6f56))
* **council:** the owner-facing options block becomes conditional on ownership ([915f2d3](https://github.com/event4u-app/agent-config/commit/915f2d3d5e9bea2f9634f1c65c2913dd394f8051))
* **scripts:** add ui_conformance_probe, structure gated before style ([8ed491c](https://github.com/event4u-app/agent-config/commit/8ed491c11ceba058b69a77ac220da0d3b8583a87))
* **rules:** test-first, a 40-line rule that activates the TDD skill ([d278dd9](https://github.com/event4u-app/agent-config/commit/d278dd98cb21393e0b64e081c2903820f17f93fa))
* **roadmap:** make `## Decisions` the plan's closure record ([088f98f](https://github.com/event4u-app/agent-config/commit/088f98fc2a7cc375b4eeefaf67eb902b55488ca0))
* **census:** count an explicit bypass as its own axis ([a145778](https://github.com/event4u-app/agent-config/commit/a14577800332efb614012c1a74b21f985eef6248))
* **rules:** close the declared enforcement-class vocabulary beside obligation_frequency ([513ecef](https://github.com/event4u-app/agent-config/commit/513ecefc6dfb6b2ce15d532bffa47a483065a312))
* **planning:** declare roadmap producers, and make closure their last step ([94112d8](https://github.com/event4u-app/agent-config/commit/94112d886793ba268e91efa660210a53737e9aac))
* **settings:** quality runs under a mission, per-phase cadence, an execution block ([83700d3](https://github.com/event4u-app/agent-config/commit/83700d38e16c0655019b80e9060cbae8c9477fef))
* **challenge-me:** add the closure sub-command and its detector ([0257cd3](https://github.com/event4u-app/agent-config/commit/0257cd39b51e47b2c5e0acecc225139d0fbd0c67))
* **release:** refuse a major cut whose BREAKING section has no migration entry ([2bb5176](https://github.com/event4u-app/agent-config/commit/2bb5176dcbd2ff98b4932e887af9749d8fb9d755))
* **release:** derive Known limitations, the fifth label nothing derived ([ebc4286](https://github.com/event4u-app/agent-config/commit/ebc4286bef16cd05f4f48bcb517ff9a223db06ee))
* **roadmap-create:** the council is a step, not a billable offer ([96f7aa8](https://github.com/event4u-app/agent-config/commit/96f7aa891186938b7b24f1a605c100849f8d3652))
* **council:** route decisions by ownership, not by impact ([58e4366](https://github.com/event4u-app/agent-config/commit/58e4366b8eb73e97756d9bc09394faae354171d0))
* **gates:** register the hook-manifest triple in check_generator_sync ([16cf6fa](https://github.com/event4u-app/agent-config/commit/16cf6fafc9fde371fdcb74b17610c4f991bac30b))
* **hooks:** let compile_hook_manifest write outside the tree ([bacde7d](https://github.com/event4u-app/agent-config/commit/bacde7d2ef1d6ccafca507156a842a4e92d3cf77))
* **gates:** deliver the memory before the action, and refuse a generated artefact its source outran ([9c7d1ef](https://github.com/event4u-app/agent-config/commit/9c7d1ef543a326e80dba0b42bfddc20905c90d4a))
* **payload:** split the payload metric into three, and correct a stale figure this roadmap carried ([3f439c3](https://github.com/event4u-app/agent-config/commit/3f439c3ca4b9959efb7cb6fed01dd85bd1fac445))
* **docs:** generate the enforcement matrix per slot, and title it for what it proves ([128b227](https://github.com/event4u-app/agent-config/commit/128b227889d6cb4b5ecb4d86aa6099c5bcd63c9c))
* **gates:** measure the enforcement table against its configuration, and get one mismatch ([dfc1f93](https://github.com/event4u-app/agent-config/commit/dfc1f93d9f8ce186097b537eb886ada96c4b5812))

### Bug Fixes

* **roadmap:** give D1 the mandated Decisions-table columns ([922085a](https://github.com/event4u-app/agent-config/commit/922085aafe00c049e1f1b6c3323bdca962bd7fd5))
* **evidence:** use the six-column findings-table shape ([8452a91](https://github.com/event4u-app/agent-config/commit/8452a91dfef6abe97895617a9cf9a283f682c37f))
* **evidence:** declare the review artefact's evidence type ([b54ae08](https://github.com/event4u-app/agent-config/commit/b54ae086a2814a3ce92c1d00133929ff5c9378fe))
* **tests:** stop the reach:doctor witness watching shared mutable state ([f83ce46](https://github.com/event4u-app/agent-config/commit/f83ce4600dba85f1ea139608ba056b91846f586f))
* **roadmap:** correct AC-2's prose, which put AC-5 in the refused set ([b992b5c](https://github.com/event4u-app/agent-config/commit/b992b5cd46db0b01d68d1fc295c5e70b57fc4467))
* **report:** repoint the codex writer citation after the second line shift ([4ad8939](https://github.com/event4u-app/agent-config/commit/4ad8939fd8df76305bced49a1be859f663a0bfb6))
* **wizard:** surface preserved files instead of swallowing every conflict channel ([2d96040](https://github.com/event4u-app/agent-config/commit/2d96040a9e7b1721570f0b100cb099500be89b6c))
* **install:** stop the rule rewrite from dropping a preserved file's frontmatter ([78e77b1](https://github.com/event4u-app/agent-config/commit/78e77b12a4d668c633ba7382af9cfbe8349f6010))
* **install:** stage the file the installer would have written, and record it ([eecbaa0](https://github.com/event4u-app/agent-config/commit/eecbaa07d530b2ef338b1739ba196cec13199eed))
* **report:** repoint the codex writer citation after the line shift ([157482d](https://github.com/event4u-app/agent-config/commit/157482d802f2a848fbb431ffd5bfc003b6cf0e84))
* **install:** prove sidecar ownership from the manifest, not from byte equality ([df8c516](https://github.com/event4u-app/agent-config/commit/df8c516c1bcb6ae41f609c70653bdf65a0ff3737))
* **install:** keep recorded digests across runs, so preservation survives ([539b08c](https://github.com/event4u-app/agent-config/commit/539b08cc2094e0e91caf4e13e1a80aadb88e6480))
* **install:** spell out the macOS realpath symlink instead of quoting it ([e740520](https://github.com/event4u-app/agent-config/commit/e740520fe6b37023b9938addccc887cd95dc235e))
* **gate:** base R1 staleness on the commit that introduced the review (#2065) ([61bbdb1](https://github.com/event4u-app/agent-config/commit/61bbdb10f2103a147cb90adc73e7bb3096d7c12c))
* **roadmap:** reword three ruleset-type mentions the reference gate reads as rule refs ([c204e85](https://github.com/event4u-app/agent-config/commit/c204e85c31a3cab803aa7127efb436055324b932))
* **roadmap:** mark the seven blocked steps so scanOpenSteps reads them ([438c2e5](https://github.com/event4u-app/agent-config/commit/438c2e55e239237bb9f0a3c63155c16b51b35461))
* **roadmap:** declare release-holds blockedness where the scanner reads it ([aed1e94](https://github.com/event4u-app/agent-config/commit/aed1e94f65a97a1eb47e9b0621e24e768e8621a3))
* **roadmap:** rebase the rule-13 split onto its moved base ([4a91ca8](https://github.com/event4u-app/agent-config/commit/4a91ca84ad1d6ed22e4f03baa249621f7e41b822))
* **roadmaps:** mark the 13 owner-gated steps blocked so the stop slot reads them ([112e52f](https://github.com/event4u-app/agent-config/commit/112e52fb139adc68fec77f320804b6330662cd19))
* **authority:** check that the record and the ledger name the same grant ([f5f8721](https://github.com/event4u-app/agent-config/commit/f5f872120fc5b4f5323c2e758aa4ffcc2a2dc6ba))
* **authority:** make the exact object, the verb and the turn checkable ([91b7864](https://github.com/event4u-app/agent-config/commit/91b786421ad3443b548e1862489be79a7f16892a))
* **roadmaps:** stop two note headings parsing as phases ([74d937b](https://github.com/event4u-app/agent-config/commit/74d937b39054e976183352a93b6a8a6d3f1bee00))
* **install:** correct a txlog docstring naming a removed module ([6dec7fc](https://github.com/event4u-app/agent-config/commit/6dec7fce14ffc1fba3d570f06cb0f30b97e4ed45))
* **roadmap:** decision-closure's banner claimed 0 of 22 while 17 boxes were checked ([4f6e09a](https://github.com/event4u-app/agent-config/commit/4f6e09a6acfa86ca4926c75f189eb633ed3b67dc))
* **portability:** drop the project-local task name from the verification table ([0cc441c](https://github.com/event4u-app/agent-config/commit/0cc441ca3674b59a468dc1a8bc4511a9805b4bbc))
* **tests:** anchor the memory_lookup staleness fixture to the real clock ([c9fdae7](https://github.com/event4u-app/agent-config/commit/c9fdae7152975e5c39b5301d140793b8cdeb8ce3))
* **merge:** resolve three badly-committed count-badge conflicts ([8cf38c6](https://github.com/event4u-app/agent-config/commit/8cf38c6230ac2aa610f88557af6aa22e949adaa9))
* **docs:** put the migrated German quote on one DE/EN anchor line ([5ee7e7d](https://github.com/event4u-app/agent-config/commit/5ee7e7d5ab5a17d84c33afc6cf14c01d1ebca7c6))
* **merge:** re-derive four contested counts on the merged tree ([a671cd7](https://github.com/event4u-app/agent-config/commit/a671cd77e182fc0f8fe628521f39719da34a2bba))
* **review:** eight findings from an independent review of this branch ([2f5c68b](https://github.com/event4u-app/agent-config/commit/2f5c68bdd518ebdcd2469cf642eea7d96c2e14ff))
* **context:** give the new context a referrer inside the context layer ([82a7dea](https://github.com/event4u-app/agent-config/commit/82a7dea8a9d9a748fb5a69e7c36282767d14ba53))
* **ci:** re-pin the secret-allow line, give the gates a base ref, and narrow the weakening detector ([484077c](https://github.com/event4u-app/agent-config/commit/484077ce125bda06e7b0931992f8c5259498e6b0))
* **conformance:** the log has no writer at all — correct the premise, not just the wording ([d04ed00](https://github.com/event4u-app/agent-config/commit/d04ed00f25b7a2d0f6efa806ace66f269fe81a74))
* **budget:** keep the scope-growth pointer off the always-rule closure ([585eaaa](https://github.com/event4u-app/agent-config/commit/585eaaa375fd42f5e4b43dbdf1a09ccb16cdb970))
* **budgets:** split the ladder context and pay both size ratchets back ([27daf4e](https://github.com/event4u-app/agent-config/commit/27daf4ec61e8d7d237756f5a8c82042692184c91))
* **install:** this branch published a claim its own tree contradicts ([0c4cff3](https://github.com/event4u-app/agent-config/commit/0c4cff3e04ed9d739ccd4d7d3615bab50dd1315e))
* **docs:** house dialect on the one line this diff authored ([929d151](https://github.com/event4u-app/agent-config/commit/929d151c9a09524880e9b1d39d68c87ea061bccd))
* **ci:** pay the settings rename off the source ratchet, and repair one link ([9413b9e](https://github.com/event4u-app/agent-config/commit/9413b9e1cf02be3355203130d76de26cb6dd864d))
* **ci:** rebuild dist/install, and clear two ratchets the new prose tripped ([529c28e](https://github.com/event4u-app/agent-config/commit/529c28e35f3f4ee0baeee98b6dba0167edf33a14))
* **ci:** clear the fourteen red checks this branch introduced ([d5a8efe](https://github.com/event4u-app/agent-config/commit/d5a8efebd2642ad52d5609fa154a6c92017260cc))
* **verify-repair-loop:** require reading the failure before revising ([2718b07](https://github.com/event4u-app/agent-config/commit/2718b071692e840132fa9f66e41fefeab438df03))
* **rules:** restore the concrete verification tools in autonomous-execution ([e12e3c2](https://github.com/event4u-app/agent-config/commit/e12e3c2d47c14a092a0b99abc6f79b7ee5e225eb))
* **ci:** move the two test gates to tests.yml — consistency.yml is ratification-gated ([7dc3e92](https://github.com/event4u-app/agent-config/commit/7dc3e922fceb54ebd82b013941ccae09f3d69c17))
* **hooks:** replace three raw NUL separators and record the concern admission ([39db453](https://github.com/event4u-app/agent-config/commit/39db4536880688ae7a300fb8dea4f1da08b87625))
* **templates:** drop the roadmap path from a stable artifact ([e1ed862](https://github.com/event4u-app/agent-config/commit/e1ed862c5211221cff2bfa7749cbbe613d6a367a))
* **telemetry:** remove three trigger-comparison flags nothing can compute ([8b0deb7](https://github.com/event4u-app/agent-config/commit/8b0deb77bfefaccb0a814bb348979c94dfa422b2))
* **ci:** clear the six reds this branch created, and pay the payload cost honestly ([bbdbcad](https://github.com/event4u-app/agent-config/commit/bbdbcade2400a5a3e5db8b98d62176db04b54610))
* **conformance:** keep the `unknown` symbol out of the over-ceiling doctor file ([160927e](https://github.com/event4u-app/agent-config/commit/160927e547b4d8da73529fda27d8308687cb2f1e))
* **skills:** correct the Storybook docs tool names, re-derived from an installation ([fea24ec](https://github.com/event4u-app/agent-config/commit/fea24ecbe0f44a6615d00e3c0b962dfc05326ab3))
* **docs:** canonical house dialect, and no bare src/ path in a shipped skill ([03e3ec9](https://github.com/event4u-app/agent-config/commit/03e3ec9057f5c1c769d10d187d4de52873585f76))
* **config:** dispose of the ui-conformance state leaf in the continuity surface ([d924ed6](https://github.com/event4u-app/agent-config/commit/d924ed64b9003d0e02886362ee13bbe3aa55571f))
* **budget:** keep the ownership axis and the ask contract off the ratchets ([de8bee8](https://github.com/event4u-app/agent-config/commit/de8bee8ee8095575badb49346901729e4cb0cfe2))
* **schema:** allow `produces_roadmap` on a command, and resync the index ([39b8ca1](https://github.com/event4u-app/agent-config/commit/39b8ca1da1c4b4ca3500acb71251faa5fac93e40))
* **rules:** routes_to back to block form — the linter parses no flow sequence ([0b80768](https://github.com/event4u-app/agent-config/commit/0b8076804d0316556da944d9165490417c7aa1d6))
* **secrets:** re-pin the gate-coverage canary allow-entry to 655 ([38dfab6](https://github.com/event4u-app/agent-config/commit/38dfab664eb389bcc0a3fbdd2954b4c441cd3e53))
* **rules:** scope test-first to workspaces and packs ([c580266](https://github.com/event4u-app/agent-config/commit/c580266d58d115dbce5648b8470c4442d9b3d940))
* **changelog:** the 16.0.0 and 15.0.0 heads claimed no known limitations ([da107a3](https://github.com/event4u-app/agent-config/commit/da107a339607bbea52d60852192b24a35511d83b))
* **ci:** claim the offset half of the estate ratchet, not only the growth half ([8e73efa](https://github.com/event4u-app/agent-config/commit/8e73efa3d00703524cd87a65bafc6e435fbea976))
* **ci:** admit the recall concern and claim its estate growth where it happened ([36f30b6](https://github.com/event4u-app/agent-config/commit/36f30b612e20772c637bceaee1cc3456e667bba9))
* **ci:** compile the hook manifest the YAML comment edit outran ([9703a69](https://github.com/event4u-app/agent-config/commit/9703a69341c20298666530d84d556c4650a98530))
* **ci:** rebuild the committed install bundle for the schema text this branch changed ([1a238ad](https://github.com/event4u-app/agent-config/commit/1a238ad674e11947b7e02c829950cfad6ff5dbab))
* **release:** read the remote before pushing, never from the rejection ([84d069e](https://github.com/event4u-app/agent-config/commit/84d069ef83c23ca2c834e9e1234c0adf89e323a2))

### Reverts

* **install:** drop the txlog docstring fix, record it in the roadmap ([252dbf9](https://github.com/event4u-app/agent-config/commit/252dbf9d4641a4a62ee908f9ba01724857da97ae))

### Documentation

* **roadmap:** record that trigger-eval freshness has no writer ([aa2e30e](https://github.com/event4u-app/agent-config/commit/aa2e30e7717e6b4a5e8c20a5fcedbcbe16d4ae5b))
* **roadmap:** record the corpus cadence decision the council reached ([289241d](https://github.com/event4u-app/agent-config/commit/289241deb1f28ab456d187bd5aa56172fae7cd1b))
* **evidence:** record the independent verdict on the witness test rewrite ([de40070](https://github.com/event4u-app/agent-config/commit/de40070dd9d7e22ff102b8e59580c3ec1388df26))
* **contributing:** adopt a Flake-diagnosis commit-trailer convention ([aa51c49](https://github.com/event4u-app/agent-config/commit/aa51c495bc3c9a75004d5076f7e1dcad9de2032e))
* **review:** declare the completion-review skip for the docs-only reading ([980cf47](https://github.com/event4u-app/agent-config/commit/980cf47772ad3f80d9a45c0466f92f8fc8c09983))
* **roadmap:** close Phase 1 of the corpus refresh ([ae7ef00](https://github.com/event4u-app/agent-config/commit/ae7ef00f41a4b6be216007f415761d4ea57953f2))
* **roadmap:** re-verify the bounded approval-floor waiver's one open item ([e5bf070](https://github.com/event4u-app/agent-config/commit/e5bf0709c2471987892b17e85036c54da263f2e3))
* **roadmap:** record the 2026-09-27 shadow-bar reading against ledger step 6.1 ([be9093e](https://github.com/event4u-app/agent-config/commit/be9093e6e52bb64baba661140379634a5d91fb89))
* **roadmap:** close out the declared component contract on the refusal ruling ([1b8d185](https://github.com/event4u-app/agent-config/commit/1b8d1852ba78e97e92a7c05ab1894b03a07da85b))
* **roadmap:** re-review the risk register after the refusal ruling ([19cb97b](https://github.com/event4u-app/agent-config/commit/19cb97b5b8705e3590879bf229fb155b60e8dccd))
* **roadmap:** resolve taxonomy-reversal-is-a-second-arrival as a refusal ([de0b4d0](https://github.com/event4u-app/agent-config/commit/de0b4d03154838157a5d6d66f6512c2044a93ad9))
* **roadmap:** record the second arrival on the archived granularity roadmap ([06ec030](https://github.com/event4u-app/agent-config/commit/06ec0300a86e0f535595665e1979418c10fea0da))
* **install:** correct every surface that published the unconditional-overwrite claim ([5c596ba](https://github.com/event4u-app/agent-config/commit/5c596babb3b5e588a0f9de3c58a94dd31033f512))
* **roadmap:** execute the screenshot blocker condition and escalate the ruling (#2060) ([46eaa0b](https://github.com/event4u-app/agent-config/commit/46eaa0b1d375526450d9edfb7c95d168ca217e18))
* **roadmap:** decide which-track-promotes-is-owner-reserved -- promote none (#2056) ([00a4dc8](https://github.com/event4u-app/agent-config/commit/00a4dc84c0c6ec770f096ec7ac60de17b00c7e32))
* **review:** declare the completion-review skip for a prose-only diff ([b63cdf3](https://github.com/event4u-app/agent-config/commit/b63cdf3431b57b982f3bdea149f9e15a89a78b22))
* **roadmap:** re-verify both blockers and three stale step reasons ([a84c73b](https://github.com/event4u-app/agent-config/commit/a84c73be1fe44579714e4d1de131614c69faf553))
* **work-engine:** correct how the engine reaches a consumer, and record the measured blast radius ([772735f](https://github.com/event4u-app/agent-config/commit/772735f55b65128311c28d86c3844d776cb76aa4))
* **evidence:** record a third exposure reading and the first near-miss ([fabcaa5](https://github.com/event4u-app/agent-config/commit/fabcaa5f5861265f5a6a5fc64941546bd9bfcaa8))
* **roadmap:** re-review the risk register and record the reachability risk ([9af15b7](https://github.com/event4u-app/agent-config/commit/9af15b780cfc5da74be0c6e8407e4a1aa14960a1))
* **roadmap:** mark the two owner-blocked screenshot steps blocked-by ([763f089](https://github.com/event4u-app/agent-config/commit/763f08942cf96edb37935b8beabcee0b86f1eefc))
* **evidence:** record the threat pass over the two authority modules ([0dc6835](https://github.com/event4u-app/agent-config/commit/0dc6835e65cc6dc5a51480af63e6489da6bb0f8b))
* **roadmap:** record the measured shadow-bar reading against step 6.1 ([5661596](https://github.com/event4u-app/agent-config/commit/56615963e937a917f65ab09788af937b5f3c18fa))
* **roadmaps:** mark the substrate stub's owner-reserved steps blocked-by ([1671e0f](https://github.com/event4u-app/agent-config/commit/1671e0f6c837d70d744cb3265e40643dbad6dace))
* **roadmap:** say why the last three criteria are impossible, not unstarted ([2d232dc](https://github.com/event4u-app/agent-config/commit/2d232dcb8e1e403655d199392c9e4b5e9f5f3361))
* **roadmap:** carry the four authority findings the AC-2 pass produced ([a1f11bc](https://github.com/event4u-app/agent-config/commit/a1f11bcc642dbfbfd31bda26b2d92a8478228b17))
* **roadmaps:** record the capability screen and mark the blocked steps ([8485b73](https://github.com/event4u-app/agent-config/commit/8485b737c841f776acf65c59214034a9ea6481a0))
* **roadmap:** correct the NEVER_WAIVABLE count, record the gated third site ([dc4a61b](https://github.com/event4u-app/agent-config/commit/dc4a61b6deaec601fecb44b703de4edb78e3eb45))
* **roadmap:** correct stale present-tense records in the waiver roadmap ([5dc973e](https://github.com/event4u-app/agent-config/commit/5dc973ea2b0872d69b019931597a43475848c62d))
* **roadmap:** re-verify decision-closure's five open boxes on the current tree ([732b1b5](https://github.com/event4u-app/agent-config/commit/732b1b579b651f1d597a5b56b33ec71465aa8dee))
* **evidence:** record the post-merge exposure reading as a dated addendum ([dfa5bcb](https://github.com/event4u-app/agent-config/commit/dfa5bcbc85b80e23310687a2fd50e79dbc7b8878))
* **review:** disposition all 12 round-2 findings against d04ed00f2 ([c77a257](https://github.com/event4u-app/agent-config/commit/c77a257a905694da410856b5da3d960dfa358182))
* **review:** bind each fixed finding to the commit that fixed it ([d7a2e78](https://github.com/event4u-app/agent-config/commit/d7a2e78667c95e7fb60128b91cfa56488f1bc849))
* **review:** completion review of drain/conformance-check — 11 findings, all open ([23d8cca](https://github.com/event4u-app/agent-config/commit/23d8cca415ff537f881df143a4a63c9115c6602b))
* **roadmap:** re-review the risk register against what landed ([7f79a07](https://github.com/event4u-app/agent-config/commit/7f79a07dec92c820c47980d0e408f281c505be33))
* **roadmap:** close the seven acceptance criteria with their evidence ([e2de90e](https://github.com/event4u-app/agent-config/commit/e2de90e569068eadde7ce334b1bbcada314086ba))
* **roadmap:** record why 1.4, 1.7 and 4.2 were not attempted ([6a3478d](https://github.com/event4u-app/agent-config/commit/6a3478d72207bf8a5f14651000c3565563f92312))
* **roadmaps:** re-review the substrate-stub risk register ([ce60f08](https://github.com/event4u-app/agent-config/commit/ce60f0871d0aa959bf3e965ffd47962390ae0903))
* **roadmap:** document the optional delivery frontmatter block ([741d9dd](https://github.com/event4u-app/agent-config/commit/741d9dd65e212991dedbc99393390ba4bcb4f5d2))
* **roadmaps:** record phases 1 to 4 landed, phase 5 owner-reserved ([0579873](https://github.com/event4u-app/agent-config/commit/05798739fc702abb4ae6366640c0f2f2642b8d0e))
* **roadmap:** re-review the risk register after Phase 1 ([8ee2a29](https://github.com/event4u-app/agent-config/commit/8ee2a29c475c08a78db54ea7202c98130740f2dd))
* **roadmaps:** re-cut the substrate stub against its now-open gate ([715b3ae](https://github.com/event4u-app/agent-config/commit/715b3ae39310300e81815c18c5fe3eaafccc2350))
* **evidence:** enumerate ADR-249 governance conditions against the tree ([d0a9e06](https://github.com/event4u-app/agent-config/commit/d0a9e06d2233690e0860960c1f6892ea76e472e0))
* **roadmap:** keep the auto-merge namespace ratchet, and say why ([6c5e2c9](https://github.com/event4u-app/agent-config/commit/6c5e2c976a65d76c1dcefb107c2d51b8f552d080))
* **settings:** name what no execution mode lifts, instead of "a safety floor" ([047fdaf](https://github.com/event4u-app/agent-config/commit/047fdaf21432345d8c31b839afcb50de5e9c3e77))
* **roadmap:** advance the two owner-reserved blockers with evidence, not a decision ([36c89fd](https://github.com/event4u-app/agent-config/commit/36c89fd570adf80983fe0991f0f73e5a03ad852c))
* **roadmap:** re-measure both open blockers instead of reading them forward ([5952d4c](https://github.com/event4u-app/agent-config/commit/5952d4c83f4ec9c979aa1c55342af8cfcb174c38))
* **roadmap:** mark AC-1 to AC-4 proven, and say why AC-5 and AC-6 are not ([40215fb](https://github.com/event4u-app/agent-config/commit/40215fbd2a556fdfb3bd3ffc170d57d74ce8f346))
* **roadmap:** mark the eight acceptance criteria the landed work satisfies ([ffe25e1](https://github.com/event4u-app/agent-config/commit/ffe25e17d6c34328d71b11e867d7e6837399ea38))
* **claims:** register the conformance catch against its pre-registered bar ([1fee1ef](https://github.com/event4u-app/agent-config/commit/1fee1ef3c18ac70e1333d8058976e3b5cce48c5b))
* **evidence:** declare the completion-review skip for this closure ([af45769](https://github.com/event4u-app/agent-config/commit/af457691a23cc0e9d013626005c9eb8bd89973ff))
* date the superseded platform measurements across the tree ([fda54cf](https://github.com/event4u-app/agent-config/commit/fda54cf92158f71a4c1147355b817ae87aa7db47))
* **anchor:** correct the record against re-measured forge state ([b4beff0](https://github.com/event4u-app/agent-config/commit/b4beff02644f91b8beb81fc08eaebd355d8ea17c))
* **anchor:** close Phase 1 against what shipped, with sensitivity proven ([e3eb5bb](https://github.com/event4u-app/agent-config/commit/e3eb5bbf97b4065f74b72e81ad4b334fb5f4314d))
* **anchor:** answer both open design questions and write the lockout recovery ([1722a3e](https://github.com/event4u-app/agent-config/commit/1722a3e368f8dbb3e1c8869e8e00edcefa1017db))
* **evidence:** re-read the enforcement census and correct a stale ADR pointer ([aed37c1](https://github.com/event4u-app/agent-config/commit/aed37c1764d17c8ea83d5423a24359d9007c2806))
* **evidence:** what the Known-limitations derivation returns over both spans ([740d622](https://github.com/event4u-app/agent-config/commit/740d622c6120a86c7f8852d354b23648a2f3f7e0))
* **gates:** recount the gate-coverage denominator on this tree ([04916f1](https://github.com/event4u-app/agent-config/commit/04916f181ea42b39363b6a82e876d812ecb067ed))
* **memory:** correct the hook-manifest regeneration recipe ([21ba777](https://github.com/event4u-app/agent-config/commit/21ba7772c6ff739ebcfaa609e762eb6d5ea7150a))
* **contracts:** name computed_style, interaction, viewport_matrix, media_emulation ([e69e40c](https://github.com/event4u-app/agent-config/commit/e69e40c3eceac549c48eed8434ecb4f1e5641017))
* **migration:** give 15.0.0 and 16.0.0 the sections their BREAKING entries earn ([d720135](https://github.com/event4u-app/agent-config/commit/d7201354dd080eef09a45b035dd927876e2e91ab))
* **changelog:** say which line won on the 15.0.0 kernel-deny entry ([163f447](https://github.com/event4u-app/agent-config/commit/163f447891ee6b5455c79d126c97d35579d52452))
* **review:** declare the completion-review skip — the diff carries no code path ([e6a206e](https://github.com/event4u-app/agent-config/commit/e6a206ebb4d5019d25c7a7e17b2a17c6952fa64f))
* **pr-merge:** pin the straggler batch to preparation and close the disposition set ([c63818b](https://github.com/event4u-app/agent-config/commit/c63818bfc4f18dc3ed39363192afcdcf69b7a9ca))
* **roadmap:** two release-truth defects the round found, both verified at source ([f1d927f](https://github.com/event4u-app/agent-config/commit/f1d927fd614e68fbe08dc2d9dd6eebcb8a2aaa92))
* **evidence:** one inbox round read three times, and the two counts it moved ([8abff9f](https://github.com/event4u-app/agent-config/commit/8abff9fc31820d87ca598aa79d198b0bc571eda1))
* **evidence:** enumerate and disposition the 18 mixed-trigger rules, and defer both rebinds ([4e5c5dd](https://github.com/event4u-app/agent-config/commit/4e5c5ddc9e7da7dde2e9dc90d2034962e87543d6))
* **projection:** separate the template default from the parser fallback, in ten places ([295e753](https://github.com/event4u-app/agent-config/commit/295e753aa809d125f63a1d8330b9e36af52ac605))
* **governance:** ratify the workflow registration, and close the fail-open flag it exposed ([7abad60](https://github.com/event4u-app/agent-config/commit/7abad60aab09a533755d6d3f012e395d7127cfa7))

### Refactoring

* **install:** move the preservation state machine out of install.ts ([dfb10aa](https://github.com/event4u-app/agent-config/commit/dfb10aaf6cfccaa6848a6fec7ccc69f296382d3b))
* **release:** drop the RunResult import the extraction orphaned ([88a46d2](https://github.com/event4u-app/agent-config/commit/88a46d24ae05c0db171c0c9853f3fada16d5a62b))
* **release:** move both MIGRATION.md refusals out of release.ts ([ad5f26b](https://github.com/event4u-app/agent-config/commit/ad5f26b71da2168d41c0f208dba5bf011f88c4cc))
* **release:** pay the size ratchet this branch moved, by pairing the refs ([63bf8ac](https://github.com/event4u-app/agent-config/commit/63bf8ac9ac692f35f5c4bbbc84155cf75e26ea59))

### Tests

* **e2e:** record the independence level per group, closing AC-2 ([af398a1](https://github.com/event4u-app/agent-config/commit/af398a182efbef5d154c7b870714158a618631bc))
* **e2e:** a four-phase long-run fixture over the composition, closing AC-7 ([37a6ff8](https://github.com/event4u-app/agent-config/commit/37a6ff8c624ff6e5bead783f37720a571cb4b231))
* **e2e:** land T1, T6, T9 and T10, closing AC-1 and AC-3 ([9de29d0](https://github.com/event4u-app/agent-config/commit/9de29d0a50c7aa3db5ac6c5181f2f792d26e7cc2))
* **server:** carry the delivery block in the settings fixture ([bbb3aa5](https://github.com/event4u-app/agent-config/commit/bbb3aa5e04eaf1d043379e33469216735a5b260b))
* **ui-audit:** pin the five-level taxonomy out of the emitted vocabulary ([2d3b8e2](https://github.com/event4u-app/agent-config/commit/2d3b8e214fc29a74df46a25b68b76c5a3215ecaf))
* **design:** add the ui-conformance sensitivity fixture, before the probe ([d81c72a](https://github.com/event4u-app/agent-config/commit/d81c72aa680aa660dfbd2b381b05aa2212255072))

### Build

* **install:** regenerate the install bundle for the per_phase schema default ([a5759da](https://github.com/event4u-app/agent-config/commit/a5759da2475a47133724fb0c880463ebcbb7d784))
* **install:** resync the install bundle with the delivery schema ([5ace984](https://github.com/event4u-app/agent-config/commit/5ace98478647fbc7044882bd1bb8d4ba9ce9e96c))
* **install:** regenerate the install bundle for the new settings keys ([4a1de39](https://github.com/event4u-app/agent-config/commit/4a1de39625b4c47fe6e6eb0ef13683cf78c8450b))

### CI

* **canary:** skip the live job when ANTHROPIC_API_KEY is absent instead of running it ([40f9376](https://github.com/event4u-app/agent-config/commit/40f937677e1398fdb070292f1d81e25a5e2b6f9c))
* register the migration-section gate outside the ratification self-watch ([d0ff02a](https://github.com/event4u-app/agent-config/commit/d0ff02a41aa8f56f0172c7270bde5b5e9bff239a))

### Chores

* **roadmap:** claim the estate offset exemption with its reason ([34f11cf](https://github.com/event4u-app/agent-config/commit/34f11cf745c72817eb8b87785e8a0d4995a71790))
* **roadmaps:** archive the conformance-check roadmap at 17/17 ([86255ab](https://github.com/event4u-app/agent-config/commit/86255abdf5885e5c49bd6d4721c108f86927b62b))
* **roadmaps:** archive the 2026 Q3 corpus refresh ([07975f9](https://github.com/event4u-app/agent-config/commit/07975f9c2a0ed8ff3e8c3eaf9c53f7beac92c9b6))
* **roadmaps:** archive the witness-without-shared-state roadmap ([b9d2660](https://github.com/event4u-app/agent-config/commit/b9d26605d5f4abf355322c0978c796d7a04d0e4e))
* **roadmaps:** archive the declared component contract ([8cf9680](https://github.com/event4u-app/agent-config/commit/8cf9680de4bbeedea891888d2271fff47010a0d8))
* **dist:** rebuild the CLI output and install bundle ([e04ca0c](https://github.com/event4u-app/agent-config/commit/e04ca0c7c5c1f2306ca0e1b55e1d56bcb28955d1))
* **gate:** lower the source-size ratchet to the measured total ([d19d2e7](https://github.com/event4u-app/agent-config/commit/d19d2e7f78c1ff1b45c97fff08b014b595d110af))
* **roadmap:** archive road-to-authority-object-exactness ([5c702a2](https://github.com/event4u-app/agent-config/commit/5c702a2b8206e75038cc50f5fa3dc55916ee9b71))
* **roadmap:** close the four criteria and promote the roadmap to ready ([e7c8625](https://github.com/event4u-app/agent-config/commit/e7c8625ee653c3378d074e514384ba510742207b))
* **roadmap:** declare the estate growth and decline the offset, on the record ([5918806](https://github.com/event4u-app/agent-config/commit/5918806e8b9f728070847abc62efd5a75b6f3632))
* **roadmaps:** archive the four roadmaps that reached every box ([d585e91](https://github.com/event4u-app/agent-config/commit/d585e919514eed984fcb9b8c7d95e9809d1fb43f))
* **roadmaps:** promote three finished drafts to ready so the sweep can see them ([85297c0](https://github.com/event4u-app/agent-config/commit/85297c0e2fe8b80018c4238ecc90712d96f6b11d))
* **proof:** regenerate the claims proof on the merged tree ([20a6c98](https://github.com/event4u-app/agent-config/commit/20a6c980e367d3df853eab2e4f990e05d8d17337))
* **index:** regenerate for the merged command surface ([a56cf71](https://github.com/event4u-app/agent-config/commit/a56cf71af64eef180912e4af79ae8c0ab5e969ba))
* **evidence:** re-pin the completion-review scope after the addendum commit ([ef111fd](https://github.com/event4u-app/agent-config/commit/ef111fdf4e9223c19c64fdaf5e0aed27a1b998fe))
* **census:** re-emit the host payload census at the current pin ([98a9c87](https://github.com/event4u-app/agent-config/commit/98a9c87c8eed724659312fded3d61b5bdd5137c1))
* **evidence:** declare the completion-review skip for this diff ([a2a1106](https://github.com/event4u-app/agent-config/commit/a2a11069e2119a438dcf83fe541fb94a905e740c))
* **budgets:** carry the source-size gain the extraction produced ([6eb5d4f](https://github.com/event4u-app/agent-config/commit/6eb5d4fb66ad7cc7c882b4df86268d266ee23fca))
* **build:** rebuild the install bundle after the settings-key rename ([953adca](https://github.com/event4u-app/agent-config/commit/953adcad205d661ed8cae4f34dd023f015d8bc65))
* **sync:** regenerate projections and derived pages ([6501427](https://github.com/event4u-app/agent-config/commit/65014277caf0f76b0b51fcc99e63b4c0eb543e9a))
* **tests:** drop the dead subprocess scaffolding in the doctor test ([0c37af1](https://github.com/event4u-app/agent-config/commit/0c37af1667730981425d7386c18428578bff6805))
* **index:** regenerate the artefact index for test-first ([6f2aa02](https://github.com/event4u-app/agent-config/commit/6f2aa02cfdcbef24c36e6070947373986b9891d4))
* **evidence:** regenerate the ADR evidence census ([5b9d161](https://github.com/event4u-app/agent-config/commit/5b9d1613bb0c502c306174d2731aa5ef8ead8320))
* **ci:** re-run the macOS shard that failed on a process-spawn error ([e59c004](https://github.com/event4u-app/agent-config/commit/e59c00479b73643138e6b8d2f8fdd4212f70a29a))
* **roadmap:** archive the delivery-flip roadmap and regenerate the archive index ([c8a0dbf](https://github.com/event4u-app/agent-config/commit/c8a0dbf32105b5968cc0de471731ae216bf30a39))
* **roadmap:** archive the enforcement-table roadmap and regenerate the archive index ([f483632](https://github.com/event4u-app/agent-config/commit/f483632c088508959b30dea5fd000d9677b8c208))
* **roadmap:** close the enforcement-table roadmap with its five acceptance criteria ([ec9f22a](https://github.com/event4u-app/agent-config/commit/ec9f22a3766d404524362ba5d2fe97b4b3888fe6))

### Other

* Refute the shadow-window installation-lag cause and re-measure the pre-registered bar (#2059) ([5644590](https://github.com/event4u-app/agent-config/commit/5644590ddf0b6a92c82bd3555946363cb5f3693d))
* Execute the detector blocker's condition, and make the taxonomy rejection citable (#2062) ([d5e109a](https://github.com/event4u-app/agent-config/commit/d5e109a4983c6df0562bacf05d1a9fc4885c3ee1))
* Release holds that refuse: the contract, the evaluator, and the authoring self-check (#2061) ([3f34210](https://github.com/event4u-app/agent-config/commit/3f342103168e56d0168655c12141829f5e1d6ca0))

Tests: 23972 (+883 since 16.0.0)

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
