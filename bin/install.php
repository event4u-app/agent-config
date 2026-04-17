#!/usr/bin/env php
<?php

declare(strict_types=1);

/**
 * Agent Config — Project Bridge Installer
 *
 * Generates project bridge files (.agent-settings, .vscode/settings.json, etc.)
 * so that supported AI tools can discover agent-config from the project.
 *
 * Usage:
 *   php vendor/bin/install.php                          # defaults: profile=minimal
 *   php vendor/bin/install.php --profile=balanced       # specific profile
 *   php vendor/bin/install.php --force                  # overwrite existing files
 *   php vendor/bin/install.php --skip-bridges           # only create .agent-settings
 *
 * This script is idempotent — safe to run multiple times.
 * It never overwrites existing files unless --force is passed.
 */

const DEFAULT_PROFILE = 'minimal';
const SUPPORTED_PROFILES = ['minimal', 'balanced', 'full', 'enterprise'];

main($argv);

function main(array $argv): void
{
    $projectRoot = getcwd();
    if ($projectRoot === false) {
        fail('Could not determine current working directory.');
    }

    $options = parseOptions($argv);
    $profile = $options['profile'];

    if (! in_array($profile, SUPPORTED_PROFILES, true)) {
        fail(sprintf(
            'Unsupported profile: %s. Supported: %s',
            $profile,
            implode(', ', SUPPORTED_PROFILES),
        ));
    }

    $packageRoot = detectPackageRoot($projectRoot);
    $packageType = detectPackageType($packageRoot);

    echo PHP_EOL;
    info('Agent Config — Project Bridge Installer');
    info('Project:  ' . $projectRoot);
    info('Package:  ' . $packageRoot);
    info('Type:     ' . $packageType);
    info('Profile:  ' . $profile);
    echo PHP_EOL;

    // Always: create .agent-settings from profile preset
    ensureAgentSettings($projectRoot, $packageRoot, $profile, $options['force']);

    // Optional: create tool bridge files
    if (! $options['skip-bridges']) {
        ensureVsCodeBridge($projectRoot, $packageType, $options['force']);
        ensureAugmentBridge($projectRoot, $options['force']);
        ensureCopilotBridge($projectRoot, $options['force']);
    }

    echo PHP_EOL;
    success('Done.');
    echo PHP_EOL;
    echo '  Next steps:' . PHP_EOL;
    echo '  1. Open your agent and try: "Refactor this function"' . PHP_EOL;
    echo '  2. Commit .agent-settings and bridge files to your repo' . PHP_EOL;
    echo '  3. New team members just run composer install — done' . PHP_EOL;
    echo PHP_EOL;
}

function parseOptions(array $argv): array
{
    $options = [
        'profile' => DEFAULT_PROFILE,
        'force' => false,
        'skip-bridges' => false,
    ];

    foreach ($argv as $arg) {
        if (str_starts_with($arg, '--profile=')) {
            $options['profile'] = substr($arg, strlen('--profile='));
        }
        if ($arg === '--force') {
            $options['force'] = true;
        }
        if ($arg === '--skip-bridges') {
            $options['skip-bridges'] = true;
        }
    }

    return $options;
}

function detectPackageRoot(string $projectRoot): string
{
    $paths = [
        $projectRoot . '/vendor/event4u/agent-config',
        $projectRoot . '/node_modules/@event4u/agent-config',
    ];

    foreach ($paths as $path) {
        if (is_dir($path)) {
            return realpath($path) ?: $path;
        }
    }

    // Running from within the package itself (development mode)
    $selfMarker = $projectRoot . '/config/profiles/minimal.ini';
    if (file_exists($selfMarker)) {
        return $projectRoot;
    }

    fail('Could not find agent-config package. Run from a project with composer/npm install.');
}

function detectPackageType(string $packageRoot): string
{
    if (str_contains($packageRoot, '/vendor/')) {
        return 'composer';
    }
    if (str_contains($packageRoot, '/node_modules/')) {
        return 'npm';
    }

    return 'local';
}

