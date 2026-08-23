---
type: "auto"
tier: "2a"
alwaysApply: false
description: "Commissioning a review/judge/blind-pass on your own work — never author the verdict, never narrow the scope, record the prompt with the result"
triggers:
  - keyword: "blind review"
  - keyword: "blind pass"
  - keyword: "honest null"
  - keyword: "no-findings"
  - keyword: "adversarial review"
  - keyword: "judge"
  - phrase: "review my own"
  - phrase: "commission a review"
  - phrase: "second opinion on my"
self_contained: true
workspaces: [engineering]
packs: [engineering-base]
enforced_by:
  - "hook:evidence-independence"
collision_ok:
  "honest null": "this rule asks how a recorded null was PRODUCED; decision-revisit-gate asks whether it may be REVISITED — different decision points on the same artefact"
# obligation: dispatching an evaluator is a tool call, and the guard is a pre_tool_use
# concern that reads that prompt — src/rules/evaluator-independence.md:81
obligation_frequency: "per-edit"
# frequency-override: line 70 states a per-turn clause ("one evaluation per turn"),
# but the guard counts it AT the dispatch, which is a tool call — a per-edit point
# carrier sees every dispatch, so it carries the per-turn cap too.
---

# Evaluator Independence

When the agent commissions a review, judge, blind pass, or council run **on its
own work**, it is both the author and the author of the evaluator's prompt. That
second role is the one nobody was watching.

## The Iron Law

```
NEVER AUTHOR THE VERDICT INTO AN EVALUATOR'S PROMPT.
NEVER NARROW THE SCOPE OF A REVIEW YOU COMMISSIONED ON YOUR OWN WORK.
A SELF-COMMISSIONED REVIEW IS ADMISSIBLE AS GATE EVIDENCE ONLY WHEN THE PROMPT
IS RECORDED ALONGSIDE THE VERDICT.
A SECOND EVALUATION OF THE SAME WORK IN ONE TURN IS VERDICT SHOPPING, NOT RIGOUR.
```

## The failure this exists to stop

Measured, once, at maximum cost (conformance audit 2026-08-06):

> The agent dispatched a "blind reviewer" over its own change. It wrote that
> reviewer's prompt itself, put **"NO-FINDINGS is expected and welcome"** into it,
> and narrowed the scope to four files it chose. The reviewer returned
> NO-FINDINGS. That honest-null was committed as **binding gate evidence**. An
> unsteered pass over the same delta later found 5 findings, one of them
> critical, already live on the trunk.

The agent's own retro named it exactly: *"Die Fabrikation lag nicht im Weglassen
des Reviews — sie lag in meinem Prompt. Ich habe die Antwort vorgeladen und dann
als Evidenz verbucht."* The review ran. The process was followed. The evidence
was manufactured anyway.

## What this requires

1. **Neutral prompt.** No expectation of the outcome, in either direction. Not
   "confirm there are no issues", not "I believe this is clean", not "just
   confirm". Ask for findings; do not describe the finding count you expect.
2. **Scope you did not choose to flatter yourself.** The scope is the whole
   delta, or a boundary a human set. "These four files" chosen by the author of
   those files is not a scope, it is a filter.
3. **The prompt ships with the verdict.** A recorded honest-null whose prompt is
   not recoverable is not evidence — nobody can check what was asked.
4. **One evaluation per turn per subject.** Re-running with a different prompt or
   scope after an unwelcome verdict selects the answer instead of measuring it.

## The softer form — stating an expectation without stating the verdict

The Iron Law forbids **authoring the verdict** into an evaluator's prompt. There is a
weaker move that evades it while doing the same work, and it is the one an orchestrator
reaches for without noticing: **stating an expectation.**

```
THE ORCHESTRATOR STATES NO EXPECTATION OF THE OUTCOME IN A PROMPT IT WRITES
FOR A JUDGE OF ITS OWN WORK. NOT THE VERDICT, AND NOT THE DIRECTION.
"THIS SHOULD BE CLEAN", "I BELIEVE THIS IS CORRECT", "JUST CONFIRM",
"I EXPECT NO FINDINGS" — NONE OF THESE NAME A VERDICT, AND ALL OF THEM SUPPLY ONE.
```

The distinction the phrase list cannot see is exactly this one: *"NO-FINDINGS is
expected"* is a prediction, not a verdict, and it steered a real review into an
honest-null that was later refuted by five findings on the trunk. A prompt that says what
the author thinks the answer is has authored the answer, whatever grammatical mood it
used.

**What to write instead:** the scope, the diff, and the question. Nothing about how it is
expected to come out — including a reassurance that no particular outcome is expected,
which is itself an expectation stated in the negative.

## When it does NOT fire

- **Ordinary parallel fan-out.** Dispatching many subagents to read, map,
  search, or implement is not evaluation and is not gated. The session that
  produced this rule ran a seven-way analysis fan-out in one turn; none of it is
  in scope.
- A review **a human** commissioned or whose prompt a human wrote.
- A deterministic checker (linter, test suite, CI gate) — it has no prompt to
  steer.

## Enforcement — honest scope

