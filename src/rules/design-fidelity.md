---
type: "auto"
tier: "2a"
description: "A provided prototype/mockup/design system is the spec — build 1:1; never swap fonts, controls, or layout unconfirmed"
triggers:
  - keyword: "prototype"
  - keyword: "mockup"
  - keyword: "wireframe"
  - keyword: "design system"
  - keyword: "design spec"
  - keyword: "Figma"
  - keyword: "handoff"
  - keyword: "Claude Design"
  - phrase: "match the design"
  - phrase: "build this design"
  - phrase: "design fidelity"
  - phrase: "stick to the design"
  - phrase: "design.html"
  - phrase: "attached artifact"
  - phrase: "provided artifact"
  - phrase: "übernimm das design"
  - phrase: "baue das nach"
  - phrase: "bau das nach"
  - phrase: "1:1 um"
  - phrase: "1:1 nach"
  - phrase: "claude.site/artifacts"
  - file_pattern: "*design.html"
  - path_prefix: ".claude/design-system/"
applies_to_user_types:
  - "creator"
  - "developer"
  - "maintainer"
routes_to:
  - "guideline:design-fidelity-mechanics"
workspaces: [engineering]
packs: [engineering-base, frontend-design]
collision_ok:
  "mockup": "a provided mockup is the spec — 1:1 fidelity floor"
# obligation: line 58
obligation_frequency: "per-edit"
---

# Design Fidelity

When the user provides a finished prototype, mockup, screenshot, or design
system, that artifact is the **spec** — not a starting point for the agent's
own taste. This rule mirrors [`brand-source-of-truth`](brand-source-of-truth.md):
the provided design is authoritative for the run.

The failure it prevents: an agent substituting its own judgment over the
supplied design — swapping fonts, replacing a slider with another control,
dropping elements, restructuring the layout — so the result looks
fundamentally different from what the user already approved. A "honesty gate",
a "cleaner" idea, or a "better flow" is **not** a licence to redesign.

## The Iron Law

```
A PROVIDED PROTOTYPE / DESIGN SYSTEM IS THE SPEC, NOT A SUGGESTION.
BUILD IT 1:1. NEVER SWAP FONTS, CONTROLS, COMPONENTS, LAYOUT, SPACING,
OR COLOUR — AND NEVER OMIT OR ADD AN ELEMENT — WITHOUT EXPLICIT CONFIRMATION.
A "BETTER IDEA" IS A PROPOSAL TO SURFACE, NEVER A CHANGE TO MAKE.
WHENEVER THE SOURCE IS REACHABLE, THE SOURCE IS THE DATA BASIS.
A SCREENSHOT IS VALIDATION, NEVER THE INPUT YOU BUILD FROM,
WHILE ANY HIGHER RUNG IS REACHABLE. WHEN THE HANDOVER *IS* AN IMAGE,
THE IMAGE IS THE SPEC AND THE 1:1 FLOOR ABOVE APPLIES TO IT UNCHANGED.
WHERE THE ARTIFACT'S OWN MARKUP / CSS / JS IS STACK-COMPATIBLE, ADAPTING
THAT CODE IS THE DEFAULT — A FROM-SCRATCH RE-DERIVATION IS A DEVIATION
AND NEEDS THE SAME CONFIRMATION AS A SWAPPED CONTROL.
```

The qualifier is load-bearing, not hedging. Unqualified, the screenshot line
contradicts this rule's own opening sentence and its § What counts as the spec,
both of which name a screenshot as a legitimate spec — and it would forbid the
image-only handover class the rule exists to govern. What it forbids is
narrower: reaching for pixels **while the code is sitting there**.

The five new lines route to
[`design-fidelity-mechanics`](../docs/guidelines/design-fidelity-mechanics.md)
§ Data-basis ladder (the first three) and § Adopt the code (the last two) —
including the scope line that keeps the adopt-the-code duty from colliding with
[`code-provenance`](code-provenance.md). Read that scope line before acting on
either rule; the boundary is stated from both sides.

