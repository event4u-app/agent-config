---
type: "always"
description: "Suppress trivial workflow questions and act on the obvious next step; never commit and never ask about committing except via /commit-in-chunks or explicit user instruction"
alwaysApply: true
source: package
---

# Autonomous Execution

The user's time is the scarce resource. Trivial workflow questions are
noise. This rule defines what counts as **trivial** (just act), what
counts as **blocking** (still ask), and the **commit default** (never
commit and never ask about commits — review-first by design).

## Setting — `personal.autonomy`

| Value | Behavior |
|---|---|
| `on` | Suppress trivial questions. Act on the obvious next step. Still ask on blocking / critical decisions. |
| `off` | Ask trivial questions too. Use this if you want the agent to check in on each workflow step. |
| `auto` (default) | Same as `off` by default. Flips to `on` for the rest of the conversation as soon as the user expresses the intent "stop asking, just work". See **Opt-in detection** below — match by **intent**, not exact string. |

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
Single-decision delegation ("für diesen Schritt entscheide du") →
handle that step autonomously, do **not** flip standing mode.

### Speech-act check — the phrase must be a meta-instruction to the agent

Before flipping, verify the phrase is **addressed to the agent as
guidance about how to work**, not a literal substring inside an
unrelated instruction. The same words can be content, data, quote,
copy, code, or subject matter — none of those flip.

Do **not** flip when the phrase is:

- **Content / copy** — "Baue den Slogan 'just do it' in die Landing-Page ein."
- **Quote / reference** — "Nike's tagline is 'just do it' — write a blog post about it."
- **Subject of a request** — "Schreib eine Doku über 'arbeite selbstständig'-Modi."
- **Code / data** — string literals, test fixtures, translations, JSON.
- **About a third party** — "Mein Kollege arbeitet selbstständig."
- **A question or hypothetical** — "Sollte ich `don't ask` als Default setzen?"

Heuristic: strip quotes, code blocks, and embedded content. Read what's
**left**. If the remainder is still a directive to the agent about its
own working style → flip. Otherwise → don't.

Opt-out (same intent, reversed) flips back to `off`: "frag mich
wieder" · "ask me first" · "stop being autonomous". Same speech-act
check applies.

Counter-examples — meta-questions, self-descriptions, or one-shot
delegations do **not** flip: "warum fragst du das nicht selbst?",
"ich arbeite gerade selbstständig", "kannst du das selbst entscheiden?".

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

When `personal.autonomy: off`: ask these. When `on` or
`auto`-after-opt-in: act.

## Blocking — STILL ASK regardless of `personal.autonomy`

The autonomy setting never overrides:

- **Vague-request triggers** in [`ask-when-uncertain`](ask-when-uncertain.md)
  — ambiguous requirements stay ambiguous; pick-one-and-pray is wrong.
- **Architectural / structural choices** that the codebase doesn't
  already settle (multi-stack picks, library introductions).
- **Security-sensitive paths** — see [`security-sensitive-stop`](security-sensitive-stop.md).
- **Scope expansion** beyond the stated task — see [`scope-control`](scope-control.md).
- **Remote-state operations** — push, merge, rebase, force-push,
  branch create/delete/switch, PR create/close/retarget, tag/release.
  These remain permission-gated by `scope-control`.
- **Destructive local ops** — `git reset --hard`, `rm -rf`, drop
  database, anything that loses uncommitted work.

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

- Asking "Step 2 oder Step 3?" when the roadmap orders them.
- "Soll ich die CI-Checks laufen lassen?" — `verify-before-complete`
  decides; act.
- "Wollen wir das committen?" — no, by default. Don't ask.
- Numbered-options block whose only choice differences are sequencing
  ("do A then B" vs "do B then A") with no real trade-off.
- Asking after the user already said "arbeite selbstständig" earlier
  in the conversation (cache the opt-in for `auto`).

## Cloud Behavior

Setting reads degrade gracefully on cloud platforms (no
`.agent-settings.yml` available). Treat as `personal.autonomy: on` —
the user had to deliberately ship a custom skill bundle to a cloud
agent and is unlikely to want trivial-question friction.

## See also

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
