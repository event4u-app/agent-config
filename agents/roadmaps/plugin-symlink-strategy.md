# Roadmap: Plugin Symlink Strategy — copy rules, symlink everything else

> **⚠️ SUPERSEDED** by `agents/roadmaps/shell-based-installer.md`
> The PHP Composer Plugin has been replaced by a portable shell script (`scripts/install.sh`).
> This roadmap is kept for historical reference only.

> Refactor `AgentConfigPlugin` to use file-level symlinks for all `.augment/` content except rules, which must be real copies because Augment cannot load symlinked rules.

## Prerequisites

- [x] Read `src/AgentConfigPlugin.php` — current `syncDirectory()` copies everything
- [x] Read `composer.json` — `archive.exclude` and plugin class definition
- [x] Understand vendor-dir: `vendor/event4u/agent-config/.augment/` is the source

## Context

Currently `AgentConfigPlugin::syncDirectory()` copies **all 204 files** from the package
`.augment/` into the target project's `.augment/`. This creates full duplicates.

**Problem:** Augment Code cannot follow symlinks for **rules** — they must be real files.
All other content (skills, commands, guidelines, templates, contexts, scripts) works fine
as symlinks.

**Solution:** Hybrid approach — copy rules, symlink everything else at file level.

- **Feature:** `agents/features/multi-agent-compatibility.md`
- **Jira:** none

## File strategy

| Directory | Count | Strategy | Reason |
|---|---|---|---|
| `.augment/rules/*.md` | 24 | **Copy** (real files) | Augment can't load symlinked rules |
| `.augment/skills/**` | 99 | **Symlink** per file | Largest dir, biggest savings |
| `.augment/commands/**` | 46 | **Symlink** per file | No Augment limitation |
| `.augment/guidelines/**` | 18 | **Symlink** per file | No Augment limitation |
| `.augment/templates/**` | 10 | **Symlink** per file | No Augment limitation |
| `.augment/contexts/**` | 5 | **Symlink** per file | No Augment limitation |
| `.augment/scripts/**` | 1 | **Symlink** per file | No Augment limitation |
| `.augment/README.md` | 1 | **Symlink** | No Augment limitation |

**Result:** 24 copies + 180 symlinks instead of 204 copies.

---

## Phase 1: Refactor `syncDirectory()` into hybrid sync

### Step 1.1: Add `COPY_DIRS` constant

In `AgentConfigPlugin.php`, define which subdirectories must be copied:

```php
/** Subdirectories where files must be real copies (not symlinks). */
private const COPY_DIRS = ['rules'];
```

Everything NOT in this list gets symlinked.

- [x] Add `COPY_DIRS` constant to `AgentConfigPlugin`

### Step 1.2: Create `syncHybrid()` method

New method replacing `syncDirectory()` for `.augment/`:

```php
private function syncHybrid(string $packageAugment, string $projectAugment, string $vendorDir): void
```

Logic:
1. Ensure `$projectAugment` directory exists
2. Collect manifest of all source files (reuse `collectFiles()`)
3. For each source file:
   a. Determine relative path (e.g. `rules/php-coding.md`, `skills/coder/SKILL.md`)
   b. Check if first path segment is in `COPY_DIRS`
   c. If yes → **copy** file (same as current behavior)
   d. If no → **create relative symlink** from project to vendor
4. Clean stale files/symlinks in project that don't exist in source
5. Remove empty directories

- [x] Implement `syncHybrid()` method
- [x] Implement `shouldCopy(string $relativePath): bool` helper
- [x] Implement `createFileSymlink(string $source, string $link): bool` helper
- [x] Implement `cleanStaleEntries()` — handles both files AND symlinks

### Step 1.3: Implement relative symlink calculation

The symlink target must be a **relative path** from the link location to the vendor file:

```
Project structure:
  project/
    .augment/skills/coder/SKILL.md  ← symlink
    vendor/event4u/agent-config/.augment/skills/coder/SKILL.md  ← target

Relative: ../../../vendor/event4u/agent-config/.augment/skills/coder/SKILL.md
```

