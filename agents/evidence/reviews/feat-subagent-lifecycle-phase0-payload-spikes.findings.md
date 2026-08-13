# Findings: feat-subagent-lifecycle-phase0-payload-spikes

**Skipped:** no code surface for this completion — the branch changes three markdown files (one new evidence file, the roadmap it feeds, and the regenerated dashboard) and no executable path, scope 865bbe70364fbb7afe9915227d125297e7c992f2bcb241583e1fe94d24434f52, declared 2026-08-13

## Why a skip is honest here rather than convenient

The gate's own count is the evidence: **0 code paths of 3 changed files.** No
shipped behaviour moves on this branch. What it lands is a measurement and the
roadmap edits that measurement forces, and an R2 review's value is that a fresh
reviewer probes a running path — there is none to probe.

That is precisely why the *claims* had to be probed instead, and they were:

- **The reproduction is controlled, not anecdotal.** Two subagents in the same
  turn, same `subagent_type`, same task, same requested output; the single
  varied factor is whether the final block is text or a tool call. Control
  returned the report, treatment returned `(no output)`. Identity is pinned by
  the ledger's own durations (13,949 ms / 18,692 ms) against the host's reported
  14,067 ms / 18,799 ms, so the two records cannot be confused with each other
  or with another session's.
- **The capture facility was verified by running it, not by reading it.** The
  claim that Phase 0 Steps 2 and 4 need no scratch hook rests on the shipped
  dispatcher actually writing a file: `AGENT_HOOK_CAPTURE_DIR` was set, a
  synthetic `SubagentStop` payload piped into `dispatch_hook.ts`, and the
  resulting capture read back. Presence in `dist/hooks/dispatch.js` was checked
  separately, because the source and the bundle the host runs are two different
  facts.
- **The weakest finding is labelled as the weakest.** The 25:7 stop-to-start
  ratio is confounded — three sessions wrote to that ledger during the window,
  and one record is a `general-purpose` agent this session never dispatched. It
  is recorded with the confound in the finding itself rather than quoted as a
  per-dispatch rate, and the fix (write `session_id` on the appended line) is
  filed against the step that would otherwise publish a wrong denominator.
- **Nothing was flipped that was not measured.** Step 3 closes. Steps 2 and 4
  stay open, and Step 2 stays open even though half of its assertion is now
  answered, because the other half needs the raw capture. Substituting the
  ledger for that capture and calling the step done would be exactly the
  method-substitution `evaluator-independence` exists to stop.

## What a reviewer should check if one runs anyway

The three line references the evidence file leans on —
`subagent_ledger_hook.ts:216-232` (`classifyEnvelope`'s two-state collapse),
`:592` (`session_id` on the open record but not on the appended line), and
`dispatch_hook.ts:486` / `:1082` (the capture helper and its unconditional
call). Every downstream re-scope in the roadmap follows from those four
locations being what the evidence says they are.
