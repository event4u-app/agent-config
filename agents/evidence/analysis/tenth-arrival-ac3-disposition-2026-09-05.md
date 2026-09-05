<!-- evidence-type: analysis -->
# AC-3 of the tenth arrival: reproduced as unsatisfiable in scope, carried rather than cancelled

`road-to-the-tenth-arrival` AC-3, at `agents/roadmaps/road-to-the-tenth-arrival.md:307-318`
on `acf134119`. Every other tracked item on that roadmap is closed. This file is
the executed evidence for the one that is not, and the record of the council
round that decided what happens to it.

## What AC-3 asks, split into its conjuncts

> Trigger coverage is re-derived by a reproducible command, expanded with a
> positive and a near-miss fixture per addition, and activation is published at
> the new coverage — including if it did not move.

| conjunct | state | where |
|---|---|---|
| re-derived by a reproducible command | met | `agents/evidence/analysis/tenth-arrival-coverage-2026-09-04.md`, step 2.1 |
| **expanded** with a positive and a near-miss per addition | **not met** | this file |
| activation published at that coverage, null included | met | `docs/CLAIMS.md § skill-activation-census-zero`, step 2.3 |

## The unmet conjunct, reproduced today with one file rather than fourteen

`agents/evidence/analysis/trigger-corpus-wave2-deferred-2026-09-04.md` records a
14-file wave that reddened 8 tests in 3 files and was reverted. That is a
14-variable experiment. The claim it supports — that the corpus cannot grow at
`src/skills/*/evals/triggers.json` without moving published records — is
reproduced here at n=1, which is the sharper form: one file is the smallest
possible addition, so nothing about the *choice* of files can be the cause.

One preserved corpus file was restored to `src/skills/ai-council/evals/triggers.json`
from that artefact's own preservation block, the gates were run, and the file was
removed with `rm` (it was untracked; no `git checkout` was used).

Corpus-local gates, with the file present — all green, and coverage ratchets UP:

```
$ ./scripts-run src/scripts/check_routing_coverage
  = rules    94 / 105  = 0.8952  (seed 0.8952)
  ↑ skills  101 / 299  = 0.3378  (seed 0.3344)
✅  routing coverage at or above seed in both scopes.

$ ./scripts-run src/scripts/lint_skill_trigger_corpus
lint_skill_trigger_corpus: 101 corpus file(s) hold the discipline (>=3 positives,
>=2 near-misses; 2 grandfathered by name).
```

The three published pins, same tree, same moment:

```
$ npx vitest run tests/scripts/trigger_corpus_holdout_pin.test.ts \
                 tests/scripts/routing_signal_measurement.test.ts \
                 tests/scripts/delivery_set_compatibility.test.ts

 Test Files  3 failed (3)
      Tests  6 failed | 27 passed (33)

× trigger-corpus holdout pin > the published SET-SHA256 reproduces from the tree
    expected '0667fbd96d7d1da88368d4d587545ff034752…' to be '76a7584fa97244f6f6e0045b1e4c4f3db8709…'
× trigger-corpus holdout pin > every per-file row reproduces from the tree
    expected [ 'ai-council' ] to deeply equal []
× 5.1 — the partition is not vacuously all-train        expected 101 to be 100
× 5.1 — the catalogue and the corpus are both large     expected  83 to be  82
× 5.1 — the published verdict reproduces from the tree
× 6.4 — every metric and every pair reproduces
    precision_at_k 82.45 against 82.353 published
```

Baseline before and after the probe: `Test Files 3 passed (3) · Tests 33 passed (33)`.

**The asymmetry is the finding.** The gates that are *about* the corpus cannot
see the problem — they check corpus-local shape and one of them reports the
addition as progress. The three that go red are reproduce-from-tree pins over
records published elsewhere.

## Why the pins move, and why re-pinning is not a smaller fix

The recipe in `agents/evidence/analysis/trigger-corpus-holdout-2026-08-30.md:58-67`
hashes a line per file over the **whole glob**, so the set hash is a function of
the file set and not of any 100 named members. `src/scripts/_lib/routing_corpus.ts:131`
and `:145` enumerate the same glob for the train/holdout loader. Any file at that
path moves all three records; no file at any other path is counted by
`check_routing_coverage`, whose declared measurement is
`src/skills/*/evals/triggers.json over src/skills/*/SKILL.md`
(`src/config/routing-coverage-seed.json:9`, `owner: maintainer`).

