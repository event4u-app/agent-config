---
proposed_by: claude-opus-5-5
implemented_by: claude-opus-5-5
reviewed_by: ai-council
subject: 0d375e89d95adb4b0bfb8b096d73f7500ef7698fa92171ae7a6bccf3511268ac
providers: [anthropic, openai]
verdict: ratified
seats:
  anthropic: confirmed-non-expanding
  openai: ratified
effective_after: merge
---

<!-- evidence-type: ratification -->

# Modification review

Act-time reference duty: a shell-act recogniser checked against bash, the act-reference table, observation of bound acts in the reread-guard ledger, and the conditional reference_duty chunk with its budget row and raise_log entries.

Verdict `ratified`, derived from each seat's stance line; the prompt every seat answered is `agents/evidence/council/act-references-ratification-r17-20261108.question.md`, committed at `b72f2f61768f33209db7c689b872ef6d4d142681` and naming this record's subject.

What this record does not establish: that a council produced the session it was rendered from. That file is the caller’s and council output is not kept, so on that point this record is exactly as trustworthy as a typed one. What it does establish is that the header says no more than the replies below, and that the prompt showed this content.

## Each seat, verbatim

### anthropic — `confirmed-non-expanding`

````text
# Independent Review — Round 17

## Agreement with Prior Reviews

**Agree with Reviewer A:**
- The unified grammar prefix loop is the right architectural choice over special-casing each edge case
- Testing is rigorous within the stated contract (curated oracle + bash differential)
- Weakest assumption is that generator grammar bounds what agents actually write in practice
- The trace of `time >/dev/null ! git push` is correct

**Agree with Reviewer B:**
- The diff doesn't establish equivalence throughout the generator's language (I cannot see the complete generator implementation)
- Distinction between "syntactic candidate" and "executed act" must be preserved by consumers
- Budget increase 18,200 → 22,000 loosens a gate (though explicitly logged, not hidden)
- Equivalence claims need qualification about environment and reachability assumptions

## Disagreements

**Partial disagreement with Reviewer A's confidence level:**
- "RATIFIED | HIGH" is generous given 34% byte growth (15,080 → 20,247 B) across 17 rounds
- The 8% ceiling margin (1,753 B remaining) is tight for a parser that found new syntax in 15 consecutive rounds after the first raise
- Convergence to bash's complete syntax is **assumed, not proven** — bash is Turing-complete through functions, aliases, etc.
- I'd rate CONFIDENCE: MED because the growth trajectory doesn't demonstrate we've found the last edge case

**Partial disagreement with Reviewer B's stance:**
- "APPROVE" is too weak for the testing quality shown (155 curated cases, 1,500 generated seeds, real bash comparison, eight-run oracle for reachability)
- The eight-run oracle limitation is explicitly acknowledged; for **observe-only** this is adequate — false observation costs reader attention, not safety
- Requesting "precise" equivalence qualification might over-promise; the contract already says "best effort beyond the grammar"

## New Points Not Raised in Round 1

### 1. The ceiling raise is actually two raises in one commit
The diff shows both 18,200 → 20,600 (round 7, measured 18,774 B) and 20,600 → 22,000 (round 15, measured 20,607 B) in a single `raise_log`. Both are properly logged with "what was added" and "why it could not be avoided," but presenting them together could confuse a reader about which findings drove which raise. This is **acceptable** since both are documented, but it's worth noting.

### 2. The `external` variable logic is not shown in this diff
Reviewer A notes that `external` context tracking (making `exec` after `exec`/`nohup`/`sudo`/time(1) a program name, not a wrapper) was present in round 16. The round-17 diff doesn't show where this was introduced, making the diff **incomplete as a standalone review artifact**. I have to trust that the round-16 review covered it.

### 3. Generator coverage of prefix combinations unclear
The test excerpt shows `simple()` adds `time >/dev/null -p` cases, but I cannot verify whether the generator produces all **intermixed** prefix combinations like:
- `! time git push` (pinned in oracle)
- `time ! command git push`
- `! command time git push`

The oracle has `! time ! X=1 git push` and `time ! time X=1 git push`, but without seeing the full generator I cannot confirm systematic coverage. For observe-only this is acceptable, but it's a **verification gap**.

