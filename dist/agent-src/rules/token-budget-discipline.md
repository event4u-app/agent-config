---
type: "auto"
tier: "2a"
description: "Governs token_budget_class: rich skills — exempt them from telegraph-speak + thin-projector trimming; enforce the 15% cap + justification requirement"
triggers:
  - keyword: "token_budget_class"
  - keyword: "rich skill"
  - intent: "editing a rich-tagged skill"
workspaces:
  - agent-config-maintainer
packs:
  - meta
---

# Token Budget Discipline

## Iron Law — rich skills load in full, lean skills compress

```
SKILLS MARKED token_budget_class: rich ARE INTENTIONALLY DETAILED.
LOAD THEM FULLY. DO NOT CONDENSE, SUMMARIZE, OR TRIM THEM.
THEIR LENGTH IS A DELIBERATE QUALITY INVESTMENT, NOT BLOAT.
SKILLS WITHOUT THE KEY, OR MARKED lean/standard, REMAIN SUBJECT
TO THE FULL FRUGALITY CANON (telegraph-speak, thin-projector).
```

## The three classes

| Class | Default? | Telegraph-speak | Thin-projector trimming | Target size |
|---|---|---|---|---|
| `lean` | No explicit key = lean | Full condensation | May be trimmed | < 500 tokens |
| `standard` | — | Balanced condensation | Not trimmed if priority ≥ 60 | 500–2000 tokens |
| `rich` | Must be declared + justified | **Exempt** | **Never trimmed** | 2000–5000 tokens |

Read `tokens.rich_skills` from `.agent-settings.yml` (default `on`) to determine
whether rich skills may load in full. If `off`, treat them as
`standard`. If `ask`, surface the estimated token delta (≈ skill file size in
chars / 4) and wait for user confirmation; cache the answer for the session.

## Requirements for `token_budget_class: rich`

A skill claiming `rich` MUST satisfy ALL three:

1. **`## Why this skill is rich` section** — explains in 2-5 sentences the
   irreducible complexity that makes condensation harmful (e.g. "agents need to
   see 6 worked examples to pattern-match the modular scale; condensing to the
   rule alone produces agents that invent arbitrary sizes"). The linter
   (`lint_token_budget_discipline.ts`) fails the skill if this section is absent.

2. **Not already coverable by a reference link** — if the richness is entirely
   in an external document the agent can fetch, the skill should load lean and
   carry a `load_context` pointer instead.

3. **≤ 15 % of the suite's skills may claim `rich`** — the CI linter counts
   rich-tagged skills and hard-fails if the ratio is exceeded. With ~230 skills, the
   cap is ~35. Do not claim `rich` for convenience; claim it only for
   irreducible-complexity skills.

## Telegraph-speak amendment

The `telegraph-speak` rule (Tier 1, always-on) **exempts** skills marked
`token_budget_class: rich`. When such a skill is active:

- Do not apply telegraph-speak condensation to its guidance prose
- Do not drop articles, linking auxiliaries, or extended examples
- Do not compress multi-paragraph explanations into fragments
- Preserve all worked examples, decision tables, and code blocks verbatim

This exemption is limited to the skill's guidance content; reply prose from the
*agent* (not from the skill body) remains subject to telegraph-speak unless the
user has set `telegraph.speak_scope: off`.

## Candidate rich skills (justified, not exhaustive)

These skills are approved `rich` by this roadmap's council:

| Skill | Justification summary |
|---|---|
| `design-intelligence` | 11 corpus CSVs + 16 design-language prose specs + a 10-category checklist; grounded selection needs the full reference to avoid random corpus subsets |
| `typography-system` | Modular-scale math + 6 worked example type systems; condensing to "use 1.25 ratio" produces agents that invent arbitrary px values |
| `accessibility-auditor` | WCAG criteria are non-negotiable detail; every criterion has a testable condition + failure mode; compression loses the test procedures |
| `design-system-capture` (Phase 6) | Writes + maintains DESIGN.md + PRODUCT.md; needs full templates + worked examples to generate useful artifacts |

## Governed by

- `tokens.rich_skills` setting in `.agent-settings.yml` (consumer override)
- `lint_token_budget_discipline.ts` (cap + justification CI check)
- `telegraph-speak.md` (amended to except rich-tagged skills)

## See also

- `token_budget_class` key in `src/scripts/schemas/skill.schema.json`
- `tokens.rich_skills` in `src/config/agent-settings.template.yml`
- `telegraph-speak` rule — the frugality canon this rule amends
