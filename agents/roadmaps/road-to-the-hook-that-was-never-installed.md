---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
relates:
  - slug: road-to-deterministic-defect-detectors
    relation: disjoint
    note: >
      That roadmap builds detectors for defect classes in authored content.
      This one detects a stale COPY of a generated file — the installed git
      hook against the installer that writes it. No detector is shared, and
      neither changes the other's scan scope.
estate_offset_exempt: "Cannot be offset. All twelve active roadmaps are unstarted, so any archive would be archiving unfinished work. The nearest sibling by shape, road-to-deterministic-defect-detectors, detects defects in authored content; a staleness check on an installed copy of a generated file is a different subject, and folding it in would replace that roadmap's scope rather than extend it."
estate_growth_exempt: "Claims the one concern PR #1843 adds (push-settle, concern_count 56 → 57). That PR made a push refuse a stale base and report whether it finished; measured over the 50 PRs before 2026-09-04, 25 needed a base merge and 20 needed a CI-repair commit. The concern is the second half of that mechanism and has no offsetting retirement — no existing concern reads git's ref-advance report, and the nearest neighbour (pr-url-reminder) is silent on every push that does not create a PR."
---
# Road to the hook that was never installed

> **Source:** PR #1843 (`feat: a push closes its own loop`) added a base-freshness
> gate to the pre-push hook and, in writing it, measured the hook it was editing:
> the INSTALLED `.git/hooks/pre-push` in this repository was **113 lines** against
> a source body of ~146. It was missing header revisions merged on 2026-08-30, so
> it had been stale for days with no signal anywhere. That PR recorded the gap in
> `src/skills/git-workflow/references/push-closes-its-loop.md` § "The gap this
> change does NOT close" and deliberately did not fix it, rather than smuggle a
> third mechanism into a change about two.

## Goal

A contributor whose `.git/hooks/pre-push` no longer matches what
`src/scripts/install-hooks.sh` would write is told so, by something other than a
person noticing. Today that mismatch is silent and unbounded: the installer runs
on the package manager's post-install lifecycle step or when someone runs it by
hand, and between those two events every gate added to the hook is inert on that
checkout while appearing — in the source, in CI, in the skill that documents it —
to be live.

The failure is not hypothetical and is not about one hook. It is the general
shape of an INSTALLED copy of a generated file: the source is gated, the copy is
not, and the copy is what runs.

## Phase 1 — Say when the installed hook is stale

- [ ] **1.1 Compare the installed hook against the heredoc that writes it.**
      `install-hooks.sh` emits the pre-push and pre-commit bodies from `cat > … <<'EOF'`
      blocks; `tests/scripts/prepush_delete_only.test.ts` already extracts one of
      them, so the extraction is solved and only the comparison is new. Report a
      mismatch, name `task install-hooks` as the fix, and say which hook.
      verify: a test that writes a deliberately truncated hook into a scratch
      `.git/hooks/` and asserts the check names it, plus the inverse — a
      freshly-installed hook reports clean. Both directions, or the check is
      untested in the direction that matters.

- [ ] **1.2 Re-install from `post-merge` / `post-checkout`, where the trigger
      already fires.** The first version of this step claimed the check had no
      obvious carrier and named a CI gate and a `session_start` concern as the
      only candidates. That was wrong, and it was wrong for the ordinary reason:
      nobody looked. `install-hooks.sh` already writes `post-merge`,
      `post-checkout`, `post-commit` and `post-rewrite`, and the first two
      already carry an auto-sync block that diffs `prev..new` and acts on a path
      list. One of its two branches matches
      `src/(cli|server|shared|install|scripts)/` — so a pull that changes
      `src/scripts/install-hooks.sh` is **already detected today**; that branch
      just rebuilds the CLI and never re-runs the installer. The work is
      therefore an action in an existing `if`, not a new mechanism, a new trigger
      or a new budget.
      This also fires on the event that CAUSES the staleness (a pull or a branch
      switch that moves the installer), which neither rejected candidate does: a
      CI gate never sees a contributor's `.git/`, and a session-start check would
      report the staleness without being able to say when it appeared. It
      bootstraps once — after a single manual install the hooks maintain
      themselves — and worktrees share `.git/hooks` through the common dir, so
      one repair covers every worktree at once.
      verify: a test that runs the installed `post-merge` body against a
      `prev..new` pair whose diff touches `src/scripts/install-hooks.sh` and
      asserts the hook body was rewritten, plus the inverse — a diff touching
      neither leaves it byte-identical. Both directions, or the re-install is
      untested in the direction that matters.

- [ ] **1.3 Do not add a concern without paying its ledger.**
      If 1.2 lands on a hook concern, it owes a row in
      `agents/decisions/concern-admissions.jsonl` and a `concern_count` claim
      against `check_estate_count` — the two surfaces PR #1843 discovered by
      going red on them, in that order, on two separate pushes.
      verify: `check_concern_admissions` and `check_estate_count` both exit 0 on
      the branch, before it is pushed rather than after.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-09-04 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | A hook that repairs hooks fails silently | implementation | `post-merge` is `\|\| true` throughout by design — it must never block a pull. A re-install that fails there fails invisibly, which is the same silence this roadmap exists to remove, one layer over. | 1.2's verify asserts the rewrite HAPPENED rather than that the hook exited 0, so a swallowed failure is a red test. The installer's own output stays on stderr for a human who is watching. | Phase 1 — Say when the installed hook is stale |
| 2 | A byte-comparison is too strict to be useful | implementation | The installer may legitimately interpolate paths into the hook body, so the installed copy is not always byte-identical to the heredoc. A check that fires on every install would be turned off within a week. | 1.1's verify demands the inverse direction — a freshly-installed hook must report clean — which fails loudly if the comparison is stricter than the installer is deterministic. | Phase 1 — Say when the installed hook is stale |

## Acceptance Criteria

- [ ] AC-1 — A checkout whose `.git/hooks/pre-push` predates the current
      `install-hooks.sh` body produces a message naming the mismatch and the fix,
      from a carrier that is bound and named. A checkout that just ran the
      installer produces nothing.
- [ ] AC-2 — A pull or branch switch that moves `src/scripts/install-hooks.sh`
      leaves the installed hooks matching it, without anyone running a command.
      One manual install is still required to bootstrap a fresh clone, and the
      README says so rather than leaving it to be discovered.
- [ ] AC-3 — The consumer question is answered in writing, either way. A
      consumer install today writes **no git hooks at all** — `src/install/`
      contains no reference to `.git/hooks`, and npm's `prepare` does not run
      for a registry dependency — so the pre-push gate is a maintainer-only
      mechanism. Whether consumers should get it is a separate decision; what
      this roadmap owes is that it stops being an unstated one.