```php
private function createFileSymlink(string $targetAbsolute, string $linkAbsolute): bool
{
    $linkDir = dirname($linkAbsolute);
    if (!is_dir($linkDir)) {
        mkdir($linkDir, 0755, true);
    }

    // Calculate relative path from link directory to target file
    $relativePath = $this->getRelativePath($linkDir, $targetAbsolute);

    // Remove existing file/symlink at link location
    if (file_exists($linkAbsolute) || is_link($linkAbsolute)) {
        unlink($linkAbsolute);
    }

    if (!@symlink($relativePath, $linkAbsolute)) {
        // Fallback: copy on failure (Windows, restricted fs)
        copy($targetAbsolute, $linkAbsolute);
        $this->io->write(sprintf('<comment>  Symlink failed, copied: %s</comment>', basename($linkAbsolute)));
        return false;
    }

    return true;
}

### Step 1.4: Implement stale cleanup for hybrid mode

Current `syncDirectory()` only deletes stale **files**. The new method must also handle stale **symlinks** (broken or pointing to wrong targets):

```php
private function cleanStaleEntries(string $projectDir, array $sourceManifest): void
{
    // Collect all entries in project dir (files + symlinks)
    $projectEntries = $this->collectEntries($projectDir); // includes symlinks

    $stale = array_diff($projectEntries, $sourceManifest);

    foreach ($stale as $relative) {
        $path = $projectDir . '/' . $relative;
        if (is_file($path) || is_link($path)) {
            unlink($path);
            $this->io->write(sprintf('<comment>  Removed stale: %s</comment>', $relative));
        }
    }

    $this->removeEmptyDirectories($projectDir);
}
```

Also detect **broken symlinks** (target no longer exists) and remove them:

```php
// In cleanStaleEntries(), additionally:
foreach ($projectEntries as $relative) {
    $path = $projectDir . '/' . $relative;
    if (is_link($path) && !file_exists($path)) {
        // Broken symlink — target was deleted
        unlink($path);
        $this->io->write(sprintf('<comment>  Removed broken symlink: %s</comment>', $relative));
    }
}
```

- [x] Implement `cleanStaleEntries()` — handles files, symlinks, and broken symlinks
- [x] Implement `collectEntries()` — like `collectFiles()` but also includes symlinks
- [x] Test: broken symlink is detected and removed (Phase 4)

### Step 1.5: Update `install()` method

Replace the current `syncDirectory()` call with the new hybrid approach:

```php
public function install(Event $event): void
{
    $vendorDir = $event->getComposer()->getConfig()->get('vendor-dir');
    $packageDir = dirname(__DIR__);
    $projectRoot = dirname($vendorDir);

    // Hybrid sync: copy rules, symlink everything else
    $this->syncHybrid(
        $packageDir . '/.augment',
        $projectRoot . '/.augment',
        $vendorDir
    );

    $this->copyIfMissing($packageDir . '/AGENTS.md', $projectRoot . '/AGENTS.md');
    $this->copyIfMissing($packageDir . '/CLAUDE.md', $projectRoot . '/CLAUDE.md');
    $this->copyIfMissing(
        $packageDir . '/.github/copilot-instructions.md',
        $projectRoot . '/.github/copilot-instructions.md'
    );

    $this->io->write('<info>galawork/agent-config: agent configuration installed.</info>');
}
```

- [x] Update `install()` to use `syncHybrid()` instead of `syncDirectory()`
- [x] Pass `$vendorDir` for relative path calculation
- [x] Keep `copyIfMissing()` for AGENTS.md, CLAUDE.md, copilot-instructions.md

---

## Phase 2: Target project `.gitignore`

### Step 2.1: Auto-add `.gitignore` entries

The plugin should ensure symlinked directories are gitignored in the target project. Rules (copies) should NOT be gitignored — they're real files that may be project-specific.

Add to `install()`:

```php
$this->ensureGitignoreEntries($projectRoot, [
    '# Agent config — symlinked from vendor (auto-managed by galawork/agent-config)',
    '.augment/skills/',
    '.augment/commands/',
    '.augment/guidelines/',
    '.augment/templates/',
    '.augment/contexts/',
    '.augment/scripts/',
    '.augment/README.md',
    '',
    '# Agent config — NOT ignored (real copies, may contain project overrides)',
    '# .augment/rules/',
]);
```

```php
private function ensureGitignoreEntries(string $projectRoot, array $entries): void
{
    $gitignore = $projectRoot . '/.gitignore';
    $marker = '# galawork/agent-config';

    if (!file_exists($gitignore)) {
        return; // No .gitignore, don't create one
    }

    $content = file_get_contents($gitignore);

    // Check if our block already exists
    if (str_contains($content, $marker)) {
        return; // Already managed — don't duplicate
    }

    // Append our block
    $block = "\n" . $marker . "\n" . implode("\n", $entries) . "\n";
    file_put_contents($gitignore, $content . $block);
}
```

- [x] Implement `ensureGitignoreEntries()` method
- [x] Use marker comment to prevent duplicate blocks
- [x] Only append if `.gitignore` exists (don't create)
- [x] Don't modify if marker already present (idempotent)

### Step 2.2: Handle first-time migration

When a target project upgrades from the old copy-based plugin to the new symlink plugin,
there will be ~180 real files that need to become symlinks. The `syncHybrid()` method
handles this automatically:

1. For files that should be symlinks: delete the real file, create symlink
2. For files that should be copies: overwrite as before

- [x] Verify migration works: existing real files are replaced by symlinks
- [x] Verify rules stay as real copies (not replaced by symlinks)
- [x] Test: `is_link()` check before `unlink()` to avoid deleting user-created files

---

## Phase 3: Keep `syncDirectory()` as internal method

The old `syncDirectory()` should remain available for other sync operations that need
full copies (e.g., future tool-specific directory syncing from the multi-agent roadmap).

### Step 3.1: Rename and refactor

- [x] Keep `syncDirectory()` as-is (private, full copy mode)
- [x] `syncHybrid()` is the new primary method for `.augment/`
- [x] `install()` uses `syncHybrid()` for `.augment/`, `copyIfMissing()` for standalone files

---

## Phase 4: Tests

### Step 4.1: Unit tests for `shouldCopy()`

File: `tests/AgentConfigPluginTest.php`

- [x] `rules/php-coding.md` → returns `true` (copy)
- [x] `rules/scope-control.md` → returns `true` (copy)
- [x] `skills/coder/SKILL.md` → returns `false` (symlink)
- [x] `commands/compress.md` → returns `false` (symlink)
- [x] `guidelines/php/controllers.md` → returns `false` (symlink)
- [x] `README.md` → returns `false` (symlink)
- [x] `templates/roadmaps.md` → returns `false` (symlink)

### Step 4.2: Unit tests for `getRelativePath()`

- [x] Same directory → `filename`
- [x] One level up → `../filename`
- [x] Deep nesting → `../../../vendor/event4u/agent-config/.augment/skills/coder/SKILL.md`

### Step 4.3: Integration tests for `syncHybrid()`

Use temp directories to simulate package and project:

- [x] Rules are real copies (`is_file()` && `!is_link()`)
- [x] Skills/commands/etc. are symlinks (`is_link()`)
- [x] Symlinks resolve to correct target (content readable)
- [x] Stale files are removed
- [x] Broken symlinks are removed
- [x] Re-running is idempotent (no duplicates, no errors)

### Step 4.4: Integration test for copy fallback

- [x] Copy fallback implemented in `createFileSymlink()` — verified by code review
- [x] Warning message logged via `$this->io->write()`

### Step 4.5: Integration test for gitignore

- [x] Marker block is added to existing `.gitignore`
- [x] Block is NOT duplicated on re-run
- [x] No `.gitignore` is created if it doesn't exist
- [x] Rules directory is commented-out (not ignored)

### Step 4.6: Migration test

- [x] Existing real files in skills/ → replaced by symlinks after update
- [x] Existing real files in rules/ → stay as real files (overwritten, not symlinked)
- [x] Existing symlinks in rules/ → replaced by real copies

---

## Phase 5: Documentation & Commit

### Step 5.1: Update documentation

- [x] AGENTS.md is a template for target projects — no changes needed
- [x] `agents/features/multi-agent-compatibility.md` already references the Composer plugin
- [x] Add inline PHPDoc to all new methods in `AgentConfigPlugin.php`

### Step 5.2: Commit plan

| # | Scope | Commit message |
|---|---|---|
| 1 | Core refactor | `feat(plugin): hybrid sync — copy rules, symlink all other .augment/ content` |
| 2 | Gitignore | `feat(plugin): auto-manage .gitignore entries for symlinked agent config` |
| 3 | Tests | `test(plugin): add tests for hybrid sync, symlinks, and migration` |
| 4 | Documentation | `docs: document hybrid symlink strategy for agent-config plugin` |

### Step 5.3: Final verification

- [ ] `composer install` in a test project — rules are copies, rest are symlinks (needs real project test)
- [ ] `composer update event4u/agent-config` — stale entries cleaned, new entries synced (needs real project test)
- [x] `ls -la .augment/rules/` — real files (verified by testSyncHybridCopiesRules)
- [x] `ls -la .augment/skills/coder/` — symlinks (verified by testSyncHybridSymlinksSkills)
- [x] symlinks resolve to correct content (verified by test assertions)
- [x] `.gitignore` contains agent-config block (verified by testGitignoreAddsMarkerBlock)
- [ ] Augment Code loads all rules correctly (needs manual test)
- [ ] Augment Code loads skills/commands correctly via symlinks (needs manual test)

---

## Acceptance Criteria

- [x] `.augment/rules/` files are **real copies** in target projects (unit tested)
- [x] All other `.augment/` files are **relative symlinks** to vendor package (unit tested)
- [x] Stale files AND stale/broken symlinks are cleaned on update (unit tested)
- [x] Windows fallback: copy instead of symlink, with warning (implemented)
- [x] `.gitignore` entries auto-managed (symlinked dirs ignored, rules not) (unit tested)
- [x] Migration from old copy-based sync is seamless (unit tested)
- [x] Idempotent: re-running produces identical result (unit tested)
- [x] All tests pass (23 PHP + 49 Python)

## Notes

- `COPY_DIRS = ['rules']` is easily extendable if Augment adds symlink support for rules later → just remove `'rules'` from the array
- The `getRelativePath()` helper is also needed by the multi-agent roadmap (Phase 4) — reuse it
- Vendor dir path: use `$event->getComposer()->getConfig()->get('vendor-dir')`, NOT hardcoded `vendor/`
