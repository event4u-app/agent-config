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

### FINDING 1a — the corpus is not reproducible from a commit

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

### Drop-in comparability — verified, with one operational caveat

Both arms write through the same two functions: `candidateRecordFilename` and
`serialiseCandidateRecord` (`candidate_proposer.ts:400`, `:395`), called from
`llm_propose.ts:220-221` and `evolution_lab.ts:688-698`. Both order the input
with the same comparator (`byteCompare`, `candidate_proposer.ts:290`) at
`candidate_proposer.ts:365-367` and `llm_candidate_proposer.ts:375-377`. Both
build the id with the same `candidateId` and take `dimension` from `RECIPES`,
never from the model (`llm_candidate_proposer.ts:328-337`).

Verified by running the metered arm against a **stub** generator (zero spend):

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
4. **Build the delta producer** (Finding 3b). Nothing turns two candidate records
   into deltas, and `evolution_lab run` expects vectors as an input file. AC-2
   cannot be met by running `llm_propose --confirm` alone: that produces
   candidates, not a verdict.
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
