# design-intelligence — integration mapping

> Section-level entry point of the `design-intelligence` skill (progressive
> disclosure, 2026-08-04). Content moved VERBATIM from SKILL.md —
> load this file when the section index in SKILL.md routes here.

## `MASTER.md` + page overrides ↔ `state.ui_design` (mapping)

The upstream cross-session memory pattern maps onto our delivery state:

| Upstream artifact | Our state | Notes |
|---|---|---|
| `design-system/<project>/MASTER.md` | `state.ui_design` (project-level brief: style, tokens, typography, anti-patterns) | The state is the source of truth during a run. |
| `design-system/<project>/pages/<page>.md` | per-page override entries inside `state.ui_design` (e.g. `pages.<page>` dict) | Page rules override project rules for that page only. |

File persistence stays **opt-in** (`ground … --persist <dir>`) and writes
under the consumer's project as a durable artifact for multi-session
consistency; on a fresh session, re-hydrate `state.ui_design` from
`MASTER.md` + the page file before re-running `design`.

## Grounding the review/polish a11y gate (charts + contrast)

The `review`/`polish` steps gate on `state.ui_review.a11y`. Ground two
finding classes instead of ad-hoc judgment:

- **Chart-type findings** — the grounding CLI (`ground` via
  ./scripts-run) — `…/ground search --manifest … --domain
  chart "<data shape>"` → `Accessibility Grade`, `A11y Fallback`,
  `Color Guidance` columns justify "wrong chart type / missing colorblind
  fallback" findings with a citable row.
- **Contrast findings** — `--domain color "<product>"` returns the
  WCAG-adjusted token set; a finding that a hex pair deviates from the
  adopted set cites the row instead of eyeballing ratios. Auditing
  *method* stays with [`accessibility-auditor`](../accessibility-auditor/SKILL.md).

## Stack guidance (`--stack` axis)

Per-framework Do/Don't corpora (16 stacks) ride the same manifest:

```bash
./scripts-run <skills-root>/corpus-grounding/scripts/ground search \
  --manifest <skills-root>/design-intelligence/data/manifest.json \
  --stack react "list rerender memo" [--filter "Severity=HIGH"]
```

Stack executors ([`blade-ui`](../blade-ui/SKILL.md),
[`livewire`](../livewire/SKILL.md), [`flux`](../flux/SKILL.md),
[`react-shadcn-ui`](../react-shadcn-ui/SKILL.md),
[`tailwind-engineer`](../tailwind-engineer/SKILL.md)) pull idiomatic
guidance + docs URLs from here instead of memory.

## Diagram-type routing — route on the verb

Choose a visualization by the *intent verb*, not the noun. Count the nouns
before you draw (input-complexity triage): 1–2 → inline prose or a single
shape; 3–7 → one diagram; 8+ → split or summarize, never one dense picture.

| The user asks… | Intent | Draw |
|---|---|---|
| "how does X **work** / flow" | illustrative (intuition) | flowchart / sequence — illustrative default |
| "what is X's **architecture** / structure" | reference (structural) | structural diagram (boxes + typed edges) |
| a **cycle** / loop / lifecycle | — | a **stepper widget**, never a hand-drawn ring |
| a **DB schema / ERD** / entity relations | — | **mermaid**, never hand-placed SVG |

### Geometric pre-checks (run BEFORE finalizing an SVG/diagram)

Ranked by failure rate — procedures, not constants:

1. **viewBox safety** — compute the lowest + rightmost element (plus a buffer)
   and set the viewBox from that; never assume the default fits.
2. **arrow-through-box trace** — trace every arrow's path and confirm it does
   not cross through an unrelated box before drawing it.
3. **box-width-from-longest-label** — size each box from its longest label
   before placing it, so text never overflows.

(Reference-only: any color/easing/frame values come from the consumer's tokens
or a maintained upstream — this skill vendors no drawn-asset corpus.)

## Interplay (who owns what)

| Concern | Owner |
|---|---|
| What already exists (components, tokens) | [`existing-ui-audit`](../existing-ui-audit/SKILL.md) — mandatory pre-step; audit findings outrank corpus suggestions |
| What to build (grounded selection) | **this skill** |
| Stack-agnostic heuristics + flow | [`fe-design`](../fe-design/SKILL.md) — invokes this skill for grounding |
| Orchestration gates + locks | `directives/ui/{design,review,polish}.ts` — never import the engine |
| WCAG audit method | [`accessibility-auditor`](../accessibility-auditor/SKILL.md) |
| Token authoring | [`design-tokens`](../design-tokens/SKILL.md) |
| Lo-fi structure exploration (pre-selection) | [`wireframe`](../wireframe/SKILL.md) — disposable greyscale variants |
| Multiple hi-fi options (post-selection) | [`design-variations`](../design-variations/SKILL.md) — grounds each variation via this skill |
| Fixed-canvas slide decks | [`html-deck`](../html-deck/SKILL.md) — own medium, still corpus-grounded |
