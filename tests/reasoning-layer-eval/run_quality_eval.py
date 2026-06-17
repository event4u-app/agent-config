#!/usr/bin/env python3
"""RDP quality-layer eval runner (L8, Phase 1 of road-to-rdp-eval-and-promotion).

The trigger layer (skill_trigger_eval.py) answers "did the right discipline
fire?". This runner produces the QUALITY-layer transcripts — "did firing it
produce better work?" — that the trigger metric structurally cannot score
(5/8 RDP disciplines are lenses/gates, not routable skills; see
RESULTS-trigger-2026-06-16.md).

Design — controlled two-system-prompt differential (solves the
"a baseline cannot be produced from an RDP-active session" blocker):

  baseline  system prompt = BASE                 (suite posture, NO RDP layer)
  treatment system prompt = BASE + RDP_BLOCK      (suite posture + RDP layer)

The same task prompt runs through both. The model under measurement runs with
the system prompt this script supplies — it is NOT contaminated by the calling
agent's own active rules. The treatment − baseline delta isolates the RDP
layer's marginal effect, which is exactly what L8 measures.

Standard-band slots run on a weaker host (RDP should help most there); strong-
band slots run on a stronger host (RDP should not regress — the L10 auto-gate
keeps it light). Models are configurable.

Cost discipline mirrors skill_trigger_eval.py: a 0600 key file, a pre-run cost
preview, and NO spend without an explicit --confirm. Dry-run is the default.

Usage:
  .venv/bin/python3 tests/reasoning-layer-eval/run_quality_eval.py            # dry-run + cost preview
  .venv/bin/python3 tests/reasoning-layer-eval/run_quality_eval.py --confirm  # billable
  ... --slots 05,06,07,08,09        # subset (load-bearing lens/gate slots)
"""
from __future__ import annotations

import argparse
import datetime as _dt
import json
import os
import stat
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
CORPUS = HERE / "golden-transcripts" / "corpus-prompts.json"
OUT_DIR = HERE / "golden-transcripts"

# ---- key handling (mirror of skill_trigger_eval.load_anthropic_key) ----------
KEY_PATHS = [
    Path.home() / ".event4u" / "agent-config" / "anthropic.key",
    Path.home() / ".config" / "agent-config" / "anthropic.key",  # legacy
]


def load_anthropic_key() -> str:
    for p in KEY_PATHS:
        if not p.exists():
            continue
        mode = stat.S_IMODE(p.stat().st_mode)
        if mode & 0o077:
            raise SystemExit(f"{p} must be mode 0600 (found {oct(mode)}).")
        key = p.read_text(encoding="utf-8").strip()
        if not key.startswith("sk-ant-"):
            raise SystemExit(f"{p} does not contain an Anthropic key (no sk-ant- prefix).")
        return key
    raise SystemExit(
        "Anthropic key not found.\n    Install it once with: task install-anthropic-key"
    )


# ---- pricing (per Mtok in / out) — pre-run estimate only; real billing from
#      the API usage headers once a call returns. Deliberately slightly high. ---
PRICE = {
    "claude-sonnet-4-5": (3.0, 15.0),
    "claude-sonnet-4-6": (3.0, 15.0),
    "claude-haiku-4-5-20251001": (1.0, 5.0),
    "claude-haiku-4-5": (1.0, 5.0),
    "claude-3-5-haiku-20241022": (0.8, 4.0),
}


def price_for(model: str) -> tuple[float, float]:
    return PRICE.get(model, (3.0, 15.0))


def est_cost(model: str, tin: int, tout: int) -> float:
    pin, pout = price_for(model)
    return round(tin / 1e6 * pin + tout / 1e6 * pout, 6)


# ---- the two system prompts -------------------------------------------------
# BASE: the suite's non-RDP posture (so baseline is not a strawman). It already
# carries the always-on disciplines that exist independently of RDP.
BASE_SYSTEM = """You are a senior software engineering assistant working inside a real codebase.

Operating posture:
- Keep diffs minimal and scoped to the stated task; no drive-by refactors.
- When a requirement is ambiguous, you may ask one focused clarifying question.
- Do not claim work is complete without the evidence that proves it.
- Be direct and concise. No flattery, no filler.
"""

