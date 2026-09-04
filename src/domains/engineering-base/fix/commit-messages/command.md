---
model_tier: high
name: fix-commit-messages
pack: engineering-base
visibility: internal
cluster: fix
sub: commit-messages
skills: [conventional-commits-writing, git-workflow]
description: Measure the repo's commit convention, ask which style to standardise on, then rewrite past commit subjects to it — own commits and full history by default
suggestion:
  eligible: false
  rationale: "Cluster sub-command — reached via its cluster head's routing or its explicit /cluster:sub name; not independently suggested (surface-consolidation)."
workspaces:
  - agent-config-maintainer
packs:
  - meta
---

# /fix commit-messages
## Instructions

Retro-fit past commit **subjects** (and bodies, if the user asks) to one
convention. This rewrites history: every touched commit gets a new hash, and
anything already pushed needs a force-push and a re-clone by everyone else.
Treat the whole command as a Hard-Floor operation
([`non-destructive-by-default`](../../../rules/non-destructive-by-default.md)) —
the user invoking it authorises the *investigation*, not the rewrite. The
rewrite needs its own explicit yes, after the plan is on screen.

**Author identity is preserved.** `%an` / `%ae` / `%ad` survive untouched;
committer name and date do not, because rewriting a commit re-commits it. Say
so before asking for the yes — a maintainer who expected `git log` to be
byte-identical apart from subjects should hear it from you, not from `--format`.

### 1. Refuse early, on facts, not on caution

Stop and report — do not proceed to step 2 — when any holds:

- **The working tree is dirty.** `git status --porcelain` non-empty → ask the
  user to commit or stash first. A rewrite over a dirty tree loses work.
- **A rebase, merge, cherry-pick or bisect is in progress**
  (`.git/rebase-merge`, `.git/rebase-apply`, `MERGE_HEAD`, `CHERRY_PICK_HEAD`,
  `BISECT_LOG`). Finish it first.
- **`git filter-repo` is not installed** (`git filter-repo --version`). Per
  [`missing-tool-handling`](../../../rules/missing-tool-handling.md): stop and ask
  with numbered options — install it, or use the `git rebase --exec` fallback in
  step 7b, which is slower and cannot span a root commit. Never install it
  silently, and never fall back to `git filter-branch`, which Git itself
  deprecates for exactly this use.
- **Another live session holds this worktree** and the range includes commits it
  authored. Rewriting under a peer is the one case where "ask" is not optional.

### 2. Establish the target convention — measure before offering

Run `## Procedure: Establish the house convention` from
[`conventional-commits-writing`](../../../skills/conventional-commits-writing/SKILL.md)
verbatim: tier-1 sources first, then the capped-weighted consensus pass over
the sample, with bots, merges, reverts and release automation excluded.

Report what it found, in one block, before offering anything:

```
Configured : none found (no commitlint, .gitmessage, commit-msg hook, CONTRIBUTING § Commits)
Measured   : ticket-prefix  84% of 137 eligible commits, 6 authors, last 24 months
Runner-up  : conventional   11%
Coherence  : stable (newest half 82%, preceding half 86%)
Parsers    : none — no semantic-release / changesets / git-cliff / conventional-changelog
```

`Parsers` is the line that changes the recommendation: release automation that
reads subjects makes Conventional Commits the answer regardless of what the
history looks like, and a rewrite away from it breaks the release pipeline.

### 3. Ask which style — one question, custom always available

One numbered-options block (per [`user-interaction`](../../../rules/user-interaction.md)),
recommendation on its own line underneath. The measured family leads when it
cleared the evidence bar; Conventional Commits leads when it did not, or when a
parser exists:

```
1. Keep the house style — `[JIRA-123] Subject` (84% of commits already match)
2. Conventional Commits — `feat(scope): subject`
3. Plain imperative — `Add the thing` (no prefix)
4. My own — describe or paste it (see below)
```

**Option 4 is never omitted, whatever the measurement found.** Take the user's
answer as either a template with placeholders (`[{TICKET}] {Subject}`,
`{type}({scope}): {subject}`) or two or three example subjects, and echo back
the pattern you derived from it plus one rewritten sample from their real
history before touching anything. A custom style the user cannot recognise in a
sample of their own commits is a misread, and this is the cheap moment to catch
it.

Whatever is chosen, these hold and are not offered as choices — they are floors
a style selection may not lower (see the skill's *What a measurement may never
lower*): no attribution or co-author trailers the user did not ask for
([`no-attribution-footers`](../../../rules/no-attribution-footers.md)), no emoji in
subjects ([`no-decorative-emojis-in-git-surfaces`](../../../rules/no-decorative-emojis-in-git-surfaces.md)),
and no secret pulled into a message
([`secret-vcs-guard`](../../../rules/secret-vcs-guard.md)).

### 4. Ask how far back — default is everything

Second question, its own turn:

```
1. All commits (default)
2. Since a date — e.g. 2026-01-01
3. Since a ref — e.g. the last tag, or origin/main
```

Resolve a date to a boundary commit and keep the resolved SHA, not the date:

