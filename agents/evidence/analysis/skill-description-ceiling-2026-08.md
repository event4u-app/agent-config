<!-- evidence-type: analysis -->
# The skill-description ceiling — measured, argued, and priced honestly

**Measured:** 2026-08-22 · **n = 290 skills** · **Basis:** chars/4 (proxy), named as such
**Instrument:** `./scripts-run src/scripts/tighten_skill_descriptions --cap <n>`

## The distribution the old ceiling described

    median 181 · p75 189 · p90 195 · max 200 · min 133 · over 220: 0 · over 200: 0

`src/scripts/schemas/skill.schema.json` carried `"maxLength": 220`. **It described no
artefact that existed.** Every description in the tree already sat at or under 200, and
the distribution is compressed hard against that recommended line — so the
*recommendation* was the binding constraint and the *ceiling* was 20 × 290 chars of dead
headroom that a future author could fill with no gate objecting.

## Decision: hard ceiling 200, recorded soft target 189

**200 is free.** Zero descriptions exceed it, so lowering 220 → 200 costs no rewrites
and converts dead headroom into a ratchet — the same move this repo's own
`preamble-payload-budget.json` records as *"free tightening … a lower measurement
becomes the new ceiling instead of becoming unused headroom."*

**189 (p75) is the recorded target, not a hard line, and here is the argument.**

| Cap | Descriptions over | chars returned | ≈ tok returned | Share of the 135,407-tok payload |
|---|---|---|---|---|
| 200 | 0 | 0 | 0 | 0 |
| **189 (p75)** | **72** | **352** | **~88** | **0.065 %** |
| 180 | 149 | 1,415 | ~354 | 0.26 % |
| 170 | 214 | 3,296 | ~824 | 0.61 % |
| 160 | 242 | 5,592 | ~1,398 | 1.03 % |
| 150 | 259 | 8,106 | ~2,026 | 1.50 % |
| 120 | 290 | 16,576 | ~4,144 | 3.06 % |

**Rejected, with reasons:**

* **189 as a HARD cap** — it forces 72 edits to the routing surface to return 88 tokens.
  The tokens are not the problem; the asymmetry is. A description that loses its trigger
  phrase costs more in missed routing than the entire cap returns, and the return here is
  0.065 % of standing payload.
* **160** — the first cap that returns a whole percent, at 242 rewrites. That is the
  routing surface of five sixths of the corpus rewritten for ~1 %.
* **120** — 290 rewrites for 3.06 %. This is the honest ceiling of the entire lever, and
  stating it is the point: **no description cap closes the payload gap.** The measured
  total is 135,407 against a ceiling of 107,646; the most brutal cap available returns
  4,144. The gap is a rules-corpus problem, not a catalog problem.

**The AI council went further than "insufficient", 2/2, and the sharper word is the
right one: the lever is STRUCTURALLY WRONG for this gap.** 4,144 tok against an overage
of ~27,761 is **15 %** of the excess, not 3 % of the payload — and framing it as a
percentage of the payload understates it. One seat: *"The stub proposed treating a
total-payload-size problem as a per-skill-description problem. We now know that can't
work."* The other: *"Neither proposed lever has demonstrated control over the intended
outcome."* Recorded here rather than only in the council file so the next pass that
reaches for the description cap meets the arithmetic first.

## What was actually applied, and the delta

`tighten_skill_descriptions --cap 189 --apply` shortened **27** of the 72 over-target
descriptions by **113 chars ≈ 28 tok**, using a closed list of four audited,
meaning-preserving transformations (`Use when X` → `When X`, `in order to` → `to`, Oxford
comma removal, whitespace collapse) with a hard guard: the informative-token **set** must
come out identical, so a transformation that swapped one content word for another is
refused even when it shortens.

**Catalog bucket: 14,408 → 14,379 tok** (`check_preamble_payload_budget`). Both figures
are the gate's own chars/4 proxy, compared against each other — not a proxy figure set
against an exact-tokenizer one.

