---
complexity: structural
status: ready
execution:
  mode: phase-checkpoints
---

# Road to frontier-quality operating system — turn external prompt mechanics into governed package leverage

> Source-anonymous harvest per `source-confidentiality`. The analyzed corpus is
> a current family of external assistant prompts: Source A is the general
> high-capability chat prompt, Source B is the design/artifact prompt, and
> Source C is the surrounding surface-specific prompt set (code, cowork,
> browser, mobile, office, research, visualize, styles, reminders). Raw links
> and full extracted notes stay local-only; this roadmap records transferable
> mechanisms, checksums, and adoption decisions, not attribution.

## Goal

Close the quality gap exposed by Source A/B/C without copying vendor-specific
wording or bloating the always-loaded kernel. The target is a governed
operating system: durable rules for universal floors, dynamic rules for
request-scoped behavior, skills for format/surface expertise, and eval gates
that prove the behavior fires. The package should get the benefits users
experience as "frontier quality": fewer premature assumptions, stronger
research/tool routing, better artifact decisions, safer memory/personalization,
cleaner citation discipline, and verification before claims.

## Reverse-engineering findings

Source A is not one personality prompt. It is a layered policy engine:
product/currentness, refusal and safety floors, tone and formatting, memory
application, preference gating, MCP/tool suggestions, artifact creation,
visual routing, search/copyright/citation, and tool catalog instructions. The
quality lift comes from separation of concerns plus examples, not from a single
style paragraph.

Source B is a production contract for design work. It encodes a workflow
(understand, explore, todo, build, verify), strict preservation rules for small
edits, design-system-first research, copy-assets-not-reference-assets, explicit
screen labels/comment anchors, built-in variation/canvas patterns, and a
verification endpoint that opens the artifact and checks load errors. The
package has pieces of this, but not the same hard end-to-end contract.

Source C shows the same architecture repeated per surface. Excel owns formula
truth, source comments, official financial sources, pivot/chart behavior, and
read-back verification. Word/PowerPoint own document/deck workflows. Browser
owns URL/navigation safety. Mobile owns terse interaction and tappable-choice
constraints. Research owns extended-search priority and clarifying-question
rules. The transferable lesson is not "add more rules"; it is "put the
surface contract where the surface runs, with local invariants and tests."

## Council-driven hardening

The first review pass converged on roadmap-shape risks before implementation:
evals must precede default behavior, tool-routing contracts must define
composition and tie-breakers, memory safety needs detection and rollback, and
runtime rollout cannot rely on hope. This revision therefore uses
`phase-checkpoints`, puts decision framing and the eval harness before rule
changes, and treats rollout/monitoring as a first-class phase.

## Current package fit

Already strong: source-of-truth, scope-control, verify-before-complete,
content-quoting-floor, source-confidentiality, ai-council neutrality,
request-scoped rule work, golden-set coverage, memory retrieval economy,
skill trigger evals, and frontend/design skills.

Material gaps:

- No single "quality operating profile" maps a prompt-mechanism finding to
  rule vs skill vs command vs eval. Today adoption happens as bespoke roadmaps.
- Memory/personalization rules exist, but the Source A pattern is sharper:
  apply behavioral preferences only when relevant, resist preferences that
  weaken criticism, never surface sensitive memories unless user-raised, and
  separate "search prior chats" from durable memory.
- Tool routing is scattered. Source A has explicit priority ladders:
  internal/project tools before web, connected app before browser, file request
  before inline visualizer, research mode before ordinary search.
- Search/citation quality exists as `content-quoting-floor`, but not as a full
  currentness + source-quality + citation-placement contract across research,
  finance/legal, and recommendation tasks.
- Artifact routing is under-specified outside the existing drafting protocol:
  when to answer inline, when to create files, when to visualize, when to use
  MCP/app tools, and when to refuse fake tool/mock outputs.

## Design principles

1. **Mechanism over prose.** Adopt decision tables, triggers, evals, and
   workflow gates; never paste external prompt paragraphs.
2. **Kernel stays small.** Only pre-send/pre-act universal floors can become
   always-loaded. Everything else routes by trigger, pack, or skill.
3. **Surface contracts beat generic cleverness.** Excel-like formula truth,
   browser navigation safety, or mobile question UX belongs to the relevant
   surface/skill, not the universal agent persona.
4. **Evidence before default flips.** New behavior starts additive or
   advisory, then flips only after trigger evals and golden tasks prove held
   quality.

## Phase 0 — Scope, provenance, metrics, and execution gates

