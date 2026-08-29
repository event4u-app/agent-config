---
complexity: structural
status: ready
execution:
  mode: phase-checkpoints
research_pin: "agent-config @ f16c7d9df2e1a4a6f480e734be6ed3a0138fc14d · @event4u/agent-config 14.10.0 · citations re-verified against the landing HEAD 2026-08-24"
estate_offset_exempt: "The one-in-one-out half of the estate ratchet fires on every added agents/roadmaps/road-to-*.md regardless of status, but the only roadmaps this drain run archived carried status: draft and were therefore never counted by the ratchet in the first place, so none of them can serve as this file's offset."
---

# Road to an evidence-routed council rung

> **Source:** `agents/tmp.old/nxt-council/road-to-evidence-routed-council-master.md`

## Goal

Turn the shipped AI council into an **evidence-routed** decision layer: it
spends only where another reasoning stage measurably improves the decision,
uses the smallest sufficient deliberation topology, and can explain and
attribute every paid call — **without adding a second task-side router beside
the existing judgment ladder**.

Two governing constraints, and the second is the one that shapes the whole
plan:

> Use the smallest reasoning topology that measurably improves the decision.

> There remains **one** task-to-orchestration resolver. Council topology is a
> refinement of the already-selected council rung, never a parallel router.

## Context

### The architectural rejection this roadmap exists to carry

The inbox carried three rival drafts of this workstream. Two dissolve into this
one; what survives from the adjudication is a single **rejection**, and it is
the most load-bearing sentence in the file.

One rival draft proposed a standalone `CouncilTopologyRouter` as a new
task-side resolver. That would have landed an architecture violation.
`src/scripts/_lib/judgment_ladder.ts:1-3` declares itself *"the ONE resolver
that decides which of the five dispatch rungs (0-4), or the silent ∅, a task
resolves to"*, and `:16-20` closes the same docstring with the explicit
warning that three previously-scattered classification surfaces get **one**
resolver here, *"never a fourth parallel classifier bolted on beside it"*.

So the correct shape is: the judgment ladder decides **whether council is the
right orchestration class**; `src/scripts/ai_council/necessity.ts` remains the
council-internal necessity gate; and everything this roadmap adds hangs off the
council rung *after* the ladder has already resolved to it.

```text
request / task
   │
   ▼
judgment ladder — the ONE task-side resolver
   ├── deterministic / script
   ├── bounded ask
   ├── subagent
   ├── team
   ├── council  ──►  necessity gate ──►  council-rung topology refinement
   └── user / in-session boundary          ├── single_external
                                           ├── dual_independent
                                           ├── advisor_diversity
                                           ├── peer_review
                                           ├── judge_synthesis
                                           ├── targeted_cross_exam
                                           └── full_debate
```

`team` and `user_required` deliberately do **not** appear in the topology
vocabulary: the ladder and the Hard Floor already own those classes.

### Anonymized provenance

Per [`source-confidentiality`](../../src/rules/source-confidentiality.md), the
external references that seeded parts of this analysis are named
**source-anonymously**; real links are retained as `ENC1:` tokens for
maintainer recovery only.

| Ref | What it contributed | Link |
|---|---|---|
| **Source A** | Three-stage method shape: independent generation → blind peer evaluation → synthesis. Method inspiration; no incorporated code. | `ENC1:` (pending maintainer encryption) |
| **Source B** | Thinking-lens framing that informed the shipped advisor personas. | `ENC1:` (pending maintainer encryption) |
| **Source C** | CLI-first / fallback packaging ergonomics. | `ENC1:` (pending maintainer encryption) |

Two of the three reportedly ship **no LICENSE file**, which is unverifiable
offline and is why `blocker: unlicensed-source-verbatim-scan` gates P0. No
license means no grant — so this is **not** the license-required-attribution
carve-out, and the source names stay anonymized in this roadmap even though
`CREDITS.md` is itself a denylist carve-out path.

### Deferrals held elsewhere, on purpose

- **Trigger-phrase taxonomy** — owned by the routing-assurance line
  (`agents/roadmaps/stubs/road-to-assurance-benchmark.md`); not re-opened here.
- **HTML verdict surface / verdict UX** — owned by
  `agents/roadmaps/stubs/road-to-council-visibility.md`; not smuggled in here.
- **Advisor seating** — owned by
  `agents/roadmaps/stubs/road-to-council-persona-fanout.md`, which already
  carries a pre-registered bench gate. Phase 9 points at it and adds nothing
  parallel.

---

## Prevented items — verified already-shipped

Each row was proposed by one of the three source drafts and is **deleted**, not
deferred: the mechanism already exists in the tree. A phase that rebuilt any of
these would be additive reimplementation of mature code, which the adjudication
called a larger risk than feature absence.

| Proposed | Already shipped at | Disposition |
|---|---|---|
| Blind / anonymised peer-review machinery | `src/scripts/ai_council/blind_review.ts`; delivered by `agents/roadmaps/archive/road-to-council-blind-review.md` | Deleted — exists |
| Dissent quota, novelty gate, anti-conformity directive | `ai_council/debate_gates.ts:15,18,32,51,61,81`; directive text `ai_council/prompts.ts:180`; default-off at `ai_council/config.ts:1113` | Deleted — exists (default-off is a config decision, not a gap) |
| Multi-round debate | `ai_council/orchestrator.ts:389-393`; steel-man pass `:1036-1040` | Deleted — exists |
| Finding-level consensus + minority retention | `ai_council/consensus.ts:22-23,43-44,157,235,267`; `ai_council/stance_tally.ts` | Deleted — exists |
| Decision replay | `ai_council/replay.ts:1-14,210`, wired at `src/scripts/council_cli.ts:1270,1280` | Deleted — exists |
| Low-impact fast path **and** its governing rule | `ai_council/low_impact.ts:1-20` + [`fast-path-marker-visibility`](../../src/rules/fast-path-marker-visibility.md) | Deleted — exists on both layers |
| Five thinking-style advisor personas | `src/agent-src/personas/advisors/{contrarian,executor,expansionist,first-principles,outsider}.md`; engine `ai_council/advisors.ts:1-32` | Deleted — exists (seating is the real gap, see P9) |
| Necessity classifier, CLI transport, model-size downgrade | `ai_council/necessity.ts`; delivered by `agents/roadmaps/archive/step-1-ai-council-cli-transport.md` | Deleted — exists |
| Quota / API-fallback / attendance integrity | `archive/road-to-council-api-fallback.md`, `archive/road-to-council-quota-accounting-truth.md`, `archive/road-to-inbox-harvest-2026-08-b-council-integrity.md` | Deleted — three archived roadmaps delivered it |
| **Quota-source split** | `agents/roadmaps/later/road-to-council-api-quota-source-split.md` — parked with a recorded AI-council verdict, 2 of 2 seats, 2026-08-19 | **Deleted — do not re-propose.** Re-proposing it would override a live decision; its resume trigger is the evidence file that record names |

---

## Corrections applied at landing (2026-08-24)

