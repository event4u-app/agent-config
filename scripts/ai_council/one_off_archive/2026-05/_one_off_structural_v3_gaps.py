"""Round-5 council tie-break on the three v3-introduced gaps.

Anthropic R4 raised five new gaps in v3 (G1 HIGH, G2/G3 MODERATE,
G4/G5 LOW); OpenAI R4 issued FULL GREENLIGHT with zero residual.
This round forces a binding consensus per gap so the user can decide
v3.1 vs ship.

Single round, structured per-gap verdict.

Invocation:
    .venv/bin/python -m scripts.ai_council._one_off_structural_v3_gaps
"""
from __future__ import annotations

import sys
from pathlib import Path

from scripts.ai_council.bundler import bundle_roadmap
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
ROADMAP_PATH = REPO_ROOT / "agents/roadmaps/road-to-structural-optimization.md"

ORIGINAL_ASK = (
    "Round-4 produced divergent verdicts on v3: OpenAI FULL GREENLIGHT, "
    "Anthropic CONDITIONAL with five v3-introduced gaps (G1 HIGH, G2/G3 "
    "MODERATE, G4/G5 LOW). Force binding per-gap consensus: REAL GAP / "
    "OVER-CALIBRATED / NOT A GAP, with one-sentence justification. "
    "Decide whether each gap blocks Phase-0 execution."
)

GAPS_PROMPT = """\
# Round-5 Tie-Break — Five v3-Introduced Gaps

Round 4 produced divergent verdicts on road-to-structural-optimization.md v3:

- **OpenAI gpt-4o:** FULL GREENLIGHT, all 15 Round-2/Round-3 findings ACCEPT, \
  zero residual.
- **Anthropic Claude Sonnet 4.5:** All 15 Round-2/Round-3 findings ACCEPT, \
  but flagged **five new gaps** introduced by v3 itself (1.2 engineer-days \
  to fix).

You both reviewed v3 already. **Stop re-reviewing v3 broadly.** Pick a \
binding verdict per gap. The user will decide v3.1 vs. ship based on \
your consensus.

## Output Contract (STRICT)

For each gap, produce exactly this block:

```
### G<n>: <short title>

**Verdict:** <REAL_GAP | OVER_CALIBRATED | NOT_A_GAP>
**Blocks Phase 0?:** <YES | NO>
**Justification (1-2 sentences):** <why this verdict>
**If REAL_GAP, minimal fix:** <one sentence — smallest change that closes it>
```

Verdict definitions:
- **REAL_GAP** — fix required before Phase 0 starts.
- **OVER_CALIBRATED** — gap exists but is lower severity than Anthropic R4 \
  claimed; can be a Risk-Register entry, not a phase-blocking fix.
- **NOT_A_GAP** — Anthropic R4 was wrong; v3 already addresses this or it \
  is not a real risk.

## The Five Gaps

### G1 (Anthropic R4: HIGH) — Phase 3a.0.1 collision-proxy under-tests mode collision

v3 Phase 3a.0.1 prompts `judge-test-coverage` with a security-only diff and \
checks for `judge-security-auditor` framing leak. With 4 judges, the \
collision space is C(4,2)=6 pairs plus C(4,3)=4 triples. Testing **one \
pair** is 1/10 coverage. Anthropic R4 argues this undermines the 3a.0.2 \
kill-criterion because mode-collision was the failure mode this proxy \
was designed to catch.

**Anthropic R4's fix:** Expand to all 6 pairs; threshold ≤1/6 collisions \
→ ship; ≥2/6 → kill 3a. +0.5 days.

**Counter-argument to consider:** Pairwise testing scales with persona \
count; one well-chosen pair (most-distant personas) may be a sufficient \
canary. Manual voice comparison on 6 prompts is 6× the human review time.

### G2 (Anthropic R4: MODERATE) — Phase 0.1.2 fan-out accounting under-specified

v3 Phase 0.1.2 says the generator "must account for context-file fan-out" \
but does not say whether it follows **transitive** `load_context:` chains \
(rule A → context X → nested context Y). Phase 0.2.4 caps nesting at \
depth 2. Without an explicit rule, the matrix could miss READ_ONLY deps \
or generate false-negative BLOCKS_IF_CONCURRENT cells.

**Anthropic R4's fix:** Add to 0.1.2 spec: "Generator follows transitive \
chains up to depth 2; depth-3 nesting → matrix entry becomes \
BLOCKS_IF_CONCURRENT automatically." +0.3 days.

### G3 (Anthropic R4: MODERATE) — Phase 0.2.3 retroactive test has no tolerance band

v3 Phase 0.2.3 retroactively tests PR #34's `autonomous-execution` split \
under the new budget model. Phase-wide kill-switch (line 150): "If 0.2.3 \
retroactive test fails → escalate to council; entire roadmap pauses." \
This is binary (pass/fail). A 0.4% overshoot (200 chars over 49,000 cap) \
triggers a roadmap-wide pause.

**Anthropic R4's fix:** Add tolerance: "≤5% overshoot → council \
refinement of model (b) (e.g., amortization factor); >5% → model (b) \
rejected, escalate." +0.1 days (contract language only).

### G4 (Anthropic R4: LOW) — Phase 6.1 zero-overlap escalation has no default

v3 Phase 6.1 says: if zero shared triggers between any two of the three \
chat-history concerns → halt Phase 6, escalate to council. No default \
action specified.

**Anthropic R4's fix:** "Zero overlap confirmed → default = keep three \
separate rules; Q2 rollback not required because the unified shape was \
never built." +0.1 days.

### G5 (Anthropic R4: LOW) — Phase 0.4 worked example may be atypical

v3 Phase 0.4 picks `direct-answers` for the worked example. If that rule \
is unusually clean (well-separated MECHANICS/LOGIC), the 2A.4 contract \
may fail on rule #2 (`ask-when-uncertain` or `language-and-tone`).

**Anthropic R4's fix:** "If the first Phase-2A rule after 0.4 acceptance \
fails 2A.4, re-run worked example on that rule before Rule #3." +0.2 days.

## Final Output

After all five blocks, add:

```
### Consensus verdict

<count of REAL_GAP / OVER_CALIBRATED / NOT_A_GAP across G1-G5>

**Recommendation:** <one of: SHIP V3 AS-IS · FIX <list> THEN SHIP · PRODUCE V3.1>
**Blocks Phase 0:** <gap ids that must be fixed before Phase 0 starts>
**Total residual effort:** <engineer-days>
```

Be decisive. Anthropic R4 already had its say — now you weigh in with a \
binding verdict. If a gap is over-engineering, say so. Total response \
budget: ≤ 1200 words.
"""


