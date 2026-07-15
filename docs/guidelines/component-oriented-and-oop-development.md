# Component-Oriented & Object-Oriented Development

> Cross-cutting development standard: **think in reusable units, and prefer
> object-oriented design where it reduces complexity.** Split by surface below
> (frontend / backend), each pointing to the stack-specific carve-outs rather
> than restating them. Framework-neutral by construction — React / Storybook /
> Laravel / Symfony specifics live in their own skills, never here.

## The standard, in one breath

- **Reuse before you build.** Compose from units that already exist — audit
  first, reuse the design system / shared abstractions, extract a new unit only
  when the same shape repeats.
- **Object-oriented where it fits.** Encapsulation, single responsibility,
  composition over inheritance, and behavior-rich objects are the default *when
  they reduce complexity* — not a quota to hit.

## The load-bearing caveat — reuse/OOP is a tool, never a mandate to abstract

This standard **never** authorizes speculative abstraction. It is bounded by the
package's restraint posture and defers to it on every conflict:

- [`minimal-safe-diff`](../../src/rules/minimal-safe-diff.md) (+ its
  anti-over-engineering mechanics) — smallest change; no premature abstraction,
  no speculative feature, no rewrite for taste.
- [`senior-engineering-discipline`](../../src/rules/senior-engineering-discipline.md)
  — reuse the *existing* abstraction; generalize, don't overfit; never invent an
  API to look object-oriented.
- [`improve-before-implement`](../../src/rules/improve-before-implement.md) —
  "does it fit the existing architecture?" before adding structure.
- **When NOT to use a pattern** ([`php/patterns.md`](php/patterns.md) §) — KISS &
  YAGNI trump pattern purity: no interface for a single implementation, no
  pattern for a five-line function, no class where a function is clearer.

Rule of thumb: **two real repetitions (or a genuine second axis of change)
before you extract.** One occurrence is not a component; one branch is not a
Strategy. A reviewer should be able to name the concrete duplication or the
concrete change-axis the abstraction removes.

## Frontend — think in reusable components

Component-first is the default mindset, not an afterthought: decompose a screen
into composable units, reuse the project's primitives, and extract shared shells
when they repeat. Depth and mechanics already live in dedicated skills — consult
them, don't duplicate:

- [`fe-design`](../../src/skills/fe-design/SKILL.md) § Component Architecture —
  the stack-agnostic "kind, not framework" taxonomy, granularity, extract-on-3+.
- [`ui-component-architect`](../../src/skills/ui-component-architect/SKILL.md) —
  how to *shape* a reusable component: composition over inheritance, slot
  contracts, prop-API caps, controlled/uncontrolled, the componentization
  threshold (repeat **and** real state).
- [`existing-ui-audit`](../../src/skills/existing-ui-audit/SKILL.md) — the
  reuse-before-invent gate: inventory existing components/tokens/primitives
  first (enforced by [`ui-audit-gate`](../../src/rules/ui-audit-gate.md)).
- [`design-tokens`](../../src/skills/design-tokens/SKILL.md) /
  [`design-system-capture`](../../src/skills/design-system-capture/SKILL.md) —
  the shared token/design-system layer components draw from.

**Component workshop (Storybook et al.) — when the project is large enough.**
For a project with a real, growing shared-component library, isolating and
documenting each reusable component in a component workshop (Storybook or the
ecosystem equivalent) pays for itself — it makes components discoverable,
reviewable in isolation, and reused instead of re-invented. It is **not** worth
the setup for a small surface with a handful of one-off components. The
framework-specific setup is a carve-out, not a generic mandate — React /
Storybook specifics: [`react-shadcn-ui`](../../src/skills/react-shadcn-ui/SKILL.md)
§ Component workshop.

Framework carve-outs (never restated here): React →
[`react-shadcn-ui`](../../src/skills/react-shadcn-ui/SKILL.md); Next.js
server/client component boundary →
[`nextjs-patterns`](../../src/skills/nextjs-patterns/SKILL.md); Laravel FE →
[`blade-ui`](../../src/skills/blade-ui/SKILL.md) /
[`livewire`](../../src/skills/livewire/SKILL.md) /
[`flux`](../../src/skills/flux/SKILL.md); styling →
[`tailwind-engineer`](../../src/skills/tailwind-engineer/SKILL.md).

## Backend — object-oriented where it reduces complexity

The structural half is owned by [`architecture`](../../src/rules/architecture.md):
thin HTTP handlers, business logic in services / use-cases, behavior-rich but
I/O-free domain models, validation at the boundary. Layer the OO principles on
top of that structure, each applied only where it earns its place:

- **Encapsulation** — objects own their data + the behavior over it; no anemic
  bags mutated from the outside.
- **Single responsibility** — one class, one reason to change; no god services.
- **Composition over inheritance** — inject collaborators; reach for a base
  class only for genuine is-a substitutability, not code sharing.
- **Behavior-rich domain objects** — push rules into the model, keep services
  orchestration-thin.
- **Patterns where they earn their place** — a Strategy when a branch on a
  discriminator will grow (`if-else` chain → polymorphism); a Factory when
  construction is non-trivial; DI on an abstraction when there is a *real*
  second implementation. Not before.

Language / framework carve-outs (never restated here): PHP →
[`php-coding-patterns`](php/php-coding-patterns.md) +
[`patterns.md`](php/patterns.md) (+ `patterns/strategy.md`,
`patterns/dependency-injection.md`, `patterns/factory.md`, `patterns/service-layer.md`)
+ skills [`php-coder`](../../src/skills/php-coder/SKILL.md) /
[`php-service`](../../src/skills/php-service/SKILL.md); Laravel →
[`laravel`](../../src/skills/laravel/SKILL.md); Symfony →
[`symfony-workflow`](../../src/skills/symfony-workflow/SKILL.md); Next.js / TS →
[`nextjs-patterns`](../../src/skills/nextjs-patterns/SKILL.md); cross-language
clean-code baseline → [`code-clarity`](code-clarity.md).

## Enums over scattered literals

A field with two or more non-boolean states is an enum, not a bare string /
magic number — the small OO move that keeps a codebase greppable and safe to
change. Full rule + the defer-and-ask flow for pre-existing literals:
[`prefer-enums-over-literals`](../../src/rules/prefer-enums-over-literals.md).

## How this is reviewed

"Reuse existing components + object-oriented shape (where it reduces
complexity)" is a check on the code-quality review lens
([`judge-code-quality`](../../src/skills/judge-code-quality/SKILL.md)), so it
reaches `/review-changes`, `/judge`, the subagent judge modes, and team-mode's
fallback review frame. It stays a human-judgment call that defers to the
codebase's own conventions — never a generic SOLID dogma imposed over a project
that has chosen differently.

## See also

- [`architecture`](../../src/rules/architecture.md) — the structural home this layers onto.
- [`code-clarity`](code-clarity.md) — the cross-language clean-code baseline.
- [`minimal-safe-diff`](../../src/rules/minimal-safe-diff.md) · [`senior-engineering-discipline`](../../src/rules/senior-engineering-discipline.md) — the restraint anchors this standard is bounded by.
