---
complexity: lightweight
review_by: 2026-09-25
---

# Stub: road to the direct-order merge-confirmation doctrine

> **Stub — not active work.** A **drain-run transfer**, created 2026-08-23 when
> [`road-to-merge-op-split-and-negation-guard.md`](../archive/road-to-merge-op-split-and-negation-guard.md)
> was drained. It carries the one thing that roadmap could not do: a kernel-rule
> edit. Outcome state recorded on the parent: **transferred**.

## Probe that promotes this

```
A MAINTAINER (NOT AN AGENT) IS READY TO OPEN A KERNEL-RULE PR
AND SERVE ITS >=24h SOAK WINDOW.
```

Nothing else promotes it. Every other prerequisite is already satisfied: the
analysis is complete, both options are costed, and the decision is one line
wide. What is missing is write authority an agent structurally does not have.

## Why an agent cannot do this — mechanism, not policy

`src/rules/agent-authority.md` and `src/rules/non-destructive-by-default.md` are
both in the nine kernel rules listed at
`src/scripts/hooks/block_kernel_rule_writes.ts:10-12`. An agent write to either
is a **tool-call-time deny**. This is not a rule an agent is declining to break;
it is a guard that refuses. `src/rules/scope-control.md` § Kernel-rule edits
additionally requires an own PR plus a soak window between kernel merges.

## The gap

`agent-authority.md:16` puts a prod-trunk merge in the Hard Floor band.
`non-destructive-by-default.md:26` requires explicit confirmation **on this
turn**. Read together with a prompt that *is* the confirmation — a user typing
`merge PR #123` — the pair can be read as demanding a second ceremony for a
merge the user just directly ordered.

## The two options, both costed

- **(a)** Amend one or both rules to state that a direct `merge PR #123` **is**
  this turn's confirmation. One line. Requires the kernel PR and the soak window.
- **(b)** Decline the reconciliation and record that a second ceremony after a
  direct order is the accepted behaviour.

## Council disposition — 2026-08-23, 2 of 2 convergent

Verdict **(c)**: descope to this stub rather than take either option. Both seats
reached it independently and gave the same reason — (a) is substantively correct
but mechanically unavailable to an agent, and (b) chooses the more burdensome
doctrine without evidence that the extra ceremony adds safety, which one seat
named "security theater".

Two arguments the seats added that belong with the decision:

1. **The vague-vs-direct distinction.** The "explicit confirmation on this turn"
   requirement reads as aimed at stopping a *vague* approval — "looks good",
   "LGTM" — from implying a merge. A typed `merge PR #123` names the exact
   operation with zero ambiguity, so the double-ceremony reading makes the rule
   capture a case it was never designed for.
2. **A resolution must close the loophole it opens.** Whoever takes option (a)
   must define how a *direct* order is distinguished from a **quoted, replayed,
   stale, or indirect** merge instruction, or "direct order" becomes an
   authorization bypass. The tree already draws that distinction for commit
   phrases (`contexts/authority/commit-mechanics.md`) and for pasted commands
   (`git_authorization_hook.ts` `PASTED_COMMANDS`), so the shape exists to reuse.

## Blocking cost — measured, and it is zero today

```yaml
blocking_cost:
  observations:
    - dimension: blocked_items
      value: 0
      source: "road-to-merge-op-split-and-negation-guard Phases 1-5 all shipped; no step depended on this"
  unknowns: [interruptions, context_tokens]
```

`blocked_items` is a real measured zero: the parent roadmap closed complete with
this gap open. `interruptions` is unknown rather than zero — the drain run that
found the gap operated under one standing authorization, so the second-ceremony
path was never exercised and no interruption count exists to report. **"No cost
was observed" is not "the cost is zero"** on that dimension.

## Reopens when

The probe above returns true — a maintainer is ready to open the kernel PR. The
gap is recorded, not urgent: nothing is blocked, and the cost is one extra
confirmation on a path a user reaches deliberately.
