---
complexity: lightweight
status: draft
parent_roadmap: road-to-injection-detector-wiring
execution:
  mode: phase-checkpoints
estate_offset_exempt: "Carried, not added, and the offset is exact: one roadmap out, one in. The Iron-Law-3 closure gate refuses to archive a roadmap with unresolved [~] items, and `road-to-injection-detector-wiring` is complete apart from the two Phase-3 steps this file carries — so its archival and this file are the two halves of one deferred-resolution change, and neither is coherent without the other. The move was not performed by this file's author: at authoring time the parent still carried a second open blocker sitting with the council. That blocker is now resolved — the council returned 2/2 and chose (b), leave ADR-123 section 2 standing — and the parent IS moved to archive/ in this same change, so the conditional this reason originally carried is discharged rather than pending: the offset is real and in the diff. This file also ships status: draft, so it charges no active_roadmaps until the flip to ready, which is the day the offset is a real decision rather than bookkeeping. Parking the two steps in later/ was rejected by the AI council (2026-08-22, 2/2): the estate register calls that burial, and the carried outcome is a security capability whose blocking dependency has just acquired a live owner."
estate_growth_exempt: "Growth is one open blocker and nothing else: b-per-turn-composite-ceiling, carried forward from the parent roadmap's b-pre-tool-turn-budget rather than newly discovered. While this file is status: draft the blocker is dormant and charges open_blockers nothing; it charges +1 on the day the maintainer flips this file to ready, which is the same posture the sibling carry roadmap records for its own blockers. The estate is not learning about a new gate either way — it is keeping a gate visible that the parent's archival would otherwise bury. Its owner is the composite-ceiling decision in `road-to-per-turn-hook-economy-carry`, owner-reserved by council verdict, so this is exactly the kind of decision the register exists to keep in front of the owner. No blocker was added, weakened, or resolved here; only where it is recorded changed."
---
# Road to MCP runtime integrity

> Third-party MCP tool definitions carry a recorded fingerprint, and a
> definition that changes after connection is surfaced before the tool runs
> again.

## Goal

A hash is recorded per connected third-party MCP tool definition, a change to a
recorded definition is surfaced, and the slot the check runs in was chosen by
measurement against a registered per-turn budget rather than by preference. If
the budget lands with no room for a pre-use check, the trade-off between
accepting first-call risk and provisioning budget is put to the owner — it is
never resolved by quietly shipping an after-the-fact variant.

## Why this file exists

Carried from `agents/roadmaps/archive/road-to-injection-detector-wiring.md` on
2026-08-22 by a 2-of-2 AI council verdict, which chose **carry into a named
follow-up** over restoring the steps in place, merging them into other active
work, or escalating to the owner — and ranked this item first of four parked
items, because it is a security capability whose blocking dependency has just
acquired a live owner. Both seats reached that independently.

The parent roadmap is complete apart from two `[~]` steps, and the Iron-Law-3
closure gate refuses to archive a roadmap with unresolved deferred items. The
original park was decided by a single executing agent because the council had
**0 of 2 seats** at the time (both members at their request ceiling). A council
with 2 of 2 seats reviewed that park on 2026-08-22 and replaced it with this
carry. The parent is archived in the same change, so the estate offset is exact:
one roadmap out, one in.

The two steps stop being parked here. They are open work gated by one blocker,
which is a different state from deferred — a reader can see what closes them.

## What the tree has today

Verified against this worktree while authoring, and two facts in the parent's
prose had drifted.

**Runtime rug-pull and tool-shadowing detection: still absent.**
`src/scripts/lint_mcp_config_security.ts` reads shipped **config** for
supply-chain smells — a real inline secret value, `npx -y` auto-install,
unpinned server versions, `autoApprove` / `enableAllProjectMcpServers`, a
`0.0.0.0` binding, shell metacharacters in args, omnibus scopes. Its own header
names rug-pull as the threat class it is scanning config *for*, and it never
sees a tool description change after connection. `src/scripts/audit_mcp_tools.ts`
is an inventory generator: it reads `src/scripts/mcp_server/consumer_tool_catalog.json`
plus the handler registry and emits `docs/contracts/mcp-tool-inventory.md` for
**this package's own** consumer tool catalog, not a third-party integrity
monitor. `src/skills/agent-security-review/SKILL.md` names MCP tool-poisoning
and rug-pull as a review lens a human invokes; a review lens is not a runtime
check. Nothing else in `src/` or `agents/` matches the threat at all.

