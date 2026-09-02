# Phase 2 preparatory work — what was built, and the one finding that stopped the freeze

**Date:** 2026-09-02 · **Branch:** `drain/r16-governed-evidence` · **Base:** `56c333855`
**Scope:** the preparatory half of the drain-15 1B resume chain for
`road-to-governed-evidence-production`.

**Metered calls made: zero.** No request reached any provider API. No baseline
was captured, no comparison was run, and no acceptance criterion was marked
satisfied. `--confirm` was never passed to `llm_propose`.

## What the drain-15 disposition authorised, and what it withheld

The disposition separates *authority to decide*, *authority to implement
preparatory work*, and *satisfaction of an acceptance criterion*, holding the
first two while the third stays unavailable. The chain it recorded, in order:

1. cure F-A with an equivalence-preserving manifest;
2. freeze the complete experimental definition, entire or not at all;
3. implement the paired-delta producer for F-C;
4. a fresh-checkout dry re-run;
5. an independent session — not the one that authored the corpus — authorised to spend.

Steps 1, 3 and 4 are done. **Step 2 is an honest null**, and § 3 below is the
reason. Step 5 is not this session's to take.

## 1. F-A — cured, and the earlier record's mechanism was wrong

`src/scripts/_lib/corpus_manifest.ts` plus the CLI
`src/scripts/corpus_manifest.ts` capture every field the disposition enumerated;
the shape and the equivalence contract are in
`docs/contracts/corpus-manifest-v1.md`. `subject_digest` folds the enumeration
rule and the ordered subject inventory with hashes, and deliberately nothing
else, so a node upgrade cannot report a subject change.

**Reproduced on the real tree.** A fresh `task sync && task generate-tools` at
`56c333855` produced **13** files in `.claude/rules/` and logged **101 rules
skipped** — the drain-14 measurement, reproduced rather than cited.

**The correction.** Drain 14 attributed those skips to byte-identical
user-scope twins, quoting the generator's own log line. Probed directly:

```
names 119  skip 0            # dedupableRules over dist/agent-src/rules
twin exists false            # e.g. source-of-truth.md
```

`dedupableRules` accounts for **zero** of the 101 skips, because
`projection.scope_dedup` appears on no settings layer this repository carries
and therefore defaults off (`condense.ts:445-459`). The live mechanism is
`partitionRulesForDir` (`ruleLayerPartition.ts:91`): with the partition active
and this host's **global** layer verified to carry the *names* that would be
withheld, the project projection narrows to the package-only set.
`hostLayerCarries` (`globalRuleLayers.ts:176-197`) decides on **name presence
only**, never content.

F-A's conclusion is unaffected — the corpus is a function of the operator's
home directory and not of the commit. What was wrong is the named mechanism,
and a reader following it to `dedupableRules` would have found a function
returning an empty set. The manifest captures **both**: the byte-identity twin
table and the partition decision with the global layer's name inventory and
`layer_digest`.

Live capture, `56c333855` plus this branch's uncommitted work:

```
subject_digest=860eaf2dee7f35df · 5 subject(s) · 13 produced · 0 user-scope skip(s)
partition_active: True · tool_id: claude-code · layer_dir: .claude/rules
carries: True · reason: carries · missing: 0 · package_only_count: 15
layer_inventory: 104 · layer_digest: 17e96e89c6a51fbd
scope_dedup: absent:default-off
```

## 2. F-C — the producer exists

`src/scripts/_lib/candidate_pair_delta.ts` closes the gap the drain-14 trace
established: *"nothing reads two `CandidateRecord`s and emits a signed delta, a
`PairedVerdict`, or a `MetricVector`."*

Every property of the comparison's **shape** is derived from constants committed
before either arm existed, and none of it is a choice made here:

| Slot | Derived from |
|---|---|
| sign convention (positive favours treatment) | `PairedInput.deltas`, `paired_verdict.ts:110` |
| direction handling | `MetricDirection`, `evaluation_vector.ts:59` |
| `tieEpsilon` = 1e-9 | the value the A/B report's own direction counts use, `bench_ab_v2_stats.ts:326-327` |
| aggregation, alpha, discordant floor | `decidePairedVerdict`, `ALPHA` (`:51`), `deriveMinDiscordant` (`:72`) |
| pairing key | `(dimension, sorted mutation paths)` — the observation identity, reconstructed from the record, since an id hashes mutated bytes and so differs across arms by construction |

**Pooling answers F-B's floor half.** At one delta per candidate pair the trial
count equals the corpus size (5), which is exactly `MIN_DISCORDANT`, so one tie
makes a pass arithmetically unreachable before the run starts. `compareArms`
pools per-trial deltas across pairs, so the count is the number of **trials**.
The independence assumption that buys it is stated at the function rather than
assumed away.

**What it refuses**, each with a test: an unmatched record on either arm (half a
pair is no result), two records for one observation, zero trials, a duplicate
trial id, a non-finite outcome, and a pair present in the arms but absent from
the measurements. Identical arms are **flagged, not thrown** — every trial then
ties, and a reader seeing `underpowered` without the flag would look for the
cause in the measurement.

**The honest disclosure it carries in its own header:** it has no live
population. No shipped evaluator emits a `TrialOutcome` for a candidate over the
frozen corpus, so every test supplies its own. That is the same disclosure AC-3
makes about `assertCheapestFirst`, and it is made in the same terms.

## 3. F-B — NOT frozen. The finding, stated as a refutation

**Claim:** the experimental definition cannot be frozen by derivation over the
currently frozen corpus, because the corpus's admitted mutations cannot move the
one cheap evaluator the pre-registered budget names.

