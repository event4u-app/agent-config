---
status: active
complexity: structural
---

# Road to Frontend Design Intelligence — absorb `ui-ux-pro-max` into our orchestrated UI suite

> Adoption roadmap. Goal: pull the genuinely differentiated capability of
> `nextlevelbuilder/ui-ux-pro-max-skill` (a queryable design-knowledge corpus +
> a dependency-free BM25 reasoning engine) **into** our existing stack-dispatched
> UI directive system, so a consumer installing our package no longer benefits
> from also installing `ui-ux-pro-max`. We keep our orchestration (audit →
> design → apply → review → polish, a11y gating, stack dispatch); we add their
> grounded design intelligence and feed it into `directives/ui/design.py`.
>
> **Status `draft`** — this is a proposal. Execution is NOT authorized by the act
> of authoring it. Phase 0 (council + ADR + licensing) must clear before any
> code/data lands.

## Council decision — generalize the pattern across ALL domains (resolved)

> **Council convergence (anthropic/claude-sonnet-4-5 + anthropic/claude-opus-4-5
> + openai/gpt-4o, deep 3-round debate, 2026-06-03).** No split → no tie-break.
> The owner's escalated goal — *"real knowledge + real orchestration in every
> domain, as flexible and good as possible"* — was put to the council. The
> converged answer reshapes this roadmap from "adopt a frontend corpus" into
> "build a **reusable grounding layer**; frontend is its first instance."

The council dismantled the naive framing (a CSV per domain) and converged on a
**layered, schema-agnostic grounding architecture** plus a **four-operation
split** that is the load-bearing insight for generalizing cleanly:

**The four operations — route each to the RIGHT mechanism, never one corpus for all:**

| Operation | When | Mechanism | Example |
|---|---|---|---|
| **Grounding** | *before* action — constrains the option space | curated corpus + **decision rules** | "fintech dashboard → layout #23, palette #14, anti-patterns" |
| **Reference** | *during* action — factual lookup | on-demand `references/` / RAG, **not** the grounding corpus | "what's the WACC formula", "WCAG 1.4.3 text" |
| **Validation** | *after* action — constraint check | **rules** / linters | "no hardcoded hex; use `var(--token)`" |
| **Method** | the procedure itself | **framework skill** | DCF construction, threat-model method |

