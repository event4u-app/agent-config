---
proposed_by: claude-opus-5-5
implemented_by: claude-opus-5-5
reviewed_by: ai-council
subject: f2fef9ce4cc0098f600f24dc7edca4ea2ca840e967913b9f0f5be3c0062e3931
providers: [anthropic, openai]
verdict: ratified
seats:
  anthropic: ratified
  openai: ratified
effective_after: merge
---

<!-- evidence-type: ratification -->

# Modification review

Move the agent-switch link out of the quota_notice lazy chunk into its own switch_link chunk (road-to-a-link-with-agent-switch 8.4): quota_notice ceiling lowered from 49,400 to 29,900 B (measured 27,128 B), new switch_link ceiling 30,300 B (measured 27,500 B), and a new gate feature, chunk_groups, capping both together at 60,100 B (measured 54,628 B); the digest check moves verbatim into bundle_digest.ts so a chunk does not carry the YAML reader. Council rounds 1-5 refused; round 5 asked, as round 4 did, to review the record lock rewrite separately, so it left this change for its own pull request and round 6 reviewed the split alone.

Verdict `ratified`, derived from each seat's stance line; the prompt every seat answered is `agents/evidence/council/agent-switch-link-chunk-ratification-r6-20261110.question.md`, committed at `5afd90fe623360354a6cd9f25f59191d9f5ad1d5` and naming this record's subject.

What this record does not establish: that a council produced the session it was rendered from. That file is the caller’s and council output is not kept, so on that point this record is exactly as trustworthy as a typed one. What it does establish is that the header says no more than the replies below, and that the prompt showed this content.

## Each seat, verbatim

### anthropic — `ratified`

