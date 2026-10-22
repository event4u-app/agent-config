---
model_tier: inherit
name: upstream-contribute
description: "Use when a learning, new skill, rule improvement, or bug fix from a consumer project should be contributed back to the shared agent-config package."
domain: process
scope:
  write: []
  verification_reason: "execution.handler is internal, so this skill spawns no subprocess — writes happen through the agent's declared allowed_tools. No command can prove a scope the skill never executes."
execution:
  type: assisted
  handler: internal
  allowed_tools: ["Bash(./agent-config proposal:check:*)", "Bash(./agent-config self-repair:release:*)", "Bash(./agent-config doctor:*)"]
workspaces:
  - agent-config-maintainer
packs:
  - meta
---

# upstream-contribute

## When to use

- A new skill was created in a project that should be shared across all projects
- A rule or skill improvement was discovered that benefits all consumers
- A bug was found in a shared skill, rule, or command
- The `learning-to-rule-or-skill` skill identified something worth upstreaming
- An override was created locally and should become the new default
- A project-specific skill/rule could be **generalized** to benefit all consumers
- The `upstream-proposal` rule suggested a contribution and user agreed

Do NOT use when:

- **The user has NOT given explicit consent** — this is the #1 rule
- The content already exists in the shared package
- The learning is truly one-off and cannot be generalized

## Goal

Decide whether a learning, skill, rule, or fix from a consumer project is worth
contributing back to the shared `agent-config` package — and hand the ones that
are to the single outward step, which owns everything that leaves the machine.

## One way out

```
THIS SKILL NEVER PUSHES, NEVER OPENS A PULL REQUEST, AND NEVER WRITES
A SECOND, HAND-CONDENSED COPY OF AN ARTIFACT.
EVERY BYTE THAT LEAVES — BRANCH NAME, COMMIT IDENTITY, COMMIT MESSAGE,
DIFF, TITLE, BODY — LEAVES THROUGH `self-repair:release`.
THE COMMIT IDENTITY IS NOREPLY BY CONSTRUCTION; THE REST IS SCANNED FOR
CREDENTIALS AND THE CONSUMER'S OWN NAMES ONLY. A NAME IN THE DIFF OUTSIDE
THOSE PASSES, AND SAYING SO IS THE POINT: AN UNSCANNED BYTE A READER
BELIEVES WAS SCANNED IS THE WORSE STATE.
A SECOND ROUTE WOULD BE A SECOND SET OF GUARANTEES.
```

`self-repair:release` carries the privacy floor over the record text, a
payload floor over every object it pushes, the may-not-modify deny list, the
route ladder (pull request, then issue, then a local record) and an approval
bound to the digest of the exact bytes. The per-turn Hard-Floor word is the
person's: they run `--approve <digest>` themselves. A checkbox in a skill
carries none of them, which is why this skill asks a *worth it* question and
nothing else.

It pushes one commit built on `origin/main` from the branch's net change, as
the account's noreply identity. The floor reads credentials and the consumer's
identifiers; a finding skips the push.

## Core principles

- **Consent first** — NEVER create a PR, branch, or any upstream action without explicit user approval
- **Universality first** — the contribution must work for ALL consumers, not just one project
- **Generalize when possible** — project-specific content CAN become universal with adaptation
- **Evidence-based** — meets `docs/contracts/retro-v1.md` § Evidence threshold
- **One source** — an artifact is authored in `src/` only; projections are regenerated, never hand-written
- **The floor is a check, not a tick** — a privacy judgement a human ticks is not a privacy check, and today it sees credentials and consumer names only
- **Local benefit immediately** — use override for instant project benefit while the contribution is pending

## A repeated override is a signal, and a signal is not evidence

```
THE SAME ARTIFACT OVERRIDDEN IN INDEPENDENT INSTALLS IS THE CHEAPEST AVAILABLE
HINT THAT A SHIPPED DEFAULT IS WRONG. IT IS A HINT.
NEVER CHANGE A SHIPPED DEFAULT ON OVERRIDES FROM ONE ORGANISATION.
INDEPENDENT MEANS DIFFERENT TEAMS, NOT DIFFERENT DIRECTORIES.
```

`agent-config doctor --check override-set` reports which shipped artifacts a
tree overrides and in how many layers. Two same-culture installs overriding the
same artifact is **n=2 from one toolchain culture**, which is a discovery
channel and not a mandate — and the temptation to "just fix the default, we
already know" is exactly how a general package becomes one organisation's house
style.

**What makes an aggregate admissible** (package row of `retro-v1.md`):

- overrides from **independently operated** consumers, not several repositories
  of one team;
- the overriding change **converging on the same substance**, not merely
  touching the same filename — two teams deleting different halves of a rule
  are not agreeing about anything;
- a **named public mechanism** that explains why the shipped default is wrong,
  rather than "several people changed it".

Below that bar, the signal is one input to a future aggregate and nothing more.
Record it and leave the default alone.

**The signal carries no consumer content, by construction.** Artifact kind, name
and a layer count — the type has no field that can hold a path, a diff or
anything from the tree, so privacy is the schema's shape rather than a scrubbing
pass that could fail. Never widen it to make a proposal more persuasive; a
proposal that needs the consumer's diff is a proposal that has not cleared the
bar.

## Package repository

The shared agent-config package lives at:

```
git@github.com:event4u-app/agent-config.git
```

GitHub: `https://github.com/event4u-app/agent-config`

## Procedure

### 0. Mandatory consent gate

**This step is NON-NEGOTIABLE. No exceptions.**

Before ANY upstream work, ask the user:

