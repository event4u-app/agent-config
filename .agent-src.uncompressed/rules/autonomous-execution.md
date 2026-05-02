---
type: "auto"
description: "Deciding whether to ask the user or just act on a workflow step — trivial-vs-blocking classification, autonomy opt-in detection, commit default; defers to non-destructive-by-default for the Hard Floor"
alwaysApply: false
source: package
---

# Autonomous Execution

User's time is the scarce resource. Trivial workflow questions are
noise. This rule defines **trivial** (just act), **blocking** (still
ask), the **hard floor** (always ask, no override), and the **commit
default** (never commit, never ask — review-first by design).

## Hard Floor — see [`non-destructive-by-default`](non-destructive-by-default.md)

The universal safety floor (production-branch merges, deploys, pushes,
prod data/infra, whimsical bulk deletions, and commits containing
bulk deletions or infra changes) is governed by the canonical
[`non-destructive-by-default`](non-destructive-by-default.md) rule.

It applies regardless of `personal.autonomy`, a standing autonomy
directive (see anchor list in [Opt-in detection](#opt-in-detection--match-by-intent-not-exact-string)),
or any roadmap authorization. Nothing in **this** rule lifts it. If a
trigger from that rule fires, stop and ask — every other section below
assumes the floor has already been cleared.

## Setting — `personal.autonomy`

| Value | Behavior |
|---|---|
| `on` | Suppress trivial questions. Act on the obvious next step. Still ask on blocking / critical decisions, and ALWAYS ask on Hard-Floor triggers. |
| `off` | Ask trivial questions too. Use this if you want the agent to check in on each workflow step. |
| `auto` (default) | Same as `off` by default. Flips to `on` for the rest of the conversation as soon as the user expresses the intent "stop asking, just work". See **Opt-in detection** below — match by **intent**, not exact string. The flip never lifts the Hard Floor. |

Read the value once on the first turn (per [`layered-settings`](../guidelines/agent-infra/layered-settings.md#section-aware-merge-rules))
and cache. Missing key → treat as `on`.

## Opt-in detection — match by intent, not exact string

In `auto` mode, flip to `on` for the rest of the conversation when the
user expresses **"stop asking on trivial steps, just work"**. Recognize
the **intent**, not the literal substring — the LLM understands the
semantic equivalent in either language.

Anchor examples (illustrative, not exhaustive):

- DE: "arbeite selbstständig" · "frag nicht jedes Mal" · "tue es einfach"
- EN: "work autonomously" · "don't ask" · "just do it"

Litmus test: would a reasonable reader interpret the message as
"standing permission to skip trivial workflow questions"? Yes → flip.
Single-decision delegation ("you decide for this step", "for this one
let me know what you'd pick") → handle that step autonomously, do
**not** flip standing mode.

### Speech-act check — the phrase must be a meta-instruction to the agent

Before flipping, verify the phrase is **addressed to the agent as
guidance about how to work**, not a literal substring inside an
unrelated instruction. The same words can be content, data, quote,
copy, code, or subject matter — none of those flip.

Do **not** flip when the phrase is:

- **Content / copy** — "Put the slogan 'just do it' on the landing page."
- **Quote / reference** — "Nike's tagline is 'just do it' — write a blog post about it."
- **Subject of a request** — "Write docs about the 'work autonomously' modes."
- **Code / data** — string literals, test fixtures, translations, JSON.
- **About a third party** — "My colleague works autonomously."
- **A question or hypothetical** — "Should I set `don't ask` as the default?"

Heuristic: strip quotes, code blocks, and embedded content. Read what's
**left**. If the remainder is still a directive to the agent about its
own working style → flip. Otherwise → don't.

Opt-out (same intent, reversed) flips back to `off`. Anchor examples:

- DE: "frag mich wieder" · "frag mich erst" · "stop autonomous mode"
- EN: "ask me first" · "ask me again" · "stop being autonomous"

Same speech-act check applies.

Counter-examples — meta-questions, self-descriptions, or one-shot
delegations do **not** flip: "why don't you ask that yourself?",
"I'm working autonomously right now", "can you decide that yourself?".

In doubt → keep current mode, no speculative flips.

## Trivial — JUST ACT, do not ask

Examples (matches `personal.autonomy: on` or `auto`-after-opt-in):

- "Should I start with Step 2 or Step 3?" — pick the obvious next step
  on the roadmap and proceed; if blocked, name the blocker, otherwise go.
- "Should we commit now or after the next change?" — answered by the
  commit-default below, no need to ask.
- "How should I split the commits?" — never asked; either you are
  invoked via `/commit-in-chunks` (split and commit) or you are not
  (don't commit at all).
- "Should I run the linter / tests now or after the change?" — run
  what `verify-before-complete` requires; don't ask.
- "I found 3 follow-up issues — fix all or stop?" — if they are within
  the stated task scope and minimal-safe-diff allows, fix them; if they
  expand scope, stop and surface them as a list.
- "Filename should be `X.md` or `Y.md`?" when one matches the
  surrounding convention — pick the convention-matching one.
- "Do you want a verification table or paragraph?" — pick whichever
  fits the conversation style; format is not a decision worth a turn.
- "Show me a diff before regenerating output from a tracked source?"
  — compression, code-gen, formatter passes, lock-file rebuilds — run
  it and report the result. Reversibility comes from the source, not
  from per-file confirmation. See [`non-destructive-by-default`](non-destructive-by-default.md#not-in-scope--deterministic-regeneration)
  § Not in scope.

When `personal.autonomy: off`: ask these. When `on` or
`auto`-after-opt-in: act.

## Blocking — STILL ASK regardless of `personal.autonomy`

Beyond the Hard Floor above, the autonomy setting also never
overrides:

- **Vague-request triggers** in [`ask-when-uncertain`](ask-when-uncertain.md)
  — ambiguous requirements stay ambiguous; pick-one-and-pray is wrong.
- **Architectural / structural choices** that the codebase doesn't
  already settle (multi-stack picks, library introductions).
- **Security-sensitive paths** — see [`security-sensitive-stop`](security-sensitive-stop.md).
- **Scope expansion** beyond the stated task — see [`scope-control`](scope-control.md).
- **Remote-state operations** — push, merge, rebase, force-push,
  branch create/delete/switch, PR create/close/retarget, tag/release.
  Permission-gated by [`scope-control`](scope-control.md); the
  prod-trunk and deploy-tied subset is governed by
  [`non-destructive-by-default`](non-destructive-by-default.md).
- **Destructive ops** — see [`non-destructive-by-default`](non-destructive-by-default.md)
  for the full taxonomy (whimsical bulk deletions, content
  destruction, commits containing bulk deletions or infra changes).

When in doubt whether something is trivial or blocking → it is
blocking. Ask.

## Commit policy — see [`commit-policy`](commit-policy.md)

Committing is governed by the canonical [`commit-policy`](commit-policy.md)
rule, which applies regardless of `personal.autonomy`. Summary:

- NEVER commit unless user said so this turn, a commit command was
  invoked, a standing instruction is active, or the roadmap authorizes it.
- NEVER ask about committing. The user invokes a command or says so.
- In autonomous mode, the **only** permitted commit-related question is
  the one-shot pre-scan ask at the start of roadmap execution.

Push, merge, rebase, branch creation, PR operations, and tags remain
permission-gated by [`scope-control`](scope-control.md#git-operations--permission-gated).

## Failure modes

- Asking "Step 2 or Step 3?" when the roadmap orders them.
- "Should I run the CI checks?" — `verify-before-complete` decides; act.
- "Do we want to commit this?" — no, by default. Don't ask.
- Numbered-options block whose only choice differences are sequencing
  ("do A then B" vs "do B then A") with no real trade-off.
- Asking after the user already issued a standing autonomy directive
  earlier in the conversation (cache the opt-in for `auto`).

For Hard-Floor failure modes (treating autonomy as cover for a
floor-crossing action, reading a roadmap step as deploy authorization,
refusing task-aligned WIP deletions, committing bulk-deletion / infra
diffs without surfacing them) see
[`non-destructive-by-default`](non-destructive-by-default.md#failure-modes).

## Cloud Behavior

Setting reads degrade gracefully on cloud platforms (no
`.agent-settings.yml` available). Treat as `personal.autonomy: on` —
the user had to deliberately ship a custom skill bundle to a cloud
agent and is unlikely to want trivial-question friction.

## See also

- [`non-destructive-by-default`](non-destructive-by-default.md) —
  universal safety floor; never overridden by autonomy
- [`scope-control`](scope-control.md) — git-ops permission gate
  (push/merge/branch/PR/tag stays explicit)
- [`ask-when-uncertain`](ask-when-uncertain.md) — vague-request
  triggers that always require asking
- [`direct-answers`](direct-answers.md) — Iron Laws on brevity and
  no-flattery (this rule extends to no-trivial-questions)
- [`/commit-in-chunks`](../commands/commit-in-chunks.md) — auto-split
  and commit without confirmation
- [`/commit`](../commands/commit.md) — split and commit with
  confirmation
