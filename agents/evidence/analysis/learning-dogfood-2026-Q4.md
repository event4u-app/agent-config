<!-- evidence-type: analysis -->

# Learning-sidecar dogfood window — 2026 Q4

**Window opened:** 2026-10-01.
**Scope:** one maintainer checkout
(`/Users/…/event4u/agent-config`), one person's sessions. Not a corpus — see
§ What this window cannot answer.
**Roadmap:** `road-to-learning-you-can-see`, Phase 1.

## What is being decided

`memory.learn_on_session_end` ships OFF. The condition for proposing the
default flip was written by the council of 2026-07-27 and lives verbatim in
`src/config/agent-settings.template.yml:1392-1394`, with the key it gates on
`:1395`:

> ```
>   # human via /memory:propose. SHIPS OFF (council 2026-07-27): the default
>   # flip is proposed only after the 30-day dogfood shows non-trivial signal
>   # AND session-end p95 < 2 s.
> ```

**The line number drifts; the command does not.** Those numbers read `1376-1378`
and `1379` until 2026-10-04, when a re-read found `1376` pointing at an
unrelated memory-index comment sixteen lines above the council's. A reader on
the wake date would have followed the citation to the wrong paragraph and had no
way to notice. Cite it by the grep instead, which survives any further drift:

```bash
grep -n -B3 'learn_on_session_end' src/config/agent-settings.template.yml
```

Two thresholds, both load-bearing, quoted rather than paraphrased so a reader
can check the copy against the source:

1. **non-trivial signal** — the 30-day dogfood must show it. The template does
   not quantify "non-trivial"; this window reports the number and leaves the
   judgement where the council put it (see § Owner-reserved below).
2. **session-end p95 < 2 s** — the same 2 s the hook already carries as
   `BUDGET_MS` in `src/scripts/memory_learn_hook.ts`.

The flip itself is **not** this window's to make. It is an amendment to the
council decision, owner-reserved, and the roadmap's step 2.3 is deferred on
exactly that ground.

## How to read it

```bash
# every recorded session end, one JSON object per line
cat agents/runtime/state/learning-dogfood.jsonl

# what the sidecar has actually learned — one screen, read-only
agent-config memory:learn --format status
```

`agents/runtime/state/learning-dogfood.jsonl` is gitignored (the whole
`agents/runtime/` tree is), so the window is per-machine by construction. Each
line is `{at, wall_ms, signals_in, lessons_out, preferred}`.

`wall_ms` covers **read + aggregate** — the portion the 2 s budget governs and
the portion that scales with intake size. The two `writeFileSync` calls that
follow it are not in the figure; they fire only when a lesson exists, which
in this checkout has not happened yet. If the p95 ever lands near the
threshold, that omission is the first thing to re-measure rather than to argue
about.

## Why a zero had to become a line

The window could not have been opened against the previous code. `runLearn`
returned before any measurement point whenever the intake was empty — absent
directory, nothing read, nothing aggregated — so a checkout with no signals
produced an unbroken silence. A silence and a measured zero are indistinguishable
to whoever opens the file 30 days later, and the difference between "the hook
never ran" and "the hook ran 60 times and saw nothing" is the entire question.
The ledger line is therefore appended **before** the early returns.

The first two lines recorded in the maintainer checkout, on the day the window
opened — the flag on, the hook run for real, once before the intake was seeded
and once after:

```json
{"at":"2026-10-01T10:33:35.108Z","wall_ms":1,"signals_in":0,"lessons_out":0,"preferred":0}
{"at":"2026-10-01T10:40:19.060Z","wall_ms":1,"signals_in":3,"lessons_out":0,"preferred":0}
```

`signals_in: 0` on the first line is a real reading, not a missing one. On the
second, `lessons_out: 0` beside `signals_in: 3` is the corroboration gate
working: all three signals carry one origin, and a lesson needs two.

## Supply — what feeds the window

