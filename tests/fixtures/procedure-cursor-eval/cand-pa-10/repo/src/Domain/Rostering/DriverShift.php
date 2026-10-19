<?php

namespace FleetOps\Domain\Rostering;

final class DriverShift
{
    public function __construct(
        public readonly string $driverId,
        public readonly \DateTimeImmutable $start,
        public readonly \DateTimeImmutable $end,
    ) {
    }
}
