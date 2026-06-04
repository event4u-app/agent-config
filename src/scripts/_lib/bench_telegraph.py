# Telegraph condensation bench — step-16 Phase 1 Step 4.
#
# Three-arm live bench against internal/bench/corpora/telegraph/prompts.yaml:
#   condensed     — system prompt embeds telegraph-speak rule (aggressive).
#   terse_control  — system prompt = "Answer concisely. …" (carve-out-free baseline).
#   uncondensed   — generic helpful-assistant system prompt.
#
# Token counts come from Anthropic API `usage` (authoritative). Carve-out
# share is measured via regex extraction on the reply text; chars/4 yields
# an estimated carve-out-token figure for the carve-out-tax accounting.
#
# Cost-touch: 10 prompts × 3 arms × claude-sonnet-4-5 (~$3/M in, ~$15/M out).
"""Telegraph condensation bench runner."""
from __future__ import annotations

import re
import statistics
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import yaml

# ── system prompts per arm ──────────────────────────────────────────────

SYSTEM_PROMPT_CONDENSED = """You are speaking in TELEGRAPH-SPEAK mode (speak_scope=aggressive).

Condense all body prose to telegraph grammar:
- Drop articles (the, a, an).
- Drop linking auxiliaries (is, are, was, be) where unambiguous.
- Drop pronouns when context is clear.
- Keep nouns, verbs, key adjectives, negation, numbers.
- Example: "I will now check the file and see if it exists" -> "Check file. Exists?"

Carve-outs — preserve BYTE-FOR-BYTE (do NOT condense these):
1. Triple-backtick code/literal blocks (any language, including ALL-CAPS Iron-Law fences).
2. Numbered-options lines matching ^\\d+\\.\\s + a **Recommendation:** label.
3. Backtick spans (file paths, command names, identifiers).
4. Status markers: lines starting with ❌, ⚠️, or ✅.
5. Mode markers.
6. Markdown tables.
7. Deliverables (PR titles, commit messages, ticket summaries, articles, the prompt
   line of any single question asked to the user).

Apply telegraph condensation aggressively to every other prose surface."""

SYSTEM_PROMPT_TERSE = (
    "Answer concisely. Skip preamble. Do not restate the question. "
    "Avoid filler phrases ('Let me', 'Here is', 'I will'). Get to the answer."
)

SYSTEM_PROMPT_UNCONDENSED = (
    "You are a helpful AI assistant. Answer the user's question clearly and completely."
)

ARMS: tuple[str, ...] = ("condensed", "terse_control", "uncondensed")
ARM_SYSTEM_PROMPT: dict[str, str] = {
    "condensed": SYSTEM_PROMPT_CONDENSED,
    "terse_control": SYSTEM_PROMPT_TERSE,
    "uncondensed": SYSTEM_PROMPT_UNCONDENSED,
}

# ── carve-out detection ────────────────────────────────────────────────

_RE_TRIPLE_BACKTICK = re.compile(r"```[\s\S]*?```")
_RE_BACKTICK_SPAN = re.compile(r"`[^`\n]+`")
_RE_NUMBERED_LINE = re.compile(r"^>?\s*\d+\.\s.*$", re.MULTILINE)
_RE_STATUS_LINE = re.compile(r"^(❌|⚠️|✅).*$", re.MULTILINE)
_RE_TABLE_LINE = re.compile(r"^\s*\|.*\|\s*$", re.MULTILINE)
_RE_RECOMMENDATION = re.compile(r"^\*\*(Recommendation|Empfehlung):\*\*.*$", re.MULTILINE)


def carve_out_chars(text: str) -> int:
    """Sum byte-length of every carve-out region (union, no double-count)."""
    if not text:
        return 0
    mask = bytearray(len(text))
    for pattern in (
        _RE_TRIPLE_BACKTICK, _RE_BACKTICK_SPAN, _RE_NUMBERED_LINE,
        _RE_STATUS_LINE, _RE_TABLE_LINE, _RE_RECOMMENDATION,
    ):
        for m in pattern.finditer(text):
            for i in range(m.start(), m.end()):
                mask[i] = 1
    return sum(mask)


# ── data shapes ────────────────────────────────────────────────────────

@dataclass
class ArmResult:
    arm: str
    text: str
    input_tokens: int
    output_tokens: int
    latency_ms: int
    output_chars: int
    carve_out_chars: int
    error: str | None = None

    @property
    def realised_carve_out_pct(self) -> float:
        return self.carve_out_chars / self.output_chars if self.output_chars else 0.0


@dataclass
class PromptResult:
    id: str
    category: str
    expected_carve_out_pct: float
    arms: dict[str, ArmResult] = field(default_factory=dict)

    @property
    def savings_vs_raw(self) -> float | None:
        c = self.arms.get("condensed")
        u = self.arms.get("uncondensed")
        if not c or not u or u.output_tokens == 0:
            return None
        return 1.0 - (c.output_tokens / u.output_tokens)

    @property
    def savings_vs_terse(self) -> float | None:
        c = self.arms.get("condensed")
        t = self.arms.get("terse_control")
        if not c or not t or t.output_tokens == 0:
            return None
        return 1.0 - (c.output_tokens / t.output_tokens)


# ── corpus + runner ────────────────────────────────────────────────────

def load_corpus(corpus_path: Path) -> list[dict[str, Any]]:
    """Read internal/bench/corpora/telegraph/prompts.yaml → list of prompt dicts."""
    data = yaml.safe_load(corpus_path.read_text(encoding="utf-8")) or {}
    prompts = data.get("prompts") or []
    if not prompts:
        raise ValueError(f"empty corpus: {corpus_path}")
    return prompts


