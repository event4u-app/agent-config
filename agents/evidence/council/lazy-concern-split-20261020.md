<!-- evidence-type: original-review -->

# Review the SPLIT change — the chunk alone, both concerns withdrawn

You refused an earlier version of this change on 2026-10-20, 2/2 convergent
(`agents/evidence/council/lazy-concern-authority-expansion-20261020.md`). This
is not that change and not an appeal against your verdict. It is the split you
asked for, brought back for review on its own.

**This is a different question from the one you answered.** You were asked
whether a bundle containing a chunking optimisation *and* two new lifecycle
concerns was non-expanding. You said no, and said the chunking might be
ratifiable separately once its fallback was proven. This asks only that
narrower question.

## What you asked for, and what was done

1. **Split both concerns out.** Done. `update-notice` and `update-auto-invite`
   are removed from `src/scripts/hook_manifest.yaml` — the definitions and
   every event-list entry. Nothing in this diff registers a concern that can
   initiate an install or open a question with the user. The manifest carries a
   comment recording why they were pulled and the argument that lost.
2. **Prove the chunk fallback rather than assert it.** Done, and the proof is
   `tests/hooks/lazy_concern_fallback.test.ts`: six refusing cases — chunk
   missing, malformed, exporting no `main`, exporting a non-function `main`,
   throwing at module initialisation, and present-but-undigested (no integrity
   sidecar) — each asserting the loader returns `null` so `_run_concern` falls
   through to the historical spawn path. Plus one sensitivity case that loads a
   real function, because without it all six would pass against a loader
   hardcoded to `return null`.
3. **The stdin global.** NOT changed in this diff, and named here rather than
   omitted. The per-concern stdin override moved to `globalThis` under
   `Symbol.for(...)` in an earlier commit on this branch because a chunk is a
   second module graph and a module-local override left it reading an
   already-consumed fd 0. You flagged that a single process-global slot is not
   isolation. Concerns in this dispatcher run **synchronously, one at a time**,
   so there is no overlapping execution for the slot to leak across today; what
   you asked for — `AsyncLocalStorage` or explicit envelope passing — would
   make that independent of the execution model rather than contingent on it.
   I did not make that change, because it is larger than this diff and I would
   rather you rule on it knowing it is outstanding than have it slipped in.

## What is factually corrected since you last saw this

The justification you were given contained a false claim and you should know it
is gone. It said `chat-history` is bound on `session_start` alone, making it the
largest narrow-event module. **It is bound on five events** — `session_start`,
`session_end`, `stop`, `post_tool_use`, `user_prompt_submit` — which is close to
the widest-bound concern in the tree. The claim was read off the
`session_start:` rows without checking the others, and it reached the budget
file, a roadmap, a commit message and the prompt you were given.

The size argument does not depend on it: 121,219 bytes that every event pays is
the same whether the concern runs on one event or five, because the cost is the
static inlining, not the invocation. What does not survive is "this is the
cheapest candidate". The genuinely narrow ones, measured: `turn-end-gate`
71,928 B on `stop` alone, `injection-scan` 46,660 B on `post_tool_use` alone,
`skill-route` 31,183 B, `git-authorization` 30,761 B, `session-eol` 27,708 B,
`handoff-context` 25,220 B.

**The latency effect of moving `chat_history` is unmeasured.** The 2026-10-18
round that chose this mechanism for the egress engine asked for that
measurement and did not get it. I am not claiming it; I am telling you it is
missing.

## The measured effect

Bundle: 1,549,961 B → 1,450,762 B against an unchanged 1,550,000 B ceiling. No
`raise_log` entry, no change to `max_bytes`. The ceiling the earlier version
would have had to raise is instead undercut by ~99 KB.

## Files this diff touches that are on the ratification watched set

- `src/scripts/hook_manifest.yaml` — removals only, plus the comment above
- `src/scripts/hook_manifest.json` — recompiled from it
- `src/config/hook-bundle-budget.json` — the chunk entry; `max_bytes` untouched

## The question

Does this split change expand what the agent or its lifecycle hooks are
permitted to decide? If it does not, say so and say whether the fallback proof
is sufficient. If it does, name the specific line.

A refusal is a useful answer. Do not approve it to be agreeable, and do not
treat the earlier refusal as something this diff has to overcome — judge the
diff in front of you.

## Added 2026-10-20, after #2533 merged — the justification changed and is stronger

The original reason for the chunk was headroom for the two concerns you
refused. That reason expired when they were withdrawn, and I nearly closed
this change as pointless. Then I measured.

A parallel session landed the same roadmap's Phase 1/2 and 4 work as #2533.
On `main` **after** that merge, with no chunk and no new concerns:

```
hook bundle: 1,549,984 B / 1,550,000 B ceiling
```

**Sixteen bytes.** Any future change touching a module the dispatcher imports
reds the budget gate. This is not hypothetical — in this one session the gate
fired twice on my own work, once 27 bytes over and once 585.

With the chunk the same bundle measures **1,450,501 B**.

So the question is no longer "does the chunk pay for two concerns". It is
whether the repository keeps a 16-byte margin on a gate that every hook change
has to pass. I think that makes the case stronger rather than weaker, and I am
telling you the original case collapsed rather than letting it stand.

Unchanged and still outstanding: the latency effect is unmeasured, and the
`globalThis` stdin slot is not `AsyncLocalStorage`.
