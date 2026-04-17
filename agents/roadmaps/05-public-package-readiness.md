# Roadmap 05 — Bereitschaft für öffentliche Nutzung (P2)

> **Priorität:** 🟡 P2 — Blockiert Adoption durch externe Teams  
> **Aufwand:** Groß (koordinierte Arbeit über mehrere Bereiche)  
> **Abhängigkeiten:** 01-critical-blockers.md, 03-installer-system.md vollständig abgeschlossen

---

## Gesamtzustand: Ehrliche Bestandsaufnahme

Das Paket wird auf Packagist und npmjs.com öffentlich angeboten. Es ist also
technisch "public". Aber es ist nicht in einem Zustand, in dem ein externes Team
es bedenkenlos in ein Produktionsprojekt integrieren sollte.

**Was fehlt für echte Public Readiness:**

| Kriterium | Status | Risiko |
|-----------|--------|--------|
| Klare Lizenz | ❌ Fehlt | Rechtlich nicht nutzbar |
| Kein projektspezifischer Content | ❌ AGENTS.md ist Galawork | Falscher Content in fremden Projekten |
| Sauberer Uninstall | ❌ Fehlt | Nicht rückgängig machbar |
| CHANGELOG | ❌ Fehlt | Updates sind riskant |
| Troubleshooting-Doku | ❌ Fehlt | Support-Last beim Autor |
| Test-Coverage für Install | ⚠ Unklar | Stille Fehler möglich |
| Windows-Support | ❌ Undokumentiert | Stille Fehler |
| Tool-Support-Ehrlichkeit | ⚠ Irreführend | Falsche Erwartungen |

---

## Problem 20: Kein Feedback-Kanal für externe Nutzer

### Diagnose

Es gibt 0 offene Issues im Repository. Entweder funktioniert alles perfekt (unwahrscheinlich
bei 910 Installs), oder externe Nutzer haben keinen Weg, Probleme zu melden (wahrscheinlich).

Ein Blick auf die Issue-Konfiguration wäre nötig — sind Issues aktiviert? Gibt es
Issue-Templates? Gibt es eine `SUPPORT.md`?

Das Fehlen von Issues ist kein Qualitätsmerkmal — es ist ein Zeichen dafür, dass
keine externe Community existiert. 910 Installs, 0 Issues, 0 Stars, 0 Forks.
Das deutet darauf hin, dass viele Installs interne Automations-Installationen sind,
nicht echter externer Einsatz.

### Lösungsvorschlag

**Issue-Templates erstellen:**

```
.github/
└── ISSUE_TEMPLATE/
    ├── bug_report.md
    ├── skill_improvement.md
    └── new_skill_request.md
```

**`bug_report.md`:**
```markdown
---
name: Bug Report
about: Report a problem with installation or agent behavior
---

**Package version:** (run `composer show event4u/agent-config`)
**AI Tool:** [Augment / Claude Code / Cursor / ...]
**OS:** [macOS / Linux / Windows]
**PHP version:** (run `php --version`)

**What happened:**

**What you expected:**

**Installation method:** [composer / npm / git submodule]

**Output of `php vendor/bin/install.php --verbose`:**
```

---

## Problem 21: Keine Testabdeckung für den Installer selbst

### Diagnose

Laut `docs/quality.md` gibt es Tests:
```
task test          # Run all tests
task test-install  # Install script tests only (bash)
task test-python   # Compress script tests only (Python)
```

Aber was testen diese Tests genau? Der Linter testet die Struktur von Skills.
`test-install` testet das Installskript — aber in welchem Umfang?

Ohne Einsicht in die Test-Implementierung ist unklar, ob folgende Szenarien getestet werden:

- Frische Installation in ein leeres Verzeichnis
- Installation in ein Projekt mit bereits existierenden `.claude/`-Ordnern
- Installation wenn Symlinks bereits existieren (idempotenz)
- Installation auf einem System ohne Symlink-Berechtigung
- Fehlerfall: fehlende Abhängigkeiten

### Empfehlung: Test-Matrix dokumentieren

Unabhängig von der Implementierung sollte die Test-Matrix öffentlich sein:

```markdown
# In docs/quality.md — ergänzen:

## Install Script Test Coverage

| Scenario | Tested | Notes |
|----------|--------|-------|
| Fresh install in empty project | ✅ | |
| Install when .claude/ already exists | ✅ | |
| Idempotent re-install | ✅ | |
| Install with --dry-run | ✅ | |
| Install on macOS | ✅ | |
| Install on Linux | ✅ | |
| Install on Windows/WSL | ⬜ Not tested | |
| Composer postinstall hook | ⬜ Not tested | |
| Update after version bump | ⬜ Not tested | |
```

Diese Transparenz zeigt: wir wissen, was nicht getestet ist.

---

## Problem 22: Der Content ist Laravel-spezifisch, aber das Paket behauptet Framework-Agnostik

### Diagnose

93 Skills — schauen wir uns die verteilung an (aus dem README):

```
laravel, pest-testing, eloquent, create-pr, commit, fix-ci,
fix-pr-comments, quality-fix, bug-analyzer, improve-before-implement,
docker, security, api-design, database
```

