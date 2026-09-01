<!-- evidence-type: analysis -->

# Drain 14 — Phase 2 metered-capture readiness

Reconnaissance for `road-to-governed-evidence-production` Phase 2 (steps 2.1,
2.2) and AC-2 / AC-3 / AC-4. Measured on branch `drain/governed-evidence-phase2`
@ `b50b27281`, 2026-09-01.

**Zero metered calls were made by this session.** `--confirm` was never passed;
no request reached `https://api.anthropic.com`. Every figure below comes from
the dry path, from stub generators, or from reading the tree.

**Nothing in the protocol was frozen by this session either.** The UNSET slot at
`docs/contracts/metered-proposer-protocol.md:239` is reported on, with options
and evidence, and is left UNSET. Freezing it is a council decision.

## 1. The observations document — does not exist, and cannot be committed

`llm_propose --observations FILE` (`src/scripts/llm_propose.ts:82`) and
`evolution_lab propose --observations FILE`
(`src/scripts/evolution_lab.ts:401`) consume the same document through the same
parser pair: `parseObservationDocument`
(`src/scripts/evolution_lab.ts:279`) then `parseObservations`
(`src/scripts/_lib/candidate_proposer.ts:232`).

**No such document exists anywhere in the tree.** `git ls-files` matches no
`observ*` JSON, and no script generates one. The protocol does not ship a
document; it ships an enumeration RULE
(`docs/contracts/metered-proposer-protocol.md:181-197`):

1. every `*.md` **directly under** `.claude/rules/` at the run's commit;
2. sorted byte-wise by filename;
3. first `max_candidates` = **5** (`src/config/harness-evolution-budget.json`,
   `budget.max_candidates`);
4. class per file: `over-broad-activation` when the file contains a line
   beginning `## `, otherwise `unbacked-enforcement-claim`.

### FINDING 1a (F-A) — the corpus is not reproducible from the COMMIT ALONE

`.claude/` is **gitignored in its entirety** (`.gitignore:157` pins
`/.claude/rules/`), and `git ls-files .claude` returns 0 files. A fresh worktree
of this branch has no `.claude/rules/` directory at all; this session had to run
`./scripts-run src/scripts/condense --generate-tools` (the `task generate-tools`
body, `taskfiles/content.yml:50`) to materialise it.

The protocol already names the commit pin as load-bearing
(`metered-proposer-protocol.md:199-202`). The measurement here is that the
commit pin is **not sufficient**, for two separate reasons:

- **The generator skips rules already installed at user scope.** The
  `--generate-tools` run in this worktree printed
  `ℹ️  .claude/rules: 101 rule(s) skipped — byte-identical twin already
  installed at user scope`. `~/.claude/rules/` holds 104 `.md` files on this
  machine. The projected set is therefore a function of the operator's
  user-global install, not of the commit.
- **A stale projection differs from a fresh one.** The main checkout at the same
  HEAD (`b50b27281`) carries 15 `.md` under `.claude/rules/` with mtimes of
  `Jul 5 2026`; the freshly generated worktree projection carries 13. The two
  extra files (`package-ci-checks.md`, `size-enforcement.md`) exist in
  `src/rules/` and are absent from both the fresh projection and the user-global
  layer, so the stale copy is the outlier — but a runner who does not regenerate
  would silently capture a different corpus.

**Consequence for the capture.** The observations document must be produced by a
recorded procedure that pins BOTH the commit AND the projection state, or the
comparison is not re-runnable. Nothing in the tree does this today.

**DOWNGRADED 2026-09-01 by the council, and the narrowing is load-bearing.** An
earlier framing of this finding said the run produces *"a number nobody can
reproduce"*. That is overreach and is withdrawn. What is Confirmed is narrower:
the run is not reproducible **from the commit alone**. It is NOT established that
reproduction is impossible from a captured manifest plus an environment
snapshot — nobody has tried, and the council declined to grade an untried
mechanism as impossible. Fixing this is owner-reserved by default (corpus
contract), so no manifest was pinned this run.

### The document this session produced (from the stated rule, fresh projection)

Written to `/tmp/dr14/observations.json` — deliberately **not** committed, since
it is derived from a gitignored projection and committing it would freeze one
machine's user-global state into the tree.

| # | subject | defect class |
|---|---|---|
| 1 | `.claude/rules/augment-edit-discipline.md` | `unbacked-enforcement-claim` |
| 2 | `.claude/rules/domain-adoption-policy.md` | `over-broad-activation` |
| 3 | `.claude/rules/framework-neutrality-in-generic-skills.md` | `over-broad-activation` |
| 4 | `.claude/rules/low-impact-corpus-privacy-floor.md` | `over-broad-activation` |
| 5 | `.claude/rules/no-roadmap-references.md` | `over-broad-activation` |

**5 `DefectObservation`s**, matching `max_candidates` exactly, so
`assertWithinBudget` (`src/scripts/_lib/harness_evolution_guards.ts:140`) admits
it and one more would abort. Subjects are inside the candidate surface
(`CANDIDATE_OWNED_PATHS`, `src/scripts/_lib/candidate_record.ts:262`, tested by
`isCandidateOwnedPath` at `:271`) because
`.claude` is an owned head.

**It can be produced without spending.** Generating `.claude/` touches only
gitignored paths (`.claude`, `.cursor`, `.clinerules`, `.windsurfrules`,
`GEMINI.md` are all untracked — `git ls-files` returns 0 for each), and
`git status` stayed clean through the whole run.

## 2. The dry path, end to end

`./scripts-run src/scripts/llm_propose --observations /tmp/dr14/observations.json --out /tmp/dr14/metered`
— exit 0, nothing sent.

