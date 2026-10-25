---
schema_version: 1
kind: user-type-axis
---

# `user-types/` — Install-time skill-filter axis

This directory defines the **install-time** user-type axis. A user-type
is the *kind of work* a maintainer does (`consultant`, `creator`,
`developer`, `finance`, `founder`, `gtm`, `ops`). It is written to
`personal.user_type` in the consumer's `.agent-settings.yml` by the setup
wizard (`agent-config setup`) or by `src/scripts/install.ts --user-type=<id>`.
One runtime reader exists: the MCP server's prompt list
(`src/scripts/mcp_server/prompts.ts`) intersects
`recommended_for_user_types` frontmatter with the configured value and sorts
the matching prompts first. The host's own skill selection does not read it,
so the value orders a menu and filters nothing.

This axis is **distinct** from `.agent-src.uncondensed/user-types/`
(refine-ticket review-lens axis, owned by `step-6-user-types-axis.md`).
Same word, different layer:

| Axis | Layer | Owner roadmap | Example values |
|---|---|---|---|
| Install filter (this dir) | onboarding | `step-9-user-types-axis.md` | `consultant`, `creator`, `developer` |
| Review lens | runtime / refine-ticket | `step-6-user-types-axis.md` | `galabau-field-crew`, `truck-driver` |

The two never collide: the install axis orders *which MCP prompts come
first*; review lens narrows *whose viewpoint a refine-ticket review
adopts*. Authors can use both, neither, or just one.

## Seed user-types (7)

Every value already in active use across 32 skills' `recommended_for_user_types`
frontmatter is seeded here. Adding an 8th value REQUIRES a corresponding
file in this directory plus a skill-frontmatter audit.

| File | Audience |
|---|---|
| [`consultant.yml`](consultant.yml) | Independent consultants, contract work, deliverable framing |
| [`creator.yml`](creator.yml) | Content creators, ghostwriters, voice modeling |
| [`developer.yml`](developer.yml) | Software engineers, codebase work, CI / tests |
| [`finance.yml`](finance.yml) | Finance / FP&A, DCF, runway, scenario modeling |
| [`founder.yml`](founder.yml) | Solo founders, early-stage operators |
| [`gtm.yml`](gtm.yml) | Go-to-market: sales, marketing, positioning |
| [`ops.yml`](ops.yml) | Operations, support, ticketing, retention |

## Schema (v1)

Every `<id>.yml` carries:

```yaml
id: <stem>
description: <one-line audience description>
primary_workflows:
  - <verb-phrase>
  - <verb-phrase>
default_skill_priority:
  - <skill-stem>
  - <skill-stem>
notes: <optional one-line caveat>
```

`primary_workflows` are *what this user-type does most days*.
`default_skill_priority` is a hand-curated short-list of 3–6 skills; the
schema validates it and no code reads it yet. The MCP prompt ordering is
computed from `recommended_for_user_types` frontmatter at runtime.

## Setting it

The setup wizard offers the field. For a scripted install:

```bash
./scripts-run src/scripts/install --user-type=consultant
# writes personal.user_type: consultant into .agent-settings.yml
```

`--user-type` is optional; omitting it leaves the field empty and the MCP
prompt list keeps its unsorted order.

## Maintenance

- A change to `recommended_for_user_types` frontmatter on any skill
  must keep its values inside this directory's keys.
- Adding a new user-type → new `<id>.yml` + roadmap entry in
  `step-9-user-types-axis.md` Phase 4 (frontmatter audit).
- Removing one → archive the YAML; do **not** delete (consumers may
  have `personal.user_type` pinned to it).

## See also

- [`step-9-user-types-axis.md`](../agents/roadmaps/step-9-user-types-axis.md) — owning roadmap (this axis)
- [`step-6-user-types-axis.md`](../agents/roadmaps/step-6-user-types-axis.md) — review-lens roadmap (distinct axis)
- [`step-12-universal-os-reframe.md`](../agents/roadmaps/step-12-universal-os-reframe.md) — vision parent
