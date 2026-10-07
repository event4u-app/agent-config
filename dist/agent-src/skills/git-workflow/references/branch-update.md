# Updating a branch from its base

Detail for [`git-workflow`](../SKILL.md) § Live remote state and § Before
opening a PR. The one place that
decides how a feature branch takes in its base — `/create-pr` § 1b, `/pr:merge`
§ 2, `/prepare-for-review` and `/review:changes` defer here. Read
`git.update_strategy` from `agent-config git:convention show --key update_strategy --base origin/<base>`, which exits 1
when the value in force is `malformed`, `invalid`, `discarded` or
`unresolvable` — none of these is a strategy: stop and report the line it
prints, never fall back to `merge`. A candidate in one of these states is
printed as a warning with exit 0: the update reads only the value in force.
A team declares the strategy in `.git-convention.yml` at the repository root
(ADR-283), and it is read at the commit the branch is judged against — the
`--base` given, the pull request's base — so a value changed on this branch is
a candidate `show` prints and applies only once it lands there; `unresolvable`
means that commit could not be read. Without `--base` the target is the default
branch, right only for a branch that targets it; nothing asks the forge:

| `git.update_strategy` | Operation | Asked first? |
|---|---|---|
| `merge` (default) | `git fetch origin && git merge origin/<base> --no-edit` | no — a merge adds a commit and rewrites nothing |
| `rebase` | § The rebase sequence below: resolve the ref the branch publishes, pin its SHA once, stop unless that SHA is already in `HEAD`, `git rebase origin/<base>`, report equivalence, regenerate and verify, then push in the same turn with `git push --force-with-lease=refs/heads/<b>:<sha> <remote> HEAD:refs/heads/<b>`, the pinned SHA as the lease | **yes**, unless [`git-history-discipline`](../../../rules/git-history-discipline.md) § When rewrite is allowed already covers it — the user asked this turn, an unrevoked standing instruction ("always rebase before pushing"), or a `pull --rebase` the user started. The setting picks the operation; it is never the authorisation |

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
  `git rebase origin/<parent>` on the child replays them. The sequence enforces
  it: the caller supplies `DESCENDANTS` (input below) and step 2 stops on a
  non-empty list, naming it. Restacking the chain is not this procedure, and an
  unasked `--onto` reseat needs the question the skill's shared-branch protocol
  asks. Nothing is inferred from branch names — only a pull request whose base
  is this branch counts.
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
  checked** (the base commit or origin not fetched, or the convergence policy
  disabled), never read as current; `1`: a conflict, or the base could not be
  resolved; `3`: behind under a strategy other than `merge`, refused and
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
resolved target with no remote ref is a branch that was never pushed. The
remedy the stop names: set the upstream once with `git push -u <remote> <branch>`,
then run the sequence again.

**Inputs, set before step 1.** `BASE` is required: the pull request's base
branch, bare (`main`, `release/1.x`). `DESCENDANTS` is required by step 2: the
head branches of the open pull requests whose base is this branch, space
separated — `gh pr list --base <branch> --json headRefName --jq '.[].headRefName'`
— and set empty only when that list is empty; the sequence cannot ask the forge
itself, so an unset value is a stop. `PR_HEAD_REPO` and `PR_HEAD_REF` are set
only with an open pull request (step 1). **Steps 1–3 are one script** — run
them in order, in ONE shell session, never as separate tool calls: they share
`REMOTE`, `RB`, `EXPECTED`, `SAVE` and the `stop` / `keep` functions the first
block defines. Each later block opens by checking that it shares that session
and stops otherwise, because an undefined `stop` would be a command that is not
found and lets the block run on. **Step 4 is a separate run**: step 3 stops
and prints the `SAVE` and `EXPECTED` it hands on; the caller regenerates the
derived files and runs its own verification on the rebased tree, then, in one
shell, runs step 1 again with those two set and runs step 4. Nothing is
published before that verification.

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
stop() { echo "STOP: $*" >&2; exit 1; }
keep() { stop "$* — the old head is kept at $SAVE; restore it with: git reset --keep $SAVE"; }
: "${BASE:?STOP: BASE is required — the pull request base branch, bare; nothing was rewritten}"
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
[ -n "$REMOTE" ] && [ -n "$RB" ] \
  || { echo "STOP: publish target unresolved — no rewrite; set the upstream once with git push -u <remote> $B, then run the sequence again" >&2; exit 1; }
