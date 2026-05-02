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

from scripts.ai_council.budget_guard import (
    record_spend as _record_daily_spend,
    today_spend_usd as _today_spend_usd,
    would_exceed as _would_exceed_daily,
)
from scripts.ai_council.clients import CouncilResponse, ExternalAIClient
from scripts.ai_council.pricing import (
    CostEstimate,
    PriceTable,
    estimate_cost,
    estimate_input_tokens,
)
from scripts.ai_council.project_context import ProjectContext
from scripts.ai_council.prompts import system_prompt_for


@dataclass
class CostBudget:
    max_input_tokens: int = 50_000
    max_output_tokens: int = 20_000
    max_calls: int = 10
    max_total_usd: float = 0.0  # 0 = USD ceiling disabled (token caps still apply)
    daily_limit_usd: float = 0.0  # 0 = rolling 24h cap disabled (D3)


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
    daily_spent_usd: float = 0.0  # rolling 24h spend BEFORE this member (D3)
    daily_limit_usd: float = 0.0  # the configured daily cap (0 = disabled)
    breach_kind: str = "session"  # "session" | "daily" | "tokens"


# Callback signature: receive event → return True (proceed) or False (skip + tag error).
OnOverrunCallback = Callable[[OverrunEvent], bool]


def estimate(
    question: CouncilQuestion,
    members: list[ExternalAIClient],
    table: PriceTable,
    *,
    project: ProjectContext | None = None,
    original_ask: str = "",
) -> list[CostEstimate]:
    """Return a pre-call cost estimate per member, in input order.

    `project` and `original_ask` are passed through to
    `system_prompt_for()` so the estimate covers the handoff preamble
    bytes too. Both default to v1-shape (no preamble extension).
    """
    sys_prompt = system_prompt_for(
        question.mode, project=project, original_ask=original_ask,
    )
    input_tokens = estimate_input_tokens(question.user_prompt) + estimate_input_tokens(sys_prompt)
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
    project: ProjectContext | None = None,
    original_ask: str = "",
    rounds: int = 1,
    on_round_complete: Callable[[int, list[CouncilResponse]], None] | None = None,
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
    - `project` + `original_ask` flow into `handoff_preamble()` so the
      council member receives a neutral context-handoff alongside the
      artefact. Both default to v1 shape (no preamble extension).
    - `rounds >= 2` enables multi-round debate (D1). Each subsequent
      round augments the user prompt with anonymised prior-round
      responses (provider/model identity stripped). Token + USD caps
      accumulate across rounds. Returns the FINAL round's responses;
      use `on_round_complete(round_idx, responses)` to capture
      intermediate rounds.
    """
    if rounds < 1:
        raise ValueError(f"rounds must be >= 1 (got {rounds})")
    if not members:
        return []
    budget = budget or CostBudget()
    if len(members) > budget.max_calls:
        raise ValueError(
            f"Council has {len(members)} members but budget caps at "
            f"{budget.max_calls} calls."
        )

    spent: dict[str, float] = {"input": 0, "output": 0, "usd": 0.0}
    last_results: list[CouncilResponse] = []
    current_user_prompt = question.user_prompt

    for round_idx in range(rounds):
        round_question = (
            question if round_idx == 0
            else CouncilQuestion(
                mode=question.mode,
                user_prompt=current_user_prompt,
                max_tokens=question.max_tokens,
            )
        )
        last_results = _run_round(
            members, round_question, budget, spent,
            table=table, on_overrun=on_overrun,
            project=project, original_ask=original_ask,
        )
        if on_round_complete is not None:
            on_round_complete(round_idx, last_results)
        if round_idx + 1 < rounds:
            current_user_prompt = _augment_for_next_round(
                question.user_prompt, last_results, round_idx + 2,
            )

    return last_results


def _run_round(
    members: list[ExternalAIClient],
    question: CouncilQuestion,
    budget: CostBudget,
    spent: dict[str, float],
    *,
    table: PriceTable | None,
    on_overrun: OnOverrunCallback | None,
    project: ProjectContext | None,
    original_ask: str,
) -> list[CouncilResponse]:
    """Run a single round; mutate `spent` with cumulative totals."""
    system_prompt = system_prompt_for(
        question.mode, project=project, original_ask=original_ask,
    )
    results: list[CouncilResponse] = []
    estimates = (
        estimate(question, members, table, project=project, original_ask=original_ask)
        if table is not None
        else None
    )

    for idx, member in enumerate(members):
        # ── non-billable members skip the cost gate entirely ─────────
        # ManualClient (and future PlaywrightClient) cost us $0; their
        # token counts are still tracked from the response below for
        # observability, but no projection / budget breach can apply.
        if not getattr(member, "billable", True):
            try:
                response = member.ask(system_prompt, question.user_prompt, question.max_tokens)
            except Exception as exc:  # noqa: BLE001 - last-resort safety net
                response = CouncilResponse(
                    provider=member.name, model=member.model, text="",
                    error=f"{type(exc).__name__}: {exc}",
                )
            results.append(response)
            spent["input"] += response.input_tokens
            spent["output"] += response.output_tokens
            continue

        # ── projected spend check ────────────────────────────────────
        proj_input = spent["input"] + (estimates[idx].input_tokens if estimates else 0)
        proj_output = spent["output"] + (estimates[idx].output_tokens if estimates else 0)
        proj_usd = spent["usd"] + (estimates[idx].total_usd if estimates else 0.0)
        next_call_usd = estimates[idx].total_usd if estimates else 0.0

        breaches_tokens = (
            proj_input > budget.max_input_tokens
            or proj_output > budget.max_output_tokens
        )
        breaches_usd = budget.max_total_usd > 0 and proj_usd > budget.max_total_usd
        breaches_daily = (
            budget.daily_limit_usd > 0
            and _would_exceed_daily(budget.daily_limit_usd, next_call_usd)
        )

        if breaches_tokens or breaches_usd or breaches_daily:
            breach_kind = (
                "tokens" if breaches_tokens
                else "daily" if breaches_daily
                else "session"
            )
            error_tag = (
                "daily_budget_exceeded" if breach_kind == "daily"
                else "cost_budget_exceeded"
            )
            if on_overrun is not None and estimates is not None:
                event = OverrunEvent(
                    member_index=idx,
                    member=member,
                    next_estimate=estimates[idx],
                    spent_input_tokens=int(spent["input"]),
                    spent_output_tokens=int(spent["output"]),
                    spent_usd=spent["usd"],
                    projected_total_usd=proj_usd,
                    daily_spent_usd=(
                        _today_spend_usd() if budget.daily_limit_usd > 0 else 0.0
                    ),
                    daily_limit_usd=budget.daily_limit_usd,
                    breach_kind=breach_kind,
                )
                if not on_overrun(event):
                    results.append(_aborted(member, error_tag))
                    continue
            else:
                # v1 behaviour: short-circuit all remaining members.
                for left in members[idx:]:
                    results.append(_aborted(left, error_tag))
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
        spent["input"] += response.input_tokens
        spent["output"] += response.output_tokens
        if estimates is not None and table is not None:
            # Bill the actual output against the budget using the
            # member's per-1M output rate. Re-use estimate_cost with
            # the *real* token count.
            actual = estimate_cost(
                member.name, member.model,
                response.input_tokens, response.output_tokens, table,
            )
            spent["usd"] += actual.total_usd
            # Persist to the rolling 24h ledger when the daily cap is
            # active. Errors are swallowed inside record_spend.
            if budget.daily_limit_usd > 0 and not response.error:
                _record_daily_spend(
                    actual.total_usd, member.name, member.model,
                )

    return results


def _aborted(member: ExternalAIClient, reason: str) -> CouncilResponse:
    return CouncilResponse(
        provider=member.name, model=member.model, text="", error=reason,
    )


def _augment_for_next_round(
    original_prompt: str,
    prior_responses: list[CouncilResponse],
    next_round_number: int,
) -> str:
    """Build the round-N user prompt: original artefact + anonymised prior round.

    Provider/model identifiers are stripped (Iron Law of Neutrality §
    multi-round). Reviewers are labelled "Reviewer A / B / C…" in the
    order they appeared. Errors are skipped — they reveal nothing
    useful and can leak provider error formats.
    """
    blocks: list[str] = []
    label_idx = 0
    for r in prior_responses:
        if r.error or not r.text.strip():
            continue
        label = chr(ord("A") + label_idx)
        label_idx += 1
        blocks.append(f"### Reviewer {label}\n\n{r.text.strip()}")
    if not blocks:
        return original_prompt
    prior_block = "\n\n".join(blocks)
    return (
        f"{original_prompt}\n\n"
        f"---\n\n"
        f"## Prior round critiques (round {next_round_number - 1})\n\n"
        f"You are now in round {next_round_number}. Below are anonymised\n"
        f"critiques from independent reviewers in the previous round.\n"
        f"You do NOT know which model produced which critique. Read them,\n"
        f"then respond with:\n\n"
        f"1. Which prior points you agree with (cite reviewer label).\n"
        f"2. Which you disagree with and why.\n"
        f"3. New points or refinements not raised in round 1.\n\n"
        f"{prior_block}"
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
