# Value Dashboard — was kostet das Paket, was bringt es?

> Diese Seite beantwortet **eine** Frage in echten Zahlen: *Wie viel mehr Tokens kostet mich das Paket, und wie viel spart es danach wieder ein?* Generiert von `scripts/render_value_md.py` aus dem letzten `value-v1` Report; Quelle: `internal/bench/reports/value/latest.json`.

## Wie diese Seite zu lesen ist

**Panel A (Token-Leiter)** — von oben nach unten lesen. Jede Stufe sagt: *was sie macht*, *wie viele Input-Tokens sie pro Request hinzufügt oder spart*, und *wo wir kumulativ stehen*. Die fett gedruckte **NETTO**-Zeile am Ende ist die Antwort. Bewusst rein in Tokens — kein €-Vergleich, da Abo-Nutzer keine Per-Request-API-Preise zahlen.

**Panel B (Verhalten)** — vier reale Vergleiche, *mit* vs. *ohne* Paket. Hier liegt der nicht-Token-Wert: passende Skill-Auswahl, Stopps bei riskanten Aktionen, weniger Rückfragen, mehr abgeschlossene Aufgaben.

**Confidence-Marker** an jeder Stufe: `✅ gemessen` = echter Wert aus einem Report im Repo · `⏳ pending` = noch nicht gemessen, Stufe trägt 0 zur Summe bei · `⚠️ vendor-claim` = Behauptung eines Herstellers, nicht selbst gemessen.

## Reference scale

- **1,000** Requests, durchschnittlich **8,000** Input-Tokens und **600** Output-Tokens pro Request
- Modell-Tier (Workload-Annahme): `sonnet`
- Wer einen anderen Workload fährt, rechnet selbst nach — die Methodik ist offengelegt; nichts ist hardcodiert versteckt.

## Panel A — Kostenleiter (kumulativ, min → max)

Liest sich von oben nach unten. Positive Δ-Werte = das Paket *kostet* Tokens (Regel-Load ist die ehrliche Up-Front-Steuer); negative Δ-Werte = das Paket *spart* Tokens.

| Stufe | Was sie tut | Δ Tokens | Kumulativ | Quelle |
|---|---|---:|---:|---|
| **Ohne Paket / Without package** | Baseline — der nackte Request ohne Paket-Regeln. | +0 | +0.00% | `n/a` · ✅ gemessen |
| Mit Paket (Regeln laden) / With package (rule load) | Die immer-aktiven Regeln landen im Kontext jedes Requests. ⚠️ erst teurer | +59 359 | +741.99% | `internal/bench/reports/projection-cost.json` · ✅ gemessen |
| | _Fußnote:_ Eager-Default: alle 79 Rule-Files always-on im `.claude`-Projektionspfad (0B.6-bestätigt fürs primäre Tool). Nicht nur der Kernel — das ist die ehrliche Up-Front-Last; tokens ≈ chars / 4. | | | |
| + thin (Regeln als Pointer) / + thin (rules as pointers) | Nicht-Kernel-Regel-Bodies werden zu router-aufgelösten Pointern. | -45 857 | +741.99% | `internal/bench/reports/projection-cost.json` · 🔁 verfügbar (Default aus) |
| | _Fußnote:_ Verfügbar hinter `lean_projection.mode=thin` (Default `eager-all` — deshalb NICHT im Default-NETTO). Mit Thin aktiv: Rule-Layer 59359 → 13502 GPT tok (−45857, −77.3%). MUST-LOAD-Floor `task trigger-coverage` 26/26 grün; Live-A/B-Validierung ausstehend (Harness abgelehnt). Rollback = ein Flip. | | | |
| + condense (Regeln eindampfen) / + condense (rule shrink) | Build-Schritt schrumpft Regel-Dateien vor dem Ausliefern. | -186 | +739.66% | `internal/bench/reports/telegraph-v2.json` · ✅ gemessen |
| | _Fußnote:_ Aggregate across non-Thin-Root categories; Thin-Root files (AGENTS.md variants) net negative (~−4%) and are excluded from the rung — surfaced separately. | | | |
| + rtk (CLI-Output filtern) / + rtk (filter CLI output) | rtk schneidet verbose CLI-Ausgabe vor dem Modell-Input weg. | -585 | +732.35% | `internal/bench/reports/rtk/latest.json` · ✅ gemessen |
| + terse (Antworten knapper) / + terse (shorter replies) | Telegraph-Stil zielt auf knappere Modell-Antworten. | +56 | +733.05% | `internal/bench/reports/telegraph-v1.json` · ✅ gemessen |
| | _Fußnote:_ Honest: gemessener Median = -9.27% gegen 'sei knapp' — Telegraph liefert hier mehr Tokens, nicht weniger. Wir messen, wir verstecken nicht. | | | |

