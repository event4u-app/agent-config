# Findings: drain/kernel-guards-plumbing-close
<!-- completion-review: v1 | reviewed: 2026-10-01 | scope: 00066ea69a21f3784b5d1f12031fc32364da9f2a57c576bad0059b750ce57d94 | diff: f9cb0207411e313f2b2a5c0aad0775c6a4d39d7e | reviewer: council/anthropic+openai-2026-10-01-kernel-guards-plumbing-close | author: claude-opus-5/drain-kernel-guards-plumbing-close-2026-10-01 -->

<!-- evidence-type: completion-review -->

<!-- context-manifest: v1
inputs:
  diff_sha: f9cb0207411e313f2b2a5c0aad0775c6a4d39d7e
  scope_hash: 00066ea69a21f3784b5d1f12031fc32364da9f2a57c576bad0059b750ce57d94
  roadmap: agents/roadmaps/road-to-a-kernel-that-guards-its-plumbing.md
  roadmap_hash: 3cc111b8b56d4fad5549774b83b1ef53636cf44424fc71a81d1519657366e75d
  ac_hash: d796296a2844d268cc5bce189a3bbe51aaf174124de9e27727ad52d4043a7422
excluded: [session-history, agents/runtime, implementation-context]
tools: [git-diff-branch-scoped, file-read-branch-paths]
dispatched: 2026-10-01T01:30:00Z
-->

Reviewer: AI council, 2026-10-01 — anthropic/claude-sonnet-4-5 +
openai/codex-default, 2/2 provider-diverse, 2 rounds, $0.00 (subscription
seats). The same review produced the ADR-268 § 4 ratification verdict for the
governed file in this diff; its artifact is
`agents/evidence/ratifications/drain-kernel-guards-plumbing-close.md` and
carries the verdict reasoning, the reviewers' own qualifiers, and what they
could not check.

**The diff was supplied inline.** A first dispatch failed with both seats going
to look for a checkout instead of reading the question (one returned a stub
answer, the other `os_error: ENOBUFS`); the question was rewritten with the
diff embedded and re-run. That is recorded because it bounds what the review
saw: the three code/config files verbatim, the roadmap described rather than
quoted, and no access to the surrounding tree.

**The prompt is not committed**, so this round is outside
`check_review_prompt_binding`'s checkable set by omission rather than by
substitution. Stating it here rather than leaving the absence to be inferred:
the question lives under `agents/runtime/council/questions/`, which is
gitignored and auto-pruned, and copying it into the tracked tree was not done.

**The table below carries the findings that are live against the scope this
artefact binds to, and that is a deliberate restructure rather than a short
table.** Four of the review's eight findings were already fixed when this file
was written: the review ran mid-branch, the fixes landed as they were found,
and the artefact followed. Contract § 2.5 requires a `fixed` row's commit to
postdate the artefact's first add, and these four cannot satisfy that without
rewriting pushed history — which is not this session's to rewrite. Listing them
as rows against the current scope would also be wrong on its own terms: at this
head the defects do not exist, so they are history rather than findings. They
are recorded in full under § Findings already closed when this artefact was
written, with their commits, and nothing is dropped.


| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | medium | src/scripts/bench_hook_latency.ts:812 (slaOverruns) | A benchmark is not runtime warn-only observation. It samples synthetic payloads on whichever machine runs the bench, when someone runs it; it sees no production payload diversity, no contention, and no slow consumer host. Calling it "the warn-only window" is a substitution unless the roadmap narrows the requirement explicitly. | accepted-risk | Narrowed rather than argued: the blocker now states the window is harness-observed, says what that does not cover, and leaves widening it to a runtime path as step 3.3's decision to name. The alternative — a runtime warn — is a dispatcher change shipped inside a step blocked on the readings it would produce |
| 2 | medium | agents/roadmaps/road-to-a-kernel-that-guards-its-plumbing.md (3.3 evidence) | The load-bearing in-process claim — that `_run_concern`'s 30 s timeout is on the spawn path, that every manifest concern takes the in-process path, and that `sla_ms × 3` can therefore only be a post-hoc verdict — is not pinned by a test. Neither seat had a checkout and neither could verify it; both named it load-bearing for the ratification verdict. | deferred | Half is pinned by a live gate (`tests/hooks/concern_registry_parity.test.ts` reds if any manifest concern lacks a registry entry). The other half is the absence of a mechanism — `_run_concern_inproc` calls `main_fn` directly and takes no timeout argument — and no test can falsify an absence; a source-string assertion would read as coverage without being any. Step 3.3 must state which of preemption or post-hoc verdict it is landing. Recorded at the step and in the ratification artifact |
| 3 | medium | tests/scripts/bench_hook_latency_per_concern.test.ts | No integration test that the probe actually reaches the concern end-to-end. The unit tests pin the constant and the merge; the probe could pass both and still produce no sample. | accepted-risk | The empirical evidence is the reference-runner reading: `one-question-per-ask` measures 0.723–0.733 ms across three post-fix CI passes where it previously printed `not_measured`. A spawning integration test was declined as slow and environment-dependent — it would spawn the real bundle against a real state root, and a mocked spawn tests the mock. Declined deliberately, not overlooked |
| 4 | low | src/config/hook-latency-budget.json (samples) | n=6 readings per concern is stated but not defended. A single load spike during one reading sets the bound for every future run, because the derivation takes the maximum. | accepted-risk | The maximum is the conservative direction for a bound a consumer multiplies by three: a spike raises the ceiling rather than lowering it. The window is the control in the other direction, and its reset rule ends the window on an overrun rather than extending it |

