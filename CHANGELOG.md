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

- **46 settings keys are retired; an install that never changed them sees no
  difference.** Each key's shipped default is now fixed behavior: every reader
  of it — code, rule and command prose, the wizard — was rewritten to that
  default in the same change. **If your `.agent-settings.yml` still sets one,
  that value is ignored** and the loader prints one line per key —
  `<key> was removed (<what decides instead>); ignored.` — so a non-default
  value you chose is lost visibly, never silently. Delete the line to silence
  it. The keys:
  - Output and tone: `telegraph.speak`, `tokens.rich_skills`, `personal.minimal_output`, `personal.play_by_play`, `personal.pr_comment_bot_icon`, `verbosity.intent_announcements`, `verbosity.preview_artifacts`, `verbosity.routine_confirmations`, `verbosity.post_action_reports`.
  - Reasoning protocol switches: `reasoning.auto_gate`, `reasoning.components.orchestrator`, `reasoning.components.notes_first`, `reasoning.components.grounding`, `reasoning.components.intent`, `reasoning.components.complexity_first`, `reasoning.components.verifier_default`, `reasoning.components.prediction_tracking`, `reasoning.components.decision_ledger`, `reasoning.components.uncertainty_budget`.
  - Roadmap cadence: `roadmap.skip_pre_run_gate`, `roadmap.dashboard_regen_cadence`.
  - Command suggestion and PR creation: `commands.auto_detect`, `commands.suggestion.enabled`, `commands.suggestion.confidence_floor`, `commands.suggestion.cooldown_seconds`, `commands.suggestion.max_options`, `commands.create_pr.api_examples`, `commands.create_pr.ui_paths`, `commands.create_pr.api_paths`.
  - Memory and knowledge sharing: `memory.cadence`, `memory.review_threshold`, `knowledge.global_sharing.redaction.enabled`, `knowledge.global_sharing.redaction.halt_on_trigger`, `knowledge.global_sharing.auto_promote_threshold`, `knowledge.global_sharing.freshness.hypothesis_after_days`, `knowledge.global_sharing.freshness.stale_after_days`.
  - Hooks and engine: `hooks.concern_budget.max_per_event`, `hooks.concern_budget.hard_fail`, `decision_engine.surface_traces`, `decision_engine.on_block_fallback`, `explain.enable_last`.
  - Remaining: `project.pr_template`, `pipelines.skill_improvement`, `consistency.cross_source`, `subagents.downshift`, `ai_team.suppress_setup_hint`.
  The reference page lists each key with the behavior that replaces it
  (`templates/agent-settings.md` § Retired keys).

- **A medium security finding now needs a disposition before a release
  ships.** `check_finding_dispositions` treats `security × medium` as blocking
  for every release after 16.3.0 (council 2026-10-07, 2/2). Such a row must
  carry `fixed` (with its commit), `false_positive` or `accepted_risk`, each
  with a rationale and a `verified_by`, like any blocking row, and
  `still_open` keeps the release red with a message saying so. On a release
  pull request (`--pr`), a medium security finding the self-review reported
  but the ledger lacks is red too. Releases up to 16.3.0 are judged as they
  shipped. The merge gate (`self_review_gate.classifyBlocking`) is unchanged,
  so on every other pull request the finding only advises. `claim × medium`
  stays advisory in both.
