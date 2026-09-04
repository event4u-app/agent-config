---
stability: stable
---

# Changelog Conventions

> **Status:** Active · governs the shape of [`CHANGELOG.md`](../../CHANGELOG.md)
> and the per-era archive files under [`docs/archive/`](../archive/).
> Cited from the CHANGELOG header and enforced by
> `tests/lib/changelog_eras.test.ts`.

## Purpose

Locks the entry shape, the breaking-change rules, and the era-split
discipline for `event4u/agent-config`. Auto-generated entries (e.g.
release-please) and hand-written entries follow the same shape so the
file remains uniform across automated and manual releases.

## Entry shape

Each released version is a level-2 heading with a compare link and a
release date:

```md
## [X.Y.Z](https://github.com/event4u-app/agent-config/compare/PREV...X.Y.Z) (YYYY-MM-DD)
```

Inside the version block, the **curated head comes first** — before any
generated section:

```md
### Release highlights

- **Behaviour changes:** …
- **Default changes + migration:** …
- **Security and correctness:** …
- **Honest nulls:** …
- **Known limitations:** …
```

Five lines, that order, capped at roughly ten operator-relevant lines
(`RELEASE_HEAD_CAP_LINES` in `src/scripts/release.ts`). `release.ts` emits the
skeleton on every release so it cannot be forgotten; the maintainer fills it
before merge. `_none_` is a legitimate value and often the true one — a
release that changed no defaults should say so rather than carry an unfilled
marker.

### Curated-head cadence — REVERSED 2026-09-01: a surviving marker now BLOCKS

