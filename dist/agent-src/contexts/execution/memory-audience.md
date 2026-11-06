# Memory Audience

Which cut of the shared memory each spawn audience receives, and who may write
back. The spawn brief that carries the cut is
[`subagent-spawn-contract`](subagent-spawn-contract.md); this file is the
single statement of the cut itself.

## The cut per audience

```
EVERY SPAWN AUDIENCE HAS ONE STATED MEMORY CUT, AND THIS TABLE IS IT.
NO SECURITY-CRITICAL MEMORY REACHES AN UNPAID ROUTE — NOT AS A REF, NOT INLINE.
A REFERENCE IS A LEAD TO VERIFY, NEVER A FACT TO BUILD ON.
```

"The shared memory" is the existing curated store under `agents/memory/` —
nothing here creates a second one (ADR-249 is not reopened). The cut is decided
by **who receives it**, not by what the task wants:

| Audience | What it is | Memory cut |
|---|---|---|
| **orchestrator** | the session that dispatches | The whole curated store, read on demand via `memory:lookup`. The only audience that reads the store directly. |
| **non-fork** | a named subagent on an own or frontier model, starting from an empty context | At most `MAX_KNOWLEDGE_REFS` (5) curated references in `knowledge_refs`, filtered by the ADR-100 guard, rendered into the template's `{{knowledge_refs}}` slot **labelled as leads**. |
| **fork** | a subagent that inherits the orchestrator's context | **Nothing.** It already carries what the orchestrator read; a slice would repeat it. |
| **judge-seat** | a judge, a council member, an adversarial skeptic, a competing candidate | **Facts with provenance only** — `file:line`, command output, the diff. Never curated leads: a shared lead collapses the independence these seats exist to provide, which is why their templates carry no knowledge slot (council neutrality: [`ai-council`](../../skills/ai-council/SKILL.md) § Neutrality guidelines). |
| **unpaid** | a route with no paid terms behind it (ADR-257: may propose and score, never decide) | **No shared memory at all.** Only what the orchestrator hands it for the task, and of that only closed-vocabulary conventions — names from a fixed list, never free text drawn from the store. Its writes are refused at intake. |
| **cheap-paid** | a paid route on a lower-tier model | The **non-fork** cut. It is a paid route, which the owner's answer of 2026-10-29 (OQ-35) puts on the shared side of the line. |

A record written back names its writer as `<audience>[:<id>]` from this table. `memory_signal` refuses `unpaid`, `council-seat` and `judge-seat`, and refuses any class the table does not name; a record without a writer reads `unknown`. The writer is declared by the caller, so the refusal catches a misrouted write, not a forged one — and that is the threat that exists, because the refused seats have no write path of their own: a council seat runs with its tools disabled (`claude --tools ''`, `codex --sandbox read-only`, `src/scripts/ai_council/cli_agency_bounds.ts`), and no unpaid seat exists (ADR-257). Every memory write therefore reaches `emit` through the orchestrator or a tool-bearing subagent, and what the gate refuses is that caller filing a seat's output under the seat's own label. An omitted writer is the caller declaring nothing, which reads `unknown` and is not a refused actor writing. Trusted identity at the write edge would need the host to attest the caller, which nothing here can do.

The table is carried by the templates — implementer templates have the slot,
judge-seat templates do not, which `tests/scripts/subagent_prompt_audience.test.ts`
pins. Which audience a given dispatch belongs to is the orchestrator's call and
is model-carried.
