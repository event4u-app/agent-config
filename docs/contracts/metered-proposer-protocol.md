---
stability: beta
keep-beta-until: 2026-11-30
roadmap_ref: road-to-governed-evidence-production.md
---

# Metered-proposer execution protocol

**Purpose.** Freeze, before any capture, what a metered proposer run does —
provider and model version, prompts, sampling, retry policy, exclusion policy,
corpus, pair count and stopping rule. `road-to-governed-evidence-production`
step 2.1 under the **NARROWED 2026-09-01** disposition of
`blocker: metered-backend-park`.

**Scope.** The PROPOSAL half of the 2.1 comparison: what the metered arm sends,
what it accepts back, and which observations it runs over. It does **not**
define the outcome metric — see § The one slot this document leaves open, which
is a park-compliance requirement rather than an omission.

**Written by the session that built the arm, which is why one slot is empty.**
The live-floors park (AI council 2026-08-25, 2/2 convergent) requires the
session that freezes the protocol and captures results to be independent of the
session under evaluation: *"an independent session (not the one that authored
the corpus) freezes the execution protocol — model/provider version, prompts,
sampling, retry and exclusion policy — BEFORE capturing any baseline."* Every
clause below that this session filled is either a **description of code a reader
can check against the code**, or a value **derived from a constant committed
before the arm existed**. Nothing here was chosen in a way that could favour an
outcome, and the one clause that could be is left to Session B.

## Why a frozen protocol at all

> *"the parent roadmap froze no execution protocol for 0.2, so model version,
> retries, exclusions and aggregation would all have been discretionary choices
> made by the session under evaluation."*
> — the live-floors park's second seat, AI council 2026-08-25, 2/2 convergent

The conclusion is inlined with its date and its quorum rather than linked,
because a roadmap is a transient artifact and this contract is not: the park
file lives under `later/` and its path is not a citation a stable document may
depend on.

A protocol written after a result is a tuned protocol. This one is committed
before the first metered call, and the commit that adds it made none.

## Role clause — what the metered call may do

> A metered call may **generate** candidate text. It may not score, rank,
> filter, select between, or supply any input to the verdict for the arms being
> compared — whatever the module is called.

Enforced structurally, not by intention. Six places, each with a test:

| Forbidden role | What makes it unavailable |
|---|---|
| supply a score | `GenerationResult` carries `text` and `model`; `NoDecisionField` makes adding a scoring key a **build error** |
| rank | the port takes one request and returns one result — it cannot express a batch |
| select between candidates | one record per observation, asserted at the return |
| filter | an unsatisfiable observation THROWS; the output can never be a subset of the input |
| reorder | output order is `byteCompare` over the INPUT, using the deterministic arm's own comparator |
| reach the verdict | the arm imports no verdict module |

`src/scripts/_lib/llm_candidate_proposer.ts` is the arm;
`tests/scripts/llm_candidate_proposer.test.ts` is the test, one case per row.

## Frozen mechanism

### Provider, endpoint and model version

| Item | Value | Source |
|---|---|---|
| Provider | Anthropic Messages API | `_lib/llm_proposer_transport.ts` |
| Endpoint | `https://api.anthropic.com/v1/messages` | `ANTHROPIC_URL` |
| API version header | `2023-06-01` | `ANTHROPIC_VERSION` |
| Tier `lite` | `claude-haiku-4-5-20251001` | `TIER_MODEL` |
| Tier `medium` | `claude-sonnet-4-5-20250929` | `TIER_MODEL` |
| Tier `high` | **UNPINNED — refused** | `TIER_MODEL` |
| Credential | `~/.event4u/agent-config/anthropic.key`, read at call time | `load_anthropic_key` |

**Dated ids only, and `high` is refused rather than resolved.** A protocol whose
model is a floating alias is not frozen: the alias moves and a later run answers
a different question. No dated `claude-opus-4-1-*` id exists anywhere in this
tree, so `modelForTier('high')` throws with a message naming what must be pinned
first. `high` is reachable only through an `execution_failed` escalation
(`_lib/evolution_roi.ts:128`), so a run with no transport error never touches it.

### Sampling

| Parameter | Value |
|---|---|
| `max_tokens` | 8192 |
| `temperature` | 0 |
| `top_p`, `top_k` | not sent — provider defaults |
| Streaming | off |

`temperature: 0` is not a claim of determinism. Provider inference is not
reproducible at any temperature; zero minimises the arm's own contribution to
variance and nothing more.

### Prompts

Byte-exact and frozen. Editing either is an edit to this protocol and
invalidates a comparison already captured against it.

- **System**: `SYSTEM_PROMPT` in `_lib/llm_candidate_proposer.ts`. Four lines,
  ending *"Do not judge, score, rank, or compare anything. Produce one body."*
