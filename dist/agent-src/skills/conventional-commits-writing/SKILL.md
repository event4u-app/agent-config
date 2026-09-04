---
model_tier: medium
name: conventional-commits-writing
description: "When writing a commit message, branch name or squash title — measure the repo's own convention first, Conventional Commits as fallback — even on a bare 'commit this'."
domain: process
scope:
  write: []
  verification_reason: "execution.handler is internal, so this skill spawns no subprocess — writes happen through the agent's declared allowed_tools. No command can prove a scope the skill never executes."
execution:
  type: assisted
  handler: internal
  allowed_tools: []
workspaces:
  - engineering
packs:
  - engineering-base
---

# conventional-commits-writing

## When to use

Use this skill when:

- Committing in a repository whose conventions you have not established this
  session — run `## Procedure: Establish the house convention` first
- Generating a commit message from staged changes
- Generating a squash merge title from a PR
- Deciding the correct Conventional Commit type for a change
- Reviewing whether a commit message is correct
- Splitting one vague change into multiple commit messages

Do NOT use when:

- Only explaining the Conventional Commits standard (just reference the rule)
- The message is already correct and does not need review
- Following the Git workflow (use `git-workflow` skill)

## Procedure: Establish the house convention (run FIRST, before any message)

Conventional Commits is this suite's **fallback**, not a universal truth. A
repository that has demonstrably converged on another grammar gets that grammar;
imposing the shipped default there produces commits that read as foreign in
`git log` and in review. The precedence, highest first:

| Tier | Source | Binding? |
|---|---|---|
| **1 — configured** | `commitlint.config.*` · `.gitmessage` · a `commit-msg` hook (husky / lefthook / `.git/hooks`) · `CONTRIBUTING.md` § Commits · a CI job that validates subjects · release automation that PARSES subjects (semantic-release, changesets, git-cliff, conventional-changelog) | yes — Class A, no approval needed |
| **2 — measured + approved** | the consensus pass below, after the user says yes | yes, for this repository |
| **3 — measured, unapproved** | the same pass before the user answers | **no — advisory**; report the mismatch, write Conventional |
| **4 — default** | Conventional Commits | yes |

Release automation is the trap that makes tier 1 outrank tier 2 even when the
history disagrees: a repo whose `git log` is 85 % `[JIRA-123] Fix thing` but
whose manifest (`package.json`, `composer.json`, `pyproject.toml`, `Cargo.toml`)
runs `semantic-release` or its ecosystem equivalent is a repo **migrating toward**
Conventional Commits, and the measurement is reading its past, not its intent.
Check for the parser before you trust the prevalence.

### 1. Look for tier 1 before measuring anything

```bash
ls commitlint.config.* .commitlintrc* .gitmessage .czrc 2>/dev/null
git config --get commit.template
ls .husky/commit-msg .git/hooks/commit-msg 2>/dev/null
grep -rniE 'semantic-release|git-cliff|conventional-changelog|release-please|commitlint' \
  package.json composer.json pyproject.toml Cargo.toml .github/workflows/ .gitlab-ci.yml \
  2>/dev/null | head
```

**Every one of these produces candidates, not verdicts — open the file before
you act on the hit.** A `commit.template` proves a template exists, not that it
constrains the subject: a `.gitmessage` carrying only a body checklist ends
nothing. `CONTRIBUTING.md` is prose and cannot be grepped for a convention —
`grep -i commit` matches "please commit early and often" — so read its commits
section if it has one and take the grammar from the sentences, not from the
match. Only a **confirmed** source ends the procedure, and when it does, say
which file answered.

`changesets` is deliberately not in the parser list: it reads `.changeset/*.md`
files and never parses a commit subject, so its presence says nothing about the
convention. The four that do parse subjects — semantic-release, git-cliff,
conventional-changelog, release-please — count only when the hit is a real
dependency or a wired job, not a mention in a comment.

The tier table above calls a confirmed hit Class A. That is exact for a machine
-readable config and loose for `CONTRIBUTING.md`, which carries no digest and is
read by a human judgement — treat a prose source as tier 1 in **precedence** and
as a quoted sentence in the report, so the next reader can check it.

### 2. Sample the history — native source per dimension

Only **commit subjects** are reliably measurable from a clone. Branch names,
PR titles and commit granularity have different native sources, and `unknown`
is a valid, honest result for each:

