<?php

declare(strict_types=1);

/**
 * @param int[] $orderedItems
 */
function findInsertionIndex(array $orderedItems, int $needle): int
{
    $start = 0;
    $end = count($orderedItems);

    while ($start < $end) {
        $middle = intdiv($start + $end, 2);

        if ($orderedItems[$middle] < $needle) {
            $start = $middle + 1;
        } else {
            $end = $middle;
        }
    }

    return $start;
}
