"""Council review of road-to-context-layer-maturity.md draft v1 + PR #36.

Both reviewers ran independent preview-reviews on PR #36 and converged on
the same gap: rule layer is mature, context layer is unproven. The host
agent distilled the convergence into road-to-context-layer-maturity.md
(draft v1, 6 phases, lightweight tier).

Council task: validate v1 against (a) the two preview-reviews summarised
inline, (b) the actual PR #36 shape (description + diff stat), and (c)
the existing always-budget contract. Together with the host agent,
define the binding step list before lock.

Single round, structured per-phase verdict. Saves the session under
agents/council-sessions/.

Invocation:
    .venv/bin/python -m scripts.ai_council._one_off_context_layer_v1_review
"""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

from scripts.ai_council.bundler import bundle_prompt
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
ROADMAP_PATH = REPO_ROOT / "agents/roadmaps/road-to-context-layer-maturity.md"

ORIGINAL_ASK = (
    "Two independent preview-reviews on PR #36 converged on the same "
    "finding: rule layer is now mature; context layer is unproven. The "
    "host agent distilled the convergence into a 6-phase lightweight "
    "roadmap (road-to-context-layer-maturity.md draft v1). Council task: "
    "validate v1 against the reviewers' findings, the PR's actual shape, "
    "and the always-budget contract; together with the host agent, "
    "define the binding step list."
)

REVIEW_PROMPT_HEADER = """\
# Council Review — road-to-context-layer-maturity.md draft v1 + PR #36

## Background (verbatim, do not re-frame)

Two preview-reviews of PR #36 (`feat/better-basement` branch, 174 files,
+20k/-3.6k diff, structural-optimization roadmap closed + 1.16.0
follow-ups Phase 1+2 closed) produced converging findings.

### Reviewer #1 — 3-Layer Architecture lens

- PR #36 is not a feature PR; it is the first **post-maturity
  architecture move**.
- Names a 3-Layer Architecture: **Rule** (Obligation / MUST), **Context**
  (Decision Logic / HOW to think), **Examples** (Pattern Memory / HOW it
  looks). Phase 2A revert proved the boundary matters — moving Iron-Law
  prose into context made the rule unsafe.
- Lauds: contexts/communication/ as a previously-unsolved area;
  always-budget guard + golden tests as a maturity signal.
- Gaps: (a) no Level-2 context-loading design (chain, priority,
  budget, activation order); (b) no outcome measurement — golden tests
  measure structure, not whether the agent decides better; (c)
  context-activation clarity unclear (when, how many concurrently);
  (d) Iron Laws must stay in Rule, never migrate to Context; (e)
  Examples-as-demos under-leveraged.
- Verdict: 9.6/10. Recommendation: do NOT add features/skills/rules;
  perfect Context, make Examples real demos, make Decision-System
  visible.

### Reviewer #2 — Consolidation / scope-discipline lens

- PR #36 is correctly framed as "Structural optimization foundation +
  regression gates + command surface reduction", not a feature PR.
- Lauds: Phase 2A abort + honest Model-(b) finding (Context Tax >
  rule-slim gain); roadmap reflexion depth (council rounds, locked
  decisions, file-ownership matrix); test gates; 1.16-followup clean
  closure.
- Gaps: (1) PR size 174 files reduces reviewability; (2) roadmaps
  too heavy — auditable but not consumable for normal feature work,
  needs complexity standard; (3) always-budget headroom 1,552 chars
  (96.8% utilization) — slimming hebel exhausted, new strategy needed
  (demote / merge / hard-compress / shared-context amortization);
  (4) slow-rollout protocol compressed under autonomy mandate;
  (5) one-off scripts accumulating in scripts/ai_council/.
- P0 before merge: PR description rewrite, one-off-script decision,
  honest budget block, Phase 2A as finding.
- Verdict: 8.8/10 current, 9.1/10 with cleanup. "Inhaltlich stark.
  Strategisch richtig. Aber zu groß und zu meta-lastig."

### Convergence

- Both: don't add more rules / skills / commands.
- Both: context activation / loading / budget = the unsolved next
  question.
- Both: praise audit honesty, criticise size/concentration.
- Both: PR #36 should ship after cleanup, not be expanded.

## PR #36 shape

- 174 files changed · +20,120 / −3,629
- Branch: feat/better-basement → main (open)
- Title: docs(roadmap): add structural-optimization v3.1 + 1.16.0 follow-ups v1.1

(Full diff stat appended below; PR body appended below.)

## Your task

Review **road-to-context-layer-maturity.md draft v1** (full text appended
below) against:

1. **Reviewer convergence:** does v1 close every gap both reviewers
   named, or does it merely paraphrase them?
2. **PR #36 fit:** is Phase 0 (PR closeout) sufficient to ship #36
   honestly, or are items missing that the diff exposes?
3. **Always-budget contract:** is Phase 4 (Always-Budget v2)
   structurally sound, or does it re-walk Phase 2A's path?
4. **Lightweight-tier discipline:** does the roadmap itself follow
   the standard it locks in Phase 5, or does it cheat its own gate?
5. **Sequencing:** is `0 → 1 → 2 → 3 → 4 → 5` the right order, or
   should something move?

## Output contract (STRICT)

For EACH of the six phases, produce:

```
### Phase N — <title>

**Verdict:** <ACCEPT | PARTIAL | REJECT>
**What v1 gets right (1 sentence):** ...
**What v1 misses or over-reaches (1-2 sentences):** ...
**Concrete change to v2 (binding):** ...
```

Then a final block:

```
### Greenlight verdict

<one of: FULL GREENLIGHT — lock v1 / CONDITIONAL GREENLIGHT — apply N
revisions then lock / BLOCKED — major rework needed>

**Binding revisions for v2 (numbered, ≤ 8):** ...
**Estimated total effort:** <engineer-days>
**One-line strategic risk you would still fly with:** ...
```

Total response budget: ≤ 1800 words. Do not re-write the roadmap. Do
not propose a separate roadmap unless you mark BLOCKED.
"""


