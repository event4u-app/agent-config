#!/usr/bin/env python3
"""Render `docs/value.md` from the latest `value-v1` JSON report.

Phase 4 Step 1 of `agents/roadmaps/road-to-readable-value-dashboard.md`.

This renderer is **deterministic** — it does not run any bench, only
formats existing reports. Mirrors `render_benchmark_md.py`'s placeholder
discipline: when the report is missing, write a placeholder document
explaining how to produce one. Never errors.

The dashboard has two panels:
  - Panel A — cost ladder (cumulative, min → max)
  - Panel B — behaviour (with vs. without)

Each panel uses plain language, prints `confidence` markers inline,
and ends with a bold NETTO line that lifts the totals out of the
table.
"""
from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional


REPO_ROOT = Path(__file__).resolve().parent.parent
VALUE_REPORTS_DIR = REPO_ROOT / "internal" / "bench" / "reports" / "value"
LATEST = VALUE_REPORTS_DIR / "latest.json"
OUT_PATH = REPO_ROOT / "docs" / "value.md"

REQUIRED_SECTIONS = (
    "## Reference scale",
    "## Panel A",
    "## Panel B",
    "## Glossar",
    "**NETTO",
)


def utc_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def safe_load(path: Path) -> Optional[Dict[str, Any]]:
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text())
    except json.JSONDecodeError:
        return None


def fmt_signed_int(value: int) -> str:
    return f"{value:+,}".replace(",", " ")


def fmt_pct(value: float) -> str:
    return f"{value:+.2f}%"


def confidence_badge(level: str) -> str:
    badges = {
        "measured": "✅ gemessen",
        "estimated": "≈ geschätzt",
        "vendor-claim": "⚠️ vendor-claim",
        "pending": "⏳ pending",
        "available": "🔁 verfügbar (Default aus)",
    }
    return badges.get(level, level)


def mode_badge(mode: str) -> str:
    if mode == "live":
        return "✅ live"
    if mode == "dry-run":
        return "⚠️ dry-run"
    return mode


def render_intro(report: Dict[str, Any]) -> str:
    ref = report.get("reference_scale", {})
    requests = ref.get("requests", 1000)
    avg_in = ref.get("avg_input_tokens", 8000)
    avg_out = ref.get("avg_output_tokens", 600)
    tier = ref.get("model_tier", "sonnet")
    return (
        f"# Value Dashboard — was kostet das Paket, was bringt es?\n"
        "\n"
        "> Diese Seite beantwortet **eine** Frage in echten Zahlen: "
        "*Wie viel mehr Tokens kostet mich das Paket, und wie viel "
        "spart es danach wieder ein?* Generiert von "
        "`scripts/render_value_md.py` aus dem letzten `value-v1` Report; "
        "Quelle: `internal/bench/reports/value/latest.json`.\n"
        "\n"
        "## Wie diese Seite zu lesen ist\n"
        "\n"
        "**Panel A (Token-Leiter)** — von oben nach unten lesen. Jede "
        "Stufe sagt: *was sie macht*, *wie viele Input-Tokens sie pro "
        "Request hinzufügt oder spart*, und *wo wir kumulativ stehen*. "
        "Die fett gedruckte **NETTO**-Zeile am Ende ist die Antwort. "
        "Bewusst rein in Tokens — kein €-Vergleich, da Abo-Nutzer keine "
        "Per-Request-API-Preise zahlen.\n"
        "\n"
        "**Panel B (Verhalten)** — vier reale Vergleiche, *mit* vs. "
        "*ohne* Paket. Hier liegt der nicht-Token-Wert: passende Skill-"
        "Auswahl, Stopps bei riskanten Aktionen, weniger Rückfragen, "
        "mehr abgeschlossene Aufgaben.\n"
        "\n"
        "**Confidence-Marker** an jeder Stufe: `✅ gemessen` = echter "
        "Wert aus einem Report im Repo · `⏳ pending` = noch nicht "
        "gemessen, Stufe trägt 0 zur Summe bei · `⚠️ vendor-claim` = "
        "Behauptung eines Herstellers, nicht selbst gemessen.\n"
        "\n"
        "## Reference scale\n"
        "\n"
        f"- **{requests:,}** Requests, durchschnittlich "
        f"**{avg_in:,}** Input-Tokens und **{avg_out:,}** Output-Tokens "
        "pro Request\n"
        f"- Modell-Tier (Workload-Annahme): `{tier}`\n"
        "- Wer einen anderen Workload fährt, rechnet selbst nach — die "
        "Methodik ist offengelegt; nichts ist hardcodiert versteckt.\n"
    )


