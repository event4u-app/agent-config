---
complexity: standard
status: ready
review_by: 2026-12-08
execution:
  mode: phase-checkpoints
estate_offset_exempt: "Owner search: grep -rlE 'session pin|sessionPin|checkpoint.*compact|recall.*transcript|known_bad|fast-check' across agents/roadmaps/*.md, later/ and stubs/ returned no owner (stubs/road-to-target-project-bootstrap-enforce mentions fast-check only as a consumer-grading signal; later/road-to-a-stop-that-holds-carried 1.4 owns the hooks-only kill-switch table, not a src-wide ledger). Added to later/, not active: its first phase waits on a council round, and the round that produced it (inbox-2026-11-zb) emitted one active roadmap already."
estate_growth_exempt: "Pulled from later/ on 2026-11-08 at the owner's instruction (\"hol die roadmap aus later und starte phase 1\"); its entry condition is met (road-to-a-compaction-the-session-survives is archived). Grows active_roadmaps by one and concern_count by one: the compact-checkpoint concern Phase 1.2 asks for, which writes and measures and injects nothing. active_roadmaps stays far under the owner cap of 25."
relates:
  - slug: road-to-a-compaction-the-session-survives
    relation: depends
    note: "Starts from its identity reading (274/274 kept on auto) and presence baseline."
  - slug: later/road-to-a-stop-that-holds-carried
    relation: extends
    note: "Its 1.4 lists hook kill switches; 4.1 here widens the same gate to every AGENT_CONFIG_* read in src/."
---
# Road to state and pins across compaction

> **Source:** `agents/tmp.old/inbox-2026-11-zb/` — the parts of the round's
> plans that need a council verdict, a host probe or an owner decision before
> they can run. Tree facts verified at `main@ceea998a0d` on 2026-11-08.

## Goal

After an automatic compaction the session gets back what it cannot afford to
lose — its task position and the constraints the user set in the session — from
a source the session itself wrote, and can look up what was folded away instead
of re-reading or guessing.

## Context

- Restores today cover the rule corpus (`rule-inject`) and the language pin
  (`language-mirror`). Constraints the user types mid-session ("do not touch X")
  have no capture and no restore: no session-pin mechanism exists in
  `src/scripts` (grep for `session.pin|📌|sessionPin` → nothing).
- `compact` injects no task-state record by council verdict
  (`agents/evidence/council/compact-resume-2026-10.md`) until a predecessor
  signal exists; that verdict is about lineage, not id equality.
- Nothing reads back pre-compaction content although the host keeps the full
  JSONL and hands hooks `transcript_path`.
- An external measurement the source cites (unverified here): rule violations
  rose from 0 % to about 30 % after compaction when the rule did not survive.

## Phase 1 — A checkpoint the session wrote for itself

- [x] **1.1** <!-- receipt: class=R0 · active · scope=safe · would-skip=council,evidence,retro,revalidation,review · bound=every touched path is non-behavioural --> Council answered 2026-11-08 (2/2 present, split on the label,
      convergent on the substance): (session id, transcript path) does **not**
      authorise injection. It names the session, not the compaction attempt — a
      checkpoint orphaned by an aborted compaction would match the next one.
      Writing and measuring is approved; injection is not.
      Record: `agents/evidence/council/compact-checkpoint-lineage-2026-11-08.md`.
      verify: `test -f agents/evidence/council/compact-checkpoint-lineage-2026-11-08.md` -> 0
- [x] **1.2** <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/config/hook-bundle-budget.json --> `pre_compact` writes a marker — session key, transcript hash, package
      version, time — and **injects nothing**. No task state yet: which fields
      may be restored is 1.4's decision, and reading them would mean calling
      roadmap, claim and git readers this hook cannot bound (ratification
      rounds 1–4, 2026-11-08). A counts-only log records written /
      consumed / orphaned per compaction.
      Shipped as the `compact-checkpoint` concern (claude only, lazy chunk,
      kill switch `AGENT_CONFIG_NO_COMPACT_CHECKPOINT=1`).
      verify: `npx vitest run tests/scripts/compact_checkpoint.test.ts tests/hooks/compact_checkpoint_hook.test.ts` -> 0
      production entry: `src/scripts/hooks/compact_checkpoint_hook.ts`
- [x] **1.3** <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/config/hook-bundle-budget.json --> Fault tests against the lifecycle the council named: an aborted
      compaction followed by a second one, a manual `/compact`, duplicate
      callbacks, a package upgrade between write and read. Each must show
      whether a stale checkpoint can become eligible.
      Result: every `pre_compact` invalidates an unobserved predecessor, so an
      aborted attempt cannot match the next one when that next `pre_compact`
      runs (proved sensitive: removing the invalidation reds the test).
      Residual: if `pre_compact` never fires for the second compaction, the
      orphan is still classified — `stale` once older than the bound. That is
      the case an attempt-specific host token would close (1.4).
      verify: `npx vitest run tests/scripts/compact_checkpoint_lifecycle.test.ts` -> 0
      production entry: `src/scripts/hooks/compact_checkpoint_hook.ts`