Probed 2026-10-01. The producer (`src/scripts/memory_signal.ts`) works: invoked
directly it validates, rate-limits, applies the ADR-130 provenance gate and
appends to `agents/memory/intake/signals-YYYY-MM.jsonl`. The gap was never the
binary.

The gap is **reach**. Emission is reachable from exactly three authored
surfaces, all of them slash commands a person has to invoke:

| Producer | Source |
|---|---|
| `/bug:fix` | `src/domains/engineering-base/bug/fix/command.md:159` |
| `/judge:on-diff` | `src/domains/engineering-base/judge/on-diff/command.md:73` |
| `/memory:propose` | `src/domains/meta/memory/propose/command.md:94` |

No hook, no session-end concern and no ordinary code path emits a signal. That
is why `agents/memory/intake/` held nothing but `.gitkeep` and `README.md` on
the day this window opened, and it is the honest reason a low `signals_in` in
this window is a statement about **invocation frequency**, not about whether
sessions produce anything worth learning.

Three signals were emitted through the documented path while opening the window,
so the intake is non-empty from day one. They are real observations from the
work that opened it, not filler. None of them can become a lesson on its own:
`MIN_CORROBORATIONS` is 2 **distinct origins**, so a single session never mints
one — a non-empty intake sitting beside an empty `LESSONS.md` is the
corroboration gate working, not a defect.

### Where those signals live, and why not in this commit

They are **not** in the repository, and looking for them here is the wrong
place. In this package's own tree, signal content is local scratch:
`src/scripts/check_knowledge_sharing.ts` blocks any commit that stages a file
under `agents/memory/intake/` other than the `.gitkeep` and `README.md`
skeleton, on the ground that only the directory skeleton is tracked so the
write path exists on a fresh clone.

This is worth stating because the neighbouring evidence reads the other way at
first glance. `.gitattributes:50` sets `merge=union` on
`agents/memory/intake/*.jsonl`, and `agents/memory/intake/README.md` calls the
layer "Local + tracked" — both true, and neither about this repo: they sit
inside a block headed *"Append this block to the consumer project's root
.gitattributes"*. The union-merge contract is the CONSUMER contract, where
intake is tracked and two branches may append concurrently. Here it is not.

So the maintainer checkout's intake is the window's input, and it is per-machine
exactly like the ledger beside it. That is the correct reading of the roadmap's
acceptance criterion "at least one signal file exists in the **maintainer
intake**": the file is in the checkout, not in the diff.

## Mid-window reading — 2026-10-04

Taken three days into the thirty, not to decide anything but to find out whether
the window is on course to be decidable on its wake date. Each figure below is
the command's output, and each negative carries the control that separates "no
result" from "mistyped argument".

**The ledger has not grown since the day it opened.**

```bash
$ wc -l < agents/runtime/state/learning-dogfood.jsonl
2
$ cat agents/runtime/state/learning-dogfood.jsonl
{"at":"2026-10-01T10:33:35.108Z","wall_ms":1,"signals_in":0,"lessons_out":0,"preferred":0}
{"at":"2026-10-01T10:40:19.060Z","wall_ms":1,"signals_in":3,"lessons_out":0,"preferred":0}
```

Both lines are the two this page already quotes as the opening readings. Three
days of sessions have produced no third. The closing condition asks for **≥ 20**;
the window is at **2**, with 27 days left to find 18.

**The mechanism is not the explanation — it is wired and armed.** Four checks,
each run against the live tree rather than inferred:

| Claim | Command | Output |
|---|---|---|
| the concern is bound on `session_end` | `grep -n 'session_end:' src/scripts/hook_manifest.yaml` | `memory-learn` present in every platform row |
| the native event maps to it | `grep -n 'SessionEnd' src/scripts/hook_manifest.yaml` | `SessionEnd: session_end` |
| the concern is in the built bundle | `grep -c 'learning-dogfood' dist/hooks/dispatch.js` | `2` (control: `session-register` → `5`) |
| the flag is on in this checkout | `grep -n learn_on_session_end .agent-settings.yml` | `learn_on_session_end: true` |

