---
model_tier: medium
name: storybook-workshop
description: "Use when a component library needs a workshop — one story per concept, JSDoc summaries the manifest can carry, stories run as tests, and an opt-in MCP channel that replaces guessing with querying."
domain: engineering
workspaces:
  - engineering
packs:
  - engineering-base
---

# storybook-workshop

A story is not a demo. It is the component's **executable documentation**: the artefact an
agent reads to learn what the component accepts, and the harness that catches a contrast or
focus defect while the component is still in isolation. Stack-agnostic — the tool is
Storybook, the discipline is not.

Lifted out of [`react-shadcn-ui`](../react-shadcn-ui/SKILL.md) § Component workshop, which
keeps a pointer here rather than a copy.

## The Iron Law

```
ONE CONCEPT PER STORY. NEVER A "SizesAndVariants" STORY.
EVERY COMPONENT EXPORT AND EVERY STORY CARRIES A JSDoc @summary.
A STORY THAT SHOWS AN ANTI-PATTERN IS TAGGED `!manifest` OR THE AGENT LEARNS FROM IT.
STORIES RUN. A STORY NOBODY RUNS IS A SCREENSHOT WITH EXTRA STEPS.
```

## When to use

A shared component library exists or is being started, and one of: stories are being added,
an agent needs an inventory of what the library already offers, an a11y regression should be
caught in isolation rather than on a screen, or a Storybook MCP channel is available and
nobody has decided whether to use it.

**Skip it** for a handful of one-off components with a single consumer — the setup and
upkeep outweigh the return, and that judgement belongs to the reader rather than to this
skill.

## The story set — one concept per story

The state-coverage rows every reusable component owes become **story names**:
`Default`, `Loading`, `Empty`, `Error`, `Disabled`, `Dark`. One concept each.

A combined story — the canonical anti-pattern is `SizesAndVariants` — fails at both jobs it
has: a human cannot tell which knob caused what, and an agent reading it cannot learn a
single prop's effect because every value is co-present. Split it, one axis per story
(Storybook's own guidance on writing effective stories).

Stories render under the **same semantic tokens** as the app and the `.dark` class; a
hardcoded preview theme makes the workshop lie about what the component looks like in place.

## JSDoc `@summary` is required, and the reason is mechanical

The manifest an agent reads **truncates descriptions**. A component whose summary is a
paragraph arrives as a fragment, and the agent then infers the rest. So:

```ts
/** @summary A single-action button. Owns its own focus ring; never wrap in an anchor. */
export const Button = …

/** @summary Disabled — the click handler is not attached, not merely ignored. */
export const Disabled: StoryObj<typeof Button> = …
```

One sentence, front-loaded with the fact that changes a caller's decision.

## Before authoring — review what the library already has

The first step is not a story, it is an inventory. A library large enough to want a workshop
is large enough that the component being asked for already exists under another name, and a
second `Badge` is the failure this skill's own § Do NOT is trying to prevent elsewhere.

Read the existing stories — via the MCP channel below when it is available, by reading the
files otherwise — and only then decide whether anything needs writing.

## Procedure

1. **Inspect the existing story set before authoring anything.** Read what the library
   already has — via the MCP channel below when it is available, otherwise by reading the
   story files — and check the component against it by name and by shape.
   - **Source of truth:** the story files, or `list-all-documentation` over a running Storybook.
   - **Verify:** the component you are about to write does not already exist under another name.
2. **One story per concept**, named from the state set above.
   - **Verify:** no story name joins two axes with `And`.
3. **Write the `@summary` on the export and on each story.**
   - **Verify:** every export in the file has one, and each is a single sentence.
4. **Tag what must not be learned from** — see § Do NOT.
   - **Verify:** every anti-pattern or deprecated story carries `tags: ['!manifest']`.
5. **Run them** — § Validate.
   - **Verify:** the run reports pass/fail per story, and a11y findings land in the shape below.

## Validate — stories are tests

Run the project's story test command (the Vitest addon's `storybook test`, or whatever
`package.json` declares — read it, do not assume a name), then read the a11y result.

Write findings into `state.ui_review.a11y` in the shape
[`react-shadcn-ui`](../react-shadcn-ui/SKILL.md) § Review pass already defines:

```
{violations: [{rule, selector, severity}, …], severity_floor?, accepted_violations?}
```

