# Upstream watchlist — everything this tree pins outside itself

> Durable record of the upstream facts this package's own design depends on, and
> what in this tree breaks or reopens when one of them changes. Walked once per
> release review (`docs/release-runbook.md` § 1). Cite this file rather than
> re-deriving a pin from a roadmap.

Created by `road-to-symptom-driven-harvest-loop` Phase 3. Its scope is
deliberately **wider than host issues**: the first draft seeded only the host
tool's issue tracker, and the widening has a concrete cause — a vendored corpus
pin drifted for two months without anyone noticing, which is the same maintenance
shape as an upstream issue closing, with the same consequence and no watcher.

## The `kind` axis

| `kind` | What it pins | Failure when it moves unnoticed |
|---|---|---|
| `host-issue` | a bug or behaviour in the agent host this tree designs around | a mechanism is built against a bug that was fixed, or a workaround is kept forever |
| `vendored-corpus` | a third-party corpus or engine copied into this tree under its license | the port silently diverges from upstream; features land there and never here |
| `consumed-tool` | a tool the **user** installs or connects, whose output this package adapts | an adapter maps a shape the tool no longer emits, and the import degrades instead of failing |

## Entries

### `host-issue`

| Ref | What it says | What depends on it here |
|---|---|---|
| `anthropics/claude-code#58109` (← `#20190`) | the Task tool drops a subagent's structured final report when its message sequence ends with a `tool_use` block, returning only the last pre-tool text | the entire return-channel design in `road-to-subagent-lifecycle-integrity` Phase 2 — the disk-fallback channel exists *because* of this. If it closes upstream, Phase 2 Step 2 may reduce to validation without a fallback |
| `anthropics/claude-code#20221` | prompt-type `SubagentStop` hooks send feedback but cannot prevent termination | why that Phase 2 concern is **command type only**. If it closes, the prompt-type option reopens |
| `anthropics/claude-code#55754` | a Stop hook grading a turn incomplete while an async subagent is pending loops until the session quota is gone | the ledger-aware turn-end-gate step (Phase 3 Step 2). This is the shape our always-armed `turn-end-gate` could reproduce |
| `anthropics/claude-code#68619` | recursive spawn regressions; depth caps must live where one process sees the whole tree | why the spawn guard is orchestrator-side rather than carried by children |

**Status of all four is unverified against the currently installed host** — that
is a Phase 0 spike in the dependent roadmap, not an assumption this file makes.

### `vendored-corpus`

| Pin | Recorded at | What depends on it here |
|---|---|---|
the vendored design corpus @ `b7e3af80` — identity and license in `ATTRIBUTION.md` (MIT corpus + engine; second upstream Apache-2.0) | `src/skills/design-intelligence/ATTRIBUTION.md:8-11`, replicated in nine further places — `data/manifest.json:3`, `references/design-languages.md:6`, `design-tokens/SKILL.md:34`, `corpus-grounding/SKILL.md:29`, `tailwind-engineer/scripts/tailwind_config_gen.ts:4`, `react-shadcn-ui/scripts/shadcn_add.ts:4`, `ADR-061:170`, plus two watch notes | the grounding corpus and engine. **Known drifted:** upstream is at `97eb2a20` and carries `motion.csv`, `google-fonts.csv` and three design dials the port lacks. `road-to-design-system-onramp` Phase 3 closes it — and a re-pin must sweep all ten sites, or nine documents keep asserting a stale SHA as current |

This row is why the watchlist exists in this shape: the drift ran for two months
with every gate green, because no gate compares a vendored pin against upstream.

### `consumed-tool`

Consume-side by construction (council 2026-06-28): the user installs or connects
the tool, this package ships an adapter, instructions, and validation — never the
crawler, the browser runtime, or a font-bundler. So a version move here degrades
an *import*, it does not break the build.

| Tool | What depends on it here |
|---|---|
| `dembrandt` (MIT, npm + stdio MCP) | the rich import lane in `road-to-design-system-onramp` Phase 1 — semantic colors, motion durations/easings, component observations. The `motion` block of the `design-system.json` contract gets its first real producer from this lane |
| `designlang` (MIT CLI + MCP resources) | the DTCG import lane; its `--interactions` output feeds `motion`/`components` |
| `extract-design-system` (npm) | the DTCG-lane fixture donor |
| Playwright MCP · Chrome DevTools MCP | the structured-snapshot and manual-extraction rungs of the data-basis ladder in `road-to-source-first-frontend` Phases 2 and 4 |

## Walk procedure

Once per release review: for each entry, check whether the upstream fact moved.
Record status changes here, then open or close the dependent items in their own
change — never silently. An entry whose dependency has shipped and closed is
deleted, not archived in place.

## Falsifier

Two consecutive release reviews where the walk changes nothing → the watchlist is
ceremony: fold each entry into the roadmap that depends on it and delete this
file. A recurring checklist line that never changes anything is worse than no
line, because it trains the reviewer to skip the one walk that would have
mattered.
