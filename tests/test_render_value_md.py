"""Golden-output tests for `scripts/render_value_md.py`.

Phase 4 Step 6 of `agents/roadmaps/road-to-readable-value-dashboard.md`.

Mirrors the `REQUIRED_SECTIONS` pattern in `render_benchmark_md.py`:
a fixed `value-v1` fixture in → asserts every panel + glossary + net
line is present in the rendered output. The full rendered output is
NOT byte-stable across runs (timestamps drift), so we use structural
assertions instead of a full-file diff.
"""
from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path

import pytest


REPO_ROOT = Path(__file__).resolve().parent.parent
RENDER_PATH = REPO_ROOT / "src" / "scripts" / "render_value_md.py"


def _load_renderer(monkeypatch, tmp_path: Path):
    """Load render_value_md with redirected output + input paths."""
    spec = importlib.util.spec_from_file_location("render_value_md", RENDER_PATH)
    assert spec is not None and spec.loader is not None
    mod = importlib.util.module_from_spec(spec)
    sys.modules["render_value_md"] = mod
    spec.loader.exec_module(mod)
    # Redirect input + output to a tmp dir so tests don't touch the
    # repo's real reports.
    fake_reports = tmp_path / "reports"
    fake_reports.mkdir()
    fake_latest = fake_reports / "latest.json"
    fake_out = tmp_path / "value.md"
    monkeypatch.setattr(mod, "VALUE_REPORTS_DIR", fake_reports)
    monkeypatch.setattr(mod, "LATEST", fake_latest)
    monkeypatch.setattr(mod, "OUT_PATH", fake_out)
    return mod, fake_latest, fake_out


def _canonical_report() -> dict:
    """A `value-v1` fixture with one of every rung state.

    Includes:
      - the up-front load rung (positive token_delta)
      - one measured saving (condense)
      - one pending rung (rtk)
      - the negative-honesty rung (terse, positive token_delta with a
        footnote saying so)
      - all four behaviour metrics with realistic values
    """
    return {
        "schema_version": 1,
        "schema_id": "value-v1",
        "generated_at": "2026-05-28T12:00:00+00:00",
        "reference_scale": {
            "requests": 1000,
            "avg_input_tokens": 8000,
            "avg_output_tokens": 600,
            "model_tier": "sonnet",
            "pricing_sourced_on": "2026-05-14",
        },
        "baseline": {
            "label": "Ohne Paket / Without package",
            "input_tokens_per_request": 8000,
        },
        "cost_ladder": [
            {
                "id": "baseline",
                "label": "Ohne Paket / Without package",
                "what_it_does": "Baseline — der nackte Request.",
                "token_delta": 0,
                "eur_delta": 0.0,
                "cumulative_pct": 0.0,
                "confidence": "measured",
                "source_report": "n/a",
            },
            {
                "id": "load",
                "label": "Mit Paket (Regeln laden)",
                "what_it_does": "Regeln im Kontext jedes Requests.",
                "token_delta": 4800,
                "eur_delta": 13.24,
                "cumulative_pct": 60.0,
                "confidence": "measured",
                "source_report": "agents/runtime/frugality/baseline.jsonl",
                "footnote": "Kernel + tier_1 + tier_2 + charter footprint.",
            },
            {
                "id": "condense",
                "label": "+ condense (Regeln eindampfen)",
                "what_it_does": "Build-Schritt schrumpft Regel-Dateien.",
                "token_delta": -200,
                "eur_delta": -0.55,
                "cumulative_pct": 57.5,
                "confidence": "measured",
                "source_report": "internal/bench/reports/telegraph-v2.json",
                "footnote": "Thin-Root excluded.",
            },
            {
                "id": "rtk",
                "label": "+ rtk (CLI-Output filtern)",
                "what_it_does": "rtk filtert verbose CLI-Ausgaben.",
                "token_delta": 0,
                "eur_delta": 0.0,
                "cumulative_pct": 57.5,
                "confidence": "pending",
                "source_report": "internal/bench/reports/rtk/latest.json",
                "footnote": "Install rtk and run scripts/bench_rtk_savings.py.",
            },
            {
                "id": "terse",
                "label": "+ terse (Antworten knapper)",
                "what_it_does": "Telegraph-Stil für knappere Antworten.",
                "token_delta": 56,
                "eur_delta": 0.77,
                "cumulative_pct": 58.2,
                "confidence": "measured",
                "source_report": "internal/bench/reports/telegraph-v1.json",
                "footnote": "Honest: gemessener Median = -9.27%.",
            },
        ],
        "behaviour": [
            {
                "id": "selection",
                "label": "Right-skill selection",
                "what_this_means": "Top-K Treffer richtigen Skills.",
                "with": 0.5,
                "without": 0.0,
                "delta": 0.5,
                "unit": "pct",
                "mode": "live",
                "source_report": "internal/bench/reports/",
            },
            {
                "id": "destructive-stops",
                "label": "Destructive-op stops",
                "what_this_means": "Stopps bei riskanten Aktionen.",
                "with": 4,
                "without": 1,
                "delta": 3,
                "unit": "count",
                "mode": "live",
                "source_report": "internal/bench/reports/ab/",
            },
            {
                "id": "ask-vs-act",
                "label": "Ask-vs-act ratio",
                "what_this_means": "Fragen vs. Handeln.",
                "with": 0.10,
                "without": 0.35,
                "delta": -0.25,
                "unit": "ratio",
                "mode": "live",
                "source_report": "internal/bench/reports/ab/",
            },
            {
                "id": "completion",
                "label": "Task completion rate",
                "what_this_means": "Anteil abgeschlossener Aufgaben.",
                "with": 0.78,
                "without": 0.42,
                "delta": 0.36,
                "unit": "pct",
                "mode": "live",
                "source_report": "internal/bench/reports/ab/",
            },
        ],
        "totals": {
            "cumulative_token_delta": 4656,
            "cumulative_eur_delta": 12.85,
            "cumulative_pct": 58.2,
            "net_verdict": "net-cost",
        },
        "notes": [
            "Token→€ priced at sonnet rates from internal/bench/pricing.yaml.",
            "Pending rungs contribute 0 until measured.",
        ],
    }


