---
complexity: structural
status: draft
estate_growth_exempt: "Charges +1 later_roadmaps despite status: draft, and that is not a mistake in either direction -- it is an asymmetry in the gate. check_estate_count counts later_roadmaps with countIn(), a bare name filter that never reads status, while laterRoadmaps() in the same file skips drafts for the blocker inventory. So a draft is exempt from active_roadmaps at the top level and exempt from nothing in later/. The addition is warranted: this roadmap is parked behind a three-clause entry condition whose producers both land in this same change, and it replaces a rival draft rather than adding to it. +0 open_blockers."
estate_offset_exempt: "Landed by the /analyze:inbox run of 2026-08-24 directly into later/. The one-in-one-out half fires on every added agents/roadmaps/road-to-*.md whatever its status, and this run archived only status: draft roadmaps, which were never counted and so are unavailable as offsets. This file is parked, not active, and its Workstream D was deleted at landing because its whole subject is four roadmaps this run found archived at 0 open."
execution:
  mode: experiment-gated
park: later
entry_condition: "ALL THREE, each checkable without judgement — (1) agents/evidence/ac-capability-scorecard.yaml exists AND ./scripts-run src/scripts/check_score_contract exits 0 (producer: agents/roadmaps/road-to-score-contract.md); (2) the claim episode-finalizer-coverage is registered in docs/CLAIMS.md with status: backed at >=90 % terminal records over >=200 episodes, read from a ledger carrying >=2 distinct machine provenances (producer: agents/roadmaps/road-to-episode-finalizer-and-outcome-attribution-v2.md Phases 2.3 + 5.2); (3) blocker b-envelope-drop-vs-unresolved reads Status: resolved. Reopening condition if (2) DROPs: this roadmap closes as measured-null on the attribution axis and Workstreams A/B/C proceed on mechanism-and-cost evidence only, with no outcome dimension claimed. <!-- ref-ignore -->"
pin: "fd42264a998e4ec66ba4fd397d9c37b801d045ba"
---
# Road to AC deep capabilities (v2, council-merged)

> **Source:** agents/tmp.old/road-to-10/road-to-ac-deep-capabilities.md

> Council synthesis 2026-08-23. **Parked in `later/` and landed 2026-08-24
> against HEAD `0f7c26ee9` with Workstream D deleted and the entry condition
> rewritten** — see § Corrections applied at landing. The draft's entry
> condition was unreachable as written: it claimed both inputs had "named
> producing roadmaps in the active tree", and at landing neither did. The
> replacement names three conjuncts, each checkable without judgement, plus a
> reopening condition for the case where the attribution input DROPs.
>
> Covers the rubric rows where architectural overreach is the main risk: code
> intelligence (6.5), persistent runtime/swarm (6), persistent learning (6).

## Goal

Three deep capabilities are either proven to earn their cost on the default
path, or closed with a recorded terminal state — never left as a
capability-shaped promise. Each workstream defines a contract first, ships
adapters behind it, and runs a pre-registered experiment whose null route is a
legitimate finish.

## Context — why this is parked and what unparks it

1. **Both inputs now have real producers, landed in the same run as this
   file.** `agents/roadmaps/road-to-score-contract.md` produces conjunct (1);
   `agents/roadmaps/road-to-episode-finalizer-and-outcome-attribution-v2.md`
   Phases 2.3 + 5.2 produce conjunct (2). The draft asserted this was already
   true; it was not, which is why the condition is rewritten rather than
   copied.
2. **Conjunct (3) exists because the attribution input can be blocked without
   being wrong.** `b-envelope-drop-vs-unresolved` is owner-reserved in the
   finalizer roadmap: a pre-registered DROP band and a shipped falsification
   clause disagree about the same 0.00 % reading. Until that is settled, a
   coverage figure is not citable, so this roadmap must not open on it.
3. **The outcome axis can be lost without losing the workstreams.** If the
   attribution input DROPs, the reopening condition in the entry condition
   applies: this file closes `measured-null` on attribution, and A/B/C may
   still proceed on mechanism-and-cost evidence with **no outcome dimension
   claimed**. That is a narrower roadmap, honestly labelled — not a cancelled
   one.
