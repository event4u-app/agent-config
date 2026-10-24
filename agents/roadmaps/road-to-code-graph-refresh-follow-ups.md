---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
# relates: roadmap:context 2026-10-24 — scanned 1108 roadmap files, 2 PRs, 895 branches; the cited-path
# hits (consumer-invocations, decision-closure, one-detector, placeholders, typed-grants) share a file
# with PR #2604 only, not a step. No active sibling on the topic.
relates:
  - slug: road-to-a-map-that-draws-itself
    relation: extends
    note: >
      Its map and its step-5.1 refresh are what this hardens: one-generation publication of agents/map/
      and the install boundary of the git hooks that redraw it.
estate_growth_exempt: "Owner-instructed 2026-10-24 on PR #2604: the three items the code-graph auto-refresh ratification recorded but did not resolve are done in the same PR. One active roadmap for the length of that PR; it is completed and archived before the PR merges, so the trunk never carries it."
---
# Road to code graph refresh follow ups

> **Source:** the ratification record
> `agents/evidence/ratifications/code-graph-auto-refresh-20261023.md`, section
> "Recorded, not resolved here" — three findings of the eight-round AI-council review
> of the code-graph auto-refresh (2026-10-23), taken on by the owner on 2026-10-24.

## Goal

A council bundle that contains a comparison such as `x.token === 'string'` reaches the
seats; a reader of `agents/map/` never sees one generation's `map.json` beside another
generation's pages; and this package's development git hooks cannot be installed into
any repository other than this package's own checkout, with the trust model they rely on
written down where the hooks are generated.

## Phase 1 — A comparison is not an assignment

- [x] **1.1 Repair the shared assignment head.** `assignmentSource` in
      `src/scripts/_lib/egress_rules.ts` ends every credential-assignment pattern in
      `[:=]`, so `token === 'string'` and `token == x` read as an assignment whose value
      is `==`; the council bundle then replaces that value and refuses every payload
      containing `==` (measured on 2026-10-23, round 2 of the ratification). An `=`
      followed by `=` or `>` is a comparison or an arrow, never an assignment.
      verify: `npx vitest run tests/scripts/_lib` with new cases — `token === 'x'`,
      `token == x`, `token => x` yield no span; `token = "abc"`, `token: abc`,
      `api_key=abc` still do; red with the old head restored.
      *Done 2026-10-24:* head is `(?::|=(?![=>]))`; the comparison cases were red
      before the fix, the assignment cases green before and after. The four
      exposed legacy spellings pinned in `egress_legacy_superset.test.ts` and the
      consumer template literal in `check_memory.ts` follow the same head — the
      pin is the change, not a loosening. Defect-pattern search: `[:=]` heads
      outside `assignmentSource` occur only in those frozen test spellings.
- [x] **1.2 Prove it on the surface that failed.** Run the council bundle's egress over
      the line that blocked the round.
      verify: `CouncilEgress.replace` + `check` over `typeof o.token === 'string'` returns
      no refusal; a test pins it.

## Phase 2 — The map is published as one generation

- [ ] **2.1 Write into a sibling directory, then swap.** `buildMap` in
      `src/scripts/code_graph/map.ts` writes `map.json`, `MAP.md`, the area pages and
      `index.html` one file at a time into the live directory, so a reader opening it
      mid-redraw sees a mix. Write the whole generation into a sibling temp directory and
      replace the live one by rename; anything in the old directory the writer does not
      produce is carried over, never dropped.
      verify: a test that interrupts a redraw after the first file (an injected throw)
      finds the previous generation intact; a test with a foreign file in the map
      directory finds it still there after a redraw; red with in-place writes restored.

## Phase 3 — The development hooks stay in the development checkout

- [ ] **3.1 Refuse to install anywhere but this package's own checkout.**
      `src/scripts/install-hooks.sh` writes hooks that run `./agent-config`,
      `./scripts-run`, `task` and `npm` from the checkout. That is the trust model of
      this package's development tree — the developer already runs that code — and it is
      wrong anywhere else: run from `node_modules/@event4u/agent-config/`, the installer
      would resolve the CONSUMER's git directory and install these hooks there. Install
      only when the installer's project root is the git top-level AND its
      `package.json` names `@event4u/agent-config`.
      verify: a test runs a copy of the installer from a consumer-shaped tree
      (`<consumer>/node_modules/@event4u/agent-config/src/scripts/install-hooks.sh`
      inside a git repo) and finds exit non-zero and no hook written; the existing render
      tests still pass; red with the guard removed.
- [ ] **3.2 Write the trust model down where the hooks are generated.** The header of
      `install-hooks.sh` states what the hooks execute, why that is acceptable in this
      checkout, and what the guard of 3.1 enforces — so the next reviewer reads the
      boundary instead of rediscovering it.
      verify: `grep -n "TRUST MODEL" src/scripts/install-hooks.sh` names the boundary
      and the guard.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-24 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The assignment fix narrows a real detection | implementation | A head that excludes `==` and `=>` could also stop matching a genuine assignment the rules caught before. | The existing egress rule tests run unchanged, and 1.1 adds positive cases next to the negative ones. | Phase 1 — A comparison is not an assignment |
| 2 | The swap drops files a project keeps in agents/map/ | implementation | Replacing the directory by rename removes anything the writer does not produce. | 2.1 carries foreign entries over and tests it. | Phase 2 — The map is published as one generation |
| 3 | The install guard blocks a legitimate developer setup | implementation | A worktree or a renamed checkout could fail the top-level or name check. | The render tests run from a worktree; the guard reads the top-level from git, not from a path. | Phase 3 — The development hooks stay in the development checkout |

## Acceptance Criteria

- [ ] AC-1 — A council bundle containing `typeof o.token === 'string'` passes the egress
      check, and a genuine `token = "…"` assignment is still replaced.
- [ ] AC-2 — No reader of `agents/map/` can observe files from two generations, and a
      redraw keeps files it did not write.
- [ ] AC-3 — The development hooks cannot be installed from a consumer's
      `node_modules`, and the trust model they rely on is stated in the installer.
