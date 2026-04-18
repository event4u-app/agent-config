# Roadmap 02 — Architektur-Probleme (P1)

> **Priorität:** 🟠 P1 — Beeinflusst Nutzbarkeit und Wartbarkeit erheblich  
> **Aufwand:** Mittel (Tage bis Wochen je nach Problem)  
> **Abhängigkeiten:** 01-critical-blockers.md sollte zuerst abgeschlossen sein

---

## Problem 4: Zwei Installer-Implementierungen ohne klare Canonical-Quelle

### Diagnose

Das Repository enthält zwei vollständige, parallele Installationssysteme:

- `scripts/install.sh` — Bash-Skript (historisch, ausführlich, gut dokumentiert)
- `bin/install.php` — PHP-Skript (neuer, stärker im README hervorgehoben)

Beide werden an verschiedenen Stellen in der Dokumentation erwähnt. Beide
führen Installationslogik aus. Unklar ist:

1. Welches ist canonical?
2. Sind sie funktional äquivalent?
3. Was passiert, wenn ein Nutzer beide nacheinander ausführt?
4. Welches wird vom `postinstall`-Hook aufgerufen?

Laut `docs/installation.md`:
> "The `postinstall` hook runs `scripts/install.sh` automatically via `setup.sh`."

Aber das README sagt:
> "php vendor/bin/install.php"

Und `composer.json` hat im `bin`-Feld: `"bin/install.php"`.

Das ist Verwirrung auf Dokumentations- und Implementierungsebene gleichzeitig.

### Warum das gefährlich ist

Wenn beide Skripte unterschiedliche Logik enthalten (was wahrscheinlich ist, wenn
sie parallel gepflegt werden), entstehen subtile Unterschiede je nach Installationsweg.
Ein Team, das `npm install` nutzt, bekommt möglicherweise eine andere Installation als
ein Team, das `composer install` nutzt.

### Lösungsvorschlag

**Klare Hierarchie etablieren:**

```
scripts/install.sh   ← Einzige Implementierung aller Installationslogik
bin/install.php      ← Dünner PHP-Wrapper, der install.sh aufruft
```

Oder alternativ: `install.php` komplett entfernen und durch das Bash-Skript ersetzen.

**Dokumentation vereinheitlichen:**

Eine einzige "Wie installiere ich?" Anleitung, die klar sagt: "Es gibt einen Weg."

**In der Dokumentation fehlt außerdem:**

Was macht `bin/install.php` zusätzlich zu `scripts/install.sh`? Die `--profile`-Option
scheint PHP-spezifisch zu sein. Das muss dokumentiert werden.

---

## Problem 5: Repository-Struktur ist nicht trennbar zwischen Paket und Entwicklungsumgebung

### Diagnose

Das Repository vermischt vier verschiedene Rollen:

**Rolle 1: Das Paket selbst**
```
.augment/             ← Lieferbar (ausgeliefert)
.augment-plugin/      ← Lieferbar
.claude-plugin/       ← Lieferbar
bin/                  ← Lieferbar
scripts/              ← Teils lieferbar
```

**Rolle 2: Entwicklungstools für das Paket**
```
.agent-src.uncompressed/ ← Entwicklung (ausgeschlossen via archive.exclude)
tests/                ← Entwicklung (ausgeschlossen)
Taskfile.yml          ← Entwicklung (ausgeschlossen)
```

**Rolle 3: Die Galawork-Konfiguration des Autors**
```
AGENTS.md             ← Galawork-Inhalt (fälschlicherweise im Root)
agents/               ← Möglicherweise Galawork-spezifisch
```

**Rolle 4: Templates für Consumer**
```
templates/            ← Für Consumer-Projekte
config/profiles/      ← Profile-Konfiguration
```

Das Durcheinander macht es schwer zu verstehen, was ausgeliefert wird und was nicht.

### Lösungsvorschlag: Klarere Verzeichnisstruktur

```
agent-config/
├── src/                         ← Alles was ausgeliefert wird
│   ├── augment/                 ← Komprimierte Skills/Rules/Commands
│   ├── augment-plugin/
│   ├── claude-plugin/
│   └── templates/               ← AGENTS.md Template, consumer-settings
├── source/                      ← Unkomprimierte Entwicklungsquellen
│   └── augment/                 ← (bisher: .agent-src.uncompressed/)
├── bin/                         ← CLI-Tools
├── scripts/                     ← Installationsskripte
├── tests/                       ← Tests
├── docs/                        ← Dokumentation
├── config/                      ← Profile-Konfiguration
├── Taskfile.yml
├── composer.json
└── README.md
```

**Wichtig:** Kein `.augment/`-Ordner im Repository-Root. Das führt dazu, dass Augment
Code das Repo selbst als Consumer-Projekt interpretiert — was es nicht ist.

### Aufwand: Groß (Breaking Change, erfordert Migrations-Guide)

---

## Problem 6: Keine PHP-Version im composer.json

### Diagnose

```json
{
  "name": "event4u/agent-config",
  "license": "proprietary",
  "bin": ["bin/install.php"]
}
```

Es gibt kein `require`-Feld. Das bedeutet: Packagist und Composer haben keine
Information darüber, welche PHP-Version benötigt wird. Das Paket kann theoretisch
unter PHP 7.0 installiert werden, obwohl `bin/install.php` vermutlich moderne
PHP-Features nutzt.

### Problem in der Praxis

