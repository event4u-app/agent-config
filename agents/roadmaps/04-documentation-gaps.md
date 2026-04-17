# Roadmap 04 — Dokumentationslücken (P2)

> **Priorität:** 🟡 P2 — Beeinflusst Adoption und Vertrauensbildung  
> **Aufwand:** Klein bis Mittel  
> **Abhängigkeiten:** Keine (reine Dokumentationsarbeit)

---

## Problem 14: Kein CHANGELOG

### Diagnose

Das Repository hat 14 veröffentlichte Releases (v1.0.0 bis v1.3.3). Es gibt keine
`CHANGELOG.md` und keine Release-Notes in der Dokumentation.

Was hat sich von v1.0.0 zu v1.3.3 geändert? Niemand weiß es, außer dem Autor.

**Was das für Teams bedeutet:**

- Kein Weg zu evaluieren, ob ein Update sicher ist
- Kein Weg, Breaking Changes vorauszusehen
- Kein Weg, Bugfixes zu tracken
- `composer outdated` zeigt "1.3.3 available" — aber niemand weiß, ob sich ein Update lohnt

### Keep a Changelog Format (Empfehlung)

```markdown
# Changelog

All notable changes to agent-config are documented here.
Format: https://keepachangelog.com/

## [1.3.3] — 2026-04-17

### Added
- ...

### Changed
- ...

### Fixed
- ...

### Removed
- ...

## [1.3.0] — 2026-04-10

### Added
- GitHub Copilot support via .github/copilot-instructions.md
- ...

### Breaking Changes
- install.sh replaced by install.php as primary installer
  Migration: run `php vendor/bin/install.php` after update

## [1.0.0] — 2026-03-XX

Initial release.
```

**Nachträgliche CHANGELOG-Erstellung:**

Der Commit-History hat 235 Commits. Mit konventionellen Commit-Messages (die das
Paket selbst empfiehlt) sollte ein rudimentäres CHANGELOG via `git log` rekonstruierbar
sein:

```bash
git log --oneline --no-merges v1.0.0..v1.3.3
```

### Aufwand: Mittel (einmalig, danach Routine)

---

## Problem 15: README-Behauptungen stimmen nicht mit Realität überein

### Diagnose

**Behauptung 1 im README:**
> "Works with Augment Code, Claude Code, Cursor, Cline, Windsurf, and Gemini CLI"

**Realität:**
Cursor, Cline, Windsurf und Gemini CLI bekommen ausschließlich Rules. 93 Skills und
51 Commands sind nicht verfügbar. (Bereits in Roadmap 01 beschrieben — diese Issue
ist der Dokumentationsaspekt davon.)

**Behauptung 2: Support-Tabelle im README**

```
| Augment VSCode/IntelliJ | ✅ | ✅ | ✅ |
| Claude Code             | ✅ | ✅ | ✅ |
| Cursor                  | ✅ | — | ☑️ |
```

Das `☑️` für Commands bei Cursor wird erklärt als "via documentation (AGENTS.md)".
Das bedeutet: der Agent liest eine Textdatei, in der Commands aufgelistet sind.
Er kann sie nicht nativ ausführen. Das ist fundamentaler Unterschied zu Augment/Claude Code,
wo Commands echte Slash-Commands sind.

Ein Nutzer, der die Tabelle liest, denkt: "Cursor bekommt fast alles, nur Skills fehlen."
Die Realität ist: "Cursor bekommt Rules und einen Hinweis-Text."

**Behauptung 3:** "No Task, no Make, no build tools required"

Das stimmt für die Installation. Für die Entwicklung des Pakets ist Task zwingend
erforderlich (`task ci`, `task sync`, `task compress`). Das sollte klarer getrennt
werden: "für Consumer: kein Build-Tool nötig" vs. "für Contributors: Task erforderlich".

**Behauptung 4:** Die "How it works"-Tabelle im README

```
| Without agent-config       | With agent-config              |
|----------------------------|-------------------------------|
| Agent guesses and edits    | Analyzes code before changing |
| Inconsistent code style    | Follows PHP/Laravel standards |
```

