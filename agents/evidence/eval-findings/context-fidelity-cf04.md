<!-- evidence-type: honest-null -->

# Spike cf04 — pointer liveness does not predict semantic staleness

**Date:** 2026-08-19
**Roadmap:** [road-to-context-fidelity.md](../../roadmaps/road-to-context-fidelity.md) Phase 2, step 1
**Tree:** branch `feat/context-fidelity-memory-eviction`, base `origin/main` at `f2ee93e3c`
**Instrument:** `src/scripts/report_memory_pointers.ts` (built here; named
`sweep_memory_staleness.ts` until this measurement retired that claim)
**Ground truth:** [`context-fidelity-cf02.md`](context-fidelity-cf02.md) — 107
entries hand-walked against the tree, 3-valued verdicts
**Pre-registered falsifier (council 2026-08-19):** *"Reject Option 2 if blinded
review shows that its ranked queue finds semantic staleness no better than
random sampling after accounting for review and maintenance cost."*

## Verdict up front

**The falsifier fired. No configuration of the instrument beats random
selection.** Dead citations alone: precision 0.0 % against a 20.6 % base rate,
lift **0.00x**. Adding anchor drift, the strongest signal available: 15.4 %
precision, lift **0.75x**. Widening to dead-or-moved: 12.5 %, lift 0.61x. Every
queue is worse than picking entries at random from the same store.

The ranking claim is withdrawn, the instrument is renamed to what survived
(`report_memory_pointers`), and the eviction ladder is calibrated on cf02's
hand reading exactly as the blocker's do-nothing branch described.

## What was asked, and by whom

The `memory-sweep-instrument` blocker asked whether a store-wide sweep is in
scope for Phase 2 or whether the ladder ships on cf02's hand reading. Put to the
council on 2026-08-19 (anthropic/claude-sonnet-4-5 + openai/codex-default, two
rounds, blind peer review, quorum 2/2, $0.0412 on subscription transport), the
answer was **unanimous Option 2** — build the sweep, but narrowed from semantic
truth to pointer liveness, with demotion never driven by its output.

Both seats named the same risk in their own strongest-counter slot. openai:
*"Pointer integrity may have little predictive relationship with semantic
staleness. Live pointers can support an outdated rationale."* anthropic: *"It
cannot catch semantic staleness where all pointers stay live but the claim
becomes false."*

This spike measured that risk instead of arguing it. It is the risk.

## Method

1. Build the instrument. Bounded citation grammar over each entry's `body`:
   `path/to/file.ext:123`, `path/to/file.ext`, `path/to/dir/`, `ADR-NNN`,
   `[[wiki-link]]`. Everything else is reported `unparseable` rather than
   silently treated as live (a council refinement).
2. Resolve each citation against the tree at branch HEAD. Four states: `live`,
   `moved` (basename exists elsewhere in `git ls-files`), `dead`, `unparseable`.
3. Flag an entry on structural defect only — `dead > 0` or anchor drift. Age,
   anchor state and parser coverage never flag.
4. Compare the flagged set against cf02's stale set.

Reproduction:

```
./scripts-run src/scripts/report_memory_pointers --format json > sweep.json
python3 tools/lift.py sweep.json      # transcribed cf02 stale ids, in-file
```

The comparison script is not committed — its entire content is the cf02 id list
transcribed from the tables in that file, and re-deriving it is a copy-paste. The
numbers below are the ones it printed; the flagged set is reproducible from the
first command alone.

## Result

Measured twice, because the commit anchor landed between the two runs and made
a second signal — anchor drift — computable for the first time. Both runs are
reported; the second is the shipped configuration.

**Run 1 — before the anchor (dead citations only):**

| Queue | n | true positives | precision | base rate | lift | recall |
|---|---:|---:|---:|---:|---:|---:|
| flagged (dead) | 3 | **0** | **0.0 %** | 20.6 % | **0.00x** | 0.0 % |
| moved-citation entries | 11 | 1 | 9.1 % | 20.6 % | 0.44x | 4.5 % |
| union (dead or moved) | 14 | 1 | 7.1 % | 20.6 % | 0.35x | 4.5 % |

**Run 2 — after stamping all 107 entries with `verified_at_commit: 9beeb0662`,
so "did a cited path change since this entry was verified" became answerable:**

| Queue | n | true positives | precision | base rate | lift | recall |
|---|---:|---:|---:|---:|---:|---:|
| flagged (dead **or drift**) | 13 | 2 | 15.4 % | 20.6 % | **0.75x** | 9.1 % |
| moved-citation entries | 11 | 1 | 9.1 % | 20.6 % | 0.44x | 4.5 % |
| union (dead or moved) | 24 | 3 | 12.5 % | 20.6 % | 0.61x | 13.6 % |

