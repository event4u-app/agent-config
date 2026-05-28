"""Unit tests for `scripts/_lib/value_ladder.py` and `scripts/_lib/value_report.py`.

Phase 1 Step 4 of `agents/roadmaps/road-to-readable-value-dashboard.md`.
Covers:
  - rung extractors with fixture raw-report dicts in → expected rung out
  - the negative-saving case (terse rung renders honestly, never as a saving)
  - the missing-input case (every extractor degrades to `pending`)
  - the cumulative assembler (running pct, pending contributes 0)
  - the totals + verdict computation
"""
from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

import pytest


REPO_ROOT = Path(__file__).resolve().parent.parent
LADDER_PATH = REPO_ROOT / "scripts" / "_lib" / "value_ladder.py"
REPORT_PATH = REPO_ROOT / "scripts" / "_lib" / "value_report.py"


def _load_module(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    assert spec is not None and spec.loader is not None
    mod = importlib.util.module_from_spec(spec)
    sys.modules[name] = mod
    spec.loader.exec_module(mod)
    return mod


@pytest.fixture(scope="module")
def ladder_mod():
    return _load_module("value_ladder", LADDER_PATH)


@pytest.fixture(scope="module")
def report_mod():
    # value_report depends on value_ladder; load that first under its
    # canonical name so the absolute import inside value_report resolves.
    _load_module("value_ladder", LADDER_PATH)
    return _load_module("value_report", REPORT_PATH)


@pytest.fixture
def pricing_row_sonnet():
    return {
        "tier": "sonnet",
        "sourced_on": "2026-05-14",
        "input": 3.0,
        "output": 15.0,
    }


@pytest.fixture
def reference_scale():
    return {
        "requests": 1000,
        "avg_input_tokens": 8000,
        "avg_output_tokens": 600,
        "model_tier": "sonnet",
        "pricing_sourced_on": "2026-05-14",
    }


# ── Pricing ─────────────────────────────────────────────────────────────


def test_price_input_delta_eur_positive(ladder_mod, reference_scale, pricing_row_sonnet):
    # 100 input tokens × 1000 requests = 100k tokens.
    # 100_000 / 1_000_000 × 3.0 USD = 0.30 USD = 0.276 EUR (× 0.92).
    eur = ladder_mod.price_input_delta_eur(100, reference_scale, pricing_row_sonnet)
    assert eur == pytest.approx(0.276, rel=1e-3)


def test_price_input_delta_eur_negative(ladder_mod, reference_scale, pricing_row_sonnet):
    eur = ladder_mod.price_input_delta_eur(-200, reference_scale, pricing_row_sonnet)
    assert eur == pytest.approx(-0.552, rel=1e-3)


def test_price_output_delta_eur(ladder_mod, reference_scale, pricing_row_sonnet):
    # 50 output tokens × 1000 requests = 50k tokens.
    # 50_000 / 1_000_000 × 15.0 USD = 0.75 USD = 0.69 EUR.
    eur = ladder_mod.price_output_delta_eur(50, reference_scale, pricing_row_sonnet)
    assert eur == pytest.approx(0.69, rel=1e-3)


# ── Pending rungs (missing input) ───────────────────────────────────────


def test_load_rung_pending_on_missing(ladder_mod, reference_scale, pricing_row_sonnet):
    rung = ladder_mod.load_rung_from_frugality(None, reference_scale, pricing_row_sonnet)
    assert rung["id"] == "load"
    assert rung["confidence"] == "pending"
    assert rung["token_delta"] == 0
    assert "agents/runtime/frugality" in rung["source_report"]


def test_condense_rung_pending_on_missing(
    ladder_mod, reference_scale, pricing_row_sonnet
):
    rung = ladder_mod.condense_rung_from_telegraph_v2(
        None, 8000, reference_scale, pricing_row_sonnet
    )
    assert rung["confidence"] == "pending"
    assert rung["token_delta"] == 0


def test_rtk_rung_pending_on_missing(ladder_mod, reference_scale, pricing_row_sonnet):
    rung = ladder_mod.rtk_rung_from_report(None, reference_scale, pricing_row_sonnet)
    assert rung["confidence"] == "pending"
    assert "Install rtk" in rung["footnote"]


def test_terse_rung_pending_on_missing(ladder_mod, reference_scale, pricing_row_sonnet):
    rung = ladder_mod.terse_rung_from_telegraph_v1(
        None, reference_scale, pricing_row_sonnet
    )
    assert rung["confidence"] == "pending"


# ── Load rung from frugality ────────────────────────────────────────────


def test_load_rung_from_frugality_extracts_kernel_total(
    ladder_mod, reference_scale, pricing_row_sonnet
):
    record = {
        "metric_a_footprint": {
            "kernel_total_chars": 10000,
            "tier_1_total_chars": 5000,
            "tier_2_total_chars": 2000,
            "charter_chars": 3000,
        }
    }
    rung = ladder_mod.load_rung_from_frugality(
        record, reference_scale, pricing_row_sonnet
    )
    # total = 20000 chars / 4 = 5000 tokens
    assert rung["token_delta"] == 5000
    assert rung["confidence"] == "measured"
    assert rung["eur_delta"] > 0  # cost rung, positive €


# ── Condense rung from telegraph-v2 ─────────────────────────────────────


def test_condense_rung_excludes_thin_root(
    ladder_mod, reference_scale, pricing_row_sonnet
):
    """Thin-Root categories should not pull the average negative."""
    report = {
        "aggregate": {
            "median_saving_pct": 1.0,  # would be the wrong source
            "by_category_median_pct": {
                "thin-root-package": -4.0,
                "thin-root-consumer-template": -4.8,
                "prose-heavy-contract": 4.5,
                "rule-classification": 0.1,
            },
        }
    }
    rung = ladder_mod.condense_rung_from_telegraph_v2(
        report, 8000, reference_scale, pricing_row_sonnet
    )
    # average of non-thin-root = (4.5 + 0.1) / 2 = 2.3 %
    # token_delta = -round(8000 * 0.023) = -184  (saving → negative)
    assert rung["token_delta"] == -184
    assert rung["confidence"] == "measured"
    assert "Thin-Root" in rung["footnote"]


# ── rtk rung ────────────────────────────────────────────────────────────


def test_rtk_rung_from_report_measured(
    ladder_mod, reference_scale, pricing_row_sonnet
):
    report = {
        "schema": "rtk-v1",
        "aggregate": {"tokens_saved_per_request": 250},
    }
    rung = ladder_mod.rtk_rung_from_report(report, reference_scale, pricing_row_sonnet)
    assert rung["token_delta"] == -250
    assert rung["confidence"] == "measured"


def test_rtk_rung_zero_aggregate_pending(
    ladder_mod, reference_scale, pricing_row_sonnet
):
    """Report present but aggregate empty → pending with explanatory footnote."""
    report = {"aggregate": {"tokens_saved_per_request": 0}}
    rung = ladder_mod.rtk_rung_from_report(report, reference_scale, pricing_row_sonnet)
    assert rung["confidence"] == "pending"
    assert "re-run" in rung["footnote"].lower() or "rerun" in rung["footnote"].lower()


# ── Terse rung — the negative-saving honesty case ───────────────────────


def test_terse_rung_renders_negative_value_honestly(
    ladder_mod, reference_scale, pricing_row_sonnet
):
    """The canonical telegraph-v1 case: median = -9.27% vs terse control.

    Iron Law from the spec: negative number is NEVER a saving. The rung
    renders with a positive token_delta + a footnote that names the gap.
    """
    report = {
        "telegraph": {
            "aggregate": {
                "savings_vs_terse": {
                    "median": -0.0927,
                },
            }
        }
    }
    rung = ladder_mod.terse_rung_from_telegraph_v1(
        report, reference_scale, pricing_row_sonnet
    )
    assert rung["confidence"] == "measured"
    # avg_output = 600 → -round(600 * -0.0927) = -(-56) = 56 → COST.
    assert rung["token_delta"] == 56
    assert "Honest" in rung["footnote"]
    # eur_delta priced as output → positive € (a cost, not a saving)
    assert rung["eur_delta"] > 0


# ── Behaviour metrics ───────────────────────────────────────────────────


def test_destructive_stops_metric_with_both_arms(ladder_mod):
    metric = ladder_mod.destructive_stops_metric(5, 1)
    assert metric["with"] == 5
    assert metric["without"] == 1
    assert metric["delta"] == 4
    assert metric["unit"] == "count"
    assert metric["mode"] == "live"


def test_destructive_stops_metric_pending_when_no_data(ladder_mod):
    metric = ladder_mod.destructive_stops_metric(None, None)
    assert metric["with"] is None
    assert metric["without"] is None
    assert metric["mode"] == "dry-run"


def test_completion_metric_delta(ladder_mod):
    metric = ladder_mod.completion_metric(0.85, 0.60, mode="live")
    assert metric["delta"] == pytest.approx(0.25)
    assert metric["mode"] == "live"


def test_ask_vs_act_metric_lower_is_better(ladder_mod):
    metric = ladder_mod.ask_vs_act_metric(0.12, 0.40)
    # "with" asks less = lower ratio under autonomy mandate
    assert metric["with"] < metric["without"]
    assert metric["delta"] == pytest.approx(-0.28)


# ── Cumulative assembler ────────────────────────────────────────────────


def test_assemble_ladder_running_pct(ladder_mod):
    rungs = [
        {"id": "baseline", "token_delta": 0, "confidence": "measured"},
        {"id": "load", "token_delta": 2000, "confidence": "measured"},
        {"id": "condense", "token_delta": -800, "confidence": "measured"},
        {"id": "rtk", "token_delta": -500, "confidence": "measured"},
    ]
    out = ladder_mod.assemble_ladder(rungs, baseline_input_tokens=8000)
    assert out[0]["cumulative_pct"] == 0.0
    assert out[1]["cumulative_pct"] == 25.0  # 2000 / 8000 = 25 %
    assert out[2]["cumulative_pct"] == 15.0  # (2000 - 800) / 8000 = 15 %
    assert out[3]["cumulative_pct"] == pytest.approx(8.75, rel=1e-3)


def test_assemble_ladder_pending_contributes_zero(ladder_mod):
    rungs = [
        {"id": "baseline", "token_delta": 0, "confidence": "measured"},
        {"id": "load", "token_delta": 2000, "confidence": "measured"},
        # Pending rung carries a nonzero token_delta in its own field but
        # MUST NOT influence the cumulative until measured.
        {"id": "rtk", "token_delta": -9999, "confidence": "pending"},
        {"id": "terse", "token_delta": 56, "confidence": "measured"},
    ]
    out = ladder_mod.assemble_ladder(rungs, baseline_input_tokens=8000)
    # Cumulative after load = 25 %, then pending = 25 % (no change),
    # then terse = (2000 + 56) / 8000 = 25.7 %
    assert out[2]["cumulative_pct"] == 25.0
    assert out[3]["cumulative_pct"] == pytest.approx(25.7, rel=1e-3)


# ── Totals & verdict ────────────────────────────────────────────────────


def test_compute_totals_net_saving(ladder_mod, reference_scale, pricing_row_sonnet):
    rungs = [
        {"id": "load", "token_delta": 2000, "confidence": "measured"},
        {"id": "condense", "token_delta": -800, "confidence": "measured"},
        {"id": "rtk", "token_delta": -1500, "confidence": "measured"},
    ]
    totals = ladder_mod.compute_totals(
        rungs, 8000, reference_scale, pricing_row_sonnet
    )
    assert totals["cumulative_token_delta"] == -300
    assert totals["net_verdict"] == "net-saving"
    assert totals["cumulative_pct"] == pytest.approx(-3.75, rel=1e-3)


def test_compute_totals_net_cost(ladder_mod, reference_scale, pricing_row_sonnet):
    rungs = [
        {"id": "load", "token_delta": 2000, "confidence": "measured"},
        {"id": "condense", "token_delta": -100, "confidence": "measured"},
    ]
    totals = ladder_mod.compute_totals(
        rungs, 8000, reference_scale, pricing_row_sonnet
    )
    assert totals["cumulative_token_delta"] == 1900
    assert totals["net_verdict"] == "net-cost"
    assert totals["cumulative_pct"] > 0


def test_compute_totals_excludes_pending(
    ladder_mod, reference_scale, pricing_row_sonnet
):
    rungs = [
        {"id": "load", "token_delta": 2000, "confidence": "measured"},
        {"id": "rtk", "token_delta": -9999, "confidence": "pending"},
    ]
    totals = ladder_mod.compute_totals(
        rungs, 8000, reference_scale, pricing_row_sonnet
    )
    # Pending contributes 0 → cumulative = 2000 only
    assert totals["cumulative_token_delta"] == 2000
    assert totals["net_verdict"] == "net-cost"


# ── value_report.py assembler ───────────────────────────────────────────


def test_assemble_value_v1_returns_valid_shape(report_mod):
    """Even with no reports on disk, the assembler must emit a valid v1."""
    report = report_mod.assemble_value_v1()
    assert report["schema_version"] == 1
    assert report["schema_id"] == "value-v1"
    assert "generated_at" in report
    assert "reference_scale" in report
    assert "baseline" in report
    assert isinstance(report["cost_ladder"], list)
    assert isinstance(report["behaviour"], list)
    assert "totals" in report
    # Must always carry the five canonical rungs.
    rung_ids = [r["id"] for r in report["cost_ladder"]]
    assert rung_ids == ["baseline", "load", "condense", "rtk", "terse"]
    # And the four canonical behaviour metrics.
    behaviour_ids = [m["id"] for m in report["behaviour"]]
    assert behaviour_ids == [
        "selection",
        "destructive-stops",
        "ask-vs-act",
        "completion",
    ]


def test_assemble_value_v1_with_custom_reference(report_mod):
    """Caller can override the reference scale (e.g. 10k requests)."""
    report = report_mod.assemble_value_v1(reference_scale={"requests": 10000})
    assert report["reference_scale"]["requests"] == 10000
    # Defaults preserved for the other keys.
    assert report["reference_scale"]["avg_input_tokens"] == 8000


def test_md_dump_renders_all_sections(report_mod):
    report = report_mod.assemble_value_v1()
    md = report_mod.render_md_dump(report)
    for section in (
        "# Value Report",
        "## Reference scale",
        "## Baseline",
        "## Cost ladder",
        "## Behaviour",
        "## Totals",
        "## Notes",
    ):
        assert section in md, f"missing section: {section}"


def test_write_value_report_creates_files(report_mod, tmp_path):
    report = report_mod.assemble_value_v1()
    out = report_mod.write_value_report(report, out_dir=tmp_path)
    assert out.exists()
    assert (tmp_path / "latest.json").exists()
    # latest.json must be a copy of the timestamped file
    import json as _json
    assert _json.loads(out.read_text()) == _json.loads(
        (tmp_path / "latest.json").read_text()
    )
