"""Council review of road-to-rule-hardening.md v1.

Three independent self-check rules silently skipped within one
session despite being valid, loaded, and active. Host agent drafted
a 6-phase lightweight roadmap proposing a 3-tier hardening model
(Mechanical / Nudge / Inherent-soft).

Council task: validate the architecture and the pilot order before
the host agent autonomously implements Tier 1 hooks.

Invocation:
    .venv/bin/python -m scripts.ai_council._one_off_rule_hardening_v1
"""
from __future__ import annotations

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
ROADMAP_PATH = REPO_ROOT / "agents/roadmaps/road-to-rule-hardening.md"

ORIGINAL_ASK = (
    "Three independent self-check rules silently skipped within one "
    "session: model-recommendation (task-start gate), context-hygiene "
    "(turn-count handoff), roadmap-progress-sync (file-write side "
    "effect). All valid, loaded, active. Host agent drafted a 6-phase "
    "lightweight roadmap proposing a 3-tier hardening model. Council "
    "task: validate the architecture and the pilot ordering before "
    "implementation."
)

PROMPT_HEADER = """\
# Council Review — road-to-rule-hardening.md v1

## Background (verbatim, do not re-frame)

Within a single session the host agent observed three rules failing
the same way:

| Rule | Trigger that should have fired | What happened |
|---|---|---|
| `model-recommendation` | Opus recommendation at task-start | silently skipped |
| `context-hygiene` | Handoff at turn-count >= 20/40/60 | silently skipped |
| `roadmap-progress-sync` | Regenerate dashboard on roadmap touch | silently skipped |

All three are valid auto-load rules in `.augment/rules/`, all three
are part of the active rule set surfaced to the agent. None of them
fired. Hypothesis: they share a structural property — the trigger
is observable only inside the agent, the check runs in the agent's
head, no deterministic gate sits between decision and output. When
the agent is in flow (multi-tool work, file edits, council
orchestration), the self-check is the first thing to be dropped.

The host agent drafted a 6-phase lightweight roadmap proposing a
3-tier model:

- **Tier 1 — Mechanical.** Hook + deterministic check.
  Agent-independent.
- **Tier 2 — Nudge.** Hook detects, marker injected, agent
  formulates the response.
- **Tier 3 — Inherent soft.** No platform mechanism exists. Either
  accept as self-check, convert to user-invoked `/`-command, or
  deprecate.

Pilot order proposed by user: roadmap-progress-sync (1) → onboarding-gate
(3) → context-hygiene (2). Hook surface available today: Augment
PostToolUse / Stop, Claude Code Stop / SessionStart. Cursor / Cline /
Windsurf parity is explicitly out of scope for this roadmap.

Existing precedent: `chat-history-cadence` is the only rule already
mechanically hardened (heartbeat marker pattern). Inventory:
57 rules total, 18 contain self-check phrases (`MUST`, `MANDATORY`,
`pre-send`, `before drafting`), 6 mention hooks today.

## Your task

Review road-to-rule-hardening.md v1 (full text appended below).
Be adversarial — the host will autonomously execute the pilots, so
catch architectural mistakes now, not after Phase 4.

1. **Three-tier model:** is Mechanical / Nudge / Inherent-soft the
   right partition, or does it collapse meaningful distinctions?
   Specifically: should "Tier 2 Nudge" exist at all, or is it just a
   weaker Tier 1?
2. **Pilot order (1, 3, 2):** does roadmap-progress-sync prove the
   pattern, or is it too narrow to generalise? Is per-turn counter
   (context-hygiene) actually feasible cross-platform, or should it
   move to Tier 3?
3. **Failure-class generalisation:** are there self-check rules in
   the inventory that the audit will MISS because they fire so
   rarely the agent has not yet observed a skip? Name 1-2 likely
   candidates.
4. **Cross-platform scope:** roadmap defers Cursor/Cline/Windsurf.
   Is this honest scope or hidden tech debt that will silently
   block Phase 4 rollout?
5. **Tier 3 disposition:** the roadmap allows accept-as-soft as a
   valid disposition. Is that a real choice, or a way to declare
   victory without solving anything?

## Output contract (STRICT)

For EACH of the six phases:

```
### Phase N — <title>

**Verdict:** <ACCEPT | PARTIAL | REJECT>
**What v1 gets right (1 sentence):** ...
**What v1 misses or over-reaches (1-2 sentences):** ...
**Concrete change to v2 (binding):** ...
```

Then five answers to the questions above (numbered 1-5, ≤ 3 sentences
each).

Then a final block:

```
### Greenlight verdict

<one of: FULL GREENLIGHT — proceed with pilots / CONDITIONAL GREENLIGHT
— apply N revisions then proceed / BLOCKED — major rework needed>

**Binding revisions for v2 (numbered, ≤ 6):** ...
**Pilot order recommendation:** <1,3,2 | 1,2,3 | 3,1,2 | other>
**One-line architectural risk you would still proceed with:** ...
```

Total response budget: ≤ 1500 words. Do not re-write the roadmap.
"""


def _read(path: Path) -> str:
    return path.read_text(encoding="utf-8") if path.exists() else ""


def main() -> int:
    anthropic = AnthropicClient(api_key=load_anthropic_key(), model="claude-sonnet-4-5")
    openai = OpenAIClient(api_key=load_openai_key(), model="gpt-4o")
    members = [anthropic, openai]

    roadmap_text = _read(ROADMAP_PATH)
    if not roadmap_text:
        print(f"[error] roadmap not found: {ROADMAP_PATH}", file=sys.stderr)
        return 1

    bundle_text = "\n\n---\n\n".join([
        PROMPT_HEADER,
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
        extra={"purpose": "Council review of road-to-rule-hardening v1"},
    )
    session_dir = save_session(manifest=manifest, responses=rounds_collected)
    print(f"[saved] {session_dir.relative_to(REPO_ROOT)}/")
    return 1 if any(r.error for round_r in rounds_collected for r in round_r) else 0


if __name__ == "__main__":
    raise SystemExit(main())
