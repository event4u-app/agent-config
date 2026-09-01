# Provider-recognition leakage bench — pre-registered protocol

**Written 2026-08-31 (drain run 11), BEFORE any rater saw any item.** That
ordering is checkable in the git history rather than asserted: at this commit
`collectGuesses` has no live caller, no rater call has been made, and the
corpus assembler this document depends on landed in the same change.

Carrier for the three design forks named in
`road-to-inbox-harvest-2026-08-e-council-topology-evidence.md` blocker
`leakage-bench-needs-assembler-and-design-forks`, todo items 2, 3 and 4.
Todo item 1 (the assembler) is `src/scripts/ai_council/leakage_corpus.ts`.
Todo item 5 (the retention quarantine) is settled in the roadmap's blocker entry.

**This document buys the PROTOCOL, not a result.** No recognition rate is
claimed here, and none exists. A null — recognition indistinguishable from
chance — is a valid published outcome and closes step 3.3.

---

## Fork 2 — Eligibility and balanced sampling

### What is eligible

An item is eligible iff `assembleLeakageCorpus`
(`src/scripts/ai_council/leakage_corpus.ts`) returns it. That is the definition,
not a description of one: the loader is the eligibility rule, so eligibility
cannot drift from what is measured.

Concretely a response entry is kept when it has a non-empty `provider`, a
non-empty `text`, and a falsy `error`, inside a parseable JSON record carrying a
`responses[]` array under `agents/runtime/council/responses/`. Every drop is
reported with a machine-readable `ExclusionReason` rather than silently skipped.

**The synthetic fixture is REFUSED, not excluded.** `smoke-items.json` — and any
record carrying a truthy `synthetic` key under any name, and any `responsesDir`
whose path contains `council-provider-leakage` — makes the assembler **throw**
`SyntheticCorpusRefusal`. The fixture's own text states *"A live runner must
refuse this file"*, and a refusal is a throw; exclude-and-continue would let a
live run proceed over a corpus that had quietly lost its subject. Sensitivity
proven, not asserted: neutralising the synthetic-key refusal turns
`tests/scripts/ai_council/leakage_corpus.test.ts` **2 failed / 22 passed**, and a
byte-identical restore (sha256 `874ff5f4…13a7` before and after) returns
**24/24**. The basename refusal is proven the same way at **1 failed / 23
passed**.

### The census, measured rather than carried forward

Read on the maintainer machine at this commit, recursively over
`agents/runtime/council/responses/`:

| Figure | Value |
|---|---|
| eligible items | **1,402** |
| by family | anthropic **699** · openai **703** |
| files scanned / excluded | 715 / 83 |
| response entries seen | 1,439 |
| exclusions by reason | `not-json-file` 83 · `response-carried-error` 37 |
| families actually present | `['anthropic', 'openai']` |
| items within the declared 7-day TTL | **0** |

**Three corrections to figures the roadmap carries.** Stated because each one
changes a decision, not for tidiness.

1. **The roadmap's `716` is superseded, and not because the roadmap was wrong
   when written.** `responses/` is not flat: alongside `.json` records it holds
   `.md` convergence notes, extensionless directories, and directories literally
   *named* `<slug>.json` (e.g. `0B6-decision.json/debate-round-1.json`) holding
   per-round records with real provider bodies. A single-level walk drops those.
   The assembler walks recursively with sorted relative paths, which is why it
   reports 1,402. The extra bodies are debate rounds, not duplicates — ids are
   unique by construction and verified so in the test file.
2. **`gemini 2` counted failed calls.** Both gemini entries in the tree carry a
   non-falsy `error`, so they are excluded as `response-carried-error` and
   `families` reads `['anthropic', 'openai']`. **The consequence is not
   cosmetic: it sets the chance baseline.** With two families, uniform chance is
   **0.50**, not `1/3`.
3. **A basename-derived item id would have leaked the ground truth.**
   `responses/` contains `anthropic-design-skills-integration.json`,
   `claude-code-distribution.json`, and others whose names carry the answer. The
   id is therefore an opaque `item-<sha1(relative path)[0:12]>-<index>`;
   the filename lives on `CorpusItem.source_file`, which the scorer reads and
   the rater never sees. A test asserts no id contains any of seven provider
   tokens.

### How the draw is balanced

