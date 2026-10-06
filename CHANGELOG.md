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

- **A team's git convention can be declared instead of measured — the new
  `git:` settings block.** Three Class-C keys, each defaulting to the
  behaviour every install had before, so an install that sets nothing is
  unchanged. `git.commit_format: ticket-prefix` writes
  `DEV-1234 feat(exporter): …` instead of `feat(DEV-1234): …` and treats a
  ticket in the scope as a wrong subject; `/commit` and `/commit:in-chunks`
  validate against the regex for the configured format, and the
  conventional-commits-writing classifier gains a `ticket-conventional` family
  so such a history is no longer misread as free-text ticket prefixes.
  `git.branch_pattern` (`{type}`, `{ticket}`, `{slug}`) shapes the branches
  `/worktree:create` proposes; reading a ticket back out of a branch now matches
  any `[A-Z][A-Z0-9]+-[0-9]+` token, so `DEV-1234-device-export` yields its
  ticket. `git.update_strategy: rebase` makes `/create-pr`, `/pr:merge`,
  `/prepare-for-review` and `/review:changes` propose
  `git rebase origin/<base>` plus `--force-with-lease` and never merge the base
  into a feature branch — one git-workflow reference
  (`references/branch-update.md`) now owns that decision. **What it does not do:** the setting picks the operation and never
  authorises it; git-history-discipline still requires the user's request for
  every rebase, fixup or autosquash. The keys are set per project — the
  user-global whitelist is ADR-gated and does not carry them yet — and a
  commit-linting config in the repository still outranks `git.commit_format`.
  The merge method is not a key: `/pr:merge` already reads it from the forge.

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

# Era: pre-16.2.0 — archived

> All entries before `16.2.0` live in
> [`docs/archive/CHANGELOG-pre-16.2.0.md`](docs/archive/CHANGELOG-pre-16.2.0.md).
> The archive is read-only; git tags remain the canonical
> source for what shipped. Splitting them out of the main file
> keeps the active era under the 250-line drift cap enforced by
> `tests/test_changelog_eras.py`.

# Era: 16.2.x — current

> Started at `16.2.0`. Full entries live inline below.
> The drift test caps this era at 250 lines of entry body; growth past
> that forces a new era split (`# Era: 16.3.x`, etc.) — see
> [`docs/contracts/CHANGELOG-conventions.md § Era splits`](docs/contracts/CHANGELOG-conventions.md).

## [16.2.0](https://github.com/event4u-app/agent-config/compare/16.1.0...16.2.0) (2026-10-01)

### Release highlights

