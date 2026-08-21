---
complexity: lightweight
status: later
---

# Road to the kernel question-triangle amendment — one line, human-applied

## Outcome — parked 2026-08-20, outcome state `transferred`

**Archived does not mean achieved, and parked does not mean abandoned.** Nothing
in this roadmap was executed and nothing was deleted. It is parked **whole**,
with the drafted amendment preserved verbatim below, because every one of its
three steps is a maintainer act end to end and no part of it is repository work
an agent may do.

Zero of three steps satisfied. The amendment is drafted and ready; what is
missing is the only thing that was ever missing.

> **Parked in `later/` 2026-08-20.** Owner: maintainer.
> **Resume when** `src/rules/ask-when-uncertain.md` carries the band-4 qualifier
> below, i.e. when `grep -c 'Band-4 scope' src/rules/ask-when-uncertain.md`
> returns non-zero. **It returns 0 today** — re-measured on the park date, not
> quoted from the source roadmap.
> **Why parked and not blocked:** the work is not waiting on a decision or on
> evidence. It is waiting on an act that is reserved to a human by two
> independent mechanisms, so there is no state in which an agent clears it.

**Why an agent may not apply it — verified on this checkout, not assumed:**

1. `ask-when-uncertain` is one of the nine locked kernel rules, and writes to it
   are refused at tool-call time by the `block-kernel-rule-writes` guard
   (`src/scripts/hook_manifest.yaml`, `severity: blocking`, `fail_closed: true`).
   The two bypasses its deny message names are both human acts outside the
   session.
2. The rule is the kernel's own ask-policy, so amending it is self-modification
   of a safety surface — `security-sensitive-stop` § self-modification routes it
   through the edit-permission gates rather than applying it because a prompt
   asked.
3. Step 3 is a **≥ 24 h soak between kernel-rule merges**
   (`scope-control` § Kernel-rule edits). Time is not a capability, and the
   council verdict of 2026-08-04 already ruled the amendment ships as its own PR
   for blast-radius separation.

**Framework of record:** the drain-run disposition framework in
`agents/evidence/council/drain-blocker-dispositions-a.md` — `B, transferred`.
`later/` is preferred over a stub here because this roadmap **is** the artefact
the maintainer applies: its body is the drafted one-line amendment plus the
three process steps, so a stub would be a copy of it under a different name.


> **Source:** spawned from the routing-correctness roadmap's deferred kernel
> step (2026-08-04, deferred-resolution per roadmap-management § 4b).
> AI-council verdict A1 (2026-08-04): the amendment ships as its OWN PR
> through the kernel process — blast-radius separation from feature work.
> The host edit gate independently denies agent writes to this kernel
> ask-policy rule (correct per security-sensitive-stop § self-modification),
> so the application is maintainer-owned end to end.

### blocker: kernel edit is maintainer-owned

- owner: maintainer
- Status: open — carried into the park, deliberately not closed. The drain run
  of 2026-08-20 disposed the roadmap (`B, transferred`, parked in `later/`) and
  the blocker is what the park is *on*; marking it resolved would assert an act
  that has not happened.
- Resolved when: the maintainer applies the one-line amendment below in its
  own PR and the ≥24 h kernel soak passes.
- Probe: `grep -c 'Band-4 scope' src/rules/ask-when-uncertain.md` returns
  non-zero. Measured **0** on 2026-08-20.

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
      <!-- parked 2026-08-20: not attempted. Kernel-rule write, refused at
           tool-call time by block-kernel-rule-writes. Box stays open per the
           later/ convention: parked whole, not cancelled. -->
      *Verify:* string-level — "even if trivial" coexists with the band-4
      qualifier; the literal texts no longer contradict.
- [ ] Same PR: `task sync` + `task generate-tools` (dist + projections) and
      `check_kernel_prefix_stability --update-baseline` (the kernel prefix is
      the KV-cache anchor; the baseline re-anchor is the sanctioned path —
      `contexts/authority/kernel-rule-edits.md`).
      *Verify:* Rule Backstops kernel-prefix gate green on the PR.
      <!-- parked 2026-08-20: not attempted. Rides in the same maintainer PR as
           step 1; there is no PR to run it on. -->
- [ ] Respect the slow-rollout guarantee: ≥24 h between kernel-rule merges
      (`scope-control § Kernel-rule edits`).
      *Verify:* merge timestamp ≥24 h after the previous kernel-rule merge.
      <!-- parked 2026-08-20: not attempted, and not attemptable — a soak
           window is elapsed time, not an action. -->

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
