---
proposed_by: claude-opus-5-5
implemented_by: claude-opus-5-5
reviewed_by: ai-council
subject: a466a15741a0bfe2d1a55eb6f2b5cb5dd0ce5b6403411809b69c30be7ed98d56
providers: [anthropic, openai]
verdict: refused
seats:
  anthropic: refused
  openai: refused
effective_after: merge
---

<!-- evidence-type: ratification -->

# Modification review

Move the agent-switch link out of the quota_notice lazy chunk into its own switch_link chunk (road-to-a-link-with-agent-switch 8.4): quota_notice ceiling lowered from 49,400 to 29,900 B (measured 27,162 B), new switch_link ceiling 32,200 B, and a new gate feature, chunk_groups, capping both together at 62,100 B (measured 56,491 B); the digest check moves verbatim into bundle_digest.ts so a chunk does not carry the YAML reader. Same change, not gated: the record lock becomes per-holder tickets that also hold the previous version's lock file, dated ahead. Council rounds 1-5 refused (both seats, dealbreaker); each round's defects were fixed. Remaining after round 5: the previous version's own check-then-unlink cannot be made conditional from this change, so exclusion across versions has a residual window while a hook of that version still runs across an install or rollback; one seat accepted the enforced combined allowance, one did not.

Verdict `refused`, derived from each seat's stance line; the prompt every seat answered is `agents/evidence/council/agent-switch-link-chunk-ratification-r5-20261110.question.md`, committed at `913daecc832e9f3ffac56dfebf38637a465e8733` and naming this record's subject.

What this record does not establish: that a council produced the session it was rendered from. That file is the caller’s and council output is not kept, so on that point this record is exactly as trustworthy as a typed one. What it does establish is that the header says no more than the replies below, and that the prompt showed this content.

## Each seat, verbatim

### anthropic — `refused`

```text
## Review of Prior Critiques

### 1. Which prior points I agree with

**Reviewer A:**
- ✓ The residual race during version mixing is real and lacks specific rollback triggers ("Rollback criterion 8 watches for it" is vague)
- ✓ The 62,100 B group ceiling needs justification - "a council seat named 63,500 B acceptable" is hearsay without evidence
- ✓ Lock and chunk split should be separated per round 4 feedback
- ✓ The 15-minute lock hold (vs 2 seconds) is a 450× increase in potential contention window

**Reviewer B:**
- ✓ The lock change still permits what it's supposed to prevent (older-over-newer snapshots)
- ✓ `ticketBreakable` deliberately expires genuinely live holders after 15 minutes
- ✓ The older version's check-then-unlink cannot be controlled by this change
- ✓ Split should be ratified separately from lock protocol change
- ✓ Missing deterministic tests that pause a contender after its stale check

### 2. Disagreements

None. Both reviewers identified real defects I independently confirm.

### 3. New points not raised in round 1

**Process violation:**
Round 4 had both seats explicitly request "ship lock separately." The response was "commits stay separable" but this round 5 review bundles them for ratification. This contradicts direct feedback and prevents isolating lock risks from chunk budget decisions.

**Dual correctness gaps in lock:**
The 15-minute timeout (`LOCK_ABANDONED_MS`) is a *separate* correctness issue from version mixing:
- Version mixing: old hooks can break new holders mid-write (window: install/rollback only)
- 15-minute expiry: new hooks deliberately expire *live* holders (window: any slow Stop, any time)

A genuinely slow Stop (network hiccup, large snapshot, resource contention) running >15 minutes loses exclusion and publishes an older checkpoint after its successor. No rollback criterion watches for this design choice specifically - criterion 8's "older over newer" doesn't distinguish version-mixing from timeout-caused races.

**The chunk split is sound:**
Separated from lock concerns:
- Default reduction: 47,877 B → 27,162 B (43%) is measurably beneficial
- Opted-in parsing: 56,491 B with digest verification and API versioning
- Group enforcement prevents independent part growth
- Digest check split from YAML reader is architecturally clean

The 62,100 B group figure needs the council decision as evidence, but the mechanism is reviewable.

**Missing measurement evidence:**
The diff omits:
- Complete gate implementation (only incremental changes shown)
- Full caller changes to verify opt-in boundaries
- Independent verification of load-failure fallback paths

Round 4's "provide complete diffs" feedback partially addressed.

---

**STANCE: refused | CONFIDENCE: high | DEALBREAKER: yes**

**Strongest argument for refusal:**
Bundling the lock change with the chunk split directly contradicts round 4's unanimous "ship lock separately" feedback from both seats. Beyond that process violation, the lock has *two* distinct correctness gaps: (1) the acknowledged version-mixing race lacks a precise rollback trigger ("criterion 8 watches for it" via symptoms, not thresholds), and (2) the 15-minute deliberate expiry of live holders (`LOCK_ABANDONED_MS`) can cause older-over-newer without any version mixing, yet no criterion distinguishes this case. Hook plumbing on the gate's list requires stronger than "we'll watch for symptoms."

**Strongest counter-argument:**
The existing lock already breaks live holders after 2 seconds. This change improves ordinary operation (unique-name unlinks, PID liveness checks, 15min vs 2s hold strength) and explicitly bounds its residual weakness to a narrow window (version mixing during install/rollback). The chunk split delivers a measurable 43% reduction for default users. Requiring perfect safety during version transitions may preserve worse behavior indefinitely, and symptom-based rollback (checkpoint ordering) directly watches the harmful outcome.

**Concrete next steps:**

1. **Ratify the chunk split separately** with evidence of the 63,500 B council decision. The split is technically sound: digest verification, API versioning, group enforcement, measurable default benefit.

2. **For the lock protocol:**
   - Add deterministic tests: pause a contender after its stale check but before its unlink, inject a live holder's lock, resume the unlink, assert no concurrent writes
   - Test both version directions (old breaks new, new breaks old)
   - Specify precise rollback triggers: e.g., "any observed older-over-newer snapshot during install/rollback window triggers immediate rollback"
   - Address the 15-minute live-holder expiry: either remove it (rely on PID checks only), or fence publication (reject writes from expired holders), or prove via resource profiling that legitimate Stops never exceed 15 minutes

3. **If bundling is required:** provide written justification for overriding the round 4 "ship separately" feedback and show how the combined risk is bounded

4. **Provide complete context:** full gate implementation, all caller changes, council decision on 63,500 B group ceiling
```

