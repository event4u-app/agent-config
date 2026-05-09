# Personas

Personas are **review lenses** the host agent adopts when running a
skill — not sub-agents, not execution modes. Each persona shapes
*what* the agent looks for in a diff, plan, or artifact; the host
identity, tools, and workflow stay the same.

This page catalogs the 11 personas shipped with `event4u/agent-config`
and explains how `personas:` (lens axis) interacts with `/mode`
(role-mode axis).

## Catalog

| ID | Role | Tier | Lens summary |
|---|---|---|---|
| `developer` | Developer | core | Pragmatic implementer voice — what's the smallest correct change? |
| `senior-engineer` | Senior Engineer | core | Long-horizon impact — what does this look like in 6 months? |
| `product-owner` | Product Owner | core | Outcome over output — does this move the user metric? |
| `stakeholder` | Stakeholder | core | Risk and politics — who owns the rollback if this fails? |
| `critical-challenger` | Critical Challenger | core | Devil's-advocate voice — what assumption is load-bearing here? |
| `ai-agent` | AI Agent | core | Tool-economy voice — token cost, prompt clarity, automation seam. |
| `qa` | QA | specialist | Test coverage and regression gates. |
| `backend-architect` | Backend Architect | specialist | Service-layer boundaries, transaction scope, contract changes. |
| `eloquent-tamer` | Eloquent Tamer | specialist | N+1, query shape, ORM idioms that melt the database. |
| `security-engineer` | Security Engineer | specialist | OWASP-shaped failure modes, secret leakage, trust boundaries. |
| `frontend-engineer` | Frontend Engineer | specialist | Component lifecycle, reactive state, hydration boundaries. |

Tier rules:

- **Core (6)** — always-loaded cast. 5 sections (Focus · Mindset · Unique Questions · Output Expectations · Anti-Patterns), ≤ 120 lines.
- **Specialist (5)** — opt-in lenses. 7 sections (Core-5 + Critical Rules + Workflows), ≤ 100 lines.

Schema contract: [`docs/contracts/persona-schema.md`](contracts/persona-schema.md).

## When to invoke a persona

- **A skill cites it.** Skills declare `personas:` in frontmatter; the
  agent adopts the listed personas while running the skill. No user
  action needed. Example: `judge-security-auditor` cites
  `security-engineer` — invoking the skill applies the lens.
- **You want a second pass on existing work.** Pick the specialist
  whose checklist matches the diff: `eloquent-tamer` for ORM heavy
  changes, `frontend-engineer` for component changes,
  `backend-architect` for service-seam changes.
- **Adversarial review.** `critical-challenger` for the devil's-advocate
  voice; `security-engineer` for abuse-case framing.

Invocation example (when supported by the host tool):

```text
--personas=backend-architect,security-engineer
```

The host agent reads the persona's `Critical Rules` and `Workflows`
sections (specialist tier) or `Mindset` and `Unique Questions` (core
tier) and merges them into its review pass.

## `personas:` vs `/mode` — two different axes

| Axis | What it controls | Example |
|---|---|---|
| `/mode` (role-mode) | Which **contract** the agent operates under for a turn — what outputs are mandatory, what work is refused | `/mode reviewer` refuses to write production code |
| `personas:` (lens) | Which **review checklists** the agent overlays on a skill's procedure | `personas: [security-engineer]` adds OWASP-shaped checks to whatever skill is running |

The two compose. `/mode reviewer` + `personas: [security-engineer,
backend-architect]` = a review-only turn that applies both the
security-abuse-case lens and the service-seam lens on top of the
review contract.

Personas are **not** a replacement for `/mode`. A persona cannot
refuse work or change output contracts; that is `/mode`'s job.

## Skill citations

Specialist personas need at least one skill citation to earn their
slot. Current cite map:

| Persona | Cited by |
|---|---|
| `qa` | `judge-test-coverage` |
| `critical-challenger` | `adversarial-review`, `requesting-code-review`, `receiving-code-review` |
| `developer` · `senior-engineer` · `product-owner` · `ai-agent` | `refine-ticket`, `refine-prompt`, `estimate-ticket` |
| `backend-architect` | `authz-review`, `api-design`, `blast-radius-analyzer` |
| `eloquent-tamer` | `eloquent`, `database` |
| `security-engineer` | `judge-security-auditor`, `threat-modeling`, `authz-review` |
| `frontend-engineer` | `existing-ui-audit`, `fe-design` |

Add a citation by appending `personas: [<id>]` to the skill's
frontmatter — never overwrite an existing list, append.

## Override pattern

Consumers can override any package-shipped persona via the standard
override mechanism:

- **Frontmatter override** — change `tier`, `mode`, `description`
  while keeping the package body. Frontmatter wins.
- **Body override** — full replace. Drop a same-named file under
  `agents/personas/<id>.md`; the package version is shadowed.

See [`override-management`](../.agent-src/skills/override-management/SKILL.md)
for the mechanics.

## Anti-patterns

- **Personas as agents.** Personas are lenses, not sub-agents. They do
  not spawn processes or run tools independently.
- **Personas as modes.** They do not change the host's contract or
  refuse work. Use `/mode` for that.
- **Specialist sprawl.** Cap is "≤ 4 specialists per plate" by the
  council A-OQ2 verdict. New specialists need ≥ 1 skill citation
  before merging.
- **Core-tier mutation.** Core personas are versioned (`version` in
  frontmatter); breaking changes need a new ID, not an in-place
  rewrite.
