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

## 3.2 — Estate-budget conflict anatomy

**Question.** On `src/config/estate-count-budget.json`, is the churn
append-shaped (history entries) or semantic (baseline walks)?

**Pre-registered expectation.** Appends dominate — 71 `baseline_history` entries
against a handful of baseline moves.

**Pre-registered honest null.** If baseline moves dominate, an append-safety
split buys little, and the `REMEASURED` classification (Phase 1.2) is the whole
available fix.

**Commands.**

```bash
P=src/config/estate-count-budget.json
git log --since='60 days ago' --oneline -- $P | wc -l
git log --since='60 days ago' --merges --oneline -- $P | wc -l
# per non-merge commit, classify the -U0 hunks by which keys they touch
git show --format='' -U0 <sha> -- $P | grep -E '^[+-]' | grep -v '^[+-][+-]' \
  | grep -cE '"(date|active_roadmaps|later_roadmaps|open_blockers|why|source|window)"'   # entry lines
  # vs '"baseline"|"baseline_history"|"target"|"one_in_one_out"'                          # structure keys
```

**Result.**

| Class | Count |
|---|---|
| Total commits touching the path | 93 |
| Merge commits | 50 |
| Non-merge commits | 43 |
| — entry lines only (an append) | **40** |
| — structure keys only | **0** |
| — both | 2 |
| — neither (whitespace / comment) | 1 |

The file itself carries **71** `baseline_history` entries, and every one of them
records the same `active_roadmaps` shape at its own point in time — i.e. the
array is a log, and the log is what grows.

**Verdict — expectation confirmed.** 40 of 43 non-merge commits are pure
appends. An append-safety change would remove the dominant conflict mode on this
path.

**What this does NOT license.** The council blocked the shape the handover
proposed for it — JSONL plus `merge=union` — because a line-based driver
combines two same-date entries with different counts into two contradictory
records, moving the conflict out of git (visible, must be resolved) into the
application layer (silent, may corrupt). The measurement says the fix is worth
building; it says nothing about which shape is safe. The endorsed shape is
**one file per record** (filename collision = content identity, the precedent
`.gitattributes:62-66` already uses for memory YAML), and it is gated on the
preconditions recorded in the union-merge ADR.

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
