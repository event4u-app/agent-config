# Reproducing an `ab-v2` paired sweep

One page, on purpose. It exists because the record shows the harshest critic of a
benchmark becomes its most-cited validator once handed a reproduction path — so
the path is a first-class deliverable of `road-to-solution-minimalism` Phase 3,
not an afterthought written once someone asks.

## Start here — the run that costs nothing

```bash
npx tsx src/scripts/bench_ab_v2_run.ts \
  --mode selftest \
  --arms vanilla,package,package-ladder,bare-principle,placebo \
  --seeds 2 --limit 2 \
  --model claude-sonnet-4-5-20250929 \
  --no-checkpoint
```

Exits 0 with **no network and no API key**. It substitutes exactly one thing —
the model call — and runs the fixture clone, the deterministic scorer, the
per-trial activation stamp, the cross-arm audit, the report writer and every exit
code for real. So a green selftest tells you the harness works; it tells you
nothing about the hypothesis, and its report says so in three places (`tier:
selftest`, `synthetic: true`, `-selftest` in the filename, plus a `synthetic: true`
stamp on every trial record).

`--mode dry-run` is not this. It prints a run count and returns before all of the
above — useful for checking arithmetic, useless for checking the harness.

## The three exit codes

| Code | Meaning |
|---|---|
| 0 | sweep completed and the activation audit found nothing |
| 1 | bad invocation or missing host CLI (unknown arm, arm invalid for `--host codex`, `claude` not found) |
| 2 | **refused or invalid** — a bare model alias, an unpriceable model under `--max-usd`, a sweep-budget abort, or an activation-audit violation |

Exit 2 always still writes the report: an invalid sweep already cost money and its
raw runs stay inspectable. The exit code is what makes it non-ignorable, so never
read a report without reading the code that produced it.

## What the activation audit checks, and in which direction

Two directions, because one trial cannot see both:

- **Per trial (text channel).** An arm that declares an injection must carry one;
  an arm that declares none must not. Stamped on every record as `activation`.
- **Across arms (footprint).** A lift arm's prompt footprint must sit at least
  `ACTIVATION_MIN_LIFT_RATIO` (1.2) above its paired `vanilla` run. This catches a
  treatment surface that **collapsed to baseline** — a disabled or version-drifted
  plugin, which is how this harness once produced a full set of invalid nulls that
  looked identical to real ones.

`bare-principle` opts out of the footprint direction only (`min_lift_ratio: null`
on its `ArmSpec`): its treatment is one sentence, so it has no lift to show and a
ratio check there would fail healthy runs. Its text direction still runs both
ways. `lift_audit_arms` is exported so the exclusion set is asserted by tests
rather than trusted.

## Offline re-scoring

Every trial preserves its own workspace, keyed `task__arm__seedN` under
`$TMPDIR/agent-config-bench-v2-clones/`, and records that path as `workspace` on
the trial. This is what makes a new endpoint retro-fittable onto an
already-completed sweep instead of requiring a re-run: the diff a trial produced
is still on disk.

Two consequences worth knowing before you rely on it:

- Workspaces live in the OS temp directory, so they survive the sweep but not
  necessarily a reboot. Copy them out before re-scoring a run you care about.
- A resumed or repeated trial re-clones from the pristine fixture, so the
  workspace always reflects the LAST execution of that (task, arm, seed).