| # | Source claim | Correction | Basis |
|---|---|---|---|
| 1 | "Blind review is default-on" | Blind **chairman synthesis** is default-on; blind **peer review** is **opt-in**. The two were conflated in the originating transcript. | `council_cli.ts:3557` sets `blind_chairman: true`; `_peer_review_active` at `council_cli.ts:1288-1294` requires an explicit flag or `peer_review.enabled` |
| 2 | Parallel first-round fan-out is unbuilt work | It is a **deliberately reversed decision**. Phase 4 is therefore framed as *reopening a closed decision* under [`decision-revisit-gate`](../../src/rules/decision-revisit-gate.md), and must address the interactive-overrun prompt the reversal bought and the byte-pinned dispatch-order tests. | `ai_council/orchestrator.ts:8-12` records that *"the previous parallel ThreadPoolExecutor was traded for predictable mid-flow user prompts"*; `grep -c 'Promise.all'` over that file returns **0**; the historical contract is pinned byte-for-byte by tests (`:3-6`) |
| 3 | Round-count bias bench carried no citation | Grafted the research citation the round-count phase rests on: **arXiv 2505.19477** (round-1 debate bias amplification). It appeared in a dissolving sibling draft and **0** times in the master, leaving Phase 2.7 an unsourced measurement request. | Sibling draft in the same inbox directory |
| 4 | `council_cli.ts:3555` | → `council_cli.ts:3557` (+2) | Read at landing HEAD |
| 5 | `prompts.ts:204` | → `prompts.ts:206` (+2) | Read at landing HEAD |
| 6 | `judgment_ladder.ts:15-19` for the no-parallel-classifier warning | → `:16-20`; the sentence ends one line later than the source cited | Read at landing HEAD |
| 7 | P0 provenance framed as new work | Marked **EXTEND**, not create: `CREDITS.md` (69 lines) and `provenance/harvests.jsonl` (**5** rows) both already exist | Read at landing HEAD |
| 8 | Ten proposals framed as roadmap features | Moved to § Prevented items with a citation each | See that table |

---

## Phase 0 — Provenance and the one-resolver lock

- [ ] 0.1 Pin current council behaviour in
  `agents/evidence/analysis/council-intelligence-baseline.md`: ladder council
  rung, necessity gate, advisor wiring, round resolution, blind-review
  ordering, consensus semantics, anti-conformity and novelty gates, spend /
  overrun / daily gates, replay schema, low-impact path, current synthesis
  policy.
      verify: every behavioural claim in the file carries a `file:line` or an
      executable probe; a reviewer can refute any single line without reading
      the code twice
- [ ] 0.2 Inventory every council-related rule, command, script and config
  surface, classified as task-side routing / council-internal necessity /
  topology-depth / rendering / spend governance / replay-evidence /
  compatibility / dead-duplicate.
      verify: no council-routing surface is left uncategorized, and the
      dead-duplicate column is either empty or each entry names its successor
- [ ] 0.3 **EXTEND** `CREDITS.md` and `provenance/harvests.jsonl` (5 rows
  today) with the method lineage as **Source A / B / C** — method inspiration,
  not incorporated code. Real links land as `ENC1:` tokens only.
      verify: `./scripts-run src/scripts/lint_harvest_provenance` green, and
      `./scripts-run src/scripts/check_no_external_sources` reports zero
      denylisted tokens across the tracked diff
- [ ] 0.4 Run the unlicensed-source verbatim scan: phrase-diff the advisor
  persona files and the peer-review / synthesis prompts against the source
  texts. Rewrite anything substantively verbatim.
      verify: the evidence file records the scan result **and** the commits
      read; blocked on `blocker: unlicensed-source-verbatim-scan`
