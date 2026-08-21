<!-- evidence-type: analysis -->

# Merge-hotspot cadence — what actually drives the churn

> Measured 2026-08-21 on `origin/main` at
> `f39f14258c77b2aa617f1ea7b75ae7deba3b3a75`. Roadmap:
> `road-to-merge-hotspot-drawdown` Phase 3. Both measurements carried a
> pre-registered expectation and a pre-registered honest null; both are reported
> against those, and the commands are given so a reader can re-run them.

## Why measure at all

The handover this work came from goes straight from "these three files conflict"
to a merge strategy. The AI council (2026-08-21, both seats) objected that the
root cause was unstated: `agents/roadmaps-progress.md` was touched by **1030
commits in 60 days** — ~17/day — and a fix aimed at merge mechanics before
anyone asks *why 17/day* is a fix aimed at a symptom. If the cadence is
reducible, reducing it is cheaper than any merge strategy. These two
measurements answer whether it is.

## 3.1 — Dashboard cadence attribution

**Question.** Are the 1030 commits genuine dashboard events, or a by-product?

**Pre-registered expectation.** The ride-along class dominates — the cadence is
a by-product of the per-step checkbox-flip cadence, not 17 dashboard events a
day.

**Pre-registered honest null.** If standalone regenerations dominate, the
cadence is real, cannot be reduced, and "reduce the cadence" leaves the option
set on those grounds instead.

**Commands.**

```bash
P=agents/roadmaps-progress.md
git log --since='60 days ago' --oneline -- $P | wc -l                 # total
git log --since='60 days ago' --merges --oneline -- $P | wc -l        # merges
# per non-merge commit: is the dashboard the ONLY file in it?
for c in $(git log --since='60 days ago' --no-merges --format='%H' -- $P); do
  git show --name-only --format='' $c -- | grep -cv '^$'
done   # ==1 -> standalone regeneration; >1 -> ride-along
```

**Result.**

| Class | Count | Share of total | Share of non-merge |
|---|---|---|---|
| Total commits touching the path | 1030 | 100 % | — |
| Merge commits | 292 | 28.3 % | — |
| Non-merge commits | 738 | 71.7 % | 100 % |
| — standalone regeneration (dashboard is the only file) | **42** | 4.1 % | **5.7 %** |
| — ride-along (dashboard travels with other work) | **696** | 67.6 % | **94.3 %** |

**Verdict — expectation confirmed, decisively.** 94.3 % of non-merge touches are
ride-alongs. The dashboard is not being regenerated 17 times a day for its own
sake; it is being rewritten alongside whatever else the commit did.

**What this removes from the option set.** "Throttle or batch the generation" is
**not available**. The ride-along cadence is not an accident to be tuned — it is
the `roadmap-progress-sync` Iron Law 2 obligation working as specified: *"every
done step flips `[ ]` → `[x]` in the same reply that lands the work"*, with the
dashboard regenerated on the same cadence. Reducing the cadence therefore means
repealing an Iron Law, not tuning a script. So the remaining levers on this path
are exactly the two the council named — untrack it, or give it a merge driver —
and the cadence measurement is the reason there is no cheaper third option.

## 3.2 — Estate-budget conflict anatomy — CORRECTED, and the honest null fired

**Question.** On `src/config/estate-count-budget.json`, is the churn
append-shaped (history entries) or semantic (baseline walks)?

**Pre-registered expectation.** Appends dominate — 71 `baseline_history` entries
against a handful of baseline moves.

**Pre-registered honest null.** If baseline moves dominate, an append-safety
split buys little, and the `REMEASURED` classification (Phase 1.2) is the whole
available fix.

**The first published measurement was wrong, and it reported the honest null as
its opposite.** It classified `-U0` hunks by regex — entry lines as
`"(date|active_roadmaps|later_roadmaps|open_blockers|why|source|window)"`,
structure as `"(baseline|baseline_history|target|one_in_one_out)"` — and the
`baseline` object uses **exactly the same key names as a history entry**:

