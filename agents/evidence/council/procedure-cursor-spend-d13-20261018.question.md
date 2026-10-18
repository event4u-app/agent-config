<!-- evidence-type: analysis -->

<!-- The prompt given to the council on 2026-10-18, committed verbatim so the
     verdict beside it can be checked against what was actually asked
     (evaluator-independence: a recorded verdict whose prompt is not
     recoverable is not evidence). Not edited after the run. -->

# Authorise the spend of a three-arm measurement, and within what ceiling?

Repository: `event4u/agent-config`. Roadmap `road-to-steps-the-skill-cannot-skip` splits long procedure skills into a short head plus a machine-readable step file, and adds an opt-in "cursor" in its `/work` engine. Phase 6 measures whether either helps before anything becomes a default.

## Authority for this question

The repository owner delegated the resolution of open decisions to this council on 2026-10-18, verbatim: "versuche die offenen entscheidungen im ai council zu lösen" ("try to resolve the open decisions in the AI council"). On 2026-10-16 the owner wrote, verbatim: "frag so einen scheiß den council nicht mich. ich will nicht immer gestört werden" ("ask the council things like this, not me; I don't want to be disturbed all the time"). Decision D13 (AI council, 2026-10-14, 2/2) refused the open-ended spend as first written, required a fixed workload with pinned model, retry policy, token and monetary maxima and an aggregation rule, and said the stated maximum is "put to the owner for authorisation before any run". D13's revisit-if: "a delegated spend threshold is recorded and the stated maximum falls under it".

## The question

Pick one, or propose another (these options are this lane's framing, not the roadmap's):

- **(a)** authorise Phase 6 now within a ceiling this council states (USD and tokens for the whole workload), which the pre-registration (6.1/6.4) must then freeze as its `max_cost_usd` / `max_tokens`; any overrun stops the run;
- **(b)** authorise only runs on subscription transport (no billed API spend, $0 USD), with a token ceiling; any billed spend needs a new decision;
- **(c)** do not authorise yet: the pre-registration (6.1–6.4) is written first with a computed maximum, and the authorisation is decided with that figure in hand;
- **(other)** name it.

## Evidence

- Phase 6 has not started: no file exists under `agents/evidence/preregistration/`; the corpus, metrics and maxima are not written. No monetary maximum has been computed anywhere.
- Workload as amended (D16, two pilots `existing-ui-audit` and `project-analyzer`): 3 arms (monolith / split without cursor / split with cursor) × 3 runs per case × 20 tasks = **180 task runs**, each invoking a skill explicitly in a host agent session, graded by the host's plugin-eval command with a baseline arm and a tool-order grader, under the repository's evaluator-independence rule.
- The pre-registration must also freeze: a pinned model and settings, failure and retry handling (no unplanned reruns), a token maximum and a monetary maximum for the whole workload, and the aggregation rule with confidence treatment.
- Spend settings: `cost.budgets` (user-global and project) is **not set on any layer**; its default is `daily: 0, weekly: 0, monthly: 0`, where `0` means "unbudgeted — no enforcement, `cost:check` reports spend only". So no delegated spend threshold is recorded.
- A 2026-10-06 council verdict on this repository's spend controls: an unattended-run budget is a safety precondition, not a ceiling — "requiring a decision is not the same as making one"; the package does not say what a run costs at most, it says you must state it.
- Council runs in this repository use subscription-authenticated CLI transports and have billed $0.00; the owner instructed on 2026-10-07 that council work runs through the CLI, not the billed API. Whether a 180-run host-eval workload runs on a subscription or billed transport depends on how the eval command is invoked; it is not established here.
- Nothing else in the roadmap waits on this: Phases 4 and 5 were decided council-decidable and need not wait for Phase 6 (D14). Phase 6's result decides whether the split ships and whether a cursor default is put to the council.

## Omitted

The step texts of 6.1–6.5 are summarised, not reproduced. No cost estimate per run is given because none exists in the tree; any figure you state is your own.

## Answer format

Choose one option (or propose one), with reasoning in one or two paragraphs. If you choose (a) or (b), state the ceiling explicitly (USD and tokens). End with exactly these lines:

CHOICE: <a:<usd>/<tokens>|b:<tokens>|c|other>
OWNER-ONLY: <yes|no>

OWNER-ONLY is `yes` only if the decision requires a human action (a physical or forge/UI action, a human-run probe) or a governance self-amendment; otherwise `no`.