```
disclosure: obs[0] field=defectClass class=proposer-visible
disclosure: obs[0] field=subject class=proposer-visible
… (one pair per observation, 10 lines: GUARD 0.4)
llm_propose: DRY RUN — nothing sent, nothing spent.
llm_propose: tier lite -> claude-haiku-4-5-20251001
llm_propose: tier medium -> claude-sonnet-4-5-20250929
llm_propose: tier high -> UNPINNED (refused until a dated id is pinned)
llm_propose: planned attempt 1 · class=reason_unknown · tier=lite
llm_propose: planned attempt 2 · class=reason_unknown · tier=lite
llm_propose: planned attempt 3 · class=reason_unknown · tier=lite
llm_propose: planned attempt 4 · class=reason_unknown · tier=lite
llm_propose: planned attempt 5 · class=reason_unknown · tier=lite
llm_propose: request body for .claude/rules/augment-edit-discipline.md:
{
  "model": "claude-haiku-4-5-20251001",
  "max_tokens": 8192,
  "temperature": 0,
  "system": "You rewrite one Markdown artifact to remove one named defect.\nReturn ONLY the complete rewritten artifact body. No preamble, no fences,\nno commentary, no explanation of what you changed.\nDo not judge, score, rank, or compare anything. Produce one body.",
  "messages": [
    {
      "role": "user",
      "content": "Defect class: unbacked-enforcement-claim\nWhat that means: the artefact reads as enforced while nothing can observe a violation\nArtifact path: .claude/rules/augment-edit-discipline.md\n\n--- BEGIN CURRENT BODY ---\n…\n--- END CURRENT BODY ---\n"
    }
  ]
}
llm_propose: ~275 input tokens for this one call (ESTIMATE: characters over four, not a tokenizer; …)
llm_propose: re-run with --confirm to spend.
```

The pinned models match `TIER_MODEL`
(`src/scripts/_lib/llm_proposer_transport.ts:57-61`) and the protocol table
verbatim. `high` refuses rather than resolving, as specified.

### Cost of the whole capture

Computed with the arm's own `buildPrompt` + `describeRequest` + `estimateTokens`
over all five observations (no request sent), priced from the repository's own
committed table — `claude-haiku-4-5` at $1.00/MTok in, $5.00/MTok out,
`src/scripts/ai_council/_default_prices.ts:29`, `LAST_UPDATED = '2026-05-14'`
(`:16`).

| subject | class | input tok | body tok |
|---|---|---|---|
| `.claude/rules/domain-adoption-policy.md` | `over-broad-activation` | 666 | 521 |
| `.claude/rules/framework-neutrality-in-generic-skills.md` | `over-broad-activation` | 739 | 589 |
| `.claude/rules/low-impact-corpus-privacy-floor.md` | `over-broad-activation` | 756 | 603 |
| `.claude/rules/no-roadmap-references.md` | `over-broad-activation` | 798 | 650 |
| `.claude/rules/augment-edit-discipline.md` | `unbacked-enforcement-claim` | 275 | 141 |
| **total** | | **3,234** | **2,504** |

**The arithmetic, shown rather than asserted** (the council graded the figures
`inferred` when neither the table location nor the sum was given). Price source:
`src/scripts/ai_council/_default_prices.ts:29`, the row
`['anthropic', 'claude-haiku-4-5', 1.0, 5.0]` — dollars per million tokens, input
then output, `LAST_UPDATED = '2026-05-14'` (`:16`). Token counts are the arm's own
`estimateTokens` (`_lib/llm_proposer_transport.ts:109-111`), which is
`Math.ceil(text.length / 4)` — a character proxy, not a tokenizer.

```
likely = 3234/1e6 * 1.00  +  2504/1e6 * 5.00
       = 0.003234         +  0.012520          = $0.015754  -> $0.0158
worst  = 3234/1e6 * 1.00  +  40960/1e6 * 5.00
       = 0.003234         +  0.204800          = $0.208034  -> $0.2080
where 40960 = 5 calls x MAX_TOKENS 8192 (_lib/llm_proposer_transport.ts:64)
```

- **Likely cost: $0.0158** — 3,234 in + 2,504 out (a full-body rewrite per call).
- **Absolute worst case: $0.2080** — 3,234 in + 5 × `MAX_TOKENS` (8192) out
  (`llm_proposer_transport.ts:64`). Unreachable in practice; the subject bodies
  are 141–650 tokens.
- Budget ceiling `max_spend_cents: 500` = **$5.00**. The capture uses **0.3 %**
  of it at the likely figure and **4.2 %** at the worst case.

Token counts are the arm's own `characters / 4` estimator
(`llm_proposer_transport.ts:109-111`), not a tokenizer; treat them as ±25 %.
Even a 4× miss stays two orders of magnitude under the ceiling.

Retries would add cost only on a contract refusal, and `reason_unknown`'s ladder
is exactly `['lite']` (`src/scripts/_lib/evolution_roi.ts:121`) — so an
unclassified refusal STOPS rather than escalating. The only class licensing
`high` is `execution_failed` (`evolution_roi.ts:111`), and `high` is unpinned and
throws, so a transport error terminates the observation rather than spending
more.

### The deterministic control arm, over the same document

`./scripts-run src/scripts/evolution_lab propose --observations /tmp/dr14/observations.json --out /tmp/dr14/deterministic`
— exit 0, five records:

```
propose: wrote /tmp/dr14/deterministic/act-ca6e7ddb23f7.json
propose: wrote /tmp/dr14/deterministic/act-d2ac06be9cf2.json
propose: wrote /tmp/dr14/deterministic/act-58069c3c3910.json
propose: wrote /tmp/dr14/deterministic/act-628dda0a3784.json
propose: wrote /tmp/dr14/deterministic/con-bb51c1cce67f.json
propose: 5 candidate(s)
```

