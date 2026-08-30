<!-- evidence-type: analysis -->

# Council independence and judge bias — what was hardened, and the one thing that was not measured

`road-to-inbox-harvest-2026-08-e-council-topology-evidence` Phase 3, executed
2026-08-30. Six steps, four of them closed by construction and two of them
gated on a measurement that did not run.

The headline is the second group, so it goes first.

## Step 3.3 did NOT run, and that is not a null

The provider-recognition leakage bench needs live council calls — one paid call
per item per rater. The CLI daily quota was exhausted at execution time
(anthropic 50/50, openai 51/50 against the cap), and a failed attempt still
increments the counter, so retrying under an exhausted cap spends without
measuring.

**NOT RUN is a different state from a null.** A null is what a measurement
returns; this is what you have before one. The distinction is not rhetorical
here — it is encoded, because prose alone would erode:
`normalizationGateVerdict` in `src/scripts/ai_council/provider_leakage_bench.ts`
returns `'unrun'` on empty data and never `'below-bar'`, and a test asserts
exactly that separation. `'below-bar'` would claim that recognition was measured
and found harmless, which nobody has established.

What exists instead of a result: the harness, the pre-registration, the scoring,
the significance test, and a committed synthetic smoke fixture that declares
itself unusable for measurement. `internal/bench/council-provider-leakage/README.md`
carries the pre-registered bar so it cannot move once a number exists.

**To unblock:** quota resets at UTC midnight. Assemble a corpus of ≥ 30 real
anonymised deliberation bodies from completed run artefacts (local-only —
`agents/runtime/council/` is gitignored and auto-pruned, so the corpus is built
at run time and never committed), supply a `RaterFn` over the council transport,
and publish the rendered recognition block.

## Step 3.4 is therefore blocked, and the block is mechanical

Style normalization lands only if the bench shows *materially above-chance
recognition* **and** *that recognition correlates with judgment distortion*.
Neither has been measured, so no normalization code landed and none should.

The gate is a function rather than a promise, and it fails closed in both
ambiguous directions: no gradeable data → `unrun`; above-chance recognition with
an unrun distortion arm → `unrun`, not a pass. Only both conditions recorded met
returns `bar-cleared`, and even that permits normalization rather than requiring
it. A reviewer who can name the author but does not favour it has leaked a fact
without leaking a verdict, and rewriting answers to fix that would be a cost for
no measured gain.

## Two baselines, because one of them is the wrong bar

`scoreRecognition` publishes `chance_uniform` (`1/k`) **and** `chance_majority`
(the largest single-family share of the graded items), and tests significance
against the stricter of the two.

The reason is a case the harness's own test pins: on a corpus where half the
items come from one provider, a rater that always names that provider scores
50% against a uniform baseline of 25%. Reported against uniform chance alone
that reads as leakage. It is a constant guesser recognising nothing.

The significance test is an exact binomial upper tail, not a normal
approximation — the honest sample size for this bench is a few dozen graded
items, and a normal approximation at n=20 is how a null becomes a finding.

## What closed, and how

### 3.1 — reviewer-specific shuffling, N=2..8

Already largely shipped: `deterministic_shuffle_indices`
(`src/scripts/ai_council/blind_review.ts:52-56`) is seeded from the ask plus the
deliberation bodies, and `orchestrator.ts:1533-1546` applies it per run. What was
missing was the property test across the range the step names — the existing
coverage sat at N=3 and N=4.

`tests/scripts/ai_council/peer_review_independence.test.ts` now covers every
N in 2..8 on three properties. Only one of them can carry the step's verify, and
saying which matters: deterministic replay and per-reviewer mapping distinctness
both hold under an identity shuffle too — distinctness because self-filtering
alone guarantees it, each reviewer receiving a different SUBSET. The assertion
that fails under identity is *config order is not inferable from position*,
measured as the set of observed permutations across 16 seeds. Substituting
identity for the shuffle reds it at every N from 3 to 8.

N=2 is excluded from that one assertion and from no other: a reviewer in a
two-member council sees exactly one other answer, one permutation of one element
exists, and no shuffle is distinguishable from identity there. The exclusion is
arithmetic, and it is guarded by its own test so nobody widens it.

### A recorded decision this phase did NOT override

The step asks for "reviewer-specific ordering". The shipped shuffle seed is
**run-scoped, not reviewer-scoped**, and `orchestrator.ts:1533-1543` records that
as deliberate: *"The reviewer is deliberately NOT in the seed: one shuffle per
run, so a reader comparing two reviewers' critiques of the same member is
comparing the same label."*

That is a lock with a stated reason, so the test pins the property that actually
holds — per-reviewer label→source maps ARE distinct, via self-filtering — rather
than quietly re-seeding the shuffle to make a different sentence true. Changing
it is a `decision-revisit-gate` matter and it would trade a real property
(cross-reviewer comparability of a label) for a nominal one. Surfaced, not acted
on.

### 3.2 — self-review is structurally impossible

The filter existed (`orchestrator.ts:1518-1522`, `src !== scorer`). The step's
verify is that a test asserts the **payload**, not the prompt text, and the
existing coverage asserted the derived `label_to_source_by_reviewer` map — one
layer away from what actually reaches a model.

