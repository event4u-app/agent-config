---
adr: 206
status: accepted
date: 2026-08-03
decision: drive-loop-era-disposition
supersedes: ADR-068, ADR-070, ADR-071, ADR-072, ADR-073, ADR-074, ADR-075, ADR-076, ADR-077, ADR-078, ADR-079, ADR-080, ADR-081, ADR-082, ADR-083, ADR-084
superseded_by: —
phase: road-to-renewal-adr-hygiene
type: structural
review_trigger: >-
  When the workspace drive subsystem is either promoted out of
  AGENT_CONFIG_DEV_MODE (the freeze below would then be broken and the 16
  decisions would need live governance again) OR physically removed from
  src/ (this record's code-disposition section is then complete and the
  removal PR should note it here)
---

# ADR-206 — Drive-loop era disposition: the 16 workspace-drive decisions are superseded by host-native capabilities; the code is frozen, not deleted

## Status

**Accepted** · 2026-08-03. Batch disposition of the drive-loop era —
ADR-068 and ADR-070 through ADR-084 (16 records, all dated 2026-06-08/09) —
executed per `road-to-renewal-adr-hygiene` Phase 1 with AI-council
convergence (claude-sonnet-4-5 + gpt-4o, design mode, 2026-08-03). One
record, sixteen status flips, index regenerated — not sixteen PRs.

## Context

Over two days in June 2026 the package grew a homegrown host-drive
subsystem: a `claude -p` (and codex / gemini) turn-loop executor with tier
detection (ADR-068), a unified drive loop (070–072), health tracking and a
circuit-breaker kill-switch (073–074), and a workspace GUI with multi-turn
continuation, host picker, session threads, and 410-recovery affordances
(075–084). Every decision was individually sound at the time: the host
tools of June 2026 exposed no programmatic session, subagent, or hook
surface, so orchestrating them from outside via CLI spawning was the only
available shape.

That premise is gone. The primary host now provides natively what the
drive loop reimplemented externally: subagent spawning with background
execution and result notification, resumable sessions, lifecycle hooks
(the package's own `hook_manifest.yaml` dispatcher rides them), and
long-running background tasks. Building further on an external turn-loop
would duplicate host capability behind a thinner, more brittle interface.

The code did NOT die with the premise. It was ported Python → TypeScript
wholesale (ADR-200) and is live today: `src/cli/python/workspace_*.ts`
(~4.5k LOC across 6 modules), `src/server/routes/workspace.ts`
(registered unconditionally), and `src/ui/pages/WorkspacePage.tsx`
(rendered only under `AGENT_CONFIG_DEV_MODE=1` — a beta-internal surface),
with ~5 green test suites. A disposition that pretends this is dead code
would be false; one that leaves 16 accepted forward-looking decisions
standing would invite further investment in a superseded direction.

## Decision

1. **ADR-068 and ADR-070–084 are superseded as decisions.** Their
   forward-looking content — "build and evolve an external host-drive
   loop" — no longer governs. No new feature, host config, GUI affordance,
   or contract extension is added to the drive subsystem on the authority
   of those records.
2. **The code is frozen, not deleted.** The workspace drive subsystem
   stays exactly as shipped: beta-internal, dev-mode-gated, tests kept
   green. Freezing means bugfix-only — no capability work. Physical
   removal is a separate, full-size decision with its own roadmap item and
   PR; this chip-mode record deliberately does not couple to it.
3. **ADR-069 (prompt renderer) is NOT superseded.** It is the shared
   templating primitive for Tier-3 copy-paste hand-off (ADR-065/066
   consumers) and remains load-bearing regardless of the drive loop.
4. **Forward-reference prohibition.** From this record's merge date, no
   new contract, guideline, skill, or ADR may cite ADR-068/070–084 as
   governing authority. The two existing live contract docs
   (`docs/contracts/daily-workspace.md`, `docs/contracts/host-agent-protocol.md`)
   carry a date-stamped banner pointing here; the ~48 in-code `ADR-0NN`
   provenance comments remain valid as provenance (each cited file now
   carries the supersede callout a reader lands on), and the six workspace
   source modules carry a one-line freeze header pointing here.

## Consequences

- Positive: the ADR corpus stops advertising 16 accepted forward-looking
  decisions for a direction the host has obsoleted; drain-down of the
  workspace subsystem becomes a deliberate future decision instead of an
  ambient maybe.
- Negative / accepted: `status: superseded` on records whose code still
  runs is unusual; the scoping in Decision 2 (decisions superseded, code
  frozen) is the honest reading and is restated in each flipped record's
  callout. Readers who trust the status field alone will under-read the
  nuance — the callout on every flipped ADR is the mitigation.
- The `docs/contracts/daily-workspace.md` and
  `docs/contracts/host-agent-protocol.md` contracts keep describing the
  frozen endpoints accurately (they document what ships); their banners
  scope them to the frozen subsystem.

## Alternatives considered

- **Leave the 16 accepted, add a freeze note elsewhere** — rejected: an
  accepted forward-looking ADR is an invitation to build on it; the corpus
  would keep lying about the package's direction.
- **Supersede + delete the code in the same PR** — rejected: couples a
  chip-mode documentary batch to a full-size consumer-affecting deletion;
  violates the sub-roadmap's chip-mode contract and the minimal-diff rule.
- **Sixteen individual supersede records** — rejected: pure ceremony; the
  era shares one causal story and one disposition.

## References

- [ADR-068](ADR-068-host-tier-detection.md) · [ADR-070](ADR-070-tier1-drive-loop.md) ·
  [ADR-071](ADR-071-launch-drive-integration.md) · [ADR-072](ADR-072-codex-gemini-drive-configs.md) ·
  [ADR-073](ADR-073-drive-health-kill-switch.md) · [ADR-074](ADR-074-drive-kill-switch-auto-recovery.md) ·
  [ADR-075](ADR-075-workspace-gui-drive.md) · [ADR-076](ADR-076-workspace-multi-turn.md) ·
  [ADR-077](ADR-077-workspace-followup-gui.md) · [ADR-078](ADR-078-drive-health-panel.md) ·
  [ADR-079](ADR-079-workspace-host-picker.md) · [ADR-080](ADR-080-host-session-expired-410.md) ·
  [ADR-081](ADR-081-drive-health-reset-and-410-affordance.md) · [ADR-082](ADR-082-410-one-click-relaunch.md) ·
  [ADR-083](ADR-083-session-thread-and-arbitrary-continuation.md) · [ADR-084](ADR-084-drive-health-refresh-on-drive.md)
- [ADR-069](ADR-069-prompt-renderer.md) — deliberately excluded (shared primitive).
- [ADR-200](ADR-200-python-to-typescript-migration.md) — the port that kept the code alive.
- `docs/contracts/daily-workspace.md`, `docs/contracts/host-agent-protocol.md` — banner carriers.
- `agents/roadmaps/road-to-renewal-adr-hygiene.md` Phase 1 — the authorizing roadmap step.
