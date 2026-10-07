# Updating a branch from its base

Detail for [`git-workflow`](../SKILL.md) § Live remote state and § Before
opening a PR. The one place that
decides how a feature branch takes in its base — `/create-pr` § 1b, `/pr:merge`
§ 2, `/prepare-for-review` and `/review:changes` defer here. Read
`git.update_strategy` from `agent-config git:convention show`, which exits 1
when the value in force, or this checkout's candidate, is `malformed`,
`invalid`, `discarded` or `unresolvable` — none of these is a strategy: stop
and report the line it prints, never fall back to `merge`.
A team declares the strategy in `.git-convention.yml` at the repository root
(ADR-282), and it is read at the commit the branch is judged against — the
pull request's base — so a value changed on this branch is a candidate `show`
prints and applies only once it lands there; `unresolvable` means that commit
could not be read:

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
- **Known descendants** → refuse. When the open pull requests' bases — the
  chain `/prepare-for-review` already reads
  (`gh pr list --base <branch> --json number,headRefName`) — show another branch
  built on this one, the `rebase` row does not run: rewriting the parent leaves
  every descendant carrying its old commits, and a later
  `git rebase origin/<parent>` on the child replays them. Report the chain and
  stop; restacking it is not this procedure, and an unasked `--onto` reseat
  needs the question the skill's shared-branch protocol asks. Nothing is
  inferred from branch names — only a pull request whose base is this branch
  counts.
- **Completion review** → rebase first, review after: the completion review
  binds after the last rebase, and one taken before a rebase is re-bound after
  it — the re-binding reviewer cites the post-rebase commits in a commit of its
  own. The step 3 equivalence report is supporting data for that reviewer, never
  the re-binding itself, and nothing edits a findings file automatically
  ([`plan-review-gates`](../../../docs/contracts/plan-review-gates.md) § 2.5).
- **Conflicts** → resolve to the correct end state per commit, `git add`,
  `git rebase --continue`; `git rebase --abort` returns to the pre-rebase state.
  Re-run the relevant tests afterwards — a conflict-free tree is not a correct
  one. Detail: [`merge-conflicts`](../../merge-conflicts/SKILL.md).
- **A base SET** (a non-default target whose branch-convergence policy also
  carries the default branch): rebase onto the target. When the branch is
  current with the target and the target itself is behind its default,
  `sync_pr_branch` exits 3 with the reason code `TARGET_POLICY_STALE` — that is
  the target's update, not this branch's; report it and do not rebase. A branch
  also behind the target gets the ordinary behind line first.
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
first. The two must agree when both resolve. A target that names the base
branch — `BASE`, or the default branch the publish remote reports — is a stop:
under `push.default=upstream` or `tracking`, `@{push}` of a branch cut with
`--track origin/main` IS `origin/main`, and nothing later in the sequence would
notice — the base is an ancestor of `HEAD`, so the pin passes
and the lease is the base's own SHA.

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
DEF=$(git ls-remote --symref "$REMOTE" HEAD | awk '$1 == "ref:" { sub("^refs/heads/", "", $2); print $2; exit }')
for b in "${BASE:-}" "$DEF"; do
  [ -z "$b" ] || [ "$RB" != "$b" ] \
    || { echo "STOP: the publish target $REMOTE/$RB is the base branch — a rewrite is never published onto its base" >&2; exit 1; }
done
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

Before the rewrite the old head is kept at a private recovery ref,
`refs/agent-config/rewrites/<tx>/before`, written with `git update-ref` —
outside `refs/tags/`, so `git push --tags` cannot publish it, and not a tag
push for anything that counts them. It is removed once the published ref reads
back as `HEAD`; on any failure it is kept and the one command that restores it
is printed. A kept ref is removed with `git update-ref -d <ref>`.

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
SAVE="refs/agent-config/rewrites/$(date -u +%Y%m%dT%H%M%SZ)-$$/before"
git update-ref "$SAVE" HEAD
keep() { stop "$* — the old head is kept at $SAVE; restore it with: git reset --keep $SAVE"; }
git rebase "origin/$BASE" \
  || keep "the rebase stopped on a conflict — resolve each commit and git rebase --continue, then run steps 3 and 4 with SAVE=$SAVE (git rebase --abort first to give up)"
```

**3. Report equivalence from stable data.** The stable patch ids of the old
range and the new range are compared: equal sets mean "mechanically
equivalent"; anything else means "needs review" and names the commits on each
side that have no match — never a pair inferred from a subject or a position.
Whenever the old head already contained the new base, the trees must also be
equal. A conflict resolution changes a patch id, so a mismatch means "needs
review", never "wrong". The verdict is a report, not a review: it binds nothing
and approves nothing. `git range-diff` is shown to the human and never parsed —
its manual says under OUTPUT STABILITY that the output is not for machines.

```bash
# rebase-sequence: equivalence
pids() { git log -p --no-merges --format='commit %H' "$1" | git patch-id --stable | sort; }
OLD_BASE=$(git merge-base "$SAVE" "origin/$BASE")
OLD=$(pids "$OLD_BASE..$SAVE")
NEW=$(pids "origin/$BASE..HEAD")
VERDICT="mechanically equivalent"
[ "$(cut -d' ' -f1 <<<"$OLD")" = "$(cut -d' ' -f1 <<<"$NEW")" ] || VERDICT="needs review"
if git merge-base --is-ancestor "origin/$BASE" "$SAVE" \
  && [ "$(git rev-parse "$SAVE^{tree}")" != "$(git rev-parse "HEAD^{tree}")" ]; then
  VERDICT="needs review"
fi
echo "EQUIVALENCE: $VERDICT"
if [ "$VERDICT" = "needs review" ]; then
  comm -3 <(cut -d' ' -f1 <<<"$OLD") <(cut -d' ' -f1 <<<"$NEW") | tr -d '\t' | sort -u | while read -r p; do
    [ -n "$p" ] || continue
    grep "^$p " <<<"$OLD" | while read -r _ c; do echo "  before: $(git log -1 --format='%h %s' "$c")"; done
    grep "^$p " <<<"$NEW" | while read -r _ c; do echo "  after:  $(git log -1 --format='%h %s' "$c")"; done
  done
fi
git range-diff "$OLD_BASE..$SAVE" "origin/$BASE..HEAD"   # for the human; never parsed
```

**4. Push in the same turn, then read the published ref back.** An empty
`EXPECTED` (never pushed) makes the lease require that the ref does not exist.

```bash
# rebase-sequence: publish
git push --force-with-lease="refs/heads/$RB:$EXPECTED" "$REMOTE" "HEAD:refs/heads/$RB" \
  || keep "the lease was rejected — $REMOTE/$RB moved; refetch and report, never retry without the lease"
[ "$(git ls-remote "$REMOTE" "refs/heads/$RB" | cut -f1)" = "$(git rev-parse HEAD)" ] \
  || keep "$REMOTE/$RB does not match HEAD after the push"
git update-ref -d "$SAVE"
```

A rejected lease is a stop: refetch, report what moved, and hand back — never a
bare `--force-with-lease`, which compares against whatever the last fetch
brought in and so overwrites a push it has just fetched, and never `--force`.
