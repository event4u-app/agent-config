<?php

declare(strict_types=1);

function versionCompare(string $left, string $right): int
{
    [$leftCore, $leftTag] = extractTag($left);
    [$rightCore, $rightTag] = extractTag($right);

    $leftSegs = explode('.', $leftCore);
    $rightSegs = explode('.', $rightCore);

    for ($idx = 0; $idx < 3; $idx++) {
        $leftVal = (int) ($leftSegs[$idx] ?? 0);
        $rightVal = (int) ($rightSegs[$idx] ?? 0);

        if ($leftVal !== $rightVal) {
            return $leftVal < $rightVal ? -1 : 1;
        }
    }

    if ($leftTag === $rightTag) {
        return 0;
    }

    if ($leftTag === null) {
        return 1;
    }

    if ($rightTag === null) {
        return -1;
    }

    return strcmp($leftTag, $rightTag) < 0 ? -1 : 1;
}

/**
 * @return array{0: string, 1: string|null}
 */
function extractTag(string $ver): array
{
    $chunks = explode('-', $ver, 2);

    return [$chunks[0], $chunks[1] ?? null];
}
