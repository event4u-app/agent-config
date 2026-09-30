# Findings: stop-that-holds-shadow-read
<!-- completion-review: v1 | reviewed: 2026-09-30 | scope: 8f18de4a2536915a029a0fbc8d32aafac151362f4055bf0e322fed6721d45c7b | diff: 1b2b8da782990cc7a6e6b0580e25b91c70859bdc | reviewer: fresh-subagent-independent-review-shadow-read | author: claude-opus-5-worktree-agent-adb9c217d1771e758 | prompt_hash: 4c9af26fa89ab9a1bb9cb11ea1ba0d5ffc1c8532a20596341d7dccb1d651ae05 -->
<!-- {"review-independence":{"review_independence":"single-member","context_relation":"fresh","acceptance_status":"provisional","assurance":"single-pass","reviewers":["fresh-subagent-independent-review-shadow-read"]}} -->
<!-- evidence-type: v1 | type: current-binding | declared: 2026-09-30 -->

<!-- context-manifest: v1
inputs:
  diff_sha: 1b2b8da782990cc7a6e6b0580e25b91c70859bdc
  scope_hash: 8f18de4a2536915a029a0fbc8d32aafac151362f4055bf0e322fed6721d45c7b
  roadmap: agents/roadmaps/road-to-a-stop-that-holds.md
  roadmap_hash: none
  ac_hash: none
excluded: [session-history, agents/runtime, implementation-context]
tools: [git-diff-branch-scoped, file-read-branch-paths]
dispatched: 2026-09-30T21:55:00Z
-->

**Verdict: `mergeable on the code, not on the record as it stood`.** The
reviewer's own words. It accepted the restructure, the shadow write's inability
to change a verdict, the bounded state and the extraction; it refused the
record on two clusters, both fixed here before this artifact was written.

**The prompt is committed** at
`agents/evidence/reviews/stop-that-holds-shadow-read.review-input/prompt.md`,
sha256 `4c9af26f…`, and `prompt_hash` above re-derives from it. Per
`evaluator-independence`: the scope was the whole branch diff, not a subset the
author chose; the prompt states no expected outcome in either direction; and it
ran once. It was amended once mid-review, and the amendment WIDENED the scope —
a seventh file appeared when CI's size ratchet forced an extraction — which is
recorded as F12 by the reviewer rather than left for a reader to notice.

**What the reviewer verified independently and is worth more than the findings
list.** It re-ran six sabotages of its own construction in a sandbox copy,
including three the branch never claimed: dropping only the Layer-1 write (4
fail), only the Layer-2 write (1 fail), and removing the row cap (1 fail). It
diffed the 8,622-character extracted region character-for-character. It deleted
the `collectRefusalStats` skip and confirmed no rollup number moved — which is
the measurement F3's disposition rests on, and the branch had asserted rather
than measured it.

| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | medium | agents/roadmaps/road-to-a-stop-that-holds.md:308 | Step 2.2 and the `q1-shadow-reading-window` blocker both instruct "Q1 = `would_refuse_again` rows / eligible initial refusals per detector" with no mention of `layer`. An implementer following either writes exactly the pooling the `layer` field exists to prevent: a `stop_hook_active` retry follows ANY stop concern's block, so pooled rows read another concern's retries against this gate's refusals. | fixed | `1b2b8da78` — both sites now say "grouped by `layer` first and then by detector", and both carry the two instrument bounds to publish beside the number. |
| 2 | medium | src/scripts/_lib/turn_end_refusals.ts:398 | `retries_observed` was a single pooled counter, so the denominator could not be split on the axis the numerator preserves. Worse than a symmetry problem: a CLEAN retry adds no row at all, so for the `stop_hook_active` layer there was no coherent denominator anywhere in the record. | fixed | `1b2b8da78` — `Record<ShadowLayer, number>`, derived from a new `SHADOW_LAYERS` list rather than hand-written, on the same argument `emptyCounts` makes one screen up (a literal satisfied the union on the day it was typed and read `undefined` the moment a member was added). Caught before one row accumulated, which is the only reason this was cheap. |
| 3 | medium | docs/contracts/turn-end-detector-demotion.md:229 | Condition 4's carve-out — the clause that stops instrument 1 resetting all five accumulation windows — justified itself with "it writes `would_refuse_again` onto the session record". Written before the instrument existed, and false: the rows are in a sibling file, which this same branch says in bold 120 lines below. The branch claimed it corrected the contract "on three points" and missed the fourth, which is the load-bearing one. | fixed | `1b2b8da78` — premise corrected, and the wider point the reviewer raised is answered rather than sidestepped: the shipped change also touched the RETENTION and ROLLUP of the state directory, which condition 4's own wording reaches. The conclusion survives on evidence the reviewer produced (no verdict moved; deleting the `collectRefusalStats` skip moves no number), and that evidence is now in the contract instead of an assertion. |
| 4 | low | agents/roadmaps/road-to-a-stop-that-holds.md:7 | `estate_growth_exempt` says the six obstacles lived "inside a **closed-step** HTML comment", then names six steps that are all `- [ ]` open — which is precisely why `scanOpenSteps` read `open: 7`. The string is gate-consumed and echoed verbatim by `check_estate_count`. | fixed | `1b2b8da78` — "inside an HTML comment under its own step". The substance the reviewer verified (the prose exists, in comments no gate reads) was never in doubt; the adjective was. |
| 5 | low | agents/roadmaps/road-to-a-stop-that-holds.md:582 | `kill-switch-owner-decision`'s `What to do` step 2 instructs filling the `destructive:` column — work the note 20 lines below, added in the same branch, records as already done since 2026-09-13. An agent working the numbered list redoes it. | fixed | `1b2b8da78` — step 2 now leads "Already done — do not redo it" and names what actually remains. |
| 6 | low | tests/scripts/turn_end_refusals.test.ts:334 | "a shadow record contributes nothing to the refusal rollup" reads as coverage of the `SHADOW_SUFFIX` skip in `collectRefusalStats`; the reviewer deleted that skip and the file stayed 21/21 green. | fixed | `1b2b8da78` — renamed to "moves no number in the refusal rollup", which is what it pins, with a docblock saying the skip is defence-in-depth against a future parser loosening and that no test can observe a guard whose removal changes nothing today. The guard stays; the claim narrows. |
| 7 | low | src/scripts/_lib/turn_end_refusals.ts:583 | A shadow record whose `last_at` will not parse was KEPT forever, and a test pinned that. Keep-on-unparseable is right for a refusal record — it may carry the wedge marker — and wrong here: a shadow record is pure measurement, so keeping it means the unbounded growth this pruner exists to stop survives for exactly the subset nobody can read. | fixed | `1b2b8da78` — pruned on the filesystem mtime, the weaker clock this function refuses for refusal records precisely because those are evidence. Three fixtures now pin the asymmetry in both directions; removing the branch fails exactly one. |
| 8 | low | src/scripts/_lib/turn_end_refusals.ts:399 | `retries_observed` says "retries on an allow path, refusing or NOT". A retry whose transcript is missing, oversized or textless records nothing — the assembly returns null — so it is "retries with a readable transcript". Biases Q1 upward: the numerator is unaffected and the denominator shrinks. | fixed | `1b2b8da78` — stated on the type as a bound on any reading, and carried into step 2.2 so it is published beside the number rather than discovered by whoever reads it. |
| 9 | low | src/scripts/hooks/turn_end_gate_hook.ts:1180 | On a host sending no `session_id` the key is a fixed `'unknown-session'` bucket, so the instrument pools measurements across unrelated sessions. The gate documents this collision for the wedge guard and argues it degrades safely toward under-refusing; the reviewer's point is that the argument does not transfer. | fixed | `1b2b8da78` — named on `ShadowRecord` with the reason it does not transfer: a merged measurement does not under-report, it reports one number for several sessions and a reader takes it for one. Opposite in kind to the guard's failure, which is why inheriting the note would have been wrong. |
| 10 | low | src/scripts/hooks/turn_end_gate_hook.ts (recordShadow) | Unlocked read-modify-write: the write is atomic, the sequence is not, so two concurrent stop events in one session can drop a `retries_observed` increment. | accepted-risk | The identical shape is `markRefusedTurn`'s, so this is the house pattern for this directory and changing only the new writer would leave two lock disciplines in one file. `update_json_under_lock` exists and is the right eventual answer for both; adopting it here alone adds lock acquisition to the stop slot, which carries a pre-registered latency budget this branch has already spent against. The bias is toward under-counting the denominator, i.e. Q1 upward — the same direction as F8, and now stated on the type alongside it. |
| 11 | low | src/scripts/hooks/turn_end_gate_hook.ts:35, :39, :227 | Three `main()` pointers went stale with the extraction, in a file whose same diff corrects two OTHER stale comments by name and date. | fixed | `1b2b8da78` — two now name `runDetectors()`, one names `assembleDetectorInputs()`. A sweep for the remaining `main()` mentions found three, all genuine (two describe `main()`, one is a past-tense account of a fixed defect). |
| 12 | low | — | The branch moved three times mid-review, adding a seventh file and changing a figure the reviewer was about to report as unreproducible. | accepted-risk | Unavoidable: the branch was under CI at the time and the size-budget red forced the extraction. The reviewer re-verified everything against the final head and scoped its verdict to `918c6131b` explicitly, which is the right handling. This artifact's scope is `1b2b8da78`, one commit later, and that commit is the fixes above. |

