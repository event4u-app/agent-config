---
adr: 070
status: accepted
date: 2026-06-08
decision: tier1-drive-loop
supersedes: —
superseded_by: —
phase: employee-product Phase 8 (road-to-employee-product-and-external-proof)
type: structural
---

# ADR-070 — Tier-1 host drive loop (v0)

## Status

**Accepted** · 2026-06-08. Design converged via AI-council (claude-sonnet-4-5 +
gpt-4o, design mode, 2026-06-08): both members agreed on decisions 1, 2, 4, 5,
6; on decision 3 (adapter shape) both sided with the **unified** adapter over
three copy-paste functions. This ADR covers the **first PR** — the Python
executor + tests, no HTTP endpoint (that is PR 2).

## Context

ADR-023 locks a CLI shell-out protocol with three tiers. Tier-1 hosts
(Claude Code / Codex / Gemini) expose `launch` (`claude -p "<prompt>"
--output-format json`) and a JSON envelope per turn. `detectHostTier`
(ADR-068) already classifies a host as Tier 1, but reports
`mode = tier1-drive-pending` — there was no executor. The rendered prompt now
exists (`workspace_render.py`, ADR-069). The missing piece is the **drive
loop**: spawn the host CLI, parse the envelope, record the turn.

## Decision

| # | Question | Verdict | Rationale |
|---|---|---|---|
| 1 | Turn model | **Single-turn.** Tool calls **recorded opaquely, never executed.** | Smallest useful cut. Agentic multi-turn (feed results back) + tool execution are v1 — recording tool-call JSON now keeps the session log complete without an executor. |
| 2 | Envelope validation | **Explicit required/optional keys per host; fail closed.** Missing `result` or `is_error: true` → error turn, not a fabricated one. | "Named keys only" is too vague; an unrecognised envelope must degrade to the inbox, never invent a turn. |
| 3 | Adapter shape | **Unified `drive(host, prompt, …)`** + per-host config (`build_args` + `normalise`). | The `ai-council` skill already drives all three hosts through one path; three copy-paste functions discard a proven abstraction. Variance is CLI flags, not control flow. |
| 4 | Loop vs launch | **Sync drive inside `POST /launch`** when tier 1 (PR 2); no separate `/drive` endpoint. | A two-call split (header then drive) risks orphaned sessions with no rollback / dedup / lock. Sync-in-launch (202 on timeout) is sounder for v0. |
| 5 | Timeout / failure | **90 s** default, configurable. CLI-missing / non-zero-exit / timeout / bad-envelope → `host.error` record + degrade to Tier-3 inbox. | 30 s is too short for LLM+tool turns; the user is never stuck because every failure path has an inbox fallback. |
| 6 | First PR | `workspace_drive.py` (claude-code adapter) + stubbed-runner tests + a real-CLI **contract test** (skipped when `claude` absent). **No HTTP endpoint.** | The contract test catches Anthropic-side envelope drift (e.g. `result` renamed) the moment it runs where `claude` is present. The endpoint is PR 2. |

### Uniform turn record

`drive()` returns, on success:

```json
{"ok": true, "host": "claude-code", "text": "...", "model": null,
 "usage": {"input_tokens": 12, "output_tokens": 34}, "session_id": "...",
 "cost_usd": 0.01, "num_turns": 1, "tool_calls": []}
```

On any operational failure it returns `{"ok": false, "host", "error",
"error_kind"}` (`error_kind` ∈ `unsupported-host` / `empty-prompt` / `timeout`
/ `cli-missing` / `spawn-failed` / `nonzero-exit` / `bad-envelope`). It never
raises for an operational failure — the caller records `host.error` via
`workspace_sessions.py` and degrades to the Tier-3 inbox.

## Consequences

- The drive loop is the executor behind `tier1-drive-pending`; PR 2 wires it
  into `POST /launch` so a Tier-1 launch actually drives a turn.
- The session log stays the source of truth: every drive (success or error) is
  one append, through the encrypted store (ADR-064) — `workspace_drive.py`
  never writes JSONL itself.
- `runner` injection keeps the test suite hermetic; the opt-in contract test is
  the only path that touches a real host CLI.

## Alternatives considered

- **Multi-turn agentic loop in v0** — rejected: large surface, tool-execution
  trust questions; single-turn is useful and shippable now.
- **Three per-host functions** — rejected: discards the proven `ai-council`
  unified adapter; the variance is purely CLI flags.
- **Separate `POST /launch/:id/drive` endpoint** — rejected: orphaned-session
  risk with no rollback / dedup / lock in v0.
- **Hard-error on bad envelope** — rejected: leaves the user stuck; fail-closed
  to the inbox is the protocol's stated posture (host-agent-protocol).

## Deferred to v1 (debt)

- Multi-turn agentic loops + **tool-call execution**.
- `codex` / `gemini` host configs (the unified `drive()` is ready for them).
- Drive **metrics** (success / timeout rate) + a kill-switch that flips Tier-1
  to inbox-only when the failure rate crosses a threshold.
- Error-taxonomy refinement (structured error codes).

## References

- [`ADR-023`](ADR-023-host-agent-protocol.md) — the three-tier CLI protocol.
- [`ADR-068`](ADR-068-host-tier-detection.md) — detection (`tier1-drive-pending` is what this resolves).
- [`ADR-069`](ADR-069-prompt-renderer.md) — produces the rendered prompt the drive loop consumes.
- [`ADR-064`](ADR-064-append-jsonl-per-record-encryption.md) — the encrypted session store turns are appended to.
- [`host-agent-protocol`](../contracts/host-agent-protocol.md) — fail-closed posture + envelope-as-contract.
