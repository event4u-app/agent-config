---
complexity: structural
status: draft
parent_roadmap: road-to-inbox-harvest-2026-08-e-council-topology-evidence
---

# Road to the deferred council-topology evidence

> **Draft receiver.** This file exists so the 38 `[~]` items deferred out of
> `road-to-inbox-harvest-2026-08-e-council-topology-evidence` on 2026-09-01 have
> a **live destination** that `deferralProblems`
> (`src/agent-src/scripts/archive_completed_roadmaps.ts:414`) can verify from
> both ends. `status: draft` keeps it off the dashboard until a human flips it to
> `ready`; nothing here is scheduled work today.
>
> **`[~]` is DEFERRED, never cancelled.** Every item below is planned and
> carried, with a resumption trigger. The detail — evidence, forbidden claims,
> red-proof tables, execution sequences — lives in the three stubs each group
> names, and is not duplicated here.

## Why one receiver rather than three, and the council split behind it

AI council 2026-09-01, members **anthropic (claude-sonnet-4-5)** and **openai
(codex-default)**, 2 rounds, blind chairman, subscription transport
(`billable=0`, `$0.0000`), quorum `2/2 present, needed 1 — concluded`.

**The seats SPLIT on this question and that is recorded rather than smoothed.**
The openai seat chose **2A**, one draft receiver: *"three receivers add
governance surface without improving preservation if one receiver maps the
groups faithfully."* The anthropic seat chose **2B**, three receivers, on the
ground that the three resumption triggers are non-fungible and one file would
need internal grouping *"which recreates the three-roadmap structure anyway"*.

**2A was taken, and the reason is not that it won a vote.** Each seat attached a
*condition* rather than an absolute, and the two conditions are simultaneously
satisfiable: openai's — one receiver is acceptable **iff** it maps the groups
faithfully — and anthropic's — the distinct triggers must stay
distinguishable. The per-group sections below are exactly that internal
grouping, so this file satisfies both conditions as stated.

**One further fact, recorded because acting on it silently would be worse.** The
anthropic seat's 2B rationale enumerated its three groups as *"Phase 2 + 23
deps"*, a *"Loom group (3 items)"* and a *"Council-topology group (12 items)"*,
with triggers naming `evidence_discipline/runner_arm_v2`, `v8.Isolate` access
and a 200-sample budget. **None of those exist in this tree** — there is no Loom
dependency, no `runner_arm_v2`, and no such budget. Its granularity argument
therefore rests partly on groups it invented, which is why the argument does not
transfer; its *condition* does, and is met. The seat's Question-1 verdict is
unaffected and was reached on evidence that does check out.

## Group A — Phase 2 and its dependents