The first endpoint to actually cash this in is the T1/T2 pair (delta #11):

```bash
npx tsx src/scripts/bench_ab_v2_complexity.ts <report.json>          # print, touch nothing
npx tsx src/scripts/bench_ab_v2_complexity.ts <report.json> --write  # write the endpoints back
```

It writes `added_lines` and `median_cognitive_complexity` onto each trial's
`metrics`. Three properties matter when reading its output:

- The default **prints and writes nothing**. Rewriting a pinned artefact in place
  is how a report stops matching numbers already quoted from it, so `--write` is
  explicit.
- A trial whose workspace was pruned reports `null` with a reason, never `0`. A
  zero would read as "this run changed nothing"; `compare()` treats the null as
  *not measured on this pair*, and `size_claim_verdict` then refuses to report a
  size win at all rather than scoring a partial sample.
- The fixture each trial is diffed against is resolved **from the corpus by task
  id**, which is what makes the retro-fit real: it needs nothing stamped into the
  report, so every sweep that already ran is re-scorable as it stands. A report
  from a different corpus is re-scored by pointing the re-scorer at that corpus;
  a task id it does not carry is reported as such, never silently skipped.

Two more re-scorers follow the same shape (2026-08-17). **T4 — the safety tier**,
free to run and deterministic:

```bash
npx tsx src/scripts/bench_ab_v2_safety.ts <report.json>          # print, touch nothing
npx tsx src/scripts/bench_ab_v2_safety.ts <report.json> --write  # write safety_tier_pass
```

It runs each safety-tier task's adversarial probe against the trial's workspace
and writes `safety_tier_pass`. Only the tasks carrying a `safety_oracle` are in
the tier; everything else reports "no safety oracle" and contributes nothing. A
trial whose run broke the module reports **unmeasured**, not a breach — folding
that into a failure would report every crashed trial as a dropped guard.

**T5 — search adherence**, the one endpoint that costs money:

```bash
npx tsx src/scripts/bench_ab_v2_search.ts <report.json>                  # mock judges, no spend
npx tsx src/scripts/bench_ab_v2_search.ts <report.json> --live --write   # two real judges
```

It reads the transcript preserved beside each clone (`<workspace>.transcript.txt`)
and scores it at the pre-registered k=2, crediting a rubric item only when both
judges credit it. Three things to know: the default is the **mock** judge, so a
run without `--live` costs nothing and is what the tests exercise; a missing key
is a hard exit rather than a silent drop to one judge, because k=2 is
pre-registered; and a sweep run **before 2026-08-17** preserved no transcript, so
every trial in an older report reports that boundary explicitly instead of
scoring zero.

## Resume

Checkpointing is on by default. The key is derived from corpus, model, seeds,
arms, budget, timeout, host and the task-id list, so a sweep resumes only into an
identical configuration — change any of those and you get a fresh run rather than
a silently mixed one. `--fresh` discards a checkpoint; `--no-checkpoint` disables
it. A completed sweep deletes its own checkpoint so no residue steers a later run.

## Cost control

`--budget` is **per run** (default 1.0). `--max-usd` is the **sweep** cap: prices
come from `internal/bench/pricing.yaml`, the four token buckets are priced
separately (they differ by up to 125×, so a blended rate is a different number,
not an approximation), and the first run that crosses the cap aborts the sweep
with exit 2. A model with no pricing row plus `--max-usd` is **refused**, never
silently uncapped.

## What a paid run additionally needs — and does not have yet

A full-tier Phase-3 run is **not** reproducible from this document alone, and
saying so is part of the path:

- ~~**The spend grant** is the user's (`benchmark-spend-authorization` in the
  roadmap). Firing a paid external run without it is a Hard-Floor action.~~
  **Granted 2026-08-14** at a $250 ceiling, pre-authorised — pass `--max-usd 250`
  so the `collect_records` guard aborts rather than overruns. The Hard-Floor
  reasoning is unchanged for any *other* paid run; this particular grant is spent
  as a decision and does not need re-asking.
- **A pinned external repo** (S0.3 delta #9) does not exist: the corpus carries no
  `repo`/`sha` keys and the fixtures are self-contained in-repo trees. So there is
  currently **no SHA to pin**, and any report claiming one would be wrong.
- **Task oracles against that repo** (delta #10, sized large) do not exist. A
  harness pointed at a real repo with no oracles runs nothing, which is why #9 and
  #10 ship together.
- ~~**A cognitive-complexity endpoint** (delta #11, sized large) does not exist
  anywhere in the tree, and Phase 3's acceptance is a metric *pair* — so the phase
  cannot report a pass without it, at any price.~~
  **Landed 2026-08-16** — `_lib/bench_ab_complexity.ts` plus the re-scorer above.
  The pair reasoning still holds and is now enforced rather than documented: an
  unmeasured endpoint yields `INCONCLUSIVE`, never a pass.

- ~~Two endpoints named in the pre-registration are still unimplemented and will
  read `INCONCLUSIVE` on any run made today: the **safety tier** (T4) and
  **search-adherence** (T5). Both are rubric-judged, so both need model calls and
  their own oracles.~~
  **Landed 2026-08-17, and one half of that sentence was wrong.** Only T5 is
  rubric-judged; the pre-registration defines T4 as *adversarial-input
  **execution***, so it needs no model call and no spend — see the two re-scorers
  above. What remains true is the conservative direction: an unmeasured T4 still
  makes `size_claim_verdict` refuse a size win outright.

Until #9 and #10 land, the honest reproducible surface is the selftest plus
offline re-scoring of whatever sweeps exist — which now includes the size pair,
the safety tier, and (on sweeps run after 2026-08-17) search adherence.
