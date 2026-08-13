---
complexity: structural
status: later
---

# Road to corpus knowledge skills — compile a document corpus into on-demand knowledge, and measure whether the compile earned its existence

> **Blocked until** the maintainer names the first two corpora (Phase 0.2) or
> archives this plan as demand-not-shown. Parked rather than active because every
> remaining open item is gated on that one decision — the two items that were
> workable (Phase 0.1 and Phase 5) already shipped, so leaving the file in the
> active tree would tell the dashboard and `/roadmap:process-*` that work is
> available when none is.
>
> **Origin.** An external analysis artifact dropped into the maintainer inbox
> (see `## Provenance`), re-verified claim-by-claim against `origin/main` before
> this file was written. The source proposed five phases; two shipped in the
> change that created this roadmap, one is **cut** because the capability
> already exists, and the remaining two are blocked on a decision only the
> maintainer can take. Eight claims were corrected — recorded in `## Context`
> rather than silently applied.

## Goal

Give the suite a **reference layer with a production pipeline**: a compiler that
turns an already-ingested document corpus into a layered, on-demand knowledge
skill, gated the way this repo gates everything — the cost instrument is
pre-registered and run **before** the capability is defaulted on, generated
output passes the existing injection linters before it is ever loaded, and a
compile that does not beat its own measured counterfactual is published as an
honest null.

## Non-goals

- **No second grounding engine.** `corpus-grounding` (BM25 over CSV, explicitly
  pre-action) stays untouched; this builds the *reference* layer its own Do-NOT
  section points away to (`src/skills/corpus-grounding/SKILL.md:45-46`).
- **No second ingestion path.** Extraction, redaction, chunking and bounds
  already ship (`src/cli/python/knowledge_ingest.ts`); the compiler consumes
  that output, it does not replace it.
- **No second sanitization layer.** The existing unicode/confusable linters and
  the runtime injection scanner are the single source of truth for that defense
  class.
- **No new Python under `src/`** — 0 tracked `.py` there today, and it stays 0.

## Context (verified against `origin/main`, then do not relitigate)

- **Defect A — the reference layer has no compiler.** Narrower than the source
  claimed. Ingestion is production-quality already: `/knowledge ingest` routes
  binary formats (PDF, DOCX, XLSX, EPUB, PPTX) through the peer-side
  `markitdown` MCP server (`src/cli/python/knowledge_ingest.ts:14-17`), redacts,
  chunks to 2 KB markdown, writes a manifest
  (`agents/memory/knowledge/<id>/{manifest.json,chunks/<n>.md}`, `:27-39`) and
  hard-rejects past its bounds (`:41-45`), under
  `docs/contracts/local-knowledge-ingestion.md`. What does **not** exist is the
  step from those chunks to a layered skill bundle — a resident `SKILL.md` core
  plus on-demand chapter files, a navigation index, and a decision-layer
  cheatsheet. The *layout* is precedented twice, hand-authored both times:
  `src/skills/design-intelligence/` and `src/skills/humanizer/`, each shipping
  `SKILL.md` + `references/` + `data/`. So the gap is the compiler, and only the
  compiler.
- **Defect B — no per-corpus loading-strategy comparator.** The suite measures
  aggregate and per-leg surfaces: `src/scripts/check_token_regression.ts:15-20`
  gates `eager_rule_load` / `thin_rule_load` / description catalogs off
  `internal/bench/reports/projection-cost.json` with exact tokenizer counts, and
  `src/config/dispatch-economy-metrics.json:9` measures the init/work ratio per
  dispatched leg. Nothing produces, for **one corpus**, the three-way comparison
  that decides whether a compile was worth it: whole-corpus resident vs an agent
  navigating the raw documents vs the compiled skill's core plus one chapter. A
  tree-wide search for such an instrument returns nothing. Without it, Phase 3
  output can only be justified by narrative.
- **Defect C — no size-gated read protocol.** *Closed by the change that created
  this roadmap.* `token-efficiency.md` and `context-hygiene.md` governed
  *repetition* only (`src/rules/token-efficiency.md:42`); the read-loop 15/25
  rule counts read-only *turns*, never file size. The one adjacent fragment was
  a single unthresholded line in the mechanics context. See Phase 5.
