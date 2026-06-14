# Frontier-Grade Reasoning — Operating Profile

> Source dossier for the **Reasoning Discipline Protocol (RDP)** — the durable,
> sourced rationale behind the RDP gate context, rule, and skills. It documents what a
> frontier reasoning model (Anthropic's Fable 5 / Mythos 5, June 2026) does that
> weaker models skip — the **transferable operating discipline** — and the
> boundary of what is *not* transferable.
>
> Citation discipline: every catalog row names its source **and its dignity**
> (Anthropic primary doc · third-party review · customer testimonial · our own
> derivation). Two independent external model analyses (Claude + GPT) corroborate
> but are never the primary evidence for a transferable-behavior line. A
> line-by-line audit (2026-06-13) corrected five rows; the load-bearing claims
> (over-prescription degrades, reasoning-in-response → refusal) are verbatim in
> Anthropic's prompting doc and stand.

## The one boundary that frames everything

```
CAPABILITY DOES NOT TRANSFER. DISCIPLINE DOES.
```

A frontier model's edge lives in its **weights** — gains spread across the whole
training stack, with no single copyable prompt (the explicit framing is Nathan
Lambert / Interconnects [lam]; Anthropic's docs support only the weaker "needs
less scaffolding" [pf]). No skill, rule, or workflow makes Sonnet/Opus/GPT
*equal* Fable 5, and anyone promising that is selling the hallucinated analysis
this suite refuses to produce.

What *does* transfer is the **operating discipline**: the steps a frontier model
takes on its own that weaker models skip unless forced. On under-specified and
long-horizon tasks, that discipline gap is the largest part of the *visible*
quality difference. RDP transplants the discipline; it never claims the
capability.

> **Background (dates, precise):** Anthropic's own banner dates the **access
> suspension of Fable 5 / Mythos 5 to 2026-06-12** [an]; the related US
> export-control directive / Reuters report is **2026-06-13** [re]. Either way
> the model is currently inaccessible, so we cannot A/B against it — our own
> falsifiable eval is the only ground truth, which makes the discipline-transplant
> approach *more* relevant, not less.

## Sources (with dignity)

- **[an]** Anthropic — *Claude Fable 5 and Mythos 5* announcement. Primary, but
  several quotes on the page are **customer testimonials** (labeled per-row), not
  Anthropic capability statements.
- **[pf]** Anthropic docs — *Prompting Claude Fable 5*. Primary; the transferable
  prompting playbook. Load-bearing claims live here.
- **[in]** Anthropic docs — *Introducing Fable 5 / Mythos 5*. Primary; adaptive
  thinking + effort parameter + memory tool + refusals.
- **[ve]** Vellum — benchmark breakdown. **Third-party**; benchmark numbers are
  not verifiable in Anthropic prose and must be labeled third-party or pulled to
  the system card.
- **[cr]** CodeRabbit model review. **Third-party**; source of the
  "explore-environment-first" observation (not Anthropic-documented).
- **[lam]** Nathan Lambert / Interconnects. **Third-party analysis**; "whole
  training stack, no copyable prompt".
- **[re]** Reuters — export-control report (2026-06-13).
- Two external model analyses (Claude + GPT), provenance untracked in
  `agents/.harvest-local/` — **corroboration only**, never primary.

## Transferable-behavior catalog

Each row: behavior → **source + dignity** → transplant mechanism → carrier.

| Behavior | Source (dignity) | Transplant | Carrier |
|---|---|---|---|
| Audit progress against real tool results | **[pf] ✓ primary** | every claim cites a tool result | shipped: `verify-before-complete` |
| Act when you have enough; no overplanning; outcome-first | **[pf] ✓ primary** | shipped | `direct-answers`, `autonomous-execution` |
| Pause only when genuinely needed | **[pf] ✓ primary** | shipped | `no-cheap-questions` |
| No over-refactor / minimal diff (at higher effort) | **[pf] ✓ primary** | shipped | `minimal-safe-diff` |
| Parallel async subagents, dispatched readily | **[pf] ✓ primary** | default async dispatch | extend `subagent-orchestration` |
| Fresh-context verifier beats self-critique (for **long-running** tasks) | **[pf] ✓ primary** | verifier subagent on a **structural-complexity** gate (not blanket) | extend `adversarial-review` |
| Persistent **cross-run** notes (file memory = 3× vs Opus 4.8 on Slay the Spire) | **[an] ✓ primary (direct)** | lessons across runs, one per file | extend memory / `memory-consolidation` |
| Infer the underlying goal (standard host only) | **[an] testimonial (Lovable); direction note** | infer goal, give **one** recommendation — NO "2–3 framings"; standard host only (a strong-reasoning host self-infers) | extend `improve-before-implement` |
| Multi-hypothesis / "killing incorrect beliefs" | **[an] testimonial (Sean Ward); "multi-hypothesis" is our framing** | hypotheses + killed-beliefs in the notes file | `notes-first-reasoning` |
| Adaptive effort (depth scales with hardness) | **[in],[pf] = API knob, not a scaffold** | strong-reasoning host: set `effort: high`; standard host w/o the knob: scaffold the effort/stop discipline | extend `autonomous-execution` (standard-host-only) |
| Explore the environment first, then build | **[cr] third-party (NOT Anthropic-documented)** | enumerate constraints/tools/info-gaps, close by query/test before designing | extend `think-before-action` |
| Risk-first decomposition (hardest/load-bearing unknown first) | **OUR DERIVATION — general engineering discipline, NOT Fable-documented** ([pf]'s "top of difficulty range" means **task selection**, not intra-task order) | resolve load-bearing uncertainties before dependent work | new skill `complexity-first-planning` |

Adopted from GPT review (frontier-implicit behaviors; our adoption, corroboration
only — all cost-gateable notes components):

| Behavior | Source | Transplant | Carrier |
|---|---|---|---|
| Prediction tracking (calibration) | GPT review | prediction + confidence + result + lesson in notes | `notes-first` component `prediction_tracking` |
| Uncertainty budget | GPT review | per-dimension uncertainty score → feeds adaptive effort | `notes-first` component `uncertainty_budget` |
| Decision ledger | GPT review | decision + alternatives + reason + revisit-if in notes; **escalates to `decision-record`/ADR** when cross-task or structural | `notes-first` component `decision_ledger` |

The ordered chain the orchestrator enforces:
`ground → intent → notes → gather → audit → verify`.

## Deferred to the Phase-8 audit (likely already covered)

Two transferable [pf] behaviors are **not** given new artifacts up front — the
Phase-8 de-prescriptivize audit checks existing coverage first and adds only
verified gaps (HIGH priority):

- **Re-ground the final summary** — write the closing summary for a reader who
  saw none of the working thread; outcome first; drop working shorthand. Likely
  covered by `language-and-tone` + `direct-answers`.
- **Report findings and stop** — when the user is thinking out loud, don't apply
  a fix. Likely covered by `scope-control`.

## What does NOT transfer (and must not be faked)

- **Raw capability** — vision SOTA, document/chart reasoning, codebase-scale
  migrations. Benchmark deltas (e.g. SWE-Bench Pro 80.3 vs 69.2) are **[ve]
  third-party**, not verifiable in Anthropic prose — label third-party or pull to
  the system card; note "SWE-Bench Pro" is not named in [an] (which cites
  FrontierCode/Cognition + Hebbia-Finance). These are weights, not prompts.
- **"Show your work" in the response.** [pf] warns that reasoning-in-response can
  trigger a `reasoning_extraction` refusal, and that over-prescriptive skills
  *degrade* strong models. **Both verbatim in [pf] — the gating foundation.** RDP
  keeps reasoning in notes + verifier subagents, never in the response, and
  tier-gates prescription.
- **Pokémon FireRed vision-only harness** — **[an] only** ([pf] does not mention
  it).

## Cost / benefit by host reasoning strength (the gating lens)

RDP is **not** free — scaffolding costs tokens and, on strong-reasoning hosts,
*degrades* output. So it engages only where it pays, via **table-free** signals.
Per **ADR-035** the suite maintains no runtime model→band table, and `model_tier`
is the *skill's* needed band (lite/medium/high), **not** the host's. Host strength
is therefore **agent self-assessed**, never looked up (roadmap L10/L17):

| Host / task | Self-coordination | RDP engagement | Why |
|---|---|---|---|
| standard host | low | **full** scaffolding | biggest discipline gap → biggest lift |
| strong-reasoning host | high | **light / off** (use native `effort: high`) | over-scaffolding degrades + wastes tokens |
| trivial / short task (any host) | n/a | **off** | no discipline gap to close; pure overhead |
| verifier subagent (any host) | — | **only** on the structural-complexity gate (≥2 of: branching, ≥3 constraints, stateful, irreversibility) + token floor ≥1k | a full extra inference pass — the most expensive primitive |

**One** constraint-light scaffold ships — no heavy/light content variants, since
two variants would be a hidden model→band table. A standard host **expands it on
request**. Two gates, both default-on: automatic (task signal + agent
self-assessment) + the user `reasoning:` settings toggle (global + per-component
+ hard off).

## Notes template grounding

The session-notes template is grounded in Anthropic's **documented cross-run
lessons memory** [pf] (one lesson per file; corrections + confirmed approaches;
why they mattered). The in-task sections (`## In-Task Hypothesis Log`,
`## Predictions`, `## Decisions`, `## Uncertainty`) are a clearly-marked **local
derivation** for within-task scope — useful, but not claimed as Anthropic-
documented, and kept on the notes side of the `reasoning_extraction` line.

## Naming

Neutral, no brand/capability claim. Umbrella: **Reasoning Discipline Protocol
(RDP)**. Artifacts: `reasoning-orchestrator`, `notes-first-reasoning`,
`complexity-first-planning`, `environment-grounding`. "Fable" / "Mythos" never
appear in an artifact identifier.

[an]: https://www.anthropic.com/news/claude-fable-5-mythos-5
[pf]: https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-fable-5
[in]: https://platform.claude.com/docs/en/about-claude/models/introducing-claude-fable-5-and-claude-mythos-5
[ve]: https://www.vellum.ai/blog/claude-fable-5-and-mythos-5-benchmarks-explained
[re]: https://www.reuters.com/technology/us-blocks-foreign-access-anthropics-most-advanced-ai-models-axios-reports-2026-06-13/
[cr]: https://www.coderabbit.ai/blog/fable-5-model-review
[lam]: https://www.interconnects.ai/p/claude-fable-5-and-new-ai-safety
