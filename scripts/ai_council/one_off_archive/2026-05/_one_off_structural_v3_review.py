"""Round-4 council validation of road-to-structural-optimization.md v3.

Focused close-out review: do the Phase-0 items and the Round-3 locked
decisions cleanly close every CRITICAL / HIGH / MODERATE finding from
Round 2, and did v3 introduce any new structural gap?

Single round, structured per-finding accept/reject verdict. Saves the
session under agents/council-sessions/.

Invocation:
    .venv/bin/python -m scripts.ai_council._one_off_structural_v3_review
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
    "Validate that road-to-structural-optimization.md v3 cleanly closes every "
    "CRITICAL / HIGH / MODERATE finding from the Round-2 council debate and "
    "the three locked decisions (Q1=A, Q2=A, Q3=A) from Round 3. Per-finding "
    "binding ACCEPT / REJECT / PARTIAL verdict + one-sentence justification. "
    "Flag any new structural gap v3 introduced."
)

REVIEW_PROMPT = """\
# Round-4 Close-Out Review — v3 Final Validation

You have already reviewed road-to-structural-optimization.md across three \
prior rounds (Round 1 design, Round 2 critique with CONDITIONAL GREENLIGHT, \
Round 3 locked decisions Q1=A / Q2=A / Q3=A). The author has now produced \
**v3** — Phase 0 added (6 work-streams), all CRITICAL/HIGH/MODERATE findings \
folded in, locked decisions referenced.

**Your task:** Verify that v3 closes every Round-2 finding cleanly. Pick \
ACCEPT / REJECT / PARTIAL per finding. Do not re-litigate the design — \
just check whether the fix is in the document and whether it is structurally \
sound.

## Output Contract (STRICT)

For each finding, produce exactly this block:

```
### F<id>: <short title>

**Verdict:** <ACCEPT | PARTIAL | REJECT>
**v3 location:** <line range or section reference where the fix lives>
**Justification (1-2 sentences):** <why the fix closes — or fails to close — the finding>
**Residual gap (if PARTIAL/REJECT):** <one sentence — what is still missing>
```

## Findings to validate (all from Round 2 unless noted)

### CRITICAL tier — must close before Phase 1

- **C1.** File-ownership matrix was a ghost reference (3× cited, 0× defined). \
  v3 adds Phase 0.1 with schema, generator script, JSON + human projection, \
  and lock-in before Phase 1. Closed?
- **C2.** `load_context:` budget accounting model was undefined (rule chars \
  only? rule + context? per-loader split?). v3 adds Phase 0.2 with default \
  model (b) "rule + every loaded context", retroactive PR #34 test, max \
  nesting depth 2. Closed?
- **C3.** Phase 6 → 2B decoupling was asserted without proof. v3 adds \
  Phase 0.3 grep-and-document with three branch outcomes (0 hits / >0 hits / \
  linter check). Closed?

### HIGH tier — must close before Phase 2A

- **H1.** 2A.4 worked example was inside the phase, not a pre-phase spike. \
  v3 adds Phase 0.4 (pick `direct-answers`, run obligation diff, council \
  reviews artefact). Closed?
- **H2.** Phase 3a spike scoring was subjective with no deadline. v3 adds \
  Phase 0.5: 3-scorer protocol, persona-voice rubric file, 5-day deadline, \
  default = A on tie. Closed?
- **H3.** Context-file path conventions were undefined for Phase 2A/2B/3. \
  v3 adds Phase 0.6: locked path tree + `check_context_paths.py` linter + \
  docs-sync orphan check. Closed?

### MODERATE tier — must close before Phase 3

- **M1.** Phase 3a rollback atomicity (per-skill vs. family-level). v3 \
  rewrites 3a.2 as staged extraction (3a.2.1 in-place slim → 3a.2.2 parity → \
  3a.2.3 atomic shared-context extract → 3a.2.4 post-parity). Closed?
- **M2.** Phase 2B's flat 30% LOC reduction target was unvalidated for \
  logic-heavy rules. v3 adds 2B.0 LOC feasibility audit with custom targets \
  for >70% LOGIC rules. Closed?
- **M3.** Phase 5 absolute slimming did not address proportional concentration. \
  v3 adds 5.2.1 concentration threshold (≤12% per rule, ≤30% top-3) with \
  re-distribution path. Closed?

### NICE-TO-HAVE tier (treat as "should be present")

- **N1.** Phase 1.4.1 cluster-pattern compliance check (`scripts/check_cluster_patterns.py`). Present?
- **N2.** Phase 4.3.1 dispatch-latency benchmark (≤+100ms gate). Present?
- **N3.** Locked-contract terminology (External-locked / Internal-locked / Deferred) at top of doc. Present?

### Round-3 locked decisions — must be referenceable + rollback-defined

- **Q1=A** (separate skills + shared context): rollback path in v3?
- **Q2=A** (one rule + three contexts): rollback path in v3?
- **Q3=A** (safety floor untouched): rollback path in v3 (two-gate)?

### v3-introduced new gaps (open-ended)

After validating the above, do a final scan: did v3's structural changes \
(Phase 0 insertion, gating contracts, expanded risk register) introduce \
any new contradictions, ghost references, or sequencing bugs? List up to \
three, ACCEPT-as-written if none.

## Final Output

After all per-finding blocks, add:

```
### Greenlight verdict

<one of: FULL GREENLIGHT — execute Phase 0 / CONDITIONAL GREENLIGHT — \
fix N residual gaps first / BLOCKED — major rework needed>

**Residual fix list (if any):** <numbered list, ≤5 items>
**Estimated residual effort:** <engineer-days>
```

Do not re-write the roadmap. Do not propose v4 unless BLOCKED. Verdict \
language must be unambiguous. Total response budget: ≤ 1800 words.
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

    print("=== CONSULT (1 round, focused close-out) ===")
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
        cost_usd_estimated=total_est,
        cost_usd_actual=actual_total,
        extra={"purpose": "Round-4 close-out review of structural-optimization v3"},
    )
    session_dir = save_session(manifest=manifest, responses=rounds_collected)
    print(f"[saved] {session_dir.relative_to(REPO_ROOT)}/")
    return 1 if any(r.error for round_r in rounds_collected for r in round_r) else 0


if __name__ == "__main__":
    raise SystemExit(main())
