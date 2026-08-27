---
type: "auto"
tier: "3"
alwaysApply: false
description: "Architecture rules for new files, classes, controllers, modules, or structural decisions about project organization"
triggers:
  - keyword: "controller"
  - keyword: "service"
  - keyword: "module"
routes_to:
  - "skill:module-detect-on-the-fly"
workspaces: [agent-config-maintainer, engineering]
packs: [meta]
collision_ok:
  "controller": "thin-handler floor on controller work"
# obligation: line 26
obligation_frequency: "per-edit"
enforced_by:
  - "instruction-only: a placement decision before any file exists"
---

# Architecture Rules

```
HTTP HANDLERS STAY THIN. BUSINESS LOGIC LIVES IN SERVICES OR USE-CASES.
ALWAYS VALIDATE AT THE REQUEST BOUNDARY. NEVER INLINE-VALIDATE INSIDE THE HANDLER.
ALWAYS READ AGENTS.MD AND PROJECT-LOCAL DOCS BEFORE STRUCTURAL DECISIONS.
```

Fires on new files, classes, controllers, modules, or any structural decision about project organization.

## General Principles

- **HTTP handlers stay thin** — no business logic; delegate to a service / use-case / domain layer.
- **Validate at the request boundary** — never inline-validate user input inside the handler. Use the framework's request-validation primitive (Laravel `FormRequest`, Symfony validator, Zod / class-validator in TS, Pydantic in Python).
- **One handler, one responsibility** — prefer single-purpose handlers over multi-action controllers when the framework supports it (Laravel `__invoke`, Next.js route handlers, Express handler-per-route).
- **Business logic lives in services / use-cases** — calculations, orchestration, cross-aggregate validation.
- **Domain models stay behavior-rich but I/O-free** — no HTTP, no DB transactions in the model; only domain rules, relationships, derived properties.
- Always check the existing directory structure before creating new files.
- Respect existing patterns — apply modern standards to **new** code only. Stale idioms in *existing* code you touch are governed by the [`active-remediation`](active-remediation.md) ladder (fix-now / note + ask), not by this line.

→ Laravel-specific patterns (FormRequest, single-action `__invoke`, Eloquent scopes): see [`laravel`](../skills/laravel/SKILL.md), [`laravel-validation`](../skills/laravel-validation/SKILL.md).
→ Symfony: see [`symfony-workflow`](../skills/symfony-workflow/SKILL.md).
→ Next.js / TypeScript backends: see [`nextjs-patterns`](../skills/nextjs-patterns/SKILL.md).

## Reusable components + object-oriented design

- **Think in reusable units** — decompose UI into composable components; reuse the project's primitives / shared abstractions before building; extract a new unit only when the same shape repeats (audit existing first, per [`ui-audit-gate`](ui-audit-gate.md)).
- **Object-oriented where it reduces complexity** — in an object-oriented / class-based codebase, encapsulation, single responsibility, composition over inheritance, behavior-rich domain objects, and design patterns *where they earn their place* are the high-priority default — never speculative abstraction, and never imposed on a functional / pipeline codebase (detect + defer to its paradigm). Bounded by [`minimal-safe-diff`](minimal-safe-diff.md) + [`senior-engineering-discipline`](senior-engineering-discipline.md), which **win on conflict**: a reviewer should be able to name the concrete duplication or second axis of change the abstraction removes (rule of thumb: two real repetitions before you extract a **code-level** abstraction; UI classes carry deliberately higher bars — per-class canon: [`abstraction-thresholds`](../docs/guidelines/abstraction-thresholds.md)).

Full standard — split FE / backend, with the stack carve-out index and the anti-over-engineering deference: [`component-oriented-and-oop-development`](../docs/guidelines/component-oriented-and-oop-development.md).

## Architectural Decision Records (ADRs)

When a structural decision is non-trivial (kernel membership, contract change, library swap,
deprecation, scope re-cut), record it as an ADR. Use the [`adr-create`](../skills/adr-create/SKILL.md)
skill — it numbers the file (`ADR-NNN-<slug>.md`), writes the standard template
(Status / Context / Decision / Consequences / Alternatives / References), and regenerates the
index via `scripts/adr/regenerate_index.ts`. ADRs land in `docs/adr/` by default; legacy
projects use `docs/decisions/`. Reversible refactors and minor cleanups do **not** need ADRs.

Body migrated to [`skill:module-detect-on-the-fly`](../skills/module-detect-on-the-fly/SKILL.md) (per P4 of `road-to-kernel-and-router.md`) — project-detection table, project-specific architecture docs, module-level documentation mechanics, packages, build/task-runner detection.
Trigger-set above activates this routing on demand, independent of the discipline profile (ADR-110).