# RDP_BLOCK: the Reasoning Discipline Protocol layer — the ONLY variable between
# the two conditions. Faithful to src/rules/notes-first-reasoning.md and
# src/agent-src/contexts/execution/rdp-gate.md (the gate's "engage where it
# pays" framing is honored: skip the scaffolding on trivial/fully-specified
# tasks; on a complex/ambiguous/irreversible task, apply it).
RDP_BLOCK = """## Reasoning Discipline Protocol

Engage the protocol below only where it pays: skip it on trivial, short, fully
specified tasks (rename, one-liner, list files); apply it on complex, ambiguous,
multi-component, stateful, or irreversible tasks. If you are a strong-reasoning
model that already self-coordinates, apply it lightly.

1. GROUND BEFORE DESIGNING. Enumerate the constraints, available facts, and the
   information gaps the task leaves open. Close the load-bearing gaps (by asking
   or by stating an explicit assumption) BEFORE proposing a solution. Never design
   against unstated assumptions.

2. INFER THE REAL GOAL. When the literal request and the underlying goal may
   differ, state the inferred goal in one line, then give ONE recommendation —
   not a spread of framings.

3. COMPLEXITY-FIRST SEQUENCING. For multi-step work, resolve the hardest /
   most load-bearing unknown FIRST, before dependent work. Do not build the easy
   parts first and rework later. Name what you would tackle first and why.

4. NOTES-FIRST OUTPUT. Keep multi-hypothesis reasoning, predictions, and
   decisions in a clearly delimited "## Working notes" section. Your "## Answer"
   section carries CONCLUSIONS + EVIDENCE only — never a raw chain-of-thought
   dump. The answer must be readable by someone who saw none of the working
   thread: outcome-first, no arrow-chain shorthand.

5. VERIFIER GATE (risky change). When the task shows two or more of {branching /
   conditional logic, three or more explicit must/must-not constraints, stateful
   operations, irreversibility}, explicitly name what must be verified and how
   BEFORE treating the change as done. Surface the irreversible step for
   confirmation rather than executing it blind.

6. PREDICTIONS + DECISIONS (calibration / ledger). When you make an estimate,
   log it as a prediction with a confidence level so it can be checked against
   the actual outcome later. When you choose between alternatives, record the
   decision, the alternatives, the reason, and what would make you revisit it —
   in the Working notes, so a later session can reuse it instead of re-deriving.

7. ADAPTIVE EFFORT. Scale effort to difficulty; stop when marginal evidence
   drops rather than over-elaborating.
"""


# ORCHESTRATOR_PREAMBLE: the L6 component under test. Distributed-only = the
# RDP disciplines listed as a "buffet" (RDP_BLOCK alone). Orchestrated = the
# same disciplines run as ONE ordered chain with handoffs (the
# reasoning-orchestrator skill's "coherence, not exclusivity" value). The L6
# flip condition compares orchestrated vs distributed-only.
ORCHESTRATOR_PREAMBLE = """## Reasoning orchestration (run the disciplines as ONE ordered chain)

Do not treat the protocol below as an optional buffet. Run it as a single
coordinated chain, in order, with explicit handoffs between links — a skipped or
out-of-order link compounds downstream:

  ground → infer intent → write working notes → resolve the load-bearing unknown
  first → audit progress against real evidence → verify before claiming done.

Coordinate the links; do not let later steps run before earlier ones. On a
trivial or fully-specified task, do NOT force the chain (that is over-process) —
engage it only where the task is genuinely complex/ambiguous/interdependent.
"""


def build_systems() -> tuple[str, str]:
    return BASE_SYSTEM, BASE_SYSTEM + "\n\n" + RDP_BLOCK


