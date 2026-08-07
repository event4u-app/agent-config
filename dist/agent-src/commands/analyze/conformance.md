---
model_tier: high
name: analyze-conformance
pack: analysis-workbench
tier: 2
visibility: internal
sub: conformance
cluster: analyze
skills: [roadmap-writing, decision-review, ai-council, subagent-orchestration]
description: Audit recent local sessions for rule violations — deterministic scan plus subagent passes over the transcripts, root-cause each class, and emit a roadmap that mechanises what is mechanisable.
argument-hint: "[--limit N] [--scan-only] [--no-council] [--no-roadmap] [--worktree]"
suggestion:
  eligible: false
  rationale: "Cluster sub-command — reached via its cluster head's routing or its explicit /analyze:conformance name; not independently suggested (surface-consolidation)."
workspaces:
  - agent-config-maintainer
packs:
  - meta
---

# analyze-conformance

Answer one question about this agent, from evidence rather than impression:
**where did it not work the way its own rules require, and why?**

The sibling [`/analyze:inbox`](../inbox/command.md) turns somebody else's opinion
into a roadmap. This turns **the agent's own recorded behaviour** into one. The
input is not a document — it is the local transcript store, which is the only
place the agent's actual conduct is written down.

## Why this is not just a grep

The first version of this audit measured 303 language violations. The real
number was 626. The detector had inherited the very defect it was measuring:
it classified "the most recent user-role entry", and slash-command and skill
bodies arrive in the `user` role. It scored the worst session — 136 of 136
assistant turns in the wrong language — at **3**.

That is the shape of this whole job. A conformance audit is measuring a
measurement failure, so every instrument has to be checked against a case whose
answer is already known before its number is believed.

## Where the work happens — the checked-out branch, unless asked otherwise

```
RUN IN THE CURRENT BRANCH. NEVER CREATE A BRANCH, A WORKTREE, OR A PR
ON THIS COMMAND'S OWN AUTHORITY. A WORKTREE ONLY ON AN EXPLICIT ASK.
```

Same default and same reasoning as [`/analyze:inbox`](../inbox/command.md): the
roadmap and the findings land in the branch already checked out, as ordinary
uncommitted changes for the operator to review. This command authorizes
**analysis and authoring** — not a git shape
([`scope-control`](../../../../rules/scope-control.md) § Git operations).

An isolated worktree runs only when the invocation asks for one — `--worktree`,
or the operator saying so in the prompt. Then follow
[`using-git-worktrees`](../../../../skills/using-git-worktrees/SKILL.md),
including its seeding allow/deny list.

One difference from its sibling worth knowing: a **full** run of this command
(subagent fan-out plus council) is long enough that a worktree can genuinely
earn its price by keeping a multi-file diff off the current branch. It still
does not take one by itself — that is the operator's call, and `--worktree` is
how they make it.

## Procedure

### 1 — Scan (deterministic, always)

```bash
agent-config conformance:behavior --limit <N> --output conformance-report.json
```

Replays the local transcript store through the four **mechanised** checks:
language pin, git authorization, vacuous evidence, evidence steering. Every
classifier is imported from the gate it measures, so the scan and the gate
cannot drift apart.

This is the floor, not the audit. It sees only what already has a gate — which
is exactly why it is trustworthy and exactly why it is not sufficient.

`--scan-only` stops here.

### 2 — Read the transcripts (subagent fan-out)

The scan cannot see a rule that has no gate: an ask handed over as a trailing
parenthetical, a completion claimed on the wrong evidence, a root cause named
and then not fixed. Those need reading.

- Build per-session digests (user turns + assistant prose, tool calls stripped)
  so a session fits in a subagent's context.
- Group them into balanced batches by size, and dispatch **one subagent per
  batch, in parallel**, each returning findings in a fixed shape:
  rule · session · timestamp · **verbatim quote** · what happened · why
  (hypothesis) · severity.
- A finding without a quote is discarded. The quote is what makes the finding
  auditable by someone who was not in the session.

Highest-signal evidence, in order: a user turn correcting the agent; a user turn
expressing frustration; the agent's own retro sentence admitting a mistake. Any
of those three outranks a rule read in the abstract, because it is ground truth
about what actually cost the user something.