```json
"baseline": {"active_roadmaps": 9, "later_roadmaps": 55, "open_blockers": 41}
```

At `-U0` the enclosing `"baseline": {` line is outside the hunk, so a **pure
baseline walk matches the entry-line regex and not the structure regex** and was
counted as an append. The single clearest instance, whole diff of the commit:

```
e79f0450e chore(estate): ratchet the active-roadmap baseline down to 10
@@ -19 +19 @@
-    "active_roadmaps": 11,
+    "active_roadmaps": 10,
```

Zero appends, a pure ratchet walk, counted as "entry lines only (an append)".
That is why the first table read `structure keys only: 0` — a cell that cannot
be non-zero is the tell, and it was published without anyone asking why.

**Commands — corrected method.** Parse the JSON on both sides of each commit and
compare the two fields directly, rather than pattern-matching the hunk text:

```bash
P=src/config/estate-count-budget.json
for c in $(git log --since='60 days ago' --no-merges --format=%H -- $P); do
  # len(baseline_history) changed?  ->  append
  # baseline object changed?        ->  walk
  git show "$c~1:$P" ; git show "$c:$P"     # json.loads both, compare the two keys
done
```

**Result** (43 non-merge commits, re-measured at the same pinned commit):

| Class | Count |
|---|---|
| pure history append, baseline untouched | **1** |
| pure baseline walk, no append | 4 |
| **both in one commit** | **35** |
| neither (comment / whitespace) | 2 |
| unparsable side | 1 |
| **commits that moved the baseline** | **39 of 43** |

**Verdict — the honest null fired.** Baseline moves dominate: 39 of 43 commits
move the baseline, and exactly **one** commit in 60 days is a pure append. The
expectation was wrong.

**What this changes.** An append-safety split of `baseline_history` — per-record
files or otherwise — would have addressed the conflict mode that occurs **once**
in 60 days while leaving the one that occurs in 35 of 43 commits untouched, and
that remaining mode is precisely the semantically real one: two branches
measured two different trees. So the `REMEASURED` class from Phase 1.2 is not the
interim mitigation ahead of a split; on this file it is **the whole available
fix**, which is what the honest null pre-registered.

It also strengthens [ADR-239](../../../docs/decisions/ADR-239-no-union-merge-for-ratchet-baselines.md)
rather than weakening it: the union-merge proposal was not merely unsafe, it was
aimed at a mode that barely exists here. A driver would have been built, carried
its silent-corruption risk, and bought one conflict per 60 days.

**Why this correction is in the record rather than a quiet edit.** The wrong
number had already been cited as a premise in an ADR and in a PR body before the
method defect was found — by an independent reviewer, not by the author. A
measurement whose failure mode is "the cell that should have been non-zero was
zero" is exactly the shape that survives a re-read of its own output, so the
defect is named with its mechanism above, and the corrected command is written
out so the next reader re-runs a parse rather than a regex.

## Cross-cutting finding — one proposed gate already exists

Not a Phase 3 item; found while probing Phase 2 and recorded here because it is
the same class of answer. The council asked for a CI check rejecting a commit
that regenerates only one of `agents/roadmaps/archive/{INDEX.md,index.json}`.
That check already exists and already runs:

```bash
./scripts-run src/scripts/build_archive_index --check --quiet
# with only index.json made stale:
# ❌  archive index out of date (agents/roadmaps/archive/index.json) — run `task build-archive-index`
```

`build_archive_index.ts:392-401` regenerates both in memory and compares each
byte-for-byte against the committed artefact, naming whichever one drifted; the
task is wired at `taskfiles/content.yml:132-135` and runs in CI at
`.github/workflows/consistency.yml:160`. A half-regenerated commit is stale on
the un-regenerated half the moment CI checks it out, so the invariant holds
without a second gate. Probed, not assumed — the failing direction was produced
first and the file restored from a copy afterwards.
