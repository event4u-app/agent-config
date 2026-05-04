# Hardening Platform Parity — Deferred Tracking

> Phase 4 deliverable for [`road-to-rule-hardening.md`](../roadmaps/road-to-rule-hardening.md).
> Production = Augment + Claude Code; this file records the deferred
> third-tier platforms (Cursor / Cline / Windsurf) per Tier 1 rule, with
> each capability gap explicit so silent debt cannot accumulate. Every
> row turns into a GitHub issue under the `hardening-platform-parity`
> label.
>
> Last refreshed: 2026-05-04. Source for hook surfaces:
> [`chat-history-platform-hooks.md`](chat-history-platform-hooks.md).

## Status snapshot

| Rule | Augment | Claude Code | Cursor (IDE) | Cursor (CLI) | Cline (non-Win) | Cline (Win) | Windsurf |
|---|---|---|---|---|---|---|---|
| `roadmap-progress-sync` | ✅ | ✅ | ⏸ deferred | ❌ no surface | ⏸ deferred | ❌ no surface | ⏸ deferred |
| `onboarding-gate` | ✅ | ✅ | ⏸ deferred | ⏸ deferred | ⏸ deferred | ❌ no surface | ⏸ deferred |
| `context-hygiene` | ✅ | ✅ | ⏸ deferred | ❌ no surface | ⏸ deferred | ❌ no surface | ⏸ deferred |

`✅` shipping · `⏸` deferred (hook surface exists, wiring not done) ·
`❌` no platform surface (cooperative-rule-only, escalate to MANUAL fallback).

## Per-platform capability map

### Cursor (IDE)

- **Surface:** `.cursor/hooks.json` or `~/.cursor/hooks.json`. Also reads
  `.claude/settings.json` transparently — meaning **the existing
  Claude wiring may already fire under Cursor IDE** without new code.
  This is unverified; the parity issue's first task is to confirm.
- **Events available:** `sessionStart`, `postToolUse`, `stop`,
  `afterAgentResponse` — sufficient for all three Tier 1 rules.
- **Status:** Beta since 1.7 (2025-09); still beta as of 2026-Q1.
- **Capability gap:** none structural; just unwired and unverified.

### Cursor (CLI)

- **Surface:** `.cursor/hooks.json` honored, but only
  `beforeShellExecution` / `afterShellExecution` actually fire.
- **Capability gap:** `sessionStart`, `postToolUse`, `stop` do **not**
  fire on the CLI as of 2026-01 (documented limitation).
- **Path forward:** CHECKPOINT/MANUAL fallback for `roadmap-progress-sync`
  and `context-hygiene`. `onboarding-gate` can piggy-back on the first
  shell command of a session via `beforeShellExecution`, so a CLI
  variant is feasible if demand appears.

### Cline (non-Windows)

- **Surface:** `.cline/hooks/` directory; `fail_open` / `fail_closed`
  policies per hook.
- **Events available:** `TaskStart`, `TaskComplete`, `PostToolUse`,
  `UserPromptSubmit` — sufficient for all three rules. Note Cline's
  unit is "task" not "session"; `onboarding-gate` should bind to
  `TaskStart`.
- **Capability gap:** none structural; just unwired.

### Cline (Windows)

- **Capability gap:** Hooks unsupported on Windows
  (`cline/cline#8073`). Upstream is patching the toggle, but feature
  parity is not promised.
- **Path forward:** MANUAL fallback only. Track upstream issue; revisit
  when Cline ships Windows hook support.

### Windsurf

- **Surface:** `.windsurf/hooks.json`, 12 events, exit-code-2 blocking.
- **Events available:** `pre_user_prompt` (session/turn init),
  `post_cascade_response` (async, ideal for context-hygiene counter),
  `post_write_code` (path-filter for roadmap-progress-sync).
- **Capability gap:** none structural; just unwired. `post_cascade_response`
  is async, which is fine for all three rules (none are on the critical
  path).

