# Roadmap 01 — Kritische Blocker (P0)

> **Priorität:** 🔴 P0 — Muss behoben werden, bevor das Paket extern genutzt werden kann  
> **Aufwand:** Klein bis mittel (Tage, nicht Wochen)  
> **Abhängigkeiten:** Keine — diese Fixes sind unabhängig voneinander

---

## Problem 1: AGENTS.md enthält Galawork-Projektdaten

### Diagnose

Die Datei `AGENTS.md` im Repository-Root ist keine generische Vorlage. Sie ist die
echte Agent-Konfiguration des "Galawork"-Projekts des Paket-Autors. Inhalt:

```
# Galawork API
A governed AI development layer for the Galawork platform —
a Laravel SaaS application for the landscaping industry.

## Tech Stack
- Framework: Laravel 11 (PHP ^8.2)
- Database: MariaDB / MySQL (multi-tenant, customer-specific databases)
- Queue: Redis + Laravel Horizon
...
make start
make console
make migrate-and-seed
...
```

Dieses Dokument wird durch `install.sh` in Consumer-Projekte kopiert (laut
`docs/installation.md`: "AGENTS.md ← copied if missing"). Das bedeutet: ein Team,
das `composer require event4u/agent-config` ausführt und danach `php vendor/bin/install.php`
aufruft, bekommt eine AGENTS.md, die von MariaDB-Multi-Tenancy, Redis Horizon und
`make migrate-and-seed` spricht — unabhängig von ihrem eigenen Stack.

### Warum das passiert ist

Das Repo dient dem Autor gleichzeitig als Entwicklungsumgebung für sein eigenes
Galawork-Projekt und als Paket-Quelle. Die AGENTS.md wurde nie sauber getrennt.

### Woraus das Richtige aussehen würde

Es muss eine **Template-Version** geben, die bei Installation in ein neues Projekt
kopiert wird, und eine **entwicklungsinterne Version**, die nicht ausgeliefert wird.

**Lösung:**

```
# Vorher (fehlerhaft):
AGENTS.md                ← Galawork-Inhalt, wird kopiert

# Nachher (korrekt):
AGENTS.md                ← Paket-eigene Konfiguration für agent-config selbst
templates/AGENTS.md      ← Leere Vorlage, die bei Install kopiert wird
```

Die `templates/AGENTS.md` sollte so aussehen:

```markdown
# [Projektname]

> Ersetze diesen Header mit deinem Projektnamen.
> Diese Datei ist die Agent-Konfiguration für dein Projekt.
> Lies: https://github.com/event4u-app/agent-config/blob/main/docs/customization.md

## Tech Stack

- **Framework:** [z.B. Laravel 11, Symfony 7, Next.js 15]
- **Sprache:** [z.B. PHP 8.3, TypeScript 5.7]
- **Datenbank:** [z.B. PostgreSQL 16, MariaDB 10.11]
- **Tests:** [z.B. Pest, PHPUnit, Vitest]

## Entwicklungs-Setup

```bash
# Wie startet man die Umgebung?
# z.B.: docker compose up -d
# z.B.: make start
```

## Wichtige Konventionen

- [Ergänze hier die wichtigsten Regeln für deinen Codebase]
```

**Änderungen in install.sh / install.php:**

```bash
# Statt: cp "$SOURCE/AGENTS.md" "$TARGET/AGENTS.md"
# Neu:
if [ ! -f "$TARGET/AGENTS.md" ]; then
    cp "$SOURCE/templates/AGENTS.md" "$TARGET/AGENTS.md"
    echo "✓ AGENTS.md template created — please customize it for your project"
    echo "  → $TARGET/AGENTS.md"
fi
```

**Änderungen im CI (Portability-Check):**

Der bestehende "Portability check — No project-specific paths in shared files" erfasst
die Root-AGENTS.md nicht, weil sie außerhalb von `.augment/` liegt. Das ist eine CI-Lücke.

Lösung: CI-Check erweitern, der sicherstellt, dass die `templates/AGENTS.md` keine
projektspezifischen Strings enthält (z.B. "Galawork", "galawork", "landscaping").

### Aufwand: Klein (2–4 Stunden)

---

## Problem 2: Proprietäre Lizenz ohne Terms of Use

### Diagnose

```json
// composer.json
{
  "license": "proprietary"
}
```

Es gibt keine `LICENSE`-Datei im Repository. Es gibt keine `TERMS.md`. Es gibt
kein Dokument, das beschreibt, was "proprietär" in diesem Kontext bedeutet.

**Was das rechtlich bedeutet:**

In Deutschland und der EU gilt: wenn kein explizites Nutzungsrecht eingeräumt wird,
greift das Urheberrecht vollständig. "All rights reserved" ist der Default. Das bedeutet:

- Darf ein Team das Paket in ihrem kommerziellen Projekt nutzen? **Unklar.**
- Darf es modifiziert werden? **Nein**, ohne explizite Erlaubnis.
- Darf es intern weiterverteilt werden (z.B. via private Packagist-Instanz)? **Unklar.**
- Darf es geforkt werden? **Nein.**

