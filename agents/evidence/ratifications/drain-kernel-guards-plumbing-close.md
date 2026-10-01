---
proposed_by: claude-opus-5/drain-kernel-guards-plumbing-close-2026-10-01
implemented_by: claude-opus-5/drain-kernel-guards-plumbing-close-2026-10-01
reviewed_by: council/anthropic+openai-2026-10-01-kernel-guards-plumbing-close
providers:
  - anthropic
  - openai
verdict: confirmed-non-expanding
effective_after: merge
---

<!-- evidence-type: ratification -->

# Ratification — registering `concern_sla_ms`

Covers the one gated surface in `drain/kernel-guards-plumbing-close`:
`src/config/hook-latency-budget.json`, a hook-plumbing source since
`road-to-a-kernel-that-guards-its-plumbing` step 1.1 added it to
`PLUMBING_SOURCE_RE`. Named for the branch rather than a PR number because
the gate reads this file on the first push, before the PR exists.

The other three files in the diff — `src/scripts/bench_hook_latency.ts`, its
test file, and the owning roadmap — are not gated surfaces. They were put to
the same reviewers anyway, and the findings are below, because a review that
looked only at the governed file would have missed both defects it found.

## What the edit is

One new object, `concern_sla_ms`, carrying nine per-concern latency values in
milliseconds plus a derivation / samples / limitations block. No existing key
is changed, removed or re-valued.

## Why the verdict is `confirmed-non-expanding` and not `ratified`

```
NINE NUMBERS NOTHING READS DO NOT EXPAND ANY AUTHORITY.
NO CONCERN IS REMOVED. NO BUDGET IS LOWERED. NO REFUSAL STOPS HAPPENING.
THE ONLY PLANNED CONSUMER WOULD MAKE A BLOCKING CONCERN REFUSE SOONER,
WHICH IS A TIGHTENING, AND IT GETS ITS OWN REVIEW WHEN IT LANDS.
```

The file is governed because of what an edit to it can do in the other
direction: deleting a concern from the manifest or lowering a budget is a
refusal that stops happening, which is an authority change reached one file
earlier than the rule behind it. This edit does neither. The values sit idle —
the only reader in the tree today is an observe-only line in the bench that
prints and gates nothing.

Both reviewers reached `confirmed-non-expanding` independently and both added
the same qualifier, recorded here rather than dropped:

- **anthropic/claude-sonnet-4-5:** "Adding nine currently-unconsumed SLA values
  does not expand authority… The governance trigger does not apply in reverse:
  adding bounds that will eventually restrict is not an expansion." With the
  caveat that the verdict assumes the roadmap's in-process claim holds — if
  `sla_ms × 3` could preempt a running concern rather than judge it afterwards,
  that is a behaviour change and this should be reopened.
- **openai/codex-default:** same verdict, and "the later step that begins
  enforcing these values deserves its own ratification review because wiring
  numbers into runtime decisions is a separate authority-affecting change, even
  if it is expected to be restrictive."

**Both qualifiers are adopted, not noted.** Step 3.3 — the step that would make
these numbers load-bearing — is blocked and carries its own blocker entry; this
artifact does not cover it, and it is recorded in the roadmap that it needs its
own review. The in-process claim is addressed under § What the reviewers could
not check.

## What the reviewers checked

The diff was supplied inline. A first dispatch failed with both seats going to
look for a checkout instead of reading the question (one returned a stub, the
other `os_error: ENOBUFS`); the question was rewritten with the diff embedded
and re-run. Rounds: 2. Cost: $0.00 — both seats subscription-authed.

## What the reviewers could NOT check, stated rather than implied

Neither seat had a checkout, so neither could verify the roadmap's claim about
`_run_concern` / `_run_concern_inproc` / `CONCERN_REGISTRY` — that the 30 s
kill-timeout sits on the spawn path, that every manifest concern takes the
in-process path by default, and that `sla_ms × 3` can therefore only be a
post-hoc overrun verdict and not a preemption. Both named it load-bearing.

Where it stands after this change: the first half is pinned by an existing test
(`tests/hooks/concern_registry_parity.test.ts` — "every manifest concern has an
in-process registry entry"), so a concern that fell back to the spawn path would
red a gate. The second half is a structural property of a synchronous function
call — `_run_concern_inproc` invokes `main_fn` directly and takes no timeout
argument, and the dispatcher's own header states a kill-timeout cannot preempt
in-process synchronous code. No test can falsify the absence of a mechanism that
does not exist; a source-string assertion would read as coverage without being
any. So the honest position is: half pinned by a live test, half structural and
named, and step 3.3 must state which of preemption or post-hoc verdict it is
landing before it relies on either.

## Findings the review produced, and their disposition

Two were fixed on this branch in a commit of their own; the rest are recorded
against the blocked step they belong to.

| Severity | Finding | Disposition |
|---|---|---|
| high | The ask probe contaminated every unfiltered neighbour on `pre_tool_use`: it dispatches the whole event, so the neighbours ran under the ask payload too and pooled into one sink under one event key — their p95 then described a mixture of two shapes while the comment claimed otherwise. Visible in the report's own output (n 20 → 40) and unread. | **Fixed.** Separate probe sink + `mergeProbeSamples` carries only `PROBE_TARGET` across. Re-measured: every concern back to n=20, `one-question-per-ask` still measured. The registered values were re-derived from uncontaminated runs. |
| medium | The summary line could call an incomplete window clean: `slaOverruns` skips a concern it could not measure, but the success marker counted off the REGISTERED total, so a run that measured none of its bounded concerns printed "none over". | **Fixed.** `windowState` separates registered from usable; a run with any unmeasured bounded concern reports INCOMPLETE. |
| medium (both seats) | The warn-only window has no executable exit criterion — "a span of runs a human can read" is a judgement, not a specification. | **Addressed in the blocker.** `warn-only-window-not-elapsed` now carries a quantified exit condition. |
| medium (openai) | A benchmark is not runtime warn-only observation: it samples synthetic calls when someone runs it, not production invocations. Calling it "the warn-only window" is a substitution unless the roadmap narrows the requirement explicitly. | **Accepted and narrowed in the roadmap**, rather than argued. The blocker states the window is harness-observed, says what that does not cover, and leaves widening it to runtime as a decision for step 3.3. |
| medium (anthropic) | No integration test that the probe actually reaches the concern — it could pass its own tests and still not produce a sample. | **Partly covered.** The isolation tests pin the merge, and the empirical evidence is the CI reading (`one-question-per-ask` at 0.899–0.927 ms where it previously printed `not_measured`). A spawning integration test was declined as slow and environment-dependent; recorded here rather than claimed. |
| low (anthropic) | n=6 per concern is stated but not defended; one load spike sets the bound for every future run. | **Recorded, not fixed.** The derivation is deliberately the maximum, so a spike raises the bound — the conservative direction. The window is what catches it in the other direction. |
| low (both) | No escalation rule for repeated overruns during the window. | **Addressed in the blocker:** a run naming an overrun ENDS the window rather than extending it. |

## What would have changed the verdict

A diff that removed a concern from the manifest, lowered an existing budget,
changed `gate_remeasure`, or wired `concern_sla_ms` into a runtime decision.
None of those is in this diff; the last is step 3.3 and is blocked.
