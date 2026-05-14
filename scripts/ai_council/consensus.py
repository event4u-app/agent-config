"""Consensus scoring for the analysis lens (Phase 4 / F3).

After the final deliberation round, members score each other's
findings. The renderer ranks findings by consensus and surfaces a
"Minority Views" section for sub-threshold items so they remain
audit-trail signal rather than silent drop.

Schema (Opus's machine-readable contract):

    Finding            — `{id: str, source: str, text: str}`
    FindingScore       — `{finding_id: str, scorer: str, score: 1..10,
                          agree: bool, reason: str}`
    ConsensusMetadata  — per-finding aggregate:
                         `{finding_id, consensus_strength: 0..1,
                           dissent_count, scorers, mean_score}`

Threshold bucketing (Phase 4 Step 3):

    consensus_strength > strong   → Strong Consensus
    minority < strength <= strong → Findings (default body)
    strength <= minority          → Minority Views
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from typing import Iterable

_JSON_BLOCK = re.compile(r"```(?:json)?\s*(\[.*?\])\s*```", re.DOTALL)
_BARE_ARRAY = re.compile(r"(\[\s*\{.*?\}\s*\])", re.DOTALL)

# Defaults mirror the roadmap (Phase 4 Step 4). The .agent-settings.yml
# block overrides them at run time.
DEFAULT_STRONG_THRESHOLD: float = 0.7
DEFAULT_MINORITY_THRESHOLD: float = 0.4


@dataclass(frozen=True)
class Finding:
    """One finding extracted from a member's deliberation output."""

    id: str
    source: str  # provider/model that authored the finding
    text: str


@dataclass(frozen=True)
class FindingScore:
    """One scorer's vote on one finding."""

    finding_id: str
    scorer: str
    score: int  # 1..10
    agree: bool
    reason: str


@dataclass(frozen=True)
class ConsensusMetadata:
    """Aggregate consensus stats for a single finding."""

    finding_id: str
    consensus_strength: float  # 0..1
    dissent_count: int
    scorers: tuple[str, ...]
    mean_score: float


@dataclass(frozen=True)
class ConsensusBucket:
    """Threshold-bucketed findings ready for renderer sectioning."""

    strong: list[tuple[Finding, ConsensusMetadata]] = field(default_factory=list)
    findings: list[tuple[Finding, ConsensusMetadata]] = field(default_factory=list)
    minority: list[tuple[Finding, ConsensusMetadata]] = field(default_factory=list)


def aggregate_scores(
    findings: Iterable[Finding],
    scores: Iterable[FindingScore],
) -> dict[str, ConsensusMetadata]:
    """Aggregate per-finding scores into ConsensusMetadata.

    `consensus_strength` = mean(score) / 10 * agreement_rate.

    A finding's *own author* is never expected to score it; we drop
    self-scores defensively to keep the aggregate honest. Missing
    findings get zero scorers (strength=0, dissent_count=0).
    """
    by_id: dict[str, list[FindingScore]] = {f.id: [] for f in findings}
    sources: dict[str, str] = {f.id: f.source for f in findings}
    for s in scores:
        if s.finding_id not in by_id:
            continue
        if s.scorer == sources[s.finding_id]:
            continue  # ignore self-scores
        by_id[s.finding_id].append(s)
    out: dict[str, ConsensusMetadata] = {}
    for fid, fs in by_id.items():
        if not fs:
            out[fid] = ConsensusMetadata(
                finding_id=fid, consensus_strength=0.0,
                dissent_count=0, scorers=(), mean_score=0.0,
            )
            continue
        mean = sum(s.score for s in fs) / len(fs)
        agree_rate = sum(1 for s in fs if s.agree) / len(fs)
        strength = (mean / 10.0) * agree_rate
        dissent = sum(1 for s in fs if not s.agree)
        scorers = tuple(s.scorer for s in fs)
        out[fid] = ConsensusMetadata(
            finding_id=fid, consensus_strength=round(strength, 3),
            dissent_count=dissent, scorers=scorers,
            mean_score=round(mean, 2),
        )
    return out