def run_arm(
    client: Any,
    arm: str,
    user_prompt: str,
    *,
    max_tokens: int = 1024,
) -> ArmResult:
    """Invoke one arm against the live API. Returns ArmResult including text."""
    t0 = time.monotonic()
    system = ARM_SYSTEM_PROMPT[arm]
    try:
        resp = client.ask(system, user_prompt, max_tokens=max_tokens)
    except Exception as exc:  # noqa: BLE001
        latency_ms = int((time.monotonic() - t0) * 1000)
        return ArmResult(arm=arm, text="", input_tokens=0, output_tokens=0,
                         latency_ms=latency_ms, output_chars=0, carve_out_chars=0,
                         error=str(exc))
    return ArmResult(
        arm=arm, text=resp.text or "",
        input_tokens=int(resp.input_tokens or 0),
        output_tokens=int(resp.output_tokens or 0),
        latency_ms=int(resp.latency_ms or (time.monotonic() - t0) * 1000),
        output_chars=len(resp.text or ""),
        carve_out_chars=carve_out_chars(resp.text or ""),
        error=resp.error,
    )


# ── aggregation ────────────────────────────────────────────────────────────

def _stats(values: list[float]) -> dict[str, float]:
    """Median / p10 / p90 / stdev / n on a list of floats. Empty → zeros."""
    if not values:
        return {"n": 0, "median": 0.0, "p10": 0.0, "p90": 0.0, "stdev": 0.0}
    s = sorted(values)
    n = len(s)
    def _pct(p: float) -> float:
        if n == 1:
            return s[0]
        k = (n - 1) * p
        lo, hi = int(k), min(int(k) + 1, n - 1)
        return s[lo] + (s[hi] - s[lo]) * (k - lo)
    return {
        "n": n,
        "median": statistics.median(s),
        "p10": _pct(0.10),
        "p90": _pct(0.90),
        "stdev": statistics.pstdev(s) if n > 1 else 0.0,
    }


def aggregate_results(results: list[PromptResult]) -> dict[str, Any]:
    """Compute median/p10/p90 for condensation metrics across the corpus."""
    vs_raw = [r.savings_vs_raw for r in results if r.savings_vs_raw is not None]
    vs_terse = [r.savings_vs_terse for r in results if r.savings_vs_terse is not None]
    realised_carve_pct = [
        r.arms["condensed"].realised_carve_out_pct
        for r in results if "condensed" in r.arms and r.arms["condensed"].output_chars
    ]
    expected_carve_pct = [r.expected_carve_out_pct for r in results]

    per_arm_tokens: dict[str, list[int]] = {a: [] for a in ARMS}
    for r in results:
        for arm in ARMS:
            ar = r.arms.get(arm)
            if ar:
                per_arm_tokens[arm].append(ar.output_tokens)

    return {
        "savings_vs_raw": _stats(vs_raw),
        "savings_vs_terse": _stats(vs_terse),
        "realised_carve_out_pct": _stats(realised_carve_pct),
        "expected_carve_out_pct": _stats(expected_carve_pct),
        "output_tokens": {
            arm: _stats([float(v) for v in per_arm_tokens[arm]]) for arm in ARMS
        },
    }


def compute_cost(results: list[PromptResult], pricing: dict[str, float]) -> dict[str, Any]:
    """Sum input/output tokens across all arms; cost from per-1M pricing dict."""
    totals = {"input_tokens": 0, "output_tokens": 0, "calls": 0, "errors": 0}
    per_arm: dict[str, dict[str, int]] = {a: {"input_tokens": 0, "output_tokens": 0, "calls": 0} for a in ARMS}
    for r in results:
        for arm, ar in r.arms.items():
            totals["input_tokens"] += ar.input_tokens
            totals["output_tokens"] += ar.output_tokens
            totals["calls"] += 1
            if ar.error:
                totals["errors"] += 1
            per_arm[arm]["input_tokens"] += ar.input_tokens
            per_arm[arm]["output_tokens"] += ar.output_tokens
            per_arm[arm]["calls"] += 1
    cost_usd = (
        totals["input_tokens"] / 1e6 * pricing.get("input", 0.0)
        + totals["output_tokens"] / 1e6 * pricing.get("output", 0.0)
    )
    totals["total_cost_usd"] = round(cost_usd, 6)
    return {"totals": totals, "per_arm": per_arm}


# ── orchestrator ───────────────────────────────────────────────────────────

def run_telegraph_bench(
    client: Any,
    corpus_path: Path,
    *,
    max_prompts: int | None = None,
    max_tokens: int = 1024,
    on_progress: Any = None,
) -> list[PromptResult]:
    """Run all three arms over the corpus. Returns per-prompt results."""
    prompts = load_corpus(corpus_path)
    if max_prompts:
        prompts = prompts[:max_prompts]
    results: list[PromptResult] = []
    total = len(prompts) * len(ARMS)
    done = 0
    for p in prompts:
        pr = PromptResult(
            id=str(p["id"]),
            category=str(p.get("category", "unknown")),
            expected_carve_out_pct=float(p.get("expected_carve_out_pct", 0.0)),
        )
        for arm in ARMS:
            ar = run_arm(client, arm, str(p["prompt"]), max_tokens=max_tokens)
            pr.arms[arm] = ar
            done += 1
            if on_progress:
                on_progress(done, total, pr.id, arm, ar)
        results.append(pr)
    return results
