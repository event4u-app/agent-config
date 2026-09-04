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
the user invoking it authorises the *investigation*, not the rewrite.

**Author identity is preserved on both paths.** `git filter-repo` leaves author
*and* committer name, email and date untouched when only the message changes;
the `git rebase` fallback preserves the author trio and resets the committer,
because it re-commits. Say which path you are on before asking for the go-ahead
— and say only what is true of that path.

### 1. Refuse early, on facts, not on caution

Stop and report — do not proceed to step 2 — when any holds:

- **The working tree is dirty.** `git status --porcelain` non-empty → ask the
  user to commit or stash first. A rewrite over a dirty tree loses work.
- **A rebase, merge, cherry-pick or bisect is in progress**
  (`.git/rebase-merge`, `.git/rebase-apply`, `MERGE_HEAD`, `CHERRY_PICK_HEAD`,
  `BISECT_LOG`). Finish it first.
- **`git config user.email` is empty.** Step 5's default scope is built from
  it, and an empty value makes the author filter match everything — the
  opposite of the default. Ask for the address rather than inferring one.
- **`git filter-repo` is not installed** (`git filter-repo --version`). Per
  [`missing-tool-handling`](../../../rules/missing-tool-handling.md): stop and
  ask with numbered options — install it, or use the `git rebase --exec`
  fallback in step 7b, which is slower, resets committer metadata, and stops on
  every conflict. Never install it silently, and never fall back to
  `git filter-branch`, which Git itself deprecates for exactly this use.
- **The range contains commits authored by someone whose work is in flight.**
  There is no metadata that distinguishes "a peer session wrote this" from "you
  wrote this" — both carry the same `user.email` — so the checkable form is the
  one to use: `git worktree list` plus `git log <range> --format='%aE' | sort -u`.
  More than one worktree on this repository, or an author in the range who is
  not the invoking user, is the case to raise rather than resolve.

### 2. Establish the target convention — measure before offering

Run `## Procedure: Establish the house convention` from
[`conventional-commits-writing`](../../../skills/conventional-commits-writing/SKILL.md)
verbatim: tier-1 sources first (opened and read, never taken from a grep hit),
then the capped-weighted consensus pass with bots, merges, reverts and release
automation excluded.

Report what it found, in one block, before offering anything:

```
Configured : none found (no commitlint, .gitmessage, commit-msg hook, CONTRIBUTING § Commits)
Measured   : ticket-prefix  84% of 118 capped commits (137 eligible, 6 authors, last 24 months)
Runner-up  : conventional   11%
Coherence  : stable (newer half 82%, older half 86%)
Parsers    : none — no semantic-release / git-cliff / conventional-changelog / release-please
```

The share is quoted against the **capped** total, because that is what it was
computed over; the raw eligible count sits beside it and is not the denominator.

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

**A tier-1 validator vetoes an incompatible choice.** `git filter-repo` does not
run `commit-msg` hooks, so a rewrite away from a format the repo *enforces*
completes silently and then fails commitlint on the next CI run or the next
local commit. When step 2 found an enforcing source, check the chosen style
against it — run the validator over one rewritten sample if it can be run at all
— and if they disagree, say so and stop rather than rewriting into a state the
repo rejects.

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

```bash
BASE=$(git rev-list -1 --before='<date>' HEAD)   # empty => whole history
git show -s --format='%h  authored %ad  committed %cd  %s' "$BASE"
```

**`--before` filters on COMMITTER date, not author date** — so on a rebased,
cherry-picked or previously-rewritten history the boundary is not where the
user thinks it is, and a second run of this command resolves against the
timestamps the *first* run wrote. That is why the second line is not optional:
show the resolved commit with both dates and let the user confirm it is the
boundary they meant. Keep the SHA from then on, never the date.

An empty `BASE` means the range reaches the root commit — say that plainly, and
carry it into step 7, where both paths need a different form for it.

### 5. Scope by author — own commits unless told otherwise