The consent layer also grants rather than withholds: `.agent-settings.yml` is a
hand-edited file with no provenance sidecar (`ls .agent-settings.provenance*` →
no matches), which is exactly the case `consentVerdict` admits.

**Readings are not being stranded in worktrees either.** The obvious hypothesis
— that work happens in ephemeral worktrees, so each session's line lands in a
tree that is later deleted — is false here:

```bash
$ find .claude/worktrees -maxdepth 4 -name 'learning-dogfood.jsonl' | wc -l
0
$ ls .claude/worktrees | wc -l
116
# control, same command against a path known to hold the file:
$ find agents/runtime/state -maxdepth 2 -name 'learning-dogfood.jsonl'
agents/runtime/state/learning-dogfood.jsonl
```

Zero ledgers across 116 worktrees, from a command proven to find the file when
it is there. So the lines are not being written and discarded; they are not
being written.

**What this does and does not establish.** It establishes that the window is on
course to close with far fewer than 20 readings, and that no missing wiring
explains it. It does not establish why no session end has reached the concern —
that is a question about how sessions in this checkout actually terminate, and
nothing in the tree answers it. Whoever opens this page on 2026-10-31 should
expect to read a ledger near 2, and should treat *that* as the finding rather
than as a threshold failure: a window that recorded nothing has not shown a
`preferred` count to be trivial, it has shown the window did not run.

## Fifth reading — 2026-10-06

Taken five days into the thirty, at `2026-10-06T02:23:32Z`. It exists because
the reading above ended on a falsifiable prediction and the prediction did not
hold. Every figure names the command that produced it; both inputs are
gitignored, so this page is their only durable record.

### The prediction that failed

The 2026-10-04 reading closed by telling its successor to "expect to read a
ledger near 2". It is not near 2.

`wc -l < agents/runtime/state/learning-dogfood.jsonl` -> **6**. The ledger has
tripled in two days, and the open question that reading ended on — why a session
end in this checkout does not reach a concern that is bound, bundled and
enabled — is now answered by measurement rather than by argument: **it does
reach it.** Four readings landed on 2026-10-05.

Per-day distribution, same file:

| Day | Readings |
|---|---|
| 2026-10-01 | 2 |
| 2026-10-02 to 2026-10-04 | 0 |
| 2026-10-05 | 4 |
| 2026-10-06, to 02:23 UTC | 0 |

The generator is **bursty and tracks maintainer sessions, not the calendar**.
That cuts both ways, which is why this reading declines to replace one
projection with another: the 2026-10-04 figure was a projection from a
three-day drought, and a projection from the 2026-10-05 burst would be the same
mistake pointing the other way. At the pooled rate (6 in 5 days) the window
clears 20 comfortably; at the 2026-10-02 to 2026-10-04 rate (0 in 3 days) it
does not. **The line count on the wake date is undetermined, and five days is
not enough to determine it.** What is settled is narrower and still worth
having: a reading near 2 on 2026-10-31 is no longer the expected case.

### The two thresholds are not symmetric

**`session-end p95 < 2 s`.** Sorted `wall_ms` over the six lines is
`[0, 0, 1, 1, 1, 3]`; nearest-rank p95 = **3 ms**, max 3 ms, against a 2000 ms
budget. Three orders of magnitude of headroom at n = 6 — underpowered, and
pointing hard in one direction.

**`non-trivial preferred count`.** **0 on every line of the ledger**, and the
reason is structural rather than statistical:

- `signals_in` reads `3` on every line since the window opened, and
  `stat -f '%Sm' agents/memory/intake/signals-2026-10.jsonl` ->
  **2026-10-01T12:40:09**. The intake has not been written to in five days: it
  still holds exactly the three signals seeded on day one.