The new tests read the `user_prompt` string handed to `ask()` and assert, for
every N in 2..8, that a reviewer's own deliberation body is absent from it and
every other body is present. One test then strips the prompt's own *"You may NOT
see your own response"* sentence from the captured payload and re-asserts, which
is the step's point made executable: the protection survives a prompt that no
longer mentions it. Removing the `src !== scorer` filter reds 22 assertions.

### 3.5 — per-judge position consistency

`src/scripts/ai_council/judge_position_bias.ts`, new. `evaluatePair` in
`check_quality_regression.ts:84-108` already swaps order and resolves a flip to
`inconsistent`, and `_lib/judge_hygiene.ts:5-9` records that as stronger than
the step that asked for it — but it is single-judge and it reports presence, not
direction. Two judges of differing reliability average into one
`inconsistency_rate` that describes neither, and a judge that flips at random is
indistinguishable from one that always prefers whatever it was shown first.
Those need opposite remedies.

So the metric is per judge and carries `first_position_rate` alongside
`position_consistency`. Scripted primacy and recency judges produce identical
consistency scores and opposite direction scores, which is the pair the metric
exists to separate. Sampling is deterministic and seeded, so a published rate is
re-drawable.

**Honest scope:** the shipped council has no pairwise judging stage — members
deliberate, peer-review and are scored on findings, never compared two at a
time. `grep -rn pairwise src/scripts/ai_council` returns nothing. So this is the
metric and its renderer, exercised by the leakage bench; no claim is made that a
live council verdict currently carries the line, because there is currently no
live council judgment for it to describe.

### 3.6 — peer content fenced as untrusted data

`build_peer_review_user_prompt` rendered peer bodies as bare Markdown under
`### Response-A` headings. Two forgeries were free:

- **Schema forgery** — a body containing `### Refinement`, one of the four
  headings the *reviewer* is told to emit, was byte-identical to a real section
  of the reviewer's own output.
- **Label forgery** — a body containing `### Response-Z` was byte-identical to a
  real candidate heading, so a reviewer could cite a member nobody consulted.

Each body is now fenced by `wrapUntrustedBlocks`, with the labels rendered
**outside** the fences. The defence is position rather than wording: every real
heading sits outside a fence, every payload inside one, and the closing tag
carries a nonce the payload cannot guess. Nothing is stripped or sanitised —
modifying untrusted input before showing it to a reviewer destroys evidence, and
the module deliberately does not.

`wrapUntrustedBlocks` was added to `src/scripts/_lib/untrusted_content.ts` rather
than written locally: rendering five peer answers with five copies of a five-line
security notice is the cost that makes a caller write its own fencing, which is
how a second and weaker delimiter gets born. One shared nonce is not a weakening —
the nonce defends against a payload *closing* a fence, and a payload that cannot
guess one value cannot guess it for the block it sits in either.

## An observation this phase did not fix

A council member that is in `members` but **not** in the deliberation set — its
round-1 answer errored or came back empty, which `orchestrator.ts:1468-1475`
skips — is still consulted as a peer reviewer, and its self-filter matches
nothing, so it receives the full set and costs a paid call.

This is **not** a 3.2 violation: self-review means a reviewer seeing its own
answer, and a member with no answer in the set cannot see one. It is a spend
observation. It is pinned as a characterisation test rather than patched,
because changing it changes which paid calls fire — outside this step, and a
decision rather than a cleanup.

## Seen-red table

Every guard below was neutralised in source, watched fail, and restored from a
scratchpad copy.

| Step | Neutralisation | Reds |
|---|---|---|
| 3.1 | `deterministic_shuffle_indices` → identity permutation | 6 (N=3..8, config-order-inferability) |
| 3.2 | `src !== scorer` self-filter removed | 22 |
| 3.3 | `chance_majority` → 0 | 2 (constant-guesser and stricter-bar cases) |
| 3.4 | no-data branch `'unrun'` → `'below-bar'` | 2 |
| 3.5 | `first_position_rate` → constant 0.5 | 2 (primacy and recency cases) |
| 3.6 | fencing reverted to the plain-heading render | 5 |

## Files

| Path | What |
|---|---|
| `src/scripts/_lib/untrusted_content.ts` | `wrapUntrustedBlocks`, `newNonce`, shared `assertNonce` |
| `src/scripts/ai_council/prompts.ts` | peer bodies fenced; labels outside the fence (3.6) |
| `src/scripts/ai_council/judge_position_bias.ts` | per-judge order-swap metric (3.5) |
| `src/scripts/ai_council/provider_leakage_bench.ts` | leakage harness (3.3) + the 3.4 gate |
| `internal/bench/council-provider-leakage/` | pre-registration, NOT-RUN status, synthetic smoke fixture |
| `tests/scripts/ai_council/peer_review_independence.test.ts` | 3.1 + 3.2, N=2..8 |
| `tests/scripts/ai_council/peer_review_fencing.test.ts` | 3.6 injection fixtures |
| `tests/scripts/ai_council/judge_position_bias.test.ts` | 3.5 |
| `tests/scripts/ai_council/provider_leakage_bench.test.ts` | 3.3 + 3.4 |

The evidence file's own name avoids a `council-` prefix on purpose:
`check_council_layout` treats any `council-*` basename outside
`agents/runtime/council/` as a misplaced council artefact, and seven such files
already sit under `agents/evidence/`. Adding an eighth to a count somebody will
eventually have to pay down is not free.
