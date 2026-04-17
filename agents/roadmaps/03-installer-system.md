# Roadmap 03 — Installer-System (P1)

> **Priorität:** 🟠 P1 — Direkter Einfluss auf Developer Experience und Sicherheit  
> **Aufwand:** Mittel  
> **Abhängigkeiten:** 02-architecture-issues.md (Problem 4 — Installer canonical)

---

## Problem 9: Postinstall-Hook ohne Opt-in ist ein Sicherheitsrisiko

### Diagnose

Laut `docs/installation.md`:
> "The `postinstall` hook runs `scripts/install.sh` automatically via `setup.sh`."

Das bedeutet: sobald ein Entwickler `composer require event4u/agent-config` ausführt,
läuft automatisch ein Shell-Skript, das Dateien und Symlinks im Projekt anlegt.

**Warum das ein Problem ist:**

1. **Supply-Chain-Angriffsfläche:** npm und Composer `postinstall`-Hooks sind ein
   bekannter Angriffsvektor (vgl. event-stream-Skandal 2018, colors.js 2022). Viele
   Security-bewusste Teams deaktivieren automatische postinstall-Hooks explizit
   (`composer config allow-plugins false` oder `npm config set ignore-scripts true`).
   Für diese Teams funktioniert die Installation still falsch — kein Fehler, keine
   Warnung, aber kein Setup.

2. **Kein Consent:** Der Nutzer hat nicht zugestimmt, dass Dateien in seinem Projekt
   angelegt werden. `composer require` bedeutet "füge diese Abhängigkeit hinzu",
   nicht "ändere mein Projekt".

3. **Nicht idempotent dokumentiert:** Was passiert, wenn der Hook zweimal läuft?
   Was wenn er mit `--no-scripts` übersprungen wird und der Nutzer danach manuell
   installiert?

### Was andere Pakete besser machen

Laravel selbst (Installer): `composer create-project laravel/laravel myapp`
Spatie Packages: Expliziter Publish-Step: `php artisan vendor:publish`
Livewire: `php artisan livewire:publish`

Das Muster ist klar: **Composer installiert das Paket, der Nutzer entscheidet
explizit, was in sein Projekt kopiert wird.**

### Lösungsvorschlag

```bash
# Statt automatischem Postinstall-Hook:

# 1. Nur eine Hinweis-Nachricht ausgeben
composer require --dev event4u/agent-config
# → Ausgabe: "Run 'php vendor/bin/install.php' to set up agent configuration."

# 2. Expliziter Setup-Schritt
php vendor/bin/install.php
# → Fragt interaktiv: "Install agent configuration for this project? [Y/n]"
# → Zeigt mit --dry-run was passieren würde

# 3. Für Teams die Automation wollen: Flag
php vendor/bin/install.php --yes  # Kein Prompt, sofort installieren
```

**composer.json Anpassung:**

```json
{
  "scripts": {
    "post-install-cmd": [
      "php -r \"echo '\\n⚡ agent-config installed. Run: php vendor/bin/install.php\\n';\""
    ],
    "post-update-cmd": [
      "php -r \"echo '\\n⚡ agent-config updated. Run: php vendor/bin/install.php --update\\n';\""
    ]
  }
}
```

### Aufwand: Klein (Behavioral change, aber einfach)

---

## Problem 10: Kein Uninstall/Cleanup-Prozess

### Diagnose

Es gibt keinen dokumentierten Weg, das Paket zu deinstallieren. Was passiert bei
`composer remove event4u/agent-config`?

Die Antwort ist: der Composer-Paket-Code wird entfernt, aber alle installierten
Dateien und Symlinks bleiben im Projekt zurück:

```
.augment/rules/       ← Bleiben (echte Kopien)
.augment/skills/      ← Bleiben (Symlinks → vendor/... → broken nach remove)
.claude/rules/        ← Bleiben (Symlinks → .augment/rules/ → existiert noch)
.claude/skills/       ← Bleiben (Symlinks → .augment/skills/ → broken)
.cursor/rules/        ← Bleiben (broken Symlinks)
.clinerules/          ← Bleiben (broken Symlinks)
.windsurfrules        ← Bleibt (generierte Datei)
AGENTS.md             ← Bleibt
.agent-settings       ← Bleibt
.github/copilot-instructions.md ← Bleibt
```

