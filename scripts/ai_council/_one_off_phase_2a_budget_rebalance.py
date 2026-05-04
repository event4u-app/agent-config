"""Council adjudication of Phase 2A always-budget overshoot.

Phase 2A of road-to-structural-optimization slimmed the top-3
budget-consuming `type: always` rules (language-and-tone,
ask-when-uncertain, direct-answers) by extracting MECHANICS into
contexts under contexts/communication/rules-always/. Under the
locked Model (b) literal, the extended budget grew from 47,448 to
52,534 chars (49,000 cap → 107.2 %), 5.2 pp above the 2 % G3
tolerance band defined in
docs/contracts/load-context-budget-model.md.

Per that contract: an overshoot above the band rejects the model
and escalates to council. Phase 2A § Abort/rollback fires its
budget kill-switch in this exact case.

This one-off bundles the linter output, the three slimmed rules,
the three new mechanics contexts, and the locked budget contract,
and asks the council to pick the smallest viable resolution.

Invocation:
    .venv/bin/python -m scripts.ai_council._one_off_phase_2a_budget_rebalance
"""
from __future__ import annotations

import sys
from pathlib import Path

from scripts.ai_council.bundler import bundle_files
from scripts.ai_council.clients import (
    AnthropicClient,
    OpenAIClient,
    load_anthropic_key,
    load_openai_key,
)
from scripts.ai_council.orchestrator import (
    CostBudget,
    CouncilQuestion,
    consult,
    estimate,
)
from scripts.ai_council.pricing import estimate_cost, load_prices
from scripts.ai_council.project_context import detect_project_context
from scripts.ai_council.session import SessionManifest, save as save_session

REPO_ROOT = Path(__file__).resolve().parents[2]
ARTEFACTS = [
    REPO_ROOT / "docs/contracts/load-context-budget-model.md",
    REPO_ROOT / ".agent-src.uncompressed/rules/language-and-tone.md",
    REPO_ROOT / ".agent-src.uncompressed/rules/ask-when-uncertain.md",
    REPO_ROOT / ".agent-src.uncompressed/rules/direct-answers.md",
    REPO_ROOT / ".agent-src.uncompressed/contexts/communication/rules-always/language-and-tone-mechanics.md",
    REPO_ROOT / ".agent-src.uncompressed/contexts/communication/rules-always/ask-when-uncertain-mechanics.md",
    REPO_ROOT / ".agent-src.uncompressed/contexts/communication/rules-always/direct-answers-mechanics.md",
]

ORIGINAL_ASK = (
    "Phase 2A of road-to-structural-optimization slimmed the top-3 "
    "always-rules and breached the 2 % G3 tolerance band on the "
    "always-budget under Model (b) literal. The contract requires "
    "council escalation. Council task: pick the smallest viable "
    "resolution from a fixed option set."
)

REVIEW_PROMPT = """\
# Council Adjudication — Phase 2A Always-Budget Overshoot

## Measured state (linter output, model (b) literal)

```
FAIL  always-rule extended budget: 52,534 / 49,000 chars (107.2%)
      thresholds: warn 80% · fail 90% · per-rule ≤ 6,000 (ext) ·
                  top-3 ≤ 24,500 (ext) · depth ≤ 2 · G3 band ≤ +2%

  ext= 8529  raw= 4636  scope-control.md (top-3)  allowlisted ≤ 8,529
  ext= 7887  raw= 4607  non-destructive-by-default.md (top-3)  allowlisted ≤ 7,887
  ext= 6827  raw= 2424  ask-when-uncertain.md (top-3)  PER-RULE BREACH
  ext= 6283  raw= 2758  direct-answers.md  PER-RULE BREACH
  ext= 5863  raw= 3658  language-and-tone.md
  ext= 5781  raw= 3309  commit-policy.md
  ext= 5481  raw= 2196  verify-before-complete.md
  ext= 4415  raw= 4415  no-cheap-questions.md
  ext= 1468  raw= 1468  agent-authority.md
```

Pre-Phase-2A baseline (Phase 0.2.3 retroactive test, locked):
**47,448 / 49,000 = 96.8 %** (within tolerance, model (b) accepted).

Phase-2A delta per slimmed rule (raw rule shrank, mechanics
context loaded as new dependency):

| Rule | ext before | ext after | delta |
|---|---:|---:|---:|
| language-and-tone | 5,832 | 5,863 | +31 |
| ask-when-uncertain | 5,196 | 6,827 | +1,631 |
| direct-answers | 4,722 | 6,283 | +1,561 |

Phase 0.4 worked example council-locked the +1,561 delta on
direct-answers. ask-when-uncertain (+1,631) is structurally
identical. The total overshoot is **+3,534 chars over cap**.

## Why the literal model can no longer hit budget

Under model (b) literal each rule pays full cost for every context
it loads. Each mechanics extraction adds ~1.5–2 KB of frontmatter +
headers + context-introduction overhead per rule. Phase 2A is
structurally unable to satisfy the roadmap success criterion
("budget delta ≥ −5 %") under model (b); extraction *always* adds
overhead unless mechanics are consolidated and shared across rules.

## Fixed option set (pick exactly one)

- **R1 — Switch to Model (c) shared-divisor.** Reserved by the
  contract as "first refinement step if the 2 % tolerance band is
  exceeded". Under (c), `Σ RawSize(c) / N_loaders`. Currently each
  mechanics file has N=1, so (c) reduces to (b). Buy-in for (c)
  enables R5 below.
- **R2 — Raise TOTAL_CAP.** Set cap to 56,000 chars (current
  utilization 93.8 % under new cap). Acknowledges extraction
  overhead is real; freezes Phase 2A wins; abandons the −5 %
  delta success criterion.
- **R3 — Raise PER_RULE_CAP to 7,000 + add allowlist entries +
  raise TOTAL_CAP to 54,000.** Minimal-change variant: keeps the
  shape, accepts the two new per-rule breaches, raises cap
  modestly.
- **R4 — Revert Phase 2A.** Abandon mechanics extraction on the
  three rules; restore them to original size; mark Phase 2A as
  "structurally infeasible under locked contract"; close roadmap
  phase.
- **R5 — Consolidate the three mechanics into one shared context
  + adopt R1.** Single `rules-always-mechanics.md` loaded by all
  three slimmed rules; under (c) each rule pays 1/3 of the
  consolidated context size. Highest engineering cost, only path
  that delivers a net negative delta.

## Output Contract (STRICT)

```
### Verdict
**Choice:** <R1 | R2 | R3 | R4 | R5>
**One-sentence rationale:** <≤ 30 words>
```

```
### Required follow-up actions (numbered, ≤ 4)
  1. <smallest concrete step, files named>
  2. <...>
```

```
### Risk note
**Single biggest risk of the chosen option:** <one sentence>
**Mitigation:** <one sentence>
```

```
### Contract amendment needed?
**Amend load-context-budget-model.md?** <YES — section · NO>
**Amend road-to-structural-optimization Phase 2A success criterion?**
  <YES — new criterion in 1 line · NO>
```

Be decisive — total response ≤ 1,000 words. Artefacts follow
verbatim.
"""


