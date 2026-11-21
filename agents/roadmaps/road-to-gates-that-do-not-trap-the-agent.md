---
complexity: structural
status: ready
tree_pin: 811cea61d6
estate_growth_exempt: "+2 open_blockers (b-apply-allow-proposal, owner-only host permission posture; b-measure-window, external session count), carried by the owner's 2026-11-21 instruction to plan and work off every retro learning."
estate_offset_exempt: "Owner-directed 2026-11-21 ('Lass uns alle Learnings einplanen und abarbeiten'): measures 10 and 18 of the session retro have no active carrier; the matching later/ roadmap stays parked and is extended, not archived, so nothing is offset. Owner record: agents/evidence/owner-directives/2026-11-21-session-retro-roadmaps.md."
execution:
  mode: autonomous
depends: [road-to-an-episode-ledger-with-cost-per-control]
relates:
  # Probe: `agent-config roadmap:context --roadmap road-to-gates-that-do-not-trap-the-agent --relates`
  # at 811cea61d6 returned 47 hits. 29 matched only on [not that] (the probe's
  # stopword list lacks both words); their titles and goals name unrelated
  # subjects and they are disjoint. The 18 hits on [gates] or [agent] are listed
  # below with the relation decided on their body, plus seven rows the probe did
  # not reach lexically (four are siblings authored in the same retro run).
  - slug: road-to-an-episode-ledger-with-cost-per-control
    relation: depends
    note: "Owns measure 8: sessions:episodes traces every blocked-call episode profile → rule precedence → host permission → deciding hook, with a --by-control view. Phase 1 here joins relays to that ledger and Phase 2 ranks its --by-control output; no second trace is built."
  - slug: road-to-an-agent-the-owner-does-not-drive
    relation: extends
    note: "Its Phase 5 owns the pre-push path (5.1), a landing command (5.2), lint fixes without history rewrite (5.3) and cleanup inside landing (5.4); its Phase 1 owns the goal-scoped mandate. This adds the relay map, the ranked gate inventory, the repo gates outside its Phase 5, and the host allow-list probe; 3.6 hands its rows the relay evidence."
  - slug: later/road-to-mandates-scoped-to-the-goal
    relation: disjoint
    note: "Owns the agent-side goal mandate that E1's PR series lacked; this roadmap handles the host-side refusal and repo text that remain once the mandate exists."
  - slug: road-to-stop-hooks-that-count-own-edits
    relation: disjoint
    note: "Owns the false positives of the stop and turn-end hooks; 2.2 marks those rows excluded with that roadmap as owner."
  - slug: road-to-questions-that-reach-the-right-decider
    relation: disjoint
    note: "Owns which questions reach the owner; a relay here is a hand-off of an action, not a question."
  - slug: road-to-a-halt-that-holds-every-lane
    relation: disjoint
    note: "The emergency orchestration halt is a gate that must keep holding; 3.1 excludes it from every removal verdict."
  - slug: road-to-gates-that-check-what-they-claim
    relation: disjoint
    note: "Tightens block-no-verify and the impact floor; 3.1 excludes the guards it owns, so the two never act on one gate in opposite directions."
  - slug: road-to-gate-preauth-authorization
    relation: disjoint
    note: "Owns where a signed spend authorisation lives. 3.2 here keeps the /dev/tty keypress and only removes its repetition per set."
  - slug: road-to-a-hard-floor-the-shell-cannot-talk-past
    relation: disjoint
    note: "Owns the Hard Floor's tool-time mechanism; no step here changes Hard Floor scope, and 3.1 excludes its rows."
  - slug: road-to-worktree-hygiene
    relation: extends
    note: "Archived; its verification duties shipped as `worktree:cleanup`. 3.3 routes the bulk-cleanup ask to that command instead of an ad-hoc script."
  - slug: road-to-three-gates-the-canary-could-not-kill
    relation: disjoint
    note: "Gates that stay green over a planted defect; the opposite failure of a gate that traps."
  - slug: road-to-a-required-check-that-does-not-rerun-the-gates
    relation: disjoint
    note: "CI runtime of one required check; no relay path."
  - slug: road-to-gates-that-do-not-run
    relation: disjoint
    note: "Gates that never execute; opposite failure."
  - slug: road-to-standing-payload-truth
    relation: disjoint
    note: "Standing payload size; matched on [gates] only."
  - slug: road-to-gates-that-can-fail
    relation: disjoint
    note: "Gates that could not go red; opposite failure."
  - slug: road-to-gates-that-read-what-was-written
    relation: disjoint
    note: "False greens on written content; opposite failure."
  - slug: road-to-gates-that-run-where-the-consumer-stands
    relation: disjoint
    note: "Consumer-side gate execution; no relay path."
  - slug: road-to-gates-that-see-what-is-there
    relation: disjoint
    note: "Two false greens; opposite failure."
  - slug: road-to-agent-velocity
    relation: disjoint
    note: "Session time lost to self-inflicted tool loops; no gate trace."
  - slug: road-to-decided-but-not-done
    relation: disjoint
    note: "Decisions recorded but not executed; matched on [agent not]."
  - slug: road-to-estate-drawdown
    relation: disjoint
    note: "Roadmap estate size; matched on [agent that]."
  - slug: road-to-global-user-memory
    relation: disjoint
    note: "User memory layer; matched on [agent not]."
  - slug: road-to-lean-agent-init
    relation: disjoint
    note: "Init footprint; matched on [agent not]."
  - slug: road-to-mcp-stdio-end-user-packaging
    relation: disjoint
    note: "MCP packaging; matched on [agent not]."
  - slug: road-to-the-graph-that-lies-confidently
    relation: disjoint
    note: "Code-graph freshness; matched on [agent that]."