### 3 — Root-cause each class, then pick a mechanism

Group findings into classes and, for each, ask the only question that matters:

> The rule was in context, at full strength, when this happened. So what would
> a prose change buy?

Usually nothing. Choose exactly one per class:

| Choice | When |
|---|---|
| **Deterministic gate** | The failure is a state transition observable at a hook event (a git op, a claim of verification, a dispatch). Name the event and whether it warns or blocks. |
| **Context injection** | The context is genuinely missing a *fact*, not attention — the language pin is the worked example. |
| **Rule-text change** | The rule is wrong or its trigger is mis-stated, not merely unheeded. |
| **Nothing** | Accept the rate and **delete the claim that it is enforced.** |

Reach for a mechanism only where the failure mode was measured. A gate for a
class nobody was harmed by is the mechanism-without-a-failure-mode this repo
forbids.

**What round 5 measured about the choice itself** — the first post-fix reading,
2026-08-07, 27 sessions:

| carrier class | bound at | before | after |
|---|---|---:|---:|
| BLOCKING (unauthorized irreversible git op) | `pre_tool_use` | 8 | **0** |
| BLOCKING (evaluator prompt pre-loading its verdict) | `pre_tool_use` | 1 | **0** |
| advisory state injection (language mirror) | `user_prompt_submit` | 555 | **19** |
| advisory (verification claimed on empty output) | `post_tool_use` | 4 | **1** |

Both blocking carriers reached zero. Neither advisory carrier did. This is a
prior on the table above, not a law: the post-fix corpus is one session and
roughly 600 assistant turns, and the two classes also differ in what they are
asked to catch. But where a class has already failed with its fact **verifiably
in context** — round 5 confirmed the language pin present on the turns that
violated it — raising the injection frequency is the same mechanism, not a new
one. Two council members called that theatre independently. Prefer the refusal,
or take the honest downgrade.

### 4 — Council (unless `--no-council`)

Route the class list and the proposed mechanisms to the AI council. Ask it
directly for the strongest objection to your own plan, and ask which parts are
theatre. Record where you **depart** from its verdict and why — a council
recommendation adopted without a stated reason is not a review, it is cover.

### 5 — Roadmap (unless `--no-roadmap`)

Per [`roadmap-writing`](../../../../skills/roadmap-writing/SKILL.md). The
roadmap must carry:

- the measured numbers, with the method that produced them;
- any number that was **corrected during the audit**, published beside the
  correction rather than silently replaced;
- one phase per mechanised class;
- a final phase of **honest downgrades** — every enforcement claim the audit
  proved false;
- a table of classes deliberately **not** fixed, each with its reason.

### 6 — Validate the instruments before trusting them

Before the roadmap is believed, run every new detector and gate against:

- **the worst known case** — if it does not fire there, the instrument is wrong,
  not the corpus;
- **this session's own behaviour** — the audit that produced this command found
  its own evidence-steering gate flagging six of its own analysis subagents.

## Flags

| Flag | Effect |
|---|---|
| `--limit N` | How many recent sessions to read (default 30). |
| `--scan-only` | Step 1 only — the deterministic report, no subagents, no spend. |
| `--no-council` | Skip step 4. Record that it was skipped. |
| `--no-roadmap` | Findings only; no artefact authored. |
| `--worktree` | Opt into an isolated worktree. Off by default — see above. |

## Do NOT

- Trust a number this audit computed without validating the instrument (§ 6).
- Ship a stronger adjective as a fix for a rule that already failed at full
  strength.
- Let the scan cover a class that has no gate — a report over un-mechanised
  rules reads as enforcement and is not.
- Fold execution into this command. It audits and it plans; running the roadmap
  is [`/roadmap:process-full`](../../../meta/roadmap/process-full/command.md) on
  a later turn, per `scope-control` § Authoring vs. implementation.

## See also

- [`conformance:behavior`](../../../../scripts/conformance_scan.ts) — the
  deterministic half, and the only part that runs without a model.
- [`/analyze:inbox`](../inbox/command.md) — same output shape, external input.
- [`evaluator-independence`](../../../../rules/evaluator-independence.md) —
  binds step 2: this command dispatches evaluators, so its own prompts are
  subject to it.