Gates after the batch: `lint_skill_descriptions` → 290 scanned, 0 defects.
`validate_frontmatter` → 440 artefacts, 0 failing. `skill_linter` → 0 fail.

## The correction that matters: the 45 misses are NOT trigger-loss walls

The commissioning roadmap's AC-5 expected the remainder to be *"skills whose description
could not shorten without losing a trigger"*. **Measured, none of them is.**

Every one of the 45 still holds between **39 and 112 chars of removable filler** against
a need of **6 to 11 chars**. The wall is the conservatism of *this tool's* transformation
list, not the trigger vocabulary. A hand rewrite is available for all 45 and would return
the modelled ~88 tok in full.

The reason not to run it is therefore a **decision, not an inability**: 45 hand edits to
the routing surface for 60 tokens more. Recorded that way so nobody reads the table below
as "these cannot be shortened" — they can, and the cost/benefit says don't.

**Reversal condition.** If the payload ceiling ever becomes binding by a margin under
~100 tok, the 45 are sitting there. Nothing else about them changes.

### The 45, with their real reason

| skill | len | over | filler left |
| `license-compliance-audit` | 200 | +11 | 112 |
| `brand` | 198 | +9 | 67 |
| `blast-radius-analyzer` | 197 | +8 | 105 |
| `llm-provider-knowledge` | 197 | +8 | 88 |
| `supply-chain-intake` | 197 | +8 | 90 |
| `verify-repair-loop` | 197 | +8 | 101 |
| `brand-identity` | 196 | +7 | 78 |
| `pixar-storyteller` | 196 | +7 | 49 |
| `project-analysis-core` | 196 | +7 | 39 |
| `reasoning-orchestrator` | 196 | +7 | 78 |
| `test-case-discovery` | 196 | +7 | 91 |
| `video-director` | 196 | +7 | 47 |
| `dcf-modeling` | 195 | +6 | 98 |
| `design-intelligence` | 195 | +6 | 68 |
| `design-tokens` | 195 | +6 | 78 |
| `gated-reach` | 195 | +6 | 150 |
| `fe-design` | 194 | +5 | 110 |
| `overbuild-review-lens` | 194 | +5 | 113 |
| `privacy-review` | 194 | +5 | 75 |
| `rtk-output-filtering` | 194 | +5 | 76 |
| `judge-test-coverage` | 193 | +4 | 78 |
| `md-language-check` | 193 | +4 | 93 |
| `pdf-tools` | 193 | +4 | 98 |
| `security-maturity-assessment` | 193 | +4 | 97 |
| `standards-from-config` | 193 | +4 | 90 |
| `terragrunt` | 193 | +4 | 87 |
| `agent-security-review` | 192 | +3 | 77 |
| `evaluate-llm-feature` | 192 | +3 | 76 |
| `forecast-accuracy` | 192 | +3 | 73 |
| `prediction-pool-optimizer` | 192 | +3 | 64 |
| `ai-code-blindspots` | 191 | +2 | 66 |
| `api-testing` | 191 | +2 | 76 |
| `grafana` | 191 | +2 | 86 |
| `image-creator` | 191 | +2 | 73 |
| `project-analyzer` | 191 | +2 | 51 |
| `root-cause-frameworks` | 191 | +2 | 98 |
| `screenshot-hygiene` | 191 | +2 | 71 |
| `spreadsheet-authoring` | 191 | +2 | 74 |
| `error-handling-patterns` | 190 | +1 | 61 |
| `frontend-render-security` | 190 | +1 | 62 |
| `incident-commander` | 190 | +1 | 97 |
| `judge-synthesis` | 190 | +1 | 65 |
| `memory-consolidation` | 190 | +1 | 59 |
| `php-debugging` | 190 | +1 | 99 |
| `stakeholder-tradeoff` | 190 | +1 | 108 |

`filler left` is deliberately generous — it counts every stopword occurrence and every
separator run — so a small number would be a strong claim that a cut must take an
informative token. The smallest here is 39 against a need of at most 11, which is why the
paragraph above says what it says.