**Default: only commits whose author email matches the current user.** Widen
only on an explicit instruction the user gave — either in the original
invocation ("fix all of them", "also [name]'s") or as the answer here. Do not
offer widening as an option when they did not raise it; rewriting a colleague's
commit message is their call, not a menu item.

```bash
ME=$(git config user.email)                       # step 1 refused if this is empty
git log ${BASE:+$BASE..}HEAD --no-merges --author="<$ME>" --pretty=oneline | wc -l
```

**The angle brackets are load-bearing.** `--author` is an unanchored regex
against `Name <email>`, so a bare `m@corp.com` also matches `Tim
<tim@corp.com>` — every colleague whose address ends with yours lands in the
default scope. `<$ME>` cannot match inside a longer address.

Also handle the mailmap case: a user with several historical addresses
(`git log --format='%aE' | sort -u`) should be shown the list and asked which
are theirs, once, rather than silently missing half their own commits. Carry the
result as a **set** of addresses — step 7b consumes the same set, and a scope
the preview and the rewrite disagree on is the defect in step 6's own table.

### 6. Show the plan, get both authorisations

Produce a preview table — old subject → new subject — for every commit in
scope, capped at 40 rows with a count of the remainder. Include the rows where
**nothing changes**: a commit already in the target style is a row that proves
the classifier read it correctly.

The table must be built with the **same** predicate step 7b will apply — the
author set, merges excluded, the same range. A preview built from `--author`
substring matching against a rewrite keyed on exact addresses describes a
different operation than the one the user is approving.

Then, in one block, state:

- the number of commits rewritten and the number left alone;
- whether the range contains commits that are **already pushed**. Fetch first —
  `git fetch origin` then `git branch -r --contains <oldest-in-range>` — because
  the check reads `refs/remotes/`, and a stale tracking ref reports "local only"
  for a branch a teammate already has;
- whether the range crosses the **default branch** — rewriting merged history
  is a different order of disruption and gets its own sentence;
- the backup ref you are about to write.

**Ask for the rewrite and, when the range is already pushed, the force-push in
the same block.** [`git-history-discipline`](../../../rules/git-history-discipline.md)
requires a rewrite of pushed history to be re-pushed in the same turn or not
performed at all, and
[`non-destructive-by-default`](../../../rules/non-destructive-by-default.md)
forbids acting in the turn you ask. Splitting the two questions satisfies
neither: a "no" to a later push question strands the repository in exactly the
rewritten-but-unpushed state the first rule forbids. So both answers come first,
then both actions run, in the turn after the answer. A "no" to either means
nothing is rewritten at all.

Wait. Do not run anything in the turn you ask.

### 7. Rewrite

**7a. Backup, and capture what the verification will compare against.**

```bash
git tag "backup/pre-message-fix-$(date +%Y%m%d-%H%M%S)"
git rev-list --count HEAD > /tmp/precount.txt
git log ${BASE:+$BASE..}HEAD --pretty=format:'%aN%x09%aE%x09%ad%x09%s' > /tmp/preplan.txt
```

The count and the subject/author list are captured **before** the rewrite
because step 7c compares against them. A verification that has no baseline is
not a verification.

**7b. Rewrite the messages.**

`git filter-repo` with a `--commit-callback`, because the callback needs the
author email to honour the scope from step 5 — `--message-callback` sees the
message alone and cannot. A worked example, normalising a ticket prefix to one
bracketed form:

```bash
git filter-repo --force --refs "${BASE:+$BASE..}HEAD" \
  --commit-callback '
    import re
    ME = {b"me@example.com"}                  # the step-5 address set, bare, no <>
    PAT = re.compile(rb"^\[?([A-Z][A-Z0-9]+-[0-9]+)\]?[: ]\s*(.+)$")
    if len(commit.parents) > 1:
        return
    if commit.author_email not in ME:
        return
    subject, sep, body = commit.message.partition(b"\n")
    m = PAT.match(subject)
    if m:
        commit.message = b"[" + m.group(1) + b"] " + m.group(2) + sep + body
  '
```

Three things that make the difference between this rewriting the history and
rewriting nothing:

- **`commit.author_email` is the bare address** — `b"me@example.com"`, never
  `b"<me@example.com>"`. Compared against the bracketed form it is unequal for
  every commit, the callback returns on every commit, filter-repo prints
  `Completely finished` and the hashes are identical. The angle brackets belong
  in `--author` (step 5) and nowhere else, and the two steps are easy to
  cross-wire precisely because they need opposite forms.
- **Merges are skipped in the callback too**, or the rewrite touches commits the
  step-6 table did not list.
- **`PAT` and the replacement are the step-3 pattern**, substituted for real.
  A callback that references a helper nothing defines is not a callback that
  failed loudly — Python evaluates the name only if control reaches it, so a
  wrong author filter hides the missing helper completely.

`--refs` implies partial mode, which is what keeps the `origin` remote that
plain `filter-repo` strips as a safety measure; `--partial` is not needed
alongside it. Keep bodies intact unless the user asked for body edits — the
question in step 3 was about subjects.

Fallback without `filter-repo`: a script that reads the subject, applies the
pattern and amends, run once per commit by `git rebase --exec`:

```bash
git rebase --exec 'agents/tmp/retitle.sh' "$BASE"    # whole history: --root instead of "$BASE"
```

Not `-i` (it opens the sequence editor for nothing) and not
`--reset-author=false` (`--reset-author` takes no value — Git rejects it with an
`option ... takes no value` error, the exec fails, and the rebase stops
mid-flight; verified against git 2.x). `git commit --amend -m "<new>"` inside the script preserves
the author trio and resets the committer. `--root` does rewrite the root commit;
the constraint on the fallback is conflicts and speed, not reachability.

If an exec does fail, the repository is left detached mid-rebase — `git rebase
--abort` first, then the step-9 recovery command. `git reset --hard` alone does
not exit that state.

**7c. Verify against the baseline, not against the tree.**

```bash
git rev-list --count HEAD                                  # equals /tmp/precount.txt
git diff <backup-tag> HEAD --stat                          # MUST be empty
git log ${BASE:+$BASE..}HEAD --pretty=format:'%aN%x09%aE%x09%ad%x09%s' > /tmp/postplan.txt
diff /tmp/preplan.txt /tmp/postplan.txt
```

The empty `git diff` proves **no content moved** — and it is equally empty when
the rewrite did nothing at all, so on its own it is a tautology, not evidence.
The `diff` of the two plan files is what carries the claim: every line that
differs must differ only in its last field, and the set of changed subjects must
match the step-6 preview. Author name, email and date are the first three
fields, so the same diff proves they survived. Report the actual output of both.

### 8. Push

The authorisation was taken in step 6, together with the rewrite's. Push in this
turn:

```bash
git push --force-with-lease origin <branch>
git log --oneline -3 origin/<branch>
```

`--force-with-lease`, never bare `--force`. Leave the backup tag in place. Tell
the user its name, and that recovery is `git reset --hard <backup-tag>` — plus a
force-push, since the rewrite was already pushed.

### 9. Report

- Convention chosen, and how it was established (measured / user-supplied / tier-1).
- Range, author scope, commits rewritten vs unchanged.
- The `diff /tmp/preplan.txt /tmp/postplan.txt` result and the
  `git diff <backup-tag> HEAD --stat` result, both quoted.
- The backup tag and the one-line recovery command.
- Whether it was pushed, and to where.

## Do NOT

- Do NOT rewrite anything before both the style answer and the step-6 yes.
- Do NOT split the rewrite and force-push authorisations across two turns.
- Do NOT widen past the invoking user's own commits without an explicit
  instruction — and never by offering it as a menu option they did not raise.
- Do NOT compare `commit.author_email` against a bracketed address, or pass a
  bare address to `--author`.
- Do NOT treat an empty `git diff <backup> HEAD` as proof the rewrite happened.
- Do NOT use `git filter-branch`, bare `git push --force`, or `--no-verify`.
- Do NOT rewrite into a style the repo's own validator rejects.
- Do NOT let a chosen style carry an attribution trailer, a subject emoji, or
  anything `secret-vcs-guard` would stop at write time.