Von diesen 14 Featured Skills sind mindestens 5 Laravel/PHP-spezifisch:
- `laravel` — obviously
- `pest-testing` — PHP-spezifisch (Pest ist ein PHP-Framework)
- `eloquent` — Laravel ORM
- `quality-fix` — ruft PHPStan/Rector/ECS auf (alle PHP-Tools)
- `database` — "MariaDB optimization" (laut README)

Das ist mehr als ein Drittel. Was ist mit den anderen 79 Skills? Unklar.

**Das Problem:**

Das Paket wird als `@event4u/agent-config` auf npm angeboten — suggeriert JavaScript-Support.
Ein JavaScript-Team, das `npm install --save-dev @event4u/agent-config` ausführt,
bekommt Skills, Commands und Rules, die auf PHPStan, Eloquent, Pest und Rector
ausgerichtet sind. Das ist irreführend.

### Lösungsvorschlag

**Option A: Ehrliche Zielgruppe-Kommunikation**

```markdown
## Who this is for

This package is primarily designed for **PHP/Laravel development teams**.

Most skills are PHP-specific (Laravel, Pest, PHPStan, Eloquent).
Framework-agnostic skills (Docker, Git, PR workflows, API design, Security)
work for any project.

If your project is JavaScript/TypeScript, you will get value from:
- All Rules (language-agnostic)
- Framework-agnostic Skills (~30 of 93)
- All Commands (Git/GitHub workflows)

PHP/Laravel teams get the full experience (all 93 skills).
```

**Option B: Framework-Flags für Skills einführen**

```yaml
# In SKILL.md frontmatter:
---
name: pest-testing
category: testing
framework: php
requires: [pest]
---
```

Der Installer könnte dann Skills basierend auf dem erkannten Framework aktivieren/deaktivieren.

**Option C: Separate Pakete**

```
event4u/agent-config-core     ← Framework-agnostische Skills
event4u/agent-config-laravel  ← Laravel/PHP Skills
event4u/agent-config-next     ← Next.js/TypeScript Skills (future)
```

Das würde das npm-Paket ehrlicher machen, ist aber ein größeres Refactoring.

### Aufwand: Klein (Option A, Dokumentation) bis Groß (Option C, Paketstruktur)

---

## Problem 23: Bus-Factor 1 ist ein ernstes Risiko für externe Nutzer

### Diagnose

Das Paket hat:
- 1 Contributor (der Autor)
- 0 Forks
- Proprietäre Lizenz (kein Fork möglich)
- Keine Community

Wenn der Autor aufhört, das Paket zu pflegen, gibt es keine Möglichkeit für
externe Nutzer, es weiterzupflegen. Bei proprietärer Lizenz dürfen sie nicht einmal
einen Fix schreiben und nutzen.

Das ist ein fundamentales Risiko für jedes Team, das das Paket in einen kritischen
Workflow integriert.

**Praktische Auswirkungen:**

- Augment Code ändert sein Plugin-Interface → keine Anpassung möglich (außer durch Autor)
- Claude Code ändert die Skills-Spezifikation → keine Anpassung möglich
- Paket wird nicht mehr gepflegt → Teams sitzen mit broken Symlinks

### Was dagegen hilft

**Kurzfristig:**
- MIT-Lizenz ermöglicht Forks als Fallback
- Klares Statement im README: "maintained by a single author, community contributions welcome"

**Mittelfristig:**
- Second contributor / reviewer
- Klare Roadmap, wer was übernimmt wenn der Autor nicht verfügbar ist

**Langfristig:**
- Open-Source-Governance-Modell
- Oder: ehrliche Kommunikation "This is personal tooling I share; use at your own risk"

Das zweite wäre ehrlicher als das erste, wenn keine Community aufgebaut werden soll.

---

## Problem 24: agentskills.io Standard ist nicht verifizierbar

### Diagnose

Das README und die Architektur-Dokumentation verweisen mehrfach auf den
"Agent Skills open standard" (https://agentskills.io):

> "Skills follow the Agent Skills open standard"

**Was ist agentskills.io?**

Unklar. Die Domain ist registriert, aber die Inhalte sind nicht Teil des Reviews.
Die Frage ist: ist das ein echter, breit unterstützter Standard? Oder ist es ein
Standard, den der Autor selbst (mit-)definiert hat?

Wenn Letzteres: dann ist "follows an open standard" eine Übertreibung.
Wenn Ersteres: dann sollte im README stehen, wer den Standard definiert und wie
er genutzt wird.

### Empfehlung

Entweder:
```markdown
Skills follow the [Agent Skills open standard](https://agentskills.io), 
maintained by [Organization]. The standard defines the SKILL.md frontmatter
format used by Claude Code, Augment, and other tools.
```

Oder (wenn es kein breit unterstützter Standard ist):
```markdown
Skills use a SKILL.md format with YAML frontmatter, compatible with
Claude Code's skills specification.
```

---

## Status-Tracking

| Problem | Status | Branch |
|---------|--------|--------|
| Issue-Templates erstellen | ⬜ Offen | — |
| Test-Matrix dokumentieren | ⬜ Offen | — |
| Zielgruppe klar kommunizieren | ⬜ Offen | — |
| Bus-Factor-Strategie | ⬜ Offen | — |
| agentskills.io Referenz klären | ⬜ Offen | — |
