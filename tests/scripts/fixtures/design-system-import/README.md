# `design_system_import` lane fixtures

One input sample per lane plus its expected adapter output. These are the
compatibility matrix **as tests rather than prose** — a third-party tool that
changes its output shape fails a test here instead of degrading an import in
silence (road-to-design-system-onramp Phase 1 Step 2, Risk 3).

| File | Lane | Where the sample comes from |
|---|---|---|
| `native.json` → `native.expected.json` | `native` | Hand-authored minimal artifact in the contract's own shape, including one off-contract key so the `_meta.unmapped` path is exercised. |
| `dtcg.tokens.json` → `dtcg.expected.json` | `dtcg` | The DTCG shape **this package itself authors** — `{$value, $type}` leaves in the `primitive` / `semantic` / `dark` layering of `src/skills/design-tokens/templates/design-tokens-starter.json`. A real producer's real output, and the one whose drift would hurt most. |
| `dembrandt.json` → `dembrandt.expected.json` | `dembrandt` | **Derived from the tool's published output surface, not captured from a live run** — see the honesty note below. |

## Why the extraction-lane sample is not a live capture

Capturing real output from the extraction tool means installing it, installing a
browser runtime, and crawling a live site. The package's own lock (council
2026-06-28) is that it ships neither the crawler nor the Playwright runtime, and
a test fixture is not a reason to cross it. Running it also puts a third-party
package and a network fetch into the test path, which a pure file transform must
never need.

So the sample is built from what the tool **documents**: its published output
categories (colors, typography, spacing, borders, shadows, motion, components,
breakpoints) and the two top-level JSON keys it names explicitly — `motion` and
`wcag`. The nested value shapes are not documented anywhere public, which is
exactly why the adapter's extraction lane matches on key *names* and then
accepts a small set of shapes per bucket rather than pinning invented fields.

**What this fixture therefore does and does not prove.** It proves the adapter's
mapping rules, its `_meta` routing, and its note-emission are correct for the
shapes it claims to accept. It does **not** prove the tool emits these exact
shapes. Treat a failure here as "the adapter changed"; a real-world mismatch
will surface as an import that lands mostly under `_meta`, which is the designed
degradation and not a crash.

Replacing this file with a genuine `--json-only` capture is a strict improvement
and needs no code change — only the two JSON files and this row.