**Drift 1 — the per-turn composite row already exists.** The parent's blocker
said the dependency was a step "registering a per-turn composite row" in
`src/config/hook-latency-budget.json`. That registration has landed:
`per_turn_composite` is in the file with a `definition`, an `arming_procedure`
and an `arming_precondition`. What is missing is the **ceiling** — the row
carries `observe_only: true` and `p50_ci: null`, so it gates nothing and cannot
fail a build. The dependency is therefore arming, not registering.

**Drift 2 — the owning step is renumbered, and it is not the whole story.** The
parent named "step 4.2 of `road-to-per-turn-hook-economy`". That roadmap is
archived and its two deferred items were themselves carried into
`agents/roadmaps/archive/road-to-per-turn-hook-economy-carry.md`, where the arming step
is **A2.1** ("Set `p50_ci` and flip `observe_only` to false"). The config's own
note still calls this "the whole of step 4.2", which is where the old id
survives. A2.1 is additionally gated by that roadmap's `b-composite-ceiling-value`,
which both council seats placed with the owner, and it is preceded by Phase A1
there — because the arming precondition (">= 10 CI gate readings of the
composite, from at least 2 distinct runner sessions") currently **cannot be
evaluated at all**: the bench prints the composite and stores nothing.

**The slot arithmetic, unchanged.** A check that must run before a tool call
belongs in `pre_tool_use`, whose budget row is `p95_ci: 175` and whose measured
readings in this tree are **141–148 ms** — roughly 27–34 ms of headroom. The cap
derivation block in the same config records a wider real spread (p50 111–148 ms
across runner classes, with a max that may exceed 157 ms and is unrecorded), and
that cap was itself re-derived after the gate flapped on unchanged code. The
slot already carries 11 to 13 concerns depending on the resolved role. No
per-turn composite ceiling is armed, so a new per-call concern added today is
added against no enforced per-turn number at all.

## Phase 1 — Fingerprint third-party MCP tool definitions

Both steps are gated by `b-per-turn-composite-ceiling`. They are open work, not
deferred work: the blocker names what closes them.

**PARKED 2026-08-23 by AI council, 2 of 2 convergent (verdict (b3)), and the
park is recorded rather than silent.** Neither step is started. The council
refused both shortcuts — the after-use variant (Risk 1: a coverage claim the tree
cannot support) and provisioning `pre_tool_use` without an armed ceiling (slot
erosion the ceiling exists to prevent) — and required the disposition to state
plainly that **rug-pull protection remains absent and the protection level is
zero**. The full reasoning, both seats' disagreement, and the named collection
milestone are at the blocker below.

- [ ] **1.1 Fingerprint store for third-party MCP tool definitions.** <!-- blocked-by: b-per-turn-composite-ceiling -->
      Record a stable hash per connected third-party tool definition — name,
      description, input schema — and surface a mismatch against the recorded
      value. The store is keyed by server plus tool name so a renamed tool reads
      as a new tool rather than as an unchanged one, and a first sighting is
      recorded rather than reported. Scope is third-party servers only: this
      package's own consumer catalog is already covered by
      `src/scripts/audit_mcp_tools.ts` and duplicating it would produce two
      sources of truth for the same tools.
      verify: `npx vitest run tests/scripts/mcp_tool_fingerprint.test.ts` passes
      with a case where a changed description yields a mismatch, a case where an
      unchanged definition yields none, and a case where a first sighting is
      recorded silently.
- [ ] **1.2 Choose the slot by measurement, not by preference.** <!-- blocked-by: b-per-turn-composite-ceiling -->
      Measure the added p95 of a fingerprint lookup in `pre_tool_use` against
      the armed per-turn composite ceiling, and record the reading. A
      fingerprint comparison is nominally an O(1) hash lookup, and nominal is
      not measured — the slot readings above are dominated by spawn and bundle
      load rather than by concern work, so the question is whether one more
      concern's work fits inside the headroom that remains after the composite
      is armed. A number that does not clear the armed ceiling is a finding that
      routes to the blocker's escalation path, never a reason to loosen a
      budget.
      verify: `test -f agents/evidence/reports/mcp-fingerprint-slot-measurement.md`
      and the file states the measured added p95, the composite value it was
      measured against, and the armed `p50_ci` it was compared to.

**Exit criteria.** A test asserts mismatch, no-mismatch and first-sighting
behaviour; the measurement report exists and names its three numbers.
**Rollback.** Remove the fingerprint module, its test and its manifest entry;
nothing else in the tree reads the store, so the revert is local to this phase.

## The no-silent-downgrade rule

The original park kept an alternative on the table: a `post_tool_use` or
session-start fingerprint check that never runs per tool call, and therefore
detects a mutated tool definition **after** first use rather than before it. The
council ruled that this is **not equivalent protection**, and it may never be
substituted silently.

The reason is the threat, not the latency. For a tool with irreversible side
effects — a file write, a network call, credential use — detecting a rug-pull
after the first execution is too late; the damage is done and the fingerprint
mismatch is a post-mortem rather than a control.

So this roadmap binds itself: if the per-turn ceiling arms **without** room for
a pre-use check, or arms and the measurement in step 1.2 shows a hash lookup
cannot fit, the trade-off — accept first-call risk, or provision budget for the
check — is escalated to the owner as its own decision. This roadmap does not
quietly build the post-use variant instead. The variant stays a legitimate
option; what is forbidden is choosing it without the owner recording that they
chose it, because the choice gives up protection against exactly the class of
tool the check exists for.

## Blockers

### blocker: b-per-turn-composite-ceiling
- **Status:** open
- **Owner:** the composite-ceiling decision in
  `agents/roadmaps/archive/road-to-per-turn-hook-economy-carry.md` — its step **A2.1**
  and the blocker `b-composite-ceiling-value` that gates it, which both council
  seats placed with the owner independently.
- **Blocks:** Phase 1 entirely — both steps. Nothing else in this roadmap is
  startable, which is why the file carries no unblocked phase.
- **What to do:** pick exactly one — (a) wait for A2.1 to set a numeric
  `p50_ci` for `per_turn_composite` in `src/config/hook-latency-budget.json` and
  flip `observe_only` to false, then scope Phase 1 against the armed number.
  Note that A2.1 is itself gated: Phase A1 of that roadmap has to build the
  reading store first, because the arming precondition cannot be evaluated
  today; or (b) escalate the trade-off named in
  `## The no-silent-downgrade rule` — accept first-call risk with an after-use
  check, or provision budget for a pre-use check — as its own owner decision,
  recorded before any code lands.
- **Recommendation:** **option (a) — wait, and the wait is now bounded.** The
  parent roadmap parked this against an owner-less dependency; that dependency
  now has a named step, a named gating blocker, and a `status: ready` roadmap
  around it as of 2026-08-22, which is the state change that turned a park into
  a carry. Option (b) is the honest escape if the wait proves indefinite, and it
  is deliberately shaped as an escalation rather than as a build.
- **If you do nothing:** the capability stays absent while the threat stays
  named in a review skill nobody runs per tool call, and the next reader meets a
  second park with no record of why the first one was reopened.
- **Resolved when:** `per_turn_composite` in
  `src/config/hook-latency-budget.json` carries a numeric `p50_ci` and
  `observe_only: false` — or option (b) is recorded at this blocker with the
  owner's chosen side of the trade-off.
- **Disposition 2026-08-23 — option (a) kept, the wait recorded, and the
  collection milestone named. AI council 2026-08-23, 2 of 2 seats present
  (anthropic/claude-sonnet-4-5, openai/codex-default), both convergent on (b3),
  $0.041.** The response artefact is deliberately NOT linked: it lives under the
  gitignored, auto-pruned council output tree, so a link from a stable artefact
  would rot — the convergence summary is inlined below instead, which is what
  `no-roadmap-references` § council clause requires. Status stays **open**
  deliberately: this
  discharges AC-4's first clause — the blocker carries a recorded option — and
  the roadmap stays `status: draft`, charging no active slot.

  **MCP runtime rug-pull protection remains explicitly absent. No prevention and
  no detection is shipped; the current protection level is zero.** That sentence
  is the council's own required wording and it is here rather than paraphrased,
  because Risk 1's failure mode is a *silent* one — a tree gaining a coverage
  claim it cannot support.

  **Why (a) is unreachable now rather than refused.** A2.1 of
  `road-to-per-turn-hook-economy-carry` is a MAINTAINER ACT gated by
  `b-composite-ceiling-value`, whose own *"What to do"* reads *"name the `p50_ci`
  ceiling … **once A1.3 publishes the distribution**"*. Phase A1 does not exist —
  the bench prints the composite and stores nothing — and the row's
  `arming_precondition` needs **≥ 10 CI readings from ≥ 2 distinct runner
  sessions**, which accumulate over a release cycle. No verdict and no agent
  action produces them now.

  **Why not (b1) — build the after-use variant.** Both seats refused it. One:
  post-use detection is *"detection archaeology, not runtime integrity"* for a
  tool with irreversible side effects, and shipping it under this roadmap's title
  is Risk 1 exactly. The other **disagreed** that MCP tools are *fundamentally*
  irreversible — many are read-only, so late detection has real value — and still
  refused, because *"shipping under a 'runtime integrity' roadmap while leaving
  first-call irreversible actions exposed creates a more dangerous ambiguity than
  explicitly retaining zero coverage."* That disagreement is recorded rather than
  smoothed over: it is the strongest argument for (b1) and it lost on framing,
  not on value.

  **Why not (b2) — provision the pre-use slot without an armed ceiling.** The
  27–34 ms headroom is unreliable: the derivation block records a real p50 spread
  of 111–148 ms and an unrecorded max that may exceed 157 ms, and this cap was
  already re-derived once after the gate flapped on unchanged code. One seat put
  the systemic cost plainly — bypassing capacity discipline "because this one is
  important" weakens slot integrity **everywhere**, not only here.

- **The collection milestone — added by the council, and it is the load-bearing
  half of this disposition.** One seat's refinement: *"(b3) needs an actionable
  collection milestone, not merely a distant revisit condition, or it becomes the
  indefinite park identified by Risk 2."* Agreed and named:

  > **Milestone: Phase A1 of `road-to-per-turn-hook-economy-carry` is built** —
  > A1.1 persists every CI composite reading with its runner identity, A1.2
  > answers the arming question as a predicate, A1.3 publishes the distribution.
  > That is what starts the clock the `arming_precondition` counts, and it is
  > **unblocked buildable work today** (`b-composite-ceiling-value` blocks A2.1
  > only, by its own `Blocks:` line).

  Without that milestone this park has no mechanism, which is precisely Risk 2.
  With it, the wait is bounded by a build plus a release cycle rather than by
  nobody's attention.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-22 | reviewer: ai-council -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The after-use variant ships as if it were equivalent protection | product | A `post_tool_use` or session-start check is cheaper and unblocked by the budget dependency. It is also the wrong control for a tool with irreversible side effects: it reports a rug-pull after the write has happened. The failure mode is silent — the capability appears delivered and the tree gains a claim it cannot support | The no-silent-downgrade rule makes the substitution an owner decision rather than an implementation choice; AC-3 refuses a post-use variant that ships without a recorded trade-off | The no-silent-downgrade rule |
| 2 | This file becomes an indefinite park under a new name | product | The carry is only better than the park if the dependency actually moves. Its owning step is itself gated by a precondition that cannot currently be evaluated at all | The blocker's `Resolved when` is a checkable config state rather than a judgement call; option (b) is written into the blocker as the bounded escape and names the escalation instead of a build | Blockers |
| 3 | The lookup is assumed cheap and lands in the tightest slot on that assumption | implementation | A hash comparison is nominally O(1) — and the slot readings are dominated by spawn and bundle load rather than by concern work, so nominal cost predicts nothing about the reading. Assuming it fits is how the flap that forced the cap re-derivation comes back | Step 1.2 makes the slot decision a measurement with three named numbers in a report; a number that misses the armed ceiling routes to the blocker rather than to a budget change | Phase 1 — Fingerprint third-party MCP tool definitions |
| 4 | The store fires on legitimate tool updates and trains the reader to ignore it | implementation | Third-party servers update their tool descriptions for benign reasons. A check that reports every change with the same weight as a rug-pull produces noise, and noise on a security surface is worse than silence because it is read as coverage | Step 1.1 records a first sighting silently and keys the store by server plus tool name, so a rename reads as a new tool rather than as a mutation; the mismatch report is a surface for a decision, not a verdict | Phase 1 — Fingerprint third-party MCP tool definitions |

## Acceptance Criteria

- [ ] AC-1 — a fingerprint store records a stable hash per connected
      third-party MCP tool definition, and a test asserts all three behaviours:
      a changed definition yields a mismatch, an unchanged one yields none, and
      a first sighting is recorded without a report.
- [ ] AC-2 — `agents/evidence/reports/mcp-fingerprint-slot-measurement.md`
      exists and states the measured added p95, the composite value it was
      measured against, and the armed `p50_ci` it was compared to. The slot was
      chosen from those numbers.
- [ ] AC-3 — no `post_tool_use` or session-start fingerprint variant ships
      unless the owner-recorded trade-off from
      `## The no-silent-downgrade rule` is present at
      `b-per-turn-composite-ceiling`, naming which side was chosen and why.
      Falsified by a merged after-use check with no such record.
- [x] AC-4 — `b-per-turn-composite-ceiling` carries a recorded option, or Phase
      1 is untouched and the blocker is still open with its dependency named —
      a carried item whose gate is visible and checkable is a discharged
      obligation; one that has quietly become a second park is not.

      **Met 2026-08-23 on BOTH clauses.** The blocker carries a recorded option
      (a-kept, via council verdict (b3), 2 of 2 convergent), Phase 1 is untouched,
      and the dependency is named down to the step that gates it and the
      precondition that gates *that*. The clause about "quietly become a second
      park" is answered by the named collection milestone: Phase A1 of
      `road-to-per-turn-hook-economy-carry`, which is unblocked buildable work and
      is what starts the reading clock.
