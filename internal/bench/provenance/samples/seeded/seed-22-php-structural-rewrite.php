<?php

declare(strict_types=1);

/**
 * @template T
 * @param callable(): T $operation
 * @return T
 */
function retryWithBackoff(callable $operation, int $maxAttempts = 3, int $baseDelayMs = 100)
{
    return attemptOnce($operation, $maxAttempts, $baseDelayMs, 1);
}

/**
 * @template T
 * @param callable(): T $operation
 * @return T
 */
function attemptOnce(callable $operation, int $maxAttempts, int $baseDelayMs, int $attemptNumber)
{
    try {
        return $operation();
    } catch (\Throwable $exception) {
        if ($attemptNumber >= $maxAttempts) {
            throw $exception;
        }

        usleep(backoffDelayMs($baseDelayMs, $attemptNumber) * 1000);

        return attemptOnce($operation, $maxAttempts, $baseDelayMs, $attemptNumber + 1);
    }
}

function backoffDelayMs(int $baseDelayMs, int $attemptNumber): int
{
    return $baseDelayMs * (2 ** ($attemptNumber - 1));
}
