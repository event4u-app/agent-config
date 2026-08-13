# `design-system.json` — import contract

> Lazy-loaded by `design-system-capture` ONLY when importing an extracted design
> system. Not part of the always-on skill body. This is the **consumer-side
> contract**: any external static-extraction tool (URL / git repo / local dir
> crawler) emits this shape; the skill READS it to seed/merge `DESIGN.md`. We
> own the contract, not the crawler (council 2026-06-28).

## Shape

```json
{
  "source": { "kind": "url|repo|dir", "ref": "https://example.com", "captured_at": "<ISO-8601>" },
  "colors": {
    "light": { "<role>": "<value>" },
    "dark":  { "<role>": "<value>" }
  },
  "typography": {
    "families": [{ "role": "body|display|mono", "name": "<font>", "bundled_local": false }],
    "scale": [{ "step": "xs|sm|base|lg|…", "size": "<rem/px>", "lineHeight": "<n>" }]
  },
  "spacing": { "base": "<px>", "scale": ["<px>", "…"] },
  "radius":  { "<role>": "<px>" },
  "shadow":  { "<role>": "<box-shadow>" },
  "motion":  { "durations": { "<role>": "<ms>" }, "easings": { "<role>": "<cubic-bezier>" },
               "_meta": { "detected_libs": ["gsap", "lottie"] } },
  "components": [{ "name": "<Name>", "observed": { "classes": ["…"], "props": ["…"] } }]
}
```

## Field rules

- **Map to DTCG where it maps cleanly.** `colors` / `typography` / `spacing` /
  `radius` / `shadow` correspond to the DTCG `.tokens.json` shape that
  `design-tokens` / `brand-to-tokens` already author — reuse it; do **not**
  invent a parallel token format.
- **Mark extraction-only metadata.** Anything that is *observation*, not a
  token decision, lives under a `_meta` key (e.g. `motion._meta.detected_libs`,
  `components[].observed`). It informs the human; it never becomes a token.
- **`source` is mandatory** — `kind` + `ref` + `captured_at`. An artifact with
  no provenance is rejected (you cannot confirm what you cannot trace).
- **`bundled_local`** on a font family is a flag, not an instruction: the
  package never downloads or bundles fonts (out of scope) — it records that the
  source did.
- **`motion` has a consumer.** It sits outside the DTCG mapping above, and for
  a long time that meant nothing read it at all: the block was written by
  capture and consumed by nobody, so easing and duration were re-derived from
  taste on every port. On the **Port a provided artifact** branch
  ([`design-artifact-lifecycle`](../../../../../docs/contracts/design-artifact-lifecycle.md))
  the audit reads `motion.durations` and `motion.easings` as the answer. The
  extraction-only marking above still holds: `motion._meta.detected_libs`
  informs the human and never becomes a token.

## Trust posture (mandatory)

An imported artifact is **observed, not authoritative** (mirrors
`source-discovery`: evidence vs. authoritative). It seeds `DESIGN.md` as a
**proposal the human confirms per field** — never a silent write. A field that
conflicts with a registered brand value (a confirmed `.tokens.json` / brand
token) is **flagged, never auto-applied** (`brand-source-of-truth`: consumer
brand wins). Precedence on import: registered brand tokens > confirmed
`DESIGN.md` > imported observation.

## Two sources, one shape

- **External target** (a site/repo you do not own) → an external standalone
  tool emits `design-system.json`; hand it to `design-system-capture`.
- **Current repo** → prefer [`existing-ui-audit`](../../existing-ui-audit/SKILL.md):
  it already inventories the codebase's components/tokens and can emit the same
  `design-system.json` shape, so the import path is identical either way.

The package **owns this contract**; it does **not** ship the crawler, the
Playwright runtime, or a font-bundler.

## Extractor compatibility — which crawler, and how its output gets here

The contract above says what this skill reads. This section says how a real
tool's output becomes that shape, so the answer to *"which crawler?"* lives in
the contract rather than in somebody's memory.

`src/scripts/design_system_import.ts` is a **pure, offline file transform** with
three input lanes. It reads a file and writes the contract shape to stdout — no
network, no browser, no crawl. That is the lock restated as code: a transform
that fetched would quietly become the crawler this package does not ship.

| Lane | Input | What it does |
|---|---|---|
| `native` | an existing `design-system.json` | Validates `source`, carries every other key verbatim. Past provenance the validation is **report-only** — a key whose shape contradicts the contract is flagged and kept, never dropped, because the import is a proposal a human reads. |
| `dtcg` | a W3C DTCG token file (`{$value, $type}` leaves) | Buckets by `$type`, never by group path, so it works on any authoring tool's layering. Resolves `{alias.references}` to their values. Tokens with no contract bucket land in `_meta.unmapped`. |
| `dembrandt` | an extraction tool's raw JSON | Matches the documented top-level key names and accepts a small set of shapes per bucket. Motion durations/easings become the `motion` block; per-context profiles, hover deltas, WCAG results and breakpoints are **observation** and land in `_meta`. |

```bash
./scripts-run src/scripts/design_system_import <file> \
    [--lane native|dtcg|dembrandt] \
    [--source-kind url|repo|dir --source-ref <ref>] [--captured-at <ISO>] \
    [--format json|summary]
```

**Documented producers.** Two extraction tools are known to emit input this
adapter consumes, and both are **user-installed and user-connected** — the
package ships the adapter, the instructions, and the validation, never the tool:

- **dembrandt** (MIT, npm) — the richest single source: computed-DOM tokens,
  automatic motion extraction (duration scale, easing curves), component
  observations, WCAG pairs, and a stdio MCP server. Feeds the `dembrandt` lane
  directly, or the `dtcg` lane via its `--dtcg` export.
- **designlang** (MIT) — DTCG in primitive/semantic/composite layers plus
  interaction states. Feeds the `dtcg` lane. Its own repo-writing feature is not
  invoked; this package owns its projection.

A third, **extract-design-system**, emits plain W3C `tokens.json` and feeds the
same `dtcg` lane. Any other tool that can export DTCG works without a new lane.

**Provenance is mandatory on every lane, and its origin is recorded.** DTCG
carries no `source` block by construction, so the caller supplies one; the
result then carries `source._meta.provenance_origin: "caller"` rather than
`"input"`, so a reader can always tell an extracted provenance from an asserted
one. Neither one present is a rejection, not a default — you cannot confirm what
you cannot trace.

**A lane is never forced.** Where a real sample cannot be mapped without
inventing values, the adapter emits it as `_meta` observation and says so in a
note. An import that lands mostly under `_meta` is the designed degradation, not
a failure — it means the tool's shape moved, and the values are still in front
of the human instead of silently coerced into tokens.

**Parked, not adopted — runtime drift detection.** One documented producer also
ships a drift gate: `--compare <baseline>` against a captured baseline, with
distinct exit codes (0 clean · 1 drift · 2 usage · 67 threshold) and a
machine-readable `drift` key carrying per-token `changes[]`. That is a
*design-quality CI* capability, not an import one, and nothing in this package
asks for it today — recorded here as a candidate so the next reader finds it
already assessed, and taken up only if a design-quality roadmap asks for runtime
drift detection.

The compatibility matrix is committed as tests, not prose:
`tests/scripts/fixtures/design-system-import/` holds one input/expected pair per
lane, and that directory's README states which sample is a real capture and
which is derived from a tool's published output surface.