| Dimension | Native source | Measurable from a clone? |
|---|---|---|
| Subject grammar | `git log` | yes |
| Branch naming | forge refs / `git branch -r` | partially — merged branches are often deleted |
| PR title shape | forge API (`gh pr list`) | only with forge access |
| Granularity (atomic vs batched) | per-commit diff stat | **no** where the repo squash-merges — the evidence was destroyed at merge |

Resolve the trunk explicitly. `origin/HEAD` is set by `git clone` and is absent
in a `git init` + `git remote add` checkout, in many CI checkouts and in
worktrees, where the sample command would die rather than return nothing:

```bash
TRUNK=$(git symbolic-ref -q --short refs/remotes/origin/HEAD)
[ -n "$TRUNK" ] || TRUNK=$(git rev-parse -q --verify origin/main >/dev/null && echo origin/main)
[ -n "$TRUNK" ] || TRUNK=$(git rev-parse -q --verify origin/master >/dev/null && echo origin/master)
[ -n "$TRUNK" ] || TRUNK=HEAD          # no remote at all: this checkout is the trunk
git log "$TRUNK" --no-merges -n 200 --since='24 months ago' \
  --pretty=format:'%H%x09%aN%x09%aE%x09%s'
```

**`--first-parent` is deliberately absent.** On a merge-commit workflow the
trunk's first-parent chain is merge commits, which `--no-merges` then drops —
the two together leave only what was committed straight to the trunk, which on
a PR-based repo is nearly nothing. The convention lives in the feature commits,
so walk the whole reachable history and exclude merges alone.

The terminal `HEAD` matters as much as the first line: a chain that ends with an
unset `TRUNK` hands `git log` an empty argument, which walks `HEAD` anyway —
silently doing the right thing on a local repo while hiding that the resolution
failed on one where it should not have.

`%H` leads the format because two of the exclusions below need the commit, not
just its subject. Drop, from the sample:

- **bot authors** — `[bot]`, `dependabot`, `renovate`, `github-actions`,
  `semantic-release`, `release-please`;
- **automation subjects** — `^Revert `, `^Merge `, `chore(release)`,
  `^Bump `, a bare `v?\d+\.\d+\.\d+`;
- **bulk imports** — resolve with the hash the format carries:
  `git show --stat --oneline <sha> | tail -1` and drop anything over 500 files.
  Check this only for the handful of subjects that read like an import; running
  it per commit costs 200 subprocesses to remove two rows.

### 3. Classify each surviving subject

Match in order, first hit wins. These are POSIX extended regular expressions,
given outside a table because a markdown cell would need the alternation pipes
escaped and `\|` in ERE is a literal pipe, not an alternation:

```
conventional      ^(build|chore|ci|docs|feat|fix|perf|refactor|revert|style|test)(\([^)]+\))?!?: 
ticket-prefix     ^\[[A-Z][A-Z0-9]+-[0-9]+\][: ]|^[A-Z][A-Z0-9]+-[0-9]+[: ]
gitmoji           ^:[a-z0-9_+-]+:[[:space:]]|^[^[:ascii:][:space:]]
imperative-plain  ^[A-Z][a-z]+[[:space:]].*[^.]$
other             everything else
```

`imperative-plain` is deliberately mechanical — capitalised first word, no
trailing period — and does **not** test for the imperative mood. Mood needs a
verb lexicon this procedure does not ship, and `Update` versus `Updated` is
exactly the pair a lexicon-free test cannot separate. That is a stated limit of
the classifier, not a gap to fill by guessing: a repo whose only distinction
from Conventional is mood will read as `imperative-plain` either way, and the
mood question belongs in the ask at step 6.

`classifier_version` in step 7 names the revision of THIS section — the five
patterns above plus the exclusions in step 2. It is a provenance stamp so a
later measurement can be compared against a like one; it does not claim an
executable classifier ships anywhere in the tree.

Record the runner-up family too — a near-tie is itself the finding.

### 4. Aggregate, capped per author, per half

Raw commit counts let one prolific author or an unfiltered bot define the house
style; one-vote-per-author lets a drive-by contributor with two commits veto it.
Cap instead: split the sample into a newer and an older half by position first,
then let **each author contribute at most 20 commits to each half**. Capping the
sample as a whole would let one author's newest 20 fill their entire quota and
empty the older half, which is precisely where step 5's coherence check has to
look.

