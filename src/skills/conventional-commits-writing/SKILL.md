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
| **1b — declared** | `git.commit_format` in `.git-convention.yml`, the team's committed carrier at the repository root (ADR-283), where either value is a declaration — a team that commits `ticket-scope` chose it. Without the carrier, `git.commit_format: ticket-conventional` in a developer settings file, where only the non-default value declares anything: `ticket-scope` is also what a copied template carries, so it proves no choice. `agent-config git:convention show --key commit_format` names the file and the state; `malformed` or `invalid` declares nothing and is reported, never read as the default | yes — the user's own word, so no measurement and no ask |
| **2 — measured + approved** | the consensus pass below, after the user says yes | yes, for this repository |
| **3 — measured, unapproved** | the same pass before the user answers | **no — advisory**; report the mismatch, write Conventional |
| **4 — default** | Conventional Commits | yes |

`agent-config git:convention subject` validates against tiers 1b–4 only. A
tier-1 commitlint config or `commit-msg` hook is named in a `note:` line as also
running at commit, possibly stricter; the verb never infers what it accepts and
never changes its exit for it.

Release automation is the trap that makes tier 1 outrank tier 2 even when the
history disagrees: a repo whose `git log` is 85 % `[JIRA-123] Fix thing` but
whose manifest (`package.json`, `composer.json`, `pyproject.toml`, `Cargo.toml`)
runs `semantic-release` or its ecosystem equivalent is a repo **migrating toward**
Conventional Commits, and the measurement is reading its past, not its intent.
Check for the parser before you trust the prevalence.

### 1. Look for tier 1 before measuring anything

