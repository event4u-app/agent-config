"""Council acceptance review of Phase 0.4 2A.4 worked example.

Purpose: Phase 0.4.3 of road-to-structural-optimization.md requires a
council acceptance pass on the 2A.4 obligation-keyword-diff contract
before Phase 2A may begin. The artefact lives at
`agents/roadmaps/structural-optimization-2A4-example.md` plus two
sandbox files. Status will move from `draft` to `locked` only on
ACCEPT or ACCEPT_WITH_REVISIONS where revisions are minor.

Invocation:
    .venv/bin/python -m scripts.ai_council._one_off_2a4_acceptance
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
    REPO_ROOT / "agents/roadmaps/structural-optimization-2A4-example.md",
    REPO_ROOT / "agents/roadmaps/examples/2A4-direct-answers/direct-answers.slim.md",
    REPO_ROOT / "agents/roadmaps/examples/2A4-direct-answers/direct-answers-mechanics.md",
]

ORIGINAL_ASK = (
    "Phase 0.4 of road-to-structural-optimization v3.1 dry-runs the "
    "2A.4 obligation-keyword-diff contract on `direct-answers.md` to "
    "lock the contract before Phase 2A begins. The artefact and two "
    "sandbox files (slim rule + extracted mechanics) are presented. "
    "Council task: ACCEPT / ACCEPT_WITH_REVISIONS / REJECT the "
    "contract for use across the remaining 8 always-rules in Phase 2A."
)

REVIEW_PROMPT = """\
# Council Acceptance Review — 2A.4 Worked Example

## Context

The host agent ran Phase 0.4 of `road-to-structural-optimization` v3.1: \
took one always-rule (`direct-answers.md`, smallest of the top-3), split \
it into a slim RULE+LOGIC half and a MECHANICS context, then applied \
the 2A.4 obligation-keyword diff contract. The artefact is the report \
of that dry-run; the two sandbox files are the actual produced split.

You are not asked to re-litigate the v3.1 roadmap or the choice of \
`direct-answers.md` — both were settled in earlier rounds. Verdict \
solely concerns whether the **contract** (keyword × counts × \
accept-rationale table, plus its tie-break rules) is now ready to be \
applied to the remaining 8 always-rules in Phase 2A.

## Output Contract (STRICT)

Produce exactly these blocks in order. Be decisive — total response \
budget <= 1200 words.

```
### Contract correctness

**Verdict:** <ACCEPT | ACCEPT_WITH_REVISIONS | REJECT>
**Keyword extraction completeness:** <COMPLETE | PARTIAL — list missing>
**Tie-break rules sufficient:** <YES | NO — name the gap>
**Required revisions (numbered, 1-3 max, only on ACCEPT_WITH_REVISIONS):**
  1. <one sentence — smallest change>
  2. <...>
  3. <...>
```

```
### Sandbox split quality

**Slim file preserves all RULE+LOGIC obligations:** <YES | NO — list lost>
**Mechanics file holds only mechanics+examples:** <YES | NO — list misplaced>
**Round-trip: rule_slim + load_context(mechanics) == original behaviour:**
  <YES | NO — name the divergence>
```

```
### Generalisability to remaining 8 rules

**Contract scales without per-rule tuning:** <YES | NO — name failure mode>
**Single biggest risk on the next rule (likely `non-destructive-by-default`):**
  <one sentence>
```

```
### Final verdict

**Lockable as-is for Phase 2A?** <YES | NO>
**If NO, single blocking change required:** <one sentence>
```

Verdict definitions:
- **ACCEPT** — contract ships unchanged; status moves to locked.
- **ACCEPT_WITH_REVISIONS** — locks after the 1-3 listed revisions land.
- **REJECT** — contract is structurally wrong; describe the fault.

The three artefacts follow this prompt verbatim.
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
        max_tokens=3072,
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

    print("=== CONSULT (1 round, 2A.4 acceptance review) ===")
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
        artefact="agents/roadmaps/structural-optimization-2A4-example.md",
        original_ask=ORIGINAL_ASK,
        members=[f"{r.provider}/{r.model}" for r in final_round],
        rounds=len(rounds_collected),
        cost_usd_estimated=total_est,
        cost_usd_actual=actual_total,
        extra={"purpose": "Council acceptance review of Phase 0.4 2A.4 worked example"},
    )
    session_dir = save_session(manifest=manifest, responses=rounds_collected)
    print(f"[saved] {session_dir.relative_to(REPO_ROOT)}/")
    return 1 if any(r.error for round_r in rounds_collected for r in round_r) else 0


if __name__ == "__main__":
    raise SystemExit(main())
