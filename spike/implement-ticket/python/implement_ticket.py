"""Phase 0 spike — Python prototype for the /implement-ticket orchestrator.

Linear dispatcher over 8 mock steps. Throwaway prototype.

Usage:
    python3 implement_ticket.py <ticket.yml>

Emits one JSON line into agents/logs/implement-ticket/metrics.jsonl.
Exits 0 on success, 10 on blocked, 20 on partial (mirrors Bash codes).
"""
from __future__ import annotations

import json
import sys
import time
from dataclasses import asdict
from pathlib import Path

import yaml

from delivery_state import DeliveryState, Outcome
from steps import ORDER, STEPS

REPO_ROOT = Path(__file__).resolve().parent.parent.parent.parent
LOG_DIR = REPO_ROOT / "agents" / "logs" / "implement-ticket"

EXIT_CODES = {
    Outcome.SUCCESS: 0,
    Outcome.BLOCKED: 10,
    Outcome.PARTIAL: 20,
}


def dispatch(state: DeliveryState) -> tuple[Outcome, str | None]:
    """Run the 8 steps linearly. Stop at first non-success."""
    for name in ORDER:
        handler = STEPS[name]
        result = handler(state)  # type: ignore[operator]
        state.outcomes[name] = result.outcome.value
        if result.outcome is Outcome.BLOCKED:
            state.questions = result.questions
            return Outcome.BLOCKED, name
        if result.outcome is Outcome.PARTIAL:
            state.questions = result.questions
            return Outcome.PARTIAL, name
    return Outcome.SUCCESS, None


def render_report(state: DeliveryState, final: Outcome, block_step: str | None) -> str:
    lines = [
        "---",
        f"# Delivery report — {final.value.upper()}",
        "",
        f"- Ticket: {state.ticket['id']} — {state.ticket['title']}",
        f"- Persona: {state.persona}",
        f"- Final: {final.value}"
        + (f" (blocked at: {block_step})" if block_step and final is Outcome.BLOCKED else ""),
        f"- Outcomes: {json.dumps(state.outcomes)}",
    ]
    if final is Outcome.BLOCKED:
        lines.append("- Questions:")
        for q in state.questions:
            lines.append(f"  > {q}")
    lines.append("---")
    return "\n".join(lines)


def emit_metrics(state: DeliveryState, final: Outcome, boot_ms: int, total_ms: int) -> None:
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    record = {
        "runtime": "python",
        "ticket": state.ticket["id"],
        "final": final.value,
        "boot_ms": boot_ms,
        "total_ms": total_ms,
        "outcomes": state.outcomes,
    }
    with (LOG_DIR / "metrics.jsonl").open("a", encoding="utf-8") as fh:
        fh.write(json.dumps(record) + "\n")


def main() -> int:
    if len(sys.argv) != 2:
        print("Usage: implement_ticket.py <ticket.yml>", file=sys.stderr)
        return 2

    boot_start = time.time()
    ticket_path = Path(sys.argv[1])
    if not ticket_path.is_file():
        print(f"❌ Ticket not found: {ticket_path}", file=sys.stderr)
        return 2

    ticket = yaml.safe_load(ticket_path.read_text(encoding="utf-8"))
    state = DeliveryState(
        ticket=ticket,
        persona=ticket.get("persona_hint") or "senior-engineer",
    )
    dispatch_start = time.time()
    boot_ms = int((dispatch_start - boot_start) * 1000)

    final, block_step = dispatch(state)

    end_ms = time.time()
    total_ms = int((end_ms - boot_start) * 1000)

    print(render_report(state, final, block_step))
    emit_metrics(state, final, boot_ms, total_ms)

    return EXIT_CODES[final]


if __name__ == "__main__":
    raise SystemExit(main())
