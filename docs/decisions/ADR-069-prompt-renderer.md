---
adr: 069
status: accepted
date: 2026-06-08
decision: prompt-renderer
supersedes: —
superseded_by: —
phase: employee-product Phase 8 (road-to-employee-product-and-external-proof)
type: structural
---

# ADR-069 — Role-prompt placeholder renderer (v0)

## Status

**Accepted** · 2026-06-08. Design converged via AI-council (claude-sonnet-4-5 +
gpt-4o, design mode, 2026-06-08): both members agreed on decisions 1–4; on
decision 5 (CLI surface) claude-sonnet-4-5's minimal-surface argument prevailed
over gpt-4o's "keep `--input k=v`" — see the verdict table below.

## Context

Role prompts live at `agents/roles/<role>/prompts/<name>.md` with YAML
frontmatter declaring `inputs` (name / required / shape) and a `skill_hint`,
plus a body with `{{name}}` placeholders. Nothing filled those placeholders:
the launch endpoint stored a session header but never produced a usable prompt.

The hand-off surfaces both need a *filled* prompt:

- **Tier-3 inbox** (ADR-065) writes a rendered prompt for copy-paste, and
  pre-renders a `skill_hint` body (ADR-066).
- **Tier-1 hosts without a skill surface** (Codex / Gemini, per ADR-068 /
  host-agent-protocol) need the prompt pre-rendered with skill context inlined.

`workspace_render.py` is the missing pure function: prompt + `name → value`
map → rendered prompt string. It mirrors the existing `workspace_*.py`
Python-authoritative CLI shape.

## Decision

| # | Question | Verdict | Rationale |
|---|---|---|---|
| 1 | Missing **optional** input | **(a)** substitute empty string, leave the heading | Markdown-structure stripping ("this heading belongs to that placeholder") is fragile template-validation masquerading as runtime logic. An empty section is template-author feedback, not a renderer bug. |
| 2 | Unknown `{{placeholder}}` (no declared input) | **Hard error** (CLI exit 1) | A broken template contract. Leaving the literal wastes host tokens — the agent tries to interpret template syntax as content. |
| 3 | Value contains `{{...}}` | **Single-pass literal** substitution | Recursive expansion is a code-injection vector; one pass over the original body means an injected token is never re-expanded. |
| 4 | `skill_hint` coupling | **Stay pure** — return the hint, never append the body | The inbox already owns skill pre-rendering (ADR-066). Appending here would double-append when the inbox calls the renderer. Tier-1 and inbox have different attach policies. |
| 5 | CLI surface | **Minimal** — `render --role --prompt [--inputs-json <f\|->] [--root]` + `inspect` | `--input k=v` is a shell-escaping trap for multi-line paragraph inputs; `--json`-on-render duplicates `inspect`. Smallest surface that works; add flags when pain emerges. |

The `shape` frontmatter field is **advisory documentation only** — the renderer
does not enforce it (decision deferred to v1).

### Node wiring

`POST /api/v1/workspace/render` → `{role, prompt, inputs}` → `{rendered,
skill_hint}`. Inputs flow to the CLI via a temp JSON file (mirrors the inbox
`--body-file` path — values can be large / multi-line). A missing-required or
undeclared-placeholder error surfaces as HTTP 400. Role prompts are read from
the read-only `<packageRoot>/agents/roles` tree, never the write root.

## Consequences

- The renderer is a pure, side-effect-free function — trivially testable, no
  store / crypto / network coupling.
- The `skill_hint`-pure boundary means the inbox auto-routing flow is:
  `render(role, prompt, inputs) → {rendered, skill_hint}` then
  `inbox.write(rendered, skill_hint=skill_hint)` — the skill body is appended
  exactly **once**, by the inbox. No double-append.
- Tier-1 pre-rendering (Codex / Gemini) consumes the same `{rendered,
  skill_hint}` and inlines the skill itself when the drive loop lands.

## Alternatives considered

- **Heading-aware empty-section stripping (decision 1b)** — rejected as
  fragile Markdown-structure inference with no robust signal for "which heading
  introduces which placeholder".
- **Forgiving unknown placeholders (leave literal)** — rejected: silent
  token-wasting bug; a template typo should fail loud.
- **Renderer appends the skill body** — rejected: couples three concerns and
  double-appends on the inbox path.
- **`--input k=v` repeatable flag** — rejected for v0: multi-line paragraph
  inputs make shell escaping unusable; `--inputs-json` (file / stdin) is the
  one clean mechanism.

## Deferred to v1 (debt)

- Per-prompt **kill-switch** (disable a template by name without redeploying) —
  belongs at the launch / inbox layer, not in this pure function.
- **Shape validation** against declared `shape` hints.
- Render success / failure **metrics**.

## References

- [`ADR-065`](ADR-065-tier3-inbox-handoff-v0.md) — Tier-3 inbox (first consumer).
- [`ADR-066`](ADR-066-skill-body-prerendering.md) — skill pre-rendering (owns the append).
- [`ADR-068`](ADR-068-host-tier-detection.md) — host-tier detection (drives whether to pre-render for Tier-1 or hand off to Tier-3).
- [`host-agent-protocol`](../contracts/host-agent-protocol.md) — Tier-1 hosts without a skill surface.
- [`daily-workspace`](../contracts/daily-workspace.md) — workspace surface contract (lists the `/render` endpoint).
