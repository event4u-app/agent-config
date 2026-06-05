#!/usr/bin/env python3
"""Plain-mode renderer for the ``explain-v1`` envelope — Phase 6.

Implements ``docs/contracts/explain-modes.md``. Pure function over the
envelope; no I/O. Per-role glossary YAMLs override the default labels +
band thresholds.

CLI::

    workspace_explain.py render --mode plain|technical [--role <slug>] \
                                [--envelope-file <p>] [--glossary <p>]
"""

from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

DEFAULT_BANDS_CONFIDENCE = {"very_high": 0.85, "high": 0.65, "medium": 0.40}
DEFAULT_BANDS_FRESHNESS = {"fresh": 0.80, "aging": 0.50}

DEFAULT_LABELS_PLAIN = {
    "confidence": "How confident",
    "sources": "Where this came from",
    "last_reviewed": "When last reviewed",
    "contradictions": "What's contested",
}

LABELS_TECHNICAL = {
    "confidence": "Trust score",
    "sources": "Sources",
    "last_reviewed": "Last reviewed",
    "contradictions": "Unresolved contradictions",
}


@dataclass
class Glossary:
    labels: dict[str, str]
    bands_confidence: dict[str, float]
    bands_freshness: dict[str, float]

    @classmethod
    def default(cls) -> "Glossary":
        return cls(labels=dict(DEFAULT_LABELS_PLAIN),
                   bands_confidence=dict(DEFAULT_BANDS_CONFIDENCE),
                   bands_freshness=dict(DEFAULT_BANDS_FRESHNESS))


def load_glossary(path: Path) -> Glossary:
    g = Glossary.default()
    if not path.exists():
        return g
    in_labels = False
    in_bands = False
    in_bc = False
    in_bf = False
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.rstrip()
        if not line or line.lstrip().startswith("#"):
            continue
        if line == "labels:":
            in_labels, in_bands, in_bc, in_bf = True, False, False, False
            continue
        if line == "bands:":
            in_labels, in_bands = False, True
            continue
        if in_bands and line.lstrip().startswith("confidence:"):
            in_bc, in_bf = True, False
            continue
        if in_bands and line.lstrip().startswith("freshness:"):
            in_bc, in_bf = False, True
            continue
        if in_labels and ":" in line and line.startswith("  "):
            k, _, v = line.strip().partition(":")
            g.labels[k.strip()] = v.strip().strip("'\"")
        elif (in_bc or in_bf) and ":" in line and line.startswith("    "):
            k, _, v = line.strip().partition(":")
            try:
                val = float(v.strip())
            except ValueError:
                continue
            if in_bc:
                g.bands_confidence[k.strip()] = val
            else:
                g.bands_freshness[k.strip()] = val
    return g


def _band(score: float, bands: dict[str, float], plain: bool) -> str:
    if plain:
        if score >= bands.get("very_high", 0.85):
            return "Very High"
        if score >= bands.get("high", 0.65):
            return "High"
        if score >= bands.get("medium", 0.40):
            return "Medium"
        return "Low"
    return f"{score:.2f}"


def _freshness_band(score: float, bands: dict[str, float]) -> str:
    if score >= bands.get("fresh", 0.80):
        return "Fresh"
    if score >= bands.get("aging", 0.50):
        return "Aging"
    return "Stale"


def _human_relative(ts: str, *, now: datetime | None = None) -> str:
    try:
        when = datetime.strptime(ts, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)
    except (TypeError, ValueError):
        return ts or "(unavailable)"
    ref = now or datetime.now(timezone.utc)
    delta = ref - when
    days = delta.days
    if days < 1:
        h = max(1, int(delta.total_seconds() // 3600))
        return f"{h} hour{'s' if h != 1 else ''} ago"
    if days < 30:
        return f"{days} day{'s' if days != 1 else ''} ago"
    months = days // 30
    return f"{months} month{'s' if months != 1 else ''} ago"


def render(envelope: dict, *, mode: str = "plain",
           glossary: Glossary | None = None,
           now: datetime | None = None) -> dict:
    plain = mode != "technical"
    g = glossary or Glossary.default()
    labels = g.labels if plain else LABELS_TECHNICAL
    trust = float(envelope.get("trust_score") or 0.0)
    decay = envelope.get("decay") or {}
    fresh = float(decay.get("applied_factor") or 0.0)
    sources = (envelope.get("evidence") or {}).get("sources") or []
    contradictions = envelope.get("contradictions") or []
    last_reviewed = envelope.get("last_reviewed_at")
    lines = []
    lines.append(f"## {labels['sources']}")
    lines.append(f"{len(sources)} source(s)" + (" — " + ", ".join(sources[:5]) if sources else ""))
    lines.append("")
    lines.append(f"## {labels['confidence']}")
    lines.append(f"{_band(trust, g.bands_confidence, plain)}"
                 + (f" ({trust:.2f})" if plain else ""))
    lines.append("")
    lines.append(f"## {labels['last_reviewed']}")
    if plain:
        lines.append(_human_relative(last_reviewed or "", now=now)
                     + f" · {_freshness_band(fresh, g.bands_freshness)}")
    else:
        lines.append(f"{last_reviewed or '(unavailable)'} · decay={fresh:.2f}")
    lines.append("")
    lines.append(f"## {labels['contradictions']}")
    lines.append(f"{len(contradictions)} open" if contradictions else
                 ("No open disagreements." if plain else "0"))
    return {
        "markdown": "\n".join(lines).rstrip() + "\n",
        "mode": "plain" if plain else "technical",
        "ids": [envelope.get("id")] if envelope.get("id") else [],
    }


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(prog="workspace_explain")
    sub = p.add_subparsers(dest="cmd", required=True)
    s_render = sub.add_parser("render")
    s_render.add_argument("--mode", choices=("plain", "technical"), default="plain")
    s_render.add_argument("--envelope-file", required=True)
    s_render.add_argument("--glossary")
    args = p.parse_args(argv)
    if args.cmd == "render":
        env = json.loads(Path(args.envelope_file).read_text(encoding="utf-8"))
        gloss = load_glossary(Path(args.glossary)) if args.glossary else None
        out = render(env, mode=args.mode, glossary=gloss)
        print(json.dumps(out, sort_keys=True))
        return 0
    return 2


if __name__ == "__main__":
    sys.exit(main())
