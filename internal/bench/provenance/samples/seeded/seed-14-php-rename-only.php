<?php

declare(strict_types=1);

/**
 * @template T
 * @param callable(): T $task
 * @return T
 */
function withRetries(callable $task, int $tries = 3, int $initialDelayMs = 100)
{
    $count = 0;
    $failure = null;

    while ($count < $tries) {
        try {
            return $task();
        } catch (\Throwable $error) {
            $failure = $error;
            $count++;

            if ($count >= $tries) {
                break;
            }

            $waitMs = $initialDelayMs * (2 ** ($count - 1));
            usleep($waitMs * 1000);
        }
    }

    throw $failure;
}
