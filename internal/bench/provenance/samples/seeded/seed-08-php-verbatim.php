<?php

declare(strict_types=1);

/**
 * @param int[] $sortedValues
 */
function insertPosition(array $sortedValues, int $target): int
{
    $low = 0;
    $high = count($sortedValues);

    while ($low < $high) {
        $mid = intdiv($low + $high, 2);

        if ($sortedValues[$mid] < $target) {
            $low = $mid + 1;
        } else {
            $high = $mid;
        }
    }

    return $low;
}
