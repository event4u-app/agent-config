# Subagent Routing (Phase 2 — downshift + quota arbitrage)

How a delegated sub-task's model is chosen. The orchestrator stays on the
session / high tier and routes each sub-task to the **lowest-capable** tier it
declares (cost + speed via model downshift). Quota arbitrage is an optional
bonus layered on top. Vendor-neutral throughout — no `.md` here names a
provider's model or billing rule.

## Inputs

- The sub-task's declared `model_tier` (`lite | medium | high | frontier |
  inherit`, per [`model-recommendations`](../model-recommendations.md)).
  `frontier` (ADR-232) is declarable and opt-in; it is never the resolution of
  `inherit` — see the top-band invariant below.
- `subagents.downshift`, `subagents.quota_arbitrage`, `subagents.model_map`
  (see [`auto-orchestration-activation`](auto-orchestration-activation.md)).
- The host-capability manifest's `separate_quota_pool`
  ([`host-capability-manifest`](host-capability-manifest.md)).

## Policy

```
ORCHESTRATOR STAYS ON THE SESSION / HIGH TIER.
A SUB-TASK RUNS ON THE LOWEST-CAPABLE TIER IT DECLARES (downshift on).
QUOTA ARBITRAGE IS A BONUS, NEVER LOAD-BEARING — REMOVE IT AND ROUTING IS
THE SAME MINUS THE QUOTA WIN.
```

1. **Downshift off** (`downshift: false`) → every sub-task runs on the session
   tier. No routing change.
2. **Downshift on** → a sub-task runs on its declared tier; an `inherit` task
   runs on the session tier, **bounded by the top-band invariant below**. The
   tier resolves to a model alias via `model_map`; an empty entry means "use
   the tier's runtime default" — never a baked-in provider model name.
3. **Quota arbitrage** → prefer the **separate** quota pool for the sub-task
   **only when** `subagents.quota_arbitrage == true` **and**
   `manifest.separate_quota_pool == true`. Otherwise the shared pool is used and
   the tier/model choice is unchanged. This is the only place the
   "Sonnet-has-its-own-allowance" idea lives, and it lives as a runtime-detected
   flag, never as portable prose.
4. **Budget routing — ARCHIVED 2026-08-16, there is no fourth step.** This
   position used to describe a budget relation applied after the tier resolves
   per 1–3: cheapest classifier-adequate tier WITH available budget, an atomic
   pre-dispatch reserve, a cool-down on quota errors. None of it exists any
   more. A converged AI-council verdict (anthropic + openai, 2 of 2) archived
   `pickTier` and the permit lifecycle, because the `routing_switch` they
   required lost its only source when `subagents.budget_routing` was deliberately
   deleted by always-on orchestration — so wiring meant inventing a replacement
   for a removed category — and because `session_tier` sits non-null in 0 of 327
   records, leaving the saving unmeasurable in principle. Migration record and
   the union revisit-if:
   [`budget-routing` contract](../../../../docs/contracts/budget-routing.md).
   **Tier resolution therefore ends at step 3.** What survives of the module is
   `TIER_ORDER` and `readCooldowns`, read by `routing:doctor` as a diagnostic —
   monitoring, not routing, and note that nothing writes the cool-down file any
   more, which is why the doctor reports that state as *unavailable, no
   producer* rather than as a measured "not cooling".

### The top-band invariant (binding)

```
UNDER A TOP-BAND SESSION, `inherit` RESOLVES TO AT MOST `high`.
A SLICE THAT GENUINELY NEEDS THE SESSION'S OWN BAND DECLARES IT.
ONE TOP-BAND CONTEXT PER TASK — THE ORCHESTRATOR'S. NEVER A SECOND BY DEFAULT.
```

Read as one line: an undeclared slice under a top-band session runs at most
`high`, never the session's own band.

`inherit` means *model-agnostic*, not *whatever the session happens to cost*.
Left unbounded it is the one declaration that silently buys the most expensive
band available, for exactly the slices whose authors judged the model choice
not to matter — the weakest possible reason to spend the most.

**The clamp is `high`, not the top mapped tier, and the distinction is not
cosmetic.** ADR-232 added `frontier` to the tier→model map, so the top *mapped*
rung is now `frontier`; clamping there would clamp nothing. The bound is the
top **generally-recommended** band, which is what
[`model-recommendations`](../model-recommendations.md) already states from the
other side — its `frontier` row reads *"Never the resolution of `inherit`"*.
This clause is that same rule written where the resolution actually happens.

Consequences, stated so the cost stays visible rather than removed:

- A slice that needs `frontier` **declares `model_tier: frontier`** — a value
  § Inputs above lists as declarable, precisely so this escape hatch is legal
  rather than instructed-but-forbidden. The declaration is the whole point:
  the spend becomes an authored decision with a name on it instead of a
  default nobody chose.
- The clamp changes only the **undeclared** case. Every explicit
  `model_tier:` is honoured verbatim, upward included.
- A session running *below* `high` is untouched — `inherit` still resolves to
  the session tier. "At most" is a ceiling, never a floor, and this clause
  never promotes a slice.
- A **declared `frontier` implementer** keeps its band, and its judge is
  governed by [`subagent-configuration`](../subagent-configuration.md)
  § The judge cap — which handles that case explicitly rather than leaving
  the reviewer weaker than the author.

**Honest scope.** This is a policy clause in a context file, so it binds the
agent that reads it and nothing else; no gate re-derives an `inherit`
resolution at dispatch time. `enforced_by: none`, deliberately — the same
boundary the safety-floor rules state for their own obligations.

### The non-escalation floor (binding)

```
A SLICE WHOSE DISPATCH OVERHEAD EXCEEDS THE SAVING FROM DOWNSHIFTING
STAYS IN-SESSION. SPLITTING WORK WHOSE OVERHEAD EATS ITS OWN SAVING
IS THE ANTI-GOAL, NOT THE MECHANISM WORKING.
```

Every dispatch pays a fixed cost the in-session path does not: the slice's
prompt is re-sent to a fresh context, the return is read back, and the
orchestrator verifies it. Below some slice size that overhead exceeds
whatever the cheaper tier saved, and the delegation is a net loss dressed as
an optimisation.

**The floor is a rule, not a number — and the reason is measured, not
assumed.** The step that authored this clause expected the same-band spawn
distribution to supply the number. It cannot, and the corpus says so
precisely. Over the full 327-record `orchestration` corpus (2026-07 plus
2026-08):

| Field the saving model needs | Non-null records |
|---|---:|
| `dispatch_tokens` | 40 |
| `tier_chosen` | 1 |
| `session_tier` | **0** |

The three must co-occur on one dispatch to model a reduction, so the usable
intersection is **zero**. This is not a small sample — it is an empty one, and
`orchestration_savings_report.ts` already prints exactly that conclusion
(`MODELED cost reduction: n/a (needs dispatch_tokens + session_tier +
tier_chosen on a dispatch)`). `token_delta` does not rescue it: the hook
writes it as a constant `0` with provenance `estimated`, deliberately, because
no in-session counterfactual exists on disk to difference against.

So the floor binds as a judgement with a named direction rather than a
threshold:

- **Default to in-session** when the slice is small enough that stating it
  costs about as much as doing it — a single-file edit, one grep, one
  question with a known answer.
- **Delegate** when the slice carries its own reading (a file set to sweep, an
  independent verification, a search whose output you do not want in context)
  — there the returned conclusion is the saving, and it is not in tokens.
- **Never delegate to hit a target.** A dispatch count is not an outcome.

*Revisit-if:* a single dispatch record carries `dispatch_tokens`,
`session_tier` and `tier_chosen` together. At that point the floor is
computable and this clause should be replaced by the number, not amended
toward it. Filling `session_tier` is the blocking gap — it exists in the
schema and on the manual `orchestration_record` CLI path (`--session-tier`),
and the hook that produced all 327 records never sets it.

**Cache trade-off (road-to-cache-economy Phase 4).** A tier downshift changes
the sub-task's model, and the prompt cache is keyed by `(model, prefix)`. The
concern was that a downshifted leg forfeits its model-scoped cache reads AND
splits a cohort's shared prefix into two caches (downshifted legs vs.
session-tier legs).

**Measured 2026-08-16 —
[`downshift-vs-cache.md`](../../../../agents/evidence/analysis/downshift-vs-cache.md),
611 subagent legs / 16,612 calls.** The first half does not hold: a subagent
leg's **first call realizes 2.8 % cache read**, so it starts cold and does not
inherit the session's cache — a downshift forfeits a cache the leg never had.
The cache is not lost, it is created on the other model and then read for the
rest of the leg (median 18 calls per leg, ~96.9 % read share). The second half
is **not measured** — nothing sizes cohort prefix sharing — but it is bounded
above: prefix splitting is a write-side cost, and writes are **3.1 %** of
subagent billable input against a 96.9 % read surface. Even attributing every
write to splitting, the two sit about an order of magnitude apart, in favour of
the downshift, so the direction does not depend on the unmeasured fraction.

This resolves the direction; it does not license downshifting as a target. The
cold start is paid per leg regardless of tier, which is precisely what the
non-escalation floor above bounds. Analogous downgrade/cache coupling on the
council side: see
[`docs/contracts/ai-council-config.md`](../../../../docs/contracts/ai-council-config.md)
§ `model_downgrade` for the analogous downgrade/cache coupling this suite
already ships on the council side.

## Why vendor-neutral

A separate-quota-pool is a billing quirk of one host at one time. Encoding it
as `manifest.separate_quota_pool` (resolved per host) keeps the package
portable: hosts without it route identically, just without the bonus. No skill,
rule, or context asserts "model X is free".

## Reference implementation

[`src/scripts/_lib/subagent_routing.ts`](../../../../src/scripts/_lib/subagent_routing.ts)
(`resolveSubagentRouting`), covered by
[`tests/scripts/_lib_subagent_routing.test.ts`](../../../../tests/scripts/_lib_subagent_routing.test.ts).
Tier vocabulary + cool-down state:
[`src/scripts/_lib/tier_budget_routing.ts`](../../../../src/scripts/_lib/tier_budget_routing.ts)
(`TIER_ORDER`, `readCooldowns` — the budget decision layer that used to live
there is archived, see step 4), covered by
[`tests/scripts/tier_budget_routing.test.ts`](../../../../tests/scripts/tier_budget_routing.test.ts);
live state: `agent-config routing:doctor` (orchestration section).

## Related

- [`subagent-configuration`](../subagent-configuration.md) — implementer/judge model + parallelism.
- [`auto-orchestration-activation`](auto-orchestration-activation.md) — the enable/auto gate that runs first.
- [`host-capability-manifest`](host-capability-manifest.md) — source of `separate_quota_pool`.