- Those three carry `origin: claude`, which is **none** of the three producers'
  origin strings — `grep -rn -- '--origin' src/domains/` returns `bug-fix`,
  `do-and-judge` and `propose-memory`. The window's entire input arrived by
  hand, and the documented supply path in Supply above has emitted **nothing at
  all** in five days.
- The three sit on three distinct `path` values, so each forms its own group
  with a single origin. `MIN_CORROBORATIONS` is 2 **distinct** origins, so no
  combination of them can mint a lesson.

### Controlling the zero before reporting it

A zero from an aggregator nobody exercised is not a finding. Supply above argues
*from the source* that an empty `LESSONS.md` beside a non-empty intake is the
corroboration gate working; that argument is now executed, with a negative and a
positive arm over the **real** intake:

```
arm=A signals_in=3 distinct_origins=1 [claude]        lessons_out=0 preferred=0
arm=B signals_in=4 distinct_origins=2 [claude,cursor] lessons_out=1 preferred=1
   lesson: historical-patterns @ src/scripts/learning_sidecar.ts verdict=preferred corroborations=2
```

Arm A is the maintainer intake unmodified. Arm B is those same three signals
plus one line repeating the third signal's claim verbatim under a second origin.
**Arm B is the control that matters:** it shows that the specific event this
window waits for — a `preferred` lesson reaching `lessons_out` — does land once
its precondition is met, so arm A's zero is a statement about the data and not
about a broken instrument. A control showing merely that the ledger gets written
at all would not have established that.

Reproduce: import `readSignals` and `buildSidecarFromSignals` from
`src/scripts/learning_sidecar.ts`, run them over two intake directories at a
fixed `now`, and print `lessons_out` and the `preferred` count. The probe writes
nothing into the tree.

### What this means for the wake date

The likely 2026-10-31 reading is **p95 passes, `preferred` reads 0** — and the
second figure will not mean what the threshold was written to test. A
`preferred` count of 0 reads naturally as *the learning produced nothing worth
keeping*. Here it would record that nobody invoked `/bug:fix`, `/judge:on-diff`
or `/memory:propose` for thirty days. On that axis the window measures
**invocation frequency**, which What this window cannot answer already says of
`signals_in`; this reading extends the same caution to `preferred`, where it
matters more, because `preferred` is the figure the council's condition actually
gates on.

Put as a question for whoever holds the decision, never as a proposal: **is a
`preferred` count drawn from an intake with one hand-seeded origin the
measurement the condition of 2026-07-27 intended?** Both thresholds are the
council's and neither is this page's to move — Owner-reserved below is
unchanged. What this reading adds is that one of them is on course to return a
number whose plain reading would be wrong.

### Unchanged

The elapsed-time block is untouched: `date -u +%Y-%m-%d` -> `2026-10-06`, five
days of thirty, so step 2.3's condition stays **live-unmet**. No reading taken
inside one run can change that.

## What this window cannot answer

- **One machine is not a corpus.** p95 and counts here describe one person's
  sessions on one checkout. A number from this window is evidence that the
  mechanism records what it claims to record; it is weak evidence about anyone
  else's session shape.
- **`signals_in` measures invocation, not value.** With emission confined to
  three commands, a low count says those commands were not run.
- **"non-trivial" is undefined here on purpose.** Quantifying it would be
  deciding the thing the council reserved.

## Owner-reserved

Proposing the default flip (roadmap step 2.3) amends a recorded council
decision and stays deferred until the window has 30 days and both thresholds
hold. Nothing in this page, and nothing in the ledger, flips anything by
itself.

## Closing condition

On or after **2026-10-31**, with ≥ 20 lines in the ledger: state in this page
the p95 of `wall_ms`, the `preferred` count from
`agent-config memory:learn --format status`, and the command each figure came
from. Then — and only then — step 2.3 becomes decidable.