```bash
agent-config git:convention show --key commit_format   # tier 1b: valid from .git-convention.yml (either value), or ticket-conventional from a settings file
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

### 2. Measure the history — `agent-config git:convention measure`

The measurement is code. `agent-config git:convention measure [--limit N]
[--family F] [--json]` samples the history, classifies, caps, aggregates and
judges it, and writes nothing. The sample size, the exclusions and every
threshold it applies are the `measure` rows of the generated block in
[`commit-subject`](../git-workflow/references/commit-subject.md) § The grammar,
rendered from the module the verb runs — read them there, never from memory.
What the verb reports, and why each choice is the one it makes:

| Dimension | Native source | What `measure` does with it |
|---|---|---|
| Subject grammar | `git log` on the trunk | classifies, caps, judges — the only dimension that can be **established** |
| Branch naming | `git for-each-ref refs/remotes`, without `HEAD` and the default branch | proposes a `branch_pattern` among the shapes the reader accepts, or `no clear pattern` — merged branches are often deleted, so the sample is thin |
| Update style | merge subjects that bring the default branch into a topic branch | **shown, never adopted** — `update_strategy` is a team decision, not a habit to copy |
| PR title shape, granularity | forge API · per-commit diff stat | not measured — granularity is destroyed where the repository squash-merges |

**The trunk** is `origin/HEAD`, else `origin/main`, else `origin/master`, else
`HEAD` — `origin/HEAD` is absent in a `git init` + `git remote add` checkout,
in many CI checkouts and in worktrees, and a chain that silently falls through
to an empty argument would hide that the resolution failed.

**`--first-parent` is deliberately absent.** On a merge-commit workflow the
trunk's first-parent chain is merge commits, which `--no-merges` then drops — the
two together leave only what was committed straight to the trunk, which on a
PR-based repo is nearly nothing. The convention lives in the feature commits.

**Exclusions** — bot authors, automation subjects (reverts, merges, release
chores, version bumps, bare versions) and bulk imports. The verb reads the file
count of every sampled commit in the same `git log` call, so the bulk check costs
no extra subprocess.

**Classification** — the `family` rows of the same block, matched in order,
first hit wins: `conventional`, `ticket-conventional`, `ticket-prefix`,
`gitmoji`, `imperative-plain`, else `other`. `ticket-conventional` precedes
`ticket-prefix`, which would otherwise swallow it as "ticket, then free text".
`imperative-plain` is deliberately mechanical — capitalised first word, no
trailing period — and does **not** test for the imperative mood: mood needs a
verb lexicon this procedure does not ship, and `Update` versus `Updated` is
exactly the pair a lexicon-free test cannot separate. A repo whose only
distinction from Conventional is mood reads as `imperative-plain` either way,
and the mood question belongs in the ask at step 3. `classifier_version` in the
verb's output and on the card names the revision of the families and exclusions
(`ticket-conventional` was added 2026-10-06; re-measure an older card).

**Aggregation, capped per author, per half.** Raw counts let one prolific author
or an unfiltered bot define the house style; one vote per author lets a drive-by
contributor with two commits veto it. The verb splits the sample into a newer and
an older half by position first, then caps each author within each half —
capping the sample as a whole would let one author's newest commits fill the
quota and empty the older half, which is exactly where the coherence check has to
look. Shares are over the **capped** total, and the verb reports that total; a
percentage quoted against the raw eligible count describes a statistic nobody
computed. With fewer than three authors the cap is off and the stricter uncapped
bar applies: there is no dominance to guard against, and a cap would put the
minimum sample out of reach of its own denominator. Two authors take the stricter
branch rather than falling between the two.

**Temporal coherence.** The same family must lead the newer **and** the older
half. Halves that disagree mean the repository is **migrating**: the verb names
both families and establishes the newer half's family only if the newer half
clears the bar on its own (`migrating` in the output).

**Verdict.** At or above the bar the verb names the established family; below it,
the reasons and the **two strongest** families with a grammar. Record the
runner-up either way — a near-tie is itself the finding.

> The share bar is the stricter of two council positions (2026-09-04,
> anthropic + openai, 2/2 quorum); the per-author cap is why a separate
> author-share clause was not also adopted — it already answers the dominance
> concern that clause existed for. These are policy heuristics, not statistically
> derived thresholds. **Revisit-if:** a labelled corpus of repositories shows a
> false-positive or false-negative rate that a different bar would fix.

### 3. Ask once — never adopt silently

Only an **interactive** `/commit` asks, and only while `git:convention show --key commit_format`
prints `no convention established` — no declaration and no approved card. It
asks once, as numbered options (per `user-interaction`), naming the family, the
share **and the capped total it was computed over**, the author count, and — if a
tier-1 parser exists — the tooling that would stop parsing:

- **at or above the bar** — the established family (recommended) vs Conventional
  Commits;
- **below the bar** — the two strongest families vs Conventional Commits, with
  the reasons the verb gave.

`/commit:in-chunks` never asks: it reports the measurement in its summary and
uses the card, or the default. Until the user answers, a measurement is tier 3 —
advisory.

### 4. Persist the answer where the next session finds it

The answer is the approval, so `/commit` writes the card straight to
`agents/memory/curated/conventions/approved/commit-subject.md` — **also when the
answer is Conventional Commits**, so the question is never asked again.
`git:convention measure --family <answer>` prints the card's content: a Class-B
convention card carrying `dominant_family`, `observed_n`, `dominant_share`,
`author_count`, `sample_window`, `classifier_version`, `confirm_against` and
`ticket_keys` — aggregates only, never per-author identities. A measurement the
agent records without an answer goes to `quarantine/` instead. `ticket_keys`
lists the approved project keys (`ticket_keys: [DEV, OPS]`): it is filled from the
user's answer when `/commit` meets a key not on it, and a commitlint config's
`issuePrefixes` are offered as the proposal, never written silently. Re-measure
and re-review when the share falls below **70 %**, when a tier-1 source appears,
or when the newer half's family changes.

### 5. The team file is a human's commit

A card is one developer's memory; `.git-convention.yml` is the team's
declaration and outranks it (tier 1b). When the chosen family maps to a
`git.commit_format` value (`conventional` → `ticket-scope`, `ticket-conventional`
→ `ticket-conventional`) or a `branch_pattern` was proposed, `measure` — and
`/commit` after the answer — prints the file's ready-to-commit content.
`update_strategy` is never in it. The file is class C: the agent prints it and a
human creates and commits it. The one exception is creation on the user's
explicit yes this turn, through `agent-config git:convention init --yes` — once,
never over an existing carrier, never `update_strategy`, never committed by the
verb; the agent never writes or edits the file by hand.

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

### 3. Place the ticket, then choose the scope

Read the ticket with `agent-config git:convention ticket` and place it per [`commit-subject`](../git-workflow/references/commit-subject.md) § Placing the ticket — under `ticket-conventional` **never in the scope**.

### 4. Write the description

- State the intent clearly
- Avoid generic filler (`update stuff`, `fix things`)
- Stay concise — max 72 chars total for first line (the ticket prefix counts)
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

Only for a squash merge — rebase-and-merge keeps every commit (`/pr:merge` § 9 reads the method from the forge).

1. Read all commits in the PR
2. Identify the **net effect** — what does the PR accomplish overall?
3. Write a single subject in the convention in force (ticket placed per § Place the ticket) summarizing the net effect
4. Do not list every internal commit — summarize

## Output format

1. The convention in force and the tier that established it — `configured
   (commitlint.config.js)`, `declared (git.commit_format: ticket-conventional)`,
   `approved (family ticket-prefix, 84% of 137)`, or `default (Conventional Commits)`
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
- Do NOT put a ticket id in the scope when `git.commit_format` is `ticket-conventional`
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
