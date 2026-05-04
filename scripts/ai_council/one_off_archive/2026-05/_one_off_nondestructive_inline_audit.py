"""Council inline-content audit for `non-destructive-by-default` (Phase 1.1.3).

Roadmap `road-to-1-16-followups` Phase 1.1.3 requires a council audit
before merging the `load_context:` rollout for the safety-floor rule.
Both reviewers must return PASS confirming that:

  - The Hard-Floor trigger table stays inline.
  - The Iron Law caps block stays inline.
  - The Cloud Behavior section stays inline.
  - No obligation moved to `destructive-mechanics.md` that should
    have stayed in the rule.

This audit is post-rollout (the rollout already shipped via Phase 7.4
of `road-to-structural-optimization`); it certifies the *current* state
of `main` against the Phase 1.1.3 contract.

Invocation:
    .venv/bin/python -m scripts.ai_council._one_off_nondestructive_inline_audit
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
    REPO_ROOT / ".agent-src.uncompressed/rules/non-destructive-by-default.md",
    REPO_ROOT / ".agent-src.uncompressed/contexts/authority/destructive-mechanics.md",
]

ORIGINAL_ASK = (
    "Phase 1.1.3 of road-to-1-16-followups requires a council audit on "
    "the `non-destructive-by-default` rule after `load_context:` rollout. "
    "Verify that Hard-Floor table, Iron Law caps block, and Cloud Behavior "
    "section are still inline; flag any obligation that moved to context "
    "and should not have."
)

REVIEW_PROMPT = """\
# Council Inline-Content Audit — non-destructive-by-default

## Context

The host agent rolled out `load_context:` to the `non-destructive-by-default` \
rule (universal safety floor). Failure-mode catalog and Bulk-deletions-WIP \
allowed/forbidden lists moved to `destructive-mechanics.md`. The roadmap \
contract requires that the load-bearing inline obligations stay in the rule.

You are auditing the **current state** of two files (rule + mechanics) to \
certify the rollout. This is not a re-design review.

## Required-inline checklist

1. **Hard-Floor trigger table** — six rows: production-branch merge, \
   deploy/release, push to remote, production data/infra, whimsical or \
   unscoped bulk deletion, commit containing bulk deletions or infra changes.
2. **Iron Law caps block** — three lines starting with \
   `HARD FLOOR OVERRIDES EVERYTHING.`
3. **Cloud Behavior section** — two-sentence statement that the floor applies \
   on Claude.ai Web, Skills API, and any cloud agent, with no cloud override.
4. **"Triggers require explicit user confirmation on this turn" clause** — \
   the not-from-previous-turn, not-from-roadmap, not-from-standing-autonomy \
   anchor.

## Output Contract (STRICT)

Produce exactly these blocks in order. Total response budget <= 800 words.

```
### Inline-content audit

**Hard-Floor trigger table inline:** <YES | NO — list missing rows>
**Iron Law caps block inline:** <YES | NO — quote what is there>
**Cloud Behavior section inline:** <YES | NO — quote what is there>
**On-this-turn confirmation clause inline:** <YES | NO — quote anchor>
```

```
### Misplaced-content audit

**Any obligation moved to mechanics that should be inline:** <NONE | list>
**Any failure mode duplicated in both files (drift risk):** <NONE | list>
```

```
### Final verdict

**Verdict:** <PASS | FAIL>
**If FAIL, single blocking issue:** <one sentence>
```

Verdict definitions:
- **PASS** — every required-inline item is present in the rule; no obligation \
  is misplaced. The rollout meets the Phase 1.1.3 contract.
- **FAIL** — at least one required-inline item is missing, weakened, or \
  duplicated in a way that creates a normative drift surface.

The two artefacts follow this prompt verbatim.
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
        max_tokens=2048,
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

    print("=== CONSULT (1 round, Phase 1.1.3 inline-content audit) ===")
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
        artefact=".agent-src.uncompressed/rules/non-destructive-by-default.md",
        original_ask=ORIGINAL_ASK,
        members=[f"{r.provider}/{r.model}" for r in final_round],
        rounds=len(rounds_collected),
        cost_usd_estimated=total_est,
        cost_usd_actual=actual_total,
        extra={"purpose": "Phase 1.1.3 inline-content audit on non-destructive-by-default"},
    )
    session_dir = save_session(manifest=manifest, responses=rounds_collected)
    print(f"[saved] {session_dir.relative_to(REPO_ROOT)}/")
    return 1 if any(r.error for round_r in rounds_collected for r in round_r) else 0


if __name__ == "__main__":
    raise SystemExit(main())
