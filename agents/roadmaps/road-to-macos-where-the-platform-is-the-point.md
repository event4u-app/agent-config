---
complexity: structural
status: ready
execution:
  mode: autonomous
estate_offset_exempt: "Round inbox-2026-10-w verified at 5dcfa13a6 that tests.yml requests 13 macOS jobs on every PR and every push to main (26 jobs, tests.yml:75-769) against GitHub's 5-concurrent macOS ceiling, and that on PR #2569 every ubuntu job started within 63 s while macOS jobs waited 5.7-33 min. The in-repo half of the merge-queue transfer (merge_group on every required workflow, which the admin stub road-to-main-protection-ruleset-changes names as the fixed precondition) is still 0 of 2. No active roadmap owns macOS placement; the stub owns only the ruleset write, which this file does not perform."
relates:
  - slug: road-to-main-protection-ruleset-changes
    relation: extends
    note: "Stub, repo-admin only. Phase 3 here does the in-repo precondition it names (merge_group on every required check) and records it there; enabling the queue and changing the required set stay with that stub."
  - slug: road-to-ci-time-that-counts-the-queue
    relation: extends
    note: "Phase 1's decision is evidence-gated on that file's per-OS attribution (its 1.3)."
  - slug: road-to-merge-surface-zero
    relation: disjoint
    note: "later/. Its blocker B2 is the merge queue itself; nothing here enables it."
  - slug: road-to-a-test-matrix-that-finishes-together
    relation: disjoint
    note: "Balances shards on both OSes; this file decides which macOS legs a PR requests."
---
# Road to macOS where the platform is the point

> **Source:** `agents/tmp.old/inbox-2026-10-w/` — the transcript's question
> *"Matrix Runner? Irgendwas anderes?"* <!-- md-language-check: ignore --> and
> two supplied plans that both answer it the same way: more matrix makes it worse,
> because the time is lost waiting for one of five macOS slots, not computing.
> Verified against `main@5dcfa13a6`. **Fourth arrival of the merge queue** (two
> earlier feedback rounds and an inbox round on 2026-10-06 named it); the ruleset
> write is owner/admin-reserved and recorded on its stub, not decided here.

## Goal

A typical code PR asks for the macOS legs where macOS behaviour is what is being
tested, not for all thirteen; a PR touching platform-sensitive paths still gets
the full set; `push: main` keeps the full matrix; and the repository is ready for
a merge queue the moment an admin enables one — with no macOS suite losing its
run on the way to `main`.

## Context — verified at `5dcfa13a6`

- macOS legs per run (`tests.yml`): install-tests ×4 (:75-80), install-aux (:112),
  node-tests ×4 (:223), golden (:540), svg-witness (:594), collector-lifecycle
  (macOS-only, :658), workspace (:769) — 13.
- PR #2569 Tests (Actions API): macOS jobs started 5.7-33 min after creation;
  the four macOS install shards ran 58 s-2 min each but took four queue entries.
- ADR-223 forbids demoting a **required** check on cost grounds. No macOS job is
  required (`branch-protection-policy.md:55`, live ruleset: two checks, `strict`
  off); moving a non-required leg between PR and `push: main` is placement.
- Ruleset `17749383` live: no `merge_queue` rule; 0 workflows declare
  `merge_group`.

## Phase 1 — Decide the PR tier on evidence

- [ ] **1.1 In-repo path classifier.** `ci_platform_scope` reads the PR's changed
      paths (`git diff --name-only` against the merge base; no third-party
      changed-files action) and prints `macos=full|tier`: `full` when any path is
      under the platform-sensitive set (`src/install/**`, `setup.sh`, `scripts/install*`,
      `src/scripts/hooks/**`, collector/daemon code, `.github/workflows/tests.yml`,
      `package.json`, `package-lock.json`), and when the classifier cannot decide.
      verify: unit tests cover a docs-only diff (`tier`), an installer diff
      (`full`), an empty diff (`full`) and an unreadable base (`full`).
- [ ] **1.2 Council decision on the tier set.** Put the per-OS attribution reading
      (road-to-ci-time-that-counts-the-queue 1.3) and the proposed PR tier
      (install, install-aux, collector-lifecycle, workspace on macOS; node, golden,
      svg-witness macOS legs on `full`, label `ci:macos`, and every `push: main`)
      to the council; record the verdict and any suite the evidence forces back
      into the PR tier.
      verify: the council record exists under `agents/evidence/council/` and the
      tier set in 1.3 matches its verdict.