### 4. Bash version compatibility beyond 3.2 and 5
The code follows bash 5; bash 3.2 differences are pinned in `BASH3`. The `raise_log` says bash ≥4 is "required on Linux CI." But are bash 4.x-specific differences tracked? What about bash 6+ (future)? The contract makes no commitment to track future versions. For observe-only this means **future misses are acceptable**, but it should be stated more clearly that "bash 5" is a snapshot, not a moving target.

### 5. The "correctness" claim is actually version-qualified
The recogniser header says "correctness measured against bash," but this is **bash 5.2, with known bash 3.2 divergences recorded**. The `BASH3` map is clever, but the header should say "follows bash 5" explicitly. A maintainer seeing `time ! time X=1 git push` in the wild needs to know this is bash-5 syntax, not a recogniser bug.

### 6. False positive risk from generator gaps
Neither prior review examined: what if the generator **misses a syntax form that produces false positives**? For example:
- `echo 'git push'` → lexer handles quotes correctly, no false positive ✓
- `cat <<'EOF'\ngit push\nEOF` → heredoc body consumed but not examined for acts ✓

But what about something the generator doesn't cover? If the parser **invented** a push in a real command, advisory value degrades. The curated oracle and bash differential mitigate this, but they're **samples, not proofs**. For observe-only this is acceptable (false observation costs attention, not safety), but it's the failure mode **most likely to erode value over time**.

### 7. Rollback criteria omit operational limits
Reviewer B noted: rollback criteria cover correctness and size, but omit:
- Latency added to Bash tool calls
- Ledger growth from high advisory volume
- Sustained `duty_errors` from chunk load failures

These are **operational failure modes** distinct from correctness. For observe-only they're not blockers, but they could make the feature unusable without being "incorrect."

### 8. The contract's "best effort" scope needs a list
The header names what's **not interpreted**: `$(...)`, backticks, subshell `()`, `eval`, aliases, functions, `bash -c`. But it doesn't say what **is** "best effort" beyond the generator grammar. Is `case` a grammar token? Is `select`? A maintainer adding a new wrapper (`nice`, `stdbuf`) needs to know if it's in-scope. The **boundary of the grammar** should be a named, versioned list, not "whatever the generator currently covers."

### 9. The recogniser's output is candidate-per-command, not per-execution-path
The header says "syntactic candidate per simple command," and Reviewer B correctly notes control flow is not evaluated. But the **implication** is subtle: `false && git push || git commit` reports **both** acts. The advisory shows what the command **names**, not what it **runs**. This is correct for observe-only, but a reader must understand: **the ledger is a syntax report, not an audit log**.

## Counterexample Search (Inside Stated Grammar)

I cannot construct a counterexample **from the excerpts provided**. The stated grammar includes:
- Prefixes/wrappers (sudo, command, time, exec, nohup)  
- Quotes, escapes, continuations  
- Redirections at any position  
- Heredocs (all terminator forms)  
- Reserved words  
- Comments