---

# Road to gates that do not trap the agent

> **Source:** the owner's session retrospective of 2026-11-21 (about 380 Claude
> Code sessions, 643 incidents; pattern E "the owner becomes the command relay",
> measures 10 and 18), and the AI council round of the same day (members
> anthropic + openai, analysis mode, one round). Convergence, inlined: anthropic
> — remove the bad gates instead of building an allow-list; openai — an
> allow-list helps only where the installer can set the value, and every
> blockage lacks its path profile → rule precedence → host permission → deciding
> hook. Owner decision recorded in the retro: trace that path first, remove gates
> where they are the cause, allow-list only for genuine host-classifier cases.

## Goal

Every blockage that made the owner run a command, type a confirmation, or delete
something on the agent's behalf is joined, by a generated relay map, to the
episode-ledger trace of the control that decided it. Each repo-owned control that the trace names as the cause is
removed or reshaped so the agent completes the authorised action itself, an
allow-list proposal exists only for command shapes where a probe shows an allow
entry changes the host's outcome, and a generated inventory ranks every gate by
how often it blocked.

## Context

Owner constraint (2026-11-21): no hand-maintained or owner-written context file.
The relay map, the inventory and the allow-list proposal are command output,
regenerated from transcripts, the episode ledger and the tree; nothing here is
curated by hand.

**The five relay episodes** (retro chunks, dates are session dates):

| # | Date | What the owner had to do | Path as far as the transcript shows |
|---|---|---|---|
| E1 | 2026-10-07 | land 14 of 15 green PRs by hand ("Verarscht du mich?") | agent asked the owner for a landing permission first; after #2238 landed, the host auto-mode classifier refused the rest as "Auto-Mode Bypass". ADR-282 records the same classifier refusing the same action because the command text forbade it (`docs/decisions/ADR-282-*.md`, lines 52-58) |
| E2 | 2026-11-01 | delete 135 worktrees | agent wrote its own deletion script; the host filter blocked it twice; the script went to the owner. `agent-config worktree:cleanup apply` existed since 2026-10-25 (`src/scripts/_dispatch.bash:103`, `src/domains/engineering-base/worktree/cleanup/command.md:50-55`) and was not used |
| E3 | 2026-11-08 | run the push by hand with `AGENT_CONFIG_SKIP_PREPUSH_PREFLIGHT=1`, then again adding `…_FRESHNESS=1` | host auto-mode refused a history rewrite of a commit subject for `lint_commit_subjects`. `…_PREFLIGHT` skips nothing since the CI mirror replaced it (`src/scripts/install-hooks.sh:366-371`); the pre-push hook still carries four skip variables (`:198`, `:274`, `:315`, `:373`) |
| E4 | 2026-11-13 | type "yes" 70 times | `skill_trigger_eval` takes exactly one `--skill` (`src/scripts/skill_trigger_eval.ts:897-933`) and confirms every run on `/dev/tty` (`:476-503`); the agent looped it over 70 sets |
| E5 | 2026-11 (two sessions) | edit `~/.claude/settings.json` and `permissions.allow` by hand | `block-config-weakening` refuses agent edits to Class-C keys in `.claude/settings(.local).json` (`src/scripts/hooks/block_config_weakening.ts:261-266`, message `:590-600`); the installer writes only `claudeMdExcludes` there (`src/scripts/install.ts:1953-1981`) and `src/scripts/_lib/host_permission_checks.ts:5-13` says the package never writes consumer permissions, so no route to a sanctioned allow-list exists |