### Drop-in comparability — OBSERVED under a stub in this run, with a caveat

Both arms write through the same two functions: `candidateRecordFilename` and
`serialiseCandidateRecord` (`candidate_proposer.ts:400`, `:395`), called from
`llm_propose.ts:220-221` and `evolution_lab.ts:688-698`. Both order the input
with the same comparator (`byteCompare`, `candidate_proposer.ts:290`) at
`candidate_proposer.ts:365-367` and `llm_candidate_proposer.ts:375-377`. Both
build the id with the same `candidateId` and take `dimension` from `RECIPES`,
never from the model (`llm_candidate_proposer.ts:328-337`).

**The command, so the word is not doing the work.** A throwaway probe under
`node_modules/.bin/tsx` imports both arms, parses `/tmp/dr14/observations.json`
through `parseObservations`, and calls `proposeCandidatesWithModel` with two
stub generators — one echoing `RECIPES[cls].rewrite(read(subject), '')`, one
appending a marker comment — then compares `serialiseCandidateRecord` output
against `proposeCandidates` over the same input. Nothing is sent.

Output of that run, verbatim:

```
deterministic records: 5 | metered records: 5
filenames det : act-ca6e7ddb23f7.json act-d2ac06be9cf2.json act-58069c3c3910.json act-628dda0a3784.json con-bb51c1cce67f.json
filenames met : act-ca6e7ddb23f7.json act-d2ac06be9cf2.json act-58069c3c3910.json act-628dda0a3784.json con-bb51c1cce67f.json
record ORDER identical: true
BYTES identical (echo stub): true
attempts: [{"defect_class":"reason_unknown","tier":"lite","sequence":1}, … x5]

filenames met2: act-d4fee76891a6.json act-c9218ab7ebcd.json act-f9cddb25cf5e.json act-6fc3387e0019.json con-b4f67d4cc2b6.json
same key set as det: true
dimensions from RECIPE: true
all lifecycle proposed: true
one record per observation: true
```

Digests, `sha256`: probe output
`9c23e72965e5f25726bf0e579c000ceb769eb712257cbe761c0a1adde5714d79`; observations
document `4079965fbc97f167434cb37fec1d774100d6de437fcf8e9e6f9fb7b5052dbbe3`;
concatenated deterministic records
`5c1babdb2c28ba882e6f79d161862852fb59635bf203fe35a6fed1de0b41fef3`.

**What the digests do and do not pin — the honest limit.** They pin THIS run's
artefacts. Neither the probe nor the observations document is committed, and the
observations document is derived from a gitignored projection, so the digest
inherits F-A: another machine can re-run the same procedure and get a different
observations document, hence different digests. The word in the heading is
therefore **observed**, not **proven**. What is genuinely established is a code
property, independent of the corpus: both arms call the same
`candidateRecordFilename`, `serialiseCandidateRecord`, `byteCompare` and
`candidateId`, at the line numbers cited above.

Observed by running the metered arm against a **stub** generator (zero spend):

- with a stub returning exactly the deterministic recipe's output, the two arms
  produce **byte-identical** record files with **identical filenames in
  identical order** — 5 records each;
- with a stub returning different text, the record key set, dimensions,
  `lifecycle: 'proposed'` and the one-record-per-observation invariant all hold,
  and the filenames diverge.

**CAVEAT — do not pair by filename.** `candidateId`
(`candidate_proposer.ts:322-337`) hashes the mutation CONTENT, so two arms that
produce different text produce different ids and therefore different filenames.
The pairing key for the comparison is `(defectClass, mutations[0].path)`, which
is stable across arms. A runner that zips the two `--out` directories by sorted
filename will mis-pair.

## 3. The UNSET slot — what `decidePairedVerdict` actually consumes

`docs/contracts/metered-proposer-protocol.md:237-258` leaves the **paired
outcome metric and its aggregation** UNSET, owned by the executing session,
citing `ARTIFACT_COUNT_METRIC` (`_lib/evaluation_vector.ts:62`) and
`promotionVerdict` as the committed constraints.

### The exact input type

```ts
export interface PairedInput {
    /** One signed delta per trial. Positive favours the treatment. */
    deltas: readonly number[];
    /** Deltas within this of zero are ties and are excluded as concordant. */
    tieEpsilon?: number;
    alpha?: number;
}
```
— `src/scripts/_lib/paired_verdict.ts:109-115`.

**A discordant pair** is a delta with `|d| > tieEpsilon`
(`paired_verdict.ts:130-132`): `wins = deltas.filter(d => d > eps).length`,
`losses = deltas.filter(d => d < -eps).length`, `discordant = wins + losses`.
`tieEpsilon` defaults to **0** (`:128`), so with an integer-valued metric only an
exact tie is concordant.

**Constants, verified at this commit:**

- `ALPHA = 0.05` — `paired_verdict.ts:51`.
- `MIN_DISCORDANT = 5` — `paired_verdict.ts:78`, derived by
  `deriveMinDiscordant` (`:72-76`) as the smallest `n` with `0.5**n <= ALPHA`.
  Confirmed by execution: `MIN_DISCORDANT = 5`.

**So the metric must be:** a function producing **one signed scalar per trial**,
sign-oriented so that positive favours the METERED arm (the treatment). The
aggregation is then NOT free — `decidePairedVerdict` fixes it as the one-sided
exact sign test over the discordant subset (`:156-183`). The two genuinely free
parameters are (a) **what the scalar measures**, and (b) **what one trial is**.

### FINDING 3a — the unit of a trial is the load-bearing half, and it is not stated

