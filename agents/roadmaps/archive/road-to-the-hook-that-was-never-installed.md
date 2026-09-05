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

- [x] **1.1 Compare the installed hook against the heredoc that writes it.**
      `install-hooks.sh` emits the pre-push and pre-commit bodies from `cat > … <<'EOF'`
      blocks; `tests/scripts/prepush_delete_only.test.ts` already extracts one of
      them, so the extraction is solved and only the comparison is new. Report a
      mismatch, name `task install-hooks` as the fix, and say which hook.
      verify: a test that writes a deliberately truncated hook into a scratch
      `.git/hooks/` and asserts the check names it, plus the inverse — a
      freshly-installed hook reports clean. Both directions, or the check is
      untested in the direction that matters.
      <!-- DONE: src/scripts/check_installed_hooks_fresh.ts. CORRECTED THE
      METHOD: it does NOT compare against the heredoc. install-hooks.sh writes
      post-merge and post-checkout as a heredoc PLUS an appended auto-sync block
      (src/scripts/install-hooks.sh:435-499), and interpolates the hook name into
      both, so no slice of the source file equals an installed body — a
      heredoc-slice comparison would have been wrong for two of six hooks. The
      gate instead runs the real installer with a new AGENT_CONFIG_HOOKS_DIR seam
      (src/scripts/install-hooks.sh:16-27, seam at :23-24) pointed at a scratch dir and
      byte-compares the six rendered files against .git/hooks. That also settles
      risk-register row 2 structurally rather than by tolerance: anything the
      installer does deterministically compares equal by construction.
      LIVE POSITIVE, not a planted one — run on this branch it found pre-push,
      post-merge and post-checkout all stale in the real shared hooks dir
      (installed pre-push b5f9e859a74b vs source f319d801a8d8) and named
      `task install-hooks`. Inverse proven live too: a scratch dir the installer
      had just written reports `6 installed hook(s) match`, exit 0. Also handles
      never-installed (exit 0, says so, still prints `scanned: 6` via
      reportScanned so it cannot be a vacuous green) and ignores unmanaged files
      such as the pre-commit.bak-* backups sitting in the real hooks dir.
      Deliberately NOT registered in task ci / task preflight / gate-coverage.yml:
      CI never sees a contributor's .git/hooks, so a CI-registered run would scan
      nothing and report a green meaning "no data" — the vacuous-pass class the
      2026-07 gates-that-cannot-fail audit catalogued. Reasoning is in the script
      docstring; correctness is covered by vitest, which does run in CI.
      12 tests in tests/scripts/check_installed_hooks_fresh.test.ts. Sensitivity
      proven by three sabotages, each restored: forcing state:'match' reds 4
      tests, removing either carrier reds 2, renaming the pre-push echo line reds
      the ordering test. -->

- [x] **1.2 Re-install from `post-merge` / `post-checkout`, where the trigger
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
      <!-- DONE, WITH THE RE-INSTALL REFUSED. The step's position was right and
      its action was wrong. What shipped: the detector runs from inside the
      existing `if` in the auto-sync block (src/scripts/install-hooks.sh:476-494),
      on the event that causes the staleness, and REPORTS on stderr. It does not
      re-install. Two findings stopped the re-install, and both are recorded in
      src/skills/git-workflow/references/push-closes-its-loop.md.
      (1) MEASURED 2026-09-05: a bash script that `cat >`-overwrites its own path
      mid-run stops executing at that point and exits 0 — probe: a 9-line script
      lost its last three echoes and still reported success; the same script
      staging to a temp file and `mv`-ing ran to completion. Re-running the
      installer from post-merge therefore truncates post-merge's OWN remaining
      body (task sync, task generate-tools, npm run build:cli) and reports
      success. That is risk-register row 1 demonstrated, not hypothesised.
      (2) Linked worktrees SHARE one .git/hooks through the common dir (eight in
      this checkout), so "the installed hooks match the checked-out tree" has no
      unique referent: a repair lets whichever worktree checked out last redefine
      the gates all the others run, and an older branch reinstalls older hooks
      over newer ones. AI council, two rounds, 2 of 2 seats present in both
      (claude-sonnet-4-5 + codex-default, 2026-09-05): round 1 blocked the
      mutation on the trust boundary; round 2 was given the counter-facts (this
      block already executes checked-out content via task sync and npm run
      build:cli, so the capability is not new) and BOTH seats independently still
      chose report-not-repair, on the worktree-arbitration argument rather than
      the trust one. Reopen condition: per-worktree hook isolation
      (core.hooksPath) or a branch-independent dispatcher in the common dir —
      either makes "which version is authoritative" answerable. Atomic installer
      writes are the other prerequisite and were deliberately NOT shipped, since
      with no in-hook re-install nothing self-overwrites and the change would not
      trace to this task (minimal-safe-diff).
      VERIFY, revised in the same direction: the test runs the RENDERED post-merge
      body in a scratch git repo whose ORIG_HEAD..HEAD diff touches
      src/scripts/install-hooks.sh and asserts the detector was invoked AND the
      hook body is byte-identical before and after — the refused mutation is
      pinned, not merely absent. Inverse: a diff touching docs/unrelated.md
      invokes nothing. Third direction added after the guards landed: the same
      triggering diff on a checkout that does not carry the gate script invokes
      nothing and does not fail, because .git/hooks is shared and an older branch
      in a sibling worktree must not have its push refused by a script that is not
      on it (guards at src/scripts/install-hooks.sh:116 and :491-492). -->

