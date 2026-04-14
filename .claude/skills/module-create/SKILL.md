---
name: module-create
description: "Create a new Laravel module from template"
disable-model-invocation: true
---

# module-create

## Instructions

### 1. Check modules + template

`app/Modules/` not found → ask to create. `.module-template/` not found → create manually.

### 3. Ask for module details

```
📦 Create new module

1. Module name (PascalCase, e.g. UserProfile, Reporting):
```

Validate: PascalCase, unique, no special chars. Then ask:

```
2. Route-Prefix (kebab-case, z.B. user-profile, reporting):
   Suggestion: {auto-generated-from-name}

3. Short description (one sentence):

4. Which route files should be created?
   [x] API Routes (Routes/api.php)
   [ ] Web Routes (Routes/web.php)
   [x] Console Routes (Routes/console.php)
```

### 4. Create

Copy `.module-template/` → replace `[MODULE_NAME]`/`[module-prefix]` → update README → remove unchecked routes → create agent dirs:
   ```
   app/Modules/{ModuleName}/agents/
   ├── features/.gitkeep
   ├── roadmaps/.gitkeep
   └── contexts/.gitkeep
   ```

### 5. Verify PSR-4 namespace. If not configured:
```
⚠️  PSR-4 autoloading not configured for App\Modules\{ModuleName}.
Please run `composer dump-autoload` or check if a wildcard mapping exists.
```

### 6. Show result

```
═══════════════════════════════════════════════
  ✅  MODULE CREATED: {ModuleName}
═══════════════════════════════════════════════

📁 app/Modules/{ModuleName}/
  App/                ✅
  Routes/             ✅  (api.php, console.php)
  Tests/              ✅  (Component/, Integration/, Unit/)
  agents/             ✅  (features/, roadmaps/, contexts/)
  README.md           ✅

🔗 Namespace: App\Modules\{ModuleName}\App\
🌐 Route-Prefix: /api/v1/{route-prefix}

═══════════════════════════════════════════════
```

### 7. Next: `1. /context-create` / `2. /feature-plan` / `3. Done`

### Rules

- No commit/push. No existing modules. Suggest (don't run) `composer dump-autoload`. PascalCase. Agent dirs with `.gitkeep`.
