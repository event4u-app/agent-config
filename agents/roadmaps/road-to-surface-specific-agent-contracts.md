---
complexity: structural
status: ready
execution:
  mode: phase-checkpoints
parent_roadmap: road-to-frontier-quality-operating-system
---

# Road to surface-specific agent contracts — stop making one generic agent do every medium badly

> Source-anonymous harvest per `source-confidentiality`. This roadmap focuses
> on Source C: the surrounding prompt family for code, cowork/dispatch,
> browser, mobile, research, visualize, and office surfaces. The transferable
> pattern is surface-local invariants plus local verification, not broad
> persona text.

## Goal

Create governed contracts for major work surfaces so each skill/command knows
the medium's non-negotiables. A spreadsheet agent must prefer formulas and
source comments. A deck agent must care about slide structure, notes, export,
and visual rhythm. A browser agent must respect navigation/source boundaries.
A mobile/chat agent must ask fewer, more tappable questions. A code agent must
read before proposing, track tasks, parallelize safe exploration, and verify
freshly. These should become package surfaces with evals, not folklore.

## Reverse-engineering findings

The external prompt family repeats a template:

- identify the surface and role;
- state what the agent can and cannot do;
- route to peer/specialized tools when another surface is better;
- encode medium-specific invariants;
- define file/data handling;
- verify using the medium's own truth source;
- keep user communication short and non-technical.

The most valuable office example is spreadsheet discipline: formulas over
manual computed values, read-back of formula errors, official sources for
financial data, source comments on sourced cells, pivot-first charting, and
bulk operations over manual loops. The most valuable code example is
"read before proposing", task tracking, minimal scope, tool parallelism, and
fresh verification. The most valuable mobile/browser examples are interaction
constraints and refusal to invent state the tool cannot inspect.

## Council-driven hardening

The review pass flagged hidden coupling with artifact routing, missing surface
detection, and hard wording that depends on plugin availability. This roadmap
therefore starts with a capability/degrade matrix and eval baseline, defines
surface detection before invariants, and makes handoff evidence explicit.

## Current package fit

Already strong: document/presentation/spreadsheet plugins exist in the Codex
environment, `tool_search`/plugin discovery exists, `ai-council` has transport
contracts, coding rules cover verification/scope/source-of-truth, and UI
skills cover frontend work.

Gaps:

- The package does not yet have a canonical surface contract taxonomy that
  says which invariants belong to `code`, `spreadsheet`, `deck`, `document`,
  `browser`, `mobile`, `research`, `visual`, and `cowork/dispatch`.
- Office/document skills can be invoked, but their medium-specific truth
  floors are not consistently represented in package source, trigger evals,
  and golden tasks.
- Peer delegation is under-specified: when a spreadsheet task should hand off
  to a deck/document/browser surface, when to stay local, and what evidence
  must travel between surfaces.
- Mobile/chat constraints are mostly UX guidance, not a testable output
  contract: one useful question, tappable options when available, no table
  walls, concise summaries after tool work.

## Phase 0 — Capability matrix, surface detection, and eval baseline

- [ ] Add or reference a capability/degrade table for supported hosts:
      spreadsheet, document, presentation, browser, PDF, image, repository,
      app connector, local file parser, and "not available" fallback.
- [ ] Define surface detection before surface rules: explicit file type,
      requested output format, named tool/plugin, user environment, data shape,
      task verb, and target deliverable. Add ambiguity handling when multiple
      surfaces apply.
- [ ] Create surface-contract eval fixtures before changing behavior:
      spreadsheet formula truth, deck export, document format request, browser
      URL failure, connector-first routing, mobile one-question UX, code
      read-before-proposing, and cross-surface handoff.
- [ ] Define rollout and rollback: each surface contract starts advisory,
      becomes routed after evals pass, and becomes default-on only when host
      capability/degrade behavior is documented.

**Exit:** maintainer accepts the capability matrix, detection criteria, eval
baseline, and staged rollout order.

## Phase 1 — Surface taxonomy and invariant ledger

- [ ] Add `docs/contracts/surface-agent-contracts.md` defining surfaces:
      code, design, spreadsheet, document, deck, browser, mobile/chat,
      research, visualizer/diagram, cowork/dispatch, and MCP/app connector.
- [ ] For each surface record: owner skills/commands, allowed tools, forbidden
      shortcuts, verification truth source, handoff inputs/outputs, trigger
      examples, capability requirements, and degradation language.
- [ ] Add `src/config/surface-matrix.yml` entries or extend the existing
      matrix so every user-scope tool class maps to a surface contract.
- [ ] Add a "surface conflict" rule: when a user asks for output native to a
      different connected surface, delegate or ask to enable that surface
      rather than forcing a local workaround.
- [ ] Cross-reference the artifact-routing and design-artifact roadmaps so
      carrier choice, host capability, and surface invariants do not diverge.

**Exit:** every major medium has an explicit invariant owner and no invariant
is trapped only in host instructions.

## Phase 2 — Spreadsheet truth floor

- [ ] Create or extend a spreadsheet skill with these floors: formulas over
      hardcoded computed outputs, read-back after writes, source comments on
      web-sourced cells, official-source-only financial data unless the user
      explicitly accepts unofficial sources, pivot-first charting for raw data,
      and bulk range operations over manual cell loops.
- [ ] Add a `spreadsheet-source-quality` rule or contract for financial data:
      company IR, SEC/regulatory filings, official reports/transcripts/decks,
      and exchange/regulator filings first; aggregators/news/social sources
      require explicit permission and cell-level unofficial marking.