```text
# Independent Review — agent-switch link chunk split (round 2, subject f2fef9ce)

## Prior Round Assessment

### Points I AGREE with:

**Reviewer A:**
- The 14% overhead (6,751 B) is substantial and warrants scrutiny
- ~1,600 B of duplicated helpers is technical debt that could be shared
- Missing production monitoring for chunk load failures
- No latency SLO for the digest check operation itself
- Filesystem compromise defeats SHA-256 verification (both files are local)

**Reviewer B:**
- Default-path byte reduction (43%, 20,749 B) is a meaningful improvement
- Chunk group mechanism makes aggregate cost visible and enforceable
- `require(specifier)` executes module init BEFORE `linkFor` checks compatibility — protects calls but not execution
- Removal-log validation is weak: accepts any entry naming `chunk_group` without substantive reason
- The branch revert specification is operationally imprecise vs. exact commits

### Points I DISAGREE with:

**Reviewer A's conclusion (refused):**
The 49,400 B ceiling was refused for forcing ALL prompts to parse the link. Making it opt-in fundamentally changes the tradeoff. The overhead is the price of: (1) user choice, (2) default reduction, (3) integrity verification, (4) aggregate budgeting. Rejecting 60,100 B because it exceeds a ceiling meant to block mandatory inclusion treats different contexts as equivalent.

**Optimization demand:** Reviewer A asks for <2,000 B overhead to respect the "original refusal." But that refusal addressed mandatory inclusion; this addresses opt-in choice. The comparison is category error.

### New points not raised in round 1:

1. **Precedent question:** This establishes that opt-in features may carry infrastructure overhead beyond the feature's base cost. The group mechanism makes this visible/bounded, but future splits could claim similar "necessary" overheads. Is that acceptable doctrine?

2. **Silent degradation cascade:** Missing chunk → no question → checkpoint stays owed → next Stop (if it loads) writes it. A persistent installation error creates an indefinite owed-checkpoint state, observable only through rollback criterion 8 or user reports. No alert fires between "chunk absent" and "behavior wrong."

3. **Helper duplication as measurable debt:** The 1,600 B of duplicated helpers (`user_global_paths`, partial `quota_ledger`) is quantified technical debt. Ratifying 60,100 B with that debt unaddressed sets a ceiling that could be 58,500 B if cleaned up. Should the gate bound the minimum achievable size rather than current implementation?

4. **Source mode verification gap persistence:** Development skips digest checks "because no built chunk exists." True, but a compromised development tree runs unverified chunks that later ship. The gap is intentional but creates a window.

5. **API version check location:** `linkFor(api)` checks after `require()` executes module initialization. A malicious or buggy chunk from a different build runs initialization code before compatibility rejection. The API check protects function calls, not load-time side effects.

---

## Direct Answers

### 1. Behaviour changes
**Stated:** Default parses 27,128 B; opt-in parses 54,628 B (two chunks + loader + digest). Missing/mismatched chunk = silent fallback.

**Unstated consequence:** An installation error (chunk absent, wrong digest, or API mismatch) appears as "feature disabled" with no immediate diagnostic. Checkpoint debt accumulates across Stops until one succeeds. Latency impact: sync digest check (SHA-256 over ~27.5 KB) added to opted-in prompt path.

### 2. Authority/safety boundaries
**Narrower:** Default 43% reduction; digest + API checks guard chunk use.  
**Wider:** Opt-in +14% (+6,751 B); group 60,100 B exceeds refused 49,400 B by +10,700 B; two-file install; source mode skips verification.

**Critical:** SHA-256 is local consistency, not authentication. Filesystem compromise defeats it.

### 3. Weakening judges?
**No.** Gate gains group enforcement; `quota_notice` ceiling lowered; tests added, none weakened. But: removal-log validation accepts any entry naming `chunk_group`; gate doesn't discover actual chunk loads (membership manually declared).

### 4. Other hosts/projections
Source mode bypasses digest. `require()` runs module init before `linkFor` checks API. Opt-out via env vars. API mismatch = silent degradation.

### 5. Revertibility
Clear: merge commit or branch commits. Eight rollback criteria. Authority: repository access. **Imprecision:** "commits after X excluding main merges" less precise than commit list.

### 6. Falsifying observations & omitted criteria
**Falsifies:** Measured bytes exceed ceilings; default no faster in production.  
**Omitted:** Digest check latency SLO; production monitoring for load failures; persistent failure being invisible; regression below 500ms threshold.

### 7. Smaller change?
**Could be 2,000-3,000 B smaller:** Share loader (~−1,300 B), shared helpers (~−800 B), call surface simplification (~−1,000 B). Result: ~51,500-52,500 B group, still over 49,400 B.  
**Larger buys:** Default savings, group mechanism, digest integrity, opt-in choice.

### 8. Standing instruction weight
Default: REDUCES (−20,749 B). Opt-in: INCREASES (+6,751 B). Permanent: loader/digest/API/groups machinery. **Not shown:** Contract/roadmap/evidence token cost (diff omitted them).

### 9. Untrusted steering
Filesystem compromise, env control, API manipulation, source mode gap. **Bounds:** Group ceiling, digest, API version. **Missing:** Rate limiting on load attempts; monitoring repeated failures.

---

## Assessment

**I AGREE the 60,100 B group ceiling is acceptable, with conditions.**

### Strongest argument FOR ratification:

The refused 49,400 B ceiling addressed **mandatory inclusion** forcing all prompts to parse the link. This change makes it **opt-in**: defaults parse 27,128 B (34% under the original 41,000 B ceiling, 43% under 47,877 B), and only users who choose the feature pay the 54,628 B cost. The 6,751 B overhead buys: (1) default savings for 100% of non-opted prompts, (2) integrity verification, (3) API compatibility checking, (4) a gate mechanism that bounds aggregate growth. Treating the opt-in group as equivalent to the refused mandatory ceiling conflates different problems. The group makes the cost explicit and bounded; users decide if the feature is worth it.

### Strongest counter-argument:

Splitting a 47,877 B feature costs +6,751 B (+14%) in infrastructure. That overhead includes ~1,600 B of duplicated helpers (technical debt), ~2,600 B of loader/digest (necessary), and ~2,551 B of call surface (API contract). The technical debt portion could be eliminated, bringing the group to ~58,500 B. Ratifying 60,100 B locks in that debt as acceptable. The precedent is: opt-in features may add 14% infrastructure overhead, and we'll call it "the price of choice." That doctrine could justify future overheads. If the line was 49,400 B for good reason, opt-in doesn't erase it—it shifts who pays, not what's too large.

### Concrete next steps (RATIFIED path):

1. **Ratify the 60,100 B group**, explicitly noting it includes ~1,600 B of duplicated helpers (`user_global_paths`, partial `quota_ledger`) as documented technical debt to address separately.

2. **Strengthen removal-log validation** (`chunkGroupRaiseFindings`): require entries that remove groups or drop members to state the substantive reason, not just name the `chunk_group`.

3. **Add production observability:**
   - Monitor chunk load failures (missing, digest mismatch, API mismatch)
   - Alert on persistent failure for a session (rollback criterion 8)
   - Measure digest check latency (p50, p95) to validate < 5ms assumption

4. **Document the precedent:** Opt-in features may carry infrastructure overhead; group ceilings bound the total; overhead must be justified by default savings + user choice.

5. **Follow-up optimization:** Track the 1,600 B technical debt; address in a separate change to bring the group to ~58,500 B without re-splitting.

6. **Correct loader comment** (`hooks/bundle_digest.ts:55`): "the chunk is … the one built" should say "the chunk matches its local sidecar" (Reviewer B's point).

STANCE: ratified | CONFIDENCE: med | DEALBREAKER: no
```

