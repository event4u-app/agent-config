---
complexity: structural
status: ready
tree_pin: b234d08480
execution:
  mode: phase-checkpoints
review_by: 2026-12-31
estate_growth_exempt: "+1 active_roadmaps over the WIP cap of 5, owner-directed 2026-11-03 (agents/evidence/owner-directives/2026-11-03-process-inbox-2026-11-n-roadmaps.md): one of eight roadmaps of round inbox-2026-11-n landed active so /roadmap:process-full executes them in the same run."
estate_offset_exempt: "Owner search at b234d08480 — grep -rlF over agents/roadmaps/*.md, agents/roadmaps/later and agents/roadmaps/stubs for check_owner_question, duplicate OQ, needs-rebase, all_skipped, gh run watch, subagent_return_report, spawnDepth, xhigh, ultracode, peer_session returned nothing; agents/roadmaps-owned.md lists no owner. Adjacent stubs (road-to-main-protection-ruleset-changes, road-to-subagent-return-gate, road-to-subagent-payload-capture) are not active work and receive dated lines only."
relates:
  - slug: stubs/road-to-main-protection-ruleset-changes
    relation: disjoint
    note: "1.4 and 1.5 discharge its in-repo precondition (queue-ref concurrency, PR-only-step inventory). The ruleset write stays there."
  - slug: stubs/road-to-subagent-return-gate
    relation: disjoint
    note: "Phase 3 builds the read-only instrument its probe lacks. Nothing here blocks, retries or refuses on the numbers."
  - slug: later/road-to-merge-surface-zero
    relation: disjoint
    note: "Its prospective-merge job and hotspot drawdown stay there."
---
# Road to a green that saw what it certifies

> **Source:** `agents/tmp.old/inbox-2026-11-n/` (topic T2, T3, P05).
> **Arrivals:** 1 — `inbox-2026-11-n` (2026-11-03).

## Goal

Every reported pass saw what it certifies, or says it saw nothing. At the pin `Tests result` is green
when every job skipped (`.github/workflows/tests.yml:925-934`), the pre-cut gate trusts an exit
code on a run picked by `--limit 1` (`docs/release-runbook.md:127-136`), owner-question ids have
no uniqueness gate although duplicates already reached `main` without a git conflict, and no
instrument can say whether a subagent that reported `DONE` wrote anything
(`stubs/road-to-subagent-return-gate.md:8`).

## Phase 1 — The merge surface reports what it checked

- [x] **1.1 Owner-question ids are unique.** New `src/scripts/check_owner_question_ids.ts`:
      parse `^#{2,4} *OQ-(\d+)` headings in `agents/owner-questions.md`, exit 1 naming each
      duplicate id and its lines, print `scanned: <N>`. Wire it into `taskfiles/ci-fast.yml`, a
      `consistency.yml` step with **no** `pull_request` guard (so it also runs on `merge_group`),
      and `src/config/gate-coverage.yml`.
      verify: `npx vitest run tests/scripts/check_owner_question_ids.test.ts` (a fixture with a
      duplicate id exits 1 and names both lines; the live file exits 0).
- [x] **1.2 "Nothing ran" is stated, not folded into green.** In the `Tests result` job
      (`.github/workflows/tests.yml:925-934`) count `success` vs `skipped`; when every needed job
      is `skipped`, write `nothing ran` to `$GITHUB_STEP_SUMMARY` and set output
      `all_skipped=true`. Exit code unchanged (the release-PR skip at `tests.yml:123-132` is
      intended).
      verify: `npx vitest run tests/scripts/tests_workflow_result_aggregate.test.ts` — runs the
      step's script with `RESULTS="skipped skipped"` (summary says nothing ran, exit 0) and
      `RESULTS="success skipped"` (no line, exit 0) and `RESULTS="failure"` (exit 1).