Diese Tabelle ist Marketingtext ohne Evidenz. Es gibt keine Tests, keine Messungen,
keine Benchmarks, die zeigen, dass das Paket diese Verhaltensänderungen erzeugt.
Das ist nicht per se falsch — es ist eine legitime Behauptung — aber sie sollte
als Behauptung kenntlich sein, nicht als Fakt.

### Lösungsvorschlag

Alle drei Probleme erfordern präzisere Sprache:

- Tool-Support-Tabelle: klarer zwischen "native" und "via text reference" unterscheiden
- "No build tools required" → "No build tools required for installation (Task required for development)"
- How it works-Tabelle: "Designed to help your agent..." statt faktischer Formulierung

### Aufwand: Klein (30–60 Minuten)

---

## Problem 16: Kein CONTRIBUTING.md

### Diagnose

Es gibt keinen Hinweis darauf, ob externe Contributions willkommen sind, und wenn ja,
wie. Bei proprietärer Lizenz wäre "no external contributions" eine valide Antwort —
aber sie muss irgendwo stehen.

**Warum das wichtig ist:**

Wenn jemand einen Bug findet und einen PR öffnen will, weiß er nicht:
- Werden PRs reviewed?
- Welche Coding-Standards gelten für das Paket selbst?
- Wie werden Skill-Verbesserungen eingereicht?
- Was ist der Branch-Workflow?

### Minimales CONTRIBUTING.md

```markdown
# Contributing

## Status

This package is currently maintained by a single author.

External contributions are [welcome / not accepted at this time].

## If contributions are accepted:

1. Open an issue first to discuss the change
2. Fork the repository
3. Create a feature branch: `git checkout -b feat/your-feature`
4. Run CI before submitting: `task ci`
5. Submit a PR with a clear description

## Editing Skills

Skills live in `.augment.uncompressed/skills/`. Edit there, then:
```bash
task compress   # Compress to .augment/
task ci         # Verify everything passes
```

## License

Note: By contributing, you agree that your contributions will be
licensed under the same [license] as the project.
```

### Aufwand: Trivial (1 Stunde)

---

## Problem 17: "Getting Started" beschreibt Erfolg, aber nicht Misserfolg

### Diagnose

`docs/getting-started.md` beschreibt das Happy Path. Es gibt keine Troubleshooting-Sektion.

**Was fehlt:**

- Was wenn `scripts/install.sh` Fehler wirft?
- Was wenn Symlinks nicht funktionieren?
- Wie testet man, ob die Installation korrekt war?
- Warum "sieht" mein Agent die Skills nicht?
- Was ist der Unterschied zwischen plugin-installed und project-installed, wenn beides aktiv ist?

**Das "3 Prompts" Test-Setup ist gut, aber unvollständig:**

```markdown
1. "Refactor this function" → watch: agent analyzes first
2. "Add caching to this" → watch: agent asks instead of guessing
3. "Implement this feature" → watch: agent respects your existing codebase
```

Wenn das Verhalten nicht eintritt: was dann? Kein Troubleshooting-Hinweis.

### Lösungsvorschlag: `docs/troubleshooting.md`

