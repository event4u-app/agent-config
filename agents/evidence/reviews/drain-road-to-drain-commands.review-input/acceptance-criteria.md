## Acceptance Criteria

- [ ] AC-1 — `LEDGER_MAX_AGE_MS` is `30 * 60 * 1000` in the guard source, no
      temporary-widening marker remains anywhere in the guard, and a rebuild of
      the hook bundle from that source carries the restored value. The bundle
      itself is untracked, so the source and the rebuild are the checkable
      surface — not a committed artefact.
- [ ] AC-2 — An mtime-preserving edit to a bundled hook source fails the
      content-equivalence gate while passing the mtime check; both outcomes are
      demonstrated, not asserted. The gate's header states that it is
      local-only because `dist/hooks/` is untracked.
- [ ] AC-3 — `/pr:merge` exists at `src/domains/git/pr/merge/command.md`, is
      registered in the locked cluster registry, and specifies the immutable
      target manifest, the enumerated conflict classes, the bounded CI-repair
      halt list, the kill-switch set, the no-rollback rule, and the closed
      disposition set of its summary artifact.
- [ ] AC-4 — `/roadmap:process-full` accepts `--all` and `--worktree`.
      **Weakened after R2 (finding 8), because the original wording was not
      satisfiable:** an `--all` hand-off is one immediately-mergeable PR plus
      N−1 *prepared* ones, each needing a re-sync at merge time — while
      `--merge` is gated nothing merges, so the base never advances and every
      PR after the first is mergeable only against the base recorded when it
      was prepared. The command says this in those words rather than promising
      "N mergeable PRs". `--merge` is specified, marked inert, and points at
      the `merge-authority` blocker.
- [ ] AC-5 — No new command named `process-all` exists anywhere in the tree,
      and no new authorization store exists in `src/scripts/hooks/`. No shipped
      path merges anything while the `merge-authority` blocker is open: both
      command files state the gate in a block a reader cannot miss.
- [ ] AC-6 — `/roadmap:next` is byte-identical: it still never merges.
- [ ] AC-7 — An accepted ADR records the merge-authority decision, cites
      ADR-237 § 4 and the `road-to-gate-preauth-authorization` stub, and names
      the two properties a future persistent grant would need.
- [ ] AC-8 — The command, cluster, frontmatter and roadmap gates pass on the
      changed files, and both new eval fixtures load under the existing loader.
