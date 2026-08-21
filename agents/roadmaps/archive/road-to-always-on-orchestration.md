---
complexity: structural
status: ready
---

# Road to always-on orchestration — subagents, council, and team stop being features and become how this suite works

> Doctrine change, decided by the repo owner (recorded in the consumed inbox
> source below; this roadmap does not relitigate it): subagents, council, and
> team are no longer opt-in capabilities behind settings. They are ALWAYS
> AVAILABLE; the decision of WHEN moves into a classifier-gated judgment
> layer — telemetry-calibrated, per-trigger falsifiable, removable by
> evidence-bearing PR, never by settings flag. Default-off survives where it
> belongs — spend caps for metered transports, plan-quota caps, privacy and
> egress switches, destructive-action gates, and one audited INCIDENT
> kill-switch — and dies on activation. Transport doctrine, equally owner-set:
> CLI first, API second, only where no CLI exists.
>
> Why: the five-transcript evidence behind the carriers roadmap showed what
> settings-gated delegation produces — every fresh install shipped the entire
> orchestration layer dead, and sessions ran ~99 % serial into 582k/887k-token
> contexts with zero neutral reviews. The measured outcome of "the user may
> switch it on" is that nobody does.

> Source (consumed inbox): `agents/tmp.old/team-subagents.txt` (2026-08-09) —
> two draft roadmaps plus the owner's doctrine directive, built on a survey of
> eight external systems. Per source-confidentiality the externals are
> referred to here as Sources A–H; the mapping stays in that local-only file.
> Every load-bearing claim in the drafts was re-verified against the current
> tree and the current host documentation before this roadmap was cut (two
> verification agents, 2026-08-09); the corrections are recorded in the
> Context section — five of the drafts' claims were wrong or stale.

> Council provenance (inline per no-roadmap-references): 2026-08-09, members
> anthropic/claude-sonnet-4-5 + openai/gpt-4o, prompt mode, $0.12 actual.
> The doctrine itself was fixed as owner input; challenged was the cut.
> Convergent verdict adopted here: (1) resequence — infrastructure, teardown,
> classifier, and transport-default now; telemetry-CONSUMING behaviour
> (release-gate council auto-dispatch, stop-block, ladder calibration) only
> after an accumulation window, as gated blockers; (2) the deletion boundary
> keeps ONE audited incident kill-switch ("on by default, flip only during
> incident response, re-enable requires recorded justification" — the
> enforcement difference that keeps it from being an activation gate under a
> new name) and keeps `ai_team.allow_delegate` (authorization — write-access
> grant — not activation); (3) quorum for n=2 is 1-of-2, and an inconclusive
> pass at a release gate HOLDS the gate, never degrades to advisory.

## Goal

A fresh install of this suite on any host delivers a working orchestration
stack with zero configuration: capabilities are probed at runtime instead of
declared in settings, one committed judgment ladder decides in-session vs
subagent vs team vs council per task shape, council members ride vendor CLIs
by default (API fallback, honest ∅), and every layer's effect is measured —
falsifiability moves from "whether enabled" to "when invoked and did it
help", with registered metrics and per-trigger kill criteria written down
before any behaviour data exists.

## Outcome (closed 2026-08-20 — read this before the phase checkboxes)

```
ARCHIVED DOES NOT MEAN ACHIEVED.
ONE STEP AND FOUR BLOCKERS LEFT THIS ROADMAP BECAUSE THIS REPOSITORY
CANNOT PRODUCE THE EVIDENCE THEY REQUIRE.
A TRANSFER IS A RECORDED RELOCATION OF UNFINISHED WORK, NOT A RESULT.
```

**The count, with its denominator named** — two true numbers circulate here and
a reader comparing them would otherwise think one is wrong. Counting the two
prerequisites plus the 36 phase steps: **37 of 38 landed, 1 transferred**. The
dashboard counts phase steps only and reports **35 done, 1 cancelled of 36** at
100 %, because `[-]` is the glyph for a step that will not be done here, so a
transferred step reads as `cancelled` in that view. Neither number counts the
seven acceptance criteria, and the 100 % says nothing about the goal — see
§ Against the goal, honestly.

Closed by the autonomous drain run of 2026-08-20 under the council record
[`drain-blocker-dispositions-b`](../evidence/council/drain-blocker-dispositions-b.md)
(2026-08-20, anthropic/claude-sonnet-4-5 + openai/codex-default, quorum 2/2).
Outcome states are the four that record defines: `satisfied`, `narrowed`,
`transferred`, `abandoned`.

| Phase | Outcome | What that means here |
|---|---|---|
| 1 — settings teardown | **satisfied** | All six steps landed, contract before code. The activation keys are gone and `lint_no_activation_gates` makes their return a CI failure — green over 137 template leaves, self-test 7/7. |
| 2 — one judgment ladder | **satisfied** | One committed table plus `judgment_ladder.ts` replaced three scattered classifiers; precision registered as a metric with kill/tighten paths. This run **added** to the same table: the `CV-1`/`CV-2` cross-vendor entries. |
| 3 — CLI-first transport | **satisfied** | Both transport implementations reconciled, defaults flipped, quorum majority with absentees recorded — verified in two real passes, each naming every member's transport. |
| 4 — verdict handoff | **satisfied for what it scoped; one item transferred** | 4.1 (handoff envelope) and 4.2 (doc repair) landed. 4.3 was *written as* a deferral rather than as work, and the blocker it deferred to is now a stub. |
| 5 — team readiness | **narrowed** | 5.1–5.3 landed (spike script, ADR-109 contract line, AGENTS.md obligation without the unverified mechanism claim). **5.4 transferred** — the experimental host flag is unset, third dated reading. |
| 6 — the measurement | **satisfied** | Metrics and per-layer kill/tighten criteria registered. Worth noting against the roadmap's own premise: they are **no longer pre-data** (below). |
| 7 — what this will not do | **satisfied** | All five negative statements re-verified 2026-08-20. 7.3's two deferred items now have stubs rather than open blockers. |

