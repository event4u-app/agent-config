# scale-history bench — is the harness runnable? (measured 2026-08-20)

<!-- evidence-type: analysis -->

**Question.** Before transferring the human-rating half of
`road-to-scale-history-bench-run.md` out to a stub, establish which half of
Phase 1 is instrument-building (agent-closable) and which half is not. A
transfer that hides an unbuilt instrument behind "we need a human" would be the
wrong disposition.

**Answer.** The instrument is complete and runs end-to-end. The gap is the human
PRIMARY rater and nothing else. Every line below is command output observed in
this worktree at `d6cc42e63`, not inference.

## 1 — The runner completes all six cells in dry mode

```
$ ./node_modules/.bin/tsx internal/bench/scale-history/run.ts --dry --all --n 1
✅  anthropic-A-01 · rounds 1 · 2 files · secondary gate defects 2 · 0s · n/a
✅  anthropic-B-01 · rounds 2 · 2 files · secondary gate defects 2 · 0s · n/a
✅  anthropic-C-01 · rounds 2 · 2 files · secondary gate defects 2 · 0s · n/a
✅  openai-A-01 · rounds 1 · 2 files · secondary gate defects 2 · 0s · n/a
✅  openai-B-01 · rounds 2 · 2 files · secondary gate defects 2 · 0s · n/a
✅  openai-C-01 · rounds 2 · 2 files · secondary gate defects 2 · 0s · n/a

📦  6 run(s) this invocation · manifest internal/bench/scale-history/artifacts/manifest.json
📋  rate blind first: internal/bench/scale-history/artifacts/rating-workbook.md
```

Exit code 0. Both families, all three arms, the arm-C fix-or-waive loop
(`rounds 2`), the manifest and the rating workbook all materialise.

## 2 — The rating workbook is a real blind instrument

Generated in step 1 and read directly. It carries:

- opaque `art-NNN` ids in a seeded-shuffle order, with **blind copies** of the
  delivered code whose paths carry no arm, family or replicate label;
- the full rubric reproduced inline, so the rater never opens another file;
- an explicit instruction not to open `manifest.json`, any `run.json`, or
  `score.ts` output before rating, citing `rubric.md:4`;
- the arm mapping written to a **separate** `rating-key.md` headed
  *"Blind key — do NOT open before rating is complete"*.

## 3 — The anti-anchor ordering is enforced, not merely documented

Probe: move the workbook aside, then ask for the secondary pass.

```
$ mv internal/bench/scale-history/artifacts/rating-workbook.md /tmp/wb2.md
$ ./node_modules/.bin/tsx internal/bench/scale-history/run.ts --score ; echo "exit=$?"
❌  refused: no rating-workbook.md — the manual rubric is PRIMARY and runs first
exit=2
```

Source: `internal/bench/scale-history/run.ts:907-913`. The tooling cannot
itself break the pre-registered ordering — a real property, since the ordering
violation is irreversible once a rater has seen a linter count.

## 4 — The cost sheet renders and refuses to fabricate

```
$ ./node_modules/.bin/tsx internal/bench/scale-history/run.ts --estimate --n 16
N per arm per family        : 16 (registered)
Cells (family × arm × N)    : 96
Max model invocations       : 224  (arm A 1 round, B ≤2, C ≤4)

No live run recorded yet, so no USD projection is printed. […]
A list-price multiplication would be a fabricated number in a cost sheet,
which is worse than an absent one.
```

The registered shape is exactly what the pre-registration fixes
(`internal/bench/corpora/scale-history-PREREG.md:57-59`). The absent USD figure
is a property of **this tree**, not of the harness: the artifact root is
gitignored (`.gitignore:314`), so the 2026-08-14 live smoke runs recorded in
the roadmap's spend blocker left no local record here to anchor a projection on.
The roadmap's own measured sheet — $22–50 and ~4.6 h for 224 invocations —
stands as the figure of record.

## 5 — What is NOT present

`internal/bench/scale-history/artifacts/` did not exist before the dry run and
was removed after it. There is no live sweep, no rated workbook and no
`score.ts` output in this tree. So:

| Half of Phase 1 | State | Closable by an agent? |
|---|---|---|
| Producing the artifacts | instrument finished, sweep not fired | Yes — paid, and needs its own this-turn approval |
| Rating them blind (PRIMARY) | not started, cannot start | **No** — see below |
| The Step-2 verdict | blocked on the rating | No |

## 6 — Why the rating half is not merely undone

The pre-registration makes the manual rubric the PRIMARY defect count and
`lint_persistence` SECONDARY (`scale-history-PREREG.md:63-69`). An agent
rating artifacts an agent produced is the self-preference substitution
`evaluator-independence` forbids; the number it produced would be uncitable
rather than merely weak.

**And this run is itself the demonstration.** Running `--dry` put six blind
artifacts and their sealed key in front of me. Producing rubric numbers from
them was mechanically available and would have been worthless — I had just
generated the arms. That the ratings are *producible* is evidence the
instrument works, never evidence the blocker cleared.

The primary rating is therefore **unmade, not negative**. No result is being
suppressed; none exists.
