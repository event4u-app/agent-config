"""Council review of road-to-1-16-followups.md (draft v1).

The followups roadmap distils 14 numbered findings (F1-F14) from two
external review rounds of release 1.16.0 into three phases:
- Phase 0: reviewer P0/P1/P2 stack (README sync, budget headroom,
  council labelling, release-tag gate). Effort <= 1 hour.
- Phase 1: load_context: rollout to three medium-risk policy rules
  + non-destructive-by-default failure-mode-only split + 1.15-followups
  archive verification. Effort ~2 days.
- Phase 2: README "Start here" anchor, host-agent wording precision,
  golden-test failure-mode coverage. Effort ~0.5 days.

Single round. Both members produce a structured per-phase verdict and
together with the host agent define the binding step list before the
roadmap is locked.

Invocation:
    .venv/bin/python -m scripts.ai_council._one_off_followups_review
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
ROADMAP_PATH = REPO_ROOT / "agents/roadmaps/road-to-1-16-followups.md"

ORIGINAL_ASK = (
    "Two external review rounds on release 1.16.0 produced 14 numbered "
    "findings (F1-F14) and a P0/P1/P2 fix stack. The host agent distilled "
    "them into road-to-1-16-followups.md (draft v1, 3 phases, 7 risks). "
    "Council task: evaluate the F1-F14 capture quality, the phase split, "
    "the gating between this roadmap and road-to-structural-optimization "
    "v3.1, and the per-step contracts. Together with the host agent, "
    "define the binding step list before lock-in."
)

REVIEW_PROMPT = """\
# Council Review — road-to-1-16-followups.md draft v1

Context for both reviewers:

- A separate roadmap (`road-to-structural-optimization.md`) was \
  finalised at v3.1 in a prior session. You both reviewed it across \
  five rounds. v3.1 is locked. **Do not re-litigate it.** This review \
  is about a *different*, *narrower* roadmap that addresses post-1.16.0 \
  PR feedback.
- Reviewer 1 (consolidation-quality lens) scored 1.16.0 at 9.5/10. \
  Concerns: surface still large, README dense, context-layer rollout \
  pace, "agent runs / implements" overclaim risk, golden-test failure-\
  mode bias. Strategy notes (F5-F8): roll out load_context: slowly, \
  prepare a second command-collapse phase, ship outcome demos, do not \
  inflate the README.
- Reviewer 2 (commit-level audit, raw.githubusercontent.com verified) \
  scored 1.16.0 at A-. Concrete findings:
  - **F9 (P0):** README on `main` shows pre-1.15.0 wording \
    ("Teach your AI agents Laravel...", "124 Skills · 46 Rules · \
    73 Commands · 46 Guidelines"). The 1.16.0 release tag has the \
    correct text but is not an ancestor of `main`. Reviewer-supplied \
    cherry-pick SHAs: 1053d56, d26bf68, 2fa8022, c282ae3.
  - **F10 (P1):** `tests/test_always_budget.py` top-5 cap headroom is \
    ~141 chars after `no-cheap-questions` was added. Target: >= 2,000 \
    chars headroom. Q3=A from structural-optimization v3.1 excludes \
    safety-floor rules from slim work.
  - **F11 (P2):** AI Council Phase 3-4 (debate, persistence, special \
    modes) grew without external-user signal. Reviewer fix: experimental \
    banner, no code cut.
  - **F14:** 1.16.0 tag points to commit 08daac9 which is not on `main`. \
    Workflow gap.
- Three Reviewer-1 strategy items (F5/F6/F7) and one (F8) on golden \
  tests are also captured. The host agent placed them as: F5/F6/F7 = \
  out-of-scope strategy notes (next-roadmap-generation seed); F8 = \
  Phase 2.3.

You both reviewed v3.1 already. **Stop re-reviewing v3.1.** Pick a \
binding verdict per phase of *this* followups roadmap, and together \
with the host agent define the final step list.

## Output Contract (STRICT)

For each phase, produce exactly this block:

```
### Phase <0|1|2>: <theme>

**Verdict:** <ACCEPT | ACCEPT_WITH_REVISIONS | REJECT>
**Capture quality (F-items folded into this phase):** <COMPLETE | PARTIAL — list missing> 
**Gate correctness:** <CORRECT | UNDER-GATED | OVER-GATED>
**Per-step contract clarity:** <SUFFICIENT | NEEDS_TIGHTENING — name steps>
**Required revisions (numbered, 1-3 max):**
  1. <one sentence — smallest change>
  2. <...>
  3. <...>
**Risk register coverage:** <SUFFICIENT | MISSING — name risk>
```

Verdict definitions:
- **ACCEPT** — phase ships as written; no revisions required.
- **ACCEPT_WITH_REVISIONS** — phase ships after the listed revisions \
  land. Each revision must be one specific, actionable change.
- **REJECT** — phase is structurally wrong; describe the structural \
  fault in <= 2 sentences in the revisions block.

## The Three Phases

The roadmap text follows this prompt verbatim. Read it first, then \
render the three blocks above for Phase 0, Phase 1, Phase 2.

## Cross-cutting questions (answer after the three blocks)

```
### Cross-cutting

**Is the F1-F14 placement correct?** \
  <YES | NO — list misplaced F-numbers and where they should go>
**Is the gating to road-to-structural-optimization v3.1 correct?** \
  <YES | NO — Phase 1 currently gates on v3.1 Phase 0.4 worked example>
**Is anything missing entirely from the F1-F14 capture that the \
  source feedback raised?** \
  <NO | YES — list missing observation + which phase/risk it belongs to>
**Is anything over-scoped (should not be a roadmap item at all)?** \
  <NO | YES — list and justify>
**Reviewer-1 strategy items F5/F6/F7 placement (out-of-scope, \
  next-roadmap-generation seed) — correct?** \
  <YES | NO — propose alternative placement>
```

## Final Output

After the three phase blocks and the cross-cutting block, add:

```
### Consensus verdict

**Overall recommendation:** <one of: LOCK_AS_IS | LOCK_AFTER_REVISIONS \
  | RESCOPE_REQUIRED>
**Phase-0 launchable now?** <YES | NO — reasons>
**Phase-1 unblocked once structural v3.1 Phase 0.4 lands?** \
  <YES | NO — reasons>
**Total residual revisions:** <count and sum of effort estimates>
**Single biggest risk in this followups roadmap that the host agent \
  has under-weighted:** <one sentence>
```

Be decisive. The host agent will integrate your two verdicts; \
divergence triggers a tie-break round, but only if you actually \
disagree on a *blocking* item. Total response budget: <= 1500 words \
per reviewer.
"""


def main() -> int:
    anthropic = AnthropicClient(api_key=load_anthropic_key(), model="claude-sonnet-4-5")
    openai = OpenAIClient(api_key=load_openai_key(), model="gpt-4o")
    members = [anthropic, openai]

    context = bundle_roadmap(ROADMAP_PATH)
    project = detect_project_context(REPO_ROOT)
    table = load_prices()

    user_prompt = REVIEW_PROMPT + "\n\n---\n\n" + context.text

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

    print("=== CONSULT (1 round, followups roadmap review) ===")
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
        extra={"purpose": "Council review of road-to-1-16-followups.md draft v1"},
    )
    session_dir = save_session(manifest=manifest, responses=rounds_collected)
    print(f"[saved] {session_dir.relative_to(REPO_ROOT)}/")
    return 1 if any(r.error for round_r in rounds_collected for r in round_r) else 0


if __name__ == "__main__":
    raise SystemExit(main())