- **User**: built by `buildPrompt(obs, body)` — defect class, the recipe's
  one-line summary of that class, the artifact path, the route target when the
  class has one, then the current body between `--- BEGIN CURRENT BODY ---` and
  `--- END CURRENT BODY ---`.

The user prompt is a pure function of the observation and the subject bytes, so
the exact string for any observation can be printed without sending it:
`./scripts-run src/scripts/llm_propose --observations FILE --out DIR` prints it
for the first observation and sends nothing.

### Retry policy

The ladder walk in `_lib/llm_candidate_proposer.ts`, and it is a retry policy
rather than a selection policy:

1. The first attempt runs on class `reason_unknown`, whose ladder is exactly
   `['lite']` — *"escalating on a reason nobody established is spending on a
   guess"* (`_lib/evolution_roi.ts:136-138`).
2. A refused generation is classified into a `PathologyWhy` by
   `classifyRefusal`, deterministically and from the refusal itself — never from
   the model's opinion of its own output.
3. The walk continues on that class's ladder from its cheapest untried rung.
4. A class whose ladder is empty, or whose rungs are all spent, STOPS the walk
   and the observation throws.
5. **First-valid wins.** The walk stops at the first generation that satisfies
   the output contract. It never holds two valid generations and never compares
   them; choosing the better of two would be selection, and no code path here
   can express it.

Per-observation spend is per observation: a new subject starts at the cheapest
rung again, which the ordering guard allows explicitly — *"retrying `lite` is
not an escalation"* (`_lib/evolution_roi.ts:201-202`).

`assertCheapestFirst` (`_lib/evolution_roi.ts:215`) validates the whole attempt
list before the arm returns.

### Exclusion policy

Two layers, both deterministic, neither a quality judgement.

**Observation-level** — inherited unchanged from the deterministic arm's
`parseObservations`, so both arms run over the same admitted set: a class
outside the three fixed recipes, a subject outside the candidate surface, a
missing `routeTo` on a class that needs one, a `routeTo` on a class that does
not read one, and a duplicate `(class, subject)` pair are all refused.

**Generation-level** — `assertGenerationAcceptable`. A generation is refused
when it is empty, byte-identical to the input, over the 256 KiB ceiling, carries
a NUL, or (for a routing class) omits the required route target. Each is a fact
about ONE string. `better` is a judgement about two and appears nowhere.

### Inherited guards

`llm_propose` runs both of the deterministic verb's guards, against the same
observations document, because an arm that skipped them would not be the same
experiment:

- **GUARD 0.5** — `assertWithinBudget` against
  `src/config/harness-evolution-budget.json`. Aborts; never truncates.
- **GUARD 0.4** — `discloseObservations`, which logs every field disclosed to a
  proposer and aborts when holdout truth appears in proposer context.

### Entry point, and the dry default

```
./scripts-run src/scripts/llm_propose --observations FILE --out DIR [--confirm]
```

Without `--confirm` nothing is sent: the dry path prints the ladder plan, the
pinned model per tier, the exact request body for the first observation, and a
token estimate. `--confirm` is the only path that spends.

## Corpus, pairs and stopping rule — derived, not chosen

### The defect-observation corpus

Enumerated by a stated rule rather than hand-picked, so the session that built
the arm did not get to choose which artifacts it is judged on:

1. Take every `*.md` **directly under** `.claude/rules/` in the checkout at the
   run's commit.
2. Sort byte-wise by filename.
3. Take the first `max_candidates` (**5**, from
   `src/config/harness-evolution-budget.json`).
4. Assign one defect class per file, by reading the file: `over-broad-activation`
   when it contains a line beginning `## `, otherwise
   `unbacked-enforcement-claim`.

`unrouted-obligation` is excluded from the corpus because its recipe requires a
`routeTo` target that no rule can derive from the file, and inventing one would
be the session under evaluation choosing an input.

**The commit pin is load-bearing, and NOTHING CAPTURES IT.** `.claude/` is a
generated projection, so the same rule over a different checkout can yield a
different set.

**CORRECTED 2026-09-01 — the claim this paragraph used to make is withdrawn.**
It read *"The run report records `git rev-parse HEAD`, and a comparison is only
comparable against the same commit."* The second clause is true and stays. The
first was false when it was written and is false now: `RunReport`
(`_lib/evolution_roi.ts:353-359`) has `run_id`, `candidates`,
`trials_per_candidate`, `roi` and `ladder` and no commit field; `run_id` is
built from candidate ids (`evolution_lab.ts:871`); and `rev-parse` appears
nowhere in `evolution_lab.ts`, `llm_propose.ts`, `_lib/evolution_roi.ts` or
`_lib/llm_candidate_proposer.ts`.

**Withdrawn rather than implemented, and the reason is not effort.** Adding a
commit field to `RunReport` would not make the sentence true for the arm this
protocol governs: `llm_propose` writes **no run report at all** — it writes
candidate records and prints attempts, and `buildRunReport` is reached only from
`evolution_lab run` (`evolution_lab.ts:866`). The capture path therefore has no
report for a commit to sit in, so the field would produce a second true-sounding
claim about a document the capture never emits.

