---
complexity: medium
---

# Roadmap: AI Council Consolidation + External-Pattern Integration

> Consolidate the `/council` family into a Hybrid Stub architecture, add a `/council analysis` lens for local analysis outputs, and selectively absorb three external patterns (Karpathy peer-review, lens-adaptive synthesis, consensus-scoring) verified through two council rounds.

## Prerequisites

- [ ] Read both council session artefacts:
      [`agents/council-sessions/2026-05-14-ai-council-redesign/prompt.md`](../council-sessions/2026-05-14-ai-council-redesign/prompt.md) (Round 1)
      and [`round-2-external-patterns.md`](../council-sessions/2026-05-14-ai-council-redesign/round-2-external-patterns.md) (Round 2)
- [ ] Read the existing dispatcher [`commands/council.md`](../../.agent-src.uncompressed/commands/council.md) and the four current lenses under [`commands/council/`](../../.agent-src.uncompressed/commands/council/)
- [ ] Read the skill spec [`skills/ai-council/SKILL.md`](../../.agent-src.uncompressed/skills/ai-council/SKILL.md)
- [ ] Confirm no commits / pushes happen without explicit per-step user approval (per [`commit-policy`](../../.augment/rules/commit-policy.md))

## Context

Two council rounds (2026-05-14, Anthropic Opus + OpenAI o1, deep tier) on the question "how to remove duplication in the `/council` family and integrate external patterns" produced converging verdicts:

- **Round 1 (architectural):** Hybrid Stub — master + thin wrappers. Real cost: $0.34.
- **Round 2 (feature filter):** Of six candidate patterns (F1–F6) extracted from `tenfoldmarc/llm-council-skill`, `hex/claude-council`, and `dustdustpy/multi-agent-council`, the council recommends **ship F2 + F3, defer F1 as opt-in flag, reject F4/F5, defer F6**. Real cost: $0.24.
- **Round 3 (sanity pass, file-level):** R1's "~400 LOC duplication" claim does not match the actual files. `commands/council.md` (56 lines) is already a pure dispatcher; `commands/council/default.md` (276 lines) is the de-facto master; `pr.md`/`design.md`/`optimize.md` are already wrappers that delegate via `mode_override=<lens>` (centralized in `scripts/ai_council/prompts.py:_MODE_TABLE`). The "~10-line stub" target is unachievable — each wrapper carries genuine lens-specific resolution logic (gh CLI for PR, metric capture for optimize, goal extraction for design). Phase 1 retargeted from "refactor" to "document the contract".

This roadmap is **work-only** — no version pins, no tag plans, no release dates.