- **Defect D — stale contract statements.** *Closed by the same change.* The
  host-activation table's Claude Code row and the paragraph beneath it both
  described an emitter that has shipped since PR #1231. See Phase 0.1.
- **The existing defense set is a superset of what the source offered.**
  `src/scripts/lint_confusables.ts` (visible homoglyph class, naming its sibling
  `lint_hidden_unicode.ts` for the invisible class: zero-width, bidi,
  tag-block) plus the runtime `src/scripts/injection_scan_hook.ts`, bound to
  `post_tool_use` on six hosts as `fail_closed: false` / `severity: advisory`
  (`src/scripts/hook_manifest.yaml:86-90`), plus `check_structural_malice`
  inside `src/scripts/skill_linter.ts:3457` (5 patterns, called at `:3711`),
  wired into `task ci`. Generated corpus skills flow through **these**. No
  ported scanner, no second codepoint table.
- **The skill budget machinery constrains Phase 3.**
  `src/scripts/lint_token_budget_discipline.ts` — `token_budget_class` ∈
  lean | standard | rich (`:54`), rich capped at 15 % of the estate (`:52`) and
  3,500 tokens (`:60`), justification section required. ADR-217 gates the
  ceiling and deliberately not the floor.

### Eight corrections to the source analysis

They change the plan, so they are recorded rather than quietly applied.

1. **The central methodological citation does not exist.** The source justified
   its instrument-first phase order as "the ADR-202 lesson: instrument before
   capability, Phase 1 before Phase 3". ADR-202 is about anchor-scoring as a
   thin quality instrument and *closes with an honest null* (κ = 0.472 against
   an 0.800 floor); it contains no build-order lesson, and the phrase appears
   nowhere in the tree. **The discipline is still right — on different
   evidence:** this repo pre-registers instruments as a matter of practice, in
   seven committed budget files carrying `registered_at` / `owner` /
   `review_by` (`src/config/hook-latency-budget.json`,
   `preamble-payload-budget.json`, `hook-token-budget.json`,
   `recycle-threshold-budget.json`, `quorum-attendance-budget.json`,
   `cost-parity-budget.json`, `dispatch-economy-metrics.json`). Phase 1 cites
   those, never ADR-202.
2. **Defect A is a compiler gap, not a pipeline gap** (evidence above). The
   source's framing implied unimplemented plumbing; extraction and redaction are
   done.
3. **The source's extraction phase is cut, not adapted.** It planned a
   subprocess-vs-native decision with PDFs via `pdftotext`. That decision is
   already taken and shipped through the markitdown MCP route.
4. **ADR-200 does not bar shelling out to an external Python tool.** It retired
   *this package's own* Python surface (0 tracked `.py` under `src/`, verified)
   and carves out bench fixtures. The external extractor is moot because of
   correction 3, not because of ADR-200 — citing the ADR for that restriction
   would be a claim it does not make.
5. **The layout precedent is two skills, not one.** `humanizer/` alongside
   `design-intelligence/`.
6. **One claimed count does not reproduce.** Rule sources measure 116 today, not
   125. Skills (289) and projected rules (115) reproduce exactly.
7. **Defect D was two statements plus a third instance.** The source found the
   table cell. The paragraph directly beneath it asserted the same closed gap,
   and a defect-pattern search for the wrong construct — a line-pinned
   `<contract>.md:<line>` citation in a script comment — found 2 real instances
   tree-wide, of which 1 (`check_rule_projection_integrity.ts`, pointing at
   `rule-router.md:234`) already resolved to the wrong statement *before* this
   change. All three are fixed; the second instance was checked and is correct.
8. **A borrowed rationale number was dropped.** The source motivated the read
   protocol with "28 re-reads of a 75k-token book ≈ 2M input tokens" — an
   unverifiable third-party figure. Phase 5 states its threshold as an
   explicitly-unmeasured default with a falsifiable revisit-if instead.