function ensureAgentSettings(
    string $projectRoot,
    string $packageRoot,
    string $profile,
    bool $force,
): void {
    $target = $projectRoot . '/.agent-settings';
    $source = $packageRoot . '/config/profiles/' . $profile . '.ini';

    if (! file_exists($source)) {
        fail('Missing profile preset: ' . $source);
    }

    if (file_exists($target) && ! $force) {
        skip('.agent-settings already exists');
        return;
    }

    $content = file_get_contents($source);
    if ($content === false) {
        fail('Could not read profile preset: ' . $source);
    }

    writeFile($target, $content);
    success('.agent-settings created (profile: ' . $profile . ')');
}

function ensureVsCodeBridge(string $projectRoot, string $packageType, bool $force): void
{
    $target = $projectRoot . '/.vscode/settings.json';

    $pluginPath = match ($packageType) {
        'composer' => './vendor/event4u/agent-config/plugin/agent-config',
        'npm' => './node_modules/@event4u/agent-config/plugin/agent-config',
        default => './plugin/agent-config',
    };

    $bridge = [
        'chat.pluginLocations' => [
            $pluginPath => true,
        ],
    ];

    mergeJsonFile($target, $bridge, $force, '.vscode/settings.json');
}

function ensureAugmentBridge(string $projectRoot, bool $force): void
{
    $target = $projectRoot . '/.augment/settings.json';

    $bridge = [
        'enabledPlugins' => [
            'agent-config@event4u' => true,
        ],
    ];

    mergeJsonFile($target, $bridge, $force, '.augment/settings.json');
}

function ensureCopilotBridge(string $projectRoot, bool $force): void
{
    $target = $projectRoot . '/.github/plugin/marketplace.json';

    $bridge = [
        'marketplace' => [
            'name' => 'event4u-agent-marketplace',
            'plugins' => [
                [
                    'id' => 'agent-config@event4u',
                    'repository' => 'https://github.com/event4u-app/agent-config',
                ],
            ],
        ],
    ];

    if (file_exists($target) && ! $force) {
        skip('.github/plugin/marketplace.json already exists');
        return;
    }

    writeJsonFile($target, $bridge);
    success('.github/plugin/marketplace.json created');
}

// --- File utilities ---

function mergeJsonFile(string $path, array $newData, bool $force, string $label): void
{
    if (! file_exists($path)) {
        ensureDirectory(dirname($path));
        writeJsonFile($path, $newData);
        success($label . ' created');
        return;
    }

    $existing = readJsonFile($path);
    $merged = array_replace_recursive($existing, $newData);

    if ($merged === $existing) {
        skip($label . ' already configured');
        return;
    }

    if (! $force) {
        skip($label . ' exists, needs update (use --force)');
        return;
    }

    writeJsonFile($path, $merged);
    success($label . ' updated');
}

function readJsonFile(string $path): array
{
    $content = file_get_contents($path);
    if ($content === false) {
        fail('Could not read: ' . $path);
    }

    $decoded = json_decode($content, true);
    if (! is_array($decoded)) {
        warn('Invalid JSON in ' . $path . ', treating as empty');
        return [];
    }

    return $decoded;
}

function writeJsonFile(string $path, array $data): void
{
    $json = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    if ($json === false) {
        fail('Could not encode JSON for: ' . $path);
    }

    writeFile($path, $json . PHP_EOL);
}

function writeFile(string $path, string $content): void
{
    ensureDirectory(dirname($path));

    if (file_put_contents($path, $content) === false) {
        fail('Could not write: ' . $path);
    }
}

function ensureDirectory(string $path): void
{
    if (is_dir($path)) {
        return;
    }

    if (! mkdir($path, 0777, true) && ! is_dir($path)) {
        fail('Could not create directory: ' . $path);
    }
}

// --- Output helpers ---

function info(string $msg): void
{
    echo '  ' . $msg . PHP_EOL;
}

function success(string $msg): void
{
    echo '  ✅  ' . $msg . PHP_EOL;
}

function skip(string $msg): void
{
    echo '  ⏭️  ' . $msg . PHP_EOL;
}

function warn(string $msg): void
{
    echo '  ⚠️  ' . $msg . PHP_EOL;
}

function fail(string $msg): never
{
    fwrite(STDERR, '  ❌  ' . $msg . PHP_EOL);
    exit(1);
}
