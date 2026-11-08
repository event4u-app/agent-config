---
proposed_by: claude-opus-5-5
implemented_by: claude-opus-5-5
reviewed_by: ai-council
subject: 84e7b48ee66adc46e059e71f6ae86289e7e0616d900b743c73335802900a93c8
providers: [anthropic, openai]
verdict: refused
seats:
  anthropic: refused
  openai: refused
effective_after: merge
---

<!-- evidence-type: ratification -->

# Modification review

Raise the quota_notice lazy chunk ceiling from 22,800 to 41,000 B for the agent-switch switch question (raise, relay, best-effort checkpoint, off switch). Council round 5 refused (both seats, dealbreaker); merged on the owner's word per ADR-282, residual findings carried into Phase 7 of road-to-a-link-with-agent-switch.

Verdict `refused`, derived from each seat's stance line; the prompt every seat answered is `agents/evidence/council/agent-switch-ask-ratification-r5-20261108.question.md`, committed at `172f63ac9d91b56c4f5e782f1fc3889bea1eafd0` and naming this record's subject.

What this record does not establish: that a council produced the session it was rendered from. That file is the caller’s and council output is not kept, so on that point this record is exactly as trustworthy as a typed one. What it does establish is that the header says no more than the replies below, and that the prompt showed this content.

## Each seat, verbatim

### anthropic — `refused`

```text
# Independent Review — Round 5

Reading this fresh, as an outsider who hasn't seen prior reasoning:

## 1. Agreement with prior reviewers

**Reviewer A:**
- Correct that synchronous 5s calls with no circuit breaker is the core problem
- Correct that contract explicitly defers this ("no failure counter or circuit breaker")
- Sound suggestion for Phase 5.5 latency measurement and circuit breaker
- Correct that +16KB bundle cost paid by all sessions for subset benefit

**Reviewer B:**
- Exactly right: "operating requirements for this activation, not merely future refinements"
- Correct on unbounded retry cost (every hot-window prompt pays timeout if link fails)
- Correct that opt-in is appropriate until operational evidence exists
- Correct that checkpoint/execution race needs resolution, not just documentation

## 2. Disagreement with prior reviewers

**Reviewer A's "DEALBREAKER: no":**
I disagree. Reviewer A says "the latency risk can be mitigated post-ship if it arises." But the risk is **predictable**, not hypothetical: failing link → every hot-window prompt stalls 5s → user perceives system as broken. "Mitigate post-ship" means users hit the problem first, then operators scramble. Reversibility via env var is a recovery path, not a reason to ship the risk.

## 3. New points

**The bundle threshold deserves independent scrutiny.** Ceiling rises 80% (22,800→41,000 bytes). Measured headroom is 6%—tight enough that two similar raises would exhaust it. The `raise_log` justifies it, but should all-session performance constraints relax automatically when a feature needs room, or should threshold changes be reviewed separately?

**Stale record cleanup is missing.** If a terminal request's record isn't deleted (write failure, killed process), subsequent prompts retry `showSwitch` indefinitely. No TTL, no cleanup. A request can be `expired` in agent-switch while the local record persists forever, causing wasted spawns.

**The checkpoint/execution race is contradictory, not just vague.** Contract says "this Stop is the last point the session can leave it" then immediately: "`how: now` can run before this Stop." Both can't be true. Code treats checkpoint as best-effort and never-gating, which is coherent. But contract language suggests Stop precedes execution, which is false for `how: now`. This affects whether checkpoints are useful, not just confusing.

**Lint is detection, not enforcement.** Line 204 cites `lint_mcp_config_security` as if it enforces no-auto-approve. But lint runs on demand. User could edit `.mcp.json` post-install and won't see lint failure until next run. Host tool confirmation is the real gate; lint is valuable but downstream.

## 4. My assessment

**STANCE: refused | CONFIDENCE: high | DEALBREAKER: yes**

### Single strongest argument (my position)

The change ships a **predictable operational failure**: synchronous 5s external calls in a prompt hook with no circuit breaker. When agent-switch is slow/failing, every hot-window prompt stalls. The contract acknowledges this gap ("no failure counter or circuit breaker... deferred to Phase 6") but ships anyway. This isn't a future optimization—**it's a prerequisite for activation**. The fail-open design (errors→no request) prioritizes availability, but repeated 5s stalls are user-visible failures, not graceful degradation. Circuit breaker with back-off is standard mitigation for retry storms; deploying without it is operational malpractice.

### Single strongest counter-argument (developer should consider)

The safety controls are appropriate: host confirms `switch_decide`, validation rejects malformed responses, output bounded/labeled, lint blocks auto-approve, env vars provide escape hatch. The +16KB bundle, while paid by all sessions, addresses real quota pressure pain. If Phase 6 ships promptly (4 weeks?) with circuit breaker, and this is opt-in until then, the phased rollout is defensible. Code quality is high, feature is reversible, design is coherent.

### Concrete alternatives (because I refuse)

1. **Add circuit breaker before merge.** Threshold: 3 consecutive timeouts/errors → 1-hour skip. Test: configure timeout, send 5 prompts, verify stop after 3. This belongs in Phase 4, not 6.

2. **Instrument and measure.** Emit p50/p95/p99 latency from `callJson`. Run 2 weeks opt-in. Rollback if p95>2s. Operational validation, not future work.

3. **Resolve checkpoint race.** Either coordinate with execution or test recovery when `how: now` precedes Stop. Document which race is acceptable. Current contract contradicts itself.

4. **Verify host confirmation.** Test each platform (CLI/desktop/web/IDE) actually prompts for `switch_decide`. Lint is detection; host prompt is enforcement.

5. **Make opt-in until Phase 6.** Add `AGENT_CONFIG_ENABLE_SWITCH_QUESTION=1` (explicit) alongside opt-out. Ship for testing without exposing all users.

6. **Add stale-record TTL.** Expire local records after 7 days or when agent-switch state is terminal. Prevents unbounded retry on orphaned records.

STANCE: refused | CONFIDENCE: high | DEALBREAKER: yes
```