**The bundle-delta figure went stale a third time because of this round**, and
the roadmap records all three readings rather than the last one. It is the same
failure each time: a measured number taken before the last edit. Nothing in this
tree compares a figure in a roadmap against the thing it measures, so the
discipline that works is ordering, not care.

## Ordering — this artifact violates contract §2.5, and the violation is named

`check_completion_review` reports `fix-before-artifact` on every `fixed` row
here: the fix commit `1b2b8da78` predates this file's first-add commit. That is
accurate and it is not worked around. Recorded rather than dressed up, because
a review artifact that quietly failed the gate measuring review integrity would
be the exact shape this whole branch is about.

**What §2.5 protects, and whether it was actually lost.** The rule exists so an
artifact cannot be authored to match fixes already made — the file's add-commit
is the gate's proxy for "the review existed first". Here the REVIEW genuinely
predates the fixes: the subagent was dispatched at 21:55, reported at ~22:14
naming two structural clusters, and the fixes landed at ~22:40 in response. What
postdates is the FILE, not the finding. The proxy is right in general and wrong
about this instance, and saying so is not a claim that the rule should be
weaker — it is a statement of what a reader can and cannot conclude from the
red.

**Why it is not fixed here.** The only remedy is to reorder two local commits,
which is a history rewrite `git-history-discipline` forbids without the user
asking for it this turn. So the honest options were a silent red or a named one.

**This is the SECOND round in this lane to record the same thing**, and that is
the finding worth carrying upward rather than the individual red. The sibling
artifact `stop-that-holds.findings.md` closes with "this artifact was committed
AFTER the fixes it records, so an ancestry check will report against it".
A drain that dispatches a review on a pushed branch, receives findings, and
fixes them structurally cannot commit the artifact first — the artifact does not
exist until the review returns, and the review is dispatched against a branch
that must already be pushed. Either the workflow needs an empty placeholder
artifact committed at dispatch time, or §2.5 needs a clause for the
review-after-push case. **Owner-reserved: it is a contract change.**

The reviewed head (`918c6131b`) and the recorded head (`1b2b8da78`) are both
named above so the gap is readable either way.
