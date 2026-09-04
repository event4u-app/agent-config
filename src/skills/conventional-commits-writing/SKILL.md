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
grep -rniE 'commit|conventional' CONTRIBUTING.md docs/CONTRIBUTING.md 2>/dev/null | head
grep -rniE 'semantic-release|changesets|git-cliff|conventional-changelog|commitlint' \
  package.json composer.json pyproject.toml Cargo.toml .github/workflows/ .gitlab-ci.yml \
  2>/dev/null | head
```

A hit ends the procedure — that is the convention, and no measurement can
outrank it. Say which file answered.

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

```bash
git log --first-parent origin/HEAD --no-merges -n 200 \
  --since='24 months ago' --pretty=format:'%aN%x09%aE%x09%s'
```

`--first-parent` keeps the trunk's own commits; `--no-merges` drops merge
commits. Then drop, from the sample:

- **bot authors** — `[bot]`, `dependabot`, `renovate`, `github-actions`,
  `semantic-release`, `release-please`;
- **automation subjects** — `^Revert `, `^Merge `, `chore(release)`,
  `^Bump `, a bare `v?\d+\.\d+\.\d+`;
- **bulk imports** — any single commit touching > 500 files.

### 3. Classify each surviving subject

Match in order; first hit wins, `other` is the fallthrough:

| Family | Shape |
|---|---|
| `conventional` | `^(build\|chore\|ci\|docs\|feat\|fix\|perf\|refactor\|revert\|style\|test)(\(.+\))?!?: ` |
| `ticket-prefix` | `^\[?[A-Z][A-Z0-9]+-\d+\]?[:\ ]` |
| `gitmoji` | leading `:shortcode:` or emoji |
| `imperative-plain` | no marker, capitalised verb first, no trailing period |
| `other` | anything else |

Record the runner-up family too — a near-tie is itself the finding.

### 4. Aggregate, capped per author

Raw commit counts let one prolific author or an unfiltered bot define the house
style; one-vote-per-author lets a drive-by contributor with two commits veto it.
Cap instead: **each author contributes at most 20 commits** to the tally, then
compute the dominant family's share of the capped total.

### 5. The evidence bar

A measured convention is eligible to be proposed only when **all** hold:

- **n ≥ 30** eligible commits after exclusions;
- **≥ 3 distinct human authors** — or, for a single-maintainer repo, n ≥ 30 and
  a **≥ 90 %** share;
- **≥ 80 %** capped-weighted share for the dominant family;
- **temporal coherence** — the same family is dominant in the newest half of
  the sample *and* in the preceding half. If the halves disagree materially the
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
name the family, the share, the sample size, the author count, and — if a
tier-1 parser exists — the tooling that would stop parsing.

### 7. Persist the answer where the next session finds it

Write the measurement as a Class-B convention card under
`agents/memory/curated/conventions/quarantine/commit-subject.md`; the user's
approval is what moves it to `approved/`. Carry `observed_n`,
`dominant_share`, `author_count`, `sample_window`, `classifier_version`, and
`confirm_against` — aggregates only, never per-author identities. Re-measure
and re-review when the share falls below **70 %**, when a tier-1 source
appears, or when the newest half's family changes.

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
