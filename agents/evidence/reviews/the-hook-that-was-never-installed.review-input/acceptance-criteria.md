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