### Harvest discipline — the evidence direction

ADR-211 Amendment C requires `finding → borrow`, never the reverse: a borrow
qualifies only if the cited failure finding predates the borrow proposal. The
defects here were found *during* the source analysis, not before it, so **this
roadmap's own commit is the pre-registration** and no borrow may land ahead of
it. Amendments B/C/D survive the freeze lift recorded in ADR-216, so the
discipline is live even though the freeze is not.

## Gap table

| Proposed item | Verdict | Why |
|---|---|---|
| Layered skill shape: resident core + on-demand chapters + navigation index + glossary + decision cheatsheet | **KEEP** | No compiler produces it; the layout is precedented but hand-authored (Phase 3). |
| Three-way per-corpus cost comparator | **KEEP** | Defect B; nothing measures a single corpus's loading strategies (Phase 1). |
| Cheatsheet as a decision layer (rules and thresholds, never term→definition rows) | **KEEP** | Matches this repo's decision-rule culture; costs nothing extra to require (Phase 3). |
| Size-gated probe-before-read protocol | **KEEP — shipped** | Defect C; landed in Phase 5. |
| Stale contract repair | **KEEP — shipped** | Defect D; landed in Phase 0.1. |
| Pre-flight cost estimate + explicit confirm before generation | **KEEP** | Scoped to the compile command only (Phase 3). |
| Fold-in / merge semantics + owner & refresh cadence | **KEEP** | Reuses the manifest discipline `corpus-grounding` already enforces (Phase 4). |
| Budget matrix (corpus type × depth → per-file token targets) | **FOLD** | Into the existing `token_budget_class`; a second budget axis would be a parallel truth (Phase 3). |
| Front-load-against-truncation ordering | **FOLD** | Into Phase 3 as evidence-gated: no host truncation is measured in this tree, so no lint ships against an undemonstrated failure mode. |
| Extraction strategy (subprocess vs native, PDFs via `pdftotext`) | **CUT** | Already shipped via the markitdown MCP route (correction 3). |
| Route extracted text through unicode/confusable checks | **CUT as new work** | Redaction already runs at ingest; Phase 3.2 gates the *generated* artifact, which is the surface that was actually open. |
| Ported sanitizer / generated-skill scanner | **CUT** | Existing linters are a superset; two truth sources for one defense class is the drift to avoid. |
| Per-host validation lens | **CUT** | The per-host emitters in `condense.ts` encode deeper host knowledge (pattern budgets, placeholder discrimination) than a lint lens. |
| Honesty-labelling convention in tooling output | **CUT** | Already native — proxy-vs-exact labelling in `token_count.ts`, `"HONEST LIMITATION"` in `dispatch-economy-metrics.json:11`. |
| External Python extractor | **CUT** | Moot per correction 3; no Python lands in `src/` regardless. |

## Phase 0 — Truth repair and scope decision

