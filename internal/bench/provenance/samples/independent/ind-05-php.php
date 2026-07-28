<?php

declare(strict_types=1);

/**
 * Compares two semantic version strings. Returns -1, 0, or 1.
 */
function semverCompare(string $v1, string $v2): int
{
    $p1 = parseVersion($v1);
    $p2 = parseVersion($v2);

    if ($p1['major'] !== $p2['major']) {
        return $p1['major'] < $p2['major'] ? -1 : 1;
    }
    if ($p1['minor'] !== $p2['minor']) {
        return $p1['minor'] < $p2['minor'] ? -1 : 1;
    }
    if ($p1['patch'] !== $p2['patch']) {
        return $p1['patch'] < $p2['patch'] ? -1 : 1;
    }

    $pre1 = $p1['pre'];
    $pre2 = $p2['pre'];

    if ($pre1 === $pre2) {
        return 0;
    }
    if ($pre1 === '') {
        return 1;
    }
    if ($pre2 === '') {
        return -1;
    }

    return strnatcmp($pre1, $pre2) < 0 ? -1 : 1;
}

/**
 * @return array{major: int, minor: int, patch: int, pre: string}
 */
function parseVersion(string $version): array
{
    $match = [];
    preg_match('/^(\d+)\.(\d+)\.(\d+)(?:-(.+))?$/', $version, $match);

    return [
        'major' => (int) ($match[1] ?? 0),
        'minor' => (int) ($match[2] ?? 0),
        'patch' => (int) ($match[3] ?? 0),
        'pre' => $match[4] ?? '',
    ];
}
