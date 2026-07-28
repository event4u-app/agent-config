<?php

declare(strict_types=1);

/**
 * @template T
 * @param callable(): T $operation
 * @return T
 */
function retryWithBackoff(callable $operation, int $maxAttempts = 3, int $baseDelayMs = 100)
{
    $attempt = 0;
    $lastException = null;

    while ($attempt < $maxAttempts) {
        try {
            return $operation();
        } catch (\Throwable $exception) {
            $lastException = $exception;
            $attempt++;

            if ($attempt >= $maxAttempts) {
                break;
            }

            $delayMs = $baseDelayMs * (2 ** ($attempt - 1));
            usleep($delayMs * 1000);
        }
    }

    throw $lastException;
}
