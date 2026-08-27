---
complexity: lightweight
review_by: 2026-09-26
---

# Stub: restore the never-act-while-asking literal

> **Stub — not active work.** A **drain-run transfer**, created 2026-08-27 when
> [`road-to-kernel-invariant-restoration.md`](../archive/road-to-kernel-invariant-restoration.md)
> was drained. The parent closed against outcome state **`transferred`**: its
> agent-actionable work is complete, and the one remaining edit is one no agent
> may make. Outcome recorded on the parent at step 2.1 and AC-1 as
> **transferred, unresolved** — never as done.

## State

State model for this file: `pending-owner-action` → `scheduled` → `completed`,
or `rejected`. Nothing else. A state is written here by the owner, or by an
agent recording an owner ruling that exists in the tree — **never** inferred
from silence.

The state is carried in the blocker below rather than in a field of its own, so
that `agent-config stubs:due` and the owner-decision count in the dashboard
header both see it. A state nobody counts is a state nobody reads.

### blocker: clause-1-restore-is-human-only
- **Status:** open
- **Owner:** maintainer
- **State:** `pending-owner-action` (created 2026-08-27)
- **Severity:** **CI-blocking** — `check_rule_invariants` exits non-zero on
  `main`, so `task ci` stops at that gate and every gate after it goes unrun
  locally.
- **Blocks:** step 2.1 and AC-1 of the transferred parent, both recorded there
  as *transferred, unresolved*.
- **What to do:** the two-part edit under § The edit below — restore the literal
  at `src/rules/non-destructive-by-default.md:41` keeping the sentence after it,
  then `task sync`. Land it in its own PR with the ≥ 24 h soak, per
  `scope-control` § kernel-rule-edits.
- **Recommendation:** restore the literal. The AI council settled the choice 2/2
  on 2026-08-26; nothing is left to weigh.
- **If you do nothing:** the kernel's never-act-while-asking floor keeps the
  NARROWER guarantee — the current prose forbids acting in the same turn as the
  ask and permits acting in a later turn with no answer, which is the
  confirmation bypass the clause exists to close. `task ci` also stays red at
  that gate for every contributor, which trains readers to treat this gate's
  findings as background noise.
- **Resolved when:** `./scripts-run src/scripts/check_rule_invariants` exits 0
  on `main`.

## The edit

In `src/rules/non-destructive-by-default.md:41`, restore the protected literal
and **keep the sentence that follows it**, so the line reads:

```
**Never act while asking.** The ask and the action are strictly sequential: surface the confirmation, then WAIT for the answer. Never fire the action in the turn you ask — no do-then-ask race, no "I went ahead and…".
```

Then regenerate the projection (`task sync`), because
`check_rule_invariants` checks `src/` and `dist/agent-src/` both.

## Why an agent cannot do it

Three independent blocks, any one sufficient:

1. `block_kernel_rule_writes` denies any write whose basename is one of the nine
   kernel rule filenames under a `rules/` path segment.
   `non-destructive-by-default` is one of the nine
   (`src/scripts/_lib/kernel_rules.ts:24`). Established by **reading** the
   guard — a council seat was explicit that probing a safety guard by writing to
   it is not an acceptable way to learn its reach, and neither drain run did.
2. `scope-control` § kernel-rule-edits: own PR, ≥ 24 h between merges, and the
   soak guarantee is explicitly **not** lifted by an autonomous mandate.
3. It is a kernel-membership § 10 decision about a protected string.

Block 3 is **spent**: the council settled which remedy 2/2 on 2026-08-26. What
remains is execution by an authorised human, not a judgement.

## Why the wording matters, in one paragraph

The rule today carries a reworded form that drops *"for the answer"*. That is
not a stylistic loss. *"WAIT"* plus *"never fire the action in the turn you
ask"* does **not** forbid acting in a LATER turn with no answer; *"WAIT for the
answer"* does. The reworded form is a tighter sentence about a **narrower**
guarantee — exactly the shape a semantic-invariant gate exists to catch, and
exactly the shape a reviewer reading only the prose would approve.

## Probe — is the edit still needed, and is it still the same edit?

Read, in this order:

1. `./scripts-run src/scripts/check_rule_invariants` — exits 0 → the edit
   landed; set State to `completed` and delete this stub.
2. `grep -n 'Never act while asking' src/rules/non-destructive-by-default.md` —
   if the surrounding sentence has changed again, the literal above is stale and
   the § 10 question reopens rather than this stub simply executing.
3. `tests/golden/invariants.json` — if clause 1's entry is gone, someone chose
   the amend path instead; record that ruling here and close as `rejected`.

**Silence is not an answer.** An absent ruling is recorded as absent, never as a
decision — the fabrication the sibling
[`road-to-owner-authority-decisions.md`](road-to-owner-authority-decisions.md)
refuses in the same words.

## What this stub does NOT claim

It does not claim the invariant is satisfied, that `task ci` is green, or that
the parent roadmap achieved its goal. AC-1 of the parent is **not met** and says
so. This file exists so the open item sits in the queue a maintainer actually
reads — `agent-config stubs:due`, and the owner-decision count in the dashboard
header — rather than inside an archived roadmap nobody opens.

## Provenance

Disposition decided by AI council 2026-08-27, 2/2 convergent
(`anthropic/claude-sonnet-4-5`, `openai/codex-default`; two rounds, blind peer
review), on the maintainer's delegation of owner-reserved decisions for an
autonomous drain run. Verdicts and the one correction they forced:
[`kernel-invariant-disposition.md`](../../evidence/council/kernel-invariant-disposition.md).