> **Read this before the history below.** Everything from *"The cadence is
> retro-curation"* down to the measured-rate table is the record of the
> 2026-08-11 decision and its two re-confirmations. That decision has now been
> **reversed on maintainer instruction**, and the paragraphs are kept rather
> than rewritten because the reversal is only legible against them.
>
> **What is true as of 2026-09-01.** `src/scripts/check_release_highlights.ts`
> **exits 1** when the section under release carries `DERIVED_MARKER`, naming
> the section and the offending labels. `src/scripts/release.ts` additionally
> refuses at the three publication call sites — annotated-tag creation, the
> resumed push of a tag created but never pushed, and the GitHub Release body —
> via `publication_blockers` in `src/scripts/_lib/release_highlights.ts`.
>
> **Why now, rather than at either earlier re-confirmation.** The falsifier this
> section pre-registered — *"a shipped marked line survives its next release
> cycle uncurated"* — had already fired twice and was recorded as fired, with
> reopening left to the maintainer. The maintainer then instructed the fix, in
> the closing message of the 2026-09-a inbox round. Re-derived at `b50b27281`,
> the rate at the time of reversal was **eighteen marked lines across five
> consecutive released sections** — 14.9.0 (4), 14.10.0 (2), 14.11.0 (4),
> 14.12.0 (4), 14.13.0 (4).
>
> **The guaranteed-first-run red the rejected branch feared does not follow,
> and the reason is structural rather than optimistic.** Every read is scoped to
> the ONE section cut for `--version`, so the eighteen already-published lines
> are invisible to every future release. What a releaser must now do is rewrite
> the marked lines in the section they are already authoring — which is what
> the marker asked for and what did not happen eighteen times.
>
> **FALSIFIED ON THE NEXT RELEASE — 2026-09-02, and the paragraph above is kept
> so the correction is legible.** The scoping half is true and did its job; the
> conclusion drawn from it was not. `release.ts` writes the draft head in step 2
> and pushes in step 4, and nothing between them asked for the rewrite — so
> 14.14.0 pushed a branch, opened PR #1812, waited on `Curated highlights
> plausible against the span`, and died on a check that could not pass. This is
> Risk 1 of the reversing plan's own register, materialised on the first
> release after the flip, with its stated mitigation ("the releaser edits prose
> before merge") never invoked by anything.
>
> **The repair is a FOURTH guard site, and its placement is the whole point.**
> `guard_release_branch_push` in `src/scripts/release_publication.ts` reads the
> same `publication_blockers` at the branch push — the first thing in the
> pipeline that leaves the machine. A run whose head is still the generator's
> draft now stops with no remote state at all: no branch on the remote, no pull
> request, no CI minutes, no half-open release. The refusal names the version,
> the file, the heading to edit, and `task release -- --resume`; and
> `check_release_highlights` now prints the SUBJECT behind each cited SHA
> alongside its verdict, so writing the real claim does not start with eleven
> `git show` lookups. Nothing about the blocking condition changed — only the
> moment it is enforced, and how much a releaser has to reconstruct to satisfy
> it. Pinned by the drill scenario `marker-refuses-before-commit` (which
> asserts no commit, no push, no PR, no check-watch after the refusal) and by
> the section-scope near-misses in
> `tests/scripts/release_push_failure_masking.test.ts`.
>
> **Moved one step earlier, 2026-09-03 — the branch push was still too late.**
> The paragraph above is accurate about remote state and was wrong about local
> state, which it did not mention. Refusing at the push means steps 2 and 3
> have already run: six files bumped, the derived trees regenerated, and all of
> it committed as `release: X.Y.Z`. Measured on 14.14.1, which died at step
> 4/10 having produced `136cea960 release: 14.14.1`, so the releaser curated
> prose on top of a commit that already claimed to be the release.
> `guard_release_curation` is the fifth guard site and it fires between the
> changelog write and the commit, on the non-merged path only — the merged path
> runs neither step and firing there preempts the step-8 and step-9 guards,
> which was measured as three red drill scenarios before the condition was
> added. It names the marked LINES, not just the marker, because the next
> action is an edit. The four later guards are unchanged and stay as
> defence-in-depth for a section that changes after the commit.
>
> **The halt is GONE since 2026-09-03, and the open question above is what
> closed it.** The paragraph that stood here described the halt as the cadence
> the flip chose, said it was "a different cost, not zero cost", and ended by
> naming its own successor: *whether the generator should emit a publishable
> derived claim instead of a rewrite-me draft is an open maintainer question.*
> The maintainer answered it — *"fix the bug so this stops happening"* — and
> that instruction is the authority for this change.
>
> The arithmetic behind why it had to go: every release of this package touches
> `src/rules/` or `src/scripts/schemas/`, so `Behaviour changes` is always
> substantiated, so the generator always wrote a line the gate always refused.
> A release halting *by construction* is not a cadence, it is a failure with a
> schedule. Two intermediate positions were tried and neither removed it — the
> 2026-09-01 flip made the marker a hard refusal at the PR, and 2026-09-03's
> first attempt (`guard_release_curation`) moved that refusal before the
> commit. Both made the halt cheaper. Only the writer change removes it.
>
> `render_derived_head_values` now emits the COMMIT SUBJECTS behind each
> category with their SHAs, and no marker: "stage-2 impact scan, so a refused
> merge can be answered in four words (5a3b7c5)" rather than "rule/schema diffs
> in 5a3b7c5". Measured against the real 14.15.0 span, seven commits, the
> rendered head returns zero publication blockers.
>
> What is deliberately NOT relaxed: `highlight_contradictions` still refuses a
> human editing a substantiated line down to `_none_`, which is what the false
> 9.13.0 and 9.14.0 heads actually were; and the marker constant with its four
> guard sites stays, now covering only a marker written BY HAND. The unattended
> path (`.github/workflows/release.yml`, `--ci --yes`, ADR-113) can therefore
> complete a release, which it could not before.
>
> **The honest cost, stated rather than left to be discovered.** The head is
> now a categorised view of the span rather than curated prose, and it ships
> without a human having read it. That is a real reduction in editorial
> quality, accepted deliberately: an operator who wants better prose still
> edits the section, and is no longer STOPPED until they do.
>
> **No escape hatch exists, deliberately.** See § No escape hatch below.
>
> **The durable conclusion, inlined rather than cited.** `no-roadmap-references`
> forbids a stable artifact from pointing at a roadmap file, and a roadmap is
> archived or deleted as its work completes — so the reversal has to stand on
> its own here. It does: the reversing authority is the maintainer's
> instruction, the measured basis is the eighteen lines across five sections
> above, and the mechanism is the two code sites named above. Nothing a reader
> needs is behind a path that will rot.

### The superseded cadence, kept as the record

The generator pre-fills each *substantiated* label with a marked line
(`DERIVED_MARKER` in `src/scripts/_lib/release_highlights.ts`) carrying the real
reason plus the citing SHAs; the maintainer rewrites it into prose. When a marked
line survives to merge, `src/scripts/check_release_highlights.ts` **used to warn
and still exit 0** — reversed 2026-09-01, see the block above; it now exits 1.
Whether that is a defect or the intended cadence was open until
2026-08-11, and one marked line reached npm and GitHub Releases in the v9.32.0
head before it was settled. Both branches are recorded here so the decision is
legible later (AI-council convergence 2/2, 2026-08-11, anthropic + openai).

**The cadence is retro-curation.** A marked line is a legitimate interim state:
unpolished, never false — its reason is derived and its SHAs are real. Curation
is expected before merge and permitted after; a shipped head may be rewritten in
place by a later change, which is how the v9.32.0 head was repaired.

**The rejected branch.** Hard-blocking a surviving marker in the final release
head was rejected. The marker is present *by construction* on every release that
carries any substantiated category, so blocking it re-introduces the
guaranteed-first-run red that pre-filling was introduced to remove — the failure
mode `check_release_highlights.ts` names in its own source. A marked line is a
prose gap, not a contradiction, and contradictions (`_none_` against derived
evidence) remain the sole blocking condition.

**The derivation is the load-bearing half of that sentence — 2026-08-15.** "A
contradiction remains the sole blocking condition" only carries the rejected
branch while a contradiction is *detectable*. It was not, on two of the five
labels. Measured over the six most recent released spans (341 commits) in
[`release-head-derivation-recall.md`](../../agents/evidence/analysis/release-head-derivation-recall.md):
`Security and correctness` derived **1 of 45** in-category commits — the rule
looked only for `security` while the label also names *correctness*, and
nothing derived the correctness half — and `Honest nulls` **3 of 9**, matching a
literal marker string only. `Security and correctness` could not be
contradicted at all and shipped `_none_` on **five of six** curated heads;
`Honest nulls` fired on three of the six and shipped a derived line on those,
so the five-of-six rate belongs to the first label only.

**Widening a derivation is therefore not a reversal of the decision above; it
is a repair of the check the decision depends on.** The two are independent
axes and the next reader should not re-derive that: making a contradiction
*detectable* changes what the sole blocking condition can see, while making an
unrewritten *marker* block is the branch that stays rejected. The widening also
does not reintroduce the guaranteed-first-run red, and for the same structural
reason the rejection rests on — the generator pre-fills every substantiated
label, so a wider derivation produces a marked line rather than a `_none_` to
contradict. That is pinned in
`tests/scripts/check_release_highlights.test.ts`, not assumed.

**But that pre-fill is also what fires falsifier (2), and this section must say
so rather than re-affirm the lock over it.** The falsifier below reads: *"a
shipped marked line survives its next release cycle uncurated"*. Measured
2026-08-15 across the era archives and the live head: **11 marked lines across
6 of 6 releases, none curated in place since** — 10.1.0's are still verbatim
five releases later. The condition the 2026-08-11 decision pre-registered for
reopening the (a)/(b) choice is **met**, and it was met before this branch
touched anything.

The widening moves the same dial further, by construction and not by accident:
`Security and correctness` now derives on **6 of 6** spans against **1 of 6**
before, so it adds a marked line to nearly every future release on a label that
used to ship `_none_`. The counterweight this plan offers — a publish-side
unresolved-marker invariant — is deferred behind an open maintainer blocker, so
merging this on its own increases the marked-line rate without adding anything
that curates them.

**This is surfaced, not decided.** Nothing here reverses the lock: reopening the
(a)/(b) choice is the maintainer's call under the contract's own terms, and the
honest state is that the falsifier has fired and the rate is rising. Whoever
revisits it inherits a fired trigger and a measured rate rather than the
cautious forecast the paragraph below was written as.

**What that concedes.** The advisory already failed once, and no non-gate
mechanism is added here to make the next survivor less likely; this branch
accepts recurrence rather than claiming a process reminder prevents it. The
behaviour is pinned in `tests/scripts/check_release_highlights.test.ts` — a
surviving marker warned and exited 0, verified to go red when that branch was
flipped — so reversing the decision stays a one-line diff a test notices.
**That prediction held: the reversal of 2026-09-01 was one branch and the same
fixtures, updated in place rather than deleted so the change of contract is
visible in the diff.**

**The conceded recurrence is now a measured rate, not a risk — 2026-08-13.**
Re-confirming the decision without publishing this number would leave the
paragraph above reading as a cautious forecast when it has become a
description. Every release tagged after the 2026-08-11 decision shipped marked
lines:

| Release | Marked lines in the shipped head | Fields |
|---|--:|---|
| 10.0.0 | 0 | curated before merge |
| 10.1.0 | 2 | Behaviour changes · Honest nulls |
| 10.2.0 | 3 | Behaviour changes · Security and correctness · Honest nulls |
| 10.3.0 | 2 | Behaviour changes · Default changes + migration |
| 10.4.0 | 1 | Honest nulls |
| 11.0.0 | 1 | Behaviour changes |
| 12.0.0 | 2 | Behaviour changes · Default changes + migration |

**Refreshed 2026-08-15: 6 of the 6 releases since, 11 marked lines** — the
figure below the table read "3 of the 3 releases since, 7 marked lines" and was
three releases stale. All six tags are published; 10.1.0 and 10.2.0 sit in
[`docs/archive/CHANGELOG-pre-10.3.0.md`](../archive/CHANGELOG-pre-10.3.0.md),
10.3.0 through 11.0.0 in
[`docs/archive/CHANGELOG-pre-12.0.0.md`](../archive/CHANGELOG-pre-12.0.0.md),
and 12.0.0 is live in [`CHANGELOG.md`](../../CHANGELOG.md).

**Not one of the eleven has been curated in place.** The rate is not merely
holding, it is the full population — which is what makes falsifier (2) a fired
trigger rather than a forecast.

**The decision stands, and the number does not by itself reverse it.** The
rejected branch was rejected on a structural argument the rate does not touch:
the marker is present *by construction* on every release carrying a
substantiated category, so a hard block is red on the first run of every such
release regardless of how diligent curation is. A 3-of-3 rate is evidence that
curation is not happening, not evidence that blocking would be cheap.

What the rate *does* change is what a future revisit is allowed to assume. Two
falsifiers are pre-registered here so the next reader inherits a test rather
than a habit: **(1)** a marked line reaches a consumer-visible surface that is
*not* rewritable in place — an npm description, a GitHub Release body that
nobody edits after the fact — at which point "unpolished, never false" stops
being the whole story; or **(2)** retro-curation stops happening at all, i.e. a
shipped marked line survives its next release cycle uncurated, which would mean
the cadence named here is not the cadence being practised. Either one reopens
the (a)/(b) choice with a stronger premise than 2026-08-11 had.

Why it is a *head* and not a trailer: reviewers of 9.9.0 and 9.10.0 repeatedly
could not tell, from a generated commit log, which entries change consumer
behaviour, which need migration, which are internal gate repairs, and which
ended as nulls. The log is a faithful record of what was committed; it is not
a statement of what changed for the reader. That statement has to be the first
thing in the entry.

Below the head, group changes under level-3 headings using
the Conventional Commits family the entry came from:

- `### Features` — `feat:` commits.
- `### Bug Fixes` — `fix:` commits.
- `### Chores` — `chore:`, `build:`, `ci:` commits a user might want
  to see (silent infra-only chores stay out).
