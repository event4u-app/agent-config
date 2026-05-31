---
stability: beta
keep-beta-until: 2026-08-28
---

# Value Dashboard Spec — what the package costs and what it saves

> Contract for `docs/value.md` — a single human-readable dashboard that
> answers the owner's question *"what does this package cost me and what
> does it save me, in plain numbers a non-expert can read"*. Companion
> to [`value-report-schema.md`](value-report-schema.md) which owns the
> per-report JSON shape this contract layers semantics onto.

## Scope

This contract covers the **dashboard surface** that consolidates three
existing measurement systems (A/B `docs/benchmark.md`, telegraph
`internal/bench/reports/telegraph-v*`, frugality
`agents/runtime/frugality/baseline.jsonl`) into one two-panel page. It
does **not** redefine the underlying measurement contracts — it is a
derived view on top of them, and the raw reports remain the
machine-readable source of truth.

## Source

- **Chat thread:** 2026-05-27 (the owner's verdict: *"Aktuell bringen
  diese Benchmarks nichts. Ich weiß worum es geht und verstehe sie nicht
  mal."*)
- **Roadmap:** `agents/roadmaps/road-to-readable-value-dashboard.md`
- **Extends:** archived `road-to-package-impact-benchmark.md` (A/B
  surface) and archived `step-4-measurement-and-benchmark.md`
  (telegraph + selection bench).

## Producer / consumer surface

| Concern | Owner |
|---|---|
| Rung normalisation (raw report → `value-v1` rung) | `scripts/_lib/value_ladder.py` |
| `value-v1` JSON assembly | `scripts/_lib/value_report.py` |
| rtk savings measurement (new) | `scripts/bench_rtk_savings.py` + `internal/bench/corpora/rtk/commands.yaml` |
| Rendered dashboard | `scripts/render_value_md.py` → `docs/value.md` |
| Dashboard linter | `scripts/lint_value_dashboard.py` |
| Task orchestration | `taskfiles/value.yml` (`task value*`) |

## Canonical output path

**Decision (2026-05-28):** the dashboard lives at **`docs/value.md`**,
a sibling of (not a replacement for) `docs/benchmark.md`.

Rationale:

- `docs/benchmark.md` is the A/B-technical appendix (cache key,
  methodology, integrity check, history). It serves a different reader
  — a maintainer auditing the variant axis — and already has a
  contract, schema, and renderer. Replacing it would either lose the
  technical surface or bloat the dashboard.
- `docs/value.md` is the human dashboard — the page a non-developer
  opens to answer the cost/value question. It is derived (no raw
  measurement happens here; the renderer reads existing reports).
- The two pages cross-link: `value.md` links down to `benchmark.md` for
  the methodological detail; `benchmark.md`'s Track A row is reframed
  in Phase 4 Step 5 to point a reader who wants impact at `value.md`.

## Two panels

### Panel A — Cost ladder (cumulative, min → max)

The package's full cost picture as a layperson reads it top-to-bottom.
Each rung is a measurement (or a clearly-marked `pending` placeholder),
not a marketing number. The ladder is **honest about the up-front
cost**: installing the package first *adds* input tokens (rules load
into context); condense + rtk + terse then claw that back. The
**NETTO** line is the real answer.

Rung order:

1. **Ohne Paket** — baseline. Token delta = 0. Reference rung; the
   ladder is computed relative to this.
2. **Mit Paket (Regeln laden)** — the honest up-front cost. The
   always-loaded kernel + router footprint added to every request's
   input. Token delta is *positive* (the rule body lands in context).
   Source: `metric_a_footprint` from `frugality/baseline.jsonl`.
3. **+ condense** — the input-side carve-out savings from
   condensation (`.agent-src.uncondensed` → `.agent-src`). Source:
   `internal/bench/reports/telegraph-v2.json`. **Excludes Thin-Root
   files** (AGENTS.md variants — they net negative); the Thin-Root
   caveat surfaces as a footnote, not a hidden exclusion.
4. **+ rtk** — output-side savings on verbose CLI output that the
   agent would otherwise pipe into its context. New measurement:
   `scripts/bench_rtk_savings.py` against
   `internal/bench/corpora/rtk/commands.yaml`. `pending` when `rtk`
   is not installed (with install hint per `missing-tool-handling`).
5. **+ terse (telegraph)** — output-side carve-out from
   telegraph-condensed agent replies vs. a "be concise" control.
   Source: `telegraph-v1` `vs_terse`. **Measured median is negative
   today** (−9.27%); the rung renders with its real value and a
   one-line "why" note. Decision in this spec (see § "Terse rung
   honesty" below): render as a rung with the negative value, do
   not move to Panel B.

The renderer prints, per rung:

- **label** — short German + English ("Mit Paket / +load")
- **what-it-does** — one phrase a non-developer understands
- **token_delta** — signed integer (positive = adds tokens)
- **eur_delta** — token_delta priced at the reference scale below
- **cumulative_pct** — running cumulative as % of baseline request
  size
- **confidence** — `measured` | `estimated` | `vendor-claim` |
  `pending`
- **source_report** — relative path to the raw report this rung
  was derived from (`pending` rungs cite the report that *would*
  produce them)

### Panel B — Behaviour (with vs. without)

The package's strongest value, currently unmeasured live. Four
metrics, each carrying `with` / `without` / `delta` plus a run
`mode` (`live` | `dry-run`) so a dry-run number can never
masquerade as evidence.

1. **Right-skill selection** — the existing selection-accuracy
   bench (`tests/eval/corpus-dev.yaml`, top-K hit rate). The
   bench already exists; surface its `with` vs. `without` result.
2. **Destructive-op stops** — the 5 destructive/security prompts
   already defined in `benchmark-corpus-spec.md`. For each:
   does the agent refuse / stop / ask before the destructive
   action? Metric: `stops: N/5 vs M/5`. This is the safety value
   the Hard-Floor rules deliver — currently unquantified.
3. **Ask-vs-act ratio** — from the existing A/B Track B runner
   when run in `--mode live`. Lower ratio = more decisive agent
   under autonomy mandate (`personal.autonomy: on`).
4. **Task completion rate** — A/B Track B `completion_rate`,
   `with` vs. `without`. `live` mode required for evidence;
   `dry-run` runs are clearly badged and excluded from the
   headline number.

The renderer prints, per metric: label · what-this-means caption ·
with · without · delta · mode badge (`live` / `dry-run`).

## Ladder rung data model

Every rung in the `cost_ladder` array carries:

```yaml
id: <kebab-case>                  # e.g. "load", "condense", "rtk"
label: "<German + English>"       # e.g. "Mit Paket (Regeln laden)"
what_it_does: "<one phrase>"      # plain language, ≤ 80 chars
token_delta: <signed int>         # per-request input token delta
eur_delta: <float>                # token_delta priced at reference scale
cumulative_pct: <signed float>    # running cumulative as % of baseline
confidence: measured | estimated | vendor-claim | pending
source_report: <relative path>    # the raw report this was derived from
footnote: "<optional caveat>"     # e.g. "Thin-Root files excluded"
```

`token_delta` is the per-request delta (single request, average
shape). `eur_delta` is computed at the **reference scale** below.

## Reference scale

- **1,000 requests per measurement period** (default reference).
- **Average request shape:** ~8 k input tokens / ~600 output
  tokens (matches the A/B Track B median observed in the
  available reports).
- **Model tier:** Sonnet (default development model in the
  repository's `.agent-settings.yml`). Token→€ conversion reads
  `internal/bench/pricing.yaml` row `sonnet`. If the user picks
  another tier, the renderer recomputes against that row.

The reference scale is documented inline in `docs/value.md` (the
glossary block); the renderer never silently changes it.

## Confidence taxonomy

| Marker | Meaning |
|---|---|
| `measured` | Derived from a raw report under `internal/bench/reports/` produced by an in-repo script |
| `estimated` | Computed by `value_ladder.py` from primary measurements (e.g. cumulative %) |
| `vendor-claim` | Quoted from an upstream source without local measurement (used for context, never the headline) |
| `pending` | The rung exists in the schema but no measurement is available yet |

Never label a `pending` rung `measured`. Never render a negative
number under `confidence: measured` as a "saving" — the linter
catches this.

## Panel B rule attribution (telemetry)

The `behaviour` block's `with`-arm value is driven by rules the agent
activates while solving each task. The router-telemetry replay
(Phase 3 of `road-to-value-dashboard-netto-cuts`) writes per-corpus
hit counts to `internal/bench/reports/router-telemetry/latest.json`.
Two fields gate the optimisation pass:

- `panel_b_untouchable_rules` — tier-1 rules that activated on at
  least one Track B task. **Hard floor for Phase 5 dead-rule audit**
  — these rules are not candidates for demotion or deletion.
- `panel_b_tier2_drivers` — tier-2 rules that activated on Track B.
  Documented for transparency; tier-2 rules already lazy-load per
  the rule-router contract, so no roadmap touches them, but if a
  future phase ever cuts tier-2, this list is the floor.

The 2026-05-28 replay against the 13-task Track B corpus surfaced
**zero tier-1 rules** in the Panel B activation set; the three
tier-2 drivers were `domain-safety-pii`, `downstream-changes`,
`model-recommendation`. Phase 5's audit therefore has free reign on
the 20 never-matched tier-1 rules.

## Behaviour-metric set

Each metric in the `behaviour` block carries:

```yaml
id: <kebab-case>                  # e.g. "selection", "destructive-stops"
label: "<German + English>"
what_this_means: "<one line>"     # plain language caption
with: <value>                     # metric-specific (pct, count, ratio)
without: <value>
delta: <signed value>             # with - without
unit: pct | count | ratio | seconds
mode: live | dry-run
source_report: <relative path>
```

## Terse rung honesty

The `telegraph-v1` `vs_terse` median is **−9.27%** — telegraph-style
output is *more verbose* than a "be concise" control in the measured
corpus. This roadmap considered two options:

1. Render the rung in Panel A with its real (negative) value and a
   one-line "why" caption.
2. Move telegraph from Panel A to Panel B as a quality lever (impact
   on the agent's output style) rather than a cost saver.

**Decision (2026-05-28):** option 1. The page's credibility is the
product (per the non-goals section of the roadmap). Hiding the
negative number — even by relocating it to a "quality" panel —
would betray the for-dummies-honest framing. The rung renders with
its measured value, `confidence: measured`, and a caption: *"In
unserem Testkorpus liefert Telegraph mehr Tokens als ein neutrales
'sei knapp' — wir messen, wir verstecken nicht."*

## Glossary (rendered into `docs/value.md`)

Plain-language one-sentence definitions for the non-developer
reader. The glossary block is the source-of-truth; the renderer
copies it verbatim into the dashboard.

- **Token** — the unit a language model bills in. Roughly: one
  token ≈ 4 characters of English / German prose. 1,000 tokens ≈
  750 words.
- **Input tokens** — everything the model reads each turn
  (system prompt, rules that load every request, your message,
  prior conversation). The package adds rules here, so installing
  it costs input tokens.
- **Output tokens** — what the model writes back. Usually fewer
  than input. Per-token output costs more than input.
- **condense** — a build step that shrinks the rule files
  before they ship (`.agent-src.uncondensed` →
  `.agent-src`). Saves input tokens on every request.
- **rtk** — the *Rust Token Killer*, a CLI wrapper that strips
  verbose output (`git status`, lint output, test runners) before
  the model reads it. Saves input tokens on tool calls.
- **terse / telegraph** — a style of output (short phrases,
  dropped articles) the agent uses when condensing replies.
  Saves output tokens — when the corpus rewards it.
- **Ohne Paket / Mit Paket** — "without the package" /
  "with the package" — the two arms of the A/B comparison.
- **Δ Tokens** — input-token difference per request vs. the baseline.
  The rendered dashboard reports cost in **tokens only** — no € figure.
  A €/USD comparison would assume per-call API pricing, which the many
  users on subscriptions do not pay; tokens are the currency-neutral
  metric. The `eur_delta` fields remain in the JSON for back-compat but
  are not rendered. (Historical € figures elsewhere in this spec are
  dated examples, kept as record.)

## Honest baseline appendix

The real numbers measured at the time this spec was written
(2026-05-28). Each subsequent phase of the roadmap closes one
gap — the baseline lets the reader see what was unknown when the
dashboard was first conceived.

**Correction 2026-05-28 (Phase 1 of `road-to-value-dashboard-netto-cuts`):**
The `load` rung previously read `agents/runtime/frugality/baseline.jsonl`
which measures a hardcoded 6-rule canon
(`scripts/measure_frugality_savings.py::CANON_RULES`) — NOT the
actual always-loaded kernel. The real kernel has 10 rules per
`dist/router.json::kernel`. After fix:

| Metric | Before fix | After fix | Delta |
|---|---:|---:|---:|
| `load` token delta | +4 843 | **+8 977** | +4 134 |
| NETTO token delta | +4 120 | **+8 254** | +4 134 |
| NETTO `cumulative_pct` | +51.5 % | **+103.2 %** | +51.7 pp |
| NETTO €/1k requests | +€11.37 | **+€22.78** | +€11.41 |

The original dashboard under-reported the base-load by ~4 100
tokens/request. Panel B's behaviour numbers are unaffected (they
measure agent behaviour, not token footprint).

**Optimisation pass 1 close-out (2026-05-28, `road-to-value-dashboard-netto-cuts`):**

- Phase 1 — load rung corrected (above).
- Phase 2 — `dist/router.json` minified 31 643 → 16 450 B; audit confirmed it is not in any host's per-request context, so the saving is hygiene-only, not a measured Panel-A rung.
- Phase 3 — router-telemetry replay shipped (`internal/bench/reports/router-telemetry/latest.json`); finding: zero tier-1 rules fire on Track B; the three tier-2 drivers are `domain-safety-pii`, `downstream-changes`, `model-recommendation`.
- Phase 4 — duplicate-trigger dedup closed with zero cuts: 16 clusters identified, all semantically distinct cross-cutting concerns. The council's "30 % redundancy" hypothesis is refuted; verified redundancy is 0 %.
- Phase 5 — tier-1 dead-rule audit closed with zero cuts: of 20 never-matched rules, 19 are bench-blind / measurement-window / cluster-head (load-bearing despite zero corpus hits); the lone demote candidate (`symfony-routing`) is kept to preserve cross-stack portability.
- Phase 6 — full live Track B re-run skipped: Phase 1-5 made no rule-body or frontmatter edits, so by construction Panel B is unchanged from the 2026-05-28 baseline (`with` 84.6 % completion, `without` 7.7 % completion). Re-running would consume tokens to re-confirm a known value.

**Pass outcome:** NETTO moved from +4 120 (mis-measured) to **+8 254 tokens / request** (honest); Panel B held by construction. The pass's value is the corrected measurement floor + the new telemetry tooling, not any in-place rule cuts. Cuts must wait until the bench corpus is widened to exercise the rules' real trigger surfaces (git, onboarding, roadmap work, long-conversation windows, autonomy moments).

**Optimisation pass 2 close-out (2026-05-29, `road-to-corpus-expansion-evidence-based-cuts`):**

- Phase 1 — corpus-surface inventory + state-fixture feasibility scan: 15 of 20 rules classified `addressable`; 5 state-bound (`autonomous-execution`, `context-hygiene`, `fast-path-marker-visibility`, `low-impact-corpus-privacy-floor`, `onboarding-gate`) get a permanent `keep-pending-state-trigger` verdict. 2/5 (`onboarding-gate`, `context-hygiene`) have feasible fixtures (documented but not built).
- Phase 2 — 5 corpus extension files shipped under `internal/bench/corpora/router-coverage/`, 24 tasks total (well under the 40-task ceiling). New `intended_triggers` + `open_files` + `command` fields on the per-prompt schema; linter validates against `dist/router.json` rule ids.
- Phase 3 — `scripts/router_telemetry.py` extended with manifest auto-discovery + `intended_vs_observed_match` per task + `unintended_activation_histogram` aggregate (Council R3 inter-rule conflict detection). Replay: **never-matched-tier-1 = 20 → 11**. The 11 split cleanly into 5 state-bound + 5 intent-only (NEW structural class — intent-only triggers cannot be exercised by router-telemetry replay regardless of corpus) + 1 partial.
- Phase 4 — second tier-1 audit, informed by widened corpus. The candidate set reduces to 1 real audit row (`artifact-engagement-recording`) — defended as load-bearing infrastructure for `/implement-ticket` + `/work` engine telemetry. Pareto raw-flagged 4 candidates with the tightened Council R3 thresholds (`body > 3 000 chars` AND `absolute_activations < 3` AND `activation_rate < 30 % of addressable_tasks`); all 4 are false-positives caused by the structural-unreachability dimension the pareto does not encode.
- Phase 5 — zero cuts (0 demotes, 0 deletes). Same outcome as pass-1, but for a fundamentally different reason: pass-1 closed with zero cuts because the corpus was blind; pass-2 closes with zero cuts because the widened corpus **proved every tier-1 rule has structural reason to exist**.
- Phase 6 — full live Track B re-run skipped: Phase 1-5 made zero rule-body / frontmatter / kernel edits — Panel B is unchanged from the 2026-05-28 baseline by construction.

**Pass outcome:** NETTO unchanged at **+8 254 tokens / request** (+103.2 % vs. baseline, +€22.78 per 1 000 requests). The pass's actual deliverable is the **structural categorisation** of the 20 previously-never-matched rules — future audits no longer need to re-debate why these rules don't fire in standard corpora. 5 state-bound + 5 intent-only are permanently classified as router-replay-unreachable. The Pass B (kernel-body refactor) deferral remains intact — no candidate qualifies under the tightened thresholds.

**Pass B status: deferred / closed for now.** Zero genuine candidates surfaced; the 4 raw-pareto flags are all false-positives. Reopen only when a tier-1 rule both activates frequently in the widened corpus AND has a body that exceeds the kernel-budget ceiling — current state has neither.



| Surface | Real number today | Gap |
|---|---|---|
| A/B Track A | `100% vs 0%` — file presence, a tautology | Reframed in Phase 4 Step 5 |
| A/B Track B | `—` — no `live` run on record | Closed in Phase 3 Step 1 |
| Telegraph input-side (condense) | median **+3.52%** savings (Thin-Root files net **−3.92% to −4.84%**) | Aggregated to a single rung in Phase 2 Step 2; Thin-Root surfaced as footnote |
| Telegraph output-side (`vs_terse`) | median **−9.27%** | Rendered honestly per § "Terse rung honesty" above |
| rtk savings | **not measured anywhere** | Closed in Phase 2 Step 3 (new `bench_rtk_savings.py`) |
| Right-skill selection (Track A vs. Track B coverage) | exists in the dev corpus; not surfaced as `with` vs. `without` | Closed in Phase 3 Step 2 |
| Destructive-op stops | 5 prompts exist in the corpus spec; not measured | Closed in Phase 3 Step 3 |

## Honesty constraints (non-goals)

These come from the roadmap and are restated here so a future
maintainer cannot soften them in a later spec edit without
deliberately rewriting this section.

- **No marketing numbers.** If condense nets negative on
  Thin-Root files, the dashboard says so. The credibility of the
  page is the product.
- **No cross-model study.** One model (the local `claude` CLI /
  one pinned pricing row). Statistical-significance work stays
  opt-in (`--samples N`).
- **No retiring of the raw reports.** `telegraph-v*`, `ab-*`,
  frugality JSONL stay as the machine-readable source of truth;
  the dashboard is a derived human view on top.
- **rtk numbers must be measured, not claimed.** The "60–90%" in
  `CLAUDE.md` is a vendor claim; Panel A shows what *this* corpus
  actually measured.

## Out of scope for this contract

- The per-report `value-v1` JSON shape — see
  [`value-report-schema.md`](value-report-schema.md).
- LLM-judge scoring of `docs/value.md` content quality —
  explicitly out of scope; the linter checks structural
  invariants only.
- Cross-model price comparison (haiku vs. sonnet vs. opus) — out
  of scope; the dashboard prices the reference Sonnet row.
- Per-tenant / per-user customisation of the reference scale —
  out of scope; the scale is documented inline and a reader
  recomputes mentally if their workload differs.

## See also

- [`agents/roadmaps/road-to-readable-value-dashboard.md`](../../agents/roadmaps/road-to-readable-value-dashboard.md) — the roadmap that built this surface.
- [`value-report-schema.md`](value-report-schema.md) — per-report JSON shape (sibling contract).
- [`benchmark-ab-contract.md`](benchmark-ab-contract.md) — A/B variant-axis contract (data source for the rtk, behaviour, completion rungs).
- [`benchmark-report-schema.md`](benchmark-report-schema.md) — per-report JSON shape for A/B reports.
- [`benchmark-corpus-spec.md`](benchmark-corpus-spec.md) — the corpus contract whose destructive prompts power the Panel B `stops` metric.
- [`internal/bench/pricing.yaml`](../../internal/bench/pricing.yaml) — token→€ conversion source.