## Issue payloads (ready to file)

Each issue is filed against this repo with label
`hardening-platform-parity` plus the platform label. Title format:
`[parity] <platform>: wire <rule> hook`.

### Issue 1 — Cursor IDE: wire all three Tier 1 rules

- **Title:** `[parity] Cursor IDE: verify Claude-wired hooks fire & wire native variant`
- **Labels:** `hardening-platform-parity`, `platform:cursor`
- **Body:** Cursor reads `.claude/settings.json` transparently. (1)
  Confirm the four PostToolUse / SessionStart hooks already fire under
  Cursor IDE 1.7+ in practice. If yes, document and close. (2) If no,
  add `.cursor/hooks.json` mirroring the Claude hook block via
  `scripts/install.py:ensure_cursor_bridge`. CLI variant is a separate
  issue.
- **Acceptance:** all three Tier 1 hooks fire on a sample session;
  output verified via the `--verbose` flag.

### Issue 2 — Cursor CLI: CHECKPOINT fallback for roadmap & context-hygiene

- **Title:** `[parity] Cursor CLI: CHECKPOINT fallback for postToolUse-bound rules`
- **Labels:** `hardening-platform-parity`, `platform:cursor`, `tier:fallback`
- **Body:** Cursor CLI does not fire `postToolUse` / `stop` /
  `sessionStart`. Document the gap in
  `chat-history-platform-hooks.md`, route Cursor-CLI users to the
  cooperative-rule fallback, and consider piggy-backing
  `onboarding-gate` on `beforeShellExecution`.
- **Acceptance:** behavior documented; CHECKPOINT command works on a
  sample CLI session.

### Issue 3 — Cline (non-Windows): wire all three Tier 1 rules

- **Title:** `[parity] Cline: wire roadmap-progress-sync, onboarding-gate, context-hygiene hooks`
- **Labels:** `hardening-platform-parity`, `platform:cline`
- **Body:** Add `.cline/hooks/` entries via
  `scripts/install.py:ensure_cline_bridge` (new). Use `TaskStart` for
  `onboarding-gate`, `PostToolUse` for the other two with the
  established path filters. Set `fail_open` so a hook crash never
  blocks the task.
- **Acceptance:** all three hooks fire on a sample non-Windows session.

### Issue 4 — Cline (Windows): MANUAL track upstream

- **Title:** `[parity] Cline Windows: track upstream hooks support (cline/cline#8073)`
- **Labels:** `hardening-platform-parity`, `platform:cline`, `tier:manual`
- **Body:** Hooks unsupported on Windows. Subscribe to the upstream
  issue; revisit this parity item when Cline ships Windows hook support.
  Until then, Windows Cline users rely on the cooperative rule body.
- **Acceptance:** linked to upstream; auto-close when upstream resolves
  + this repo wires the platform.

### Issue 5 — Windsurf: wire all three Tier 1 rules

- **Title:** `[parity] Windsurf: wire roadmap-progress-sync, onboarding-gate, context-hygiene hooks`
- **Labels:** `hardening-platform-parity`, `platform:windsurf`
- **Body:** Add `.windsurf/hooks.json` via
  `scripts/install.py:ensure_windsurf_bridge` (new). Map
  `pre_user_prompt` → onboarding-gate, `post_cascade_response` (async)
  → context-hygiene, `post_write_code` (path filter) →
  roadmap-progress-sync.
- **Acceptance:** all three hooks fire on a sample Windsurf session.

## See also

- [`hardening-pattern.md`](hardening-pattern.md) — the four-artefact
  contract every Tier 1 rule ships
- [`chat-history-platform-hooks.md`](chat-history-platform-hooks.md) —
  exhaustive per-platform hook surface, the source for the gap rows above
- [`road-to-rule-hardening.md`](../roadmaps/road-to-rule-hardening.md)
  Phase 4 — the roadmap step this artefact discharges