**Data already in the tree.** `src/scripts/hooks/dispatch_hook.ts:919-935`
counts BLOCK and WARN per concern into `agents/runtime/state/rule-trips.json`;
`src/scripts/hooks/interruption_ledger_hook.ts` classes each turn end as
`ask` / `handback` / `none` into `interruptions.jsonl`, with no class for a
turn that hands the owner a command. Host-side denials exist only in
transcripts.

**Host fact, unverified since 2026-09-10:** `permissions.allow` does not bypass
the auto-mode classifier
(`src/agent-src/contexts/communication/rules-auto/token-efficiency-mechanics.md:243-251`).
If it still holds, an allow-list cannot fix E1–E3; Phase 4 probes it before any
proposal is built.

**The trace itself is owned elsewhere.** `road-to-an-episode-ledger-with-cost-per-control`
(measure 8, authored in the same run) builds `agent-config sessions:episodes`:
deduplicated blocked-call episodes, each traced profile → rule precedence → host
permission → deciding hook, with a `--by-control` view. This roadmap depends on
it and does not build a second trace. What that ledger does not see is a
**relay**: a turn that ends by handing the owner a command, a script or a
`/dev/tty` prompt. E4 has no blocked tool call at all, and E2/E3 continue past
the block into a hand-off. Phase 1 adds that axis and joins it to the ledger.

**Scope boundary.** The pre-push path, a landing command, lint fixes without a
history rewrite, and worktree removal inside landing stay with
`road-to-an-agent-the-owner-does-not-drive` Phase 5; this roadmap maps their
relays, ranks them, and hands that roadmap the evidence (3.6). Stop and
turn-end hook false positives stay with `road-to-stop-hooks-that-count-own-edits`.
Kernel guards (`block-kernel-rule-writes`, `block-no-verify`,
`block-plumbing-writes`), Hard Floor triggers, the emergency halt and every
guard owned by `road-to-gates-that-check-what-they-claim` are excluded from
removal.

## Phase 1 — Relays joined to the episode ledger

- [ ] **1.1 A relay is a counted turn end.** Test first in
      `tests/scripts/hooks/interruption_ledger.test.ts`: a closing paragraph that
      hands the user a `!`-prefixed command, a script path to run, or a
      `/dev/tty` instruction logs `class: relay`; an owner-reserved hand-back
      (spend, Hard Floor) stays `handback`. Then add the class to
      `interruption_ledger_hook.ts`, which stays capture-only and exits 0.
      verify: `npx vitest run tests/scripts/hooks/interruption_ledger.test.ts` -> 0
- [ ] **1.2 Relay map, fixtures first.** `tests/scripts/gate_relay_map.test.ts`
      with fixture transcripts shaped like E1–E5 and a fixture
      `sessions:episodes --json` output; it asserts each relay is joined to the
      episode that preceded it in the same session (deciding layer + control),
      and that a relay with no blocked call (E4 shape) reads `no-blocked-call`.
      Red before 1.3.
      verify: `npx vitest run tests/scripts/gate_relay_map.test.ts` -> /failed/
