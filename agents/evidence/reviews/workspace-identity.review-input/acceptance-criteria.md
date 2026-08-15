## Acceptance criteria

- [x] Every census row is either migrated to the shared resolver or carries a
      written reason it is not.
      21 rows: **7 migrated · 11 deliberately not · 3 n/a**, each with a reason
      (census § 8).
- [x] Both shipped worktree misclassification defects have a regression test
      that fails against the pre-migration primitive.
      `tests/scripts/workspace_identity.test.ts`, plus a control assertion that
      `rev-parse --show-toplevel` genuinely differs between the two locations —
      so the pin cannot pass vacuously.
- [x] `workspace doctor` reports the same repo root and main worktree from
      inside a worktree as from the main checkout, and says so under an
      inherited `GIT_DIR`.
      **Discharged with one correction to the criterion's own wording, stated
      rather than quietly worked around.** `mainWorktree` is identical from both
      locations and under an inherited `GIT_DIR` — verified by live probe and by
      test, and it is the invariant the criterion exists for. `repoRoot` is
      **not** identical between the two, and cannot be: `git rev-parse
      --show-toplevel` is defined as the top level of the *invoking* working
      tree, so inside a linked worktree it is the worktree's own root. That is
      also why the roadmap's Phase 2 lists repo root, main worktree and current
      worktree as three fields rather than one. What the criterion is really
      asking — "the answer does not change depending on where you stand" — holds
      for `mainWorktree`, and `currentWorktree` names which checkout you are in
      so the difference is legible instead of silent.
