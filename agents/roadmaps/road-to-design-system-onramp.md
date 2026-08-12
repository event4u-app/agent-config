---
complexity: structural
---

# Road to the design-system onramp — consume the crawler ecosystem, one optional command

> **The ask (2026-08-12):** (1) survey crawlers/extractors agents can use today
> and let agent-config benefit from them; (2) plan a corpus-grounded design
> system feature — **optional, and as easy to use as possible.** Pinned commit
> for all repo claims: `ed76d224` (v10.1.0). External pins named per source.
> *(proposal)* marks this roadmap's own suggestions (ADR-211 C/D).

> **Re-verified at adoption against tip `1432c7a45`** (81 commits past the pin):
> C1–C5 all hold — no `/design-system` command exists anywhere,
> `design-intelligence` is still `execution: type: manual` (`SKILL.md:16-17`),
> `persist_grounding` is at `decision_engine.ts:688` and `--persist` at
> `ground.ts:203`, and the corpus drift is real (`motion.csv`,
> `google-fonts.csv` and the three dials are all still absent). Verdict table in
> [`road-to-august-program`](road-to-august-program.md) § Verification at adoption.
> Program sequencing: **Phase 3 is the first scheduled outcome of the upstream
> watchlist** (X5), not a one-off; **Phase 4 Step 2 is written once, in
> `road-to-source-first-frontend` Phase 4** (X4).

> **The headline finding that shapes everything below:** most of ask (2) is
> already in the tree and unreachable. The vendored design corpus is present
> (`design-intelligence/ATTRIBUTION.md:9-12`, upstream pin `b7e3af80`,
> 2026-06-07), the grounding engine is ported (`corpus-grounding/scripts/`),
> and even the MASTER.md + page-overrides **persistence is already
> implemented** (`decision_engine.ts:688` `persist_grounding`, upstream
> pattern generalized; `ground.ts:17-20` exposes `--persist`). What is missing
> is not machinery — it is **one command that reaches it**, a **refresh** to
> the drifted upstream, and an **import adapter** so the crawler ecosystem's
> output lands in the contract this package already owns. This roadmap is
> reachability work, not a new subsystem — the same shape as the
> code-intelligence reachability fix.

## Context / What is verified

**C1 — The consumer contract exists and is deliberately crawler-agnostic.**
`design-system-capture/references/design-system-json.md:3-7`: *"any external
static-extraction tool … emits this shape; the skill READS it … We own the
contract, not the crawler (council 2026-06-28)."* Field rules already say
*"Map to DTCG where it maps cleanly"* (`:34-37`), `source` (kind/ref/
captured_at) is mandatory and unprovenance'd artifacts are rejected (`:41-43`),
the trust posture is per-field human confirmation, never silent write
(`:57-63`), and `motion` finally has a consumer on the port branch (`:47-55`).
The contract was built for exactly the ecosystem surveyed below; nothing has
ever been wired to feed it.

