# Pre-registration — code-graph vs grep, in-repo corpus **v2**

Registered 2026-08-29, **BEFORE the first v2 run**. Sibling of
`PREREGISTRATION-inrepo-2026-08-28.md`, never an edit of it. The v1 document,
its corpus, its runner and its report stay exactly where they are; nothing here
re-scores them.

This is a **new confirmatory experiment**, which is what AI council 2026-08-28
required of any v2 ("a NEW confirmatory experiment, never a repaired
continuation"). It exists because three defects in v1's **scorer** were
confirmed by direct execution on 2026-08-29.

## The v1 defects — what was measured, and what was published about it

**Defect 1 — the `path-between` class discarded correct answers.** v1's graph
arm kept a returned relation only if some endpoint's symbol segment matched the
probe. For this class the probe was a two-endpoint string, `"cmdBuild ->
getParser"`. No symbol contains that string, so every relation was dropped and
the class scored 0/0. Reproduced directly:

```
$ code_graph/cli.ts affected "cmdBuild -> getParser" --graph <code_graph>
seeds: cmdBuild, getParser
  EXTRACTED cli.ts#cmdBuild        --calls--> build.ts#buildFromRepo
  EXTRACTED build.ts#buildFromRepo --calls--> extract.ts#extractFile
  EXTRACTED extract.ts#extractFile --calls--> loader.ts#getParser
  …
```

All four truth files are in that output. The engine answered; the scorer threw
the answer away.

**This makes v1's published root cause false, and it is corrected in the same
change as this registration.** v1 reported the class `VOID — INSTRUMENT FAILURE`
with the note *"Both arms returned the empty set on every question in this
class"*. The grep arm did — a word-boundary search for a token containing ` -> `
matches nothing. The graph arm did not. The class was never symmetric, and
calling it symmetric attributed to the engine a silence that belonged to the
scorer. That sentence appeared on five surfaces; all five are corrected.

**Defect 2 — v1 never invoked the shipped `path` verb.** `cli.ts` dispatches
`path <a> <b>` and implements it; v1's graph arm ran `affected` and `query`
only. The class asking "is there a path from A to B, and through what?" was
measured with the two verbs that do not answer it. With the verb:

```
$ code_graph/cli.ts path cmdBuild getParser --graph <code_graph>
  EXTRACTED cli.ts#cmdBuild        --calls--> build.ts#buildFromRepo
  EXTRACTED build.ts#buildFromRepo --calls--> extract.ts#extractFile
  EXTRACTED extract.ts#extractFile --calls--> loader.ts#getParser
```

**Defect 3 — `symbol:` pseudo-nodes were counted as files.** An unresolved call
target renders as `symbol:DatabaseSync`; v1 applied `p.split('#')[0]` to it,
got the whole token back, and added it to a set the scorer treats as files. The
`code_graph` root alone carries 152 such endpoints. Every class holding one was
precision-deflated. `callers` was ruled `NULL` on the **precision floor alone**,
with recall tied at 1.000/1.000 — so that verdict is harness-caused as well.

**A fourth, not a scorer defect but silent.** v1's `run()` returned a `status`
neither arm read, so a crashed probe was indistinguishable from an honest empty
answer. v2 aborts the run on any non-zero status (`git grep`'s exit 1, which
means "no match", is an answer and is not a failure).

## What is NOT retro-edited

**v1's arithmetic was faithful to v1's own pre-registration**, which defines arm
B as `affected` + `query` and gives both arms the same single probe token. Its
numbers stand. What is corrected on v1's surfaces is the **explanation** — a
factual claim about which arm returned what — never a score.

## NOT COMPARABLE — stated before any v2 number exists

```
NO DELTA MAY BE COMPUTED BETWEEN V2 AND V1, OR BETWEEN V2 AND THE 2026-07-28 RUN.
THREE VARIABLES MOVE AT ONCE AGAINST V1: CORPUS, ARM-B VERB SET, SCORER.
A SUBTRACTION IN EITHER DIRECTION IS A FABRICATED RESULT.
```

Against **v1**: 19 questions vs 16 (three added, one class re-probed with two
endpoints, four items moved to a class of their own, one `references` probe
replaced by the corpus author); arm B gains the `path` verb for one class; the
scorer drops `symbol:` pseudo-nodes and matches per probe token. Against the
**2026-07-28** run: different corpus, different question set, pre-repair build,
single-aggregate bar.

## Blindness — declared, because it is partial

**`path-between` is CONFIRMATORY, not blind.** The `path` verb's behaviour on
all three of these questions was observed on 2026-08-29 while diagnosing why v1
scored the class 0/0 — before this document existed. Saying otherwise would be
the failure this registration exists to prevent. What protects the class is
stated instead of claimed:

- **The bars are v1's, unchanged** (+10 pp recall delta, 5 pp precision floor).
  A bar re-chosen after a defect is diagnosed is a bar chosen to fit a number.
- **The truth sets are the corpus author's, unchanged** — taken verbatim from
  `inrepo-corpus-v2-SEED-NOT-REGISTERED.yaml`, written by a party who was not
  running the benchmark and before this diagnosis.
- **The grep arm is given more, not less** — the union of two word-boundary
  searches instead of one, so a graph result here cannot be attributed to
  withholding an endpoint from the other arm.

**The three in-domain negative controls ARE blind.** Their probes were verified
absent from their roots with a word-boundary text search at construction time;
the graph arm was **not** run on any of them before this registration.

The other three graph-shaped classes are re-measurements under a corrected
scorer. v1's recall figures for them are known; their precision under defect-3
removal is not.

## The seed contradicted the stub — resolved here, explicitly

`road-to-code-graph-benchmark-v2-registration.md` requires "a v2 runner change
so the `path-between` class uses the engine's own `path <a> <b>` verb, with a
fair two-probe equivalent for the grep arm." The seed corpus it names mandates
the opposite: *"the probe is ALWAYS THE START SYMBOL"*, a single token, and its
own Limits section concedes that a scorer should then read the class as "what
does a search from A surface" rather than "can the tool answer a path query".
`path <a> <b>` cannot consume a one-token probe. The two cannot both hold.

**Resolved in favour of the stub, and the seed's rule is superseded rather than
overruled on taste.** The single-token rule was a workaround for v1's runner,
which passes one probe per question; it is not a property of the question. v2
ships a new runner, so the constraint that produced the rule does not exist.
The v2 corpus therefore carries **two structured fields** for this class —
`probe` (start) and `probe_to` (goal) — applied to all three questions
identically and derived mechanically from the two endpoints each `question`
already names.

**The seed's truth sets are kept, including the narrowing it introduced.** The
seed demotes `orchestrator.ts` from `ac-path-01`'s truth to a distractor: it
calls the start symbol but lies upstream of the path, and the question asks what
lies *between* the endpoints. That is the correct reading for a real path query
and it is the **stricter** one — a two-file truth makes any extra answer cost
more precision than a three-file truth would. The narrowing is kept for that
reason, not despite it.

## Corpus roots — unchanged from v1

| Root | Path |
|---|---|
| `code_graph` | `src/scripts/code_graph` |
| `shared` | `src/shared` |
| `ai_council` | `src/scripts/ai_council` |

## Questions — bound by content hash

19 questions in `internal/bench/code-graph/inrepo-corpus-v2-2026-08-29.yaml`,
tracked and bound here by SHA-256. Any post-registration edit changes the hash
and voids the run:

```
719885107aae85f1031314b822ee5d8e1dfc4e0d1d784a644b6a98862307f00b  inrepo-corpus-v2-2026-08-29.yaml
```

| Category | Count | Shape | Scored as |
|---|---|---|---|
| `callers` | 3 | which files call/reach symbol X | precision + recall, per-class bar |
| `transitive-impact` | 3 | which files are affected if X changes | precision + recall, per-class bar |
| `path-between` | 3 | is there a call path from A to B, and through what | precision + recall, per-class bar |
| `references` | 3 | where is X referenced / imported / declared | precision + recall, per-class bar |
| `negative-control-in-domain` | 3 | symbol-shaped probe naming nothing; correct answer empty | **clean-rate**, no bar |
| `capability-boundary` | 4 | literal string, filename, config key, env var | **reported only**, no bar |

## Separating the two things v1 conflated

This is the council's own v2 requirement, implemented:

1. **In-domain negative controls** — symbol-shaped probes whose correct answer
   is the empty set. Each is a plausible near-miss of a real symbol in the same
   root (`extractFileCached` beside `extractFile`, `planSettingsGate` beside
   `planSettingsAsks`, `evaluateQuorumWeights` beside `evaluateQuorum`), so the
   class is adversarial to a lexical-fallback seed resolver in a way a text
   search cannot fail. **An arm passes an item iff it returns the empty set.**
   Recall is undefined over an empty truth set, and v1's convention of scoring
   it 1.0 would hand every arm a free pass, so recall is not computed for them
   and they are excluded from the macro average.
2. **Capability-boundary tests** — the four literal probes v1 called negative
   controls. **Reported separately, with no floor derived from them.** v1 folded
   them into a recall floor a symbol index cannot clear by construction and then
   reported that floor FAILED; the council's guidance is explicit: *"Do not make
   an unsupported symbol index clear a literal-search recall floor."*

## Arms

- **Arm A (grep):** `git grep --line-number` over the root's tracked files.
  `symbol` → `-P '\b<probe>\b'`; `literal` → `-F`. Answer = files with ≥ 1 hit,
  **unioned over every probe the question carries** (two for `path-between`,
  one otherwise). No graph access. Exit 1 = no match, an answer; exit > 1 aborts
  the run.
- **Arm B (code graph):** `code_graph/cli.ts build --root <root>` once per root,
  then per question, by class and mechanically:
  - `path-between` → `path <probe> <probe_to>`. The verb returns the path
    itself, so **every returned relation is the answer** and no relevance filter
    is applied. Filtering here is v1's defect 1: an intermediate hop matches
    neither endpoint by construction, and the intermediates are exactly what
    "and through what?" asks for.
  - every other class → `affected <probe>` + `query <probe>`, as in v1, with the
    relevance filter applied **per probe token** rather than against the whole
    probe string.
  - In both cases an endpoint contributes a file only when its pre-`#` segment
    carries a file extension and is not a `symbol:` placeholder.
  No grep access. Any non-zero exit aborts the run.

## Metrics

Recall, precision, missed/wrong file lists, wall time per question and arm,
build time separately, output bytes as a context-cost proxy. In-domain negative
controls carry a clean-rate instead of recall.

## Pass bars — PER CLASS, identical to v1

For each of the four graph-shaped classes independently:

> **The graph WINS that class** iff mean recall(B) − mean recall(A) ≥ **+10
> percentage points** on that class, AND mean precision(B) ≥ mean precision(A) −
> **5 pp** on that class.

Verdicts are `WIN`, `NULL`, or `TIE`. The macro average is **reported and is not
a pass criterion**. There is no cross-class floor: the two non-bar classes above
replace v1's negative-control floor, for the reason the council gave.

The `VOID — NOTHING MEASURED` check is carried over: a class where every metric
is zero for both arms is flagged, and its note now says only what the runner can
see. A shared zero is not evidence that both arms failed for the same reason —
in v1 it was not.

## Publication policy

- The report lands at
  `internal/bench/reports/code-graph-vs-grep-inrepo-v2-2026-08-29.{md,json}`,
  **without touching** either earlier report's figures.
- The result is published **whichever way it lands**. A null is a complete
  success of this registration.
- **No new `docs/CLAIMS.md` entry**, for v1's reason, unchanged: the `kind` enum
  is `{quant, qual, comparative}` and none of the three makes two recall figures
  incomparable by construction, so a second entry would put subtractable numbers
  on the published surface. The existing `claim:code-graph-retrieval-null` gains
  a pointer.

## What this run may and may not change

It may change **routing** — which classes the code-intelligence skill and the
`external-code-graph-interop` rule name as graph-first. It may **not** change
permission: no setting default moves, and no dependency moves between
`devDependencies` and `dependencies`. That is ADR-246's question. If this run
produces a winning class, ADR-246's reopen trigger is **evaluated and recorded**
— and no reopen is performed by the change that produces the measurement.

## Runner

`internal/bench/code-graph/run_bench_inrepo_v2.ts` — committed alongside this
document; verifies the corpus SHA-256 against the value above and refuses on
mismatch.
