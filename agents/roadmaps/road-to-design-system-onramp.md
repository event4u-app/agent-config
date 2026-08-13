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
> [`road-to-august-program`](archive/road-to-august-program.md) § Verification at adoption.
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

- [x] **Step 1:** `design-system:import` *(proposal)* — a pure, no-network
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
      **Done 2026-08-13** — `src/scripts/_lib/design_system_import.ts` (the
      transform) + `src/scripts/design_system_import.ts` (CLI). Three findings
      the step's text did not anticipate, each a silent-wrongness class rather
      than a crash:
      **(1) DTCG aliases.** `{primitive.color.gray.50}` passed through as a
      literal brace string, so every downstream consumer would inherit an
      unusable token from an import that reported success. Resolved now, with
      a depth bound, and a dangling reference is kept verbatim so the broken
      pointer stays visible instead of being blanked.
      **(2) Role collisions.** Naming a role from the last path segment alone
      collapses `color.gray.50` and `color.blue.50` onto `50`, and
      `button.radius` and `card.radius` onto `radius` — overwrites, not errors.
      A numeric or bucket-naming final segment now takes its parent with it.
      **Corrected after the R2 completion review, which showed this claim was
      too broad:** widening the *name* fixed the two shapes above and left the
      general case open — `semantic.color.background` and
      `component.card.background` still collapsed onto `background`, losing a
      token with `ok: true` and an empty note list, and that is the very
      layering this branch's own fixture uses. The claim is now true because the
      fix moved: collisions are resolved at **assignment**, not by naming. A
      write that would overwrite a *different* value widens the role with more
      of the token's own path until it is free and says so; re-stating the same
      value stays silent. The `-default` strip had the same shape of error —
      it joined before stripping, so a three-segment path took the bucket as its
      parent — and now drops `default` first.
      **(3) A malformed `source` was re-routed, not reported.** Detection keyed
      on a *valid* source block, so a native artifact with broken provenance
      fell through to a token lane and was rejected with "this format does not
      carry provenance" — true of that lane, false of the user's file.
      Presence now selects the lane; validity is reported by it.
      Two deliberate departures from the step's letter: the native lane's
      validation past `source` is **report-only** (a contradicting value is
      flagged and kept, because the import is a proposal a human reads and a
      value they can reject beats one this module deleted for them), and the
      extraction lane matches on documented key *names* with tolerant inner
      shapes rather than a pinned schema — the tool publishes no schema, and
      coding against invented field names is the failure `source-discovery-gate`
      exists to stop.
- [x] **Step 2:** Fixtures from real tool output: one committed sample per
      lane (dembrandt `--json-only`, a DTCG `.tokens.json` from
      extract-design-system, a hand-minimal native file), each with the
      expected adapter output — the compatibility matrix as tests, not prose.
      **Done 2026-08-13, with one sample honestly weaker than the step asked
      for.** `tests/scripts/fixtures/design-system-import/` carries the three
      input/expected pairs; `tests/scripts/design_system_import.test.ts` asserts
      them plus the rejection, inference-marking and overwrite classes (36
      tests). The DTCG sample is genuine producer output — the `{$value,$type}`
      layering this package itself authors. The extraction sample is **derived
      from the tool's published output surface, not captured from a live run**:
      capturing one means installing the tool plus a browser runtime and
      crawling a live site, which crosses the same 2026-06-28 lock the roadmap
      cites, and puts a third-party package and a network fetch into the test
      path of a pure file transform. The fixture README states exactly what that
      proves (the adapter's mapping rules) and what it does not (that the tool
      emits these shapes); replacing it with a real capture needs no code
      change.
      **Extended after the R2 review, and this is the transferable half:** all
      36 fixture tests passed while nine executed probes found data loss, so the
      matrix proves the mappings it encodes and nothing about the shapes it does
      not reach. Each probe is now a regression test (48 total), and the classes
      they pin — two same-named roles across layers, a `default` leaf, a
      non-radius border fallback, a nested colour subtree, motion residue, a
      clobbered `_meta.unmapped`, a scalar component observation — are all
      "returns `ok: true` while a value is gone", never a crash. A fixture suite
      is not a substitute for adversarial probing; it is the half that regresses.
- [x] **Step 3:** A short *extractor compatibility* section appended to
      `design-system-json.md` naming the three lanes, the two documented
      producers, and the lock boundary — so the next reader learns "which
      crawler" from the contract itself.
      **Done 2026-08-13.** § *Extractor compatibility* carries the lane table,
      the CLI invocation, both documented producers plus the DTCG-any-tool
      escape, the provenance-origin rule, and the never-force-a-lane
      degradation. Naming the tools is `source-confidentiality`-legal — that
      rule forbids derivation-attribution and explicitly permits naming a tool
      the package recommends integrating; `check_no_external_sources` is green
      and none of the three is on the denylist.

