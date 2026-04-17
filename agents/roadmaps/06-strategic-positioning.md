# Roadmap 06 — Strategische Positionierung (P3)

> **Priorität:** 🔵 P3 — Grundsätzliche Fragen, die alle anderen Roadmaps beeinflussen  
> **Aufwand:** Keine Code-Arbeit, aber die wichtigste Entscheidung  
> **Abhängigkeiten:** Sollte zuerst entschieden werden — beeinflusst Priorität aller anderen Punkte

---

## Die zentrale Frage: Was soll dieses Paket sein?

Nach der vollständigen Analyse des Repositories ist die wichtigste Beobachtung diese:

Das Paket wurde als **persönliches Entwicklungs-Tooling** aufgebaut und
**danach öffentlich gemacht**, ohne den Übergang sauber zu vollziehen.

Das ist kein Vorwurf. Es ist ein häufiges Muster. Aber es erklärt die meisten
Probleme in dieser Review:

- `AGENTS.md` mit Galawork-Inhalt → war nie als öffentliches Template gedacht
- `language: de` als Default → persönliche Präferenz, nie hinterfragt
- `ide: cursor` als Default → persönliche Präferenz
- Augment-first Architektur → der Autor nutzt Augment Code
- Proprietäre Lizenz → keine bewusste Entscheidung, Default-Annahme

---

## Drei ehrliche Szenarien

### Szenario A: "Persönliches Tooling, das ich teile"

**Beschreibung:** Das Paket ist primär für den Autor selbst. Es ist öffentlich,
weil andere davon profitieren könnten — aber die primäre Referenz-Implementierung
ist Galawork.

**Was das bedeutet:**
- README ehrlich umschreiben: "This is my personal agent setup for Galawork. Use it as inspiration."
- Proprietäre Lizenz ist OK, aber MIT wäre freundlicher für andere
- Keine Verpflichtung zu generischen Installern, Windows-Support, etc.
- 0 Stars und 0 Forks sind nicht das Ziel

**Aufwand, um zu diesem Zustand zu kommen:** Klein (nur README anpassen)

**Risiko:** Kein echtes Risiko für andere Teams, weil die Erwartungen korrekt gesetzt sind

---

### Szenario B: "Open-Source-Paket für PHP/Laravel-Teams"

**Beschreibung:** Das Paket wird zu einem echten Open-Source-Paket für Teams,
die ähnliche Tools nutzen (Augment/Claude Code + Laravel).

**Was das bedeutet:**
- MIT-Lizenz (nicht verhandelbar)
- AGENTS.md Template trennen (Roadmap 01)
- CHANGELOG, CONTRIBUTING, Troubleshooting (Roadmap 04)
- Windows-Support oder klare Nicht-Unterstützung (Roadmap 03)
- Issue-Templates, Community-Pflege (Roadmap 05)
- Zielgruppe klar kommunizieren: PHP/Laravel Teams

**Aufwand:** Mittel (2–4 Wochen vollständige Überarbeitung)

**Realistisches Potential:** Nische, aber echte Community möglich.
Laravel + Augment/Claude Code ist ein Growing Segment.
Ein gut gepflegtes Paket mit MIT-Lizenz könnte 50–200 Stars in 6 Monaten erreichen.

---

### Szenario C: "Framework-agnostisches Multi-Tool-Paket"

**Beschreibung:** Das Paket wird zu dem, was das README momentan behauptet — ein
universelles Agent-Config-Paket für alle Teams und alle Tools.

**Was das bedeutet:**
- Alles aus Szenario B, plus:
- Framework-neutrale Skills schreiben (oder Skills nach Framework trennen)
- Echte Cursor/Cline/Windsurf-Unterstützung aufbauen (nicht nur Symlinks)
- npm-Paket als First-Class-Bürger behandeln
- Augment-Lock-in auflösen oder als bewusste Entscheidung kommunizieren
- Mitbewerber-Analyse und Differenzierung: Was kann dieses Paket, was caliber/skills-sync nicht kann?

**Aufwand:** Groß (Monate, erfordert Architektur-Überarbeitung)

**Realistisches Potential:** Hoch — wenn die Ausführung stimmt.
Das ist ein echter Markt. Aber es gibt bereits gut etablierte Konkurrenten.

---

## Die Augment-Frage

Das Paket ist Augment-first. Das ist keine neutrale technische Entscheidung —
Augment Code ist ein kommerziales Produkt mit proprietärer Lizenz.

