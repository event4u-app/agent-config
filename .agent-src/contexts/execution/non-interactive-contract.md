# Non-Interactive & Auto-Detection Contract

Loaded by every command orchestrator that auto-detects a sub-command
(`/judge`, `/fix`, `/analytics`, `/tests`, `/override`). Holds the
single source of truth for: TTY/CI detection, the confidence tiers that
gate auto-detection, `--yes` / `--json` / explicit-sub semantics, the
two abort schemas, the `auto_detect` kill-switch, the structured
pre-routing emission, and the rollback procedure.

> **Why this exists (6.1.0 Step 1, AI-council-converged 2026-06-05,
> claude-sonnet-4-5 + gpt-4o):** every interactive command MUST work
> non-interactively — CI has no TTY, so a command that blocks on a
> prompt is "provably wrong for CI/CD". No orchestrator ships
> auto-detection without honoring this contract.

**Size budget:** ≤ 6,000 chars.

## 1. Surface detection — is a human reachable?

An orchestrator runs in one of two surfaces:

- **Interactive** — a human can answer a numbered-options question this
  turn (normal chat session, attended terminal).
- **Non-interactive (CI / headless / autonomous)** — no human can
  answer before the run ends: `/work`, `/roadmap:process-*`, a CI job,
  `--json`, or an explicit `--yes`. Treat the surface as non-interactive
  when **any** of these hold: `CI=true` / `CI=1` in the environment,
  `stdin` is not a TTY, `--yes` / `--json` is passed, or the caller is
  another command/skill (not a human turn).

A command MUST NEVER block waiting for input it cannot receive.

## 2. Confidence tiers — declarative, not numeric

An agent does not compute a numeric score; it evaluates a **declarative
detection table** the orchestrator carries and labels the match:

| Tier | Meaning | Basis must be |
|---|---|---|
| **HIGH** | Deterministic signal uniquely names the sub-command | A file/git/flag fact (`git diff --cached` non-empty, `--prune` passed) |
| **MEDIUM** | Heuristic signal points to one sub-command | A plausible-but-defeasible fact (`plan.md` exists) |
| **LOW** | No signal, or ≥ 2 signals conflict | Ambiguous / absent |

Every detection row in an orchestrator names its tier **and** its
`basis` (the concrete condition that matched).

## 3. Behavior matrix — tier × surface

| Confidence | Interactive | Non-interactive (CI / `--yes`) |
|---|---|---|
| **HIGH** | Run silently | Run silently |
| **MEDIUM** | Confirm: show `basis`, ask Y/n | Run **only if** `--yes` / explicit sub; else abort `ambiguous_routing` |
| **LOW** | Show the sub-command menu, ask | Abort `ambiguous_routing` (even with `--yes`) |

An explicit sub-command (`/judge solo`) **always** wins — detection is
skipped entirely. `--yes` means "proceed with MEDIUM decisions without
asking"; it is **not** "run anything regardless of confidence".

## 4. Destructive sub-commands — never on a safe default

A sub-command that mutates or deletes (`analytics prune`, anything
behind a confirm gate) MUST NOT be reached by auto-detection or a
safe-default fallback. It runs only on an **explicit** sub-command, and
in CI only with an explicit `--yes`. A safe default always resolves to
the **read-only / least-destructive** sibling (`analytics` → `show`,
`fix` → detect-only, `judge` → `solo`).

## 5. Two abort schemas

When a non-interactive run cannot proceed, emit **structured JSON** and
exit non-zero — never hang, never guess:

```json
{ "status": "missing_sub_command",
  "orchestrator": "analytics",
  "available": ["analytics/show", "analytics/prune"],
  "safe_default": "analytics/show",
  "suggest": "Re-run with: /analytics show" }
```

```json
{ "status": "ambiguous_routing",
  "orchestrator": "judge",
  "detected_signals": [
    {"condition": "plan.md exists", "suggests": "judge/steps"},
    {"condition": "git diff --cached non-empty", "suggests": "judge/on-diff"}],
  "confidence": "LOW",
  "suggest": "Re-run with an explicit sub-command: /judge steps OR /judge on-diff" }
```

`missing_sub_command` = the caller forgot to name one (UX). 
`ambiguous_routing` = detection could not reach HIGH/MEDIUM (heuristic).

## 6. Structured pre-routing emission

Before invoking the detected sub-command, the agent MUST emit (so the
decision is auditable and in-band-validated by this contract, not a
black box):

```json
{ "orchestrator": "judge", "detected_sub_command": "judge/on-diff",
  "confidence": "HIGH", "basis": "git diff --cached non-empty", "params": {} }
```

## 7. Kill-switch — disable auto-detection without a rollback

Three override layers, narrowest wins:

1. **Per-invocation:** `--no-auto-detect` → fall back to the menu
   (interactive) or `missing_sub_command` (CI).
2. **Per-orchestrator:** `auto_detect: false` in the command's
   front-matter → that orchestrator always shows the menu.
3. **Global:** `commands.auto_detect: disabled | warn | enabled` in
   `.agent-settings.yml` (default `enabled`; `warn` = detect but always
   confirm).

A misbehaving heuristic is disabled by config, not by reverting 6.1.0.

## 8. Rollback procedure (every orchestrator references this)

1. Re-run with the explicit sub-command (`/judge solo`) — detection is
   skipped.
2. Disable globally: `commands.auto_detect: disabled` in
   `.agent-settings.yml`.
3. Disable one orchestrator: `auto_detect: false` in its front-matter,
   then `task sync`.

## See also

- [`command-clusters`](../../../docs/contracts/command-clusters.md) — the locked cluster/sub-command set.
- [`user-interaction`](../../rules/user-interaction.md) — numbered-options + recommendation rules the interactive path obeys.
- [`non-destructive-by-default`](../../rules/non-destructive-by-default.md) — the Hard Floor destructive sub-commands still answer to.
