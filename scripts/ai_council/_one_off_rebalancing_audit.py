"""One-off council consultation — Phase 0 audit findings on rebalancing roadmap.

Validates whether the rebalancing roadmap premise still holds against the
actual PR #34 diff. Transient script; can be deleted after the consult runs.

Invocation:
    .venv/bin/python -m scripts.ai_council._one_off_rebalancing_audit
"""
from __future__ import annotations

import sys
from pathlib import Path

from scripts.ai_council.clients import AnthropicClient, load_anthropic_key
from scripts.ai_council.orchestrator import CostBudget, CouncilQuestion, consult, estimate
from scripts.ai_council.pricing import estimate_cost, load_prices
from scripts.ai_council.project_context import detect_project_context

REPO_ROOT = Path(__file__).resolve().parents[2]

ORIGINAL_ASK = (
    "Phase 0 audit of the rebalancing roadmap. The roadmap was written based on "
    "five rounds of external review claiming PR #34 over-deleted implicit "
    "expertise. Validate whether the premise still holds against the actual diff. "
    "Three concrete questions: (1) is the deletion narrative supported by the "
    "numbers? (2) which of the 6 phases are already done or moot? "
    "(3) what is the actual minimum-viable scope still worth executing?"
)

ARTEFACT = """# Phase 0 audit findings - road-to-rebalancing.md

## Premise from the roadmap

The risk surface is whether implicit expertise (edge cases, decision forks,
failure modes, anti-patterns) was trimmed alongside the redundancy.
Rebalancing means restoring intelligence without re-inflating Always-rules.

## Actual numbers from the PR #34 diff

Scope: git diff origin/main...HEAD, path .agent-src.uncompressed/rules/

- 35 files changed: 202 insertions, 204 deletions => net -2 lines total.
- Largest delta: language-and-tone.md 37 ins / 96 del. The 96 lines were
  EXTRACTED to docs/guidelines/language-and-tone-examples.md (79 lines),
  not deleted. Net knowledge loss: ~17 lines of duplicated phrasing.
- Second-largest: roadmap-progress-sync.md 26 ins / 33 del - minor.
- All other rules: <=8 line changes each, mostly renames.
- ZERO rule files deleted outright.

## Phase-by-phase realities

### Phase 0 - Removed-Knowledge Audit
This document IS Phase 0. Findings: 80% redundancy, examples extracted to
safe layer, zero decision-logic deletions. Phase 0 is now COMPLETE.

### Phase 1 - Pilot Context Split (3 rules)
Candidates: autonomous-execution, minimal-safe-diff, scope-control.
- autonomous-execution: 8 line delta in PR, no extraction yet.
- minimal-safe-diff: already auto-trigger; 6 line delta.
- scope-control: 40 line ADDITION (not deletion) in this PR. Pilot value low.

### Phase 2 - load_context: convention + linter
0 rules use load_context: today. Convention does not exist.
Genuinely net-new work.

### Phase 3 - Guidelines domain folders
Already done. 47 guidelines, 46 already in domain folders
(agent-infra/, docs/, e2e/, php/). Only language-and-tone-examples.md
is flat at root. Phase 3 reduces to deciding where the one flat file goes.

### Phase 4 - Golden-Transcript-backed demos under examples/flows/
Partially shipped. docs/end-to-end-walkthroughs.md (built last cycle)
already does this with 4 traces anchored to GT-1, GT-P1, GT-U2, GT-2.
Required cases per roadmap: implement-ticket-demo, work-freeform-demo,
ui-track-demo, blocked-path-demo (all covered) plus mixed-flow-demo
(NOT covered yet).
Net-new: 1 mixed-flow demo + folder move from docs/ to examples/flows/.

### Phase 5 - Rule priority hierarchy + interaction matrix
Partially shipped. docs/contracts/rule-interactions.yml and
rule-interactions.md exist (13 pairs across 9 rules).
rule-priority-hierarchy.md does NOT exist.

### Phase 6 - Senior-agent behavior tests
Not started. Net-new work, but only valuable if Phase 1 actually runs
and produces something to validate.

## Question to council

Given:
- The deletion narrative is empirically thin (-2 net lines after extraction).
- 3 of 6 phases are already done or near-done.
- Phase 1 pilot value is questionable on the 3 named candidates.

Should this roadmap:

(A) Close out as substantially-already-done. Execute only the small delta
    (1 mixed-flow demo, move walkthroughs to examples/flows/, add the
    priority-hierarchy doc, add load_context: convention if cheap),
    then archive.

(B) Drop Phase 1 pilot - the three named candidates don't show evidence of
    over-deletion. Execute Phase 2 + Phase 4 (1 missing demo + restructure)
    + Phase 5 (priority-hierarchy doc) only.

(C) Original full scope - assume the audit missed something subtle and run
    all 6 phases as written.

(D) Other framing - propose a tighter scope based on what the audit shows.

Identify blind spots: did the diff miss content moves between branches?
Are there rules whose implicit expertise lives in non-line-count signal?
Recommend (A/B/C/D) with rationale.
"""


def main() -> int:
    api_key = load_anthropic_key()
    client = AnthropicClient(api_key=api_key)
    project = detect_project_context(REPO_ROOT)
    table = load_prices()

    question = CouncilQuestion(mode="roadmap", user_prompt=ARTEFACT, max_tokens=2048)
    estimates = estimate(question, [client], table, project=project, original_ask=ORIGINAL_ASK)
    print(f"[estimate] ~{estimates[0].input_tokens} in + {estimates[0].output_tokens} out = ${estimates[0].total_usd:.4f}")

    budget = CostBudget(
        max_input_tokens=50_000, max_output_tokens=20_000,
        max_calls=5, max_total_usd=0.50,
    )

    print(f"[consult] calling {client.name}/{client.model} ...")
    responses = consult([client], question, budget, table=table, project=project, original_ask=ORIGINAL_ASK)
    if not responses or responses[0].error:
        err = responses[0].error if responses else "no response"
        print(f"[error] {err}", file=sys.stderr)
        return 1

    r = responses[0]
    actual = estimate_cost(r.provider, r.model, r.input_tokens, r.output_tokens, table)
    print(f"[done] {r.input_tokens} in / {r.output_tokens} out, {r.latency_ms} ms, actual ${actual.total_usd:.4f}")
    print("=" * 72)
    print(r.text)
    print("=" * 72)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