**Deferred by:** AI council verdict **A3**, 2026-09-01, provisional and
owner-ratifiable (see the parent's `blocker: phase-2-benchmark-cost`).

**Detail:** [`stubs/road-to-council-topology-benchmark-execution.md`](stubs/road-to-council-topology-benchmark-execution.md)

**Resume when all three hold:** `n >= 5` independent eligible seats are
configured; a **verified** 20-consecutive-UTC-day reservation of that capacity
exists (an intention is not a reservation); and no governed-estate headroom
constraint prevents monopolising those seats for the duration. Plus the
fresh-manifest trigger: if the corpus, models, prompts, eligibility rules or
provider configuration change, the frozen manifest is invalid and a new
pre-registration cycle is required.

- [ ] 2.2 Mandatory baselines per eligible slice
- [ ] 2.3 Emit the full metric set
- [ ] 2.4 Stage ablation
- [ ] 2.5 Separate model quality from topology quality
- [ ] 2.7 Round-count bias arm
- [ ] 5.2 Bench identity-blind against identity-visible synthesis
- [ ] 5.5 Revisit ADR-120 only on results
- [ ] 6.5 Pre-registered promotion gate against a fixed-round arm — the
      recorded-gate half is DONE and preserved; only the against-the-arms half
      is carried
- [ ] 7.2 The selector returns an explainable record
- [ ] 7.4 Deterministic policy first, interpretable features only
- [ ] 7.5 Shadow mode first
- [ ] 7.6 Promote per task slice on benchmark evidence only
- [ ] 8.5 Stop when the next call has low expected value
- [ ] 9.1 Same-provider host-subagent fan-out lane as a governed exception
- [ ] 9.4 Benchmark governed bundles after seating is solved
- [ ] 10.4 Compute route regret offline
- [ ] 11.2 Train an offline challenger classifier
- [ ] 11.3 Promotion requires a material Pareto improvement
- [ ] 11.5 Model-generation changes mark affected routing evidence
- [ ] 13.1 Shadow rollout stage
- [ ] 13.2 Advisory rollout stage
- [ ] 13.3 Adaptive rollout stage
- [ ] 13.4 Default-on per slice
- [ ] 13.5 Re-evaluate on model-generation changes

## Group B — the provider-recognition leakage bench

**Deferred by:** the council's **B1** verdict under the **B3** fallback its own
openai seat named, 2026-09-01. **No measurement was taken and none is claimed.**

**Detail:** [`stubs/road-to-provider-leakage-bench-execution.md`](stubs/road-to-provider-leakage-bench-execution.md)

**Resume when** two consecutive UTC-day windows can be reserved with the
per-provider cap free in both, and the run executing them can remain coherent
across the boundary. Each arm is 30 calls per provider against a cap of 50 per
provider per UTC day, so the arms cannot share a day.

- [ ] 3.3 Provider-recognition leakage bench — build the runner, run both arms
- [ ] 3.4 Hold style normalization behind the stronger gate

## Group C — instrumentation and its live-run evidence

**Deferred by:** the council's second pass, 2026-09-01. Every guard named in the
stub is **committed and runs in CI regardless of these checkboxes** — the
council was explicit that they are defensive infrastructure, not blocked work.

**Detail:** [`stubs/road-to-council-topology-instrumentation.md`](stubs/road-to-council-topology-instrumentation.md)

**Resume, per item**, when the population it guards enters an integration branch
or a release candidate (7.3, 10.1, 10.6, 11.1, 12.1, 12.2, 12.3); when the
mechanism is built AND a qualifying real run is scheduled (5.4, 10.2, 10.3);
when one allocated representative analysis run is available in which **every**
answering seat inlines the findings block (1B.1); and when capacity is
explicitly allocated for `>= 10` representative runs with the comparison methods
frozen beforehand (1B.4).

- [ ] 1B.1 Findings schema as a fenced trailing block, replacing the second
      extraction call — the authorised run was made 2026-09-01 and REPRODUCED
      the `codex-default` contract miss; n = 2, not a rate
- [ ] 1B.4 Promotion gate across `>= 10` real analysis runs
- [ ] 5.4 Final synthesis retains unresolved disagreement
- [ ] 7.3 Keep the deterministic/probe path above council
- [ ] 10.1 Extend decision replay with the route record
- [ ] 10.2 Attribute each useful correction to its first stage
- [ ] 10.3 Emit `zero_marginal_value_call_rate`
- [ ] 10.6 Track early-stop savings separately from quality
- [ ] 11.1 Offline training rows without raw prompt content
- [ ] 12.1 `/council` stays the user concept
- [ ] 12.2 A free explain mode
- [ ] 12.3 A force-topology control cannot override the five named authorities

## What this file may NOT be read as claiming

That any deferred mechanism was verified against a real population; that
topology validation is live; that any promotion gate passed; that telemetry is
complete; that Phase-2 equivalence was measured; or that sabotage sensitivity is
positive runtime validation. Each stub carries a per-group forbidden-claims
list, and those lists govern.

**That sentence was not true when this file was written, and was made true on
2026-09-01 rather than softened.** Only the Group A stub carried such a list.
The Group B stub stated the permitted claim and no prohibitions; the Group C
stub carried a list for one of its three internal groups. The missing lists have
been added by transcribing the archived parent's own per-step deferral blocks —
each of which pointed *at these stubs* for its forbidden claims, so the pointer
previously resolved to nothing. Nothing was invented; the transcription sources
are cited inside each new section.
