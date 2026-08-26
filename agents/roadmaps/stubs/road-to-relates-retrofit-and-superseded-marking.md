---
complexity: lightweight
review_by: 2026-09-23
---

# Stub: road to the `relates:` retrofit and `superseded` step-marking

> **Stub — not active work.** Drain-run transfer, 2026-08-24, from
> [`road-to-roadmap-situational-awareness.md`](../archive/road-to-roadmap-situational-awareness.md)
> — targets **4.3**, **5.3** and **AC-5**, outcome state **transferred**. The
> parent closed with 26 of 29 steps executed; these three carried
> owner-reserved decisions in their own deferral annotations, so they are moved
> rather than ticked. The parent's mechanism shipped and is not in question.

## The two residuals

**4.3 — retro-tag the existing estate with `relates:`.** An estate-wide write
that produces no evidence. The parent held it deliberately: *"this is a write
over the whole active estate and produces no evidence, so it waits for an
explicit go rather than riding an autonomous run."*

**5.3 — reaction (e), marking a step the tree already closed.** When a merged PR
has already satisfied the current step, mark it done with
`<!-- superseded-by: #N -->` plus a decision memo. Held deferred because *an
autonomous run writing a completion marker into the source of truth touches
`roadmap-progress-sync` Iron Law 3*. **AC-5** is bound to 5.3 — two of its three
clauses are verified at the criterion; the memo clause is only satisfiable once
5.3 is taken up, so it travels with 5.3 and is not a third item.

## Why they are capability-gated, not demand-gated

The scope decision is made — the parent specified both. What is missing is
**another human**: 4.3 needs an explicit go for an estate-wide write, 5.3 needs
the owner to decide whether an autonomous run may write completion markers into
the source of truth. Per [`README.md`](README.md) § The two classes these are
drain-run transfers, promoted by the probes below and by nothing in the shared
promotion criteria.

## What moved here — the complete list

1. The **decision** for 4.3: may an agent write `relates:` across the estate in
   one pass, and with what edge content where no analysis exists to invent edges?
2. The **decision** for 5.3: may an autonomous run mark a step done off
   `origin/main` evidence, under the specified guard (the step's own `verify:`
   green against `origin/main`, a memo, and the one-strike kill criterion)?
3. If 5.3 is granted, AC-5's memo clause is re-evaluated in the archived parent.

Nothing else moved. The probe, its wiring into every entry point, the `relates:`
field itself, the four shipped reactions and the mid-run refresh are **met**.

### Named producer

**The repository maintainer.** Both items are owner-reserved by the parent's own
annotations — 4.3 as an estate-wide write, 5.3 as a source-of-truth write by an
autonomous run. An agent granting either to itself is the failure the deferral
recorded.

### Probe, and its measured baseline at transfer

Both clauses are **comparisons**, never pinned counts — the estate drains and
grows, and a pinned figure reports FIRED on the first unrelated archival. The
parent's own text says "22 existing roadmaps", measured 2026-08-22; the active
set is 4 today. The count moved by 18 in two days while the defect did not
change, which is the argument for writing the probe this way.

```bash
# Clause 1 (4.3) — how much of the estate still lacks the field?
for f in agents/roadmaps/*.md agents/roadmaps/later/*.md; do
  grep -qE '^relates:' "$f" || echo "$f"
done | wc -l
#   -> 64 at transfer (3 of 4 active, 61 of 61 later). Zero is the re-entry
#      condition for 4.3; any decision recorded against it also satisfies the
#      clause, including a written decision NOT to retrofit.

# Clause 2 (5.3) — is there a recorded decision on autonomous superseded-marking?
grep -rn "superseded-by" src/agent-src/ src/rules/ 2>/dev/null | head
#   -> no live consumer at transfer; the marker is specified in the archived
#      parent and implemented nowhere. A consumer, or a written refusal, closes it.
```

**Measured 2026-08-24: 64 files without `relates:`, no `superseded-by` consumer.**
Re-entry completes per clause — the two are independent and may be taken up
separately.

## Dissent, recorded

None at transfer. The parent's annotations and this transfer agree both items are
owner-reserved; there was no competing reading. What IS worth carrying forward is
the parent's own risk-register row 3: `relates: []` written by reflex, so that a
retrofit granted under 4.3 must not satisfy itself with 64 empty lists and a
boilerplate note.