- **No spend bound applies unless you set one.** Owner directive, 2026-10-05,
  recorded as **ADR-279** and accepted on the owner's own answer (option (a))
  on 2026-10-06. With nothing configured, no USD or token ceiling this package
  defines stops a council run, a debate or a paid gate, and none of them asks —
  because no ceiling exists to ask about. Every ceiling remains settable and
  behaves exactly as its contract describes once set.
  **Your own council file is not rewritten.** If you copied
  `agents/templates/.ai-council.yml.example` before this release it carries
  these lines explicitly, and they are your figures now:
  `cost_budget.max_input_tokens: 500000`, `cost_budget.max_output_tokens:
  200000`, `cost_budget.max_total_usd: 20.0` and `debate.max_cost_usd: 5.00`.
  Delete them to become unbounded; keep them to stay bounded. The shipped
  defaults behind an absent key moved to `0` in all three layers — the loader,
  the command's own fallback for a file with no `cost_budget` block, and the
  `CostBudget` constructor.
  **`max_calls` and the debate round limits did not move**: they bound call
  count per invocation, not money. Nor did any of the controls listed under
  § What stays in ADR-279 — provider refusals, the per-day plan-quota guards,
  the `--confirm` a class-1 gate asks for, the debate's between-round
  confirmation, or the budget an unattended run must still be given.
  **Two defects were repaired in the same change, and both could bite a
  configured install.** `0` was documented as disabling a token cap and did
  not — the two token comparisons carried no zero guard while the two USD
  comparisons beside them did, so a budget with every cap at zero breached on
  a ten-token estimate. And the class-1 gate's two caps had to BOTH be set
  before EITHER applied, so setting one left you bounded by neither. Each cap
  now bounds alone.
  **One optional hard stop now works for the first time.** With
  `cost.enforcement: hard-stop` and a budget configured, the cost preflight
  resolved its budget script relative to the working directory, read the
  resulting empty output as "no budget configured", and exited `0` on a spent
  budget from every working directory. It now resolves the script from its own
  location and exits non-zero as its contract always said it would.

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

