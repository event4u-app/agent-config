# Tier 3 Dispositions — Soft-by-Construction Rules

> Phase 6 deliverable for [`road-to-rule-hardening.md`](../roadmaps/road-to-rule-hardening.md).
> Records the formal disposition for every rule classified as Tier 3
> in [`rule-trigger-matrix.md`](rule-trigger-matrix.md) — judgment-bound
> rules where mechanical enforcement is not feasible at the current
> platform-capability ceiling.
>
> Last refreshed: 2026-05-04. Re-audit due: **2026-11-04** (+6 months).

## Disposition vocabulary

| Disposition | Meaning |
|---|---|
| `accept-as-soft` | Stays as a self-check rule. Re-audited each cycle against new platform capabilities — a rule that is Tier 3 today may become Tier 2 next year. |
| `convert-to-command` | Rule body shrinks to a pointer; behavior moves to a user-invoked `/`-command. |
| `deprecate` | Rule retired entirely (folded into another rule, superseded by a hook, or empirically dormant with no path forward). |

All 13 Tier 3 rules below are `accept-as-soft`. None has a clear
slash-command equivalent (Iron Laws cannot be opt-in commands by
construction), and none is a deprecation candidate (every rule still
fires routinely in observed sessions).

## Dispositions

| # | Rule | Reason mechanical enforcement is not feasible | Disposition |
|---|---|---|---|
| 1 | `agent-authority.md` | Priority Index — pure routing surface, no triggerable event of its own; every turn the agent traverses it as a check. | `accept-as-soft` |
| 2 | `analysis-skill-routing.md` | Skill-router decision; no observable surface today. Marked dormant-suspected — re-evaluate after live-fire telemetry pass. | `accept-as-soft` |
| 3 | `architecture.md` | Architectural decisions are judgment-bound (does this warrant a new module?). No syntactic surface a hook could pattern-match on. | `accept-as-soft` |
| 4 | `ask-when-uncertain.md` | One-question-per-turn Iron Law — pre-send self-check requires output rewrite, not feasible without semantic parsing. | `accept-as-soft` |
| 5 | `autonomous-execution.md` | Trivial-vs-blocking classification is judgment; "is this op trivial in this context" is not pattern-decidable. | `accept-as-soft` |
| 6 | `direct-answers.md` | No-flattery + verify + brevity Iron Laws. Pre-send rewrite gate; no platform mechanism plausible at current capability ceiling. | `accept-as-soft` |
| 7 | `docker-commands.md` | Topic-matched coding rule. Trigger is the agent recognising "Docker context", not a path or tool-name. | `accept-as-soft` |
| 8 | `e2e-testing.md` | Topic-matched (Playwright). Path-based trigger exists but enforcement is content-shape, not file-presence. | `accept-as-soft` |
| 9 | `guidelines.md` | Generic "check guidelines before code edit" — no specific event surface; semantically inseparable from "writing code". | `accept-as-soft` |
| 10 | `language-and-tone.md` | Pre-send language detection on the user's last message. Hook could mark drift, but the **rewrite** is judgment. Best-effort marker only — would be Tier 2a if mechanism existed; deferred until Tier 2 prototype lands. | `accept-as-soft` |
| 11 | `no-cheap-questions.md` | Pre-send Q&A self-check — "would the user already know this?" is judgment-bound. No platform surface. | `accept-as-soft` |
| 12 | `php-coding.md` | Topic-matched coding guideline; quality enforcement is split across PHPStan / Rector / ECS (Tier `mechanical-already` for the linter-enforceable subset). What remains here is style judgment. | `accept-as-soft` |
| 13 | `user-interaction.md` | Numbered-options Iron Law — output-shape rewrite gate. No mechanical path; the rule is the agent's contract with itself. | `accept-as-soft` |

## Re-audit clock

**Due: 2026-11-04** (six months from disposition lock-in).

At the next audit, for each rule, ask:

1. **New platform capability?** — has Augment / Claude Code shipped a
   surface (output-rewrite hook, semantic-parse callback, structured
   pre-send filter) that lets us harden this rule without judgment?
2. **Empirical drift?** — has the rule shown a new failure mode that
   suggests a Tier 2 marker would now help?
3. **Better-shaped scope?** — has the rule's contract narrowed enough
   that a `/`-command would now cover the high-frequency case?

Any "yes" → re-tier the rule, file a roadmap step, move it out of this
list. Two consecutive cycles of "no" → consider deprecation or merge.

## Why no per-rule frontmatter `tier:` rollout (closure deviation)

Original Phase 6 plan called for adding `tier:` to each rule body and a
"this is a soft rule; re-audit due …" annotation. Closure scope chose
the centralised path instead:

- All 13 dispositions are uniform (`accept-as-soft`) — no per-rule
  variation to record in the rule body.
- Editing 13 rule frontmatters triggers 13 recompressions plus 13
  cross-platform regenerations (Augment, Claude, Cursor, Cline,
  Windsurf, Gemini), most expensive part of Phase 6 with the least
  information gain.
- The `tier:` field is now declared in the rule schema as **optional**
  (`scripts/schemas/rule.schema.json`). New rules SHOULD set it; bulk
  retrofit of existing rules is its own roadmap.
- The re-audit clock lives once, here, instead of being duplicated 13
  times — single source of truth survives renames.

`rule-type-governance.md` has been updated to require `tier:` on **new
or edited** rules. The bulk-retrofit roadmap, when it runs, becomes
the moment to add per-rule annotations.

## Cross-references

- [`rule-trigger-matrix.md`](rule-trigger-matrix.md) — the canonical
  Tier-classification table.
- [`hardening-pattern.md`](hardening-pattern.md) — Tier 1 four-artefact
  pattern (the inverse of this list).
- [`tier-2-nudge-surface.md`](tier-2-nudge-surface.md) — Tier 2
  mechanism the Tier 3 rules will be re-evaluated against next cycle.
- [`road-to-rule-hardening.md`](../roadmaps/road-to-rule-hardening.md)
  Phase 6 — the roadmap step this artefact discharges.
