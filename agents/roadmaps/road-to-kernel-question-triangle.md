---
complexity: lightweight
status: ready
---

# Road to the kernel question-triangle amendment — one line, human-applied

> **Source:** spawned from the routing-correctness roadmap's deferred kernel
> step (2026-08-04, deferred-resolution per roadmap-management § 4b).
> AI-council verdict A1 (2026-08-04): the amendment ships as its OWN PR
> through the kernel process — blast-radius separation from feature work.
> The host edit gate independently denies agent writes to this kernel
> ask-policy rule (correct per security-sensitive-stop § self-modification),
> so the application is maintainer-owned end to end.

### blocker: kernel edit is maintainer-owned

- owner: maintainer
- Resolved when: the maintainer applies the one-line amendment below in its
  own PR and the ≥24 h kernel soak passes.

## The amendment (drafted, ready to apply)

In `src/rules/ask-when-uncertain.md` (line 21), replace

```
Even if trivial or independent — exactly one.
```

with

```
Even if trivial or independent — exactly one. Band-4 scope: this law caps the
count for questions that clear the `autonomous-execution` trivial bar — a
trivial workflow question below that bar is not asked at all (per
`agent-authority` band 4); the cap never licenses the ask.
```

"even if trivial" stays literal (the string-level verify), the band-4
qualifier removes the contradiction with `autonomous-execution` ("trivial
workflow questions are noise — just act") and `no-cheap-questions` IL4.

## Phase 1 — apply through the kernel process

- [ ] Apply the one-line amendment in `src/rules/ask-when-uncertain.md` —
      own PR, no other rule edits riding along.
      *Verify:* string-level — "even if trivial" coexists with the band-4
      qualifier; the literal texts no longer contradict.
- [ ] Same PR: `task sync` + `task generate-tools` (dist + projections) and
      `check_kernel_prefix_stability --update-baseline` (the kernel prefix is
      the KV-cache anchor; the baseline re-anchor is the sanctioned path —
      `contexts/authority/kernel-rule-edits.md`).
      *Verify:* Rule Backstops kernel-prefix gate green on the PR.
- [ ] Respect the slow-rollout guarantee: ≥24 h between kernel-rule merges
      (`scope-control § Kernel-rule edits`).
      *Verify:* merge timestamp ≥24 h after the previous kernel-rule merge.

## Success criteria

- The question triangle (ask-when-uncertain × autonomous-execution ×
  no-cheap-questions IL4) carries no contradicting literal texts.
- The amendment landed as its own PR with the kernel-prefix baseline
  re-anchored in the same PR.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-04 | reviewer: claude/host -->
| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Kernel-prefix cache invalidation | implementation | Editing a kernel rule moves the KV-cache anchor; without the sanctioned baseline re-anchor in the same PR the prefix-stability gate reds every later PR | Re-anchor `check_kernel_prefix_stability --update-baseline` in the SAME PR as the amendment (the documented path) | Phase 1 — apply through the kernel process |
| 2 | Amendment weakens the one-question law | product | A band-4 qualifier on an Iron Law can be read as licence to ask more, inverting the law it is meant to reconcile | Wording keeps "even if trivial" literal and states the cap "never licenses the ask"; the string-level verify pins both texts | The amendment (drafted, ready to apply) |
| 3 | Soak window skipped under momentum | implementation | Merging inside 24 h of another kernel-rule merge defeats the slow-rollout guarantee that exists to bound blast radius | Explicit merge-timestamp check as its own step; the guarantee is not liftable by an autonomy mandate | Phase 1 — apply through the kernel process |

<!-- Register added 2026-08-04 by the plan-governance-gates PR (Gate R1 adoption):
     this roadmap was first committed ON the gate activation date, so under the
     strictly-before grandfather bound (docs/contracts/plan-review-gates.md § 1)
     it has no pre-gate baseline and carries a register like any new plan. The
     roadmap's own content and its maintainer-owned blocker are unchanged. -->