def render_panel_a(report: Dict[str, Any]) -> str:
    lines = [
        "## Panel A — Kostenleiter (kumulativ, min → max)\n",
        "Liest sich von oben nach unten. Positive Δ-Werte = das Paket "
        "*kostet* Tokens (Regel-Load ist die ehrliche Up-Front-Steuer); "
        "negative Δ-Werte = das Paket *spart* Tokens.\n",
        "| Stufe | Was sie tut | Δ Tokens | Kumulativ | Quelle |",
        "|---|---|---:|---:|---|",
    ]
    for rung in report.get("cost_ladder", []):
        if rung["id"] == "baseline":
            label_cell = f"**{rung['label']}**"
        else:
            label_cell = rung["label"]
        what = rung.get("what_it_does", "")
        token_delta = int(rung.get("token_delta", 0))
        cum = float(rung.get("cumulative_pct", 0.0))
        conf = confidence_badge(rung.get("confidence", "pending"))
        source = rung.get("source_report", "")
        # Honesty stamp: an `up-front-cost` note on the load rung.
        if rung["id"] == "load" and token_delta > 0:
            what = f"{what} ⚠️ erst teurer"
        lines.append(
            f"| {label_cell} | {what} | "
            f"{fmt_signed_int(token_delta)} | "
            f"{fmt_pct(cum)} | `{source}` · {conf} |"
        )
        if rung.get("footnote"):
            lines.append(
                f"| | _Fußnote:_ {rung['footnote']} | | | |"
            )

    totals = report.get("totals", {})
    cum_tokens = int(totals.get("cumulative_token_delta", 0))
    cum_pct = float(totals.get("cumulative_pct", 0.0))
    verdict = totals.get("net_verdict", "—")
    verdict_label = {
        "net-saving": "**NETTO: Ersparnis** ✅",
        "net-cost": "**NETTO: Mehrkosten** ⚠️",
        "break-even": "**NETTO: Break-Even** ⚖️",
    }.get(verdict, f"**NETTO: {verdict}**")
    lines.extend(
        [
            "",
            f"{verdict_label} — "
            f"**{fmt_signed_int(cum_tokens)} Tokens / Request**, "
            f"kumulativ **{fmt_pct(cum_pct)}** vs. Baseline.\n",
        ]
    )
    return "\n".join(lines)


def render_panel_b(report: Dict[str, Any]) -> str:
    lines = [
        "## Panel B — Verhalten (mit vs. ohne)\n",
        "Vier reale Vergleiche aus echten Bench-Runs. Hier liegt der "
        "Wert, den Tokens allein nicht messen: ob der Agent das "
        "richtige Skill wählt, bei riskanten Aktionen stoppt, weniger "
        "rückfragt und mehr Aufgaben abschließt.\n",
        "| Metrik | Was es bedeutet | Mit Paket | Ohne Paket | Δ | Mode |",
        "|---|---|---:|---:|---:|---|",
    ]
    for metric in report.get("behaviour", []):
        label = metric["label"]
        what = metric.get("what_this_means", "")
        unit = metric.get("unit", "")
        mode = mode_badge(metric.get("mode", "dry-run"))

        def _fmt(v: Any) -> str:
            if v is None:
                return "—"
            if unit == "pct" and isinstance(v, (int, float)):
                return f"{float(v) * 100:.1f}%"
            if unit == "count":
                return str(int(v))
            if unit == "ratio" and isinstance(v, (int, float)):
                return f"{float(v):.3f}"
            if unit == "seconds" and isinstance(v, (int, float)):
                return f"{float(v):.1f}s"
            return str(v)

        with_v = _fmt(metric.get("with"))
        without_v = _fmt(metric.get("without"))
        delta_v = _fmt(metric.get("delta"))
        lines.append(
            f"| {label} | {what} | {with_v} | {without_v} | {delta_v} | {mode} |"
        )
    return "\n".join(lines) + "\n"


