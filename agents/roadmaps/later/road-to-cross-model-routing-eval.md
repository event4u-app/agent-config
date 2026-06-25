---
complexity: structural
status: later
parent_roadmap: road-to-governance-moat
---

# Road to cross-model routing eval — the falsifiability lever, parked behind its gates

**Trigger:** Spun out of `road-to-governance-moat` (Iron Law 3 resolution,
2026-06-25). That roadmap's P1/P2 shipped; its P3 (cross-model routing eval +
public benchmark) is real but blocked, so it is parked here rather than dropped.

> **Blocked until** all three gates clear: (a) OpenAI **and** Gemini API
> credentials are available to the eval env; (b) an **in-host end-to-end**
> skill-invocation harness exists (measuring what the host actually invokes, NOT
> AC's own trigger-matching — the current `skill_trigger_eval` measures the wrong
> layer per the 2026-06-25 council); (c) a comparative **baseline** (host-native
> routing and/or the external operator-runtime reference) is defined.

## Why parked, not cancelled

Council (claude-sonnet-4-5 + gpt-4o, 2026-06-25) flagged routing-precision
measured *correctly* (end-to-end in-host, with baselines, across models) as a
genuine falsifiability lever for the multi-host claim — but warned the naive
version is a category error (measures config trigger-matching, not in-host
invocation) and is credential-gated. So the work is worth keeping, gated on the
harness + credentials, not shipped as a single-model trigger-match table.

## Phase 1 — In-host end-to-end harness (the prerequisite)

- [ ] Build a harness that measures **what the host actually invokes** for a
  prompt (not AC's trigger-match), with a host-native baseline. Anthropic first,
  then OpenAI/Gemini once credentialled.
- [ ] Define the baseline + the comparison (host-native routing; optionally the
  external operator-runtime reference) so "precision" is comparative, not absolute.

## Phase 2 — Cross-model run + honest publication

- [ ] Run cross-model once credentials land; report precision per model with the
  baseline. Honest-null allowed.
- [ ] Only if the result is comparative and survives review: a public benchmark.
  A single-model, wrong-layer table must never ship as positioning evidence.

## Acceptance criteria

- Measures in-host end-to-end invocation, not config trigger-matching.
- Cross-model with a stated baseline; honest-null is a valid outcome.
- No public benchmark until the above holds.
