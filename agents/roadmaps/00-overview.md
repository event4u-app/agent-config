# Roadmap Overview — agent-config External Review

> **Quelle:** Unabhängige Code-Review, durchgeführt April 2026  
> **Reviewer:** Externe Analyse (kein Mitglied des event4u-Teams)  
> **Basis:** v1.3.3, GitHub-Stand 17. April 2026  
> **Methode:** Review von README, composer.json, package.json, AGENTS.md, docs/architecture.md, docs/quality.md, docs/installation.md, docs/customization.md, Packagist-Metadaten

---

## Ehrliche Gesamtbewertung

Das Paket zeigt beeindruckende Ingenieur-Denkarbeit für ein Ein-Personen-Projekt. Die
Idee ist richtig, der CI-Apparat ist ungewöhnlich solide, und die Kompressions-Pipeline
ist clever. Gleichzeitig ist das Paket in seinem aktuellen Zustand **nicht bereit für
externe Teams**. Es enthält projektspezifische Inhalte des Autors, hat eine unklare
Lizenz, und versteckt seine Augment-Abhängigkeit hinter einer Multi-Tool-Fassade.

Diese Roadmaps sind keine Kritik an der Person, sondern ein ehrlicher Fahrplan, um
das Paket auf das Niveau zu bringen, das es offensichtlich anstrebt.

---

## Roadmaps in diesem Review

| Datei | Fokus | Priorität | Status |
|-------|-------|-----------|--------|
| `archive/01-critical-blockers.md` | 3 Blocker, die sofort behoben werden müssen | 🔴 P0 | ✅ Archiviert |
| `archive/02-architecture-issues.md` | Strukturelle Probleme, die das Fundament betreffen | 🟠 P1 | ✅ Archiviert |
| `archive/03-installer-system.md` | Probleme mit Installation, Cleanup, Windows | 🟠 P1 | ✅ Archiviert |
| `archive/04-documentation-gaps.md` | Was in der Doku fehlt oder irreführt | 🟡 P2 | ✅ Archiviert |
| `05-public-package-readiness.md` | Was nötig ist, damit fremde Teams das Paket nutzen können | 🟡 P2 | 🟡 Teilweise — Bus-Factor offen |
| `06-strategic-positioning.md` | Grundsätzliche Fragen zur Ausrichtung des Projekts | 🔵 P3 | 🟡 Teilweise — Community-Kanal offen |

**Offene strategische Punkte** (brauchen Maintainer-Entscheidung statt Code-Arbeit):
Bus-Factor-Plan (05) und Community-Kanal (06). Siehe jeweilige Roadmap
und `deferred-followups.md` für Unblock-Bedingungen.

---

## Kurzfassung der kritischsten Probleme

### P0 — Sofortiger Handlungsbedarf

1. **AGENTS.md enthält Galawork-Projektdaten** — ein Installationsfehler für externe Nutzer
2. **Proprietäre Lizenz ohne Terms** — rechtliche Grauzone für jedes Team, das das Paket einbindet
3. **Augment-Lock-in ist nicht kommuniziert** — das README behauptet Multi-Tool-Support, der de facto eingeschränkt ist

### P1 — Hohe Priorität

4. **Kein Uninstall-Prozess** — nicht umkehrbar ohne manuelle Aufräumarbeit
5. **Postinstall-Hook ohne Opt-in** — Sicherheitsproblem bei Composer/npm
6. **Zwei parallele Installer** — welcher ist canonical?
7. **Keine PHP-Version im composer.json** — fehlende Kompatibilitätsgarantie
8. **Windows-Symlinks ohne Fallback** — stille Fehler auf Windows

### P2 — Mittlere Priorität

9. **Kein CHANGELOG** — 15 Releases ohne Änderungsprotokoll
10. **Sprach-Konfiguration (`language: de`) als Hardcode im System** — nicht für internationale Nutzung geeignet
11. **IDE-Hardcode (`ide: cursor`)** — unpassend als Default für fremde Teams
12. **README-Behauptungen vs. Realität** — Skills-Support für Cursor/Cline fehlt, steht aber implizit drin
13. **Portability-Check deckt AGENTS.md nicht ab** — CI-Lücke

### P3 — Strategisch

14. **Was ist die Zielgruppe wirklich?** — Paket oder persönliches Tooling?
15. **Proprietär vs. Open Source** — die falsche Wahl für Community-Traktion
16. **Augment-first in einer Welt, die Claude Code und Cursor bevorzugt**

---

## Bewertungsmatrix

| Bereich | Note | Begründung |
|---------|------|------------|
| Konzept & Idee | **A** | Richtig gedacht, echter Nutzen |
| Interne Code-Qualität | **B+** | CI-Pipeline und Linter sind stark |
| Für externe Nutzung bereit | **D** | 3 Blocker, unklar lizenziert |
| Dokumentation | **B** | Gut, aber Lücken an kritischen Stellen |
| Installer/DX | **C** | Zu viel Magie, kein Cleanup |
| Tool-Support-Breite | **C+** | Augment bekommt alles, andere bekommen wenig |
| Community-Reife | **F** | 0 Stars, 0 Forks, Bus-Factor 1 |

---

## Wie diese Roadmaps genutzt werden können

Die einzelnen Roadmaps folgen dem Format, das im Repo unter `agents/roadmaps/` genutzt
wird. Sie können direkt in das Repository eingecheckt werden. Jede Roadmap hat:

- Klare Problem-Diagnose
- Konkrete Lösungsvorschläge mit Codebeispielen wo möglich
- Priorität und Aufwandsschätzung
- Abhängigkeiten zu anderen Roadmaps
