---
type: "auto"
tier: "2b"
alwaysApply: false
description: "Writing/generating code — generalize (no overfit/tautological tests), supply the invisible cross-cutting controls, never invent an API/field/package"
triggers:
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
collision_ok:
  "migration": "migration = invisible-controls surface (reversible, indexed, tenant-scoped)"
  "refactor": "a refactor must generalize, never overfit — the anchor applies"
  "implement": "implementation = the invisible-controls checklist"
  "endpoint": "endpoint row of the surface-to-controls table"
  "component": "component work = generalize + reuse duty"
# obligation: line 69
obligation_frequency: "per-edit"
---

# Senior Engineering Discipline

The dominant failure mode of AI-written code is not ignorance — it is **omission**. The model writes the happy-path code that satisfies the literal task and passes shallow tests, and silently drops the invisible cross-cutting controls a senior engineer supplies from context the prompt never states. Baseline (2025 studies): a large share of AI-generated code ships a known vulnerability even at high syntax-correctness, and automation bias makes developers trust it *more* while it is *less* safe. Write code the way a senior does: general, not overfit; with the invisible controls present; verified against real sources, not memory. Act like a senior **owner**, not a passive typist — work in the interest of the product, the user, and the company, especially on security and quality; when you see a problem, react (fix it if small and task-aligned, otherwise ask — per [`active-remediation`](active-remediation.md)) — never look away.

## The Iron Law

```
CODE AND TESTS EXPRESS THE GENERAL RULE — NEVER OVERFIT TO A FIXED CASE.
SUPPLY THE INVISIBLE CROSS-CUTTING CONTROLS THE PROMPT DID NOT NAME.
NEVER INVENT AN API, FIELD, OR PACKAGE — VERIFY IT AGAINST A REAL SOURCE.
THE HAPPY PATH THAT PASSES ONE TEST IS NOT A FINISHED CHANGE.
```

## Three obligations, every time you write code

### 1. Generalize — never overfit

- The implementation expresses the general rule, not a special case that happens to satisfy the example. Do not hardcode a value that should be derived; do not branch on one literal where a rule covers all inputs; do not paste a near-duplicate block where an existing abstraction should be reused.
- Tests assert **general behavior**, never a fixed value or narrow regex that only passes for one crafted input. Derive expected values from the inputs and from seeded/random test data — never hardcode what the code will emit. Cover multiple cases: happy path **and** boundary (empty / null / max / Unicode) **and** error **and**, on security-sensitive paths, an abuse case. A lone happy-path assertion is a tautology, not a test. → `skill:testing-anti-patterns`.

### 2. Cover the invisible controls for what you touched

Before the change is done, assert the cross-cutting control the prompt didn't mention is present — matched to the surface:

- **endpoint / route** → authorization + tenant scope + input validation + rate limit; state-changing route → CSRF + audit. (`security-sensitive-stop` gates the sensitive ones.)
- **database query / migration** → parameterized (never string-built), tenant-scoped, transaction around multi-step writes, reversible migration (expand-contract, never a bare `DROP`), index on filtered / FK columns.
- **user-controlled render** → output-encode; never `dangerouslySetInnerHTML` / `v-html` / `innerHTML` / `eval` on non-constant input; no secret or token in client code. → `skill:frontend-render-security`.
- **file / outbound fetch** → path-confinement + SSRF allow-list; validate server-side, never client-only.
- **infra / IaC** → least-privilege (no `Action:*` / `Resource:*`), encryption at rest, no `0.0.0.0/0` to management / DB ports, no hardcoded creds; a real scanner (Checkov / Trivy) is the backstop — `plan` succeeding is not.
- **new dependency** → verify it exists on the real registry before install (hallucinated / "slopsquatted" packages are ~1 in 5 AI suggestions); pin + lockfile; CVE scan. → `skill:supply-chain-intake`.

The full surface→controls table with authoring-time backstop greps: → `skill:ai-code-blindspots`.

### 3. Verify — never assert from memory

No completion claim without exercising the real path (the running endpoint / UI / test — not "the code looks right"). "Defined but not wired" (middleware written but never connected to the route) counts as **not done**. **Before pushing code or opening a PR, run a changed-files static pass — type-checker + linter scoped to the diff (e.g. `tsc --noEmit` on the touched project, the project linter on the changed files) — even when `quality.local_auto_run` is false. This is a narrow probe of your own diff, NOT the suppressed full quality pipeline; skipping it and letting a compile/lint error hit remote CI is a completion claim without evidence (the exact beginner error this guards against).** → `verify-before-complete`, `source-discovery-gate`.

## When it fires

Any turn that writes, generates, or modifies code — a feature, endpoint, query, migration, component, test, seeder, dependency, or infra resource.

## When NOT to fire

- Prose / docs / config-only edits with no code behavior.
- A one-line rename / typo / formatting change.
- The user explicitly fenced the scope ("just this one line", "skip the checks").

## Relationship to existing rules

This is the cross-cutting **anchor**; the depth lives elsewhere and this rule routes to it. It does not replace `security-sensitive-stop` (stop-and-threat-model before editing auth / billing / tenant / secret paths), `minimal-safe-diff` (smallest change), `think-before-action` (analyze first), `downstream-changes` (update all callers), or `output-discipline` (no placeholder / TODO code). When one of those fires it wins on its own subject; this rule adds the "did I generalize and supply the invisible controls?" gate on top.

## See also

- [`ai-code-blindspots`](../skills/ai-code-blindspots/SKILL.md) — surface→controls checklist + backstop greps.
- [`frontend-render-security`](../skills/frontend-render-security/SKILL.md), [`supply-chain-intake`](../skills/supply-chain-intake/SKILL.md) — the two precision gaps.
- [`testing-anti-patterns`](../skills/testing-anti-patterns/SKILL.md) — overfit / tautological assertions + test-data realism.
- [`security-sensitive-stop`](security-sensitive-stop.md), [`engineering-safety-floor`](engineering-safety-floor.md), [`verify-before-complete`](verify-before-complete.md), [`source-discovery-gate`](source-discovery-gate.md).
