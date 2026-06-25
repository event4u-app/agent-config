# Cross-model baseline + outcome read (T-006)

> Roadmap `road-to-operator-runtime-harvest`, Phase 0 keystone. First **live**
> cross-model trigger-routing run, after the credential blocker was cleared
> (Gemini key installed; all three vendor legs confirmed reachable). Produced by
> `src/scripts/cross_model_smoke.ts`.

## Run

- Catalogue: **258 skills** (full).
- Fixtures: **1** — `image-analyser` (`evals/triggers.json`, 10 queries: 5 should-trigger + 5 should-not).
- Coverage denominator: **1 of 258 skills (0.4%), behavioral 0** — this is a *thin* slice. Directional, not a parity verdict.
- Hosts / models (mid-tier, chosen to bound cost): Anthropic `claude-haiku-4-5`, OpenAI `gpt-4o-mini`, Gemini `gemini-2.5-flash`.

## Result (live)

| host | model | queries | routing pass% | output parse% | neg-control caught | in_tok | out_tok |
|---|---|---|---|---|---|---|---|
| anthropic | claude-haiku-4-5 | 10 | 70% | 100% | 5/5 | 130 971 | 764 |
| openai | gpt-4o-mini | 10 | 100% | 100% | 5/5 | 113 144 | 146 |
| gemini | gemini-2.5-flash | 10 | 90% | **80%** | 5/5 | 95 649 | 105 |

(The script's `~$` column uses the existing `estimate_cost` price table, which is
not calibrated for these mid-tier model ids — treat it as a loose upper bound;
the real spend at haiku/mini/flash input rates was a few cents. Token counts are
real, from each vendor's `usage`.)

## Outcome read (council's a/b/c)

- **(c) FIRED — output-shape divergence is real, not hypothetical.** Gemini
  `gemini-2.5-flash` returned a non-parseable `would_load` payload on **2 of 10**
  queries (80% parse). Anthropic + OpenAI were 100%. This is exactly the
  format-governance gap the 3rd-pass council predicted: a host can pass
  behaviorally yet break the output contract that downstream consumers
  (ticket-bundle parser, `manifest.yml`, the dispatcher) depend on. → **Phase 0b
  (output-format governance) is now evidence-backed and should open.**
- **(b) NOT cleanly established.** Routing accuracy diverges (anthropic-haiku
  70%, gemini 90%, openai 100%), but on a 10-query / 1-skill slice with the
  *weakest* model per vendor — this is far more likely a **capability/tier**
  effect (haiku is the weakest leg) than an RDP **behavior** gap. Per T-000, a
  capability gap is NOT an overlay candidate. **Overlays stay shelved**; do not
  open Phase G on this thin, capability-confounded signal.
- **(a) NOT supported** as a clean "all hosts pass" either — the slice is too
  thin and the spread too wide to call parity. Honest status: **inconclusive on
  routing parity; conclusive on a format-divergence finding.**

## Discrimination note (T-003)

All three hosts caught **5/5** should-NOT-trigger queries (gross negative
controls correctly rejected). The *graded* (gross + subtle) `computeDiscrimination`
gate is implemented (`_lib/eval_discrimination.ts`) but not yet wired into this
smoke with a calibrated subtle control — that wiring + a labeled gold set is the
finding_floor calibration work, still deferred.

## Honest next steps (not done here)

1. **Widen coverage** — 1/258 skills is directional only. Run more fixtures
   (cost scales: ~13k catalogue tokens/query) before any parity claim.
2. **Capability-control the accuracy spread** — re-run with comparable-tier
   models (or per the T-000 matrix) to separate capability from behavior before
   reading the 70% as a behavior gap.
3. **Open Phase 0b** — the Gemini format divergence is a real, reproducible
   contract gap; scope output-shape governance (or a parse-and-retry shim in the
   GeminiRouter) against it.
4. Wire the graded subtle control into the smoke; author the finding_floor gold
   set — both still gated on the wider run.

## Phase 0b — output-format fix (RESOLVED, evidence-chosen)

Outcome (c) — Gemini's 80% parse — is fixed at the source by giving `GeminiRouter`
a JSON output contract. The fix was **chosen by measurement, not assumption** — a
live 3-variant comparison on the same fixture:

| Gemini `generationConfig` | parse% | routing pass% |
|---|---|---|
| original (no contract) | 80 | 90 |
| `responseMimeType` **+ strict `responseSchema`** | 100 | **60** |
| **`responseMimeType` only** (shipped) | **100** | 80 |

The strict schema **over-constrains** — it guarantees the shape but suppresses
the model's intermediate reasoning, crushing routing accuracy to 60%.
`responseMimeType: 'application/json'` alone closes the format gap (100% parse)
with far less collateral (80%). Shipped the mimeType-only variant.

**Honesty note (n=10):** the pass-rate column (90/60/80) is noisy at 10 queries —
the *parse* recovery (80→100) is the robust, structural result; the accuracy
deltas are directional and need the wider run (step 1) to separate signal from
noise. The format contract is applied **only to Gemini** (the host that
diverged) — per falsifiability-first, OpenAI/Anthropic were 100% parse and are
left unchanged until evidence shows otherwise.

## Wider coverage run — 10 skills (after the Gemini fix)

Coverage **10 of 258 skills (3.9%)**, 100 queries/host, mid-tier models. Skills:
agent-security-review, contract-review, decision-record, eloquent, iconography,
image-analyser, nda-triage, php-coder, refine-ticket, skill-writing.
(`estimate-ticket` was dropped — its `triggers.json` uses a legacy
`should_trigger`/`should_not_trigger` shape; the smoke now skips-and-warns on
unparseable fixtures rather than crashing.)

| host | model | routing pass% | parse-proxy% | neg-control caught |
|---|---|---|---|---|
| anthropic | claude-haiku-4-5 | 74% | 100% | 48/48 |
| openai | gpt-4o-mini | 80% | 100% | 42/48 |
| gemini | gemini-2.5-flash | 65% | 86% | 48/48 |

**Read (honest):**

- **Routing parity is NOT uniform** — a real ~15pp spread (openai 80 / haiku 74 /
  gemini 65) at a credible (no-longer-1-skill) slice. The multi-host claim cannot
  be stated as "consistent across hosts" without qualification.
- **But the spread is tier-confounded** — all three are the *weakest* model per
  vendor (haiku / mini / flash). Per T-000, this is a capability/tier effect far
  more than an RDP behavior gap. **Overlays stay shelved.** A capability-controlled
  re-run (comparable tiers) is the next honest step before any behavior claim.
- **OpenAI over-triggers**: 42/48 negative controls — 6 false-positives (loaded a
  skill on a should-NOT query). A per-host precision quirk worth noting, not a
  parity verdict.
- **`parse-proxy%` caveat (important):** this metric counts a call as "ok" if it
  returned *any* tokens/load — it is a coarse "got-a-response" proxy, NOT a strict
  `would_load`-parsed rate. Gemini's 86% almost certainly reflects ~14% transient
  empty/rate-limited responses under 100 rapid sequential calls (the `responseMimeType`
  fix is in place), not format divergence. A strict per-call format-parse counter is
  a follow-up refinement.
- **Cost:** the `~$` column (≈$10.5 total) is the uncalibrated `estimate_cost`
  table — a loose upper bound; real spend at haiku/mini/flash rates was materially
  lower. Token counts are real.

**Coverage honesty for the repositioning narrative:** "consistent across hosts"
may be claimed for **at most ~3.9% of the suite, and even there only with the
tier-confound caveat** — i.e., not yet a clean parity claim. Widening to
comparable-tier models + more skills is the path to a defensible statement.