**Was das für das Paket bedeutet:**

1. Wenn Augment seinen Plugin-Standard ändert, muss das Paket folgen
2. Die `.augment/`-Struktur ist ein Augment-proprietäres Format (kein IETF-Standard)
3. Teams ohne Augment-Lizenz können nur einen Teil des Pakets nutzen

**Empfehlung:**

Wenn Augment die primäre Plattform ist: sagen. "Optimiert für Augment Code und Claude Code."

Wenn echte Multi-Tool-Neutralität das Ziel ist: `.augment/` als interne Struktur behandeln,
nicht als Source of Truth. Die Source of Truth sollte das agentskills.io-Format sein
(wenn dieses wirklich neutral ist).

---

## Der Konkurrenz-Realitätscheck

In dieser Review wurden folgende direkte Konkurrenten identifiziert:

**`caliber` (caliber-ai-org/ai-setup):**
- Generiert CLAUDE.md, .cursor/rules/, AGENTS.md aus dem echten Codebase
- Hält Configs aktuell wenn sich der Code ändert
- Framework-agnostisch
- Offene Lizenz
- **Kernunterschied zu agent-config:** Caliber ist projekt-spezifisch generiert,
  agent-config ist ein generisches geteiltes Paket

**`@ai-coders/context`:**
- Universeller `.context/`-Ordner
- Export in 8+ Tools
- MCP-Integration

**`skills-sync`:**
- Globales CLI-Tooling
- Drift-Check

**Was agent-config einzigartig hat:**
- 93 vorkuratierte Skills für PHP/Laravel (niemand sonst hat das)
- CI-System für Skill-Qualität (einzigartig)
- Kompressions-Pipeline (einzigartig)
- Integration mit Augment CLI Plugin-System

**Was agent-config verliert wenn es generisch wird:**
- Die Tiefe. 93 Skills für einen spezifischen Stack ist besser als 20 für alle Stacks.

**Empfehlung:**

Lean into the niche. Der USP ist: "Das beste Agent-Setup für PHP/Laravel-Teams."
Das ist ehrlicher, schärfer, und realistischer als "Multi-Tool für alle".

---

## Empfohlene Entscheidung

Auf Basis der Analyse empfehle ich **Szenario B**: Open-Source-Paket für PHP/Laravel-Teams.

**Begründung:**
- Der Content (93 PHP/Laravel Skills) ist bereits vorhanden und gut
- Die Zielgruppe ist klar und real
- Der Aufwand ist überschaubar
- Es erfordert keine Architektur-Überarbeitung
- Mit MIT-Lizenz entstehen keine rechtlichen Risiken für Nutzer

**Was dafür getan werden muss (priorisiert):**

1. MIT-Lizenz hinzufügen (1 Stunde)
2. AGENTS.md Template trennen (2-4 Stunden)
3. README neu schreiben mit ehrlicher Zielgruppe (2-3 Stunden)
4. CHANGELOG erstellen (halber Tag)
5. Uninstall implementieren (2-3 Tage)
6. Troubleshooting-Doku (halber Tag)

**Gesamtaufwand für Szenario B:** ca. 5-7 Arbeitstage

---

## Was passiert, wenn nichts passiert

Wenn das Paket im aktuellen Zustand bleibt:
- Es wird von einzelnen Entwicklern genutzt, die es explorativ ausprobieren
- Es wird selten in Produktionsprojekten eingesetzt (Lizenz-Risiko)
- Die 910 Installs wachsen nicht wesentlich
- Es bleibt ein persönliches Tooling mit öffentlichem Hosting

Das ist ein legitimer Zustand — aber er sollte bewusst gewählt sein, nicht default.

---

## Abschlussbewertung

| Dimension | Heute | Mit Szenario B |
|-----------|-------|----------------|
| Rechtliche Nutzbarkeit | ❌ Unklar | ✅ MIT |
| Adoptions-Potential | Niedrig | Mittel |
| Vertrauen externer Teams | Niedrig | Mittel-Hoch |
| Wartungsaufwand | Hoch (alles selbst) | Mittel (Community hilft) |
| Differenzierung | Mittel (versteckt) | Hoch (klar kommuniziert) |

Das Paket hat das Potenzial, das beste öffentlich verfügbare Agent-Setup für PHP/Laravel-Teams zu sein.
Es ist noch nicht dort. Aber der Weg dorthin ist nicht lang.