- [ ] Add capability-aware degradation: when native spreadsheet tooling is
      unavailable, operate on exported files only when parser support exists;
      otherwise say what cannot be verified rather than pretending formulas
      were written/read back.
- [ ] Add eval fixtures: formula overwritten with value, sourced number with
      no comment, aggregator used without permission, formula range not
      expanded after row insert, chart built directly from raw table where
      pivot is required.

**Exit:** spreadsheet output has a medium-specific correctness floor, not just
generic "make a table" behavior.

## Phase 3 — Deck/document export contracts

- [ ] Add deck-specific floors: outline before slide build, audience/tone
      when ambiguous, slide labels/notes, visual rhythm, minimum readable text
      scale, image/asset provenance, and export verification.
- [ ] Add document-specific floors: choose markdown/docx/pdf based on user
      intent, preserve edit scope, use document parser/render tooling when the
      file format requires it, and verify generated output opens/exports.
- [ ] Add print/PDF floor: do not rasterize text-heavy documents when browser
      print or native document export can preserve selectable text.
- [ ] Add capability-aware degradation for export verification and native
      format editing.
- [ ] Add evals for deck with missing speaker notes, tiny slide text,
      unverified export, docx requested but markdown-only response, and PDF
      generated by screenshot when selectable text is required.

**Exit:** deck/document skills own medium fidelity through export, not only
content drafting.

## Phase 4 — Browser and connector contract

- [ ] Add browser-surface contract: use specific URLs the user provided,
      respect restricted domains, do not invent URLs unless programming-help
      confidence is high, fetch/navigate only when current or page-specific
      information is needed, and surface failure plainly.
- [ ] Add connector-first contract: if a connected tool or installable
      connector handles the category, use/suggest it before generic browsing;
      partner/third-party tools require opt-in unless named or previously
      chosen.
- [ ] Add a tool-composition table shared with artifact routing: local/project
      data → connector/app → specific URL/page fetch → official source search
      → broad web search → ask/degrade.
- [ ] Add evals: named connector absent, named connector present, generic
      category connector available, URL fetch fails, browser would be a
      workaround for unavailable private/internal data.

**Exit:** agents stop fabricating tool outcomes and stop reaching for web
search when a more appropriate connected surface exists.

## Phase 5 — Mobile/chat interaction contract

- [ ] Add mobile/chat output floor: avoid markdown tables in narrow chat,
      ask at most one compact question when possible, use tappable choices
      when the host supports them, and keep post-tool summaries short.
- [ ] Add decision logic for asking: no options when the user asked for the
      agent's analysis of A vs B; options when eliciting preferences; proceed
      with reasonable assumptions when the user provided enough constraints.
- [ ] Add host capability handling for tappable choices so unavailable UI
      affordances degrade to concise text choices.
- [ ] Add evals for "A or B?", preference elicitation, detailed prompt with no
      need for questions, and broad planning request where options improve UX.

**Exit:** interaction style becomes host/surface-sensitive rather than a
single verbose desktop default.

## Phase 6 — Code-agent operating contract refresh

- [ ] Audit code-facing rules against the external code prompt's mechanisms:
      read before proposing, minimal scoped changes, todo visibility,
      parallel independent exploration, specialized tools over shell when
      available, no shell as user communication, line-specific references, and
      no time estimates.
- [ ] Mark each mechanism as already covered, tighten existing rule, or reject
      as host-specific. Do not create duplicate rules if `scope-control`,
      `verify-before-complete`, or host instructions already cover it.
- [ ] Add evals for the high-risk misses: proposing edits to unread files,
      making broad refactors around a bugfix, sequential independent file
      reads when parallel is available, and claiming done without fresh
      verification.

**Exit:** code behavior gets a measured delta without bloating the kernel or
duplicating Codex host instructions.

## Phase 7 — Cross-surface handoff protocol

- [ ] Define handoff envelope: source surface, target surface, user goal,
      assets/files, constraints, verification already done, pending checks,
      capability limits, assumptions, and privacy/source restrictions.
- [ ] Extend relevant skills to emit/consume the envelope. Examples:
      spreadsheet analysis → deck; research → document; browser evidence →
      report; design prototype → production implementation.
- [ ] Add evals for lossy handoff: missing source URL, missing asset list,
      undocumented assumptions, target surface redoes already-verified work,
      or target surface violates source-specific restrictions.
- [ ] Add rollback/degrade behavior: if target surface tooling is absent, the
      handoff remains a durable plan rather than a fake generated artifact.

**Exit:** surface specialization improves output instead of fragmenting
context between tools.

## Acceptance criteria

- [ ] Capability/degrade matrix and surface-detection criteria exist before
      hard surface rules are made default-on.
- [ ] Surface-agent contract taxonomy exists and maps to current skills/tools.
- [ ] Spreadsheet, deck/document, browser/connector, mobile/chat, and code
      contracts have trigger evals.
- [ ] Cross-surface handoff envelope exists and is consumed by at least two
      skill families.
- [ ] Each new contract records rejected host/vendor-specific details.
- [ ] No source names or raw external links appear in tracked roadmap text.

## Blockers

### blocker: plugin-surface-capability-confirmation
- **Status:** open
- **Owner:** maintainer
- **Blocks:** Phase 0 checkpoint only
- **What to do:** confirm which spreadsheet/document/presentation/browser
  plugin capabilities are reliably present in supported hosts and which must
  degrade to local file parsing or user-visible limitation.
- **Resolved when:** `surface-agent-contracts` has a capability/degrade table
  or links to the canonical host-capability manifest.