```bash
BASE=$(git rev-list -1 --before='<date>' HEAD)   # empty => whole history
```

An empty `BASE` means the range reaches the root commit — say that plainly,
because it is also the case `git rebase` cannot handle and the one that most
needs `filter-repo`.

### 5. Scope by author — own commits unless told otherwise

**Default: only commits whose author email matches the current user**
(`git config user.email`). Widen only on an explicit instruction the user gave
— either in the original invocation ("fix all of them", "also [name]'s") or as
the answer here. Do not offer widening as an option when they did not raise it;
rewriting a colleague's commit message is their call, not a menu item.

```bash
ME=$(git config user.email)
git log ${BASE:+$BASE..}HEAD --no-merges --author="$ME" --pretty=oneline | wc -l
```

Also handle the mailmap case: a user with several historical addresses
(`git log --format='%aE' | sort -u`) should be shown the list and asked which
are theirs, once, rather than silently missing half their own commits.

### 6. Show the plan, then ask for the rewrite

Produce a preview table — old subject → new subject — for every commit in
scope, capped at 40 rows with a count of the remainder. Include the rows where
**nothing changes**: a commit already in the target style is a row that proves
the classifier read it correctly.

Then, in one block, state:

- the number of commits rewritten and the number left alone;
- whether the range contains commits that are **already pushed**
  (`git branch -r --contains <oldest-in-range>`) — if yes, name the force-push
  and the re-clone every collaborator will need;
- whether the range crosses the **default branch** — rewriting merged history
  is a different order of disruption and gets its own sentence;
- the backup ref you are about to write.

Ask for the yes. Wait. Do not run anything in the turn you ask.

### 7. Rewrite

**7a. Backup first, always.** Never skip this, and never make it conditional:

```bash
git tag "backup/pre-message-fix-$(date +%Y%m%d-%H%M%S)"
git rev-parse HEAD    # record it in the reply
```

**7b. Rewrite the messages.**

`git filter-repo` with a `--commit-callback`, because the callback needs the
author email to honour the scope from step 5 — `--message-callback` sees the
message alone and cannot:

```bash
git filter-repo --force --partial --refs "${BASE:+$BASE..}HEAD" \
  --commit-callback '
    import re
    if commit.author_email != b"<me@example.com>":
        return
    subject, sep, body = commit.message.partition(b"\n")
    new = rewrite(subject)          # the step-3 pattern, applied
    commit.message = new + sep + body
  '
```

`--partial` keeps the `origin` remote, which plain `filter-repo` strips as a
safety measure; without it the next step has nowhere to push. Keep bodies
intact unless the user asked for body edits — the question in step 3 was about
subjects.

Fallback without `filter-repo`, for a range that does not reach the root
commit:

```bash
git rebase -i --exec 'git commit --amend --no-edit --reset-author=false' <BASE>
```

— and in practice, a scripted `--exec` that reads `%s`, applies the pattern and
runs `git commit --amend -m`. It is slower, it stops on every conflict, and it
cannot rewrite a root commit. Say which path you took.

**7c. Verify before reporting.**

```bash
git log ${BASE:+$BASE..}HEAD --pretty=format:'%h %aN <%aE> %ad %s' | head -20
git rev-list --count HEAD                       # same count as before the rewrite
git diff <backup-tag> HEAD --stat               # MUST be empty: no content changed
```

The `git diff` line is the load-bearing check, not the log: a message rewrite
that altered a single byte of tree content is a defect, and an empty diff
against the backup tag is what proves it did not. Report its actual output.

### 8. Push — a separate, explicit authorisation

The yes in step 6 authorised the **rewrite**, not the push. Anything already on
a remote needs `git push --force-with-lease` (never bare `--force`), and per
[`git-history-discipline`](../../../rules/git-history-discipline.md) a rewrite of
pushed history is re-pushed **in the same turn** or not performed at all. Ask,
then push in that turn, then verify:

```bash
git push --force-with-lease origin <branch>
git log --oneline -3 origin/<branch>
```

Leave the backup tag in place. Tell the user its name, and that recovery is
`git reset --hard <backup-tag>` — plus a force-push, if the rewrite was already
pushed.

### 9. Report

- Convention chosen, and how it was established (measured / user-supplied / tier-1).
- Range, author scope, commits rewritten vs unchanged.
- The `git diff <backup-tag> HEAD --stat` result, quoted.
- The backup tag and the one-line recovery command.
- Whether it was pushed, and to where.

## Do NOT

- Do NOT rewrite anything before both the style answer and the step-6 yes.
- Do NOT widen past the invoking user's own commits without an explicit
  instruction — and never by offering it as a menu option they did not raise.
- Do NOT use `git filter-branch`, bare `git push --force`, or `--no-verify`.
- Do NOT drop the backup tag, and do NOT skip the `git diff` content check.
- Do NOT rewrite a commit another live session authored without asking.
- Do NOT let a chosen style carry an attribution trailer, a subject emoji, or
  anything `secret-vcs-guard` would stop at write time.
