---
stability: experimental
---

# Daily Workspace Surface Contract

> **Status** · v0 / design · 2026-05-24. Surface contract for the daily
> workspace introduced as Phase 4 of the employee-product workstream.
> Governed by ADRs [`022`](../decisions/ADR-022-daily-workspace-decomposition.md) ·
> [`023`](../decisions/ADR-023-host-agent-protocol.md) ·
> [`024`](../decisions/ADR-024-workspace-v0-feature-floor.md) ·
> [`025`](../decisions/ADR-025-workspace-chrome.md).

## Shape (v0)

Browser tab at `http://127.0.0.1:<gui-port>/workspace`, served by the
existing installer GUI (`packages/core/installer/src/gui/server.ts`).
Same CSRF token, same loopback bind, same kill-switch as
[`gui-wizard`](gui-wizard.md). Launched via
`npx @event4u/agent-config workspace` (alias for
`init --gui --route=/workspace` once wired).

```
┌─ /workspace ─────────────────────────────────────────────────┐
│  [identity strip — shared with installer GUI shell]         │
├────────────────────┬─────────────────────────────────────────┤
│ Role + Task        │  Active session log                     │
│ launcher           │  (latest JSONL entries, append-only)    │
│                    │                                         │
│ - galabau          │  ▸ 12:04 launch  · role=galabau         │
│ - content-creator  │  ▸ 12:05 host    · claude / tier-1      │
│ - consultant       │  ▸ 12:08 host    · turn.completed       │
│                    │                                         │
│ (Phase 3 roles)    │  Knowledge pane                         │
│                    │  - source: handbuch.pdf                 │
│                    │  - source: angebot-template.md          │
│                    │  (Phase 2 namespace; "no sources yet"   │
│                    │   when empty)                           │
└────────────────────┴─────────────────────────────────────────┘
```

No left / centre / right three-rail layout in v0 (deferred per
ADR-024). One launcher, one log, one stub pane.

## Endpoints (additions to the GUI server)

All endpoints CSRF-gated, loopback-bound. Existing wizard endpoints
in [`gui-wizard`](gui-wizard.md) are untouched.

| Method · Path | Purpose |
|---|---|
| `GET  /workspace` | HTML shell + initial state (role list, recent sessions). |
| `GET  /api/v1/workspace/roles` | List available roles from `agents/roles/<role>/`. |
| `GET  /api/v1/workspace/roles/:role/tasks` | Per-role task list from `skills.yml` + `prompts/`. |
| `POST /api/v1/workspace/launch` | Body: `{ role, task, host? }`. Resolves host via ADR-023 tier; runs the launch; appends to JSONL log. |
| `GET  /api/v1/workspace/sessions` | List of recent sessions (≤ 20, ordered by mtime). |
| `GET  /api/v1/workspace/sessions/:id` | Streams the JSONL log for one session. |
| `GET  /api/v1/workspace/knowledge` | Snapshot of the current `knowledge:` memory namespace (read-only). |
| `POST /api/v1/workspace/render` | Body: `{ role, prompt, inputs }`. Fills `{{name}}` placeholders in `prompts/<prompt>.md`; returns `{ rendered, skill_hint }`. Pure — skill body is **not** appended (ADR-069). Missing-required / undeclared-placeholder → 400. |

## Session JSONL schema

Path: `~/.event4u/agent-config/workspace/sessions/<yyyy-mm-dd>/<session-id>.jsonl`
(one file per session; append-only; UTF-8). Session id = `YYYYMMDDTHHMMSSZ-<8-hex>`.

Each line is one JSON record with the shared envelope:

```json
{ "ts": "<iso-8601-utc>", "kind": "<event-kind>", "data": { … } }
```

Event kinds:

- `launcher.input` — `{ role, task, rendered_prompt, host_tier, host_id }`
- `host.turn` — `{ host_id, turn_id, model, input_tokens, output_tokens, latency_ms }`
- `host.output` — `{ host_id, turn_id, role: "assistant", text }` *(verbatim host envelope text — Tier 1 only)*
- `host.tool` — `{ host_id, turn_id, tool_name, input, output_excerpt }` *(when the host envelope surfaces it)*
- `host.error` — `{ host_id, message, exit_code }`
- `inbox.handoff` — `{ inbox_path, copied_to_clipboard: bool }` *(Tier 3 only)*

No PII in filenames. No remote sync. Encryption-at-rest deferred to a
future ADR.

## Inbox handoff (Tier 3)

Path: `~/.event4u/agent-config/workspace/inbox/<yyyy-mm-dd>/<id>.md`.

```markdown
---
created_at: 2026-05-24T12:08:00Z
role: galabau
task: angebot-erstellen
host_tier: 3
host_id: cursor
---

[rendered prompt body — skill context inlined per ADR-023]
```

The UI surfaces a one-line banner: "Workspace wrote
`~/.event4u/.../<id>.md`. Open it in Cursor and paste." Clicking
the banner copies the path to clipboard.

## Skill resolution

Tier 1 with skill surface (Claude Code only) — workspace passes the
slash command as part of the prompt body (`/work "<task>"` style)
and lets the host resolve it from `.claude/commands/`.

Tier 1 without skill surface (Codex, Gemini) and Tier 3 — workspace
**inlines** the skill body into the rendered prompt. The host gets
the prompt with skill context as a self-contained block.

## State scope

- Per-user. Local-only. One workspace per OS user.
- No multi-tenant view in v0. Multi-user deployment (the topology
  from [`ADR-021`](../decisions/ADR-021-deployment-shape.md)) is
  out of scope for v0.
- Closing the browser tab does not kill running host subprocesses.
  Reopening shows the live JSONL log.

## Failure modes & telemetry

- Host CLI not installed → workspace renders "Host `<id>` not
  available" banner with install link. No silent fallback.
- JSON envelope shape change → demote host to Tier 3 per ADR-023.
- Inbox write failure (disk full, permissions) → red banner; no
  silent loss.

Telemetry stays off by default (project inertia). When the user
opts in via `.agent-settings.yml`, the workspace emits
`workspace.launch`, `workspace.host_turn`, `workspace.inbox_handoff`
counters only. No prompt bodies, no response bodies.

## Cross-references

- ADRs: [`022`](../decisions/ADR-022-daily-workspace-decomposition.md) · [`023`](../decisions/ADR-023-host-agent-protocol.md) · [`024`](../decisions/ADR-024-workspace-v0-feature-floor.md) · [`025`](../decisions/ADR-025-workspace-chrome.md).
- Host-agent protocol: [`host-agent-protocol`](host-agent-protocol.md).
- GUI substrate: [`gui-wizard`](gui-wizard.md).
- Knowledge ingestion: [`local-knowledge-ingestion`](local-knowledge-ingestion.md).
- Role experience: [`role-experience`](role-experience.md).