Ein Team mit Legacy-PHP-Projekt könnte `composer require` ausführen, die Installation
läuft durch, aber das PHP-Skript schlägt beim Ausführen fehl. Kein Composer-Fehler
vorab, nur eine Runtime-Exception.

### Lösung

```json
{
  "require": {
    "php": "^8.1"
  }
}
```

Wenn `bin/install.php` PHP 8.2-Features nutzt: `"^8.2"`.

### Aufwand: Trivial (5 Minuten)

---

## Problem 7: Augment-Ordner im Repository-Root sind ein konzeptionelles Problem

### Diagnose

Das Repository enthält `.augment/`, `.agent-src.uncompressed/`, und `.augment-plugin/`
im Root. Wenn Augment Code dieses Repository öffnet (z.B. wenn jemand das Paket
weiterentwickeln will), interpretiert es die `.augment/`-Dateien als
Projekt-Konfiguration des Repositories selbst.

Das ist technisch korrekt (das Paket konfiguriert sich selbst mit seinen eigenen Skills),
aber es vermischt die Rollen "Ich bin das Paket" und "Ich entwickle das Paket".

**Konkretes Problem:**

Ein Contributor, der das Paket weiterentwickelt, öffnet das Repository in Augment Code.
Augment liest `.augment/rules/` — aber diese Rules gelten für Laravel-Projekte.
Das repository selbst ist kein Laravel-Projekt. Der Agent wendet also Laravel-Rules
auf ein Python/Bash/PHP-Tooling-Projekt an.

### Lösung

```
# Option A: Eigene Entwicklungs-Konfiguration für das Paket selbst
.augment-dev/         ← Rules für die Entwicklung des Pakets
                      ← Python, Bash, PHP Tooling — nicht Laravel

# Option B: .augmentignore nutzen (existiert bereits im Repo)
# .augmentignore konfigurieren, dass der Agent weiß:
# "Behandle dieses Repo als Tooling-Projekt, nicht als Consumer"
```

Das `.augmentignore` existiert bereits im Repository. Die Frage ist, ob es diesen
Fall abdeckt.

### Aufwand: Klein bis Mittel

---

## Problem 8: Observability-System ist Over-Engineering für ein junges Paket

### Diagnose

Die Architektur definiert sechs Layer:

1. Governance (Rules, Skills, Guidelines, Commands)
2. Execution (Runtime mit Dispatching)
3. Tool Integration (GitHub, Jira Adapter)
4. Observability (metrics.json, feedback.json, tool-audit.json)
5. Feedback System (Improvement Loop)
6. Lifecycle Management (skill health scoring, deprecation)

Layer 4–6 sind für ein Paket mit 0 externen Nutzern und 1 Contributor premature
optimization in reinster Form.

**Konkret:**

- `metrics.json` — Wer wertet diese aus? Wie? Wo ist der Auswertungs-Workflow dokumentiert?
- `feedback.json` — Wie wird "Feedback" erfasst? Manuell? Wann?
- Lifecycle-States (active → deprecated → superseded) — 93 Skills, alle aktiv, kein
  öffentliches Deprecation-Protokoll. Wann wird das gebraucht?
- Skill health scoring — was ist der Score von Skill X heute?

Keins dieser Features ist in der externen Dokumentation mit einem echten Workflow
verknüpft. Sie existieren in der Architektur-Dokumentation, aber nicht in der
Nutzungsdokumentation.

### Risiko

Dieses Komplexitätsniveau erhöht die Wartungslast erheblich. Jeder neue Contributor
muss sechs Layer verstehen, bevor er einen einzelnen Skill bearbeiten kann.

### Empfehlung

Für eine v2.0 oder wenn externe Nutzer kommen: Layer 4–6 in einem separaten,
opt-in Dokument beschreiben. In der Haupt-Dokumentation sollte stehen:

> "Das System kann optional Metriken, Feedback und Lifecycle-Daten erfassen.
> Standardmäßig passiert nichts davon. Dokumentation: docs/observability.md"

Aktuell sind diese Layer in der Hauptarchitektur-Dokumentation gleichwertig
mit den Kern-Layern dargestellt. Das ist misleading.

### Aufwand: Klein (Dokumentations-Refactoring, keine Code-Änderungen)

---

## Status-Tracking

| Problem | Status | Branch |
|---------|--------|--------|
| Installer canonical klären | ✅ Erledigt (docs/installation.md Canonical-Box, Wrapper-Hinweise) | `feat/improve-agent-setup-2` |
| Repository-Struktur aufräumen | ✅ Erledigt — `.gitattributes export-ignore` + npm `files` whitelist; `composer archive` 1221→433 Dateien, `npm pack` 313 Dateien | `feat/improve-agent-setup-2` |
| PHP-Version in composer.json | ✅ Erledigt — `require.php: >=8.0` ist gesetzt. Tighter constraint (`^8.1`/`^8.2`) nur nötig, wenn `bin/install.php` neuere Features nutzt; aktuell nicht der Fall. | `feat/improve-agent-setup-2` |
| Augment-Root-Konflikt lösen | ✅ Erledigt — `.augmentignore` schließt `.agent-src.uncompressed/` und Tool-Mirrors aus | `feat/improve-agent-setup-2` |
| Observability-Doku vereinfachen | ✅ Erledigt — Layer 4–6 in `docs/observability.md` ausgelagert, `docs/architecture.md` verweist nur noch mit Opt-in-Hinweis | `feat/improve-agent-setup-2` |