4. **There is no permanent "maybe later" state without a concrete reopening
   condition.** A parked file whose resume clause cannot be evaluated is an
   abandonment wearing a directory name.

## Standing constraints (inherited, not negotiable here)

- `no-runtime-daemon` (`docs/CLAIMS.md:104`) — every backend below is
  file/local-store based by default; anything long-lived is an **optional
  adapter** and never a correctness requirement.
- ADR-088 no-external-runtime-federation — remote backends conform to the
  local contract; they never become the reference implementation.
- Orchestrator-only doctrine; estate budgets (each workstream names its
  one-in-one-out offset before starting).
- Non-regression: runtime simplicity, portability, security, context
  discipline, governance-complexity are hard floors — a deep capability that
  spends one of them has failed regardless of its benchmark.

## Completion states — four, not one

Every workstream closes in exactly one of these, and the state is recorded in
the scorecard row it serves:

| State | Meaning |
|---|---|
| `promote` | The pre-registered thresholds were met and the capability goes on the default path behind the cross-workstream promotion gate. |
| `measured-null` | The experiment ran and the thresholds were not met. Terminal and 10-eligible under the score contract's measured-no-build rule. |
| `max-boundary` | A standing constraint (daemon, federation, portability) caps the achievable result before the experiment can distinguish anything. Terminal, and the constraint is named. |
| `follow-up-spike-required` | The adapters available were insufficient to run the experiment at all — the question is open and needs a bounded spike, which is a different finding from "we measured nothing". |

The fourth state exists because the draft could express only `measured-null`
and therefore could not say "the adapters were insufficient, open a spike"
without misfiling it as a measured null.

## Workstream A — Code intelligence

Hypothesis: semantic repository queries improve change correctness, impact
analysis, and test selection enough to justify their cost.

**This workstream EXTENDS an existing surface rather than opening one.**
`src/skills/code-intelligence/SKILL.md` already routes
`agent-config code-graph detect|query|affected|path` over a native engine or a
consumer-shipped index with grep as the stated fallback, and the
`external-code-graph-interop` rule already carries the query-the-index-first
obligation and the name-which-source-answered discipline. The contract below
is that surface's provider interface, not a parallel one.

- [ ] **Step A1:** Define `CodeIntelligenceProvider` (searchSymbols,
      definition, references, callers/callees, dependencies,
      changedSymbolImpact, associatedTests, freshness, capabilities). Every
      answer carries provider, revision, freshness, confidence,
      fallback_used; **no provider may answer a query it cannot back — stale
      is rejected, never guessed.**
      verify: a provider returning a stale answer is rejected by the contract
      rather than downgraded in confidence; the rejection path is proven by a
      test that goes red when the freshness check is neutralised.
- [ ] **Step A2:** Adapter ladder, in order: host-native index →
      LSP/language-native → Tree-sitter structural → grep/text control arm
      (explicit lower confidence). An AC-owned incremental index is **not**
      built in this workstream; it may only be proposed for gaps a benchmark
      proves adapters cannot serve.
      verify: each rung is reachable in a test and declares its own
      confidence; the grep arm is present as a control, not as a silent
      fallback whose provenance is lost.
- [ ] **Step A3:** Pre-registered benchmark: frozen multi-language tasks
      (rename/impact, find-implementation, callers, boundary change, test
      selection) with known answers; measure query accuracy AND episode-level
      task outcome vs. the text-only control. PROVE thresholds registered
      before any run.
      verify: the thresholds are in `docs/CLAIMS.md` before the first run;
      the null route closes the row as `measured-null` (adapters that are
      cheap stay, no AC graph is built), and an inability to run the benchmark
      at all closes it as `follow-up-spike-required`, never as a null.

## Workstream B — Durable execution (not swarm)

Three concepts kept separate: durability (required), worker lifecycle
(optional), swarm scheduling (experimental consumer — never the architecture).

- [ ] **Step B1:** Define `ExecutionStateStore` (createEpisode, checkpoint,
      load, lease, complete, fail, cancel, listResumable; heartbeat as an
      optional backend capability). Delivery semantics declared per backend.
      verify: every method's delivery semantics are declared per backend; a
      backend that cannot state them fails the contract rather than inheriting
      a default.