- [x] 0.5 Lock the one-resolver invariant in documentation **and** in a test:
  `judgment_ladder.ts` stays the one task-side resolver, no
  `CouncilTopologyRouter` beside it, topology refinement begins only after the
  ladder resolves to `council`, `necessity.ts` keeps its council-internal role.
      verify: a deliberately-added second task-side council router makes the
      new architecture test fail; sabotage the guard, watch it go red, restore

      **Closed 2026-08-29, after three review rounds killed three
      implementations.** The invariant was documented and enforced by nothing:
      `judgment_ladder.ts`'s docstring states all three clauses — one resolver,
      "never a fourth parallel classifier bolted on beside it", and
      "deliberately independent of `ai_council/necessity.ts`" — and a docstring
      cannot fail. A second task-side council router could have landed beside
      the ladder with every gate in this tree green.

      Landed: `src/scripts/_lib/one_resolver_invariant.ts` and
      `tests/scripts/one_resolver_invariant.test.ts` — **76 tests, all green**;
      `tsc --noEmit` and `eslint` clean.

      **It parses. It does not lex, and that is the whole finding.** Three
      fresh-subagent R2 rounds — each dispatched at a deterministically
      generated package, none of them authored by the implementing session —
      killed three successive text-scanning implementations, and each defect
      was introduced by the repair for the last:

      | Round | Approach | What the reviewer measured |
      |---|---|---|
      | 1 | no comment/string handling | false POSITIVE: a router name in a comment or a string counted as a declaration |
      | 2 | ordered regexes, block comments stripped first | false NEGATIVE: a `//` comment containing a glob opened a spurious block comment. **12 files under `src/` lost top-level exports** |
      | 3 | hand-written single-pass character scanner | false NEGATIVE, **worse**: a backtick inside a *regex literal* read as a template opener, and templates do not end at a newline. **54 files, 231 exports lost**, plus a reachable false positive |

      Round 3's trigger was ordinary, not exotic: `check_portability.ts:741`
      contains a regex with a backtick in it. Round 1's headline was sharper
      still — the test advertised as "guards the guard" never called the scanner
      at all, so one walking **zero files** passed it, which is precisely the
      failure it claimed to exclude.

      **The N=3 budget fired and the decision went to the AI council, which
      SPLIT.** One seat argued for withdrawing the guard and enforcing the
      invariant by review; one for parsing with the TypeScript compiler API.
      Both refused another hand-lexing round, and — decisively — **both
      classified withdrawal and narrowing as owner-reserved**, since each
      changes what "done" guarantees. Parsing was therefore the only option
      either seat permits a council to execute, and it is what landed. The
      withdrawal option is recorded here as a live owner decision, not as a road
      not taken.

      Both seats asked the same two principles be recorded:

      > A gate must not implement a partial lexer or parser for a language when
      > an authoritative parser for it is already a dependency.

      > A repair is tested against the violated PROPERTY and representative
      > mutations, never against the reproducer's literal spelling.

      The second explains the pattern the reviewers kept finding underneath the
      lexing bugs. The clearest instance: the resolver check tested for the
      identifier `classifyLadder`, so round 2's reproducer
      `export const NOTE = "moved"` was caught while
      `export const classifyLadder = "moved"` — the same stub keeping the name —
      scanned green. It now tests the declaration KIND, so a resolver must be
      callable rather than merely named.

      **The frozen claim, stated so nobody reads the guard as wider.** It
      asserts syntactically that no module outside the sanctioned resolver
      exports a binding whose NAME matches a router pattern, in any export form
      the parser recognises; that the resolver itself exports a callable one;
      and that the resolver names no council-internal module in any import,
      re-export, dynamic-import or `require` specifier. It asserts **nothing**
      requiring symbol resolution or a module graph — a router exported under an
      unrelated name is outside the claim, and two tests pin that limit so it
      cannot be quietly read as coverage.

      **Sensitivity and polarity, both established rather than assumed.** Four
      sensitivity arms add a defect and observe the guard go red, each asserting
      the baseline clean **and non-empty** first: a second router beside the
      ladder, a function-shaped one, an `ai_council` import in the resolver, and
      the resolver deleted. Five denial arms must stay green — a file that
      merely mentions the council, a council-INTERNAL module even when it
      literally declares `CouncilTopologyRouter`, a `.test.ts` naming one, a
      router name inside a comment or a string, and an `ai_council` import in a
      non-resolver file. Every reproducer from all three killed rounds is
      retained as a permanent regression, because their absence is exactly what
      let each round's repair look complete.

      **Anti-vacuity is asserted on the scanner's own report**, which was round
      1's correction: `checkOneResolver` returns `{ violations, scanned }`, the
      real-tree test asserts `scanned` exceeds 100 files and contains
      `judgment_ladder.ts` by path, and an empty directory is driven to pin the
      pair a vacuous scan produces.

      **ROUND 4 — 4 findings, and the fourth round is the one that did not find
      a new failure class.** The reviewer's verdict on the model: *"yes, for the
      frozen claim as written. None of the four findings requires symbol
      resolution or module-graph analysis."* Under the council's stopping rule
      that makes them repairable rather than an owner exit, and all four are
      repaired.

      The high one is the mirror of every previous round and worth the space:
      `exportsRouterFunction` recognised a router only when declared **inline**,
      so five behaviour-preserving spellings of the *genuine* resolver were
      reported as `resolver-is-not-a-resolver` — `export { classifyLadder }`
      after a function declaration, `export default classifyLadder`, an
      `as`-cast arrow, a `satisfies`-annotated arrow, and an aliased local
      export. It was **internally inconsistent**: `declaresRouter` accepted the
      identical syntax, so one spelling counted as "declares a router" for every
      other file and as "is not a resolver" for this one, and the emitted
      diagnostic asserted the resolver had "gone somewhere this guard does not
      look" while the function sat two lines above. A false POSITIVE, so it
      opened no hole — but a gate that reds on a legitimate refactor is a gate
      that gets bypassed, which is the risk the reviewer named and it is not
      cosmetic. Now resolved through local declarations, with the re-export and
      stub refusals from round 3 preserved.

      The other three: `.tsx`, `.mts` and `.cts` were never read, so a second
      resolver in any of the tree's **28 live `.tsx` files** scanned green —
      and the gap was *masked*, because `src/ui/` contributes `.ts` paths to
      `scanned` and the directory therefore looked covered. That is the third
      time in four rounds a blind spot hid behind a non-empty `scanned`, which
      is the honest limit of that discriminator. A namespace's own name was read
      and its body was not, so a router inside `export namespace Dispatch { … }`
      was invisible while the enclosing form was caught — worse than omitting
      the kind, because the visitor listed it. And two claims in this record
      were wider than the artefact.

      **Both of those claims are corrected here rather than softened.** "Every
      reproducer from all three killed rounds is retained" is now true: round
      3's two false-POSITIVE reproducers had no pin and now do. And the limits
      below are stated at the claim level rather than in a helper's docstring,
      which the stopping rule declares insufficient.

      **What this step does NOT close, stated at the claim level:**

      - **The third clause of 0.5** — "topology refinement begins only after the
        ladder resolves to `council`" — is a sequencing property of code that
        does not exist, since no topology refiner is built. Any check for it
        today would pass vacuously. Left to the phase that builds one.
      - **The guard is name-pattern based.** A second resolver exported under a
        name outside `ROUTER_NAMES` is undetectable by construction. Closing
        that needs symbol resolution and a module graph, which is a separate
        decision and not this step's.
      - **A specifier built by interpolation is not resolved.** Both limits are
        pinned by tests, so neither can be quietly read as coverage.
      - **Withdrawing the guard entirely** remains a live OWNER decision. One
        council seat argued for it — enforce by review, automate nothing — on
        the ground that four rounds of escalating false-negative damage from
        ordinary valid syntax is evidence about the cost of the automation. That
        seat's own verdict classed withdrawal as owner-reserved, which is why it
        was not executed, and it is recorded here rather than dropped because
        the argument does not expire with the defects that prompted it.


## Phase 1 — Stop paying for information the tree already has

Deliberately before any sophisticated routing: the cheapest quality improvement
is not paying twice for the same deliberation.

### 1A — Re-council guard

- [ ] 1A.1 Detect exact repeats on `council:run` by reusing the **existing**
  question hash — no second hash implementation.
      verify: a re-run of a retained question is detected; a one-token edit is
      not detected as exact
- [ ] 1A.2 Warn, never prohibit: prior run date, prior artifact path, the fact
  that the question appears already deliberated, and a path to re-run after
  explicit confirmation.
      verify: confirmation still re-runs; no code path can turn the warning
      into an unconditional block
- [ ] 1A.3 Near-duplicate detection on the already-imported similarity
  mechanism — no embedding infrastructure. Pre-register the threshold before
  tuning it on the retained local corpus.
      verify: the warning prints the similarity score, and the threshold in
      the code equals the pre-registered one
- [ ] 1A.4 Distinguish three states in the warning: exact question + same
  relevant configuration; exact question + stale model/config evidence; near
  duplicate.
      verify: a fixture per state renders the matching state and no other

### 1B — Inline findings, analysis lens only

- [ ] 1B.1 Require the existing findings schema as a fenced trailing block in
  the initial analysis response, replacing the second extraction call.
      verify: a real analysis run parses inline with no second call; blocked by
      `blocker: evidence-integrity-unparsed-dependency`
- [ ] 1B.2 Keep the repair path: absent or invalid inline block falls back to
  the existing extraction call at `prompts.ts:206`.
      verify: a corrupted inline block still yields findings, and the
      worst-case call count is no worse than today's
- [ ] 1B.3 Scope to the analysis lens only — do not force structured tails
  into every lens without a named second consumer.
      verify: other lenses' prompts are byte-unchanged
- [ ] 1B.4 Promotion gate across ≥ 10 real analysis runs: ≥ 70 % inline parse
  rate, no `unparsed` regression, no substantive finding-quality regression.
      verify: gate met, or the null result is recorded and the change reverts
      to extraction-always

## Phase 2 — Build the benchmark before automating topology

The council should not ship a topology selector before it can define "better".

- [ ] 2.1 Pre-register benchmark families: architecture trade-offs, roadmap
  critique, ADR reopening, requirements completeness, code review with seeded
  defects, security review with seeded true/false findings, debugging with an
  executable oracle, incident diagnosis, probe-resolvable factual controls,
  direct-generation controls where debate is expected to **hurt**, adversarial
  misconception cases, ambiguous product decisions with a human rubric.
      verify: the family list and per-family success criteria are committed
      before any arm runs
- [ ] 2.2 Mandatory baselines per eligible slice: host solo, strongest
  configured single external model, cheapest configured single external model,
  current default council path, full debate where applicable.
      verify: no result claims "council improves quality" without a strong
      single-model baseline in the same table
