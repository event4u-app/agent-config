---
complexity: structural
status: ready
estate_growth_exempt: "Promoted draft -> ready 2026-08-30. The roadmap is executable now: four of its five blockers are resolved and the open b-adr-088 parks only Phase 6.4s second half, leaving Phases 0-5 and 7-9 legal. The growth is a status flip, not a new file — the estate gains no roadmap it did not already carry, only one collect() now counts."
estate_offset_exempt: "Landed by the /analyze:inbox run of 2026-08-24. The one-in-one-out half fires on every added agents/roadmaps/road-to-*.md whatever its status, and this run archived only status: draft roadmaps, which were never counted by collect() and so cannot serve as offsets. The addition is sanctioned on its own terms: a tree-wide grep over agents/roadmaps/*.md and agents/roadmaps/later/*.md for `adapter manifest` and `dispatchab` returns zero files, so no active or parked roadmap owns the subject."
execution:
  mode: phase-checkpoints
research_date: 2026-08-23
ac_pin: d7072e910d0478814358cca576eef585c3a04bfc
---

# Road to capability-native execution — a browser resolver that earns its generality

> **Source:** agents/tmp.old/nxt-lvl-frontend/road-to-capability-native-execution-v2.md

## Goal

A domain skill states the semantic capability, evidence and policy constraints
it needs. It does not name a browser backend. The suite selects a
**dispatchable** implementation for the current task, host and policy, records
which one it chose and why, and can fall back without silently widening trust,
cost, autonomy or evidence scope.

Scope is one vertical: `browser.*`. Nothing here graduates to a general
execution primitive until Phase 9's gate fires.

## Context — what already ships, and what is actually missing

The draft this file lands from proposed four new mechanisms. Three of them
already exist in the tree under different names, and re-anchoring onto them is
the difference between an extension and a fourth parallel router.

**The declarative surface ships.** `src/scripts/schemas/skill.schema.json:45-89`
defines a top-level `runtime_requires` object with `bins`, `env`, `primary_env`
and `network`, described in the schema itself as being "in the form
`doctor`/`preflight` can actually probe", and mandatory for an external
`execution.handler`. Its `$comment` records that zero skills use it today. So
the projection-compatible place for a skill to declare what it needs is present
and unused; what is missing is the **semantic layer above named binaries** — the
abstraction `model_tier` already proves for models, applied to capabilities.

**`requires` as a key name is reserved, and the draft collides with it.** The
same schema states it plainly: `requires` is taken by ADR-015 pack-dependency
edges (a list of pack ids, validated in `build_discovery_manifest.ts`), and
reusing it "makes every skill carrying one unassignable in the discovery
manifest". The draft's proposed `execution.requires:` block is therefore a
naming collision — the second one it carries, alongside a generated root
`CAPABILITIES.yaml`. Both are merge-blocking and are gated in Phase 0.

**The probe taxonomy ships, and it is already seven states.**
`src/scripts/_lib/tool_probe.ts:59` defines
`ToolProbeStatus = 'ok' | 'missing' | 'broken' | 'timeout' | 'error'`, with
every spawn hardened, retry only on timeout, and no throw path.
`src/scripts/reach_doctor.ts:104-110` extends it in both directions:
`ChannelStatus = ToolProbeStatus | 'removed' | 'not-ready'`, so an operator can
tell `missing` (nothing to run) from `not-ready` (installed, answering its probe,
still unable to retrieve). The draft's seven-field `dispatchable` object is a
re-derivation of that seven-state enum with the states flattened into booleans.
This roadmap extends the enum; it does not invent a parallel one. The draft
cites neither file.

**A fixed-priority resolver is precedented.** `src/scripts/_lib/judgment_ladder.ts`
resolves a task to one of five dispatch rungs in a **fixed priority order**, and
its own header states that the order *is* the contract — "two signals matching
the same text must resolve deterministically, never on evaluation-order
accident". That is the shape Phase 4 copies: an ordered filter, not a weighted
score.

**The pilot runs before the selector, and this is measured rather than argued.**
`docs/contracts/budget-routing.md` was **RETIRED 2026-08-16** by a converged
2-of-2 AI council. Its own opening states why: AC1–AC5 "were pre-registered
against a mechanism with no production caller and no possible measurement basis,
so they could never fire — and an acceptance criterion that cannot fire reads as
coverage that does not exist". `session_tier` was non-null in **0 of 327**
orchestration records, and `src/scripts/_lib/tier_budget_routing.ts` still sits
in the tree with its routing machinery removed. Building a selector before its
caller exists is exactly that failure, so the frontend pilot is Phase 3 and the
selector is Phase 4. The pilot exercises each dispatchable adapter explicitly;
that is what produces both the caller and the data the selector needs.

**Ownership.** This roadmap owns the capability request shape, the adapter
manifest and probe, dispatchability, selection, transport/runtime separation, the
normalized outcome envelope, failure and fallback semantics, the tool-instruction
loading boundary, and the expansion gate. It owns no frontend fidelity
semantics, no detector rules, no visual quality judgment, no default flips, no
model routing, no merge authority, no install permission, and no cost or privacy
policy.

## Phase 0 — Governance, collisions and a frozen corpus

Merge-blocking. **AMENDED 2026-08-30, AI council 2/2 convergent** — the original
line read *"Nothing in Phases 1-9 is authored before this phase closes"*, and it
contradicted `b-adr-088-external-runtime-federation`'s own `Blocks:` field
(*"Phase 6 Step 6.4's parked half. Phases 0-5 and 7-9 proceed"*). One of the two
had to give, because step 0.2's remaining half is owner-reserved by a prior 2/2
council ruling and no council may close it — so under the original wording this
roadmap was permanently stalled at Phase 0 until a human wrote an ADR
interpretation, while its own blocker said 45 of 54 steps were executable.

The amended rule, in the wording openai's seat refined:

> Later phases may proceed once all Phase 0 prerequisites **within current
> authority** are complete, except that **no work may implement, expose, depend
> on, or assume availability of any ADR-088-reserved capability**.

Phase 0 and step 0.2b stay **visibly incomplete**. "Closed for sequencing
purposes" was rejected by both seats as giving one phase two meanings of closed;
what changes is the gate's condition, not the step's status.

**What the exception forbids, named rather than left to Step 6.4's scope.** No
capability manifest entry, schema member, generated artifact, fixture, public
type, test or documentation line may name, reserve a slot for, or assume the
availability of `semantic-single-step` or `agentic-subflow`, and none may record
the four deterministic browser-engine adapters as outside ADR-088's boundary.
openai's seat named the leak path specifically: the disputed interpretation can
be embedded in public types, fixtures, generated artifacts or compatibility
contracts long before Phase 6, at which point discovering it at implementation
time is too late. The conservative reading holds throughout.

**Stop condition.** Any later-phase step that cannot be authored without taking
a position on ADR-088's boundary halts and returns here rather than deciding it
in passing.

**Two things this amendment does NOT do**, stated because they are what a
reviewer should check it against: it does not re-open the owner-reserved
question — the 2026-08-29 split stands unchanged — and it authorises no work,
because the roadmap is `status: draft` and sequencing structures planned work
rather than greenlighting implementation. Both seats made that distinction
independently; anthropic's called the draft status load-bearing, openai's split
the three states this design was conflating (administratively executable,
architecturally permitted, externally releasable).

