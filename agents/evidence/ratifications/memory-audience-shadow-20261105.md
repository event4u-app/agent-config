---
proposed_by: claude-opus-5-5
implemented_by: claude-opus-5-5
reviewed_by: ai-council
subject: 4dacd4bb92d8d3fcfad0b2ebcb6e6e9b49663dcd2f724d34c422a67728a00a1f
providers: [anthropic, openai]
verdict: ratified
seats:
  anthropic: ratified
  openai: ratified
effective_after: merge
---

<!-- evidence-type: ratification -->

# Modification review

memory-audience-shadow: a record-only claude pre_tool_use concern that records child write attempts under agents/memory/ by resolved destination and the counts of the curated slice a spawn prompt names; never denies, never emits.

Verdict `ratified`, derived from each seat's stance line; the prompt every seat answered is `agents/evidence/council/memory-audience-shadow-ratification-r13-20261105.question.md`, committed at `aa2db6f46c192a23e11d66e8759d802bb40b7840` and naming this record's subject.

What this record does not establish: that a council produced the session it was rendered from. That file is the caller’s and council output is not kept, so on that point this record is exactly as trustworthy as a typed one. What it does establish is that the header says no more than the replies below, and that the prompt showed this content.

## Each seat, verbatim

### anthropic — `ratified`