Kein sorgfältiger Engineering-Manager wird ein Paket mit dieser Lizenz in einem
professionellen Projekt einsetzen.

### Die Entscheidung, die getroffen werden muss

Der Autor muss sich entscheiden. Es gibt drei realistische Optionen:

**Option A: MIT-Lizenz** (empfohlen für maximale Adoption)

- Erlaubt alles: Nutzung, Modifikation, Weiterverteilung
- Einzige Bedingung: Copyright-Notice beibehalten
- Standard in der PHP/Laravel-Community

```
MIT License

Copyright (c) 2026 Matthias [Nachname]

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction...
```

**Option B: Source-Available mit Nutzungserlaubnis**

- Quellcode öffentlich, aber mit Einschränkungen
- Z.B.: "Kostenlose Nutzung erlaubt, keine Weiterverteilung als eigenes Produkt"
- Braucht eine explizite, menschenlesbare `LICENSE.md`

**Option C: Bewusst proprietär mit klaren Terms**

- Explizite Nutzungserlaubnis in `TERMS.md`
- Z.B.: "Kostenlose Nutzung für Teams unter X Personen erlaubt"
- Muss trotzdem klar formuliert sein

**Was auf keinen Fall funktioniert:**

Einfach "proprietary" in composer.json schreiben und keine Terms veröffentlichen.
Das ist der Status quo — und er ist für niemanden akzeptabel.

### Empfehlung

Wenn das Ziel Adoption durch externe Teams ist: MIT-Lizenz. Sofort.

Wenn das Ziel ein kommerzielles Produkt ist: `TERMS.md` schreiben, der klar beschreibt
wer es nutzen darf. Dann ist "proprietary" korrekt, aber es braucht expliziten Inhalt.

### Aufwand: Sehr klein (1 Stunde, hauptsächlich Entscheidung)

---

## Problem 3: Augment-Lock-in wird nicht kommuniziert

### Diagnose

Das README stellt das Paket als "Multi-Tool-Lösung" dar:

```
Works with Augment Code, Claude Code, Cursor, Cline, Windsurf, and Gemini CLI
```

Die Realität laut `docs/architecture.md`:

| Tool | Rules | Skills | Commands |
|------|-------|--------|----------|
| Augment VSCode/IntelliJ | ✅ | ✅ | ✅ |
| Claude Code | ✅ | ✅ | ✅ |
| Cursor | ✅ | — | ☑️ |
| Cline | ✅ | — | ☑️ |
| Windsurf | ✅ | — | ☑️ |
| Gemini CLI | ✅ | — | ☑️ |

**Was das bedeutet:**

Teams, die Cursor oder Cline nutzen, bekommen ausschließlich Rules. Skills (93 Stück,
das Herzstück des Pakets) und Commands (51 Stück) stehen für diese Tools nicht zur
Verfügung. Das ist nicht "Works with Cursor" — das ist "Cursor bekommt einen Bruchteil
des Funktionsumfangs."

**Die Architektur-Realität:**

`.augment/` ist die kanonische Source of Truth. Alle anderen Tools konsumieren Symlinks
oder generierte Dateien von dort. Das Paket ist ein Augment-Paket mit Adapter-Schicht
für andere Tools — nicht ein neutrales Multi-Tool-Paket.

Das ist keine falsche Entscheidung. Es ist eine versteckte Entscheidung.

### Was ehrliche Kommunikation aussehen würde

**Im README:**

```markdown
## Tool-Support

Dieses Paket ist primär für Augment Code und Claude Code optimiert.

| Tool | Rules | Skills (93) | Commands (51) |
|------|-------|-------------|---------------|
| **Augment Code** | ✅ Vollständig | ✅ Vollständig | ✅ Vollständig |
| **Claude Code** | ✅ Vollständig | ✅ Vollständig | ✅ Vollständig |
| Cursor | ✅ Rules only | ❌ | ❌ nativ* |
| Cline | ✅ Rules only | ❌ | ❌ nativ* |
| Windsurf | ✅ Rules only | ❌ | ❌ nativ* |
| Gemini CLI | ✅ Rules only | ❌ | ❌ nativ* |

*Commands sind via AGENTS.md als Text-Referenz verfügbar, aber nicht als
native Slash-Commands.

→ Wenn du hauptsächlich Cursor oder Windsurf nutzt, bekommst du nur Rules.
Das ist nützlich, aber nicht der volle Funktionsumfang.
```

### Aufwand: Sehr klein (README-Update, 30 Minuten)

---

## Status-Tracking

| Problem | Status | Branch |
|---------|--------|--------|
| AGENTS.md Template trennen | ⬜ Offen | — |
| Lizenz klären und dokumentieren | ⬜ Offen | — |
| README Tool-Support ehrlich beschreiben | ⬜ Offen | — |
