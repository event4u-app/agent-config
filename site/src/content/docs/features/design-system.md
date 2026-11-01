---
title: Give your AI agent a design system to follow
description: Generate a design system from a product brief, capture the one your repository already has or import one extracted from a site — then the agent builds UI against it instead of its own taste.
---

Capture the components and tokens your repository already uses:

```text
/design-system:capture
```

## What it does

Three ways in, one result: a `DESIGN.md` in your repository that the agent treats as the spec for UI work.

- **`/design-system:capture`** inventories your own components and tokens.
- **`/design-system:import <file>`** takes the output of a design-extraction tool, or a snapshot exported from a design canvas, and maps it into the same shape.
- **`/design-system:generate "<product or industry>"`** proposes a design system grounded in a curated design corpus — type, colour, spacing, motion — when you have none yet.

Every value is confirmed with you field by field before it lands in `DESIGN.md`. `/design-system:sync` reconciles a design system that already exists on your design canvas with the code.

## When to use it

- Before the agent builds its first screen in a project.
- When UI the agent builds keeps moving away from what your designers drew.

## Example

```text
/design-system:generate "B2B invoicing app for small agencies"
```

The answer is a recommendation you can keep, change or drop; with your go-ahead it seeds `DESIGN.md`.

## What it needs

- Any [supported AI coding tool](/agent-config/tools/overview/) and the `frontend-design` set of skills; `agent-config packs:active` shows whether it is active for you.

## Limits

- A provided design is the spec: once it exists, the agent builds it as drawn and asks before deviating, rather than improving it to its own taste.
- Imported files are read as data; nothing in a snapshot is executed.