The protocol calls the slot "the paired outcome metric, and its aggregation" and
does not say whether one trial is one candidate PAIR or one (candidate, eval
item) pair. The arithmetic makes the two answers completely different verdicts.
Executed against the real module:

| deltas | kind | discordant | p | at_floor |
|---|---|---|---|---|
| 5 pairs, metered sweeps 5-0 | `pass` | 5 | 0.0313 | **true** |
| 5 pairs, 4-1 | `no-change` | 5 | 0.1875 | true |
| 5 pairs, one tie (4-0) | **`underpowered`** | 4 | 1.0000 | false |
| 5 pairs, 0-5 | `regression` | 5 | 0.0313 | true |
| 25 trials, 20-5 | `pass` | 25 | 0.0020 | false |

**If one trial = one candidate pair, the run is on a knife edge.** The corpus is
5 (a budget ceiling, not a choice) and `MIN_DISCORDANT` is 5 (a derivation, not
a choice). The two coincide. A single tie drops the run to `underpowered`; a
single dissent drops it to `no-change`; only a perfect 5-0 sweep can pass, in
either direction. `floorWarning` (`paired_verdict.ts:199`) fires on every
outcome and says so verbatim: *"Raise the trial count rather than the
expectation."* The protocol itself flags `at_floor` handling nowhere.

**The budget file already argues for the other reading.**
`src/config/harness-evolution-budget.json`,
`why_these_numbers.max_trials_per_candidate`: *"20 leaves room above that floor
for a corpus of 10 queries run in both orders (judge_hygiene.ts:5-9)"* — i.e. a
trial is a (candidate × query × order) unit, giving up to 5 × 20 = 100 deltas.
`src/scripts/_lib/judge_hygiene.ts:4-9` is the order-swap discipline that
citation points at.

Whoever freezes the slot must state the trial unit explicitly. It is not
derivable from the protocol as written.

### FINDING 3b — nothing in the tree computes a delta, for any metric

`decidePairedVerdict` has exactly **one** production caller in `src/`:
`directionVerdict` in `src/scripts/_lib/bench_ab_size_claim.ts:96-105`, on the
A/B bench path, unrelated to the evolution lab.

On the evolution-lab path, `MetricVector`s are **read off disk**, not computed:
`evolution_lab.ts:762-766` parses `--vector FILE` through
`parseMetricVectorJson` (`evolution_roi.ts:428`), which accepts a `PairedRow`
carrying an already-decided `PairedVerdict` (`evaluation_vector.ts:64-69`,
verdict kinds validated at `evolution_roi.ts:456`, `:489`). So the deltas — and
therefore the metric — are an **operator-supplied input** today. No code path
turns two candidate records into a delta.

This is a build gap AC-2 sits behind, and it is larger than the slot: freezing
the metric in writing does not by itself make a paired-verdict run possible.

### Candidate metrics — pre-existing vs. fresh judgement

**Available from pre-existing, committed material:**

| Candidate | Where it already exists | What it would measure | Fitness |
|---|---|---|---|
| ±1 direction vector | `bench_ab_size_claim.ts:96-105` — the only committed construction of `deltas`, reconstructing counts into `[1,…,-1,…]` with default `tieEpsilon` | the SHAPE of the delta vector, not its content | This is a **precedent for the encoding**, not a metric. It settles (b)-adjacent questions and none of (a). |
| `ARTIFACT_COUNT_METRIC` = `'artifact-count-delta'` | `evaluation_vector.ts:62` | signed change in artifact count | **Cannot be the paired metric.** `buildVector` requires it as a `CountedRow` (`:114-120`), and `promotionVerdict` blocks a vector whose only rows are counted (`:262-265`, `<no-paired-row>`). It is a mandatory companion row, not the outcome. |
| Skill trigger-eval pass rate | 100 committed `src/skills/*/evals/triggers.json`, e.g. `src/skills/code-intelligence/evals/triggers.json` (10 queries, 5 should-trigger / 5 should-not) | per-query routing correctness before vs. after the mutation | **Does not cover this corpus.** Zero rules carry a `triggers.json`; the frozen corpus is five `.claude/rules/*.md`. The parent roadmap's "First cut" named `code-intelligence`, but the frozen corpus rule (`metered-proposer-protocol.md:181-197`) enumerates rules instead. The two do not line up. |

**Fresh judgement calls — none of these has a constant in the tree:**

1. **What the scalar measures** for a rule artifact. Candidates a runner might
   reach for — token count, activation-precision on a hand-built query set,
   an LLM-judged quality score — are all uncommitted, and the third is
   **forbidden**: a metered call that supplies input to the verdict is the
   evaluator role the narrowing still bars
   (`road-to-governed-evidence-production.md:252-256`).
2. **The unit of a trial** (Finding 3a).
3. **`tieEpsilon`** — defaulted to 0 in code, never stated in the protocol.
4. **`direction`** for the paired row (`'higher-better' | 'lower-better'`,
   `evaluation_vector.ts:59`) and the metric's string name.
5. **`artifactDeltaCeiling`** (`evaluation_vector.ts:215`, defaulted to 0 at `:238`). Both
   recipes rewrite one existing file and add none, so 0 is satisfiable — but it
   is a caller choice nobody has recorded.

**Recommendation to the council (not a freeze):** the trial-unit question
(3a) should be answered before the metric-content question, because the
knife-edge at `n = 5` makes a per-pair metric arithmetically near-unpassable
regardless of what it measures, and because the budget file's own reasoning
already presumes the per-query unit.

### FINDING 3c — the protocol's HEAD-recording claim is false at this commit