- [ ] 2.3 Emit the full metric set: deterministic correctness where possible,
  executable test result where possible, rubric quality, cost, latency, calls,
  tokens, parse/gradeability rate, rerun variance, disagreement entropy,
  minority rescue, majority corruption, synthesis delta,
  zero-marginal-value-call rate.
      verify: one run produces every column, or the missing column is recorded
      as a declared gap rather than silently absent
- [ ] 2.4 Stage ablation: generation only; + ranking; + peer critique;
  + synthesis; full pipeline.
      verify: an improvement can be attributed to a named stage
- [ ] 2.5 Separate model quality from topology quality — same topology across
  model sets, and same model set across topologies.
      verify: both axes appear in the result table
- [ ] 2.6 No promotion from N=1: confidence intervals or explicit variance
  bands.
      verify: every promotion claim carries a trial count and a band
- [ ] 2.7 Round-count bias arm: rounds 1 vs 2, verdict flips, dissent
  retention, correctness where gradeable, confidence-vs-correctness, cost
  delta. Grounded in **arXiv 2505.19477** (round-1 debate bias amplification) —
  the citation the source draft omitted.
      verify: the arm reports a result **or** a null; a null is a valid
      published outcome and closes the step

## Phase 3 — Independence and judge-bias hardening

- [ ] 3.1 Property-test reviewer-specific shuffling for N=2..8: deterministic
  replay per seed, reviewer-specific ordering, config order not inferable from
  candidate position.
      verify: the property test fails when the shuffle is replaced by identity
- [ ] 3.2 Keep self-review structurally impossible — the reviewer payload
  construction excludes the reviewer's own authored answer; no prompt
  instruction is the only protection.
      verify: a test asserts the payload, not the prompt text
- [ ] 3.3 Provider-recognition leakage bench: ask reviewers and judges to guess
  the provider family from anonymized answers; measure recognition against
  chance. **Measurement first** — not a justification for rewriting anything.
      verify: recognition rate and chance baseline are both published
- [ ] 3.4 Hold style normalization behind the stronger gate: implement only if
  this tree's own leakage bench shows materially above-chance recognition
  **and** that recognition correlates with judgment distortion.
      verify: no normalization code lands until both conditions are recorded
      met; if it lands, the raw answer is retained for synthesis and replay and
      semantic preservation is proven
- [ ] 3.5 Order-swap consistency: repeat sampled pairwise judgments with
  candidate order reversed; emit a per-judge position-consistency metric.
      verify: the metric exists per judge and is reported with the verdict
- [ ] 3.6 Fence peer content as untrusted data with structured boundaries or
  nonce fencing, per
  [`untrusted-input-defense`](../../src/rules/untrusted-input-defense.md).
      verify: injection fixtures cannot alter the ranking schema or the system
      contract

## Phase 4 — Parallel fan-out reopens a closed decision

**This phase does not add missing work — it re-opens a decision that was made
deliberately and recorded.** `orchestrator.ts:8-12` states the v2 contract:
members are called sequentially in input order, and *"the previous parallel
ThreadPoolExecutor was traded for predictable mid-flow user prompts"*. There
are **0** `Promise.all` occurrences in that file and the dispatch order is
byte-pinned by tests. Any work here runs through
[`decision-revisit-gate`](../../src/rules/decision-revisit-gate.md).

- [ ] 4.1 Run the revisit gate before writing code: state the recorded
  decision, the condition it encoded (interactive mid-flow overrun prompts at
  2-3 members), and what has changed since. Route per that rule.
      verify: the revisit record exists with a verdict and a `revisit-if`
      line; a verdict of "keep sequential" closes Phase 4 as a null and is a
      legitimate outcome
- [ ] 4.2 Answer the interactive-overrun question the reversal bought: how a
  parallel round presents a mid-flow spend prompt without losing
  predictability.
      verify: a written mechanism, or the phase stops here
- [ ] 4.3 Preserve the sequential default — plain confirmation keeps today's
  semantics exactly.
      verify: the byte-pinned dispatch-order tests stay green **unmodified**;
      needing to edit them is the signal to stop, not to update them
- [ ] 4.4 Present the worst-case ceiling for all parallel member calls
  (including output-token ceiling and buffer rules) and require
  `--confirm-ceiling`; plain `--confirm` is insufficient.
      verify: a parallel run without the ceiling flag refuses
- [ ] 4.5 Parallelize only **within** a round; rounds stay sequential because
  round N+1 depends on N. One member failure normalizes to an error-valued
  response, never a thrown whole-run failure.
      verify: a seeded member failure yields a rendered error response and the
      run completes
- [ ] 4.6 Topology integration rule: a parallel topology may be selected only
  when its spend authorization precondition is already satisfied, and may
  never silently upgrade `--confirm` into ceiling authorization.
      verify: a test asserts the upgrade is impossible

## Phase 5 — Synthesis-policy showdown

- [ ] 5.1 One synthesis-strategy interface behind the candidates (host
  convener, dedicated external judge, strongest configured model, top-ranked
  member, dual synthesis + adjudication) — no user-facing mode proliferation.
      verify: the user-facing surface gains no new mode names
- [ ] 5.2 Bench identity-blind against identity-visible synthesis explicitly,
  so vendor prestige cannot leak in accidentally.
      verify: both arms are reported side by side
- [ ] 5.3 Majority-laundering test: seed one correct minority against several
  plausible-but-wrong majority answers; the synthesizer must justify accepting
  or rejecting the minority.
      verify: the fixture is permanent, and a synthesizer that silently drops
      the minority fails it
- [ ] 5.4 Final synthesis retains unresolved disagreement, the strongest
  minority evidence, and what evidence would resolve it.
      verify: a run with real dissent renders all three
- [ ] 5.5 Revisit ADR-120 **only** on results — record keep / amend /
  supersede with the benchmark artifact pin and a revisit condition.
      verify: the ADR record cites the benchmark artifact, not this roadmap

## Phase 6 — Adaptive depth with anti-conformity before the meter

Convergence is either genuine stability or conformity collapse. The ordering is
the whole point: **the conformity defence gets its chance before the meter is
allowed to stop.**

- [ ] 6.1 Compute a zero-cost structural disagreement signal from
  already-paid outputs: stance divergence, finding overlap, contradiction
  count, confidence spread, rank uncertainty, novelty / self-similarity.
      verify: no extra model call is issued; call count is unchanged
- [x] 6.2 Argument-exhaustion stop requires **all** of: ≥ 2 rounds completed;
  dissent repair already attempted; every present member self-near-duplicate
  versus the prior round under the existing novelty logic; no unresolved
  adversarial trigger.
      verify: **`evaluateStop` in `src/scripts/ai_council/argument_exhaustion.ts`,
      15 tests.** All four conditions asserted individually via a table-driven
      case — each one alone blocks a fixture that would otherwise stop — plus a
      fifth the step did not name (`no-members-present`, because `every()` over
      an empty array is vacuously true and would have made an empty council the
      easiest one to stop).

      The verdict reports **every** failing condition rather than the first: a
      caller acting on one reason at a time would re-evaluate N times to learn N
      blockers.

      Unblocked by `early-stop-vs-dissent-ordering`, resolved the same day with
      the red-then-green sensitivity proof that blocker required.