- [x] **0.1 Fix the stale rule-router statements (Defect D).** The
      host-activation table's Claude Code cell named no emitter and pointed at
      an open roadmap phase; the paragraph beneath it asserted "the suite does
      not emit it, so every projected rule there is standing context". Both now
      describe the shipped state (`_emit_claude_rule`, planned by
      `_claude_paths_plan` under `CLAUDE_PATHS_PATTERN_BUDGET`, PR #1231), with
      the residual gap named honestly as per-rule coverage and the per-rule
      authority pointed at the emitted frontmatter rather than a count in a
      contract. The drifted line-pinned citation in
      `check_rule_projection_integrity.ts` was re-anchored to a section
      reference so it cannot rot again.
      <!-- verify: grep -q "_emit_claude_rule" docs/contracts/rule-router.md -->
- [ ] **0.2 Demand gate for the compiler.** Name at least two concrete corpora
      that will actually be compiled, each with a named consumer, or archive
      this roadmap as demand-not-shown — that outcome is a **success** of the
      gate, not a failure of the plan. `project.audience` resolves to `public`,
      so the gate is live rather than inert.
      *Verify:* this file gains a "first corpora" list with an owner per corpus,
      or the file moves to `agents/roadmaps/skipped/` with the null recorded.
      <!-- blocked-by: first-corpora-named -->
- [ ] **0.3 Placement decision.** Compiled skills are consumer artifacts, not
      repo skills. Decide where they land and whether the compiler ships as a
      skill, a command, or both — recorded as a short decision file, never
      defaulted silently.
      *Verify:* a decision file exists naming the target path per host and the
      invocation surface.
      <!-- blocked-by: first-corpora-named -->

## Phase 1 — Instrument before capability

- [ ] **1.1 Pre-register the corpus-loading-cost instrument**, in the shape of
      the seven existing budget files (correction 1): definitions for
      `context_dump_tokens` (whole corpus resident, measured),
      `discovery_loop_tokens` (**modeled** from the corpus's real section sizes —
      index plus target section plus one backtrack, and labelled a model in the
      output itself, never presented as a measurement), and
      `compiled_skill_tokens` (measured: core plus one chapter). Thresholds
      committed before any Phase 3 code lands. Every row carries `source`, per
      the `lint_budget_ownership` contract those files already obey.
      *Verify:* the registration file exists with `registered_at`, owner,
      thresholds and a `review_by` date, and `lint_budget_ownership` passes on it.
      <!-- blocked-by: first-corpora-named -->
- [ ] **1.2 Build the comparator** as a TS script over an ingested corpus plus a
      compiled skill directory, calling `measure()` / `gpt_tokens()` from
      `src/scripts/_lib/token_count.ts` — exact BPE where the encoder resolves,
      labelled proxy where it does not, which is the existing discipline rather
      than a new one. Output: the three numbers, the counting method, and the
      reproduce command.
      *Verify:* a run against one fixture corpus produces a report whose
      discovery-loop figure is labelled `model` in the output.
      <!-- blocked-by: first-corpora-named -->

## Phase 2 — Cut

- [-] **2.1 Extraction strategy — cut, not deferred.** The source planned a
      subprocess-vs-native decision with PDFs routed through `pdftotext`. That
      decision is already taken and shipped: binary formats go through the
      peer-side `markitdown` MCP server at ingest
      (`src/cli/python/knowledge_ingest.ts:14-17`), and redaction plus bounds
      run there too. The phase is kept as a closed item rather than renumbered
      away, so the cut stays visible instead of reading as an omission.

## Phase 3 — The compiler

- [ ] **3.1 Author the compile spec** per the 0.3 decision, consuming the
      existing ingest output rather than re-extracting. Per compiled skill: a
      resident `SKILL.md` core carrying the frameworks, the chapter index and a
      **mandatory navigation index**; on-demand `references/ch*.md`; a glossary;
      and a cheatsheet whose lines are decision rules, thresholds and tells —
      never term→definition rows. Budget mapping: core → `standard`; a chapter
      may claim `rich` only under the existing 15 % cap with its justification
      section. No parallel budget axis.
      *Verify:* one compiled fixture skill passes `skill_linter`,
      `lint_token_budget_discipline` and `validate_frontmatter` unmodified.
      <!-- blocked-by: first-corpora-named -->
- [ ] **3.2 Gate the generated artifact through the existing linters before
      install** — `check_structural_malice` plus the unicode and confusable
      linters. A finding stops the install; nothing silently rewrites, and the
      generated files stay on disk for review.
      *Verify:* a corpus salted with an instruction-override phrase produces a
      blocked install with file and line findings, and the emitted files are
      unmodified afterwards.
      <!-- blocked-by: first-corpora-named -->
- [ ] **3.3 Pre-flight estimate and explicit confirm**, scoped to the compile
      command: corpus token count from the ingest manifest, projected generation
      cost in counts only — never hardcoded prices.
      *Verify:* running the command on a corpus past the confirm threshold
      without confirming generates nothing.
      <!-- blocked-by: first-corpora-named -->
- [ ] **3.4 Front-load ordering, evidence-gated.** Before any ordering lint,
      demonstrate per targeted host that truncation of a loaded `SKILL.md`
      actually occurs. This tree carries no such measurement for any host, so
      the default outcome is a recorded null and no lint.
      *Verify:* a per-host note carrying either the demonstration or the null;
      no lint ships against an undemonstrated failure mode.
      <!-- blocked-by: first-corpora-named -->
- [ ] **3.5 Run the Phase-1 instrument on both first corpora** and publish the
      numbers either way. Below threshold → the compile is reverted and the null
      published with the prominence a win would have got.
      *Verify:* two instrument reports exist, each stating
      proceed / iterate / revert against the pre-registered thresholds.
      <!-- blocked-by: compiler-scope-council-review -->

## Phase 4 — Fold-in and freshness

- [ ] **4.1 Fold-in mode** — a new source merges into an existing compiled skill:
      chapter numbering continues, navigation and glossary indexes merge with
      multi-reference entries, the core is re-emitted under budget. Same linter
      gates as 3.1 and 3.2.
      *Verify:* folding a second document into the fixture skill leaves every
      prior chapter file byte-identical except where a revision was declared,
      and the merged skill still passes every gate.
      <!-- blocked-by: first-corpora-named -->
- [ ] **4.2 Refresh discipline** — every compiled skill carries an owner and a
      refresh cadence, and the compiler refuses a corpus config lacking either.
      *Verify:* the command refuses such a config and the error names both
      missing fields.
      <!-- blocked-by: first-corpora-named -->

## Phase 5 — Size-gated read protocol

- [x] **5.1 Extend `token-efficiency` with a size-gated read protocol** —
      chosen over `context-hygiene` because that file already carries three
      distinct mechanisms and sits near the rule size ceiling, while this one
      already owns the "did the previous call change what I know" discriminator
      that a byte-shaped probe rule extends. Neither is a kernel rule, so the
      slow-rollout gate does not apply. The obligation, the 800-line threshold
      and its revisit-if live in the rule; the three-step procedure and the two
      failure modes it replaces live in the mechanics context, absorbing the
      unthresholded fragment that was there. The repetition discriminator and
      the enumerated-set carve-out are untouched.
      <!-- verify: grep -q "Size-gated reads" src/rules/token-efficiency.md -->
- [x] **5.2 Close the `token-optimizer` coverage gap the audit surfaced.** That
      skill's description promised "large file read" while its decision tree had
      no branch for it — a description claiming coverage the artifact did not
      deliver. The tree gained the branch and the catalog row gained the
      capability and its trigger keyword.
      <!-- verify: ./scripts-run src/scripts/check_token_optimizer_freshness -->

## Success criteria

- The stale contract statements are fixed regardless of every other outcome — **met**.
- The read protocol ships with a stated threshold and a falsifiable revisit-if — **met**.
- Either two compiled corpus skills exist, each with an instrument report beating
  its pre-registered thresholds, **or** the demand gate / instrument produced a
  null and this roadmap is archived with that null published. Both are success
  states; a compiler shipped on narrative is not.
- Zero new sanitization tables, zero second ingestion path, zero Python under
  `src/`.

## Risk Register

<!-- risk-review: v1 | reviewed: 2026-08-12 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Compiler is built and never earns it | product | The compile beats neither the dump nor the navigation model, and the sunk cost argues for keeping it anyway. | Thresholds committed before any compiler code lands; below-threshold outcome reverts the compile and publishes the null. | Phase 1 — Instrument before capability |
| 2 | No corpus with a named consumer | product | The capability is built for a corpus nobody compiles, which is the failure the demand gate exists to catch. | Gate is a hard blocker; archiving as demand-not-shown is an explicit success state. | Phase 0 — Truth repair and scope decision |
| 3 | Generated skills carry injected instructions | implementation | Third-party prose is untrusted content, and a compiled skill is loaded as agent instructions. | Generated artifact is gated through the existing malice and unicode linters before install; findings stop the install and nothing is silently rewritten. | Phase 3 — The compiler |
| 4 | Compiled output blows the budget class | implementation | Chapter files drift past the rich ceiling or claim `rich` without justification, degrading the estate-wide 15 % cap. | Budget mapping fixed to the existing `token_budget_class`; fixture must pass `lint_token_budget_discipline` unmodified. | Phase 3 — The compiler |
| 5 | Second ingestion path grows beside the first | implementation | Re-implementing extraction or redaction next to the shipped ingest path creates two truths for one job. | Compiler consumes ingest output only; the extraction phase is cut rather than adapted. | Phase 2 — Cut |
| 6 | Compiled knowledge rots silently | product | A compiled corpus ages while reading as current, which is worse than no corpus. | Owner and refresh cadence are refused-if-absent at compile time. | Phase 4 — Fold-in and freshness |
| 7 | The 800-line threshold is wrong | implementation | The shipped read threshold is a stated default, not a measured optimum, and a wrong number costs a probe on every read near it. | Stated as unmeasured in the rule itself, with a falsifiable revisit-if naming both directions of evidence. | Phase 5 — Size-gated read protocol |

## Blockers

### blocker: first-corpora-named

- **Status:** open
- **Owner:** maintainer
- **Blocks:** Phase 0 steps 0.2 / 0.3, Phase 1, Phase 3, Phase 4
- **What to do:**
  1. Name two concrete corpora to compile first, with a consumer per corpus —
     the analysis surfaced two candidate shapes: host-platform documentation
     that `llm-provider-knowledge` currently re-verifies per fact, and a domain
     manual set for the construction-side integrations.
  2. Add them to this file as a "first corpora" list with an owner each.
  3. If no corpus with a named consumer exists, `git mv` this file to
     `agents/roadmaps/skipped/` and record the demand-not-shown null in it.
- **Resolved when:** this file carries a "first corpora" list naming two corpora
  with an owner each, or the file no longer sits at the top level of
  `agents/roadmaps/`.

### blocker: compiler-scope-council-review

- **Status:** open
- **Owner:** maintainer
- **Blocks:** Phase 3 step 3.5
- **What to do:**
  1. Run a council pass on the compile spec once 0.2 and 0.3 are settled —
     `agent-config council:status` confirms availability without spending.
  2. Fold the convergence into this file inline, with date and members, per the
     transient-reference discipline (never a session filepath).
- **Resolved when:** this file carries an inlined convergence summary with a
  date and the member list for the compile spec.

## Provenance

- Source: an external analysis artifact dropped into the maintainer inbox,
  consumed as `agents/tmp.old/corpus-knowledge-analysis/` (two files: the
  proposed roadmap and the originating thread transcript). The thread link, via
  `src/scripts/_lib/link_crypto.ts decrypt`:
  ENC1:XPhm+3dMfR51LBLMTG+/GS7P1EVz6U3EX5ar5VY3TrKRfJlLDwjYDJL8zoNvKTKAwMSiilcV32W9w9kEXzNdGXaR2Z0zUDAuhi7YUN1AW5mp4evve+3ifCo0m29IT/AD+sRxJPs+F9wWPpoTNLWfjxqEZ0mBQSFzegvK
- The reference the analysis drew on (Source A) is a permissively-licensed
  external skill-compiler project; its identity and pinned commit, via the same
  `decrypt` command:
  ENC1:jW3Afq2OxfUtYJUrOB3iiFtJX8pl3LkI0e8MT1iPYZnRB5g05qpJcYAnlL0i5Es7jPM1JDuN2YtyJFKmfysKheNzeqHNGh36SzeXEAGpNJeeEYAlUUcov0TMmgCetBNaoU/zpU2Cvoqypu6/snZ0GB9gbmum1y5gMFs0GcFh00NBgRLyxxhlH0Zzy3q8tZhFVi7rZXrPHqhlCR67tk8=
- No code from Source A lands anywhere in this plan — every code-shaped borrow
  is CUT in the gap table, so no provenance ledger entry is owed (the ledger
  grows only when a borrow actually lands).
- The source is an external proposal and not adopted doctrine. Every claim
  carried into this roadmap was re-verified against `origin/main` first; eight
  were corrected and five items were cut, as recorded above.
