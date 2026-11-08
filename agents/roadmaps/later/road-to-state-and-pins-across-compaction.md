---
complexity: standard
status: later
review_by: 2026-12-08
entry_condition:
  what: "road-to-a-compaction-the-session-survives is archived (identity reading and presence baseline on main)"
  when: "after that roadmap closes"
  who: owner
execution:
  mode: phase-checkpoints
estate_offset_exempt: "Owner search: grep -rlE 'session pin|sessionPin|checkpoint.*compact|recall.*transcript|known_bad|fast-check' across agents/roadmaps/*.md, later/ and stubs/ returned no owner (stubs/road-to-target-project-bootstrap-enforce mentions fast-check only as a consumer-grading signal; later/road-to-a-stop-that-holds-carried 1.4 owns the hooks-only kill-switch table, not a src-wide ledger). Added to later/, not active: its first phase waits on a council round, and the round that produced it (inbox-2026-11-zb) emitted one active roadmap already."
estate_growth_exempt: "Grows later_roadmaps by one and open_blockers by three. The three blockers are not new work but the decisions this file's steps genuinely wait on — two council questions (checkpoint lineage under the compact-resume-2026-10 verdict; recall verb under ADR-041) and one owner-reserved release commitment (who may issue a known_bad advisory). Recording them as blockers is what keeps the file from presenting takeable steps that are not takeable. The round's active roadmap closed in the same change, so active_roadmaps is unchanged at 8."
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

- [ ] **1.1** Put to the council, neutrally: is a checkpoint written at
      `pre_compact` and keyed by (session id, transcript path) a predecessor
      signal sufficient for `session_start(compact)` to inject task state?
      Attach `agents/evidence/analysis/compaction-identity-and-presence-2026-11-08.md`.
      <!-- blocked-by: council-compact-checkpoint-lineage -->
      verify: `test -f agents/evidence/council/compact-checkpoint-lineage.md` -> 0
- [ ] **1.2** On a yes: `pre_compact` writes the checkpoint with the field
      discipline of `continuity_writer.ts` (no judgement fields);
      `session_start(compact)` injects it only when both keys match, inside the
      8,000-char restore budget, ordered by the injection budget.
      verify: `npx vitest run tests/scripts/handoff_context_compact_record.test.ts` -> 0
- [ ] **1.3** Tests: own checkpoint restores; foreign, missing and mismatched
      checkpoints inject nothing.
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

- [ ] **3.1** Read-only keyword recall over the session's own JSONL only, output
      capped (2,000 tokens per call, 3 calls per turn), redacted through the
      existing redact path, on an existing verb (ADR-041; candidate
      `export --recall`). <!-- blocked-by: recall-verb-placement -->
      verify: `npx vitest run tests/scripts/transcript_recall.test.ts` -> 0
- [ ] **3.2** Pre-registered paired comparison over ≥ 15 compactions: re-read
      rate of already-read paths in the 10 turns after a compaction, before vs
      after. No gain keeps the default off and publishes the null.
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
      reported in every mode except `off`, never auto-installed.
      <!-- blocked-by: known-bad-publication-authority -->
      verify: `npx vitest run tests/scripts/update_notice.test.ts` -> 0
- [ ] **4.4** `host_lowering.json` `claude.pre_compact.block_exit` re-checked
      against the current host docs through the digest gate; truth only, never
      used to block a compaction (a blocked recovery compaction fails the
      request).
      verify: `./scripts-run src/scripts/check_host_docs_digest` -> 0
## Blockers

### blocker: council-compact-checkpoint-lineage
- **Owner:** council
- **Resolved when:** a council record answers 1.1 with the identity evidence attached.

### blocker: recall-verb-placement
- **Owner:** council
- **Resolved when:** the verb carrying recall is chosen under ADR-041.

### blocker: known-bad-publication-authority
- **Owner:** user
- **Resolved when:** the owner states who may publish a `known_bad` advisory and whether its target may be older than the installed version — a public release commitment.

## Decisions

| ID | Class | Resolved by | Decision | Revisit-if |
|---|---|---|---|---|
| L1 | reversible-technical | run | Pins enter by explicit user marker only; heuristic or model extraction is rejected — about half of real rules are phrased declaratively and a false pin is worse than none. | a marker-only pin set stays empty across sessions that set constraints |
| L2 | reversible-technical | run | No proxy, no request-path work, no own summarizer: this package is not in the request path and the host compacts itself. | the host offers a summarizer hook that takes instructions per call |

## Risk Register

| Risk | Mitigation |
|---|---|
| Recall becomes a token sink | Output caps and a pre-registered null that keeps the default off. |
| Restores add standing payload | Injection only on re-arm events (`session_start(compact)`), never always-on. |
| Pins become an injection vector | User-prompt source only; tool and file content can never create or delete a pin. |

## Acceptance Criteria

- Each phase closes on its verify line or its pre-registered null.
- No new always-on bytes; all restores ride `session_start(compact)`.
