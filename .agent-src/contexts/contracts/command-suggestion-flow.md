---
stability: beta
---

# Command Suggestion — Flow & Scoring Contract

> Cross-cutting reference for the suggestion layer.
> The runtime rule is [`command-suggestion`](../../.agent-src.uncompressed/rules/command-suggestion-policy.md);
> the architectural decision lives in [`adr-command-suggestion.md`](adr-command-suggestion.md).
>
> - **Created:** 2026-04-30
> - **Status:** Phases 1–7 shipped — engine, rule, settings, sanitiser,
>   GT-CS goldens (9/9 passing) all live.

This document is the stable reference for **how a user prompt becomes a
numbered-options block** (or stays silent). The roadmap tracks phased
delivery; this doc explains the contract every suggestion must honour.

## Flow at a glance

```
user turn
   │
   ├── starts with "/cmd" ──────────────► slash-command-routing-policy handles it. STOP.
   │
   ├── senior-rule active                ►  STOP.  (clarification owed,
   │   (ask-when-uncertain, scope gate,      role-mode contract, engine
   │    role-mode, engine halt)              halt — suggestion stays silent)
   │
   ▼
sanitize_message + sanitize_context
   (strip fenced + inline code, strip prior suggestion-block echoes)
   │
   ▼
match()    →  raw scored matches per eligible command
   │
   ▼
rank()     →  apply floor, drop blocklisted, anti-noise heuristics,
              cap at max_options, stable tie-break
   │
   ▼
apply_cooldown()  →  drop (command, evidence) pairs shown in window
   │
   ▼
render()   →  numbered-options block + Recommendation line
   │
   ▼
agent emits the block as the first and ONLY thing this turn
```

## Scoring breakdown

Per match, `match.py` computes:

| Component | Weight | Source |
|---|---|---|
| `trigger_description` substring hit | base 0.6 | command frontmatter |
| `trigger_context` substring hit | +0.1 (when both hit, `matched_trigger="both"`) | command frontmatter |
| Token overlap (Jaccard, message ∪ ctx) | up to +0.05 | runtime |
| Structural bonus (ticket key, file path) | +0.05, sets `has_structural_bonus=True` | runtime |

Phrase length matters — longer matched evidence wins ties. The score is
clamped to `[0.0, 1.0]`. `rank.py` then enforces the floor and the
heuristics in
[`adr-command-suggestion.md`](adr-command-suggestion.md#anti-noise-heuristics).

## What gets recorded as evidence

`Match.evidence` is the **literal substring** that triggered the match
— `"ABC-123"` for a structural bonus, `"commit my changes"` for a
description hit. The cooldown key is `(command_name, evidence)`, so two
distinct triggers for the same command (a ticket key vs. a phrase)
track separately.

## Opt-outs — three paths, picked by scope

| Scope | Key | Effect |
|---|---|---|
| Whole project | `commands.suggestion.enabled: false` | Layer fully silent; explicit slashes still work |
| Specific command | `commands.suggestion.blocklist: [cmd1, cmd2]` | Those commands never appear; still callable |
| Specific conversation | User types `/command-suggestion-off` | Disabled until user types `/command-suggestion-on` or chat ends |

Per-command frontmatter overrides the global floor and cooldown:

```yaml
suggestion:
  eligible: true
  trigger_description: "..."
  trigger_context: "..."
  confidence_floor: 0.7   # stricter than global default
  cooldown: 30m            # longer than global default
```

## Subordination — when to stay silent

The rule lists four senior gates that outrank suggestion. The agent
self-checks before emitting:

1. **`scope-control`** — never resurface a git-op the user just declined.
2. **`ask-when-uncertain`** — clarification owed → suggestion suppressed.
3. **`verify-before-complete`** — evidence-gate verification active → silent.
4. **Active role-mode contract or engine halt** (`/implement-ticket`
   step waiting on user, `/work` mid-flow, etc.) — active flow has the floor.

On any conflict → zero output. The user's prompt processes as it would
without the rule active.

## Anti-noise heuristics — when not to fire

`rank.py` returns `[]` when:

- Top score is below `confidence_floor` (default `0.6`).
- Single match within `floor + 0.1` and no structural bonus.
- Short prompt (< 6 words) matches > 2 commands without a structural bonus.
- Prompt is a pure continuation phrase (`ok`, `weiter`, `continue`, …).

Structural bonuses (ticket key, file path) override every suppressor.

## Hardening tests — what we lock down

`tests/test_command_suggester.py` covers 84 cases (matcher, rank,
cooldown, sanitiser, render, settings, directive). The 9 GT-CS goldens
(`tests/test_command_suggester_goldens.py`) lock end-to-end shape.
Together they enforce:

- **No execution without user pick** — engine has no execute path.
- **No echo-trigger** — `sanitize.py` strips the previous block's shape.
- **No code-block triggers** — `/commit` inside ``` ``` ``` ``` stays inert.
- **No conversation hijack** — `enabled: false` and senior gates → silent.
- **No multi-question stack** — only a numbered-options block, no extra ask.
- **As-is option always last** — render contract test plus rule self-check.

## Cloud bundles

On Claude.ai Web / Skills API, the suggester package is **not** part
of the standard bundle (T2 ZIPs ship rules + skills, not Python
helpers). Treat `commands.suggestion.enabled` as `false` — degrade
silently, never crash the turn. Local agents (Augment, Claude Code,
Cursor, Cline, Windsurf) get the engine via `scripts/`.

## See also

- [`command-suggestion`](../../.agent-src.uncompressed/rules/command-suggestion-policy.md) — runtime rule
- [`adr-command-suggestion.md`](adr-command-suggestion.md) — architectural decision
- [`command-suggestion-eligibility.md`](command-suggestion-eligibility.md) — locked eligibility table
- [`agent-settings`](../../.agent-src.uncompressed/templates/agent-settings.md) — `commands.suggestion.*` reference