- [ ] **1.4** Choose the guarantee explicitly — attempt-specific handoff or
      "latest validated snapshot of this session" — and list which fields may
      be restored, each as a historical observation ("tests passed at <sha>"),
      never as current status. <!-- blocked-by: compact-attempt-identity -->
      verify: `test -f agents/evidence/council/compact-checkpoint-guarantee.md` -> 0
- [ ] **1.5** Only then inject at `session_start(compact)`: both keys match,
      staleness bound, version mismatch rejects, at most once, behind its own
      switch independent of rule restore and language pin; a wrong-session or
      stale restore disables it.
      verify: `npx vitest run tests/scripts/handoff_context_compact_record.test.ts` -> 0
## Phase 2 — Session pins the user set, restored verbatim

- [ ] **2.1** Capture only from `user_prompt_submit` text carrying an explicit
      line-start marker (`pin:`), never from tool output or file content, so
      injected content can neither create nor remove a pin. No model decides
      what is a pin.
      verify: `npx vitest run tests/scripts/session_pins.test.ts` -> 0
- [ ] **2.2** Restore through the existing `language-mirror` marker pattern
      (arm at `pre_compact`, one re-emit after) — no second mechanism; pass pins
      to subagents through `subagent-constraints`.
      verify: `npx vitest run tests/scripts/language_mirror_hook.test.ts tests/scripts/session_pins.test.ts` -> 0
- [ ] **2.3** Cap 12 pins × 300 chars; overflow tells the user, never truncates
      silently.
      verify: `npx vitest run tests/scripts/session_pins.test.ts` -> 0
- [ ] **2.4** Add a pin probe to `compaction_census` and re-run it on sessions
      that used pins; pre-registered target: pin text present in ≥ 95 % of
      summaries-plus-restore.
      verify: `test -f agents/evidence/analysis/session-pin-presence.md` -> 0
## Phase 3 — Recall from the session's own transcript

Council 2026-11-08 (2/2, split on the surface only): not `memory:lookup`; one
transport-independent core with CLI or MCP as adapters; nothing ships before a
host-attested session binding exists. Record:
`agents/evidence/council/transcript-recall-surface-2026-11-08.md`.

- [ ] **3.1** Show the need first: extend `compaction_census` to count, in the
      10 turns after each compaction, reads of paths already read before the
      boundary and turns that refer back to pre-boundary content. A rate too
      low to move a pre-registered outcome closes this phase as a null.
      verify: `test -f agents/evidence/analysis/post-compaction-reread.md` -> 0
- [ ] **3.2** Session binding from a host-supplied identity, never a
      caller-supplied path or id; state the narrower guarantee honestly — the
      command limits its own scope, it cannot confine a shell that can read the
      file anyway. <!-- blocked-by: recall-session-binding -->
      verify: `test -f agents/evidence/council/recall-session-binding.md` -> 0
- [ ] **3.3** Core: snapshot offset with a tolerated unfinished tail; recall
      output excluded from later searches; redaction failure returns nothing;
      original roles kept so recalled text is never read as a current
      instruction; telemetry counts only, never queries or excerpts; kill switch
      checked per call. Caps 2,000 tokens per call, 3 per turn, with the turn
      counter's owner named.
      verify: `npx vitest run tests/scripts/transcript_recall.test.ts` -> 0
- [ ] **3.4** Pre-register the decision rule before any run: outcome metric,
      improvement threshold, regression and inconclusive handling, stop
      conditions (cross-session result, redaction failure, budget bypass).
      ≥ 15 compactions is the floor, not the rule. No gain keeps it off.
      verify: `test -f agents/evidence/analysis/transcript-recall-paired.md` -> 0
## Phase 4 — Governance imports, each small

- [ ] **4.1** Widen `check_kill_switch_table` from `src/scripts/hooks` +
      `src/scripts/_lib` to every `AGENT_CONFIG_*` read in `src/` (tests and
      build defines excluded), adding `kind` (temporary/permanent) and an expiry
      condition mandatory for gate bypasses. Today about 25 such names appear in
      no doc, among them `AGENT_CONFIG_SKIP_SURFACE_TIER_CHECK` and
      `AGENT_CONFIG_ORCHESTRATION_HALT`.
      verify: `./scripts-run src/scripts/check_kill_switch_table` -> 0
