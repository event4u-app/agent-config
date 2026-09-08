<!-- evidence-type: analysis -->

# Autonomous roadmap drain — run 22, 2026-09-08

Owner-delegated drain under a written instruction: drive every active roadmap to
completion, route **every** open decision to the AI council rather than back to the
maintainer, zero user round-trips. Token spend, paid council calls, commits, pushes and
PR creation pre-authorised. One orchestrator lane plus two subagent lanes, each in its
own git worktree.

**Read this before any verdict below.** Several decisions came from a `⚠️ DEGRADED`
**single-seat** council, and one came from a council that reached quorum 2/2 and **split**.
Each is labelled at the point of use — in the ADR or blocker entry that rests on it — not
only here. A single-seat verdict is a considered opinion, never agreement between
independent seats.

## Machine-readable record

```json
{
  "run": "roadmap-drain-run-22-2026-09-08",
  "base_at_start": "8a3160242197c39b070e58d288a504a8d1c371fc",
  "base_at_end": "21c2ee68a",
  "lanes": 3,
  "prs": [
    {"pr": 1932, "roadmap": "road-to-the-skill-surface-framing-choice",    "lane": "orchestrator", "progress_before": "3/3",   "progress_after": "3/3",   "delta": 0,  "blockers_before": 1, "blockers_after": 0, "ci": "settled-green", "checks": 12, "archived": true,  "merged": true},
    {"pr": 1934, "roadmap": "road-to-first-reference-analysis-observation","lane": "subagent-a",   "progress_before": "1/9",   "progress_after": "1/9",   "delta": 0,  "blockers_before": 2, "blockers_after": 2, "ci": "settled-green", "checks": 6,  "archived": false, "merged": true, "note": "parked to later/"},
    {"pr": 1935, "roadmap": "road-to-continuity-retirement-sequencing",    "lane": "subagent-b",   "progress_before": "0/9",   "progress_after": "9/9",   "delta": 9,  "blockers_before": 0, "blockers_after": 5, "ci": "settled-green", "checks": 43, "archived": true,  "merged": true, "note": "4 items carried to a new receiver"},
    {"pr": 1936, "roadmap": "road-to-candidate-moves-floor",               "lane": "orchestrator", "progress_before": "16/20", "progress_after": "20/20", "delta": 4,  "blockers_before": 2, "blockers_after": 0, "ci": "settled-green", "checks": 38, "archived": true,  "merged": true},
    {"pr": 1937, "roadmap": "road-to-delivery-on-hook-hosts",              "lane": "orchestrator", "progress_before": "9/16",  "progress_after": "9/16",  "delta": 0,  "blockers_before": 2, "blockers_after": 2, "ci": "settled-green", "checks": 6,  "archived": false, "merged": true, "note": "disposition only — K6 honoured"},
    {"pr": 1938, "roadmap": "road-to-skill-menu-economy",                  "lane": "orchestrator", "progress_before": "4/12",  "progress_after": "4/12",  "delta": 0,  "blockers_before": 1, "blockers_after": 1, "ci": "settled-green", "checks": 10, "archived": false, "merged": true, "note": "1 of 5 blocker conditions satisfied"},
    {"pr": 1939, "roadmap": "road-to-council-topology-evidence-followups", "lane": "subagent-a",   "progress_before": "0/41",  "progress_after": "3/41",  "delta": 3,  "blockers_before": 3, "blockers_after": 3, "ci": "settled-green", "checks": 34, "archived": false, "merged": false, "note": "C1 built; A/B/C2/C3 parked to later/"},
    {"pr": 1940, "roadmap": "road-to-a-standing-budget-with-headroom",     "lane": "orchestrator", "progress_before": "0/3",   "progress_after": "1/3",   "delta": 1,  "blockers_before": 0, "blockers_after": 1, "ci": "settled-green", "checks": 36, "archived": false, "merged": true, "note": "1.1 closed, 1.2 cancelled, 1.3 blockered; ADR-264"}
  ],
  "adrs": [
    {"adr": 263, "pr": 1932, "decision": "skills-are-explicitly-invoked-reference-material", "council_quorum": "1/2", "degraded": true},
    {"adr": 264, "pr": 1940, "decision": "grace-ceiling-may-not-rise-iron-law-reserve-designed-not-shipped", "council_quorum": "2/2", "split": true}
  ],
  "council": {"seats": 2, "members": ["anthropic", "openai"], "questions": 4, "cost_usd": 0.0, "transport": "subscription", "degraded_runs": 2, "splits": 1},
  "foreign_branches_touched": [
    {"pr": 1921, "action": "merge-conflict-resolved-and-pushed", "files": 1, "history_rewritten": false},
    {"pr": 1923, "action": "resolution-confirmed-locally-then-aborted", "pushed": false}
  ],
  "descopes": [],
  "roadmaps_active_at_start": 10,
  "roadmaps_active_at_end": 8,
  "roadmaps_archived_this_run": 3,
  "roadmaps_parked_this_run": 2
}
```

