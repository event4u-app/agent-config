# Outcome Baselines — Scope & Scaling Criteria

Locked behavior contracts for the Iron-Law layer. Each fixture pairs
an input prompt with a `baseline_reply` that demonstrates the rule's
Iron Law in observable form, plus expected / forbidden regex patterns
and structural counters that the scorer checks line-by-line.

CI entry: `tests/test_outcome_baselines.py`. Scorer:
[`scorer.py`](scorer.py) — 41 LOC, stdlib only (caps locked at
≤ 50 LOC / stdlib / no AST per Phase 2.3a of
`road-to-context-layer-maturity`).

## Locked baselines (Phase 2.4)

| Fixture | Rule | Iron Law | Trigger class |
|---|---|---|---|
| `ask_when_uncertain.json` | `ask-when-uncertain` | One question per turn, vague-request must ask | vague-request (`improve this`) |
| `verify_before_complete.json` | `verify-before-complete` | No completion claim without fresh evidence | completion-claim |
| `direct_answers.json` | `direct-answers` | No flattery, brevity by default | factual one-true-answer |

These three were picked because they have the **sharpest Iron Laws**
and the **cheapest observable signals** (regex over the reply text).
Each fixture cites the canonical anchor in its own `iron_law_anchor`
field.

## What outcome tests prove (and what they do not)

Per Phase 2.5 of `road-to-context-layer-maturity`:

- **Prove:** the rule changes observable behavior on a held-out
  prompt; a future edit that relaxes the Iron Law trips CI.
- **Do not prove:** that the agent is "better" overall, that the rule
  is the right rule, or that other rules also hold.
  **Outcome ≠ universal quality.**

The scorer is a shape-check, not a semantic judge. A fixture passing
means the reply matches the locked patterns, not that the reply is
genuinely useful in the wild.

## Scaling criteria — when to add rule #4

Adding a 4th outcome baseline requires **all three**:

1. **Sharp Iron Law.** The rule has a single canonical line that the
   reply either obeys or breaks. Soft / advisory rules without a
   single observable signal don't qualify (e.g. `scope-control` is
   too situation-dependent for shape-level scoring).
2. **Scorable in the cap.** The observable signal fits the
   ≤ 50-LOC / stdlib / no-AST scorer cap. If the signal needs
   semantic understanding ("is this code actually correct?"), the
   rule is **deferred**, not added with a richer scorer. A flexible
   scorer is exactly the path to flaky tests (Risk #2).
3. **Two release cycles green.** The current three baselines have
   held across two release cycles without a single false-positive
   re-lock. Rationale: signals that flake in the first three rules
   would compound badly across more.

If a candidate rule fails (1) or (2) → document the gap below under
**Deferred candidates**. Do not add the fixture and do not extend
the scorer to accommodate it.

## Deferred candidates

(Document candidates that fail criterion 1 or 2 here so future
maintainers don't re-attempt the same evaluation.)

- _none yet — first re-evaluation due after two release cycles past
  Phase 2.4 lock-in._

## Adding a baseline (procedure)

1. Open a roadmap entry in `agents/roadmaps/` justifying the addition
   against the three scaling criteria.
2. Author a JSON fixture matching the existing schema:
   `rule`, `iron_law_anchor`, `trigger_class`, `input_prompt`,
   `baseline_reply`, `expected_patterns`, `forbidden_patterns`,
   optional `counters` (with `pattern`, `op` ∈ `{==, <=, >=}`,
   `target`), `notes`.
3. Add the filename to `LOCKED_BASELINES` in
   `tests/test_outcome_baselines.py`.
4. Run `python3 -m pytest tests/test_outcome_baselines.py -v` and
   confirm green on the new fixture **and** the existing three.
5. Update the locked-baselines table above and the count claim in
   `road-to-context-layer-maturity.md` Phase 2 exit gate.

## Editing a baseline (re-lock procedure)

A passing-then-failing fixture means **either** the fixture drifted
**or** the Iron Law it encodes was relaxed. Pick one:

- **Drift → re-lock fixture.** The Iron Law is unchanged but the
  reply or pattern wording shifted. Update the fixture, re-run, no
  rule edit.
- **Iron Law relaxed → re-lock both.** The rule weakened on purpose
  (with a roadmap entry justifying it). Update the rule first, then
  the fixture to match the new contract.

**Never** edit the scorer to accommodate a failing baseline. The
scorer is shape-agnostic; relaxing it leaks outcome-layer scope into
rule-quality judgment, which Phase 2.5 explicitly excludes.
