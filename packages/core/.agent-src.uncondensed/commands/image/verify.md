---
model_tier: high
name: image:verify
tier: 2
cluster: image
sub: verify
description: Verify a candidate render against its canon — run the analyser in loop mode, emit the gate verdict + remaining diff, halt-and-surface on non-pass.
personas: [hollywood-director]
skills: [image-analyser]
suggestion:
  eligible: true
  trigger_description: "verify this render, does the generated image pass the canon, re-check fidelity after regeneration, loop-verify"
  trigger_context: "user has a generated candidate image + a character id and wants the canon-fidelity gate verdict"
workspaces:
  - agent-config-maintainer
packs:
  - meta
---

# /image:verify

The verify step of the fidelity loop — runs
[`image-analyser`](../../skills/image-analyser/SKILL.md) on a candidate render
against its canon and reports the loop stop-state. Args: `<path-or-url>`
(required) `<character-id>` (required).

## Steps

1. **Analyse + diff** — run `image-analyser` on the candidate against
   `agents/reference/ai-video/<project>/characters/<id>.json` (the rubric in
   [`canon-spec.md`](../../skills/image-analyser/canon-spec.md)).
2. **Apply the loop stop conditions** — PASS (canon-breaking gate clear + every
   per-section score ≥ threshold) · plateau · oscillation · budget.
3. **Non-PASS → halt and surface** the best candidate + its remaining diff +
   the concrete correction directives to feed back into `/image:create`. Never
   silently accept drift (per `verify-before-complete`).

## Output

1. `GATE: pass|FAIL` + per-section scores.
2. Remaining diff (canon-breaking + major misses) with per-miss fixes.
3. Loop verdict: `PASS` | `continue (feed fixes to /image:create)` | `halt (plateau/oscillation/budget)`.

## Rules

- **Do NOT commit, push, or open a PR.**
- **Read-only** — verification only; regeneration is `/image:create`.
- **The human approves the final** — the loop proposes, never declares canon-perfect on its own.