### openai — `refused`

```text
**Assessment: mixed; refuse ratification as presented.** The validation improvements are useful, but default activation still precedes evidence about recurring latency and execution-time consent.

**Strongest argument:** an unreadable saved request persists indefinitely. In `switchTurn`, `showSwitch(...) === null` returns without clearing or aging the record. Every later eligible prompt retries; Stop can independently poll it too. Operators inherit repeated stalls and manual recovery without back-off, expiry or diagnostic evidence.

**Strongest counter-argument:** AC creates a question rather than directly approving a move. Session/id binding, restricted parsing and explicit off switches make this a reasonably contained integration. That supports an opt-in trial.

1. **Behaviour changes and consequences.** The prompt hook now creates external requests, polls saved requests, writes user-global records and supplies tool-use instructions through `additional_context`. Stop independently polls for approval and attempts a checkpoint. Failed creation consumes its claim without retry, potentially suppressing the feature for the entire window; failed polling has the opposite behaviour—unbounded retries across prompts. Those asymmetric failure modes complicate support.

2. **Authority and safety boundaries.** AC expands from quota notification into initiating orchestration and directing the model toward a consequential MCP call. Matching identifiers narrows response acceptance. The claimed execution boundary remains external: neither `raisedContext` nor a security lint proves that a host actually requires confirmation. The off switch narrows AC participation; it does not revoke agent-switch’s existing authority.

3. **Weakening of evaluators.** `max_bytes: 22800 → 41000` explicitly relaxes the size gate by about 80%. It is disclosed, rather than silent, and no supplied evidence shows deleted assertions, skipped tests or changed fixture semantics. Nevertheless, “Nothing earlier: the growth is the feature” in `raise_log.what_would_have_caught_it` is not an operational justification for the chosen headroom. Independent approval must cover the relaxed budget itself. No test results or complete test diff were supplied.

4. **Other hosts and projections.** This path targets Claude prompts, while approval may happen through agent-switch or an MCP host. The supplied diff does not establish confirmation enforcement across those execution paths. Treat lint as configuration detection, not a runtime barrier. Verify the hosts actually exposed to this feature; the project’s support for 20 tools does not establish equivalent controls.

5. **Reversal.** Users can disable AC participation through the two environment variables, once the relevant hook processes inherit them. Maintainers can revert the feature changes reviewed at `a54483d66a` and rebuild/reinstall affected user-level configurations. The historical measurement base `d783496af2` is not automatically the correct rollback target. Existing external requests require separate inspection or cancellation through agent-switch’s authorized interface: disabling AC neither cancels them nor reverses completed moves.

6. **Falsification and omitted operating criteria.** The benefit fails if successful moves do not preserve usable continuity, prompts stall enough to outweigh saved effort, or users cannot reliably understand and authorize the proposed target. Before default activation, define measured prompt/Stop latency limits, polling failure back-off, stale-record expiry, consent failures requiring immediate disablement, and recovery criteria for moves preceding checkpoints. A five-second call timeout is not an end-to-end hook latency measurement.

7. **Smaller alternative.** Start with an opt-in notification linking users to agent-switch, leaving decisions there. That retains quota-triggered discovery while avoiding in-session tool instructions. Add interactive decisions and polling after host confirmation and latency evidence exist. The larger design buys convenience and status visibility, but also recurring process calls, state maintenance and a second consent interaction.

8. **Standing instruction weight.** The measured chunk grows by 15,948 bytes; that is executable loading cost wherever this shared lazy chunk loads, including its other concern, `metered-spawn-ask`. It is not model instruction weight. The supplied changes add conditional model context once on creation and on relay updates; they show no new universal standing instruction. The creation instruction can subsequently be lost through context compaction because open-request polling does not reintroduce it.

9. **Untrusted steering.** CLI output and local request records influence notices, model context and checkpoint selection. Identifier checks and schema restrictions constrain that influence. Clipping and a “data” label do not neutralize malicious commands: `resume` still becomes user-facing “Resume it with: …”. Confirmation for `switch_decide` does not protect unrelated actions suggested by injected text. Also, parsing processes the entire candidate array before displaying three; display bounds are not input-processing bounds.

**Prior-review agreement and corrections:**

- **Agree with Reviewer B:** recurring polling failure, missing runtime consent evidence, rollback of existing requests and the contradictory contract wording are material concerns. “Moves after the turn at the earliest” conflicts with the subsequent `how: now` exception and should be removed.
- **Agree with Reviewer A:** the explicit budget relaxation and separation between creation context and subsequent relay context matter.
- **Disagree with Reviewer A:** failed creation does **not** retry on every hot-window prompt; the claim prevents that. Existing-record polling causes recurring retries. The larger chunk is not necessarily loaded by every session, and its bytes are not standing model instructions. Splitting out relay could spare unrelated shared-chunk consumers, so the packaging justification is incomplete.
- **Disagree with Reviewer A’s safety conclusion:** host confirmation for one tool does not bound every action that injected `resume` text might suggest.
- **Additional refinement:** atomic record replacement does not make read–modify–write operations coordinated. Prompt relay and Stop can overwrite each other’s `decision_told` or `checkpointed` updates, or recreate a record after terminal deletion. Test those interleavings before claiming “once” semantics.

Concrete next steps: make activation opt-in; implement polling back-off and record expiry; measure actual prompt and Stop latency; demonstrate confirmation on exposed execution hosts; test record races and checkpoint timing; and document external-request cancellation separately from disabling AC.

STANCE: refused | CONFIDENCE: high | DEALBREAKER: yes
```