`metered-proposer-protocol.md:199-202` states *"The run report records
`git rev-parse HEAD`"*. `RunReport` (`evolution_roi.ts:329-335`) carries
`run_id`, `candidates`, `trials_per_candidate`, `roi`, `ladder` — **no commit
field**. `run_id` is built from candidate ids (`evolution_lab.ts:866-871`), not
from HEAD. `grep -rn "rev-parse"` over `evolution_lab.ts`, `llm_propose.ts`,
`evolution_roi.ts` and `llm_candidate_proposer.ts` returns **nothing**. And
`llm_propose` writes no run report at all — `buildRunReport` is reached only from
`evolution_lab run` (`evolution_lab.ts:866`).

Given Finding 1a, this is the more serious half: the one field that would make a
capture re-runnable is claimed and absent.

### FINDING 3d — three line citations in the frozen protocol are off

Cosmetic, but the protocol is a frozen contract that cites by line:

| Protocol text | Cited | Actual |
|---|---|---|
| *"`high` is reachable only through an `execution_failed` escalation"* (`:85`) | `evolution_roi.ts:109` (`dependency_unavailable: []`) | `evolution_roi.ts:111` |
| *"escalating on a reason nobody established is spending on a guess"* (`:124`) | `evolution_roi.ts:117-119` | `evolution_roi.ts:119-121` |
| *"retrying `lite` is not an escalation"* (`:138`) | `evolution_roi.ts:203` (the empty-ladder error string) | `evolution_roi.ts:184-185` |

Verified correct: `ALPHA` `:51`, `MIN_DISCORDANT` `:78`, `decidePairedVerdict`
`:126`, `assertCheapestFirst` `evolution_roi.ts:191`, `ARTIFACT_COUNT_METRIC`
`evaluation_vector.ts:62`, `assertWithinBudget`
`harness_evolution_guards.ts:140`, `buildRunReport` `evolution_roi.ts:363`,
`candidate_proposer.ts:343-347`, the park at
`road-to-routing-assurance-live-floors.md:20-52`.

## 4. Guards — 76/76 green

`npx vitest run` over the four relevant files, on `b50b27281`:

| file | tests | result |
|---|---|---|
| `tests/scripts/proposer_survival_bar.test.ts` | 5 | pass |
| `tests/lib/paired_verdict.test.ts` | 17 | pass |
| `tests/scripts/_lib/evolution_roi.test.ts` | 28 | pass |
| `tests/scripts/llm_candidate_proposer.test.ts` | 26 | pass |
| **total** | **76** | **4 files passed, 0 failed** |

No test file matches `llm_propose` — the entry point has no test of its own; its
behaviour is covered indirectly through the arm and the transport description.
Stated as an observation, not a defect claim.

`git status` was clean before and after. The run triggered
`ensure-build-artefacts` for `dist/cli`, `dist/ui` and `dist/mcp` (all
gitignored); no tracked file changed.

## 5. AC-3 — the claim is true, with the line numbers naming declarations

AC-3 (`road-to-governed-evidence-production.md:526-541`) says
`assertCheapestFirst` now has production callers at
`llm_candidate_proposer.ts:369` (`proposeCandidatesWithModel`) and `:429`
(`plannedAttempts`).

**Both verified at `b50b27281`:**

- `:369` — `export async function proposeCandidatesWithModel(` ✓
- `:429` — `export function plannedAttempts(observations: readonly DefectObservation[]): LadderAttempt[] {` ✓

The cited numbers are the **function declarations**. The `assertCheapestFirst`
CALLS are at `:417` (inside `proposeCandidatesWithModel`) and `:446` (inside
`plannedAttempts`). Both functions are on an executable path:
`llm_propose.ts:137` calls `plannedAttempts` on the dry path, and
`llm_propose.ts:212` calls `proposeCandidatesWithModel` on `--confirm`. These are
the only two production call sites in the tree.

**AC-3's stated remaining gap is confirmed.** The dry run above produced exactly
five attempts, all `class=reason_unknown · tier=lite`. Every attempt is on the
cheapest rung of a one-rung ladder, so no ordering decision arises and the guard
polices a population in which it cannot fire. The population is real and
non-empty; it is not a SPENT population.

### FINDING 5a — two comments in the tree still deny AC-3's half-met state

- `src/scripts/_lib/evolution_roi.ts:188-190` — `assertCheapestFirst`'s own
  docstring: *"NO LIVE SUBJECT. Nothing in this programme produces
  `LadderAttempt`s today; see the header. This is a guard waiting for a harness,
  and its unit test proves it fires rather than proving anything ran."* False at
  this commit: `plannedAttempts` produces five on a dry run.
- `src/scripts/activation_receipt.ts:10` — *"open on `assertCheapestFirst`, which
  polices a population of zero."* Same drift.

Doc drift only; reported, not fixed.

## 6. What a later capture step still needs

Ordered by what blocks what. Items 1–3 are decisions; 4 is code; 5 is the run.

1. **Freeze the UNSET slot** — the metric, the trial unit (Finding 3a),
   `tieEpsilon`, the metric name and direction. Council decision; must land in
   its own commit before any capture (`road-to-governed-evidence-production.md:307-311`).
2. **Decide the corpus-reproducibility question** (Finding 1a) — either pin the
   projection procedure alongside the commit, or move the corpus to a tracked
   surface. As it stands, two runs on the same commit can enumerate different
   corpora.
3. **Decide whether the protocol's HEAD claim is repaired or withdrawn**
   (Finding 3c).
4. **Build the delta producer** (Finding 3b / F-C, Confirmed — see § 7). No
   producer has been identified that turns two candidate records into deltas,
   and `evolution_lab run` expects vectors as an input file. So running
   `llm_propose --confirm` alone would not produce the comparison AC-2 asks
   for: it produces candidates, not a verdict.
