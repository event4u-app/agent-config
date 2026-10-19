# Council question — authorisation of the Phase 6 measurement spend (road-to-steps-the-skill-cannot-skip, D17 follow-up)

## Context

A roadmap in this repository split two "pilot" skills (`existing-ui-audit`, `project-analyzer`) into a short head plus per-step files, and added a default-off "procedure cursor" (`agent-config work --procedure <skill>`) that hands out one step at a time and withholds step n+1 until step n's exit holds. Phase 6 measures whether either change does anything, before anything becomes a default. Three arms: A = the original single-file skill, B = the split without the cursor, C = the split with the cursor.

On 2026-10-18 the AI council (2 seats, 2/2) decided (D17) that the Phase 6 spend was not authorised yet: first write the pre-registration with pinned model, settings, invocation path, transport, retry policy, aggregation, and a token estimate translated into a worst-case USD figure; then return to the council with that figure for the authorisation decision. A subscription-only authorisation was refused that day because the transport of the eval workload was not established.

## What exists now (2026-10-19)

The pre-registration is written and committed before any run. Its frozen figures:

- Instrument: `claude plugin eval <arm-dir> --ablation none --runs 3 --model claude-sonnet-5-5 --concurrency 1 --keep-temp --no-publish --trust-plugin --max-cost-usd <share> --json <path>`. Claude Code 2.1.303.
- Transport, established: each run is a full `claude` child process on the operator's own credential. `claude auth status` on the operator's machine reports `authMethod: claude.ai`, `subscriptionType: team` (a subscription, not a metered API key). Whether usage past the plan's included amount is billed depends on the organisation's extra-usage setting, which the repository cannot read.
- Workload: calibration 2 pilots × 15 candidate tasks × 3 runs = 90 runs of arm A (a candidate is admitted only if arm A does not meet its success criterion in at least 2 of 3 runs); measurement 3 arms × 3 runs × 20 admitted tasks = 180 runs. 270 runs in all.
- Bound per run: `max_turns: 40`, `timeout_seconds: 1800`. Planning ceiling per run 40 turns × (100,000 input + 4,000 output tokens) → $9.60 at list price for claude-sonnet-5-5 with no cache hits. Programme maximum: 1,123,200,000 tokens, **$2,592 at list price** (calibration $864; $576 per measured arm). The enforced bound is `--max-cost-usd` per invocation; a partial invocation is published as partial, never topped up. Expected spend with prompt caching is a fraction of the maximum.
- Retry policy: no reruns; infrastructure losses count as unsuccessful runs; above 10 % in any arm the result is published as inconclusive.
- Concurrency 1, so the programme holds one seat's share of the shared rate limit while the operator's own sessions run.
- No metric uses an LLM grader; a committed deterministic scorer reads the kept run directories.

Not yet built: the 30 candidate fixture repositories, the scorer, the three arm plugin directories. Building them costs no model calls.

Settings facts: `cost.budgets` is unset on every settings layer (its resolved default is `{"daily":0,"weekly":0,"monthly":0}`), so no delegated spend threshold is recorded. The repository's governance table reserves "spend or liability above a delegated threshold" to the owner and makes "budgeted, threshold-bounded spend" council-decidable. The owner delegated open decisions on this roadmap to the council on 2026-10-18 ("versuche die offenen entscheidungen im ai council zu lösen"), and the current run was started by the owner with an instruction that authorises "paid model/eval calls within configured cost.budgets".

## Question

Which one of these is the right disposition of the Phase 6 spend now?

- **(a)** Authorise the full stated maximum ($2,592 at list price, 270 runs on the subscription transport) under the owner's delegation.
- **(b)** Authorise only the calibration slice (90 runs, $864 maximum) now; the 180 measured runs come back to the council with the calibration result, which also tells whether enough candidates are admitted for the measurement to run at all.
- **(c)** Neither is council-decidable: with no delegated threshold recorded, any monetary maximum above zero is owner-reserved; the authorisation goes to the owner with this figure, and the agent builds only the zero-spend parts (fixtures, scorer, arm directories) meanwhile.
- **(d)** Decline the measurement in its current shape (say what would have to change).

Answer with one letter first, then your reasons, then whether your answer requires an action only the owner can take, and name that action if so. Address the threshold question explicitly: does the delegation of 2026-10-18 or the run instruction's "within configured cost.budgets" cover a monetary maximum when `cost.budgets` resolves to zero?