```
> This [skill/rule/guideline] could improve the shared agent-config package.
> [Brief explanation of what would be contributed and why it's valuable]
>
> 1. Yes — hand it to the upstream step
> 2. No — keep it project-local only
```

- **If user picks 2** — STOP. Do not mention upstream again for this item.
- **If user picks 1** — continue with the procedure below.
- **NEVER skip this step**, even if the user previously agreed to other contributions.

Consent here authorizes the *preparation*. The send is a separate, per-turn
word in step 6 and this gate never substitutes for it.

### 1. Determine contribution type

`src/` is the only place an artifact is authored. ADR-201 copies every `.md`
verbatim into the projections, so there is no second version to write and no
condensation ratio to hit.

| Type | Source path |
|---|---|
| **New skill** | `src/skills/{name}/SKILL.md` |
| **New rule** | `src/rules/{name}.md` |
| **New command** | `src/domains/{domain}/{name}/command.md` |
| **New guideline** | `docs/guidelines/{category}/{name}.md` |
| **Update to existing** | Same path as original |

### 2. Apply locally as override (immediate benefit)

Create an override so the project benefits immediately:

```
agents/overrides/{type}/{name}.md
```

With frontmatter:

```yaml
---
overrides: {type}/{name}
mode: replace  # or extend
---
```

Optional for a low-urgency change.

### 2b. Generalize project-specific content (if needed)

If the content is project-specific but could be made universal:

1. **Identify project-specific parts** — domain names, local paths, project conventions
2. **Abstract them** — replace with generic patterns, configurable values, or examples
3. **Show the user the diff** — original vs. generalized version
4. **Get approval** — user must confirm the generalized version is correct

Example: A project-specific "import-csv" skill becomes a generic "file-import"
skill with a configurable format.

Generalizing is an editorial act and it is not the privacy floor. What the
floor refuses in step 4 stays local; it is never rewritten into shape.

### 3. Proposal gate — MANDATORY when a proposal doc exists

If the contribution originates from a proposal under `agents/proposals/`
(produced by `learning-to-rule-or-skill` via the pipeline in
[`self-improvement-pipeline`](../../guidelines/agent-infra/self-improvement-pipeline.md)),
run the Stage-4 gate first:

```bash
./agent-config proposal:check agents/proposals/{slug}.md
```

**Hard refusal rule:** if `./agent-config proposal:check` exits non-zero, STOP.
Surface the findings to the user, ask them to fix the proposal (add evidence,
remove TODO markers, complete required sections), then rerun.

**Also STOP unless `stage: gated`.** For `scope: package` that needs a review
record and an owner authorization on one digest.

When no proposal doc exists (small fix, typo, pure bug-fix), skip this step and
record the rationale in the finding.

### 4. See every byte before any byte leaves

```bash
./agent-config self-repair:release <fingerprint> --dry-run
```

The dry run prints the destination (repository, account, route, remote, base)
and every byte that may leave except the commit date, then their digest. It
creates nothing. Read it with the user.

A refusal from the privacy floor is **final**: the finding stays local. There
is no scrubbing pass, because a rewritten identifier is still a leaked one.

### 5. Quality gates (only inside a checkout of this package)

Run the package's full CI pipeline and confirm it is green.
[`package-ci-checks`](../../rules/package-ci-checks.md) owns the entry point
and names it; a consumer has no such runner, so the command is not repeated.
Outside a checkout the package CI runs after the issue or pull request exists.

### 6. Send — one command, one turn, one word

```bash
./agent-config self-repair:release <fingerprint> --approve <digest>
```

The user runs it; the agent prints it and never runs `--approve` itself. The
digest proves the bytes unchanged since the dry run, not consent — the agent
can read it too. Sending is a Hard-Floor action (`non-destructive-by-default`);
no autonomy setting, standing instruction or earlier consent substitutes for it.

A byte changed since the dry run voids the approval. The ladder picks the
vehicle: a pull request only when the release runs from a checkout of this
package, an issue otherwise, a local record when nothing may leave.

### 7. After merge — clean up override

Once the contribution is merged and the package is updated in the project:

```bash
rm agents/overrides/{type}/{name}.md
```

```bash
./agent-config update
```

`update` moves the `agent_config_version` pin in `.agent-settings.yml`; the
project's own package manager then fetches that version. The shared artifact
replaces the local override.

## Output format

1. Summary of what is being contributed (type, name, why)
2. The source path under `src/` that the contribution targets
3. The dry-run output verbatim — destination, payload, digest. A field it did
   not print is reported as unshown, never filled in
4. The one command the user runs to send it, and nothing executed on their behalf
5. Reminder to clean up the local override after the contribution merges

## Gotcha

- Agent in consumer project doesn't know the package repo URL — this skill provides it
- Agent may include project-specific references — the floor in step 4 refuses them
- Agent may not have git access to the package repo — the ladder degrades to an issue
- A consumer install reaches the issue step, not the pull-request step

## Do NOT

- **Do NOT create any upstream artifact without explicit user consent** — this is the #1 rule
- **Do NOT open a contribution if `./agent-config proposal:check` blocks** — fix the proposal first (step 3)
- Do NOT push, open a pull request, or open an issue by hand — the ladder owns the send
- Do NOT edit a generated projection; author in `src/` and let the package's sync step regenerate
- Do NOT write a hand-condensed second copy of an artifact
- Do NOT stage with a bare `git add .` — name the paths
- Do NOT rewrite what the privacy floor refused; a refused finding stays local
- Do NOT assume consent from a previous contribution — ask every time
- Do NOT bypass quality gates — in a checkout of this package they run BEFORE
  the send
