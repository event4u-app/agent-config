#!/usr/bin/env python3
"""Skill trigger evaluation runner.

Phase 1 of agents/roadmaps/road-to-trigger-evals.md — measures whether a
pilot skill's frontmatter description actually causes Claude to route to
the skill for queries that should trigger it, and to avoid routing for
queries that should not.

Input:  one skill name + its evals/triggers.json (5 should-trigger +
        5 should-not-trigger queries).
Output: evals/last-run.json with per-query observed vs expected,
        aggregate precision/recall, model id, timestamp, cost estimate.

Design notes:
- The real Anthropic client is a **soft** dependency. If the `anthropic`
  package is not installed, only --dry-run works (mock router).
- The router is injectable — tests use a `MockRouter` that returns a
  canned list per query. CI never makes real API calls.
- The full set of skill frontmatter (name + description) is passed in
  every routing call. That is the actual production routing condition;
  anything less is cheating.

Budget per roadmap: ≤500 LoC single file, no framework.
"""
from __future__ import annotations

import argparse
import json
import sys
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable, Protocol

PROJECT_ROOT = Path(__file__).resolve().parent.parent
SKILLS_SOURCE = PROJECT_ROOT / ".agent-src.uncompressed" / "skills"
DEFAULT_MODEL = "claude-sonnet-4-5"

# Approximate Anthropic API pricing (USD per 1M tokens). Used for the
# cost estimate only — exact billing comes from the API response headers
# once we run with a real key.
PRICE_PER_MTOK_IN = {"claude-sonnet-4-5": 3.0, "claude-opus-4": 15.0}
PRICE_PER_MTOK_OUT = {"claude-sonnet-4-5": 15.0, "claude-opus-4": 75.0}


@dataclass
class SkillMeta:
    """Name + description of one skill, loaded from SKILL.md frontmatter."""

    name: str
    description: str


@dataclass
class Query:
    q: str
    trigger: bool


@dataclass
class QueryResult:
    q: str
    expected: bool
    observed: bool
    loaded_skills: list[str]
    passed: bool


@dataclass
class Metrics:
    true_positive: int = 0
    false_positive: int = 0
    true_negative: int = 0
    false_negative: int = 0
    precision: float = 0.0
    recall: float = 0.0


@dataclass
class EvalResult:
    skill: str
    model: str
    timestamp: str
    router: str
    queries: list[QueryResult] = field(default_factory=list)
    metrics: Metrics = field(default_factory=Metrics)
    input_tokens: int = 0
    output_tokens: int = 0
    cost_usd_estimate: float = 0.0


class TriggerRouter(Protocol):
    """Contract: given a user query and the full skill catalogue, return
    the list of skill names the model would load. Implementations decide
    whether that means a live API call or a canned response."""

    name: str

    def route(self, query: str, skills: list[SkillMeta]) -> tuple[list[str], int, int]:
        """Returns (loaded_skill_names, input_tokens, output_tokens)."""
        ...


class MockRouter:
    """Deterministic router for tests and dry-runs.

    Constructed with a callable `decide(query, skills) -> list[str]`.
    Token counts are faked as len(query)//4 + len(skills)*20 for input
    and 16 for output, which keeps the cost-estimate math testable
    without inventing numbers that look real.
    """

    name = "mock"

    def __init__(self, decide: Callable[[str, list[SkillMeta]], list[str]]):
        self._decide = decide

    def route(self, query: str, skills: list[SkillMeta]) -> tuple[list[str], int, int]:
        loaded = self._decide(query, skills)
        return loaded, len(query) // 4 + len(skills) * 20, 16


def load_skill_metas(root: Path = SKILLS_SOURCE) -> list[SkillMeta]:
    """Parse name + description from every SKILL.md frontmatter under root."""
    metas: list[SkillMeta] = []
    for skill_dir in sorted(p for p in root.iterdir() if p.is_dir()):
        skill_md = skill_dir / "SKILL.md"
        if not skill_md.exists():
            continue
        meta = _parse_frontmatter(skill_md)
        if meta is not None:
            metas.append(meta)
    return metas


def _parse_frontmatter(path: Path) -> SkillMeta | None:
    text = path.read_text(encoding="utf-8")
    if not text.startswith("---"):
        return None
    end = text.find("\n---", 3)
    if end < 0:
        return None
    block = text[3:end]
    name = _extract_field(block, "name")
    desc = _extract_field(block, "description")
    if name is None or desc is None:
        return None
    return SkillMeta(name=name, description=desc)


