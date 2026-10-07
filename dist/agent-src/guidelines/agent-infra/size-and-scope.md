# size-and-scope-guidelines

## Purpose

Ensure all system components stay:

- readable
- maintainable
- executable
- non-redundant

Prevent:
- oversized rules
- bloated skills
- command overreach
- duplicated knowledge

---

# Core principle

> Split by responsibility, NOT by length.

Size is a signal — not the goal.

---

# Golden size rules

## Rules & system instructions

- Ideal: **< 60 lines**
- Acceptable: **< 100–120 lines**
- Hard limit: **< 200 lines**

Linter (structural model, 2026-05-08 — see
[`docs/contracts/linter-structural-model.md`](../../contracts/linter-structural-model.md)):
the long-rule warning fires only when the rule is **> 60 non-empty
lines AND density < 0.50 AND ships no Iron-Law block**. Rules whose
body is a verbatim ALL-CAPS imperative (`commit-policy`,
`ask-when-uncertain`, `direct-answers`) are auto-exempt — no
frontmatter flag required. The 200-line hard error stays
unconditional.

Reason:
- Loaded frequently
- Must be reliably followed
- Large files get partially ignored

---

## Skills

- Target: **300–900 words**
- Warning: **> 400 lines AND (density < 0.60 OR ≥ 2 `## Procedure`
  blocks)** — structural model, 2026-05-08
- Reference-rich skills with high density (`quality-tools` at 0.83,
  catalogue-style skills) pass without splitting; the multi-procedure
  trigger flags genuine cluster-split candidates regardless of size

Focus:
- scanability
- one responsibility
- executable workflow

---

## Commands

- Target: **200–600 words**
- Acceptable: **up to ~1000 words**
- Warning: **> 1000 words AND no delegation signal AND density < 0.65**
  — structural model, 2026-05-08. A delegation signal is either
  frontmatter (`cluster:` / `routes_to:`) OR ≥ 3 markdown links to
  other `.md` files. Well-factored orchestrators pass automatically;
  inlined logic in a non-orchestrator command warns.

Commands orchestrate — not implement.

---

## AGENTS.md

- Enforced budget: **character caps** via `lint_agents_md.ts` — package
  root fails at **3,000 chars** (warns 2,800); consumer template fails at
  **2,500 chars** (warns 2,300).
- Word guidance: aim for **≤ ~450 words** — that is roughly what fits
  under the 3,000-char cap.

High-level only.

---

## copilot-instructions.md

- Ideal: **< 60 lines**
- Acceptable: **< 100–150 lines**
- Note: Copilot Code Review reads only the **first 4,000 characters**
  (see `src/agent-src/templates/copilot-instructions.md`), so the
  effective cap is character-based — highest-priority rules go up top.

Must stay lightweight.

---

## Guidelines

- Target: **400–1500 words**
- Can exceed if needed

Guidelines are reference — not execution.

---

## Knowledge cards

Committed knowledge cards (`agents/knowledge/<source>.md`) are a size-bounded,
evidence-disciplined context type:

- Hard bound: **≤ 150 lines** — a card is a thin distillation, never a mirror.
- **Mandatory** `links.authoritative` pointer (path or URL).
- Enforced by `check_knowledge_cards.ts` (pointer-resolution CI + size +
  trust-tag + multi-evidence git-ancestry consistency; `--strict` adds a
  content-compare). Durable content = negative facts + pointers; positive
  structure is a per-line, last-verified hypothesis.

See [`source-discovery`](../../skills/source-discovery/SKILL.md) and the
`evidence-discipline` context for the full model.

---

# Component responsibilities

## Rules

- constraints only
- no workflows
- no long explanations

---

## Skills

Must contain:

- When to use
- Procedure
- Validation
- Output format
- Gotchas
- Do NOT

---

## Commands

- orchestrate workflows
- delegate to skills
- do not contain deep logic

---

## Guidelines

- define conventions
- support skills
- must NOT replace workflows

---

## AGENTS.md

- entrypoint
- system overview
- interaction model

---

## copilot-instructions.md

- behavioral hints
- style guidance

---

# Anti-patterns

## Too large

- skill solves multiple problems
- rule explains instead of constraining
- command contains implementation
- AGENTS.md becomes documentation dump

---

## Too small

- skill has no real workflow
- rule is just a suggestion
- command adds no value

---

# Boundary rule (critical)

> A skill must remain usable WITHOUT opening a guideline.

If not → the skill is too weak.

---

# Decision checklist

Before creating or modifying:

1. Is this a constraint → Rule
2. Is this a workflow → Skill
3. Is this orchestration → Command
4. Is this reference → Guideline
5. Is this entrypoint → AGENTS.md
6. Is this behavior hint → copilot-instructions.md

## Rich-class size band — moved from `token-budget-discipline`

Moved verbatim from the rule on 2026-10-06 to pay for the standing-payload cost
of `neighbour-precedence`; the rule keeps the band and a pointer here.

### Candidate rich skills (justified, not exhaustive)

These skills are approved `rich` by this roadmap's council:

| Skill | Justification summary |
|---|---|
| `design-intelligence` | 11 corpus CSVs + 16 design-language prose specs + a 10-category checklist; grounded selection needs the full reference to avoid random corpus subsets |
| `typography-system` | Modular-scale math + 6 worked example type systems; condensing to "use 1.25 ratio" produces agents that invent arbitrary px values |
| `accessibility-auditor` | WCAG criteria are non-negotiable detail; every criterion has a testable condition + failure mode; compression loses the test procedures |
| `design-system-capture` (Phase 6) | Writes + maintains DESIGN.md + PRODUCT.md; needs full templates + worked examples to generate useful artifacts |

### The size band is measured, and only its ceiling is gated

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

---

# Final principle

> Small enough to understand quickly
> Large enough to be useful
