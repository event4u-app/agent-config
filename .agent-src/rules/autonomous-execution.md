---
type: "auto"
description: "Deciding whether to ask the user or just act on a workflow step — trivial-vs-blocking classification, autonomy opt-in detection, commit default; defers to non-destructive-by-default for the Hard Floor"
alwaysApply: false
source: package
---

# Autonomous Execution

User's time is the scarce resource. Trivial workflow questions are
noise. Defines **trivial** (just act), **blocking** (still ask), the
**hard floor** (always ask, no override), and the **commit default**
(never commit, never ask — review-first by design).

## Hard Floor — see [`non-destructive-by-default`](non-destructive-by-default.md)

Universal safety floor (production-branch merges, deploys, pushes,
prod data/infra, whimsical bulk deletions, and commits containing
bulk deletions or infra changes) is governed by the canonical
[`non-destructive-by-default`](non-destructive-by-default.md) rule.

Applies regardless of `personal.autonomy`, a standing autonomy
directive (anchor list in [Opt-in detection](#opt-in-detection--match-by-intent-not-exact-string)),
or any roadmap authorization. Nothing in **this** rule lifts it. If a
trigger from that rule fires, stop and ask — every section below
assumes the floor has cleared.

## Setting — `personal.autonomy`

| Value | Behavior |
|---|---|
| `on` | Suppress trivial questions. Act on obvious next step. Still ask on blocking decisions; ALWAYS ask on Hard-Floor triggers. |
| `off` | Ask trivial questions too. Use to check in on each workflow step. |
| `auto` (default) | Like `off` until user expresses "stop asking, just work" — then `on` for the rest of the chat. See **Opt-in detection** below; match by **intent**, not exact string. The flip never lifts the Hard Floor. |

Read once on first turn (per [`layered-settings`](../guidelines/agent-infra/layered-settings.md#section-aware-merge-rules))
and cache. Missing key → treat as `on`.

## Opt-in detection — match by intent, not exact string

In `auto`, flip to `on` for the rest of the chat when the user expresses
**"stop asking on trivial steps, just work"**. Recognize the **intent**,
not the literal substring — semantic equivalent in either language.

Anchor examples (illustrative, not exhaustive):

- DE: "arbeite selbstständig" · "frag nicht jedes Mal" · "tue es einfach"
- EN: "work autonomously" · "don't ask" · "just do it"

Litmus test: standing permission to skip trivial questions? → flip.
Single-decision delegation ("you decide for this step") → handle that
step, do **not** flip standing mode.

### Speech-act check — meta-instruction, not content

Before flipping, verify the phrase is **addressed to the agent as
guidance about how to work**, not a literal substring inside another
instruction. Do **not** flip when the phrase is:

- **Content / copy** — "Put the slogan 'just do it' on the landing page."
- **Quote / reference** — "Nike's tagline is 'just do it' — write a blog post."
- **Subject of a request** — "Write docs about the 'work autonomously' modes."
- **Code / data** — string literals, fixtures, translations, JSON.
- **About a third party** — "My colleague works autonomously."
- **Question / hypothetical** — "Should I set `don't ask` as the default?"

Heuristic: strip quotes, code blocks, embedded content. Read what's
**left**. Still a directive to the agent about its working style →
flip. Otherwise → don't.

Opt-out (reversed intent) flips back to `off`:

- DE: "frag mich wieder" · "frag mich erst" · "stop autonomous mode"
- EN: "ask me first" · "ask me again" · "stop being autonomous"

Same speech-act check applies.

Counter-examples — do **not** flip on meta-questions, self-descriptions,
or one-shot delegations: "why don't you ask that yourself?", "I'm
working autonomously right now", "can you decide that yourself?".

In doubt → keep current mode, no speculative flips.

## Trivial — JUST ACT, do not ask

Examples (matches `personal.autonomy: on` or `auto`-after-opt-in):

- "Step 2 or Step 3?" — pick the obvious next roadmap step; if blocked, name the blocker, otherwise go.
- "Commit now or after the next change?" — answered by the commit-default below.
- "How should I split the commits?" — never asked; either `/commit-in-chunks` was invoked (split + commit) or it wasn't (don't commit).
- "Run linter / tests now or later?" — `verify-before-complete` decides; act.
- "Found 3 follow-ups — fix all or stop?" — if within scope and minimal-safe-diff allows, fix; if scope expands, stop and surface as list.
- "Filename `X.md` or `Y.md`?" when one matches convention — pick convention-matching one.
- "Verification table or paragraph?" — pick whichever fits; format isn't a decision worth a turn.
- "Show me a diff before regenerating output from a tracked source?"
  — compression, code-gen, formatter passes, lock-file rebuilds — run
  it and report the result. Reversibility comes from the source, not
  from per-file confirmation. See [`non-destructive-by-default`](non-destructive-by-default.md#not-in-scope--deterministic-regeneration)
  § Not in scope.

`personal.autonomy: off`: ask these. `on` or `auto`-after-opt-in: act.

## Blocking — STILL ASK regardless of `personal.autonomy`

Beyond the Hard Floor, the autonomy setting also never overrides:

- **Vague-request triggers** in [`ask-when-uncertain`](ask-when-uncertain.md) — ambiguous stays ambiguous; pick-one-and-pray is wrong.
- **Architectural / structural choices** the codebase hasn't settled (multi-stack picks, library introductions).
- **Security-sensitive paths** — see [`security-sensitive-stop`](security-sensitive-stop.md).
- **Scope expansion** beyond stated task — see [`scope-control`](scope-control.md).
- **Remote-state ops** — push, merge, rebase, force-push, branch create/delete/switch, PR create/close/retarget, tag/release. Permission-gated by [`scope-control`](scope-control.md); the prod-trunk and deploy-tied subset is governed by [`non-destructive-by-default`](non-destructive-by-default.md).
- **Destructive ops** — see [`non-destructive-by-default`](non-destructive-by-default.md) for the full taxonomy (whimsical bulk deletions, content destruction, commits containing bulk deletions or infra changes).

In doubt → blocking. Ask.

## Commit policy — see [`commit-policy`](commit-policy.md)

Committing is governed by [`commit-policy`](commit-policy.md), which
applies regardless of `personal.autonomy`. Summary:

- NEVER commit unless user said so this turn, a commit command was
  invoked, a standing instruction is active, or the roadmap authorizes it.
- NEVER ask about committing.
- In autonomous mode, the **only** permitted commit-related question
  is the one-shot pre-scan ask at the start of roadmap execution.

Push, merge, rebase, branch creation, PR ops, tags remain
permission-gated per [`scope-control`](scope-control.md#git-operations--permission-gated).

## Failure modes

- Asking "Step 2 or Step 3?" when the roadmap orders them.
- "Should I run the CI checks?" — `verify-before-complete` decides; act.
- "Do we want to commit this?" — no, by default. Don't ask.
- Numbered-options block whose only difference is sequencing ("A then B" vs "B then A") with no real trade-off.
- Asking after user already issued a standing autonomy directive earlier (cache the opt-in for `auto`).

For Hard-Floor failure modes (treating autonomy as cover for a
floor-crossing action, reading a roadmap step as deploy authorization,
refusing task-aligned WIP deletions, committing bulk-deletion / infra
diffs without surfacing them) see
[`non-destructive-by-default`](non-destructive-by-default.md#failure-modes).

## Cloud Behavior

Settings reads degrade gracefully on cloud platforms (no
`.agent-settings.yml`). Treat as `personal.autonomy: on` — user had to
deliberately ship a custom skill bundle and is unlikely to want
trivial-question friction.

## See also

- [`non-destructive-by-default`](non-destructive-by-default.md) — universal safety floor; never overridden by autonomy
- [`scope-control`](scope-control.md) — git-ops permission gate (push/merge/branch/PR/tag stays explicit)
- [`ask-when-uncertain`](ask-when-uncertain.md) — vague-request triggers that always require asking
- [`direct-answers`](direct-answers.md) — Iron Laws on brevity and no-flattery (this rule extends to no-trivial-questions)
- [`/commit-in-chunks`](../commands/commit-in-chunks.md) — auto-split and commit without confirmation
- [`/commit`](../commands/commit.md) — split and commit with confirmation
