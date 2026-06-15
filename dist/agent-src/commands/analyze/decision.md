---
model_tier: inherit
name: analyze-decision
pack: analysis-workbench
tier: 2
visibility: internal
cluster: analyze
sub: decision
skills: [decision-review]
description: Audit a past architectural decision — restate what was chosen and why, compare original assumptions against reality now, produce a verdict (still valid / needs amendment / superseded).
suggestion:
  eligible: true
  trigger_description: "decision review, ADR review, did this hold up, rückblick Architektur, past decision"
  trigger_context: "user wants to audit a past architectural decision or ADR for continued validity"
workspaces:
  - engineering
packs:
  - analysis-workbench
---

# /analyze:decision

Past-decision audit sub-command in the `/analyze` cluster.
Loads and runs the
[`decision-review`](../../../../skills/decision-review/SKILL.md) skill.

## Instructions

### 1. Identify the decision

Ask the user (in their language) for:

- The ADR identifier (e.g. `ADR-042`) or informal name.
- The path to the ADR file, or the slug to look up in `docs/decisions/`
  or `docs/adrs/`.

If the user names the decision informally, check the index before
reading the full file.

### 2. Run the decision-review skill

Delegate to
[`decision-review`](../../../../skills/decision-review/SKILL.md) verbatim:

1. **Locate and read the full ADR** before proceeding.
2. **Restate** — chosen option, context then, assumptions, alternatives
   rejected.
3. **Compare to reality now** — for each assumption: held / broke /
   unknown, with evidence. List new information not available at
   decision time.
4. **Verdict** — one of three:
   - *Still valid* — document the validation date.
   - *Needs amendment* — core decision stands; recommend specific
     amendment.
   - *Superseded* — name the successor option; recommend
     `decision-record` + `adr-create` as the forward path.

Hindsight discipline: judge each assumption against the information
available at the time it was made, not against the outcome alone.

### 3. Memory write-back (dedup-first)

Before drafting a new candidate, call `retrieve()` over the same
key-space (decision area, affected paths) per
[`analysis-memory-loop.md § 2`](../../../../docs/contracts/analysis-memory-loop.md):

- **Match found** → propose a `frequency` / `supersedes` update.
- **No match** → draft a new `historical-patterns` candidate:

```jsonc
{
  "type":              "historical-patterns",
  "summary":           "<one-line pattern: what held or broke>",
  "evidence_paths":    ["docs/decisions/ADR-NNN-<slug>.md"],
  "decision_surface":  ["<area1>", "<area2>"],
  "last_validated":    "<today-YYYY-MM-DD>",
  "review_after_days": 90,
  "applicable_scope":  "project"
}
```

Surface the candidate and ask:

> 1. Propose this candidate to `/memory propose` (recommended)
> 2. Refine before proposing — suggest changes
> 3. Skip memory candidate for now

**Empfehlung:** 1

If the candidate fails the admission gate (< 2 distinct evidence paths
AND < 3 future decisions in `decision_surface`), surface the gap and
suggest deferring or strengthening evidence before proposing.

### Rules

- Do NOT commit, push, or open a PR.
- Do NOT auto-promote — `/memory propose` is the intake.
- Do NOT re-litigate a decision confirmed still valid — acknowledge it,
  note the validation date, stop.
- Do NOT issue a "superseded" verdict without naming the successor
  option and recommending the forward path to `decision-record` +
  `adr-create`.

## See also

- [`decision-review`](../../../../skills/decision-review/SKILL.md)
- [`analysis-memory-loop.md`](../../../../docs/contracts/analysis-memory-loop.md)
- [`/analyze`](../command.md) — cluster orchestrator