Compute the dominant family's share over the **capped** total, and report that
total — a percentage quoted against the raw eligible count describes a statistic
nobody computed.

With fewer than three authors the cap is **off**: there is no dominance to guard
against, and a cap of 20 would put the single-maintainer bar's own `n ≥ 30`
out of reach of its denominator.

### 5. The evidence bar

A measured convention is eligible to be proposed only when **all** hold:

- **n ≥ 30** eligible commits after exclusions;
- **≥ 80 %** capped-weighted share for the dominant family, over **≥ 3 human
  authors** — or, with **one or two** authors, an uncapped **≥ 90 %** share over
  n ≥ 30. Two authors take the stricter branch rather than falling between the
  two: a two-person repo is a small-team repo, and leaving it unreachable by
  both branches would make the measurement permanently advisory there;
- **temporal coherence** — the same family is dominant in the newer half of
  the sample *and* in the older half. If the halves disagree materially the
  repository is **migrating**: abstain, name the change point, and use the
  newer half's family only if it independently clears the bar.

> The 80 % figure is the stricter of two council positions (2026-09-04,
> anthropic + openai, 2/2 quorum: 70 % vs 80 % + a two-thirds-of-authors
> clause). The per-author cap is why the separate author-share clause was not
> also adopted — it already answers the dominance concern the clause existed
> for. These are policy heuristics, not statistically derived thresholds.
> **Revisit-if:** a labelled corpus of repositories shows a false-positive or
> false-negative rate that a different bar would fix.

### 6. Ask — never adopt silently

Below the bar, or on a migrating repo: use Conventional Commits and say so
**once**, in one line, when a commit is actually requested. Do not ask.

At or above the bar, ask once, as numbered options (per `user-interaction`):
name the family, the share **and the capped total it was computed over**, the
author count, and — if a tier-1 parser exists — the tooling that would stop
parsing.

### 7. Persist the answer where the next session finds it

Write the measurement as a Class-B convention card under
`agents/memory/curated/conventions/quarantine/commit-subject.md`; the user's
approval is what moves it to `approved/`. Carry `observed_n`,
`dominant_share`, `author_count`, `sample_window`, `classifier_version`, and
`confirm_against` — aggregates only, never per-author identities. Re-measure
and re-review when the share falls below **70 %**, when a tier-1 source
appears, or when the newer half's family changes.

## What a measurement may never lower

Prevalence answers *what happened*, never *what the agent is permitted to do* —
so a house convention can change how a commit reads, and can never change what
the agent is allowed to commit. Three override policies:

| Policy | Applies to | Examples |
|---|---|---|
| `never` | authorization · security · integrity · destructive history · agent provenance | [`commit-policy`](../../rules/commit-policy.md) · [`secret-vcs-guard`](../../rules/secret-vcs-guard.md) · [`git-history-discipline`](../../rules/git-history-discipline.md) · [`non-destructive-by-default`](../../rules/non-destructive-by-default.md) · [`no-attribution-footers`](../../rules/no-attribution-footers.md) |
| `explicit-only` | governance preferences a maintainer may lift deliberately, that history may not | [`no-decorative-emojis-in-git-surfaces`](../../rules/no-decorative-emojis-in-git-surfaces.md) |
| `approved-observation` | representation — subject grammar, ticket prefixes, type vocabulary, capitalisation, mood, subject length, body wrapping | this procedure |

So a repository whose history is 70 % emoji subjects does **not** license emoji
subjects: that rule is `explicit-only`, and the lift is the maintainer's word,
not the log's. A repository whose history is 60 % attribution trailers licenses
nothing at all. The council split here (one member argued subject-line emoji is
a defect and absolute, the other that it is governance taste) resolves to
`explicit-only` because both positions agree on the operative half — **history
may not lift it**.

## Procedure: Generate commit message

### 1. Identify the actual intent

Determine whether the change is:

- New behavior → `feat`
- Bug fix → `fix`
- Structural cleanup → `refactor`
- Docs only → `docs`
- Tests only → `test`
- CI/build/tooling → `ci` or `build`
- Maintenance → `chore`
- Performance → `perf`
- Formatting only → `style`