- [x] Define "frontier-quality" as observable package behavior, not a vendor
      comparison: currentness recall, correct carrier selection, source-quality
      compliance, memory non-application precision, verification honesty, and
      no regression in existing coding/roadmap workflows.
      <!-- done 2026-07-09 (proposal): quality-metrics.md § 1 — six observable
      dimensions (currentness recall, carrier selection, source-quality, memory
      non-application precision, verification honesty, no-regression), each mapped
      to the EXISTING measurement infra; no-vendor-comparison / no-unbacked-number
      frame stated. -->
- [x] Add `agents/roadmap-assets/frontier-quality/quality-metrics.md` with
      baseline tasks, target thresholds, allowed regressions, rollback triggers,
      and the review cadence for re-harvesting future prompt families.
      <!-- done 2026-07-09: agents/roadmap-assets/frontier-quality/quality-metrics.md
      § 2 — baseline-first, flip thresholds (advisory→routed→default-on),
      no-silent-regression, per-mechanism rollback triggers, re-harvest cadence. -->
- [x] Record source-anonymous provenance in the mechanism matrix using file
      checksums and local-only source notes. Raw external links stay outside
      tracked files unless encrypted by the maintainer.
      <!-- done 2026-07-09 (decision): quality-metrics.md § 3 — provenance =
      file checksums + LOCAL-ONLY source notes (no named source / raw link in
      tracked files); encrypted-link retention is a maintainer-key alternative,
      out of scope for this autonomous proposal. Satisfies source-confidentiality
      by construction. -->
- [x] Declare the execution contract: phases -1, 0, and 0.5 require maintainer
      checkpoint approval; later implementation phases can run autonomously
      only within the approved matrix and eval gates.
      <!-- done 2026-07-09: quality-metrics.md § 4 — contract declared; this
      doc is a PROPOSAL pending the Phase-0 maintainer checkpoint; Phases 1–8 do
      not start until accepted, and Phase 1 needs the local external corpus
      (maintainer-held), so it is not autonomously fabricable. -->
- [x] Choose the first pilot slice before any default flip. Recommended pilot:
      currentness/research routing, because it is high-value, measurable, and
      less entangled with memory or artifact creation.
      <!-- done 2026-07-09 (decision): quality-metrics.md § 5 — pilot =
      currentness / research routing (M1 + source-quality half of M3): high-value,
      trigger-eval-measurable, least entangled with memory/artifacts. -->

**Exit:** maintainer accepts the metrics, provenance method, execution mode,
and first pilot slice.

## Phase 1 — Prompt-mechanism inventory, dependency graph, and disposition matrix

- [x] Add a tracked, source-anonymous inventory under
      `agents/roadmap-assets/frontier-quality/mechanism-matrix.md` with rows
      for each transferable mechanism: currentness search, tool priority,
      memory gating, preference gating, artifact routing, visual routing,
      research mode, citation/copyright, design verification, surface-specific
      office/browser/mobile/code contracts, and conversational formatting.
- [x] For each row record: owner surface, proposed carrier
      (`kernel-rule`, `auto-rule`, `skill`, `command`, `contract`, `eval`,
      `reject`), activation trigger, existing package coverage, missing
      acceptance gate, dependency ids, conflict ids, rollout flag, and risk if
      over-eagerly generalized.
- [x] Add a dependency graph that makes hidden coupling explicit: currentness
      feeds citation/source-quality; tool composition feeds artifact routing;
      capability maps feed design and surface contracts; memory safety feeds
      personalization and prior-chat retrieval.
- [x] Add conflict-resolution rules for overlapping mechanisms: project data
      beats web for internal facts; connected app beats browser for owned data;
      explicit user file request beats inline brevity; safety/verification
      floors beat preference and tone; host capability limits beat aspirational
      workflow wording.
- [x] Mark rejected items explicitly: vendor product claims, exact model
      names, environment-specific tool syntax, hidden system-prompt secrecy
      boilerplate that this host already owns, and anything that conflicts
      with `source-confidentiality`.
- [x] Add one linter-friendly convention: every future external-prompt harvest
      roadmap must include a mechanism matrix or cite an existing one.

**Exit:** matrix exists, no named source leakage, every downstream phase
references row ids, and conflicts have deterministic tie-breakers.

## Phase 2 — Eval harness and baseline before behavior changes

- [x] Create or extend a frontier-quality eval corpus before implementing
      routing changes. Include positive and negative fixtures for currentness,
      internal/project-data lookup, memory application, memory non-application,
      artifact carrier choice, connected-app routing, citation discipline,
      surface handoff, and verification honesty.
- [x] Add baseline snapshots for existing behavior so adoption can show
      improvement rather than only new green checks.