### The five blockers

| Blocker | Disposition | Outcome | Went to |
|---|---|---|---|
| `cross-vendor-worker-slices` | D — decided | **satisfied** | Nowhere — shipped here: [`docs/contracts/cross-vendor-worker-direction.md`](../../docs/contracts/cross-vendor-worker-direction.md) + the two citing entries |
| `team-telemetry-behind-flag` | B | **transferred** | [`stubs/road-to-team-telemetry-behind-flag.md`](stubs/road-to-team-telemetry-behind-flag.md) |
| `f4-full-stop-block` | B | **transferred** | [`stubs/road-to-f4-full-stop-block.md`](stubs/road-to-f4-full-stop-block.md) |
| `gate-council-auto-dispatch` | B | **transferred** | [`stubs/road-to-gate-council-auto-dispatch.md`](stubs/road-to-gate-council-auto-dispatch.md) |
| `point-of-action-carrier` | B | **transferred** | [`stubs/road-to-point-of-action-carrier.md`](stubs/road-to-point-of-action-carrier.md) |

Every transfer carries the three-point integrity check the disposition
framework requires: the original `Resolved when` criterion **verbatim**, the
complete list of dependent steps moved, and a **named** re-entry producer with
a detection probe. Four stubs for four blockers — merging was considered and
refused, because the two host-probe cases probe different mechanisms against
different telemetry streams and the council assigned them separate producers.

### Against the goal, honestly

The Goal has four clauses. Three are achieved and one is not:

- *"zero configuration … capabilities probed at runtime instead of declared in
  settings"* — **achieved**, verified live against a 0-byte settings file.
- *"one committed judgment ladder"* — **achieved**.
- *"council members ride vendor CLIs by default"* — **achieved**, with the
  degradation graded and the transport named per member in the artifact.
- *"every layer's effect is measured — falsifiability moves from 'whether
  enabled' to 'when invoked and did it help'"* — **not achieved, and not
  transferable to a stub either.** The metrics and kill criteria are
  *registered*; no layer has yet been *judged* against one. "Did it help" is
  answerable now in a way it was not when this was cut, and nobody has
  answered it.

### What changed under the roadmap while it ran

The Context section states flatly: *"Telemetry accumulation is zero. F6/F4
shipped yesterday. Every calibration-consuming step is therefore a gated
blocker, not a phase."* Measured 2026-08-20, that premise no longer holds —
**554 lines carrying an `orchestration` block (553 with `spawn_count > 0`) and
121 `quorum_result` events**, plus 9 `exact` `review_skipped` lines. Two
consequences, and they point in opposite directions:

1. `gate-council-auto-dispatch` is the one transferred blocker whose gate has
   **measurably moved**; its stub records the numbers so the next reader can
   tell movement from noise rather than re-deriving both halves.
2. Volume is not a verdict. 121 attendance records include **17
   solo-concluded passes** — Risk 6 (majority at n=2 is a single voice) is now
   visible in data rather than argued in prose, and still nothing gates on the
   rate. A stub keyed on "the window opened" would be a parking lot; each stub
   is keyed on its probe instead.

### The one thing this closure does not settle