**Use that shape exactly.** The engine de-duplicates on it, so a finding written in a
different shape is not a differently-formatted finding — it is a finding the engine counts
twice.

Browser tooling stays a **consumer dependency**, the same posture as `react-shadcn-ui`: this
package installs no browser and runs none. Absent the tooling, say the a11y half did not run
rather than reporting zero violations — an unrun check and a clean check produce the same
number and mean opposite things.

**One finding is decidable without a browser**, and it ships beside this skill:
`scripts/story_contrast_floor.ts` computes the WCAG 2.1 contrast ratio between two colours a
story *declares in its own args* and emits the same `(rule, selector, severity)` shape. It is
**not axe** and not a substitute for § Validate — it sees no rendered page, so role, focus,
and computed-style defects are all outside it, and a colour arriving through a token
indirection is invisible to it. It exists because "we cannot run axe here" is not a reason to
check nothing, and a declared colour pair is decidable from the file.

## Security constraints

`scripts/story_contrast_floor.ts` reads story files and computes arithmetic. No network, no
subprocess, no writes, and it never evaluates the story it reads — it matches declared literals
with a regex rather than importing the module, so running it over an untrusted repository
executes none of that repository's code. Importing a story to inspect its args would run
that file, which is the one thing a static checker must not start doing.

## MCP path — opt-in channel, never a dependency

When the project has `@storybook/addon-mcp` **and** a running Storybook,
[`existing-ui-audit`](../existing-ui-audit/SKILL.md) prefers the live tools —
`list-all-documentation`, then `get-documentation` for the components that matter — over the
hand-read inventory. **The live read wins; the file read is the fallback**, and the fallback
is never removed: an agent that cannot reach a running Storybook must still be able to
inventory the library.

**React-only while in preview.** Storybook's own MCP FAQ (docs 10.5) states the documentation
toolset supports React only during preview, so Vue, Angular, and Web Components take the
file-read path. Stated here rather than discovered at runtime.

Two operative rules, restated from Storybook's suggested agent instructions rather than
copied verbatim:

- **Never use an undocumented prop.** If the manifest does not carry it, it is not part of
  the component's surface — reading it out of the implementation is how a private prop
  becomes a de-facto API.
- **Fetch the story instructions before writing a story.** The project's own conventions
  live there; writing first and reconciling later produces a story that matches nothing.

## Output format

1. Name the inventory source used — MCP or file read — and why.
2. List the stories authored or changed, one line each, with their concept.
3. Report the story-test result, and the a11y findings in the `(rule, selector, severity)`
   shape.
4. State explicitly what did not run (no browser tooling, no running Storybook, non-React
   renderer).

## Gotchas

- **`SizesAndVariants` looks efficient and destroys both jobs** — a human cannot attribute
  the effect, and an agent cannot learn a single prop from it.
- **A truncated description reads as a complete one.** The manifest cuts the tail without
  marking it, so a paragraph-long summary arrives as a confident fragment.
- **A stale story is worse than no story.** It props-drills values the component no longer
  accepts and documents an API that does not exist; keep stories beside the component and
  change them in the same commit.
- **An unrun a11y check reports zero violations** — the same number a clean run reports.
  Say which one happened.
- **The MCP channel disappearing is normal**, not an error: no running Storybook is the
  fallback's whole purpose.

## Do NOT

- Do NOT combine two axes in one story.
- Do NOT ship a component export or a story without a `@summary`.
- Do NOT leave an anti-pattern or deprecated story untagged: it carries
  `tags: ['!manifest']` so it is excluded from the manifest and the agent never learns from
  it (Storybook's own tag mechanism for curating what the manifest exposes).
- Do NOT hardcode a preview theme in a story.
- Do NOT make the MCP channel required, and do NOT remove the file-read fallback.
- Do NOT report zero a11y violations when the a11y tooling did not run.

## See also

- [`react-shadcn-ui`](../react-shadcn-ui/SKILL.md) — the React stack lane, and the `(rule, selector, severity)` shape § Validate writes into.
- [`existing-ui-audit`](../existing-ui-audit/SKILL.md) — the inventory the MCP path accelerates.
- [`js-library-packaging`](../js-library-packaging/SKILL.md) — the package around the workshop.
- [`accessibility-auditor`](../accessibility-auditor/SKILL.md) — the WCAG depth behind the a11y half.
- [`fe-design`](../fe-design/SKILL.md) § Component Architecture — the stack-agnostic isolate-and-document principle.