def _read(path: Path) -> str:
    return path.read_text(encoding="utf-8") if path.exists() else ""


def _diff_stat() -> str:
    proc = subprocess.run(
        ["git", "diff", "--stat", "origin/main..HEAD"],
        cwd=REPO_ROOT, check=True, capture_output=True, text=True,
    )
    lines = proc.stdout.splitlines()
    if len(lines) > 60:
        return "\n".join(lines[:30] + ["... [middle truncated] ..."] + lines[-15:])
    return proc.stdout


def _pr_body() -> str:
    try:
        proc = subprocess.run(
            ["gh", "pr", "view", "36", "--json", "body", "--jq", ".body"],
            cwd=REPO_ROOT, check=True, capture_output=True, text=True,
        )
        return proc.stdout
    except subprocess.CalledProcessError:
        return "[gh pr view 36 unavailable]"


def main() -> int:
    anthropic = AnthropicClient(api_key=load_anthropic_key(), model="claude-sonnet-4-5")
    openai = OpenAIClient(api_key=load_openai_key(), model="gpt-4o")
    members = [anthropic, openai]

    roadmap_text = _read(ROADMAP_PATH)
    if not roadmap_text:
        print(f"[error] roadmap not found: {ROADMAP_PATH}", file=sys.stderr)
        return 1

    bundle_text = "\n\n---\n\n".join([
        REVIEW_PROMPT_HEADER,
        "## PR #36 — diff --stat (origin/main..HEAD)\n\n```\n" + _diff_stat() + "\n```",
        "## PR #36 — body (verbatim)\n\n" + _pr_body(),
        "## Roadmap v1 (verbatim, the artefact to validate)\n\n" + roadmap_text,
    ])
    context = bundle_prompt(bundle_text)
    project = detect_project_context(REPO_ROOT)
    table = load_prices()

    question = CouncilQuestion(
        mode="prompt",
        user_prompt=context.text,
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

    print("=== CONSULT (1 round) ===")
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
        mode="prompt",
        artefact=str(ROADMAP_PATH.relative_to(REPO_ROOT)),
        original_ask=ORIGINAL_ASK,
        members=[f"{r.provider}/{r.model}" for r in final_round],
        rounds=len(rounds_collected),
        cost_usd_estimated=total_est,
        cost_usd_actual=actual_total,
        extra={"purpose": "Council review of road-to-context-layer-maturity v1 + PR #36"},
    )
    session_dir = save_session(manifest=manifest, responses=rounds_collected)
    print(f"[saved] {session_dir.relative_to(REPO_ROOT)}/")
    return 1 if any(r.error for round_r in rounds_collected for r in round_r) else 0


if __name__ == "__main__":
    raise SystemExit(main())
