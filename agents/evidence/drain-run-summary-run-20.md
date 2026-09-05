<!-- evidence-type: analysis -->

# Autonomous roadmap drain — run 20, 2026-09-04

Autonomous drain under a written owner instruction: drive every active roadmap
to completion, route every open decision to the AI council rather than to the
owner, close gates only legitimately, one pull request per roadmap, no user
round-trips. Two worktrees, two subagent lanes, base `bd7dc08d8`.

**Filename.** The instruction named `agents/evidence/drain-run-summary.md`. That
path holds run 18's record and run 19 already took its own suffixed file, so
this run follows the established convention rather than overwriting a prior
evidence artefact. The deviation is stated rather than made silently.

## The queue, recomputed

The instruction carried a seed table of 36 roadmaps. **It was stale in full** —
not one of its 36 names exists under `agents/roadmaps/` today. Its own step 1.2
says to recompute rather than trust the seed, which is what happened; it is
recorded here because a reader comparing the two would otherwise assume 25
roadmaps were dropped.

The live set was ten files, every one at 0/N, so the ordering rule was ascending
complexity then ascending step count. **Two more landed mid-run** from a parallel
analysis round (`road-to-the-check-that-cannot-see`,
`road-to-the-graph-that-lies-confidently`) and were appended to the queue rather
than deferred to a later run.

## Terminal state — stated as the council required

Eleven drain-eligible roadmaps, eleven pull requests, **nine archived**. The run
does **not** claim the roadmap directory is empty; both council seats required
that wording be refused (below). The honest terminal claim is: every
drain-eligible roadmap carries a PR; two remain active because closing them
would have required manufacturing a result; one carrier was never in scope.

## Pull requests

| PR | Roadmap | Outcome |
|---|---|---|
| #1841 | checklist-rows | 7 steps + 4 ACs, archived |
| #1842 | infra-threat-floor | 11 steps, archived (merged) |
| #1844 | one-negation-vocabulary | 11 steps + 5 ACs, archived |
| #1845 | decided-but-not-done | 12 steps + 5 ACs, archived (merged) |
| #1846 | defect-population-sweeps | 8 steps + 5 ACs, archived, stacked on #1844 |
| #1847 | meta-ratio-measured | 13 steps + 5 ACs, archived (merged) |
| #1848 | deterministic-defect-detectors | 15 steps + 5 ACs, archived |
| #1849 | the-unwritten-ledger | 10 steps + 5 ACs, archived |
| #1850 | the-check-that-cannot-see | 14/15, **not archived** (merged) |
| #1851 | the-graph-that-lies-confidently | 17 steps + 6 ACs, archived |
| #1853 | the-tenth-arrival | **not archived** |

`road-to-defect-population-sweeps` and `road-to-one-negation-vocabulary` both
edit `src/scripts/git_authorization_hook.ts`, so they were run sequentially and
#1846 is stacked on #1844 rather than racing it.

## Council decisions

Every decision below was taken by the AI council, never referred to the owner.
Convergence summaries are inlined; the response tree is gitignored and
auto-pruned, so citing a path there would fail `check_council_references`.

1. **Carrier disposition** — 2026-09-04, anthropic/claude-sonnet-4-5 +
   openai/codex-default, 2 rounds, quorum 2/2, subscription transport, $0.0000.
   Verdict **(a)**: leave `road-to-council-topology-evidence-followups.md`
   byte-for-byte unchanged. It is `status: carrier`, human-gated to `ready`, and
   its own header says nothing in it is scheduled work; removing it produces 38
   broken deferral carries and exit 1. Group A's resume condition requires five
   independent eligible seats and a verified 20-consecutive-day capacity
   reservation — two seats exist and no reservation mechanism does, so no
   execution and no council decision can satisfy it. Rejected: (b) flipping the
   status bypasses an explicit human gate; (c) rewrites resume conditions purely
   to make them pass; (d) is churn against a gate that reds on removal.
   **Both seats attached the same correction**, which this document obeys: the
   run must not report "roadmap directory empty", because `countActiveCarriers`
   still returns 1 and a measured counter contradicting a completion claim is a
   reporting defect.