Four stubs is four pieces of specified, sequenced work now sitting outside the
active estate. The disposition framework's own residual applies: a transferred
item can become an indefinite deferral, and only a re-entry probe reading
positive — or a registered honest null closing it — discharges that. Two of the
four carry such a null already (`point-of-action-carrier`'s "no discriminator
is publishable"; `gate-council-auto-dispatch`'s "auto-fire adds nothing and the
gate stays recommend-only"). The other two do not, and that is the honest
statement of what is still owed.

## Prerequisites

- [x] #1223/#1224 on main (carriers, telemetry, hardening) — verified at
      merge-base 1d28cea51.
- [x] Owner sign-off on the settings-classes reclassification — the doctrine
      directive in the consumed source explicitly orders the settings
      deletion; the contract change ships FIRST inside Phase 1, never as a
      silent violation.

## Context (verified against tree + host docs 2026-08-09, do not relitigate)

- **The transport chain exists and is opt-in.** `transport_resolver.ts`
  implements cli → api → ∅ with billing classification
  (`environment_detector.classifyBilling`: vendor CLI under subscription
  login = subscription-billed; community wrappers stay per-token). But the
  LIVE council path resolves modes through a second implementation
  (`modes.ts::resolve_mode`, defaults `api`/`manual`) — a default flip must
  reconcile the two, not just flip a constant.
- **The necessity classifier exists** (off|educate|block|warn-only, default
  educate, user-global council config) and folds into the ladder as rung-4
  input rather than remaining a separate decision surface.
- **`classifyTask` has a shipped production caller** (delegation-nudge hook).
  A judgment-ladder construct is NEW; five prose "ladders" already exist in
  the tree, so the construct gets one unambiguous name (`judgment ladder`)
  and a committed table.
- **The telemetry reader half of "outcome-fed" already exists** —
  `orchestration_savings.ts` aggregates per-tier outcomes with honest-null
  gates. What is missing is consumers citing it, not the reader.
- **Draft corrections (five):** the `self-review-gate-cost` blocker is
  already RESOLVED (2026-07-10) — what remains is wiring, not unblocking; an
  "agent-switch managed statusline" does not exist (the drafts' HUD phase has
  no substrate — cut); `road-to-cross-provider-review` does not exist (the
  drafts' cross-vendor phase cited a phantom policy artefact — deferred to a
  blocker); `cost_budget`/`cli_call_budget`/council `mode` live in the
  user-global council config, not `.agent-settings.yml`; the subagent-v1
  contract is ADR-109 + schema (no `skills`/`mcpServers` fields exist there
  at all — `additionalProperties: false`).
- **Host facts (docs-verified):** agent teams remain EXPERIMENTAL behind
  `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS`; `TaskCreated`/`TaskCompleted`/
  `TeammateIdle` hook events exist and are block-capable; a subagent
  definition run as a teammate honours `tools` + `model` but NOT
  `skills`/`mcpServers`; "delegate mode" is NOT in official docs (third-party
  reports only — doctrine on it waits for verification); stop-hook
  `decision: block` + reason is documented to continue the conversation, and
  `additionalContext` on Stop IS documented at exit 0 (better than the
  carriers roadmap assumed); `stop_hook_active` is absent from current docs —
  any stop-block needs a self-built session-scoped loop guard; the upstream
  request for agent identity in PreToolUse is closed NOT_PLANNED (the drafts'
  watch-blocker on it is dead), while the per-agent-permission bug is closed
  COMPLETED with unverified scope — a live probe beats waiting on issues.
- **Telemetry accumulation is zero.** F6/F4 shipped yesterday. Every
  calibration-consuming step is therefore a gated blocker, not a phase.
- **Anonymisation is mandatory.** source-confidentiality forbids naming the
  surveyed externals in tracked artifacts; two of their tokens are already
  in the denylist. This roadmap uses Sources A–H throughout.

## What the survey contributes per layer (verdicts, anonymised)

| Idea | Source | Verdict |
|---|---|---|
| Tier 0 below every model: mechanical slices resolve to deterministic scripts, not spawns | A (meta-harness) | KEEP → Phase 2 rung 0 |
| Committed cheapest-sufficient-model decision table, escalation criteria named | B (doctrine suite) | KEEP → Phase 2 table |
| Quorum conclusion k-of-n instead of all-must-answer; absentees recorded | A (one of five protocols; only quorum transfers) | KEEP → Phase 3 |
| Verdict→handoff envelope: council output becomes the implementing agent's machine-readable work order | G (CLI-bridge tool) | KEEP → Phase 4 |
| Pre-authenticated provider CLIs discovered from environment, env keys as fallback | F (multi-CLI wrapper) | KEEP → Phase 3 (is our resolver, shipped as default) |
| Point-of-action pre-tool-use carrier + escalation ladder | E (hook plugin), H (pattern writeup) | DEFER → blocker (needs telemetry + main/sub discrimination spike) |
| Stop-slot block/reprompt for continuation | D (multi-instance topology), F | DEFER → f4-full blocker (loop guard must be self-built) |
| Structural lead/worker capability split | C (container product), D | DEFER → team blockers (experimental flag; "delegate mode" unverified) |
| Teammate false-completion reports ("the report is the interface, not the verification") | field report | KEEP → Phase 5 artifact-check spike shape |
| Swarm topologies, queens, consensus beyond quorum, neural routing, bidding | A | CUT — solves a 100-agent problem we measurably do not have |
| Auto-rollback of agent output | A | CUT — destructive, threshold unfalsifiable |
| HUD statusline metrics | F | CUT — no statusline substrate exists in this suite |

## Phase 1 — settings teardown, contract first

- [x] 1.1 Update `docs/contracts/settings-classes.md` FIRST: remove the
      class-C rows for the deleted keys below; `ai_team.enabled` loses its
      seat (its "authorises paid external CLI calls" rationale is dissolved
      by CLI-first billing classification — the cap that replaces it is the
      council-side `cost_budget`/`cli_call_budget`); `ai_team.allow_delegate`
      KEEPS its row (authorization: write-access grant, not activation).
- [x] 1.2 DELETE from the template + all readers: `subagents.enabled`,
      `subagents.auto`, `subagents.host_capabilities`,
      `subagents.budget_routing`. Readers (`auto_dispatch.ts` activation
      gate, `delegation_nudge_hook.ts` resolveActivation, routing_doctor)
      switch to: probe/registry for capability, always-on for activation,
      judgment ladder for routing. `classifyTask`'s `auto` parameter and
      `ask` action collapse accordingly (ambiguous stays `ask` as a VERDICT
      to the user, but there is no `off`).
- [x] 1.3 DELETE `ai_team.enabled`; team availability = host flag probe
      (experimental env flag present) — a fact, not a setting.
- [x] 1.4 ADD the audited incident switch `emergency.orchestration_halt`
      (default absent = running): flipping it on requires no ceremony
      (incidents are urgent); flipping it back OFF requires a
      `justification:` string alongside it. Documented as incident-response
      only, in settings-classes.md, with the activation-gate distinction
      stated — and with the enforcement stated honestly: the settings file
      is hand-edited YAML with no machine on the write path, so the
      disarm-justification rule is a MODEL-CARRIED convention
      (`enforced_by: none`), not a checked gate; transition telemetry is
      deferred until a write path exists.
- [x] 1.5 Lint `no-activation-gates`: CI fails on any future settings
      boolean whose only semantics is "is this orchestration layer on"
      (heuristic: key matches enabled/auto under subagents/ai_team/council
      namespaces; allowlist for the emergency switch).
- [x] 1.6 Migration: removed keys are ignored with a one-line deprecation
      warning naming this roadmap; no silent behaviour change without a
      visible line.

**Exit:** `.agent-settings.yml` can be empty and the stack activates; the contract changed before the code.
**Rollback:** git revert; the template history carries the old keys.

## Phase 2 — one judgment ladder instead of three scattered classifiers

- [x] 2.1 The ladder as a committed decision table in the delegation-policy
      context AND one resolver (`judgment_ladder.ts`) wrapping
      `classifyTask`:

      | Rung | Shape signals | Resolves to |
      | --- | --- | --- |
      | 0 | mechanical transform, no semantics | deterministic script, no spawn |
      | 1 | single bounded read-heavy slice | one subagent, lite tier |
      | 2 | enumerable independent slices | parallel subagents, downshifted |
      | 3 | slices that must communicate | team (only when host flag present; else degrade to rung 2 with a recorded downgrade line) |
      | 4 | judgment under disagreement | council |
      | ∅ | interactive-approval-required, trivial, ambiguous | in-session; ambiguity is an `ask` verdict, never a speculative spawn |

- [x] 2.2 Rung-3/4 signals with the same regex-only discipline as the
      F3-lite extractor; the necessity classifier's council triggers fold in
      as rung-4 inputs (its own modes stay as the council-side surface).
- [x] 2.3 Recursive-dispatch guard: subagent/teammate session lineage
      resolves ∅ for rungs 1–4 — test-gated.
- [x] 2.4 The delegation-nudge line cites the rung ("rung-2: dispatch N lite
      slices"); the committed cheapest-sufficient-model table (escalation
      criteria: failed first attempt, 5+ files, architecture, security)
      lands in the delegation-policy context as the tie-breaker the ladder
      cites.
- [x] 2.5 Ladder-precision metric REGISTERED now (verdict vs what the
      session did, from F6 + future team telemetry), review window and
      per-rung kill/tighten paths written down before data exists.

**Exit:** one table answers "why did the suite delegate/team/council this"; precision is a registered metric with a review date.
**Rollback:** resolver sits behind the existing classifier interfaces.

## Phase 3 — CLI-first shipped as the default transport, quorum-resilient

- [x] 3.1 Reconcile the two transport implementations: `modes.ts::resolve_mode`
      and `transport_resolver.resolveTransport` must produce the same chain
      for `auto`; then flip the shipped defaults (`config.ts` mode default
      `api` → `auto`; `modes.ts` DEFAULT_MODE stays `manual` only for the
      no-config-at-all rung, or flips with a recorded reason — implementer
      verifies which default the live path actually observes). `manual` and
      pinned `api`/`cli` remain valid per-member overrides.
- [x] 3.2 Degradation is graded, never silent: the artifact header names
      each member's transport; a member with no CLI and no key is recorded
      `absent` with reason.
- [x] 3.3 Quorum: a pass concludes on k-of-n (default: majority, which is
      1-of-2 at n=2 — council-verified choice; 2-of-2 is a deadlock
      generator); below quorum the pass is `inconclusive`, and at a release
      gate inconclusive HOLDS the gate for a human, never degrades to
      advisory. Attendance is telemetry.
- [x] 3.4 `cli_call_budget` gets per-provider defaults (plan-quota
      protection is the one remaining brake on unmetered council frequency —
      present, generous, measured); quota exhaustion is a visible probe
      state that degrades to quorum paths, never to uncapped metered API.

**Exit:** on a host with logged-in vendor CLIs a full pass costs $0.00 metered and the artifact proves each member's transport; a missing binary degrades the pass instead of killing it.
**Rollback:** per-install `defaults.mode` pin.

## Phase 4 — verdict handoff + the wiring the resolved blocker was waiting for

- [x] 4.1 Verdict handoff envelope: council verdict artifacts gain a
      machine-readable `handoff` block — decision, rejected alternatives
      with reasons, binding constraints — injectable as the dispatched work
      order of an implementing subagent. Deliberation output becomes
      execution input without a human transcription step.
- [x] 4.2 Fix the stale narrative line in the bus-factor roadmap that still
      says Phase 1 is blocked on `self-review-gate-cost` (resolved
      2026-07-10) — one-line doc repair found during verification.
- [x] 4.3 Release-gate council AUTO-DISPATCH is NOT in this PR — it consumes
      transport-soak + telemetry that do not exist yet. It moves to blocker
      `gate-council-auto-dispatch` with its enabling conditions written
      down (council-mandated sequencing).

**Exit:** a council verdict can be dispatched, not just read; the auto-fire decision has a blocker with preconditions instead of a hope.
**Rollback:** envelope is additive to the artifact schema.

## Phase 5 — team readiness: verify first, doctrine second

- [x] 5.1 Spike (host-flag-gated, skipped cleanly when the experimental flag
      is absent): observe `TaskCreated`/`TaskCompleted`/`TeammateIdle`
      payloads on a real host and record the shapes — host_semantics
      discipline; these are documented but unobserved by this repo.
- [x] 5.2 Document in ADR-109's contract surface: a definition run as a
      teammate honours `tools` + `model` but NOT `skills`/`mcpServers`
      (docs-verified) — agents whose correctness depends on a skill surface
      must not be team-dispatched until upstream closes the gap; the rung-3
      resolver checks this property.
- [x] 5.3 AGENTS.md team obligation names the lead-coordinates doctrine
      WITHOUT the unverified third-party "delegate mode" claim — the
      structural restriction becomes doctrine only after the 5.1 spike (or a
      host doc) verifies the mechanism exists.
- [-] 5.4 Full team telemetry concerns + TaskCompleted artifact-check
      ("the report is the interface, not the verification" — a teammate's
      confident completion report is counted, checked against the declared
      deliverable, never adopted unverified) → blocker
      `team-telemetry-behind-flag`, keyed on the experimental flag and the
      5.1 payload evidence.
      <!-- TRANSFERRED 2026-08-20 (council disposition B, outcome
      `transferred`) → stubs/road-to-team-telemetry-behind-flag.md: the
      experimental host flag is unset on this host for the third dated reading
      (2026-08-09, 2026-08-13, 2026-08-20), so the payload evidence this step
      binds concerns to cannot be produced here at all. NOT done. -->

**Exit:** everything teams need from us that does not depend on the experimental flag is shipped; everything that does is a blocker with its evidence requirement named.
**Rollback:** doc lines.

## Phase 6 — the measurement that replaces the switch

- [x] 6.1 Registered metrics, committed before behaviour data exists:
      dispatch rate per delegable verdict; ladder precision (2.5); council
      fire rate + unactioned-verdict rate; per-session quota burn per
      provider; metered-fallback spend (target: trends to ~0 on CLI hosts).
- [x] 6.2 Registered kill/tighten criteria PER LAYER: the doctrine (always
      available) is fixed; every trigger inside it is falsifiable and
      individually removable — by evidence, in a PR, never by a settings
      flag. Unactioned-verdict rate is the council-trigger kill criterion.

**Exit:** "did always-on help" is a set of numbers with owners, not a vibe.
**Rollback:** n/a (registrations).

## Phase 7 — what this roadmap will not do

- [x] 7.1 No swarm topologies, queens, bidding, neural routing, consensus
      protocols beyond quorum (two surveys behind this verdict now).
      <!-- verified 2026-08-09: grep over src/scripts/*.ts finds no such
      construct — the only hit is lint_never_silent.ts PROSE that forbids it. -->
- [x] 7.2 No auto-rollback of any agent's output.
      <!-- verified 2026-08-09: zero auto-rollback hits in src/scripts. -->
- [x] 7.3 No hard tool-deny on the main session and no point-of-action
      pre-tool-use ladder yet — both wait on the discrimination spike and
      telemetry (blockers below).
      <!-- verified 2026-08-09: hook_manifest.yaml pre_tool_use chains carry
      only the pre-existing guards (block-no-verify, block-unauthorized-git,
      evidence-independence, block-kernel-rule-writes, block-config-weakening,
      rtk-wrap, design-slop, code-graph-nudge) — no delegation carrier, no
      escalation ladder. -->
- [x] 7.4 No statusline/HUD work — no substrate exists; revisit only if one
      lands.
      <!-- verified 2026-08-09: no statusline/HUD surface in src/scripts;
      the one grep hit is an unrelated `statusLines` local variable. -->
- [x] 7.5 No new settings beyond the emergency switch; the lint makes this
      a property, not a promise.
      <!-- verified 2026-08-09: lint_no_activation_gates green over the
      137-leaf template; self-test proves red on subagents.enabled /
      subagents.auto / council.enabled / ai_team.auto fixtures (7/7). -->

## Blockers

> **All five entries below are RESOLVED by the autonomous drain run of
> 2026-08-20** — four by transfer to a stub, one by shipping the artefact it
> was waiting for. The resolving mechanism is the council record
> [`drain-blocker-dispositions-b`](../evidence/council/drain-blocker-dispositions-b.md)
> (2026-08-20, anthropic/claude-sonnet-4-5 + openai/codex-default, quorum 2/2 —
> merged to main via PR #1463, so the citation resolves and no longer needs the
> reference-exemption marker it carried while it was branch-local). Each entry keeps its original
> `What to do` and `Resolved when` text unedited — those are the history a
> future reader needs — and records the resolution beneath them.
>
> **A transfer is not an achievement.** Four of these five moved because this
> repository cannot produce the evidence they require. See § Outcome.

### blocker: gate-council-auto-dispatch

- **Status:** resolved — transferred (council 2026-08-20, disposition B)
- **Owner:** maintainer
- **Class:** 2 — consent-once
- **Blocks:** auto-firing the council at the release-gate escalation
- **What to do:** after Phase 3 has soaked (transport reconciliation
  verified in real passes) and the F6/F4 + council-attendance telemetry has
  a usable window, wire the gate escalation to dispatch the pass itself
  (quorum rules from 3.3; inconclusive holds). Guards named by council:
  loop protection, metered-fallback cap via `cost_budget`, latency budget,
  unactioned-verdict kill criterion (6.2).
- **Resolved when:** the wiring lands citing the soak evidence, or the
  telemetry says auto-fire adds nothing and the gate stays recommend-only.
- **Resolution (2026-08-20):** disposition **B — transferred**, outcome state
  `transferred`. Council rationale: auto-dispatch changes external behaviour
  and cannot precede verified reconciliation soak or a usable benefit/risk
  window. Moved to
  [`stubs/road-to-gate-council-auto-dispatch.md`](stubs/road-to-gate-council-auto-dispatch.md)
  with the criterion above copied verbatim, the five dependent items
  enumerated, and a named re-entry producer (gate-autonomy maintainer) plus
  probe (dated soak report + telemetry query against pre-registered minima).
  **Probe measured today:** 121 `quorum_result` events and 553 dispatch lines
  in the gitignored runtime logs — this is the ONE transferred blocker whose
  gate has measurably moved, since the roadmap was cut on the premise that
  "telemetry accumulation is zero". The soak half is still unverified and the
  minima are still unwritten, so the transfer stands.

### blocker: point-of-action-carrier

- **Status:** resolved — transferred (council 2026-08-20, disposition B)
- **Owner:** maintainer
- **Class:** 2 — consent-once
- **Blocks:** any pre-tool-use mid-session delegation carrier + escalation
  ladder (Sources E/H harvest)
- **What to do:** run the main-vs-subagent discrimination spike (upstream
  closed the identity request as NOT_PLANNED; the per-agent-permission fix
  landed with unverified scope — probe a real host). No discriminator → the
  carrier ships only with scope reduction (source-file writes above a size
  threshold, generous exemptions) or not at all. Pre-registered null: "no
  discriminator" is publishable and does not block this roadmap.
- **Resolved when:** the spike note exists and the build/no-build decision
  cites it plus the F3-lite adoption telemetry.
- **Resolution (2026-08-20):** disposition **B — transferred**, outcome state
  `transferred`. Council rationale: a repository-only inference cannot
  establish main-agent versus subagent identity on the real host. Moved to
  [`stubs/road-to-point-of-action-carrier.md`](stubs/road-to-point-of-action-carrier.md)
  with the criterion above copied verbatim, the four dependent items
  enumerated, and a named re-entry producer (maintainer with a real
  multi-agent host session) plus probe (paired main/subagent traces
  publishing a separation result or a measured null). **Probe not locally
  measurable, and that is the finding:** the ladder's own contract surface
  already records that no field in this repository's hook envelope carries
  session lineage, which is why the recursive-dispatch guard is a
  caller-supplied fact rather than an env probe. The pre-registered null ("no
  discriminator is publishable") stands and remains the likely outcome after
  the upstream NOT_PLANNED close.

### blocker: f4-full-stop-block

- **Status:** resolved — transferred (council 2026-08-20, disposition B)
- **Owner:** maintainer
- **Class:** 2 — consent-once
- **Blocks:** single-shot stop-block continuation for the end-review
  obligation
- **What to do:** carried from the carriers roadmap, upgraded by two
  verified facts: `additionalContext` on Stop IS documented at exit 0 (the
  advisory path may already reach the model — verify live first), and
  `stop_hook_active` is gone from the docs, so the loop guard must be a
  self-built session-scoped marker (the end-review once-per-session state is
  the template). Calibrate the threshold on `review_skipped` telemetry
  (`exact` lines only).
- **Resolved when:** live delivery evidence exists and the block/advisory
  decision cites the telemetry distribution.
- **Resolution (2026-08-20):** disposition **B — transferred**, outcome state
  `transferred`. Council rationale: the block/advisory decision depends on
  real-host delivery behaviour and a telemetry distribution not present in the
  repository. Moved to
  [`stubs/road-to-f4-full-stop-block.md`](stubs/road-to-f4-full-stop-block.md)
  with the criterion above copied verbatim, the four dependent items
  enumerated, and a named re-entry producer (maintainer running the supported
  host) plus probe (captured model-visible canary + dated telemetry report).
  **Probe measured today:** the telemetry half is no longer empty — 9
  `review_skipped` lines, ALL `mutation_measure: exact`, `diff_lines` 243 to
  1770. Nine points spanning that range have no usable shape and every one is
  a skip (no contrast class), so they cannot fix a threshold; the canary half
  is untouched at zero. Both halves are needed, so the transfer stands.

### blocker: team-telemetry-behind-flag

- **Status:** resolved — transferred (council 2026-08-20, disposition B)
- **Owner:** maintainer
- **Class:** 3 — human-only (a host flag that does not clear by waiting on this host)
- **Blocks:** Phase 5.4 (team telemetry concerns, TaskCompleted
  artifact-check)
- **What to do:** when the experimental flag is on in a real environment,
  run the 5.1 spike, then bind the concerns with the same fail-open
  discipline as the #1223 set.
- **Resolved when:** payload evidence exists and the concerns ship, or
  teams leave the experimental state and this re-cuts.
- **Probed 2026-08-09:** `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` is unset on
  this host — condition unchanged, 5.4 stays open.
- **Re-probed 2026-08-13:** still unset (`env | grep -i EXPERIMENTAL` returns
  nothing). Four days, no change. Recorded rather than left silent because the
  absence of a dated line is indistinguishable from nobody having looked — but
  the repetition is also the finding: this blocker does not clear by waiting on
  this host, so 5.4's realistic paths are an upstream flag flip or the "teams
  leave the experimental state" branch already named in the resolution clause.
- **Re-probed 2026-08-20:** still unset (`env | grep --line-number
  EXPERIMENTAL_AGENT_TEAMS` returns nothing; the variable is absent from the
  environment). Third dated reading, eleven days across the three. The
  inference the second reading drew is confirmed rather than revisited.
- **Resolution (2026-08-20):** disposition **B — transferred**, outcome state
  `transferred`. Council rationale: no instrument can produce the required
  payload evidence until the experimental surface is active in a real
  environment. Moved to
  [`stubs/road-to-team-telemetry-behind-flag.md`](stubs/road-to-team-telemetry-behind-flag.md)
  with the criterion above copied verbatim, the five dependent items
  enumerated (Phase 5.4, the observation half of 5.1, payload classification,
  concern binding, re-cut decision), and a named re-entry producer (maintainer
  of a flag-enabled environment) plus probe (flag-state check, then captured
  `TaskCompleted` payload fixtures). A fourth reading of the same unset value
  would add nothing, which is the argument for a probe-keyed stub over an open
  step that re-reads an unchanging environment.

### blocker: cross-vendor-worker-slices

- **Status:** resolved — satisfied (council 2026-08-20, disposition D; policy shipped)
- **Owner:** maintainer
- **Class:** 2 — consent-once
- **Blocks:** routing ordinary work slices to second-vendor CLI workers
  (huge-context analysis, independence-critical review — Source G shape)
- **What to do:** the drafts cited a direction-policy artefact that does not
  exist; before any cross-vendor worker ships, write the direction policy
  (which vendor may review which, what may be sent — extending the existing
  egress discipline), then add the two resolver entries (report-only
  workers).
- **Resolved when:** the policy artefact exists and the resolver entries
  cite it.
- **Resolution (2026-08-20):** disposition **D — decided**, outcome state
  `satisfied`. The two council seats diverged and were **merged, not picked**:
  one approved report-only workers under a deny-by-default policy, the other
  required the direction policy to exist first. The adopted disposition is the
  conjunction — write the policy, then approve report-only workers under it —
  and both halves shipped in this change, because both are ordinary repository
  work with no external dependency:
  - **Policy artefact:** [`docs/contracts/cross-vendor-worker-direction.md`](../../docs/contracts/cross-vendor-worker-direction.md)
    — deny-by-default; two permitted directions stated as **role pairs, never
    vendor names** (per `subagent-routing` § Why vendor-neutral); exhaustive
    payload allow list (tracked repository text, bundler-redacted artefacts)
    and deny list (secrets, credentials, personal data, raw confidential
    evidence, privileged material); report-only capability boundary; a
    no-recursion clause; and the human egress gate that
    `lethal-trifecta-guard` and `subagent-boundary` already own.
  - **The two resolver entries:** `CV-1` / `CV-2` in the ladder's committed
    table ([`auto-dispatch-classification`](../../src/agent-src/contexts/execution/auto-dispatch-classification.md)
    § Cross-vendor worker direction), each citing the policy.
  - **What did NOT ship, stated so the `satisfied` is not read too widely:**
    no cross-vendor worker dispatch path. `classifyLadder` carries no vendor
    identity by design, nothing reads `CV-1`/`CV-2` at runtime, and the
    policy's own enforcement section says `enforced_by: none` rather than
    implying a gate on code that does not exist. The criterion asked for the
    artefact and the citing entries; that is exactly what exists. The phantom
    reference the original survey cited is what this closes.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-20 | reviewer: claude/host -->
<!-- Re-read on closure 2026-08-20, not restamped. Three rows changed on
     evidence (2 and 6 moved from argued to measured; 7's holder changed from
     an open blocker to a stub) and one row was ADDED (9) for a risk this
     closing change itself introduces. Rows 1, 3, 4, 5, 8 were re-read and
     are unchanged: their mitigations shipped in Phase 1/3 and nothing in the
     drain touched them. -->
| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Always-on burns plan quota (unmetered is not free) | product | Subscription CLIs have real limits; an always-available council can exhaust a plan silently | `cli_call_budget` per-provider defaults (3.4) are the one remaining brake; quota exhaustion is a visible probe state degrading to quorum paths, never to uncapped metered API | Phase 3 |
| 2 | The judgment ladder over-fires and becomes the canary at system scale | product | A classifier that fires on every prompt is the cosmetic-injection failure this repo already measured at 24/29 misses | Silence/∅ is a first-class verdict at every rung; per-rung precision metric with pre-registered kill/tighten criteria (2.5, 6.2); the nudge layer keeps its conditional-injection shape. **Re-read 2026-08-20: the mitigation is no longer pre-data.** 554 lines carrying an `orchestration` block (553 with `spawn_count > 0`) accumulated in the gitignored audit log, so per-rung precision is now computable where this row was written assuming zero. It has not been computed, and the registered kill/tighten criteria have not been applied to it — the risk is unchanged in kind and now falsifiable in practice | Phase 2 |
| 3 | Deleting activation keys breaks readers that silently assumed them | implementation | `auto_dispatch`, the nudge hook, routing_doctor and tests read `subagents.*` today; a missed reader turns always-on into always-crash | 1.2 enumerates the reader migration as part of the step itself; the hook suite + registry parity tests gate the PR; every hook stays fail-open on every path | Phase 1 |
| 4 | The incident switch becomes an activation gate under a new name | product | One boolean that turns the stack off is exactly what the doctrine deletes | Council-specified enforcement difference: on-by-default, audited transitions, justification required to re-enable, incident-response documentation only (1.4); the no-activation-gates lint allowlists exactly this one key | Phase 1 |
| 5 | Transport reconciliation picks the wrong implementation under load | implementation | Two resolve paths exist; flipping the default against the dead one produces nondeterministic member transports | 3.1 makes reconciliation the step, not a footnote; the pass artifact names each member's transport (3.2) so a mismatch is visible in the first real run | Phase 3 |
| 6 | Quorum 1-of-2 lets one model wave through what two should judge | product | Majority at n=2 is a single voice | Council-weighed trade-off: the alternative (2-of-2) deadlocks a release gate on any timeout, and inconclusive-holds keeps the human in the loop. Absent members are artifact-visible (`orchestrator.ts` renders `_render_quorum_line` / `_render_absent_members`, `session.ts` serialises the quorum) **and, since `events_log.ts` schema v2, log-visible**: both `evaluateQuorum` sites emit a `quorum_result` event carrying `status` / `threshold` / `total` / `present` / `solo_concluded` / `absent[]`, so a solo-concluded pass is no longer downstream-identical to a full-attendance one. What the telemetry does **not** do is act: nothing gates on the rate, and the solo-attendance floor stays an open blocker (`road-to-inbox-harvest-2026-08-b.md` — `quorum-solo-floor`) precisely because a floor cannot be chosen before real passes accumulate. Metrics registered in `src/config/quorum-attendance-budget.json`. **Re-read 2026-08-20 — this risk has MATERIALISED and is measured:** 121 `quorum_result` events carry attendance `present=2` in 94, `present=1` in **17**, `present=0` in 9, `present=3` in 1. So 17 passes concluded on a single voice, which is exactly the shape this row predicted. The mitigation stands as written (inconclusive-holds keeps the human in the loop, absences are artifact- and log-visible) and its stated limit also stands: nothing gates on the rate, and the solo-attendance floor is still an open blocker on another roadmap because a floor cannot be chosen before real passes accumulate. They have now begun to | Phase 3 |
| 7 | Team doctrine built on an unverified third-party mechanism | product | "Delegate mode" exists only in third-party writeups; doctrine naming it would claim what no official doc backs | 5.3 ships the obligation without the mechanism claim; the mechanism enters doctrine only after the 5.1 spike or official docs verify it. **Re-read 2026-08-20: the mitigation holds and its holder changed.** 5.4 is transferred to `stubs/road-to-team-telemetry-behind-flag.md`, so the verification gate now lives in that stub's re-entry probe rather than in an open step here. The load-bearing property is unaffected — no shipped doctrine names the unverified mechanism — but the risk is now held by a stub, which is a weaker holder than an open step and is recorded as such rather than presented as closed | Phase 5 |
| 8 | The doctrine deletes a safety property caps do not cover | product | Owner directive removes switches wholesale; a missed safety semantics would ship unguarded | Council question 6 returned none beyond the incident switch; privacy/egress switches, destructive gates, spend and quota caps all survive by name (1.2–1.4); the settings-classes contract change is reviewed before code (1.1) | Phase 1 |
| 9 | The cross-vendor direction policy authorises an egress class that did not previously have one | product | Closing `cross-vendor-worker-slices` ships a policy that names sending tracked repository text and redacted artefacts to a SECOND vendor as permitted-in-principle. Before it, no artefact said that was allowed; a written permission is easier to over-read than an absence, and the two symmetric directions compose into an unbounded review-of-review chain if read carelessly | Deny-by-default with an EXHAUSTIVE two-member permitted set and an exhaustive payload deny list (secrets, credentials, personal data, raw confidential evidence, privileged material — each restating an existing floor rather than re-deriving it); report-only capability boundary (no write, no commit, no action); an explicit no-recursion clause (one hop, always); and the human egress gate restated from `lethal-trifecta-guard` and `subagent-boundary` — direction permitted + payload allowed + human approved, any one missing = may not send. **The honest limit:** the policy ships `enforced_by: none` and says so in its own text. No dispatch path exists, so there is no call site to instrument, and the first shipped worker path is where a payload classifier in front of the send becomes the gate. Until then this row is the record that a permission was written before a mechanism existed | Phase 2 |

## Acceptance criteria

- [x] A fresh install with an EMPTY `.agent-settings.yml` resolves
      spawn-capable on this host (probe/registry), and the judgment ladder
      returns a verdict for a probe task — no activation key exists to set.
      <!-- verified 2026-08-09, live probe against a scratch dir with a
      0-byte .agent-settings.yml: loader returns an object; the shipped
      template enumerates 137 leaves with ZERO matching
      (subagents|ai_team|council).(enabled|auto); probeHostCapabilities
      ('claude') → subagent_spawn=true from the registry; classifyLadder on a
      3-independent-files probe task → {rung: 2, verdict: "subagent",
      mode: "do-in-parallel"}. -->
- [x] The settings-classes contract contains no row for a deleted key, keeps
      `ai_team.allow_delegate`, and documents the emergency switch with the
      incident-response semantics.
      <!-- verified 2026-08-09: zero table rows for deleted keys;
      ai_team.allow_delegate row present (C, false); emergency switch has its
      own § plus two C rows incl. the justification field. One drift found
      and fixed in the same change: the "governs writes, not asks" paragraph
      still cited the deleted subagents.auto/budget_routing as live ask-enum
      carriers ("six" → "four"). -->
- [x] `no-activation-gates` lint is green on the tree and red on a fixture
      reintroducing `subagents.enabled`.
      <!-- verified 2026-08-09: tree run green over all 137 template leaves
      (dead scan root would exit 1); --self-test 7/7 — subagents.enabled,
      subagents.auto, council.enabled, ai_team.enabled, ai_team.auto all
      reject with exit 1; vitest suite 4/4. -->
- [x] The ladder's committed table and the cheapest-sufficient-model table
      are in the delegation-policy context; the nudge line cites a rung.
      <!-- verified 2026-08-09: auto-dispatch-classification.md carries the
      rung table (lines ~69-76) and the escalation-criteria tier table
      (~118-124: verify-fail, ≥5 files/200 lines, architecture, security —
      exactly step 2.4's four criteria); delegation_nudge_hook.ts renders
      `rung-N: dispatch …` in its injected line. -->
- [x] A council pass on this host runs CLI-first with the reconciled chain,
      names each member's transport in the artifact, and concludes at
      majority quorum with absentees recorded.
      <!-- verified 2026-08-09, two real passes (artifacts local-only under
      agents/runtime/council/responses/, gitignored by design):
      (1) default pass honoured this install's explicit `defaults.mode: api`
      pin — the per-install rollback Phase 3 names; (2) an auto-mode pass via
      $AI_COUNCIL_CONFIG: openai resolved transport=cli
      (subscription_label chatgpt-plus, billable=false), hit its
      cli_call_budget (54/50) and was recorded cli_quota_exhausted —
      degrading to the quorum path, NOT to metered API; anthropic resolved
      api per the resolver's documented keychain limitation (claude CLI
      stores its credential outside the filesystem); quorum concluded at
      threshold 1 (majority, n=2) with present=1/2 recorded. Both artifacts
      name every member's transport in metadata.transport. -->
- [x] Every telemetry-consuming behaviour (gate auto-dispatch, stop-block,
      point-of-action carrier, team telemetry) exists ONLY as a blocker with
      its enabling evidence named — none is half-shipped.
      <!-- verified 2026-08-09: no release-gate council dispatch wiring in
      src/scripts (the only "auto-fire" hit is the unrelated debate-repair
      confirm); end_review_nudge_hook never reports block severity (its own
      doc line 170); no pre_tool_use delegation carrier in the manifest;
      team events exist only as team_events_spike.ts, flag-gated with a
      clean exit-0 skip. All four have named blockers below. -->
      <!-- STILL SATISFIED after the 2026-08-20 drain, with the vehicle
      changed and the wording therefore now imprecise: the four exist as
      transfer STUBS rather than as open blockers. The property this criterion
      actually tests — none half-shipped, enabling evidence named — holds more
      strongly than before, because each stub carries its criterion verbatim,
      an enumerated moved-step list, a named re-entry producer and a detection
      probe, where an open blocker carried only prose. Deliberately NOT
      flipped to [-]: this is the criterion that documents the deferral, so
      marking it unachieved would assert the roadmap failed to defer cleanly,
      which is the opposite of what happened. Re-verified 2026-08-20: still no
      dispatch wiring, still no block severity, still no pre_tool_use
      delegation carrier, team events still only the flag-gated spike. -->
- [x] All external systems appear as Sources A–H only; the external-sources
      gate is green.
      <!-- verified 2026-08-09: check_no_external_sources exit 0 (checked
      unpiped); this roadmap references the survey exclusively as Sources
      A–H with the mapping in the local-only consumed-inbox file. -->
