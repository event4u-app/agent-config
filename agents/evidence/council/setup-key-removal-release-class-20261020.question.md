<!-- evidence-type: analysis -->


# Round 2 — when does the projection-key removal land, now that a major is already cut?

You are reviewing one scheduling decision for the repository `event4u/agent-config`.
Answer with one option letter and a short rationale. Do not restate the question.

## The decision

`road-to-a-setup-that-decides-itself` Phase 4 removes the settings keys
`lean_projection.*`, `projection.rule_workspaces` and (last) `projection.mode`,
replacing them with a computed per-host decision function that is already built
and shipped behind a shadow mode (step 3.2) that changes no behaviour today.

The blocker `what-a-minor-may-remove` closed 2026-10-14 on option (c): a key may
leave in a minor only when no consumer can rely on it. Both
`lean_projection.mode: delivery` (written user-globally, thins `~/.claude/rules`)
and `projection.mode: tiered` (still acted on by `install.ts`) are relied-on, so
their removal fixes the release that carries it as a **semver-major**. That part
is settled and is not reopened here.

## What round 1 decided, and where it split

Put to this council 2026-10-18
(`agents/evidence/council/setup-key-removal-release-class-20261018.md`).
Both seats agreed Phase 4 ships as a major. The split was on timing:

- `anthropic` — hold Phase 4 until a major is being cut for another reason, and
  land both together, so the package does not spend a major on a settings
  cleanup alone.
- `openai` — land it when ready; waiting couples an independent change to an
  unrelated release and leaves the keys live meanwhile.

A split resolves nothing under the owner's delegation of 2026-10-18.

## The new fact that this round exists for

**ADR-290 (accepted 2026-10-18, this council, 2/2) raises the Node floor to 22
and records that raise as a semver-major.** It is carried by
`road-to-an-update-that-installs-itself-only-when-it-is-safe`. So a major IS
being cut for another reason; the condition the `anthropic` option named as its
precondition is satisfiable rather than hypothetical.

## Options

(a) **Land Phase 4 when it is ready, on the same major as the Node floor.**
    The removal commits land on `main` as they are finished; the release that
    carries them is the Node-floor major. Both round-1 positions are satisfied:
    nothing waits on an unrelated schedule, and no major is spent on the
    cleanup alone.

(b) **Land Phase 4 when ready, independently of the Node-floor major**, cutting
    a major for it if none is pending at that moment (round 1's `openai` option,
    unchanged).

(c) **Hold every Phase 4 commit off `main` until the Node-floor major is being
    cut**, then land them in that window (round 1's `anthropic` option, now with
    a named target).

(d) Something else — state it.

## What is in scope and what is not

In scope: which of (a)-(d), and whether an agent lane may execute Phase 4's
steps on that answer without a further owner turn.

Out of scope: whether the keys are removed at all (the owner directed that on
2026-10-12), the release class (settled: major), and who cuts the release (the
owner; nothing here authorises cutting one).

## What a usable answer contains

1. One option letter.
2. Whether an agent lane may execute Phase 4 on it, or whether the owner must
   still turn it.
3. The one condition that would reopen the choice.
