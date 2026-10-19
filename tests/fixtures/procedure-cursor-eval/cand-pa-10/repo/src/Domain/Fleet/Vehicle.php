<?php

namespace FleetOps\Domain\Fleet;

final class Vehicle
{
    public function __construct(public readonly string $plate, public readonly int $odometerKm)
    {
    }
}