- [ ] **Step B2:** Local durable backend (SQLite or an equally simple
      transactional store, zero setup beyond install). Conformance suite:
      crash between checkpoint writes; crash after side effect before
      checkpoint; duplicate resume of one lease; corrupted state; schema
      migration; cancel-during-complete; parent death; stale lock. Remote
      adapters pass the **same** suite; ADR-088 applies.
      verify: each of the eight arms is proven RED by sabotaging the mechanism
      it guards, then restored — and the concurrency arms run N real
      processes, since a concurrency test that never failed has unknown
      sensitivity.
- [ ] **Step B3:** Resume pulls minimal unresolved state from the episode +
      requirement records (finalizer Phase 4), never the historic transcript.
      verify: a resume run reads no transcript file; the assertion is a test
      over the resume path's file access, not a code reading.
- [ ] **Step B4:** Swarm promotion experiment, pre-registered: bounded
      ephemeral subagents vs. durable sequential vs. durable parallel workers,
      on a task corpus with quality/wall/cost/duplicate-work/orphan
      thresholds fixed first.
      verify: thresholds registered before the run; the null route is terminal
      — durable state ships, the scheduler does not, and "persistent runtime"
      closes with capability-plus-falsified-need.

## Workstream C — Persistent learning

Two layers, never collapsed: **evidence memory** (automatic, factual episode
references) and **normative promotion** (governed, reviewed change to
rules/skills/config). Learning never silently edits foundation.

- [ ] **Step C1:** Learning evidence store: `{lesson_id, scope, trigger,
      observation, episode_refs[], confidence, counterexamples[], created_at,
      expires_at, supersedes, status: candidate|corroborated|validated|
      rejected|expired|promoted}`. Provenance, scope, TTL-or-permanence-reason
      mandatory; secrets never promote beyond project scope; no
      self-confirming loop (learned guidance may not generate the evidence
      that validates it).
      verify: a lesson whose only supporting episodes were themselves produced
      under that lesson is rejected by the store, and the rejection is proven
      by a test.
- [ ] **Step C2:** Validation: repeated independent episodes or an explicit
      human-approved exception; hold-out evaluation before broad promotion;
      contradiction check against rules/skills/ADRs and newer evidence.
      verify: the contradiction check runs against the live corpus, not a
      snapshot, and a deliberately contradictory lesson is caught.
- [ ] **Step C3:** Promotion boundary: a governed diff with review and
      rollback — the existing self-repair line of work
      (`src/scripts/self_repair_cli.ts`, `src/scripts/self_repair_hook.ts`) is
      the substrate, not a new channel.
      verify: poisoned-lesson negative control — a deliberately wrong lesson
      is rejectable, expirable, and rollable back without touching the
      canonical corpus; the null route is terminal (evidence memory ships,
      promotion stays manual, row closes `measured-null`).

## Cross-workstream promotion gate

- [ ] **Step X1:** No deep capability becomes default from its internal
      benchmark alone. Promotion requires all of: mechanism proof · negative
      controls · episode-level outcome improvement · cost budget · security
      review · host portability · rollback path · governance-complexity budget
      (files, standing tokens, per-turn ms, schemas, commands added — and what
      was removed to pay for them).
      verify: each of the eight conditions has a named artifact; a promotion
      with a missing condition is refused by the gate rather than waived in
      prose. Under the entry condition's reopening clause, the
      episode-level-outcome condition is **unavailable** rather than waived,
      and a promotion attempted without it is refused.

## Blockers

### blocker: b-deep-caps-entry-unreachable
- **Status:** resolved
- **Owner:** council
- **Blocks:** nothing — recorded for provenance.
- **What to do:** nothing further; the draft's entry condition asserted that
  both inputs had named producing roadmaps in the active tree, which was false
  at landing. It was replaced with the three-conjunct condition in the
  frontmatter, each conjunct checkable without judgement, plus a reopening
  condition for a DROP on the attribution input.