def build_arms(mode: str) -> list[tuple[str, str]]:
    """Return [(variant_name, system_prompt), ...] for the run mode."""
    base, treat = build_systems()
    if mode == "l6":
        # distributed-only (buffet) vs orchestrated (ordered chain)
        return [
            ("distributed", treat),
            ("orchestrated", treat + "\n\n" + ORCHESTRATOR_PREAMBLE),
        ]
    # default quality mode: no-RDP baseline vs +RDP treatment
    return [("baseline", base), ("treatment", treat)]


def approx_tokens(text: str) -> int:
    # ~4 chars/token heuristic, same family as the trigger runner's estimate.
    return max(1, len(text) // 4)


def load_slots(selected: set[str] | None) -> list[dict]:
    data = json.loads(CORPUS.read_text(encoding="utf-8"))
    slots = data["slots"]
    if selected:
        slots = [s for s in slots if s["n"] in selected]
    return slots


def model_for(band: str, standard_model: str, strong_model: str) -> str:
    return strong_model if band == "strong" else standard_model


def main() -> int:
    ap = argparse.ArgumentParser(description="RDP quality-layer eval runner")
    ap.add_argument("--confirm", action="store_true", help="actually spend (billable)")
    ap.add_argument("--mode", choices=["quality", "l6"], default="quality",
                    help="quality = baseline vs treatment (RDP off/on); "
                         "l6 = distributed-only vs orchestrated (L6 flip condition)")
    ap.add_argument("--slots", default="", help="comma-separated slot numbers, e.g. 05,06,07")
    ap.add_argument("--standard-model", default="claude-haiku-4-5-20251001")
    ap.add_argument("--strong-model", default="claude-sonnet-4-5")
    ap.add_argument("--max-tokens", type=int, default=1600, help="per-call output cap")
    ap.add_argument("--results", default=str(OUT_DIR / "results.json"))
    args = ap.parse_args()

    selected = {s.strip().zfill(2) for s in args.slots.split(",") if s.strip()} or None
    slots = load_slots(selected)
    arms = build_arms(args.mode)
    variant_names = [a[0] for a in arms]

    # ---- cost preview --------------------------------------------------------
    calls = []
    for s in slots:
        model = model_for(s["band"], args.standard_model, args.strong_model)
        for variant, sysprompt in arms:
            tin = approx_tokens(sysprompt) + approx_tokens(s["prompt"])
            tout = args.max_tokens
            calls.append((s, variant, model, tin, tout, est_cost(model, tin, tout)))

    total = round(sum(c[5] for c in calls), 4)
    print(f"rdp-quality-eval · mode={args.mode} · {len(slots)} slots × "
          f"{len(arms)} variants ({'/'.join(variant_names)}) = {len(calls)} calls")
    print(f"  standard-band model: {args.standard_model}")
    print(f"  strong-band model:   {args.strong_model}")
    by_model: dict[str, float] = {}
    for _s, _v, m, _i, _o, c in calls:
        by_model[m] = round(by_model.get(m, 0.0) + c, 4)
    for m, c in by_model.items():
        print(f"    {m}: ~${c}")
    print(f"  EXPECTED TOTAL (worst-case, full output budget): ~${total}")

    if not args.confirm:
        print("\nDRY-RUN — no spend. Re-run with --confirm to capture transcripts.")
        return 0

    if not sys.stdin.isatty() and os.environ.get("RDP_EVAL_ALLOW_NONTTY") != "1":
        raise SystemExit(
            "Refusing a billable run on non-tty stdin. Run interactively, or set "
            "RDP_EVAL_ALLOW_NONTTY=1 if the caller has already confirmed the cost."
        )

    import anthropic  # soft dependency — only needed for the billable path

    client = anthropic.Anthropic(api_key=load_anthropic_key())
    ts = _dt.datetime.now(_dt.timezone.utc).strftime("%Y-%m-%d")
    results = []
    actual_cost = 0.0

    for s in slots:
        model = model_for(s["band"], args.standard_model, args.strong_model)
        variants = {}
        for variant, sysprompt in arms:
            print(f"  → slot {s['n']} {variant} ({model}) …", flush=True)
            resp = client.messages.create(
                model=model,
                max_tokens=args.max_tokens,
                system=sysprompt,
                messages=[{"role": "user", "content": s["prompt"]}],
            )
            text = "".join(b.text for b in resp.content if getattr(b, "type", "") == "text")
            usage = resp.usage
            tin, tout = usage.input_tokens, usage.output_tokens
            cost = est_cost(model, tin, tout)
            actual_cost += cost
            variants[variant] = {
                "model": model,
                "text": text,
                "input_tokens": tin,
                "output_tokens": tout,
                "cost_usd": cost,
            }
        a_out = variants[variant_names[0]]["output_tokens"]
        b_out = variants[variant_names[1]]["output_tokens"]
        overhead_pct = round((b_out - a_out) / a_out * 100, 1) if a_out else None
        results.append({
            "slot": s["n"], "slug": s["slug"], "family": s["family"],
            "band": s["band"], "discipline": s["discipline"], "prompt": s["prompt"],
            "model": model, "date": ts,
            "variants": variants,
            "output_token_overhead_pct": overhead_pct,
        })
        _write_transcript(s, variants, ts, overhead_pct, variant_names, args.mode)

    Path(args.results).write_text(json.dumps({
        "date": ts, "mode": args.mode, "standard_model": args.standard_model,
        "strong_model": args.strong_model, "actual_cost_usd": round(actual_cost, 4),
        "results": results,
    }, indent=2), encoding="utf-8")
    print(f"\nDONE · mode={args.mode} · actual ~${round(actual_cost, 4)} · transcripts in {OUT_DIR}")
    print(f"Results JSON: {args.results}")
    print("Next: hand-score each transcript against rubric.md (4 dims, 0–3).")
    return 0


def _write_transcript(slot: dict, variants: dict, ts: str, overhead_pct,
                      variant_names: list, mode: str) -> None:
    prefix = "l6-" if mode == "l6" else ""
    p = OUT_DIR / f"{prefix}{slot['n']}-{slot['slug']}.md"
    lines = [
        f"# Golden transcript — slot {slot['n']}: {slot['slug']}",
        "",
        f"- **Task family:** {slot['family']}",
        f"- **Host strength:** {slot['band']}",
        f"- **Discipline focus:** {slot['discipline']}",
        f"- **Captured:** {ts} (controlled two-system-prompt API harness; single rater)",
        "",
        "## Prompt",
        "",
        slot["prompt"],
        "",
    ]
    for variant in variant_names:
        v = variants[variant]
        lines += [
            f"## Transcript — {variant} ({v['model']})",
            "",
            "~~~text",
            v["text"].rstrip(),
            "~~~",
            "",
            f"**Tokens:** in {v['input_tokens']} / out {v['output_tokens']} / "
            f"est ${v['cost_usd']}",
            "",
        ]
    v0, v1 = variant_names[0], variant_names[1]
    if overhead_pct is not None:
        lines += [f"**Output-token overhead ({v1} vs {v0}):** {overhead_pct:+}%", ""]
    lines += [
        "## Rubric score (0–3 each) — fill during scoring",
        "",
        f"| dim | {v0} | {v1} | evidence (quote the transcript line) |",
        "|---|---|---|---|",
        "| 1 notes-first adherence |  |  |  |",
        "| 2 grounding |  |  |  |",
        "| 3 premature-solution avoidance |  |  |  |",
        "| 4 coherence / re-grounded summary |  |  |  |",
        "",
        f"- **{v0} mean:** _ / 3 · **{v1} mean:** _ / 3 · **delta:** _",
        "- **reasoning_extraction refusal seen?** no",
        "- **notes:** ",
        "",
    ]
    p.write_text("\n".join(lines), encoding="utf-8")


if __name__ == "__main__":
    raise SystemExit(main())