- [x] 6.3 Majority size alone can never trigger a stop.
      verify: majority size is **not an input to the predicate at all**, which is
      stronger than not triggering on it, and two tests pin the absence — a
      unanimous-but-unrepaired run does not stop, and a twenty-member unanimous
      run is no easier to stop than a two-member one.
- [x] 6.4 A stopped run renders: stopped early, round N of M, reason, saved
  calls and cost, which members and arguments were judged exhausted — never as
  if all configured rounds executed.
      verify: `renderStop` emits `STOPPED EARLY`, `round 3 of 5`, the reason, the
      saved calls and cost, the named exhausted members, and the explicit line
      **`NOT a full run: the remaining configured rounds did not execute.`**
      Four assertions pin those separately.

      The last line is the load-bearing one: the failure here is quiet, and an
      artifact that reads as though all configured rounds executed is a claim
      about deliberation depth that nobody made on purpose.
- [ ] 6.5 Pre-registered promotion gate against a fixed-round arm: quality
  non-inferiority on gradeable slices, no meaningful minority-rescue
  regression, measurable call/cost reduction, no increased
  majority-corruption rate. Verdict equivalence alone is **insufficient** —
  two wrong verdicts can be equivalent.
      verify: the gate is recorded before the arms run, and the
      verdict-equivalence figure is reported as context, never as the gate

## Phase 7 — Council-rung topology refinement

Only now, and **not** as a new task router.

- [ ] 7.1 Close the internal topology vocabulary at `single_external`,
  `dual_independent`, `advisor_diversity`, `peer_review`, `judge_synthesis`,
  `targeted_cross_exam`, `full_debate`. `team` and `user_required` are excluded
  by construction — the ladder and the Hard Floor own them.
      verify: the type admits no eighth member without a schema change, and
      `team` / `user_required` are not representable
- [ ] 7.2 The selector returns an explainable record: topology, council task
  class, impact class, reason codes, estimated calls, estimated cost, latency
  band, evidence/policy source, fallback.
      verify: every field is populated on a real selection
- [ ] 7.3 Keep the deterministic/probe path **above** council: a mechanism
  question resolvable by tree fact, schema, script or executable test never
  reaches topology selection.
      verify: a probe-resolvable fixture never enters the selector
- [ ] 7.4 Deterministic policy first, interpretable features only: task class,
  impact, ambiguity type, configured provider diversity, model availability,
  historical benchmark slice, artifact size, cost ceiling, prior-run freshness,
  initial disagreement.
      verify: the policy is readable end-to-end without executing it
- [ ] 7.5 Shadow mode first: compute the proposed topology, execute current
  behaviour, record the counterfactual route.
      verify: shadow runs change no observable behaviour
- [ ] 7.6 Promote per task slice on benchmark evidence only — no global claim
  that debate is better.
      verify: each promotion names its slice and its evidence artifact

## Phase 8 — Targeted cross-examination and scalable review

- [ ] 8.1 Select a disputed finding, a conflicting pair, or a correct-looking
  minority claim, and ask focused rebuttal questions.
      verify: the cross-exam prompt names the exact disputed claim
- [ ] 8.2 Reviewer budget `k`: balanced assignment approaching O(N×k) rather
  than unconditional O(N²) for larger councils.
      verify: call count at N=8 is measured against both curves
- [ ] 8.3 Preserve provider diversity in reviewer assignment where
  alternatives exist.
      verify: no candidate is reviewed only by same-family reviewers when a
      cross-family reviewer was available
- [ ] 8.4 Score optional next calls by expected information gain per cost,
  deterministic and inspectable to start.
      verify: the score is reproducible from the recorded inputs
- [ ] 8.5 Stop when the next call has low expected value — call-level
  extension of argument exhaustion, only after benchmark evidence exists.
      verify: the stop is gated on the Phase 2 artifact, not on intuition

## Phase 9 — Advisor composition after seating

The five personas exist and are shipped (see § Prevented items). The real gap
is **seating**, and it already has a carrier.

- [ ] 9.1 Add the same-provider host-subagent fan-out lane **only** as a
  benchmark arm inside the existing stub
  `agents/roadmaps/stubs/road-to-council-persona-fanout.md`, which carries a
  pre-registered bench gate. Do not duplicate it here.
      verify: this roadmap adds no rival implementation; the stub's own gate is
      the promotion condition; blocked on `blocker: persona-seating-gap`
- [ ] 9.2 Never represent same-provider fan-out as external-model
  independence.
      verify: no rendered surface labels it "external council"
- [ ] 9.3 No further personas until the existing five can be intentionally
  seated or evaluated.
      verify: `src/agent-src/personas/advisors/` still holds exactly five
      entries when this phase closes
- [ ] 9.4 After seating is solved, benchmark governed bundles (architecture /
  code review / roadmap / product) chosen from tracked persona definitions
  only, with persona and provider assignment counterbalanced.
      verify: a "persona won" result cannot be explained by "provider won"

## Phase 10 — Outcome attribution and observability

- [ ] 10.1 Extend decision replay (`ai_council/replay.ts`) with: ladder council
  resolution, council-internal topology, initial route, escalation, stage
  outputs, stop reason, synthesis policy, cost, latency, final verdict.
      verify: a replayed run reproduces the recorded route
- [ ] 10.2 Attribute each useful correction to the first stage where it
  appeared.
      verify: one real run yields a per-correction stage attribution
- [ ] 10.3 Track paid calls that change no finding, stance, confidence,
  evidence, or final decision; emit `zero_marginal_value_call_rate`.
      verify: the rate is emitted and is non-null on a real run
- [ ] 10.4 Compute route regret offline against the cheapest topology with an
  equivalent-quality outcome.
      verify: the comparison runs offline and never influences a live route
- [ ] 10.5 Track re-council savings: duplicates prevented, near-duplicate
  warnings, reruns intentionally confirmed, spend saved.
      verify: the figures reconcile against the retained artifacts
- [ ] 10.6 Track early-stop savings separately from quality.
      verify: cost and quality are never reported as one number

## Phase 11 — Learned routing as a challenger only

- [ ] 11.1 Collect offline training rows from benchmark and dogfood evidence
  only, without requiring raw private prompt content.
      verify: the row schema has no field capable of holding prompt text
- [ ] 11.2 Train an offline challenger classifier; it stays shadow-only.
      verify: no runtime path can reach the model
- [ ] 11.3 Promotion requires a material Pareto improvement in
  quality/cost/latency plus acceptable stability.
      verify: the comparison against the deterministic policy is published
- [ ] 11.4 Keep the deterministic fallback permanently — no daemon, cloud
  router or learned model becomes necessary for basic council operation.
      verify: the suite runs green with the model artifact deleted
- [ ] 11.5 Relevant model-generation changes mark affected routing evidence
  stale.
      verify: a simulated model-generation bump invalidates the right slices

## Phase 12 — UX simplification

- [ ] 12.1 Keep `/council` as the main explicit user concept; users need no
  topology vocabulary.
      verify: the command surface gains no topology argument for normal use
- [ ] 12.2 Add a free explain mode: why task-side orchestration resolved to
  council, which topology would run, estimated spend and calls, evidence
  source — with no paid model call to explain routing.
      verify: explain mode issues zero provider calls