**NETTO: Mehrkosten** ⚠️ — **+58 644 Tokens / Request**, kumulativ **+733.05%** vs. Baseline.

## Panel B — Verhalten (mit vs. ohne)

Vier reale Vergleiche aus echten Bench-Runs. Hier liegt der Wert, den Tokens allein nicht messen: ob der Agent das richtige Skill wählt, bei riskanten Aktionen stoppt, weniger rückfragt und mehr Aufgaben abschließt.

| Metrik | Was es bedeutet | Mit Paket | Ohne Paket | Δ | Mode |
|---|---|---:|---:|---:|---|
| Right-skill selection / Richtige Skill-Wahl | Wie oft das passende Skill aktiviert wird (top-K Treffer). | 50.0% | 0.0% | 50.0% | ✅ live |
| Destructive-op stops / Stopps bei riskanten Aktionen | Wie oft der Agent vor destructive ops anhält / nachfragt (von 5). | — | — | — | ⚠️ dry-run |
| Ask-vs-act ratio / Fragen vs. Handeln | Verhältnis Rückfragen zu Aktionen — niedriger = entschlossener. | 0.000 | 0.000 | 0.000 | ✅ live |
| Task completion rate / Aufgaben fertig | Anteil der Aufgaben, die der Agent vollständig abschließt. | 84.6% | 0.0% | 84.6% | ✅ live |

## Glossar

Plain-language Definitionen für den nicht-Entwickler-Reader.

- **Token** — die Einheit, in der ein Sprachmodell abrechnet. Faustregel: ein Token ≈ 4 Zeichen deutsch/englischer Prosa. 1.000 Tokens ≈ 750 Wörter.
- **Input-Tokens** — alles, was das Modell pro Turn liest (System-Prompt, immer-aktive Regeln, deine Nachricht, frühere Konversation). Das Paket fügt hier Regeln hinzu — Installation kostet Input-Tokens.
- **Output-Tokens** — was das Modell zurückschreibt. Meist weniger als Input. Pro Token teurer als Input.
- **condense** — ein Build-Schritt, der die Regel-Dateien vor dem Ausliefern schrumpft (`.agent-src.uncondensed` → `.agent-src`). Spart Input-Tokens bei jedem Request.
- **rtk** — der *Rust Token Killer*, ein CLI-Wrapper, der verbose Output (`git status`, lint-Output, test-Runner) filtert, bevor das Modell ihn liest. Spart Input-Tokens auf Tool-Calls.
- **terse / telegraph** — ein Stil (kurze Phrasen, weggelassene Artikel), den der Agent für knappere Antworten nutzt. Spart Output-Tokens — wenn der Korpus es belohnt.
- **Ohne Paket / Mit Paket** — *without the package* / *with the package* — die zwei Arme des A/B-Vergleichs.
- **Δ Tokens** — Input-Token-Differenz pro Request gegenüber der Baseline. Bewusst die einzige Kosten-Einheit: ein €-Vergleich würde Per-Request-API-Preise unterstellen, die Abo-Nutzer nicht zahlen.

## Methodik & Quellen

Diese Seite ist eine **abgeleitete** Sicht — keine eigene Messung. Sie fasst drei bestehende Bench-Surfaces zusammen (siehe Spalte 'Quelle' in Panel A). Die maschinen-lesbaren Roh-Reports bleiben die Source-of-Truth:

- `internal/bench/reports/telegraph-v1.json` / `telegraph-v2.json` — Telegraph/Condense-Messungen.

- `agents/runtime/frugality/baseline.jsonl` — der Paket-Load (Metric A footprint).

- `internal/bench/reports/rtk/latest.json` — die rtk-Messung (neu, Phase 2).

- `internal/bench/reports/ab/*-ab-trackb-{with,without}.json` — A/B Track B (Verhalten).

- `internal/bench/reports/*-dev.json` — Dev-Korpus Selection-Accuracy.


**A/B-technischer Anhang:** [`docs/benchmark.md`](benchmark.md) trägt die Cache-Key-, Integrity- und Methodik-Details des A/B-Benches — wer den Variant-Axis-Beweis sehen will, liest dort weiter.


**Hinweise aus dem Report:**

- Cost is reported in tokens only — no € figure. Per-call API pricing misleads subscription users; tokens are the currency-neutral metric.
- Pending rungs contribute 0 to the cumulative until measured.
- Reference scale: 1000 requests × 8000 input / 600 output tokens per request.

_Last rendered: `2026-06-01T12:10:59+00:00`_
