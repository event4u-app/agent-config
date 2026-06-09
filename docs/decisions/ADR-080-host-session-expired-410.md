---
adr: 080
status: accepted
date: 2026-06-09
decision: host-session-expired-410
supersedes: —
superseded_by: —
phase: employee-product Phase 8 (road-to-employee-product-and-external-proof)
type: structural
---

# ADR-080 — `/continue` 410 on an expired host session

## Status

**Accepted** · 2026-06-09. Implements the 410 mapping
[`ADR-076`](ADR-076-workspace-multi-turn.md) deferred ("a 410 'host session
expired' mapping needs per-host stderr detection → v1"). No council — ADR-076
already fixed the *shape* (410, per-host stderr); this PR supplies the verified
signatures.

## Context

`POST /sessions/:id/continue` resumes a host session by its recorded id. If the
host has since garbage-collected / never had that session, resume fails — but
ADR-076 returned a generic `{driven:false, error_kind}` indistinguishable from a
transient failure. The GUI should tell the user "start a new conversation," not
show a generic error.

## Decision

Detect an expired / unknown host session from the host CLI's stderr **only on
the resume path** and map it to a distinct `error_kind: 'session-expired'`,
which `/continue` answers as **HTTP 410 Gone** (`start a new conversation`).

**Verified stderr signatures** (probed 2026-06-09 with a bogus session id —
fast-fail, no LLM turn):

| Host | Signature (substring, case-insensitive) |
|---|---|
| claude | `No conversation found with session ID` |
| gemini | `Invalid session identifier` |
| codex | `no rollout found for thread id` / `thread/resume failed` |

Plus a generic `session not found` catch-all. `_is_session_expired(stderr)` is
substring-matched and **best-effort + extensible** — a new host (or a vendor
wording change) adds a signature; an unmatched failure stays the generic
`nonzero-exit` / `bad-envelope`.

**Scope guard:** the mapping fires **only when `resume_session_id` is set** — the
identical stderr on a fresh launch stays `nonzero-exit` (a fresh launch has no
session to expire).

## Consequences

- A continued conversation whose host session is gone returns **410** with a
  clear "start a new conversation" message — the GUI can route the user to a
  fresh launch rather than surfacing a confusing drive error.
- 410 is the honest code: not 5xx (our system is fine), not 4xx (the request was
  valid) — a gone resource.
- The session log still records the `host.error(session-expired)` (audit trail);
  health recording still applies (a probe that hits an expired session counts as
  a failure, consistent with the kill-switch).

## Alternatives considered

- **Keep the generic error** — rejected: indistinguishable from a transient
  failure; the user can't tell they need a fresh conversation.
- **Parse exit codes instead of stderr** — rejected: the three CLIs use
  different / overlapping exit codes; the stderr message is the reliable signal.
- **A 409** — rejected: 409 already means "no host turn to continue" (ADR-076);
  410 (gone) is the correct distinct semantics for an expired session.

## Testing note

The detector is covered hermetically by `workspace_drive.py` pytest (stubbed
stderr with all three verified signatures + the resume-only scope guard). The
Node `error_kind → 410` mapping is a trivial one-line map and is exercised
through that detector — a Node-level vitest would need a real host CLI to emit
the signature (absent in CI), so it follows the established pattern of covering
real-drive paths in pytest, not vitest.

## Deferred to v1+ (debt)

A GUI affordance that, on a 410, offers a one-click "start a fresh conversation"
(re-launch the same role/task). Signature drift monitoring (alert if an
unmatched resume failure rate climbs — it may signal a new vendor wording).

## References

- [`ADR-076`](ADR-076-workspace-multi-turn.md) — `/continue` + the deferred 410 this closes.
- [`ADR-072`](ADR-072-codex-gemini-drive-configs.md) — the three host CLIs whose stderr is matched.