- [x] **0.1 Resolve the two naming collisions.** `execution.requires:` and a
      generated root `CAPABILITIES.yaml`. Either extend `runtime_requires` with
      a capability member, or name a third key deliberately with the reason
      recorded.
      `verify:` **CORRECTED 2026-08-29 — the original verify was unsatisfiable.**
      It read ``grep -n '"requires"' src/scripts/schemas/skill.schema.json``
      "shows the ADR-015 reservation intact". That grep returns **zero lines**:
      there is no `"requires"` key in the schema, which is precisely the point —
      the reservation is recorded as PROSE inside `runtime_requires`'s
      `description`, not as a key. A verify that can only ever return nothing
      cannot show anything, so it is replaced with three checks that hold:
      (i) `grep -c 'ADR-015' src/scripts/schemas/skill.schema.json` ≥ 1 and
      `grep -n 'NOT named .requires' …` matches at `:48` — the reservation prose
      is intact; (ii) the schema has no top-level `requires` property
      (`Object.keys(properties).includes('requires') === false`) while
      `runtime_requires` is present; (iii) `requires` is read as an ADR-015 pack
      edge in `src/scripts/build_discovery_manifest.ts:556`, which is what makes
      the reservation real rather than declared.

      **Closed 2026-08-29 on the AI council's resolution of
      `b-requires-key-reserved` (2/2): the chosen key is `runtime_requires`, and
      choosing it IS the resolution of the collision** — `execution.requires:`
      is not introduced, so the ADR-015 edge is untouched. The capability member
      is optional and additive, and it lands **with its first consumer in Phase
      1**, not before: the schema's own `$comment` refuses a speculative
      vocabulary, and four skills already carry `runtime_requires` in
      frontmatter. `CAPABILITIES.yaml` is **preserved** — it is an existing
      323-line CI-drift-checked artifact generated by
      `generate_capabilities_index` (PR #1679), not the draft's file — so any
      capability index this roadmap needs extends that generator or takes a
      different name. Both premises the blocker argued from were false; see the
      blocker for what survives.

- [x] **0.2a Classify the roadmap against ADR-042 and ADR-212.** Both blockers
      answered with a written disposition, not an assumption of non-overlap.
      `verify:` `b-adr-042-runtime-resolver` and `b-adr-212-declarative-routing`
      each read `Status: resolved` with a dated disposition naming the ADR and
      the reason this work is or is not inside its scope — both do, AI council
      2/2, 2026-08-25.

- [~] **0.2b Classify the roadmap against ADR-088.** The third disposition, and
      the one no council may write.
      `verify:` `b-adr-088-external-runtime-federation` reads
      `Status: resolved`. It reads `open`, and stays open until an owner acts —
      see the blocker's amended `Resolved when`.

      **SPLIT from 0.2 on 2026-08-30, AI council 2/2.** The step bundled two
      dispositions of DIFFERENT AUTHORITY under one checkbox, so its glyph could
      only be wrong: `[x]` would claim an owner-reserved decision had been
      taken, and `[~]` buried two completed council rulings inside a deferral.
      anthropic's seat called the split *"mechanically honest"* — it resolves
      the authority conflation structurally rather than by interpretation — and
      openai's agreed it *"prevents the unresolved decision from being buried"*
      while insisting, correctly, that the split alone does not fix the
      sequencing rule: 0.2b stays `[~]`, so Phase 0 stays open and the header
      had to be amended too. Both are done, and the header amendment is the
      operative half.

      **The step count moves 54 → 55 and no work was invented.** One checkbox
      became two over the same subject; 0.2a's content is the two dispositions
      that were already recorded as done under the old 0.2, quoted below
      unchanged.

      **Two of three done, ADR-088 outstanding — deferred, not skipped.**
      `b-adr-042-runtime-resolver` and `b-adr-212-declarative-routing` both read
      `Status: resolved` with dated dispositions (AI council 2/2, 2026-08-25).
      `b-adr-088-external-runtime-federation` names **`Owner: maintainer`**, so
      it was not put to the council: it blocks only Phase 6 Step 6.4's parked
      half, and Phases 0-5 and 7-9 proceed without it. This step closes when
      that third disposition exists.

      **What the two dispositions established, and it is narrower than the step's
      wording suggests:** ADR-042 is out of scope **only** for demonstrated
      execution gating, and ADR-212's class distinction holds **only** for
      semantics-preserving feasibility resolution. Neither is a general
      clearance, and widening either returns to the ADR owner.

      **UPDATED 2026-08-29 — the third disposition was put to the council, and
      the council established that it cannot give half of it.** The note above
      said `b-adr-088-external-runtime-federation` "was not put to the council"
      because it names `Owner: maintainer`. It has now been put, under this
      run's standing instruction that maintainer-owned decisions route to the
      council. **The verdict is a split, 2/2:**

      - **Council-decidable, and recorded:** `semantic-single-step` and
        `agentic-subflow` stay parked and unavailable, gated on a federation ADR
        that does not yet exist.
      - **OWNER-RESERVED, and not taken:** recording the four deterministic
        browser-engine adapters as *outside* ADR-088's boundary. ADR-088 is
        `status: accepted` and states a category boundary; writing an exception
        to it narrows an accepted floor, which no council may do. openai caught
        the substitution that makes the exception look safe — the argument reads
        ADR-088 as barring external **agent** runtimes, while the ADR says
        external **tool** runtimes, and "local, deterministic, delegates no
        decisions" does not establish that a browser engine is not an external
        tool runtime. The conservative reading holds in the meantime.

      **So this step stays `[~]`, and its blocker stays `open` — correctly.**
      The third disposition cannot be completed by this run or by any council,
      and the blocker's own `Resolved when` bundled the two halves as though one
      authority could discharge both. That `Resolved when` is amended at the
      blocker. This is the one place in this roadmap where the honest answer is
      that an owner is required.

- [x] **0.3 State why the browser vertical is not the reach-channels result
      again.** Blocker `b-reach-channels-precedent`, answered before any adapter
      manifest is authored.
      `verify:` **`b-reach-channels-precedent` reads `Status: resolved`** with a
      dated 2/2 disposition naming the transferable and non-transferable parts.

      **The named property is NOT one this step expected**, and that is the
      finding. Both council seats **rejected** two of the three candidate
      distinctions the blocker offered — *"interchangeable on one protocol"* is
      false as stated (Playwright, Puppeteer, Selenium, WebDriver and CDP are not
      one protocol), and byte-comparable evidence *"measures reproducibility, not
      whether we should choose this adapter over that one"*. Only the third
      distinguishes: **a real caller exists before the selector**, supplying at
      least one observed unavailability case.

      So the property is **semantics-preserving selection on demonstrated
      execution eligibility** — not "browser", and not determinism. The step's
      verify asked for *at least one* property, and it has one; it does not have
      the three it went looking for.

- [x] **0.4 Map existing runtime-routing primitives and forbid a second
      router.** Read `tool_probe.ts`, `reach_doctor.ts`, `judgment_ladder.ts`,
      `tier_budget_routing.ts`, missing-tool handling and missing-skill
      recovery. Every proposed code path either extends one of them or states
      why it cannot.
      `verify:` a table in the roadmap names each primitive, the file, and
      extend-or-not with a reason; no new module duplicates
      `ToolProbeStatus`/`ChannelStatus` or re-implements a priority-ordered
      resolver.

      **CLOSED 2026-08-29.** All six read at this branch's HEAD. Line numbers
      are citations, not recollections.

      | Primitive | File | Decision | Reason |
      |---|---|---|---|
      | `ToolProbeStatus` (`ok · missing · broken · timeout · error`), `ToolProbeDescriptor`, `ToolProbeResult`, `probeTool` | `src/scripts/_lib/tool_probe.ts:59,70,88,266` | **EXTEND** | This IS the cheap static availability probe Phase 2.2 asks for. A new status enum next to it is the duplication this step forbids. |
      | `ChannelStatus` (`ToolProbeStatus \| 'removed' \| 'not-ready'`), `ChannelRow`, `runDeepProbe`, `ReachDoctorPayload` | `src/scripts/reach_doctor.ts:110,204,425,219` | **EXTEND** | Phase 2.3 already says so. The load-bearing detail is HOW: `:110` adds two states by **composing** `ToolProbeStatus`, never by restating it. Phase 2.3's `dispatchable` state is added the same way or not at all. |
      | `LadderRung`, `LadderVerdict`, `classifyLadder`, `explainLadder`, `RungStatus` (`taken · rejected · not-reached`) | `src/scripts/_lib/judgment_ladder.ts:40,42,342,499,467` | **DO NOT extend the resolver; IMPORT the reason-code shape** | Different input and different domain: the ladder classifies TASK TEXT to pick a fixed delegation rung; the Phase 4 selector filters ADAPTERS by capability coverage against a host-dependent set. Merging them would give one module two unrelated input types and two unrelated rung sets. But `explainLadder`'s per-rung `taken / rejected / not-reached` is exactly what 4.5 and AC-7 need, so the selector imports `RungStatus`-shaped reason codes rather than inventing a parallel vocabulary. **This is the closest thing in the tree to the second router 0.4 warns about, and it is named here so Phase 4 cannot drift into one unnoticed.** |
      | `BudgetTier`, `TIER_ORDER`, cooldown read/write | `src/scripts/_lib/tier_budget_routing.ts:32,35,37,49` | **DO NOT extend; adopt the shape** | It routes MODEL tiers under a spend budget with cooldowns — nothing about capability coverage, and an adapter is not a price tier. What transfers is `TIER_ORDER`: a fixed ordered array with no numeric weight, which is the existing precedent for AC-7. |
      | `missing-tool-handling` (ask before working around a missing CLI; never install silently) | `src/rules/missing-tool-handling.md`, routing to `guideline:agent-infra/missing-tool-handling` | **ROUTE INTO IT** | When no adapter is dispatchable the terminal behaviour already exists. The selector must hand off to it, not grow its own install-or-workaround path. |
      | `rank()` — keyword scoring over skill frontmatter, returns `[name, score, tags]` | `src/scripts/skill_tools/score_skill_relevance.ts:247,249` | **DO NOT extend — cite as the ANTI-precedent** | `RankRow` carries a NUMERIC score, and AC-7 forbids numeric weight anywhere in selection. This is the one place the tree ranks numerically; reusing it for adapters would violate AC-7 by construction. Recorded so a future step cannot reach for it as the obvious ready-made ranker. |

      **The negative half is a CHECK, not a promise.** At Phase 0 "no new module
      duplicates `ToolProbeStatus`/`ChannelStatus`" is trivially true because no
      adapter code exists — which is precisely when the assurance is worthless.
      `tests/contracts/runtime_routing_primitives.test.ts` (4 tests, green)
      asserts each vocabulary is declared exactly once, that no other module
      re-lists a full member set, and that `ChannelStatus` still composes rather
      than forks. Sensitivity proven: a temporary second `ToolProbeStatus`
      declaration turned 2 of the 4 red, and it was removed.

      **What the check deliberately does NOT cover:** *"re-implements a
      priority-ordered resolver"* is not decidable from a file's text — a
      resolver is recognisable by what it does, and a pattern guess would either
      miss the real case or fire on every `sort`. That half stays model-carried
      and is carried into Phase 4's exit criteria, with `explainLadder` named
      above as the specific thing Phase 4 must import from rather than mirror.

- [x] **0.5 Freeze the browser benchmark fixtures.** Minimum set: project
      Playwright available; playwright-cli only; MCP only; CLI + MCP; backend
      unavailable; unhealthy backend; capability advertised but not
      dispatchable; evidence-degraded fallback.
      `verify:` the fixture digest is committed in a commit that **precedes**
      the first commit touching any resolver or adapter code.

      **CLOSED 2026-08-30.** `internal/bench/corpora/browser-dispatch/` carries
      eight scenarios in `scenarios.jsonl` — one per state this step lists by
      hand — plus a `manifest.json` whose `sha256` entry IS the freeze. Same
      shape as the encoding-channels corpus next to it, deliberately: a frozen
      corpus with no digest is a corpus nobody would notice being edited.

      **What is frozen, and what is deliberately NOT.** Each row freezes a HOST
      STATE and the observable facts a probe can read from it — is the module
      resolvable, is the binary installed, is the server reachable. **No row
      carries an expected selector verdict**, and the omission is the point:
      Risk 3 in this roadmap's own register is acceptance criteria
      pre-registered against a mechanism with no production caller (the retired
      budget-routing contract, `session_tier` non-null in 0 of 327 records).
      Freezing verdicts here would pre-register exactly that, before Phase 3 has
      a caller and before Phase 4 has a selector to judge. The labels recorded
      instead are true or false independently of anything this roadmap builds.

      Two distinctions are frozen separately because they are the two a static
      probe most often collapses: **present ≠ healthy** (`s6`, Playwright
      importable with no browser binaries) and **advertised ≠ reachable** (`s7`,
      an MCP server advertising a capability it cannot dispatch — the row
      `dispatchable` exists for).

      `tests/contracts/browser_dispatch_corpus_freeze.test.ts` (5 tests) asserts
      the digest, the scenario SET against the eight names above, the absence of
      any verdict-shaped key, that the host states actually differ, and both
      distinctions. **Sensitivity proven:** appending one scenario line turned 3
      of the 5 red — digest, set, and distinct-host-count — and the line was
      removed.

      **Ordering, which is this step's actual verify clause:** the corpus and
      its manifest land in this commit, and no resolver or adapter code exists
      anywhere in the tree at this point — Phases 1-9 are entirely unstarted, so
      the precedence the clause asks for is satisfied by construction rather
      than by commit ordering within a series.

- [ ] **0.6 Pre-register the outcome bars and their falsifiers.** Dispatch
      success, evidence completeness, token/context cost, wall-clock, setup
      friction, deterministic replay, degraded-run honesty.
      `verify:` every bar has a numeric threshold and a named falsifier, and the
      prereg commit precedes any default-preference change; a bar with no
      falsifier fails the shape check rather than passing.

## Phase 1 — The browser capability request contract

**ORDERING FINDING, 2026-08-30 — Phase 1 cannot start before Phase 3, and its
own verify clauses are what say so.** Recorded here rather than worked around,
because the workaround is the failure this roadmap's risk register already
names.

- **1.1's verify** requires *"every declared capability has at least one real
  consumer call site and at least one adapter that implements it; a capability
  with neither fails the check."* No adapter exists (Phase 2 builds them) and no
  consumer exists (Phase 3 supplies one), so declaring the eleven capabilities
  today produces eleven that fail 1.1's own check. Declaring them anyway and
  deferring the check is precisely the speculative-vocabulary move the schema's
  `$comment` refuses and blocker `b-requires-key-reserved` already resolved
  against — *"the capability member lands with its first consumer in Phase 1,
  not before"*.
- **1.2 and 1.3** extend a declaration format 1.1 has not established.
- **1.4's** *"a domain skill naming a browser backend in a **required
  position**"* reads as prose at first glance, and it is not: a *required
  position* is the required list of a 1.2 capability declaration. Measured
  before concluding this — a tree-wide grep for a requirement marker
  co-occurring with `playwright|puppeteer|selenium|webdriver` in
  `src/skills/*/SKILL.md` returns exactly **two** lines, both in
  `verify-repair-loop`, and both describe the **deferred** live-app path rather
  than requiring a backend (one is a parenthetical inside a sentence whose
  requirement attaches to *"a live app"*, the other is a `NEVER`). So the prose
  reading gives a lint whose entire live population is two false positives,
  which is a gate that would have to be tuned against its own corpus to stay
  green. The structured reading needs 1.2.

This is the same ordering the reach-channels blocker settled at Phase 0:
*"the general selector manifest may not precede the caller"*, and one seat
called the original order *"the speculative-infrastructure mistake"*. That
disposition was applied to Phase 2's manifest; it applies to Phase 1's
vocabulary for the same reason, and the phase order does not yet reflect it.

**What this does NOT do:** it does not renumber the phases or move steps, which
would be authoring Phase 1's replacement while claiming to observe a problem in
it. It records the dependency so the next run starts from Phase 3's caller
rather than from a vocabulary with nothing consuming it.


- [ ] **1.1 Define only the capabilities the frontend pilot consumes.**
      `browser.navigate`, `browser.snapshot`, `browser.find`,
      `browser.interact`, `browser.viewport`, `browser.screenshot`,
      `browser.evaluate`, `browser.console.read`, `browser.network.read`,
      `browser.trace`, `browser.session`. No Git/DB/HTTP namespace.
      `verify:` every declared capability has at least one real consumer call
      site and at least one adapter that implements it; a capability with
      neither fails the check.

- [ ] **1.2 Land the declaration on `runtime_requires`, per 0.1's outcome.**
      Required/optional capability semantics, so an absent optional capability
      degrades evidence without failing an unrelated required one.
      `verify:` a fixture declaring `browser.console.read` optional and
      `browser.screenshot` required produces `degraded`, not `failed`, when only
      console evidence is missing.

- [ ] **1.3 Add the evidence and constraint fields.**
      `verify:` a task can express "screenshot required, console preferred,
      personal-profile reuse forbidden, paid remote forbidden" and each of the
      four is machine-readable.

- [ ] **1.4 Add the vendor-coupling lint for domain workflows.** Exempt
      tool-specific skills, migration docs, and examples explicitly marked
      implementation-specific.
      `verify:` the lint is green on the tree as it stands, and a seeded
      violation (a domain skill naming a browser backend in a required position)
      exits non-zero.

## Phase 2 — Adapter manifest and the dispatchability probe

> **RESEQUENCED 2026-08-25 by the Step 0.3 disposition, and this is a real
> change rather than a note.** The general selector manifest **may not precede
> the Phase 3 caller**. Both council seats named the ordering unprompted — one
> calling the current shape *"the speculative-infrastructure mistake"*, the other
> requiring that *"Phase 3 caller evidence must demonstrate at least one real
> unavailability case before Phase 2 authors a general manifest"*.
>
> **What may still proceed here:** the capability contract, its conformance
> tests, and one explicit adapter. **What waits:** the manifest, the ordering,
> and any probe that selects.
>
> **The stop condition is part of the disposition, not a caveat.** If Phase 3
> produces no genuine runtime-unavailability case, the reach precedent controls
> and the selector work stops — an outcome one seat said should be *celebrated
> rather than treated as invalidation*, because it would mean cross-platform
> browser automation simply works through one adapter.
>
> **Build to the conservative intersection**, because the seats split on where
> the line sits and the evidence that would settle it does not exist yet:
> **binary eligibility only, no ranking among executable adapters, no preference
> metric anywhere in the selection path.** Detail and the recorded disagreement:
> `b-adr-212-declarative-routing`.

Proving adapters, four: existing project Playwright, playwright-cli, Playwright
MCP, and agent-browser (experimental). Stagehand and Browser Use are
deliberately excluded — both are semantic/agentic backends and fall under the
parked autonomy classes in Phase 6.

- [ ] **2.1 Define the adapter manifest.** Capabilities, transport
      (`library | cli | mcp | host-native | connector`), runtime modes
      (`project | local | container | remote | managed`), version constraints,
      evidence support, lifecycle behaviour.
      `verify:` all four proving adapters validate against one schema, and the
      schema rejects a manifest missing transport or runtime.

- [ ] **2.2 Cheap static availability probe.** PATH, dependency and
      MCP-registration checks only.
      `verify:` the probe launches no browser — a fixture run records zero
      browser processes spawned and completes inside the static-probe budget.

- [ ] **2.3 Compatibility and health probe, extending `ChannelStatus`.**
      `verify:` the wrong-version and broken-runtime fixtures resolve to
      distinguishable states, and every state emitted is a member of the
      extended enum rather than a new boolean.

- [ ] **2.4 Dispatchability proof.** A minimal safe no-op or seed action
      through the actual invocation lane, returning the normalized result.
      `verify:` the advertised-but-undispatchable fixture is rejected **before**
      selection, and the rejection names which condition failed.

- [ ] **2.5 Cache probe results with an explicit basis and freshness.**
      `static | live | cached`.
      `verify:` a stale cached `healthy` cannot authorize a high-impact
      operation — the fixture forces a live re-probe and the test fails if it
      does not.

## Phase 3 — The frontend proving vertical (moved ahead of the selector)

This phase runs **before** Phase 4 deliberately. See § Context: a selector with
no caller is the retired budget-routing shape. Here each dispatchable adapter is
invoked explicitly by the pilot, which is what produces both the caller and the
measurements Phase 4 consumes.

- [ ] **3.1 Convert the frontend review and evidence call site to
      capabilities.**
      `verify:` the call site contains no required backend name; a grep for
      Playwright, playwright-cli, MCP or agent-browser in the caller's required
      path returns zero hits.

- [ ] **3.2 Run the frozen 0.5 fixtures through every dispatchable proving
      adapter, named explicitly.**
      `verify:` each adapter produces the same required evidence contract on the
      same fixture, published with the fixture digest from 0.5.

- [ ] **3.3 Measure context/token and wall-clock differences, suite-owned.**
      External marketing numbers are not evidence.
      `verify:` the bench log records both arms with the fixture digest, and
      every figure is reproducible from a command in the log.

- [ ] **3.4 Record honest nulls.** If an adapter is not cheaper or not more
      reliable, publish that rather than defend it.
      `verify:` the published set covers every bar named in 0.6, with none
      missing and none present that 0.6 does not name.

- [ ] **3.5 Dispatchability negative control in the pilot.**
      `verify:` on the advertised-but-undispatchable fixture the pilot refuses
      before execution and an equivalent adapter completes the same contract.

## Phase 4 — The deterministic selector v0

Modelled on `judgment_ladder.ts`: a fixed priority order where the order is the
contract. No weighted score, at any phase.

- [ ] **4.1 Filter hard constraints first** — capability coverage, policy,
      trust, cost, privacy, compatibility, dispatchability.
      `verify:` an ineligible backend never reaches tie-breaking; a fixture
      asserts the ineligible candidate is absent from the tie-break input set,
      not merely ranked last.

- [ ] **4.2 Add the two task profiles** — deterministic verification,
      interactive inspection.
      `verify:` profile rules are explicit, versioned, and the version appears
      in the emitted reason codes.

- [ ] **4.3 Add dominance rules.** A dominates B when A satisfies the same
      required capabilities, provides at least the same evidence, uses no higher
      autonomy class, crosses no wider trust or cost boundary, and is
      equal-or-better on measured reliability and cost.
      `verify:` an equivalent-but-strictly-weaker candidate is eliminated with
      no numeric weight anywhere in the decision path.

- [ ] **4.4 Empirical tie-break from Phase 3 data only.**
      `verify:` the no-data path is deterministic and stable across two runs;
      the tie-break refuses to fire below the 0.6 sample threshold.

- [ ] **4.5 Emit decision reason codes.**
      `verify:` every selection is explainable from its reason codes alone,
      without the user being shown implementation detail by default.

## Phase 5 — The normalized execution and evidence envelope

- [ ] **5.1 Define the adapter-neutral result envelope.** Capability, adapter,
      version, transport, runtime, autonomy class, resolution source, attempts,
      fallback chain, artifact paths, verification state, degradation reason.
      `verify:` all four proving adapters emit one shape, validated against one
      schema.

- [ ] **5.2 Preserve tool-native artifacts by reference.** Large snapshots and
      traces stay on disk unless a consumer asks for them.
      `verify:` an envelope for a trace-producing run carries a path and not the
      trace body, and the context cost of reading the envelope is bounded.

- [ ] **5.3 Separate execution success from evidence success.** A click can
      succeed while the required screenshot fails.
      `verify:` that fixture reads `degraded` or `unverified`, never `success`.

- [ ] **5.4 Add the lifecycle and cleanup result.**
      `verify:` orphaned session or resource state is visible in the envelope,
      and the process tree is empty after the command exits.

## Phase 6 — Failure taxonomy, equivalent fallback, and the parked autonomy classes

- [ ] **6.1 Normalize the failure set** — `adapter_unavailable`,
      `adapter_unhealthy`, `adapter_undispatchable`, `capability_missing`,
      `launch_failed`, `navigation_failed`, `target_not_found`,
      `target_ambiguous`, `auth_required`, `network_blocked`,
      `evidence_incomplete`, `timeout`, `policy_denied`, `backend_bug`.
      `verify:` every fixture failure maps to exactly one member, and an
      unmapped failure fails the test rather than defaulting.

- [ ] **6.2 Map only safe equivalent fallbacks.** Implementation, transport or
      runtime may change while autonomy class, cost class, trust boundary,
      evidence completeness and authentication scope are preserved.
      `verify:` a fixture attempting `local -> paid remote` is refused as an
      ordinary retry and requires its own gate.

- [ ] **6.3 Add the transition and attempt ceiling.**
      `verify:` no fixture can construct an infinite fallback cycle; the ceiling
      is asserted by a test, not by inspection.

- [ ] **6.4 Adopt the deterministic autonomy class only; park the other two.**
      Adopted: `autonomy_class: deterministic` across all three resolution
      sources (`direct`, `discovered`, `cached`) — the draft's L0-L2, in the
      vocabulary v2 replaced them with. Parked: `semantic-single-step` and
      `agentic-subflow` (the draft's L3-L5), behind an explicit
      federation-shaped decision, **not** as an experimental tier.
      `verify:` the manifest schema rejects an adapter declaring a non-
      deterministic autonomy class, and blocker
      `b-adr-088-external-runtime-federation` reads open until that decision
      exists.

## Phase 7 — The runtime instruction contract

- [ ] **7.1 Support version-bound invocation instructions.** Candidate sources:
      an adapter-owned machine-readable schema, versioned `--help`, or a
      runtime-served tool help surface.
      `verify:` an instruction set is bound to an adapter version hash, and a
      version change invalidates it.

- [ ] **7.2 Treat external instructions as untrusted invocation data.** They may
      describe commands; they never override governance, safety, cost policy,
      evidence acceptance, merge authority, user intent or suite precedence.
      `verify:` a fixture whose help text contains an instruction-shaped
      directive is quarantined and surfaced, never executed.

- [ ] **7.3 Cache by adapter version hash and detect drift.**
      `verify:` a drifted adapter version produces a cache miss and a recorded
      drift event, not a stale hit.

## Phase 8 — Outcome telemetry, and no learning broker

The draft proposed a four-rung ladder ending in a bounded tie-break. Two rungs
land; two are parked. No defect in the tree names an outcome-learning broker,
and the weighted-fitness engine the analysis companion already rejected is
corroborated by the budget-routing retirement in § Context.

- [ ] **8.1 Record outcomes by adapter, version, host and task profile.**
      `verify:` a run appends one validated line per dispatch, and the record
      carries no free-form field capable of holding a prompt, a file body or a
      path.

- [ ] **8.2 Report reliability and cost distributions.**
      `verify:` the report is reproducible from the recorded lines alone.

- [ ] **8.3 Park the shadow-recommendation and broker-fitness-scoring rungs as
      null-until-need.**
      `verify:` no code path scores an adapter, and the park is recorded with the
      demand signal that would reopen it — a named defect, never two models
      suggesting it.

## Phase 9 — The generalization gate

Do not expand because capability names are cheap to invent.

- [ ] **9.1 Hold generality until every condition holds.** The browser vertical
      passes; at least two interchangeable transports pass one contract;
      fallback and evidence semantics are stable; one second non-browser domain
      with a **real recorded defect** and two actual implementations
      demonstrates the same abstraction; context and runtime cost stay inside
      suite budgets.
      `verify:` each of the five conditions has a citable artifact; a missing
      citation blocks the graduation rather than being argued around.

## Blockers

### blocker: b-reach-channels-precedent
- **Status:** resolved 2026-08-25 — **the reach precedent is TRANSFERABLE
  against speculative preference-routing and NON-TRANSFERABLE to caller-proven
  binary feasibility selection.** AI council 2/2 convergent.

  **Both seats REJECTED the distinctions this blocker offered as candidates**,
  which is the most useful part of the answer and the opposite of what the
  recommendation expected:

  - *"genuinely interchangeable on one protocol"* — **false as stated.**
    Playwright, Puppeteer, Selenium, WebDriver and CDP are not one
    interchangeable protocol. Wrapping unlike APIs behind one interface does not
    establish interchangeability; the roadmap must define its own capability
    contract and **prove adapter conformance**.
  - *"numeric and byte-comparable evidence"* — **not a categorical
    distinction.** Screenshots differ across engines, fonts, operating systems,
    timing and rendering pipelines. One seat: byte equality *"may test
    reproducibility without testing whether the requested browser task
    succeeded"*. The other: it *"measures reproducibility, not whether we should
    choose this adapter over that one"*.
  - *"a caller exists in Phase 3 before the selector"* — **the only one that
    distinguishes**, and it is decisive.

  **So the property is not "browser" and not determinism.** It is
  **semantics-preserving selection on demonstrated execution eligibility**, with
  a real caller supplying at least one observed unavailability case first.

  **Consequence for phase order, and it is a real change:** the general selector
  manifest may not precede the caller. Both seats named the sequencing
  explicitly — one calling the current order *"the speculative-infrastructure
  mistake"*. Phase 2's capability contract and an explicit adapter may proceed;
  Phase 2's general manifest waits on Phase 3 evidence.

  **The stop condition is recorded rather than left implicit:** if Phase 3
  produces no genuine runtime-unavailability case, the reach precedent controls
  and the selector work stops. One seat added that this outcome should be
  *celebrated rather than treated as invalidation* — if cross-platform browser
  automation simply works through one adapter, no selector is needed at all.

  **Scope, recorded so the disposition cannot later be read wider:** it permits
  selection among implementations conforming to ONE declared capability contract
  where binary execution preconditions make an implementation genuinely
  unavailable. It authorises no quality, latency, cost, historical-success or
  preference routing.
- **Owner:** AI council
- **Blocks:** Phase 0 Step 0.3, and transitively Phase 2 (no adapter manifest is
  authored before this is answered).
- **What to do:**
  1. Read `src/config/reach-channels.yml` (217 lines), its schema, and
     `src/scripts/reach_doctor.ts` (1651 lines). Together they already implement
     a capability-to-ordered-backend-candidates manifest with health probes and
     pinned installs — in another domain.
  2. Read that work's own recorded outcome: its Phase-0 pre-registered benchmark
     returned **`band: stop`** (native arm 12/12, reach arm 0 outright wins), so
     no router skill ships and no channel is routed, preferred, or suggested to
     an agent. The header also records the design intent that "BACKEND ORDER IS
     THE SWITCH... never editing code" — which is this roadmap's Phase 4 in
     another vocabulary.
  3. Read the second instance of the same shape:
     `agents/roadmaps/later/road-to-policy-evaluation-core.md`. Its gate (1)
     fired **against** the roadmap, and a 2026-07-28 council read the resulting
     null's root cause as a **category limit, not a bug**, recommending the
     roadmap be treated as approach-invalidated rather than unblocked.
  4. State what property of the browser vertical makes it not that result a
     third time. Candidate properties: the backends are genuinely
     interchangeable on one protocol; the evidence contract is numeric and
     byte-comparable rather than a retrieval ranking; a caller exists in Phase 3
     before the selector.
- **Recommendation:** answer it as a scoped distinction, not as a dismissal. The
  reach result is strong evidence about *retrieval* backends and weak evidence
  about *deterministic artifact producers* — but that distinction has to be
  stated and defended before the manifest is written, not after.
- **If you do nothing:** the third instance of a pre-registered manifest-plus-
  probe benchmark returns `stop`, and the roadmap discovers it in Phase 3 after
  Phases 1 and 2 are built.
- **Resolved when:** a dated council disposition names the transferable and
  non-transferable parts of the reach outcome, and Phase 0 Step 0.3's verify
  passes.

### blocker: b-requires-key-reserved
- **Status:** resolved 2026-08-29 — **(a): extend `runtime_requires` with an
  OPTIONAL capability member. Two of this blocker's own premises were false and
  are corrected below; the conclusion survives, the argument for it does not.**
  AI council 2026-08-29, anthropic + openai, **2/2 convergent**.

  **False premise 1 — "it is unused so there is no migration".** Verified this
  run: `runtime_requires` appears in the FRONTMATTER of four skills —
  `src/skills/adr-create/SKILL.md`, `src/skills/lint-skills/SKILL.md`,
  `src/skills/md-language-check/SKILL.md`, `src/skills/check-refs/SKILL.md`.
  That clause was the load-bearing half of the recommendation and it does not
  hold. What survives is a **different** argument, which both seats separated
  out explicitly: an **optional additive** member breaks none of those four, so
  the backward-compatibility conclusion stands on compatibility rather than on
  emptiness. The distinction matters for the next person who extends the key
  believing nothing consumes it.

  **False premise 2 — "the draft's generated root `CAPABILITIES.yaml`".** That
  file **already exists** at the repository root: 323 lines, header `GENERATED
  by generate_capabilities_index — do NOT hand-edit`, drift-checked in CI,
  landed in PR #1679. It is not the draft's file and cannot be dropped or
  renamed as if it were. **The established artifact is preserved**; the draft is
  the thing that must not collide with it, and any capability index this roadmap
  needs either extends `generate_capabilities_index` or takes a different name.
  Both seats converged on preserving it.

  **The schema constraint the blocker cites does hold** and is why a third key
  is refused: `skill.schema.json` records that `requires` is taken by ADR-015
  pack-dependency edges validated in `build_discovery_manifest.ts`, and reusing
  it makes every skill carrying one unassignable in the discovery manifest.

  **openai's addition, carried into 0.1:** the schema test that decides the
  member's shape is **required-versus-provided** capability semantics.
  `runtime_requires` states what a skill NEEDS; a capability member that quietly
  also declared what a skill PROVIDES would be two relations in one key, which
  is the collision this blocker exists to avoid, one level down.
- **`revisit-if`:** a fifth consumer of `runtime_requires` appears with a
  non-additive need, or a capability member turns out to require
  provided-semantics after all — at which point the third-key option is reopened
  with its reservation note.
- **Owner:** maintainer
- **Blocks:** Phase 0 Step 0.1, and transitively Phase 1.
- **What to do:**
  1. Read `src/scripts/schemas/skill.schema.json:45-89`. `runtime_requires`
     exists, is probeable, and is unused by any skill.
  2. Read the same schema's statement that `requires` is reserved for ADR-015
     pack-dependency edges, validated in `build_discovery_manifest.ts`, and that
     reusing it makes every skill carrying one unassignable in the discovery
     manifest.
  3. Decide: extend `runtime_requires` with a capability member, or name a third
     key deliberately with the collision reason recorded in the schema
     `$comment` the way the existing one is.
  4. Resolve the second collision in the same pass: the draft's generated root
     `CAPABILITIES.yaml`.
- **Recommendation:** extend `runtime_requires`. It is already the declared
  machine-readable prerequisites object, it is unused so there is no migration,
  and a third key would need its own reservation note explaining why two were
  not enough.
- **If you do nothing:** Phase 1 lands `execution.requires:`, and every skill
  carrying one becomes unassignable in the discovery manifest — the exact
  failure the schema documents.
- **Resolved when:** the chosen key exists in exactly one schema, is validated,
  and `CAPABILITIES.yaml` is either dropped or renamed away from the collision.

### blocker: b-adr-042-runtime-resolver
- **Status:** resolved 2026-08-25 — **OUT of ADR-042's scope for demonstrated
  execution gating only. Health-based prioritisation among executable adapters
  stays IN scope.** AI council 2/2 convergent, applying the ADR's own
  discriminator to the case rather than restating it.

  **Unavailable, enumerated as a closed set** — executable or required transport
  absent · platform or protocol version unsupported · mandatory credentials
  absent · a required browser feature not implemented. **De-prioritised** —
  capable but losing on order, latency, cost, quality, comparative health or
  historical performance.

  **The conflation both seats warned about, and it is the live risk here:** a
  probe that turns a working-but-degraded adapter into "unavailable" smuggles
  runtime ranking in through the definition. A transient probe failure
  establishes unavailability **only if the same condition would make the
  imminent invocation unable to execute**; a generic "unhealthy" score never
  does.

  **One seat qualified the blocker's own recommendation rather than adopting
  it:** *"no adapter means no capability"* does not by itself prove a runtime
  resolver is necessary — explicit configuration or build-time selection
  produces the same failure. What satisfies ADR-042's re-trigger is evidence
  that implementations **vary in availability at execution time** and static
  selection cannot handle that.

  **Authority boundary, stated by both:** this narrow classification is
  council-decidable. Redefining "unavailable" to include degraded, slower,
  costlier or less-preferred implementations would **weaken an accepted ADR**
  and returns to the owner under `decision-revisit-gate`.

  Also recorded: configuration may reference only implementations already
  admitted by a trusted code registry, never an arbitrary executable target —
  the config-to-execution trust boundary ADR-042 was written about.
- **Owner:** AI council
- **Blocks:** Phase 0 Step 0.2, and transitively Phase 4.
- **What to do:** read `docs/decisions/ADR-042-runtime-resolver-decision-gate.md`
  (`status: accepted`) — "**STOP.** Do not build a runtime pack resolver now",
  converged 3-round council 2026-06-03, on the grounds that a runtime resolver
  crosses a new config-to-execution trust boundary and adds a context-window tax
  with no evidence the problem exists. Then state whether an adapter selector
  for `browser.*` is inside that decision's scope. The ADR's own refinement is
  the discriminator: only an **execution-gating** need — implementations
  genuinely *unavailable*, not merely de-prioritised — would justify a resolver.
- **Recommendation:** argue it as outside scope on the execution-gating ground,
  since an undispatchable browser adapter is unavailable rather than
  de-prioritised — but argue it explicitly, and cite the ADR's re-trigger
  condition rather than asserting non-overlap.
- **If you do nothing:** Phase 4 builds a resolver against a live accepted STOP.
- **Resolved when:** a dated disposition records in-scope or out-of-scope with
  the ADR's own discriminator applied.

### blocker: b-adr-212-declarative-routing
- **Status:** resolved 2026-08-25 — **different class, but ONLY where adapter
  selection is semantics-preserving feasibility resolution.** AI council 2/2 on
  the disposition, with one **recorded disagreement on where the line sits**
  (below). ADR-212's quantified reopen is **untouched**.

  **The subject distinction alone does NOT clear ADR-212's anti-renaming bar,
  and both seats said so.** One put the test sharply: it is not *"are the
  subjects different"* but *"would this distinction prevent ANY subject from
  claiming exception?"* — if capability-to-implementation earns an exception,
  database drivers, HTTP clients and every plugin system claim the same one.

  **The bar that does clear it is SEMANTIC AUTHORITY, not subject.** Rule
  routing decides what instructions and policy reach a session and can therefore
  change intended behaviour. A qualifying adapter selector receives an
  already-declared capability and may only choose an implementation proven to
  satisfy that same contract. It may not choose the capability, alter its
  contract, load rules, change policy, or trade correctness for latency, cost or
  quality. **If choosing a different adapter observably changes contract-level
  semantics, those adapters are not interchangeable and runtime choice is a
  separate decision.**

  **RECORDED DISAGREEMENT — unresolved, and material to Phase 2's design.**
  Seat 1: *any* runtime choice among multiple eligible adapters is the same
  resolver class, so the manifest must be an **unordered registry with explicit
  caller selection** and a test must prove that changing manifest order cannot
  change which adapter executes. Seat 2: that *"would expand an ADR about
  rule-to-session routing into a universal prohibition on dispatch mechanisms"*
  — a **semantics-neutral tie-break** among conformance-tested equivalents is
  legitimate, and the danger is order **carrying behavioural preference** or
  equivalence being **asserted rather than tested**.

  Both agree on the conservative intersection, so Phase 2 builds to it and the
  tie-break question stays open until the conformance tests exist to make it
  answerable: **binary eligibility only, no ranking among executable adapters,
  no preference metric anywhere in the selection path.** A split is an
  escalation condition, not a verdict; this one is recorded rather than resolved
  because the evidence that would settle it does not exist yet.

  **The quantified reopen (>= 30 % of tier-2 rules failing their matrix floor) is
  untouched, and one seat added a clause the blocker did not ask for:** adapter
  eligibility, conformance and availability measurements **may not count toward,
  feed, or be cited as evidence satisfying that threshold**. Recorded, because
  that is exactly how an unrelated measurement ends up reopening a decision it
  has nothing to do with.
- **Owner:** AI council
- **Blocks:** Phase 0 Step 0.2, and transitively Phase 4.
- **What to do:** read
  `docs/decisions/ADR-212-declarative-routing-with-quantified-resolver-reopen.md`
  (`status: accepted`) — rule routing stays declarative, the layer-1 resolver was
  evaluated and **not built**, and the reopen is deterministic and quantified
  (>= 30 % of tier-2 rules failing their matrix floor), with the explicit
  consequence that "the resolver question stops recurring conversationally".
  State whether adapter selection is the same resolver class as rule routing.
- **Recommendation:** they are different subjects — that ADR governs which
  *rules* reach a session; this governs which *implementation* satisfies a
  declared capability. But ADR-212's closing consequence exists precisely to stop
  a resolver being re-proposed under a new name, so the distinction has to clear
  that bar in writing.
- **If you do nothing:** Phase 4 is the conversational recurrence ADR-212 closed.
- **Resolved when:** a dated disposition states the class distinction and
  confirms the quantified reopen is untouched by this work.

### blocker: b-adr-088-external-runtime-federation
- **Status:** open — **PARTIALLY RESOLVED 2026-08-29, and it is divisible. The
  parked half is closed by council; the browser-engine half is OWNER-RESERVED
  and no council may close it.** AI council 2026-08-29, anthropic + openai,
  **2/2 convergent on the split**.

  **Closed, council-decidable — the parked classes.** `semantic-single-step` and
  `agentic-subflow` are recorded as **parked and unavailable**, gated on a
  future federation ADR that does not yet exist and must answer ADR-088's
  questions on delegation, network, billing and orchestrator authority. This
  changes nothing about what may run and creates no external commitment;
  promoting either remains owner-reserved because it creates an external,
  billable, network-crossing commitment.

  **NOT closed, owner-reserved — the browser-engine classification.** Recording
  that the four deterministic browser-engine adapters are *"outside ADR-088's
  boundary"* is **not** a status-quo note. ADR-088 is `status: accepted` and
  states a **category** boundary — this package "does not bridge to, or drive,
  external tool runtimes" — so writing an exception to it narrows an accepted
  floor, and narrowing a floor is owner-reserved whatever its blast radius.

  openai caught the substitution that makes the exception look safe: the
  argument reads ADR-088 as barring *external **agent** runtimes*, while the ADR
  says *external **tool** runtimes*. "Local", "deterministic" and "delegates no
  decisions" genuinely distinguish browser engines from AI runtimes, and none of
  the three establishes that a browser engine is not an external **tool**
  runtime. Until that is clarified, the **conservative reading holds**: treat
  the four adapters as inside the literal boundary, which does not weaken
  anything, rather than outside it, which does.

  **What the council may do and did:** record the four adapters' factual
  properties and their existing adopted status. What it may not do, and did not:
  state that they fall outside ADR-088.

  **This blocker's original `Resolved when` is unsatisfiable by any council**,
  and that is why it is recorded here rather than quietly narrowed. It requires
  *both* halves — "records the deterministic class as outside the boundary with
  its reason, **and** the two parked classes as gated on a named federation
  ADR". One half is owner-reserved by its own subject matter. Amended below.
- **Resolved when:** *(AMENDED 2026-08-29 — the marker moved inside the value on
  purpose; see the note under this field.)* the parked half is already recorded
  above. The blocker closes when the owner either (i) confirms in ADR-088 or a
  clarifying ADR that deterministic, local browser engines were never within
  "external tool runtimes", or (ii) states that they are within it, at which
  point Phase 6's deterministic class needs its own disposition too.
- **`revisit-if`:** ADR-088 gains explicit browser-engine guidance, the owner
  provides a written interpretation of "external tool runtimes", or a federation
  ADR lands and clarifies the boundary retrospectively.
- **Owner:** maintainer
- **Blocks:** Phase 6 Step 6.4's parked half. Phases 0-5 and 7-9 proceed.
- **What to do:** read `docs/decisions/ADR-088-no-external-runtime-federation.md`
  (`status: accepted`) — this package "does not bridge to, or drive, external
  tool runtimes", stated as a **category** boundary, and "federation is a
  separate, explicit decision" requiring its own ADR. Then classify:
  1. The four adopted adapters drive browser **engines**, not external agent
     runtimes, so the deterministic class is argued as outside the boundary.
  2. `semantic-single-step` and `agentic-subflow` delegate decisions to external
     AI runtimes. That is inside the boundary, and it also touches
     orchestrator-only doctrine plus billing and network governance.
- **Recommendation:** keep the parked classes parked. Promoting them needs its
  own ADR answering ADR-088's questions, and it is owner-reserved: it creates an
  external, billable, network-crossing commitment.
- **If you do nothing:** a `semantic-single-step` adapter lands as
  "experimental" and the category boundary is crossed without the ADR ADR-088
  requires.

  **Why this field had a stale twin until 2026-08-29, and why removing it was
  not a formatting fix.** The 2026-08-29 amendment added a second
  `Resolved when` and left the original in place, three fields below, stating
  the opposite: that the blocker closes when *"a disposition records the
  deterministic class as outside the boundary"* — the very thing the amendment
  had just established no council may do. Two contradictory closure conditions
  on one blocker, and `lint_roadmap_blockers` was green throughout.

  It was green **because of** the stale line. Its check is
  `/^-[ \t]*\*\*Resolved when:\*\*/im`
  (`src/scripts/lint_roadmap_blockers.ts:52`) — a literal label. The amendment
  had written `**Resolved when (AMENDED 2026-08-29):**`, which does not match,
  so the field the reader was meant to follow did not satisfy the five-field
  contract at all, and the contradictory line was the only thing keeping this
  blocker legal. Deleting the stale line first would have turned the gate red;
  renaming the amended one first makes the deletion safe. Both are done here, in
  that order, which is why the marker now sits inside the value.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-24 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Third `band: stop` on a manifest-plus-probe benchmark | product | Two prior instances of this exact shape returned a null read as a category limit rather than a bug — the reach benchmark and the policy-evaluation core. A third would spend Phases 1-2 to learn it. | Blocker `b-reach-channels-precedent` is answered before any adapter manifest is authored, and must name a non-transferable property rather than dismiss the precedent. | Phase 0 — Step 0.3 |
| 2 | A second parallel router lands beside three existing primitives | implementation | `tool_probe.ts`, `reach_doctor.ts` and `judgment_ladder.ts` already carry the probe taxonomy and the priority-ordered resolver. A new module re-deriving them is the fourth classifier the ladder's own header forbids. | Step 0.4 requires a table naming each primitive with extend-or-not and a reason; the manifest schema is forbidden from re-declaring `ToolProbeStatus`/`ChannelStatus`. | Phase 0 — Step 0.4 |
| 3 | Selector built before its caller | implementation | The retired budget-routing contract is the measured instance: acceptance criteria pre-registered against a mechanism with no production caller, `session_tier` non-null in 0 of 327 records, dead code still in the tree. | Phase 3 precedes Phase 4 by construction, and 4.4's empirical tie-break can only consume Phase 3 measurements. | Phase 3 — before Phase 4 |
| 4 | The `requires` collision reaches the manifest | implementation | The schema states that reusing `requires` makes every skill carrying one unassignable in the discovery manifest, so the collision is silent at authoring time and structural at build time. | Blocker `b-requires-key-reserved` gates Step 0.1; Step 0.1's verify greps the reservation and asserts no new top-level `requires`. | Phase 0 — Step 0.1 |
| 5 | Autonomy escalation arrives as an experiment | product | A `semantic-single-step` adapter labelled experimental crosses ADR-088's category boundary, adds billing and network governance, and is hard to withdraw once a consumer depends on it. | Step 6.4 adopts only the deterministic class; the schema rejects a non-deterministic autonomy class while `b-adr-088-external-runtime-federation` is open. | Phase 6 — Step 6.4 |
| 6 | Capability namespace grows past its consumers | product | Capability names are cheap to invent, so the namespace outgrows the adapters that implement it and the roadmap reads as broader coverage than it has. | Step 1.1's verify fails a capability with no consumer call site or no implementing adapter; Phase 9 blocks generality on five citable artifacts. | Phase 1 — Step 1.1 |
| 7 | Evidence degradation reported as parity | product | An adapter that produces a screenshot but no console evidence can be recorded as satisfying the contract, which makes the whole benchmark unreliable in the direction that flatters it. | Step 5.3 separates execution success from evidence success with a fixture asserting `degraded`, never `success`; Step 3.4 publishes nulls against the 0.6 bar set. | Phase 5 — Step 5.3 |

## Acceptance Criteria

- [ ] AC-1 — A frontend workflow requests browser capabilities without naming a
      backend in any required position, and the vendor-coupling lint of Step 1.4
      is green on the tree.
- [ ] AC-2 — The declaration lands on the key resolved by
      `b-requires-key-reserved`, and no new top-level `requires` exists in any
      schema.
- [ ] AC-3 — Available, healthy and dispatchable are distinguishable states,
      expressed as members of the extended `ChannelStatus` enum rather than as a
      parallel boolean object.
- [ ] AC-4 — All four proving adapters — project Playwright, playwright-cli,
      Playwright MCP, agent-browser — validate against one manifest schema.
- [ ] AC-5 — At least two dispatchable adapters satisfy one browser evidence
      contract on the same frozen fixture, published with the 0.5 digest.
- [ ] AC-6 — The advertised-but-undispatchable fixture is refused before
      execution, in both the probe (2.4) and the pilot (3.5).
- [ ] AC-7 — Selection is a fixed priority order with no numeric weight anywhere
      in the decision path, and every selection emits reason codes sufficient to
      explain it.
- [ ] AC-8 — Phase 3's measurements exist and are published before any Phase 4
      empirical tie-break can fire; the no-data path is deterministic.
- [ ] AC-9 — Fallback cannot silently widen trust, cost, autonomy or evidence
      scope, and no fixture can construct an infinite fallback cycle.
- [ ] AC-10 — Runtime-loaded tool instructions are version-bound, drift-detected,
      and cannot override governance; an instruction-shaped directive in help
      text is quarantined.
- [ ] AC-11 — Telemetry records and reports only. No code path scores an
      adapter, and the parked scoring rungs name the defect that would reopen
      them.
- [ ] AC-12 — Only `autonomy_class: deterministic` ships. The two escalation
      classes stay gated on a federation ADR that does not yet exist.
- [ ] AC-13 — Generality beyond `browser.*` is blocked until Phase 9's five
      conditions each have a citable artifact.
- [ ] AC-14 — All five blockers read `Status: resolved` before any code in
      Phases 1-9 is authored.

## Corrections applied at landing (2026-08-24)

| What | Source draft | Landed as | Why |
|---|---|---|---|
| **Phase order** | Selector (Phase 3) before frontend pilot (Phase 5) | Pilot is Phase 3; selector is Phase 4 | `docs/contracts/budget-routing.md` was RETIRED 2026-08-16 by a 2-of-2 council because AC1-AC5 were "pre-registered against a mechanism with no production caller and no possible measurement basis, so they could never fire". `session_tier` was non-null in **0 of 327** records and `src/scripts/_lib/tier_budget_routing.ts` is still dead code. Building a selector before its caller is that failure by name. |
| Phase 1 anchor | A new `execution.requires:` field | Extends `runtime_requires`, per blocker `b-requires-key-reserved` | `src/scripts/schemas/skill.schema.json:45-89` already defines a probeable top-level `runtime_requires` with `bins`/`env`/`primary_env`/`network`, unused by any skill. The declarative surface ships; only the semantic layer above named binaries is missing. |
| `requires` as a key name | Proposed `execution.requires:` | Named as a merge-blocking collision, gated in Phase 0 | The same schema reserves `requires` for ADR-015 pack edges validated in `build_discovery_manifest.ts`, and states that reusing it makes every skill carrying one unassignable in the discovery manifest. The generated root `CAPABILITIES.yaml` is the second collision. |
| Phase 2 anchor | A new 7-field `dispatchable` boolean object | Extends the existing 7-state enum | `tool_probe.ts:59` ships `ToolProbeStatus` (5 states, hardened spawn, retry only on timeout, never throws); `reach_doctor.ts:104-110` extends it to `ChannelStatus` (7 states) so `missing` and `not-ready` are distinguishable. The draft cites neither file. |
| Selector anchor | No precedent cited | Cites `src/scripts/_lib/judgment_ladder.ts` | Its header states that the fixed priority order *is* the contract, so two signals matching the same text resolve deterministically. That is the precedent for an ordered filter over a weighted score. |
| Autonomy ladder | v1's L0-L5; v2 replaced it with three `autonomy_class` values | Adopt `deterministic` across all three resolution sources; park `semantic-single-step` and `agentic-subflow` behind a federation-shaped decision | **Vocabulary mismatch, recorded not papered over:** the landing brief specified "adopt L0-L2, park L3-L5", which is v1 vocabulary (`road-to-capability-native-execution.md:159-163` defines L0-L2 as deterministic action, deterministic discovery, cached action). v2 had already decomposed that ladder because it conflated caching with autonomy. The instruction is applied through v2's own axes; the mapping is stated so a reader can check it. |
| Semantic escalation | Phase 7, conditional "only if earned" | Folded into Step 6.4 and gated on `b-adr-088-external-runtime-federation` | ADR-088 states a **category** boundary and that "federation is a separate, explicit decision" needing its own ADR. "Only if earned" is a benchmark condition; this needs an authorization decision, and it is owner-reserved. Not shipped as an experimental tier. |
| Adapter set | Three (project Playwright, CLI, MCP) | Four, with agent-browser experimental; Stagehand and Browser Use excluded | The two excluded backends are semantic/agentic and fall under the parked autonomy classes, so admitting them would cross the ADR-088 boundary through the adapter list. |
| Outcome learning | Four-rung ladder ending in a bounded tie-break | Two rungs land (record, report); shadow recommendation and broker fitness scoring parked null-until-need | No defect in the tree names an outcome-learning broker. The weighted-fitness engine the analysis companion rejects is independently corroborated by the budget-routing retirement above. |
| Precedent blocker | None | `b-reach-channels-precedent` (owner: AI council) | `src/config/reach-channels.yml` (217 lines) + `reach_doctor.ts` (1651 lines) already implement a capability-to-ordered-candidates manifest with health probes in another domain, and its pre-registered benchmark returned **`band: stop`**. `later/road-to-policy-evaluation-core.md` is the second instance, where a council read the null as a category limit rather than a bug. |
| ADR classification | Assumed non-overlap | Three blockers, one per ADR (042, 212, 088) | Each is `status: accepted` and each has a discriminator the roadmap must apply rather than assert: ADR-042's execution-gating test, ADR-212's "the resolver question stops recurring conversationally", ADR-088's category boundary. |
| Risk table shape | No risk section | `## Risk Register` with the six-column house grammar and the `risk-review` marker | `src/scripts/lint_plan_risk_register.ts` requires the exact six-cell header; `Risk type` admits only `product` or `implementation` (`:288-293`). |
| Missing house sections | No `## Goal`/`## Context` in house shape, no Source line, no `## Blockers` | All present; every step carries a `verify:` line | House roadmap contract. |
| Frontmatter | `supersedes:` a file that is not in the tree | `estate_offset_exempt` with the offset-unavailability reason; `supersedes:` dropped | Nothing named in `supersedes:` exists under `agents/roadmaps/`, so the key would point at nothing. The one-in-one-out half fires on every added `road-to-*.md` whatever its status, and this run archived only `status: draft` roadmaps, which `collect()` never counted. |
| Landing HEAD | Pinned `d7072e910` (2026-08-23) | Anchors re-verified at worktree HEAD `fb06b65f1` | The pin is a day old and the landing worktree is not at the HEAD the brief named (`0f7c26ee9`); every file:line cited above was re-read at `fb06b65f1`. |
| Frontend consumer | `depends_on` a v2 frontend roadmap | No `depends_on`; the consumer's surviving phases are registered in two existing stubs | The frontend Draft C does not land. `agents/roadmaps/stubs/road-to-frontend-power-live-measurements.md` already carries its tiering phases as E1.5 and `stubs/road-to-frontend-power-detector-promotions.md` already carries its detector phases as E3.3, both verbatim and both with named producers. |