DEF=$(git ls-remote --symref "$REMOTE" HEAD | awk '$1 == "ref:" { sub("^refs/heads/", "", $2); print $2; exit }')
for b in "${BASE:-}" "$DEF"; do
  [ -z "$b" ] || [ "$RB" != "$b" ] \
    || { echo "STOP: the publish target $REMOTE/$RB is the base branch — a rewrite is never published onto its base" >&2; exit 1; }
done
```

**2. Stop, pin, rebase.** The stops come first, before anything is
rewritten: known descendants (`DESCENDANTS` non-empty, § Under `rebase`); a
dirty working tree; a merge commit in the topic range
(`git rev-list --merges origin/<base>..HEAD` is non-empty) — the default
`merge` strategy and `/prepare-for-review` put them there, so a branch switched
to `rebase` usually carries one, and a plain rebase silently drops it. When
every such commit is a **base merge** — each parent after the first is
reachable from `origin/<base>` — the stop names its remedy: a plain rebase that
drops those merges, run only after the user confirms it this turn, which a run
started with `DROP_BASE_MERGES=1` stands for; the recovery ref is written
first, and conflicts resolved inside those merges may come back during the
rebase. A merge of anything else is still refused even with
`DROP_BASE_MERGES=1`; `--rebase-merges` is a separate operation the user asks
for, never a fallback;
and commits on the branch you did not author (§ Under `rebase`, shared branch)
— any commit in `origin/<base>..HEAD` whose author email is not
`git config user.email`. That stop lifts only for a run started with
`ALLOW_FOREIGN=1`, which stands for the user's answer this turn that those
commits may be rewritten; it is never set to get past the stop.
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
declare -F keep >/dev/null && [ -n "${BASE:-}" ] && [ -n "${REMOTE:-}" ] \
  || { echo "STOP: run steps 1–3 in one shell session, starting with step 1 — nothing was rewritten" >&2; exit 1; }
[ "${DESCENDANTS+set}" = set ] \
  || stop "DESCENDANTS is required — the head branches of open pull requests whose base is this branch, empty when there are none; nothing was rewritten"
[ -z "$DESCENDANTS" ] \
  || stop "pull requests are built on this branch ($DESCENDANTS) — rewriting it leaves them carrying its old commits; restacking is not this procedure, nothing was rewritten"
[ -z "$(git status --porcelain --untracked-files=no)" ] || stop "the working tree is dirty — nothing was rewritten"
git fetch -q origin "$BASE" || stop "could not fetch origin $BASE — nothing was rewritten"
MERGES=$(git rev-list --merges "origin/$BASE..HEAD") \
  || stop "could not list the topic range origin/$BASE..HEAD — nothing was rewritten"
if [ -n "$MERGES" ]; then
  OTHER=
  for m in $MERGES; do
    for p in $(git rev-parse "$m^@" | tail -n +2); do
      git merge-base --is-ancestor "$p" "origin/$BASE" || { OTHER="$OTHER $(git rev-parse --short "$m")"; break; }
    done
  done
  [ -z "$OTHER" ] \
    || stop "the topic range carries a merge commit that is not a merge of the base ($OTHER) — a plain rebase drops it; --rebase-merges is a separate operation the user asks for"
  [ "${DROP_BASE_MERGES:-}" = 1 ] \
    || stop "the topic range carries a merge commit from an earlier merge of the base, which a plain rebase drops — ask the user; set DROP_BASE_MERGES=1 only on their answer this turn (conflicts resolved inside those merges may come back); keeping them is --rebase-merges, a separate operation the user asks for"
fi
ME=$(git config user.email) || stop "git config user.email is unset, so your commits cannot be told from inherited ones — nothing was rewritten"
AUTHORS=$(git log --format='%h %ae' "origin/$BASE..HEAD") \
  || stop "could not list the authors of origin/$BASE..HEAD — nothing was rewritten"
FOREIGN=$(awk -v me="$ME" 'tolower($2) != tolower(me)' <<<"$AUTHORS")
[ -z "$FOREIGN" ] || [ "${ALLOW_FOREIGN:-}" = 1 ] \
  || stop "the topic range carries commits you did not author ($(tr '\n' ' ' <<<"$FOREIGN")) — ask the user; set ALLOW_FOREIGN=1 only on their answer this turn"
EXPECTED=$(git ls-remote "$REMOTE" "refs/heads/$RB" | cut -f1)
if [ -n "$EXPECTED" ]; then
  git fetch -q "$REMOTE" "refs/heads/$RB" || stop "could not fetch $REMOTE/$RB — nothing was rewritten"
  git merge-base --is-ancestor "$EXPECTED" HEAD || stop "$REMOTE/$RB has commits this branch lacks"
fi
SAVE="refs/agent-config/rewrites/$(date -u +%Y%m%dT%H%M%SZ)-$$/before"
git update-ref "$SAVE" HEAD
git rebase "origin/$BASE" \
  || keep "the rebase stopped on a conflict — resolve each commit and git rebase --continue, then in one shell run step 1, set SAVE=$SAVE EXPECTED=$EXPECTED, and run step 3 (git rebase --abort first to give up)"
```