- `### Docs` — `docs:` commits that change user-facing behaviour or
  surface (otherwise drop them).
- `### BREAKING CHANGES` — see [What counts as breaking](#what-counts-as-breaking).
- `### Reverts` — `revert:` commits, with the SHA of the original commit.

Each bullet is one line, scope-prefixed, with the short SHA linked:

```md
* **scope:** imperative-mood summary ([abc1234](https://github.com/event4u-app/agent-config/commit/abc1234...))
```

No line appears twice. A cherry-pick, a re-land, or one change split across
branches produces the same `scope: subject` under two SHAs; the generator folds
those to the first occurrence (`dedupe_commit_lines`). A breaking commit is
never folded into a non-breaking twin — `!` changes what the line means.

Optional trailers — a free-form paragraph for the release narrative
(only for non-trivial releases), followed by a single-line test count
delta:

```md
Tests: NNNN (+M since X.Y.(Z-1))
```

The test-count line is enforced for any release that ships changes to
`scripts/`, `internal/workers/`, or `dist/agent-src/` content; it can be omitted for
pure-docs releases.

Minor / major sections (`## [X.Y.0]`) additionally carry a `Rollback:` line for
every introduced or substantially reworked subsystem — required by
[`release-sizing.md`](release-sizing.md) and enforced by
`src/scripts/lint_changelog_rollback.ts` for versions above the current
`package.json` version (historical sections never retro-fail).

## Governance-versus-product response

> **In force from the first reading — not from a threshold.** Added 2026-09-04
> by [`ADR-253`](../decisions/ADR-253-per-pr-user-artefact-gate-declined.md),
> which declines the per-PR user-artefact gate an external reviewer asked for
> twice and replaces it with a release-level measurement. Read that record
> before proposing the per-PR shape again; it is declined on mechanism, so a
> worse ratio does not revive it.

`src/scripts/measure_release_mix.ts` classifies a release span from the files
its commits touch — never from commit subjects — into `consumer`,
`governance`, `maintenance`, `mixed` and `unclassified`, using the versioned
mapping in `src/scripts/release_mix_taxonomy.json`. Generated projections and
lockfiles are excluded from both views by name.

**The obligation.** When governance-only commits **strictly outnumber**
consumer-only commits over the release span, the section under release carries
a written response naming either the next cycle's consumer work or a maintainer
justification. One line, immediately under the curated head, outside it:

```md
> **Governance mix:** governance-only 16 vs consumer-only 6 (taxonomy 1.0.0).
> Next cycle ships <the consumer work>, tracked in <roadmap or issue>.
```

It sits outside the `### Release highlights` head on purpose: the head's
ten-line cap (`RELEASE_HEAD_CAP_LINES`) is for operator-relevant product
lines, and a sixth label would make every historical section retroactively
incomplete.

**What is enforced, and what is not.** `check_release_highlights` refuses a
release whose section owes a response and does not carry one — a **missing
answer**, never a particular number. No threshold is committed to this
repository, and none may be until at least two readings exist; both council
seats refused to pick one on a single cycle and the reviewer's "more than half
the cycle" carries no denominator. Read the measurement command yourself with:

```bash
./scripts-run src/scripts/measure_release_mix --from <prev-tag> --to <tag> --label <tag>
```

**Coverage, stated honestly.** The refusal fires at the release **pull
request** (`.github/workflows/release-validation.yml`, the
`check_release_highlights` step). The local push guard
(`guard_release_branch_push`) reads `publication_blockers`, a different
function, and does **not** check the mix response — so the earliest refusal for
this one obligation is the PR, not the push. A measurement that cannot run
(shallow clone, missing tag) degrades to a printed warning rather than to a
refusal: this is a governance signal, not a correctness control, and turning an
environment fact into a blocked release would be the wrong trade.

**Published readings** live in `agents/evidence/reports/release-mix-*.json`
with a human summary in `agents/evidence/reports/release-mix-baseline.md`. They
are levels, not verdicts.

## What counts as breaking

A change is **breaking** (and MUST appear under `### BREAKING CHANGES`
**and** bump the major version) when it changes:

1. **Public CLI surface** — `agent-config <cmd>` flags / subcommands at
   Tier-0 or Tier-1 (Tier-2 is internal per
   [`command-surface-tiers.md`](command-surface-tiers.md) and may shift
   without a major bump).
2. **Install scopes** — adding / removing a scope (`global`, `project`,
   `mcp_scope: lite|full`) or changing its default discovery path per
   [`ADR-007`](../decisions/ADR-007-agent-discovery-scopes.md).
3. **MCP Worker contracts** — anything that breaks
   [`mcp-cloud-scope.md`](mcp-cloud-scope.md) or
   [`mcp-phase-1-scope.md`](mcp-phase-1-scope.md) (tool shape, prompt
   ids, resource URIs).
4. **Generated tree shape** — removing or renaming top-level
   directories under `dist/agent-src/`, `.augment/`, `.claude/`,
   `.cursor/`, `.clinerules/`, or `.windsurfrules`.
5. **Settings keys** — removing / renaming a key in
   `.agent-settings.yml` that consumer projects may rely on. Adding a
   new key with a default is **not** breaking.
6. **AGENTS.md / kernel rules** — removing or renaming an Iron-Law
   rule, or changing the kernel-membership contract per
   [`kernel-membership.md`](kernel-membership.md).

Internal refactors, doc rewrites, test changes, and any change to
files under `.agent-src.uncondensed/` that round-trip through
`task sync` unchanged are **not** breaking.

## Era splits

`CHANGELOG.md` keeps only the **current era** inline; prior eras live
under [`docs/archive/`](../archive/) and are read-only.

Drift gate — `tests/lib/changelog_eras.test.ts` fails when the current
era's body (lines between `# Era: X.Y.x — current` and the next era
header) exceeds **250 lines**. When that happens:

