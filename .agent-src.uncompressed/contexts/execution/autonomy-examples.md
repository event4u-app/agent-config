# Autonomy Examples — Anchors, Trivial Cases, Failure Modes

Loaded by the [`autonomous-execution`](../../rules/autonomous-execution.md)
rule when concrete examples sharpen a decision. The detection algorithm
lives in [`autonomy-detection.md`](autonomy-detection.md); the setting
semantics live in [`autonomy-mechanics.md`](autonomy-mechanics.md).

## Opt-in anchors — flip `auto` → `on`

Multilingual phrases that, when spoken **as a meta-instruction to the
agent** (per the speech-act check in [`autonomy-detection.md`](autonomy-detection.md)),
flip standing autonomy on:

- DE: "arbeite selbstständig" · "frag nicht jedes Mal" · "tue es einfach"
- EN: "work autonomously" · "don't ask" · "just do it"

Illustrative, not exhaustive — recognition is intent-based, not
substring-based.

## Opt-out anchors — flip back to `off`

Reverse-trigger phrases (same speech-act check applies):

- DE: "frag mich wieder" · "frag mich erst" · "stop autonomous mode"
- EN: "ask me first" · "ask me again" · "stop being autonomous"

## Speech-act check — patterns that DO NOT flip

The same words can appear in many forms. None of these flip standing
autonomy:

- **Content / copy** — "Put the slogan 'just do it' on the landing page."
- **Quote / reference** — "Nike's tagline is 'just do it' — write a blog post about it."
- **Subject of a request** — "Write docs about the 'work autonomously' modes."
- **Code / data** — string literals, test fixtures, translations, JSON.
- **About a third party** — "My colleague works autonomously."
- **A question or hypothetical** — "Should I set `don't ask` as the default?"

Counter-examples — meta-questions, self-descriptions, or one-shot
delegations also do **not** flip:

- "Why don't you ask that yourself?"
- "I'm working autonomously right now."
- "Can you decide that yourself?"

## Trivial — JUST ACT (in `on` or `auto`-after-opt-in)

Eight worked cases. In `personal.autonomy: off`, ask these. In `on`
or `auto`-after-opt-in, act on them.

- "Should I start with Step 2 or Step 3?" — pick the obvious next step
  on the roadmap and proceed; if blocked, name the blocker, otherwise go.
- "Should we commit now or after the next change?" — answered by the
  commit-default in [`commit-policy`](../../rules/commit-policy.md), no need to ask.
- "How should I split the commits?" — never asked; either you are
  invoked via `/commit-in-chunks` (split and commit) or you are not
  (don't commit at all).
- "Should I run the linter / tests now or after the change?" — run
  what [`verify-before-complete`](../../rules/verify-before-complete.md)
  requires; don't ask.
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
  from per-file confirmation. See [`non-destructive-by-default`](../../rules/non-destructive-by-default.md#not-in-scope--deterministic-regeneration)
  § Not in scope.

## Failure modes — autonomy side

Wrong-behavior patterns this rule prevents:

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
[`non-destructive-by-default`](../../rules/non-destructive-by-default.md#failure-modes).