5. **Run the capture.** ~$0.02, worst case ~$0.21, against a $5.00 ceiling. The
   credential the transport reads at call time
   (`~/.event4u/agent-config/anthropic.key`, via `load_anthropic_key`,
   `src/scripts/ai_council/clients.ts:369`) is present on this machine; its
   contents were not read.

Step 5 is cheap and step 4 is not. The dollar cost was never the constraint —
which is what the park said in 2026-08-25 (*"Cost was explicitly not the
objection — token spend was pre-authorised"*,
`road-to-routing-assurance-live-floors.md:27-28`) and is still true.

## Honest nulls

- **No metered call was made.** The transport's live path remains unexercised, as
  `metered-proposer-protocol.md:260-265` states.
- **No verdict was computed** over real candidates. The verdict table in § 3 is
  the real `decidePairedVerdict` over synthetic delta vectors, to expose the
  `n = 5` arithmetic. It measures nothing about either arm.
- **The UNSET slot is still UNSET.** Options and evidence only.
- **Whether the metered arm beats the deterministic one is unknown**, and nothing
  here is evidence in either direction.
- **The observations document is not committed** and the corpus is not pinned;
  the five subjects above are this machine's projection on 2026-09-01, not a
  reproducible corpus.

---

# Addendum — council round 2, the repair pass, and the F-C trace

Added 2026-09-01, same drain run, after the reconnaissance above was committed.
**Still zero metered calls: `--confirm` was never passed and the `--confirm`
path stays untaken permanently for this drain.**

## 7. Council round 2 — QB, do not capture

*AI council 2026-09-01 (drain run 14, round 2 on Phase 2), members
`anthropic/claude-sonnet-4-5` + `openai/codex-default`, 2 rounds, depth deep,
peer-review, blind chairman, quorum 2/2 present (needed 1) — concluded.
Subscription transport, `billable=0`, `$0.0000`. Verdict **QB**, convergent.*
Council artefacts are gitignored and auto-pruned, so the text is inlined and no
path under `agents/runtime/council/` is cited.

Ratio, one line: *"the current run lacks both a reproducibly fixed subject and
an executable path to the required comparison. The low cost and green guards do
not cure those validity failures."*

### The four framings it graded, and what changed in this document

| # | Framing put to the council | Grade | What this document now says |
|---|---|---|---|
| 1 | *"a number nobody can reproduce"* | **overreach — refused** | § 1 F-A now claims only "not reproducible **from the commit alone**", and says explicitly that reproduction from a captured manifest plus an environment snapshot is untried, not impossible. |
| 2 | *"AC-2's artefact cannot be produced"* | **Inferred, too categorical** | Narrowed everywhere to **"no producer has been identified"**, and then Confirmed by the trace in § 8 — which still does not license the categorical form. |
| 3 | *"comparability-proven"* | **unsupported — no command cited** | § 2 now carries the probe description, its verbatim output, three `sha256` digests, and a paragraph on what the digests do NOT pin. The heading says **observed**, not proven. |
| 4 | the cost figures | **inferred — no table, no arithmetic** | § 2 now shows the price-table row with its file:line and `LAST_UPDATED`, and the two sums line by line. |

One further unsupported claim, now cited: fixture-substitution **is** ranked #2
in this roadmap's Risk Register — `road-to-governed-evidence-production.md`
§ Risk Register, Rank 2, *"Phase 2 closes on a fixture instead of a run"*, risk
type `product`.

### The two direct rulings

1. **Fixing F-A is owner-reserved by default.** Changing corpus membership or
   selection semantics amends a frozen experimental subject. One seat allowed a
   purely provenance-preserving pin of the *same* subjects *might* be
   autonomous, but held the equivalence undemonstrated. **No manifest was
   pinned.**
2. **`underpowered` does not discharge AC-2.** A legitimate execution status,
   not a directional result: it records that adjudication was unavailable.

### Not done, deliberately

No capture, not even diagnostic. The metric and the trial unit were **not**
frozen — the council ruled the experimental definition must be frozen as a whole
(estimand, trial unit, pairing, aggregation, independence assumptions, sign
convention, `tieEpsilon`) and that is not this run's work. The corpus contract
was not touched. AC-2, AC-3, AC-4 not closed; 2.1 and 2.2 not flipped.
`metered-backend-park` not resolved; its narrowing stands and this run's block is
downstream of it.

## 8. F-C — the end-to-end trace. VERDICT: CONFIRMED, no producer identified

The council graded F-C `Inferred` because the first report described
`evolution_lab run` as consuming vectors without showing that no producer exists
elsewhere. This is the search record it asked for. **A confirmed absence needs a
search record, not a description**, so every command is given.

**The acceptance criterion** — AC-2,
`road-to-governed-evidence-production.md` § Acceptance Criteria: *"A
paired-verdict comparison between a metered proposer and the deterministic one
has been run, and its result — in either direction — is recorded."*

**The input consumer** — `evolution_lab run --vector FILE`
(`src/scripts/evolution_lab.ts:402`), which parses each file through
`parseMetricVectorJson` (`_lib/evolution_roi.ts:452`) into `buildVector`
(`_lib/evaluation_vector.ts:103`).

**The candidate records** — `proposeCandidates`
(`_lib/candidate_proposer.ts:361`) and `proposeCandidatesWithModel`
(`_lib/llm_candidate_proposer.ts:369`). Both emit `CandidateRecord`, whose fields
are `kind`, `version`, `id`, `dimension`, `lifecycle`, `mutations` — **no outcome
field of any kind**.

**The gap, stated precisely:** nothing reads two `CandidateRecord`s and emits a
signed delta, a `PairedVerdict`, or a `MetricVector`.

### The searches

