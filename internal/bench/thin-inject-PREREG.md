# PREREG — trigger-delivered rule bodies: four endpoints, and what they license

> Pre-registration for Phase 2 of
> [`road-to-trigger-delivered-rule-bodies`](../../agents/roadmaps/archive/road-to-trigger-delivered-rule-bodies.md).
> Committed **before** any artefact under `internal/bench/reports/thin-inject-*`
> exists. Scorer: `./scripts-run src/scripts/model_rule_injection --endpoints`.
> Corpus: `tests/eval/routing-matrix/` (94 labelled rules, 305 positives, 194
> near-misses), frozen. No metered call on any path.

## The sentence this run is bound by, verbatim

> **This licenses delivery equivalence and cost. It does not measure behavioural
> equivalence; that instrument is closed (ADR-202) and this run does not reopen
> it.**

It appears here, in the commit that lands any default change, and in the
`docs/CLAIMS.md` entry. `ADR-202` closed three instruments — paired judging (LLM
or human) as inadmissible for this question, the non-inheritance of the 0.48 bar,
and anchor evaluation at inter-evaluator Cohen's **κ 0.472** against a registered
floor of **0.800**, its own "final honest null". Its `review_trigger` (c), a judge
substrate with measurable reliability, has not fired. Nothing below is evidence
about quality, and no reading of it may be reported as such.

## How pre-registered this registration actually is — the honest limit

**The decision rule below was fixed before the endpoint artefact existed, NOT
before any number was seen.** Phase 0 precedes Phase 2 in the roadmap's own
order, so `0.3` and `0.4` had already published the aggregate recall (0.902 /
0.993), the false-fire count (0) and the price grid when this file was written.
Calling that a clean pre-registration would be the fabricated-verdict failure
`evaluator-independence` exists to catch, so it is not claimed.

What is claimed is the mitigation, and it is structural rather than a promise:
**every bar below is a PROPERTY, derived from a stated principle that does not
reference an observed value.** No bar is a threshold placed near a number
somebody had already read. Two of the four are exact zeros; one is a strict
inequality between two computed costs; one is a reachability predicate. A bar of
that shape cannot be tuned to pass, which is the only defence available once the
ordering is admitted.

The residual risk is named rather than mitigated: a bar chosen with knowledge of
the outcome can still be chosen to be one the outcome satisfies. The check on
that is `--selftest`, which requires each endpoint to REJECT a planted defect
before its green reading counts (§ Falsification).

## Endpoint (a) — delivery census

**Bar: zero tolerance. `unequal == 0`, and `deliveries > 0`.**

For every labelled positive on which the matcher fires, the text the CONCERN puts
in front of the model must contain the projected body verbatim. Scored by calling
`buildInjection` from the shipped hook — not by re-reading the projected file
twice, which is a tautology that would pass whatever the concern did to the bytes
on the way out.

*Derivation.* A delivery mechanism that alters the body is not delivering the
rule; it is delivering a paraphrase of it. There is no tolerance to negotiate,
which is why the bar is zero rather than a percentage.

## Endpoint (b) — per-rule recall floor

**Bar: `unreachable == 0`. No labelled rule may end with ZERO matched positives,
with `open_files` honoured. Residual partial misses are listed by rule and by
prompt, never aggregated away.**

*Derivation, and why this is not an aggregate recall number.* The failure that
matters is a rule becoming **unreachable** — in force under the eager projection,
never delivered under the delivery mode, with no error anywhere. That is the
roadmap's own risk register rank 1. A rule matched on 2 of its 3 labelled
positives is still reachable; a rule matched on 0 of 3 has been silently removed.
An aggregate floor (say "recall ≥ 0.95") would let one rule vanish completely
while the mean stayed comfortable, and it would also be a number whose value one
could shop. Reachability is a property.

Partial misses are published because they are the honest cost of the mechanism
and a reader is entitled to judge them. They are not a pass/fail axis here.

## Endpoint (c) — false-fire ceiling

**Bar: `falseFires == 0` over the 194 labelled near-misses.**

