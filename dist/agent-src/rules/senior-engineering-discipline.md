---
type: "auto"
tier: "2b"
alwaysApply: false
description: "Writing/generating code — generalize (no overfit/tautological tests), supply the invisible cross-cutting controls, never invent an API/field/package"
triggers:
  - intent: "writing or generating code"
  - intent: "implementing a feature"
  - keyword: "implement"
  - keyword: "endpoint"
  - keyword: "query"
  - keyword: "migration"
  - keyword: "component"
  - keyword: "seeder"
  - keyword: "dependency"
  - keyword: "refactor"
routes_to:
  - "skill:ai-code-blindspots"
  - "skill:frontend-render-security"
  - "skill:supply-chain-intake"
  - "skill:testing-anti-patterns"
workspaces: [engineering]
packs: [engineering-base]
---

# Senior Engineering Discipline

Dominant failure mode of AI-written code isn't ignorance — **omission**. Model writes happy-path code satisfying the literal task + passing shallow tests, silently drops the invisible cross-cutting controls a senior supplies from unstated context. Baseline (2025 studies): a large share of AI-generated code ships a known vulnerability even at high syntax-correctness, and automation bias makes devs trust it *more* while it's *less* safe. Write like a senior: general not overfit; invisible controls present; verified against real sources, not memory. Act like a senior **owner**, not a passive typist — work in the interest of the product, the user, and the company, especially on security and quality; see a problem → react (fix it if small and task-aligned, else ask — per [`active-remediation`](active-remediation.md)) — never look away.

## The Iron Law

```
CODE AND TESTS EXPRESS THE GENERAL RULE — NEVER OVERFIT TO A FIXED CASE.
SUPPLY THE INVISIBLE CROSS-CUTTING CONTROLS THE PROMPT DID NOT NAME.
NEVER INVENT AN API, FIELD, OR PACKAGE — VERIFY IT AGAINST A REAL SOURCE.
THE HAPPY PATH THAT PASSES ONE TEST IS NOT A FINISHED CHANGE.
```

## Three obligations, every time you write code

### 1. Generalize — never overfit

- Implementation expresses the general rule, not a special case that happens to satisfy the example. Don't hardcode a derivable value; don't branch on one literal where a rule covers all inputs; don't paste a near-duplicate where an existing abstraction fits.
- Tests assert **general behavior**, never a fixed value or narrow regex passing only for one crafted input. Derive expected from inputs + seeded/random data — never hardcode what the code emits. Cover happy **and** boundary (empty / null / max / Unicode) **and** error **and**, on security paths, an abuse case. Lone happy-path assertion = tautology. → `skill:testing-anti-patterns`.

### 2. Cover the invisible controls for what you touched

Before done, assert the unmentioned cross-cutting control is present, matched to surface:

- **endpoint / route** → authorization + tenant scope + input validation + rate limit; state-changing → CSRF + audit. (`security-sensitive-stop` gates the sensitive ones.)
- **database query / migration** → parameterized (never string-built), tenant-scoped, transaction around multi-step writes, reversible migration (expand-contract, never bare `DROP`), index on filtered / FK columns.
- **user-controlled render** → output-encode; never `dangerouslySetInnerHTML` / `v-html` / `innerHTML` / `eval` on non-constant input; no secret / token in client code. → `skill:frontend-render-security`.
- **file / outbound fetch** → path-confinement + SSRF allow-list; validate server-side, never client-only.
- **infra / IaC** → least-privilege (no `Action:*` / `Resource:*`), encryption at rest, no `0.0.0.0/0` to mgmt / DB ports, no hardcoded creds; real scanner (Checkov / Trivy) is the backstop — `plan` succeeding isn't.
- **new dependency** → verify it exists on the real registry before install (hallucinated / "slopsquatted" packages ~1 in 5 AI suggestions); pin + lockfile; CVE scan. → `skill:supply-chain-intake`.

Full surface→controls table + backstop greps: → `skill:ai-code-blindspots`.

### 3. Verify — never assert from memory

No completion claim without exercising the real path (running endpoint / UI / test — not "the code looks right"). "Defined but not wired" (middleware written, never connected to the route) = **not done**. **Before pushing code / opening a PR, run a changed-files static pass — type-checker + linter scoped to the diff (`tsc --noEmit` on the touched project, linter on changed files) — even when `quality.local_auto_run` is false: a narrow probe of your own diff, NOT the suppressed full pipeline. Letting a compile/lint error hit remote CI = completion claim without evidence (the beginner error this guards).** → `verify-before-complete`, `source-discovery-gate`.

## When it fires

Any turn that writes, generates, or modifies code — feature, endpoint, query, migration, component, test, seeder, dependency, infra resource.

## When NOT to fire

- Prose / docs / config-only edits, no code behavior.
- One-line rename / typo / formatting.
- User fenced the scope ("just this one line", "skip the checks").

## Relationship to existing rules

Cross-cutting **anchor**; depth lives elsewhere and this routes to it. Doesn't replace `security-sensitive-stop` (threat-model before editing auth / billing / tenant / secret paths), `minimal-safe-diff` (smallest change), `think-before-action` (analyze first), `downstream-changes` (update all callers), `output-discipline` (no placeholder / TODO code). When one fires it wins on its subject; this adds the "generalized + invisible controls?" gate on top.

## See also

- [`ai-code-blindspots`](../skills/ai-code-blindspots/SKILL.md) — surface→controls checklist + backstop greps.
- [`frontend-render-security`](../skills/frontend-render-security/SKILL.md), [`supply-chain-intake`](../skills/supply-chain-intake/SKILL.md) — the two precision gaps.
- [`testing-anti-patterns`](../skills/testing-anti-patterns/SKILL.md) — overfit / tautological assertions + test-data realism.
- [`security-sensitive-stop`](security-sensitive-stop.md), [`engineering-safety-floor`](engineering-safety-floor.md), [`verify-before-complete`](verify-before-complete.md), [`source-discovery-gate`](source-discovery-gate.md).