1. Pick the next major or significant minor boundary at the bottom of
   the current era (typically the last `X.Y.0` release).
2. Move every entry at or below that boundary into
   `docs/archive/CHANGELOG-pre-<boundary>.md`, prepending the standard
   archive header.
3. Replace the moved entries in `CHANGELOG.md` with a single collapsed
   `# Era: pre-<boundary> — archived` section that links to the
   archive file.
4. Rename the active era header to `# Era: <new-current>.x — current`.
5. Update the `## [Unreleased]` placeholder unchanged.

Each era split lands as its own `chore(changelog): split era X.Y.x →
pre-X.Y.x` commit — never bundled with a feature release.

### Gate-vs-script contract

- **Canonical splitter** — `src/scripts/release.ts`, run via `task release`
  or the `release`-labeled-PR CI path
  (`.github/workflows/release.yml`, see
  [`ADR-113`](../decisions/ADR-113-ci-native-release-label-trigger.md)).
  When a release crosses a minor/major boundary and the current era body
  is at or over the 250-line cap, the release pipeline writes the
  `chore(changelog): split era …` commit **first**, then the
  `release: X.Y.Z` commit. The maintainer does not run the split by
  hand for the release path.
- **Backstop** — `tests/lib/changelog_eras.test.ts` (`test_current_era_body_under_cap`)
  catches entries written **outside** the release script (hand-edited
  Unreleased section, agent-authored hotfix entries, doc patches). The
  failure message names `task release` as the auto-split path.
