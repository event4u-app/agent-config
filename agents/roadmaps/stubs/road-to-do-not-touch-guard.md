---
complexity: lightweight
---

# Stub: road to a `do_not_touch` write guard

> **Stub — not active work.** Drain-run transfer, 2026-08-22, from
> [`road-to-subagent-lifecycle-integrity.md`](../archive/road-to-subagent-lifecycle-integrity.md)
> Phase 7 Step 1. Council disposition 2/2 convergent, recorded in
> [`agents/evidence/council/subagent-lifecycle-closeout-2026-08-22.md`](../../evidence/council/subagent-lifecycle-closeout-2026-08-22.md)
> § Decision 2(c) and 2(d).

## What moved here

The advisory `pre_tool_use` concern that would warn when a write targets a path
the current recycle envelope lists under `do_not_touch`.

**Its first blocking condition is DISCHARGED and stays discharged.** Condition
(a) was measured in the parent on 2026-08-20: 13 envelopes exist, **6 carry a
non-empty `do_not_touch`**, and 3 of those are entirely path-shaped. The field
is used, so the parent's falsifier — "cancel the guard if the field is unused" —
is **refuted**, and this stub is not a cancellation. The caveat travels with the
count: the envelopes are gitignored runtime state, so the measurement is
machine-local and not reproducible from a clean clone.

## Why it is not being built — two undecided questions, not a missing producer

**(c) Matching semantics.** `isPathRef` is a SHAPE predicate: it answers "is
this one token", never "does this entry cover that write target". Choosing a
matcher now would **silently choose the policy language** — the roadmap has not
decided whether an entry denotes a file, a directory subtree, a pattern, or a
source reference. The worked case is real, not hypothetical: one live entry is
`agents/roadmaps/later/`, which validates and, under exact-string matching,
matches nothing.

The council explicitly declined to make segment-boundary directory matching the
presumptive default, because inferring the type from a trailing slash is the
same defect as the shape confusion above.

**(d) Publication point.** The list has to be readable per tool call, and the
route the step's own text preferred does not exist: `handoff-context` binds on
`session_start` only, and `consume_recycle_envelope` is consume-on-read —
every non-`absent` outcome renames the envelope. By the time a `pre_tool_use`
fires, the source is gone.

`recycle-envelope.consumed.json` is **struck from the option set**, and the
reason is narrower than "it is stale": a successful current-session consumption
can leave a current-session consumed file, so the defect is **indeterminate
provenance** — the reader cannot tell which it has. Session state written by the
consumer is recorded as an unproven design direction, not a decision.

**(c) and (d) are not independent.** (c) cannot be validated without (d)
supplying test data, so shipping (c) first would canonise semantics for data
that cannot reach enforcement. If either ever ships, (d) goes first.

## The probe that promotes this stub

```
A VERSIONED do_not_touch SCHEMA EXISTS, AND A PUBLICATION MECHANISM BINDS THE
LIST TO THE ACTIVE INVOCATION. BOTH, OR NEITHER.
```

**Schema** — distinguishes at least: workspace-relative exact files;
workspace-relative directory subtrees; whether `file:line` refs are rejected or
separately typed; whether globs are supported at all. Plus adversarial matcher
tests over `..`, absolute paths, workspace escape, symlinks, nonexistent
targets, case, separators, directory boundaries, and malformed syntax.

**Publication** — binds invocation id, producer, workspace, creation time,
expiry, and deterministic cleanup; provably available before the first relevant
tool call; concurrency and recycle tests passing.

## Two conditions on shipping, carried forward rather than decided

- **Authority boundary.** A subagent-authored field would constrain the
  *parent's* tool execution. Which subagents hold that authority, whether the
  list is mandatory or advisory, and how it is revoked are unanswered. The
  council named this the most important unresolved issue and it is neither (c)
  nor (d).
- **Per-turn cost.** The `pre_tool_use` chain already runs 11 concerns on
  augment (`hook_manifest.yaml:895`) and 12 on claude and cowork (`:903`,
  `:957`). A further concern is a latency cost on every tool call, so a
  hook-latency reading gates the rollout rather than following it.