**Falsifier.** A lane's real-world sample cannot be mapped without inventing
values → that lane ships as `_meta`-only (observation, not tokens) and the
matrix says so; no lane is forced.

**Rollback.** One script, three fixtures, one doc section.

## Phase 2: The onramp — one optional command, zero settings

- [x] **Step 1:** `/design-system` command cluster *(proposal)*, engineering
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
      **Done 2026-08-13** — `src/domains/engineering-base/design-system/`
      (head + `generate` / `import` / `capture`), modelled on `/brand`: tier 2,
      `visibility: internal`, head `type: orchestrator` and suggestion-eligible,
      subs not independently suggested. Registered in the locked-clusters table
      and mapped into `surface-map.yaml`; `lint_no_new_atomic_commands`,
      `check_cluster_patterns`, `lint_command_tiers`, `lint_command_flow_coverage`
      and `validate_frontmatter` all green on the new cluster, and every derived
      surface regenerated (pack manifests, `CAPABILITIES.yaml`, catalog, index,
      command-flows, surface report, counts, projections).
      **The internal-visibility choice is load-bearing, not a copy of `/brand`.**
      `design-system` is not in `command-verbs.yml`, so a *visible* head would
      need an ADR-041 verb addendum — a governance change this roadmap did not
      ask for. `/brand` already demonstrates that internal + suggestion-eligible
      is a working pairing, and it is exactly the posture Step 2 wants:
      discoverable on an explicit design-system question, silent otherwise.
      **Checked before naming the subs:** the slug `design-system-capture`
      collides with the skill of the same name. That is a pre-existing,
      tolerated pattern — `brand`, `brand-identity`, `brand-strategy`,
      `estimate-ticket`, `refine-ticket`, `review-routing` and
      `upstream-contribute` are all already both — so the roadmap's own name was
      kept rather than renamed around a non-problem.
- [x] **Step 2:** Optionality per C4: no settings key, no always-on rule, no
      auto-trigger. The command is suggestion-eligible where a design-system
      question is explicit, and otherwise silent. The "as easy as possible"
      path is documented in the command body as two lines: *connect an
      extractor once (e.g. `claude mcp add … dembrandt-mcp`), then
      `/design-system import` its output — or skip the extractor entirely and
      `/design-system generate` from the corpus.*
      **Done 2026-08-13.** Zero new settings leaves — verified by grep, not by
      intention: the cluster adds no `.agent-settings.yml` key, no always-on
      rule, and no auto-trigger. The head states "optional means invoked or not
      invoked" in its own body so the constraint travels with the command rather
      than living only here, and `:import` carries the two-line easy path
      (connect an extractor once, then import) with the no-extractor fallbacks
      named beside it.
- [x] **Step 3:** Precedence restated where the command lands: generated
      output is a **proposal**; a provided artifact, registered brand tokens,
      and a confirmed `DESIGN.md` all outrank it (the chain
      `design-fidelity-mechanics` + C1 trust posture already define — cited,
      not redefined).
      **Done 2026-08-13.** Stated in the head's Rules and again in `:generate`
      and `:import`, each time as a citation to `brand-source-of-truth` and the
      contract's trust posture rather than a re-definition of them.

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

- [ ] **Step 1:** *(BLOCKED — see `### blocker: corpus-refresh-budget-and-scope`.
      Its premise was measured at the pin and is false in both directions: the
      step names two missing files; there are **nine** absent and **eleven**
      content-drifted. And its second named file is the one ADR-061 §8 rejected
      by name.)* Re-pin the vendored corpus to upstream `97eb2a20`: bring
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
      **Deferred 2026-08-13 — blocked by Step 1 through a MEASURED dependency,
      not by sequencing preference.** The upstream dial table was read at the
      pin: `variance` biases style selection with the keywords `Minimalism`,
      `Brutalism`, `Bento Grids`, which resolve against the local `styles.csv`
      (2 / 3 / 3 hits) — portable today. `density` is three pure range maps —
      portable today. But `motion` resolves to the tiers `Subtle` / `Standard` /
      `Complex`, and those are the values of the **`Intensity Tier` column of
      `motion.csv`**, which this tree does not carry. Porting the motion dial
      now would ship a knob that silently does nothing — the "defined but not
      wired" class this package has already paid for once. Porting two of three
      dials and leaving the third inert is worse than waiting: the flag surface
      would claim a capability the corpus cannot answer.
- [ ] **Step 3:** One regression fixture per dial tier boundary, mirroring
      upstream's `DIAL_TIERS`, so the next upstream refresh diffs against
      pinned expectations instead of memory.
      **Deferred 2026-08-13** — its subject is Step 2's output.

**Falsifier.** Upstream's dial implementation turns out to depend on data the
MIT grant does not cover → dials are re-implemented from the tier table alone
(trivial: three range maps) and the ATTRIBUTION notes the divergence.