def _extract_field(block: str, field_name: str) -> str | None:
    """Minimal YAML-ish frontmatter field extractor — supports quoted
    and unquoted single-line values. We do not pull PyYAML in here; the
    audit script already proved stdlib suffices for our frontmatter."""
    prefix = f"{field_name}:"
    for line in block.splitlines():
        stripped = line.lstrip()
        if not stripped.startswith(prefix):
            continue
        value = stripped[len(prefix):].strip()
        if value.startswith('"') and value.endswith('"'):
            value = value[1:-1]
        elif value.startswith("'") and value.endswith("'"):
            value = value[1:-1]
        return value
    return None


def load_triggers(path: Path) -> tuple[str, list[Query]]:
    """Read evals/triggers.json. Returns (skill_name, queries)."""
    data = json.loads(path.read_text(encoding="utf-8"))
    skill = data["skill"]
    queries = [Query(q=item["q"], trigger=bool(item["trigger"])) for item in data["queries"]]
    if not queries:
        raise ValueError(f"{path} has zero queries; roadmap minimum is 10")
    return skill, queries


def run_eval(
    skill_name: str,
    queries: list[Query],
    router: TriggerRouter,
    skills: list[SkillMeta],
    model: str = DEFAULT_MODEL,
) -> EvalResult:
    """Execute every query through `router` and aggregate into EvalResult."""
    result = EvalResult(
        skill=skill_name,
        model=model,
        timestamp=datetime.now(timezone.utc).isoformat(timespec="seconds"),
        router=router.name,
    )
    for q in queries:
        loaded, in_tok, out_tok = router.route(q.q, skills)
        observed = skill_name in loaded
        passed = observed == q.trigger
        result.queries.append(
            QueryResult(
                q=q.q,
                expected=q.trigger,
                observed=observed,
                loaded_skills=sorted(loaded),
                passed=passed,
            )
        )
        result.input_tokens += in_tok
        result.output_tokens += out_tok
    result.metrics = compute_metrics(result.queries)
    result.cost_usd_estimate = estimate_cost(model, result.input_tokens, result.output_tokens)
    return result


def compute_metrics(results: list[QueryResult]) -> Metrics:
    tp = sum(1 for r in results if r.expected and r.observed)
    fp = sum(1 for r in results if not r.expected and r.observed)
    tn = sum(1 for r in results if not r.expected and not r.observed)
    fn = sum(1 for r in results if r.expected and not r.observed)
    precision = tp / (tp + fp) if (tp + fp) else 0.0
    recall = tp / (tp + fn) if (tp + fn) else 0.0
    return Metrics(
        true_positive=tp,
        false_positive=fp,
        true_negative=tn,
        false_negative=fn,
        precision=round(precision, 3),
        recall=round(recall, 3),
    )


def estimate_cost(model: str, in_tokens: int, out_tokens: int) -> float:
    """Rough pre-invoice cost estimate. Real figure comes from response
    headers once we wire a real key — this is only used to sanity-check
    the roadmap's ≤$5-per-run budget before launching a batch."""
    price_in = PRICE_PER_MTOK_IN.get(model, 3.0)
    price_out = PRICE_PER_MTOK_OUT.get(model, 15.0)
    cost = (in_tokens / 1_000_000) * price_in + (out_tokens / 1_000_000) * price_out
    return round(cost, 6)