Nach `composer remove` hat das Projekt broken Symlinks und fremde Konfigurationsdateien.
Das ist ein ernstes Problem für Teams, die das Paket evaluieren und dann gegen eine
Alternative tauschen wollen.

### Lösungsvorschlag

```bash
# Uninstall-Befehl
php vendor/bin/install.php --uninstall

# Was er tun sollte:
# 1. Alle Symlinks entfernen die von diesem Paket angelegt wurden
# 2. Alle generierten Dateien entfernen (.windsurfrules, copilot-instructions.md)
# 3. .agent-settings entfernen (oder Backup anbieten)
# 4. AGENTS.md NICHT entfernen (könnte angepasst worden sein)
# 5. .augment/rules/ Kopien entfernen (waren vorher nicht da)
# 6. Leere Verzeichnisse aufräumen

# Output:
# ✓ Removed .augment/skills/ (symlink)
# ✓ Removed .claude/ (symlinks + directory)
# ✓ Removed .cursor/rules/ (symlinks)
# ✓ Removed .windsurfrules (generated)
# ✓ Removed .agent-settings
# ⚠ AGENTS.md kept (may have been customized — remove manually if needed)
# ✓ Cleanup complete
```

**Tracking-Datei für sicheres Uninstall:**

Das Installskript sollte eine Manifest-Datei anlegen:

```json
// .agent-config-manifest.json (nicht committe)
{
  "version": "1.3.3",
  "installed": "2026-04-17T10:00:00Z",
  "created": [
    ".augment/skills",
    ".augment/commands",
    ".claude/rules",
    ".claude/skills",
    ".cursor/rules",
    ".clinerules",
    ".windsurfrules",
    ".github/copilot-instructions.md",
    ".agent-settings"
  ],
  "copied": [
    ".augment/rules"
  ]
}
```

Diese Datei ins `.gitignore` (lokal, nicht committe) und beim Uninstall nutzen.

### Aufwand: Mittel (2–3 Tage Implementierung)

---

## Problem 11: Windows-Kompatibilität nicht adressiert

### Diagnose

Das gesamte Installationssystem basiert auf:
- Bash-Skripten (`scripts/install.sh`)
- Unix-Symlinks (`ln -s`)

Beides funktioniert nicht oder eingeschränkt auf Windows ohne zusätzliche Setup-Schritte:

- **Bash:** nur via Git Bash, WSL oder Cygwin verfügbar
- **Symlinks:** auf Windows erfordern Entwicklermodus (ab Windows 10) oder
  Admin-Rechte. Ohne diese: stille Fehler oder Fallback auf Junction Points
  (die anders funktionieren als Unix-Symlinks)

Die Dokumentation erwähnt Windows nirgends. Weder als "nicht unterstützt" noch
als "so funktioniert es".

**Betroffene Teams:**

- Windows-Entwickler ohne WSL
- CI/CD auf Windows (GitHub Actions Windows runners)
- Teams mit gemischten Betriebssystemen

### Lösungsvorschläge

**Option A: Windows explizit ausschließen (ehrlicher Short-Term-Fix)**

```markdown
## Requirements

- Bash (macOS, Linux, or Windows with WSL/Git Bash)
- Unix-compatible symlinks (not supported on native Windows without Developer Mode)

→ Windows users: use WSL2 for best results.
```

**Option B: Windows-Fallback implementieren (korrekte Long-Term-Lösung)**

```bash
# In install.sh:
create_symlink() {
    local source="$1"
    local target="$2"
    
    if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" ]]; then
        # Windows: use copy instead of symlink
        cp -r "$source" "$target"
        echo "  (Windows: copied instead of symlinked — manual sync needed on updates)"
    else
        ln -sfn "$source" "$target"
    fi
}
```

**Option C: PHP-only Installer ohne Bash-Abhängigkeit (ideal)**

