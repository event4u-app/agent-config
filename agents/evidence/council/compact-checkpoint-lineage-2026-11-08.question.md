<!-- evidence-type: analysis -->

<!-- The prompt given to the council on 2026-11-08, committed verbatim so the
     verdict beside it can be checked against what was actually asked
     (evaluator-independence). Not edited after the run. -->

# Is a pre-compaction checkpoint a sufficient predecessor signal?

You are deciding one design question for a repository that ships rules, skills
and hooks for AI coding agents. Answer on the evidence below. Do not summarise
the evidence back. Name the option you choose, the strongest argument against
it, and anything the options miss.

## Background

The host (Claude Code) compacts long sessions. Hooks fire around it:
`pre_compact` before, and `session_start` with `source: compact` after.

- Two shipped mechanisms already carry state across that boundary keyed by the
  session id: a rule restore writes a pending set at `pre_compact` and reads it
  at `session_start(compact)`; a language pin does the same with a marker file.
- A council round in October 2026 decided that on `compact` the task-state
  record ("continuity record") injects **nothing** — neither the session's own
  record nor another session's — "until a real predecessor-identity signal
  exists". Its reasoning: session-id preservation alone does not establish that
  a record is intended for reinjection, and a non-own id proves only difference,
  not lineage. That round named the session-id question "not measured".
- Measured 2026-11-08 from the host's own transcript files: 274 automatic
  compactions across 123 transcripts kept the same session id across the
  boundary, 274 of 274. No manual `/compact` appears in the corpus.

## The proposal

At `pre_compact`, a hook writes a checkpoint of task state (deterministic
fields computed from on-disk state; no free-text judgement fields), keyed by
(session id, hash of the host-supplied `transcript_path`). At
`session_start(compact)`, the checkpoint is injected only if both keys match
the current session; otherwise nothing is injected, as today. The checkpoint is
written by the session that is about to be compacted, immediately before the
compaction, and is consumed once.

## The question

Does a checkpoint written at `pre_compact` and keyed by (session id, transcript
path hash) constitute a predecessor signal sufficient for
`session_start(compact)` to inject task state?

1. Yes, as proposed.
2. Yes, with conditions (name them).
3. No — name the signal that would be sufficient.