The R3 convergence: a corpus **grounds** (pre-action, decision-space constraint),
it does **not** do mid-action reference (that's RAG) or post-action validation
(that's rules). Conflating them produces "grounding theater" + expensive
backtracking + maintenance bloat. This is why `design-intelligence` feeding the
`design.py` step (pre-action) is correct, and why generalizing means **splitting
each domain's knowledge across the four mechanisms**, not dumping it in a corpus.

**Converged architecture (per fork):**

1. **One shared engine, invoked not inherited.** A generic `corpus-grounding`
   library (e.g. `lib/corpus-grounding/`: BM25 + decision-rule evaluator +
   schema validator). Domains plug in via a manifest; the engine is grep-able,
   never a hidden god-dependency. **Opus condition:** ship it with a **versioned
   interface-stability contract** before any domain adopts (a volatile shared
   interface is worse than copies).
2. **Schema-agnostic plug-in contract — explicitly NOT uniform.** Each domain
   declares its own axes (`security: tactic×technique×platform`; `api:
   protocol×pattern×scale`) via a `manifest` (corpus files, search cols, output
   cols, reasoning-map location). Forcing the frontend schema onto other domains
   is a named failure mode. Three sophistication tiers: **lookup-only →
   conditional-grounding (decision rules) → constraint-emission** (feeds gates).
   The decision-rule layer (richer than ui-reasoning's JSON; allow a Python
   callable where JSON caps out) is *the value*, not row count.
3. **Grounding default = lightweight consultation; directive integration only
   for mature, naturally-sequential domains.** Default contract: skill consults
   corpus → proposes grounded options **with a confidence score + an explicit
   evidence-gap line** → human confirms. Strong consensus **against**
   "directive engines everywhere" (orchestration envy). Frontend keeps its
   directive engine (Tier 2); most domains use Tier 1 consultation.
4. **Qualification by decision-rule utility, NOT row count.** The R2 pivot:
   8 rows with strong conditional rules beats 300 flat rows. A domain qualifies
   when (i) its *selection/constraint* decision is externalize-able as auditable
   rules that **beat the agent's priors**, and (ii) grounding happens
   **before** action. Verdicts:
   - **Strong**: security/threat-modeling (MITRE), accessibility (WCAG/ARIA),
     API design, DB-query tuning.
   - **Conditional (thin pre-action selection corpus + framework skill +
     reference + validation rules)**: finance *method selection* (which
     valuation + parameter ranges + failure modes — NOT the modeling itself),
     architecture-pattern selection.
   - **Reject as a corpus**: anything that is really reference (→ RAG), really
     validation (→ rule), volatile/culturally-specific (people/org "fads"), or
     a thin corpus that doesn't beat priors ("grounding theater"). The test:
     *if it fits in 5 lines of an always-on rule, it's a rule, not a corpus.*
5. **Provenance / freshness.** Per-corpus header: upstream SHA + maintainer +
   refresh cadence + last-validated; CI link-check + staleness header; volatile
   → "reference-only" header or live/MCP lookup, not a snapshot. Realism (Opus):
   CI checks links, not accuracy → tier corpora by rot velocity; every corpus
   needs a **named owner + cadence** (domain-adoption Gate 2) or it rots.
6. **Retrieval: BM25 default + a `filters` param now; pluggable later.** Add
   structured pre-filtering before BM25 immediately (the cheap design that
   doesn't cap quality). Retriever selected by name (`bm25` / `structured` /
   `hybrid`); embeddings only on **measured** recall failure, never network-by-
   default.
7. **Frontend specifics (resolved):** (a) **standalone `design-intelligence`
   skill** (size discipline; `fe-design` stays heuristics and *invokes* it) —
   2-of-3 strong, overrides the "fold in" view; (b) **port `.cjs` token gens to
   Python** — unanimous; (c) **defer the Gemini generative suite** behind domain
   gates / adapt into the AI-media pack — unanimous.

**Every corpus output MUST carry a confidence score + an evidence-gap line**
(prevents false-precision / authority inflation). **Change-my-mind anchor** all
three logged: a reasoning-heavy-domain corpus that *measurably* beats the
existing framework skill over ≥10 real sessions — until then, business-pack
corpora stay deferred and evidence-gated.

## Source analysis (verified 2026-06-03, full-tree deep-dive — not README)

Upstream repo: `nextlevelbuilder/ui-ux-pro-max-skill` @ `main`, ~86k stars,
`skill.json` v2.5.0, npm `uipro-cli`. Mechanism deep-dived across SKILL.md, the
three Python scripts, all CSVs, the 6 sub-skills, the CLI, and both license
files. Key facts that drive this roadmap:

- **Engine is pure Python stdlib.** `core.py` (BM25 ranker, `k1=1.5, b=0.75`),
  `search.py` (argparse CLI), `design_system.py` (1148-line reasoning +
  renderer + `MASTER.md`/page-override persistence). Zero pip deps, zero
  network, zero API keys. `requirements.txt` confirms (pytest is dev-only).
  Python ≥3.10 for two `ui-styling` scripts (`tuple[bool,str]`).
- **The IP is the data, not the code.** Porting the scripts is trivial;
  the value + maintenance cost is the corpus:
  | File | Records | Encodes |
  |---|---|---|
  | `ui-reasoning.csv` | 161 | product-category → pattern/style/color/typography/effects + **JSON `Decision_Rules`** conditionals + anti-patterns + severity. **The differentiator.** |
  | `products.csv` | 161 | product type → style/landing/dashboard/palette recommendations |
  | `colors.csv` | 160 | full shadcn-style semantic token sets, **WCAG-contrast-adjusted inline** |
  | `styles.csv` | 84 | design styles → when/when-not, a11y grade, framework-fit, ready AI prompt, CSS vars |
  | `typography.csv` | 73 | font pairings + Google Fonts URL + `@import` + Tailwind config |
  | `charts.csv` | 25 | data shape → chart type + perf threshold + **a11y grade + colorblind fallback** + library |
  | `ux-guidelines.csv` | 98 | web UX rules (Do/Don't + good/bad code + severity) |
  | `react-performance.csv` | 44 | React/Next perf rules (Do/Don't + code) |
  | `app-interface.csv` | 29 | mobile/native UX (44pt targets, a11y labels) |
  | `icons.csv` | 104 | Phosphor catalog → import + usage |
  | `landing.csv` | 34 | landing blueprints (section order, CTA, conversion) |
  | `stacks/*.csv` (16) | ~820 | uniform schema `Category,Guideline,Description,Do,Don't,Code Good,Code Bad,Severity,Docs URL` per framework |
  | `google-fonts.csv` | 1923 | full Google Fonts index (heavy 745KB; commoditized) |
  | `design.csv` | ~16 | prose design-language specs (Chinese title + English body); `draft.csv` is a dead byte-identical backup the CLI never reads |
- **Two knowledge layers**: (a) an always-loaded checklist taxonomy
  (`quick-reference.md`, 10 priority categories / ~205 rules; "scripts do not
  read this table"); (b) the on-demand searchable CSVs. This split matches our
  own size-discipline (thin SKILL.md, knowledge in `references/` + `data/`).
- **Cross-session memory**: a file convention `design-system/MASTER.md` (global
  source of truth) + `design-system/pages/<page>.md` (per-page overrides that
  override the master). Notable pattern; maps onto our `state.ui_design`.
- **Sub-skills** beyond the core skill:
  - `ui-styling` (Apache-2.0, vendored "claudekit") — shadcn/ui + Tailwind +
    **the only a11y reference**; ships `shadcn_add.py` (shells out to `npx
    shadcn@latest add` — the **only** subprocess/network surface in the whole
    suite) and `tailwind_config_gen.py` (pure templating).
  - `design-system` — 3-layer DTCG tokens (primitive→semantic→component) with
    CSS/Tailwind generators (`.cjs`, Node) + hardcoded-value validators + a full
    Chart.js **slide-generation engine** (8-CSV decision corpus, Duarte
    pattern-breaking).
  - `brand` — `brand-guidelines.md` → design-token pipeline (`.cjs`:
    `sync-brand-to-tokens` algorithmic 50–900 scale gen, `inject-brand-context`
    prompt injection).
  - `design` (v2.1.0, monolithic superset) + `slides` + `banner-design` —
    **Gemini image-model + Chrome-screenshot** generators (logo 55 styles, CIP
    50 deliverables, SVG icons via Gemini 3.1-pro, banners, social photos).
    Heavy external deps (`google-genai`, `pillow`, Node, Chrome, `GEMINI_API_KEY`).
- **Licensing**: root **MIT** (Next Level Builder, 2024); `ui-styling/LICENSE.txt`
  is **Apache-2.0** (vendored claudekit; frontmatter says MIT — file wins). Both
  permissive: commercial use + redistribution + modification allowed. Obligations:
  retain notices (both), mark modified files + ship the license (Apache-2.0).

## Mapping to our package (what's net-new vs overlap)

| Upstream capability | Our current state | Verdict |
|---|---|---|
| Design-intelligence corpus + reasoning engine | **MISSING** — `design.py` relies on `fe-design` heuristics + agent judgment | **ADOPT (core win)** |
| `MASTER.md` + page-override persistence | partial via `state.ui_design` | **ADAPT** into our design state |
| Stack best-practice CSVs (16 frameworks) | per-stack executor skills only (no knowledge corpus); **Vue/Next/Svelte/Flutter/Angular knowledge missing** | **ADOPT** → fills gaps |
| shadcn/ui + Tailwind impl | `react-shadcn-ui`, `tailwind-engineer` (stronger orchestration) | **MERGE** scripts in, keep our skills |
| Accessibility | `accessibility-auditor` (WCAG 2.2 AA) + a11y gate in `review.py`/`polish.py` — **stronger than theirs** | **KEEP ours**, enrich with colors/charts a11y data |
| Charts / data-viz selection | **MISSING** (only `dashboard-design`) | **ADOPT** `charts.csv` knowledge |
| Typography pairings, color token sets, icon catalog | scattered in `fe-design` | **ADOPT** as `references/` + token data |
| 3-layer DTCG design tokens + generators | **MISSING** (no token-authoring skill) | **ADOPT** (port `.cjs`→Python) |
| Brand→token pipeline | **MISSING** | **ADOPT (gated)** — decide scope |
| Slide / presentation engine | **MISSING** (we have `canvas-design` for static art) | **DEFER** — out of frontend scope |
| Gemini generative suite (logo/CIP/icon/banner/social) | overlaps `pack-ai-video` (`image-creator`, `canvas-design`) | **GATE** — near-new-domain, heavy deps |
| 18-tool projection / npm CLI | our generator covers `.claude/.cursor/.clinerules/.windsurf/.augment` | **POSITION** — confirm parity |

## Goal

After this roadmap, our `directives/ui/design.py` "analyze" step produces a
**grounded** locked design brief — style, semantic color tokens (WCAG-checked),
font pairing, layout pattern, and anti-patterns drawn from an adopted, queryable
design-knowledge corpus — instead of pure agent judgment. Stack guidance for
Vue/Next/Svelte/Flutter/Angular exists. A design-tokens skill and chart/data-viz
knowledge close the largest gaps. Net effect: **installing our package alone
matches or beats `ui-ux-pro-max` for frontend**, with our orchestration,
a11y gating, and stack dispatch on top.

## Branching strategy

> Execute on a **dedicated feature branch cut off `main`** (name chosen at
> execution time — not pinned here per `scope-control`). NOT on `refactor/6.0.0`
> (this is independent of the 6.0.0 refactor). One PR per phase against the
> feature branch; the feature branch merges to `main` once the whole adoption is
> green. No commit steps are written into this roadmap (`commit-policy`).

## Source-of-truth note

All authored content lands under `packages/<pack>/.agent-src.uncondensed/`
(`augment-source-of-truth`). Adopted CSVs/scripts are **skill assets**
(`skills/<name>/{data,scripts,references}/`) and pass through condensation
untouched (condensation only rewrites `.md` prose). Run `/condense` before any
review. Keep corpus **project-agnostic** (`augment-edit-discipline`,
`framework-neutrality-in-generic-skills` — the corpus is generic design
knowledge, but the new skill must not *mandate* one stack).

---

## Phase 0: Decision gate — council, ADR, licensing, domain gates

> Nothing in Phases 1+ lands until this clears. Per project convention, the
> contested design forks are resolved in the **AI council** (with a tie-break
> round if split), not by asking the user step-by-step.

- [x] **Step 0.1:** AI council (deep 3-round debate, 2026-06-03) resolved the
      forks — see **§ Council decision** above. Outcomes: standalone
      `design-intelligence` skill; `.cjs` token gens → Python; Gemini suite <!-- ref-ignore -->
      <!-- ^ forward-ref to the planned design-intelligence skill (this [x] step
           records the council decision to build it; the skill lands later in this
           roadmap). check-refs only exempts forward-refs under unchecked [ ] items. -->
      deferred (Phase 7); **plus** the generalization mandate — build a reusable
      `corpus-grounding` layer with the four-operation split, not a frontend-only
      corpus.
- [x] **Step 0.2:** Record the decision as an ADR (`adr-create`): the four-
      operation routing (grounding/reference/validation/method), the shared
      engine + versioned interface contract, the schema-agnostic plug-in
      contract, the qualification-by-decision-rule-utility rubric, licensing
      handling, and what is explicitly out of scope (slides engine, generative
      suite pending gates, business-pack corpora pending evidence). Inline the
      council convergence (members + date) per `no-roadmap-references`; do NOT
      link the session JSON. <!-- done: docs/decisions/ADR-061-corpus-grounding-layer.md (accepted), INDEX regenerated; includes the 2026-06-07 fork resolutions (pack A2, google-fonts skip, --stack domain, brand defer) -->
- [x] **Step 0.3:** Licensing foundation. Create a vendored-attribution NOTICE
      (e.g. `packages/<pack>/.agent-src.uncondensed/skills/design-intelligence/ATTRIBUTION.md`)
      recording: upstream repo + commit SHA + last-checked date, MIT (Next Level
      Builder) for the corpus, Apache-2.0 + "claudekit" attribution for any
      `ui-styling`-derived material. Plan to **mark modified files** (Apache-2.0
      §4b) and **ship the license copy** for Apache-derived assets. <!-- done: src/skills/design-intelligence/ATTRIBUTION.md @ upstream b7e3af80 (2026-06-07); Apache marking + license-copy obligations recorded -->
- [x] **Step 0.4:** Run the `domain-adoption-policy` three gates **only for the
      Gemini generative suite** (Phase 7): demand signal, named maintenance
      owner, CI-tooling decision. Frontend itself is already an open domain, so
      Phases 1–6 run under the regular harvest plate (no domain gate). If a gate
      fails for the generative suite, mark Phase 7 `[-] gated` and open a watch
      note under `agents/settings/contexts/domain-watch/`. <!-- done: Gates 1+2 FAIL (no demand signal, no owner), Gate 3 not drawn → Phase 7 marked [-] gated; watch note agents/settings/contexts/domain-watch/generative-brand-assets.md -->
- [x] **Step 0.5:** Confirm an inline upstream-source line (SHA + last-checked)
      on every adopted asset is part of the per-phase definition of done
      (refresh is mechanical, not archaeological). <!-- done: locked as ADR-061 §6 (provenance/freshness = part of DoD) -->
- [x] **Step 0.6 — frontmatter + pack placement (from the 2026-06-03 repo
      validation):** Every new skill needs the full ADR-013 frontmatter
      (`name`, `description` ≤200 chars, `source`, `domain`, `packs`,
      `workspaces`, `lifecycle`, `trust`, `install`) or `lint-artefact-frontmatter`
      + `validate-frontmatter` fail the PR. **Decide the pack:** there is **no
      `frontend`/`design` pack today** — only `engineering-base` (+ stack packs
      laravel/react). Choose: assign `design-intelligence`/`design-tokens` to
      `engineering-base`, OR create a new `frontend-design` pack via an ADR-013
      amendment to `config/discovery/packs.yml` (a clean lint must follow —
      `generate-pack-manifests-check` rejects unknown pack ids). Keep SKILL.md
      prose generic or cross-stack so `lint-framework-leakage` passes (the
      `data/*.csv` are not scanned; only `.md` prose is); avoid project
      identifiers so `check-portability` passes.
      <!-- done: council 2026-06-07 converged A2 — new `frontend-design` pack
           (requires engineering-base, suggests react/nextjs). Landed:
           src/config/discovery/packs.yml entry + ADR-013 table row + amendment
           + ADR_PACKS frozenset in lint_discovery_vocabulary.py. -->

## Phase 1: Build the reusable `corpus-grounding` engine (foundation)

> Per the council, P1 builds a **generic, reusable** layer — not a frontend-
> local engine. Frontend is its first consumer (Phase 2–3). This is the change
> that makes "other domains" cheap later: a new domain ships a manifest + data,
> not a forked engine.

- [x] **Step 1.0 — DELIVERY-MECHANISM GATE (load-bearing prerequisite, from
      the 2026-06-03 repo validation):** Prove that skill-bundled Python +
      data **reach and run at CONSUMER runtime** before building on the
      assumption. Verified-true so far: `scripts/condense.py::sync_non_md`
      copies all non-`.md` skill assets through to `.agent-src/`; `package.json`
      ships `.agent-src/`; `install.py::_copy_dir_dereferencing_symlinks`
      deploys whole skill dirs to `~/.claude/skills/<name>/…`. **Gap (verified):
      ZERO existing skills carry `skills/<name>/{scripts,data}/`; no test proves
      consumer-runtime execution; the `$PWD` / skill-relative-path invocation
      semantics are unspecified.** This step closes the gap: (a) add an
      integration test (a fixture skill with `scripts/x.py` + `data/y.csv`,
      installed, then invoked at a simulated consumer cwd); (b) document
      `skills/<name>/{scripts,data}/` as a sanctioned pattern in
      `docs/contracts/`; (c) pin the invocation contract — how the agent resolves
      the script path at consumer runtime (skill-relative, not project-relative).
      **Do NOT confuse with repo-root `scripts/` (e.g. `council_cli.py`), which is
      maintainer-only and never ships.** If (a)–(c) cannot be made green, the
      grounding layer is theater at consumer runtime → escalate before Phase 2.
      <!-- done: tests/test_skill_bundled_assets.py (3 tests: fixture skill from foreign cwd, real engine cross-skill from foreign cwd, sync_non_md structural guard) + docs/contracts/skill-bundled-assets.md (delivery chain + skill-relative invocation contract pinned) -->
- [x] **Step 1.1:** Create the shared engine under a grep-able shared lib
      (e.g. `packages/<pack>/.agent-src.uncondensed/skills/_lib/corpus-grounding/`
      or a scripts lib): `bm25_search.py`, `decision_engine.py` (rule evaluator,
      JSON + Python-callable rules), `schema_validator.py`, plus a `README.md`
      stating the **versioned interface-stability contract** (Opus condition).
      Add the `filters` (structured pre-filter) param from day one; retriever
      selected by name (`bm25` default, `structured`/`hybrid` pluggable, never
      network-by-default).
      <!-- done: src/skills/corpus-grounding/scripts/{bm25_search,decision_engine,schema_validator,ground}.py — pure stdlib; filters pre-filter + named retrievers (bm25/structured/hybrid) from day one; versioned interface contract v1 in SKILL.md -->
- [x] **Step 1.2:** Define + document the **schema-agnostic plug-in manifest**:
      a domain declares corpus files, search columns, output columns, reasoning-
      map location, and output tier (lookup-only / conditional-grounding /
      constraint-emission). Every corpus result carries a **confidence score +
      evidence-gap** field by contract.
      <!-- done: manifest contract v1 in corpus-grounding SKILL.md (+ schema_validator.py enforces it incl. provenance keys); confidence + evidence_gap mandatory on every output -->
- [x] **Step 1.3:** Port `core.py` (BM25) + `search.py` (argparse CLI) into the
      engine. **Dedupe** the duplicated BM25 class (`core.py` and
      `slide_search_core.py` are byte-identical) — one engine. Strip slide-only
      paths unless slides are later in scope.
      <!-- done: BM25 ported into bm25_search.py (one engine — upstream dedupe noted in ATTRIBUTION); CLI ported as ground.py (search/ground/validate); slide-only paths stripped -->
- [x] **Step 1.4:** Port `design_system.py` as the **reasoning layer** atop the
      engine (`_apply_reasoning` decision-rules + multi-domain search + best-match
      selection + ascii/markdown renderers). This is the reusable
      conditional-grounding tier, parameterised by the manifest — not frontend-
      hardcoded. Keep the `MASTER.md` + page-override persistence as opt-in
      `--persist` (re-routed into `state.ui_design` in Phase 3).
      <!-- done: decision_engine.py ports _apply_reasoning + multi-domain plan + best-match selection, manifest-parameterized; MASTER.md + page-override persistence as opt-in --persist (state.ui_design rerouting in Phase 3) -->
- [x] **Step 1.5:** Port their pytest suite (or write equivalents) for BM25
      ranking, structured filtering, domain detection, decision-rule evaluation,
      and grounded-output generation. Verify locally with the project test runner
      (targeted, not full `task ci` — `roadmap-ci-steps-policy`). Mark this step
      `<!-- carve-out: new-gate-verification -->`.
      <!-- done: tests/test_corpus_grounding_engine.py — 18 tests; 21 passed incl. delivery gate (fresh local run) -->
- [x] **Step 1.6:** Runtime-safety review (`runtime-safety`, `tool-safety`): the
      engine is read-only/local except `--persist` (writes `.md`). No network, no
      subprocess, no secrets — document this in the execution block. (The
      npx-shelling `shadcn_add.py` is handled separately in Phase 5.)
      <!-- done: runtime-safety review recorded in corpus-grounding SKILL.md § Runtime-safety review — read-only except --persist, no network/subprocess/secrets, path containment -->

## Phase 2: Adopt the design-knowledge corpus

- [x] **Step 2.1:** Bring in the tabular CSVs into the skill's `data/`:
      `ui-reasoning, products, colors, styles, typography, charts, landing,
      icons, ux-guidelines, react-performance, app-interface`. **Skip
      `draft.csv`** (dead backup). Decide `google-fonts.csv` (745KB) —
      recommend: include but flag as the heavy file, or trim to a curated subset.
      <!-- done: 11 tabular CSVs in src/skills/design-intelligence/data/; draft.csv skipped (dead backup); google-fonts.csv SKIPPED per council 2026-06-07 (B2: public-API-redundant; typography.csv carries pairing knowledge + API fallback documented in SKILL.md) -->
- [x] **Step 2.2:** Portability + neutrality pass: confirm the corpus carries no
      project names / tenant identifiers; verify the framework-neutrality linter
      is satisfied (the corpus *describes* stacks, it does not *mandate* one).
      <!-- done: portability scan locked by tests/test_design_intelligence_corpus.py::test_corpus_carries_no_project_identifiers; corpus describes stacks, never mandates (data/*.csv not scanned by lint-framework-leakage anyway) -->
- [x] **Step 2.3:** Optional rich reference: adopt `design.csv` (~16 prose
      design-language specs) as `references/design-languages.md`, translating the
      Chinese titles/descriptions to English (`language-and-tone` — `.md` is
      always English). Mark as on-demand reference, not always-loaded.
      <!-- done: 16 design-language specs (not ~16 prose rows — actual upstream shape) extracted to data/design-languages/*.txt verbatim + English index references/design-languages.md with translated essences -->
- [x] **Step 2.4:** Add the always-loaded checklist taxonomy (their
      `quick-reference.md` 10-category / ~205-rule list) as a compact
      `references/design-rules-checklist.md`, English, de-duplicated against our
      existing `accessibility-auditor` and `fe-design` content (no double source
      of truth — cross-link instead).
      <!-- done: references/design-rules-checklist.md — 10-category priority table + ~205 rules (English verbatim, Chinese framing translated); dedup note cross-links accessibility-auditor + fe-design as method owners -->
- [x] **Step 2.5:** Verify search quality: run representative queries
      ("fintech SaaS dashboard", "luxury e-commerce", "developer tool landing")
      and confirm the generated design systems are sane. Capture as eval fixtures.
      <!-- done: tests/test_design_intelligence_corpus.py — 11 eval fixtures (representative queries incl. fintech dashboard / luxury e-commerce / glassmorphism, grounded design-system sanity, Decision_Rules JSON validity over all 161 rows); 11 passed -->

## Phase 3: Wire into the UI directive orchestration (the core win)

> This is the phase that makes the combination unnecessary: our orchestration
> now *grounds* its design brief in the adopted corpus.

- [x] **Step 3.1:** Ground the "analyze" step — **in the skill layer, NOT in
      `design.py`** (refined by the 2026-06-03 validation). `design.py` is a pure
      orchestration gate (validate contract → emit halts → require
      `design_confirmed`); it already delegates an empty brief via
      `_delegate_to_design_skill()` → the `ui-design-brief` skill. Put the corpus
      call THERE: the skill consults the grounding engine and pre-fills the brief
      candidates (recommended pattern, style, WCAG-checked semantic color tokens,
      typography pairing, key effects, anti-patterns), then the agent + user
      confirm (`design_confirmed`). **`design.py` must NOT `import` the corpus
      engine** — this keeps the engine an *optional* dependency (council Fork 1)
      and the directive contract unchanged. The existing placeholder/microcopy
      lock is unaffected: corpus output is a *constraint set*, never final
      microcopy.
      <!-- done: corpus call lives in the skill layer — src/skills/design-intelligence/SKILL.md § "Producing a grounded design brief" (engine consult → pre-filled candidates with confidence + evidence-gap → design_confirmed); design.py untouched and import-free (locked by tests/test_grounded_brief_e2e.py::test_design_py_never_imports_the_engine) -->
- [x] **Step 3.2:** Map the `MASTER.md` + page-override concept onto
      `state.ui_design`: a project-level design system + per-page overrides, so
      multi-page work stays consistent across sessions. Keep the file-persistence
      as an optional artifact under the consumer's `design-system/`.
      <!-- done: MASTER.md/page-override ↔ state.ui_design mapping table in design-intelligence SKILL.md; file persistence stays opt-in via ground.py --persist (writes design-system/<project>/ in the consumer); re-hydration noted -->
- [x] **Step 3.3:** Update `fe-design` to **cite** `design-intelligence` (it
      becomes the grounded source; `fe-design` stays the stack-agnostic heuristic
      layer). Update `existing-ui-audit` interplay note (audit = what exists,
      design-intelligence = what to build).
      <!-- done: fe-design positioning table + § "How the directive set cites this skill" now route selection through design-intelligence; existing-ui-audit carries the interplay blockquote (audit = what exists, outranks corpus suggestions) -->
- [x] **Step 3.4:** Feed `charts.csv` + `colors.csv` a11y data into the
      `review.py`/`polish.py` a11y gate so chart-type and contrast findings are
      grounded, not ad-hoc.
      <!-- done: review.py first-pass halt + polish.py round halt now instruct grounding chart-type/contrast findings in the corpus (design-intelligence § "Grounding the review/polish a11y gate"); golden directive tests still green (42 passed) -->
- [x] **Step 3.5:** End-to-end check: run the UI directive set
      (audit → design → apply → review → polish) on a sample greenfield page for
      one stack (e.g. `react-shadcn`) and confirm the grounded brief flows
      through. Targeted verification; carve-out marker.
      <!-- done: tests/test_grounded_brief_e2e.py — real-corpus grounded brief passes design.py contract (sign-off halt → SUCCESS), placeholder lock still fires, review/polish halts cite the grounded source; 5 passed --> <!-- carve-out: new-gate-verification -->

## Phase 4: Stack best-practice corpus → stack-aware guidance

- [x] **Step 4.1:** Adopt the 16 `stacks/*.csv` into `data/stacks/` (uniform
      schema). Note the two quirks: `threejs.csv` lacks the `No` column;
      `laravel.csv` is Blade/UI-scoped (not general Laravel).
      <!-- done: 16 stacks/*.csv adopted into src/skills/design-intelligence/data/stacks/; quirks confirmed harmless (DictReader + named cols — the optional No column and the Blade/UI-scoped laravel.csv are noted in the cross-links) -->
- [x] **Step 4.2:** Decide surfacing (council-informed): a `--stack <name>`
      search domain (matches upstream) vs. per-stack `references/` docs cited by
      our stack skills. Recommend the search domain (one mechanism, less prose).
      <!-- done: council-recommended option confirmed — --stack search domain on the one engine (manifest stacks + stack_cols; council 2026-06-07 fork C converged C1); no per-stack prose docs generated -->
- [x] **Step 4.3:** Map to our stacks: `react`, `nextjs`, `vue`, `svelte`,
      `react-native`, `flutter`, `angular`, `astro`, `nuxtjs`, `nuxt-ui`,
      `html-tailwind`, `shadcn`, `jetpack-compose`, `swiftui`. This **closes the
      Vue gap** (we have a `ui-apply-vue` placeholder but no knowledge) and adds
      Next/Svelte/Flutter/Angular best-practice coverage.
      <!-- done: all 16 stacks reachable via --stack (react nextjs vue svelte astro swiftui react-native flutter nuxtjs nuxt-ui html-tailwind shadcn jetpack-compose threejs angular laravel); Vue gap closed (smoke: --stack vue "list rendering key reactivity" → "Use key with v-for") -->
- [x] **Step 4.4:** Cross-link from `blade-ui`/`livewire`/`flux`/`react-shadcn-ui`
      to the stack corpus so the executors can pull idiomatic Do/Don't + docs URLs.
      <!-- done: blade-ui + livewire (laravel/UI-scoped), flux (html-tailwind), react-shadcn-ui (shadcn/react/nextjs) carry Grounded-stack-guidance blockquotes pointing at the corpus -->

## Phase 5: Design-tokens skill + shadcn/Tailwind automation

- [x] **Step 5.1:** New `skills/design-tokens/`: the 3-layer DTCG model
      (primitive → semantic → component), light/dark theming, CSS-variable +
      Tailwind output. Port `generate-tokens` / `validate-tokens` / `embed-tokens`
      from `.cjs` to **Python** (per Step 0.1 decision) so there is no Node
      runtime dependency.
      <!-- done: src/skills/design-tokens/ — SKILL.md (3-layer DTCG model, light/dark, workflow) + scripts/tokens.py (generate css|tailwind / validate / embed — Python port of the .cjs trio, no Node dep) + templates/design-tokens-starter.json; locked by tests/test_design_tokens_toolchain.py (7 pass) -->
- [x] **Step 5.2:** Fold `tailwind_config_gen.py` into `tailwind-engineer`
      (pure templating — low risk) and `shadcn_add.py` into `react-shadcn-ui`.
      <!-- done: tailwind_config_gen.py → src/skills/tailwind-engineer/scripts/ (cited in § Resolve to design tokens first); shadcn_add.py → src/skills/react-shadcn-ui/scripts/; both carry Apache-2.0 §4b modification headers; license copy shipped at design-intelligence/LICENSE.apache-2.0.txt -->
- [x] **Step 5.3:** **Runtime-safety review for `shadcn_add.py`** — it shells out
      to `npx shadcn@latest add` (the only subprocess+network surface). Gate it
      behind explicit `assisted` execution (proposal, never silent), declare
      `allowed_tools`, add a verification step. Follow `missing-tool-handling`
      (npx/Node may be absent → ask, don't silently work around).
      <!-- done: react-shadcn-ui frontmatter gained execution {type: assisted, handler: shell, safety_mode: strict, allowed_tools: [npx]}; SKILL.md § Component installer mandates propose-first (--dry-run), missing-tool-handling on absent npx/Node, and post-run verification -->
- [x] **Step 5.4:** Adopt `html-token-validator.py` as a token-discipline linter
      and wire its findings into `review.py`/`polish.py` (no hardcoded hex; use
      `var(--token)`). Reconcile with our existing `tailwind-engineer`
      token-discipline rules (single source of truth).
      <!-- done: html-token-validator folded into tokens.py validate (one linter — .html/.blade.php in scan set); --json emits kind=token_violation matching the polish step auto-convert contract; tailwind-engineer § 1 names it the single token-discipline linter -->
- [x] **Step 5.5:** Decide brand→token pipeline scope (council): adopt
      `sync-brand-to-tokens` / `inject-brand-context` (port to Python) or defer.
      If adopted, it feeds `design-tokens` from a `brand-guidelines.md`.
      <!-- done: council 2026-06-07 fork D converged D2 — DEFER; watch note agents/settings/contexts/domain-watch/brand-token-pipeline.md pins upstream SHA b7e3af80 + reopen trigger (first consumer demand) -->

## Phase 6: Enrich existing skills + close adjacent gaps

- [x] **Step 6.1:** Charts/data-viz: new `skills/chart-selection/` (or enrich
      `dashboard-design`) from `charts.csv` — data shape → chart type + perf
      threshold + colorblind fallback + library. Closes a named gap.
      <!-- done: enriched dashboard-design (no new micro-skill — the knowledge already lives in the adopted charts.csv corpus domain; a separate chart-selection skill would duplicate the corpus surface): Procedure step 3 grounds chart-type choice via --domain chart (best type, when-NOT, volume threshold, a11y grade, colorblind fallback, library) -->
- [x] **Step 6.2:** Typography: route `typography.csv` pairings into
      `design-intelligence` + `design-tokens`; cross-link from `fe-design`.
      <!-- done: typography.csv is a manifest search domain consumed by design-intelligence grounding (typography in the reasoning plan); fe-design § aesthetic-direction now routes pairing choice through --domain typography -->
- [x] **Step 6.3:** Color/a11y: feed the WCAG-adjusted `colors.csv` palettes and
      `app-interface.csv` (44pt targets, a11y labels, mobile) into
      `accessibility-auditor` as grounded reference (keep our WCAG 2.2 AA depth).
      <!-- done: accessibility-auditor § Perceivable cites the grounded references (WCAG-adjusted color sets --domain color, chart a11y grades --domain chart, 44pt mobile rules --domain web) while keeping its own WCAG 2.2 AA method authority -->
- [x] **Step 6.4:** Icons: adopt `icons.csv` (Phosphor) as icon-system guidance;
      decide whether it warrants its own micro-skill or a `references/` doc.
      <!-- done: decision — references doc / micro-skill NOT warranted; icons.csv is a first-class manifest search domain (--domain icons, 104 Phosphor rows with import code) cited from fe-design; one mechanism, no prose duplication -->
- [x] **Step 6.5:** Re-run the gap audit from the explore pass; record which gaps
      are now closed (charts, typography, design tokens, Vue/stack knowledge,
      colorblind data-viz) and which remain explicitly out of scope (web motion,
      i18n/RTL, visual-regression CI, Storybook) for a future roadmap.
      <!-- done: gap audit re-run — CLOSED: design-knowledge grounding, charts/data-viz selection, typography pairings, design tokens (DTCG skill), Vue/Next/Svelte/Flutter/Angular(+11 more) stack knowledge, colorblind data-viz fallbacks, icon catalog. REMAINING out of scope (future roadmap): web motion/animation engineering, i18n/RTL, visual-regression CI, Storybook integration, slide/presentation engine (upstream out-of-frontend-scope), generative brand assets (gated, watch note) -->

## Phase 7: (Gated) Generative brand-asset suite — Gemini logo/CIP/icon/banner/social

> **[-] GATED 2026-06-07** — Step 0.4 gates failed (no demand signal, no owner); watch note: `agents/settings/contexts/domain-watch/generative-brand-assets.md`. Runs **only if** the gates later pass. This is the "ideally everything"
> tail and the heaviest part: external `google-genai` + `pillow`, Node, Chrome
> screenshot, `GEMINI_API_KEY`. It overlaps `pack-ai-video`.

- [-] **Step 7.1:** Council + ADR: adopt-as-is vs. adapt into `pack-ai-video`
      (reuse `image-creator`, `canvas-design`, provider adapters). Recommend
      adapt — do not fork a second image-gen stack.
- [-] **Step 7.2:** Provider lifecycle (`provider-lifecycle-discipline`) +
      media governance (`media-governance-routing`, `media/` policies:
      likeness, disclosure, brand-impersonation) for any logo/brand/face output.
- [-] **Step 7.3:** Port logo (55 styles) / CIP (50 deliverables) / SVG-icon-gen
      / banner / social-photos under the adapted home, with the disclosure +
      provider-tier surfacing our `/video:*`/`/image:*` flows already enforce.
- [-] **Step 7.4:** If any gate fails, mark this phase `[-] gated` with the
      reason and the watch-note path; do not silently shrink scope.
      <!-- executed 2026-06-07: gates failed (demand signal + owner) → phase marked [-] gated; watch note agents/settings/contexts/domain-watch/generative-brand-assets.md -->

## Phase 8: Positioning + "make the combination unnecessary"

- [x] **Step 8.1:** Confirm multi-tool projection parity: ensure the adopted
      skill + corpus render correctly into every tool our generator targets
      (`.claude/.cursor/.clinerules/.windsurf/.augment`). Their CLI hits 18 tools;
      confirm our surface covers our supported set.
      <!-- done: new artefacts ride the standard pipeline with zero special-casing — sync green (check_condensation 0 errors, hashes in sync), non-md assets shipped via sync_non_md (locked by tests/test_skill_bundled_assets.py), discovery manifest lists corpus-grounding/design-intelligence/design-tokens. Local tool projections are intentionally disabled in this repo (agents/.agent-tools.yml tools: []); consumer projection runs the same generator as the existing 224 skills -->
- [x] **Step 8.2:** Write a `competitive-positioning` doc (ours-vs-theirs verdict
      table) proving frontend parity-or-better, so a consumer no longer needs
      `ui-ux-pro-max` alongside ours. Cite the adopted corpus + our orchestration
      + a11y gating + stack dispatch as the combined advantage.
      <!-- done: docs/case-studies/frontend-design-vs-ui-ux-pro-max.md — frame, 7 axes, verdict table (parity-plus on grounding; ours on orchestration/a11y/governance; theirs only on the gated generative suite), invariants, empty adoption queue, explicit unknowns -->
- [x] **Step 8.3:** `upstream-contribute` consideration: we built on their MIT
      work; decide whether any improvements (BM25 dedupe, Python token gens, a11y
      enrichment) are worth proposing back upstream.
      <!-- done: recorded in the positioning doc § Upstream-contribute consideration — candidates: BM25 dedupe, Python token toolchain, manifest/filters layer; decision: defer the upstream PR until the engine soaks one internal release; revisit at first quarterly corpus refresh -->
- [x] **Step 8.4:** Update package docs/catalog + `docs/catalog.md` and the
      relevant pack manifest so the new skills are discoverable; update counts +
      cross-references in the same edit (`augment-edit-discipline`).
      <!-- done: docs/catalog.md + agents/index.md regenerated (227 skills); pack manifests regenerated; discovery-manifest.json + packs.json carry the frontend-design pack; workspaces.yml engineering.optional_packs gained frontend-design (bidir lint green) -->

## Phase 9: Cross-domain generalization — "real knowledge + orchestration everywhere"

> The owner's actual goal. Frontend (Phases 1–8) proves the reusable layer;
> this phase rolls it out **per qualified domain**, gated, one at a time. Each
> domain is a manifest + corpus + the four-operation split + a named owner +
> evidence — never a wholesale dump. Order: prove on strong candidates before
> touching conditional ones.

- [x] **Step 9.1:** Author a `corpus-grounding` authoring guide + a domain
      **qualification checklist** (decision-rule-utility test, before-action
      test, "fits in 5 lines → it's a rule" test, owner + cadence requirement).
      This is the gate every new domain corpus passes.
      <!-- done: docs/guidelines/agent-infra/corpus-grounding-authoring.md — qualification checklist (decision-rule-utility, before-action, fits-in-5-lines, owner+cadence, provenance pin, evidence gate), corpus shape, governance table, reject list, shipped-domain registry -->
- [x] **Step 9.2:** **Strong candidate — Security / threat-modeling.** Ship a
      grounding corpus (MITRE-ATT&CK-derived: surface/data-class → threat →
      control, with decision rules + SHA pin + owner). Ground it into
      `threat-modeling` / `authz-review` via Tier-1 consultation. First proof the
      layer generalizes beyond frontend.
      <!-- done: src/skills/threat-modeling/data/{surfaces,threats,reasoning}.csv + manifest (conditional-grounding — first proof the layer generalizes: category=surface-class → ATT&CK/CWE-cited threats + controls + negative tests + decision rules); Tier-1 consultation wired into threat-modeling + authz-review SKILL.md; smoke: file-upload query → SSRF, conf high -->
- [x] **Step 9.3:** **Strong candidate — API design.** protocol×pattern×scale →
      endpoint conventions / pagination / versioning / error-shape decision rules,
      grounding `api-design`/`api-endpoint`.
      <!-- done: src/skills/api-design/data/api-patterns.csv + manifest (12 concerns: pagination/versioning/RFC-9457 errors/idempotency/async/rate-limit/bulk/naming/expansion/webhooks, each with hardening + anti-patterns + RFC link); consultation wired into api-design + api-endpoint -->
- [x] **Step 9.4:** **Strong candidate — DB-query tuning.** query-symptom →
      index/strategy decision rules (Do/Don't + code, like `ux-guidelines`),
      grounding `database`/`sql-writing`. Vendor-doc SHA pins.
      <!-- done: src/skills/database/data/query-tuning.csv + manifest (12 symptom→strategy rows with Code Good/Anti-Pattern/Verification probes, PostgreSQL16/MySQL8-derived); consultation wired into database + sql-writing -->
- [x] **Step 9.5:** **Strong candidate — Accessibility patterns.** WCAG/ARIA
      pattern corpus (W3C-sourced) grounding `accessibility-auditor` (keep the
      audit method as the framework skill; corpus grounds *pattern selection*).
      <!-- done: src/skills/accessibility-auditor/data/aria-patterns.csv + manifest (12 W3C-APG widget patterns with implementation + WCAG refs + anti-patterns); grounding paragraph in § Perceivable extended — corpus grounds pattern *selection*, audit method stays the skill -->
- [~] **Step 9.6:** **Conditional, evidence-gated — architecture-pattern
      selection + finance method-selection.** Thin pre-action selection corpora
      ONLY (which pattern / which valuation method + parameter ranges + failure
      modes), with the method/execution staying a framework skill, reference via
      RAG, validation via rules. Land ONLY if Step 9.1's evidence test passes
      (beats the existing framework skill over ≥10 real sessions — the council's
      change-my-mind anchor). Otherwise mark `[~]` deferred with a watch note.
      <!-- deferred (evidence-gated by design): change-my-mind anchor not met — no ≥10-session evidence exists yet; watch note agents/settings/contexts/domain-watch/conditional-grounding-candidates.md records both candidates + the reopen procedure· archival disposition: council (anthropic/claude-sonnet-4-5 + openai/gpt-4o, 2026-06-07) converged "keep in archive" — the watch note is the durable, event-driven reopen record; a follow-up roadmap before the evidence trigger would be process theatre -->
- [x] **Step 9.7:** Reject-list discipline: explicitly DO NOT build corpora for
      people/org, GTM, founder-strategy verdicts, or anything that is really
      reference (→ RAG) or validation (→ rule). Record the rejections so they are
      not relitigated.
      <!-- done: reject list recorded in corpus-grounding-authoring.md § 4 (people/org, GTM, founder-strategy verdicts, reference→RAG, validation→rules, ≤5-line corpora) with the right mechanism per rejection — not to be relitigated -->
- [x] **Step 9.8:** Per-domain governance: each shipped corpus has a named owner,
      refresh cadence, staleness header, and CI link-check. Enforce the
      `domain-adoption-policy` Gate 2 (owner) before merge.
      <!-- done: governance enforced structurally — schema_validator refuses manifests without owner/refresh_cadence/upstream (locked by tests/test_domain_corpora.py::test_every_corpus_declares_governance); staleness via last_checked bumps; eval locks per corpus (15 tests pass) -->

## Acceptance criteria

- `directives/ui/design.py` produces a grounded design brief sourced from the
  adopted corpus; the full UI directive set runs green on a sample page.
- `design-intelligence` (+ `design-tokens`, chart/data-viz) skills exist, pass
  `skill_linter.py` and `validate_frontmatter.py`, stay within size budgets, and
  carry upstream-source lines + the ATTRIBUTION/NOTICE + Apache-2.0 markings.
- Stack knowledge covers Vue/Next/Svelte/Flutter/Angular (Vue gap closed).
- Ported engine has tests; no network/subprocess except the explicitly-gated
  `shadcn_add.py` (assisted execution, declared tools).
- Corpus is project-agnostic; framework-neutrality + portability linters pass.
- A competitive-positioning doc demonstrates frontend parity-or-better vs.
  `ui-ux-pro-max`.
- All quality gates pass on the PR (remote CI is the authoritative gate).

## Final integration validation (our repo, `universal-project-analysis`, 2026-06-03)

Validated the roadmap + council decision against the current `event4u/agent-config`
state across three integration surfaces. **No hard blockers; three concrete
prerequisites folded into the phases above.**

| Surface | Verdict | Evidence | Action folded in |
|---|---|---|---|
| **Skill scripts+data reach consumer runtime** | 🟡 GREEN-with-work | `condense.py::sync_non_md` copies non-`.md` assets; `package.json` ships `.agent-src/`; `install.py::_copy_dir_dereferencing_symlinks` deploys whole skill dirs. **But: zero skills use `skills/<name>/{scripts,data}/` today, no test, no doc, `$PWD` invocation unspecified.** Repo-root `scripts/` (council_cli.py) is maintainer-only and does NOT ship — skill-level is different. | **Step 1.0** delivery gate (test + doc + invocation contract) |
| **`design.py` grounding seam** | 🟢 GREEN | `design.py` is a pure orchestration gate (336 lines, no subprocess/import/network); delegates empty briefs via `_delegate_to_design_skill()` → `ui-design-brief`. `work_engine` ships to consumers (core pack). Audit→design ordering is a hard gate; corpus output is a constraint set, not microcopy → no conflict with the placeholder lock. | **Step 3.1** corrected: corpus call in the skill, never `import`ed into `design.py` |
| **CI gates + pack** | 🟡 NEEDS-WORK (no blocker) | `skill_linter`/size apply to SKILL.md prose only → 745KB `google-fonts.csv` in `data/` passes. `lint-framework-leakage` scans `.md` not `.csv`; generic/cross-stack prose passes (allowlist exists). `check-portability` scans `.md`, content is generic → passes. **Missing: ADR-013 frontmatter keys; no `frontend`/`design` pack exists.** | **Step 0.6** frontmatter + pack decision |

**Net verdict:** the architecture is sound against our repo. The single
load-bearing risk is the **skill-bundled-script delivery path being unproven at
consumer runtime** (Step 1.0) — everything downstream assumes the agent can run
the bundled engine where the user actually works. Prove that first.

## Risk & licensing register

- **License obligations.** MIT (corpus) → retain notice. Apache-2.0
  (`ui-styling`-derived) → retain notice, **mark modified files**, ship the
  license. Internal MIT-vs-Apache frontmatter mismatch on `ui-styling`: treat the
  dedicated `LICENSE.txt` (Apache-2.0) as authoritative; attribute "claudekit".
- **Corpus maintenance cost.** The CSVs are the real cost. Name a maintenance
  owner + refresh cadence (Gate 2). Pin upstream SHA per asset; CI `check-refs`
  catches 404s on refresh.
- **`shadcn_add.py` subprocess/network.** Only runtime-unsafe surface; gate as
  assisted, never silent (Phase 5.3).
- **Scope creep into a second image-gen stack.** Phase 7 must adapt into
  `pack-ai-video`, not fork — enforced by council + ADR.
- **Over-broad always-loaded prose.** Keep the corpus on-demand (search) + thin
  SKILL.md; the always-loaded checklist must dedupe against existing rules/skills.
- **Chinese-language source content** (`design.csv`, parts of templates) →
  translate to English on adoption (`language-and-tone`).