- **Behaviour changes:** keep ui-audit-gate inside the measured per-spawn payload ceiling (bc499bf); record taxonomy detection and the fourth greenfield option (91d0c55); register the gates, and stop the reader guessing (8714a7a); declare inputs once, structurally (3cfaa6f); disprove a deletion claim against the tree before it blocks a release (c7f813f).
- **Default changes + migration:** correct the blocker gate's own scope claims, and pin the widened default (5857ef1).
- **Security and correctness:** enable auto-merge, fix the deploy-row checker, and withdraw an AC-5 close that did not hold (#2114) (52f2da9); re-derive the codex writer pin after install.ts shrank (3c2041a); an absent section must parse, and now a test says so (51c2bab); pay the read-surface declaration nothing (bfce3ac); a deterministic traversal test, and a claim I got wrong (b883d80); a canonical ASCII boundary, and the exploit that is not there (6281500); +31 more.
- **Honest nulls:** The plumbing roadmap's last measurable gap, measured (#2135) (db000c5); a bytes row that exists, and a gate that refuses one without it (0863114); re-bind the skip to the post-fix scope, and record what the read returned (246d7ea).
- **Known limitations:** ci_settle refuses an argument it does not honour, and the doc that taught a wrong one (#2130) (tests/scripts/memory_learn_hook.test.ts declares a residual) (dbbf470); A zero in the enforcement table becomes a fact with a date on it (#2141) (tests/install/global_install_hooks_smoke.test.ts declares a residual) (ab2c75d); The review of the stop gate, acted on (#2128) (tests/scripts/release.test.ts declares a residual) (5689c2d); an opt-in write of two size caps, and neither traffic variable (src/scripts/install.ts declares a residual) (74e21e2).

> **Governance mix:** governance-only 70 vs consumer-only 22 (taxonomy 1.1.0).

### Features

* **host-env:** an opt-in write of two size caps, and neither traffic variable ([74e21e2](https://github.com/event4u-app/agent-config/commit/74e21e2d4b81714e2721a31b9aea93455b85211d))
* **retrieval-sanitize:** generate the read-surface list, close the two named gaps ([96c9b2a](https://github.com/event4u-app/agent-config/commit/96c9b2abcd4b9ed6f57db568f0c771f9ef36e9f6))
* **retrieval-sanitize:** salvaged work from an interrupted run, unverified ([a175faf](https://github.com/event4u-app/agent-config/commit/a175fafedbcb4ea6a27924a77845d85d45bf16f6))
* **settings-fence:** refuse a Class C key, leave every other key writable ([7d285e5](https://github.com/event4u-app/agent-config/commit/7d285e59840867b1faede405561407297d6ab551))
* **exit-codes:** one table, and the gate that keeps it the only one ([7f4cbbb](https://github.com/event4u-app/agent-config/commit/7f4cbbbe177f990bb80f492bc4f3370011259d3f))
* **work-engine:** wire the taxonomy into the audit, the schema and apply ([7f87162](https://github.com/event4u-app/agent-config/commit/7f8716240d557dc78a3d2ac25a783ac8ed4ca9ee))
* **work-engine:** detect the component taxonomy a project already chose ([0772aaa](https://github.com/event4u-app/agent-config/commit/0772aaaa1c87ee633a943dc652613461926040a4))
* **plumbing-guard:** salvaged work from an interrupted run, unverified ([b8a7037](https://github.com/event4u-app/agent-config/commit/b8a7037e37ed29f52fc169fbbf7821d7db281791))
* **gates:** keep the kill-switch table equal to the tree it counts ([948f8f2](https://github.com/event4u-app/agent-config/commit/948f8f25bc342bb59d0f0715ac3da2caeed67def))
* **host-format-gate:** generate the format cell instead of maintaining it ([86093ec](https://github.com/event4u-app/agent-config/commit/86093ec7dc499a6c77112fa82466e4a3f3c00e70))
* **hooks:** a new test file clears detector F only with a red it passed ([04bb5ea](https://github.com/event4u-app/agent-config/commit/04bb5ea4a3982688e16afaf00713eb365d0d12da))
* **hooks:** detector C reads the run record, and keeps a replay mode ([dcb07e0](https://github.com/event4u-app/agent-config/commit/dcb07e09b95379d1fedfeeb9783a3f7a3e4618c7))
* **hooks:** record the verification runs a turn actually made ([99255cd](https://github.com/event4u-app/agent-config/commit/99255cd9fd2dcb328d40b2528167a2a8682b9c67))
* **hooks:** classify a verification RUN, not the command text ([d638959](https://github.com/event4u-app/agent-config/commit/d638959550a7ab6bf65acf9939fbb8b5f3b708d9))
* **metrics:** a bytes row that exists, and a gate that refuses one without it ([0863114](https://github.com/event4u-app/agent-config/commit/08631143754a53b6a4ad25296e573a4451fdbde6))
* **report:** print menu bytes per install profile, and show them equal ([8ecb71c](https://github.com/event4u-app/agent-config/commit/8ecb71c3d66b7e67055355296786def48c0e8e87))
* **gates:** fail a diff that changes a skill carrying no trigger corpus ([7539f7f](https://github.com/event4u-app/agent-config/commit/7539f7f4577d8ad2dcb6136c73572472307ae658))
* **eval:** score the ranker with an interval, and refuse a verdict under n=100 ([f6a0608](https://github.com/event4u-app/agent-config/commit/f6a0608d198ca5255fd01aac7942d49f05b87c5d))
* **eval:** give every routing-matrix case an expected-skills label ([06f8cb3](https://github.com/event4u-app/agent-config/commit/06f8cb3f543fd937728461758a89d0daa4dfc4c9))
* **roadmap-template:** a verify clause may say what the command must produce ([8f60a26](https://github.com/event4u-app/agent-config/commit/8f60a269d1358f9b1981b66bd3d4a5c9fc9ac12f))
* **roadmaps:** publish the runnable and falsifiable share, and refute a zero ([7e0fd6b](https://github.com/event4u-app/agent-config/commit/7e0fd6ba6c9b3dab62c3f3dbf3ff5a846515b0a4))
* **closure-scan:** list the verify clauses whose oracle cannot say no ([86d2c07](https://github.com/event4u-app/agent-config/commit/86d2c07771c7c2a8000a63f46cd2de27b9d57c1c))
* **run-continuation:** carry the expectation into the continuation message ([67fdd5b](https://github.com/event4u-app/agent-config/commit/67fdd5b0f1dfa743444930f591cb2a231a3bfe00))
* **verify:** one parser for the verify clause, with an expectation half ([8b5a878](https://github.com/event4u-app/agent-config/commit/8b5a87881c1dea06b8c092d48dbac2991d3c5760))
* **hooks:** carry the host lowering table further toward every host ([d28ce58](https://github.com/event4u-app/agent-config/commit/d28ce587ab6b3e3010aada63c59985d22d63c0dd))
* **obligations:** name the writer on every obligation row ([46d3ebf](https://github.com/event4u-app/agent-config/commit/46d3ebf806f52cddec4e65913860b055ec869417))
* **denylist:** give every external-source subject a registry entry ([bb1107d](https://github.com/event4u-app/agent-config/commit/bb1107d5a4b033021bf6c9d22f30c977b277150c))
* **probe:** report a false green as a refusal, and archive the roadmap ([0eadd50](https://github.com/event4u-app/agent-config/commit/0eadd503f9f735162acc951d636987738f1d92f4))
* **design-pass:** report stale, and stop reporting a count against inputs that moved ([4032b24](https://github.com/event4u-app/agent-config/commit/4032b24aea47144cf07fc51680a0b1d227660c71))
* **probe:** record the inputs beside the timestamp, on every artefact ([c86ebad](https://github.com/event4u-app/agent-config/commit/c86ebad009fe41485f6e28ce8b4fa23ef9a5dbac))
* **ui:** report a port that handed all its work back, in shadow ([55b4378](https://github.com/event4u-app/agent-config/commit/55b4378732b7601afbe37356c9e35dba7aac7c11))
* **probe:** give the conformance artefact a vocabulary for what it read ([e07a896](https://github.com/event4u-app/agent-config/commit/e07a8967164e7d2c8409c91ec67b56dca12d52b0))
* **reporter:** count the artifacts that carry one obligation ([cabc485](https://github.com/event4u-app/agent-config/commit/cabc48540c446dbc4138e00117aec49545d155d2))
* **doctor:** report the host traffic environment, and never omit a row ([454e072](https://github.com/event4u-app/agent-config/commit/454e07223d5ba539bc341b802506eca282bd9122))
* declare inputs on one command and one skill ([124dc5b](https://github.com/event4u-app/agent-config/commit/124dc5becdbab71993c7993eac6072265cd9d9fe))
* **mcp:** derive the argument-hint and the wire arguments from the declaration ([15f1f66](https://github.com/event4u-app/agent-config/commit/15f1f665c082fa6fb74a11c91ac11e7e995afcdf))
* **scripts:** fail an in-body reference no declaration backs ([c2a2d07](https://github.com/event4u-app/agent-config/commit/c2a2d07f3bb9d794aa9110aa2768ab48f84ba492))
* **schemas:** declare inputs once, structurally ([3cfaa6f](https://github.com/event4u-app/agent-config/commit/3cfaa6f2183bd6f567a4ff0ebc2ead864ac1df82))
* **scripts:** ratchet foreign placeholder syntaxes shrink-only ([d9c99ad](https://github.com/event4u-app/agent-config/commit/d9c99ad9a3a8d1f7d0d825109a59daaa17d45ba7))
* **scripts:** census the invocation surface, with the unit defined first ([833e2f6](https://github.com/event4u-app/agent-config/commit/833e2f6f44cef9e7ebbd277ef4b5e7dee8744edd))
* **scripts:** count which concerns sit on slots that cannot deny ([76811e9](https://github.com/event4u-app/agent-config/commit/76811e9653014adfea2f0f157733a2117f0af248))
* **scripts:** add the body-portable eligibility predicate ([e0eb189](https://github.com/event4u-app/agent-config/commit/e0eb1892b91087afa673861b4b3df172d411e55d))
* **scripts:** census which skill semantics the MCP-lite carrier drops ([88cff00](https://github.com/event4u-app/agent-config/commit/88cff0053daeb92c645673781094b0ca20b6517d))
* **gates:** lint_roadmap_blockers scans agents/roadmaps/stubs/ ([a1e47cd](https://github.com/event4u-app/agent-config/commit/a1e47cd288ca00d18dbeb4e30d0b2f37b58ce886))
* **design-review:** demote the screenshot to an appearance-only floor ([d7427f7](https://github.com/event4u-app/agent-config/commit/d7427f7bd16d8da0dca699cc5d03291059b0659d))

### Bug Fixes

* **release:** count tests by running files, not by static parse (#2145) ([396fbbc](https://github.com/event4u-app/agent-config/commit/396fbbc27f37147a2dad7757a69147b7e0d9a761))
* **roadmap:** make the menu-precision path-scoping blocker machine-readable (#2119) ([016530f](https://github.com/event4u-app/agent-config/commit/016530fd099d74f48b4fb3346226fb48608597fa))
* **adversarial-verification:** enable auto-merge, fix the deploy-row checker, and withdraw an AC-5 close that did not hold (#2114) ([52f2da9](https://github.com/event4u-app/agent-config/commit/52f2da946181ab0ab5437055ec55759f6e04fd92))
* **roadmap:** make the obligation-writer corpus blocker machine-readable (#2117) ([9de3e0c](https://github.com/event4u-app/agent-config/commit/9de3e0cd3cf8a4ae08c9b809038f225e3750adef))
* **citations:** re-derive the codex writer pin after install.ts shrank ([3c2041a](https://github.com/event4u-app/agent-config/commit/3c2041a152d77ad6799f0053eb8be509ec8824d4))
* **host-env:** an absent section must parse, and now a test says so ([51c2bab](https://github.com/event4u-app/agent-config/commit/51c2bab3fda07042a643cd10ec26c04bd381349c))
* **size-budget:** pay the read-surface declaration nothing ([bfce3ac](https://github.com/event4u-app/agent-config/commit/bfce3ac363c6e6013aad9829d7289ab388940c6e))
* **read-surface:** a deterministic traversal test, and a claim I got wrong ([b883d80](https://github.com/event4u-app/agent-config/commit/b883d80cc0074381bbd5b91a52aebaeefa6b480f))
* **update-prices:** a canonical ASCII boundary, and the exploit that is not there ([6281500](https://github.com/event4u-app/agent-config/commit/62815002af383bdb3655fb4d62956f69ef0397d9))
* **read-surface:** four findings from the second review round ([1bd1f97](https://github.com/event4u-app/agent-config/commit/1bd1f9718d3d667c727a30197162005900a70d2e))
* **rules:** keep ui-audit-gate inside the measured per-spawn payload ceiling ([bc499bf](https://github.com/event4u-app/agent-config/commit/bc499bf6c9e773800373a918966fed42530703ea))
* **ci:** four gates this branch reds, each for a real reason ([6b9f886](https://github.com/event4u-app/agent-config/commit/6b9f886f6a269fed302b9e5b2bdee16c5cbf973b))
* **work-engine:** close seven defects an independent review found ([3e83a51](https://github.com/event4u-app/agent-config/commit/3e83a513aeb8b15fd93f5dedcd8682471955a4cf))
* **hooks:** use the shared session-stability predicate main brought in ([d229d1a](https://github.com/event4u-app/agent-config/commit/d229d1afde93903e42fad03f5bf95b5a5216af6e))
* **plumbing-guards:** three defects an independent review found before merge ([afcd180](https://github.com/event4u-app/agent-config/commit/afcd180c0614f950d7ae58b361d0c3512aee891d))
* **skills:** keep existing-ui-audit under its size budget and at dialect baseline ([876b045](https://github.com/event4u-app/agent-config/commit/876b04557a4da5932a2bc927c2d68d1fa256da71))
* **work-engine:** make the taxonomy floors and the AC-2 guard testable alone ([0e30e4a](https://github.com/event4u-app/agent-config/commit/0e30e4ac9f9a7691d24d44a942a85c5e77272442))
* **gates:** host the kill-switch step where its trigger paths already are ([2ffcd47](https://github.com/event4u-app/agent-config/commit/2ffcd4771ef14987a0f826a75c58c219aac9fdfa))
* **hooks:** keep the settle concern's main() argv-shaped ([0a0a4d7](https://github.com/event4u-app/agent-config/commit/0a0a4d7ca49cd6b03c337024610b58dbff9d6147))
* **hooks:** join the ledger on ONE root resolver, and make the reproduction reproduce ([27deeb0](https://github.com/event4u-app/agent-config/commit/27deeb0a365a011e269c91eec02bf6a31ca39274))
* **hooks:** narrow detector F to a new test file, and label the evidence honestly ([285c51e](https://github.com/event4u-app/agent-config/commit/285c51ec3f2b0b2c97dffd25c159b86e87524f75))
* **hooks:** read the exit code the host actually reports, not the one it does not ([7282593](https://github.com/event4u-app/agent-config/commit/7282593773a823f1021d18aad4c77f729601ffc3))
* **hooks:** join the obligation reader to the key the writer used ([5c94152](https://github.com/event4u-app/agent-config/commit/5c94152581b44b6ec68f26201c45ca8cad6107f3))
* **roadmap:** report against the acceptance criteria, do not rewrite them ([2bf7673](https://github.com/event4u-app/agent-config/commit/2bf7673fd2ff2c81603c953fe258ff102d6819ad))
* **verify:** bound a clause to its own paragraph, not to the whole step ([55cf57c](https://github.com/event4u-app/agent-config/commit/55cf57ce2ee42b3ecfbfb11708353fee2028467b))
* act on an independent review of this branch ([b5d2d8f](https://github.com/event4u-app/agent-config/commit/b5d2d8f4ecda62d9dbf34da5285b7620dd6eb839))
* **verify:** keep the over-cap hook at its size, and stop F5 reading as a roadmap ([846d765](https://github.com/event4u-app/agent-config/commit/846d76502b7f870174c11ff3b5a62d4cefc57507))
* **injection-budget:** meter only the hosts whose emission reaches them ([cde876e](https://github.com/event4u-app/agent-config/commit/cde876e7f7c2d34346a9e83fe7fd4750158a1dbc))
* **host-lowering:** two defects the answered_at fixtures surfaced, and the tests that hold them ([5eadd50](https://github.com/event4u-app/agent-config/commit/5eadd507c1412c61904cab18b3970452b7229511))
* **canonical-terms:** write the two new prose lines in house dialect ([21894c1](https://github.com/event4u-app/agent-config/commit/21894c16fa0a9e8b0753f9f21fc5b86db17ff13b))
* **probe:** record inputs on the stopped path too ([952e616](https://github.com/event4u-app/agent-config/commit/952e6167dd21d7e0a38b93fa19703124704d7299))
* **contexts:** keep the pointer, drop the argument for the pointer ([3d84ba0](https://github.com/event4u-app/agent-config/commit/3d84ba04d5daa2cf6a2ccc41fbcf2333bcebca10))
* **ui:** match a declared item by id, and report the shadow outcome ([2b6a0f5](https://github.com/event4u-app/agent-config/commit/2b6a0f551278446aa839f1e0f6e79791ab0c8108))
* **docs:** write the traffic doc in the house dialect ([10a9de9](https://github.com/event4u-app/agent-config/commit/10a9de902b2cc4e6761e2b156cde53476ac4deef))
* **tests:** narrow the comparison union before reading its reason ([cc270c9](https://github.com/event4u-app/agent-config/commit/cc270c9e83517a4ca2c9ed96c0f1e87fca7b2986))
* **ui:** account for a declared item by id, not by substring ([99933fa](https://github.com/event4u-app/agent-config/commit/99933fac372e2f2d37b18c83baf8d6c3a0555872))
* **review:** stop a removal claim inside a modified file from disproving itself ([54c01ad](https://github.com/event4u-app/agent-config/commit/54c01ad156761c7a62c90029f40e453dab55d52d))
* **config:** give the placeholder budget an owner and a review date ([cc28417](https://github.com/event4u-app/agent-config/commit/cc2841777e28b340f34d0385cd0d69dc56e3f42c))
* **gates:** refuse an empty corpus, and record the ratification ([a9e7da2](https://github.com/event4u-app/agent-config/commit/a9e7da2150097f74d03f10467bd54c73ec9deef9))
* register the gates, and stop the reader guessing ([8714a7a](https://github.com/event4u-app/agent-config/commit/8714a7a2724c15264bea3144e942dfa83785f4ab))
* **scripts:** stop the audit failing open on a host with no slot rows ([074ae19](https://github.com/event4u-app/agent-config/commit/074ae19883ca19facc8588280ab74421095162a6))
* **scripts:** bind the carrier constants to the carrier, and share one classifier ([828d384](https://github.com/event4u-app/agent-config/commit/828d384102755fade06a2632228242aedc9a5018))
* **roadmaps:** close the three lint_decision_classes violations ([9b9f61b](https://github.com/event4u-app/agent-config/commit/9b9f61b7f77e814e3ee76fbb8bb384b02b5d900c))
* **claims,roadmap:** six corrections from an independent read of this branch ([5169ced](https://github.com/event4u-app/agent-config/commit/5169cedaaafc9992ce2afb5cc27bd071d4f1a86f))
* **claims:** correct the two ledger sentences that denied a shipped collector ([1ec20a6](https://github.com/event4u-app/agent-config/commit/1ec20a65887628c5b23312a0c35a3458209f82bd))
* **review:** re-derive the manifest hashes after the roadmap's final edits ([319d35e](https://github.com/event4u-app/agent-config/commit/319d35edafe3f9ffc058d5def02b96c780a650e9))
* **ci:** write the house dialect and refresh the routing-signal verdict ([91503fc](https://github.com/event4u-app/agent-config/commit/91503fc2b5ad28f5720d443fcfbfff3fe1242c77))
* **gates:** correct the blocker gate's own scope claims, and pin the widened default ([5857ef1](https://github.com/event4u-app/agent-config/commit/5857ef107468f03561ea7e45ddafd2a613642acd))
* **design-review:** drop the archived-roadmap path from the appearance floor ([26a2dbd](https://github.com/event4u-app/agent-config/commit/26a2dbd7b5a7ae39d7cc8d0b992782490a43853d))
* **claims:** re-measure the artifact counts the claim had gone stale against ([1528325](https://github.com/event4u-app/agent-config/commit/15283253b24a875f6fe466b29e8ec8b40b6fdb91))
* **review:** disprove a deletion claim against the tree before it blocks a release ([c7f813f](https://github.com/event4u-app/agent-config/commit/c7f813ffc39acc712ecb309f4c5f1df702e31ea1))

### Performance

* **enforcement-coverage:** worklist the reachability fixed point (#2112) ([7090e82](https://github.com/event4u-app/agent-config/commit/7090e822e74fdb10295be2d652b572ccb0a28d5d))
* **hooks:** compile the lowering table — 9 ms off every dispatch (#2110) ([4d60b86](https://github.com/event4u-app/agent-config/commit/4d60b866732808e3252336c26f198134d6ed0c34))

### Reverts

* **structural-hiding:** hold the transform, land the inventory gate ([55dae10](https://github.com/event4u-app/agent-config/commit/55dae10e9aa9339b8f6180c0bfe7565fcaa02f65))

### Documentation

* **roadmap:** mark the bounded-approval-floor-waiver's owner-reserved step, and date M18 (#2116) ([0a462f2](https://github.com/event4u-app/agent-config/commit/0a462f29b37ccc5595b94f23808d3d2b421f3bd5))
* **roadmap:** the 2026-09-30 window reading, and the reset three readings missed (#2115) ([e6b8ac3](https://github.com/event4u-app/agent-config/commit/e6b8ac3a6630015de2f84c0799fd15bc5687b9ad))
* **roadmap:** correct the release-holds measurement-window record against the live tree (#2113) ([7c065c3](https://github.com/event4u-app/agent-config/commit/7c065c30464be92720a3ff41f45269b13c0db8d8))
* **ratification:** record the five-round review that ratified this branch ([41f29b9](https://github.com/event4u-app/agent-config/commit/41f29b991676c747050747b976dcffce618358fa))
* **evidence:** record the holdout-corpus growth and move the two counts ([ce90f34](https://github.com/event4u-app/agent-config/commit/ce90f34008e56ae47875ecad1e72d9ecb1819ac9))
* **admissions:** record why block-plumbing-writes was admitted ([2203c9e](https://github.com/event4u-app/agent-config/commit/2203c9ed2c62b4cffee1edc405d5b6a28269c559))
* **budget:** record that the pre_tool_use revisit-if fired, and what this branch cost ([724329f](https://github.com/event4u-app/agent-config/commit/724329fd410daada84347f7ec843434e8aa84fff))
* **roadmaps:** record the review round and withdraw two false claims ([3947043](https://github.com/event4u-app/agent-config/commit/3947043b4cbbc789d7d0a39f3a4c140c993bb495))
* **roadmap:** re-review the risk register against what actually landed ([5b89946](https://github.com/event4u-app/agent-config/commit/5b89946d5c44ad0d69121f6211d95e98d5276dfa))
* **ratification:** record the ratified verdict and the three fixed blockers ([c6ad1bb](https://github.com/event4u-app/agent-config/commit/c6ad1bb23e4e6a5defc0450cf070bdaa67f443d7))
* **roadmap:** close Phases 1, 2 and 4 with evidence; record the Phase 3 blocker ([8e6db5c](https://github.com/event4u-app/agent-config/commit/8e6db5cd36fa32ff881cc00636821bfe962e8fdc))
* **roadmaps:** close the component-taxonomy roadmap and archive it ([6ae9804](https://github.com/event4u-app/agent-config/commit/6ae9804e9b42b4063c0d39f6033a0b12b4b695ec))
* **ui-track:** record taxonomy detection and the fourth greenfield option ([91d0c55](https://github.com/event4u-app/agent-config/commit/91d0c55d7ec7f38840cc7062f74122589b53d7cc))
* **roadmaps:** record the review round, and what it changed about the closed steps ([57bc4b1](https://github.com/event4u-app/agent-config/commit/57bc4b1312e0fb76239c10ca5848a849d6852cb8))
* **evidence:** record the independent review of this branch ([c8e775b](https://github.com/event4u-app/agent-config/commit/c8e775b3d13d9bb2c9a4d5382ab88c262b977faf))
* **ratification:** record the three-round review, and leave Phase 2 open ([0758dca](https://github.com/event4u-app/agent-config/commit/0758dcaf962b324f59c5628ba3e6fc12f85a7d99))
* **enforcement-by-host:** state what the tree does, and what it does not record ([80f7cf0](https://github.com/event4u-app/agent-config/commit/80f7cf06853ba7a782813f4cc3488f774449da96))
* **roadmaps:** close six steps of road-to-a-stop-that-holds, and name what stays open ([862227a](https://github.com/event4u-app/agent-config/commit/862227aa9c2becf1087cafeedce5d0fefbbfc69c))
* **claims:** reset the obligation-settle bar window at the join fix ([ab59f86](https://github.com/event4u-app/agent-config/commit/ab59f866f5d337f30c9de8385f073790c7335c57))
* **hooks:** inventory every AGENT_CONFIG kill switch the hook layer reads ([b9e9d9e](https://github.com/event4u-app/agent-config/commit/b9e9d9e34f205f17b30ad0b26fc632e9c201798c))
* **closure-scan:** say that the unfalsifiable count is a lower bound ([e6fd3ee](https://github.com/event4u-app/agent-config/commit/e6fd3ee3e92fe24295dbad37613ec01723488b26))
* **verify:** correct four refuted figures, and unship a dated number ([7f165fb](https://github.com/event4u-app/agent-config/commit/7f165fb1ee30a786eed89878f5a972f1ebcb0c28))
* **evidence:** say which sha the reading was taken against, and that it held ([b9e3cbd](https://github.com/event4u-app/agent-config/commit/b9e3cbd993bf3ce65bc9a5ddd78cb310a72a4053))
* **evidence:** record the measured routing precision and cite it in the register ([5feeba5](https://github.com/event4u-app/agent-config/commit/5feeba5f9d0da66d1193acccae07b647051f3ec2))
* **roadmaps:** close the probe-inputs roadmap, and retract the claim it got wrong ([106e80f](https://github.com/event4u-app/agent-config/commit/106e80f2c73f8fe7b7d68da65870af5f1ce8ca8c))
* **onboarding:** point the consumer tour at the traffic mapping, close phases 1-3 ([a2a7a43](https://github.com/event4u-app/agent-config/commit/a2a7a4388ddc37c4a6d5c350c053f923bc860add))
* **setup:** map the host traffic variables against the shipped binary ([3428a55](https://github.com/event4u-app/agent-config/commit/3428a55924c426142b92a561d056d63913cc64e4))
* **roadmaps:** close the fact-plane roadmap with its evidence and two findings ([0b10990](https://github.com/event4u-app/agent-config/commit/0b10990d21ccba680055c5a1d5f64a713bb8b6b1))
* **roadmaps:** close road-to-an-invocation-contract-that-reaches-the-wire ([3c8fbd1](https://github.com/event4u-app/agent-config/commit/3c8fbd1fbd3d6fd88d17b44edd2473f977f3984b))
* **roadmaps:** close road-to-a-content-scanner-on-a-slot-that-can-refuse ([43c717e](https://github.com/event4u-app/agent-config/commit/43c717e5a803cc2a327bd07133a83652dd21150a))
* **enforcement:** say which concern sits on which slot, and why ([43c2c5b](https://github.com/event4u-app/agent-config/commit/43c2c5b526f152f6fbeb67c57ac8fdb2b27aa6e1))
* **roadmaps:** byte-equality is necessary and not sufficient ([2bfb6cb](https://github.com/event4u-app/agent-config/commit/2bfb6cb2a839e18844bb01b829794571e379d47a))
* **review:** declare the completion review skipped — this diff has no code surface ([549c3cc](https://github.com/event4u-app/agent-config/commit/549c3cc8e801d9315abd11e236791df69957691d))
* **roadmaps:** state the measured growth figure in both claims ([2bb25fe](https://github.com/event4u-app/agent-config/commit/2bb25fe5138510e048383dbcb0a3c57495fde687))
* **roadmaps:** make the two growth claims legible in the gate output ([01bb781](https://github.com/event4u-app/agent-config/commit/01bb781bdda772ae3f48dc051d66dcee794c3036))
* **evidence:** record the inbox-2026-09-ab disposition ([6697f68](https://github.com/event4u-app/agent-config/commit/6697f68c6dc8a039fce80a788a866c1f800e9c01))
* **roadmaps:** record arrival counts on 18 held objects ([3d2a99c](https://github.com/event4u-app/agent-config/commit/3d2a99c6ffe8fbb94004f226f6fb0f5a5e2c8aba))
* **roadmaps:** land 22 roadmaps from inbox round inbox-2026-09-ab ([e0db0cc](https://github.com/event4u-app/agent-config/commit/e0db0cca23e56e18c9e122254fdfeab06a84b39f))
* **review:** re-bind the skip to the post-fix scope, and record what the read returned ([246d7ea](https://github.com/event4u-app/agent-config/commit/246d7eab5bfdc2cb5bd298d0b705472f0ceb024d))
* **roadmap:** record the per-track governance ruling as pending, and close its blocker ([464b1ab](https://github.com/event4u-app/agent-config/commit/464b1ab8f7f82eb54a4471a22252be7a14dd4314))
* **review:** declare the completion-review skip for this closure ([755d616](https://github.com/event4u-app/agent-config/commit/755d616d9b7c9f207d21c865524da97c5ee9041f))
* **roadmap:** record the owner ruling on the probe lane ([4bdc42d](https://github.com/event4u-app/agent-config/commit/4bdc42d78c38a575f4704f9a9cd153466411c32e))
* **review:** re-point the findings artifact at the current review scope ([9b62299](https://github.com/event4u-app/agent-config/commit/9b6229945474441d0a724ff1d20a37111e118674))
* **roadmap:** move the post-review AC-4 corrections out of the AC section ([74150a8](https://github.com/event4u-app/agent-config/commit/74150a8434f55dd3669c680e1d5d568575c6fbfc))
* **roadmap:** second risk-register pass, after the independent review moved AC-4 ([81cc461](https://github.com/event4u-app/agent-config/commit/81cc46111b1a456b6ad900c4a1418b0de4a543da))
* **review:** record the §2.5 ordering deviation on the review artifact ([3749d12](https://github.com/event4u-app/agent-config/commit/3749d12c868eb42e44204cd4363f0074c5d9e5b5))
* **review:** land the independent completion review for the blocker-gate widening ([eb4c47f](https://github.com/event4u-app/agent-config/commit/eb4c47f5bb508ea4492cb336836599f2a6f7de7c))
* **evidence:** re-scope the skip declaration and record the two CI catches ([4160717](https://github.com/event4u-app/agent-config/commit/41607171e9e40242944f667b7c58b7a3816361b8))
* **roadmap:** record the archival deadlock AC-4's closure creates ([b4f1751](https://github.com/event4u-app/agent-config/commit/b4f175167550e2944de4e91b3cc4001f880054cb))
* **stubs:** tell stub authors the blocker gate now reads this directory ([c7d5deb](https://github.com/event4u-app/agent-config/commit/c7d5debdc0d2263b0a8dc868213fe5edde54a416))
* **roadmap:** re-review the substrate-stub risk register after AC-4 ([254bf55](https://github.com/event4u-app/agent-config/commit/254bf5596f00438b1cdbd2aeca1f0c533f6ac458))
* **evidence:** declare the completion-review skip for Phase 4 ([f1b1545](https://github.com/event4u-app/agent-config/commit/f1b15458f5d2e7c8b11ab81c8c8dedb7260c1746))
* **roadmap:** close AC-4 of the substrate-stub roadmap on the owner ruling ([4b5a23d](https://github.com/event4u-app/agent-config/commit/4b5a23dd74b37e3b4ad6d36b55a14c96beb12b67))
* **roadmap:** re-review the risk register after Phase 4 landed ([144f209](https://github.com/event4u-app/agent-config/commit/144f209a98214b2568fbe1c51062c043a91b362b))
* **roadmap:** record the owner ruling and close Phase 4 ([6f71003](https://github.com/event4u-app/agent-config/commit/6f71003642732c94eb518115415d2410e8d36f12))

### Refactoring

* **hooks:** move the record reader to its producer, and the verdict prose to its vocabulary ([063197a](https://github.com/event4u-app/agent-config/commit/063197ae40b62d4a3c4d893186787206b2bd1145))
* **contexts:** one carrier for the commit obligation, not three ([1a87d86](https://github.com/event4u-app/agent-config/commit/1a87d86502b922c74601295138374db8838fdc19))
* **design-review:** fit the appearance floor under the 400-line skill cap ([6daa154](https://github.com/event4u-app/agent-config/commit/6daa154b59a699b369bd83e2fb3be03b8eb55105))

### Tests

* **read-surface:** type the fixture index accesses and the transport request ([e6983ed](https://github.com/event4u-app/agent-config/commit/e6983edf355433ad87cbc34bdba49ec1aca35131))
* **routing:** hold the trigger corpus to the case-class discipline, and re-seed ([76cfda9](https://github.com/event4u-app/agent-config/commit/76cfda96b6c3ad464871e08badabf705f9066d93))
* **routing:** add the trigger corpus for ui-component-architect ([2c567c3](https://github.com/event4u-app/agent-config/commit/2c567c30307c85ee67747296eefa7d496d14605f))
* **work-engine:** make three weak assertions discriminate, and cover the new refusals ([48c8a88](https://github.com/event4u-app/agent-config/commit/48c8a885a855a38b79ca3b16c8ae823af398f3e9))
* **golden:** re-capture GT-U9 and GT-U10 for the fourth greenfield option ([a993773](https://github.com/event4u-app/agent-config/commit/a9937736cf6de275a30cc02294e9f53308e37088))
* **work-engine:** cover detection, placement and the greenfield offer ([e89d304](https://github.com/event4u-app/agent-config/commit/e89d30414b66472dc1bbf55591762e286883183f))
* **transcript:** state the not-measured byte column on the token fixtures ([071d7dd](https://github.com/event4u-app/agent-config/commit/071d7dd3bbf7d254ae7174b18b3e69dbe972e648))
* **fixtures:** capture the two inputs the conformance probe had never seen ([b7c3f57](https://github.com/event4u-app/agent-config/commit/b7c3f579026c0f75487ee3f6e920722f912659b2))
* **ui:** plant three port losses and pre-register what today catches ([7b35b4c](https://github.com/event4u-app/agent-config/commit/7b35b4c5c42bde3997a936574735f2066b975f6e))

### Chores

* **deps:** vitest 2 → 5, vite 5 → 8 (#2111) ([1f44215](https://github.com/event4u-app/agent-config/commit/1f442155ae679b38de1ea179ee85a133ce30a1d1))
* **deps:** clear the production-dependency advisories the packed job flagged ([0f68f1a](https://github.com/event4u-app/agent-config/commit/0f68f1a45fcb06a7063f42aa8b843e0a93cbc62b))
* **roadmaps:** archive two completed roadmaps, carry their three deferrals ([b29a75c](https://github.com/event4u-app/agent-config/commit/b29a75c6b51ca28b118a830f10c3cfd422380032))
* **evidence:** re-emit the standing-payload census and the host cost table ([f8cea12](https://github.com/event4u-app/agent-config/commit/f8cea1246934fb3ddb8d729df637a49387336ee2))
* **estate:** claim the one-concern growth where it happened ([028fc20](https://github.com/event4u-app/agent-config/commit/028fc202a7ba0a7d635883a30635a4e450487d25))
* **roadmaps:** re-review the risk register on the five closed steps ([a4a5dee](https://github.com/event4u-app/agent-config/commit/a4a5dee30427779e2a0c7ed0f056cc7dfc76309a))
* **roadmaps:** close five steps of road-to-a-menu-whose-precision-is-measured ([5ba60b9](https://github.com/event4u-app/agent-config/commit/5ba60b9d9c3d82229b6cac400ad6c18cf0f95ed7))
* **roadmaps:** close six steps, and correct the roadmap own refuted figures ([2958ecc](https://github.com/event4u-app/agent-config/commit/2958ecc79e77387961f9cd86cc78958cd04b7dcf))
* **dist:** rebuild the install bundle after the lowering-reader change ([a765c56](https://github.com/event4u-app/agent-config/commit/a765c569a511ab69e96278da230bcc9b84aebf82))
* **roadmaps:** archive road-to-a-denylist-that-sees-every-subject ([ea6363f](https://github.com/event4u-app/agent-config/commit/ea6363f76b26cdbeb5da69d561c5f8bddd40c753))
* **dist:** regenerate the ui apply directive after the merge ([d310aa6](https://github.com/event4u-app/agent-config/commit/d310aa61b082854f293f898befb94aab755eaf88))
* **ratchet:** follow the source-size gain down to 17,748 ([e52a668](https://github.com/event4u-app/agent-config/commit/e52a668bda84201dbc20376056d2a9a22ddf3fc4))
* **roadmaps:** archive road-to-probe-evidence-that-knows-its-inputs ([2c1e9e3](https://github.com/event4u-app/agent-config/commit/2c1e9e3fa6173359a3f6add4e880d47539d98a8b))
* **roadmaps:** archive road-to-a-fact-plane-the-reviewer-cannot-invent ([e3dc42f](https://github.com/event4u-app/agent-config/commit/e3dc42fb9a21349146cbebf29cb6958123a59562))
* **roadmaps:** archive road-to-an-invocation-contract-that-reaches-the-wire ([98da5a7](https://github.com/event4u-app/agent-config/commit/98da5a7ae5c95f6413fd0826734134116321ecc2))
* **hooks:** recompile the manifest after the concern header edit ([319e43e](https://github.com/event4u-app/agent-config/commit/319e43eeba5b69fbb239d6fc0f694c3318dcdcc9))
* **roadmaps:** archive road-to-a-content-scanner-on-a-slot-that-can-refuse ([f426526](https://github.com/event4u-app/agent-config/commit/f426526328ed48be0ad865f5df889fff639c7739))
* **roadmaps:** archive road-to-semantic-parity-before-off-menu ([35e37a6](https://github.com/event4u-app/agent-config/commit/35e37a64d0236eb423f2a2c1c5869741c545b754))
* **roadmap:** archive the substrate-stub roadmap now its last blocker is closed ([4865319](https://github.com/event4u-app/agent-config/commit/4865319602eea85a5052f62721c6f13023013cf0))
* **roadmaps:** archive the behaviour-evidence-over-pixels roadmap ([88449ba](https://github.com/event4u-app/agent-config/commit/88449bac119738e75c2a3c2dfb4c94b000dd2ceb))
* **gates:** reaffirm the lint_handoffs baseline, measured rather than waved through ([6d757a7](https://github.com/event4u-app/agent-config/commit/6d757a79356cd26545a9283b94ca24820ac474e5))

### Other

* One corpus re-check that actually ran, and a repo-wide red due 2026-11-22 (#2137) ([d9ae1da](https://github.com/event4u-app/agent-config/commit/d9ae1da3f411d2905cbdca41a5f58b54bbbb4ed6))
* Close AC-5 on the command it names, and hand AC-4 and AC-6 to their owners (#2143) ([4e803d6](https://github.com/event4u-app/agent-config/commit/4e803d6204906ce5357808ad2ec146e285249a0b))
* The plumbing roadmap's last measurable gap, measured (#2135) ([db000c5](https://github.com/event4u-app/agent-config/commit/db000c50cd6dde87cd4e35b477a236aadcf9e797))
* ci_settle refuses an argument it does not honour, and the doc that taught a wrong one (#2130) ([dbbf470](https://github.com/event4u-app/agent-config/commit/dbbf470b8acd15a523a8b2db85cda66e72bd5115))
* A zero in the enforcement table becomes a fact with a date on it (#2141) ([ab2c75d](https://github.com/event4u-app/agent-config/commit/ab2c75dcbb31bb02bf16f4159c60ed8740fba58f))
* The typed-grants roadmap, dispositioned: stop the ladder handing out the autonomy self-grant (#2140) ([5ade6a5](https://github.com/event4u-app/agent-config/commit/5ade6a5b88b3a55fcc697c45f585b149cd0c177c))
* Decision closure: route its own ownership blocker to the council it specifies (#2139) ([405c5d8](https://github.com/event4u-app/agent-config/commit/405c5d82accf36c8f808c5fcfa8176db717cc4c2))
* Re-probe the menu-precision E3 blocker and correct five stale figures (#2138) ([ad79f85](https://github.com/event4u-app/agent-config/commit/ad79f858af0ae102faef2f23f561283869e6b848))
* Park the release-holds roadmap in later/, with a wake test a gate can read (#2136) ([d6e2e14](https://github.com/event4u-app/agent-config/commit/d6e2e1458529bc8c95622461c0542618598926b4))
* Close what is agent-closable on trigger-eval freshness, and defer the owner-owned choice (#2134) ([5a4b897](https://github.com/event4u-app/agent-config/commit/5a4b8972102ab820bd451c7fd60ed6be189b4fec))
* The obligation-row roadmap's last step, routed to its owner (#2133) ([fb915c0](https://github.com/event4u-app/agent-config/commit/fb915c08b73fd76574ad1ee15df9ba3ca15f4c57))
* Close the ledger roadmap by carrying its one unreachable step to its live owner (#2132) ([1fd8f00](https://github.com/event4u-app/agent-config/commit/1fd8f006d6c0c7dd77666637f265ab3d690652dd))
* Re-probe the shadow-release gate and re-verify the UI coverage ledger live (#2131) ([cdb16f7](https://github.com/event4u-app/agent-config/commit/cdb16f7f25d781a7f135d15d9b8a30d9af327639))
* A reader for the shadow corpus, and the review that reopened a checkbox (#2142) ([e51a1df](https://github.com/event4u-app/agent-config/commit/e51a1dfda1585971872accc38e1ad43064a56eb3))
* One verification classifier, anchored on the segment head (#2129) ([9f2b9fb](https://github.com/event4u-app/agent-config/commit/9f2b9fb4a78f2270eaa040513050e7a2d657879e))
* The review of the stop gate, acted on (#2128) ([5689c2d](https://github.com/event4u-app/agent-config/commit/5689c2d1266560c187cb4df5bac73327d4dd71ed))
* The stop gate measures the turns it lets through (#2127) ([ce923cc](https://github.com/event4u-app/agent-config/commit/ce923cce720bc84885ef24270a2e7dc9b197f09e))
* Rotation coverage survives suite growth, and the freshness bill is priced (#2126) ([7178cdd](https://github.com/event4u-app/agent-config/commit/7178cdd1c3ca500bfb0507493329e4e461fff062))
* Close the corpus stamp-edit ambiguity and structure the cadence hold (#2125) ([aae6467](https://github.com/event4u-app/agent-config/commit/aae6467510dfcb4bb7ce09bc0110b3fe57415439))
* Phase 2 of road-to-host-claims closes: slot-failure rows from a pinnable source, and its blocker becomes machine-readable (#2124) ([14ff4a3](https://github.com/event4u-app/agent-config/commit/14ff4a3ca89bbd871305aac8294ea4753c245e88))
* The dispatcher measures what it runs, per concern (#2121) ([a129277](https://github.com/event4u-app/agent-config/commit/a129277d510ba43baf627b9d649852bf21c03a58))
* Close the UI coverage ledger's measurement half, and make 3.2's release gate machine-readable (#2122) ([99db452](https://github.com/event4u-app/agent-config/commit/99db452b9868d9af47381074d3abf8b5c64afc71))
* The structural-hiding detector returns parser-backed, and Phase 3 closes (#2123) ([9b128df](https://github.com/event4u-app/agent-config/commit/9b128df1d1dd5362234c8185fb378bc82a1be627))
* Mark decision-closure's blocked steps machine-readable, and re-verify its five open boxes (#2120) ([ebd31d9](https://github.com/event4u-app/agent-config/commit/ebd31d9482f7b299dee7ba0281f4eaf5cc1cbd33))
* The lockout recovery procedure is rehearsed, and bounded-approval-floor-waiver closes (#2118) ([4429b1d](https://github.com/event4u-app/agent-config/commit/4429b1d3df9d7495d14f1ef61e356f5c5d0125d5))
* **canonical-terms:** write the three new prose lines in house dialect ([c0a8c43](https://github.com/event4u-app/agent-config/commit/c0a8c437912f70cf807b4116e120aeea3fcd54b7))

Tests: 24992 (+1020 since 16.1.0)

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