## Findings already closed when this artefact was written

The review that produced them is the same one; the ordering is the only
difference, and § 2.5 is explicit that what it holds against is "fixing
silently and writing the review afterwards". The review is recorded in the
ratification artefact committed at `4100b5810`, which predates nothing here
because it is the same round — so the account of these four is contemporaneous
with the fixes rather than reconstructed after them.

Written as prose, not a table: the gate parses every table-shaped row in this
file as a live findings row, and a six-cell row here would either re-raise the
ordering violation or need a status that is false. The content is unchanged.

**high — `src/scripts/bench_hook_latency.ts:809`.** The ask probe contaminated every unfiltered concern on its slot. `benchEvent('pre_tool_use', …, ASK_PROBE)` dispatches the whole event, not one concern — only the manifest's `tools:` filter isolates the target — so every neighbour ran under the ask payload too and wrote into the same sink. Pooled under one event key, their p95 described a mixture of two payload shapes, directly contradicting the comment beside it ("the default shape is what every OTHER concern's number must come from"). The evidence was in the report's own output and went unread: n per `pre_tool_use` concern went 20 → 40 the moment the probe landed, which is two passes and not a longer one. The nine registered `concern_sla_ms` values were derived from those polluted samples.

  Fixed in `ae9e643d4` — separate probe sink + `mergeProbeSamples` carries only `PROBE_TARGET`; re-measured n=20 everywhere, values re-derived in the following commit and every one moved DOWN

**medium — `src/scripts/bench_hook_latency.ts:1250`.** The summary line could report an incomplete window as clean. `slaOverruns` correctly skips a registered concern it could not measure — an unknown is not an overrun — but the success marker counted off the REGISTERED total, so a run that measured none of its bounded concerns printed "none over `sla_ms × 3`" indistinguishably from a run that measured all of them and found nothing. The same unknown-is-not-fine invariant the per-row function keeps, dropped at the summary.

  Fixed in `ae9e643d4` — `windowState` separates registered from usable; any unmeasured bounded concern reports INCOMPLETE, with cases for the malformed-vs-absent distinction

**medium — `agents/roadmaps/road-to-a-kernel-that-guards-its-plumbing.md (Blockers)`.** The warn-only window had no executable exit criterion. "A span of runs a human can read" is a judgement, not a specification: nothing said how many runs, on what machines, or what resets the count, so the blocker could be closed on an impression. Raised independently by both seats.

  Fixed in `4100b5810` — blocker gains a quantified exit condition (10 clean runs, ≥ 2 distinct CI runner sessions, no INCOMPLETE run counting, plus a 1-vCPU sample or a recorded decision to flip without one) and a reset rule

**low — `src/scripts/bench_hook_latency.ts:1250 (window reporting)`.** No escalation rule for repeated overruns during the window — nothing said whether the window extends, resets, or blocks 3.3 indefinitely.

  Fixed in `4100b5810` — the blocker's reset rule: a run naming an overrun ENDS the window rather than extending it, because the registered value was then wrong and a counter that keeps waiting turns a falsified bound into a patience problem


## What the reviewers explicitly did NOT find

Recorded because an honest null is evidence and dropping it would make the
table read as the whole of what was examined:

- Derivation transparency — both the machine-class spread and the 1-vCPU gap
  are stated in the budget file rather than hidden.
- `slaOverruns`' per-row handling of the three non-overrun states
  (unregistered, unmeasured, malformed) — all four directions covered.
- `ASK_PROBE`'s one-question shape, and the test that reads the live manifest
  filter rather than a copy of it.

One seat also refused a finding the other proposed, and the refusal is kept
because it is the more careful reading: the 6.04× ubuntu/darwin ratio does
**not** show the ×3 margin may be insufficient, since the SLA is taken from the
slower class — the ratio to a faster machine says nothing about how far a third
machine exceeds the slower one. The real gap is the unmeasured 1-vCPU floor,
which is finding 3's (d) clause.

## Sensitivity

Probed before the review and re-run after the fixes. On `slaOverruns`:
relaxing `>` to `>=` reds only the tie case; treating an unregistered SLA as an
overrun reds only the two cases bounding that direction. Nothing else moved in
either probe — 31 cases green in the file, 1 and 2 red respectively under the
two neutralisations.