2. **Per-PR meta-ratio rule — declined** (#1847, ADR-253). The reviewer's
   proposal was rejected on mechanism, not threshold: it measures packaging
   rather than progress, and rejects CI fixes, dependency bumps and analysis
   rounds by construction. Recorded as a decline, "not deferred, not scheduled,
   and not softened into a maybe". Its replacement measurement then substantiated
   the reviewer's underlying concern anyway: 14.16.0 ran 16 governance changes to
   6 consumer ones, 2706 governance lines to 450.
3. **Corpus wave rolled back** (#1853). A 14-file trigger corpus was written to a
   declared rule and every corpus-local gate was green — then three published
   reproduce-from-tree pins fell. Council 2/2: revert. The wave is preserved
   whole as Phase-5 input rather than kept for the coverage number.
4. Sixteen further design forks were settled per-lane and are inlined in their
   own pull requests, including two rounds that **changed a design** rather than
   ratifying one: dropping `CHANGELOG.md` as a release source, and correcting a
   tag-only predicate that would have been inert in CI because `actions/checkout`
   leaves `git tag -l` empty.

## Blockers

`agent-config gates --all --json` at base and at close: `needsYou: 0`,
`blockers: []`. The unblocking sweep the instruction mandates was a no-op because
there was nothing to unblock. One `resumeFired` entry exists for
`later/road-to-elicitation-front-door.md`, which sits outside the active glob and
was not pulled into scope.

## What was not closed, and why

- **`road-to-the-check-that-cannot-see` — 14/15.** Both council seats held that
  the only correct marker for the remaining step is `[-]`, and `[-]` is
  owner-reserved. The line stays `[ ]`, AC-6 is reported failed rather than
  claimed, and the roadmap stays active awaiting owner disposition.
- **`road-to-the-tenth-arrival` — AC-3 unmet.** The "expanded" conjunct fails
  because the corpus wave was rolled back by council decision. Closing it means
  deciding a versioned second corpus generation, which is Phase-5 and owner work.
- **`road-to-council-topology-evidence-followups`** — never in scope, per the
  carrier verdict above.

Nothing else was descoped. No gate was disabled, no baseline raised, and no
roadmap was archived to make a count look better.

## Inherited reds, reproduced rather than asserted

Four failures pre-date this run and were each reproduced on a clean detached
`origin/main` checkout by more than one lane, with each lane measuring its own
delta at zero: `lint-eval-freshness` (the `threat-modeling` manifest carries no
`upstream.last_eval`; the count is 0 on main), `check-gate-completeness`
(226 un-adopted gates against a 214 baseline dated 2026-08-30, with 91 new
scripts landed on main since), `check_rule_projection_integrity.test.ts:198`,
and `check-public-links` (8 errors in files no drain branch touches). None was
fixed; none is in a `.github/workflows/` file, so none gates a PR.

## Findings the roadmaps did not predict

- **A live authorization leak** (#1844). The negation vocabulary was ASCII-only
  while macOS, iOS and Slack substitute U+2019 by default, so `don't merge PR
  #12` was denied while `don’t merge PR #12` returned `["pr-merge"]`. One smart
  quote turned a prohibition into a grant.
- **A recorded decision contradicted by the next commit** (#1845). A council
  resolution stating "Steps 6 and 7 land nothing" was added to a file in the same
  372-line insertion that marked both steps `[x] DONE`, with the script it
  rejected landing 14 minutes earlier.
- **A detector that reproduced the defect it measures** (#1848). The first
  silent-catch implementation was defeated by `pass  # intentional` — its own
  roadmap's Risk 3. Its own test caught it.
- **A check passing on nothing** (#1850). Seven checks reported `PASSED` and
  exit 0 on a build with no title, lang, charset, viewport or canonical — five of
  them having iterated zero files.
- **Skill activation measured at exactly zero** (#1853), not near zero: 0
  invocations across 30 sessions and 11,049 turns, before and after a coverage
  wave.
- **Two machine-readable finding blocks 3.5 minutes apart with zero id overlap**
  (#1849), falsifying the schema's own stability claim.
- **Twenty-plus false roadmap premises** across the eleven files, each recorded
  inline with evidence rather than worked around.

## Process notes

- Council quorum fails in a fresh worktree: the availability record lives at
  `agents/runtime/state/council-probes.json`, which is gitignored and therefore
  never copied by `git worktree add`, so every seat cli-skips and the run returns
  `0/2 INCONCLUSIVE` **while still spending quota**. One lane lost two runs before
  the file was seeded into both worktrees.
- `archive_completed_roadmaps` exists at `src/agent-src/scripts/`, not
  `src/scripts/`. The wrong path returns "no script found", which makes a stale
  belief that it does not exist self-confirming.
- Three lanes were killed mid-run by host events — two sleeps and one 600-second
  stream stall — and each resumed by re-reading tree state rather than trusting
  what it remembered.
- A scratch probe worktree at `/tmp/wlr-mainprobe` is still registered. It holds
  no work; `worktree remove` is Hard-Floor gated and was not authorised.
