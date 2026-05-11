#!/usr/bin/env php
<?php

declare(strict_types=1);

/**
 * Agent Config — Project Installer (Composer wrapper)
 *
 * Thin wrapper that delegates to scripts/install, the primary orchestrator.
 * The orchestrator chains payload sync (install.sh) and bridge generation
 * (install.py); this wrapper only exists so that PHP/Composer users can
 * invoke it via `php vendor/bin/install.php` without knowing about bash.
 *
 * Usage:
 *   php vendor/bin/install.php                              # full install (every tool)
 *   php vendor/bin/install.php --profile=balanced           # pick cost profile
 *   php vendor/bin/install.php --tools=claude-code,cursor   # only those two surfaces
 *   php vendor/bin/install.php --tools=cursor --yes         # CI-friendly, single tool
 *   php vendor/bin/install.php --list-tools                 # show valid tool IDs
 *   php vendor/bin/install.php --force                      # overwrite existing bridges
 *   php vendor/bin/install.php --skip-bridges               # payload only
 *   php vendor/bin/install.php --skip-sync                  # bridges only
 *   php vendor/bin/install.php --help                       # full option list
 *
 * Valid --tools IDs (default: all):
 *   claude-code, claude-desktop, cursor, windsurf, cline,
 *   gemini-cli, copilot, augment, aider, codex, all
 */

$packageRoot = dirname(__DIR__);
$installer = $packageRoot . '/scripts/install';

if (! file_exists($installer)) {
    fwrite(STDERR, "  ❌  Installer script not found: {$installer}\n");
    exit(1);
}

// Forward all CLI arguments to the bash orchestrator. Drop $argv[0] (this script).
$forwarded = array_slice($argv, 1);
$command = array_merge(['bash', $installer], $forwarded);
$escaped = array_map('escapeshellarg', $command);

$exitCode = 0;
passthru(implode(' ', $escaped), $exitCode);
exit($exitCode);
