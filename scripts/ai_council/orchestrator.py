"""Council orchestrator — fan out one question to multiple members.

v2 contract (sequential + interactive overrun prompt):

- Members are called **sequentially** in input order. The previous
  parallel ThreadPoolExecutor was traded for predictable mid-flow
  user prompts; with 2-3 council members the latency cost is small.
- `estimate(question, members, table)` returns a pre-call cost preview
  (input tokens + max-output ceiling + USD per member). The host
  agent shows this before invoking `consult()`.
- `consult(..., on_overrun=...)` invokes the callback BEFORE each
  member's actual API call when the projected total cost would push
  past the cost budget. The callback decides whether to proceed for
  this single member; the next member triggers the callback again.

Failure normalisation (one member's exception → `error`-set
CouncilResponse, never raise) is unchanged.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Callable

from scripts.ai_council.clients import CouncilResponse, ExternalAIClient
from scripts.ai_council.pricing import (
    CostEstimate,
    PriceTable,
    estimate_cost,
    estimate_input_tokens,
)
from scripts.ai_council.prompts import system_prompt_for


@dataclass
class CostBudget:
    max_input_tokens: int = 50_000
    max_output_tokens: int = 20_000
    max_calls: int = 10
    max_total_usd: float = 0.0  # 0 = USD ceiling disabled (token caps still apply)


@dataclass
class CouncilQuestion:
    mode: str  # one of: prompt, roadmap, diff, files
    user_prompt: str  # bundled artefact text
    max_tokens: int = 1024


@dataclass
class OverrunEvent:
    """Passed to `on_overrun` when projected spend exceeds the budget."""

    member_index: int
    member: ExternalAIClient
    next_estimate: CostEstimate  # this member's projected cost
    spent_input_tokens: int  # already-billed totals BEFORE this member
    spent_output_tokens: int
    spent_usd: float
    projected_total_usd: float  # spent_usd + next_estimate.total_usd


# Callback signature: receive event → return True (proceed) or False (skip + tag error).
OnOverrunCallback = Callable[[OverrunEvent], bool]


def estimate(
    question: CouncilQuestion,
    members: list[ExternalAIClient],
    table: PriceTable,
) -> list[CostEstimate]:
    """Return a pre-call cost estimate per member, in input order."""
    input_tokens = estimate_input_tokens(question.user_prompt) + estimate_input_tokens(
        system_prompt_for(question.mode)
    )
    return [
        estimate_cost(m.name, m.model, input_tokens, question.max_tokens, table)
        for m in members
    ]


def consult(
    members: list[ExternalAIClient],
    question: CouncilQuestion,
    budget: CostBudget | None = None,
    *,
    table: PriceTable | None = None,
    on_overrun: OnOverrunCallback | None = None,
) -> list[CouncilResponse]:
    """Sequentially fan out `question` to every enabled member.

    - If `table` is provided, USD spend is tracked against
      `budget.max_total_usd` (when > 0). Without `table`, only the
      token caps apply (back-compat with v1 callers).
    - When the projected next-member spend would breach any cap,
      `on_overrun` is consulted. Returning False marks that member as
      `cost_budget_exceeded`; True proceeds with the call.
    - Without `on_overrun`, breaching caps short-circuits remaining
      members with `cost_budget_exceeded` (v1 behaviour preserved).
    """
    if not members:
        return []
    budget = budget or CostBudget()
    if len(members) > budget.max_calls:
        raise ValueError(
            f"Council has {len(members)} members but budget caps at "
            f"{budget.max_calls} calls."
        )

    system_prompt = system_prompt_for(question.mode)
    results: list[CouncilResponse] = []
    spent_input = 0
    spent_output = 0
    spent_usd = 0.0

    estimates = estimate(question, members, table) if table is not None else None

    for idx, member in enumerate(members):
        # ── projected spend check ────────────────────────────────────
        proj_input = spent_input + (estimates[idx].input_tokens if estimates else 0)
        proj_output = spent_output + (estimates[idx].output_tokens if estimates else 0)
        proj_usd = spent_usd + (estimates[idx].total_usd if estimates else 0.0)

        breaches_tokens = (
            proj_input > budget.max_input_tokens
            or proj_output > budget.max_output_tokens
        )
        breaches_usd = budget.max_total_usd > 0 and proj_usd > budget.max_total_usd

        if breaches_tokens or breaches_usd:
            if on_overrun is not None and estimates is not None:
                event = OverrunEvent(
                    member_index=idx,
                    member=member,
                    next_estimate=estimates[idx],
                    spent_input_tokens=spent_input,
                    spent_output_tokens=spent_output,
                    spent_usd=spent_usd,
                    projected_total_usd=proj_usd,
                )
                if not on_overrun(event):
                    results.append(_aborted(member, "cost_budget_exceeded"))
                    continue
            else:
                # v1 behaviour: short-circuit all remaining members.
                for left in members[idx:]:
                    results.append(_aborted(left, "cost_budget_exceeded"))
                return results

        # ── actual call ──────────────────────────────────────────────
        try:
            response = member.ask(system_prompt, question.user_prompt, question.max_tokens)
        except Exception as exc:  # noqa: BLE001 - last-resort safety net
            response = CouncilResponse(
                provider=member.name, model=member.model, text="",
                error=f"{type(exc).__name__}: {exc}",
            )
        results.append(response)
        spent_input += response.input_tokens
        spent_output += response.output_tokens
        if estimates is not None:
            # Bill the actual output against the budget using the
            # member's per-1M output rate. Re-use estimate_cost with
            # the *real* token count.
            actual = estimate_cost(
                member.name, member.model,
                response.input_tokens, response.output_tokens, table,
            )
            spent_usd += actual.total_usd

    return results


def _aborted(member: ExternalAIClient, reason: str) -> CouncilResponse:
    return CouncilResponse(
        provider=member.name, model=member.model, text="", error=reason,
    )


def render(responses: list[CouncilResponse]) -> str:
    """Render stacked sections + a Convergence/Divergence summary slot."""
    blocks: list[str] = []
    for r in responses:
        header = f"## {r.provider} · {r.model}"
        if r.error:
            blocks.append(f"{header}\n\n*ERROR:* `{r.error}`")
            continue
        meta = (
            f"*tokens: {r.input_tokens} in / {r.output_tokens} out · "
            f"{r.latency_ms} ms*"
        )
        blocks.append(f"{header}\n\n{meta}\n\n{r.text}")
    blocks.append("## Convergence / Divergence\n\n*to be summarised by the host agent*")
    return "\n\n---\n\n".join(blocks)