## Council decisions

### 1 — The skill surface → ADR-263 · `1/2 seats, ⚠️ DEGRADED`

openai returned `os_error: ENOBUFS`. Options were **A** build a host-side activation path
for the 12 trigger-declaring skills · **B** declare the remainder reference material and
correct the consumer-facing surfaces · **D** close the menu.

**Verdict: B, held conditional** on one precondition — *"document which hosts were
census-tested and whether they claim frontmatter routing; if unknown, Option D becomes the
honest choice."* Discharged before the ADR was written, so D's trigger never fired.

Two wording points the seat insisted on, both carried into the ADR: **"by observation",
never "by design"** — design intent is an ownership claim this repository cannot make
about hosts it does not own — and **187, not 189**, because 12 + 100 with 2 in both leaves
187 in neither set and the earlier framing double-counted the overlap.

### 2 and 3 — `candidate-moves-floor` · `2/2 seats, convergent`

The seats reached both verdicts independently, and their drafts of the replacement AC-4
matched limb for limb.

**D1-a — abandon the sixth mandated line.** Four reasons: step 2.0 measured **zero**
well-formed emissions of all five *existing* mandated lines; 6 of the 9 rubric points came
from transcripts carrying no line at all; the arms are 78 days apart with a single rater;
and the 2026-09-07 split council's authorising branch never fired. Both seats rejected the
middle option — *"creating a mandatory receiver would convert inconclusive research into
new committed scope"*.

Neither the roadmap nor the orchestrator had spotted what both seats raised independently:
**step 2.4 is a second, separately unjustified intervention.** Bundling it with 2.1 would
have carried a confound into the contract itself, where neither could afterwards be
attributed.

**D2 — a satisfied prohibition closes `[x]`**, with a scoped negative-existence `verify:`
that **fails if an expected search root is missing**, checked *before* the absence check —
a glob over a vanished directory returns nothing and reads as success. Shipped as a general
convention in `roadmap-writing` § 6, deliberately compressed to 17 lines after the first
draft took the file from 382 to 427 and tripped `skill_too_large`.

### 4 and 5 — capacity dispositions · `1/2 seats, ⚠️ DEGRADED`

anthropic returned `exit_1`.

**Q1-a amended** — build topology Phase C1, park the rest in `later/` with
**phase-specific disjunctive** entry conditions rather than one conjunction, so satisfying
one condition reactivates its own phase.

**Q2-a — honour K6.** `delivery-on-hook-hosts` stays active with both blockers open.
Q2-c (re-scope so it can close) was rejected outright: it *"would convert an unfinished
delivery obligation into a completed documentation exercise. That is precisely the false
closure K6 guards against."*

Asked generally, because the shape recurs: a kill-register entry is a **binding local
constraint, defeasible only through explicit supersession** recording the original failure
mode, the changed premise, the replacement safeguard, rollback criteria and a falsifier.
**Authority alone is not a rationale.**

### 6 — The standing-payload budget → ADR-264 · `2/2 seats, SPLIT`

