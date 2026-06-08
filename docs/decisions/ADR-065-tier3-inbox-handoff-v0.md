---
adr: 065
status: accepted
date: 2026-06-08
decision: tier3-inbox-handoff-v0
supersedes: —
superseded_by: —
phase: employee-product Phase 8 (road-to-employee-product-and-external-proof)
type: structural
---

# ADR-065 — Tier-3 host hand-off inbox: plaintext, ephemeral v0 (encryption declined)

## Status

**Accepted** · 2026-06-08. Design converged via AI-council (claude-sonnet-4-5 +
gpt-4o, design mode, 2026-06-08). The encrypt-at-rest arc (ADR-062/063/064)
listed the inbox as the one deferred store; the council round that scoped it
found the inbox did not exist yet **and** that encrypting it would be security
theater. This ADR records the honest v0: build the hand-off, ship it plaintext.

## Context

ADR-023 specifies a **Tier-3 host hand-off**: for hosts the workspace cannot
drive (Augment, Cursor, Cline, Windsurf, JetBrains), the workspace writes the
rendered prompt into `~/.event4u/agent-config/workspace/inbox/<id>.md` and
surfaces a copy-to-clipboard banner; the user opens the host themselves. No
code wrote or read that file — the feature was specified, never built.

## Decision

Build the Tier-3 inbox as a **plaintext, ephemeral, content-minimal** store.

- **Plaintext — encryption declined.** The inbox holds a prompt the user
  *reads to copy-paste*; the adversary an at-rest cipher defends against is a
  filesystem attacker. That same prompt content already lives in the
  **encrypted sessions store**. Encrypting the inbox therefore stops **no
  incremental threat** — it would add migrate/rekey/decrypt-all/Python-routing
  complexity for zero marginal security. Revisit only if a distinct threat
  model emerges (e.g. the inbox starts holding content not in sessions).
- **Ephemeral.** `prune` drops hand-off files older than 24h; the store is a
  transient hand-off surface, not durable storage.
- **Content-minimal (v0).** The file is a small frontmatter header
  (id / role / task / session / created_at) + the **rendered prompt body**
  supplied by the caller. **Deferred:** skill-body pre-rendering (ADR-024
  notes Codex/Gemini lack skill resolution — that resolution algorithm is its
  own feature + ADR) and host-tier **auto-detection** (v0 takes the hand-off
  intent explicitly from the caller).
- **Python-authoritative, ships dark.** `workspace_inbox.py`
  (write / read / list / forget / prune, `--root` validated to
  `…/workspace/inbox`) is the store; the Node `POST /api/v1/workspace/inbox`
  + `GET /api/v1/workspace/inbox/:id` endpoints route through it and are
  **gated behind `AGENT_CONFIG_TIER3_INBOX` (default off)** until the hand-off
  UX is validated. The write endpoint returns `{id, path, banner}`; the banner
  text only — clipboard / UI wiring is the Preact shell's job, deferred.
- A pasted credential in the prompt is **scrubbed** on write (disposable
  hand-off posture, same as the session/analytics telemetry stores).

## Consequences

- The Tier-3 hand-off has a real, tested writer/reader for the first time;
  the encrypt-at-rest arc is closed (the inbox is intentionally plaintext, not
  an outstanding encryption gap).
- The feature ships dark — zero behaviour change until an operator sets the
  flag.
- If the inbox later carries content NOT mirrored in sessions, encryption
  must be revisited (reuse the documents whole-file `.md.enc` pattern); the
  contract scope table records this trigger.

## Alternatives

- **Encrypt the inbox** (the arc's original intent) — rejected as security
  theater per the threat-model analysis above.
- **Fold into `launch`** (write the inbox when a Tier-3 launch happens) —
  rejected for v0: requires host-tier auto-detection, which is deferred; a
  standalone endpoint is more testable and modular.
- **Skill-body pre-rendering in v0** — rejected: a new skill-resolution trust
  boundary; its own ADR.

## References

- ADR-023 — host-agent protocol (Tier-3 hand-off spec).
- ADR-024 — workspace v0 floor (the inbox is a post-floor addition).
- ADR-062/063/064 — the encrypt-at-rest arc this closes.
- `src/cli/python/workspace_inbox.py`, `src/server/routes/workspace.ts`.
- Contract: [`docs/contracts/at-rest-encryption.md`](../contracts/at-rest-encryption.md).
