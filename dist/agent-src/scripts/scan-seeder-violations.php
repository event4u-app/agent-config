<?php

declare(strict_types=1);

/**
 * Scans all PhpDataSeeder data files for foreign key references that use raw seeder constants
 * instead of getReference(). Raw constants don't trigger lazy initialization of the referenced
 * seeder, causing "items not available" errors when seeders run in unpredictable order.
 *
 * Usage (inside Docker container):
 *   php .augment/scripts/scan-seeder-violations.php
 *
 * Used by: /fix-seeder command
 */

$seedersDir = __DIR__ . '/../../database/seeders';
$dataDir = __DIR__ . '/../../database/seeder-data/data';

if (!is_dir($seedersDir) || !is_dir($dataDir)) {
    echo "Error: seeders or data directory not found. Run from project root.\n";
    exit(1);
}

// Step 1: Build map of seeder short class name -> data file relative path
$seederMap = [];
$iterator = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($seedersDir));

foreach ($iterator as $file) {
    if ($file->getExtension() !== 'php') {
        continue;
    }

    $content = file_get_contents($file->getRealPath());

    if (preg_match('/class\s+(\w+)\s+extends\s+(?:Php|Json)DataSeeder/', $content, $classMatch)
        && preg_match('/\$dataFile\s*=\s*[\'"]([^\'"]+)[\'"]/', $content, $dataMatch)) {
        $seederMap[$classMatch[1]] = $dataMatch[1];
    }
}

// Known exceptions: circular dependencies where getReference() would cause infinite loops.
// Format: 'OwnerSeeder' => ['ReferencedSeeder', ...]
// Currently empty — all circular dependencies have been resolved via two-phase seeding
// (e.g., UserWageTypeRuleSeeder uses run() to apply project mappings after initReferences).
$exceptions = [];

// Step 2: For each data file, find violations
$violations = [];

foreach ($seederMap as $ownerSeeder => $dataFile) {
    $filePath = $dataDir . '/' . str_replace('\\', '/', $dataFile);

    if (!file_exists($filePath)) {
        continue;
    }

    $lines = file($filePath);

    if (!$lines) {
        continue;
    }

    $fileExtension = pathinfo($filePath, PATHINFO_EXTENSION);

    foreach ($lines as $lineNum => $line) {
        if (!preg_match_all('/(\w+Seeder)::([A-Z][A-Z0-9_]+)/', $line, $matches, PREG_SET_ORDER)) {
            continue;
        }

        foreach ($matches as $match) {
            $referencedSeeder = $match[1];
            $constant = $match[2];

            // Skip own seeder constants (primary keys are OK)
            if ($referencedSeeder === $ownerSeeder) {
                continue;
            }

            // Skip known exceptions (circular dependencies)
            if (isset($exceptions[$ownerSeeder]) && in_array($referencedSeeder, $exceptions[$ownerSeeder], true)) {
                continue;
            }

            // Skip if the line already contains getReference/getReferences for this seeder
            if (preg_match('/' . preg_quote($referencedSeeder, '/') . '::getReference/', $line)) {
                continue;
            }

            // Check multiline: previous line may have getReference(
            if ($lineNum > 0) {
                $prevLine = $lines[$lineNum - 1];
                if (preg_match('/' . preg_quote($referencedSeeder, '/') . '::getReference\s*\(\s*$/', trim($prevLine))) {
                    continue;
                }
            }

            $violations[] = [
                'file' => str_replace($dataDir . '/', '', $filePath),
                'line' => $lineNum + 1,
                'owner' => $ownerSeeder,
                'referenced' => $referencedSeeder,
                'constant' => $constant,
                'full' => $referencedSeeder . '::' . $constant,
                'lineContent' => trim($line),
                'extension' => $fileExtension,
            ];
        }
    }
}

// Step 3: Output results
if (empty($violations)) {
    echo "✅  No violations found.\n";
    exit(0);
}

$phpCount = count(array_filter($violations, static fn(array $v): bool => $v['extension'] === 'php'));
$jsonCount = count(array_filter($violations, static fn(array $v): bool => $v['extension'] === 'json'));

echo "Found " . count($violations) . " violation(s)";

if ($jsonCount > 0) {
    echo " ($phpCount in PHP files, $jsonCount in JSON files — JSON cannot be auto-fixed)";
}

echo ":\n\n";

printf("%-4s %-65s %-6s %-55s %s\n", '#', 'Data File', 'Line', 'Violation', 'Owner');
echo str_repeat('-', 185) . "\n";

foreach ($violations as $i => $v) {
    $prefix = $v['extension'] === 'json' ? '[JSON] ' : '';
    printf(
        "%-4d %-65s %-6d %-55s %s\n",
        $i + 1,
        $prefix . $v['file'],
        $v['line'],
        $v['full'],
        $v['owner']
    );
}

echo "\nPHP violations (auto-fixable): $phpCount\n";
echo "JSON violations (manual fix needed): $jsonCount\n";