- **Shared cap constant** — `src/scripts/_lib/changelog_eras.ts` owns
  `CURRENT_ERA_BODY_CAP` and the era-header regex. Both the test and
  the release script import from there; no parallel copies.
- **Patch-release overflow** — a `patch` bump cannot cross an era
  boundary by definition, so the release script refuses to auto-split
  on a patch and surfaces the manual-intervention message instead.

## Cross-references

- [`../../CHANGELOG.md`](../../CHANGELOG.md) — active era + Unreleased.
- [`../archive/CHANGELOG-pre-2.2.0.md`](../archive/CHANGELOG-pre-2.2.0.md) —
  frozen pre-2.2.0 entries.
- [`command-surface-tiers.md`](command-surface-tiers.md) — Tier-0/1/2
  split that governs CLI-surface breaking-change classification.
- [`mcp-cloud-scope.md`](mcp-cloud-scope.md) ·
  [`mcp-phase-1-scope.md`](mcp-phase-1-scope.md) — MCP contract bounds.
- [`../decisions/ADR-007-agent-discovery-scopes.md`](../decisions/ADR-007-agent-discovery-scopes.md) —
  install scope discovery.

## No escape hatch — decided 2026-09-01, with its reason

The publication guards above have **no bypass flag and no environment
variable**, and the absence is a decision rather than an omission. The planning round that produced this change required one of two things: a
documented escape whose use is printed, or the absence stated with its
reason. This is the reason, kept here rather than behind a pointer because
the plan is a transient artifact and this contract is not.

