---
name: module-create
skills: [laravel]
description: Create a new module from .module-template with interactive setup
disable-model-invocation: true
---

# module-create

## Instructions

### 1. Check for module support

- Check if `app/Modules/` exists.
- If not:
  ```
  ⚠️  No module system found (no app/Modules/ directory).
  Should I set up the module structure? (y/n)
  ```
  If yes → create `app/Modules/` and check if `ModuleServiceProvider` is registered.
  If no → stop.

### 2. Check for template

- Check if `app/Modules/.module-template/` exists.
- If not:
  ```
  ⚠️  No module template found (.module-template/).
  I'll create the module manually based on the standard structure.
  ```

### 3. Ask for module details

```
📦 Create new module

1. Module name (PascalCase, e.g. UserProfile, Reporting):
```

Wait for name. Validate:
- Must be PascalCase
- Must not already exist in `app/Modules/`
- Must not contain special characters

Then ask:

```
2. Route-Prefix (kebab-case, z.B. user-profile, reporting):
   Suggestion: {auto-generated-from-name}

3. Short description (one sentence):

4. Which route files should be created?
   [x] API Routes (Routes/api.php)
   [ ] Web Routes (Routes/web.php)
   [x] Console Routes (Routes/console.php)
```

### 4. Create the module

Copy `.module-template/` to `app/Modules/{ModuleName}/`:

1. Copy all files and directories.
2. Replace placeholders in all files:
   - `[MODULE_NAME]` → `{ModuleName}`
   - `[module-prefix]` → `{route-prefix}`
3. Update `README.md` with the module description.
4. Remove unchecked route files.
5. Create agent directories:
   ```
   app/Modules/{ModuleName}/agents/
   ├── features/.gitkeep
   ├── roadmaps/.gitkeep
   └── contexts/.gitkeep
   ```

### 5. Verify namespace

Check that PSR-4 autoloading is configured for the new module:

```php
// composer.json → autoload → psr-4
"App\\Modules\\{ModuleName}\\": "app/Modules/{ModuleName}/"
```

If not configured, warn:
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

### 7. Offer context and feature creation

```
What would you like to do next?

1. 📄 Create module context → /context-create (documents structure & purpose)
2. 📋 Plan first feature → /feature-plan (Module: {ModuleName})
3. ✅ Done for now — continue later
```

- **Option 1:** Transition to `/context-create` with the module pre-selected.
- **Option 2:** Transition to `/feature-plan` with the module pre-selected.
- **Option 3:** Remind about `composer dump-autoload` if needed, then stop.

### Rules

- **Do NOT commit or push.**
- **Do NOT modify existing modules.**
- **Do NOT run `composer dump-autoload`** — only suggest it.
- **Always use PascalCase** for module names.
- **Always create agent directories** with `.gitkeep`.