Drift is the strongest of the three signals and it is still sub-random. It did
find two genuine stale entries the citation check missed
(`roadmap-progress-regen-side-effects`, `typecheck-use-task-not-bare-tsc` — the
latter being cf02's own showcase for "live pointers, false rationale"), so the
signal is not zero. It is simply not better than picking an entry at random,
which is the bar the council set.

One caveat on run 2 that a later reader must not skip: the anchor was 41 days
old at measurement. Drift is monotonic in anchor age, so this ratio degrades
as anchors age and improves right after a re-verification pass. A 0.75x taken
against a fresh anchor would be a different number and would still have to
clear 1.0x to change the verdict.

The three flagged entries, and what cf02 said about each:

| id | flagged because | cf02 verdict |
|---|---|---|
| `bench-ab-cost-and-activation-mechanics` | cites `src/scripts/bench_ab_task_runner.py`, now `.ts` | **still-true** — cf02 explicitly notes "path drift only" |
| `pr-gate-roadmap-archival` | cites `src/agent-src/scripts/archive_completed_roadmaps.py`, now `.ts` | **still-true** — same note |
| `no-cheap-sequencing-questions` | `[[no-cheap-questions]]` resolves to no entry (it is a RULE, not a memory id) | **still-true** |

Three flags, three entries the hand walk had already confirmed as correct. Not a
single one of cf02's 22 stale entries carries a broken citation.

## Why the two axes do not meet

The failure mode each axis detects is genuinely different, and cf02 had already
published the counterexample without anyone reading it as one:

- `typecheck-use-task-not-bare-tsc` — every path it cites is live. Its stated
  *reason* is false. Pointer liveness is structurally blind to it.
- The three `.py → .ts` renames above are the mirror image: the citation rotted,
  the claim did not.

And the batch mechanism cf02 identified makes the mismatch worse rather than
better. Its two dominant staleness events — ADR-201 removing markdown
condensation, and the deletion of the `subagents.auto` setting — account for 11
of 22 stale entries. **Neither leaves a dead citation.** A removed *behaviour*
and a removed *config key* invalidate prose while every file named around them
keeps existing.

## Three false-positive classes had to be killed before the number was even fair

Stated because the honest reading of the null depends on it — the instrument was
not strawmanned into failing. Each narrowing was made *before* the comparison
and each reduced the flagged set:

| Narrowing | Flagged before → after | Why it is correct, not tuning |
|---|---|---|
| `unparseable` stops contributing to the score | 107 → 28 | It measures grammar coverage, not entry health. Counting it flagged the entire store. |
| Citations must be repo-rooted (first segment is a real top-level name) | 28 → 19 | `analyze/decision.md`, `charge.ts:13`, `archive/` are prose fragments, not repo paths. Resolving a fragment against the root manufactures a dead pointer. |
| Relocation-awareness (`moved` ≠ `dead`) | 19 → 10 | 16 of 18 flags cited a roadmap that had simply been archived. The file exists; the claim is untouched by the move. |
| Gitignored paths are unresolvable, not dead | 10 → 3 | `agents/tmp/…` and `agents/runtime/…` are absent from every clone by design. |

The last one is worth naming twice: it removed the only true positive the
instrument ever had. `video-strategy-2026-06` was flagged for citing a council
response under `agents/runtime/`, which is gitignored and auto-pruned after
seven days — so *every* citation into that tree is absent, for every entry,
always. It cannot discriminate. Keeping it would have bought one true positive
and a permanent false-positive generator.

## What this does not show

- **n=1 corpus, one instrument, one tree state.** This falsifies pointer
  liveness as a staleness ranker *on this store*. A store whose entries cite
  code rather than roadmaps and council artefacts could behave differently.
- **cf02 is itself a single-classifier hand walk** with undefined inter-rater
  agreement, and this spike inherits every limitation of that ground truth. A
  stricter re-reading that reclassified several `still-true` rows would move
  these numbers — though not plausibly from 0.00x to above 1.0x.
- **The ground-truth count is 22, not the 23 cf02's summary states.** Its
  `product-rules` per-entry table lists eight stale rows under a heading that
  says nine, and the totals row says nine. Transcribed here as what the table
  actually lists. The discrepancy changes the base rate by 0.9 points and no
  verdict.
- **Nothing here says the report is worthless.** It found 3 dead citations and
  11 relocated ones — real documentation debt — and it is the only reproducible
  reading of anchor coverage the store has. It says only that none of that
  predicts whether an entry is true.

## Consequences, carried into the phase

1. **The ranking claim is withdrawn** and the instrument renamed
   `report_memory_pointers`. Its header carries this null so the next reader
   meets it before the code.
2. **Demotion never reads pointer output.** The council said this as a
   precaution; it is now a finding. The ladder acts on age past a per-store
   window and on recorded human semantic verdicts, nothing else.
3. **"Contradiction outranks retention" needs a human verdict field**, because
   no mechanical contradiction signal against the tree exists or is in prospect.
   That is what `semantic_verdict` records.
4. **The commit anchor survives independently** of the sweep and is the half
   that was always load-bearing: without it a date cannot be tied to a tree
   state, which is why the shipped instrument reads 0.0 %.
