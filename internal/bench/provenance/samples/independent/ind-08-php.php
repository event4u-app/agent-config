<?php

declare(strict_types=1);

/**
 * Returns the index at which $needle should be inserted into
 * $sorted to keep it in ascending order.
 *
 * @param int[] $sorted
 */
function lowerBound(array $sorted, int $needle): int
{
    $count = count($sorted);

    if ($count === 0) {
        return 0;
    }

    $left = 0;
    $right = $count - 1;

    while ($left <= $right) {
        $pivot = (int) floor(($left + $right) / 2);

        if ($sorted[$pivot] < $needle) {
            $left = $pivot + 1;
        } else {
            $right = $pivot - 1;
        }
    }

    return $left;
}