- [ ] **1.3 Implement `agent-config gates:relays`.** `src/scripts/gate_relay_map.ts`
      reads relay turns from transcripts with the turn-end detector 1.1 uses,
      and episodes from `sessions:episodes --json`. Flags `--since`,
      `--gate <id>`, `--json`, `--write`. Report only (D2). Register it in
      `src/scripts/_dispatch.bash`.
      verify: `npx vitest run tests/scripts/gate_relay_map.test.ts` -> 0
- [ ] **1.4 Run it over the real store.** `agent-config gates:relays
      --since 2026-10-01 --write` writes
      `agents/evidence/analysis/gate-relay-map-<date>.md`, generated header
      naming the command, transcript count and tree sha.
      verify: the report lists E1–E5, each joined to a control or marked
      `no-blocked-call` with the hand-off shape named.

## Phase 2 — Gate inventory ranked by block frequency

- [ ] **2.1 Fixture first.** `tests/scripts/gate_inventory.test.ts` with a
      fixture `sessions:episodes --by-control --json`, a fixture relay map and a
      three-concern manifest; it asserts the ranking (blocks desc, relays desc)
      and that a gate with zero episodes still appears with `0`. Red before 2.2.
      verify: `npx vitest run tests/scripts/gate_inventory.test.ts` -> /failed/
- [ ] **2.2 Implement `agent-config gates:inventory`.** The catalog half lists
      every gate that can stop the agent: concerns in
      `src/scripts/hook_manifest.yaml`, skip variables in
      `src/scripts/install-hooks.sh`, every `/dev/tty` confirm under
      `src/scripts/`. The count half joins the ledger's `--by-control` view and
      the 1.4 relay map. Columns: gate, layer, blocks, relays, the defect class
      its header names, owning roadmap (grep of `agents/roadmaps/`), and
      `excluded` with the scope-boundary reason.
      verify: `npx vitest run tests/scripts/gate_inventory.test.ts` -> 0
- [ ] **2.3 Write the inventory.** `agent-config gates:inventory --write`
      produces `agents/evidence/analysis/gate-inventory-<date>.md`, header
      marked generated with the command that regenerates it.
      verify: `grep -c 'generated by agent-config gates:inventory' agents/evidence/analysis/gate-inventory-*.md` -> /[1-9]/

## Phase 3 — Remove or reshape the repo gates that are the cause

- [ ] **3.1 Verdict per gate, council first.** For every inventory row with
      relays ≥ 1, a `repo-*` layer and `excluded: false`, run
      `agent-config council:status`, then a council analysis round on that row's
      relay-map excerpts asking remove | reshape | keep. Record each verdict as a
      `## Decisions` row (`contested-technical`, `council:<date>`). A verdict
      that lowers a safety floor becomes a blocker per template rule 20, routed
      through the council first.
      verify: every qualifying inventory row has a Decisions row with a
      `council:` resolver.
- [ ] **3.2 Seventy confirmations become one.** Test first in
      `tests/scripts/skill_trigger_eval.test.ts`: `--skills a,b,c` (and
      `--skills-file <path>`) runs every set after one `/dev/tty` confirmation
      that shows the summed estimate; a refusal runs none. Then implement in
      `skill_trigger_eval.ts`; single `--skill` keeps today's behaviour.
      verify: `npx vitest run tests/scripts/skill_trigger_eval.test.ts` -> 0
- [ ] **3.3 Removing many worktrees routes to the sanctioned removal command.** Test
      first: a routing fixture where "räum die Worktrees auf" / "clean up the
      worktrees" resolves to `/worktree cleanup --apply`, and the cleanup command
      text names that it handles every non-main worktree in one call. Then
      amend `src/domains/engineering-base/worktree/cleanup/command.md` and run
      `task sync`.
      verify: `npx vitest run tests/scripts/worktree_cleanup_check.test.ts` -> 0
- [ ] **3.4 Apply each remove/reshape verdict from 3.1.** One step per gate,
      added under this phase when 3.1 records it: failing test reproducing the
      trace episode first, then the change, then the gate's own test file green.
      verify: each added step carries its own narrow `verify:`.