**A bypass would have no legitimate use, because the remedy is always cheaper
than the bypass.** The CI gate runs in one place —
`.github/workflows/release-validation.yml:266`, on a job gated to
`startsWith(github.head_ref, 'release/')` — so it fires on the release **pull
request**, before the merge, before the tag, and before publication. Since
2026-09-02 the same condition is also read locally at the branch push
(`guard_release_branch_push`), which is earlier still: the refusal arrives
before any remote state exists. Either way the action that clears it is
rewriting a head line in `CHANGELOG.md` on the branch the releaser is already
authoring. There is no state in which reaching for a flag is easier than
editing the line the flag would let you ship.

**"Emergency release" is the case a bypass is usually argued for, and it does
not survive contact with this one.** An emergency release still cuts a section,
still opens a release PR, and still edits `CHANGELOG.md` in that PR. The guard
adds one line of editing to a path that is already editing that file. It does
not add a review, a wait, an approval, or a second human.

**The publish-side guards in `release.ts` refuse on a narrower condition still.**
They read the MERGED section, which the PR gate has already passed. A refusal
there means the merged content differs from what was validated — a desync,
which is precisely when a release should stop rather than be waved through.

**What a bypass would actually be.** A supported way to publish the defect on
purpose. The defect shipped eighteen times without one; adding a flag would give
the next eighteen a documented justification.

**Reversible, and here is the trigger.** If a real release is ever blocked by
these guards in a state where rewriting the section is genuinely impossible,
that state is the evidence this decision lacks, and it reopens the question.
Record it against this section.