- [ ] **1.3 Wire the tier.** A `platform-scope` job runs 1.1; the macOS legs
      outside the decided tier run on a PR only when it says `full` or the PR
      carries `ci:macos`; `push: main` and `workflow_dispatch` are unchanged.
      verify: on this PR's CI (which touches `tests.yml`, so `full`) every macOS
      leg runs; a unit test of the job-condition expression covers the
      `tier`/`full`/label cases.

## Phase 2 — Fewer queue entries for the same macOS work

- [ ] **2.1 One macOS install job instead of four shards.** macOS runs
      `test_install.sh` unsharded with its parallelism sized to the runner; ubuntu
      keeps its four shards.
      verify: this PR's CI shows one macOS install job running the full install
      suite and passing.

## Phase 3 — Merge-queue ready, not merge-queue enabled

- [ ] **3.1 `merge_group` on both required workflows.** `consistency.yml` and
      `standing-payload-delta.yml` (and `tests.yml`) declare `merge_group`, with
      every `github.event.pull_request.*` expression guarded so it evaluates on a
      merge-group event; required checks keep running unconditionally there.
      verify: `grep -l "merge_group" .github/workflows/consistency.yml .github/workflows/standing-payload-delta.yml` -> 0
- [ ] **3.2 One always-run `tests-result` aggregate job** (`needs:` all Tests jobs,
      `if: always()`, red when any needed job failed or was cancelled) so a
      future required-set change pins one stable name instead of shard names.
      verify: this PR's CI reports a `Tests result` check that is green only with
      every needed job green.
- [ ] **3.3 Record the in-repo half on the admin stub.** Update the stub's live-state
      table (`merge_group` declarations, the aggregate check name) and its arrival
      count; the ruleset write stays with its named producer.
      verify: `grep -n "Arrivals" agents/roadmaps/stubs/road-to-main-protection-ruleset-changes.md` -> 0

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| C1-C5, C7 | deterministic | evidence | Not decisions: frontmatter, `relates` notes, source block, goal and a phase heading describing merge-queue readiness; no operation | `closure_scan` keyword matches on "merge" | any of them gains an imperative |
| C6 | deterministic | evidence | Not a decision: `git diff --name-only` is a read | step 1.1 | — |
| C8 | reversible-technical | agent | Declaring `merge_group` in workflows is a reversible file edit and inert until an admin enables a queue; enabling it stays with the admin stub | live ruleset `17749383` has no `merge_queue` rule | the step is widened to write the ruleset |
| D1 | critical-technical | agent | Procedure: which macOS legs a PR requests is put to the council at step 1.2 on the attribution reading; this row is replaced by `council:<record>` there | ADR-223 governs required checks only; no macOS job is required | the attribution reading changes |
| D2 | destructive-owned | evidence | Out of scope here: enabling the merge queue and changing the required set were transferred to the admin stub by council disposition B | stub `road-to-main-protection-ruleset-changes`, council disposition B | — |

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-21 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | A macOS-only defect reaches main | product | A suite moved off the PR tier would have caught a macOS-only red before merge | Evidence-gated by 1.2; `push: main` keeps the full set, so a regression is caught on the next merge; platform paths escalate to `full` | Phase 1 — Decide the PR tier on evidence |
| 2 | Classifier under-escalates | product | A platform-relevant path is missing from the list and the PR skips macOS | Unknown or undecidable → `full`; the list lives in one script with tests | Phase 1 — Decide the PR tier on evidence |
| 3 | `merge_group` code path untested until enabled | implementation | The guarded expressions are only exercised once an admin enables the queue | 3.1 keeps the merge-group path free of PR-only expressions, and the stub records that the first queue run is the first live test | Phase 3 — Merge-queue ready, not merge-queue enabled |
| 4 | Unsharded macOS install too slow | implementation | One job takes longer than four parallel shards once it starts | 2.1 measures it on this PR; revert to shards if its runtime exceeds the 4-shard queue saving | Phase 2 — Fewer queue entries for the same macOS work |

## Acceptance Criteria

- [ ] AC-1 — A docs-only PR requests only the decided macOS tier; a PR touching a
      platform path requests every macOS leg; `push: main` requests all 13.
- [ ] AC-2 — Both required workflows declare `merge_group`, and the admin stub
      records it.
- [ ] AC-3 — The macOS tier set is backed by a recorded council verdict citing the
      per-OS attribution reading.