- [x] **1.3 Do not add a concern without paying its ledger.**
      If 1.2 lands on a hook concern, it owes a row in
      `agents/decisions/concern-admissions.jsonl` and a `concern_count` claim
      against `check_estate_count` — the two surfaces PR #1843 discovered by
      going red on them, in that order, on two separate pushes.
      verify: `check_concern_admissions` and `check_estate_count` both exit 0 on
      the branch, before it is pushed rather than after.
      <!-- DONE, and the condition did not fire. 1.2 did not land on a hook
      concern: the carriers are a git hook body (src/scripts/install-hooks.sh)
      and a gate script, so hook_manifest.yaml, CONCERN_REGISTRY and
      concern-admissions.jsonl are all untouched and no admission row is owed.
      The two gates were still RUN as the step's evidence, on the branch and
      before the push, rather than asserted — and re-run AFTER merging
      origin/main, because a reading taken against the old base computes the
      wrong delta: check_concern_admissions → "0 concern(s) added since
      origin/main", exit 0; check_estate_count → concern_count 57 (floor 57 at
      origin/main, +0), active_roadmaps 2 (floor 3, -1 — this roadmap's own
      archival, a shrink), every other ratchet +0, exit 0. Note the
      `estate_growth_exempt` prose in this file's frontmatter claims the concern
      PR #1843 adds (56 → 57); #1843 is merged and main's floor already reads 57,
      so the exemption has nothing to spend and this change spends nothing. The one ledger surface a new check_* script CAN trip,
      check_gate_completeness, is satisfied by a `// ledger-exempt:` marker at
      src/scripts/check_installed_hooks_fresh.ts:54 naming why per-target
      accounting is already this gate's whole output — it reports all six managed
      hooks by name with a fingerprint on both the clean and the failing path. -->

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-09-04 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | A hook that repairs hooks fails silently | implementation | `post-merge` is `\|\| true` throughout by design — it must never block a pull. A re-install that fails there fails invisibly, which is the same silence this roadmap exists to remove, one layer over. | 1.2's verify asserts the rewrite HAPPENED rather than that the hook exited 0, so a swallowed failure is a red test. The installer's own output stays on stderr for a human who is watching. | Phase 1 — Say when the installed hook is stale |
| 2 | A byte-comparison is too strict to be useful | implementation | The installer may legitimately interpolate paths into the hook body, so the installed copy is not always byte-identical to the heredoc. A check that fires on every install would be turned off within a week. | 1.1's verify demands the inverse direction — a freshly-installed hook must report clean — which fails loudly if the comparison is stricter than the installer is deterministic. | Phase 1 — Say when the installed hook is stale |

## Acceptance Criteria