def write_result(result: EvalResult, output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    payload = asdict(result)
    output_path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")


def format_summary(result: EvalResult) -> str:
    m = result.metrics
    total = len(result.queries)
    pass_count = sum(1 for r in result.queries if r.passed)
    fail_count = total - pass_count
    lines = [
        f"Skill:     {result.skill}",
        f"Router:    {result.router}    Model: {result.model}",
        f"Queries:   {total}  ({pass_count} pass, {fail_count} fail)",
        f"Precision: {m.precision}  (TP={m.true_positive} FP={m.false_positive})",
        f"Recall:    {m.recall}  (TP={m.true_positive} FN={m.false_negative})",
        f"Tokens:    in={result.input_tokens}  out={result.output_tokens}  "
        f"cost~${result.cost_usd_estimate}",
    ]
    if fail_count:
        lines.append("")
        lines.append("Failures:")
        for r in result.queries:
            if r.passed:
                continue
            lines.append(
                f"  [{'FN' if r.expected else 'FP'}] expected={r.expected} "
                f"observed={r.observed} :: {r.q}"
            )
    return "\n".join(lines)


ROUTING_PROMPT_HEADER = """You are a skill-routing oracle. Given the catalogue below
and a single user query, return ONLY the JSON object {"would_load": [...]}
listing the skill names whose bodies you would load to answer the query.

Rules:
- Use the skill frontmatter description verbatim as the only routing signal.
- Return at most 4 skill names.
- If no skill applies, return {"would_load": []}.
- Output ONLY the JSON. No prose, no code fences.

Skill catalogue (name :: description):
"""


class AnthropicRouter:
    """Real-API router. Builds a routing prompt with the full skill
    catalogue, asks the model for structured JSON output, parses the
    `would_load` list. Token counts come from the usage field of the
    SDK response."""

    name = "anthropic"

    def __init__(self, model: str = DEFAULT_MODEL, client=None, max_tokens: int = 256):
        self._model = model
        self._max_tokens = max_tokens
        if client is not None:
            self._client = client
        else:
            try:
                import anthropic  # type: ignore[import-not-found]
            except ImportError as exc:  # pragma: no cover - exercised only with real key
                raise RuntimeError(
                    "anthropic package not installed. "
                    "`pip install anthropic` or run with --dry-run."
                ) from exc
            self._client = anthropic.Anthropic()

    def route(self, query: str, skills: list[SkillMeta]) -> tuple[list[str], int, int]:
        catalogue = "\n".join(f"- {s.name} :: {s.description}" for s in skills)
        prompt = ROUTING_PROMPT_HEADER + catalogue + "\n"
        response = self._client.messages.create(
            model=self._model,
            max_tokens=self._max_tokens,
            system=prompt,
            messages=[{"role": "user", "content": query}],
        )
        text = _first_text_block(response)
        loaded = _parse_would_load(text)
        usage = getattr(response, "usage", None)
        in_tok = getattr(usage, "input_tokens", 0) if usage else 0
        out_tok = getattr(usage, "output_tokens", 0) if usage else 0
        return loaded, in_tok, out_tok


def _first_text_block(response) -> str:
    """Extract the text from the first content block of an Anthropic
    Messages API response."""
    content = getattr(response, "content", None)
    if not content:
        return ""
    first = content[0]
    return getattr(first, "text", "") or ""


def _parse_would_load(text: str) -> list[str]:
    """Parse `{"would_load": [...]}` out of a model response. Tolerates
    leading/trailing whitespace and code fences even though the prompt
    forbids them — models occasionally ignore that instruction."""
    stripped = text.strip()
    if stripped.startswith("```"):
        stripped = stripped.strip("`").lstrip("json").strip()
    try:
        data = json.loads(stripped)
    except json.JSONDecodeError:
        return []
    loaded = data.get("would_load", [])
    if not isinstance(loaded, list):
        return []
    return [str(name) for name in loaded]


def build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--skill", required=True, help="Skill name (e.g. eloquent)")
    parser.add_argument(
        "--triggers",
        type=Path,
        default=None,
        help="Path to evals/triggers.json. Default: .agent-src.uncompressed/skills/<skill>/evals/triggers.json",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=None,
        help="Path to write last-run.json. Default: <triggers-dir>/last-run.json",
    )
    parser.add_argument("--model", default=DEFAULT_MODEL)
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Use MockRouter (no API call). Returns the pilot skill only for should-trigger queries.",
    )
    return parser


def _default_triggers_path(skill: str) -> Path:
    return SKILLS_SOURCE / skill / "evals" / "triggers.json"


def main(argv: list[str] | None = None) -> int:
    args = build_arg_parser().parse_args(argv)
    triggers_path = args.triggers or _default_triggers_path(args.skill)
    if not triggers_path.exists():
        print(f"❌  triggers.json not found: {triggers_path}", file=sys.stderr)
        return 2

    skill_from_file, queries = load_triggers(triggers_path)
    if skill_from_file != args.skill:
        print(
            f"❌  skill mismatch: --skill={args.skill} but triggers.json says {skill_from_file}",
            file=sys.stderr,
        )
        return 2

    skills = load_skill_metas()
    if args.dry_run:
        expected = {q.q: q.trigger for q in queries}

        def decide(query: str, _skills: list[SkillMeta]) -> list[str]:
            return [args.skill] if expected.get(query, False) else []

        router: TriggerRouter = MockRouter(decide)
    else:
        router = AnthropicRouter(model=args.model)

    result = run_eval(args.skill, queries, router, skills, model=args.model)
    output_path = args.output or triggers_path.parent / "last-run.json"
    write_result(result, output_path)
    print(format_summary(result))
    print(f"\nWrote: {output_path}")
    fail_count = sum(1 for r in result.queries if not r.passed)
    return 1 if fail_count else 0


if __name__ == "__main__":
    sys.exit(main())