One seat gave Option B with a full mechanism. The other rejected A and B alike, read the
ceiling as a **baseline** rather than a cap, and argued both designs rest on an
unverifiable property — that "Iron Law" is a checkable category at all.

**The split was resolved on evidence, not preference.** The dissenting seat attached a
falsifier naming three conditions, *any* of which would sink its own objection. Two were
testable and were tested — see Findings 1 and 2.

**Verdict: the ceiling may not rise.** The 128-token aggregate Iron Law reserve is
**designed and deliberately not shipped**, because the deciding seat made
enforcement-before-wording an ordering condition: *"Wording alone creates an exploitable
trust gap."* What survives the falsifier is the dissent's real point, and ADR-264 keeps it:
a heading regex is syntactic and cannot tell whether prose *deserves* Iron Law status,
which is why the design verifies protected approval metadata instead of inferring
importance from fence syntax.

## Findings

**1. A dissent was retired by its own falsifier.** Condition 2 — checkable Iron Law
criteria exist — **holds**: `src/scripts/check_condensation.ts:196` carries
`IRON_LAW_HEADING = /^(#{2,6})\s+(The\s+)?Iron Laws?\b/`, enforced over every projection.

**2. The forbidding sentence predates the raises it forbids.** `git log -S'may never move
UP'` returns one commit, `4ef90d350` of **2026-08-24**; the two raises are 2026-09-02 and
2026-09-08. The contradiction is real, not an ordering artifact.

**3. Nothing reads a skill's `triggers:` frontmatter.** `dist/router.json` carries no
skills key, `compile_router.ts` contains zero occurrences of `skills`, and the one in-tree
reader indexes the field **only under a non-default mode**
(`score_skill_relevance.ts:170`; the default scores `name + description` at `:261-262`).
So for the trigger-declaring population the census zero is not a mechanism that failed —
no mechanism exists.

**4. A reading of this run's was wrong and is retracted in place.** A first pass compared
`src/skills/` against the installed `.claude/skills/` and concluded the projection strips
`triggers:` from 10 of 13. It measured **seven weeks of local staleness** in a gitignored
artifact — `Jul 5` copies against `Aug 23` sources. Retracted in § 3 of the evidence
artifact with the mtimes, not quietly dropped.

**5. A second reading was wrong, and the tooling disproved it.** The orchestrator argued
`road-to-the-skill-surface-framing-choice` could not be archived without stranding a
deferral carry. `archive_completed_roadmaps` **migrates** a destination when it moves one —
the sweep reported `4 ref(s) migrated` and `lint_deferral_integrity` re-ran green over 701
roadmaps. The roadmap's prose and its Risk Register row 3 are corrected in place, the row
marked RETIRED with the measurement that retired it.

**6. A risk predicted this run and came true.** `road-to-a-standing-budget`'s Risk 2 read
*"the question is answered by an agent — a run under an autonomous mandate is exactly the
actor that would resolve it anyway."* It was. Marked **REALISED, not avoided**: the
mitigation held where it mattered, but what stopped the failure was a seat's ordering
condition, not a structural gate.

**7. The ADR-number collision RECURRED within a day.** Run 21 found two branches claiming
ADR-262, stubbed the durable fix, and dispositioned it *record and defer*. Run 22 hit the
identical defect at **ADR-263** under 24 hours later — and **#1923 is in both collisions**:
its head commit is *"renumber ADR-262 -> ADR-263"*, so it dodged the first by taking the
next free number and landed in the second. Renumbering is not a fix; it is the defect
moving. Recorded on the stub per `recurring-criticism`, without settling which of the three
outcomes applies — this run lacked the authority, and "wrong disposition" versus "right but
unreachable" need different fixes.

**8. `scripts-run` resolves scripts from its own root but git state from the caller's
cwd.** With the shell pinned to the main checkout, every diff-scoped gate silently measured
the wrong worktree. It caused one red CI run — a stale ADR evidence census — before being
caught. `env -C <worktree>` is the fix and now prefixes every gate call in all three lanes.

