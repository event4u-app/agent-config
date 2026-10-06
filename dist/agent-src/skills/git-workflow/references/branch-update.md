# Updating a branch from its base

Detail for [`git-workflow`](../SKILL.md) § Live remote state and § Before
opening a PR. The one place that
decides how a feature branch takes in its base — `/create-pr` § 1b, `/pr:merge`
§ 2, `/prepare-for-review` and `/review:changes` defer here. Read
`agent-config settings:get git.update_strategy`:

| `git.update_strategy` | Operation | Asked first? |
|---|---|---|
| `merge` (default) | `git fetch origin && git merge origin/<base> --no-edit` | no — a merge adds a commit and rewrites nothing |
| `rebase` | `git fetch origin && git rebase origin/<base>`, then on a pushed branch `git push --force-with-lease=<branch>:<fetched-sha>` in the same turn | **yes**, unless [`git-history-discipline`](../../../rules/git-history-discipline.md) § When rewrite is allowed already covers it — the user asked this turn, an unrevoked standing instruction ("always rebase before pushing"), or a `pull --rebase` the user started. The setting picks the operation; it is never the authorisation |

## Under `rebase`

- **Never merge the base into the branch instead**, not even to avoid the ask —
  a `Merge branch 'main' into …` commit is exactly what the setting excludes.
  No authorisation → stop and ask with numbered options (rebase now / leave the
  branch behind).
- **Pushed branch** → run the pre-rewrite stop of the skill's § Two protective
  stops first (divergent local vs origin halts the rebase), and push in the same
  turn per its post-rewrite stop.
- **Shared branch** — commits on it that you did not author this session → do
  not rebase without the authors' agreement; this is the git-history-discipline
  inherited-commits law, and the setting does not lift it.
- **Conflicts** → resolve to the correct end state per commit, `git add`,
  `git rebase --continue`; `git rebase --abort` returns to the pre-rebase state.
  Re-run the relevant tests afterwards — a conflict-free tree is not a correct
  one. Detail: [`merge-conflicts`](../../merge-conflicts/SKILL.md).
- **`sync_pr_branch` refuses with exit 3** when the branch is behind and the
  strategy is not `merge`; a current branch passes with exit 0, so automated
  pre-push syncs stay green when there is nothing to do.
- **Plain `git push --force` is never used** — only `--force-with-lease`, and
  never against the base branch itself.
- **Tidying WIP / fixup commits before the PR** (`git commit --fixup`,
  `git rebase -i --autosquash origin/<base>`) stays a user-requested operation —
  the skill's § Equivalents that are also forbidden by default lists it; a team
  that expects curated history asks for it, and the agent offers it, never runs
  it unasked.
- **Published commits on the base are never rewritten**; a wrong change there is
  undone with `git revert <sha>`, a new commit.