```markdown
# Troubleshooting

## Agent doesn't seem to behave differently after install

**Check 1: Are the files actually there?**
```bash
ls -la .claude/rules/     # Should show symlinks
ls -la .augment/skills/   # Should show symlinks or files
```

**Check 2: Does your agent read these directories?**
- Claude Code: reads `.claude/CLAUDE.md` and `.claude/skills/` automatically
- Augment: reads `.augment/` automatically
- Cursor: reads `.cursor/rules/*.mdc` — check if files are there

**Check 3: Run the installer again**
```bash
php vendor/bin/install.php --dry-run   # See what would happen
php vendor/bin/install.php --verbose   # See what's actually happening
```

## Broken symlinks after `composer update`

Run the installer after every update:
```bash
php vendor/bin/install.php --update
```

## Installation fails on Windows

Native Windows is not fully supported. Use WSL2:
```bash
wsl --install
# then work inside WSL
```
```

### Aufwand: Mittel (halber Tag)

---

## Problem 18: Portability-Check hat eine Lücke

### Diagnose

Der CI-Step "Portability check — No project-specific paths in shared files" prüft
Dateien in `.augment/`. Die `AGENTS.md` im Root liegt außerhalb dieses Checks.

Wie in Roadmap 01 beschrieben, enthält `AGENTS.md` Galawork-spezifische Inhalte.
Der Portability-Check hätte das erkennen müssen — er hat es nicht.

### Lösungsvorschlag

```python
# In scripts/skill_linter.py oder einem separaten check-portability.py:

PROHIBITED_STRINGS = [
    "Galawork", "galawork",
    "landscaping",
    "make start", "make console",  # Projekt-spezifische Makefile-Targets
    # Füge hier weitere projektspezifische Strings hinzu
]

FILES_TO_CHECK = [
    "AGENTS.md",
    "CLAUDE.md",
    "GEMINI.md",
    ".windsurfrules",
    ".github/copilot-instructions.md",
    # Alle Root-Dateien die in Consumer-Projekte kopiert werden
]

def check_portability(file_path, prohibited):
    with open(file_path) as f:
        content = f.read()
    violations = [s for s in prohibited if s in content]
    if violations:
        print(f"FAIL: {file_path} contains project-specific strings: {violations}")
        return False
    return True
```

### Aufwand: Klein

---

## Problem 19: Keine Versionierungs-Strategie dokumentiert

### Diagnose

15 Releases in kurzer Zeit. Kein Dokument erklärt das Versioning-Schema.
Ist das Semantic Versioning? Wenn ja: was ist ein major, minor, patch?

Für ein Paket, das Rules und Skills liefert (keine API im klassischen Sinne), ist
SemVer nicht offensichtlich anwendbar. Was wäre ein "breaking change"?

- Ein neuer Skill: patch oder minor?
- Eine geänderte Rule, die das Agent-Verhalten ändert: minor oder major?
- Eine geänderte install.sh, die andere Dateien anlegt: major (breaking)?

Ohne diese Definition hat Semantic Versioning keinen Wert für Consumer.

### Lösungsvorschlag

```markdown
# In CHANGELOG.md oder docs/development.md:

## Versioning Policy

This package follows Semantic Versioning (semver.org).

### Major version (X.0.0)
- Breaking changes to the installer (files created/removed change)
- Breaking changes to the .agent-settings format
- Removal of skills or rules that teams may depend on

### Minor version (x.X.0)
- New skills, rules, or commands added
- New tool support added
- Non-breaking changes to existing skills

### Patch version (x.x.X)
- Fixes to existing skills (improved instructions, better wording)
- Documentation updates
- CI/tooling fixes
```

### Aufwand: Trivial

---

## Status-Tracking

| Problem | Status | Branch |
|---------|--------|--------|
| CHANGELOG erstellen | ✅ Erledigt (`CHANGELOG.md`, 14 Releases) | `feat/improve-agent-setup-2` |
| README-Behauptungen korrigieren | ✅ Erledigt (Tool-Support-Legende, Requirements, "What your agent is asked to do") | `feat/improve-agent-setup-2` |
| CONTRIBUTING.md erstellen | ✅ Erledigt (`CONTRIBUTING.md` inkl. SemVer-Policy) | `feat/improve-agent-setup-2` |
| Troubleshooting-Doku erstellen | ✅ Erledigt (`docs/troubleshooting.md`) | `feat/improve-agent-setup-2` |
| Portability-Check erweitern | ✅ Erledigt (Root-Dateien + Identifier-Blocklist, galawork hardcoding entfernt) | `feat/improve-agent-setup` + `feat/improve-agent-setup-2` |
| Versioning-Strategie dokumentieren | ✅ Erledigt (CONTRIBUTING.md Versioning-Policy-Abschnitt) | `feat/improve-agent-setup-2` |