**Falsifier outcome (2026-08-13): it fired sideways.** The MIT grant is intact —
verified at the pin, same licence, same holder — so the licence half never
triggered. What the phase actually hit is a **budget and scope** wall the
falsifier did not anticipate, and "three range maps" is true of `density` only.

**Rollback.** Data files + engine flags; the v2.5 behaviour is the no-flag path.

## Out-of-scope repair carried by this roadmap's branch

Three lines in the branch belong to no step here and are recorded so a reader
can trace them: `analyze-conformance` added to the `analyze` head's `routes_to:`,
to its Sub-commands table, and to `src/flows/surface-map.yaml`.

They clear two gates that were **red on the trunk before this branch** and that
no open roadmap claims — checked against `road-to-local-only-gate-reds` (merged
as #1329), which claims neither. `analyze/conformance` shipped its command file,
frontmatter and body but was listed in neither surface, so `check_cluster_patterns`
and `lint_command_flow_coverage` both failed.

Repaired here rather than deferred because the missing surface-map entry sits in
a file this branch already edits, and both gates guard the exact two surfaces the
new `/design-system` cluster registers into — a green reading of this roadmap's
own registration was only obtainable alongside somebody else's red. Doc-truth,
no behaviour change.

## Blockers

### blocker: corpus-refresh-budget-and-scope

- **Status:** open
- **Owner:** maintainer
- **Blocks:** Phase 3 entirely — 3.1 directly, 3.2 through the measured
  `motion.csv` dependency below, 3.3 as 3.2's subject. Phases 1, 2, 4 and 5 are
  unaffected and closed or closable without it.
- **What was measured** (upstream tree read at `97eb2a20`, licence re-verified
  at that commit: MIT, same holder, unchanged):
  1. **The step's scope claim is false.** It names `motion.csv` and
     `google-fonts.csv` as the delta. Against our `data/`: **nine** files are
     absent — those two plus `typography.csv` and six desktop-UI stacks
     (`avalonia`, `javafx`, `uno`, `uwp`, `winui`, `wpf`) — and **eleven** more
     have drifted in content (`products` +15 KB, `nuxt-ui` +7 KB, `colors`
     +6 KB, and eight smaller). A wholesale re-pin therefore adopts six stacks
     outside `frontend-design`'s scope and eleven unreviewed content changes,
     which is a different act from the two-file bump the step describes.
  2. **`google-fonts.csv` is already a recorded decision.** ADR-061 §8 rejected
     it **by name and by size** — "745 KB, 1923 rows … Skip. Redundant with the
     public Google Fonts API". The 2026-06-16 amendment supersedes that only
     toward **adopt-lite pinned metadata** from a *different* MIT mirror, "or a
     slim top-N slice". The full 743 KB upstream CSV this step names is the
     mechanism that was rejected, not the one the amendment authorised.
  3. **Two `owner: maintainer` budgets stand in the way**, and both are cited by
     `pack-size-budget.json` itself: `packed_size_mb` is 7.238 against a 7.8
     cap (~562 KB of headroom, and the font CSV alone is 743 KB), and the
     `design-intelligence` per-skill exception sits at **22.63 % of a 23 % cap**
     — whose own note calls it "visible debt, not an endorsement: raising
     `max_pct` requires a reason in the same commit". Even the small half
     (`motion.csv`, 10.5 KB) spends roughly all remaining headroom of that
     exception (~22.87 % by arithmetic), which is a call on a maintainer-owned
     budget rather than an in-budget change.
  4. **The budget cannot be re-measured from a built worktree.** `check_pack_size`
     reads 9.096 here against a 7.8 cap *before any change*, which is the trap
     `pack-size-budget.json` documents in its own baseline note — the
     `--ignore-scripts` method assumes `dist/cli|ui|mcp|hooks` are absent and a
     built tree has them. So the real figure needs a clean checkout; the numbers
     above are the committed ones plus arithmetic, and are labelled as such.
- **What to do:** decide the shape, then Phase 3 becomes executable as written
  against that decision. The options are not equivalent and none is an agent's
  to take: (a) adopt `motion.csv` only, spending the per-skill headroom and
  leaving the pin unbumped — smallest, and it is what unblocks the motion dial;
  (b) (a) plus a re-baselined per-skill cap with the reason in the same commit;
  (c) a full re-pin, which needs a scope verdict on the six desktop stacks and
  the eleven content drifts; (d) revisit ADR-061 §8's font decision on the
  merits, which is an ADR act, not a roadmap step.
- **Why it is not agent-resolvable:** every path either raises a budget whose
  file declares `owner: maintainer`, reverses a recorded ADR decision, or adopts
  third-party corpus content into a shipped package on nobody's authority. Per
  `decision-revisit-gate` the lock is surfaced rather than silently obeyed — the
  benefit (a working motion dial, a fresher corpus) is real and is stated here
  so the decision can be made on it.

### blocker: no-command-invocation-telemetry

- **Status:** open
- **Owner:** maintainer
- **Blocks:** step 5.1 only, and through it the Phase-2 falsifier's ability to
  fire. Phases 1, 2 and 4 are closed and do not depend on it.
- **What was measured:** `audit_command_surface.ts:587` states plainly that
  *"Per-command invocation telemetry is **not** available"*, and rejects both
  surrogates in the same note — filesystem mtime (`task sync` rewrites every
  file) and git history (dominated by a directory-rename artefact). So the
  estate does not, in fact, record the command telemetry step 5.1 assumes.
- **Why this matters beyond one step:** Phase 2's falsifier is *"two release
  windows with zero invocations → demote the cluster to `later/`"*. With no
  counter, **zero-invocations and zero-measurement are the same reading**, and
  acting on it would retire a working surface on the strength of a missing
  instrument. The falsifier is therefore inert until this is resolved, and that
  is recorded here rather than left for someone to discover at demotion time.
- **What to do:** either (a) build a per-command invocation counter — the skill
  layer already has one shape of it in `skill-usage:collect`, and it carries its
  own privacy surface, so it is a roadmap of its own, not a step; or (b) decide
  the Phase-2 falsifier on a different signal (an explicit maintainer read at
  the review-window walk) and amend it to say so.
- **Why it is not agent-resolvable:** (a) is a new telemetry capability
  collecting user-behaviour data, which is a product and privacy decision; (b)
  rewrites a pre-registered falsifier, which is exactly the move a falsifier
  exists to prevent an agent from making on its own.

## Phase 4: Wire the consumers — cross-refs, no duplication

- [x] **Step 1:** The port branch: `design-system-capture`'s import step and
      the honest-refusal recommendation ("supply the contract") gain one line
      naming the now-real supply path — `/design-system import` over a
      connected extractor's output closes the refusal branch.
      **Done 2026-08-13.** Both halves: `design-system-capture/SKILL.md` gains
      the supply-path paragraph above its import procedure, and the halt's
      option 2 in `directives/ui/design.ts` now names the adapter for the case
      the option previously had no answer to — an extractor's output that exists
      but is in another shape. The halt's own recommendation and caveat are
      untouched; `directives_ui_design.test.ts` green.
- [-] **Step 2:** *(merged at adoption — program X4)* The producer sentence for
      `road-to-source-first-frontend` Phase 4's URL-handover section — connected
      extractor MCP (dembrandt / designlang), manual Chrome-DevTools-MCP as
      fallback — is now written **once, in that roadmap's Phase 4 Step 2**, which
      owns the section. Two roadmaps writing one sentence into the same file is
      the drift this merge removes; the content is unchanged and not lost.
- [x] **Step 3:** dembrandt's drift gate (exit 0/1/2/67, `--compare`
      baseline) recorded as a **parked** candidate for the design-quality CI
      lane — one line in the compatibility section, taken up only if the
      design-quality roadmap asks for runtime drift detection.
      **Done 2026-08-13** — § Extractor compatibility carries the parked note
      with the exit-code set and the `drift.changes[]` payload, and states why
      it is parked rather than adopted: it is a design-quality CI capability,
      not an import one, and nothing in the package asks for it today.