- **Recommendation:** none outstanding.
- **If you do nothing:** nothing — this entry exists so a later reader does
  not re-derive the unreachable condition from the draft.
- **Resolved when:** resolved at landing 2026-08-24 by the entry-condition
  rewrite recorded in § Corrections applied at landing.

### blocker: b-deep-caps-offsets-unnamed
- **Status:** open
- **Owner:** council
- **Blocks:** the start of any workstream (A1, B1, C1).
- **What to do:**
  1. The standing constraints above require each workstream to name its
     one-in-one-out estate offset **before starting**. None is named.
  2. Name a concrete offset per workstream, or record that the workstream
     runs inside an existing roadmap rather than as a new file.
- **Recommendation:** name the offsets when the entry condition first reads
  true, not now — an offset chosen against today's estate will be stale by
  then, and the estate at landing is 3 active files, which is not the estate
  this roadmap will unpark into.
- **If you do nothing:** the first workstream to open does so without an
  offset, which is the estate-ratchet violation the constraint exists to
  prevent.
- **Resolved when:** each of A, B, C carries a named offset or a recorded
  statement that it adds no file.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-24 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | A parked file becomes a permanent maybe-later | product | The draft's entry condition could not be evaluated, which makes parking indistinguishable from abandonment. There is no permanent maybe-later state without a concrete reopening condition. | The frontmatter condition names three conjuncts, each checkable without judgement, plus the DROP reopening clause; § Context item 4 states the principle so a future edit cannot soften it back. | Context — why this is parked and what unparks it |
| 2 | Capability creep toward graph-server / swarm-OS / memory-daemon | product | Each workstream has an obvious "just run a service" shortcut that would spend the no-daemon constraint the package sells. | Every workstream's default backend is local+file; long-lived anything is an optional adapter behind the cross-workstream promotion gate; `no-runtime-daemon` and ADR-088 are declared non-negotiable here. | Standing constraints (inherited, not negotiable here) |
| 3 | Benchmarks pass, outcomes do not | product | A capability can win its internal benchmark and change no engineering outcome, which is the exact failure the six-dimension definition of 10 exists to catch. | Outcome evidence comes from finalizer episodes, which is why entry-condition conjunct (2) blocks this roadmap until that claim reads `backed`; if it DROPs, the outcome dimension is declared unavailable rather than substituted. | Cross-workstream promotion gate |
| 4 | "Adapters insufficient" is misfiled as a measured null | implementation | A workstream that could not run its benchmark at all would close as `measured-null`, which reads as "we measured and found nothing" and closes a question that was never asked. | The four-value completion enum adds `follow-up-spike-required`; Step A3's verify routes an unrunnable benchmark there explicitly. | Completion states — four, not one |
| 5 | A conformance arm never goes red | implementation | Eight crash/lease/corruption arms are exactly the shape that passes vacuously; the repo has recorded a concurrency test that stayed green against the code it was written to refute. | Step B2's verify requires sabotage-then-restore per arm and N real processes for the concurrency arms. | Workstream B — Durable execution (not swarm) |
| 6 | Learning validates itself | implementation | A lesson whose supporting episodes were produced under that lesson is a self-confirming loop that looks like accumulating evidence. | Step C1 forbids it in the store and its verify requires a test proving the rejection; C3 keeps promotion on the existing governed self-repair substrate rather than a new channel. | Workstream C — Persistent learning |
| 7 | Estate growth with no named offset | implementation | The standing constraints require a per-workstream offset before starting and none is named. | Blocker `b-deep-caps-offsets-unnamed` gates A1/B1/C1 and defers the naming to unpark time, so the offset is chosen against the estate that will actually exist. | Blockers |

## Acceptance Criteria

- [ ] AC-1 — All three entry-condition conjuncts read true before any
      workstream opens, each evaluated without judgement.
- [ ] AC-2 — Each of Workstreams A, B, C closes in exactly one of the four
      completion states, recorded in the scorecard row it serves.
- [ ] AC-3 — No workstream shipped a long-lived process as a correctness
      requirement; every such backend is an optional adapter behind the
      promotion gate.
- [ ] AC-4 — Every pre-registered threshold was in `docs/CLAIMS.md` before its
      first run, byte-identical to the resolving report's.
