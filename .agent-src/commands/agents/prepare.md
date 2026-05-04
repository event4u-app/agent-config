---
name: agents:prepare
cluster: agents
sub: prepare
skills: [agent-docs-writing]
description: Scaffold the agents/ directory structure with all required subdirectories and .gitkeep files
disable-model-invocation: true
suggestion:
  eligible: false
  rationale: "One-shot project scaffolding; only run during initial setup."
---

# /agents prepare
## Instructions

### 1. Check project root

Verify you're in the project root (look for `composer.json`, `artisan`, or `package.json`).

### 2. Create directory structure

Create the following directories if they don't exist, with a `.gitkeep` in each **empty** directory:

```
agents/
├── roadmaps/
│   └── .gitkeep
├── features/
│   └── .gitkeep
└── contexts/
    └── .gitkeep
```

Also create the guidelines directory in `.augment/` if it doesn't exist:

```
.augment/guidelines/
└── php/
    └── .gitkeep
```

**Rules:**
- Only add `.gitkeep` to directories that have **no other files** in them.
- Do NOT overwrite existing files.
- Do NOT create directories that already exist with content.

### 3. Check for module support

Check if the project has a module system (`app/Modules/` directory):

- If `app/Modules/` exists → list all modules.
- For each module, create the agent directories if they don't exist:

```
app/Modules/{Module}/agents/
├── roadmaps/
│   └── .gitkeep
├── features/
│   └── .gitkeep
├── contexts/
│   └── .gitkeep
```

### 4. Verify templates exist

Check that `.augment/templates/` contains the required templates:

```
.augment/templates/
├── features.md    # Feature plan template
├── roadmaps.md    # Roadmap template
└── contexts.md    # Context document template
```

If any template is missing, warn:

```
⚠️  Missing templates in .augment/templates/:
  - {missing-file}

These templates are required by the Feature/Roadmap commands.
```

### 5. Clean up old templates

Check for **old template files** in the agents directories and offer to remove them:

```
agents/features/template.md
agents/roadmaps/template.md
app/Modules/*/agents/roadmaps/template.md
app/Modules/*/agents/features/template.md
```

If any are found:

```
ℹ️  Old template files found (now in .augment/templates/):

  - agents/features/template.md
  - agents/roadmaps/template.md

Delete these? (y/n)
```

If yes → delete them.

### 6. Show summary

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

- **Do NOT commit or push.**
- **Do NOT overwrite existing files.**
- **Do NOT create `.gitkeep` in directories that already have files.**
- **Always ask before deleting** old template files.