- [ ] 12.3 A force-topology debug control may exist but cannot override
  user-required decisions, destructive authorization, spend authorization, the
  Hard Floor, or turn same-provider subagents into an external council.
      verify: one test per prohibition
- [ ] 12.4 Consumer surfaces request **capabilities** (independent external
  review, adversarial decision, architecture trade-off, minority challenge),
  never topology names; the shared council-rung policy chooses.
      verify: no command file hardcodes a topology name

## Phase 13 — Rollout and promotion gates

- [ ] 13.1 Shadow: no behaviour change; record proposed topology and
  counterfactual evidence.
      verify: behaviour diff against the pre-phase baseline is empty
- [ ] 13.2 Advisory: permit cheaper depth reductions only where
  non-inferiority is demonstrated; no auto-escalation into more expensive
  topology yet.
      verify: no run costs more than today's default under advisory mode
- [ ] 13.3 Adaptive: enable escalation and early stop on slices that pass
  holdout gates.
      verify: each enabled slice names its holdout artifact
- [ ] 13.4 Default-on per slice only, on: quality non-inferiority or
  improvement, acceptable cost/latency, stable parse/gradeability, no material
  minority-rescue regression, judge-bias metrics within threshold, no weakening
  of user or spend boundaries.
      verify: all six conditions are recorded per slice before the flip
- [ ] 13.5 Re-evaluate on model-generation changes — evidence is not timeless.
      verify: a stale-evidence slice blocks its own default-on state

---

## Blockers

### blocker: unlicensed-source-verbatim-scan
- **Status:** resolved
- **Owner:** maintainer
- **Resolution:** **(c) now — publish unreachability as the finding and scope the
  step to prose this tree can diff — plus a follow-up stub for pinned-source
  verification.** AI council 2026-08-28. Offline execution cannot establish
  remote licence state; it can still scan and rewrite substantively-verbatim
  prose that exists in the current tree, while reporting explicitly that upstream
  provenance was unreachable.
- **One correction to this blocker's own wording, adopted.** It says "confirm no
  LICENSE → **no grant exists**". That is **too categorical**: a grant may appear
  in file headers, package metadata, accompanying terms, or another document in
  the same repository. The defensible conclusion is *"no licence grant was
  located in the inspected material"*, followed by conservative treatment — not a
  claim that no grant exists anywhere. The step text is read that way from here.
- The source names stay **anonymized** in this roadmap in every branch, and no
  branch of this makes it the license-required-attribution carve-out.
- **Blocks:** 0.4 only. Phases 0.1-0.3, 0.5 and everything downstream ship
  without it.
- **What to do:** two of the three harvest sources reportedly ship no LICENSE
  file. That is unverifiable offline, so a maintainer must fetch each source at
  a pinned revision and record the licence state. Then pick one of:
  (a) confirm no LICENSE → **no grant exists**, so the verbatim scan is
  mandatory and any substantively-verbatim prose is rewritten before P0 closes;
  (b) a permissive licence is found → record it and run the scan as a courtesy
  check; (c) the sources are unreachable → publish that as the finding and
  scope 0.4 to the prose this tree can actually diff.
  **In every branch the source names stay anonymized in this roadmap.** No
  licence means this is *not* the license-required-attribution carve-out, and
  `CREDITS.md` being a denylist carve-out path (`external_sources_denylist.json`
  → `skip_paths`) does not extend to `agents/roadmaps/`.
- **Recommendation:** (a) — fetch and record; the scan is cheap once the
  licence state is written down.
- **If you do nothing:** P0 closes with an unrecorded provenance claim, and the
  first external question about lineage has no answer in the tree.
- **Resolved when:** the licence state of each source is recorded in the
  evidence file with the commit read, and the scan result is recorded or
  explicitly scoped out.

### blocker: parallel-fanout-reopens-a-closed-decision
- **Status:** resolved
- **Owner:** maintainer
- **Resolution:** **(a) — keep sequential dispatch and close Phase 4 as a
  published null.** AI council 2026-08-28, **2/2**. Sequential dispatch is a
  recorded decision, not an omission: the orchestrator states the trade (the
  previous parallel executor was traded for predictable mid-flow user prompts),
  `grep -c 'Promise.all'` returns 0, and the dispatch order is pinned
  byte-for-byte by tests. Reopening it without new evidence — a real latency
  complaint, not a topology experiment's convenience — is scope creep, and the
  trade was made at 2-3 members, which is still the typical configuration.
- **A published null here is honest completion**, and it discharges the revisit
  gate: the decision was named, evaluated against the current tree, and left
  standing with the reason recorded. If it is ever reopened, one seat named the
  only shape worth considering — intra-round parallelism behind a ceiling flag,
  preserving the interactive-prompt property that motivated going sequential.