## What counts as the spec

A user-provided, finished design artifact the user points at and says "match
this": a prototype (HTML / JSX / Figma export), a mockup or screenshot, a
design-system file (tokens, component library), or a URL / path. It encodes
decisions already made — treat it like brand tokens, not like inspiration.

## Two axes — artefact maturity is not instruction mandate

```
MATURITY IS A PROPERTY OF THE ARTEFACT. MANDATE IS A PROPERTY OF THE INSTRUCTION.
A HANDOVER WHOSE OWN ARTEFACT DECLARES ITSELF LOW-FIDELITY CARRIES A **STRUCTURE**
MANDATE, NEVER A **PIXEL** MANDATE — WHATEVER `design.fidelity_mode` SAYS.
REPRODUCING A WIREFRAME'S GREYS 1:1 HONOURS THE WRONG HALF OF THE ARTEFACT.
```

`strict` means *do not redesign*; never *reproduce a wireframe's placeholder grays*, which
are **non-decisions** ([`wireframe`](../skills/wireframe/SKILL.md) § Gotchas).
**The discriminator reads the ARTEFACT, never the prose.** A finished comp whose prose
mentions a wireframe it replaces routes **strictly** — a reference to a previous artefact,
not a declaration about this one. **When the artefact does not declare its maturity,
it is treated as finished**: the 1:1 floor is stricter, and guessing *low fidelity*
would authorise the redesign this rule prevents. Maturity→spec table + the pinned near-miss:
[`design-fidelity-mechanics § Artefact maturity`](../docs/guidelines/design-fidelity-mechanics.md).

## Strictness — set by `design.fidelity_mode`

Read `design.fidelity_mode` from `.agent-settings.yml`. Missing → `strict`.
That file is the project layer of a cascade that starts user-global, so "missing"
means missing from **every** layer — `agent-config settings:get
design.fidelity_mode` reports the value and the file it came from.

| Mode | Behaviour |
|---|---|
| `strict` (default) | Build 1:1. EVERY visible deviation — font, control type (slider → input, etc.), component, layout, spacing, colour, an omitted or added element — requires explicit confirmation. A "better" alternative is surfaced as a numbered option, never executed. |
| `structural` | Structure is locked — fonts, control types, component set, layout, no omissions still require confirmation. Where the spec is genuinely **silent** (a state it does not show: hover / empty / error), the agent may fill the gap in the spec's style and MUST state the assumption. |
| `hard-floor` | Any deviation from the provided design is a Hard-Floor action (per [`non-destructive-by-default`](non-destructive-by-default.md)): never autonomous; no autonomy setting, roadmap, or standing instruction lifts it. |

## When it fires

A finished design artifact is provided or referenced AND the agent is building,
porting, or modifying UI to match it.

## When NOT to fire

- No provided design (greenfield from a text brief) — [`design-intelligence`](../skills/design-intelligence/SKILL.md) / [`fe-design`](../skills/fe-design/SKILL.md) define it; fidelity has nothing to bind to.
- The user explicitly invites exploration ("show me options", "redesign this", "improve the layout") — that authorises deviation for that turn.
- Non-UI surfaces (scripts, CLI, backend).

## Routing — an attached artifact is a trigger, an attached HTML file is not

Matching is plain lower-cased substring containment on the prompt, plus fnmatch
over the open files. Three handover classes must reach this rule: an English
phrasing, a German one, and a prompt carrying **no** keyword at all because the
artifact is simply attached. The last is covered by `file_pattern: *design.html`
— the conventional handover filename, not `*.html`, which would fire on every
HTML edit in every project and be strictly worse than the gap it closes. A
handover under some other filename needs one word in the prompt.

Two further handover shapes carry the artifact without any of the above:

