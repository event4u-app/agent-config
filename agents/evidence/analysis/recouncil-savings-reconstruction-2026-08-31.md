# Re-council savings — a corpus reconstruction, and what it cannot be

**Date:** 2026-08-31 · **Roadmap:** `road-to-inbox-harvest-2026-08-e-council-topology-evidence`, step 10.5
**Mechanism:** `src/scripts/ai_council/recouncil_savings.ts` (new) over `src/scripts/ai_council/recouncil_guard.ts` (shipped)
**Reproduce:** `./scripts-run src/scripts/ai_council/recouncil_savings --root <checkout> [--pairs]`

Step 10.5 asks to *"track re-council savings: duplicates prevented,
near-duplicate warnings, reruns intentionally confirmed, spend saved"* and
verifies that *"the figures reconcile against the retained artifacts"*. Three of
those four figures are **not observable in this tree**, and the honest output is
therefore three nulls and one measured number, not four numbers.

## The two limits, stated before the figures

**1. This is a reconstruction, not instrumentation.** The guard persists
nothing. `warnIfRecounciled` (`src/scripts/ai_council/recouncil_guard.ts:267`)
returns `void` and writes only to an injected sink
(`recouncil_guard.ts:273` declares `write: (s: string) => void`,
`:289` is the only call). No warning, no abandonment and no confirmation is
recorded anywhere. So *duplicates prevented*, *reruns intentionally confirmed*
and *spend saved* have no data behind them at all — they are reported as `null`,
never as `0`, because `0` would assert a measured absence.

What **is** computable is the guard's own detector replayed over the retained
corpus: how many questions it *would* have flagged.

**2. The denominator is accidental, not designed.** See § The retention cause
below — no automatic reaper runs, so the corpus is not "the last N days of
council traffic" but "every artefact ever written that nobody deleted by hand".
Any rate over it is a rate over an unknown sampling frame.

## Figures — measured 2026-08-31

Corpus root: the maintainer's `agent-config` checkout. `agents/runtime/` is
gitignored and machine-local, so these figures are **not reproducible from a
clone**; the command above regenerates them on a machine that has the corpus.

| Figure | Value |
|---|---|
| retained question files (`*.md`, recursive) | **355** |
| distinct question sha256 | **355** |
| exact repeat files | **0** |
| near-duplicate pairs at 0.80 | **2** |
| questions in ≥ 1 pair | **4** |
| response artefacts the guard's reader admits as prior runs | **62** |
| …of which the question file still resolves | **45** (43 distinct question paths) |
| response artefacts the reader rejects | **23** |
| questions `checkRecouncil` would flag | **0** |
| duplicates prevented | **null — not observable** |
| reruns intentionally confirmed | **null — not observable** |
| spend saved (USD) | **null — not observable** |

`find agents/runtime/council/questions -type f` counts **357**; the two extra
entries are non-`.md` and are not council questions. The `355` above is the
`*.md` denominator this module reads.

Threshold is `NEAR_DUPLICATE_THRESHOLD` (`recouncil_guard.ts:50`), which aliases
`MERGE_THRESHOLD = 0.8` (`src/scripts/_lib/text_similarity.ts:19`) — fixed by a
2026-07-05 verdict long before this corpus existed, which is why step 1A.3's
pre-registration requirement is satisfied by reuse rather than by declaration.

## The reconciliation, and the one number that does not follow from the others

Two above-threshold pairs exist and the guard would have flagged **zero** of
them. That is not a contradiction; it is the guard's reach:

- `readPriorRuns` (`recouncil_guard.ts:102`) reads the responses directory
  **non-recursively** and filters on `.md`. 611 top-level entries → 85 end in
  `.md` → 10 of those are directories, which fail `readFileSync` and are skipped
  → 75 candidate files → 62 carry a parseable leading JSON object.
- Of those 62, only **45** name a question file that still exists, covering
  **43 distinct questions** — i.e. the guard can text-compare against
  **43 of 355** retained questions (12.1 %).
- Neither member of either near-duplicate pair has a retained response artefact
  pointing at it, so no prior run existed for the detector to match against.

**The pairs themselves.** Both are round-1/round-2 of one deliberation:

| score | a | b |
|---|---|---|
| 0.898 | `drain-blockers-a.md` | `drain-dispo-r2-a.md` |
| 0.870 | `drain-blockers-b.md` | `drain-dispo-r2-b.md` |

Each pair shares ~34 KB of identical "standing context" preamble and differs in
its deliverable — round 2 explicitly opens *"This is NOT a re-litigation of the
framework"*. So they are **true near-duplicates by text and correct re-councils
by intent**. This is exactly why step 1A.2 makes the guard warn and never block,
and exactly why *reruns intentionally confirmed* cannot be derived from text: the
distinction lives in the operator's head and nothing writes it down.

**An input to the threshold's own `revisit-if`, recorded rather than acted on.**
`recouncil_guard.ts:44-49` says the number is falsified if *"two questions a
human calls different"* score at or above it. These two pairs are arguably that
case — but the score is driven by a shared preamble, not by the question, so the
falsifier that fires is about **what text the guard compares**, not about `0.8`.
Changing the threshold here would be a drive-by; the observation is logged so the
next reader has the data point.

## The retention cause — NOT-established → established

The predecessor blocker recorded *"The cause was NOT established"* and a
hypothesis about divergent repo roots. The hypothesis is **moot**, and the real
cause is one grep:

1. **`prune_all_council_artifacts`** (`src/scripts/ai_council/session.ts:468`)
   has exactly **one** caller — `src/scripts/council_prune.ts:131`, behind the
   manual `task council-prune` (`taskfiles/content.yml:384`). No hook, no
   workflow, no `task ci` path.
2. **The auto-prune inside `save()`** (`session.ts:604`, reached from
   `save()` at `session.ts:506`) **has no production caller at all.** Across the
   repo, `src/scripts/ai_council/session.ts` is imported by exactly two files:
   `src/scripts/council_prune.ts:36` (which imports `_load_retention_days` and
   `prune_all_council_artifacts`, not `save`) and
   `tests/scripts/ai_council/session.test.ts:18`. The live writer,
   `src/scripts/council_cli.ts:224`, never imports it. This supersedes the
   divergent-root hypothesis: the pruner is not reached from **any** root.
3. **`janitor.ts`** declares the same directory at `ttlDays: 7`
   (`src/scripts/janitor.ts:57-59`) and is bound only to the manual
   `task janitor` / `task janitor-apply` (`taskfiles/content.yml:388,392`).

**No reaper runs.** Confirmed by measurement on 2026-08-31: **764 of 798**
files under `responses/` (recursive) and **326 of 357** top-level entries under
`questions/` have mtimes older than the declared 7-day TTL.

Two stale docstrings fall out of this and are recorded, not fixed here (out of
scope for step 10.5): `session.ts:461-462` says the function is *"Used by the
`task council-prune` target and by `save()`"* — true of the target, and true of
`save()` only in the sense that `save()` itself is dead; and
`council_prune.ts:14` describes *"the auto-prune that runs on every `council
save()`"*, an auto-prune with no live caller.

## What was NOT done

- No provider call, no network, no spend. The module is offline and read-only.
- **No spend figure was estimated.** A dollar amount needs a prevented run, and
  no prevented run is recorded. Deriving one from "2 near-duplicate pairs × an
  average call price" would be an invented number wearing arithmetic.
- The retention defect is **diagnosed, not repaired**. Wiring a reaper touches
  the council write path and belongs in its own change.
