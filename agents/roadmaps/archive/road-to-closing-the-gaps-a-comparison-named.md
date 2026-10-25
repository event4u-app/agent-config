---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
estate_offset_exempt: "Round inbox-2026-10-au (a third comparison against deny group S4) verified its ~200 points at e494248c3c: most already exist or are owned in later/ and stubs/, and the seven gaps below have no owner. Search: grep -rlF -e cmd_analyze_session -e checklists/database.md -e trust-escalation -e literal-url -e 'requires_skills cycle' over agents/roadmaps/*.md, later/ and stubs/ returned nothing. The owner asked in the invocation for this round's roadmap to be processed now, and four active roadmaps leave one WIP slot."
relates:
  - slug: road-to-a-graph-that-wins
    relation: disjoint
    note: "Owns measuring the graph against external repositories. Phase 5 here adds one default-off mechanism with a fixture and measures nothing; enabling it stays with that roadmap's precision bar."
  - slug: road-to-breadth-with-depth
    relation: disjoint
    note: "Owns the capability gap register and new skills. Phase 1 here adds checklist rows to an existing skill and no skill."
---
# Road to closing the gaps a comparison named

> **Source:** `agents/tmp.old/inbox-2026-10-au/` — a third external comparison
> against deny group S4, a master plan and eight workstream plans plus the chat
> they came from. Verified point by point at `e494248c3c`; the round's ledger is
> in the PR description.

## Goal

Every gap the comparison named that this tree can close without spend, network
or an owner decision is closed: the review path checks data integrity, API
compatibility and doc drift; three judges carry a seeded defect and a clean
control; a `requires_skills` cycle fails CI; `analyze-session` says what a
session cost and which refusals stopped it; the trust-and-safety contract
describes only files that exist; and the graph can link a client URL literal to
the route it calls, switched off until measured.

## Phase 1 — Review rows the comparison found missing

- [x] **1.1 Add transaction-boundary and lost-update rows to the database <!-- receipt: class=R0 · shadow · would-skip=council,evidence,retro,revalidation,review · bound=every touched path is non-behavioural -->
      checklist.** `src/skills/code-review/checklists/database.md` has an N+1 row
      and no row for a multi-step write outside a transaction or a check-then-insert
      race (comparison R3).
      verify: `grep -cE 'Transaction boundary|Lost update' src/skills/code-review/checklists/database.md` -> /^2$/
- [x] **1.2 Add a contract-compatibility row to the backend and frontend <!-- receipt: class=R0 · shadow · would-skip=council,evidence,retro,revalidation,review · bound=every touched path is non-behavioural -->
      checklists.** A removed or renamed response field, a changed status code or
      error shape, or a renamed route has no row today (comparison R4).
      verify: `cat src/skills/code-review/checklists/backend.md src/skills/code-review/checklists/frontend.md | grep -c 'Contract compatibility'` -> /^2$/
- [x] **1.3 Add a docs-follow-code row.** The Doc-Impact obligation lives in a <!-- receipt: class=R0 · shadow · would-skip=council,evidence,retro,revalidation,review · bound=every touched path is non-behavioural -->
      rule only; no review checklist asks it for a code diff (comparison R10).
      verify: `cat src/skills/code-review/checklists/backend.md src/skills/code-review/checklists/frontend.md | grep -c 'Docs follow code'` -> /^2$/

## Phase 2 — A seeded defect and a clean control per judge

- [x] **2.1 Author `evals/evals.json` for judge-bug-hunter, judge-test-coverage <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=unrecognised path shape: src/skills/judge-bug-hunter/evals/evals.json -->
      and judge-code-quality.** Each carries one planted defect (swallowed
      exception; test without assertion; duplicated block) and one clean control,
      in the existing code-review eval format. Grading stays unrun until the runner
      exists (owned by the skill-uplift stub).
      verify: `./scripts-run src/scripts/lint_eval_specs` -> 0

## Phase 3 — A dependency cycle fails CI

- [x] **3.1 Detect cycles in `requires_skills`.** `check_skill_requires.ts` <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/check_skill_requires.ts -->
      checks referential integrity and co-availability, never a cycle.
      verify: a test with a two-skill cycle fixture fails before the change and passes after; the real tree still exits 0.

## Phase 4 — "Why did it stop" names cost and refusals

- [x] **4.1 Read the session cost record in `analyze-session`.** The report prints <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/_cli/cmd_analyze_session.ts -->
      "not tracked" while `src/scripts/cost/track.mjs` writes a session-keyed
      `agents/cost-tracking/sessions.jsonl`.
      verify: a test with a fixture cost record shows its figures; without one the report says no record exists.
- [x] **4.2 List turn-end refusals in the same report.** The report omits the <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/_cli/cmd_analyze_session.ts -->
      refusals the turn-end gate records; `src/scripts/_cli/cmd_analyze_session.ts`
      now reads them through that gate's existing parser.
      verify: a test with a fixture refusal shows its count and last reason.

## Phase 5 — Contract truth and the cross-stack edge

- [x] **5.1 Make `docs/contracts/trust-and-safety.md` describe existing files.** <!-- receipt: class=R0 · shadow · would-skip=council,evidence,retro,revalidation,review · bound=every touched path is non-behavioural -->
      Its §4 names an installer file under `packages/core/` that does not exist as
      the gate's implementation; other paths are Python-era.
      verify: every repository path the contract names as an implementation resolves (`test -e` per path; the gitignored release manifest and the never-written installer file, named as such, excepted), and §4 states what reads `trust_summary` today.
- [x] **5.2 Add a default-off `literal-url` convention mechanism.** A JS/TS <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/code_graph/conventions_default.ts -->
      `fetch`/`axios` URL literal that matches exactly one route node gets an
      inferred edge to it; the comparison's retrieval null names string-keyed
      consumers as its cause. Off in `DEFAULT_MECHANISMS` until a precision
      measurement clears the 90 % bar.
      verify: a Laravel-route plus React-fetch fixture links the two with the mechanism on and does not with it off.

## Not taken from this round

- Head-to-head benchmark against S4 and every KPI in the master plan — owner
  question OQ-14; the assurance-benchmark stub carries the arrival.
- Language-server resolution, a task-DAG coordinator, per-provider queues, a
  unified explain view, a worktree-boundary write guard, non-PHP stack reviewers
  — each is owned in `later/` or `stubs/` or needs spend or a host session.
- Laravel container bindings and events, JSX usage edges — declined: ADR-298
  adds overlays only on fixture demand, and file imports already carry the chain.
- A hook-incident runbook — declined: `docs/troubleshooting.md` already walks the
  "hooks stopped firing" case.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-25 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | literal-url precision | implementation | A URL literal matches the wrong route and impact answers lie | Default off; edge only on a single match; tagged inferred | Phase 5 — Contract truth and the cross-stack edge |
| 2 | eval fixtures read as evidence | implementation | A reader takes unrun fixtures for a measured judge | Grading left null; the step says no run happened | Phase 2 — A seeded defect and a clean control per judge |

## Acceptance Criteria

- [x] AC-1 — The code-review checklists carry the data-integrity,
      contract-compatibility and docs-follow-code rows.
- [x] AC-2 — A `requires_skills` cycle makes `check_skill_requires` exit non-zero.
- [x] AC-3 — `analyze-session` reports a session's recorded cost and its
      turn-end refusals.
- [x] AC-4 — Every path the trust-and-safety contract names exists.
- [x] AC-5 — The `literal-url` mechanism exists, is off by default, and its
      fixture links client and route only when switched on.
