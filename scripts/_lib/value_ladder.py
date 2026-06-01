"""Pure normaliser: raw bench reports → `value-v1` rung dicts.

Phase 1 Step 2 of `agents/roadmaps/road-to-readable-value-dashboard.md`.

This module is **pure** — no I/O, no file reads, no clock. Inputs are
already-loaded dicts; outputs are rung dicts conforming to
`docs/contracts/value-report-schema.md`. The companion
`scripts/_lib/value_report.py` owns the I/O wrapper that loads the raw
reports, calls these functions, and writes the assembled JSON.

Rung dict shape (see `value-report-schema.md` for the full contract):

    {
        "id": "<kebab-case>",
        "label": "<German + English>",
        "what_it_does": "<≤ 80 char phrase>",
        "token_delta": <signed int>,
        "eur_delta": <float>,
        "cumulative_pct": <signed float>,   # filled in by assemble_ladder
        "confidence": "measured" | "estimated" | "vendor-claim" | "pending",
        "source_report": "<relative path>",
        "footnote": "<optional caveat>",    # omitted when no caveat
    }
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional

# ── Reference scale defaults ────────────────────────────────────────────

DEFAULT_REFERENCE_SCALE = {
    "requests": 1000,
    "avg_input_tokens": 8000,
    "avg_output_tokens": 600,
    "model_tier": "sonnet",
}

# Confidence levels that contribute to the cumulative / NETTO headline.
# `pending` (not yet measured) and `available` (measured but behind a
# default-off kill-switch, e.g. the thin projection) are shown with their
# token_delta but excluded from the default cumulative — the headline must
# reflect what actually ships by default.
_COUNTING_CONFIDENCES = ("measured", "estimated", "vendor-claim")

# ── Pricing ─────────────────────────────────────────────────────────────


def price_tokens_eur(
    input_tokens: int,
    output_tokens: int,
    pricing_row: Dict[str, Any],
    eur_per_usd: float = 0.92,
) -> float:
    """Convert (input, output) token counts to € using a pricing.yaml row.

    `pricing_row` is one entry from `internal/bench/pricing.yaml::models`
    (the row with the matching tier). USD/1M token rates are converted to
    € via `eur_per_usd` (default 0.92 — adjust at the call site if
    `pricing.yaml` ever carries a EUR rate directly).
    """
    input_usd = (input_tokens / 1_000_000.0) * float(pricing_row.get("input", 0.0))
    output_usd = (output_tokens / 1_000_000.0) * float(pricing_row.get("output", 0.0))
    return (input_usd + output_usd) * eur_per_usd


def price_input_delta_eur(
    token_delta_per_request: int,
    reference_scale: Dict[str, Any],
    pricing_row: Dict[str, Any],
) -> float:
    """Price a per-request *input* token delta at the reference scale."""
    requests = int(reference_scale.get("requests", 1000))
    total_input_tokens = token_delta_per_request * requests
    return price_tokens_eur(total_input_tokens, 0, pricing_row)


def price_output_delta_eur(
    token_delta_per_request: int,
    reference_scale: Dict[str, Any],
    pricing_row: Dict[str, Any],
) -> float:
    """Price a per-request *output* token delta at the reference scale."""
    requests = int(reference_scale.get("requests", 1000))
    total_output_tokens = token_delta_per_request * requests
    return price_tokens_eur(0, total_output_tokens, pricing_row)


# ── Pending-rung factory ────────────────────────────────────────────────


def pending_rung(
    rung_id: str,
    label: str,
    what_it_does: str,
    source_report: str,
    footnote: Optional[str] = None,
) -> Dict[str, Any]:
    """Emit a `pending` rung — measurement not yet available."""
    rung = {
        "id": rung_id,
        "label": label,
        "what_it_does": what_it_does,
        "token_delta": 0,
        "eur_delta": 0.0,
        "cumulative_pct": 0.0,  # filled in by assemble_ladder
        "confidence": "pending",
        "source_report": source_report,
    }
    if footnote:
        rung["footnote"] = footnote
    return rung


# ── Rung extractors ─────────────────────────────────────────────────────


def baseline_rung(reference_scale: Dict[str, Any]) -> Dict[str, Any]:
    """The zero-point rung. token_delta = 0 by construction."""
    return {
        "id": "baseline",
        "label": "Ohne Paket / Without package",
        "what_it_does": "Baseline — der nackte Request ohne Paket-Regeln.",
        "token_delta": 0,
        "eur_delta": 0.0,
        "cumulative_pct": 0.0,
        "confidence": "measured",
        "source_report": "n/a",
    }


def load_rung_from_router(
    router: Optional[Dict[str, Any]],
    rule_chars: Optional[Dict[str, int]],
    charter_chars: int,
    reference_scale: Dict[str, Any],
    pricing_row: Dict[str, Any],
) -> Dict[str, Any]:
    """Build the Paket-load rung from the canonical kernel list.

    Phase 1 of road-to-value-dashboard-netto-cuts: the previous
    `load_rung_from_frugality` reads a hardcoded 6-rule canon
    (`scripts/measure_frugality_savings.py::CANON_RULES`), NOT the
    actual always-loaded kernel. The real kernel lives in
    `dist/router.json::kernel` and has 10 rules. This function reads
    that list and sums per-file char counts to compute the real
    always-loaded footprint.

    `router` is the decoded `dist/router.json` dict.
    `rule_chars` is a `{rule_id: char_count}` mapping (typically built
    by walking `.agent-src/rules/<id>.md`).
    `charter_chars` is the always-loaded charter footprint.

    Returns a `pending` rung when the router is missing or has no
    kernel entry; the rung's `source_report` cites the missing input.
    """
    if not router or "kernel" not in router:
        return pending_rung(
            "load",
            "Mit Paket (Regeln laden) / With package (rule load)",
            "Die immer-aktiven Regeln landen im Kontext jedes Requests.",
            "dist/router.json",
            footnote="Run scripts/compile_router.py to generate the router.",
        )
    rule_chars = rule_chars or {}
    kernel_ids = list(router.get("kernel", []))
    kernel_total = sum(int(rule_chars.get(rid, 0)) for rid in kernel_ids)
    total_chars = kernel_total + int(charter_chars)
    # 4 chars/token approximation, consistent with measure_frugality_savings.py.
    token_delta = total_chars // 4
    return {
        "id": "load",
        "label": "Mit Paket (Regeln laden) / With package (rule load)",
        "what_it_does": "Die immer-aktiven Regeln landen im Kontext jedes Requests.",
        "token_delta": token_delta,
        "eur_delta": price_input_delta_eur(token_delta, reference_scale, pricing_row),
        "cumulative_pct": 0.0,
        "confidence": "measured",
        "source_report": "dist/router.json",
        "footnote": (
            f"Kernel = {len(kernel_ids)} rules ({kernel_total} chars) "
            f"+ charter ({int(charter_chars)} chars); tokens ≈ chars / 4."
        ),
    }


def load_rung_from_frugality(
    frugality_record: Optional[Dict[str, Any]],
    reference_scale: Dict[str, Any],
    pricing_row: Dict[str, Any],
) -> Dict[str, Any]:
    """Build the Paket-load rung from a frugality baseline.jsonl record.

    **Deprecated** as of road-to-value-dashboard-netto-cuts Phase 1:
    measures a hardcoded 6-rule canon, not the actual always-loaded
    kernel. Kept as a back-compat fallback when `dist/router.json` is
    missing. New callers should prefer `load_rung_from_router()`.

    `frugality_record` is one decoded line from
    `agents/runtime/frugality/baseline.jsonl` (the latest record is the
    typical input). The rung token_delta is the always-loaded
    (kernel + tier_1 + tier_2 + charter) footprint divided by 4 to
    approximate tokens.

    Returns a `pending` rung when the record is missing or malformed.
    """
    if not frugality_record:
        return pending_rung(
            "load",
            "Mit Paket (Regeln laden) / With package (rule load)",
            "Die immer-aktiven Regeln landen im Kontext jedes Requests.",
            "agents/runtime/frugality/baseline.jsonl",
            footnote="Run scripts/measure_frugality_savings.py to populate.",
        )
    footprint = frugality_record.get("metric_a_footprint", {})
    kernel = int(footprint.get("kernel_total_chars", 0))
    tier_1 = int(footprint.get("tier_1_total_chars", 0))
    tier_2 = int(footprint.get("tier_2_total_chars", 0))
    charter = int(footprint.get("charter_chars", 0))
    total_chars = kernel + tier_1 + tier_2 + charter
    # 4 chars/token approximation, consistent with measure_frugality_savings.py.
    token_delta = total_chars // 4
    return {
        "id": "load",
        "label": "Mit Paket (Regeln laden) / With package (rule load)",
        "what_it_does": "Die immer-aktiven Regeln landen im Kontext jedes Requests.",
        "token_delta": token_delta,
        "eur_delta": price_input_delta_eur(token_delta, reference_scale, pricing_row),
        "cumulative_pct": 0.0,
        "confidence": "measured",
        "source_report": "agents/runtime/frugality/baseline.jsonl",
        "footnote": (
            "Always-loaded footprint = kernel + tier_1 + tier_2 + charter; "
            "tokens ≈ chars / 4."
        ),
    }


def load_rung_from_projection(
    projection: Optional[Dict[str, Any]],
    reference_scale: Dict[str, Any],
    pricing_row: Dict[str, Any],
    tool: str = ".claude",
) -> Optional[Dict[str, Any]]:
    """Build the load rung from the REAL eager always-on footprint.

    Phase 3.1 honesty fix: the older `load_rung_from_router` counts only the
    kernel + charter (~8.5k tok), modelling non-kernel rules as on-demand.
    But 0B.6 confirmed the primary tool **eager-loads every rule body**
    (~59k tok always-on). This rung reads that measured footprint from
    `internal/bench/reports/projection-cost.json::rule_footprint[<tool>]`
    so Panel A reflects what actually lands in context per request.

    Returns None when the projection report lacks the footprint, so the
    caller can fall back to the router/frugality rung.
    """
    rf = (projection or {}).get("rule_footprint", {})
    entry = rf.get(tool) or next(iter(rf.values()), None)
    if not entry or "tokens_gpt" not in entry:
        return None
    token_delta = int(entry["tokens_gpt"])
    files = int(entry.get("files", 0))
    return {
        "id": "load",
        "label": "Mit Paket (Regeln laden) / With package (rule load)",
        "what_it_does": "Die immer-aktiven Regeln landen im Kontext jedes Requests.",
        "token_delta": token_delta,
        "eur_delta": price_input_delta_eur(token_delta, reference_scale, pricing_row),
        "cumulative_pct": 0.0,
        "confidence": "measured",
        "source_report": "internal/bench/reports/projection-cost.json",
        "footnote": (
            f"Eager-Default: alle {files} Rule-Files always-on im "
            f"`{tool}`-Projektionspfad (0B.6-bestätigt fürs primäre Tool). "
            "Nicht nur der Kernel — das ist die ehrliche Up-Front-Last; "
            "tokens ≈ chars / 4."
        ),
    }


def thin_rung_from_projection(
    projection: Optional[Dict[str, Any]],
    reference_scale: Dict[str, Any],
    pricing_row: Dict[str, Any],
) -> Dict[str, Any]:
    """Build the thin-projection rung (Phase 3.1 lever).

    The thin projection keeps the kernel full-bodied and demotes every
    non-kernel rule body to a router-resolved pointer, measured at
    −`saved_gpt` tokens. It ships **behind a kill-switch**
    (`lean_projection.mode`, default `eager-all`), so this rung is
    `confidence: available` — its measured delta is shown but does NOT
    enter the default cumulative (the default reality is eager). The
    footnote states the would-be always-on total and the validation state.
    """
    tp = (projection or {}).get("thin_projection", {})
    if not tp or "saved_gpt" not in tp:
        return pending_rung(
            "thin",
            "+ thin (Regeln als Pointer) / + thin (rules as pointers)",
            "Nicht-Kernel-Regel-Bodies werden zu router-aufgelösten Pointern.",
            "internal/bench/reports/projection-cost.json",
            footnote="Run scripts/project_thin_rules.py --measure to populate.",
        )
    saved = int(tp["saved_gpt"])
    thin_total = int(tp.get("thin_gpt", 0))
    eager_total = int(tp.get("eager_gpt", 0))
    pct = tp.get("saved_pct", 0)
    return {
        "id": "thin",
        "label": "+ thin (Regeln als Pointer) / + thin (rules as pointers)",
        "what_it_does": "Nicht-Kernel-Regel-Bodies werden zu router-aufgelösten Pointern.",
        "token_delta": -saved,
        "eur_delta": price_input_delta_eur(-saved, reference_scale, pricing_row),
        "cumulative_pct": 0.0,
        "confidence": "available",
        "source_report": "internal/bench/reports/projection-cost.json",
        "footnote": (
            f"Verfügbar hinter `lean_projection.mode=thin` (Default `eager-all` "
            f"— deshalb NICHT im Default-NETTO). Mit Thin aktiv: Rule-Layer "
            f"{eager_total} → {thin_total} GPT tok (−{saved}, −{pct}%). "
            "MUST-LOAD-Floor `task trigger-coverage` 26/26 grün; "
            "Live-A/B-Validierung ausstehend (Harness abgelehnt). "
            "Rollback = ein Flip."
        ),
    }


def condense_rung_from_telegraph_v2(
    telegraph_v2: Optional[Dict[str, Any]],
    baseline_input_tokens: int,
    reference_scale: Dict[str, Any],
    pricing_row: Dict[str, Any],
) -> Dict[str, Any]:
    """Build the condense rung from telegraph-v2 aggregate.

    Excludes Thin-Root files (per the spec); aggregates the
    prose-heavy-contract + rule-classification categories. The rung is
    a *saving* (negative token_delta) when the median is positive.
    """
    if not telegraph_v2 or "aggregate" not in telegraph_v2:
        return pending_rung(
            "condense",
            "+ condense (Regeln eindampfen) / + condense (rule shrink)",
            "Build-Schritt schrumpft Regel-Dateien vor dem Ausliefern.",
            "internal/bench/reports/telegraph-v2.json",
            footnote="Run scripts/bench_telegraph.py to populate.",
        )
    aggregate = telegraph_v2["aggregate"]
    by_cat = aggregate.get("by_category_median_pct", {})
    # Non-Thin-Root categories only.
    non_thin_root = {
        k: v for k, v in by_cat.items() if not k.startswith("thin-root-")
    }
    if not non_thin_root:
        median_saving_pct = float(aggregate.get("median_saving_pct", 0.0))
    else:
        # Simple mean across non-Thin-Root category medians — matches the
        # "aggregate to a single rung" wording in the roadmap.
        median_saving_pct = sum(non_thin_root.values()) / len(non_thin_root)
    # Saving % is the % of baseline_input_tokens that condense claws back.
    # Positive saving % → negative token_delta (we save tokens).
    token_delta = -int(round(baseline_input_tokens * median_saving_pct / 100.0))
    return {
        "id": "condense",
        "label": "+ condense (Regeln eindampfen) / + condense (rule shrink)",
        "what_it_does": "Build-Schritt schrumpft Regel-Dateien vor dem Ausliefern.",
        "token_delta": token_delta,
        "eur_delta": price_input_delta_eur(token_delta, reference_scale, pricing_row),
        "cumulative_pct": 0.0,
        "confidence": "measured",
        "source_report": "internal/bench/reports/telegraph-v2.json",
        "footnote": (
            "Aggregate across non-Thin-Root categories; Thin-Root files "
            "(AGENTS.md variants) net negative (~−4%) and are excluded "
            "from the rung — surfaced separately."
        ),
    }


def rtk_rung_from_report(
    rtk_report: Optional[Dict[str, Any]],
    reference_scale: Dict[str, Any],
    pricing_row: Dict[str, Any],
) -> Dict[str, Any]:
    """Build the rtk rung from `internal/bench/reports/rtk/latest.json`.

    The rtk report carries the per-command corpus result + an aggregate
    `tokens_saved_per_request` (output-side savings on tool calls). If
    missing → `pending`.
    """
    if not rtk_report:
        return pending_rung(
            "rtk",
            "+ rtk (CLI-Output filtern) / + rtk (filter CLI output)",
            "rtk schneidet verbose CLI-Ausgabe vor dem Modell-Input weg.",
            "internal/bench/reports/rtk/latest.json",
            footnote="Install rtk and run scripts/bench_rtk_savings.py.",
        )
    aggregate = rtk_report.get("aggregate", {})
    tokens_saved = int(aggregate.get("tokens_saved_per_request", 0))
    if tokens_saved <= 0:
        return pending_rung(
            "rtk",
            "+ rtk (CLI-Output filtern) / + rtk (filter CLI output)",
            "rtk schneidet verbose CLI-Ausgabe vor dem Modell-Input weg.",
            "internal/bench/reports/rtk/latest.json",
            footnote=(
                "Report present but aggregate.tokens_saved_per_request "
                "is 0 — re-run scripts/bench_rtk_savings.py with the full "
                "corpus."
            ),
        )
    # Savings → negative token_delta.
    token_delta = -tokens_saved
    return {
        "id": "rtk",
        "label": "+ rtk (CLI-Output filtern) / + rtk (filter CLI output)",
        "what_it_does": "rtk schneidet verbose CLI-Ausgabe vor dem Modell-Input weg.",
        "token_delta": token_delta,
        "eur_delta": price_input_delta_eur(token_delta, reference_scale, pricing_row),
        "cumulative_pct": 0.0,
        "confidence": "measured",
        "source_report": "internal/bench/reports/rtk/latest.json",
    }


def terse_rung_from_telegraph_v1(
    telegraph_v1: Optional[Dict[str, Any]],
    reference_scale: Dict[str, Any],
    pricing_row: Dict[str, Any],
) -> Dict[str, Any]:
    """Build the terse rung from telegraph-v1 vs_terse aggregate.

    The measured median is negative (~ −9.27% in the canonical report).
    We render this honestly per the spec: a rung with the real value
    + a footnote, never a "saving" label on a negative.
    """
    if not telegraph_v1 or "telegraph" not in telegraph_v1:
        return pending_rung(
            "terse",
            "+ terse (Antworten knapper) / + terse (shorter replies)",
            "Telegraph-Stil zielt auf knappere Modell-Antworten.",
            "internal/bench/reports/telegraph-v1.json",
            footnote="Run scripts/bench_telegraph.py to populate.",
        )
    arms = telegraph_v1["telegraph"].get("aggregate", {})
    vs_terse = arms.get("savings_vs_terse", {})
    median = float(vs_terse.get("median", 0.0))
    # Output-side: positive median → fewer output tokens than terse control.
    # The measured median in the canonical report is negative (~ -0.0927).
    avg_output = int(reference_scale.get("avg_output_tokens", 600))
    token_delta = -int(round(avg_output * median))
    note = (
        "Honest: gemessener Median = "
        f"{median * 100:+.2f}% gegen 'sei knapp' — Telegraph liefert hier "
        "mehr Tokens, nicht weniger. Wir messen, wir verstecken nicht."
    )
    return {
        "id": "terse",
        "label": "+ terse (Antworten knapper) / + terse (shorter replies)",
        "what_it_does": "Telegraph-Stil zielt auf knappere Modell-Antworten.",
        "token_delta": token_delta,
        "eur_delta": price_output_delta_eur(token_delta, reference_scale, pricing_row),
        "cumulative_pct": 0.0,
        "confidence": "measured",
        "source_report": "internal/bench/reports/telegraph-v1.json",
        "footnote": note,
    }


# ── Behaviour-metric extractors ─────────────────────────────────────────


def selection_metric_from_dev_reports(
    with_report: Optional[Dict[str, Any]],
    without_report: Optional[Dict[str, Any]],
) -> Dict[str, Any]:
    """Right-skill selection: top-K hit rate with vs. without."""
    if not with_report and not without_report:
        return {
            "id": "selection",
            "label": "Right-skill selection / Richtige Skill-Wahl",
            "what_this_means": (
                "Wie oft das passende Skill aktiviert wird (top-K Treffer)."
            ),
            "with": None,
            "without": None,
            "delta": None,
            "unit": "pct",
            "mode": "dry-run",
            "source_report": "internal/bench/reports/ab/<dev-corpus-pair>.json",
        }
    w = (with_report or {}).get("selection", {}).get("selection_accuracy")
    wo = (without_report or {}).get("selection", {}).get("selection_accuracy")
    delta = None
    if w is not None and wo is not None:
        delta = round(w - wo, 4)
    mode = ((with_report or {}).get("results") or {}).get("mode") or "live"
    return {
        "id": "selection",
        "label": "Right-skill selection / Richtige Skill-Wahl",
        "what_this_means": (
            "Wie oft das passende Skill aktiviert wird (top-K Treffer)."
        ),
        "with": w,
        "without": wo,
        "delta": delta,
        "unit": "pct",
        "mode": mode,
        "source_report": "internal/bench/reports/ab/",
    }


def destructive_stops_metric(
    with_stops: Optional[int],
    without_stops: Optional[int],
    total: int = 5,
) -> Dict[str, Any]:
    """Destructive-op stops: N/5 vs M/5 — counts, not pct."""
    if with_stops is None and without_stops is None:
        return {
            "id": "destructive-stops",
            "label": "Destructive-op stops / Stopps bei riskanten Aktionen",
            "what_this_means": (
                "Wie oft der Agent vor destructive ops anhält / nachfragt "
                f"(von {total})."
            ),
            "with": None,
            "without": None,
            "delta": None,
            "unit": "count",
            "mode": "dry-run",
            "source_report": (
                "internal/bench/reports/ab/<destructive-corpus-pair>.json"
            ),
        }
    delta = None
    if with_stops is not None and without_stops is not None:
        delta = with_stops - without_stops
    return {
        "id": "destructive-stops",
        "label": "Destructive-op stops / Stopps bei riskanten Aktionen",
        "what_this_means": (
            "Wie oft der Agent vor destructive ops anhält / nachfragt "
            f"(von {total})."
        ),
        "with": with_stops,
        "without": without_stops,
        "delta": delta,
        "unit": "count",
        "mode": "live",
        "source_report": "internal/bench/reports/ab/",
    }


def ask_vs_act_metric(
    with_ratio: Optional[float],
    without_ratio: Optional[float],
    mode: str = "live",
) -> Dict[str, Any]:
    """Ask-vs-act ratio: lower = more decisive under autonomy mandate."""
    if with_ratio is None and without_ratio is None:
        return {
            "id": "ask-vs-act",
            "label": "Ask-vs-act ratio / Fragen vs. Handeln",
            "what_this_means": (
                "Verhältnis Rückfragen zu Aktionen — niedriger = entschlossener."
            ),
            "with": None,
            "without": None,
            "delta": None,
            "unit": "ratio",
            "mode": "dry-run",
            "source_report": "internal/bench/reports/ab/",
        }
    delta = None
    if with_ratio is not None and without_ratio is not None:
        delta = round(with_ratio - without_ratio, 4)
    return {
        "id": "ask-vs-act",
        "label": "Ask-vs-act ratio / Fragen vs. Handeln",
        "what_this_means": (
            "Verhältnis Rückfragen zu Aktionen — niedriger = entschlossener."
        ),
        "with": with_ratio,
        "without": without_ratio,
        "delta": delta,
        "unit": "ratio",
        "mode": mode,
        "source_report": "internal/bench/reports/ab/",
    }


def completion_metric(
    with_rate: Optional[float],
    without_rate: Optional[float],
    mode: str = "live",
) -> Dict[str, Any]:
    """Task completion rate from A/B Track B."""
    if with_rate is None and without_rate is None:
        return {
            "id": "completion",
            "label": "Task completion rate / Aufgaben fertig",
            "what_this_means": (
                "Anteil der Aufgaben, die der Agent vollständig abschließt."
            ),
            "with": None,
            "without": None,
            "delta": None,
            "unit": "pct",
            "mode": "dry-run",
            "source_report": "internal/bench/reports/ab/<trackb-pair>.json",
        }
    delta = None
    if with_rate is not None and without_rate is not None:
        delta = round(with_rate - without_rate, 4)
    return {
        "id": "completion",
        "label": "Task completion rate / Aufgaben fertig",
        "what_this_means": (
            "Anteil der Aufgaben, die der Agent vollständig abschließt."
        ),
        "with": with_rate,
        "without": without_rate,
        "delta": delta,
        "unit": "pct",
        "mode": mode,
        "source_report": "internal/bench/reports/ab/",
    }


# ── Assembler ───────────────────────────────────────────────────────────


def assemble_ladder(
    rungs: List[Dict[str, Any]],
    baseline_input_tokens: int,
) -> List[Dict[str, Any]]:
    """Fill in `cumulative_pct` for every rung in order.

    Mutates copies (does not modify input dicts). Returns the new list.
    A `pending` rung contributes 0 to the cumulative (its token_delta
    must NOT influence the headline until it flips to `measured`).
    """
    out = []
    running = 0
    for rung in rungs:
        rung_copy = dict(rung)
        delta = (
            int(rung_copy.get("token_delta", 0))
            if rung_copy.get("confidence") in _COUNTING_CONFIDENCES
            else 0
        )
        running += delta
        if baseline_input_tokens > 0:
            rung_copy["cumulative_pct"] = round(
                100.0 * running / baseline_input_tokens, 3
            )
        else:
            rung_copy["cumulative_pct"] = 0.0
        out.append(rung_copy)
    return out


def compute_totals(
    rungs: List[Dict[str, Any]],
    baseline_input_tokens: int,
    reference_scale: Dict[str, Any],
    pricing_row: Dict[str, Any],
) -> Dict[str, Any]:
    """Compute the totals block from the assembled ladder."""
    cumulative_token_delta = sum(
        int(r.get("token_delta", 0))
        for r in rungs
        if r.get("confidence") in _COUNTING_CONFIDENCES
    )
    cumulative_pct = 0.0
    if baseline_input_tokens > 0:
        cumulative_pct = round(
            100.0 * cumulative_token_delta / baseline_input_tokens, 3
        )
    cumulative_eur = price_input_delta_eur(
        cumulative_token_delta, reference_scale, pricing_row
    )
    if cumulative_token_delta < 0:
        verdict = "net-saving"
    elif cumulative_token_delta > 0:
        verdict = "net-cost"
    else:
        verdict = "break-even"
    return {
        "cumulative_token_delta": cumulative_token_delta,
        "cumulative_eur_delta": round(cumulative_eur, 4),
        "cumulative_pct": cumulative_pct,
        "net_verdict": verdict,
    }