**C2 — The generator + persistence are ported and command-less.**
`persist_grounding` writes `design-system/<slug>/MASTER.md` + `pages/<page>.md`
overrides (`decision_engine.ts:688-720`) — the upstream Master+overrides
pattern, opt-in via `--persist` (`ground.ts:20` — *"read-only except
--persist"*). But `design-intelligence` is `execution.type: manual`
(`SKILL.md:17-18`), primarily reached via the engine's `ui-design-brief`
directive, and `find src/domains -name command.md` shows **no** design-system
command anywhere — the brand cluster (`/brand:tokens`) is the nearest
neighbour and covers brand decisions, not product design-system generation.
The upstream one-liner UX ("one query → complete system → persist") has no
equivalent entry point here.

**C3 — The vendored corpus has drifted from upstream.** Port pin `b7e3af80`
(2026-06-07, v2.5.x) vs upstream `97eb2a20` (fetched + cloned 2026-08-12):
upstream `data/` now carries `google-fonts.csv` and `motion.csv` (16 GSAP
presets) which the port's `data/` lacks (directory diff), and
`design_system.py:51,61,310-317` implements the three 1-10 **design dials**
(`--variance/--motion/--density`) — `grep variance|density
corpus-grounding/scripts/*.ts` → 0 hits. Licenses unchanged (MIT corpus +
engine; Apache-2.0 material from the second upstream), so a refresh is an
ATTRIBUTION date
bump plus data + engine deltas.

**C4 — No settings surface may grow.** `road-to-zero-settings.md` (maintainer
direction 2026-08-12: ever fewer settings). "Optional" therefore cannot mean a
config key; it must mean **invoked or not invoked** — a command, suggested
never auto-run, with zero new `.agent-settings.yml` leaves.

**C5 — Two sibling roadmaps are the consumers.** The port branch's honest
refusal closes when a `design-system.json` is supplied
(`archive/road-to-provided-artifact-honesty.md` Phase 2), and
`road-to-source-first-frontend.md` Phase 4 needs a concrete, documented
producer for its URL-handover extraction artifact. This roadmap supplies the
producer path and the adapter; it changes neither sibling.

## The crawler survey (round 1–2, verdicts per ADR-211)

Two families, one relevant to design, one not — stated so the irrelevant one
is a recorded decision rather than an omission.

**Design-extraction tools (the fit — they emit what C1 consumes):**

| Tool | Pin / state | What it emits | Fit to `design-system.json` | Verdict |
|---|---|---|---|---|
| **dembrandt** (`dembrandt/dembrandt`) | v0.22.0, MIT, npm | Confidence-scored tokens from computed DOM styles; **motion auto** (duration scale, easings, per-component hover deltas); components (buttons/badges/inputs); DTCG export; DESIGN.md export (Google Stitch draft format); WCAG per-DOM-pair; drift gate with distinct exit codes; multi-page `--crawl`/`--sitemap`; **stdio MCP server** (`get_design_tokens`, `get_color_palette`, `get_typography`, `get_component_styles` …); CDP attach to an existing browser | Richest single source: `colors`, `typography`, `spacing`, `radius`, `shadow`, **`motion` incl. easings/durations** (the block that finally has a consumer), `components[].observed`; provenance derivable | **adopt as consumed** — primary documented path |
| **designlang** (designlang.app) | MIT CLI | DTCG in primitive/semantic/composite layers; Tailwind/Figma/shadcn/framework themes; `--interactions` (hover/focus/active); **MCP server exposing artifacts as resources**; writes AGENTS.md/skills into the repo | DTCG path via the adapter's DTCG lane; interaction states feed `motion`/`components` | **adopt as consumed** — second documented path; its repo-writing feature is NOT invoked (this package owns its own projection) |
| **extract-design-system** (`arvindrk/…`) | npm 0.1.x | W3C `tokens.json` + `tokens.css`; skills-first with confirm-before-apply discipline; MCP server | Clean DTCG lane; narrower (no motion/components) | **adopt as consumed** — DTCG-lane fixture donor |
| **Chrome DevTools MCP** | official | Raw CDP: computed styles, DOM, coverage | Not a token emitter — it is the *manual* extraction channel the source-first roadmap's browser-handover section already names | **cross-ref only** (source-first Phase 4), no adapter lane |

**General content crawlers (not this problem):** Firecrawl, Crawl4AI, fastCRW,
Browserbase/Stagehand, Apify — LLM-ready *content* (markdown/structured text),
not computed styles; none emits design tokens. **Parked** for this roadmap.
One line of honest scope: they are relevant to the *research/harvest* tooling
question (source ingestion for harvest sweeps), which is a different roadmap
if ever wanted — recorded here so the survey's negative half is citable.

**The lock, restated once.** Every verdict above is **consume-side**: the user
installs/connects the tool (npm, MCP), the package ships an adapter (pure file
transform), instructions, and validation — never the crawler, the Playwright
runtime, or a font-bundler (council 2026-06-28; the sharpened accept-side
reading in `archive/road-to-provided-artifact-honesty.md` § Design constraints).

## Phase 1: The import adapter — three lanes into one contract

- [ ] **Step 1:** `design-system:import` *(proposal)* — a pure, no-network
      file transform under `src/scripts/` with three input lanes:
      (a) **native** `design-system.json` → validate against C1's field rules
      and pass through; (b) **DTCG** `.tokens.json` → map per the contract's
      own DTCG note (colors/typography/spacing/radius/shadow), everything
      unmappable to `_meta`; (c) **dembrandt raw JSON** → the rich lane:
      semantic colors → roles, motion durations/easings → the `motion` block,
      component observations → `components[].observed`, WCAG results →
      `_meta`. Provenance stays mandatory on every lane — an input without a
      derivable `source.ref` is rejected, exactly as the contract already
      demands.
- [ ] **Step 2:** Fixtures from real tool output: one committed sample per
      lane (dembrandt `--json-only`, a DTCG `.tokens.json` from
      extract-design-system, a hand-minimal native file), each with the
      expected adapter output — the compatibility matrix as tests, not prose.
- [ ] **Step 3:** A short *extractor compatibility* section appended to
      `design-system-json.md` naming the three lanes, the two documented
      producers, and the lock boundary — so the next reader learns "which
      crawler" from the contract itself.

**Falsifier.** A lane's real-world sample cannot be mapped without inventing
values → that lane ships as `_meta`-only (observation, not tokens) and the
matrix says so; no lane is forced.

**Rollback.** One script, three fixtures, one doc section.

## Phase 2: The onramp — one optional command, zero settings

- [ ] **Step 1:** `/design-system` command cluster *(proposal)*, engineering
      pack, following the `/brand:tokens` command shape: three subs —
      **`generate "<product / industry / keywords>"`** runs the grounded
      one-shot via `ground.ts` (the upstream `--design-system` UX at parity),
      prints the full recommendation, and offers `--persist` (existing
      `persist_grounding`, MASTER.md + pages) **and/or** seeding `DESIGN.md`
      through `design-system-capture` — the package's own design memory
      remains the canonical home, MASTER.md the interchange format;
      **`import <file>`** runs the Phase-1 adapter and hands the result to
      `design-system-capture`'s existing per-field-confirmation import;
      **`capture`** routes to `existing-ui-audit`'s existing same-shape emit
      for the current repo. No new machinery in any sub — three doors onto
      three things that already run.
- [ ] **Step 2:** Optionality per C4: no settings key, no always-on rule, no
      auto-trigger. The command is suggestion-eligible where a design-system
      question is explicit, and otherwise silent. The "as easy as possible"
      path is documented in the command body as two lines: *connect an
      extractor once (e.g. `claude mcp add … dembrandt-mcp`), then
      `/design-system import` its output — or skip the extractor entirely and
      `/design-system generate` from the corpus.*
- [ ] **Step 3:** Precedence restated where the command lands: generated
      output is a **proposal**; a provided artifact, registered brand tokens,
      and a confirmed `DESIGN.md` all outrank it (the chain
      `design-fidelity-mechanics` + C1 trust posture already define — cited,
      not redefined).

**Falsifier.** Two release windows with zero invocations outside the
maintainer's own runs → the onramp has no demand; demote the cluster to
`later/` and keep only the Phase-1 adapter (which the port branch consumes
regardless).

**Rollback.** One command cluster; the engines it fronts are untouched.

## Phase 3: Corpus refresh — close the v2.5 → v2.6 drift

**Re-labelled at adoption (program X5): this is the first *scheduled outcome* of
the upstream watchlist**, not a one-off fix. The pin drifted `b7e3af80` →
`97eb2a20` unnoticed for two months, which is the concrete proof that the
watchlist's scope is "everything we pin upstream", not just host issues.

- [ ] **Step 1:** Re-pin the vendored corpus to upstream `97eb2a20`: bring
      `motion.csv` (16 GSAP presets) and `google-fonts.csv` into
      `design-intelligence/data/`, manifest rows included; ATTRIBUTION.md
      SHA + date bump; license posture re-checked (MIT/Apache-2.0 unchanged
      at the fetched pin — verify at refresh time, not from this sentence).
      **Downstream surface the draft did not name (found at adoption): the pin is
      replicated in ten places, not one** — `ATTRIBUTION.md:8-11`,
      `design-intelligence/data/manifest.json:3`,
      `design-intelligence/references/design-languages.md:6`,
      `design-tokens/SKILL.md:34`, `corpus-grounding/SKILL.md:29`,
      `tailwind-engineer/scripts/tailwind_config_gen.ts:4`,
      `react-shadcn-ui/scripts/shadcn_add.ts:4`, `ADR-061:170`, plus two watch
      notes. A re-pin that touches only ATTRIBUTION leaves nine stale SHAs
      behind, each of which reads as authoritative.
- [ ] **Step 2:** Port the three design dials into `decision_engine.ts` +
      `ground.ts` flags (`--variance/--motion/--density`, 1-10, unset = no
      behaviour change — upstream's own contract), surfaced as optional args
      on `/design-system generate`.
- [ ] **Step 3:** One regression fixture per dial tier boundary, mirroring
      upstream's `DIAL_TIERS`, so the next upstream refresh diffs against
      pinned expectations instead of memory.

**Falsifier.** Upstream's dial implementation turns out to depend on data the
MIT grant does not cover → dials are re-implemented from the tier table alone
(trivial: three range maps) and the ATTRIBUTION notes the divergence.

**Rollback.** Data files + engine flags; the v2.5 behaviour is the no-flag path.

## Phase 4: Wire the consumers — cross-refs, no duplication

- [ ] **Step 1:** The port branch: `design-system-capture`'s import step and
      the honest-refusal recommendation ("supply the contract") gain one line
      naming the now-real supply path — `/design-system import` over a
      connected extractor's output closes the refusal branch.
- [-] **Step 2:** *(merged at adoption — program X4)* The producer sentence for
      `road-to-source-first-frontend` Phase 4's URL-handover section — connected
      extractor MCP (dembrandt / designlang), manual Chrome-DevTools-MCP as
      fallback — is now written **once, in that roadmap's Phase 4 Step 2**, which
      owns the section. Two roadmaps writing one sentence into the same file is
      the drift this merge removes; the content is unchanged and not lost.
- [ ] **Step 3:** dembrandt's drift gate (exit 0/1/2/67, `--compare`
      baseline) recorded as a **parked** candidate for the design-quality CI
      lane — one line in the compatibility section, taken up only if the
      design-quality roadmap asks for runtime drift detection.

**Falsifier.** Owned by the sibling roadmaps' own falsifiers.

## Phase 5: Measure

- [ ] **Step 1:** Count `/design-system` invocations and adapter runs per
      release window (the command telemetry the estate already records for
      clusters); publish alongside the Phase-2 falsifier's threshold.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-12 | reviewer: claude/host -->
| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | A command cluster nobody invokes | product | The whole onramp rests on the premise that the machinery is unreachable rather than unwanted. Those are different diagnoses with the same symptom, and this roadmap only verified the first. Three new subcommands that go uninvoked add a permanent surface to the command catalogue, whose budget is already governed | Phase 2's falsifier demotes the cluster to `later/` after two release windows with zero invocations outside the maintainer's own runs, keeping only the Phase-1 adapter, which the port branch consumes regardless of whether the command exists | Phase 2 |
| 2 | A re-pin that leaves nine stale SHAs behind | implementation | The uupm pin is replicated in ten places, found at adoption and not in the draft. Bumping ATTRIBUTION alone leaves nine documents asserting `b7e3af80` as current, each of which reads as authoritative to the next reader and to any future drift check | Step 1 names all ten sites explicitly, so the sweep is a checklist rather than a memory exercise, and Step 3's regression fixture diffs the next refresh against pinned expectations instead of recollection | Phase 3 Step 1 |
| 3 | An adapter pinned to output shapes that move | implementation | Three lanes are mapped against three third-party tools at one moment in their release history. Tool output is not a contract this package controls, so a lane can silently start producing values the mapper drops or misreads, and a token import that quietly loses the motion block looks like a successful run | Step 2 commits one real sample per lane with its expected adapter output, so a shape change fails a test instead of degrading an import; the falsifier ships an unmappable lane as `_meta`-only observation rather than forcing values | Phase 1 Step 2 |
| 4 | A consumed tool becomes a dependency without an intake review | implementation | Naming dembrandt as the primary documented path pushes users toward installing a third-party npm package and connecting its MCP server. This package would then be recommending a supply-chain surface it does not review, on the strength of one survey round | Every verdict is consume-side by construction — the user installs and connects, the package ships only a pure file transform — and the documented path states the boundary; the recommendation names alternatives rather than a single required tool | The crawler survey |
| 5 | Optionality erodes into configuration | product | "Optional" is defined here as invoked-or-not, against a maintainer direction of ever fewer settings. The pressure to add one flag — a default extractor, a persist default — arrives with the first real user, and each one is a settings key the zero-settings direction spent effort removing | Step 2 states the zero-new-keys constraint in the roadmap and in the command body, and the easy path is documented as two literal invocations rather than as configuration to be set once | Phase 2 Step 2 |

## Non-goals

- **No crawler, browser runtime, or font-bundler shipped** — the 2026-06-28
  lock holds; every tool above is user-connected, and the package's share is
  adapter + instructions + validation.
- **No new settings keys** (zero-settings direction) — optionality is
  invocation, not configuration.
- **No parallel token format** — DTCG and `design-system.json` remain the two
  shapes; MASTER.md is interchange, `DESIGN.md` stays the canonical design
  memory.
- **No auto-apply** — the per-field confirmation trust posture is untouched;
  generated systems and imported extractions are proposals.
- **No general-crawler integration** (Firecrawl/Crawl4AI et al.) — parked
  with its one-line rationale above; a research-tooling roadmap may pick it
  up, this one does not.
