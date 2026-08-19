---
complexity: lightweight
execution:
  mode: autonomous
parent_roadmap: road-to-long-horizon-execution
estate_offset_exempt: >-
  Offset in the same change by archiving road-to-long-horizon-execution, whose sole deferred item
  this roadmap carries. Net estate change is zero; the field is present because the ratchet reads
  the addition before it reads the archival.
---

# Road to a run-continuation engagement anybody can point at

> **Source:** the sole deferred acceptance criterion of
> `road-to-long-horizon-execution`, carried here under the preservation
> test in `roadmap-progress-sync § Who resolves it` rather than dropped
> at that roadmap's archival. AI council 2026-08-19, unanimous 2/2
> (anthropic/claude-sonnet-4-5 + openai/codex-default, blind peer
> review): fix the blocker now, carry the criterion, close it only on a
> recorded run.

## Context

`run-continuation` is the stop-slot concern that re-engages a run while
its claimed roadmap still has open steps. It shipped, it is unit-tested
(21 cases), it is integration-tested against the real dispatcher (7
cases) — and it had **never fired once** outside a test.

The cause was a defect, not a missing step, and it is fixed: the run
contract had two halves resolving different roots. `sessions:claim`
wrote the claim under `process.cwd()` (the operator's worktree) while
the concern read it under `--project-dir` (the parent checkout). In a
worktree those are different trees, so the concern found no contract,
took its `contract absent → no-op` rung, and wrote **no event** — an
empty ledger that looks exactly like a healthy idle run. The claim now
lives in the git common dir beside the session register.

What remains is not work. It is an **observation**, and it is the one
thing the fix cannot supply: a real run, started from a worktree, that
engages and leaves the event behind.

## Phases

### Phase 0 — Observe one engagement

- [ ] **0.0** A `process-full` run started from a worktree, under a
      `sessions:claim`, writes at least one `engage` line to
      `agents/runtime/state/run-continuation.jsonl`. Record the run id,
      the roadmap, and the iteration count the ladder reached.
      The event is the evidence; a green test is not, and the reason is
      the whole point of this roadmap — the integration test passes the
      SAME root to writer and reader, which is the one arrangement in
      which the defect was invisible. Only a real two-tree run proves
      it.
      `verify:` `cat agents/runtime/state/run-continuation.jsonl`

- [ ] **0.1** The parent criterion closes on that evidence: *"a
      `process-full` contract run finishes a 3-phase roadmap with zero
      synchronous contacts, re-engaging across turns, and opens the
      PR."* Half of it was observed on 2026-08-19 — the zero-contact
      property — but it came from the operator's standing mandate, not
      from the mechanism, and attributing it to the mechanism is the
      attribution error the parent roadmap's own falsification criteria
      are written against. Step 0.0 supplies the missing half.
      `verify:` `./scripts-run src/scripts/interruption_report --root <main-checkout>`

## Acceptance criteria

- [ ] `run-continuation.jsonl` holds at least one `engage` event from a
      worktree-started run, with the run id recorded here.
- [ ] The AUTONOMY AXIS in `interruption_report` reports a non-zero
      median re-engagement count for at least one run.

## Risk Register

<!-- risk-review: v1 | reviewed: 2026-08-19 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The observation is claimed from a green test rather than a real run | product | The defect survived a release precisely because a passing integration test looked like proof; accepting a test as the evidence here would repeat that exactly. | Step 0.0 names the `.jsonl` line as the artifact and says in its own text why a test cannot substitute. | Phase 0 |
| 2 | The engagement fires but the ladder halts on the wrong rung | implementation | An `engage` event proves the contract was found, not that the termination ladder behaves; a stall-halt on the first iteration would satisfy the letter of 0.0. | 0.0 records the iteration count reached, so a degenerate single-iteration engagement is visible in the evidence rather than hidden by it. | Phase 0 |
| 3 | This roadmap becomes the indefinite deferral it was created to avoid | product | Carrying an item into a follow-up is exactly the shape both council seats named in their strongest counter — a named destination is not a schedule. | The criterion closes on the FIRST qualifying run rather than on a dedicated effort, so any future `process-full` in a worktree discharges it as a side effect. If none has by the next task boundary it is raised again per `active-remediation`, not aged out. | Phase 0 |
