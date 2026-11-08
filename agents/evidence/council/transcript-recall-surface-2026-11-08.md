<!-- evidence-type: analysis -->
# Council — where should transcript recall live? (2026-11-08)

Prompt, verbatim: `transcript-recall-surface-2026-11-08.question.md` beside this
file. Invocation: user-explicit, design mode, 2 rounds, blind chairman.
Seats: anthropic/claude-sonnet-4-5, openai/codex-default — 2/2 present,
subscription CLIs, $0 billed. Raw responses stay local
(`agents/runtime/council/responses/`, gitignored).

## Verdict — split on the surface, convergent on everything that blocks it

- **openai: option 1, as a narrow experiment.** `session:recall`, CLI first,
  over a transport-independent implementation; an MCP adapter only where a host
  gives it a concrete advantage. Strongest counter it names: a fresh shell may
  have no trustworthy way to identify the invoking session.
- **anthropic: "none of the above", reluctantly option 3.** An MCP tool, but
  only after the need is shown ("justify building it at all first": a failure
  taxonomy showing summaries cannot carry what recall would retrieve) and the
  prerequisites exist.

**Convergent:**
- Not `memory:lookup` — raw session retrieval is not curated memory.
- One core, transports as adapters.
- "Never other sessions" is not a security boundary while a caller-supplied path
  or id selects the transcript; a command cannot confine a shell that can read
  the file anyway, so the guarantee must be stated narrowly.
- Prerequisites before any exposure: host-attested session binding, a named
  owner for the per-turn counter, redaction that fails closed, recall output
  excluded from later searches, telemetry without query or excerpt content, a
  kill switch checked per call.
- "≥ 15 compactions" is a sample floor, not a decision rule; the rule (metric,
  threshold, regression, inconclusive, stop conditions) is pre-registered first.

The earlier candidate `export --recall` is withdrawn by tree evidence, not by the
council: `export` ejects a tool's canonical content into a path
(`src/cli/registry.ts:35`) and reads no session data.

## What the roadmap does with it

`later/road-to-state-and-pins-across-compaction` Phase 3: show the need from
transcripts first (3.1), host-attested binding (3.2, blocker
`recall-session-binding`, which also settles CLI-first versus MCP-first), the
core with the listed safeguards (3.3), the pre-registered decision rule (3.4).

Revisit-if: a supported host supplies a session identity a later call can
verify, or 3.1 shows post-compaction re-reads too rare to matter.