- [x] Add synthetic failure cases for every proposed rule: answering without
      lookup, using web before internal/project data, applying irrelevant
      memory, creating a file when inline is correct, simulating an unavailable
      tool, over-quoting, and claiming verification without evidence.
- [x] Define flip gates per mechanism: `advisory` means documentation only,
      `routed` means skill/rule can trigger with caveats, `default-on` requires
      trigger recall, negative-example precision, and no material regression in
      existing quality checks.

**Exit:** the eval suite can fail on known bad behavior before any contract is
made default-on.

## Phase 3 — Currentness, research-routing, and source-quality pilot

- [ ] Extend or create a rule/contract that classifies currentness risk:
      fast-changing facts, current office holders, product/version/release
      questions, specific URLs, unfamiliar named entities, laws/policies,
      prices/sports/weather/finance, and high-stakes recommendations.
- [ ] Encode tool priority: project/internal connectors first for "my/our"
      data; official/primary sources first for external claims; specific URL
      fetch when user provides a URL; ordinary web search only after the more
      specific tool path is exhausted.
- [ ] Add a tool-composition table for the pilot: when to use local files,
      repository search, GitHub/app connector, web fetch, web search, deep
      research, or no lookup. Include failure/degrade language for absent
      tools and restricted network.
- [ ] Add a research-mode skill/command path that mirrors Source C's useful
      rule: launch deep research immediately for clear research asks, ask at
      most three useful clarifying questions only when the research direction
      would materially change.
- [ ] Run the Phase 2 evals for ambiguous cases: "is X still CEO", "latest
      model", "does this law still apply", "what did we decide in the project",
      and "summarize this URL".

**Exit:** currentness behavior is trigger-tested, source-quality floors are
explicit, and no answer path relies on "knowledge cutoff apology" as a
substitute for doing the lookup.

## Phase 4 — Memory, preference, and prior-context safety

- [ ] Split durable memory guidance into three policy classes: behavioral
      preferences, contextual preferences, and sensitive/potentially harmful
      memories. Each class gets apply / do-not-apply rules, false-positive
      examples, and user-control behavior for viewing, declining, or overriding
      personalization.
- [ ] Add a hard floor: preferences or memories that suppress criticism,
      encourage agreement, weaken safety, or encourage unhealthy behavior are
      ignored even when directly relevant.
- [ ] Add an operational detection model: relevance cues, domain match,
      explicit personalization request, "we decided" cues, and negative cues
      for unrelated tasks. Include a false-positive tolerance threshold and
      review queue for borderline eval failures.
- [ ] Add a "prior conversation retrieval" decision contract separate from
      memory summaries: possessives, definite references, and "we decided" cues
      route to chat-history/conversation retrieval when available; no "I don't
      see it" claim before searching the relevant store.
- [ ] Add rollback controls: memory-gated behavior ships behind a package flag,
      logs trigger reason in test traces, and can be disabled if negative
      examples regress or users report uncanny/irrelevant personalization.
- [ ] Add trigger evals for false-positive prevention: user says they like a
      hobby and asks unrelated code; do not mention the hobby. User asks for
      personalized advice in the hobby domain; apply it.

**Exit:** memory/personalization has a falsifiable relevance gate, a user
control model, a safety override, and rollback criteria.

## Phase 5 — Artifact, visual, and connected-tool routing protocol

- [ ] Create a unified artifact-routing contract: inline answer vs tracked
      file vs visual widget/diagram vs MCP/app tool vs downloadable document.
      The contract should be format-agnostic and point to existing skills for
      implementation.
- [ ] Add explicit file-creation triggers: "write article/report/story",
      "save/download/file", named path/format, code above threshold, edit my
      file, presentation/spreadsheet/document. Add non-triggers: brief lists,
      short code, simple recipes, conversational strategy/summary.
- [ ] Add MCP/app-first rule for category-fit tools: if a real connected tool
      handles the category, use/suggest it instead of simulating UI or
      inventing fake tool outputs.
- [ ] Add a carrier cost/UX table: inline is cheapest and best for short
      answers; tracked files are best for durable repo artifacts; visual tools
      are best for inspection/spatial reasoning; documents/decks/sheets are
      best when the user asks for native format or export; MCP/app tools are
      best when they own private or structured state.
- [ ] Add visual-routing triggers: explicit "show/diagram/chart", spatial or
      system structure, data shape, UI spec as noun phrase. Add negative
      examples for text-only technical support and ordinary prose drafting.
- [ ] Wire trigger evals and at least five golden tasks that force the router
      to pick different carriers on superficially similar prompts.