The `>= 30` floor is read **per arm**, which is the stricter reading and is not
weakened anywhere below. Under fork 3's two-arm verdict that means **60 distinct
bodies**: 30 assigned to the RAW arm and 30 to the PATTERN-STRIPPED arm.

Each arm is drawn **stratified at 15 anthropic / 15 openai**, deterministically:
sort eligible items by id, then take the first 15 of each family per arm under a
recorded seed. Determinism is a property of the assembler (sorted walk, sorted
ids) and is asserted by a test that two calls return deeply equal results.

**Why exact balance is the point and not neatness.** `scoreRecognition`
publishes two baselines — uniform `1/k` and `chance_majority`, the largest share
any single family holds among graded items. At exactly 15/15 those two
**coincide at 0.50**, so a rater that always answers the majority family gets no
free lift over uniform chance and the stricter-of-two baseline the p-value uses
is unambiguous. An unbalanced corpus is what lets a constant guesser score
above chance while recognising nothing, and that failure is already pinned in
the roadmap.

### The detection floor, computed and stated up front

Exact one-sided binomial against `p0 = 0.50`:

| Unit | n | Correct needed for p < 0.05 | p at that k | Power at true rate 0.70 | at 0.80 |
|---|---|---|---|---|---|
| one rater, one arm | 30 | **20** (66.7 %) | 0.0494 | 0.730 | 0.974 |
| both raters pooled, one arm | 60 | **37** (61.7 %) | 0.0462 | 0.937 | 1.000 |

**Pre-registered reading:** the per-arm inferential unit is the **pooled n = 60**
(both raters, one arm). The per-rater n = 30 figures are reported alongside as
descriptive, and a per-rater result is explicitly NOT promoted to a finding on
its own — at n = 30 the power against a true rate of 0.70 is 0.730, so a real
effect of that size is missed better than a quarter of the time.

**A limit this design does not overcome:** two families is a weak instrument.
Chance is 50 %, so nothing below ~62 % pooled recognition is distinguishable
from guessing, and the bench cannot detect a small-but-real house-style signal.
That is a property of the configured council having two seats, not of the
sampling. *Revisit-if:* a third provider family accumulates eligible
(error-free) bodies, at which point chance falls and the floor with it.

---

## Fork 3 — Anonymisation protocol

**SETTLED BY AI COUNCIL 2026-08-31 — Option (C), TWO ARMS, 2/2 CONVERGENT.**
Members: anthropic/claude-sonnet-4-5 + openai/codex-default, 2 rounds, blind
chairman. Question:
`agents/runtime/council/questions/q-leakage-anonymisation-protocol.md`.
Response: `agents/runtime/council/responses/r-leakage-anonymisation-protocol.md`
(gitignored and auto-pruned by declaration — the verdict is reproduced here
because the artefact is not durable).

### The fork, and why it was a real one

The live council path strips the **label** and nothing else.
`src/scripts/ai_council/consensus.ts:507-528` (`anonymize_responses`), reached
via `src/scripts/ai_council/blind_review.ts:76`, assigns a positional
`Response-A` / `Response-B` label and maps it to `text.trim()`. **No
transformation is applied to the body.** A body that names its own provider
reaches a blind reviewer today exactly as written.

So "anonymized" in step 3.3 had two defensible readings that measure different
things: fidelity to what a reviewer actually receives (RAW), versus isolation of
the house-style signal that step 3.4's style normalization would target
(STRIPPED).

### The verdict

Run **every selected body in exactly one arm**, and publish both arms:

- **RAW** — no transformation beyond the live path's `trim()`. Measures what the
  deployed blind-review path actually exposes.
- **PATTERN-STRIPPED** — a deterministic, pre-registered pattern list removes
  provider names, vendor names, model ids and first-person self-identification.
  Measures the narrower, normalization-relevant signal.

Both seats reached (C) independently and converged on the reasoning: neither
single arm supports both claims the roadmap needs. Quoting the openai seat —
*"A cannot distinguish explicit labels from style; B cannot characterize the
deployed path."*

### The seven conditions the verdict carries

Every one is binding on the run, and none is optional:

1. **Pre-register and version-pin the patterns and replacement semantics.** The
   pattern list is itself a floor once written; it may not be edited after an
   arm has run.
2. **Retain an auditable span-level transformation log** — what was removed,
   where, per item.