| # | Command | Result |
|---|---|---|
| S1 | `grep -rn --include='*.ts' "decidePairedVerdict(" src` | exactly one caller: `_lib/bench_ab_size_claim.ts:101` |
| S2 | `grep -rn --include='*.ts' "kind: 'paired'" src` | 2 hits: the type declaration `_lib/evaluation_vector.ts:65`, and `_lib/evolution_roi.ts:536` |
| S3 | `grep -rn --include='*.ts' "kind: 'counted'" src` | 2 hits: `_lib/evaluation_vector.ts:72`, `_lib/evolution_roi.ts:500` |
| S4 | `grep -rn --include='*.ts' "candidate_id" src` | 30 hits across 9 files; none builds a metric vector — see the exclusions below |
| S5 | `grep -rn -- "--vector" src tests docs` | declared at `evolution_lab.ts:402`; supplied only by tests |
| S6 | `grep -rln --include='*.ts' "evaluation_vector" src tests` | 5 src files, all consumers or parsers |
| S7 | `grep -rln --include='*.ts' "paired_verdict" src tests` | 6 src files; 4 mention it only in comments |
| S8 | `sed -n '550,566p' tests/scripts/evolution_lab.test.ts` | the only vector ever fed to the verb is a **hand-authored verdict literal** |
| S9 | `sed -n '410,445p' src/scripts/_lib/evaluation_cascade.ts` | takes `input.vector` **or** `input.rows` — both caller-supplied |
| S10 | `grep -rln --exclude-dir={src,tests,node_modules,.git} "evaluation_vector\|decidePairedVerdict\|artifact-count-delta" .` | 6 files, all prose: two roadmaps, three contracts, this report |
| S11 | `sed -n '325,345p' src/scripts/bench_ab_v2_stats.ts` | the one live verdict's population is **A/B bench task pairs**, not candidate records |
| S12 | `grep -n "paired_verdict\|evaluation_vector"` over the four other importers | `paired_stats.ts`, `role_split.ts`, `harness_evolution_guards.ts`, `pathology_archive.ts` — comments only |

### Every adapter checked, and why each is not the producer

| Module | What it does | Why not a producer |
|---|---|---|
| `_lib/bench_ab_size_claim.ts:96-105` | the tree's ONLY `decidePairedVerdict` call; builds `deltas` as a ±1 direction vector | its input is `PairedContinuous` from the A/B bench report pipeline (`bench_ab_v2_stats.ts:325-344` — added lines and cognitive complexity per benchmark task pair). Different population; it never sees a `CandidateRecord`. |
| `_lib/evolution_roi.ts:480-543` (`parseRow`) | the only `kind:'paired'` / `kind:'counted'` construction in `src/` | a **deserialiser**. It re-shapes and validates JSON read off disk; it computes nothing. |
| `_lib/evaluation_cascade.ts:414-441` | stage 12, the promotion verdict | consumes `input.vector` or `input.rows`; both arrive from the caller. |
| `_lib/regression_neighbourhood.ts:194` | builds a `NeighbourhoodReport` keyed by `candidate_id` | selects regression specs from a registry. No deltas, no verdict, `authored: 0` by construction. |
| `_lib/minimality_tiebreak.ts` | breaks ties on tokens/artifacts | a tiebreak over already-decided candidates; emits a winner id, not a delta. |
| `_lib/pathology_archive.ts` | retains one representative failure per class | says outright (`:12-15`) it is not a second verdict and never calls `promotionVerdict`. |
| `_lib/promotion_evidence.ts`, `_lib/evaluator_promotion.ts` | parse and check promotion evidence | validators over supplied evidence. |
| `_lib/paired_stats.ts`, `_lib/role_split.ts`, `_lib/harness_evolution_guards.ts` | stats primitives, role split, budget/disclosure guards | reference `paired_verdict` in prose only. |

**Verdict: CONFIRMED — no producer identified.** Stated as the council requires:
this is an absence established by a recorded search over this tree at this
commit, not a proof that the artefact cannot be produced. Building one is
straightforward and is item 4 of the ordered list in § 6; if a later reader finds
a producer this trace missed, that is the better outcome and this section is
where the correction belongs.

## 9. The repair pass — what changed, and the two sweeps

Four defects reported in § 1-5 as "reported not fixed" were repaired, on the
grounds that each is wrong at this commit whatever the council decides.

### F-D1 — the false provenance claim: WITHDRAWN, not implemented

`docs/contracts/metered-proposer-protocol.md` § The defect-observation corpus
claimed *"The run report records `git rev-parse HEAD`"*.

**Option taken: withdraw.** Three reasons, in the order they decided it:

1. Adding a commit field to `RunReport` would not make the sentence true for the
   arm this protocol governs. `llm_propose` writes **no run report at all**;
   `buildRunReport` is reached only from `evolution_lab run`
   (`evolution_lab.ts:866`). The field would describe a document the capture
   never emits — a second true-sounding claim replacing the first.
2. A recorded commit would not be sufficient where it did land, because of F-A.
   An automatic HEAD line would have made the corpus look pinned while it was
   not, which is worse than no line.
3. Emitting real provenance from `llm_propose` — commit plus the enumerated
   subject list — is a change to the frozen mechanism, and per the council the
   experimental definition is frozen as a whole. That belongs to whoever freezes
   it, not to a repair of a false sentence.

**What is lost, stated in the contract itself:** the protocol now claims no
automatic provenance capture whatsoever. Comparability rests entirely on the
operator recording, by hand and alongside the results, both the commit and the
`.claude/` projection state — at minimum the five sorted subject filenames,
because the commit alone does not determine them.

### F-D2 — the citation sweep. Found 3 of 7 stale; then my own repair broke 11 more