**Falsifier.** Owned by the sibling roadmaps' own falsifiers.

## Phase 5: Measure

- [ ] **Step 1:** *(BLOCKED — see `### blocker: no-command-invocation-telemetry`.)*
      Count `/design-system` invocations and adapter runs per
      release window (the command telemetry the estate already records for
      clusters); publish alongside the Phase-2 falsifier's threshold.
      **Its premise is false, and the instrument it names does not exist.** `audit_command_surface.ts:587` states it outright:
      *"Per-command invocation telemetry is **not** available."* The two
      surrogates it considered are both rejected in that same note — filesystem
      mtime (`task sync` rewrites every file) and git history (dominated by a
      rename artefact). So there is nothing to count `/design-system`
      invocations with, and the Phase-2 falsifier — "two release windows with
      zero invocations outside the maintainer's own runs" — currently has **no
      instrument that can distinguish zero from unmeasured**.
      Recorded rather than faked: publishing a zero here would read as evidence
      of no demand when it is only evidence of no counter, which is the exact
      inversion the falsifier would then act on (demoting the cluster to
      `later/`). Building per-command invocation telemetry is a separate
      capability with its own privacy surface, and belongs to a roadmap that
      asks for it — not smuggled in as a measurement step.
      **What would close this:** a per-command invocation counter (the skill
      layer already has one shape of this in `skill-usage:collect`), or an
      explicit maintainer decision to judge the Phase-2 falsifier on something
      other than an invocation count.

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
