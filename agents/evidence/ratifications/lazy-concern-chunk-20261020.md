<!-- evidence-type: ratification -->
---
proposed_by: claude-opus-5 session 42c8753e (drain run, 2026-10-20)
implemented_by: claude-opus-5 session 42c8753e and its lane agents
reviewed_by: AI council, two provider-diverse seats, round r2 of 2026-10-20
providers: [anthropic, openai]
verdict: confirmed-non-expanding
seats:
  anthropic: confirmed-non-expanding
  openai: confirmed-non-expanding
effective_after: merge
---

# The lazy-concern chunk — confirmed non-expanding, 2/2

## What was reviewed

The chunk mechanism alone, after both session concerns were withdrawn:
`src/scripts/hooks/lazy_concern.ts`, the `resolveConcernMain` join in
`concern_registry.ts`, the one-line branch change in `dispatch_hook.ts`, the
chunk entry in `src/config/hook-bundle-budget.json`, and the manifest removals
that took `update-notice` and `update-auto-invite` out again.

Prompt, verbatim and committed:
`agents/evidence/council/lazy-concern-split-20261020.md`.

## Why there was an earlier refusal, and why this is not an appeal against it

The **bundled** change — the chunk plus the two new concerns — was refused 2/2
on the same day (`lazy-concern-authority-expansion-20261020.md`). That verdict
stands and nothing here reopens it. The concerns are out of the manifest and
their roadmap steps are reopened behind a Class-2 blocker. What was put to the
seats this time is the narrower question they themselves left open: whether
the chunk on its own expands anything.

## The verdict, in the seats' own terms

Both seats answered **no**.

`anthropic` — *"Does this expand authority? No. The manifest changes are
removals. The chunking changes how code loads, not what it may decide or when
it runs."* Recommendation: ratify.

`openai` — *"Removing every registration of `update-notice` and
`update-auto-invite` … leaves no identified new decision, event binding,
installation trigger, or user-question authority. Chunking changes the loading
mechanism, not what an existing concern may decide."* Bottom line: *"authority
classification approved."*

## What the seats asked for and did NOT make a condition of ratifying

Both placed their remaining asks **after** this verdict, explicitly.
`anthropic`: strengthening the fallback proof with an integration test is
*"the right ask before shipping, not before ratifying"*. `openai`: *"Then
ratify the change as non-expanding, with the stdin-isolation replacement and
cold/warm latency measurement tracked separately."* They are recorded here so
the follow-up is not lost, not because the verdict is conditional on them:

1. **A dispatcher-level matrix around `_run_concern`** — invalid or undigested
   chunk → the historical spawn runs once with the expected concern and
   envelope; valid chunk → the chunk runs once and the spawn does not; load or
   init failure → the fallback still runs once; chunk *execution* failure →
   the intended behaviour tested explicitly rather than left ambiguous about
   duplicate side effects. **Not written.** What this change adds instead is
   `tests/hooks/lazy_concern_resolution.test.ts`, which closes the join both
   seats identified — that a `null` from the loader becomes a `null` from
   `resolveConcernMain`, which is the value `_run_concern` branches on. That is
   narrower than the matrix and is stated as such.
2. **The `globalThis` stdin slot** is not `AsyncLocalStorage` and not explicit
   envelope passing. Concerns run synchronously and one at a time today, so
   nothing overlaps — a property of the execution model, not a guarantee.
3. **The latency effect of moving `chat_history` into a chunk is unmeasured.**
   The 2026-10-18 round that chose this mechanism for the egress engine asked
   for that measurement and has still not received it.

## The justification that collapsed, recorded because the record is the point

The chunk was built to buy byte headroom for the two concerns. That reason
expired the moment they were withdrawn, and this change was nearly closed as
pointless. The replacement is a measurement, not a rescue: after #2533 merged,
the hook bundle on `main` reads **1,549,984 B against a 1,550,000 B ceiling —
sixteen bytes**. In this one session the budget gate fired twice on ordinary
work, once 27 bytes over and once 585. With the chunk the same bundle measures
**1,450,501 B**.

Both seats were told the original case had collapsed before they ruled.

## Honest limits of this artifact

The seat verdicts in the frontmatter are transcribed by the party that gained
the ratification. The council responses are gitignored, so no reader of this
file can verify from the tree that these two seats said these two things —
that is a known property of the contract, not a gap introduced here. The
prompt is committed so at least the question is auditable.