3. **Same corpus for both arms**, with separately randomized arm presentation.
4. **No rater may see both versions of an item.** Satisfied here **by
   construction**, not by procedure: each selected body appears in exactly one
   arm, so a second version of it does not exist in the run.
5. **Report both arms and both baselines independently** — no pooling across
   arms.
6. **The second arm is labelled `pattern-stripped`, NEVER `identifier-free`.**
   Regexes miss identifiers.
7. **It doubles the rater calls and the UTC-day schedule.** Priced in fork 4.

### The claim limit both seats insisted on

**The RAW − STRIPPED delta estimates the effect of the registered
transformations. It does NOT measure "label leakage alone".** The openai seat's
refinement, and the anthropic seat concurred: the patterns *"may miss
identifiers or remove stylistic material"*, so the delta is an effect of *this
pattern list*, not of labelling in general. Any published delta must carry that
qualifier in the claim itself.

Both seats also refused a weaker premise the question had offered: the evidence
in the tree proves that labels **can pass through**, not their **prevalence**.
So the RAW arm is not a foregone conclusion and is not to be presented as one.

### The pattern list — REGISTERED 2026-08-31 (drain run 12)

**Condition 1 is discharged, and so is condition 2.** The list is
`src/scripts/ai_council/leakage_patterns.ts`, version
`leakage-patterns-v1-2026-08-31`, 15 rules, digest
`10045caaec23a1bd7053a629f9e8043cb6a3066b44e349ceba6890b058976da6`.
Tests: `tests/scripts/ai_council/leakage_patterns.test.ts`, 28 green.

**Why it lands as its own change, which is what the deferral asked for.** The
previous entry here refused to write the list in the change that settled the
protocol, because that would have put an unreviewed floor into the
pre-registration under cover of the verdict. This is the separate change. It
carries its own rationale per rule, its own admission rules, and its own
sabotage evidence, none of which borrows authority from the Fork 3 verdict.

**Replacement semantics, which condition 1 asks for by name.** One placeholder
per category and the SAME placeholder whatever family matched —
`[REDACTED-PROVIDER]`, `[REDACTED-VENDOR]`, `[REDACTED-MODEL]`,
`[REDACTED-SELF-ID]`. Family invariance is asserted, not asserted-about: two
tests check that two families with the same category produce byte-identical
output and that no placeholder contains a vendor, product or model token.

**Two admission rules govern what is in the list, and the second is the one
that keeps the arm interpretable.**
1. A token whose only role is to name a vendor or a model is admitted bare —
   `anthropic`, `openai`, `claude`, `chatgpt`, `codex`.
2. A token that is also ordinary English is admitted ONLY inside an identifying
   frame. `meta`, `grok`, `bard`, `gemini` and `mistral` are each excluded bare
   and deliberately so: stripping them unconditionally would delete ordinary
   sentences, the deletions would not be family-uniform, and the arm would then
   measure the regex rather than the style. Seven denial tests pin this — *"A
   meta comment about the metadata table"*, *"The mistral wind"*, *"I did not
   grok the migration plan"* and four more must come back byte-unchanged with an
   empty span log.

**Order is part of the pinned artefact.** Overlap resolves first-claim-wins in
declaration order, so the order decides both what is removed and which category
the log attributes it to. Three tiers: self-identification frames, then model
ids, then bare vendor and product tokens. Declared the other way round,
`product-claude` would claim `Claude` out of *"I am Claude"* and the log would
record a `provider-name` removal where a self-identification was removed. Tests
assert the tier boundaries by `patternId`, not by output text — two orderings
can produce the same string and disagree about what the log says.

**Condition 2, the span-level transformation log.** `applyLeakagePatterns`
returns `{ text, spans, patternListVersion }` where each span carries
`patternId`, `category`, `start`, `end`, `matched` and `replacement`, with
offsets indexing the ORIGINAL text — so `original.slice(start, end) ===
matched`, and a test asserts exactly that, because that is the property that
makes a log auditable without its writer. `makeRecordingAnonymiser` adapts this
to the assembler's `(text: string) => string` seam, and `attachLogIds` THROWS
rather than mis-attributing when the log length disagrees with the item count.

**Sensitivity proven in five arms, four red and one not — the one that did not
is recorded rather than dropped.**