- **Blocks:** all of Phase 4. No other phase depends on it.
- **What to do:** sequential dispatch is a **recorded decision**, not an
  omission — `src/scripts/ai_council/orchestrator.ts:8-12` states the trade
  ("the previous parallel ThreadPoolExecutor was traded for predictable
  mid-flow user prompts"), `grep -c 'Promise.all' src/scripts/ai_council/orchestrator.ts`
  returns `0`, and the dispatch order is pinned byte-for-byte by tests. Run
  [`decision-revisit-gate`](../../src/rules/decision-revisit-gate.md) first:
  name the mechanism, state what changed, and route it. Then pick exactly one:
  (a) keep sequential and close Phase 4 as a published null; (b) reopen with a
  concrete answer to the interactive-overrun question **and** a
  `--confirm-ceiling` design that leaves the byte-pinned tests unmodified;
  (c) narrow to intra-round parallelism behind the ceiling flag only.
- **Recommendation:** (a) until a real latency complaint exists — the trade was
  made at 2-3 members, which is still the typical configuration.
- **If you do nothing:** Phase 4 stays closed, which is the safe state; the
  risk is a future session reading the phase as unbuilt work and silently
  reverting a decision.
- **Resolved when:** a revisit record exists with a verdict, a rationale, and a
  `revisit-if` line — a null verdict resolves this blocker.

### blocker: maintainer-blind-ratings
- **Status:** resolved
- **Owner:** maintainer
- **Resolution:** **(b) — scope the affected phases to gradeable-only slices and
  publish the human-rubric arms as deferred, with the originating rationale
  intact.** AI council 2026-08-28, **2/2**, not actionable under this run's
  constraints: no human raters are available, and the originating record is
  explicit that *"blind human judgments cannot be substituted with an
  architectural choice or inferred from existing nulls"*.
- **The deterministic and executable-oracle arms are unaffected and land in
  full.** The roadmap stays valuable while narrower — but only if it says so:
  one seat's caveat is adopted, that deferring the rubric arms is fine when
  clearly stated and misleading if a reader assumes "quality" meant
  "human-judged usability".
- **On an LLM-as-judge substitute, asked directly.** The rationale does not
  forbid every model-graded number; it forbids using one **as a substitute for
  blind human judgment**. A separate arm is defensible only if it is named as
  what it is — a **model-graded exploratory arm**, never "the human-rubric arm" —
  and never pooled with, averaged into, or reported as the human arm.
- **Blocks:** the human-rubric arms inside 2.1 and 5.3. The deterministic and
  executable-oracle arms are unaffected.
- **What to do:** this is an **inherited live blocker**, not a new one — it
  originates in `agents/roadmaps/archive/road-to-council-blind-review.md:251`,
  whose Phases 2 and 3 were transferred out to
  `agents/roadmaps/stubs/road-to-council-blind-ratings.md` under the recorded
  disposition, on the adopted rationale that *"blind human judgments cannot be
  substituted with an architectural choice or inferred from existing nulls"*.
  Pick one: (a) the maintainer produces the blind ratings, unblocking the
  rubric arms; (b) scope Phase 2 and 5.3 to gradeable-only slices and publish
  the rubric arms as deferred; (c) close the stub against a published null.
- **Recommendation:** (b) — it lets the whole benchmark land while keeping the
  human-judgment claim honestly unpaid.
- **If you do nothing:** the rubric-scored families in 2.1 have no grader, and
  any quality claim resting on them is unsupported.
- **Resolved when:** the ratings exist, or the rubric arms are explicitly
  scoped out of this roadmap with the null recorded at the stub.

### blocker: persona-seating-gap
- **Status:** resolved
- **Owner:** maintainer
- **Resolution:** **promote the existing stub; defer Phase 9's persona-diversity
  claims; do not duplicate the stub's analysis here.** AI council 2026-08-28,
  **2/2**. The decisive argument is that running the benchmark anyway would
  produce **numbers that do not test the stated variable**: with a two-provider
  configuration at most 2 of 5 personas seat, and which two is a config-order
  accident, so the treatment is confounded before the first measurement. A
  five-persona treatment cannot be realised on this configuration at all.
- This is a **roadmap decision, not a benchmark execution** — the gap is already
  measured and the stub already carries a pre-registered bench gate.
- **Blocks:** all of Phase 9. Nothing else.
- **What to do:** **the carrier already exists — point at it, do not duplicate
  it.** `agents/roadmaps/stubs/road-to-council-persona-fanout.md` records the
  measured gap (`ai_council/advisors.ts:140` walks enabled advisors,
  `:151-155` throws `CouncilConfigError` when two bind the same member, so with
  a two-provider configuration at most **2 of 5** personas seat and which two
  is a config-order accident) and carries a **pre-registered bench gate**.
  Decide only whether that stub is promoted; do not restate its analysis here.
- **Recommendation:** leave the stub parked until Phase 2 produces evidence
  that lens diversity moves a measured outcome.
- **If you do nothing:** Phase 9 stays blocked, which is correct; the risk is
  duplicating the stub's analysis in a second file.
- **Resolved when:** the stub is promoted or closed, per its own gate.

### blocker: early-stop-vs-dissent-ordering
- **Status:** resolved 2026-08-25 — **the conjunct is in the predicate and its
  sensitivity is demonstrated red-then-green.**
  `src/scripts/ai_council/argument_exhaustion.ts`, 15 tests.

  **`dissentRepairAttempted` is a required conjunct of `evaluateStop`**, not a
  soft check upstream that the predicate hopes ran. Encoding it as a conjunct
  rather than as call-order discipline is the point: a caller that forgets the
  ORDER produces a wrong answer silently, while a caller that forgets the FIELD
  produces `false` — the safe direction, and a visible one.

  **The sensitivity proof, both arms, on one fixture.**
  `CONFORMITY_COLLAPSE` is indistinguishable from a genuinely exhausted run on
  every cost-visible axis — enough rounds, everyone repeating themselves, no open
  objection — and differs only in that the anti-conformity defence never ran.
  **RED:** through a neutered copy with the conjunct removed, it **stops**, which
  is exactly the failure this blocker names. **GREEN:** through the shipped
  predicate it does not, and reports `dissent-repair-not-attempted`. A third case
  asserts the neutered copy still agrees with the real one on a genuinely
  exhausted run — sensitivity means differing on the ONE axis under test, and a
  copy that disagreed everywhere would prove nothing.

  **Majority size is absent from the predicate on purpose (6.3), and asserted
  absent.** Unanimity is the most available signal here and the least
  trustworthy: it is precisely what conformity collapse produces, so a predicate
  reading it would stop soonest in the case it must not. A test shows a
  twenty-member unanimous-but-unrepaired run is no easier to stop than a
  two-member one.

  **One case the step's four conditions did not cover, found while writing it:**
  `every()` over an empty array is vacuously true, so a council with **no present
  member** would have been the easiest one to stop. `no-members-present` is now
  its own blocker in the verdict.
- **Owner:** agent
- **Blocks:** 6.2, and by dependency 6.5.
- **What to do:** the ordering is the substance, not a detail: anti-conformity
  repair must fire **before** the cost stop, because convergence may be
  conformity collapse rather than solution stability. Encode the ordering as a
  precondition in the stop predicate (`dissent repair attempted` is a required
  conjunct, not a soft check), then prove sensitivity: remove the conjunct,
  watch a conformity-collapse fixture stop when it must not, restore it. Run
  `./scripts-run src/scripts/lint_roadmap_blockers` after editing this section.
- **Recommendation:** encode it as a hard conjunct now — retrofitting an
  ordering constraint into a stop predicate after promotion is the expensive
  version.
- **If you do nothing:** early stop can fire on conformity collapse and be
  reported as convergence, which is exactly the failure Phase 6 exists to
  prevent.
- **Resolved when:** the conjunct is in the predicate and its sensitivity has
  been demonstrated red-then-green.

### blocker: evidence-integrity-unparsed-dependency
- **Status:** resolved
- **Owner:** maintainer
- **Resolution:** **verify by lookup, and if the distinction did not ship, REOPEN
  it as its own change — never scope it out quietly.** AI council 2026-08-28
  (anthropic + openai, 1 round, $0.00). One seat called it actionable now (pure
  in-tree lookup: read the archived roadmap's completion state, grep for the
  mechanism, cite `file:line` or confirm its absence); the other declined to call
  it actionable *from the material supplied to the council*, which is a statement
  about the council's inputs rather than about the tree.
- **Both converged on what actually matters, and it is a priority ruling:** of
  the five blockers, **this is the one that must not be descoped.** The others
  narrow which outcomes were measured; this one threatens the meaning of
  measurements already reported. If a parse failure is observationally identical
  to a genuine zero-findings result, Phase 1B's promotion gate cannot be trusted,
  and the roadmap's remaining claims become **positively misleading rather than
  merely incomplete**.
- **Blocks:** all of 1B. 1A ships independently.
- **What to do:** 1B needs the `unparsed` versus zero-findings distinction,
  which `agents/roadmaps/archive/road-to-council-evidence-integrity.md`
  Phase 2 was to expose. Confirm against the archived roadmap whether that
  distinction actually shipped: if yes, drop this blocker and cite the
  `file:line`; if no, either scope 1B out or re-open the dependency as its own
  change.
- **Recommendation:** check first — the roadmap is archived, which usually
  means shipped, and this blocker may be resolvable by one read.
- **If you do nothing:** 1B's promotion gate cannot distinguish a parse failure
  from a genuine zero-findings result, and the 70 % figure is unmeasurable.
- **Resolved when:** the distinction is cited at `file:line`, or 1B is scoped
  out.

---

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-24 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | A second task-side resolver lands anyway | implementation | The rejected `CouncilTopologyRouter` shape is the intuitive design; a future session reading Phase 7 in isolation may rebuild it beside the ladder | 0.5 locks the invariant in a test that fails on a second router, sabotage-verified; 7.1 excludes `team` and `user_required` from the vocabulary by construction | Phase 0 — Provenance and the one-resolver lock |
| 2 | Rebuilding shipped council mechanics | implementation | Ten proposals in the source drafts already exist in the tree; re-implementing any is a larger risk than the feature's absence | § Prevented items carries a `file:line` per row; 0.2's surface inventory forces a no-duplication check before any phase opens | Prevented items — verified already-shipped |
| 3 | Phase 4 silently reverts a recorded decision | implementation | Sequential dispatch was chosen deliberately and is byte-pinned by tests; reading Phase 4 as unbuilt work would revert it without a record | Phase 4 is framed as a revisit gate; 4.3 requires the byte-pinned tests to stay green **unmodified**; `blocker: parallel-fanout-reopens-a-closed-decision` gates the whole phase | Phase 4 — Parallel fan-out reopens a closed decision |
| 4 | Early stop fires on conformity collapse | product | A run that stops because members converged socially is reported as convergence, degrading exactly the decisions council exists to improve | 6.2 makes dissent repair a required conjunct; 6.3 forbids majority size as a stop condition; `blocker: early-stop-vs-dissent-ordering` requires red-then-green sensitivity proof | Phase 6 — Adaptive depth with anti-conformity before the meter |
| 5 | Quality claims without a single-model baseline | product | "Council improves quality" is the claim most likely to be asserted and least likely to be measured; without a strong single-model arm it is unfalsifiable | 2.2 makes the strong single-model baseline mandatory in the same table; 2.5 separates model quality from topology quality; 2.6 forbids N=1 promotion | Phase 2 — Build the benchmark before automating topology |
| 6 | Source attribution leaks into the tracked tree | product | The source drafts name third-party repos and authors; a landed derivation-attribution violates source confidentiality and the CI denylist gate | Sources are referenced only as Source A/B/C with `ENC1:` links; 0.3 routes real links through encryption; `check_no_external_sources` is the deterministic backstop | Anonymized provenance |
| 7 | Style normalization ships on research alone | implementation | Self-preference research is suggestive but not evidence about this tree; an expensive normalization pipeline could land unjustified | 3.3 measures leakage first; 3.4 requires both above-chance recognition **and** demonstrated judgment distortion before any code | Phase 3 — Independence and judge-bias hardening |
| 8 | Spend authorization weakened by topology choice | product | A topology selector that can pick a parallel or deeper path could effectively upgrade a plain `--confirm` into broader authorization | 4.4 requires `--confirm-ceiling`; 4.6 forbids the silent upgrade with a test; 12.3 blocks the force control from overriding spend or Hard Floor | Phase 4 — Parallel fan-out reopens a closed decision |
| 9 | Learned routing becomes a runtime dependency | implementation | A challenger model that quietly moves onto the live path makes basic council operation depend on an artifact | 11.2 keeps it shadow-only with no runtime path; 11.4 requires the suite to run green with the artifact deleted | Phase 11 — Learned routing as a challenger only |
| 10 | Phase 9 duplicates an existing stub | implementation | The seating analysis already exists in a stub with a pre-registered gate; restating it creates two carriers that can drift | 9.1 points at the stub and forbids a rival implementation; `blocker: persona-seating-gap` makes promotion the stub's own decision | Phase 9 — Advisor composition after seating |

---

## Acceptance Criteria

1. `judgment_ladder.ts` remains the single task-side orchestration resolver,
   and a test fails on any second one.
2. Council topology selection exists only behind the ladder's council rung;
   `team` and `user_required` are not representable in its vocabulary.
3. `ai_council/necessity.ts` retains a clear, non-duplicative role.
4. Method provenance is recorded as Source A/B/C in `CREDITS.md` and
   `provenance/harvests.jsonl`, with links as `ENC1:` tokens only, and
   `check_no_external_sources` is green.
5. The unlicensed-source verbatim scan is recorded, or explicitly scoped out
   with the licence state written down.
6. Exact repeat council runs warn before new spend, and the warning can never
   become an unconditional block.
7. Near-duplicate warnings print their similarity score against a
   pre-registered threshold.
8. Inline findings reduce analysis-lens extraction calls with no parse-quality
   regression, or the null is published and the change reverts.
9. Deterministic and executable truth outranks council consensus — a
   probe-resolvable question never reaches topology selection.
10. Every council-effectiveness claim carries a strong single-model baseline, a
    trial count, and a variance band.
11. Benchmark results separate topology quality from model quality.
12. Peer reviewers never receive their own authored answer, enforced in payload
    construction rather than in prompt text.
13. Candidate ordering is reviewer-specific and property-tested for position
    bias at N=2..8.
14. Provider-recognition leakage is measured against chance; style
    normalization remains absent unless leakage is both measurable and shown
    harmful.
15. Candidate content cannot override ranking or synthesis contracts.
16. Sequential dispatch remains the default and its byte-pinned tests are
    unmodified; any parallel path requires a confirmed worst-case ceiling and a
    recorded revisit verdict.
17. Majority vote cannot decide finding-level correctness, and material
    minority arguments survive synthesis.
18. Correct-minority / wrong-majority fixtures are permanent benchmark cases.
19. ADR-120 changes only on synthesis evidence, with the artifact pinned.
20. Dissent repair runs before argument-exhaustion stopping can fire, proven
    red-then-green; majority size alone never stops a run.
21. A stopped run is textually distinguishable from a full run.
22. Large councils do not require unconditional O(N²) peer review, and
    targeted cross-examination names the exact disputed claim.
23. The five existing personas are benchmarked before any sixth is proposed,
    and same-provider fan-out is never labelled external-model independence.
24. Every paid call is explainable in replay; useful corrections are
    attributable to a stage; `zero_marginal_value_call_rate` is measurable.
25. Re-council and early-stop savings are measured separately from quality.
26. Learned routing, if explored, stays an offline shadow challenger, and the
    suite runs green with its artifact deleted.
27. User authority, the Hard Floor, and spend gates are never weakened by a
    topology choice.
28. The published proof surface reports where council **loses** as well as
    where it wins.
29. No row in § Prevented items has been rebuilt, and the quota-source split
    has not been re-proposed.

---

## Explicit non-goals

- No second task-side routing architecture beside the judgment ladder, and no
  standalone `CouncilTopologyRouter`.
- No replacing external-model independence with same-provider personas, and no
  new fixed five-agent council.
- No additional personas before existing seating is resolved.
- No majority vote as finding-level truth, and no Borda aggregate as a
  correctness oracle.
- No learned router as a required runtime dependency, and no remote routing
  daemon.
- No third-party transport shortcut that bypasses existing provider spend and
  quota governance.
- No project-local council config as an authoritative enablement source
  ([`council-availability`](../../src/rules/council-availability.md)).
- No auto-authorization by council, and no hiding dissent for cleaner output.
- No trigger-taxonomy work and no HTML verdict surface — both are owned
  elsewhere (§ Deferrals held elsewhere).
- No claim that "council is better" without scoped evidence.