### openai — `ratified`

```text
**Assessment: mixed; I would ratify the explicitly disclosed 60,100 B allowance.** This verdict concerns the supplied diff; the build sizes, subject digest and test outcomes remain reported evidence, not independently verified results.

**Strongest argument:** the split removes 20,749 B from the default prompt path, while `chunkGroupFindings` enforces a combined budget for opted-in prompts. That addresses the default-path cost without concealing the optional path’s expansion.

**Strongest counter-argument:** the change adds synchronous verification, another installation dependency and silent failure modes to a feature whose checkpoint matters. The byte reduction is demonstrated by the reported measurements; an overall reliability or latency improvement is not.

I agree with **Reviewer B** that byte counts do not establish latency, API compatibility is checked after module initialization, runtime bytes differ from standing instruction weight, and group-removal logging is weaker than ceiling-raise validation. I agree with **Reviewer A** that opted-in cost increases and source mode lacks sidecar verification.

I disagree with A’s assertions that the default necessarily becomes faster and the opted-in path necessarily slower. Neither follows directly from bundle size. A’s proposed overhead targets and estimated savings are unsupported by this diff. The earlier refusal also does not establish that every optional aggregate must remain below 49,400 B; the expanded allowance requires an explicit verdict, which this review supplies.

1. **Behaviour.** `quota_notice_hook.ts:183` conditionally loads the link; the Stop caller loads a separate chunk. Failure suppresses the question or defers an owed checkpoint. `loadLazyExport` now delegates to the digest-checking loader, so the effect potentially extends to **every existing lazy concern**, not merely agent-switch. Their failure and fallback behaviour deserves regression coverage.

2. **Boundaries.** The default chunk budget narrows; the opted-in aggregate allowance widens. Sidecar verification establishes local consistency, not provenance. `linkFor` protects function calls against declared API mismatch; it cannot prevent initialization of an incompatible module.

3. **Judging mechanisms.** No supplied test change demonstrates a silently weakened assertion. The aggregate expansion is disclosed rather than hidden. However, `chunkGroupRaiseFindings` accepts removal or member deletion with merely a new object naming the group; unlike a ceiling raise, it does not validate a substantive explanation. This weakens the new mechanism’s audit quality.

4. **Other projections.** Source execution deliberately avoids sidecars. That is a separate trust model, not automatically an exploitable bypass. The excerpt does not establish packaging coverage across all installed hosts. Manually declared groups also cannot detect a newly loaded chunk omitted from their membership.

5. **Undoing it.** A maintainer with merge authority can revert the eventual merge commit, accounting for subsequent dependencies. Record that exact revision when available. The environment kill switch disables the feature but does not restore the previous implementation or complete outstanding checkpoints.

6. **Falsification and omissions.** Default loading of the link would contradict the isolation claim; measured sizes above the limits would contradict budget compliance. Existing rollback criteria cover persistent checkpoint failure, but need an observable signal: silent failure makes detection difficult. Add a relative opted-in latency regression criterion alongside the absolute 500 ms threshold.

7. **Smaller alternatives.** Deduplicating helpers or choosing another extraction boundary could reduce overhead, but the supplied evidence does not establish achievable savings. The larger change buys default-path isolation and enforceable aggregate accounting. Avoid weakening verification merely to meet an arbitrary overhead target.

8. **Standing instructions.** No increase in universally loaded instruction text is demonstrated. Omitted contract and evidence edits prevent a complete assessment. Chunk bytes are execution footprint, not instruction tokens.

9. **Untrusted steering.** Fixed loader paths prevent prompt text from directly selecting a module. Relayed agent-switch text remains an indirect influence; labeling it as data helps communicate intent but supplies no enforcement boundary. Existing response validation and subprocess bounds remain relevant.

Concrete next steps: validate removal-log explanations, verify installation and update packaging of the chunk and sidecar, exercise existing lazy concerns through the shared loader, and measure both paths in fresh processes. Add a bounded diagnostic for repeated load failures. These are targeted follow-ups; the disclosed byte allowance itself is defensible.

STANCE: ratified | CONFIDENCE: med | DEALBREAKER: no
```
