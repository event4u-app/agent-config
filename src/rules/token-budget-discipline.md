---
type: "auto"
tier: "2a"
description: "rich-class skills are exempt from telegraph + thin-projector trims; enforce the 15% cap + justification"
triggers:
  - keyword: "token_budget_class"
  - keyword: "rich skill"
self_contained: true
workspaces: [agent-config-maintainer]
packs: [meta]
# obligation: line 43
obligation_frequency: "per-edit"
enforced_by:
  - "validator:src/scripts/lint_token_budget_discipline.ts"
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
| `rich` | Must be declared + justified | **Exempt** | **Never trimmed** | 2000–3500 tokens |

Read `tokens.rich_skills` from `.agent-settings.yml` (default `on`) — the project
layer of a cascade that starts user-global, so `agent-config settings:get
tokens.rich_skills` is the read that answers it, file included — to determine
whether rich skills may load in full. If `off`, treat them as `standard`. If
`ask`, the question's shape is
[`settings-ask-protocol`](settings-ask-protocol.md)'s, not this rule's; what only
this rule knows is the number to put in it — the estimated token delta, ≈ skill
file size in chars / 4. The answer is cached for the session and never persisted
(`tokens.rich_skills` is class C).

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
   rich-tagged skills and hard-fails if the ratio is exceeded. With ~290 skills
   (288 as-of 2026-08), the cap is ~43. Do not claim `rich` for convenience; claim it only for
   irreducible-complexity skills.

## Telegraph-speak amendment

The telegraph-speak rule is **dormant by default** — absent
`telegraph.speak` it does not project at all, so there is nothing to exempt
from. Where a consumer has enabled it, it **exempts** skills marked
`token_budget_class: rich`. When such a skill is active:

- Do not apply telegraph-speak condensation to its guidance prose
- Do not drop articles, linking auxiliaries, or extended examples
- Do not compress multi-paragraph explanations into fragments
- Preserve all worked examples, decision tables, and code blocks verbatim

This exemption is limited to the skill's guidance content; reply prose from the
*agent* (not from the skill body) remains subject to telegraph-speak wherever
that rule ships at all (`telegraph.speak`), within the carve-outs the rule
itself names.

## Value-over-budget escalation

```
BUDGET RULES EXIST TO CUT WASTE, NEVER TO CUT CAPABILITY.
A CHANGE BLOCKED PURELY ON A BUDGET LINE, WHILE PLAUSIBLY NET-POSITIVE,
GETS THE TRADE-OFF SURFACED — NOT AN AUTO-REJECT.
THE BUDGET LINE IS AN INPUT TO THE DECISION, NEVER THE DECISION ITSELF.
```

The 15 % rich-skill cap, the lean/standard/rich size targets, and every
telegraph-speak / thin-projector trim point are cost controls, not
capability ceilings. When a proposed change is blocked *purely* because
it would cross one of these lines — a skill needs more than 3500 tokens
to stay useful, a rule's condensed form loses a worked example the
frugality canon would otherwise trim — do not silently reject it.
Surface the trade-off instead: the estimated token delta, and the
expected benefit (better outcomes, fewer retries, higher activation,
fewer follow-up questions). Let the human weigh cost against value; a
budget line is not qualified to make that call alone.

This mirrors [`decision-revisit-gate`](decision-revisit-gate.md)'s
broader principle for any lock, applied specifically to the frugality
canon: a near-miss where a net-positive frontend/design change was
almost dropped purely on token-budget grounds is the canonical failure
this escalation exists to prevent.

## Candidate rich skills (justified, not exhaustive)

These skills are approved `rich` by this roadmap's council:

| Skill | Justification summary |
|---|---|
| `design-intelligence` | 11 corpus CSVs + 16 design-language prose specs + a 10-category checklist; grounded selection needs the full reference to avoid random corpus subsets |
| `typography-system` | Modular-scale math + 6 worked example type systems; condensing to "use 1.25 ratio" produces agents that invent arbitrary px values |
| `accessibility-auditor` | WCAG criteria are non-negotiable detail; every criterion has a testable condition + failure mode; compression loses the test procedures |
| `design-system-capture` (Phase 6) | Writes + maintains DESIGN.md + PRODUCT.md; needs full templates + worked examples to generate useful artifacts |

## Rich artifacts lead with a non-negotiable band

```
A RICH-CLASS ARTIFACT OPENS WITH THE SECTION THAT OUTRANKS THE REST OF ITS
OWN DOCUMENT, THEN THE REASONING LAYER.
A LONG REFERENCE READ PARTIALLY MUST LOSE THE REASONING, NEVER THE OBLIGATION.
```

The `rich` exemption buys length, and length buys the risk that a reader stops
early. Ordering is the mitigation available at authoring time: put the
load-bearing fraction first, so a partial read loses the part that was
explanation rather than the part that was binding.

This is a **precedence claim inside one document**, not a claim over other
artifacts — a rich skill's leading band outranks that skill's own later
sections and nothing else. Cross-artifact precedence is the authority index's
job.

It mitigates partial reading. It does **not** answer whether the artifact should
be shorter — that is the ceiling, gated below, and the two controls are
independent: an artifact can sit comfortably under the ceiling and still bury
its obligation on line 300.

## The size band is measured, and only its ceiling is gated

The `rich` band is **2,000–3,500 tokens** (ADR-217, `docs/decisions/ADR-217-rich-class-band-measured-and-enforced.md`).
It was 2,000–5,000 and enforced by nothing until that record: measured with the
exact BPE tokenizer, the largest rich artifact in the tree is 3,331 tokens, so
the old ceiling described no artifact that existed. An unused permission costs
nothing until someone uses it.

`lint_token_budget_discipline.ts` gates the **ceiling** and publishes every rich
artifact's size on the green path. It does **not** gate the floor, and that is a
finding rather than an omission: running the check once surfaced a 1,931-token
skill legitimately holding the class, because `rich` buys exemption from
condensation — a claim about what compression would *lose*, not about file size.
The published study supplies a degradation threshold, which is a ceiling.
Nothing measures a minimum.

Measurement is exact where `js-tiktoken` resolves and the character proxy where
it does not; the gate says which, and a proxy reading within its own error
margin of the ceiling is reported **unresolved** rather than classified.

## Governed by

- `tokens.rich_skills` setting in `.agent-settings.yml` (consumer override)
- `lint_token_budget_discipline.ts` (cap + justification + ceiling CI check)
- the telegraph-speak rule, where enabled (amended to except rich-tagged skills)

## See also

- `token_budget_class` key in `src/scripts/schemas/skill.schema.json`
- `tokens.rich_skills` in `src/config/agent-settings.template.yml`
- the telegraph-speak rule, where enabled — the frugality canon this rule amends
