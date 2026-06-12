"""Golden-parity driver for the command_suggester package.

Deterministic, timing-free harness used by the TS parity test. Runs the
pure-function surface (sanitize / parse_cooldown / detect_disable_directive /
is_explicit_slash_invocation) and the full match -> rank -> render pipeline
against the real `dist/agent-src/commands/` catalogue on a fixed set of
messages, then emits a canonical JSON document on stdout
(`json.dumps(..., indent=2, sort_keys=True, ensure_ascii=False)`).

Wall-clock / cooldown timing is excluded on purpose: the pipeline runs with a
fresh `CooldownStore` and no `record_shown`, so no timestamp leaks into the
output. Float scores are serialised via `repr(float)` so the TS twin can
match Python's float formatting byte-for-byte (e.g. `1.0` not `1`).

Usage: python3 _command_suggester_driver.py <commands_dir>
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

_THIS = Path(__file__).resolve()
REPO_ROOT = _THIS.parent.parent.parent
sys.path.insert(0, str(REPO_ROOT / "src" / "scripts"))

from command_suggester import (  # noqa: E402
    Settings,
    load_commands,
    match,
    rank,
    render,
    sanitize_context,
    sanitize_message,
    strip_code_blocks,
    strip_suggestion_echo,
    detect_disable_directive,
    is_explicit_slash_invocation,
)
from command_suggester.cooldown import parse_cooldown  # noqa: E402


# Deterministic message corpus exercising the matcher / ranker / renderer.
_MESSAGES = [
    "Setze Ticket ABC-123 um",
    "commit my changes and write a PR description",
    "do it now",
    "the weather is nice today",
    "commit my changes please now",
    "weiter mit ABC-123",
    "ci is failing on main, fix the pipeline",
    "explain `/commit` versus `/commit-in-chunks` from the docs",
    "please look at this output:\n```\nci is failing\n```\nnow what",
    "create a roadmap for the new feature work",
    "review my changes for correctness",
    "ok",
]

_SANITIZE_INPUTS = [
    "before\n```bash\ngit commit -m fix\n```\nafter",
    "use `/implement-ticket` somehow",
    "commit my changes please now",
    "```a\ncommit\n```\nmid\n```b\nfix-ci\n```",
    (
        "> 💡 Your request matches a command. Pick one or run as-is:\n"
        ">\n"
        "> 1. /implement-ticket — drive ticket end-to-end\n"
        "> 2. /refine-ticket — tighten AC\n"
        "> 3. Just run the prompt as-is, no command\n"
        "\n"
        "**Recommendation: 1 — /implement-ticket** — the request matches.\n"
    ),
    "> the docs say '/commit stages everything'",
    "",
]

_COOLDOWN_INPUTS = ["10m", "30s", "1h", "2d", "", "garbage", "5", "100x", None]

_DIRECTIVE_INPUTS = [
    "/command-suggestion-off",
    "  /command-suggestion-off  ",
    "/command-suggestion-on",
    "/command-suggestion-off then later /command-suggestion-on",
    "/command-suggestion-offline",
    "implement the feature",
    "",
]

_EXPLICIT_INPUTS = ["/quality-fix", "  /commit", "commit my changes", "", "/"]


def _match_to_dict(m) -> dict:
    return {
        "command": m.command,
        "score": repr(float(m.score)),
        "matched_trigger": m.matched_trigger,
        "evidence": m.evidence,
        "has_structural_bonus": m.has_structural_bonus,
    }


def main() -> int:
    commands_dir = Path(sys.argv[1])
    specs = load_commands(commands_dir)
    specs_by_name = {s.name: s for s in specs}
    settings = Settings()

    # Stable spec snapshot (eligible commands only — sorted by name).
    spec_snapshot = [
        {
            "name": s.name,
            "description": s.description,
            "eligible": s.eligible,
            "trigger_description": s.trigger_description,
            "trigger_context": s.trigger_context,
            "rationale": s.rationale,
            "confidence_floor": (
                None if s.confidence_floor is None else repr(float(s.confidence_floor))
            ),
            "cooldown": s.cooldown,
        }
        for s in sorted(specs, key=lambda x: (x.name, x.description))
    ]

    pipeline = []
    for msg in _MESSAGES:
        raw = match(msg, [], specs)
        ranked = rank(raw, settings, specs_by_name, raw_message=msg)
        block = render(ranked, specs_by_name)
        pipeline.append(
            {
                "message": msg,
                "raw_matches": [_match_to_dict(m) for m in raw],
                "ranked": [_match_to_dict(m) for m in ranked],
                "block": block,
            }
        )

    sanitize = [
        {
            "input": s,
            "strip_code_blocks": strip_code_blocks(s),
            "strip_suggestion_echo": strip_suggestion_echo(s),
            "sanitize_message": sanitize_message(s),
        }
        for s in _SANITIZE_INPUTS
    ]
    sanitize_ctx = sanitize_context(_SANITIZE_INPUTS)

    cooldown = [
        {"input": v, "parsed": parse_cooldown(v, 600)} for v in _COOLDOWN_INPUTS
    ]
    directives = [
        {"input": v, "detected": detect_disable_directive(v)} for v in _DIRECTIVE_INPUTS
    ]
    explicit = [
        {"input": v, "is_explicit": is_explicit_slash_invocation(v)}
        for v in _EXPLICIT_INPUTS
    ]

    doc = {
        "spec_count": len(specs),
        "eligible_count": sum(1 for s in specs if s.eligible),
        "specs": spec_snapshot,
        "pipeline": pipeline,
        "sanitize": sanitize,
        "sanitize_context": sanitize_ctx,
        "cooldown": cooldown,
        "directives": directives,
        "explicit": explicit,
    }
    sys.stdout.write(
        json.dumps(doc, indent=2, sort_keys=True, ensure_ascii=False)
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