**Three independent legs, each falsifiable:**

1. **Path.** The corpus is `.claude/rules/*.md`
   (`metered-proposer-protocol.md` § The defect-observation corpus).
   `description_route_check`'s catalogue is loaded from `dist/agent-src/skills`
   and `dist/agent-src/rules` (`description_route_check.ts:386-410`). A mutation
   to a corpus member never reaches the catalogue. *Refuted by:* a catalogue
   loader that reads `.claude/`.
2. **Surface.** The catalogue is `name + description` only —
   `catalogueHash` maps each entry to `` `${c.name} ${c.description}` ``
   (`:81-84`), and the description is extracted from frontmatter (`:395`). Both
   admitted recipes preserve frontmatter byte-identically: `keepLeadingBand`
   cuts at the first `## ` heading (`candidate_proposer.ts:126-140`) and
   `appendHonestEnforcement` appends at the end (`:159-164`). *Refuted by:* a
   recipe that rewrites frontmatter.
3. **Arithmetic.** With every trial a tie, `discordant` is 0 against a floor of
   5, so `decidePairedVerdict` returns `underpowered` — which drain 14 already
   ruled *"does not discharge AC-2 … it records that adjudication was
   unavailable."* *Refuted by:* a metric on which the arms differ.

**The one evaluator that could move.** `bench_ab_clone --candidate-record`
(`bench_ab_clone.ts:449`) materialises a candidate into a clone outside the
repository, and the A/B bench measures per-task outcomes over it
(`bench_ab_v2_stats.ts:315-345`), which is the population the tree's only live
`decidePairedVerdict` caller already uses. It is an **agent-run** harness, so
its cost is far above the two-cent estimate drain 14 computed for the proposal
half alone.

**Why this session did not choose it.** Both available exits amend the frozen
experimental subject rather than deriving from it: selecting the bench as the
outcome surface fixes aggregation for the arms being compared, and changing the
corpus so a cheap evaluator applies changes corpus membership. Drain 15 widened
the delegation to a **provenance-preserving pin of the same subjects**; a
rules-to-skills corpus change is not provenance-preserving, and drain 14's
routing for corpus membership stands. A protocol frozen against a metric known
in advance to return a non-answer would be a tuned protocol with the tuning
pointing at nothing.

**What closes it:** a ruling on which of the two amendments is taken. That is a
decision, not a build, and it is the first thing the next run on this file
should put to a council.

## 4. Fresh-checkout dry re-run — passed, and the refusal path passed first

A detached worktree at `ac0cfd223` with nothing but `node_modules` symlinked.
Four observations, in order.

**(a) A fresh checkout has no corpus at all.** `.claude/rules` does not exist,
which is F-A in one line.

**(b) `capture` refuses rather than pinning nothing** — exit **1**:

```
corpus_manifest: capture refused - .claude/rules does not exist in <fresh> - the
corpus is a generated projection, so a capture before generation would pin an
empty subject and read as a successful pin of nothing
```

**(c) Generation reproduces the same corpus.** `task sync && task
generate-tools` produced **13** files and logged **101 rules skipped**, the same
numbers as the working tree.

**(d) The reconstruction check passes.** `verify --manifest` against the pin
captured in the working tree:

```
corpus_manifest: SUBJECT EQUIVALENT - digest=860eaf2dee7f35df
real exit code: 0
```

Zero differences printed, explanatory ones included. The clean-checkout
requirement the resume chain names — *"requiring identical corpus identity. A
dry run in a worktree that inherited a projection is not that check"* — is met
literally: the projection was generated in that checkout, not inherited.

**(e) The dry proposal path runs end to end there.** Observations built from the
protocol's own enumeration rule (byte-sorted first five, class assigned by the
presence of a `## ` heading), which yields one
`unbacked-enforcement-claim` and four `over-broad-activation`:

```
llm_propose: DRY RUN - nothing sent, nothing spent.
llm_propose: tier lite -> claude-haiku-4-5-20251001
llm_propose: tier medium -> claude-sonnet-4-5-20250929
llm_propose: tier high -> UNPINNED (refused until a dated id is pinned)
llm_propose: planned attempt 1..5 - class=reason_unknown - tier=lite
llm_propose: ~275 input tokens for this one call
llm_propose: re-run with --confirm to spend.
```

All five planned attempts are `lite`, which is the same fact AC-3 records about
itself: no ordering decision arises in the dry plan, so the ordering guard has
nothing to govern until a run spends.

The worktree was removed afterwards.

## 5. AC-3 — honest null, and locked

AC-3's caller half was already met on 2026-09-01. Its purpose half needs one
**spent** population, and the drain-15 disposition is explicit that *"'No
further code is needed' establishes implementation completeness, not acceptance
completeness"*, and that AC-3 is to stay attached to the Phase 2 resume chain
rather than transferred. Nothing this session built produces a spent population,
so the box stays `[ ]`. Checking it would be closing on the half that was
already true.

## 6. What is now the next decision

One question, and it is owner- or council-routed rather than buildable:

> Phase 2's frozen corpus (`.claude/rules/*.md`, activation and content recipes)
> cannot move the pre-registered cheap evaluator. Which amendment is taken —
> (a) adopt the A/B bench as the outcome surface and accept its cost, or
> (b) re-cut the corpus onto a surface a cheap evaluator measures, accepting
> that corpus membership is amended and the pin re-captured?

Until it is answered, steps 2 and 5 of the resume chain are both blocked, and
2.1, 2.2, AC-2, AC-3 and AC-4 all stay open.