```text
## Independent Review: Memory Audience Shadow (Round 13)

Reading this change fresh, without prior rounds. This adds writer provenance and memory slice telemetry through a new record-only hook concern plus gates in the signal emission path.

### Agreement with prior reviewers

**Agree with Reviewer A:**
- Hook latency unmeasured despite 100k-char regex scan per spawn
- Gitignored ledger accumulates without stated retention
- Caller-declared writer field enables bypass by design (contract-level tradeoff)
- Manual E2E probe vs automated test is a gap

**Agree with Reviewer B:**
- Claude-only binding leaves other hosts observable but unmetered
- Records are partial observations (missing = unresolved OR ineligible OR beyond bounds)
- Writer gate validates declared provenance, doesn't authenticate it
- Lacks operational disable criteria (latency threshold, ledger size, error rates)

Both reviewers correctly identified the change as narrowing or status quo on authority, not expanding. Both ratified with medium confidence, citing follow-up work but no blockers.

### Disagreement

None on substance. The reviewers were thorough.

**Minor framing difference:** Reviewer A's "highest leverage change" (add hook latency telemetry) is post-merge friendly; Reviewer B's (automated E2E test) guards the integration before merge. I lean toward the E2E test as higher pre-merge leverage because it protects the registration → binding → projection → invocation path that was only manually verified.

### New points not raised in round 1

1. **Whitespace truncation correctness**: The scan truncation walks backward from `MAX_SCAN_CHARS` to the last whitespace before it. If the first 100k chars contain no whitespace, `lastWhitespaceBefore()` returns 0, `scanned` becomes empty, and no refs are counted. This is correct — an adversarial 100k-char no-whitespace prompt shouldn't match refs. The `scan_truncated: true` flag surfaces this. Test coverage exists but the edge case is subtle.

2. **Multi-stage deduplication is complex but correct**: Names are normalized, then deduplicated as strings, then resolved to real paths, then deduplicated by real path. This means `agents/memory/a.yml` and `agents/memory/./a.yml` count once (string dedup), and two different names for one file count once (real-path dedup). Eligibility is decided before dedup and before the 5-ref cap, so an ineligible name never displaces a deliverable one. Tests verify but the logic is intricate.

3. **Intake symlink handling is thorough**: Intake can be a symlink out of the store; it's resolved independently. A curated name that resolves into intake's real directory is excluded from the slice. A write to a curated name resolving into intake is classed as `target: 'intake'`. Tests cover both scenarios. This is non-obvious from the code.

4. **Regex boundary fix from round 12 is correct**: The trailing `(?![A-Za-z0-9_/~-]|\.+[A-Za-z0-9_/~-])` excludes `x.yml.bak`, `x.yml._bak`, `x.yml.~1` (dots followed by name chars) while allowing `x.yml.`, `x.yml...`, `x.yml)` (dots not followed by name chars). Tests verify. Subtle negative lookahead logic but handles the round 12 concern.

5. **Filesystem timing unbounded but acceptable**: Synchronous `fs.realpathSync`, `fs.statSync`, `fs.lstatSync` could hang on slow/remote mounts. Catch-all error handling allows the tool call but hides the failure. For record-only telemetry this is acceptable (data loss, not tool denial), but worth noting for operational monitoring.

6. **Twin divergence is a maintenance risk**: The consumer twin `src/agent-src/templates/scripts/memory_signal.ts` is claimed byte-identical but not shown in the diff. If twins diverge, the writer gate could be bypassed by calling the twin that lacks it. Not a merge blocker but a maintenance hazard — consider a build-time check or a single source.

### Answers to the nine questions

1. **Behaviour changes**: Hook records child writes (tools with `agent_id`) to `agents/memory/*` as `intake`/`curated` and counts curated refs in orchestrator spawn prompts (up to 5 deliverable, 20 examined, rest counted). `memory_signal.emit()` refuses writer classes `unpaid`, `council-seat`, `judge-seat` and unknown classes. `learning_sidecar` skips `external_read` tainted signals. Unstated: regex scans 100k chars per spawn (latency), ledger grows unbounded, slice counts logged but not delivered (phase 3), writer is caller-declared (trust model), other hosts bypass telemetry.

2. **Authority boundaries**: Narrower (writer restrictions, external read exclusion). No widening. New boundaries: memory audience tiers, slice cap at 5, examination cap at 20, resolution depth cap at 32.

3. **Test weakening**: None evident. Concern count 73→74 matches addition. Permission test skip is legitimate (root bypasses). Omitted tests claimed red-first but not shown — trusting summary.

4. **Other hosts / projections**: Yes. Other hosts (agentic-node, gpt-v0) bypass hook telemetry; direct filesystem bypasses both hook and writer gate; shell commands bypass `WRITE_TOOLS`; lying about writer bypasses gate. Acceptable for scoped telemetry; writer gate at `emit()` applies regardless of hook.

5. **Undo**: Remove hook from manifest (needs ratifiers), revert `memory_signal.ts`, `learning_sidecar.ts`, both twins, regenerate compiled manifest. Authority: commit access + ratification process. Against: pre-merge state. Existing ledger persists.

6. **Falsification**: Child write with `agent_id` producing no ledger line; >5 refs delivered in phase 3; refused writer succeeding; `external_read` signal aggregated. Missing: hook latency alert, ledger retention policy, success metric for phase 3, filesystem timeout handling, error rate monitoring.

7. **Smaller change**: Could split hook-only vs writer-gate-only. Larger change buys complete observability picture (what children write AND receive) in one ratification cycle. Reasonable tradeoff.

8. **Standing instruction weight**: Regex scan (up to 100k chars) on every claude Agent/Task call is the largest per-session cost. No typical-case timing. Also: filesystem resolution for up to 20 refs, writer validation per emit, taint check per signal read, audience table docs. Bounded quantifier `{1,200}?` limits backtracking but scan is still O(prompt length).

9. **Untrusted steering**: Prompts can name many nonexistent refs to exhaust the 20-name examination budget, pushing valid refs past it (test explicitly demonstrates). Bounds: `MAX_SCAN_CHARS` 100k, `MAX_EXAMINED_REFS` 20, `MAX_RESOLVE_DEPTH` 32, regex quantifier `{1,200}?`, real-path containment checks, exit 0 on all paths. Writer/taint fields caller-declared, so absence or alteration bypasses respective policies. Adequate bounds for observation + cooperative provenance enforcement.

### Specific correctness checks

- **Projection tests**: Verify `agent_id` and `file_path`/`prompt` survive, verify other fields dropped (`description`). Good.
- **Privacy**: Ledger lines carry tool name, target class, counts — no paths, agent IDs, prompt text. Privacy-by-construction works.
- **Taint matching**: Case-insensitive, trimmed (`external_read`, `EXTERNAL_READ`, etc.). Good.
- **Writer allowlist**: `unknown` allowed (missing writer default), unknown classes refused (prevents disguised refused classes like `:unpaid`). Subtle but correct.

---

**APPROVE** with the same caveat both prior reviewers identified: follow-up work (latency telemetry, retention policy, automated E2E) is valuable but not blocking. The change is functional, tested, bounded, and privacy-preserving.

**Highest leverage change before merge**: Add an automated E2E test exercising the built dispatcher's registration → binding → projection → invocation path for one child write and one spawn. This protects the integration that was only manually verified in round 1. Costs ~50 lines (test boilerplate), guards against regression in `agent_id` detection or payload projection, and validates the hook actually fires in the dispatcher context. Latency telemetry can follow post-merge.

STANCE: ratified | CONFIDENCE: med | DEALBREAKER: no
```

### openai — `ratified`

```text
I agree with Reviewer B’s distinction between partial telemetry and an audit, its assessment of caller-declared provenance, and its warning that bounded filesystem work does not bound latency. I also agree with both reviewers about retention and the missing automated dispatcher test.

I disagree with Reviewer A’s “no widening” claim: the hook gains access to prompt bodies and adds ledger writes. Its fail-open behavior prevents intentional denial, but cannot prevent synchronous filesystem stalls. Runtime overhead also differs from standing instruction weight, and phase-3 delivery behavior cannot falsify this PR’s current observation claims.

1. **Behavior changes.** `processEnvelope()` records selected child write attempts and orchestrator spawn-reference counts. Separately, `emit()` introduces live writer rejection, and `readSignals()` stops using `external_read` records for corroboration. The whole PR therefore changes production behavior beyond the “record-only” hook. Missing telemetry cannot establish that no write occurred; a recorded attempt cannot establish success.

2. **Authority and safety boundaries.** The manifest’s `needs_payload_bodies: [input]` grants this concern prompt visibility; `payload_fields` limits projected input. Counts-only logging limits retained information. The writer allowlist narrows accepted declarations without authenticating identity: absent provenance becomes allowed `unknown`, and an allowed declaration remains caller-controlled. Taint filtering likewise depends on callers preserving the label.

3. **Weakening of judging mechanisms.** None is demonstrated in the supplied diff. Moving the concern count from 73 to 74 is consistent with registration. The root-only permission-test skip has a technical justification. However, omitted files, generated output, red-first claims, and the manual dispatcher probe are reported evidence, not independently verified results. There is no basis here to certify their exact contents.

4. **Other hosts and projections.** Observation remains Claude-only and limited to three write tools. Shell writes, other hosts, and absent child identifiers escape observation. Direct filesystem writes also bypass `emit()`’s declaration gate. These are material coverage limits, even if intentional. The projection unit test protects one link; it does not prove the installed dispatcher invokes the concern with the correct root and payload.

5. **Reversibility.** An authorized maintainer can remove the Claude binding and regenerate the compiled manifest through the applicable ratification process. Full rollback additionally requires reverting provenance, sidecar, template, and installed/generated changes. Use the actual merged revision: the supplied digest identifies the manifest subject at `51427f8bc8`, not the complete later branch. Reverting code leaves ledger records behind and does not automatically rerun lesson aggregation.

6. **Falsification and operational criteria.** Controlled eligible calls producing missing, duplicate, or incorrect records would disprove the observation claims. Independent reference enumeration disagreeing with the logged counts would undermine their planning value. Missing disable criteria include excessive latency, ledger growth, and persistent observation failure. Catch-all handling makes filesystem failures operationally quiet: operators cannot distinguish a healthy hook with no events from a broken observation path using this ledger alone.

7. **Smaller change and maintenance.** A hook-only PR would isolate telemetry from live writer rejection and lesson filtering, simplifying review and rollback. The combined scope buys coordinated provenance groundwork, but should be described accordingly. Existing ledger, root-resolution, stdin, and cap helpers are appropriately reused; the functional structure needs no additional OO abstraction. The ongoing burden is maintaining path parsing, filesystem edge cases, distributed twins, and ledger storage.

8. **Standing instruction weight.** The audience table, council citation, and implementer-template additions increase instructions wherever loaded; the supplied material cannot establish a universal per-session token cost. An empty `{{knowledge_refs}}` slot still leaves its explanatory instructions. Separately, every eligible spawn incurs scanning, filesystem work, and a ledger append—even when no references are found.

9. **Untrusted steering and new refinements.** Prompt text controls candidate selection. Twenty nonexistent names can exclude later valid references; the tests explicitly pin that behavior. `unexamined` and `scan_truncated` expose incomplete scanning, but `examined` includes nonexistent and ineligible names, so it is not an eligible-reference denominator. Keep those meanings explicit in any operational dashboard. Containment checks and output minimization constrain consequences; they do not authenticate provenance or guarantee filesystem responsiveness. Additional regression coverage should exercise `main()` with malformed input and the actual built dispatcher; the current failure test checks allowance, not operational visibility of failure.

APPROVE: the supplied implementation supports bounded, scoped observation and cooperative provenance checks; the single highest-leverage pre-merge improvement is an automated built-dispatcher regression covering binding, root resolution, projection, and exactly one ledger append.

STANCE: ratified | CONFIDENCE: med | DEALBREAKER: no
```
