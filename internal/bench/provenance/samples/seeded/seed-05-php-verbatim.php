<?php

declare(strict_types=1);

function compareSemver(string $a, string $b): int
{
    [$aCore, $aPre] = splitPrerelease($a);
    [$bCore, $bPre] = splitPrerelease($b);

    $aParts = explode('.', $aCore);
    $bParts = explode('.', $bCore);

    for ($i = 0; $i < 3; $i++) {
        $aNum = (int) ($aParts[$i] ?? 0);
        $bNum = (int) ($bParts[$i] ?? 0);

        if ($aNum !== $bNum) {
            return $aNum < $bNum ? -1 : 1;
        }
    }

    if ($aPre === $bPre) {
        return 0;
    }

    if ($aPre === null) {
        return 1;
    }

    if ($bPre === null) {
        return -1;
    }

    return strcmp($aPre, $bPre) < 0 ? -1 : 1;
}

/**
 * @return array{0: string, 1: string|null}
 */
function splitPrerelease(string $version): array
{
    $parts = explode('-', $version, 2);

    return [$parts[0], $parts[1] ?? null];
}