The frozen artefact reserves the question rather than leaving it open by
omission (`:245-249`):

> It freezes the files that exist, not the ones that will. A corpus authored in
> wave 2 is outside this frozen set. Whether it joins the holdout, joins the
> train set, or forms a second frozen generation is a Phase 5 decision.

and of its partition rule (`:38-41`): *"A change is legal; a silent change is the
compromise this step exists to prevent."* The Phase 5 it names belongs to
`road-to-governed-harness-evolution`, which is archived; its AC-6
(`agents/roadmaps/archive/road-to-governed-harness-evolution.md:2807`) asserts the
frozen hash predates the first proposer commit, verified by
`git merge-base --is-ancestor 34318f7f ac2501313`. A re-pin taken now post-dates
that proposer, so the generation it certifies is no longer the one AC-6 is about.

A council round on 2026-09-04 (2 seats, 2 rounds, quorum 2/2) had already settled
the shape of the durable fix: *an explicitly versioned second corpus generation
with its own partition provenance, never a rewrite of the first generation's
pins.* What it did not settle is what happens to AC-3 in the meantime.

## The council round on the disposition — 2026-09-05

Question: `agents/runtime/council/questions/tenth-arrival-ac3-disposition.md`
(gitignored, local-only). Response:
`agents/runtime/council/responses/tenth-arrival-ac3-disposition.json`.
Members: `anthropic/claude-sonnet-4-5` + `openai/codex-default`, 2 rounds,
quorum 2/2 concluded, $0.00 — both seats subscription-authed.

Options put to it, unweighted and in no stated preference order: **A** defer AC-3
to a follow-up created in the same change and archive · **B** leave AC-3 open with
a blocker and do not archive · **C** build the second generation now · **D** cancel
AC-3 to `[-]` with the finding recorded · **E** something else.

**Convergent on A**, both seats, with the same two conditions.

- *anthropic*: "A (defer to follow-up via council), with conditions… Does not
  drop, weaken, or accept loss IF the follow-up owns the full obligation."
- *openai*: "Council-approved A is the correct disposition; B is the safe interim
  state, C is feasible but oversized, and D unambiguously requires the owner."

Both seats independently routed **D to the owner** on the rule's own words
(`src/rules/roadmap-progress-sync.md:82`, *"Cancel to `[-]`, keep-in-archive,
scope cut | user, and no mandate lifts it"*), and both rejected the reading that
cancellation-with-a-finding is a council-decidable scope call.

Both seats also stated, and it is recorded here rather than smoothed over, that
**C is technically feasible** — the frozen record permits a non-silent change.
The deferral is a judgement about scope and reviewability, not about
impossibility. *openai*: "'blocked' is slightly misleading. The criterion is not
technically blocked; its originally implied implementation is blocked by
generation-1 invariants."

Conditions attached by both seats, all of which this change meets:

1. AC-3 marked `[~]`, naming only the unsatisfied conjunct.
2. The successor roadmap created in the **same** change, before archival.
3. The successor owns the **complete** remaining obligation, not "decide
   generation 2" — an executable end state with a completion gate.
4. Estate compliance demonstrated.
5. Archival authorised explicitly rather than following automatically from the
   glyph.

## What the council did not resolve

Whether the trigger corpus predicts anything about host behaviour at all. Step
2.3 of the same roadmap measured activation at **0** invocations over 30 sessions
and 11,049 assistant turns, and `evals/triggers.json` is read by three gates and
by no host at routing time. Both seats reframed AC-3 as a
measurement-governance criterion rather than a routing one, and *openai* attached
the consequence: "generation 2 should not be built merely to raise a corpus-count
numerator whose relationship to host behavior is unspecified." That question is
carried into the successor as its own step and is not answered here.

## Route

`src/rules/roadmap-progress-sync.md:80` — *"Carry item **and** blocker into a
named follow-up roadmap created in the SAME change and estate-ratchet compliant |
council"*. Receiver: `agents/roadmaps/road-to-second-trigger-corpus-generation.md`,
linked from both ends per `src/agent-src/scripts/archive_completed_roadmaps.ts:387-505`
— `<!-- deferred-resolution: carried-to=… -->` on the item, `parent_roadmap:` in
the receiver's frontmatter.
