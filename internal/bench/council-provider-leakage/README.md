# council-provider-leakage — does anonymisation actually anonymise?

> Scope: `road-to-inbox-harvest-2026-08-e-council-topology-evidence` Phase 3,
> step 3.3. Harness `src/scripts/ai_council/provider_leakage_bench.ts`;
> step-3.4 gate `normalizationGateVerdict` in the same module.

## Status — HARNESS BUILT, MEASUREMENT NOT RUN

**Nothing here reports a recognition rate, because none was measured.** The
bench needs live council calls — one paid call per item per rater — and the
CLI daily quota was exhausted when this landed (anthropic 50/50, openai 51/50
against the cap; a failed attempt still increments the counter, so retrying
under an exhausted cap spends without measuring).

NOT RUN is not a null. A null is what a measurement returns; this is the state
before one. `normalizationGateVerdict` encodes exactly that distinction and
returns `unrun` — not `below-bar` — on empty data, so step 3.4 stays mechanically
blocked rather than blocked only by prose.

## The question

The council strips provider identity before a peer-review or chairman pass
(`consensus.anonymize_responses`, `blind_review.build_blind_labels`). Stripping
the LABEL is not the same as removing the SIGNAL. Models have house styles —
sentence rhythm, hedging habits, list formatting, characteristic openers. If a
reviewer can name the author of `Response-B` from the prose alone, the pass is
not blind whatever the header says.

That had never been measured in this tree, which is why "the council is blind"
was an assumption with a mechanism behind it rather than a result.

## Pre-registration — fixed before any arm runs

Recorded here so the bar cannot move once a number exists.

| | |
|---|---|
| **Raters** | every configured council member, plus the host as a judge, each rating every item |
| **Items** | ≥ 30 anonymised deliberation bodies drawn from completed council runs, ≥ 5 per provider family present |
| **Option list** | the closed set of provider families present in the corpus, plus `unknown`; fixed order across items |
| **Primary metric** | `recognition_rate` = correct / gradeable, per rater |
| **Baselines** | BOTH published: `chance_uniform` = 1/k, and `chance_majority` = largest single-family share of the graded items |
| **Test** | exact one-sided binomial upper tail against the STRICTER of the two baselines |
| **"Materially above chance"** | p < 0.05 for at least one rater |
| **Self-rating** | a member never rates its own body; the scorer drops those pairs before grading |

`chance_majority` is published beside `chance_uniform` because a skewed corpus
makes `1/k` the wrong bar: a rater that always names the most common family
beats uniform chance while recognising nothing.

## Why the option list is closed, and why the prompt asks for nothing else

An open-ended "who wrote this?" is not gradeable without a second model in the
scoring loop, and a scoring model is one more thing to trust. A one-word answer
from a fixed list is graded by string equality.

That is also why the recognition prompt does **not** fence the body as untrusted
content, unlike `build_peer_review_user_prompt`. Fencing inserts a nonce and a
security preamble around the body; this bench measures how recognisable a body
is, so anything the harness adds to it is a confound the live path does not
carry. The rater is asked for one token from a closed list and its answer is
matched against that list, so an injected instruction has no schema to alter.

## Corpus — assembled locally, never committed

Real council answers live under `agents/runtime/council/`, which is gitignored,
auto-pruned, and local to one machine. The corpus is therefore built by the
operator at run time and **not** checked in; committing it would both leak run
content and pin a corpus that the retention window deletes underneath it.

`smoke-items.json` is the only committed fixture and it is **synthetic**. Its
bodies were written for this file. It exists to exercise the harness in tests
and it **cannot** produce a measurement: synthetic prose has no house style to
recognise, so any rate computed over it describes the fixture author, not a
provider. `"synthetic": true` is in the file so a runner can refuse it.

## To run it

1. Build a corpus file matching `LeakageItem[]` from completed run artefacts.
2. Supply a `RaterFn` that dispatches `buildRecognitionPrompt` through the
   council transport.
3. `collectGuesses` → `scoreRecognition` per rater → `renderRecognitionReport`.
4. Publish the rendered block here, then feed it to `normalizationGateVerdict`
   together with the distortion arm's result.

Step 3.4 needs the second condition too — that recognition correlates with
judgment distortion. Recognition alone is `unrun` at the gate, by design: a
reviewer who can name the author but does not favour it has leaked a fact
without leaking a verdict, and normalising style to fix that would rewrite
answers for no measured gain.
