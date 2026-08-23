# Design Handover — URL / live-page extraction

> Where a URL handover gets extracted to, what consumes it, and in what order it is read back

_Split out of [`design-fidelity-mechanics`](design-fidelity-mechanics.md) § URL / live-page handover, which carries the obligation surface and routes here. The split is the per-file depth ceiling doing its job: the mechanics file sat at 14.2k of its 16k budget, and compressing this material to fit would have cost the parts that make it actionable._

```
A HANDOVER THAT ARRIVES AS A URL IS STILL RUNG 2, NOT RUNG 4.
EXTRACT THROUGH THE USER'S CONNECTED BROWSER TOOLS INTO FILES
BEFORE ANY UI WRITE. A SCREENSHOT TAKEN DURING EXTRACTION
CARRIES QA DUTY ONLY — IT IS NEVER THE THING YOU BUILD FROM.
```

When the artifact is handed over as a **URL** rather than a file — a published
artifact link, a builder's share link, a staging or `localhost` page — rung 2 of
the [data-basis ladder](design-fidelity-mechanics.md#data-basis-ladder) is
reachable and rung 4 is not the fallback it looks like. Pull the DOM,
stylesheets, scripts and assets through the browser tools the user has
connected, and land them as files first.

## Where the extraction lands

Into `design-system.json` under `.claude/design-system/` — the `path_prefix` the
`design-fidelity` rule already routes on. That file is an **existing contract**,
specified in
[`design-system-json.md`](../../src/skills/design-system-capture/references/design-system-json.md);
this guideline defines no format of its own. Raw source files land beside it,
and screenshots taken while extracting land in a references directory next to
them.

## What consumes it

[`/design-system:import`](../../src/domains/engineering-base/design-system/import/command.md)
runs the extraction output through the three-lane adapter
(`native` / `dtcg` / `dembrandt`) into the contract shape, then hands it to
`design-system-capture`'s per-field import. The adapter is **offline** — it
reads a file and writes the contract shape; it never fetches, crawls, or
launches a browser.

## The lock boundary — stated here because this is where an agent would cross it

The package ships the contract, the adapter, and the instructions. It does
**not** ship the crawler, the Playwright runtime, or a font-bundler. Extraction
runs through the user's own connected tooling, and its output is *observed, not
authoritative*: every field is confirmed by the human, and a value conflicting
with a registered brand token is flagged rather than applied
(`brand-source-of-truth`).

## Retrieval order — so the source survives the session

Check in this order and stop at the first hit. The point is that the next
session reads a file instead of re-screenshotting the same page.

| # | Source | Why it ranks here |
|---|---|---|
| 1 | The project's own `design-system.json` | Already confirmed by a human in an earlier session — the only rung whose values someone signed off on |
| 2 | A previous extraction artifact under `.claude/design-system/` | Observed and file-backed; re-reading it costs nothing and re-extracting may drift |
| 3 | The live page | Authoritative for *today's* page, but only reachable while it is up and the tooling is connected |

**Persistence is not restated here.** Skip-if-exists unless explicitly forced,
and never silently discarding a prior confirmed decision, are owned by
[`/design-system:generate`](../../src/domains/engineering-base/design-system/generate/command.md)
— *"never overwrite a confirmed `DESIGN.md`"*, *"Never persist silently."* This
guideline states the order; that command states what happens on a collision, and
stating it twice is how the two drift apart.

## The producer sentence

The documented easy path is a connected extractor MCP, attached once and reused.
Where none is available, the manual Chrome-DevTools-MCP channel is the fallback,
and where neither is reachable the handover degrades to rung 3 or 4 — which the
ladder requires you to **name**, not to pass off as a source-based build.

## Coverage — stated honestly

No fixture scores this class yet. `daf-source-over-screenshot` scores the rung
choice on an *attached* artifact, not a URL handover.

**Its blocking reason changed on 2026-08-23 and the new one is narrower.** It was
SKIPPED since 2026-08-13 "for want of a page-reaching capture primitive". That
primitive now exists — `agent-config ui:render`, a Class-A headless capture at
desktop / 375 px / 320 px, executed against a real fixture. So the fixture is no
longer blocked on a missing capability; it is **unscored**, pending a live eval
run that puts an agent through an artifact port and judges the rung it chose.

The discipline is unchanged and still binds: claiming a regression witness before
that run would be the fabrication this package's evidence discipline exists to
prevent. What moved is which sentence is true — "we cannot measure this" became
"we have not measured this yet", and those are different claims.

## See also

- [`design-fidelity-mechanics`](design-fidelity-mechanics.md) — the data-basis ladder this operationalises, and the adopt-the-code duty that governs what you do with the extracted source.
- [`design-fidelity`](../../src/rules/design-fidelity.md) — the rule; a provided artifact is the spec.
- [`design-system-capture`](../../src/skills/design-system-capture/SKILL.md) — the per-field import the adapter hands off to.