def render_glossary() -> str:
    return (
        "## Glossar\n"
        "\n"
        "Plain-language Definitionen für den nicht-Entwickler-Reader.\n"
        "\n"
        "- **Token** — die Einheit, in der ein Sprachmodell abrechnet. "
        "Faustregel: ein Token ≈ 4 Zeichen deutsch/englischer Prosa. "
        "1.000 Tokens ≈ 750 Wörter.\n"
        "- **Input-Tokens** — alles, was das Modell pro Turn liest "
        "(System-Prompt, immer-aktive Regeln, deine Nachricht, frühere "
        "Konversation). Das Paket fügt hier Regeln hinzu — Installation "
        "kostet Input-Tokens.\n"
        "- **Output-Tokens** — was das Modell zurückschreibt. Meist "
        "weniger als Input. Pro Token teurer als Input.\n"
        "- **condense** — ein Build-Schritt, der die Regel-Dateien "
        "vor dem Ausliefern schrumpft (`.agent-src.uncondensed` → "
        "`.agent-src`). Spart Input-Tokens bei jedem Request.\n"
        "- **rtk** — der *Rust Token Killer*, ein CLI-Wrapper, der "
        "verbose Output (`git status`, lint-Output, test-Runner) "
        "filtert, bevor das Modell ihn liest. Spart Input-Tokens auf "
        "Tool-Calls.\n"
        "- **terse / telegraph** — ein Stil (kurze Phrasen, "
        "weggelassene Artikel), den der Agent für knappere Antworten "
        "nutzt. Spart Output-Tokens — wenn der Korpus es belohnt.\n"
        "- **Ohne Paket / Mit Paket** — *without the package* / *with "
        "the package* — die zwei Arme des A/B-Vergleichs.\n"
        "- **Δ Tokens** — Input-Token-Differenz pro Request gegenüber der "
        "Baseline. Bewusst die einzige Kosten-Einheit: ein €-Vergleich "
        "würde Per-Request-API-Preise unterstellen, die Abo-Nutzer nicht "
        "zahlen.\n"
    )


def render_methodology(report: Dict[str, Any]) -> str:
    notes = report.get("notes", [])
    lines = [
        "## Methodik & Quellen\n",
        "Diese Seite ist eine **abgeleitete** Sicht — keine eigene "
        "Messung. Sie fasst drei bestehende Bench-Surfaces zusammen "
        "(siehe Spalte 'Quelle' in Panel A). Die maschinen-lesbaren "
        "Roh-Reports bleiben die Source-of-Truth:\n",
        "- `internal/bench/reports/telegraph-v1.json` / `telegraph-v2.json` "
        "— Telegraph/Condense-Messungen.\n",
        "- `agents/runtime/frugality/baseline.jsonl` — der Paket-Load "
        "(Metric A footprint).\n",
        "- `internal/bench/reports/rtk/latest.json` — die rtk-Messung "
        "(neu, Phase 2).\n",
        "- `internal/bench/reports/ab/*-ab-trackb-{with,without}.json` "
        "— A/B Track B (Verhalten).\n",
        "- `internal/bench/reports/*-dev.json` — Dev-Korpus Selection-"
        "Accuracy.\n",
        "",
        "**A/B-technischer Anhang:** [`docs/benchmark.md`](benchmark.md) "
        "trägt die Cache-Key-, Integrity- und Methodik-Details des "
        "A/B-Benches — wer den Variant-Axis-Beweis sehen will, liest "
        "dort weiter.\n",
        "",
    ]
    if notes:
        lines.append("**Hinweise aus dem Report:**\n")
        for note in notes:
            lines.append(f"- {note}")
        lines.append("")
    lines.append(f"_Last rendered: `{utc_iso()}`_\n")
    return "\n".join(lines)


def render_placeholder() -> str:
    return (
        "# Value Dashboard — Platzhalter\n"
        "\n"
        "_Es liegt noch kein `value-v1` Report unter "
        "`internal/bench/reports/value/latest.json` vor._\n"
        "\n"
        "Einen erzeugen mit:\n"
        "\n"
        "```sh\n"
        "task value\n"
        "```\n"
        "\n"
        "Die Methodik dieses Dashboards ist beschrieben in "
        "`docs/contracts/value-dashboard-spec.md` und der zugehörigen "
        "Roadmap `agents/roadmaps/road-to-readable-value-dashboard.md`.\n"
        "\n"
        f"_Last rendered: {utc_iso()}_\n"
    )


def render(quiet: bool = False) -> int:
    report = safe_load(LATEST)
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    if not report:
        OUT_PATH.write_text(render_placeholder())
        if not quiet:
            sys.stdout.write(
                f"render_value_md: no report — wrote placeholder to "
                f"{OUT_PATH.relative_to(REPO_ROOT)}\n"
            )
        return 0
    parts = [
        render_intro(report),
        render_panel_a(report),
        render_panel_b(report),
        render_glossary(),
        render_methodology(report),
    ]
    OUT_PATH.write_text("\n".join(parts))
    if not quiet:
        sys.stdout.write(
            f"render_value_md: wrote {OUT_PATH.relative_to(REPO_ROOT)}\n"
        )
    return 0


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Render docs/value.md from the latest value-v1 report."
    )
    parser.add_argument("--quiet", action="store_true", help="Suppress stdout.")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv if argv is not None else sys.argv[1:])
    return render(quiet=args.quiet)


if __name__ == "__main__":
    raise SystemExit(main())
