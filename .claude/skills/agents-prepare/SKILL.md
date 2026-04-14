---
name: agents-prepare
description: "agents-prepare"
disable-model-invocation: true
---

# agents-prepare

## Instructions

### 1. Check project root (composer.json, artisan, package.json)

### 2. Create directory structure (`.gitkeep` in empty dirs only)

```
agents/
├── roadmaps/
│   └── .gitkeep
├── features/
│   └── .gitkeep
└── contexts/
    └── .gitkeep
```

Also:

```
.augment/guidelines/
└── php/
    └── .gitkeep
```

### 3. Module support

`app/Modules/` exists → per module:

```
app/Modules/{Module}/agents/
├── roadmaps/
│   └── .gitkeep
├── features/
│   └── .gitkeep
├── contexts/
│   └── .gitkeep
```

### 4. Verify templates

```
.augment/templates/
├── features.md    # Feature plan template
├── roadmaps.md    # Roadmap template
└── contexts.md    # Context document template
```

Missing → warn:

```
⚠️  Missing templates in .augment/templates/:
  - {missing-file}

These templates are required by the Feature/Roadmap commands.
```

### 5. Clean up old templates

```
agents/features/template.md
agents/roadmaps/template.md
app/Modules/*/agents/roadmaps/template.md
app/Modules/*/agents/features/template.md
```

Found →

```
ℹ️  Old template files found (now in .augment/templates/):

  - agents/features/template.md
  - agents/roadmaps/template.md

Delete these? (y/n)
```

### 6. Summary

```
═══════════════════════════════════════════════
  ✅  AGENTS-VERZEICHNIS VORBEREITET
═══════════════════════════════════════════════

📁 Projekt-Root:
  agents/roadmaps/     {✅ existiert | 🆕 erstellt}
  agents/features/     {✅ existiert | 🆕 erstellt}
  .augment/guidelines/ {✅ existiert | 🆕 erstellt}

📁 Templates:
  .augment/templates/features.md   {✅ | ⚠️ fehlt}
  .augment/templates/roadmaps.md   {✅ | ⚠️ fehlt}

{If modules exist:}
📁 Module:
  {Module}/agents/roadmaps/   {✅ | 🆕}
  {Module}/agents/features/   {✅ | 🆕}
  ...

{If old templates were cleaned up:}
🗑️  Old templates removed: {count}

═══════════════════════════════════════════════
```

### Rules

- No commit/push. No overwrite. No `.gitkeep` in non-empty dirs. Ask before delete.
