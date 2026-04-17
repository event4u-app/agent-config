#!/usr/bin/env php
<?php

declare(strict_types=1);

/**
 * Agent Config — Project Bridge Installer (PHP wrapper)
 *
 * Thin wrapper that delegates to scripts/install.py. The actual installer logic
 * lives in Python so that it works for every installation channel (Composer, npm,
 * standalone) — not only PHP projects.
 *
 * Usage:
 *   php vendor/bin/install.php                     # defaults: cost_profile=minimal
 *   php vendor/bin/install.php --profile=balanced
 *   php vendor/bin/install.php --force
 *   php vendor/bin/install.php --skip-bridges
 */

$packageRoot = dirname(__DIR__);
$installer = $packageRoot . '/scripts/install.py';

if (! file_exists($installer)) {
    fwrite(STDERR, "  ❌  Installer script not found: {$installer}\n");
    exit(1);
}

$python = findPython();
if ($python === null) {
    fwrite(STDERR, "  ❌  Python 3 is required but was not found.\n");
    fwrite(STDERR, "      Install python3 and re-run, or invoke bash scripts/install.sh.\n");
    fwrite(STDERR, "      macOS: brew install python3\n");
    fwrite(STDERR, "      Debian/Ubuntu: apt install python3\n");
    exit(1);
}

// Forward all CLI arguments to the Python installer. Drop $argv[0] (this script).
$forwarded = array_slice($argv, 1);
$command = array_merge([$python, $installer], $forwarded);
$escaped = array_map('escapeshellarg', $command);

$exitCode = 0;
passthru(implode(' ', $escaped), $exitCode);
exit($exitCode);

function findPython(): ?string
{
    foreach (['python3', 'python'] as $candidate) {
        $path = trim((string) @shell_exec('command -v ' . escapeshellarg($candidate) . ' 2>/dev/null'));
        if ($path !== '') {
            return $path;
        }
    }

    return null;
}