**9. A commit was written and never pushed.** The Finding-7 record was committed to
`drain/standing-budget-headroom` after its last push, and PR #1940 merged without it. It
was recovered by cherry-pick onto this branch. A commit is not a delivery either.

## Work on branches this run did not own

**#1921 — conflict resolved and pushed.** One file, `src/domains/meta/pack.yaml`, in the
generated `token_passport`: this branch read `rules_tokens: 65643`, `main` read `65511`,
and **neither describes the merged tree**. Regenerating gave `65632`. A merge commit on
top — no commit dropped, reordered or force-pushed — plus a PR comment naming exactly what
was touched.

Its CI then went red on two checks, and both are **one cause — ADR-264's prediction
landing**. `Standing payload delta` reports `+178 tok notes-first-reasoning (rule, grew)`,
total 138,596 against a 138,490 ceiling; `Node Tests shard 3/4` fails
`check_preamble_payload_budget.test.ts > exits 0 under the grace ceiling the CI step
passes` with `expected 1 to be +0` — the same overage, asserted from the other side. There
is no second defect and nothing to repair in the test. This is the third occurrence the
standing-budget roadmap names, and the one that cannot escape by migration because what
remains is two fenced Iron Law blocks. Reported on the PR across two comments, not fixed —
the compensating reduction is that PR's content decision.

Worth naming as a validation: ADR-264 was written before this CI ran, and stated in its
Consequences that #1921 *"does not merge under an exception that does not exist yet"*. The
run then produced the number that confirms it, within the hour, without the ADR being
consulted by anything that produced it.

**#1923 — resolution confirmed, deliberately NOT pushed.** Two conflicts,
`hook_manifest.{json,yaml}`; the yaml hunk is one slot where this branch's deliberate
removal of `rule-inject` (owner ruling E2) collided with main's rename
`code-graph-nudge` → `code-graph-context`. Both survive, and the registry on main proves
the rename. Applied locally to confirm, then **aborted, leaving the branch byte-identical
to its remote**, and posted as a recipe on the PR. Reasons: the branch is not this run's,
its content is an owner ruling, and the environment declined the regeneration step three
times.

## What stays open, and why

**No step was silently descoped.** Everything open carries a five-field blocker naming its
measured obstacle.

- **Topology A / B / C2 / C3** — capacity facts no instruction can create: 2 of 5 council
  seats enabled against a pre-registered `n >= 5`, a 50-call per-provider-per-UTC-day cap,
  and a required two-day reservation. Parked with per-phase wake conditions; C1 built.
- **`delivery-on-hook-hosts`** — stays active by ruling; its predecessor
  (`lean_projection.hosts`) exists on no merged ref.
- **`skill-menu-economy`** — four of five conditions hold. (iii) is load-bearing: ADR-263
  settles what the package *claims* about routing, not how a skill leaves a delivered
  catalog.
- **The Iron Law reserve** — designed in ADR-264, blocked on an approval store no PR author
  can edit.
- **`a-graph-that-is-shipped` 1.3 and 2.3** — left `[ ]` by the roadmap's own kill register
  K8, which pre-decides the disposition. Routing them to a council would have overridden
  the roadmap's own rule.

## Ratchets

None lowered on a local reading. `check_source_size_budget` was **lowered** 17,974 →
17,973 by paying down rather than raising. One growth was claimed rather than absorbed:
`open_blockers` 41 → 42 via `estate_growth_exempt`, for a constraint moved out of prose
into the place a gate reads when `road-to-a-standing-budget` flipped `draft` → `ready`.
That flip also exposed a pre-existing risk-type violation the linter could not see while
the file was hidden.

## Honest limits of this record

The two lanes' **second** assignments — `a-graph-that-is-shipped` (13/25 → 23/25) and
`continuity-writer-activation` — were still in flight when this file was written, so their
PR numbers and CI verdicts are not in the JSON above. `roadmaps_active_at_end: 8` is the
count at `21c2ee68a` and will move when those land.

Every figure here is this tree's. Nothing was measured in a consumer install.
