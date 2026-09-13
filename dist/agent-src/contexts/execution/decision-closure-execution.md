# Decision Closure — Execution Side

Loaded from [`roadmap-process-loop`](roadmap-process-loop.md) § 3-0 and
§ 5a-residue. Planning closes what it can foresee; this is what the RUN does
with the record it was handed, and with the residue planning could not see.

```
THE `## Decisions` TABLE IS READ BEFORE THE FIRST STEP, NOT WHEN A STEP TRIPS OVER IT.
A ROW IN IT IS A CLOSED DECISION. NEVER RE-DERIVE ONE. NEVER RE-ASK ONE.
A CLOSED DECISION REOPENS ONLY WHEN ITS `revisit if` CONDITION BECAME TRUE —
NEVER BECAUSE A CONTEXT RESET LOST IT, AND NEVER BECAUSE THE ANSWER LOOKS ODD.
```

If the roadmap carries a `## Decisions` section, read it whole and cache it for
the run alongside the cadences (§ 4). Each row is `ID | ownership | resolved by
| decision | evidence | revisit if`, and the contract that governs it is
[`roadmaps` rule 27](../../templates/roadmaps.md).

Three consequences during the run:

1. **A step whose question is already a row executes on that row's answer.**
   The decision was closed in planning; re-deriving it is the repeat the ask
   census counts as a defect, and re-asking it is worse.
2. **A `revisit if` condition that became true reopens exactly that row** —
   resolve it again through the ownership ladder, append the new answer, and
   say which condition fired. One reopen per row per run.
3. **A decision NOT in the table is mid-run residue**, handled by § 5's residue
   rule: technical residue resolves inline through the agent, an independent
   session, the council or the team and is appended to `## Decisions` with the
   step id; owner-owned residue is asked only when the step cannot progress,
   and otherwise the step is parked while independent phases continue.

No `## Decisions` section is not an error: a plan that closed everything inline
carries none. It is a finding only when the plan ALSO carries an unresolved
marker, which `lint_decision_classes` reds at authoring time rather than here.



```
A DECISION THE RUN MEETS MID-STEP IS ROUTED BY THE SAME TABLE THAT CLOSED THE
PLAN. TECHNICAL RESIDUE RESOLVES INLINE AND IS APPENDED TO `## Decisions` WITH
THE STEP ID. IT NEVER BECOMES A QUESTION, AND IT NEVER BECOMES A HALT.
OWNER-OWNED RESIDUE ASKS **ONLY IF THE STEP CANNOT PROGRESS**. OTHERWISE THE
STEP IS PARKED, INDEPENDENT PHASES CONTINUE, AND THE RUN COMES BACK TO IT.
MISSION-LEVEL `BLOCKED` ONLY PER THE TERMINAL-OUTCOMES LIST BELOW.
```

Planning closed what it could foresee (§ 3-0). What is left is residue, and it
is routed identically:

| Residue | What happens |
|---|---|
| `deterministic`, `reversible-technical` | the agent decides and says why |
| `contested-technical` | an independent session, then the council, then the team |
| `critical-technical` | a provider-diverse council; the owner only where a typed op or an owner-reserved dimension is touched |
| `spend-exhaustion` | pause and report — never a question |
| `product-owned`, `business-owned`, `destructive-owned` | the step's progress decides: **blocked on it** → ask now, one question, record the answer · **not blocked** → park the step, continue elsewhere, return |

Every resolution is appended to `## Decisions` **with the step id in the
evidence column**, so a later reader can tell a decision planning closed from
one the run met. `./scripts-run src/scripts/lint_decision_classes` validates
the row.

**Parking is not deferring.** A parked step keeps its `[ ]`, keeps its place in
the count, and is returned to in the same run once the answer lands. It does
**not** take `[~]`, which is a deferral by decision and would let the run reach
`count_open == 0` on work nobody did.

**Scope discovered mid-step is the other table** — agent-owned growth is done
and recorded as a scope delta, council-owned growth routes through the ladder,
and a larger unrelated opportunity becomes a follow-up artifact rather than
expanding the mission. Both lists, closed:
[`scope-mechanics`](../authority/scope-mechanics.md) section Scope growth, with
`./scripts-run src/scripts/scope_growth "<description>"` for a single item.


## What `blocked-by:` may point at, after the retirement

The marker itself is unchanged — `run-continuation` reads blockedness from it
and from nothing else. What narrows is its contents.

A `## Blockers` entry is the record of a decision the agent **correctly did not
own**. An entry that declares `- **Ownership:**` must therefore name one of the
three owner-owned classes: `product-owned`, `business-owned`,
`destructive-owned`. A technical class there says a decision the ownership
ladder could have closed was filed instead, and `lint_roadmap_blockers` reds
it. The field is optional and the check is HARD rather than ratcheted, on the
no-backlog-to-grandfather ground: it is new, so it fires on nothing in the tree
today.

A technical judgement call therefore has no file-shaped home. It routes back
through the closure pass, resolves at the lowest rung that owns it, and lands
as a `## Decisions` row.