And a recorded commit would not be sufficient even where it landed. `.claude/`
is gitignored in its entirety (`.gitignore:157`, `git ls-files .claude` → 0), and
the projection generator SKIPS any rule already installed byte-identically at
user scope, so the corpus this section enumerates is a function of the
operator's user-global layer as well as of the commit. Measured 2026-09-01: a
fresh generation in a clean worktree of the capture commit reported *"101 rule(s)
skipped — byte-identical twin already installed at user scope"* and produced 13
files where a stale projection of the same HEAD held 15. An automatic HEAD line
would have made that corpus look pinned while it was not, which is worse than no
line at all.

**What is lost by withdrawing.** This protocol now claims **no automatic
provenance capture whatsoever**. Comparability rests entirely on the operator
recording, by hand and alongside the results, BOTH the commit the capture ran
from AND the state of the `.claude/` projection it enumerated — at minimum the
sorted filenames of the five subjects, because the commit alone does not
determine them. A capture that records neither is not re-runnable and its result
is not comparable to any other run, and this document no longer implies
otherwise.

**What would close it properly** is provenance emitted by the capture path
itself — the commit plus the enumerated subject list, written by `llm_propose`
next to the records. That is a change to the frozen mechanism and therefore
belongs to whoever freezes the remaining slot, not to a repair of a false
sentence.

### Number of pairs

**5** — one pair per corpus member, each pair being (deterministic candidate,
metered candidate) over the same observation. Not a choice: `max_candidates` in
the pre-registered budget is 5, and it is a ceiling the guard aborts on.

`max_trials_per_candidate` is **20** from the same file, which is the ceiling on
trials inside one pair.

### Stopping rule

Cited, not restated and not tuned. Both constants were committed before either
arm existed and are not this document's to set:

- `ALPHA` — `src/scripts/_lib/paired_verdict.ts:51`.
- `MIN_DISCORDANT` — `src/scripts/_lib/paired_verdict.ts:78`, derived from
  `ALPHA` by `deriveMinDiscordant` rather than chosen.

Consequences a runner must honour:

- Below the discordant floor `decidePairedVerdict` returns `underpowered`, which
  is **an absent measurement, not a null result**, and belongs in no pass rate.
- The run stops at the budget ceiling by abort, not by truncation. A truncated
  run yields `underpowered` and a reader mistakes it for a pass.
- A resumed run passes the aborted run's attempts as `priorAttempts` so the
  ordering guard sees the whole run rather than its tail.

### The fixture prohibition is unchanged

2.1 closes on a run or it does not close. A paired-verdict harness exercised
over recorded fixtures is the substitution the source roadmap caught twice, and
neither this document nor the park narrowing weakens it.

## The one slot this document leaves open

**UNSET — the paired outcome metric, and its aggregation. Owned by Session B.**

`decidePairedVerdict` consumes one signed delta per trial. What that delta
MEASURES is not fixed anywhere in the tree, and it is the single choice in this
protocol that could favour one arm over the other.

The park names aggregation explicitly among the discretionary choices a session
under evaluation must not make. This session built the arm. So the metric is
left for the independent session to fix and commit **before** it captures
anything, and this document is the place to fix it.

What is already committed and constrains that choice:

- `ARTIFACT_COUNT_METRIC` (`_lib/evaluation_vector.ts:62`) — `buildVector`
  refuses a vector with no artifact-count row, so any metric set includes it.
- `promotionVerdict` reads exactly one paired row plus that counted row.

Deriving a metric here would have been inventing a derivation, which is the
failure this repository already recorded once for a stage enumeration: a third
proposal is a third answer.

## Not yet run

As of the commit that adds this document, **no metered call has been made
through any of these modules.** The transport's live path is unexercised; its
request shape is proven by `describeRequest` and a unit test over the
description, and every behavioral test uses a stubbed generator.

## Cross-references

- The arm: [`llm_candidate_proposer.ts`](../../src/scripts/_lib/llm_candidate_proposer.ts).
- The transport: [`llm_proposer_transport.ts`](../../src/scripts/_lib/llm_proposer_transport.ts).
- The entry point: [`llm_propose.ts`](../../src/scripts/llm_propose.ts).
- The deterministic arm this mirrors: [`candidate_proposer.ts`](../../src/scripts/_lib/candidate_proposer.ts).
- The verdict, and the two constants this document cites: [`paired_verdict.ts`](../../src/scripts/_lib/paired_verdict.ts).
- The ladder and its ordering guard: [`evolution_roi.ts`](../../src/scripts/_lib/evolution_roi.ts).
- The pre-registered budget: `src/config/harness-evolution-budget.json`.