- [x] **1.3 The pre-cut gate reads a conclusion of the run it started.** Rewrite the loop at
      `docs/release-runbook.md:127-136`: record the dispatch time and `origin/main` SHA, select the
      run by `event=workflow_dispatch`, `headSha` and `createdAt >=` dispatch time, wait with
      `gh run watch`, then require `gh run view "$id" --json conclusion --jq .conclusion` to equal
      `success`; `cancelled`, missing or still-running is a stop.
      verify: `grep -c -- '--exit-status' docs/release-runbook.md` → 0 and
      `grep -c 'conclusion' docs/release-runbook.md` → ≥ 1.
- [x] **1.4 Queue runs never cancel each other.** In `tests.yml:50-52`, `consistency.yml:118-119`
      and `standing-payload-delta.yml:98-99` make the group unique per run for `merge_group`
      (`${{ github.workflow }}-${{ github.event_name == 'merge_group' && github.run_id || github.ref }}`)
      and set `cancel-in-progress: ${{ github.event_name != 'merge_group' }}`. Behaviour for
      `push` and `pull_request` is byte-identical in effect; inert until a queue exists.
      verify: `npx vitest run tests/scripts/workflow_merge_group_concurrency.test.ts` — parses the
      three workflows and asserts the expression shape for both keys.
- [x] **1.5 Inventory of the steps a queue would skip.** New
      `agents/evidence/analysis/merge-group-pr-only-steps-2026-11.md`: one row per step guarded by
      `github.event_name == 'pull_request'` in `consistency.yml`, `standing-payload-delta.yml` and
      `tests.yml` — step name · invariant · "enforced elsewhere (`file:line`)" or "intentionally
      PR-only (why)". Add one dated line to `stubs/road-to-main-protection-ruleset-changes.md`
      under the 2026-10-22 condition pointing at it.
      verify: `npx vitest run tests/scripts/merge_group_pr_only_inventory.test.ts` — every
      PR-guarded step name in the three workflows appears as a row, and no row names a step that
      no longer exists.

## Phase 2 — Shared memory does not double an entry

- [x] **2.1 The curated reader yields an id once.** In `src/scripts/memory_lookup.ts`
      `_iter_curated_entries` and `_iter_curated_entries_all` (`:352-420`), keep the first entry
      per `id` across both layouts; an entry without `id` is yielded as today. Update the caveat in
      `.gitattributes:57-60`, which states the reader does not dedup.
      verify: `npx vitest run tests/scripts/memory_lookup_dedup.test.ts` — a flat file holding the
      same `id` twice (a bad union merge) returns one hit; two distinct ids return two.

## Phase 3 — A subagent return the tree can witness (read-only)

- [x] **3.1 `subagent_return_report`, counts only.** New `src/scripts/subagent_return_report.ts`
      on `listTranscriptFiles` (`src/scripts/_lib/cc_transcript.ts:257`): per leg, write attempts
      (`Edit`/`Write`/`MultiEdit`/`NotebookEdit`), successful writes (`tool_result.is_error` not
      true), distinct targets (hash set, never printed); joined from the host sidecar
      `<leg>.meta.json`: `agentType`, `model`, `spawnDepth`, else `meta_missing`. Stdout carries
      only numbers and enums grouped by agent type, plus oldest/newest transcript mtime. No
      Taskfile, gate or hook wiring.
      verify: `npx vitest run tests/scripts/subagent_return_report.test.ts` — fixture tree of three
      legs (two edits on one file, one failed write, one leg without sidecar) yields
      `writes_attempted 3`, `writes_ok 2`, `targets 1`, `meta_missing 1`; a test asserts no path,
      no host id and no prose string reaches stdout.
- [x] **3.2 Status claim and effort per leg.** In the same script: `status_claim` ∈ {`DONE`,
      `DONE_WITH_CONCERNS`, `NEEDS_CONTEXT`, `BLOCKED`, `CHECKPOINT`, `none`}, read line-anchored
      from the last assistant text or a final handback message only (a `DONE` inside a Bash input
      is `none`); `effort` from the leg's records, `null` when absent, `mixed` when uneven.
      verify: `npx vitest run tests/scripts/subagent_return_report.test.ts` — one fixture per enum
      value, one with `DONE` in a tool input → `none`, effort present/absent/mixed.
