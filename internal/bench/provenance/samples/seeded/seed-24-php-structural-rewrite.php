<?php

declare(strict_types=1);

/**
 * @param int[] $sortedValues
 */
function insertPosition(array $sortedValues, int $target): int
{
    return searchRange($sortedValues, $target, 0, count($sortedValues));
}

/**
 * @param int[] $sortedValues
 */
function searchRange(array $sortedValues, int $target, int $low, int $high): int
{
    if ($low >= $high) {
        return $low;
    }

    $mid = intdiv($low + $high, 2);

    if ($sortedValues[$mid] < $target) {
        return searchRange($sortedValues, $target, $mid + 1, $high);
    }

    return searchRange($sortedValues, $target, $low, $mid);
}