# ── Required-sections golden ────────────────────────────────────────────


def test_render_writes_all_required_sections(monkeypatch, tmp_path):
    mod, latest, out = _load_renderer(monkeypatch, tmp_path)
    latest.write_text(json.dumps(_canonical_report(), ensure_ascii=False))
    assert mod.render(quiet=True) == 0
    text = out.read_text()
    for section in mod.REQUIRED_SECTIONS:
        assert section in text, f"missing required section: {section}"


def test_render_panel_a_has_every_rung(monkeypatch, tmp_path):
    mod, latest, out = _load_renderer(monkeypatch, tmp_path)
    latest.write_text(json.dumps(_canonical_report(), ensure_ascii=False))
    mod.render(quiet=True)
    text = out.read_text()
    for expected in (
        "Ohne Paket",
        "Mit Paket",
        "condense",
        "rtk",
        "terse",
    ):
        assert expected in text, f"missing rung label: {expected}"


def test_render_panel_b_has_every_metric(monkeypatch, tmp_path):
    mod, latest, out = _load_renderer(monkeypatch, tmp_path)
    latest.write_text(json.dumps(_canonical_report(), ensure_ascii=False))
    mod.render(quiet=True)
    text = out.read_text()
    for expected in (
        "Right-skill selection",
        "Destructive-op stops",
        "Ask-vs-act ratio",
        "Task completion rate",
    ):
        assert expected in text, f"missing behaviour metric: {expected}"


def test_render_includes_net_line_with_verdict(monkeypatch, tmp_path):
    mod, latest, out = _load_renderer(monkeypatch, tmp_path)
    latest.write_text(json.dumps(_canonical_report(), ensure_ascii=False))
    mod.render(quiet=True)
    text = out.read_text()
    assert "NETTO" in text
    assert "Mehrkosten" in text  # net_verdict: net-cost
    assert "+58.20%" in text or "+58.2%" in text


def test_render_marks_pending_rungs_inline(monkeypatch, tmp_path):
    mod, latest, out = _load_renderer(monkeypatch, tmp_path)
    latest.write_text(json.dumps(_canonical_report(), ensure_ascii=False))
    mod.render(quiet=True)
    text = out.read_text()
    # The rtk rung is pending → must surface the pending badge somewhere
    # in the same row.
    assert "⏳ pending" in text


def test_render_marks_dry_run_metrics(monkeypatch, tmp_path):
    """If a behaviour metric is dry-run, the badge must appear."""
    mod, latest, out = _load_renderer(monkeypatch, tmp_path)
    report = _canonical_report()
    report["behaviour"][1]["mode"] = "dry-run"
    latest.write_text(json.dumps(report, ensure_ascii=False))
    mod.render(quiet=True)
    text = out.read_text()
    assert "⚠️ dry-run" in text


def test_render_placeholder_when_no_report(monkeypatch, tmp_path):
    """No latest.json → placeholder document with explicit instructions."""
    mod, _latest, out = _load_renderer(monkeypatch, tmp_path)
    assert mod.render(quiet=True) == 0
    text = out.read_text()
    assert "Platzhalter" in text or "no report" in text.lower()
    assert "task value" in text


def test_render_honest_terse_caveat(monkeypatch, tmp_path):
    """The terse rung's footnote (honesty about negative measurement)
    must reach the rendered dashboard verbatim."""
    mod, latest, out = _load_renderer(monkeypatch, tmp_path)
    latest.write_text(json.dumps(_canonical_report(), ensure_ascii=False))
    mod.render(quiet=True)
    text = out.read_text()
    assert "Honest" in text
    assert "-9.27" in text


def test_render_includes_reference_scale(monkeypatch, tmp_path):
    mod, latest, out = _load_renderer(monkeypatch, tmp_path)
    latest.write_text(json.dumps(_canonical_report(), ensure_ascii=False))
    mod.render(quiet=True)
    text = out.read_text()
    assert "1,000" in text or "1.000" in text
    assert "sonnet" in text
    # pricing_sourced_on date is intentionally NOT rendered — the dashboard
    # is token-only (no € figure ⇒ no pricing-provenance line).
    assert "2026-05-14" not in text