- **An old project keeps its real commit format — `agent-config git:convention
  measure`.** A repository with no declared convention and no approved card is
  now measured instead of silently given Conventional Commits: the verb samples
  the non-merge history of the default branch, resolved as the carrier resolves
  it (the server's symref, then `refs/remotes/origin/HEAD`) — with no default
  branch it says so and exits `1` rather than sampling `main`, `master` or the
  current branch in its place — drops bots, automation and bulk imports, caps
  each author per half, and names the established subject family or — below the
  bar — the two strongest. It also proposes a `branch_pattern` from the remote
  branch names (or reports no clear pattern) and shows the observed update style,
  which it never adopts. The thresholds are constants of the module the verb
  runs and are rendered into the commit-subject reference, not restated by hand.
  `show` and `subject` print `no convention established — run git:convention
  measure` in that state (`convention_established` under `--json`; exit codes
  unchanged). An interactive `/commit` asks once — the established family or the
  two strongest against Conventional Commits — and writes the answer to the
  approved convention card, also when the answer is Conventional, so the question
  is never repeated; `/commit:in-chunks` never asks and reports the measurement.
  Where the choice maps to a setting, `measure` prints the ready-to-commit
  `.git-convention.yml` (`commit_format`, `branch_pattern`, never
  `update_strategy`); a human creates and commits it, the agent never writes it.

- **A team's git convention can be declared instead of measured — the new
  `git:` settings block.** Three Class-C keys, each defaulting to the
  behaviour every install had before, so an install that sets nothing is
  unchanged. `git.commit_format: ticket-conventional` writes
  `DEV-1234 feat(exporter): …` instead of `feat(DEV-1234): …` and treats a
  ticket in the scope as a wrong subject; `/commit` and `/commit:in-chunks`
  validate against the regex for the configured format, and the
  conventional-commits-writing classifier gains a `ticket-conventional` family
  so such a history is no longer misread as free-text ticket prefixes.
  `git.branch_pattern` (`{type}`, `{ticket}`, `{slug}`) shapes the branches
  `/worktree:create` proposes; reading a ticket back out of a branch now takes
  the first `[A-Z][A-Z0-9]+-[0-9]+` token that is not a standard name (`UTF`,
  `ISO`, `SHA`, `RFC` prefixes), so `DEV-1234-device-export` yields its ticket.
  Under `git.update_strategy: rebase`, `/create-pr` asks for
  `git rebase origin/<base>` plus `--force-with-lease`, and `/pr:merge`,
  `/prepare-for-review` and `/review:changes` report a behind branch instead of
  updating it; none of them merges the base into a feature branch — one git-workflow reference
  (`references/branch-update.md`) now owns that decision, and
  `sync_pr_branch` exits `3` instead of merging when such a branch is behind
  (a current branch still exits `0`). **What it does not do:** the setting picks the operation and never
  authorises it; git-history-discipline still requires the user's request for
  every rebase, fixup or autosquash. A team declares the keys in
  `.git-convention.yml`, a tracked file at the repository root that overrides
  every developer settings file and where either value is a declaration
  (ADR-283): `git.update_strategy` is read from it at the commit a pull request
  is judged against, so a worktree, a fresh clone and CI agree and a pull
  request cannot change the strategy its own update is judged by;
  `git.commit_format` and `git.branch_pattern` are read at `HEAD`. Without the
  carrier the keys come from the project settings files as before; the
  user-global file does not carry them, and the settings GUI no longer offers
  them while it writes there. `agent-config git:convention show` prints the
  value in force, the commit it was read at and a differing checkout value as
  a candidate; `show --key` judges only the named keys. The commit is the
  `--base` given — a pull request passes `--base origin/<its base>` — else the
  default branch; nothing asks the forge. A carrier that does not parse makes
  `sync_pr_branch` exit `4`, a target that names no commit exit `1`, and a named
  commit that cannot be fetched is `unverified`; none of them merges. A target
  that moves between the strategy read and the merge is read again at the
  commit being merged, which is governed by the strategy it carries: the same
  strategy goes on against it, another one exits `1` before anything is
  merged. A blank `--base` is a usage error (exit `2`) in `sync_pr_branch`,
  `git:convention show` and `sync`, and `check_branch_freshness`, never read
  as no `--base`. A commit-linting config
  in the repository still outranks `git.commit_format`. In a packed consumer
  install `git:convention show` is the git surface that resolves, and the
  consumer matrix proves it with a `git-convention` leg; `sync_pr_branch` and
  `check_branch_freshness`, which `/pr:merge`, `/create-pr`, `/fix:ci` and
  `/roadmap:next` run through `./scripts-run`, still need a source checkout of
  this package.
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

# Era: pre-16.3.0 — archived

> All entries before `16.3.0` live in
> [`docs/archive/CHANGELOG-pre-16.3.0.md`](docs/archive/CHANGELOG-pre-16.3.0.md).
> The archive is read-only; git tags remain the canonical
> source for what shipped. Splitting them out of the main file
> keeps the active era under the 250-line drift cap enforced by
> `tests/test_changelog_eras.py`.

# Era: pre-16.5.0 — archived

> All entries before `16.5.0` live in
> [`docs/archive/CHANGELOG-pre-16.5.0.md`](docs/archive/CHANGELOG-pre-16.5.0.md).
> The archive is read-only; git tags remain the canonical
> source for what shipped. Splitting them out of the main file
> keeps the active era under the 250-line drift cap enforced by
> `tests/test_changelog_eras.py`.

# Era: 16.5.x — current

> Started at `16.5.0`. Full entries live inline below.
> The drift test caps this era at 250 lines of entry body; growth past
> that forces a new era split (`# Era: 16.6.x`, etc.) — see
> [`docs/contracts/CHANGELOG-conventions.md § Era splits`](docs/contracts/CHANGELOG-conventions.md).

## [16.5.0](https://github.com/event4u-app/agent-config/compare/16.4.0...16.5.0) (2026-10-12)

### Release highlights

- **Behaviour changes:** give hand-authored SVG a witness, an owner, and five recorded runs (#2300) (bdeb65c).
- **Default changes + migration:** _none_
- **Security and correctness:** close the two real findings of the third 16.5.0 review, plus road-to-svg-witness-provenance (#2309) (d1f7c3b); close the security findings from the 16.5.0 re-cut review (#2307) (9904258); close the five medium-security findings from the 16.5.0 release review (#2305) (5593838); close the sixth review round of #2302 (#2303) (c88865f); strip only generic glob classes from an inbox name (fda00b3); admit a date suffix only on the families that are dated (fd5be56); +3 more.
- **Honest nulls:** _none_
- **Known limitations:** _none_

> **Governance mix:** governance-only 6 vs consumer-only 1 (taxonomy 1.1.0; range d411219277ce..d1f7c3b834bb).

### Features

* **svg:** close all three SVG roadmaps — routing, review follow-ups and the live-session findings (#2302) ([5098697](https://github.com/event4u-app/agent-config/commit/50986972088029db18a90c6f7d198c5ab0e26da5))
* give hand-authored SVG a witness, an owner, and five recorded runs (#2300) ([bdeb65c](https://github.com/event4u-app/agent-config/commit/bdeb65c37533825c2a3061fb7a33ef5778454d11))

### Bug Fixes

* **svg:** close the two real findings of the third 16.5.0 review, plus road-to-svg-witness-provenance (#2309) ([d1f7c3b](https://github.com/event4u-app/agent-config/commit/d1f7c3b834bb43b8937dee44b7e38733d5eb70f2))
* **svg:** close the security findings from the 16.5.0 re-cut review (#2307) ([9904258](https://github.com/event4u-app/agent-config/commit/990425836285eded0a6cb4370f8ded95823dd6c8))
* **svg:** close the five medium-security findings from the 16.5.0 release review (#2305) ([5593838](https://github.com/event4u-app/agent-config/commit/5593838c01fab686e0856fba227ae4f37cd7b8f0))
* **svg-engine:** close the sixth review round of #2302 (#2303) ([c88865f](https://github.com/event4u-app/agent-config/commit/c88865fdc1aad9337b4f98a868483d571848d7ea))
* **hooks:** strip only generic glob classes from an inbox name ([fda00b3](https://github.com/event4u-app/agent-config/commit/fda00b35ef5a0d2b603b56511a986081a261dc11))
* **hooks:** admit a date suffix only on the families that are dated ([fd5be56](https://github.com/event4u-app/agent-config/commit/fd5be56f6f17ebe96b17579ffdd452cbef3dfc39))
* **hooks:** accept only wildcard-suffixed family heads and keep bracket payloads ([8446cc0](https://github.com/event4u-app/agent-config/commit/8446cc05e322c6d084df502319daff8c1bc79e63))
* **hooks:** let a glob over an opaque family prefix through block-speaking-inbox-dir ([22904a5](https://github.com/event4u-app/agent-config/commit/22904a51d58dd8d3bbed7a6db08b717b7336adb1))
* **lineage:** count a present non-road-to parent as present ([4b40ab6](https://github.com/event4u-app/agent-config/commit/4b40ab692f85bbc2b642f98603a9d601879cd5a1))

### Documentation

* **contracts:** point the hook-concern row at the manifest instead of a count ([3406ae5](https://github.com/event4u-app/agent-config/commit/3406ae53848f7cf2ca866c2d03d297ad549743d1))

### Tests

* **hooks:** table-drive the opaque-family glob cases over all five heads ([52c9e0e](https://github.com/event4u-app/agent-config/commit/52c9e0e40ebd736aadcf8f37831f994ba1fe0dc6))

### Chores

* **ratification:** record the council review of the inbox-name guard change ([a03c9e9](https://github.com/event4u-app/agent-config/commit/a03c9e95a6b7cb58065fd9e9c30b104ebcb4911b))

### Other

* add road-to-svg-from-a-live-session from the continued raster-to-SVG session (#2301) ([a17bd4a](https://github.com/event4u-app/agent-config/commit/a17bd4aa2bcca14cc787096be644647be6188f2e))
* road-to-svg-review-followups from two reviews of the SVG roadmaps (#2299) ([b015b74](https://github.com/event4u-app/agent-config/commit/b015b747f7c2eea4a8206aba846b82dcc6e84f40))
* add two ready SVG roadmaps from inbox-2026-10-l (#2298) ([fd02787](https://github.com/event4u-app/agent-config/commit/fd02787ef8e0e9eb21e9a0256e5f3ea9bca21492))
* give six added verify clauses an expectation that can fail ([9a5338a](https://github.com/event4u-app/agent-config/commit/9a5338aebd49923a894e803b7e21f0d5dbb5d7d3))
* add thirteen ready roadmaps from inbox-2026-10-g..k ([d8a9e43](https://github.com/event4u-app/agent-config/commit/d8a9e43a881bcf6ad9a8a96c83a4e4958f321098))
* record inbox-2026-10-g..k arrivals on held stubs and parked roadmaps ([243b6f3](https://github.com/event4u-app/agent-config/commit/243b6f30251da478e03a5f9aa3d60636a14ea0e1))

Tests: 27325 (+127 since 16.4.0)

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