### openai — `refused`

```text
**Assessment: mixed; I refuse the combined change as presented.** The lazy split offers a credible default-path improvement, and explicitly budgeting the opted-in total is sound. The lock change still permits concurrent publication, and the supplied excerpts do not independently establish the complete gate and caller behavior.

**Strongest argument:** `takeLegacyLock` still checks one file and then removes whichever file occupies that pathname. Tickets serialize newer contenders, but older processes ignore tickets. A supported mixed-version execution can therefore lose exclusion and publish an older checkpoint after a newer one.

**Strongest counter-argument:** the existing two-second age rule is substantially worse. The proposed protocol improves ordinary operation, and an already-running older executable cannot be repaired retroactively. Accepting a documented transitional risk could be reasonable if activation drains old processes and evidence establishes the remaining bounds.

1. **Behavior changes and implications**

   Default prompts load substantially fewer chunk bytes; opted-in prompts load 18% more. These are byte measurements, not demonstrated latency improvements.

   Missing or incompatible link chunks suppress both the question and checkpoint work. Retaining an owed checkpoint supports retries, but does not establish eventual completion: persistent load failure can leave it owed indefinitely.

   The lock changes from age-based exclusion to tickets plus a legacy compatibility file. `ticketBreakable` nevertheless expires a genuinely live holder after fifteen minutes. That holder can resume and publish after its successor unless publication has another protection.

2. **Authority and safety boundaries**

   The default chunk ceiling narrows to 29,900 B. The opted-in allowance expands from the previously requested 49,400 B to 62,100 B—approximately 26%. That is an explicit expansion requiring ratification.

   `verifyBundle` establishes consistency with a local sidecar. It does not authenticate the producer or establish build identity. `SWITCH_LINK_API` establishes declared compatibility only.

3. **Does it weaken its judges?**

   No silent test deletion, skipping, assertion weakening, or fixture manipulation is visible in the supplied diff. Unknown-flag rejection and group-removal accounting strengthen enforcement.

   However, the opted-in allowance increases. Disclosure makes that reviewable; it does not make it non-expanding. The complete group implementation and previous baseline are omitted, so I cannot independently confirm all enforcement claims or compliance with the quoted standard.

4. **Other hosts or projections**

   No alternate-host bypass is demonstrated, but coverage across the advertised twenty tools is also not established here. Source-mode loading deliberately skips sidecar verification in `loadChunkExport`; that is an explicit alternate execution path whose intended trust boundary needs documentation.

   Older hook processes are a concrete alternate participant that does not honor tickets.

5. **Reversibility**

   Repository maintainers with merge authority can revert the PR merge commit, using the appropriate mainline parent, or revert the identified implementation commits while preserving the main merge.

   Reverting source does not stop running hooks or reverse checkpoint writes. Operational rollback therefore also needs process draining and verification that record formats remain readable against `d2475e82f8`.

6. **Falsification and omitted criteria**

   The performance benefit is false if representative default prompt latency does not improve despite reduced bytes. Correctness claims fail on duplicate effects, older-over-newer publication, or checkpoint debt that persists after healthy subsequent Stops.

   Missing operational detail includes how these outcomes are detected, who acts, and how activation or rollback handles running processes. The stated criteria already read naturally as “any occurrence”; prescribing a numerical failure allowance is unnecessary.

   Disabling the opt-in is an appropriate kill switch for future link activity, but does not cancel an in-flight writer.

7. **Smaller alternative and concrete next steps**

   Review and ship the split, digest extraction, loader, and enforced group budget separately. Provide their complete caller and gate diffs, build measurements, and representative latency results.

   Review the lock independently. Require old processes to drain before activation, or establish publication protection that every possible writer honors. Add deterministic tests paused between stale observation and unlink in both version directions, plus a suspended live holder resumed after expiration. Separately committed changes help reversion, but do not provide independent ratification.

8. **Standing instruction weight**

   No additional model-facing standing instruction text is shown. Bundle bytes are executable loading cost, not instruction or context weight. Maintenance complexity increases through the compatibility protocol, API-version discipline, and group budgets.

9. **Untrusted steering**

   Fixed chunk names limit direct module-path steering. The omitted callers prevent verification of session-path validation, subprocess arguments, environment handling, and relay-content treatment.

   A matching chunk and sidecar remain executable local content. Their protection depends on installation-directory permissions and installer trust, beyond the digest check itself.

Regarding the prior critiques:

- **Agree with Reviewer A** on the byte tradeoff, mixed-version race, and benefit of separating the lock.
- **Disagree with A’s §8:** parsing bytes are not standing instruction weight. Its demand for a rollback frequency threshold also overstates the gap; detection and response procedures matter more.
- **Agree with Reviewer B** on the bidirectional legacy race, live-holder expiration, missing complete diffs, and limits of sidecars.
- **Refine B’s fencing alternative:** a new ownership check alone cannot constrain an older writer that ignores it, and a check before writing can itself race. The proposed protection must demonstrate how stale publication becomes impossible across every supported writer.

STANCE: refused | CONFIDENCE: med | DEALBREAKER: yes
```

