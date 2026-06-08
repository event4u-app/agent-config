---
adr: 076
status: accepted
date: 2026-06-09
decision: workspace-multi-turn
supersedes: —
superseded_by: —
phase: employee-product Phase 8 (road-to-employee-product-and-external-proof)
type: structural
---

# ADR-076 — Workspace multi-turn = conversation continuation (v0)

## Status

**Accepted** · 2026-06-09. Design converged via AI-council (claude-sonnet-4-5 +
gpt-4o, design mode, 2026-06-08) — both members converged firmly on **Reading B
(conversation continuation)** over Reading A (agentic tool-execution loop).
Resolves the ADR-070 "multi-turn + tool execution" debt by scoping it correctly.

## Context

The ADR-070 debt was labelled "multi-turn + tool execution," which conflates two
very different features. The council's framing decision:

- **Reading A — agentic tool-execution loop at our layer.** Parse tool-call
  requests from the host envelope, *we* execute them, feed results back. This is
  **largely redundant** — `claude -p` / `codex exec` / `gemini -p` each run their
  own agent loop + tool execution internally and return the *final* result. It
  also makes **us** execute model-requested actions — a heavy security surface
  (`security-sensitive-stop`: threat-model + allowlist + sandbox) for little
  gain over what the host already does.
- **Reading B — conversation continuation.** Every launch today is a *fresh*
  single-turn session with no way to send a **follow-up** to the *same* host
  session. We reuse the host session id (captured on `host.turn`) to continue
  (`claude --resume`, `codex exec resume`, `gemini --resume`). The host keeps
  running its own tools internally each turn; we add no execution surface.

**Decision: Reading B.** It is the real, non-redundant gap and is far
lower-risk. Reading A is deferred indefinitely (redundant with the host loop).

## Decision (Reading B)

| # | Question | Verdict |
|---|---|---|
| 1 | Surface | Dedicated **`POST /workspace/sessions/:id/continue {prompt}`**. |
| 2 | Per-host resume | `build_resume_args(session_id, prompt)` + `supports_resume` per `HOST_CONFIGS`. All three Tier-1 hosts expose a documented non-interactive resume (verified): claude `--resume <id> -p`, codex `exec resume <id> --json <prompt>`, gemini `--resume <id> -p`. |
| 3 | session-id source | The **most recent `host.turn`** record's `session_id` (the session log is canonical). **No host turn with a session_id → HTTP 409** ("run at least one turn first"). |
| 4 | Health interaction | Continuation is a drive → same `gate()` + `recordDriveHealth` as a launch (kill-switch applies). |
| 5 | First PR | Mechanics only — `build_resume_args` + the session-id lookup + `/continue`. The GUI "Follow up" affordance is a later PR. |

**Failure handling:** a resume drive failure is recorded as `host.error` and
returned `{driven:false, error_kind}` (same shape as a launch). A host-session-
expired 410 mapping (distinct from a generic failure) needs per-host stderr
parsing → deferred to v1. The append-only session log has no per-session
"status", so there is no "stuck in_progress" state to recover.

## Consequences

- A follow-up turn continues the *same* host conversation (the host carries its
  own context + ran its own tools on turn 1) — no tool-execution surface at our
  layer, no threat-model gate tripped.
- `/continue` reuses the launch drive machinery (`driveHostTurn` gained an
  optional `resumeSessionId`), so the kill-switch, health recording, and
  encrypted `host.turn` append all apply unchanged.
- The 409 guard makes "continue a session that never drove" fail loud.

## Alternatives considered

- **Reading A (agentic tool-exec loop)** — rejected: redundant with the host
  CLI's own loop + a heavy security surface for no gain.
- **Fold continuation into a generalised launch** — rejected: a dedicated
  session-keyed endpoint is clearer and avoids overloading launch's contract.
- **A separate session-id index** — rejected: the session log already records
  it on `host.turn`; a second source would drift.
- **Concurrency lock on `/continue`** — deferred: the drive infra is already
  sequential-launch-assumed; concurrent continuation is a later hardening
  concern, documented not solved.

## Deferred to v1 (debt)

A 410 "host session expired" mapping (per-host stderr detection), a session-
level concurrency lock, and the GUI "Follow up" affordance. Reading A (agentic
tool execution at our layer) remains deferred indefinitely — redundant with the
host loop.

## References

- [`ADR-070`](ADR-070-tier1-drive-loop.md) — the drive loop + the "multi-turn" debt this scopes.
- [`ADR-071`](ADR-071-launch-drive-integration.md) / [`ADR-073`](ADR-073-drive-health-kill-switch.md) — the launch drive + kill-switch `/continue` reuses.
- [`ADR-023`](ADR-023-host-agent-protocol.md) — the three Tier-1 hosts + their CLIs.
- [`security-sensitive-stop`](../../dist/agent-src/rules/security-sensitive-stop.md) — why Reading A's execution surface was avoided.
