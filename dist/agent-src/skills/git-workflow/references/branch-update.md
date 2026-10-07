# Updating a branch from its base

Detail for [`git-workflow`](../SKILL.md) § Live remote state and § Before
opening a PR. The one place that
decides how a feature branch takes in its base — `/create-pr` § 1b, `/pr:merge`
§ 2, `/prepare-for-review` and `/review:changes` defer here. Read
`git.update_strategy` from `agent-config git:convention show` — a state of
`malformed`, `invalid` or `discarded` (exit 1 for the first two) is not a
strategy: stop and report the line it prints, never fall back to `merge`.
A team declares the strategy in `.git-convention.yml` at the repository root
(ADR-282), and it is read at the commit the branch is judged against — the
pull request's base — so a value changed on this branch is a candidate `show`
prints and applies only once it lands there; `unresolvable` means that commit
could not be read, and it is not a strategy either:

| `git.update_strategy` | Operation | Asked first? |
|---|---|---|
| `merge` (default) | `git fetch origin && git merge origin/<base> --no-edit` | no — a merge adds a commit and rewrites nothing |
| `rebase` | § The rebase sequence below: resolve the ref the branch publishes, pin its SHA once, stop unless that SHA is already in `HEAD`, `git rebase origin/<base>`, then push in the same turn with `git push --force-with-lease=refs/heads/<b>:<sha> <remote> HEAD:refs/heads/<b>`, the pinned SHA as the lease | **yes**, unless [`git-history-discipline`](../../../rules/git-history-discipline.md) § When rewrite is allowed already covers it — the user asked this turn, an unrevoked standing instruction ("always rebase before pushing"), or a `pull --rebase` the user started. The setting picks the operation; it is never the authorisation |

## Under `rebase`

- **Never merge the base into the branch instead**, not even to avoid the ask —
  a `Merge branch 'main' into …` commit is exactly what the setting excludes.
  No authorisation → stop and ask with numbered options (rebase now / leave the
  branch behind).
- **Pushed branch** → § The rebase sequence is the skill's § Two protective
  stops in their rebase form: commits on the published ref you lack halt the
  rebase, and the push follows in the same turn.
- **Shared branch** — commits on it that you did not author this session → do
  not rebase without the authors' agreement; this is the git-history-discipline
  inherited-commits law, and the setting does not lift it.
- **Conflicts** → resolve to the correct end state per commit, `git add`,
  `git rebase --continue`; `git rebase --abort` returns to the pre-rebase state.
  Re-run the relevant tests afterwards — a conflict-free tree is not a correct
  one. Detail: [`merge-conflicts`](../../merge-conflicts/SKILL.md).
- **A base SET** (a non-default target whose branch-convergence policy also
  carries the default branch): rebase onto the target. If `sync_pr_branch` then
  still names the default branch as behind, the target itself is behind its
  default — that is the target's update, not this branch's; report it.
- **`sync_pr_branch` exits** — `0` with a `✅` line: current, or under `merge`
  merged cleanly; `0` with a `⚠️` `unverified` or `BYPASSED` line: **not
  checked** (origin not fetched, or the convergence policy disabled), never
  read as current; `3`: behind under a strategy other than `merge`, refused and
  never merged; `4`: the strategy itself cannot be read — the line names the
  reason code and the file, and nothing was checked. A current branch passes
  with exit 0, so automated pre-push syncs stay green when there is nothing to do.
- **Plain `git push --force` is never used**, and neither is a bare
  `--force-with-lease` — only the qualified lease the sequence pins, and never
  against the base branch itself.
- **Tidying WIP / fixup commits before the PR** (`git commit --fixup`,
  `git rebase -i --autosquash origin/<base>`) stays a user-requested operation —
  the skill's § Equivalents that are also forbidden by default lists it; a team
  that expects curated history asks for it, and the agent offers it, never runs
  it unasked.
- **Published commits on the base are never rewritten**; a wrong change there is
  undone with `git revert <sha>`, a new commit.

## The rebase sequence

The branch's upstream (`@{u}`) is **not** the ref it publishes: a branch cut
from `origin/main` and pushed without `-u` tracks the base, so a stop or a lease
read from `@{u}` checks the base and carries the base's SHA. `origin/<branch>`
is not it either — `branch.<name>.pushRemote`, `remote.pushDefault` and a fork
head publish elsewhere. The sequence therefore resolves the publish target,
and an **unresolved target means no rewrite** — never "never pushed". Only a
resolved target with no remote ref is a branch that was never pushed.