def main() -> int:
    anthropic = AnthropicClient(api_key=load_anthropic_key(), model="claude-sonnet-4-5")
    openai = OpenAIClient(api_key=load_openai_key(), model="gpt-4o")
    members = [anthropic, openai]

    context = bundle_roadmap(ROADMAP_PATH)
    project = detect_project_context(REPO_ROOT)
    table = load_prices()

    user_prompt = GAPS_PROMPT + "\n\n---\n\n" + context.text

    question = CouncilQuestion(
        mode="roadmap",
        user_prompt=user_prompt,
        max_tokens=4096,
    )

    estimates = estimate(
        question, members, table, project=project, original_ask=ORIGINAL_ASK,
    )
    print("=== ESTIMATE (single round, max tokens) ===")
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

    print("=== CONSULT (1 round, gap tie-break) ===")
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
        mode="roadmap",
        artefact=str(ROADMAP_PATH.relative_to(REPO_ROOT)),
        original_ask=ORIGINAL_ASK,
        members=[f"{r.provider}/{r.model}" for r in final_round],
        rounds=len(rounds_collected),
        cost_usd_estimated=total_est,
        cost_usd_actual=actual_total,
        extra={"purpose": "Round-5 tie-break on five v3-introduced gaps"},
    )
    session_dir = save_session(manifest=manifest, responses=rounds_collected)
    print(f"[saved] {session_dir.relative_to(REPO_ROOT)}/")
    return 1 if any(r.error for round_r in rounds_collected for r in round_r) else 0


if __name__ == "__main__":
    raise SystemExit(main())