- [ ] **4.2** `fast-check` as a devDependency (supply-chain intake first) for
      four pure decision cores: `classify_update` (uncertainty never `auto`),
      `classify_merge_risk` (more touched surface never lowers risk),
      `prefix_stable_surfaces` (append stability), `injection_budget` (one
      nudge). Shrunk counterexamples become fixed regression cases.
      verify: `npx vitest run tests/scripts/property_decision_cores.test.ts` -> 0
- [ ] **4.3** A `known_bad` range with a rollback target in the update notice,
      reported in every mode except `off`, never auto-installed. Only the owner
      issues an advisory; its target may be older than the installed version (L3).
      verify: `npx vitest run tests/scripts/update_notice.test.ts` -> 0
- [ ] **4.4** `host_lowering.json` `claude.pre_compact.block_exit` re-checked
      against the current host docs through the digest gate; truth only, never
      used to block a compaction (a blocked recovery compaction fails the
      request).
      verify: `./scripts-run src/scripts/check_host_docs_digest` -> 0
## Blockers

### blocker: compact-attempt-identity
- **Status:** open
- **Owner:** council
- **Blocks:** 1.4, and through it 1.5.
- **What to do:** after real compactions, read the counts with `npx tsx -e "import { readEventTally } from './src/scripts/_lib/compact_checkpoint.ts'; console.log(readEventTally())"` and put the guarantee and the restorable fields to the council (`agent-config council:run <question-file> --confirm`) with that reading attached.
- **Recommendation:** collect at least 20 compactions first; a high `orphaned` share argues for the attempt-specific guarantee, a near-total `match` share for the latest-snapshot one.
- **If you do nothing:** the marker keeps measuring and nothing is injected, which is today's behaviour — no regression, no gain.
- **Resolved when:** a host-provided per-compaction token shared by `pre_compact` and `session_start(compact)` exists, or 1.3's fault tests show a stale checkpoint cannot become eligible — and the council records the chosen guarantee (1.4).

### blocker: recall-session-binding
- **Status:** open
- **Owner:** council
- **Blocks:** 3.2, and through it 3.3 and 3.4.
- **What to do:** check the host hook and MCP docs for a session identity a tool call can verify (start from `src/scripts/hooks/host_lowering.json`, `verified.docs_url` per host) and record the answer in `agents/evidence/council/recall-session-binding.md`; if no host offers one, record that and close Phase 3 as a null. <!-- ref-ignore -->
- **Recommendation:** run 3.1 first — if post-compaction re-reads are rare, Phase 3 closes as a null and this blocker never needs answering.
- **If you do nothing:** no recall is built; sessions after a compaction keep re-reading files, as today.
- **Resolved when:** a supported host is shown to supply an identity a later recall call can verify; that host's mechanism also settles CLI-first versus MCP-first (the one point the 2026-11-08 round split on).


## Decisions

| ID | Class | Resolved by | Decision | Revisit-if |
|---|---|---|---|---|
| L1 | reversible-technical | run | Pins enter by explicit user marker only; heuristic or model extraction is rejected — about half of real rules are phrased declaratively and a false pin is worse than none. | a marker-only pin set stays empty across sessions that set constraints |
| L2 | reversible-technical | run | No proxy, no request-path work, no own summarizer: this package is not in the request path and the host compacts itself. | the host offers a summarizer hook that takes instructions per call |
| L3 | owner-reserved | user, 2026-11-08 (answered "1" to: only the owner, older targets allowed, notice only) | Only the owner issues a `known_bad` advisory. Its rollback target may be older than the installed version; it is shown as a notice and never installed automatically. | the owner delegates advisory issuance, or a notice is acted on as an install |

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-11-08 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Recall becomes a token sink | implementation | Every recall re-sends bytes that compaction had just folded away; unbounded use costs more than it saves. | Output caps per call and turn (3.3); a pre-registered decision rule that keeps the default off on no gain (3.4). | Phase 3 — Recall from the session's own transcript |
| 2 | Restores add standing payload | implementation | Restored state or pins injected on every turn would grow the always-on context. | Injection only on the re-arm event `session_start(compact)`, never always-on (1.5, 2.2). | Phase 1 — A checkpoint the session wrote for itself |
| 3 | Pins become an injection vector | implementation | Text from tool output or files could create or remove a pin and steer later turns. | Pins come only from user-prompt text with an explicit marker (2.1). | Phase 2 — Session pins the user set, restored verbatim |
| 4 | Stale state restored as current | implementation | A checkpoint from an earlier compaction attempt matches the next one and restores outdated status. | Injection waits on an attempt-specific guarantee (1.4); fields restored only as historical observations. | Phase 1 — A checkpoint the session wrote for itself |

## Acceptance Criteria

- Each phase closes on its verify line or its pre-registered null.
- No new always-on bytes; all restores ride `session_start(compact)`.