**1. Resolve.** `@{push}` names the publish target where the push
configuration determines one; with an open pull request, its head repository and
`headRefName` (`gh pr view --json headRefName,headRepository,headRepositoryOwner`)
name it — set `PR_HEAD_REPO=<owner>/<name>` and `PR_HEAD_REF=<headRefName>`
first. The two must agree when both resolve.

```bash
# rebase-sequence: resolve
REMOTE= RB=
B=$(git branch --show-current)
if PUSH=$(git rev-parse --symbolic-full-name '@{push}' 2>/dev/null); then
  REMOTE=$(git for-each-ref --format='%(push:remotename)' "refs/heads/$B")
  RB=${PUSH#"refs/remotes/$REMOTE/"}
fi
if [ -n "${PR_HEAD_REPO:-}" ]; then
  PR_REMOTE=$(git remote -v | awk -v r="$PR_HEAD_REPO" '$3 == "(push)" && $2 ~ ("[/:]" r "(\\.git)?$") { print $1; exit }')
  [ -n "$PR_REMOTE" ] || { echo "STOP: no remote publishes $PR_HEAD_REPO" >&2; exit 1; }
  if [ -n "$REMOTE" ] && { [ "$REMOTE" != "$PR_REMOTE" ] || [ "$RB" != "$PR_HEAD_REF" ]; }; then
    echo "STOP: @{push} is $REMOTE/$RB but the pull request head is $PR_HEAD_REPO:$PR_HEAD_REF" >&2; exit 1
  fi
  REMOTE=$PR_REMOTE RB=$PR_HEAD_REF
fi
[ -n "$REMOTE" ] && [ -n "$RB" ] || { echo "STOP: publish target unresolved — no rewrite" >&2; exit 1; }
```

**2. Stop, pin, rebase.** Three stops come first, before anything is
rewritten: a dirty working tree; a merge commit in the topic range
(`git rev-list --merges origin/<base>..HEAD` is non-empty) — the default
`merge` strategy and `/prepare-for-review` put them there, so a branch switched
to `rebase` usually carries one, and a plain rebase silently drops it;
`--rebase-merges` is a separate operation the user asks for, never a fallback;
and commits on the branch you did not author (§ Under `rebase`, shared branch).
Then the remote ref is read once; that literal is the stop (it must already be
in `HEAD`) and, unchanged, the lease. A collaborator's push lands either before
the pin and halts the stop, or after it and fails the lease — it is never
overwritten.

```bash
# rebase-sequence: rebase
stop() { echo "STOP: $*" >&2; exit 1; }
[ -z "$(git status --porcelain --untracked-files=no)" ] || stop "the working tree is dirty — nothing was rewritten"
git fetch -q origin "$BASE"
[ -z "$(git rev-list --merges "origin/$BASE..HEAD")" ] \
  || stop "the topic range carries a merge commit, which a plain rebase drops — --rebase-merges is a separate operation the user asks for"
EXPECTED=$(git ls-remote "$REMOTE" "refs/heads/$RB" | cut -f1)
if [ -n "$EXPECTED" ]; then
  git fetch -q "$REMOTE" "refs/heads/$RB"
  git merge-base --is-ancestor "$EXPECTED" HEAD || stop "$REMOTE/$RB has commits this branch lacks"
fi
git rebase "origin/$BASE" || stop "the rebase stopped on a conflict — resolve each commit, then continue at step 3"
```

**3. Push in the same turn, then read the published ref back.** An empty
`EXPECTED` (never pushed) makes the lease require that the ref does not exist.

```bash
# rebase-sequence: publish
git push --force-with-lease="refs/heads/$RB:$EXPECTED" "$REMOTE" "HEAD:refs/heads/$RB" \
  || stop "the lease was rejected — $REMOTE/$RB moved; refetch and report, never retry without the lease"
[ "$(git ls-remote "$REMOTE" "refs/heads/$RB" | cut -f1)" = "$(git rev-parse HEAD)" ] \
  || stop "$REMOTE/$RB does not match HEAD after the push"
```

A rejected lease is a stop: refetch, report what moved, and hand back — never a
bare `--force-with-lease`, which compares against whatever the last fetch
brought in and so overwrites a push it has just fetched, and never `--force`.