Classify by **user-visible or system-relevant intent**, not by file type alone.

### 2. Detect mixed concerns

Check whether the change includes more than one unrelated concern.

If yes:

- Suggest splitting into multiple commits
- Or choose the dominant net effect for squash merge title

### 3. Choose scope

Add a scope only if it improves clarity:

- Jira ticket ID: `DEV-1234`
- Module/area: `api`, `auth`, `skills`, `rules`, `ci`

### 4. Write the description

- State the intent clearly
- Avoid generic filler (`update stuff`, `fix things`)
- Stay concise — max 72 chars total for first line
- Imperative mood: "add", "fix", "remove" — not "added", "fixed", "removed"

### 5. Check for breaking change

If compatibility is broken, add `!` after type/scope:

```
feat(api)!: rename invoice status values
```

Or add `BREAKING CHANGE:` in the commit body/footer.

### 6. Validate

- Type matches intent?
- Scope is useful (not noise)?
- Description is specific (not generic)?
- Not hiding multiple unrelated changes?
- Breaking changes are marked?

## Procedure: Review existing commit message

1. Parse the message into type, scope, description
2. Check type accuracy against the actual diff
3. Check scope usefulness
4. Check description clarity and specificity
5. Suggest corrections if any check fails

## Procedure: Generate squash merge title

1. Read all commits in the PR
2. Identify the **net effect** — what does the PR accomplish overall?
3. Write a single Conventional Commit message summarizing the net effect
4. Do not list every internal commit — summarize

## Output format

1. The convention in force and the tier that established it — `configured
   (commitlint.config.js)`, `approved (ticket-prefix, 84% of 137)`, or
   `default (Conventional Commits)`
2. Recommended commit message(s)
3. Brief rationale for type choice
4. Split suggestion if the change should be multiple commits

## Gotcha

- The model tends to overuse `chore` and `refactor` — classify by intent, not by effort
- File type alone does not determine commit type (e.g. a `.md` change can be `feat` if it's a new feature doc)
- Squash merge titles should describe the net effect, not every internal detail
- `refactor` means NO behavior change — if behavior changes, use `feat` or `fix`
- A high dominant share over a long window can hide a format change six months
  ago — the temporal-coherence check, not the share, is what catches it
- Squash-merging destroys commit-granularity evidence; report granularity as
  `unknown` there rather than inferring it from the trunk

## Frugality Standards

Apply the [Frugality Charter](../../contexts/contracts/frugality-charter.md)
to every commit message you author.

**Examples in this artifact:**
- Per the charter's default-terse rule, the subject states the
  change in 50 chars; no scaffolding ("This commit will…").
- Per the post-action summary suppression, the body lists changed
  surfaces in bullets — no closing paragraph re-summarizing them.
- Per the cheap-question check, never propose a `feat` vs. `chore`
  numbered choice when the type is decidable from the diff.

**Pre-save self-check:**
1. Does the subject line carry filler ("various improvements",
   "general updates")?
2. Does the body re-narrate the diff instead of stating intent?
3. Are co-author / attribution footers present without explicit user
   request (per
   [`no-attribution-footers`](../../rules/no-attribution-footers.md))?
4. Is the type / scope chosen from the diff, not from the asker's
   framing?

## Do NOT

- Do NOT impose Conventional Commits on a repository that has a configured or
  approved convention of its own
- Do NOT adopt a measured convention without asking — below tier 2 it is
  advisory, and silence is not approval
- Do NOT let prevalence lift a `never` or `explicit-only` floor
- Do NOT use vague messages: `update stuff`, `fix bug`, `changes`
- Do NOT use `refactor` for bug fixes
- Do NOT use `chore` for meaningful behavior changes
- Do NOT hide multiple unrelated concerns in one message
- Do NOT omit breaking-change markers when compatibility changes

## References

- Rule: `commit-conventions` — base format, types, scope, examples
- Guideline: `docs/guidelines/php/git.md` — type selection rules, anti-patterns, decision checklist
- Command: `/commit` — uses this skill for message generation
- Command: `/fix commit-messages` — retro-fits past subjects to the convention
  this procedure establishes
- Context: `contexts/execution/project-intelligence.md` — the Class-B
  consensus-pass, quarantine→approved gate and deviation-staleness mechanism
  this procedure instantiates for commit subjects