- **Source verdicts:** [`responses.json`](../council-sessions/2026-05-14-ai-council-redesign/responses.json) (R1) · [`round-2-responses.json`](../council-sessions/2026-05-14-ai-council-redesign/round-2-responses.json) (R2)
- **External references analyzed:** [github.com/tenfoldmarc/llm-council-skill](https://github.com/tenfoldmarc/llm-council-skill) · [github.com/hex/claude-council](https://github.com/hex/claude-council) · [github.com/dustdustpy/multi-agent-council](https://github.com/dustdustpy/multi-agent-council)
- **Sibling roadmap:** [`step-1-v2-feedback-followup.md`](step-1-v2-feedback-followup.md) (unrelated; runs in parallel)

## Phase 1: Document the master/wrapper contract

The R1 council's Hybrid Stub architecture already exists in the codebase — it is just not documented. `default.md` is the de-facto master; `pr.md`/`design.md`/`optimize.md` are wrappers that delegate via `mode_override=<lens>` (centralized in `prompts.py:_MODE_TABLE`). Phase 1 is **doc-only**: no structural code moves, no behavioural change. This sets the floor that Phase 2's new `analysis` wrapper follows.

- [ ] **Step 1 — Write the contract block in `commands/council.md`:** Add a `## Architecture` section above `## Sub-commands` that names the master/wrapper split explicitly: `default.md` owns the full orchestration (cost gate, mode resolve, CLI invoke, render, host-verdict); the other lenses are wrappers that resolve lens-specific input then delegate to `/council default` with `mode_override=<lens>`. Reference `prompts.py:_MODE_TABLE` as the single source of lens-specific neutrality addendums.
- [ ] **Step 2 — Normalize cross-references in the three wrappers:** Each wrapper currently says "cost gate from `/council` Step 3 still applies" — change to "from `/council default` Step 3" so the source of truth is unambiguous. Same for "render via Step 6 of `/council`" → "Step 5/5a/5b of `/council default`". Surgical edits only.
- [ ] **Step 3 — Update `docs/contracts/command-clusters.md`:** Add the master/wrapper contract verbatim. Reference the architecture block from Step 1. No new entries in the cluster table — names are unchanged.
- [ ] **Step 4 — Run `task sync` + `task generate-tools` + `task lint-skills`:** Regenerate all four tool projections (`.augment/`, `.claude/`, `.cursor/`, `.windsurfrules`) and verify the four lenses still surface as discoverable commands in each tool. Lint must pass with WARN=WARN (not promoted to ERROR yet — that gate lives in the sibling roadmap).

## Phase 2: `/council analysis` lens

Adds the fifth lens — for consuming `/project-analyze` outputs and other local analysis artefacts — following the wrapper shape documented in Phase 1.

- [ ] **Step 1 — Define the input contract:** A `/council analysis` invocation accepts (a) a path to an analysis output file (`agents/analysis/*.md` or `.json`), (b) optionally a follow-up question. The lens framing emphasises: "Here is a local analysis. Critique the analysis itself + propose roadmap-ready follow-ups."
- [ ] **Step 2 — Add the `analysis` mode to `prompts.py:_MODE_TABLE`:** Mirror the `pr`/`design`/`optimize` entries with an `analysis`-specific neutrality addendum (focus on finding-deduplication, evidence quality of the upstream analysis, roadmap-readiness). Extend `available_modes()` automatically picks it up.
- [ ] **Step 3 — Create the wrapper `commands/council/analysis.md`:** Mirror the `pr.md`/`design.md`/`optimize.md` shape (~100–130 lines): frontmatter + Steps that (a) resolve the analysis-file path, (b) capture the upstream-analysis goal as `original_ask`, (c) invoke `/council default` with `mode_override=analysis`, (d) render with an analysis-specific one-line header, (e) hand back. Add the lens to the dispatch table in `commands/council.md`.
- [ ] **Step 4 — Roadmap-pipeline glue:** The analysis lens's synthesis output must be directly consumable by `/roadmap-create`. Define the output shape (Top-N findings + per-finding metadata) in the wrapper file and document it in [`docs/contracts/command-clusters.md`](../../docs/contracts/command-clusters.md).
- [ ] **Step 5 — End-to-end smoke test:** Run `/project-analyze` on a small subdirectory, pipe the output through `/council analysis`, then through `/roadmap-create`. Record the round-trip in [`agents/council-sessions/2026-05-14-ai-council-redesign/analysis-lens-smoke-test.md`](../council-sessions/2026-05-14-ai-council-redesign/) for future reference.

## Phase 3: F2 — lens-adaptive synthesis templates

The synthesizer prompt becomes lens-aware instead of one-size-fits-all. Opus's lens-adaptive shape from Round 2 is the contract.

- [ ] **Step 1 — Synthesis-template table in `prompts.py`:** Add a `_SYNTHESIS_TABLE` alongside the existing `_MODE_TABLE`, keyed by the same `mode` values (`default`/`pr`/`design`/`optimize`/`analysis`):
      - `pr` → Consensus / Conflicts / Must-Fix / Recommendation
      - `analysis` → Top-10-by-consensus / Supporting / Outliers
      - `optimize` → Performance-wins / Trade-offs / Implementation-order
      - `design` → open-ended (no template — design questions resist fixed shape; map to empty / passthrough)
      - `default` → Karpathy-style Agreement / Clashes / Blind-Spots / Recommendation / Next-Step
      Expose a `synthesis_template(mode)` helper symmetric with the existing `compose_<…>` functions.
- [ ] **Step 2 — Wire the template through the synthesis prompt:** In `scripts/ai_council/orchestrator.py`, the synthesis-prompt builder reads `mode` from the run config and injects the matching template body. No changes to the wrapper files — the wiring lives in Python, the wrappers already pass `mode_override` through.
- [ ] **Step 3 — Update the skill spec:** Add a "Synthesis templates" section to [`skills/ai-council/SKILL.md`](../../.agent-src.uncompressed/skills/ai-council/SKILL.md) documenting all five templates verbatim. Cite Round 2 verdict as source.
- [ ] **Step 4 — Renderer compatibility:** Verify `./agent-config council:render` handles all five output shapes. The renderer either auto-detects the shape from JSON keys or accepts an explicit `--template` flag.

## Phase 4: F3 — consensus-scoring on the analysis lens

Members score each other's findings (1–10 + agree/disagree + reason). The renderer ranks by consensus %, surfaces a "Minority Views" section for sub-threshold items, and adds machine-readable consensus metadata to the JSON output.

- [ ] **Step 1 — Add a scoring round to the orchestrator:** After the final deliberation round and before synthesis, spawn a scoring pass: each member sees the other members' top-N findings (anonymized as Finding A, B, …) and emits `{id, score: 1-10, agree: bool, reason: str}` per finding. Gate this round behind a lens-config flag `consensus_scoring: true` — only the `analysis` lens enables it for now.
- [ ] **Step 2 — Define the consensus metadata schema:** Each finding in the synthesis JSON gets `{consensus_strength: 0.0-1.0, dissent_count: int, scorers: [member_ids]}`. Opus's machine-readable contract is the floor.
- [ ] **Step 3 — Threshold + section rules in the renderer:**
      - `consensus_strength > 0.7` → "Strong Consensus" section, top of output, badge
      - `0.4 ≤ consensus_strength ≤ 0.7` → "Findings" (default body)
      - `consensus_strength < 0.4` → "Minority Views" section, footer, **not deleted**
- [ ] **Step 4 — Settings:** Add `ai_council.consensus_threshold_strong` (default `0.7`) and `ai_council.consensus_threshold_minority` (default `0.4`) to `.agent-settings.yml` + the template. Mirror the `max_output_tokens` precedent.
- [ ] **Step 5 — Cost-estimate impact:** The scoring round adds one extra inference call per member. Update `council:estimate` to account for it when `consensus_scoring` is active. The Phase 4 invocation cost ceiling grows ~+30 % over Phase 3 — surface this honestly in the estimate output.

## Phase 5: F1 — `--peer-review` opt-in flag (Karpathy anonymous review)

Opt-in only. Both Round 2 members agreed this should not be default; one rejected outright, the other approved as a flag. Implement as a flag, gate the implementation on actual user demand (i.e., land Phases 1–4 first, observe whether the flag is needed).

- [ ] **Step 1 — Trigger criterion:** Before starting Phase 5, confirm via user that the flag is wanted. If not requested, mark this phase `[-]` (cancelled) and close the roadmap.
- [ ] **Step 2 — Anonymization pass in the orchestrator:** Pipeline order when all features are active: **deliberation rounds → peer-review (this step) → consensus-scoring (Phase 4) → synthesis**. Peer-review fires after the final deliberation round: randomize member outputs into `Response A–N`, spawn one anonymized peer-review pass per member ("Strongest? Weakest blind spot? What did all miss?"), de-anonymize only at synthesis time. Consensus-scoring (if enabled) runs against the de-anonymized findings produced by deliberation, not against the peer-review responses.
- [ ] **Step 3 — Synthesizer prompt update:** When peer-review data is present, the synthesizer receives both the original responses (de-anonymized) and the peer-review responses (still labeled by reviewer). Add a "Peer-Review-Surfaced Blind Spots" section to the relevant lens templates.
- [ ] **Step 4 — CLI flag wiring:** Add `--peer-review` to `council:run` and `council:estimate`. The estimate increases by ~one round (N extra inference calls).
- [ ] **Step 5 — Document in the skill spec:** Add a "Karpathy peer-review (opt-in)" subsection citing the source repository.

## Acceptance Criteria

- [ ] Phase 1 — `commands/council.md` carries an `## Architecture` block that names `default.md` as master and `pr.md`/`design.md`/`optimize.md` as `mode_override` wrappers; cross-references in the three wrappers point to `/council default` (not bare `/council`); `docs/contracts/command-clusters.md` mirrors the contract; `task ci` passes
- [ ] Phase 2 — `/council analysis` is invocable, follows the same wrapper shape as `pr`/`design`/`optimize`, and round-trips a small analysis through `/roadmap-create` end-to-end
- [ ] Phase 3 — Synthesis output for `pr`, `analysis`, `optimize`, `default` follows the lens-specific template; `design` remains open-ended; renderer handles all five shapes
- [ ] Phase 4 — `/council analysis` output includes per-finding consensus metadata; renderer surfaces "Strong Consensus" / default / "Minority Views" sections per the threshold rules
- [ ] Phase 5 — Either `--peer-review` is implemented and documented, or the phase is explicitly cancelled with rationale recorded in this file
- [ ] All quality gates pass at each phase boundary (`task ci`, `task lint-skills`)
- [ ] Council session artefacts (R1 + R2 prompts and responses) remain in `agents/council-sessions/` as audit trail

## Notes

- **Cost ordering rationale:** Phase 1 (doc-only) makes the existing master/wrapper contract explicit before Phase 2 adds a new wrapper that follows it. Phase 2 lands the `analysis` lens before Phase 3 wires its synthesis template, so the template can be validated against real usage. Phase 4 adds the highest-value-per-LOC feature only after the lens consuming it exists. Phase 5 is opt-in and gate-checked.
- **Pipeline order when Phase 4 + Phase 5 are both active:** deliberation rounds → peer-review (Phase 5) → consensus-scoring (Phase 4) → synthesis. Peer-review anonymizes only the deliberation outputs; consensus-scoring runs on the de-anonymized findings; synthesis receives both streams.
- **Rejected features (do not re-open without new evidence):** F4 thinking-style advisors (Round 2 verdict: "5×N confusion matrix"), F5 auto-context injection (Round 2 verdict: leak + budget risk).
- **Deferred features:** F6 verbosity tiers — Round 2 verdict was "wait for actual user complaints about output style." Not in this roadmap.
- **Out of scope:** Response caching, HTML report generation, proactive trigger agent, plugin marketplace integration. None align with the single-maintainer power-user usage shape recorded in `step-1-v2-feedback-followup.md`.
- **Decline / fence handling:** If the user declines a step, mark it `[-]` (cancelled) and move on per [`scope-control`](../../.augment/rules/scope-control.md). Do not re-ask in the same task.
- **Sibling roadmaps:** This roadmap is independent of `step-1-v2-feedback-followup.md` and `road-to-productization.md`. No phase ordering between them; they can run in parallel or interleaved per maintainer bandwidth.