- [x] AC-1 — A checkout whose `.git/hooks/pre-push` predates the current
      `install-hooks.sh` body produces a message naming the mismatch and the fix,
      from a carrier that is bound and named. A checkout that just ran the
      installer produces nothing.
      <!-- MET, on this repository's own stale hooks rather than a fixture. Two
      carriers, both bound by the same installer and both named in
      docs/development.md § "The installed hooks go stale, and now they say so":
      the pre-push body's FIRST gate (src/scripts/install-hooks.sh:98-132) and
      the post-merge / post-checkout auto-sync block (:476-494).
      Positive direction, live: running the rendered pre-push in this worktree
      against the real shared hooks dir printed "the installed git hooks are
      stale", named pre-push / post-merge / post-checkout with installed-vs-source
      fingerprints, named `task install-hooks`, and exited 1 with
      "Push blocked — the hook that just ran is not the hook this tree ships."
      Negative direction, live: the same gate against a directory the installer
      had just written printed "6 installed hook(s) match" and exited 0 — and the
      pre-push block itself prints one status line and falls through. Both
      directions are also pinned in vitest against a real install, plus the
      one-byte-edit, deleted-hook, never-installed and unmanaged-file cases.
      Ordering is asserted, not incidental: the test fails if the gate is moved
      after base-freshness or preflight, because everything after it is answered
      by a hook that may not be the current one. -->
- [x] AC-2 — Installed hooks that no longer match `src/scripts/install-hooks.sh`
      are reported at the pull or branch switch that caused it, on stderr,
      without anyone running a command — and refused at the next push. The repair
      itself stays a human command. One manual install is still required to
      bootstrap a fresh clone, and the developer documentation says so rather
      than leaving it to be discovered.
      <!-- MET AS REWRITTEN, AND THE ORIGINAL WORDING IS DESCOPED. It read:
      "A pull or branch switch that moves src/scripts/install-hooks.sh leaves the
      installed hooks matching it, without anyone running a command." That is not
      merely hard here, it has no unique referent: linked worktrees share ONE
      .git/hooks through the common dir (eight in this checkout), so with eight
      versions of the installer checked out there is no fact of the matter about
      which one the shared hooks should match. Any auto-repair silently picks
      "last checkout wins" and hands one worktree the power to redefine the gates
      the other seven run. AI council round 2 (claude-sonnet-4-5 +
      codex-default, 2026-09-05, 2 of 2 seats) was asked this exact question with
      the counter-facts on the table and both seats chose report-not-repair
      independently; one of the two proposed the replacement wording above rather
      than a bare descope, which is what this AC now carries.
      What is NOT delivered, stated plainly: nothing repairs the hooks by itself.
      A contributor still types `task install-hooks`. The zero-intervention
      property is gone; the zero-UNNOTICED-staleness property is what shipped.
      Reopen the original on either per-worktree hook isolation (core.hooksPath)
      or a branch-independent dispatcher installed once in the common dir, plus
      atomic installer writes (measured prerequisite — see 1.2).
      The bootstrap half is met at docs/development.md § "One manual install is
      required, and nothing installs it for you", which states that `npm install`
      in a git clone is the ONLY automatic path and names the three states that
      leave a checkout with no hooks at all. Read as the developer documentation
      README delegates to ("Full project structure and commands:
      docs/development.md", README.md:602) rather than README.md itself, which
      carries no setup section to put it in. -->
- [x] AC-3 — The consumer question is answered in writing, either way. A
      consumer install today writes **no git hooks at all** — `src/install/`
      contains no reference to `.git/hooks`, and npm's `prepare` does not run
      for a registry dependency — so the pre-push gate is a maintainer-only
      mechanism. Whether consumers should get it is a separate decision; what
      this roadmap owes is that it stops being an unstated one.
      <!-- MET. Answered "maintainer-only", as a decision. Premise re-verified on
      this branch rather than inherited: `grep -rn "git/hooks\|install-hooks"
      src/install/ dist/install/` returns nothing, and package.json:96 shows
      `prepare` guarded on `[ -d .git ]`, which a registry dependency never
      satisfies. AI council (claude-sonnet-4-5 + codex-default, 2026-09-05,
      2 of 2 seats) chose it unanimously over ship-opt-in / ship-by-default /
      leave-open — explicitly rejecting leave-open as "not a decision; deferred
      scope without evidence or an owner". Reason recorded with it: the pre-push
      chain runs `task consistency` and `task preflight`, which depend on this
      repository's Taskfile, its ./scripts-run shim and its generated trees, none
      of which exist in a consumer project; and a dependency install should not
      establish persistent repository execution. Written in two places — the
      consumer-facing one at docs/development.md § "Git hooks are maintainer-only
      — consumers get none", and the one that raised the question, now closed at
      src/skills/git-workflow/references/push-closes-its-loop.md § "Answered
      2026-09-05". Revisit-if a consumer-native gate set is designed with its own
      opt-in command and consent step. -->