def main() -> int:
    anthropic = AnthropicClient(api_key=load_anthropic_key(), model="claude-sonnet-4-5")
    openai = OpenAIClient(api_key=load_openai_key(), model="gpt-4o")
    members = [anthropic, openai]

    context = bundle_files(ARTEFACTS)
    project = detect_project_context(REPO_ROOT)
    table = load_prices()

    user_prompt = REVIEW_PROMPT + "\n\n---\n\n" + context.text

    question = CouncilQuestion(
        mode="files",
        user_prompt=user_prompt,
        max_tokens=2560,
    )

    estimates = estimate(
        question, members, table, project=project, original_ask=ORIGINAL_ASK,
    )
    print("=== ESTIMATE (single round) ===")
    total_est = 0.0
    for c, e in zip(members, estimates):
        print(f"  {c.name}/{c.model}: ~{e.input_tokens} in + {e.output_tokens} out = ${e.total_usd:.4f}")
        total_est += e.total_usd
    print(f"  TOTAL per round (max): ${total_est:.4f}")
    print()

    budget = CostBudget(
        max_input_tokens=200_000,
        max_output_tokens=80_000,
        max_calls=20,
        max_total_usd=2.50,
    )

    rounds_collected: list[list] = []

    def _on_round_complete(round_idx: int, round_responses) -> None:
        rounds_collected.append(list(round_responses))
        print(f"=== ROUND {round_idx + 1} COMPLETE ===")
        for r in round_responses:
            if r.error:
                print(f"  [error] {r.provider}/{r.model}: {r.error}")
                continue
            actual = estimate_cost(r.provider, r.model, r.input_tokens, r.output_tokens, table)
            print(f"  [done] {r.provider}/{r.model}: {r.input_tokens} in / "
                  f"{r.output_tokens} out · {r.latency_ms} ms · ${actual.total_usd:.4f}")
        print()

    print("=== CONSULT (1 round, Phase 2A budget rebalance) ===")
    consult(
        members, question, budget,
        rounds=1,
        on_round_complete=_on_round_complete,
        table=table, project=project, original_ask=ORIGINAL_ASK,
    )

    if not rounds_collected:
        print("[error] no rounds completed", file=sys.stderr)
        return 1

    actual_total = 0.0
    for round_responses in rounds_collected:
        for r in round_responses:
            if r.error:
                continue
            actual = estimate_cost(r.provider, r.model, r.input_tokens, r.output_tokens, table)
            actual_total += actual.total_usd
    print(f"=== TOTAL ACTUAL: ${actual_total:.4f} ===")

    final_round = rounds_collected[-1]
    if not [r for r in final_round if not r.error]:
        return 1

    manifest = SessionManifest(
        mode="files",
        artefact="agents/roadmaps/road-to-structural-optimization.md",
        original_ask=ORIGINAL_ASK,
        members=[f"{r.provider}/{r.model}" for r in final_round],
        rounds=len(rounds_collected),
        cost_usd_estimated=total_est,
        cost_usd_actual=actual_total,
        extra={"purpose": "Phase 2A always-budget overshoot adjudication"},
    )
    session_dir = save_session(manifest=manifest, responses=rounds_collected)
    print(f"[saved] {session_dir.relative_to(REPO_ROOT)}/")
    return 1 if any(r.error for round_r in rounds_collected for r in round_r) else 0


if __name__ == "__main__":
    raise SystemExit(main())