def bucket_by_threshold(
    findings: Iterable[Finding],
    metadata: dict[str, ConsensusMetadata],
    *,
    strong: float = DEFAULT_STRONG_THRESHOLD,
    minority: float = DEFAULT_MINORITY_THRESHOLD,
) -> ConsensusBucket:
    """Split findings into Strong / Findings / Minority buckets.

    `strong` and `minority` are the thresholds from
    `.agent-settings.yml::ai_council.consensus_threshold_*`. Findings
    with no metadata (no scorers) fall into the Minority bucket — they
    were uncontested but unsupported.
    """
    if not 0.0 <= minority <= strong <= 1.0:
        raise ValueError(
            f"Threshold ordering broken: 0 <= {minority} <= {strong} <= 1 required.",
        )
    bucket = ConsensusBucket()
    for f in findings:
        m = metadata.get(f.id)
        if m is None:
            m = ConsensusMetadata(
                finding_id=f.id, consensus_strength=0.0,
                dissent_count=0, scorers=(), mean_score=0.0,
            )
        if m.consensus_strength > strong:
            bucket.strong.append((f, m))
        elif m.consensus_strength > minority:
            bucket.findings.append((f, m))
        else:
            bucket.minority.append((f, m))
    # Strongest first inside each bucket.
    for lst in (bucket.strong, bucket.findings, bucket.minority):
        lst.sort(key=lambda pair: pair[1].consensus_strength, reverse=True)
    return bucket


def parse_findings_response(text: str, *, source: str) -> list[Finding]:
    """Parse a member's structured-findings response into Finding objects.

    Accepts either a fenced ```json``` block or a bare JSON array. Each
    item must be `{id: str, text: str}` (the `source` is set from the
    `source` arg so we can attribute findings to their author). Items
    missing required keys are skipped silently — extraction is best-
    effort, never raises.
    """
    array = _extract_json_array(text)
    if not array:
        return []
    try:
        parsed = json.loads(array)
    except json.JSONDecodeError:
        return []
    if not isinstance(parsed, list):
        return []
    out: list[Finding] = []
    for item in parsed:
        if not isinstance(item, dict):
            continue
        fid = item.get("id")
        txt = item.get("text")
        if not fid or not txt:
            continue
        out.append(Finding(id=str(fid), source=source, text=str(txt).strip()))
    return out


def parse_scores_response(text: str, *, scorer: str) -> list[FindingScore]:
    """Parse a member's scoring response into FindingScore objects.

    Each item must be `{finding_id, score, agree, reason}`. Scores are
    clamped to 1..10; non-numeric scores or out-of-range values cause
    the item to be skipped (defensive — never poison aggregates).
    """
    array = _extract_json_array(text)
    if not array:
        return []
    try:
        parsed = json.loads(array)
    except json.JSONDecodeError:
        return []
    if not isinstance(parsed, list):
        return []
    out: list[FindingScore] = []
    for item in parsed:
        if not isinstance(item, dict):
            continue
        fid = item.get("finding_id") or item.get("id")
        score = item.get("score")
        if not fid or not isinstance(score, (int, float)):
            continue
        score_int = int(score)
        if not 1 <= score_int <= 10:
            continue
        out.append(FindingScore(
            finding_id=str(fid), scorer=scorer, score=score_int,
            agree=bool(item.get("agree", True)),
            reason=str(item.get("reason", "")).strip(),
        ))
    return out


def _extract_json_array(text: str) -> str:
    """Best-effort JSON-array extraction from a model response."""
    if not text:
        return ""
    fenced = _JSON_BLOCK.search(text)
    if fenced:
        return fenced.group(1)
    bare = _BARE_ARRAY.search(text)
    if bare:
        return bare.group(1)
    return ""


def anonymize_findings(findings: list[Finding]) -> dict[str, Finding]:
    """Return `{anon_label: Finding}` map so scorers see neutral labels.

    Labels are `Finding-A`, `Finding-B`, … in input order. The author
    mapping must be kept out of the prompt — keep it server-side only.
    """
    out: dict[str, Finding] = {}
    for idx, f in enumerate(findings):
        label = f"Finding-{chr(ord('A') + idx)}"
        out[label] = f
    return out
