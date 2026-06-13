---
model_tier: inherit
name: council-optimize
pack: product-reasoning
tier: 2
visibility: internal
cluster: council
sub: optimize
skills: [ai-council]
description: Run the council on an optimization target — perf hot path, memory pattern, query, or an /optimize-* output — for ranked, evidence-based suggestions instead of generic advice.
suggestion:
  eligible: true
  trigger_description: "council on this perf hot path, second opinion on this optimization, external review of /optimize output"
  trigger_context: "user has an optimization target (code path, query, profile result, /optimize-* output) and wants a ranked external opinion"
workspaces:
  - agent-config-maintainer
packs:
  - product-reasoning
---

# /council optimize

## Instructions

Specialised council mode for **optimization targets**: hot paths,
slow queries, allocation profiles, or the output of an `/optimize-*`
command (`/optimize-skills`, `/optimize-agents`,
`/optimize-augmentignore`, `/optimize-rtk-filters`). Wraps
`/council default` with the `optimize` neutrality preamble, which focuses
members on **ranked**, **evidence-based** suggestions instead of
generic "you should profile" advice.

### 1. Resolve the target

The user invoked `/council optimize <target>` or `/council optimize`.
If nothing was supplied, ask (one question per turn):

> What should the council optimize?
>
> 1. A file or directory of code (perf hot path)
> 2. A query / SQL / DB call (paste it now)
> 3. The output of an `/optimize-*` command — re-run it now and feed
>    the report to the council
> 4. A free-form description of the bottleneck

Pick **1** → `/council default files:<paths>` with `--prompt-mode optimize`.
Pick **2** → `/council default prompt:"<query + context>"` with
`--prompt-mode optimize`.
Pick **3** → run the chosen `/optimize-*` command first, then feed
its report file to `/council default files:<report>` with
`--prompt-mode optimize`.
Pick **4** → `/council default prompt:"<description>"` with
`--prompt-mode optimize`.

### 2. Capture the constraint

Optimization is meaningless without a target metric. Ask **once**
(one question per turn) before invoking `/council default`:

> What does "better" mean here?
>
> 1. Latency (p50 / p95 / p99 — pick which)
> 2. Throughput (req/s)
> 3. Memory footprint
> 4. Cost ($ / 1M ops)
> 5. Token count (for LLM workflows)
> 6. Other — describe in one line

The chosen metric becomes the `original_ask` for the handoff preamble:
`Optimize for <metric>: <one-line scope>`.

### 3. Run /council default with the optimize mode preamble

Invoke the matching `/council default` form (`files:` / `prompt:`) with
`--prompt-mode optimize`. The `optimize` mode addendum from
`scripts/ai_council/prompts.py` requires members to:

- Rank suggestions by expected impact on the chosen metric, not by
  effort or cleverness.
- Cite the evidence (line, query plan, profile entry) for each
  suggestion. No hand-wave "this is probably slow".
- State at least one suggestion the member explicitly **rejects** as
  low-leverage, so the user does not over-engineer.
- Mark at least one suggestion that requires measurement before
  committing — i.e. flag what is hypothesis vs. confirmed.

The cost gate from `/council default` Step 3 still applies. Render via
Step 5/5a/5b of `/council default`.

### 4. Render the report

Use the standard stacked + Convergence/Divergence layout. Add a
one-line header at the top so the optimization metric is visible:

```
## Council on <target> — optimize for <metric>
```

### 5. Hand back to the user

The council is **advisory**. Do **not** apply optimizations
autonomously. Surface ranked suggestions and let the user pick which
to drive into a normal `/work` / `/implement-ticket` flow.

### Hard floor (restated)

`/council optimize` produces **text only**. It does NOT edit code,
run benchmarks, or change configuration.

## Failure modes

- **No measurable metric** → if the user picks "Other" without a
  unit, ask once for clarification; if still vague, stop. Generic
  "make it better" is exactly what this command refuses to enable.
- **Target too large** → bundler raises `BundleTooLarge`; suggest
  narrowing to the hot path (`/council default files:<single-file>`).

## See also

- `/council default` — base orchestration entry point.
- `/optimize-skills`, `/optimize-agents`, `/optimize-augmentignore`,
  `/optimize-rtk-filters` — internal optimization commands; their
  output can be fed to `/council optimize` for an external ranking.
- `ai-council` skill — neutrality guidelines.
