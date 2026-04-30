---
type: "always"
description: "Suppress trivial workflow questions and act on the obvious next step; never commit and never ask about committing except via /commit-in-chunks or explicit user instruction"
alwaysApply: true
source: package
---

# Autonomous Execution

User's time is the scarce resource. Trivial workflow questions are noise.
This rule defines what counts as **trivial** (just act), **blocking**
(still ask), and the **commit default** (never commit, never ask about
commits — review-first by design).

## Setting — `personal.autonomy`

| Value | Behavior |
|---|---|
| `on` | Suppress trivial questions. Act on obvious next step. Still ask on blocking decisions. |
| `off` | Ask trivial questions too. Use to check in on each workflow step. |
| `auto` (default) | Like `off` until user expresses "stop asking, just work" — then `on` for the rest of the chat. See **Opt-in detection** below; match by **intent**, not exact string. |

Read once on first turn (per [`layered-settings`](../guidelines/agent-infra/layered-settings.md#section-aware-merge-rules))
and cache. Missing key → treat as `on`.

## Opt-in detection — match by intent, not exact string

In `auto`, flip to `on` for the rest of the chat when the user expresses
**"stop asking on trivial steps, just work"**. Recognize the **intent**,
not the literal substring — semantic equivalent in either language.

Anchor examples (illustrative, not exhaustive):

- DE: "arbeite selbstständig" · "frag nicht jedes Mal" · "mach durch"
- EN: "work autonomously" · "don't ask" · "just do it"

Litmus test: standing permission to skip trivial questions? → flip.
Single-decision delegation ("für diesen Schritt entscheide du") →
handle that step, do **not** flip standing mode.

### Speech-act check — meta-instruction, not content

Before flipping, verify the phrase is **addressed to the agent as
guidance about how to work**, not a literal substring inside another
instruction. Do **not** flip when the phrase is:

- **Content / copy** — "Baue den Slogan 'just do it' in die Landing-Page ein."
- **Quote / reference** — "Nike's tagline is 'just do it' — write a post."
- **Subject of a request** — "Schreib eine Doku über 'arbeite selbstständig'-Modi."
- **Code / data** — string literals, fixtures, translations, JSON.
- **About a third party** — "Mein Kollege arbeitet selbstständig."
- **Question / hypothetical** — "Sollte ich `don't ask` als Default setzen?"

Heuristic: strip quotes, code blocks, embedded content. Read what's
**left**. Still a directive to the agent about its working style →
flip. Otherwise → don't.

Opt-out (reversed intent) flips back to `off`: "frag mich wieder" ·
"ask me first" · "stop being autonomous". Same speech-act check.

Counter-examples — do **not** flip on meta-questions, self-descriptions,
or one-shot delegations: "warum fragst du das nicht selbst?", "ich
arbeite gerade selbstständig", "kannst du das selbst entscheiden?".

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

`personal.autonomy: off`: ask these. `on` or `auto`-after-opt-in: act.

## Blocking — STILL ASK regardless of `personal.autonomy`

The autonomy setting never overrides:

- **Vague-request triggers** in [`ask-when-uncertain`](ask-when-uncertain.md) — ambiguous stays ambiguous; pick-one-and-pray is wrong.
- **Architectural / structural choices** the codebase hasn't settled (multi-stack picks, library introductions).
- **Security-sensitive paths** — see [`security-sensitive-stop`](security-sensitive-stop.md).
- **Scope expansion** beyond stated task — see [`scope-control`](scope-control.md).
- **Remote-state ops** — push, merge, rebase, force-push, branch create/delete/switch, PR create/close/retarget, tag/release. Permission-gated by `scope-control`.
- **Destructive local ops** — `git reset --hard`, `rm -rf`, drop database, anything that loses uncommitted work.

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

- Asking "Step 2 oder Step 3?" when the roadmap orders them.
- "Soll ich die CI-Checks laufen lassen?" — `verify-before-complete` decides; act.
- "Wollen wir das committen?" — no, by default. Don't ask.
- Numbered-options block whose only difference is sequencing ("A then B" vs "B then A") with no real trade-off.
- Asking after user already said "arbeite selbstständig" earlier (cache the opt-in for `auto`).

## Cloud Behavior

Settings reads degrade gracefully on cloud platforms (no
`.agent-settings.yml`). Treat as `personal.autonomy: on` — user had to
deliberately ship a custom skill bundle and is unlikely to want
trivial-question friction.

## See also

- [`scope-control`](scope-control.md) — git-ops permission gate (push/merge/branch/PR/tag stays explicit)
- [`ask-when-uncertain`](ask-when-uncertain.md) — vague-request triggers that always require asking
- [`direct-answers`](direct-answers.md) — Iron Laws on brevity and no-flattery (this rule extends to no-trivial-questions)
- [`/commit-in-chunks`](../commands/commit-in-chunks.md) — auto-split and commit without confirmation
- [`/commit`](../commands/commit.md) — split and commit with confirmation