*Derivation.* The eager arm carries every rule standing, so nothing "fires" and
its false-fire count is zero by construction. The roadmap's phrasing — "not above
the eager arm's count by more than the registered number" — therefore resolves to
zero plus a registered allowance, and the allowance registered here is **zero**: a
near-miss is a prompt the corpus asserts must NOT reach that rule, so any fire is
a labelled-wrong delivery. A non-zero allowance would be an allowance for
delivering rules the corpus says do not apply.

## Endpoint (d) — price

**Bar: `delivery < eager` at 50 turns × 5 spawns, under
`internal/bench/pricing.yaml` (sonnet tier).**

*Derivation.* 50×5 is the roadmap's own registered comparison point and is not
re-chosen here. A strict inequality, not a ratio: the claim being licensed is
"cheaper", and any margin argument would be a number to haggle over. The model's
assumptions live in `sessionCostUsd`'s docstring — standing context
cache-written once and cache-read per later turn, a spawn re-writing the whole
preamble as uncached input, injected bodies uncached and paid once per rule per
session (step 1.4's seen-set, modelled directly), output tokens excluded because
they are identical across shapes.

## Falsification — a scorer never seen red has unknown sensitivity

`--selftest` must be green, and green there means each endpoint **rejected** a
planted defect: a mutated body for (a), a rule stripped of its triggers for (b), a
near-miss doped with its own rule's trigger for (c), and an empty router as a
matcher mutation. A scorer that cannot go red is not evidence.

## The decision rule — stated once, in full

Council 2026-08-23 (2 members configured, **1 answered** — the second returned
`cli_quota_exhausted`, so this is a DEGRADED reading and not convergence)
resolved blocker `b-behavioural-equivalence-unmeasurable` as **modified option
B**: run the deterministic endpoints, publish the table, and make any default
change conditional on all four holding — skipping 2.3's live host census, whose
cost the same verdict judged not worth paying for a fourth reading of a property
three offline endpoints already establish.

1. **Any endpoint fails** → the failing row is published under
   `internal/bench/reports/`, the shipped default does NOT move, the delivery
   mode stays opt-in, and the roadmap archives with the failing row. This is a
   legal outcome of step 2.4, not a defeat.
2. **All four hold** → the mode is licensed as *delivery-equivalent and cheaper*,
   Claude-only, and `docs/CLAIMS.md` gains an entry whose `claim:` names delivery
   equivalence and cost and contains neither "quality" nor "behaviour".
3. **The shipped default still does not move in this run.** The flip is scoped to
   Claude by construction — a thin projection without a body-delivering hook is
   the pointer arm that already scored 36.2 %, and hook-less hosts cannot run the
   concern at all — and it carries an unpriced activation charge: `rule-inject`'s
   registered 20,480-byte emission sits above the 4,096-byte `user_prompt_submit`
   and 2,048-byte `pre_tool_use` slot sums. Those two rows are the flip's cost and
   the flip's run must pay them.
   *(Latency is NOT part of that charge, and this sentence was corrected rather
   than left standing: it read "gate-open latency reads p95 87.8 ms against a
   250 ms slot budget" until the tokenizer was removed from the concern's module graph and the cap moved to bytes (see `_lib/rule_injection.ts`'s header), after which the same measurement reads **p95
   0.61 ms**. The 87.8 ms was a tokenizer load, not delivery work.)* The single council member's own hedge is recorded
   with it: *"flag to owner for post-roadmap review given the authority question
   is genuinely close."*

**Host scope: Claude.** Named here because the endpoint readings do not transfer:
on a host with neither slot bound, the delivery mode degrades to the pointer arm.

## Kill criteria

- A supported host version stops firing either bound slot, or starts firing them
  inside child sessions — either invalidates the delivery model
  (`agents/evidence/investigations/subagent-start-payload-probe.md` is the
  measurement to re-run).
- The corpus grows a labelled rule that endpoint (b) marks unreachable.
- `rule-inject` is observed emitting bytes with `lean_projection.mode` unset.
- ADR-202's `review_trigger` (c) fires and a reliable behavioural instrument
  exists — at which point this PREREG is superseded rather than amended, because
  its whole shape is built around that instrument's absence.
