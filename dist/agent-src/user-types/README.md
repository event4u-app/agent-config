# User-types

> Reusable **end-user simulation lenses** as a first-class primitive,
> parallel to `personas/`. A user-type declares a *who*: a real
> end-user of the software under review (a galabau field crew, a
> truck driver, a metalworking shop). Skills consume them via
> `--user-type=<id>` on the CLI.

## Why this directory exists

`personas/` answered one question well: *how* we review (qa,
senior-engineer, critical-challenger, product-owner). It collapsed
when "personas" like `galabau-field-crew` or `truck-driver` started
landing — those are not review methodologies, they are the end-user
viewpoint a methodology reviewer should adopt while reviewing.

The two axes compose orthogonally:

```
/refine-ticket --personas=qa --user-type=truck-driver PROJ-123
```

QA methodology applied through a truck-driver end-user lens. The
split is locked in [`../../docs/contracts/adr-user-types-axis.md`](../../docs/contracts/adr-user-types-axis.md).

## What a user-type is — and is NOT

- **Is**: a small Markdown file declaring an end-user simulation —
  workflow, vocabulary, operational constraints, the questions only
  this viewpoint would ask.
- **Is NOT**: a persona. Personas describe review methodology, never
  an end-user viewpoint.
- **Is NOT**: an operational manual. User-types are review lenses
  only — they flag ticket gaps, they never instruct a trade. No
  welding procedures, no electrical work, no structural advice, no
  dangerous how-to. The Anti-Patterns section in every file
  encodes this floor.
- **Is NOT**: an install-time filter. The vocabulary overlaps with
  the install-time `user-types/` axis at the package root (see
  [`../../docs/contracts/adr-install-user-type-axis.md`](../../docs/contracts/adr-install-user-type-axis.md)),
  but the two live in different directories and consume different
  config keys. Same word, different layer — by design.

## Schema

Locked in [`../../docs/contracts/user-type-schema.md`](../../docs/contracts/user-type-schema.md).

- **Spine** — 7 sections (Focus · Daily Workflow · Vocabulary ·
  Operational Constraints · Unique Questions · Ticket Red Flags ·
  Anti-Patterns), ≤ 120 lines.
- **Frontmatter** — `id · kind: user-type · description · version · source`.

Run `task lint-skills` to enforce the schema, the size budget, and
the Anti-Generic Quality Bar.

## Anti-Generic Quality Bar (merge gate)

Every user-type encodes **≥ 5 concrete, domain-specific review
points** across `Daily Workflow`, `Vocabulary`, `Operational
Constraints`, and `Ticket Red Flags`. Generic prose is REJECTED:

- ❌ "consider mobile usability"  →  ✅ "capacitive touch fails with
  wet leather gloves at 4 °C; tap targets ≥ 60 px or voice command"
- ❌ "think about offline"  →  ✅ "no signal in cellar yards; queue
  changes locally, conflict-resolve on the morning brief"

Reviewer test: a generic reviewer persona could not have produced
the `Unique Questions` or `Ticket Red Flags` of this file. If they
could, the file is generic and must be rewritten.

## Guardrails (encoded in every Anti-Patterns block)

User-types are review lenses, not operational manuals. Every file's
`## Anti-Patterns` section MUST explicitly forbid:

- Trade-execution instructions (welding procedure, electrical work,
  structural advice, anything that could harm if followed)
- Dangerous how-to (chemical handling, equipment operation,
  work-at-height procedures)
- Medical / legal / engineering advice requiring a licensed
  practitioner

Allowed: workflow realism, ticket gap analysis, terminology
correction, mobile / offline / safety / approval signals as
ticket-requirement signals.

## How skills use user-types

CLI-only in v1 — skills do NOT declare a default `user-types:`
frontmatter key. The migration path to v2 (skill-level default key)
is documented in [`../../docs/contracts/adr-user-types-axis.md § Consequences`](../../docs/contracts/adr-user-types-axis.md).

```
/refine-ticket --user-type=truck-driver PROJ-123
```

If `--user-type=` is omitted, no end-user lens applies — persona
review proceeds without simulation.

## Authoring rules

- Every user-type is drafted via the `artifact-drafting-protocol` rule.
- Every user-type must pass the Anti-Generic Quality Bar (≥ 5
  concrete review points, ≥ 3 Unique Questions falsifiable against a
  ticket).
- Project-specific user-types live in the consumer repo
  (`dist/agent-src/user-types/` overrides), never in this package — the
  three seeds shipped here are illustrative reference content.
- Template: [`./_template/user-type.md`](./_template/user-type.md) (7 sections, ≤ 120 lines).

## No-move policy

No existing persona moves into this directory. The three seeds
shipped here (`galabau-field-crew`, `metalworking-shop`,
`truck-driver`) were born as user-types. Existing personas stay as
personas. See [`../../docs/contracts/adr-user-types-axis.md § Migration`](../../docs/contracts/adr-user-types-axis.md).

## Related

- [`../../docs/contracts/user-type-schema.md`](../../docs/contracts/user-type-schema.md) — locked schema
- [`../../docs/contracts/adr-user-types-axis.md`](../../docs/contracts/adr-user-types-axis.md) — the axis split decision
- [`../../docs/contracts/adr-install-user-type-axis.md`](../../docs/contracts/adr-install-user-type-axis.md) — install-time `user_type` axis (distinct layer)
- [`../personas/README.md`](../personas/README.md) — sister axis (methodology vs end-user)
- [`../rules/artifact-drafting-protocol.md`](../rules/artifact-drafting-protocol.md) — mandatory per new user-type
