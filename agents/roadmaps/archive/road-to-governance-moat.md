---
complexity: structural
status: ready
parent_roadmap: road-to-positioning-and-enforcement
---

# Road to the governance moat — exploit the advantage we already have, don't build measurement theater

**Trigger:** External reviewer proposed 5 moves to make AC provably superior to an
external operator-runtime reference ("Source R"): per-skill capability registry,
public cross-model routing benchmark, README benchmark + host matrix, 5 showcase
flows, council/judge model. An AI-council pass critically reframed the proposals.

**Mode:** Positioning + documentation plate. The decisive finding is **not** "build
the registry/benchmark" — it is "exploit the compile-time governance moat that
already ships, and explicitly do NOT build the theater." Source referenced
source-anonymously per `source-confidentiality`.

- **Source R** — the same external operator-runtime / Claude-Code reference as the
  sibling roadmaps (runtime-first: deterministic hooks, more raw skills).

## Council convergence (inline per `no-roadmap-references`)

Council (claude-sonnet-4-5 + gpt-4o, 2026-06-25, 2 rounds) converged **against**
most of the proposals:

1. **Per-skill capability registry → DO NOT BUILD.** Maintainability theater with no
   consumer: maintainers read the skill file + `dist/router.json` (88 intent→skill);
   host integrators project rules, they do not parse per-skill I/O; end users never
   see it. `confidenceHints`/`best_for` are qualitative human judgments → perpetual
   drift tax for a single maintainer. `CAPABILITIES.yaml` (area-level) + `router.json`
   already cover the real need.
2. **Public routing-precision benchmark → DO NOT PUBLISH (category error).**
   `skill_trigger_eval` measures AC's OWN trigger-matching (config quality), NOT
   end-to-end skill-invocation inside a real host (Cline/Roo have their own routing
   that may ignore AC's `router.json`). A "95% accuracy" headline that a user then
   sees as 60% in-host is false-advertising. It is also Anthropic-only
   (`DEFAULT_MODEL=claude-sonnet-4-5`), cross-model is credential-gated, and "proves
   superiority" needs a comparative baseline (vs host-native, vs Source R) that does
   not exist. And the governance-effect axis already measured honest-null — do not
   build a public "governance works" story on it.
3. **Real leverage = exploit the EXISTING compile-time governance moat** (a structural
   property already shipped — NOT the behaviour-change claim that measured null):
   rules/constraints travel in config space, are un-strippable without forking, and
   reach ALL hosts (runtime hooks reach <30%). Position AC as **"the governance layer
   for host agents that lack one."**
4. **Positioning honesty:** "Source R has many skills; AC proves when which skill
   fires" OVERCLAIMS. The honest, deliverable claim is the host-agnostic compile-time
   governance moat.

## Phase 1 — Document & surface the moat (highest leverage, cheap)

- [x] `docs/governance-advantage.md` — the moat (config-space, host-agnostic
  governance; reaches all hosts vs runtime hooks <30%). Structural-property claim
  only; explicit honesty boundary (honest-null A/B cited, "un-strippable" avoided
  as overclaim). Adversarial subagent review → 1 minor overclaim ("always reads")
  fixed. Done 2026-06-25.
- [x] **Governance-in-action examples** — folded into `governance-advantage.md`
  (3 traces: safety-floor surviving static-host projection; intent routing vs
  500-artefact dump; the two-layer spectrum). `docs/flows.md` is generator-touched
  (`generate_command_flows.ts`), so the examples live in the new hand-authored doc
  rather than hand-editing a generated surface.
- [x] **Per-surface / MCP view** — added an honest "Where MCP fits" note to the
  hand-authored `docs/enforcement-by-host.md` (MCP = transport, not a 3rd
  enforcement layer) pointing at the authoritative `capability-matrix.md`. The
  generated matrix (`generate_capability_matrix.ts`, reflection-from-`condense` +
  coverage-guard + byte-`--check`) was deliberately NOT force-fitted with invented
  per-host columns — avoiding a drift/over-claim trap.
- [x] Verify: `check_references` clean; `generate_capability_matrix --check` green
  (untouched); `readme_linter`/size/jargon green. Done 2026-06-25.

## Phase 2 — Positioning honesty

- [x] README positioning: the "proves when which skill fires" overclaim was never
  in the README (only the reviewer's proposal), so nothing to drop. Surfaced the
  moat instead — the "Governance on every host" bullet now names it the moat and
  links `docs/governance-advantage.md`. Done 2026-06-25.
- [x] Verify: `readme_linter` + `lint_readme_size` (441/750) + `lint_readme_jargon`
  (2/3) + `update_counts --check` green. Done 2026-06-25.

## Phase 3 — Gated / explicitly deferred (do NOT start without the gate)

- [-] **Cross-model routing eval** — **moved out** (Iron Law 3 resolution,
  2026-06-25) to `agents/roadmaps/later/road-to-cross-model-routing-eval.md`
  (`status: later`), blocked on credentials + an in-host end-to-end harness +
  baselines. Parked, not dropped.
- [-] **Public routing benchmark** — **moved out** with the cross-model eval to the
  same `later/` follow-up; gated behind the harness above.

## Do NOT build (council "no" list — positioning asset)

- Per-skill capability registry (inputs/outputs/confidenceHints) — no consumer,
  perpetual maintenance tax.
- Public Anthropic-only routing benchmark — weak/wrong-layer evidence.
- A separate "council/judge model" artefact — already shipped (`judge-*` skills +
  `ai-council` + `/implement-ticket` review-judges); surface in flows, do not rebuild.

## Acceptance criteria

- The moat is documented and surfaced; positioning drops the overclaim.
- Nothing on the "Do NOT build" list is built.
- Phase 3 items stay deferred until their gates (credentials + in-host harness +
  baselines) clear.
- Source R stays anonymized in every tracked artifact.

## Provenance

- Source R link: `ENC1:` token — maintainer to fill via `link_crypto.ts`.
- Siblings: `road-to-positioning-and-enforcement.md` (archived), `road-to-operator-runtime-harvest.md`.
