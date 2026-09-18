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
  - file_pattern: "*.dc.html"
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
enforced_by:
  - "instruction-only: no artefact in this tree records a fidelity comparison. lint_design_slop and lint_design_quality measure generic AI-aesthetic tells and accessibility; neither reads the handover, so a 1:1 claim is model-carried"
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
A 1:1 CLAIM IS DISCHARGED BY A COMMITTED ARTEFACT NAMING, PER HANDOVER
CHAPTER, THE EVIDENCE TAKEN — NEVER BY A BEHAVIOUR TEST, AND NEVER BY A
SENTENCE IN A REPLY. A GREEN SUITE THAT MEASURED BEHAVIOUR ANSWERS A
QUESTION FIDELITY DID NOT ASK.
```

The qualifier is load-bearing, not hedging. Unqualified, the screenshot line
contradicts this rule's own opening sentence and its § What counts as the spec,
both of which name a screenshot as a legitimate spec — and it would forbid the
image-only handover class the rule exists to govern. What it forbids is
narrower: reaching for pixels **while the code is sitting there**.

**Artifact versus brand — arbitrated here, not behind a pointer.** A brand
token wins on a **value** (colour, type, spacing), and the distance from the
artifact's own value is reported, never silently absorbed. **Structure is the
artifact's** — layout, controls, component set, order, breakpoints — never
adjusted to suit a token; a conflict is surfaced, never merged. The
adopt-the-code duty stops where [`code-provenance`](code-provenance.md) starts.

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

**Inside a configured tolerance, `strict` reports a reconciliation rather than
demanding a confirmation** — conditional on `design.approximation`, which ships
disabled with both tolerances `null`, so no default install changes. Structure,
and anything outside tolerance, is unchanged; `hard-floor` disables it outright:
[`design-reconciliation § Tolerance`](../docs/guidelines/design-reconciliation.md).

## When it fires

A finished design artifact is provided or referenced AND the agent is building,
porting, or modifying UI to match it.

## When NOT to fire

- No provided design (greenfield from a text brief) — [`design-intelligence`](../skills/design-intelligence/SKILL.md) / [`fe-design`](../skills/fe-design/SKILL.md) define it; fidelity has nothing to bind to.
- The user explicitly invites exploration ("show me options", "redesign this", "improve the layout") — that authorises deviation for that turn.
- Non-UI surfaces (scripts, CLI, backend).

## Routing — an attached artifact is a trigger, an attached HTML file is not

Matching is lower-cased substring containment on the prompt plus fnmatch over
the open files. Five classes reach this rule without a keyword being typed: the
filename patterns `*design.html` and `*.dc.html`, the published-artifact path
`claude.site/artifacts`, the directory prefix `.claude/design-system/`, and the
English and German handover phrasings. A handover under any other filename, and
a third-party builder's share link, need one word in the prompt — the
builder-URL trigger was tried and **withdrawn** as over-broad, and stays pinned
silent rather than merely absent.

Every class carries its own near-miss row in `ROUTING_MATRIX`
([`design_fidelity_routing.test.ts`](../../tests/scripts/design_fidelity_routing.test.ts)),
and the row must test the direction the NEW trigger opens, not one that was
already closed — apply that before writing a trigger, not after. Why each class
is shaped as it is, why `*.html` and a bare builder host are refused, and the
worked example behind the direction rule:
[`design-fidelity-routing`](../docs/guidelines/design-fidelity-routing.md).

Body migrated to [`guideline:design-fidelity-mechanics`](../docs/guidelines/design-fidelity-mechanics.md) (per P4 of `road-to-kernel-and-router.md`) — URL / live-page handover (extraction into the `design-system.json` contract before the first UI write, the retrieval order, the lock boundary), surgical visual edits (targeted-edit vs redesign-trigger discipline, stable anchors), asset & imagery discipline (owned-asset path, third-party delivery is self-hosted by default, real-imagery-as-proof, iconography floor, no unrequested filler), deviation-surfacing shape, failure-mode catalog, `daf-*` fixtures.
Trigger-set above activates this routing on demand, independent of the discipline profile (ADR-110).

## Honest enforcement — `instruction-only`

Nothing records a fidelity comparison. The estate's two design linters measure
generic AI-aesthetic tells (`lint_design_slop`) and accessibility
(`lint_design_quality`); neither opens the handover, so nothing can tell a
proven 1:1 from an asserted one. The proof clause in the Iron Law is therefore
model-carried, and the committed matrix
([`design-review`](../skills/design-review/SKILL.md) § Fidelity proof) is the
control — a reviewer can open it, which is more than any gate here does.

## See also

- [`brand-source-of-truth`](brand-source-of-truth.md) / [`brand-consistency`](brand-consistency.md) — same precedence shape, for registered brand tokens.
- [`minimal-safe-diff`](minimal-safe-diff.md) — the code-diff analog (smallest change; no drive-by restructure).
- [`existing-ui-audit`](../skills/existing-ui-audit/SKILL.md) / [`ui-audit-gate`](ui-audit-gate.md) — inventory existing components before adding new ones.
- [`design-review`](../skills/design-review/SKILL.md) § Fidelity proof — the matrix that discharges the proof clause.
- [`ask-when-uncertain`](ask-when-uncertain.md) — the one-question, numbered-option surfacing shape.
