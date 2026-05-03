"""Session persistence for council consultations (D2).

Every `/council` call that completes (success or partial) writes an
audit artefact under `agents/council-sessions/<UTC-timestamp>/`:

- `manifest.json` — input mode, members, token + USD totals, original
  ask, neutrality preamble fingerprint.
- `response.md`   — `orchestrator.render()` output (per-member
  sections + Convergence/Divergence slot).
- `raw-text.md`   — concatenated raw text per member, separated by
  ASCII rules so a later `grep` is trivial.

Hard rules:
- Never raises on the project — disk write failures are logged and
  swallowed; the council is text-only and the report is the contract.
- Never writes secrets. The bundle has already been redacted by
  `bundler.py` before the orchestrator receives it.
- Never writes outside `agents/council-sessions/`. Path traversal in
  the timestamp is impossible (we generate it from `datetime.utcnow`).
"""

from __future__ import annotations

import datetime as _dt
import json
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterable

from scripts.ai_council.clients import CouncilResponse
from scripts.ai_council.orchestrator import render

REPO_ROOT = Path(__file__).resolve().parents[2]
SESSIONS_DIR = REPO_ROOT / "agents" / "council-sessions"


@dataclass
class SessionManifest:
    """Structured record of a single council call.

    Round 2+ debate calls (D1) pass `rounds > 1`; each round's
    per-member response is appended in `responses_per_round`.
    """

    mode: str  # bundle mode: prompt|roadmap|diff|files
    artefact: str  # human-readable artefact descriptor (path or "<inline>")
    original_ask: str
    members: list[str]  # "provider/model" pairs
    rounds: int = 1
    cost_usd_estimated: float = 0.0
    cost_usd_actual: float = 0.0
    extra: dict[str, object] = field(default_factory=dict)


def _utc_timestamp() -> str:
    """UTC timestamp safe for filesystem use (Z suffix preserved)."""
    return _dt.datetime.now(_dt.timezone.utc).strftime("%Y-%m-%dT%H-%M-%SZ")


def _serialise_response(r: CouncilResponse) -> dict[str, object]:
    return {
        "provider": r.provider,
        "model": r.model,
        "input_tokens": r.input_tokens,
        "output_tokens": r.output_tokens,
        "latency_ms": r.latency_ms,
        "error": r.error,
    }


def save(
    *,
    manifest: SessionManifest,
    responses: list[CouncilResponse] | Iterable[list[CouncilResponse]],
    sessions_dir: Path | None = None,
    timestamp: str | None = None,
) -> Path:
    """Persist a council call. Returns the session directory.

    `responses` accepts either:
    - `list[CouncilResponse]` — single round (round 1 only).
    - `Iterable[list[CouncilResponse]]` — multi-round, one list per
      round in execution order.

    Disk-write failures are surfaced via a stderr line but do not
    raise; the caller's text report is the source of truth.
    """
    rounds_data: list[list[CouncilResponse]]
    if responses and isinstance(responses, list) and isinstance(responses[0], CouncilResponse):
        rounds_data = [responses]  # type: ignore[list-item]
    else:
        rounds_data = list(responses)  # type: ignore[arg-type]

    base = sessions_dir or SESSIONS_DIR
    ts = timestamp or _utc_timestamp()
    session_dir = base / ts

    try:
        session_dir.mkdir(parents=True, exist_ok=True)
    except OSError as exc:  # noqa: BLE001 - never block the report
        print(f"[council:session] mkdir failed: {exc}", file=sys.stderr)
        return session_dir

    manifest_payload = {
        "timestamp_utc": ts,
        "mode": manifest.mode,
        "artefact": manifest.artefact,
        "original_ask": manifest.original_ask,
        "members": manifest.members,
        "rounds": manifest.rounds,
        "cost_usd_estimated": round(manifest.cost_usd_estimated, 6),
        "cost_usd_actual": round(manifest.cost_usd_actual, 6),
        "responses_per_round": [
            [_serialise_response(r) for r in round_responses]
            for round_responses in rounds_data
        ],
        **manifest.extra,
    }

    try:
        (session_dir / "manifest.json").write_text(
            json.dumps(manifest_payload, indent=2) + "\n", encoding="utf-8",
        )
        # Render uses the LAST round (the moderator-facing summary).
        last_round = rounds_data[-1] if rounds_data else []
        (session_dir / "response.md").write_text(
            render(last_round) + "\n", encoding="utf-8",
        )
        raw_blocks: list[str] = []
        for round_idx, round_responses in enumerate(rounds_data, start=1):
            for r in round_responses:
                raw_blocks.append(
                    f"=== round {round_idx} · {r.provider}/{r.model} ===\n\n"
                    f"{r.text}\n",
                )
        (session_dir / "raw-text.md").write_text(
            "\n".join(raw_blocks) + ("\n" if raw_blocks else ""),
            encoding="utf-8",
        )
    except OSError as exc:  # noqa: BLE001 - never block the report
        print(f"[council:session] write failed: {exc}", file=sys.stderr)

    return session_dir
