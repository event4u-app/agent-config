"""Decision-replay artefact for council sessions (Phase 9).

Produces a per-session ``decision-replay.md`` that surfaces the audit
trail GPT review of PR #148 called out as missing: for each top
finding, the consensus_strength, agreeing-members with their key
argument, dissenting-members with their counter-argument, the
evidence-quality verdict, and a final synthesis verdict line.

The artefact is a pure projection of the consensus data plus the
per-member deliberation texts — no extra model calls. Schema is
documented in ``docs/contracts/ai-council-config.md`` under
"Decision-replay schema".
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable, Sequence

from scripts.ai_council.clients import CouncilResponse
from scripts.ai_council.consensus import (
    ConsensusMetadata,
    Finding,
    FindingScore,
)


@dataclass(frozen=True)
class DecisionReplayInputs:
    """Bundle accepted by :func:`render_decision_replay`.

    ``include_member_arguments`` toggles the redacted-vs-full output.
    When ``False`` the artefact emits consensus + dissent COUNT only —
    no per-member arguments — for sharing without leaking which model
    framed which point.
    """

    findings: Sequence[Finding]
    scores: Sequence[FindingScore]
    metadata: dict[str, ConsensusMetadata]
    deliberation: Sequence[CouncilResponse]  # last-round per-member texts
    original_ask: str = ""
    include_member_arguments: bool = True


def _verdict(strength: float) -> str:
    """Single-word verdict band for a consensus_strength."""
    if strength > 0.7:
        return "Strong"
    if strength > 0.4:
        return "Moderate"
    return "Weak"


def _scorer_argument(
    scorer: str,
    member_texts: dict[str, str],
    score: FindingScore | None,
) -> str:
    """Return the one-line key argument for ``scorer`` on a finding.

    Prefers the scorer's ``reason`` field (rich, contextual) and falls
    back to the truncated deliberation snippet so the audit trail never
    surfaces an empty argument.
    """
    if score and score.reason:
        flat = " ".join(score.reason.split())
        if len(flat) > 200:
            flat = flat[:199].rstrip() + "…"
        return flat
    snippet = member_texts.get(scorer, "")
    flat = " ".join(snippet.split())
    if not flat:
        return "no argument captured"
    if len(flat) > 200:
        flat = flat[:199].rstrip() + "…"
    return flat


def _scores_for_finding(
    fid: str, scores: Iterable[FindingScore],
) -> dict[str, FindingScore]:
    return {s.scorer: s for s in scores if s.finding_id == fid}


def render_decision_replay(inputs: DecisionReplayInputs) -> str:
    """Render the ``decision-replay.md`` body.

    Sections (in order): a leading H1 plus the original ask blockquote,
    one ``## <finding-id> — <truncated text>`` block per finding (ranked
    by consensus_strength desc), and a trailing footer with the toggle
    state so consumers can tell at a glance whether arguments were
    redacted.
    """
    member_texts = {f"{r.provider}:{r.model}": r.text or "" for r in inputs.deliberation}
    ranked = sorted(
        inputs.findings,
        key=lambda f: inputs.metadata.get(
            f.id,
            ConsensusMetadata(
                finding_id=f.id, consensus_strength=0.0, dissent_count=0,
                scorers=(), mean_score=0.0,
            ),
        ).consensus_strength,
        reverse=True,
    )
    lines: list[str] = ["# Decision Replay\n"]
    if inputs.original_ask.strip():
        ask = " ".join(inputs.original_ask.split())
        if len(ask) > 400:
            ask = ask[:399].rstrip() + "…"
        lines.append(f"> {ask}\n")
    if not ranked:
        lines.append("*No findings were extracted for this session.*\n")
        return "\n".join(lines).rstrip() + "\n"
    for f in ranked:
        m = inputs.metadata.get(f.id)
        if m is None:
            m = ConsensusMetadata(
                finding_id=f.id, consensus_strength=0.0, dissent_count=0,
                scorers=(), mean_score=0.0,
            )
        title = " ".join(f.text.split())
        if len(title) > 120:
            title = title[:119].rstrip() + "…"
        verdict = _verdict(m.consensus_strength)
        lines.append(f"## {f.id} — {title}\n")
        lines.append(
            f"- **Consensus**: {verdict} ({m.consensus_strength:.2f})\n"
            f"- **Evidence quality**: {m.evidence_quality} "
            f"(mean {m.mean_score:.1f}/10)\n"
            f"- **Agreement**: {m.concur_count}/"
            f"{m.concur_count + m.dissent_count} members concur, "
            f"{m.dissent_count} dissent\n",
        )
        if inputs.include_member_arguments:
            score_map = _scores_for_finding(f.id, inputs.scores)
            agreeing = [s for s in m.scorers if score_map.get(s) and score_map[s].agree]
            dissent = [pair for pair in m.dissent_reasons]
            if agreeing:
                lines.append("**Agreeing members**:")
                for scorer in agreeing:
                    arg = _scorer_argument(scorer, member_texts, score_map.get(scorer))
                    lines.append(f"- _{scorer}_ — {arg}")
                lines.append("")
            if dissent:
                lines.append("**Dissenting members**:")
                for scorer, reason in dissent:
                    arg = _scorer_argument(scorer, member_texts, score_map.get(scorer))
                    lines.append(f"- _{scorer}_ — {arg}")
                lines.append("")
        lines.append(f"**Synthesis verdict**: {verdict} consensus — {f.source} sourced.\n")
    mode_label = "full" if inputs.include_member_arguments else "redacted (counts only)"
    lines.append(f"---\n\n_artefact mode: {mode_label}_\n")
    return "\n".join(lines).rstrip() + "\n"
