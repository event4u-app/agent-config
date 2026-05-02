"""Council orchestrator — fan out one question to multiple members.

Runs `member.ask()` in parallel via concurrent.futures. One member's
failure (network, rate-limit, refusal) is normalised into a
`CouncilResponse` with `error` set; the other members continue.

Cost budget is enforced per-call: if a finished call has already spent
more than `max_input_tokens_per_session`, the orchestrator aborts the
remaining queue and returns the partial responses with a synthesised
`error="cost_budget_exceeded"` for the unfinished members.
"""

from __future__ import annotations

from concurrent.futures import FIRST_COMPLETED, Future, ThreadPoolExecutor, wait
from dataclasses import dataclass

from scripts.ai_council.clients import CouncilResponse, ExternalAIClient
from scripts.ai_council.prompts import system_prompt_for


@dataclass
class CostBudget:
    max_input_tokens: int = 50_000
    max_output_tokens: int = 20_000
    max_calls: int = 10


@dataclass
class CouncilQuestion:
    mode: str  # one of: prompt, roadmap, diff, files
    user_prompt: str  # bundled artefact text
    max_tokens: int = 1024


def consult(
    members: list[ExternalAIClient],
    question: CouncilQuestion,
    budget: CostBudget | None = None,
) -> list[CouncilResponse]:
    """Fan out `question` to every enabled `member` in parallel.

    Returns one `CouncilResponse` per member, in the same order as the
    input list. Members that exceed the cost budget before they get to
    run receive a `CouncilResponse` with `error="cost_budget_exceeded"`.
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

    results: dict[int, CouncilResponse] = {}
    spent_input = 0
    spent_output = 0

    with ThreadPoolExecutor(max_workers=max(1, len(members))) as pool:
        future_to_idx: dict[Future[CouncilResponse], int] = {
            pool.submit(
                m.ask, system_prompt, question.user_prompt, question.max_tokens
            ): idx
            for idx, m in enumerate(members)
        }
        pending = set(future_to_idx)
        while pending:
            done, pending = wait(pending, return_when=FIRST_COMPLETED)
            for fut in done:
                idx = future_to_idx[fut]
                try:
                    response = fut.result()
                except Exception as exc:  # noqa: BLE001 - last-resort safety net
                    member = members[idx]
                    response = CouncilResponse(
                        provider=member.name, model=member.model, text="",
                        error=f"{type(exc).__name__}: {exc}",
                    )
                results[idx] = response
                spent_input += response.input_tokens
                spent_output += response.output_tokens
                if (
                    spent_input >= budget.max_input_tokens
                    or spent_output >= budget.max_output_tokens
                ):
                    for left in pending:
                        left_idx = future_to_idx[left]
                        member = members[left_idx]
                        results[left_idx] = CouncilResponse(
                            provider=member.name, model=member.model, text="",
                            error="cost_budget_exceeded",
                        )
                        left.cancel()
                    pending = set()
                    break

    return [results[i] for i in range(len(members))]


def render(responses: list[CouncilResponse]) -> str:
    """Render stacked sections + a Convergence/Divergence summary slot.

    The host agent fills in the summary at the end; this function only
    produces the per-member sections in a stable order.
    """
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