Wenn `bin/install.php` der canonical Installer werden soll: die gesamte Logik
in PHP implementieren, keine Bash-Abhängigkeit. PHP's `symlink()` funktioniert
auf Windows im Developer Mode, und `copy()` als Fallback ist trivial.

### Aufwand: Klein (Option A) bis Mittel (Option B/C)

---

## Problem 12: Update-Verhalten nach `composer update` ist unklar

### Diagnose

Was passiert, wenn eine neue Version veröffentlicht wird und ein Team
`composer update event4u/agent-config` ausführt?

- Werden bestehende Symlinks aktualisiert? (Ja, wenn sie auf den vendor-Ordner zeigen)
- Werden bestehende Kopien (`.augment/rules/`) aktualisiert? (Unklar — gibt es einen postupdate-Hook?)
- Wird `.windsurfrules` neu generiert? (Unklar)
- Was passiert mit angepassten Overrides in `agents/overrides/`? (Hoffentlich unberührt)

Keiner dieser Fälle ist in der Dokumentation beschrieben. Wenn ein Team update-unfähig
ist, wird das Paket nach der ersten Installation nicht mehr aktualisiert.

### Lösungsvorschlag

**Expliziter Update-Schritt dokumentieren:**

```markdown
## Updating

After `composer update event4u/agent-config` or `npm update @event4u/agent-config`:

```bash
php vendor/bin/install.php --update
```

This will:
- Refresh symlinks (usually no-op, they auto-point to new vendor version)
- Re-generate .windsurfrules (concatenated from updated rules)
- Re-generate .github/copilot-instructions.md
- NOT overwrite your AGENTS.md (project-specific)
- NOT overwrite files in agents/overrides/ (project-specific)
```

**Im Installer:**

```bash
if [ "$MODE" = "update" ]; then
    echo "Updating agent-config..."
    # Regenerate only derived/generated files
    # Skip files that may have been customized
fi
```

### Aufwand: Klein (Dokumentation) bis Mittel (Implementierung)

---

## Problem 13: `.agent-settings` Default-Werte sind Galawork-spezifisch

### Diagnose

Laut `docs/customization.md` sind die Default-Werte:

```
ide: cursor        ← Kein universeller Default
language: de       ← Deutsch als Default — nicht für internationale Teams
```

Wenn `install.php` eine `.agent-settings`-Datei mit diesen Defaults anlegt, bekommen
nicht-deutsche Teams eine deutsche Agent-Sprache. Teams, die PhpStorm oder VS Code
nutzen, bekommen `ide: cursor`.

Das zeigt: das Paket wurde für den Autor selbst designed, nicht für externe Teams.
`language: de` und `ide: cursor` sind die persönlichen Präferenzen des Autors,
keine universellen Defaults.

### Lösungsvorschlag

**Installer fragt interaktiv:**

```bash
php vendor/bin/install.php

Setting up agent-config...

Which IDE do you primarily use?
  1) Cursor (default)
  2) VS Code
  3) PhpStorm
  4) Other

> 

What language should the agent use for responses?
  1) English (recommended for international teams)
  2) German (de)
  3) Other (configure manually in .agent-settings)

> 
```

**Oder: `.agent-settings.example` ohne spezifische Defaults:**

```
# .agent-settings
# Configure agent behavior for this project.
# See: https://github.com/event4u-app/agent-config/blob/main/docs/customization.md

# ide: cursor           # cursor, code, phpstorm
# language: en          # en, de, ...
# cost_profile: cheap   # cheap, balanced, full
# minimal_output: true
```

Der Installer erstellt `.agent-settings.example` (committe) und `.agent-settings`
aus der Vorlage, aber ohne opinionated Defaults.

### Aufwand: Klein

---

## Status-Tracking

| Problem | Status | Branch |
|---------|--------|--------|
| Postinstall-Hook Opt-in | ⬜ Offen | — |
| Uninstall-Prozess implementieren | ⬜ Offen | — |
| Windows-Kompatibilität dokumentieren | ⬜ Offen | — |
| Update-Verhalten dokumentieren | ⬜ Offen | — |
| agent-settings Defaults überarbeiten | ⬜ Offen | — |
