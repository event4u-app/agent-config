<?php

declare(strict_types=1);

final class Retrier
{
    public function __construct(
        private readonly int $maxAttempts = 3,
        private readonly int $delayMs = 100,
    ) {
    }

    /**
     * @template T
     * @param callable(): T $callback
     * @return T
     */
    public function run(callable $callback)
    {
        $attempts = 0;

        do {
            $attempts++;

            try {
                return $callback();
            } catch (\Throwable $e) {
                if ($attempts >= $this->maxAttempts) {
                    throw $e;
                }

                $sleepMs = $this->delayMs * $attempts * $attempts;
                usleep($sleepMs * 1000);
            }
        } while ($attempts < $this->maxAttempts);

        throw new \RuntimeException('unreachable');
    }
}