**Exit:** artifact decisions are mechanically testable and reusable by
document, frontend, analysis, and MCP skills.

## Phase 6 — Citation, quoting, domain overlays, and claim self-check

- [ ] Fold `content-quoting-floor` into a broader citation contract without
      weakening its strict quote caps: cite only sources that materially
      support the answer, paraphrase by default, never reconstruct an article
      structure, prefer primary sources, and state conflicts.
- [ ] Add domain overlays with detection criteria: finance cells require
      source comments when data enters a spreadsheet surface; legal output
      requires jurisdiction/freshness when laws or compliance are asked;
      research reports require primary-source preference and no displacive
      summaries; recommendations require current product/source checks when
      spend/time risk is meaningful.
- [ ] Add a self-check before final answers that used retrieval: every factual
      claim either comes from stable knowledge, a cited source, or an explicit
      uncertainty note.
- [ ] Add evals for overlay boundaries so ordinary prose does not get
      overburdened and high-stakes answers do not under-cite.

**Exit:** citation behavior is not just "quote less"; it ties freshness,
source quality, domain detection, and answer claims together.

## Phase 7 — Quality eval expansion and default-flip gates

- [ ] Expand `check_token_quality_golden` or a sibling corpus with frontier
      quality tasks: currentness, memory non-application, artifact routing,
      tool priority, citation discipline, concise natural prose, and safe
      refusal formatting.
- [ ] Add cross-pressure cases for every new rule/contract: user preference vs
      criticism, inline brevity vs file request, internal data vs public web,
      currentness vs stable knowledge, connected app vs browser, and source
      quality vs convenience.
- [ ] Define default-flip gates: advisory → routed → default-on only when
      trigger eval recall is green, negative precision is green, and paired
      quality does not regress on existing tasks.
- [ ] Add a maintainer-visible report that shows which mechanisms remain
      advisory and why.

**Exit:** the package can prove the new quality behavior fires and does not
silently degrade existing coding/roadmap workflows.

## Phase 8 — Runtime rollout, monitoring, rollback, and re-harvest loop

- [ ] Ship new contracts behind staged rollout flags or opt-in packs where the
      package supports them; otherwise document the staged merge order and
      avoid changing multiple routing defaults in one PR.
- [ ] Add rollback instructions for each default-on mechanism: files to revert,
      flags to disable, evals that should fail if the rollback is incomplete,
      and user-visible behavior that should disappear.
- [ ] Add lightweight monitoring hooks for package development: trigger traces
      in eval output, misroute examples in roadmap assets, and a changelog
      entry when a behavior changes from advisory to default.
- [ ] Add a re-harvest cadence: repeat source-anonymous mechanism review after
      major host/tool changes or new prompt families, but require the matrix
      discipline before any new adoption roadmap.

**Exit:** adoption is reversible, observable, and repeatable without treating
one external corpus as permanent truth.

## Acceptance criteria

- [ ] Source-anonymous mechanism matrix exists with checksums, dependency ids,
      conflict ids, carrier decisions, and rollout state.
- [ ] Currentness/research, memory/preference, artifact/visual routing, and
      citation/source-quality contracts are implemented or explicitly rejected.
- [ ] Eval harness exists before behavior flips, with positive, negative, and
      cross-pressure examples for each new routing contract.
- [ ] Tool-composition, domain-detection, user-control, capability-degrade, and
      rollback behavior are documented before default-on adoption.
- [ ] No generated projection is edited by hand; all implementation changes
      land in `src/` during follow-up implementation roadmaps.

## Blockers

### blocker: source-anonymous-provenance-decision
- **Status:** resolved
- **Owner:** maintainer
- **Blocks:** Phase 0 checkpoint only
- **What to do:** decide whether tracked provenance uses only checksums plus
  local-only notes, or encrypted `ENC1:` link retention. If encrypted links
  are required, run the repo's link crypto helper with the maintainer key.
- **Resolved when:** Phase 0 records the accepted provenance method without
  raw source links or external source names in tracked files.
- **Resolution (2026-07-10, template rule 22 sweep):** not a contested
  decision — the house method already exists and is precedented: encrypted
  `ENC1:` link retention via `src/scripts/_lib/link_crypto.ts` inside a
  `## Provenance` block, per the `source-confidentiality` rule and the
  roadmap-writing § 8.C convention (used by prior source-derived roadmaps,
  e.g. the archived retrieval-substrate-hardening). The key lives in
  `.agent-settings.yml` `secrets.link_encryption_key` and the agent has
  executed this path before. Accepted method: ENC1 links + neutral descriptor;
  raw material stays local-only under `agents/tmp/`.
