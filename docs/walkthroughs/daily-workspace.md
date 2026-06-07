---
stability: beta
keep-beta-until: 2026-09-07
roadmap_ref: road-to-employee-product-and-external-proof.md
---

# Daily Workspace — Walkthrough

A 5-minute tour of the workspace tab for a non-technical employee:
pick a role, run a first task, find your sources and documents in the
right rail. Pairs with the accessibility audit at
[`daily-workspace-a11y.md`](daily-workspace-a11y.md) and the surface
contract at [`docs/contracts/daily-workspace.md`](../contracts/daily-workspace.md).

> **Screenshots + recruit quotes pending.** Per the roadmap step this
> walkthrough belongs to, real screenshots and verbatim quotes come
> from a follow-up validation session with a Phase 1 recruit-session
> participant (human-owner). Until that session runs, this document
> ships text-only — no staged or fabricated screenshots.

## Prerequisites

- The package installed in your project (`npx @event4u/agent-config install`).
- At least one role experience present under `agents/roles/` — six ship
  today: galabau, content-creator, consultant, sales, support, leadership.
- Optional: knowledge ingested via `/knowledge:ingest <path>` (the
  right rail shows "No sources yet" otherwise — that is fine).

## 1. Open the workspace

```bash
npx @event4u/agent-config ui:serve
```

The local UI server starts on `127.0.0.1` (loopback only — nothing is
exposed to your network) and opens the browser. Pick the **Workspace**
tab. The page header reads "Pick a role, pick a first task, run it."

## 2. Pick a role

The left column lists every installed role as a card: display name, a
status badge (`draft` / `beta` / `stable`), and a one-line tagline.
Click your role — say **Sales**. The centre column swaps to that
role's three first tasks. Clicking a different role later swaps the
task list without losing your session history.

## 3. Start a first task

Each first task card carries a name, a one-sentence intent, and a
**Start session** button. Clicking it writes a new session entry
(visible immediately in "Recent sessions" below) and shows a
confirmation banner with the session id. The session log is a local
append-only file under `~/.event4u/agent-config/workspace/sessions/`
— nothing leaves your machine.

The host agent (Claude Code, or your configured tool) picks the
session up from there; the prompt template the task references lives
under `agents/roles/<role>/prompts/`.

## 4. The right rail — sources, documents, explanation style

- **Knowledge sources** — every document you ingested with
  `/knowledge:ingest` appears as a numbered citation (`[1]`, `[2]`, …)
  with a short excerpt. Pinned sources carry a star. Clicking a source
  opens the original file. Empty state: "No sources yet. Run
  `/knowledge:ingest <path>` to add documents."
- **Recent documents** — the 20 most recently saved workspace
  documents (offers, mail drafts, memos, briefs, video scripts), newest
  first, each with a type badge and date. Saved drafts from
  `/work`-style tasks land here automatically.
- **Explanation style** — a two-way toggle between **Plain language**
  (default) and **Technical detail**. Plain mode swaps jargon for
  everyday words per the relabel matrix in
  [`plain-language-surface.md`](../contracts/plain-language-surface.md);
  the technical view keeps the original vocabulary for engineering
  leads.

## 5. Where your data lives

| Surface | Location | Leaves your machine? |
|---|---|---|
| Sessions | `~/.event4u/agent-config/workspace/sessions/<date>/<id>.jsonl` | No |
| Documents | `~/.event4u/agent-config/workspace/documents/<type>/` | No |
| Analytics | `~/.event4u/agent-config/workspace/analytics/events.jsonl` (opt-out: `AGENT_CONFIG_ANALYTICS=off`) | No — local-only by contract |
| Knowledge | `agents/memory/knowledge/<ingest-id>/` in your project | No |

Secret hygiene: every write to these stores passes a pre-write secret
scan (`workspace_secrets.py`) — high-confidence secrets (API keys, PEM
blocks) are refused on documents and silently scrubbed from telemetry.

## Troubleshooting

- **"No roles installed"** — the project has no `agents/roles/`
  directory; re-run the installer or copy a role experience in.
- **"No tasks scaffolded yet for this role"** — the role's `index.md`
  is missing its "Three first tasks" section; see
  [`docs/contracts/role-experience.md`](../contracts/role-experience.md).
- **Knowledge pane stays empty after ingest** — confirm the ingest id
  shows up in `/knowledge:list`; the pane reads
  `agents/memory/knowledge/<id>/manifest.json` from the project the UI
  server was started in.

## What this walkthrough does not cover

- The host-agent turn loop (how replies stream back) — that substrate
  is [`ADR-023`](../decisions/ADR-023-host-agent-protocol.md) Tier 1
  and lands separately.
- Encryption at rest — the layer exists (`workspace_crypto.py`) but
  store-side wiring is deferred to its own PR; see the roadmap's
  Phase 8 Step 3 deferral note.
- Team / multi-user deployment — single-user by design; see
  [`docs/deploy/team-deployment-posture.md`](../deploy/team-deployment-posture.md).