- **A capability URL.** A published artifact is handed over as a link, not a
  file — so `phrase: "claude.site/artifacts"` fires on the *published-artifact
  path*, not on the host. `claude.ai` alone is a chat link and must stay quiet:
  a keyword on the bare domain would fire on "I pasted this from claude.ai",
  which is a conversation reference, not a spec.
- **A design-system directory.** `path_prefix: ".claude/design-system/"` — the
  conventional location for a handed-over token/component set. The prefix is the
  vendor-scoped directory, never a bare `design-system/`, which is a normal
  source folder in a large fraction of frontend repos.
- **A third-party builder's share link — UNCOVERED, deliberately.** A page built
  in Lovable / v0 / bolt and handed over as a link is a finished spec, and this
  rule does not route it. The obvious trigger was tried on this branch and
  **withdrawn**: matching is plain substring containment, so `https://v0.dev/`
  also fires on `https://v0.dev/docs`, a pricing page, or a changelog link — it
  would treat every mention of the tool's own site as a spec handover. That is
  the `claude.ai` failure the capability-URL entry above exists to avoid, and by
  this rule's own standard it is worse than the gap it closes. The alternatives
  are a bare-host keyword (broader still) or guessing each vendor's share-path
  segment, and a trigger built on a guessed path is not evidence.
  **What closes it:** a verified share-path segment per vendor, or a
  handover-word co-occurrence the matcher cannot express today. Until then the
  class needs one word in the prompt, like any other unlisted filename.
  `near-bare-host-mention` in the matrix pins the bare-host direction silent so
  a future attempt cannot reintroduce the broad form unnoticed.

The trigger set is deliberately phrase-heavy on the German side and on
`artifact`: a bare `artifact` keyword fires on "the CI build artifact is 40 MB".
`ROUTING_MATRIX` in
[`design_fidelity_routing.test.ts`](../../tests/scripts/design_fidelity_routing.test.ts)
pins both halves — every class that must route, and the near-misses that must
stay silent (fixture `daf-port-trigger-de`). Extending the set without adding a
near-miss row there is how an over-broad trigger lands: each of the two shipped
trigger classes above carries its own near-miss row
(`near-claude-ai-chat-link`, `near-generic-design-system-dir`), and the
withdrawn builder-URL class left `near-bare-host-mention` behind so the broad
form stays pinned silent.

**The near-miss must test the direction the new trigger opens, not a direction
that was already closed.** The withdrawn class is the worked example: its first
near-miss row tested a protocol-less mention, which was silent *before* the
change and therefore could not have caught the over-broadness the change
introduced. The row that would have caught it is
`near-builder-host-non-handover-url` — a documentation URL on the same host —
and it exists only because a review asked for it after the trigger had already
shipped. Write that row first next time; it is the cheap half.

Body migrated to [`guideline:design-fidelity-mechanics`](../docs/guidelines/design-fidelity-mechanics.md) (per P4 of `road-to-kernel-and-router.md`) — URL / live-page handover (extraction into the `design-system.json` contract before the first UI write, the retrieval order, the lock boundary), surgical visual edits (targeted-edit vs redesign-trigger discipline, stable anchors), asset & imagery discipline (owned-asset path, third-party delivery is self-hosted by default, real-imagery-as-proof, iconography floor, no unrequested filler), deviation-surfacing shape, failure-mode catalog, `daf-*` fixtures.
Trigger-set above activates this routing on demand, independent of the discipline profile (ADR-110).

## See also

- [`brand-source-of-truth`](brand-source-of-truth.md) / [`brand-consistency`](brand-consistency.md) — same precedence shape, for registered brand tokens.
- [`minimal-safe-diff`](minimal-safe-diff.md) — the code-diff analog (smallest change; no drive-by restructure).
- [`existing-ui-audit`](../skills/existing-ui-audit/SKILL.md) / [`ui-audit-gate`](ui-audit-gate.md) — inventory existing components before adding new ones.
- [`ask-when-uncertain`](ask-when-uncertain.md) — the one-question, numbered-option surfacing shape.