**Sweep A, the protocol document.** Extracted every `file:line` citation with
`grep -o` rather than fixing only the three already noticed. **7 citations
existed; 3 were stale; 3 fixed; 4 already correct** (`evolution_roi.ts:191`,
`paired_verdict.ts:51`, `:78`, `evaluation_vector.ts:62`). The document's
non-line-numbered factual claims were checked in the same pass and **all hold**:
`ANTHROPIC_URL`, `ANTHROPIC_VERSION`, both dated model ids and the null `high`
tier, `MAX_TOKENS` 8192, `TEMPERATURE` 0, the 256 KiB body ceiling
(`MAX_BODY_BYTES`, `_lib/llm_candidate_proposer.ts:204`), `max_candidates` 5 and
`max_trials_per_candidate` 20.

**Sweep B, the tree, and it caught a defect Sweep A could not.** Grepping
`evolution_roi\.ts:[0-9]` across the tree showed the same three stale citations
**recurring in code** — `_lib/llm_candidate_proposer.ts:41` and `:295`, and
`_lib/llm_proposer_transport.ts:27`. Fixing only the protocol would have left
the identical defect in two shipped modules.

**And then the repair created the drift it was fixing.** Correcting the comments
in § 9's next item added lines to `evolution_roi.ts`, which shifted its own line
numbers and silently falsified **every** citation into it. **11 live citations
repaired** across four files: the frozen protocol (5), the active roadmap (2),
`_lib/llm_candidate_proposer.ts` (3), `_lib/llm_proposer_transport.ts` (1).

| anchor | old | new |
|---|---|---|
| `execution_failed` ladder | `:109` → `:111` | `:128` |
| `reason_unknown` + comment | `:117-119` → `:119-121` | `:136-138` |
| "retrying `lite` is not an escalation" | `:203` → `:184-185` | `:201-202` |
| `assertCheapestFirst` declaration | `:191` | `:215` |
| `RunReport` interface | `:329-335` | `:353-359` |
| `buildRunReport` | `:363` | `:387` |

**Deliberately NOT repaired — historical records.** The archived parent roadmap
(`agents/roadmaps/archive/road-to-governed-harness-evolution.md`, 3 citations)
and two prior analysis documents also cite shifted lines. An `analysis` artefact
*"asserts what was true when it was written and is never re-bound"*
(`docs/contracts/evidence-artifact-types.md:59`), so re-binding them would be
the error, not the fix.

**The structural finding this exposes, recorded rather than fixed.** A citation
by line number into a file is falsified by any prose edit to that file, silently,
with no gate that notices. This pass produced 11 such falsifications from four
comment edits. That is a maintenance hazard in the citation convention itself,
not a defect in any one document, and it is out of scope here — but a reader
touching `evolution_roi.ts` should expect to re-sweep.

### F-D3 — five comments denying a state the code has

`assertCheapestFirst` gained two production callers when the metered arm landed.
**The construct was grepped across the tree rather than assumed to be the two
already reported. 5 sites matched, all corrected:**

| site | was |
|---|---|
| `src/scripts/_lib/evolution_roi.ts` header | "The ladder is an ORDERING POLICY, and it has no live subject" |
| `src/scripts/_lib/evolution_roi.ts` guard docstring | "NO LIVE SUBJECT. Nothing in this programme produces LadderAttempts today" |
| `src/scripts/activation_receipt.ts` | "which polices a population of zero" |
| `tests/scripts/_lib/evolution_roi.test.ts` file docstring | "nothing in this programme produces a LadderAttempt" |
| `tests/scripts/_lib/evolution_roi.test.ts` describe name | "a guard with no live subject" |

Each now states the **half**-met position and not more: callers exist and are on
an executable path; no LIVE run has produced a spent population, so the ordering
has not yet governed one, which is what AC-3 stays open on.

**11 further tree matches were read and EXCLUDED**, with the reason: they
describe different machinery and are true of it —
`lint_promotion_paths.ts:42`/`:739`, `_lib/candidate_record.ts:178`,
`_lib/activation_receipt_producer.ts:32`, `src/config/gate-coverage.yml:2362`,
`docs/contracts/activation-receipt-trust-boundary.md:99`,
`_lib/tier_budget_routing.ts:15`, `ai_council/leakage_patterns.ts:48`,
`_lib/collector_supervision.ts:654`, `_lib/capture_rate.ts:37`,
`hooks/skill_route_hook.ts:8`.

### F-D4 — the roadmap's declaration-vs-call citations

Step 2.2 and AC-3 cited `llm_candidate_proposer.ts:369` and `:429` as though
they were the call sites. They are the function **declarations**; the
`assertCheapestFirst` calls are at `:417` and `:446`. Both sites now name
declaration and call, plus the entry points that reach them
(`llm_propose.ts:137` dry, `:212` `--confirm`). **Factual repair only — AC-3
stays `[ ]` and its verdict text is untouched.**

## 10. Honest nulls, restated after the addendum

- **No metered call was made, in either pass.** The transport's live path
  remains unexercised.
- **No verdict was computed over real candidates.** The `n = 5` table in § 3 is
  the real `decidePairedVerdict` over synthetic delta vectors; it measures
  nothing about either arm.
- **The metric slot is still UNSET**, and per the council it must be frozen as a
  whole rather than slot by slot.
- **The corpus contract is untouched and no manifest was pinned** — owner-reserved.
- **Whether the metered arm beats the deterministic one is unknown**, and
  nothing in this document is evidence in either direction.
- **F-C is a Confirmed absence over this tree, not an impossibility proof.**
- **The comparability result is `observed` under a stub in this run**, and its
  digests pin uncommitted artefacts derived from a gitignored projection.