**3. Report equivalence from stable data.** The stable patch ids of the old
range and the new range are compared: equal sets mean "mechanically
equivalent"; anything else means "needs review" and names the commits on each
side that have no match — never a pair inferred from a subject or a position.
Whenever the old head already contained the new base, the trees must also be
equal. A conflict resolution changes a patch id, so a mismatch means "needs
review", never "wrong". A non-empty range that yields no patch id at all — an
empty commit, or diff output git could not read — is "needs review" too: an
empty comparison is not an equal one. Colour is forced off, so a
`color.ui=always` configuration cannot empty both sets. The verdict is a report, not a review: it binds nothing
and approves nothing. `git range-diff` is shown to the human and never parsed —
its manual says under OUTPUT STABILITY that the output is not for machines.

```bash
# rebase-sequence: equivalence
declare -F keep >/dev/null && [ -n "${SAVE:-}" ] && [ -n "${BASE:-}" ] \
  || { echo "STOP: run steps 1–3 in one shell session, starting with step 1" >&2; exit 1; }
pids() { git -c color.ui=never log -p --no-color --no-merges --format='commit %H' "$1" | git patch-id --stable | sort; }
OLD_BASE=$(git merge-base "$SAVE" "origin/$BASE")
OLD=$(pids "$OLD_BASE..$SAVE")
NEW=$(pids "origin/$BASE..HEAD")
VERDICT="mechanically equivalent"
[ "$(cut -d' ' -f1 <<<"$OLD")" = "$(cut -d' ' -f1 <<<"$NEW")" ] || VERDICT="needs review"
[ -n "$OLD" ] || [ "$(git rev-list --count --no-merges "$OLD_BASE..$SAVE")" = 0 ] || VERDICT="needs review"
[ -n "$NEW" ] || [ "$(git rev-list --count --no-merges "origin/$BASE..HEAD")" = 0 ] || VERDICT="needs review"
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
echo "PUBLISH AFTER VERIFY: SAVE=$SAVE EXPECTED=$EXPECTED — regenerate and verify, then in one shell run step 1 with these two set, then step 4"
```

**4. Push in the same turn, then read the published ref back** — after the
caller's regenerate and verify, in a fresh shell that ran step 1 with `SAVE`
and `EXPECTED` from step 3. An empty `EXPECTED` (never pushed) makes the lease
require that the ref does not exist.

```bash
# rebase-sequence: publish
declare -F keep >/dev/null && [ -n "${SAVE:-}" ] && [ "${EXPECTED+set}" = set ] && [ -n "${REMOTE:-}" ] && [ -n "${RB:-}" ] \
  || { echo "STOP: run step 1 in this shell session, with SAVE and EXPECTED from step 3 — nothing was pushed" >&2; exit 1; }
git push --force-with-lease="refs/heads/$RB:$EXPECTED" "$REMOTE" "HEAD:refs/heads/$RB" \
  || keep "the lease was rejected — $REMOTE/$RB moved; refetch and report, never retry without the lease"
[ "$(git ls-remote "$REMOTE" "refs/heads/$RB" | cut -f1)" = "$(git rev-parse HEAD)" ] \
  || keep "$REMOTE/$RB does not match HEAD after the push"
[ -n "$SAVE" ] && git update-ref -d "$SAVE"
```

A rejected lease is a stop: refetch, report what moved, and hand back — never a
bare `--force-with-lease`, which compares against whatever the last fetch
brought in and so overwrites a push it has just fetched, and never `--force`.