- [x] **3.3 The effort enum covers the host's levels.** Add `xhigh` to `effort.enum` in
      `src/scripts/schemas/subagent.schema.json:43` and `src/scripts/schemas/skill.schema.json:228-233`
      (`src/scripts/_lib/subagent_native_fields.ts:23` projects verbatim). No shipped definition
      gains a pin.
      verify: `npx vitest run tests/scripts/subagent_contract.test.ts` with a new case that accepts
      `xhigh` and rejects `ultra`.
- [x] **3.4 The payload-capture stub stops listing an answered question.** Add one dated line to
      `agents/roadmaps/stubs/road-to-subagent-payload-capture.md` row "Phase 0 Step 4": the
      assertion that `agent_id`/`agent_type` reach tool events inside a subagent is observed at
      `agents/evidence/analysis/host-output-rewrite-probe-2026-10-20.md:351` (n=1, host 2.1.304);
      the verbatim-capture half stays open.
      verify: `grep -c 'host-output-rewrite-probe-2026-10-20.md' agents/roadmaps/stubs/road-to-subagent-payload-capture.md` → ≥ 1.

## Decisions

| Decision | Alternatives | Reason | Revisit if |
|---|---|---|---|
| 2.1 — the first entry of an id decides, before the status filter, in both iterators | dedup after the status filter (an excluded first copy lets a later active copy through) | one rule for `_iter_curated_entries` and `_iter_curated_entries_all`, so the hit list and the skipped list never disagree about an id; a bad union merge duplicates blocks verbatim, so the two copies carry the same status | a legitimate flow writes a second, newer entry under an existing id instead of superseding it |
| 2.1 — the template twin gets the same lines | dev side only | `lint_memory_twin_parity` holds `memory_lookup.ts` to a shrink-only ceiling; changing one side would grow the divergence | the twin becomes `exact` |
| 3.1 — `targets` counts distinct targets of successful writes only | every attempted target | a failed write changed nothing, and the report's question is what a leg wrote | the return-gate probe needs attempted targets separately |
| 3.1 — `model` falls back to the leg's last assistant `message.model` when the sidecar has none | `null` | 167 of 400 sampled sidecars carry `model`; the transcript record states which model served the leg | the sidecar starts carrying `model` on every leg |
| 3.1 — an agent type, model, spawn depth or effort that is not identifier-shaped prints as `other` | print verbatim | the sidecar's fields are host-written but unvalidated, and the output contract is numbers and enums | never |

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-11-03 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Concurrency expression breaks workflow parsing | implementation | A malformed `${{ }}` in `concurrency` makes every PR red | Test parses the YAML; keep the expression to `event_name`/`run_id`/`ref` only | Phase 1 — The merge surface reports what it checked |
| 2 | Report leaks transcript content | implementation | A path or prompt string reaches stdout | Output schema is numbers and enums; a test asserts the absence | Phase 3 — A subagent return the tree can witness (read-only) |
| 3 | Dedup hides a legitimately repeated id | implementation | Two distinct entries share an id | `check_memory.ts:391-392` already fails on duplicate ids, so first-wins only removes merge debris | Phase 2 — Shared memory does not double an entry |

## Acceptance Criteria

- [x] AC-1 — A duplicate OQ id fails a check that also runs on `merge_group`.
- [x] AC-2 — An all-skipped `Tests result` says "nothing ran"; the pre-cut gate stops on a
      cancelled or foreign run.
- [x] AC-3 — `subagent_return_report` prints write counts, status enum, model and effort per agent
      type from fixtures, with no path or id in its output.

## Non-goals

- Enabling the merge queue, changing the required-check set, or any ruleset write (owner, stub).
- Labels, comments or claims written onto open PRs (external communication; owner decision).
- Any cross-machine coordination layer, `refs/agents/*` namespace or peer cache (gated on an owner
  ADR that it is outside the cancelled team-context surface).
- A blocking return gate on the Phase 3 numbers (parked in the return-gate stub).
- Vendoring or copying the external merge-coordination plugin or the external agent-mail
  reference.
