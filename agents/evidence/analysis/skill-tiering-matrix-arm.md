# Tiering, the deterministic arm — what can be settled without a host

<!-- evidence-type: analysis -->

> **Produced by:** Phase 4.1 of `road-to-skill-delivery-over-mcp`.
> **Measured:** 2026-08-23 at commit `53ac0adb4` (branch `drain/skill-delivery-over-mcp`, after merging origin/main).
> **Reproduce:** `./scripts-run src/scripts/compute_skill_tiers --json`,
> `./scripts-run src/scripts/measure_skill_ranker_baseline --commit <sha>`, and
> `./scripts-run src/scripts/capture_skill_catalogue --projection-modes`.
> **What it does NOT settle:** H1. See § The question this arm cannot answer.

## The two hypotheses, and which one is decidable here

The roadmap pre-registered both:

- **H1** — a `tiered` install yields **more correct skill invocations per
  session** than `legacy-all`, and **not more** unintended activations.
- **H2** — the server's push-side cost plus the Tier A listing is **below** the
  current catalogue bucket.

H2 is arithmetic and is settled below. H1 requires observing what a model
actually does and is **not computable here** — which is the finding this arm
contributes, not a gap in it.

## The corpus, and a correction to the step's premise

The step says to replay "the 496-line corpus". Two problems, both measured:

1. `tests/eval/routing-matrix/` is labelled with the expected **rule** and never
   an expected skill, so no skill-level classification can be computed over it.
   The only expected-skill ground truth in this tree is
   `tests/eval/corpus-dev.yaml` + `corpus-non-dev.yaml` — **26 labelled
   prompts** — and that is what this arm uses.
2. 496 is stale regardless: the matrix holds **499** prompts at this commit. The
   old figure is still published at `src/scripts/hooks/skill_route_hook.ts`,
   `src/scripts/hook_manifest.yaml`, `src/config/hook-token-budget.json` and in
   the roadmap. Correcting those sites is out of this roadmap's scope; the drift
   is recorded so nobody re-derives from 496 again.

26 is a small denominator and is stated as such: one prompt moves any rate here
by ~4 points. It is the whole labelled ground truth that exists.

## The three counts, per mode

A prompt counts as **listed-with-description** when *any* of its expected skills
is Tier A — a model needs one good route, not all of them.

| | listed with description | listed bare | reachable only via the tool |
|---|---|---|---|
| `legacy-all` | 5 | 21 | 0 |
| `tiered` | 5 | 0 | 21 |

Tier split at this commit: **Tier A 44, Tier B 250, of 294** (fill order
`alphabetical-fallback`, 0 usage rows).

Every expected skill in the corpus resolves to one of the two tiers — 0 unknown —
so the table has no residual.

### What the table actually says

**81% of the labelled corpus (21 of 26) has its expected skill in Tier B.** So
`tiered` is not a marginal change to this corpus: it converts four fifths of it
from *listed-but-bare* to *tool-only*. That is the whole bet, stated as a number:

- Under `legacy-all`, those 21 prompts see a **name with no description**. The
  description is the surface a model selects on, so the route is weak but present.
- Under `tiered`, they see **nothing at all** natively, and the route exists only
  if the model calls `suggest_skill_for_task`.

Neither column is obviously better, and this arm cannot rank them.

## H2 — settled, and the honest reading is not the flattering one

| quantity | chars | tokens (chars/4) |
|---|---|---|
| all 294 descriptions, per-entry-capped | 52,010 | 13,003 |
| Tier A descriptions only (44) | 7,822 | 1,956 |
| lite server `tools/list` payload | 887 | 222 |
| server `instructions` | 325 | 81 |
| **`tiered` push total** | — | **2,259** |

**H2 holds as written: 2,259 < 13,003.** Two caveats, both load-bearing.

**The bucket is 13,003, not the 14,408 the roadmap states.** The catalogue has
changed since that figure was taken. 13,003 is the reproducible number at this
commit.

**And the comparison is against a counterfactual, not against today's spend.**
The host does not deliver 13,003 tokens of descriptions — it caps at ~8,000
chars, i.e. it already delivers only the 7,822 chars of Tier A, about **1,956
tokens**. So against what a default install actually pays today:

```
legacy-all (actual, today)   1,956 tok
tiered     (actual, today)   2,259 tok   ← +303 tok, i.e. MORE
```

**`tiered` costs more standing context than `legacy-all` on a default install,
not less.** The 82% saving only materialises for a consumer who has raised
`skillListingBudgetFraction` toward 100% delivery — and for that consumer, simply
leaving it raised is the competing option (`docs/mcp-server.md` § Lever 1).

This is not a defeat for the phase and it is not a surprise the roadmap failed to
anticipate: its own Goal section says "'Smaller context' is a *consequence* this
roadmap measures, not a goal it assumes", and the honest target is *routable
skills per standing token*. The number above is what that target costs. It does
mean the case for `tiered` rests **entirely** on H1 — on the tool being called —
and not at all on context savings.

## The question this arm cannot answer

H1 asks what a model does. Three specific things are unobservable from the file
system, and each of them decides the sign of H1:

1. **Whether a bare name still routes.** A model may select a skill from its name
   alone often enough that `legacy-all`'s 21 bare entries are adequate. Nothing
   here can measure that.
2. **Whether the tool gets called.** The AAIF working group measured models
   ignoring skills served over MCP and reaching for tools instead, with adherence
   *declining as context grew*. That is the prior, and it is unfavourable.
3. **The tier split's own accuracy.** The split here used the alphabetical
   fallback, and `tests/scripts/host_listing_model.test.ts` pins that fallback
   disagreeing with the one real host observation on **four of eight** sampled
   entries. So the 21/5 division above is itself a prediction.

Point 3 is the sharpest: an arm that classifies 21 prompts as Tier B using an
order the tree can show to be wrong cannot also be the evidence that acting on
that classification is safe.

## Disposition

H2: **holds**, with the two caveats above published rather than dropped.
H1: **not established**, and not establishable without a live arm. `tiered`
therefore stays opt-in, which is what Phase 4.4 records.