| arm | mechanism neutralised | result |
|---|---|---|
| A | first-claim-wins overlap guard forced to `false` | **3 failed / 25 passed** |
| B | per-call regex recompile replaced by a module cache | **28 passed — NOT RED** |
| C | greedy `[\w.-]*` restored on the gemini model-id rule | **2 failed / 26 passed** |
| D | one rationale edited without bumping the digest | **1 failed / 27 passed** |
| E | `ARM_LABEL` set to `identifier-free` | **3 failed / 25 passed** |

Every restore was byte-identical, sha256
`accd1a880799d23e97334df9022b79183329a0fab38fc42f3cf416963bc37339` before and
after, returning 28/28.

**Arm B is a real gap and is named in the code.** Hoisting the regex into a
module-level cache changes nothing observable today, because the `exec` loop
always runs to `null` and resets `lastIndex` on the way out. The per-call
recompile is defensive against a future early exit from that loop and is
**unproven**, not proven. The test that looked like its guard has been renamed
to say what it actually pins.

**A residue this design cannot remove, and it bounds the arm's claim.**
Replacement is family-invariant in TEXT and cannot be made family-invariant in
COUNT or POSITION. A family that self-identifies four times and one that never
does are distinguishable by `[REDACTED-…]` density alone — a signal the
stripping CREATES rather than removes. Equalising marker counts across families
would be a second transformation with its own distortion, so it is not done.
This sits beside the claim limit both seats insisted on: the RAW − STRIPPED
delta estimates the effect of THESE registered transformations, never label
leakage in general.

**Freeze status.** Condition 1 makes the list a floor ONCE AN ARM HAS RUN. No
arm has run at this commit — `collectGuesses` and `scoreRecognition` still have
zero production callers — so the list is pinned-and-amendable today and frozen
at the first rater call. `PATTERN_LIST_DIGEST` makes that transition observable
either way: any edit, before or after, reds a test rather than passing quietly.

**What this does NOT do: it does not run the stripped arm.** The reason the
stripped arm could not run was this list's absence, and that reason is gone. The
run itself remains open and is unchanged by this entry.

---

## Fork 4 — Rater budget and the UTC-day schedule

**Raters:** the two configured council seats, anthropic and openai. Each
rater × item is one paid call to that rater's provider.

**Volume, under fork 3's two-arm verdict and fork 2's per-arm floor:**

| Quantity | Value |
|---|---|
| distinct bodies | 60 (30 RAW + 30 PATTERN-STRIPPED) |
| raters | 2 |
| rater × item pairs | 120 |
| calls per provider | **60** |
| per-provider daily cap | 50 (`CALLS_PER_PROVIDER_PER_UTC_DAY`, mirroring `cli_call_budget.ts:60`) |
| **UTC days required** | **2** |

**The schedule, stated up front as the blocker requires** — *"Either it fits one
UTC day or the multi-day schedule is stated up front"*:

- **Day 1** — 30 calls per provider: the RAW arm, all 30 bodies × 2 raters.
- **Day 2** — 30 calls per provider: the PATTERN-STRIPPED arm, all 30 bodies × 2
  raters. **Gated on the fork-3 pattern list existing and being version-pinned.**

Arm is therefore confounded with day. Named rather than hidden: a per-day
provider-side change (a model update, a load-dependent behaviour) would appear
as an arm effect. The mitigation available at this budget is to report the day
alongside each arm so the confound is visible in the result table; removing it
would need both arms inside one UTC day, which at 60 calls per provider the cap
forbids.

**One UTC day is reachable and was rejected.** A crossover — 30 bodies, each
rater seeing 15 RAW and 15 STRIPPED, 30 calls per provider — fits one day and
removes the day-confound. It was rejected on two grounds: it pools the `>= 30`
floor across arms instead of meeting it per arm, and it makes the arm delta a
between-rater comparison, confounding rater with arm for exactly the quantity
condition 5 says must be reported independently. Trading a named day-confound
for an unnamed rater-confound plus a weakened floor is not an improvement.
*Revisit-if:* a third seat is configured, or the daily cap changes.

~~**Day 1 is runnable now. Day 2 is not**, and the reason is fork 3's condition 1
rather than quota.~~

**AMENDED 2026-08-31 (drain run 12): day 2's stated blocker is GONE.** Fork 3's
condition 1 is discharged above — the pattern list exists and is version-pinned
— so both arms are now blocked only on quota and on a runner-side caller, and
neither arm is blocked on a design decision. Nothing about the volume, the
schedule or the day-confound changes.