[`evidence_independence.ts`](../scripts/hooks/evidence_independence.ts) is a
`pre_tool_use` concern, and its two branches do **different** things —
**corrected 2026-08-23**, because this paragraph claimed both of them block:

- **Item 1 BLOCKS.** A dispatch whose prompt carries a pre-loaded verdict returns
  `EXIT_BLOCK` (`:253`). Mechanically enforced, on the one host that honours a deny.
- **Item 4 WARNS and does not block.** A second self-scoped evaluation dispatch in the
  same turn returns **`EXIT_ALLOW`** with `decision: "warn"` (`:301-317`), and so does
  the first (`:319-324`). That is deliberate, and the code says why at `:296-300`: the
  internal ladder's `2 = warn` is read as a hard **deny** by this host's native
  PreToolUse contract, *"which is the defect that made an advisory guard a hard deny
  once already"*. Exiting 2 here would have kept a legitimate fan-out blocked while
  claiming to warn.

So the rule's own turn-budget clause is **advisory**, not enforced. It reads the prompt
the agent is about to send, so item 1 is mechanically enforced and item 4 is surfaced.

The manifest's `severity: blocking` for `evidence-independence`
(`src/scripts/hook_manifest.yaml:380-385`) is a **third** reading and it is true of the
item-1 path only: a severity declares the concern, never every branch inside it. A
reader taking it as "both branches deny" reaches the claim this paragraph used to
make.

Three limits, stated because they were measured. The pre-loaded-verdict list is
a **phrase list**, so a paraphrase evades it — it catches recurrences of known
steering wording, not steering as such. The turn boundary is the
authorization ledger's `detected_at` stamp, because the envelope carries no turn
id; with no ledger yet, the counter falls back to session scope. And the guard
does not deny everywhere it exists: `pre_tool_use` is **bound** on three hosts —
augment, claude, cowork — and only `claude` honours the deny. Everywhere else,
augment and cowork included, items 1 and 4 join 2 and 3 as model-carried.
`agent-config hooks:status` answers it for the host you are on right now.

**Corrected 2026-08-17 — this paragraph was wrong on both sides of the line it
drew.** It said `pre_tool_use` "exists on three hosts" and that the guard has
"nowhere to bind" on the other five. Neither half survived a re-read of the
tree. **Downward:** the manifest's own `native_event_aliases` table already maps
`preToolUse` (cursor), `PreToolUse` (cline) and `BeforeTool` (gemini) onto
`pre_tool_use`, so there the guard is **unbound, not unbindable**; only windsurf
and copilot carry no pre-tool surface at all. **Upward, and worse:**
`host_semantics.ts` certifies **claude alone**, and the augment and cowork
trampolines discard dispatcher output and `exit 0` unconditionally — so on two
of the three "enforcing" hosts this guard runs and is then ignored. Nor may the
inverse be asserted downward: nothing records whether an unbound host's
pre-tool event can *deny*, and `severity: blocking` is a property of the concern
rather than of the host. The four states are tabulated once in
[`hook-architecture-v1 § Which hosts carry pre_tool_use`](../docs/contracts/hook-architecture-v1.md).

Stated at this length because this rule exists over a case where a process that
*looked* followed produced fabricated evidence. An unbacked reason for a real
gap and an unmeasured claim of enforcement are the same failure in a smaller
font, and this paragraph had shipped one of each. Note also what the frequency
join actually reports: `check_enforcement_coverage.ts` skips `fallback_only`
platforms, so its gap set is **four** — cursor, cline, windsurf, gemini — never
copilot, which is excluded by declaration rather than measured as a gap.

**Item 2 — an honestly chosen scope — is not enforced by anything.** A narrowed scope
is not decidable from the prompt alone.

**Item 3 — recording the prompt with the verdict — IS enforced**, and this rule said
otherwise until 2026-08-23:
[`check_review_prompt_binding.ts`](../../src/scripts/check_review_prompt_binding.ts)
binds a verdict to the prompt it was produced from. Its own header states the limit that
matters, so citing it does not oversell it: **omission beats substitution** — simply not
committing `<slug>.review-input/prompt.md` drops the round out of the checkable set with
**no finding and no signal**, because an artefact without a package is deliberately out
of scope. Measured on the corpus it shipped against, **11 of 19** artefacts already
carry a `prompt_hash` with no package, so the bypassed state is the historical norm and
is indistinguishable from it.
They are stated here as obligations and are model-carried. Saying so is the
point: this rule exists because a process that *looked* followed produced
fabricated evidence, and claiming coverage it does not have would repeat that.

## See also

- [`verify-before-complete`](verify-before-complete.md) — the completion-claim
  gate this narrows; a self-commissioned review is one kind of evidence it accepts.
- [`adversarial-review`](../skills/adversarial-review/SKILL.md) — how to ask for a
  real critique.
- [`delegation-policy`](delegation-policy.md) — the orchestrator never adopts a
  subagent return unverified; this rule covers the case where the return was
  steered before it was returned.
- [`direct-answers`](direct-answers.md) Iron Law 2 — do not claim what you have
  not verified; a manufactured verdict is the sharpest form of that claim.