- [ ] AC-5 — Each Workstream B conformance arm and the Workstream C
      poisoned-lesson control was proven red by sabotage and restored.
- [ ] AC-6 — Blocker `b-deep-caps-offsets-unnamed` reads `Status: resolved`.
- [ ] AC-7 — If entry conjunct (2) DROPped, this roadmap records
      `measured-null` on the attribution axis and no workstream claims an
      outcome dimension.

## Corrections applied at landing (2026-08-24)

| What | Was | Now | Why |
|---|---|---|---|
| Workstream D (Context efficiency) | Three steps (D1 per-payload-unit accounting, D2 migration policy gate, D3 runtime deferral) framed as extensions to four named active roadmaps | Deleted in full | All four are archived at 0 open: `road-to-standing-payload-diet` (18/0), `road-to-trigger-delivered-rule-bodies` (34/0), `road-to-skill-delivery-over-mcp` (22/0, closed at measured-null), `road-to-terminal-token-economy` (15/0). Step D1 says the accounting fields ride on "the diet drain"; that drain is finished, so the step is unexecutable as written. The accounting fields survive as Step 3.4 of `road-to-ten-across-the-board.md`. |
| `entry_condition` | "episode-finalizer-coverage claim PROVEN (>=90 % terminal records over >=200 episodes) AND ac-capability-scorecard.yaml exists", justified by "both inputs have named producing roadmaps in the active tree" | Replaced verbatim with the three-conjunct condition now in frontmatter, including the DROP reopening clause | The old condition was unreachable: the claimed producing roadmaps did not exist in the active tree at landing. The replacement names a producer per conjunct, adds the owner-reserved envelope blocker as conjunct (3), requires ≥2 machine provenances on the coverage reading, and states what happens if the attribution input DROPs instead of leaving the file stranded. |
| Completion vocabulary | Only `measured-null` ("every workstream's null route is a terminal, 10-eligible state") | Four-value enum: `promote \| measured-null \| max-boundary \| follow-up-spike-required` | Salvaged from a rival draft dissolved in the same inbox run. The file could not express "adapters insufficient, open a spike" and would have had to misfile it as a measured null. `max-boundary` matches the sixth `status` value landed in `road-to-score-contract.md` Phase 0.1. |
| Parking principle | Implicit in the later/-sweep reference | Stated: "There is no permanent 'maybe later' state without a concrete reopening condition." | Salvaged from the same dissolved draft; it is the sentence that makes the entry-condition rewrite an obligation rather than a preference. |
| Workstream A framing | A contract defined from scratch, with no reference to existing surfaces | Declared an extension of `src/skills/code-intelligence/SKILL.md` and the `external-code-graph-interop` rule, both verified present at landing | The skill already routes `agent-config code-graph detect\|query\|affected\|path` with grep as the stated fallback, and the rule already carries the query-first and name-the-source obligations. A parallel contract would duplicate a shipped surface. |
| Workstream C3 substrate | "the existing self_repair_store line of work" | `src/scripts/self_repair_cli.ts`, `src/scripts/self_repair_hook.ts` | `self_repair_store` resolves to no file; the two scripts above are what exists. |
| Step shape | Workstream steps carried no `verify:` lines; the promotion gate was prose with no checkbox | Every step is `- [ ]` with a `verify:` line; the promotion gate is Step X1 | House roadmap contract. |
| Risk table shape | `## Risks`, two columns | `## Risk Register`, six-column house grammar with the `risk-review` marker | `src/scripts/lint_plan_risk_register.ts:212`; `Risk type` admits only `product` or `implementation` (`:288-293`). |
| Missing house sections | No `## Goal`, no `## Context`, no `## Blockers`, no `## Acceptance Criteria`, no Source line | All present | House roadmap contract. |
| Frontmatter | No `status:`, no `estate_offset_exempt` | `status: draft`; exemption added with the offset-unavailability reason | House rules for this run. |
| Rubric rows covered | Header listed four rows including "context efficiency (8.3)" | Three rows; context efficiency removed | Follows the Workstream D deletion. |