I traced:
- `time >/dev/null ! git push` → correctly doesn't match (redirectAt blocks `!` from being grammar)
- `time -p time ! git push` → correctly matches per bash 5
- `command -v time git push` → correctly returns empty (describes, doesn't run)
- `git <in push >out` → correctly matches after dropping redirections
- Heredoc terminator `EO\⏎F` → continuation removed, matches `EOF` ✓

Without seeing the **full generator** I cannot verify it covers the grammar comprehensively, but the examples shown are correct.

## My Answers to the 9 Questions

1. **Behavior changes**: Exactly as Reviewer A states. Additionally, the `external` variable logic (not shown in this round's diff) affects whether `exec` after `exec`/`nohup`/`sudo`/time(1) is a wrapper or a program name.

2. **Authority/safety boundary**: Observation expands; execution authority unchanged. The boundary at risk is **downstream**: treating a syntactic candidate as proof of execution, compliance, or authorization would exceed this recogniser's contract.

3. **Weakening judges**: The ceiling raise 18,200 → 20,600 → 22,000 loosens the byte gate, but both raises are explicitly logged with "what was added" and "why it could not be avoided." Test cases **added** (8 redirection/grammar, 5 chains), not weakened. No silent degradation.

4. **Other hosts**: Runtime-built commands (`eval`, `$CMD`), aliases, functions, `bash -c`, and other tools remain observation gaps. These are **coverage limits** for an advisory, not bypasses of enforcement (since there's no enforcement).

5. **Reversibility**: Revert commit, rebuild, release. Authority: maintainer per ADR-268 §4. No **tested rollback revision** demonstrated; the diff names commit `213947e4f5` but doesn't show rollback was tested.

6. **Falsification and omissions**: A case inside the generator grammar where recogniser ≠ bash falsifies equivalence. Rollback criteria cover correctness and size but **omit operational limits**: latency per tool call, ledger growth from high advisory volume, sustained `duty_errors` from chunk failures.

7. **Smaller change**: A prefix-only recogniser (smaller) would lose chains (`git push || git commit`). The unified grammar loop (this change) is **smaller than per-case special logic** for each round's findings. Right-sized.

8. **Instruction weight**: The chunk is runtime code, not standing instructions. But reference observations **increase ledger and advisory volume**. No measurement of that recurring reading cost is provided.

9. **Untrusted content**: Shell text controls candidate generation. The static binding table limits which rules can be selected. The observe-only contract limits the immediate effect. Raw commands not stored limits exposure. **Bounded** by the lexer's stated syntax contract.

---

## Skeptical Lens: Weakest Assumption and Overlooked Failure Mode

**Weakest assumption**: The generator's grammar bounds what agents **actually write** in production. The spike analyzed 14,834 real commands: ≤0.1% misses, **17% caught by the full parser** (vs prefix match). That 17% is the whole point of this feature. But:
- Agents using `eval`, `bash -c`, or function-wrapped git are **systematically missed**
- The contract says "best effort," which is correct, but it means **absence of observation ≠ observation of absence**
- For an advisory this is acceptable; for compliance it would not be

**Most likely overlooked failure mode**: **Bash syntax evolution** (bash 6+) or a **generator gap producing false positives**. If the parser invents acts (e.g., reports a push where bash doesn't run one), readers learn to ignore advisories. The curated oracle (155 cases) and bash differential (1,500+ seeds) mitigate this, but they're **samples, not proofs**. A future bash version or a syntax form the generator doesn't cover could degrade value **silently** — the recogniser would keep running, but the advisory would be less trustworthy. Rollback criteria don't cover "advisory value degraded by false positives."

---

## STANCE: confirmed-non-expanding | CONFIDENCE: med | DEALBREAKER: no

**Rationale**: The round-17 fix (unified grammar prefix reading) correctly addresses the round-16 counterexample and generalizes to bash-5 chains. Testing is rigorous **within the stated contract** (curated oracle, bash differential, eight-run reachability). The observe-only nature bounds risk: false observation costs attention, not safety. The byte growth (34% over 17 rounds, two ceiling raises) suggests **complexity under-scoped initially**, but rollback criteria provide safety.

**Why "confirmed-non-expanding" not "ratified"**: The change **does not expand authority** (observe-only advisory). It fixes a specific counterexample correctly. But I cannot independently verify the generator's completeness without seeing it, and the tight ceiling margin (8%) with persistent growth suggests convergence is **assumed, not proven**. For observe-only this is acceptable, hence **no dealbreaker**, but I want to signal the growth trajectory as a concern.

**Why CONFIDENCE: MED not HIGH**: I cannot verify that seeds 120,001-121,500 **comprehensively cover the stated grammar** without seeing the full generator. Bash syntax is unbounded (Turing-complete through functions/aliases), so "eventual scope" is an assumption. The 8% margin may not be enough if more edge cases remain.

**Highest-leverage change before merge**: Add to the recogniser header (`src/scripts/_lib/shell_acts.ts` lines 1-10):

```typescript
/**
 * Correctness is measured against **bash 5.2** on the grammar of
 * `tests/scripts/shell_acts_bash_fuzz.test.ts`; known bash 3.2 differences
 * are recorded in the oracle's `BASH3` map. Equivalence holds for generated
 * cases under the oracle's environment and reachability assumptions (see
 * round-11 commentary on control-flow correlation). Beyond the generator's
 * grammar the result is best effort.
 */
```

This combines Reviewer A's suggestion (name bash version, link to `BASH3`) with Reviewer B's qualification (equivalence is measured, environment-bound, not a general claim). One paragraph that prevents three future confusions: (1) maintainer seeing bash-5 syntax wonders if it's a bug, (2) reader assuming "bash" means all versions, (3) reader assuming equivalence is proven for all possible bash commands.
````

### openai — `ratified`

```text
I agree with Reviewer B’s bounded approval, but not Reviewer A’s high confidence. The supplied evidence supports an advisory recogniser; it does not establish equivalence across an independently specified shell grammar.

**Prior critiques**

- **Agree with B:** the budget increase loosens a gate even though it is disclosed; execution authority stays unchanged while observation expands; omitted integration files limit verification.
- **Agree with A:** the unified prefix loop is simpler than accumulating special cases, and sharing `readQuoted` reduces duplicated parsing logic.
- **Disagree with A:** a 22,000-byte code budget does not bound input length, runtime, or memory consumption. Agent-generated commands can incorporate untrusted content. “No external data touches the parser” is unsupported.
- **Disagree with A:** the rollback criterion requires reverting when retaining pinned cases would exceed the ceiling; it does not permit dropping those cases. The claimed implementer rollback authority is also not established by the supplied ADR reference.
- **Refine B:** sampled differential agreement demonstrates agreement for tested inputs and oracle assumptions. Even supplying the complete generator would not turn those samples into proof for every generated command.

**1. Behaviour changes**

Commands acquire syntactic act candidates that trigger reference observations. The `commandRunsAct` comment explicitly includes unreachable branches and commands following `exec`. Consequently, ledger entries establish that an obligation was observed in command text, not that an act executed.

The round-17 `normalise()` loop fixes the stated redirection/prefix interaction coherently. I cannot establish a new counterexample **inside the actual generator language**, because its complete productions are absent. That is a verification limit, not evidence of completeness.

**2. Authority and safety boundaries**

Execution authority does not expand on the described integration. The observation boundary expands from existing reference duties to command-derived candidates. Downstream consumers must retain that distinction; observe-only collection can still influence later agent decisions.

**3. Changes to the judges**

Yes: `hook-bundle-budget.json` increases the permitted chunk size from 18,200 to 22,000 bytes. Logging makes this transparent, not neutral. The reported current size, 20,247 bytes, fits the intermediate 20,600-byte ceiling, so the latest increase supplies prospective headroom.

The shown tests add coverage without removing assertions. Historical oracle fixture changes cannot be independently assessed from these excerpts.

**4. Other hosts and projections**

The described integration covers Claude Bash events. Other hosts, interpreter strings, aliases, functions, and runtime-built commands remain observation gaps. These are coverage limitations rather than enforcement bypasses.

**5. Reversibility**

An authorised maintainer can revert the feature, rebuild, and release. The rollback should cover the loader, chunk registration, integrity metadata, recogniser, and integration together. Neither a tested rollback revision nor treatment of already-written ledger entries is supplied. The subject commit identifies the reviewed artefact, not a rollback target.

**6. Falsification and omitted criteria**

A reproducible disagreement within the declared grammar falsifies the correctness claim. Excessive false candidates, negligible useful observations, or increased advisory fatigue would separately falsify the practical benefit.

The stated rollback criteria omit sustained load failures, hook latency, ledger growth, and advisory usefulness. These deserve measurements, though their absence alone does not block this advisory feature.

**7. Smaller change and reuse**

A prefix-only recogniser sacrifices the chained-command coverage motivating the feature. The functional lexer and normaliser suit this code; introducing classes would add little.

The larger shipping risk is maintaining a shell subset. The conditional chunk limits routine loading costs but adds packaging and integrity dependencies whose implementations are omitted. No demonstrated existing abstraction makes reuse an actionable finding here.

**8. Standing instruction weight**

Runtime bytes are not standing instructions. Nevertheless, generated reference duties can increase later reading and advisory volume. Reviewer A’s “zero bytes” claim overlooks the resident loader and pre-check; the supplied account explicitly says those remain bundled.

**9. Untrusted steering**

Untrusted text incorporated into commands can create candidates, including unreachable ones. The static binding table bounds selectable rules, and avoiding raw-command storage reduces retained sensitive content. The recogniser itself performs no execution. Path confinement and chunk verification remain unverified because their implementations are absent.

**New refinement:** contract point 4 cannot pre-decide that every future counterexample is merely follow-up work. A defect discovered before merge must still be assessed for frequency, impact, and whether it invalidates the current evidence. Likewise, defining scope through the test generator risks making implementation, scope, and judge move together; semantic changes to that generator need explicit review.

**APPROVE** — the disclosed limitations are proportionate to an advisory signal; the highest-leverage pre-merge change is to state that differential agreement is sampled evidence under explicit oracle assumptions, rather than equivalence throughout the grammar.

STANCE: ratified | CONFIDENCE: med | DEALBREAKER: no
```