- [ ] **3.5 Rule text that turns the host classifier against the owner.** For
      relay-map rows whose ledger rule is `rule-text:<path>`, rewrite the contradicting text
      so it matches the recorded owner authority (ADR-282 shape) in `src/`, then
      `task sync`. A contradiction with no accepted ADR behind it goes to the
      council first.
      verify: `rg -nF '<quoted sentence>' src/` -> 1 for each quoted sentence from the relay-map rows
      (positive control: the same `rg` before the rewrite exits 0)
- [ ] **3.6 Hand the parked owner the evidence.** For every inventory row whose
      owning roadmap is `road-to-an-agent-the-owner-does-not-drive`, append one
      `evidence:` continuation line under its matching Phase 5 step naming the
      relay map and the relay count.
      verify: `grep -c 'gate-relay-map-' agents/roadmaps/later/road-to-an-agent-the-owner-does-not-drive.md` -> /[1-9]/

## Phase 4 — Allow-list only where the host classifier is the cause

- [ ] **4.1 Probe the host fact first.** Add the host's permission docs page
      to `src/scripts/hooks/host_docs_pages.yaml` (it lists none today), re-read
      it, and run a probe in a
      throwaway project under the scratchpad: auto mode, one command shape per
      `host-classifier` relay-map row, once without and once with a matching
      `permissions.allow` entry. Record outcome per shape as a Decisions row
      (`deterministic`, `evidence`).
      verify: a Decisions row exists per `host-classifier` command shape.
- [ ] **4.2 Generate the proposal only for shapes the probe flipped.** Test
      first, then `agent-config permissions:propose` prints the minimal allow
      entries as a JSON snippet derived from relay-map rows and 4.1 rows; it writes
      no file (`host_permission_checks.ts:5-13`). If 4.1 flipped no shape, mark
      this step `[-]` with the probe result as the reason.
      verify: `npx vitest run tests/scripts/permissions_propose.test.ts` -> 0
- [ ] **4.3 Doctor shows whether the proposal is in force.** Extend
      `host_permission_checks.ts` to report each proposed entry as present or
      absent, read-only.
      verify: `npx vitest run tests/scripts/host_permission_checks.test.ts` -> 0
      <!-- blocked-by: b-apply-allow-proposal | asked: no — nothing to apply exists until 4.2 generates the proposal -->

## Phase 5 — Re-measure the relay count

- [ ] **5.1 Compare against the Phase 1 baseline.** Rerun `agent-config
      gates:relays --since <date 3.4 last flipped>` and the relay count from
      `interruptions.jsonl`; for every gate removed or reshaped in 3.4 the
      relay count is 0, otherwise reopen its 3.4 step.
      verify: `agent-config gates:relays --since <date 3.4 last flipped> --gate <id> --json` -> /"relays": 0(?![0-9])/
      per 3.4 gate <!-- blocked-by: b-measure-window -->

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| D1 | reversible-technical | agent | the per-blockage trace comes from `sessions:episodes` (road-to-an-episode-ledger-with-cost-per-control); this roadmap adds only the relay axis and builds no second trace | that roadmap's Goal and its 2.4 trace chain; `runtime_journal.ts` carries no triggering control at 811cea61d6 | the ledger's 2.2 attribution coverage stays below 95 % after its 2.3 |
| D2 | reversible-technical | agent | `gates:relays` and `gates:inventory` are reports, never gates: no baseline, no CI exit on counts | `autonomy_friction_traffic.ts:27-31` states the same for its friction count | the owner asks for a ratchet |
| D3 | product-owned | owner | trace first; remove gates where they are the cause; allow-list only for genuine host-classifier cases | owner decision in the 2026-11-21 retro, pattern E | — |
| D4 | critical-technical | agent | kernel guards, Hard Floor triggers, the emergency halt and guards owned by `road-to-gates-that-check-what-they-claim` are never removal candidates here | `src/scripts/hooks/block_kernel_rule_writes.ts`, `road-to-a-halt-that-holds-every-lane` | the owner names one of them as a removal target |

## Blockers

