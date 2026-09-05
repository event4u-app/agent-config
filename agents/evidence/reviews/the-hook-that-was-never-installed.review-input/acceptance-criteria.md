## Acceptance Criteria

- [x] AC-1 — A checkout whose `.git/hooks/pre-push` predates the current
      `install-hooks.sh` body produces a message naming the mismatch and what to
      do about it, from a carrier that is bound and named. A checkout that just
      ran the installer produces nothing.
      <!-- MET, on this repository's own stale hooks rather than a fixture. Two
      carriers, both bound by the same installer and both named in
      docs/development.md § "The installed hooks go stale, and now they say so":
      the pre-push body's FIRST gate (src/scripts/install-hooks.sh:149-194) and
      the post-merge / post-checkout auto-sync block (:492-510).
      Positive direction, live: the gate against the real shared hooks dir named
      pre-push / post-merge / post-checkout with installed-vs-source fingerprints
      and exited 1. Negative direction, live: against a directory the installer
      had just written it printed "6 installed hook(s) match" and exited 0, and
      the pre-push block prints one status line and falls through. Both
      directions pinned in vitest against a real install, plus one-byte-edit,
      deleted-hook, lost-executable-bit, unreadable, never-installed and
      unmanaged-file cases.
      CORRECTED AFTER THE R2 BLIND REVIEW: the pre-push carrier does NOT refuse,
      and it runs AFTER base freshness rather than before it. As first shipped it
      did both, and the reviewer showed that combination hands the contributor a
      HARMFUL instruction: the commonest cause of a mismatch is a checkout behind
      a base that moved the installer, and re-installing from there writes the
      OLDER hook set over the shared .git/hooks — the exact regression 1.2 refuses
      auto-repair to avoid — while preempting the gate that would have said
      "merge". Base freshness now exits first. And the refusal is gone entirely:
      the predicate is "installed == what THIS checkout renders", which across
      eight worktrees sharing one .git/hooks has no unique referent, so a block
      fires on ordinary parallel work until the skip variable becomes routine.
      AI council round 3 (claude-sonnet-4-5 + codex-default, 2026-09-05, 2 of 2
      seats) chose advisory unanimously, reversing its own round-1 choice on a
      fact round 1 did not have. Both the ordering and the never-refuses property
      are pinned by tests that red when either is undone. -->
- [x] AC-2 — Installed hooks that no longer match `src/scripts/install-hooks.sh`
      are reported at the merge-pull or branch switch that caused it, on stderr,
      without anyone running a command — and at the next push regardless of how
      the drift arrived. Both notices are advisory; the repair itself stays a
      human command. A rebase-pull is reported at the push only, and the
      exclusion is written down rather than left to be discovered. One manual install is still required to
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
      atomic installer writes (measured prerequisite — see 1.2). The same two
      conditions gate restoring a BLOCKING push-time check: council round 3
      (2026-09-05, 2 of 2 seats) found the block rests on the same non-unique
      predicate as the repair, and the word "refused" left this AC in the first
      draft with it.
      SECOND R2 ROUND, finding 2: `git pull --rebase` fires neither post-merge
      nor post-checkout — it fires post-rewrite, which carries no detector — so
      the event half of this AC silently excluded rebase-pull users. Named in
      docs/development.md and in the gate docstring rather than closed:
      post-rewrite also fires on every `git commit --amend`, so wiring it there
      trades a real gap for a notice on an operation that cannot have moved the
      installer. The push-time carrier still catches it.
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
