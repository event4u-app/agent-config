"""One-off council run for the three open questions in road-to-structural-optimization.md v2.

Forces a STRUCTURED multiple-choice verdict per question across 2 rounds
(debate mode). Saves the session under agents/council-sessions/.

Invocation:
    .venv/bin/python -m scripts.ai_council._one_off_structural_open_questions
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
    "Lock the three open design questions on road-to-structural-optimization.md v2 "
    "with binding A/B verdicts + 2-3 sentence rationale each. The roadmap text "
    "is the context. Be decisive — say A or B (or C with new option). Avoid "
    "'depends' or 'further investigation needed'."
)

OPEN_QUESTIONS_PROMPT = """\
# Lock-the-Decision Council Round

You have already reviewed road-to-structural-optimization.md v2 in two prior \
rounds (architectural / sequencing critique). The roadmap author now needs \
**binding verdicts** on the three open design questions. Stop re-reviewing the \
roadmap. Pick A, B, or propose C with explicit justification.

## Output Contract (STRICT)

For each question, produce exactly this block:

```
### Q<n>: <short title>

**Verdict:** <A | B | C>
**Confidence:** <Low | Medium | High>
**Rationale (2-4 sentences):** <why this option, what failure mode of the other you avoid>
**Risk if wrong:** <one sentence — what breaks if your verdict is the wrong call>
**Rollback if wrong:** <one sentence — how to recover if production reveals the choice was bad>
```

If you propose C (new option), keep the same block structure.

## Q1 — Phase 3a Skill Consolidation Shape

The four `judge-*` skills (`judge-bug-hunter`, `judge-code-quality`, \
`judge-security-auditor`, `judge-test-coverage`) share procedure but \
have distinct persona voices. Two consolidation shapes:

- **A.** Keep four separate skills. Extract the shared procedure to \
  `contexts/judges/judge-shared-procedure.md`. Each skill's SKILL.md \
  loads the context via `load_context:` and adds its persona-specific \
  delta (review heuristics, persona prompt, examples).
- **B.** Single skill `judge` with `mode:` parameter \
  (`mode: bug-hunter | code-quality | security-auditor | test-coverage`). \
  One SKILL.md dispatches; persona contexts live at \
  `contexts/judges/personas/<mode>.md` and are loaded based on `mode:`.

**Decision criterion:** which preserves persona voice better at LLM \
runtime, and which is more maintainable when a fifth judge persona is \
added in 6 months?

## Q2 — Phase 6 chat-history Rule Consolidation Shape

Three rules (`chat-history-cadence`, `chat-history-ownership`, \
`chat-history-visibility`) overlap on triggers and surface but each \
encodes a distinct concern. Two consolidation shapes:

- **A.** One rule `chat-history` + three contexts \
  (`contexts/chat-history/cadence.md`, `.../ownership.md`, \
  `.../visibility.md`). The rule body holds the unified trigger language \
  and routes to the right context section based on the matched anchor.
- **B.** Router rule `chat-history` + three thin specialist rules \
  (`chat-history-cadence` etc.) reduced to <30 LOC each. Router fires \
  first, dispatches to one specialist based on signal type \
  (heartbeat / ownership-detection / cadence-decision).

**Decision criterion:** which is more maintainable when a fourth concern \
(e.g., `chat-history-archive` for log rotation) is added in 12 months, \
and which has lower cognitive load for an agent reading the rule first \
time mid-task?

## Q3 — Phase 5 Safety-Floor Rule Endorsement

Phase 5 tightens the always-rule budget. The four safety-floor rules are:

- `non-destructive-by-default` (~4,607 chars)
- `commit-policy` (~2,800 chars)
- `scope-control` (~3,900 chars)
- `verify-before-complete` (~3,200 chars)

Should these be in scope for slimming?

- **A.** Endorse keeping all four UNTOUCHED. Slimming risks weakening Iron \
  Laws under budget pressure. Phase 5 hits target without them.
- **B.** Allow slimming with stricter 2A.4-style obligation-diff (every \
  MUST/NEVER preserved verbatim, mechanics moved to context). Treat them \
  like normal always-rules.

**Decision criterion:** is the marginal budget gain worth the residual \
risk of an Iron Law regression slipping through the obligation-diff \
gate?

## Final Output

After the three blocks, add:

```
### Cross-question coupling

<2-3 sentences: do your verdicts on Q1/Q2/Q3 reinforce or conflict with \
each other? Are there hidden dependencies between them?>
```

Do not write an executive summary. Do not re-review v2. Pick, justify, \
ship. Total response budget: ≤ 1500 words.
"""


def main() -> int:
    anthropic = AnthropicClient(api_key=load_anthropic_key(), model="claude-sonnet-4-5")
    openai = OpenAIClient(api_key=load_openai_key(), model="gpt-4o")
    members = [anthropic, openai]

    context = bundle_roadmap(ROADMAP_PATH)
    project = detect_project_context(REPO_ROOT)
    table = load_prices()

    user_prompt = OPEN_QUESTIONS_PROMPT + "\n\n---\n\n" + context.text

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
    print(f"  TOTAL 2 rounds (max): ${total_est * 2:.4f}")
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

    print("=== CONSULT (2 rounds, debate mode) ===")
    consult(
        members, question, budget,
        rounds=2,
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
    print(f"=== TOTAL ACTUAL: ${actual_total:.4f} (across {len(rounds_collected)} rounds) ===")

    final_round = rounds_collected[-1]
    if not [r for r in final_round if not r.error]:
        return 1

    manifest = SessionManifest(
        mode="roadmap",
        artefact=str(ROADMAP_PATH.relative_to(REPO_ROOT)),
        original_ask=ORIGINAL_ASK,
        members=[f"{r.provider}/{r.model}" for r in final_round],
        rounds=len(rounds_collected),
        cost_usd_estimated=total_est * 2,
        cost_usd_actual=actual_total,
        extra={"purpose": "council lock on three open questions of structural-optimization v2"},
    )
    session_dir = save_session(manifest=manifest, responses=rounds_collected)
    print(f"[saved] {session_dir.relative_to(REPO_ROOT)}/")
    return 1 if any(r.error for round_r in rounds_collected for r in round_r) else 0


if __name__ == "__main__":
    raise SystemExit(main())