### blocker: b-apply-allow-proposal
- **Status:** open
- **Owner:** owner
- **Routed:** pending — no council ran while this roadmap was authored; the next council pass routes it against the owner-reserved table (writing host permission posture)
- **Blocks:** Phase 4 — Allow-list only where the host classifier is the cause
- **Question:** apply the generated `permissions.allow` entries to the host settings or not.
- **Recommendation:** apply only the entries 4.1 proved to flip the host outcome; the package must not write them itself (`src/scripts/_lib/host_permission_checks.ts:5-13`, Class C under `src/scripts/hooks/block_config_weakening.ts:261-266`).
- **If you do nothing:** every flipped command shape keeps reaching the owner as a relay.
- **What to do:**
  1. Run `agent-config permissions:propose` and paste the printed entries into `~/.claude/settings.json` under `permissions.allow`.
  2. Run `agent-config doctor` and check each entry reads `present`.
- **Resolved when:** `agent-config doctor` reports every proposed entry `present`, or 4.2 is `[-]`.

### blocker: b-measure-window
- **Status:** open
- **Owner:** external
- **Blocks:** Phase 5 — Re-measure the relay count
- **Recommendation:** wait for sessions; nothing to decide.
- **If you do nothing:** 5.1 cannot tell a fixed gate from an unexercised one.
- **What to do:**
  1. Run `agent-config gates:relays --since <date 3.4 last flipped> --json` and read `transcripts`.
- **Resolved when:** that command reports `transcripts` ≥ 20.

<!-- Release holds — none.
     resequenced: Phases 1–2 add report commands and a capture class only; each
     3.x change lands with its own failing-test-first step and is complete on
     its own, so no intermediate tree state is broken and no window is needed.
-->

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-11-21 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | A removed gate was guarding a real defect class | product | 3.4 removes a control whose only visible cost was relays, and the defect it caught returns silently. | 3.1 requires a council verdict on the relay-map excerpts and the gate's stated defect class; D4 fences the kernel, Hard Floor and halt guards; each 3.4 change starts from a reproducing test. | Phase 3 — Remove or reshape the repo gates that are the cause |
| 2 | Host denials leave no machine-readable trace | implementation | The episode ledger attributes too few host-side blocks, so 1.3 joins E1–E3 relays to `unattributed` and the inventory under-ranks host-side causes. | The ledger's own 2.2 measures attribution coverage before anything is ranked; 1.2 fixtures are cut from the real E1–E5 transcripts; 1.4 names the missing evidence per unjoined relay instead of dropping it. | Phase 1 — Relays joined to the episode ledger |
| 3 | The allow-list fixes nothing | product | If `permissions.allow` still does not bypass the auto-mode classifier, a proposal adds mechanism without removing a relay. | 4.1 probes per command shape before 4.2 builds anything; an unflipped shape gets no entry and 4.2 closes `[-]`. | Phase 4 — Allow-list only where the host classifier is the cause |
| 4 | The relay detector over-counts | implementation | 1.1 counts a legitimate hand-back (an owner-only action) as a relay and inflates the baseline 5.1 compares against. | 1.1's test carries a negative fixture for an owner-reserved hand-back; 5.1 compares per gate, not totals. | Phase 5 — Re-measure the relay count |

## Acceptance Criteria

- [ ] AC-1 — `agent-config gates:relays` and `agent-config gates:inventory` exist,
      their tests pass, and the generated reports under
      `agents/evidence/analysis/` list E1–E5 with a deciding layer each.
- [ ] AC-2 — Every inventory row with relays ≥ 1 and a `repo-*` layer that is
      not excluded has a council-resolved Decisions row, and every remove or
      reshape verdict has a ticked 3.4 step with a green `verify:`.
- [ ] AC-3 — `skill_trigger_eval --skills` runs N sets after exactly one
      confirmation (test green).
- [ ] AC-4 — A request to remove all non-main worktrees resolves, in the
      routing fixture, to `/worktree cleanup --apply`.
- [ ] AC-5 — No allow entry is proposed for a command shape 4.1 did not flip.
- [ ] AC-6 — `interruptions.jsonl` records `class: relay`, and 5.1 reports 0
      relays for each gate changed in 3.4 over ≥ 20 sessions.