## For the owner's decision

- **Expected gain.** A prompt without the switch question, the default, parses 27,162 B of `quota_notice` instead of 47,877 B, and the chunk is under the 41,000 B it was asked to return to. With the question on, the combined cost is stated and enforced by a new chunk-group ceiling (62,100 B for 56,491 B measured) instead of hiding in one chunk. A slow Stop is no longer evicted from the record lock after two seconds, and breaking an abandoned lock can no longer remove a successor's.
- **Risk.** With the question on, a prompt parses 8,614 B (+18 %) more than before. While a hook of the previous version still runs across an install or a rollback, its own check-then-unlink of `<record>.lock` can interleave with another breaker, so two hooks can enter the record together; this change cannot alter that version's code. A missing, mis-digested or other-surface `switch_link` chunk turns the switch question and the pre-move checkpoint off until it is fixed; an owed checkpoint stays owed.
- **Rollback.** `AGENT_CONFIG_NO_SWITCH_QUESTION=1`, or leaving `AGENT_CONFIG_SWITCH_QUESTION` unset, stops both halves with no reinstall. A full rollback is a revert of the merge commit, which returns `quota_notice` to its 49,400 B ceiling and the lock to the previous version; the lock, the split, the group gate and the loader move are separate commits for a partial revert. Rollback criteria are in `agents/evidence/metrics/agent-switch-link-latency-20261108.md` (criteria 7-9 for this change).
