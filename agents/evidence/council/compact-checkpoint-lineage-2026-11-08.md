<!-- evidence-type: analysis -->
# Council — is a pre-compaction checkpoint a predecessor signal? (2026-11-08)

Prompt, verbatim: `compact-checkpoint-lineage-2026-11-08.question.md` beside this
file. Invocation: user-explicit, design mode, 2 rounds, blind chairman.
Seats: anthropic/claude-sonnet-4-5, openai/codex-default — 2/2 present,
subscription CLIs, $0 billed. Raw responses stay local
(`agents/runtime/council/responses/`, gitignored).

## Verdict — split on the option, convergent on the substance

- **anthropic: option 3 (No).** "Writing a checkpoint establishes intent to hand
  off *to something*, but not proof that the reader is the intended recipient."
  Sufficient would be a host-provided single-use token per compaction, or a
  documented host lifecycle contract; failing both, do not inject.
- **openai: option 2, prototype only.** "I would approve a prototype, but not
  production injection as written." Checkpoint writing and lifecycle measurement
  may proceed; injection waits on a chosen guarantee, a trust boundary, failure
  behaviour and validated lifecycle assumptions.

**Convergent:** (session id, transcript path hash) names the session, not the
compaction attempt. A checkpoint left by an aborted compaction matches the next
one, and "consumed once" does not prevent that first wrong consumption. The
274/274 id measurement shows preservation on automatic compactions, not
freshness, pairing or manual behaviour. Both ask which fields may be restored at
all: correct lineage cannot make stale state authoritative.

## What the roadmap does with it

`later/road-to-state-and-pins-across-compaction` Phase 1: write and measure
without injecting (1.2), fault-test the lifecycle (1.3), choose the guarantee and
the restorable fields (1.4, blocker `compact-attempt-identity`), inject only after
that behind its own switch (1.5). The October 2026 verdict (`compact-resume-2026-10.md`)
stands: `compact` injects no task state today.

Revisit-if: the host documents a per-compaction token shared by `pre_compact` and
`session_start(compact)`, or the 1.3 fault tests show a stale checkpoint cannot
become eligible.
